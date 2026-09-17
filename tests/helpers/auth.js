const request = require('supertest');
const { app } = require('../../server');
const User = require('../../src/models/User');
const Role = require('../../src/models/Role');
async function register(overrides = {}) {
  const body = { name: 'Test Reader', email: `user${Date.now()}${Math.random()}@example.com`, password: 'StrongPass1', ...overrides };
  const response = await request(app).post('/api/auth/register').send(body);
  response.token = response.body.token; response.user = response.body.user; return response;
}
async function login(email, password = 'StrongPass1') {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  response.token = response.body.token; response.user = response.body.user; return response;
}
async function userWithRole(roleName, overrides = {}) {
  const role = await Role.findOne({ role_name: roleName });
  const registration = await register({ roleName: roleName === 'Author' ? 'Author' : undefined, ...overrides });
  const user = await User.findByIdAndUpdate(registration.user.id, { role: role._id }, { new: true });
  registration.dbUser = user; return registration;
}
function auth(token) { return { Authorization: `Bearer ${token}` }; }
module.exports = { register, login, userWithRole, auth };
