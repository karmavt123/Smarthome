const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const HttpError = require('../src/utils/http-error');

jest.mock('../src/services/voice-intent-client.service');
const voiceIntentClientService = require('../src/services/voice-intent-client.service');

const email = `voice-commands-test-${Date.now()}@example.com`;
const password = 'secret123';

let home;
let accessToken;
let userId;
let lightDevice;
let doorDevice;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Voice Commands Test', email, password });

  accessToken = signUp.body.accessToken;
  userId = signUp.body.user.id;
  home = await prisma.homes.create({ data: { name: 'Test Home', user_id: userId } });

  lightDevice = await prisma.devices.create({
    data: {
      home_id: home.id,
      name: 'Living Room Light',
      device_code: `light-voice-test-${Date.now()}`,
      device_type: 'light',
    },
  });

  doorDevice = await prisma.devices.create({
    data: {
      home_id: home.id,
      name: 'Front Door',
      device_code: `door-voice-test-${Date.now()}`,
      device_type: 'door',
    },
  });
});

afterEach(() => {
  jest.resetAllMocks();
});

afterAll(async () => {
  await prisma.voice_commands.deleteMany({ where: { user_id: userId } });
  await prisma.devices.deleteMany({ where: { home_id: home.id } });
  await prisma.homes.delete({ where: { id: home.id } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('POST /api/voice-commands', () => {
  test('queues a device command on a confident intent + device match', async () => {
    voiceIntentClientService.classifyIntent.mockResolvedValueOnce({
      deviceType: 'light',
      action: 'turn_on',
      confidence: 0.97,
    });

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat den phong khach', homeId: home.id });

    expect(res.status).toBe(202);
    expect(res.body.action).toBeTruthy();
    expect(res.body.voiceCommand.executionStatus).toBe('success');
    expect(res.body.voiceCommand.deviceId).toBe(lightDevice.id);
  });

  test('records unknown_command when ai-service returns 422', async () => {
    voiceIntentClientService.classifyIntent.mockRejectedValueOnce(
      new HttpError(422, 'Voice command intent not recognized', {})
    );

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'hom nay troi dep', homeId: home.id });

    expect(res.status).toBe(200);
    expect(res.body.action).toBeNull();
    expect(res.body.voiceCommand.executionStatus).toBe('unknown_command');
  });

  test('records unknown_command when intent is recognized but no matching device exists', async () => {
    voiceIntentClientService.classifyIntent.mockResolvedValueOnce({
      deviceType: 'fan',
      action: 'turn_on',
      confidence: 0.88,
    });

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat quat', homeId: home.id });

    expect(res.status).toBe(200);
    expect(res.body.action).toBeNull();
    expect(res.body.voiceCommand.executionStatus).toBe('unknown_command');
  });

  test('recognizes a door intent but requires face/PIN verification instead of opening it', async () => {
    voiceIntentClientService.classifyIntent.mockResolvedValueOnce({
      deviceType: 'door',
      action: 'open',
      confidence: 0.93,
    });

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'mo cua', homeId: home.id });

    expect(res.status).toBe(200);
    expect(res.body.action).toBeNull();
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.device.id).toBe(doorDevice.id);
    expect(res.body.voiceCommand.executionStatus).toBe('requires_verification');
    expect(res.body.voiceCommand.deviceId).toBe(doorDevice.id);

    const queuedCommands = await prisma.device_commands.count({ where: { device_id: doorDevice.id } });
    expect(queuedCommands).toBe(0);
  });

  test('surfaces a 503 without falling back when ai-service is unavailable', async () => {
    voiceIntentClientService.classifyIntent.mockRejectedValueOnce(
      new HttpError(503, 'Nhận diện lệnh giọng nói hiện không khả dụng', { voiceIntentUnavailable: true })
    );

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat den phong khach', homeId: home.id });

    expect(res.status).toBe(503);
    expect(res.body.details.voiceIntentUnavailable).toBe(true);
  });

  test('rejects an empty text', async () => {
    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: '', homeId: home.id });

    expect(res.status).toBe(400);
  });

  test('rejects a request without homeId', async () => {
    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat den phong khach' });

    expect(res.status).toBe(400);
  });

  test('rejects a homeId not owned by the caller', async () => {
    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat den phong khach', homeId: 999999999 });

    expect(res.status).toBe(404);
  });

  test('only matches devices within the given home', async () => {
    const otherSignUp = await request(app)
      .post('/api/auth/sign-up')
      .send({ full_name: 'Other Home Owner', email: `voice-other-home-${Date.now()}@example.com`, password });
    const otherHome = await prisma.homes.create({
      data: { name: 'Other Home', user_id: otherSignUp.body.user.id },
    });
    await prisma.devices.create({
      data: {
        home_id: otherHome.id,
        name: 'Living Room Light',
        device_code: `light-other-home-${Date.now()}`,
        device_type: 'light',
      },
    });

    voiceIntentClientService.classifyIntent.mockResolvedValueOnce({
      deviceType: 'light',
      action: 'turn_on',
      confidence: 0.97,
    });

    const res = await request(app)
      .post('/api/voice-commands')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ text: 'bat den phong khach', homeId: home.id });

    expect(res.status).toBe(202);
    expect(res.body.voiceCommand.deviceId).toBe(lightDevice.id);

    await prisma.devices.deleteMany({ where: { home_id: otherHome.id } });
    await prisma.homes.delete({ where: { id: otherHome.id } });
    await prisma.users.delete({ where: { id: otherSignUp.body.user.id } });
  });
});
