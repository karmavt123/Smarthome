import apiClient from './apiClient';

const alertService = {
  listRules: (params) => apiClient.get('/alert-rules', params),
  createRule: (data) => apiClient.post('/alert-rules', data),
  updateRule: (id, data) => apiClient.patch(`/alert-rules/${id}`, data),
  deleteRule: (id) => apiClient.delete(`/alert-rules/${id}`),
  getAll: (homeId, params) => apiClient.get('/alerts', { homeId, ...params }),
  updateAlert: (id, data) => apiClient.patch(`/alerts/${id}`, data),
};

export default alertService;
