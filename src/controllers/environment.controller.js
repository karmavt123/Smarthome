const environmentService = require('../services/environment.service');
const serialize = require('../utils/serialize');

async function show(req, res) {
  const result = await environmentService.getEnvironment(req.user.sub, req.query.home_id);
  res.json(serialize(result));
}

module.exports = { show };
