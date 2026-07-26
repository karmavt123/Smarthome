const dashboardService = require('../services/dashboard.service');
const serialize = require('../utils/serialize');

async function show(req, res) {
  const dashboard = await dashboardService.getDashboard(req.user.sub, req.query.home_id);
  res.json(serialize(dashboard));
}

module.exports = { show };
