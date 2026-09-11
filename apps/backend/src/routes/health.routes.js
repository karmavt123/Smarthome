const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Check API + DB connectivity
 *     responses:
 *       200:
 *         description: DB connected
 *       503:
 *         description: DB disconnected
 */
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    // err.message from Prisma carries host/port/database (sometimes the user) from the
    // connection string, and this route is public. Log it server-side, return a generic
    // status to the caller — same posture as error.middleware.js takes for 5xx.
    console.error('Health check failed:', err);
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

module.exports = router;
