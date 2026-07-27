const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const { faceImageUpload } = require('../middlewares/upload.middleware');
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

/**
 * @openapi
 * /api/door-access/verify-face:
 *   post:
 *     summary: Verify a face image against enrolled profiles and open the door on match
 *     description: >
 *       Computes a face embedding from the uploaded image, compares it against the
 *       active face profiles for the door's home, and — on a match within threshold —
 *       writes the door-access log and queues the door-open device command atomically
 *       in the same request. Callers must not call /devices/{id}/commands separately
 *       after a success response.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [doorDeviceId, image]
 *             properties:
 *               doorDeviceId: { type: integer }
 *               image: { type: string, format: binary }
 *     responses:
 *       200: { description: Verification result (success or failed) }
 *       400: { description: Missing fields, or device is not a door }
 *       422: { description: No face, or more than one face, detected in the image }
 */
router.post('/door-access/verify-face', requireAuth, faceImageUpload, controller.verifyFace);

module.exports = router;
