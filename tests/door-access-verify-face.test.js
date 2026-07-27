const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

jest.setTimeout(60000); // face-api.js inference runs on a pure-JS CPU backend (~9s/call); the alert test chains several calls

const email = `verify-face-test-${Date.now()}@example.com`;
const password = 'secret123';

const enrolledFaceImage = path.join(__dirname, 'fixtures/face-single-1.jpg');
const strangerFaceImage = path.join(__dirname, 'fixtures/face-single-2.jpg');

let accessToken;
let userId;
let home;
let doorDevice;
let nonDoorDevice;
let faceProfileId;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Verify Face Test', email, password });

  accessToken = signUp.body.accessToken;
  userId = signUp.body.user.id;
  home = await prisma.homes.create({ data: { name: 'Test Home', user_id: userId } });

  doorDevice = await prisma.devices.create({
    data: {
      home_id: home.id,
      name: 'Front Door',
      device_code: `door-test-${Date.now()}`,
      device_type: 'door',
    },
  });

  nonDoorDevice = await prisma.devices.create({
    data: {
      home_id: home.id,
      name: 'Living Room Light',
      device_code: `light-test-${Date.now()}`,
      device_type: 'light',
    },
  });

  const enroll = await request(app)
    .post('/api/face-profiles')
    .set('Authorization', `Bearer ${accessToken}`)
    .field('homeId', home.id)
    .field('name', 'Enrolled Face')
    .attach('image', enrolledFaceImage);
  faceProfileId = enroll.body.id;
});

afterAll(async () => {
  await prisma.notifications.deleteMany({ where: { user_id: userId } });
  await prisma.alerts.deleteMany({ where: { home_id: home.id } });
  await prisma.device_commands.deleteMany({ where: { device_id: { in: [doorDevice.id, nonDoorDevice.id] } } });
  await prisma.door_passwords.deleteMany({ where: { door_device_id: doorDevice.id } });
  await prisma.door_access_logs.deleteMany({ where: { door_device_id: doorDevice.id } });
  await prisma.face_profiles.deleteMany({ where: { home_id: home.id } });
  await prisma.devices.deleteMany({ where: { home_id: home.id } });
  await prisma.homes.delete({ where: { id: home.id } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('POST /api/door-access/verify-face', () => {
  test('rejects a request without an access token', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .field('doorDeviceId', doorDevice.id)
      .attach('image', enrolledFaceImage);

    expect(res.status).toBe(401);
  });

  test('rejects when the target device is not a door', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', nonDoorDevice.id)
      .attach('image', enrolledFaceImage);

    expect(res.status).toBe(400);
  });

  test('matches the enrolled face, logs the access, and queues a door-open command', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', enrolledFaceImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('success');
    expect(res.body.faceProfileId).toBe(faceProfileId);
    expect(res.body.deviceCommandId).toEqual(expect.any(String));

    const command = await prisma.device_commands.findUnique({ where: { id: res.body.deviceCommandId } });
    expect(command).not.toBeNull();
    expect(command.action).toBe('open');
    expect(command.control_method).toBe('face');

    const log = await prisma.door_access_logs.findUnique({ where: { id: BigInt(res.body.doorAccessLogId) } });
    expect(log.result).toBe('success');
    expect(log.face_profile_id).toBe(faceProfileId);
  });

  test('ignores an active face profile with no embedding instead of crashing', async () => {
    // simulator bootstrap creates a placeholder "Demo Owner" profile with no photo/embedding
    // (src/services/simulator.service.js) — verify-face must skip it, not 500 on it.
    const placeholder = await prisma.face_profiles.create({
      data: { home_id: home.id, name: 'Placeholder No Photo', is_active: true, face_embedding: null },
    });

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', enrolledFaceImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('success');
    expect(res.body.faceProfileId).toBe(faceProfileId);

    await prisma.face_profiles.delete({ where: { id: placeholder.id } });
  });

  test('rejects a stranger face and does not queue a door-open command', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', strangerFaceImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('failed');
    expect(res.body.deviceCommandId).toBeUndefined();
    expect(res.body.confidenceScore).toBeNull();

    const log = await prisma.door_access_logs.findUnique({ where: { id: BigInt(res.body.doorAccessLogId) } });
    expect(log.result).toBe('failed');
    expect(log.face_profile_id).toBeNull();
  });

  test('raises an unauthorized_access alert + notification after 3 failed attempts in the window, without duplicating it', async () => {
    // one failed attempt already happened in the previous test; two more reach the 3-in-2-minutes threshold
    await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', strangerFaceImage);

    const thirdAttempt = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', strangerFaceImage);
    expect(thirdAttempt.body.result).toBe('failed');

    const alerts = await prisma.alerts.findMany({
      where: { home_id: home.id, alert_type: 'unauthorized_access' },
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].status).toBe('unread');

    const notification = await prisma.notifications.findFirst({ where: { alert_id: alerts[0].id } });
    expect(notification).not.toBeNull();
    expect(notification.user_id).toBe(userId);
    expect(notification.channel).toBe('in_app');

    // a 4th failure within the same window must not create a second alert
    await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', strangerFaceImage);

    const alertsAfterFourthFailure = await prisma.alerts.findMany({
      where: { home_id: home.id, alert_type: 'unauthorized_access' },
    });
    expect(alertsAfterFourthFailure.length).toBe(1);
  });
});

