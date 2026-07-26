const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const telemetryController = require('../controllers/telemetry.controller');

const router = express.Router();

/**
 * @openapi
 * /api/telemetry/readings:
 *   post:
 *     summary: Store a batch of sensor readings and evaluate alert rules
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [deviceCode, readings]
 *             properties:
 *               deviceCode: { type: string }
 *               messageId: { type: string, description: Optional idempotency key }
 *               timestamp: { type: string, format: date-time }
 *               readings:
 *                 type: object
 *                 additionalProperties: { type: number }
 *     responses:
 *       201: { description: Readings stored }
 */
router.post('/telemetry/readings', requireAuth, telemetryController.ingest);

/**
 * @openapi
 * /api/sensors/{id}/readings:
 *   get:
 *     summary: Read sensor history
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Sensor and readings }
 */
router.get('/sensors/:id/readings', requireAuth, telemetryController.history);

module.exports = router;
