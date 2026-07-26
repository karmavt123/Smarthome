import apiClient from './apiClient';

const simulatorService = {
  bootstrap: () => apiClient.post('/simulator/bootstrap'),
  setConnectivity: (deviceId, paused) =>
    apiClient.patch(`/simulator/devices/${deviceId}/connectivity`, { paused }),
};

export default simulatorService;
