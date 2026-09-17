const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');

describe('authorization', () => {
  test('readers cannot access administrator routes', async () => {
    const reader = await register();
    expect((await request(app).get('/api/users').set(auth(reader.token))).status).toBe(403);
    expect((await request(app).post('/api/categories').set(auth(reader.token)).send({ category_name: 'Private' })).status).toBe(403);
  });

  test('only moderators can review books', async () => {
    const reader = await register();
    expect((await request(app).patch('/api/books/507f1f77bcf86cd799439011/review').set(auth(reader.token)).send({ status: 'approved' })).status).toBe(403);
  });

  test('protected routes require authentication', async () => {
    expect((await request(app).get('/api/bookmarks')).status).toBe(401);
    expect((await request(app).get('/api/history')).status).toBe(401);
  });

  test('administrators can access user management', async () => {
    const admin = await userWithRole('System Administrator');
    expect((await request(app).get('/api/users').set(auth(admin.token))).status).toBe(200);
  });
});
