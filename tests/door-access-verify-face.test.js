const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const HttpError = require('../src/utils/http-error');

jest.mock('../src/services/face-id-client.service');
const faceIdClientService = require('../src/services/face-id-client.service');

const email = `verify-face-test-${Date.now()}@example.com`;
const password = 'secret123';

const frameImage = path.join(__dirname, 'fixtures/face-single-1.jpg');

function fakeEmbedding() {
  return Array.from({ length: 512 }, (_, i) => i / 512);
}

function matchResult(profileId, distance = 0.31) {
  return { isLive: true, livenessScore: 0.95, matched: { id: profileId, distance }, distance };
}

function noMatchResult(distance = 0.75) {
  return { isLive: true, livenessScore: 0.92, matched: null, distance };
}

function livenessFailedResult() {
  return { isLive: false, livenessScore: 0.12, matched: null, distance: null };
}

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

  faceIdClientService.enrollFace.mockResolvedValueOnce(fakeEmbedding());
  const enroll = await request(app)
    .post('/api/face-profiles')
    .set('Authorization', `Bearer ${accessToken}`)
    .field('homeId', home.id)
    .field('name', 'Enrolled Face')
    .attach('image', frameImage);
  faceProfileId = enroll.body.id;
});

afterEach(() => {
  jest.resetAllMocks();
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
      .attach('images', frameImage);

    expect(res.status).toBe(401);
  });

  test('rejects when the target device is not a door', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', nonDoorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(400);
    expect(faceIdClientService.verifyFace).not.toHaveBeenCalled();
  });

  test('rejects when no image frame is attached', async () => {
    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id);

    expect(res.status).toBe(400);
  });

  test('matches the enrolled face, logs the access, and queues a door-open command', async () => {
    faceIdClientService.verifyFace.mockResolvedValueOnce(matchResult(faceProfileId));

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage)
      .attach('images', frameImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('success');
    expect(res.body.faceProfileId).toBe(faceProfileId);
    expect(res.body.deviceCommandId).toEqual(expect.any(String));

    const [frameBuffers, candidates] = faceIdClientService.verifyFace.mock.calls[0];
    expect(frameBuffers).toHaveLength(2);
    expect(candidates).toEqual([{ id: faceProfileId, embedding: fakeEmbedding() }]);

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

    faceIdClientService.verifyFace.mockResolvedValueOnce(matchResult(faceProfileId));

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('success');
    expect(res.body.faceProfileId).toBe(faceProfileId);

    const [, candidates] = faceIdClientService.verifyFace.mock.calls[0];
    expect(candidates.some((c) => c.id === placeholder.id)).toBe(false);

    await prisma.face_profiles.delete({ where: { id: placeholder.id } });
  });

  test('reports liveness_failed without writing a log or counting toward lockout', async () => {
    const logCountBefore = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    faceIdClientService.verifyFace.mockResolvedValueOnce(livenessFailedResult());

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('failed');
    expect(res.body.reason).toBe('liveness_failed');
    expect(res.body.doorAccessLogId).toBeUndefined();

    const logCountAfter = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    expect(logCountAfter).toBe(logCountBefore);
  });

  test('returns 503 when the ai-service is unreachable, without writing a log', async () => {
    const logCountBefore = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    faceIdClientService.verifyFace.mockRejectedValueOnce(
      new HttpError(503, 'Face ID hiện không khả dụng, dùng mã PIN để mở cửa', { faceIdUnavailable: true })
    );

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(503);
    expect(res.body.details.faceIdUnavailable).toBe(true);

    const logCountAfter = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    expect(logCountAfter).toBe(logCountBefore);
  });

  test('rejects a stranger face and does not queue a door-open command', async () => {
    faceIdClientService.verifyFace.mockResolvedValueOnce(noMatchResult());

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(200);
    expect(res.body.result).toBe('failed');
    expect(res.body.deviceCommandId).toBeUndefined();
    expect(res.body.confidenceScore).toBeNull();

    const log = await prisma.door_access_logs.findUnique({ where: { id: BigInt(res.body.doorAccessLogId) } });
    expect(log.result).toBe('failed');
    expect(log.face_profile_id).toBeNull();
  });

  test('raises an unauthorized_access alert + notification after 3 failed attempts in the window, without duplicating it', async () => {
    // one failed (no-match) attempt already happened in the previous test; two more reach
    // the 3-in-2-minutes threshold
    faceIdClientService.verifyFace.mockResolvedValueOnce(noMatchResult());
    await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    faceIdClientService.verifyFace.mockResolvedValueOnce(noMatchResult());
    const thirdAttempt = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);
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
    faceIdClientService.verifyFace.mockResolvedValueOnce(noMatchResult());
    await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

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

  test('verify-face returns 423 while locked, without writing a new log or alert, or calling the ai-service', async () => {
    const logCountBefore = await prisma.door_access_logs.count({ where: { door_device_id: doorDevice.id } });
    const alertCountBefore = await prisma.alerts.count({ where: { home_id: home.id } });

    const res = await request(app)
      .post('/api/door-access/verify-face')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('doorDeviceId', doorDevice.id)
      .attach('images', frameImage);

    expect(res.status).toBe(423);
    expect(res.body.details.lockedUntil).toBeTruthy();
    expect(faceIdClientService.verifyFace).not.toHaveBeenCalled();

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
