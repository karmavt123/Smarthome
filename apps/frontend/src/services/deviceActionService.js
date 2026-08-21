import apiClient from './apiClient';

const deviceActionService = {
  list: (params) => apiClient.get('/device-actions', params),
  getById: (id) => apiClient.get(`/device-actions/${id}`),
};

export default deviceActionService;
