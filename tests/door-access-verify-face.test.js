const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

jest.setTimeout(30000); // first request lazy-loads face-api.js models from disk

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
  await prisma.device_commands.deleteMany({ where: { device_id: { in: [doorDevice.id, nonDoorDevice.id] } } });
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
});
