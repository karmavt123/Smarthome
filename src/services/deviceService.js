import apiClient from './apiClient';

const deviceService = {
  getAll: () => apiClient.get('/devices'),
  getById: (id) => apiClient.get(`/devices/${id}`),
  create: (data) => apiClient.post('/devices', data),
  update: (id, data) => apiClient.put(`/devices/${id}`, data),
  delete: (id) => apiClient.delete(`/devices/${id}`),
  toggle: (id) => apiClient.patch(`/devices/${id}/toggle`),
};

export default deviceService;
