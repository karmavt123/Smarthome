import apiClient from './apiClient';

const roomService = {
  getAll: (homeId) => apiClient.get('/rooms', { home_id: homeId }),
  create: (data) => apiClient.post('/rooms', data),
  update: (id, data) => apiClient.patch(`/rooms/${id}`, data),
  delete: (id) => apiClient.delete(`/rooms/${id}`),
};

export default roomService;
