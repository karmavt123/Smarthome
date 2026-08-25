require('./config/env').validateEnv();

const app = require('./app');
const simulatorRuntime = require('./simulator/runtime');
const mqttService = require('./services/mqtt.service');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`smarthome-backend listening on port ${PORT}`);
  simulatorRuntime.start();
  mqttService.connect();
});

function shutdown() {
  simulatorRuntime.stop();
  mqttService.disconnect();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
