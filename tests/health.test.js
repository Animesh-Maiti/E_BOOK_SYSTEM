const request = require('supertest');
const { app } = require('../server');

describe('health and readiness', () => {
  test('health is public and reports ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, status: 'ok' });
  });

  test('readiness reports the memory database connection', async () => {
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  test('security headers are present', async () => {
    const response = await request(app).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
