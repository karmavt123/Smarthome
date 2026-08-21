const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const email = `auth-test-${Date.now()}@example.com`;
const password = 'secret123';

afterAll(async () => {
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('auth routes', () => {
  let refreshToken;

  test('sign-up creates a user and returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ full_name: 'Auth Test', email, password });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  test('sign-up rejects a duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/sign-up')
      .send({ full_name: 'Auth Test', email, password });

    expect(res.status).toBe(409);
  });

  test('sign-in rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email, password: 'wrong-password' });

    expect(res.status).toBe(401);
  });

  test('sign-in rejects an unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email: 'nobody@example.com', password });

    expect(res.status).toBe(401);
  });

  test('sign-in returns a fresh token pair for correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    refreshToken = res.body.refreshToken;
  });

  test('refresh-token rotates the token and rejects reuse of the old one', async () => {
    const rotated = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: refreshToken });

    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(refreshToken);

    const reused = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: refreshToken });

    expect(reused.status).toBe(401);

    refreshToken = rotated.body.refreshToken;
  });

  test('refresh-token rejects a malformed token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: 'not.a.jwt' });

    expect(res.status).toBe(401);
  });

  test('sign-out revokes the refresh token', async () => {
    const signOut = await request(app)
      .post('/api/auth/sign-out')
      .send({ refresh_token: refreshToken });

    expect(signOut.status).toBe(204);

    const reused = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refresh_token: refreshToken });

    expect(reused.status).toBe(401);
  });
});
