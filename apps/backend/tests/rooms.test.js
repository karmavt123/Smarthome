const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

const email = `rooms-test-${Date.now()}@example.com`;
const password = 'secret123';

let accessToken;
let home;

beforeAll(async () => {
  const signUp = await request(app)
    .post('/api/auth/sign-up')
    .send({ full_name: 'Rooms Test', email, password });

  accessToken = signUp.body.accessToken;
  home = await prisma.homes.create({
    data: { name: 'Test Home', user_id: signUp.body.user.id },
  });
});

afterAll(async () => {
  await prisma.rooms.deleteMany({ where: { home_id: home.id } });
  await prisma.homes.delete({ where: { id: home.id } });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe('rooms routes', () => {
  test('rejects a request without an access token', async () => {
    const res = await request(app).get(`/api/rooms?home_id=${home.id}`);
    expect(res.status).toBe(401);
  });

  test('requires home_id to list rooms', async () => {
    const res = await request(app)
      .get('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
  });

  let roomId;

  test('creates a room', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ home_id: home.id, name: 'Living Room' });

    expect(res.status).toBe(201);
    expect(res.body.id).toEqual(expect.any(Number));
    roomId = res.body.id;
  });

  test('rejects a duplicate room name in the same home', async () => {
    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ home_id: home.id, name: 'Living Room' });

    expect(res.status).toBe(409);
  });

  test('lists rooms for the home, including the one just created', async () => {
    const res = await request(app)
      .get(`/api/rooms?home_id=${home.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.some((room) => room.id === roomId)).toBe(true);
  });

  test('updates a room', async () => {
    const res = await request(app)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Bedroom' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Bedroom');
  });

  test('returns 404 for a room the user does not own', async () => {
    const res = await request(app)
      .patch('/api/rooms/999999999')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Nope' });

    expect(res.status).toBe(404);
  });

  test('deletes a room', async () => {
    const res = await request(app)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
  });
});
