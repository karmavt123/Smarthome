const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const controller = require('../controllers/rooms.controller');

const router = express.Router();

router.use('/rooms', requireAuth);

/**
 * @openapi
 * /api/rooms:
 *   get:
 *     summary: List rooms for a home
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: home_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of rooms }
 *       404: { description: Home not found }
 *   post:
 *     summary: Create a room
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [homeId, name]
 *             properties:
 *               homeId: { type: integer }
 *               name: { type: string }
 *     responses:
 *       201: { description: Room created }
 *       404: { description: Home not found }
 *       409: { description: Room name already exists in this home }
 */
router.get('/rooms', controller.index);
router.post('/rooms', controller.create);

/**
 * @openapi
 * /api/rooms/{id}:
 *   patch:
 *     summary: Update a room
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
 *     responses:
 *       200: { description: Room updated }
 *       404: { description: Room not found }
 *       409: { description: Room name already exists in this home }
 *   delete:
 *     summary: Delete a room
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Room deleted }
 *       404: { description: Room not found }
 */
router.patch('/rooms/:id', controller.update);
router.delete('/rooms/:id', controller.destroy);

module.exports = router;
