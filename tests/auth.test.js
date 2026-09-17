const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const { register, login, auth } = require('./helpers/auth');

describe('authentication', () => {
  test('registers and logs in a reader', async () => {
    const registration = await register({ email: 'auth@example.com' });
    expect(registration.status).toBe(201);
    expect(registration.body.user.role).toBe('Reader/Student');
    expect((await login('auth@example.com')).status).toBe(200);
  });

  test('normalizes registration fields and rejects duplicate email', async () => {
    const first = await register({ name: '  Alice  ', email: ' ALICE@EXAMPLE.COM ' });
    expect(first.body.user.name).toBe('Alice');
    expect(first.body.user.email).toBe('alice@example.com');
    expect((await register({ email: 'alice@example.com' })).status).toBe(409);
  });

  test('requires a valid bearer JWT and omits the password', async () => {
    expect((await request(app).get('/api/auth/me').set(auth('invalid'))).status).toBe(401);
    const user = await register();
    const response = await request(app).get('/api/auth/me').set(auth(user.token));
    expect(response.status).toBe(200);
    expect(response.body.user.password_hash).toBeUndefined();
  });

  test('rejects expired tokens and inactive users', async () => {
    const expired = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/api/auth/me').set(auth(expired))).status).toBe(401);
    const user = await register();
    const User = require('../src/models/User');
    await User.findByIdAndUpdate(user.user.id, { is_active: false });
    expect((await request(app).get('/api/auth/me').set(auth(user.token))).status).toBe(401);
  });
});
