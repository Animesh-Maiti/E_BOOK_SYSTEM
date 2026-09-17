const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');

describe('categories', () => {
  test('public users can list categories', async () => {
    const response = await request(app).get('/api/categories');
    expect(response.status).toBe(200);
    expect(response.body.data.length).toBeGreaterThan(0);
  });

  test('moderators can create and update categories', async () => {
    const moderator = await userWithRole('Librarian');
    const created = await request(app).post('/api/categories').set(auth(moderator.token)).send({ category_name: 'New Category', description: 'Description' });
    expect(created.status).toBe(201);
    expect((await request(app).put(`/api/categories/${created.body.data._id}`).set(auth(moderator.token)).send({ category_name: 'Renamed Category' })).status).toBe(200);
  });

  test('readers cannot administer categories', async () => {
    const reader = await register();
    expect((await request(app).post('/api/categories').set(auth(reader.token)).send({ category_name: 'Denied' })).status).toBe(403);
  });
});
