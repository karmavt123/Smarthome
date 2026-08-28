const crypto = require("crypto");
const mqtt = require("mqtt");
const prisma = require("../config/prisma");

// Pub/sub qua Adafruit IO (broker MQTT có sẵn, không qua Ohstem Cloud). Mỗi thiết bị có
// hai feed riêng, đặt tên theo device_code — không cần thêm cột DB nào:
//   <device_code>-command : Node publish, board subscribe (lệnh)
//   <device_code>-state   : board publish, Node subscribe (báo trạng thái/ack)
// Payload là chuỗi đơn giản (ON/OFF/OPEN/CLOSE/số/hex màu) — board Yolobit dùng khối lệnh
// MQTT của Adafruit IO, không parse JSON được tiện.
//
// Thiết bị loại "sensor" (device_type = sensor) thêm một feed riêng mỗi loại số đo:
//   <device_code>-temperature / -humidity / -light : board publish, Node subscribe
// Payload là số thô (vd "28.5"), Node tự map sang sensors.sensor_type tương ứng rồi
// gọi thẳng telemetry.service.js's storeReadings() — bỏ qua requireAuth/JWT vì kênh
// MQTT (key Adafruit IO) đã là biên tin cậy, giống hệt cách device_commands hoạt động.

const SENSOR_TYPES = ["temperature", "humidity", "light"];

const COMMAND_PAYLOAD_BY_ACTION = {
  turn_on: "ON",
  turn_off: "OFF",
  open: "OPEN",
  close: "CLOSE",
};

function commandPayload(action, value) {
  if (action in COMMAND_PAYLOAD_BY_ACTION)
    return COMMAND_PAYLOAD_BY_ACTION[action];
  return String(value);
}

// Adafruit IO feed keys are always lowercase — it only echoes MQTT publishes back out
// on the feed's canonical key/id topics, never on the literal (possibly mixed-case)
// topic string a publisher used. A board subscribed on the exact device_code casing
// (e.g. "YoloBit-A82F-fan-command") never sees a command published with mismatched
// case, since Adafruit re-routes it to "yolobit-a82f-fan-command" instead. Lowercase
// here so it matches the canonical key the board must also subscribe on.
function commandTopic(username, deviceCode) {
  return `${username}/feeds/${deviceCode.toLowerCase()}-command`;
}

function stateTopic(username, deviceCode) {
  return `${username}/feeds/${deviceCode.toLowerCase()}-state`;
}

function stateWildcard(username) {
  return `${username}/feeds/+`;
}

function sensorTopic(username, deviceCode, sensorType) {
  return `${username}/feeds/${deviceCode.toLowerCase()}-${sensorType}`;
}

// Trả về { deviceCode, sensorType } nếu feedKey khớp "<deviceCode>-<sensorType>" với
// sensorType nằm trong SENSOR_TYPES, ngược lại null.
function parseSensorFeedKey(feedKey) {
  for (const sensorType of SENSOR_TYPES) {
    const suffix = `-${sensorType}`;
    if (feedKey.endsWith(suffix)) {
      return { deviceCode: feedKey.slice(0, -suffix.length), sensorType };
    }
  }
  return null;
}

let client = null;
let aioUsername = null;

// Board gửi nhiều feed (vd temperature + humidity) gần như cùng lúc — mỗi message
// nếu xử lý song song sẽ tự mở transaction riêng, cùng UPDATE 1 devices row
// (last_seen_at/connection_status) → MySQL deadlock (P2034). Chạy tuần tự qua
// 1 queue duy nhất để loại bỏ hoàn toàn khả năng 2 transaction đụng nhau.
let messageQueue = Promise.resolve();

function enqueueMessage(handler) {
  const result = messageQueue.then(handler);
  // Nuốt lỗi ở đây để 1 message fail không chặn message sau trong queue — lỗi
  // thật vẫn được xử lý/log ở .catch() của caller trên promise trả về.
  messageQueue = result.catch(() => {});
  return result;
}

