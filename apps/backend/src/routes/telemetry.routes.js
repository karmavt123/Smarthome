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

/**
 * @openapi
 * /api/sensors/{id}/readings/daily:
 *   get:
 *     summary: Daily average/min/max for a sensor, aggregated in the database
 *     description: >
 *       Returns one row per calendar day instead of raw readings. Use this for trend
 *       charts — a week of readings is far more rows than the raw endpoint will return.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Defaults to 7 days ago
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Defaults to now; a bare date covers the whole day
 *     responses:
 *       200: { description: "{ sensorId, sensorType, unit, from, to, days: [{ day, avg, min, max, count }] }" }
 */
router.get('/sensors/:id/readings/daily', requireAuth, telemetryController.dailyAverages);

module.exports = router;
