const express = require('express');
const devicesController = require('../controllers/devices.controller');

const router = express.Router();

/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: List all devices
 *     responses:
 *       200:
 *         description: List of devices
 *   post:
 *     summary: Create a device
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [home_id, name, device_code, device_type]
 *             properties:
 *               home_id:
 *                 type: integer
 *               room_id:
 *                 type: integer
 *               name:
 *                 type: string
 *               device_code:
 *                 type: string
 *               device_type:
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
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Device found
 *       404:
 *         description: Device not found
 */
router.get('/devices/:id', devicesController.show);

module.exports = router;
