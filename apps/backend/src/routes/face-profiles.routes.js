const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const { faceImageUpload } = require('../middlewares/upload.middleware');
const controller = require('../controllers/face-profiles.controller');

const router = express.Router();

router.use('/face-profiles', requireAuth);

/**
 * @openapi
 * /api/face-profiles:
 *   post:
 *     summary: Enroll a face profile for door unlock
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [homeId, name, image]
 *             properties:
 *               homeId: { type: integer }
 *               name: { type: string }
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: Face profile created }
 *       422: { description: No face, or more than one face, detected in the image }
 *   get:
 *     summary: List face profiles for a home
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: homeId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of face profiles }
 */
router.post('/face-profiles', faceImageUpload, controller.create);
router.get('/face-profiles', controller.index);

/**
 * @openapi
 * /api/face-profiles/{id}:
 *   delete:
 *     summary: Delete a face profile
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Face profile deleted }
 *       404: { description: Face profile not found }
 */
router.delete('/face-profiles/:id', controller.destroy);

module.exports = router;
