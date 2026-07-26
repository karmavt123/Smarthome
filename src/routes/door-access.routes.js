const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/door-access.controller');

const router = express.Router();

/**
 * @openapi
 * /api/door-access/events:
 *   post:
 *     summary: Store a face, PIN, app, voice, or manual door-access event
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Access event stored }
 */
router.post('/door-access/events', requireAuth, controller.create);
router.get('/door-access/events', requireAuth, controller.index);

module.exports = router;
