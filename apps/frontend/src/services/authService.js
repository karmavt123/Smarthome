import apiClient from './apiClient';

const authService = {
  signUp: (payload) => apiClient.post('/auth/sign-up', payload),
  signIn: (payload) => apiClient.post('/auth/sign-in', payload),
  refreshToken: (refreshToken) => apiClient.post('/auth/refresh-token', { refreshToken }),
  signOut: (refreshToken) => apiClient.post('/auth/sign-out', { refreshToken }),
};

export default authService;
