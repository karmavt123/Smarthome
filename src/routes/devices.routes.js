const express = require('express');
const devicesController = require('../controllers/devices.controller');
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

module.exports = router;
