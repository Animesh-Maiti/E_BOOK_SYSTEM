const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');
const { book } = require('./helpers/fixtures');

describe('reading history', () => {
  test('history is isolated per user and clamps progress', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const first = await register();
    const second = await register();
    const response = await request(app).post('/api/history').set(auth(first.token)).send({ bookId: item.id, progress: 150 });
    expect(response.status).toBe(201);
    expect(response.body.data.progress).toBe(100);
    expect((await request(app).get('/api/history').set(auth(second.token))).body.data).toHaveLength(0);
  });

  test('duplicate history is updated and removable', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const reader = await register();
    await request(app).post('/api/history').set(auth(reader.token)).send({ bookId: item.id });
    expect((await request(app).post('/api/history').set(auth(reader.token)).send({ bookId: item.id })).status).toBe(409);
    expect((await request(app).put(`/api/history/${item.id}`).set(auth(reader.token)).send({ progress: 50 })).status).toBe(200);
    expect((await request(app).delete(`/api/history/${item.id}`).set(auth(reader.token))).status).toBe(200);
  });
});
