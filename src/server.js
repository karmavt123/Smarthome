const app = require('./app');
const simulatorRuntime = require('./simulator/runtime');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`smarthome-backend listening on port ${PORT}`);
  simulatorRuntime.start();
});

function shutdown() {
  simulatorRuntime.stop();
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
