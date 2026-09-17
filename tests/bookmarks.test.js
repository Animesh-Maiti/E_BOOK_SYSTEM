const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');
const { book } = require('./helpers/fixtures');

describe('bookmarks', () => {
  test('users can create, list, and check a bookmark', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const reader = await register();
    expect((await request(app).post(`/api/bookmarks/${item.id}`).set(auth(reader.token))).status).toBe(201);
    expect((await request(app).get('/api/bookmarks').set(auth(reader.token))).body.data).toHaveLength(1);
    expect((await request(app).get(`/api/bookmarks/check/${item.id}`).set(auth(reader.token))).body.bookmarked).toBe(true);
  });

  test('duplicate and cross-user bookmark removal are denied', async () => {
    const item = await book({ author: (await userWithRole('Author')).user.id });
    const first = await register();
    const second = await register();
    await request(app).post(`/api/bookmarks/${item.id}`).set(auth(first.token));
    expect((await request(app).post(`/api/bookmarks/${item.id}`).set(auth(first.token))).status).toBe(409);
    expect((await request(app).delete(`/api/bookmarks/${item.id}`).set(auth(second.token))).status).toBe(404);
  });
});
