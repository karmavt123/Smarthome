const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

/**
 * @openapi
 * /api/dashboard:
 *   get:
 *     summary: Return latest sensor values, histories, devices, and alerts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Dashboard snapshot }
 */
router.get('/dashboard', requireAuth, dashboardController.show);

module.exports = router;
