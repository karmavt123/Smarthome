const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const email = `homes-test-${Date.now()}@example.com`;
const password = 'secret123';

let accessToken;
let userId;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Homes Test', email, password });

  accessToken = signUp.body.accessToken;
  userId = signUp.body.user.id;
});

afterAll(async () => {
  await prisma.homes.deleteMany({ where: { user_id: userId } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('homes routes', () => {
  test('rejects a request without an access token', async () => {
    const res = await request(app).get('/api/homes');
    expect(res.status).toBe(401);
  });

  let homeId;

  test('creates a home', async () => {
    const res = await request(app)
      .post('/api/homes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'My House', address: '123 Main St' });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.name).toBe('My House');
    homeId = res.body.id;
  });

  test('rejects creating a home without a name', async () => {
    const res = await request(app)
      .post('/api/homes')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ address: '123 Main St' });

    expect(res.status).toBe(400);
  });

  test('lists homes, including the one just created', async () => {
    const res = await request(app)
      .get('/api/homes')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((home) => home.id === homeId)).toBe(true);
  });

  test('updates a home', async () => {
    const res = await request(app)
      .patch(`/api/homes/${homeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Renamed House' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed House');
  });

  test('returns 404 updating a home owned by someone else', async () => {
    const res = await request(app)
      .patch('/api/homes/999999999')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  test('deletes a home', async () => {
    const res = await request(app)
      .delete(`/api/homes/${homeId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);

    const getRes = await request(app)
      .get('/api/homes')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(getRes.body.some((home) => home.id === homeId)).toBe(false);
  });
});
