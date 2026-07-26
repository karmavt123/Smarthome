import apiClient from './apiClient';

const dashboardService = {
  get: (homeId) => apiClient.get('/dashboard', { home_id: homeId }),
};

export default dashboardService;
