import apiClient from './apiClient';

const doorAccessService = {
  listEvents: (params) => apiClient.get('/door-access/events', params),
  createEvent: (payload) => apiClient.post('/door-access/events', payload),
  verifyFace: (formData) => apiClient.postForm('/door-access/verify-face', formData),
  verifyPin: (data) => apiClient.post('/door-access/verify-pin', data),
  getFaceLockStatus: (doorDeviceId) =>
    apiClient.get('/door-access/face-lock-status', { doorDeviceId }),
  // Confirmed param name is snake_case here (unlike face-lock-status's
  // camelCase `doorDeviceId`) — not a typo, that's just how this route parses it.
  getPinStatus: (doorDeviceId) =>
    apiClient.get('/door-access/pin-status', { door_device_id: doorDeviceId }),
  setPin: (doorDeviceId, pin) => apiClient.put(`/door-access/${doorDeviceId}/pin`, { pin }),
};

export default doorAccessService;
