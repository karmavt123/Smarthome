const express = require('express');
const requireAuthSSE = require('../middlewares/sse-auth.middleware');
const eventsController = require('../controllers/events.controller');

const router = express.Router();

/**
 * @openapi
 * /api/events/stream:
 *   get:
 *     summary: Server-Sent Events stream (device status, and later readings/alerts)
 *     description: >
 *       EventSource can't set an Authorization header, so the access token may
 *       be passed as ?token= instead of (or in addition to) the Bearer header.
 *       Emits (camelCase payloads):
 *       - `device_status`: { deviceId, status, connectionStatus, lastSeenAt }
 *         whenever a device's status changes (command executed, or a
 *         successful door-access event).
 *       - `sensor_reading`: { deviceId, sensorId, sensorType, value,
 *         capturedAt } for every new sensor reading stored (real ingest or
 *         the simulator).
 *       - `alert`: { alertId, homeId, alertType, severity, status, title,
 *         message, transition } whenever an alert is triggered or resolved
 *         (sensor threshold rules, or repeated door-access failures).
 *     parameters:
 *       - in: query
 *         name: token
 *         schema: { type: string }
 *         description: Access token, required when no Authorization header is sent
 *     responses:
 *       200:
 *         description: text/event-stream connection
 *       401:
 *         description: Missing or invalid access token
 */
router.get('/events/stream', requireAuthSSE, eventsController.stream);

module.exports = router;
