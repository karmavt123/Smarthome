import apiClient from './apiClient';

const voiceCommandService = {
  send: (recognizedText) => apiClient.post('/voice-commands', { recognizedText }),
};

export default voiceCommandService;
