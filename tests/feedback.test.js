const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');
const { book } = require('./helpers/fixtures');

describe('feedback and ratings', () => {
  test('readers can create, update, list, and delete feedback', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const reader = await register();
    const created = await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: item.id, rating: 5, comment: 'Useful' });
    expect(created.status).toBe(201);
    expect((await request(app).put(`/api/feedback/${created.body.data._id}`).set(auth(reader.token)).send({ rating: 4 })).status).toBe(200);
    expect((await request(app).get(`/api/feedback/book/${item.id}`)).body.rating_summary.average).toBe(4);
    expect((await request(app).delete(`/api/feedback/${created.body.data._id}`).set(auth(reader.token))).status).toBe(200);
  });

  test('invalid ratings and duplicate feedback are rejected', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const reader = await register();
    expect((await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: item.id, rating: 6 })).status).toBe(422);
    await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: item.id, rating: 5 });
    expect((await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: item.id, rating: 4 })).status).toBe(409);
  });
});
