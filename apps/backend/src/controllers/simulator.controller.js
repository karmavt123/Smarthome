const simulatorService = require('../services/simulator.service');
const serialize = require('../utils/serialize');

async function bootstrap(req, res) {
  const result = await simulatorService.bootstrapSimulator(req.user.sub);
  res.status(201).json(serialize(result));
}

async function connectivity(req, res) {
  const result = await simulatorService.setDevicePaused(
    req.user.sub,
    req.params.id,
    req.body.paused
  );
  res.json(serialize(result));
}

module.exports = { bootstrap, connectivity };
