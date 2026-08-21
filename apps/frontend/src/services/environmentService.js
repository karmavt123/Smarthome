import apiClient from './apiClient';

const environmentService = {
  // Response is { homeId, serverTime, environment: {...} } — callers read
  // `.environment` off the result themselves.
  get: (homeId) => apiClient.get('/environment', { homeId }),
};

export default environmentService;
