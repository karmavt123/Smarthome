const deviceCommandService = require('../services/device-command.service');
const serialize = require('../utils/serialize');

async function create(req, res) {
  const result = await deviceCommandService.createDeviceCommand(
    req.user.sub,
    req.params.id,
    req.body.action,
    'app',
    req.body.value,
    req.body.command_id
  );
  res.status(202).json(serialize(result));
}

async function show(req, res) {
  const result = await deviceCommandService.getDeviceAction(req.user.sub, req.params.id);
  res.json(serialize(result));
}

async function index(req, res) {
  const result = await deviceCommandService.listDeviceActions(req.user.sub, req.query);
  res.json(serialize(result));
}

module.exports = { create, show, index };
