import apiClient from './apiClient';

const doorAccessService = {
  listEvents: (params) => apiClient.get('/door-access/events', params),
  createEvent: (payload) => apiClient.post('/door-access/events', payload),
};

export default doorAccessService;
