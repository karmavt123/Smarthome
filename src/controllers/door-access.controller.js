const doorAccessService = require('../services/door-access.service');
const serialize = require('../utils/serialize');

async function create(req, res) {
  const result = await doorAccessService.createDoorAccessEvent(req.user.sub, req.body);
  res.status(201).json(serialize(result));
}

async function index(req, res) {
  const result = await doorAccessService.listDoorAccessEvents(req.user.sub, req.query);
  res.json(serialize(result));
}

module.exports = { create, index };
