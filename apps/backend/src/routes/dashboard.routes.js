const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Return the home tree with each room's latest environment snapshot
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard snapshot }
 */
router.get('/dashboard', requireAuth, dashboardController.show);

module.exports = router;
