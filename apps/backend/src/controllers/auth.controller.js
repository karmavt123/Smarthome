const authService = require('../services/auth.service');

async function signUp(req, res) {
  const { full_name, email, password, phone } = req.body;
  try {
    const result = await authService.signUp({ full_name, email, password, phone });
    res.status(201).json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

async function signIn(req, res) {
  const { email, password } = req.body;
  try {
    const result = await authService.signIn({ email, password });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

async function signOut(req, res) {
  const { refresh_token } = req.body;
  // Sign-out is idempotent: a client whose refresh token already expired (or was
  // dropped from localStorage first) sends an empty body. Hashing `undefined` threw a
  // TypeError that Express turned into a 500 with a stack trace in the logs, for what
  // is really a successful no-op.
  if (!refresh_token) return res.status(204).send();

  // No try/catch on purpose: Express 5 forwards a rejected promise to
  // error.middleware.js, which deliberately swallows the message of any 5xx (a Prisma
  // connection error carries host/port/database). Catching here and echoing
  // error.message would walk straight past that protection.
  await authService.signOut(refresh_token);
  res.status(204).send();
}

async function refreshToken(req, res) {
  const { refresh_token } = req.body;
  try {
    const result = await authService.refresh(refresh_token);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
}

module.exports = { signUp, signIn, signOut, refreshToken };
