const prisma = require('../config/prisma');
const { publish } = require('./client');
const { OUTBOUND } = require('./channel-map');

// Yolo:Bit chi nhan "0"/"1", khong co duong phan hoi -> mo hinh LAC QUAN.
// Su that duy nhat ve tinh trang board la connection_status, do telemetry
// that (V1-V3) cap nhat. Rut dien -> het telemetry -> offline sau 15s ->
// lenh sau do that bai dung.
const PAYLOAD_BY_ACTION = {
  turn_on: '1',
  turn_off: '0',
  open: '1',
  close: '0',
};

async function dispatch(commandId) {
  // Require tai cho: mqtt/commands can finalizeCommand tu device-command.service,
  // ma file do lai goi nguoc sang day. Require luc chay thi ca hai da nap xong.
  const { finalizeCommand } = require('../services/device-command.service');

  const command = await prisma.device_commands.findUnique({
    where: { id: commandId },
    include: { devices: true },
  });
  if (!command || !['pending', 'delivered'].includes(command.status)) return;

  const channel = OUTBOUND[command.devices.device_code];
  if (!channel) {
    return finalizeCommand(command.id, 'failed', 'Thiet bi khong co kenh MQTT');
  }

  if (command.devices.connection_status !== 'online') {
    return finalizeCommand(command.id, 'failed', 'Device is offline');
  }

  const payload = PAYLOAD_BY_ACTION[command.action];
  if (payload == null) {
    return finalizeCommand(
      command.id,
      'failed',
      `Hanh dong ${command.action} chua ho tro qua MQTT`,
    );
  }

  if (!publish(channel, payload)) {
    return finalizeCommand(command.id, 'failed', 'Mat ket noi MQTT');
  }

  console.log(`[mqtt] -> ${channel} = ${payload}  (${command.action} ${command.devices.device_code})`);
  return finalizeCommand(command.id, 'executed');
}

function scheduleMqttCommand(commandId) {
  setImmediate(() => {
    dispatch(commandId).catch((err) => console.error('[mqtt] dispatch loi:', err.message));
  });
}

module.exports = { scheduleMqttCommand };
