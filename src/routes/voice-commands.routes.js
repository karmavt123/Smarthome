const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/voice-command.controller');

const router = express.Router();

/**
 * @openapi
 * /api/voice-commands:
 *   post:
 *     summary: Parse text and queue the matching device command
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recognizedText]
 *             properties:
 *               recognizedText: { type: string, example: bat den phong khach }
 *     responses:
 *       202: { description: Command recognized and queued }
 *       200: { description: Unknown command recorded }
 */
router.post('/voice-commands', requireAuth, controller.create);

module.exports = router;
