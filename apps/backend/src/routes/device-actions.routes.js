const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/device-command.controller');

const router = express.Router();

/**
 * @openapi
 * /api/device-actions:
 *   get:
 *     summary: List device commands, newest first
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: homeId
 *         schema: { type: integer }
 *       - in: query
 *         name: deviceId
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, success, failed] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *         description: Only commands created at or after this date (YYYY-MM-DD or ISO timestamp)
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *         description: Only commands created at or before this date; a bare date covers the whole day
 *     responses:
 *       200: { description: List of device commands }
 */
router.get('/device-actions', requireAuth, controller.index);
router.get('/device-actions/:id', requireAuth, controller.show);

module.exports = router;
