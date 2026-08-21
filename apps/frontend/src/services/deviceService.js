import apiClient from './apiClient';

const deviceService = {
  getAll: (params) => apiClient.get('/devices', params),
  getById: (id) => apiClient.get(`/devices/${id}`),
  create: (data) => apiClient.post('/devices', data),
  update: (id, data) => apiClient.put(`/devices/${id}`, data),
  delete: (id) => apiClient.delete(`/devices/${id}`),
  sendCommand: (id, payload) => apiClient.post(`/devices/${id}/commands`, payload),
  heartbeat: (id) => apiClient.post(`/devices/${id}/heartbeat`),
  createPairingToken: (homeId) => apiClient.post('/devices/pairing-tokens', { homeId }),
};

export default deviceService;
