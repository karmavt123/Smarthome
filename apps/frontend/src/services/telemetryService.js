import apiClient from './apiClient';

const telemetryService = {
  sendReadings: (payload) => apiClient.post('/telemetry/readings', payload),
  getSensorReadings: (sensorId, params) => apiClient.get(`/sensors/${sensorId}/readings`, params),
  // One row per day, aggregated by MySQL — use this for trend charts instead of pulling
  // raw readings and averaging them in the browser.
  getDailyAverages: (sensorId, params) =>
    apiClient.get(`/sensors/${sensorId}/readings/daily`, params),
};

export default telemetryService;
