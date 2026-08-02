const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/alerts.controller');

const router = express.Router();

router.get('/alert-rules', requireAuth, controller.rulesIndex);
router.post('/alert-rules', requireAuth, controller.rulesCreate);
router.patch('/alert-rules/:id', requireAuth, controller.rulesUpdate);
router.delete('/alert-rules/:id', requireAuth, controller.rulesDestroy);
/**
 * @openapi
 * /api/alerts:
 *   get:
 *     summary: List alerts for a home, paginated
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: homeId
 *         schema: { type: integer }
 *         description: Defaults to the caller's first home if omitted
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [unread, read, resolved] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [info, warning, critical] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: Paginated list of alerts }
 */
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
