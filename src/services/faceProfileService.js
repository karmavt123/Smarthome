import apiClient from './apiClient';

// This endpoint uses camelCase `homeId` in the query string, unlike most other
// list endpoints (dashboard/rooms/alerts use snake_case `home_id`) — confirmed
// against docs/FACE-ID-USAGE.md, not a typo.
const faceProfileService = {
  getAll: (homeId) => apiClient.get('/face-profiles', { homeId }),
  create: (formData) => apiClient.postForm('/face-profiles', formData),
  delete: (id) => apiClient.delete(`/face-profiles/${id}`),
};

export default faceProfileService;
