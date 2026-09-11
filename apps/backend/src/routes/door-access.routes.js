const express = require('express');
const requireAuth = require('../middlewares/auth.middleware');
const { faceFramesUpload } = require('../middlewares/upload.middleware');
const controller = require('../controllers/door-access.controller');

const router = express.Router();

/**
 * @openapi
 * /api/door-access/events:
 *   post:
 *     summary: Record an app, voice, or manual door-access event
 *     description: >
 *       Records an access that another subsystem already performed; it authenticates
 *       nobody. `password` and `face` are refused here in both directions — verify-pin and
 *       verify-face own those rows, and letting a client write them allowed both a lockout
 *       reset (fake success) and a lockout DoS on the owner (spammed failures).
 *       `app` and `voice` may only record `failed`; a real unlock goes through device
 *       commands so the board is actually told to open. Only `manual` may record a
 *       success, and only that case flips the door's status.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Access event stored }
 *       400: { description: password/face posted here, or a success on a non-manual method }
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
 *     summary: Check whether a door has an active PIN, and whether it is locked out
 *     description: >
 *       Does not reveal the PIN or its hash — just whether verify-pin would work at all,
 *       plus the current lockout state so the FE can show it before the user tries.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: doorDeviceId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: "{ doorDeviceId, hasPin, locked, lockedUntil, lockoutThreshold }" }
 */
router.get('/door-access/pin-status', requireAuth, controller.pinStatus);

/**
 * @openapi
 * /api/door-access/{doorDeviceId}/pin:
 *   put:
 *     summary: Set or change the door PIN
 *     description: >
 *       Setting the FIRST PIN needs only `pin`. Changing an existing one also requires
 *       `currentPin` — otherwise the 3-strikes lockout could be sidestepped by simply
 *       overwriting the PIN. A wrong `currentPin` is logged as a failed attempt and
 *       counts toward that same lockout. A *successful* change writes no access log at
 *       all: the lockout window is anchored to the active PIN's creation time, so the
 *       earlier guesses stop counting without fabricating an "unlocked" history entry.
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
 *               pin: { type: string, description: "4-8 digits" }
 *               currentPin: { type: string, description: "Required when a PIN already exists" }
 *     responses:
 *       200: { description: PIN saved; previous PIN (if any) deactivated }
 *       400: { description: Invalid PIN, or currentPin missing while one already exists }
 *       401: { description: currentPin is wrong }
 *       423: { description: PIN is locked out after too many failed attempts }
 */
router.put('/door-access/:doorDeviceId/pin', requireAuth, controller.setPin);

/**
 * @openapi
 * /api/door-access/{doorDeviceId}/pin:
 *   delete:
 *     summary: Remove the door PIN
 *     description: >
 *       Requires `currentPin`, exactly like changing it. This endpoint exists because
 *       DELETE /api/devices/{id} refuses to delete a door that still has a PIN: every
 *       foreign key to `devices` cascades, so deleting the door would otherwise drop the
 *       PIN *and* the whole access history without anyone producing the current code —
 *       which is the borrowed-phone attack the currentPin rule and the lockout exist to
 *       stop. Both ways out now cost the same proof.
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
 *             required: [currentPin]
 *             properties:
 *               currentPin: { type: string }
 *     responses:
 *       200: { description: PIN removed }
 *       400: { description: currentPin missing, or no PIN configured for this door }
 *       401: { description: currentPin is wrong }
 *       423: { description: PIN is locked out after too many failed attempts }
 */
router.delete('/door-access/:doorDeviceId/pin', requireAuth, controller.clearPin);

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
