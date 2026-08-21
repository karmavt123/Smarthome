const pausedDeviceIds = new Set();

function isSimulatedDevice(device) {
  return typeof device?.device_code === 'string' && device.device_code.startsWith('sim-');
}

function isDevicePaused(deviceId) {
  return pausedDeviceIds.has(Number(deviceId));
}

function setDeviceSimulationPaused(deviceId, paused) {
  const numericId = Number(deviceId);
  if (paused) pausedDeviceIds.add(numericId);
  else pausedDeviceIds.delete(numericId);
}

function decorateSimulatorDevice(device) {
  return {
    ...device,
    is_simulated: isSimulatedDevice(device),
    simulation_paused: isDevicePaused(device.id),
  };
}

module.exports = {
  isSimulatedDevice,
  isDevicePaused,
  setDeviceSimulationPaused,
  decorateSimulatorDevice,
};
