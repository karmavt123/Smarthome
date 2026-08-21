import apiClient from './apiClient';

const telemetryService = {
  sendReadings: (payload) => apiClient.post('/telemetry/readings', payload),
  getSensorReadings: (sensorId, params) => apiClient.get(`/sensors/${sensorId}/readings`, params),
};

export default telemetryService;