function isEnabled() {
  return Boolean(
    process.env.ADAFRUIT_IO_USERNAME && process.env.ADAFRUIT_IO_KEY,
  );
}

async function handleDeviceState(deviceCode) {
  const device = await prisma.devices.findFirst({
    where: { device_code: deviceCode },
  });
  if (!device) return;

  const command = await prisma.device_commands.findFirst({
    where: { device_id: device.id, status: { in: ["pending", "delivered"] } },
    orderBy: { created_at: "desc" },
  });
  if (!command) return;

  // Board thật không gửi lại command id (giới hạn khối lệnh MQTT của Yolobit) — coi tin
  // trạng thái mới nhất trên feed là board đã làm xong lệnh đang chờ gần nhất của nó.
  const { finalizeCommand } = require("./device-command.service");
  await finalizeCommand(command.id, "executed");
}

async function handleSensorReading(deviceCode, sensorType, rawPayload) {
  console.log("deviceCode", deviceCode);
  console.log("rawPayload", rawPayload);
  console.log("sensorType", sensorType);
  const device = await prisma.devices.findFirst({
    where: { device_code: deviceCode },
  });
  console.log("device", device);
  if (!device) return;

  const sensor = await prisma.sensors.findUnique({
    where: {
      device_id_sensor_type: { device_id: device.id, sensor_type: sensorType },
    },
  });
  console.log("sensor", sensor);
  if (!sensor) return;

  const { storeReadings } = require("./telemetry.service");
  await storeReadings(
    device,
    [{ sensor, rawValue: rawPayload }],
    new Date(),
    `mqtt:${crypto.randomUUID()}`,
  );
}

function connect() {
  if (client) return client;
  if (!isEnabled()) {
    console.log(
      "MQTT: ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY chưa đặt — bỏ qua pub/sub thiết bị thật.",
    );
    return null;
  }

  aioUsername = process.env.ADAFRUIT_IO_USERNAME;
  client = mqtt.connect("mqtts://io.adafruit.com", {
    port: 8883,
    username: aioUsername,
    password: process.env.ADAFRUIT_IO_KEY,
    clientId: `smarthome-backend-${Math.random().toString(16).slice(2)}`,
    reconnectPeriod: 2000,
  });

  client.on("connect", () => {
    console.log("MQTT: connected to Adafruit IO");
    client.subscribe(stateWildcard(aioUsername));
  });

  client.on("message", (topic, payload) => {
    const feedKey = topic.split("/feeds/")[1];
    if (!feedKey) return;

    if (feedKey.endsWith("-state")) {
      const deviceCode = feedKey.slice(0, -"-state".length);
      enqueueMessage(() => handleDeviceState(deviceCode)).catch((error) => {
        console.error(
          `MQTT: failed to process state for ${deviceCode}:`,
          error,
        );
      });
      return;
    }

    const sensorFeed = parseSensorFeedKey(feedKey);
    if (sensorFeed) {
      enqueueMessage(() =>
        handleSensorReading(
          sensorFeed.deviceCode,
          sensorFeed.sensorType,
          payload.toString(),
        ),
      ).catch((error) => {
        console.error(
          `MQTT: failed to process ${sensorFeed.sensorType} reading for ${sensorFeed.deviceCode}:`,
          error,
        );
      });
    }
  });

  client.on("error", (error) => {
    console.error("MQTT: connection error:", error.message);
  });

  return client;
}

function disconnect() {
  if (!client) return;
  client.end(true);
  client = null;
}

function publishCommand(device, command) {
  if (!client || !aioUsername) return;
  const payload = commandPayload(command.action, command.value);
  console.log("device", device);
  console.log("client", client.publish);
  console.log("payload", payload);
  const result = client.publish(
    commandTopic(aioUsername, device.device_code),
    payload,
  );
  console.log("result", result);
}

module.exports = {
  connect,
  disconnect,
  publishCommand,
  isEnabled,
  // exported for tests
  commandPayload,
  commandTopic,
  stateTopic,
  sensorTopic,
  parseSensorFeedKey,
};
