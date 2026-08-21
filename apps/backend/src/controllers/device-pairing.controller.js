const devicePairingService = require('../services/device-pairing.service');

async function create(req, res) {
  const { home_id } = req.body;
  const { token, expiresAt } = await devicePairingService.createPairingToken(req.user.sub, home_id);
  res.status(201).json({ token, expiresAt });
}

async function pair(req, res) {
  const { pairing_token, devices } = req.body;
  const created = await devicePairingService.pairDevices(pairing_token, devices);
  res.status(201).json(created);
}

module.exports = { create, pair };
