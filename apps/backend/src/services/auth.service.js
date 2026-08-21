const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const { exp } = jwt.decode(refreshToken);

  await prisma.refresh_tokens.create({
    data: {
      user_id: user.id,
      token_hash: hashToken(refreshToken),
      expires_at: new Date(exp * 1000),
    },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

async function signUp({ full_name, email, password, phone }) {
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    const error = new Error('Email already in use');
    error.status = 409;
    throw error;
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.users.create({
    data: { full_name, email, password_hash, phone },
  });

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

async function signIn({ email, password }) {
  // The one query that needs the hash: bcrypt.compare below. sanitizeUser() strips it
  // again before the user object leaves this function.
  const user = await prisma.users.findUnique({
    where: { email },
    omit: { password_hash: false },
  });
  if (!user) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  const tokens = await issueTokens(user);
  return { user: sanitizeUser(user), ...tokens };
}

async function signOut(refreshToken) {
  await prisma.refresh_tokens.deleteMany({ where: { token_hash: hashToken(refreshToken) } });
}

async function refresh(refreshToken) {
  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET);
  } catch {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refresh_tokens.findUnique({ where: { token_hash: tokenHash } });
  if (!stored || stored.expires_at < new Date()) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  const user = await prisma.users.findUnique({ where: { id: payload.sub } });
  if (!user) {
    const error = new Error('Invalid or expired refresh token');
    error.status = 401;
    throw error;
  }

  await prisma.refresh_tokens.delete({ where: { token_hash: tokenHash } });
  return issueTokens(user);
}

module.exports = { signUp, signIn, signOut, refresh };
