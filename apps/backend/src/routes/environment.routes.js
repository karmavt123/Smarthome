const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const environmentController = require('../controllers/environment.controller');

const router = express.Router();

/**
 * @openapi
 * /api/environment:
 *   get:
 *     summary: Latest sensor readings for a home, grouped by sensor type
 *     description: >
 *       Lighter alternative to /api/dashboard when only the `environment`
 *       field is needed (no rooms/devices/alerts in the response).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: homeId
 *         schema: { type: integer }
 *         description: Defaults to the caller's first home if omitted
 *     responses:
 *       200: { description: Environment snapshot }
 *       404: { description: Home not found }
 */
router.get('/environment', requireAuth, environmentController.show);

module.exports = router;
