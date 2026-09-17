const request = require('supertest');
const { app } = require('../server');

describe('API errors', () => {
  test('unknown API routes return JSON 404 responses', async () => {
    const response = await request(app).get('/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body.success).toBe(false);
  });

  test('invalid resource identifiers return controlled errors', async () => {
    const response = await request(app).get('/api/books/not-an-id');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  test('malformed JSON is rejected', async () => {
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(response.status).toBe(400);
  });
});
