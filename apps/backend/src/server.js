require('./config/env').validateEnv();

const app = require('./app');
const simulatorRuntime = require('./simulator/runtime');
const mqttClient = require('./mqtt/client');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`smarthome-backend listening on port ${PORT}`);
  simulatorRuntime.start();
  mqttClient.start();
});

function shutdown() {
  simulatorRuntime.stop();
  mqttClient.stop();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
