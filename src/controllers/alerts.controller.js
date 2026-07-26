const alertService = require('../services/alert-management.service');
const serialize = require('../utils/serialize');

async function rulesIndex(req, res) {
  res.json(serialize(await alertService.listAlertRules(req.user.sub, req.query.home_id)));
}

async function rulesCreate(req, res) {
  res.status(201).json(serialize(await alertService.createAlertRule(req.user.sub, req.body)));
}

async function rulesUpdate(req, res) {
  res.json(serialize(await alertService.updateAlertRule(req.user.sub, req.params.id, req.body)));
}

async function alertsIndex(req, res) {
  res.json(serialize(await alertService.listAlerts(req.user.sub, req.query)));
}

async function alertsUpdate(req, res) {
  res.json(serialize(await alertService.updateAlert(req.user.sub, req.params.id, req.body.status)));
}

module.exports = { rulesIndex, rulesCreate, rulesUpdate, alertsIndex, alertsUpdate };
