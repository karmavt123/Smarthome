const mqtt = require('mqtt');
const prisma = require('../config/prisma');
const { storeReadings } = require('../services/telemetry.service');
const { INBOUND, BOARD_PREFIX } = require('./channel-map');

let client = null;

function topicFor(channel) {
  return `${process.env.MQTT_USERNAME}/feeds/${channel}`;
}

// "khoa123/feeds/V1" -> "V1"
function channelFromTopic(topic) {
  return topic.split('/').pop();
}

// storeReadings chi danh dau ban ghi `sensor` la online. Ba ban ghi con lai cua
// cung mot board se mai mai offline -> moi lenh dieu khien bi tu choi
// "Device is offline". Cham ca 4 cung luc.
function markBoardOnline() {
  return prisma.devices.updateMany({
    where: { device_code: { startsWith: BOARD_PREFIX } },
    data: { last_seen_at: new Date(), connection_status: 'online' },
  });
}

async function handleReading(channel, raw) {
  const mapping = INBOUND[channel];
  if (!mapping) return; // kenh chieu xuong (V4-V6) hoac kenh la - bo qua

  const value = Number(String(raw).trim());
  if (!Number.isFinite(value)) {
    console.warn(`[mqtt] ${channel}: khong phai so: "${raw}"`);
    return;
  }

  const device = await prisma.devices.findFirst({
    where: { device_code: mapping.deviceCode },
    include: { sensors: true },
  });
  if (!device) {
    console.warn(`[mqtt] thieu thiet bi ${mapping.deviceCode} - chay prisma/bootstrap-board.js`);
    return;
  }

  const sensor = device.sensors.find((s) => s.sensor_type === mapping.sensorType);
  if (!sensor) {
    console.warn(`[mqtt] ${mapping.deviceCode} chua co cam bien ${mapping.sensorType}`);
    return;
  }

  // messageId phai DUY NHAT - trung se bi coi la ban sao va bo qua IM LANG.
  await storeReadings(device, [{ sensor, rawValue: value }], new Date(), `mqtt:${channel}:${Date.now()}`);
  await markBoardOnline();

  console.log(`[mqtt] ${channel} = ${value} ${sensor.unit}`);
}

function start() {
  if (process.env.MQTT_ENABLED !== 'true') {
    console.log('[mqtt] MQTT_ENABLED khac "true" - bo qua');
    return;
  }
  if (!process.env.MQTT_USERNAME) {
    console.error('[mqtt] thieu MQTT_USERNAME - khong ket noi');
    return;
  }

  const url = process.env.MQTT_BROKER_URL || 'mqtt://mqtt.ohstem.vn:1883';
  client = mqtt.connect(url, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD || '',
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    const topic = topicFor('#');
    client.subscribe(topic, (err) => {
      if (err) console.error('[mqtt] subscribe that bai:', err.message);
      else console.log(`[mqtt] da ket noi ${url}, dang nghe ${topic}`);
    });
  });

  client.on('message', (topic, payload) => {
    handleReading(channelFromTopic(topic), payload.toString())
      .catch((err) => console.error(`[mqtt] xu ly ${topic} loi:`, err.message));
  });

  client.on('error', (err) => console.error('[mqtt] loi:', err.message));
  client.on('reconnect', () => console.log('[mqtt] dang ket noi lai...'));
}

function stop() {
  if (client) { client.end(true); client = null; }
}

function publish(channel, value) {
  if (!client || !client.connected) return false;
  client.publish(topicFor(channel), String(value));
  return true;
}

module.exports = { start, stop, publish };