describe('face lockout + PIN fallback', () => {
  // the previous describe block already drove doorDevice's face attempts past the
  // 3-failures-in-2-minutes threshold, so Face ID is expected to be locked out here.

  test('GET face-lock-status reports the lockout with a lockedUntil timestamp', async () => {
    const res = await request(app)
      .get('/api/door-access/face-lock-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ doorDeviceId: doorDevice.id });

    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(new Date(res.body.lockedUntil).getTime()).toBeGreaterThan(Date.now());
  });

  test('verify-face returns 423 while locked, without writing a new log or alert', async () => {
    const logCountBefore = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    const alertCountBefore = await prisma.alerts.count({ where: { home_id: home.id } });

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('image', strangerFaceImage);

    expect(res.status).toBe(423);
    expect(res.body.details.lockedUntil).toBeTruthy();

    const logCountAfter = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    const alertCountAfter = await prisma.alerts.count({ where: { home_id: home.id } });
    expect(logCountAfter).toBe(logCountBefore);
    expect(alertCountAfter).toBe(alertCountBefore);
  });

  test('rejects verify-pin when no PIN has been configured yet', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doorDeviceId: doorDevice.id, pin: '1234' });

    expect(res.status).toBe(400);
  });

  test('GET pin-status reports hasPin: false before any PIN is set', async () => {
    const res = await request(app)
      .get('/api/door-access/pin-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ doorDeviceId: doorDevice.id });

    expect(res.status).toBe(200);
    expect(res.body.hasPin).toBe(false);
  });

  test('rejects setting a PIN with an invalid format', async () => {
    const res = await request(app)
      .put(`/api/door-access/${doorDevice.id}/pin`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ pin: '12' });

    expect(res.status).toBe(400);
  });

  test('sets a PIN for the door without exposing the hash', async () => {
    const res = await request(app)
      .put(`/api/door-access/${doorDevice.id}/pin`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ pin: '4321' });

    expect(res.status).toBe(200);
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.isActive).toBe(true);
  });

  test('GET pin-status reports hasPin: true after a PIN is set', async () => {
    const res = await request(app)
      .get('/api/door-access/pin-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ doorDeviceId: doorDevice.id });

    expect(res.status).toBe(200);
    expect(res.body.hasPin).toBe(true);
  });

  test('verify-pin fails with the wrong PIN', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doorDeviceId: doorDevice.id, pin: '0000' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('failed');
    expect(res.body.deviceCommandId).toBeUndefined();
  });

  test('verify-pin opens the door with the correct PIN, and Face ID stays locked afterwards', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doorDeviceId: doorDevice.id, pin: '4321' });

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('success');
    expect(res.body.deviceCommandId).toEqual(expect.any(String));

    const command = await prisma.device_commands.findUnique({ where: { id: res.body.deviceCommandId } });
    expect(command.control_method).toBe('password');

    // successfully unlocking with the PIN must NOT clear the Face ID lockout —
    // per spec, Face ID stays disabled for the full 5-minute window regardless.
    const lockStatus = await request(app)
      .get('/api/door-access/face-lock-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ doorDeviceId: doorDevice.id });
    expect(lockStatus.body.locked).toBe(true);
  });

  test('rotating the PIN deactivates the previous one', async () => {
    await request(app)
      .put(`/api/door-access/${doorDevice.id}/pin`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ pin: '5678' });

    const oldPinRes = await request(app)
      .post('/api/door-access/verify-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doorDeviceId: doorDevice.id, pin: '4321' });
    expect(oldPinRes.body.result).toBe('failed');

    const newPinRes = await request(app)
      .post('/api/door-access/verify-pin')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ doorDeviceId: doorDevice.id, pin: '5678' });
    expect(newPinRes.body.result).toBe('success');
  });
});
