const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');
const { markStaleDevicesOffline } = require('../src/services/telemetry.service');
const {
  sendSimulatedHeartbeats,
  generateSimulatedReadings,
} = require('../src/simulator/runtime');

const email = `simulator-test-${Date.now()}@example.com`;
const password = 'secret123';
let accessToken;
let userId;
let resources;

beforeAll(async () => {
  process.env.SIMULATOR_COMMAND_FAILURE_RATE = '0';
  process.env.SIMULATOR_COMMAND_DELAY_MS = '20';
  process.env.DEVICE_OFFLINE_AFTER_SECONDS = '1';

  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ fullName: 'Simulator Test', email, password });

  accessToken = signUp.body.accessToken;
  userId = signUp.body.user.id;
});

afterAll(async () => {
  await prisma.users.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

function authenticated(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${accessToken}`);
}

describe('simulator backend flow', () => {
  test('bootstraps an idempotent virtual home', async () => {
    const first = await authenticated('post', '/api/simulator/bootstrap');
    const second = await authenticated('post', '/api/simulator/bootstrap');

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.home.id).toBe(first.body.home.id);
    resources = first.body;
  });

  test('returns a dashboard with current readings', async () => {
    const response = await authenticated('get', '/api/dashboard');

    expect(response.status).toBe(200);
    expect(response.body.environment.temperature.value).toEqual(expect.any(Number));
    expect(response.body.environment.humidity.value).toEqual(expect.any(Number));
    expect(response.body.environment.light.value).toEqual(expect.any(Number));
  });

  test('runtime generates bounded readings and heartbeats', async () => {
    const before = await prisma.sensor_readings.count({
      where: { sensors: { device_id: resources.devices.environment.id } },
    });

    await generateSimulatedReadings();
    await sendSimulatedHeartbeats();

    const after = await prisma.sensor_readings.count({
      where: { sensors: { device_id: resources.devices.environment.id } },
    });
    expect(after).toBe(before + 3);

    const dashboard = await authenticated('get', '/api/dashboard');
    expect(dashboard.body.environment.temperature.value).toBeGreaterThanOrEqual(20);
    expect(dashboard.body.environment.temperature.value).toBeLessThanOrEqual(35);
    expect(dashboard.body.environment.humidity.value).toBeGreaterThanOrEqual(35);
    expect(dashboard.body.environment.humidity.value).toBeLessThanOrEqual(80);
    expect(dashboard.body.environment.light.value).toBeGreaterThanOrEqual(0);
    expect(dashboard.body.environment.light.value).toBeLessThanOrEqual(1000);
  });

  test('stores telemetry and creates a threshold alert', async () => {
    const payload = {
      deviceCode: resources.devices.environment.deviceCode,
      messageId: `test-high-${Date.now()}`,
      readings: { temperature: 31.5, humidity: 55, light: 300 },
    };
    const response = await authenticated('post', '/api/telemetry/readings').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.duplicate).toBe(false);

    const duplicate = await authenticated('post', '/api/telemetry/readings').send(payload);
    expect(duplicate.status).toBe(201);
    expect(duplicate.body.duplicate).toBe(true);
    expect(duplicate.body.stored).toHaveLength(0);

    const alerts = await authenticated('get', '/api/alerts');
    const highTemperature = alerts.body.data.find((alert) => alert.title === 'High temperature');
    expect(highTemperature).toBeDefined();

    await authenticated('post', '/api/telemetry/readings').send({
      deviceCode: resources.devices.environment.deviceCode,
      messageId: `test-normal-${Date.now()}`,
      readings: { temperature: 25, humidity: 55, light: 300 },
    });
    const resolved = await authenticated('get', '/api/alerts');
    expect(resolved.body.data.find((alert) => alert.id === highTemperature.id).status).toBe('resolved');
  });

  test('accepts a numeric deviceCode string as a device id', async () => {
    const bootstrap = await authenticated('post', '/api/simulator/bootstrap');
    const environmentDeviceId = bootstrap.body.devices.environment.id;

    const response = await authenticated('post', '/api/telemetry/readings').send({
      deviceCode: String(environmentDeviceId),
      messageId: `numeric-device-${Date.now()}`,
      readings: { temperature: 24, humidity: 55, light: 300 },
    });

    expect(response.status).toBe(201);
    expect(response.body.duplicate).toBe(false);
  });

  test('moves a simulated device command from pending to success', async () => {
    const queued = await authenticated(
      'post',
      `/api/devices/${resources.devices.light.id}/commands`
    ).send({ action: 'turn_on' });

    expect(queued.status).toBe(202);
    expect(queued.body.action.executionStatus).toBe('pending');

    await new Promise((resolve) => setTimeout(resolve, 60));
    const completed = await authenticated('get', `/api/device-actions/${queued.body.action.id}`);
    expect(completed.body.executionStatus).toBe('success');
    expect(completed.body.devices.status).toBe('on');
  });

  test('supports value commands and validates command ids', async () => {
    const queued = await authenticated(
      'post',
      `/api/devices/${resources.devices.fan.id}/commands`
    ).send({ action: 'set_speed', value: 65 });

    expect(queued.status).toBe(202);
    await new Promise((resolve) => setTimeout(resolve, 60));
    const completed = await authenticated('get', `/api/device-actions/${queued.body.action.id}`);
    expect(completed.body.executionStatus).toBe('success');
    expect(completed.body.devices.status).toBe('speed:65');

    const invalid = await authenticated(
      'post',
      `/api/devices/${resources.devices.fan.id}/commands`
    ).send({ action: 'turn_off', commandId: 'not-a-uuid' });
    expect(invalid.status).toBe(400);
  });

  test('stores door access events', async () => {
    const response = await authenticated('post', '/api/door-access/events').send({
      doorDeviceId: resources.devices.door.id,
      faceProfileId: resources.faceProfile.id,
      accessMethod: 'face',
      result: 'success',
      confidenceScore: 0.96,
    });

    expect(response.status).toBe(201);
    expect(response.body.accessLog.result).toBe('success');

    const passwordAttempt = await authenticated('post', '/api/door-access/events').send({
      doorDeviceId: resources.devices.door.id,
      accessMethod: 'password',
      result: 'failed',
      failureReason: 'Incorrect PIN',
    });
    expect(passwordAttempt.status).toBe(201);

    const plaintextPin = await authenticated('post', '/api/door-access/events').send({
      doorDeviceId: resources.devices.door.id,
      accessMethod: 'password',
      result: 'failed',
      failureReason: 'Incorrect PIN',
      pin: '1234',
    });
    expect(plaintextPin.status).toBe(400);
  });

  test('parses voice text into the normal command lifecycle', async () => {
    const response = await authenticated('post', '/api/voice-commands').send({
      recognizedText: 'bat den phong khach',
    });

    expect(response.status).toBe(202);
    expect(response.body.voiceCommand.intent).toBe('turn_on:light');
    expect(response.body.action.executionStatus).toBe('pending');

    const unknown = await authenticated('post', '/api/voice-commands').send({
      recognizedText: 'hom nay troi dep',
    });
    expect(unknown.status).toBe(200);
    expect(unknown.body.voiceCommand.executionStatus).toBe('unknown_command');
    expect(unknown.body.action).toBeNull();
  });

  test('fails commands sent to a paused simulator device', async () => {
    const pause = await authenticated(
      'patch',
      `/api/simulator/devices/${resources.devices.light.id}/connectivity`
    ).send({ paused: true });
    expect(pause.body.simulationPaused).toBe(true);

    const queued = await authenticated(
      'post',
      `/api/devices/${resources.devices.light.id}/commands`
    ).send({ action: 'turn_off' });
    await new Promise((resolve) => setTimeout(resolve, 60));

    const failed = await authenticated('get', `/api/device-actions/${queued.body.action.id}`);
    expect(failed.body.executionStatus).toBe('failed');
    expect(failed.body.failureReason).toBe('Device is offline');

    await authenticated(
      'patch',
      `/api/simulator/devices/${resources.devices.light.id}/connectivity`
    ).send({ paused: false });
  });

  test('marks a silent device offline and resumes it', async () => {
    await authenticated(
      'patch',
      `/api/simulator/devices/${resources.devices.environment.id}/connectivity`
    ).send({ paused: true });
    await markStaleDevicesOffline(new Date(Date.now() + 2000));

    const offlineDashboard = await authenticated('get', '/api/dashboard');
    const environment = offlineDashboard.body.devices.find(
      (device) => device.id === resources.devices.environment.id
    );
    expect(environment.connectionStatus).toBe('offline');

    const resumed = await authenticated(
      'patch',
      `/api/simulator/devices/${resources.devices.environment.id}/connectivity`
    ).send({ paused: false });
    expect(resumed.body.connectionStatus).toBe('online');
  });
});
