const humps = require('humps');
const serialize = require('../utils/serialize');

// In-memory SSE client registry, keyed by userId. Fine for a single-instance
// deploy (see CLAUDE.md); would need a pub/sub backend (Redis etc.) behind a
// load balancer with multiple app instances.
const clients = new Map();

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) clients.delete(userId);
}

// Same wire convention as res.json() (case.middleware.js): camelCase keys, and
// BigInt/Decimal/Date fields run through the same serialize() every controller
// uses — Prisma BigInt columns (e.g. alerts.id) throw in JSON.stringify otherwise.
function publish(userId, event, data) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(humps.camelizeKeys(serialize(data)))}\n\n`;
  for (const res of set) res.write(payload);
}

module.exports = { addClient, removeClient, publish };
