import apiClient from './apiClient';

const deviceService = {
  getAll: () => apiClient.get('/devices'),
  getById: (id) => apiClient.get(`/devices/${id}`),
  create: (data) => apiClient.post('/devices', data),
  update: (id, data) => apiClient.put(`/devices/${id}`, data),
  delete: (id) => apiClient.delete(`/devices/${id}`),
  sendCommand: (id, payload) => apiClient.post(`/devices/${id}/commands`, payload),
  heartbeat: (id) => apiClient.post(`/devices/${id}/heartbeat`),
};

export default deviceService;
