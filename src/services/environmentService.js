import apiClient from './apiClient';

const environmentService = {
  get: (homeId) => apiClient.get('/environment', { homeId }),
};

export default environmentService;
