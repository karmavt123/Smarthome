// Anh xa kenh ao OhStem <-> ban ghi thiet bi trong DB.
//
// Board Yolo:Bit la MOT thiet bi vat ly, nhung trong DB no la 4 ban ghi `devices`
// vi cot device_type chi nhan mot gia tri. Tien to chung `yolobit-` la thu duy nhat
// noi chung lai voi nhau.

const BOARD_PREFIX = 'yolobit-';
const SENSOR_DEVICE_CODE = 'yolobit-sensor';

// board -> server
const INBOUND = {
  V1: { deviceCode: SENSOR_DEVICE_CODE, sensorType: 'temperature' },
  V2: { deviceCode: SENSOR_DEVICE_CODE, sensorType: 'humidity' },
  V3: { deviceCode: SENSOR_DEVICE_CODE, sensorType: 'light' },
};

// server -> board
const OUTBOUND = {
  'yolobit-light': 'V4',
  'yolobit-fan': 'V5',
  'yolobit-door': 'V6',
};

function isBoardDevice(device) {
  return typeof device?.device_code === 'string'
    && device.device_code.startsWith(BOARD_PREFIX);
}

const BOARD_DEVICE_CODES = [SENSOR_DEVICE_CODE, ...Object.keys(OUTBOUND)];
module.exports = { BOARD_PREFIX, SENSOR_DEVICE_CODE, INBOUND, OUTBOUND, isBoardDevice, BOARD_DEVICE_CODES };
