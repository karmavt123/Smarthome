import apiClient from './apiClient';

const doorAccessService = {
  listEvents: (params) => apiClient.get('/door-access/events', params),
  createEvent: (payload) => apiClient.post('/door-access/events', payload),
  verifyFace: (formData) => apiClient.postForm('/door-access/verify-face', formData),
  verifyPin: (data) => apiClient.post('/door-access/verify-pin', data),
  getFaceLockStatus: (doorDeviceId) =>
    apiClient.get('/door-access/face-lock-status', { doorDeviceId }),
  getPinStatus: (doorDeviceId) =>
    apiClient.get('/door-access/pin-status', { door_device_id: doorDeviceId }),
  // currentPin is required by the backend whenever a PIN already exists — changing it
  // without proving knowledge of the old one would bypass the lockout.
  setPin: (doorDeviceId, pin, currentPin) =>
    apiClient.put(`/door-access/${doorDeviceId}/pin`, { pin, currentPin }),
  getFaceHistory: (params) => apiClient.get('/door-access/face-history', params),
  getPinHistory: (params) => apiClient.get('/door-access/pin-history', params),
};

export default doorAccessService;
