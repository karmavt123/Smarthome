const express = require('express');
const devicesController = require('../controllers/devices.controller');
const deviceCommandController = require('../controllers/device-command.controller');
const telemetryController = require('../controllers/telemetry.controller');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router();

router.use('/devices', requireAuth);

/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: List all devices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: homeId
 *         schema: { type: integer }
 *       - in: query
 *         name: roomId
 *         schema: { type: integer }
 *       - in: query
 *         name: deviceType
 *         schema: { type: string, enum: [light, fan, door, sensor] }
 *     responses:
 *       200:
 *         description: List of devices
 *       401:
 *         description: Missing or invalid access token
 *   post:
 *     summary: Create a device
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [homeId, name, deviceCode, deviceType]
 *             properties:
 *               homeId:
 *                 type: integer
 *               roomId:
 *                 type: integer
 *               name:
 *                 type: string
 *               deviceCode:
 *                 type: string
 *               deviceType:
 *                 type: string
 *                 enum: [light, fan, door, sensor]
 *     responses:
 *       201:
 *         description: Device created
 */
router.get('/devices', devicesController.index);
router.post('/devices', devicesController.create);

/**
 * @openapi
 * /api/devices/{id}/commands:
 *   post:
 *     summary: Queue a device command
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [turn_on, turn_off, open, close, set_speed, set_color] }
 *               value: { description: Required for set_speed and set_color }
 *               commandId: { type: string, format: uuid, description: Optional idempotency key }
 *     responses:
 *       202: { description: Command queued as pending }
 */
router.post('/devices/:id/commands', deviceCommandController.create);

/**
 * @openapi
 * /api/devices/{id}/heartbeat:
 *   post:
 *     summary: Record a device heartbeat
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Device marked online }
 */
router.post('/devices/:id/heartbeat', telemetryController.heartbeat);

/**
 * @openapi
 * /api/devices/{id}:
 *   get:
 *     summary: Get a device by id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Device found
 *       401:
 *         description: Missing or invalid access token
 *       404:
 *         description: Device not found
 */
router.get('/devices/:id', devicesController.show);

/**
 * @openapi
 * /api/devices/{id}:
 *   patch:
 *     summary: Rename a device or move it to a different room
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               roomId: { type: integer, nullable: true }
 *     responses:
 *       200: { description: Device updated }
 *       404: { description: Device or room not found }
 *   delete:
 *     summary: Delete a device
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Device deleted }
 *       404: { description: Device not found }
 *       409: { description: Device still has history and cannot be deleted }
 */
router.patch('/devices/:id', devicesController.update);
router.delete('/devices/:id', devicesController.destroy);

module.exports = router;
