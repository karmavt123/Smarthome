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
 *             required: [text, homeId]
 *             properties:
 *               text: { type: string, example: bat den phong khach }
 *               homeId: { type: integer, example: 1 }
 *     responses:
 *       202: { description: Command recognized and queued }
 *       200: { description: "Unknown command, or a door intent that requires face/PIN verification (response.requiresVerification: true) instead of being queued" }
 *       503: { description: Voice intent classification (ai-service) unavailable }
 */
router.post('/voice-commands', requireAuth, controller.create);

module.exports = router;
