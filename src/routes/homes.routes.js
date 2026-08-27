const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/homes.controller');

const router = express.Router();

router.use('/homes', requireAuth);

/**
 * @openapi
 * /api/homes:
 *   get:
 *     summary: List homes owned by the current user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of homes }
 *   post:
 *     summary: Create a home
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *     responses:
 *       201: { description: Home created }
 */
router.get('/homes', controller.index);
router.post('/homes', controller.create);

/**
 * @openapi
 * /api/homes:
 *   delete:
 *     summary: Delete a home by homeId in the request body, cascading everything under it
 *     description: >
 *       Deletes the home and everything that belongs to it — rooms, devices (and each
 *       device's commands/actions/sensors/telemetry/voice-command history/door
 *       access logs/passwords), alert rules, alerts, face profiles, and pairing tokens —
 *       via onDelete: Cascade foreign keys. Same operation as DELETE /api/homes/{id},
 *       just addressed by body instead of path param.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [homeId]
 *             properties:
 *               homeId: { type: integer }
 *     responses:
 *       200: { description: Home deleted, returns the deleted home }
 *       400: { description: homeId missing }
 *       404: { description: Home not found }
 */
router.delete('/homes', controller.destroyByHomeId);

/**
 * @openapi
 * /api/homes/{id}:
 *   patch:
 *     summary: Update a home
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               address: { type: string }
 *     responses:
 *       200: { description: Home updated }
 *       404: { description: Home not found }
 *   delete:
 *     summary: Delete a home
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Home deleted, returns the deleted home }
 *       404: { description: Home not found }
 */
router.patch('/homes/:id', controller.update);
router.delete('/homes/:id', controller.destroy);

module.exports = router;
