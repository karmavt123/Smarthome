const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

/**
 * @openapi
 * /api/auth/sign-up:
 *   post:
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password]
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created, tokens issued
 *       409:
 *         description: Email already in use
 */
router.post('/auth/sign-up', authController.signUp);

/**
 * @openapi
 * /api/auth/sign-in:
 *   post:
 *     summary: Sign in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens issued
 *       401:
 *         description: Invalid email or password
 */
router.post('/auth/sign-in', authController.signIn);

/**
 * @openapi
 * /api/auth/sign-out:
 *   post:
 *     summary: Revoke a refresh token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       204:
 *         description: Signed out
 */
router.post('/auth/sign-out', authController.signOut);

/**
 * @openapi
 * /api/auth/refresh-token:
 *   post:
 *     summary: Exchange a refresh token for a new access + refresh token pair
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens issued
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/auth/refresh-token', authController.refreshToken);

module.exports = router;
