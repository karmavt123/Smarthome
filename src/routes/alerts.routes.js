const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/alerts.controller');

const router = express.Router();

router.get('/alert-rules', requireAuth, controller.rulesIndex);
router.post('/alert-rules', requireAuth, controller.rulesCreate);
router.patch('/alert-rules/:id', requireAuth, controller.rulesUpdate);
router.delete('/alert-rules/:id', requireAuth, controller.rulesDestroy);
router.get('/alerts', requireAuth, controller.alertsIndex);

/**
 * @openapi
 * /api/alerts/{id}:
 *   get:
 *     summary: Get a single alert by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Alert found }
 *       404: { description: Alert not found }
 */
router.get('/alerts/:id', requireAuth, controller.alertsShow);

router.patch('/alerts/:id', requireAuth, controller.alertsUpdate);

module.exports = router;
