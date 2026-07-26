import apiClient from './apiClient';

const homeService = {
  getAll: () => apiClient.get('/homes'),
  create: (data) => apiClient.post('/homes', data),
  update: (id, data) => apiClient.patch(`/homes/${id}`, data),
  delete: (id) => apiClient.delete(`/homes/${id}`),
};

export default homeService;
