const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const email = `devices-test-${Date.now()}@example.com`;
const password = 'secret123';

let home;
let accessToken;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Devices Test', email, password });

  accessToken = signUp.body.accessToken;
  home = await prisma.homes.create({
    data: { name: 'Test Home', user_id: signUp.body.user.id },
  });
});

afterAll(async () => {
  await prisma.devices.deleteMany({ where: { home_id: home.id } });
  await prisma.homes.delete({ where: { id: home.id } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('devices routes', () => {
  test('rejects a request without an access token', async () => {
    const res = await request(app).get('/api/devices');
    expect(res.status).toBe(401);
  });

  test('rejects a request with an invalid access token', async () => {
    const res = await request(app)
      .get('/api/devices')
      .set('Authorization', 'Bearer garbage.token.here');

    expect(res.status).toBe(401);
  });

  test('does not block sibling auth routes (path-scoped middleware regression check)', async () => {
    const res = await request(app)
      .post('/api/auth/sign-in')
      .send({ email, password });

    expect(res.status).toBe(200);
  });

  let deviceId;

  test('creates a device with a valid access token', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        home_id: home.id,
        name: 'Living Room Light',
        device_code: `dev-${Date.now()}`,
        device_type: 'light',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(Number));
    deviceId = res.body.id;
  });

  test('lists devices, including the one just created', async () => {
    const res = await request(app)
      .get('/api/devices')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((device) => device.id === deviceId)).toBe(true);
  });

  test('gets a device by id', async () => {
    const res = await request(app)
      .get(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(deviceId);
  });

  test('returns 404 for a non-existent device id', async () => {
    const res = await request(app)
      .get('/api/devices/999999999')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });
});
