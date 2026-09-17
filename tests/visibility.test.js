const request = require('supertest');
const { app } = require('../server');
const { userWithRole, auth } = require('./helpers/auth');
const { book } = require('./helpers/fixtures');

describe('book visibility', () => {
  test('public listings include approved books only', async () => {
    const approved = await book({ author: (await userWithRole('Author')).user.id });
    const pending = await book({ author: (await userWithRole('Author')).user.id, status: 'pending' });
    const response = await request(app).get('/api/books');
    expect(response.body.data.some(item => String(item._id) === String(approved.id))).toBe(true);
    expect(response.body.data.some(item => String(item._id) === String(pending.id))).toBe(false);
  });

  test('authors see only their own books', async () => {
    const owner = await userWithRole('Author');
    const other = await userWithRole('Author');
    const own = await book({ author: owner.user.id, status: 'pending' });
    await book({ author: other.user.id, status: 'pending' });
    const response = await request(app).get('/api/books/mine').set(auth(owner.token));
    expect(response.body.data.map(item => String(item._id))).toEqual([String(own.id)]);
  });
});
