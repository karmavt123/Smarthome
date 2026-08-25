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
