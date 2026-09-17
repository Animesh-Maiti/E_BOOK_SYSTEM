const request = require('supertest');
const { app } = require('../server');
const { register, userWithRole, auth } = require('./helpers/auth');

describe('administrator user management', () => {
  test('administrators list and search users', async () => {
    const admin = await userWithRole('System Administrator');
    await register({ email: 'searchable@example.com' });
    const response = await request(app).get('/api/users?search=searchable').set(auth(admin.token));
    expect(response.status).toBe(200);
    expect(response.body.data.some(user => user.email === 'searchable@example.com')).toBe(true);
  });

  test('administrators can change role and status', async () => {
    const admin = await userWithRole('System Administrator');
    const target = await register();
    expect((await request(app).patch(`/api/users/${target.user.id}/role`).set(auth(admin.token)).send({ roleName: 'Author' })).status).toBe(200);
    expect((await request(app).patch(`/api/users/${target.user.id}/status`).set(auth(admin.token)).send({ is_active: false })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(target.token))).status).toBe(401);
  });

  test('administrators cannot change their own role or status', async () => {
    const admin = await userWithRole('System Administrator');
    expect((await request(app).patch(`/api/users/${admin.user.id}/role`).set(auth(admin.token)).send({ roleName: 'Author' })).status).toBe(403);
    expect((await request(app).patch(`/api/users/${admin.user.id}/status`).set(auth(admin.token)).send({ is_active: false })).status).toBe(403);
  });
});
