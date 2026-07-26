import { faLightbulb, faFan, faLock, faMicrochip } from '@fortawesome/free-solid-svg-icons';

export const CONTROLLABLE_TYPES = ['light', 'fan', 'door'];

export const DEVICE_TYPE_ICON = { light: faLightbulb, fan: faFan, door: faLock, sensor: faMicrochip };

// `optimisticAction` (from useDeviceCommand) reflects a click that hasn't been
// confirmed by the server yet — while set, it wins over the real device.status
// so the UI flips instantly instead of waiting on the async command.
export function isDeviceOn(device, optimisticAction) {
  if (optimisticAction) {
    return device.deviceType === 'door' ? optimisticAction === 'open' : optimisticAction === 'turn_on';
  }
  return device.deviceType === 'door' ? device.status === 'open' : device.status === 'on';
}

export function getNextAction(device, optimisticAction) {
  const isOn = isDeviceOn(device, optimisticAction);
  if (device.deviceType === 'door') return isOn ? 'close' : 'open';
  return isOn ? 'turn_off' : 'turn_on';
}

export function getStatusLabel(device, optimisticAction) {
  if (!optimisticAction && device.connectionStatus === 'offline') return 'Mất kết nối';
  const isOn = isDeviceOn(device, optimisticAction);
  if (device.deviceType === 'door') return isOn ? 'Đang mở' : 'Đã đóng';
  return isOn ? 'Đang bật' : 'Đang tắt';
}
