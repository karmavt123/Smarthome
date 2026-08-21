const telemetryService = require('../services/telemetry.service');
const serialize = require('../utils/serialize');

async function ingest(req, res) {
  const result = await telemetryService.ingestBatch(req.user.sub, req.body);
  res.status(201).json(serialize(result));
}

async function history(req, res) {
  const result = await telemetryService.getHistory(req.user.sub, req.params.id, req.query);
  res.json(serialize(result));
}

async function heartbeat(req, res) {
  const result = await telemetryService.recordHeartbeat(req.user.sub, req.params.id);
  res.json(serialize(result));
}

module.exports = { ingest, history, heartbeat };
