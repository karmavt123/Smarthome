import apiClient from './apiClient';

const voiceCommandService = {
  send: (text, homeId) => apiClient.post('/voice-commands', { text, homeId }),
};

export default voiceCommandService;
