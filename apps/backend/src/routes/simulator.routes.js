const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const simulatorController = require('../controllers/simulator.controller');

const router = express.Router();

/**
 * @openapi
 * /api/simulator/bootstrap:
 *   post:
 *     summary: Idempotently create a virtual smart-home environment
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Simulator resources ready }
 */
router.post('/simulator/bootstrap', requireAuth, simulatorController.bootstrap);

/**
 * @openapi
 * /api/simulator/devices/{id}/connectivity:
 *   patch:
 *     summary: Pause or resume a simulated device
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paused]
 *             properties:
 *               paused: { type: boolean }
 *     responses:
 *       200: { description: Simulation state updated }
 */
router.patch(
  '/simulator/devices/:id/connectivity',
  requireAuth,
  simulatorController.connectivity
);

module.exports = router;
