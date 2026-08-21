const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const { faceFramesUpload } = require('../middlewares/upload.middleware');
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
 *     summary: Verify a face capture against enrolled profiles and open the door on match
 *     description: >
 *       Sends 1-5 consecutive camera frames plus the home's enrolled candidates to the
 *       ai-service, which runs liveness + face matching and returns isLive/matched. On a
 *       live match within threshold, writes the door-access log and queues the door-open
 *       device command atomically in the same request. Callers must not call
 *       /devices/{id}/commands separately after a success response.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [doorDeviceId, images]
 *             properties:
 *               doorDeviceId: { type: integer }
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 minItems: 1
 *                 maxItems: 5
 *     responses:
 *       200: { description: Verification result (success, or failed with a liveness_failed/no-match reason) }
 *       400: { description: Missing fields, or device is not a door }
 *       422: { description: No face, or more than one face, detected in the frame }
 *       423: { description: Face ID temporarily locked out after repeated failures; use PIN instead }
 *       503: { description: ai-service unreachable or misconfigured — fall back to PIN, not counted toward lockout }
 */
router.post('/door-access/verify-face', requireAuth, faceFramesUpload, controller.verifyFace);

/**
 * @openapi
 * /api/door-access/face-lock-status:
 *   get:
 *     summary: Check whether Face ID is currently locked out for a door
 *     description: >
 *       Poll this before showing the Face ID button so the FE can disable it and show
 *       "locked until <lockedUntil>" instead of letting the user hit the 423 on verify-face.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doorDeviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ doorDeviceId, locked, lockedUntil }" }
 */
router.get('/door-access/face-lock-status', requireAuth, controller.faceLockStatus);

/**
 * @openapi
 * /api/door-access/face-history:
 *   get:
 *     summary: Paginated history of face-id door unlock attempts
 *     description: >
 *       Access-log rows where accessMethod is face, newest first. Scoped to the caller's
 *       own homes/doors. Filter to one door with doorDeviceId, or one outcome with result.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doorDeviceId
 *         schema: { type: integer }
 *       - in: query
 *         name: result
 *         schema: { type: string, enum: [success, failed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: Paginated list of face-id access-log rows }
 *       400: { description: doorDeviceId given but not a door }
 */
router.get('/door-access/face-history', requireAuth, controller.faceHistory);

/**
 * @openapi
 * /api/door-access/pin-status:
 *   get:
 *     summary: Check whether a door has an active PIN configured
 *     description: >
 *       Does not reveal the PIN or its hash — just whether verify-pin would work at all.
 *       Useful for showing "no PIN set" in the FE before the user tries verify-pin.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doorDeviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ doorDeviceId, hasPin }" }
 */
router.get('/door-access/pin-status', requireAuth, controller.pinStatus);

/**
 * @openapi
 * /api/door-access/{doorDeviceId}/pin:
 *   put:
 *     summary: Set or rotate the PIN for a door
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: doorDeviceId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pin]
 *             properties:
 *               pin: { type: string, description: "4 to 8 digits" }
 *     responses:
 *       200: { description: PIN set; previous PIN (if any) deactivated }
 *       400: { description: Invalid pin format, or device is not a door }
 */
router.put('/door-access/:doorDeviceId/pin', requireAuth, controller.setPin);

/**
 * @openapi
 * /api/door-access/verify-pin:
 *   post:
 *     summary: Verify a door PIN and open the door on match
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doorDeviceId, pin]
 *             properties:
 *               doorDeviceId: { type: integer }
 *               pin: { type: string }
 *     responses:
 *       200: { description: Verification result (success or failed) }
 *       400: { description: Missing fields, device is not a door, or no PIN configured }
 */
router.post('/door-access/verify-pin', requireAuth, controller.verifyPin);

/**
 * @openapi
 * /api/door-access/pin-history:
 *   get:
 *     summary: Paginated history of PIN door unlock attempts
 *     description: >
 *       Access-log rows where accessMethod is password, newest first. Scoped to the
 *       caller's own homes/doors. Filter to one door with doorDeviceId, or one outcome
 *       with result.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doorDeviceId
 *         schema: { type: integer }
 *       - in: query
 *         name: result
 *         schema: { type: string, enum: [success, failed] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: Paginated list of PIN access-log rows }
 *       400: { description: doorDeviceId given but not a door }
 */
router.get('/door-access/pin-history', requireAuth, controller.pinHistory);

module.exports = router;
