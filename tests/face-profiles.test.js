const path = require('path');
const { createCanvas } = require('canvas');
const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

jest.setTimeout(30000); // first request lazy-loads face-api.js models from disk

const email = `face-profiles-test-${Date.now()}@example.com`;
const password = 'secret123';

const singleFaceImage = path.join(__dirname, 'fixtures/face-single-1.jpg');
const multiFaceImage = path.join(__dirname, 'fixtures/face-multi.jpg');

function noFaceImageBuffer() {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, 200, 200);
  return canvas.toBuffer('image/jpeg');
}

let accessToken;
let userId;
let home;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Face Profiles Test', email, password });

  accessToken = signUp.body.accessToken;
  userId = signUp.body.user.id;
  home = await prisma.homes.create({ data: { name: 'Test Home', user_id: userId } });
});

afterAll(async () => {
  await prisma.face_profiles.deleteMany({ where: { home_id: home.id } });
  await prisma.homes.delete({ where: { id: home.id } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('face-profiles routes', () => {
  test('rejects a request without an access token', async () => {
    const res = await request(app).get('/api/face-profiles').query({ homeId: home.id });
    expect(res.status).toBe(401);
  });

  test('rejects enrollment when no face is detected in the image', async () => {
    const res = await request(app)
      .post('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('homeId', home.id)
      .field('name', 'No Face')
      .attach('image', noFaceImageBuffer(), 'no-face.jpg');

    expect(res.status).toBe(422);
  });

  test('rejects enrollment when more than one face is detected', async () => {
    const res = await request(app)
      .post('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('homeId', home.id)
      .field('name', 'Too Many Faces')
      .attach('image', multiFaceImage);

    expect(res.status).toBe(422);
  });

  let profileId;

  test('enrolls a face profile from a single-face image', async () => {
    const res = await request(app)
      .post('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`)
      .field('homeId', home.id)
      .field('name', 'Front Door Face')
      .attach('image', singleFaceImage);

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.name).toBe('Front Door Face');
    expect(res.body.isActive).toBe(true);
    expect(res.body.imageUrl).toEqual(expect.stringContaining('/uploads/faces/'));
    expect(res.body.faceEmbedding).toBeUndefined();
    profileId = res.body.id;
  });

  test('lists face profiles for the home, without exposing the embedding', async () => {
    const res = await request(app)
      .get('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ homeId: home.id });

    expect(res.status).toBe(200);
    expect(res.body.some((profile) => profile.id === profileId)).toBe(true);
    expect(res.body.every((profile) => profile.faceEmbedding === undefined)).toBe(true);
  });

  test('rejects listing without homeId', async () => {
    const res = await request(app)
      .get('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  test('returns 404 deleting a face profile that does not belong to the user', async () => {
    const res = await request(app)
      .delete('/api/face-profiles/999999999')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
  });

  test('deletes a face profile', async () => {
    const res = await request(app)
      .delete(`/api/face-profiles/${profileId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get('/api/face-profiles')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ homeId: home.id });
    expect(listRes.body.some((profile) => profile.id === profileId)).toBe(false);
  });
});
