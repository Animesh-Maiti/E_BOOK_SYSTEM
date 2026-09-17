const request = require('supertest');
const { app } = require('../server');
const Category = require('../src/models/Category');
const { userWithRole, auth } = require('./helpers/auth');
const { fixture, invalidFixture } = require('./helpers/files');

describe('book uploads', () => {
  test('accepts a valid PDF upload', async () => {
    const author = await userWithRole('Author');
    const response = await request(app).post('/api/books/submit').set(auth(author.token))
      .field({ title: 'Upload', categoryId: (await Category.findOne()).id }).attach('file', fixture());
    expect(response.status).toBe(201);
  });

  test('rejects unsupported extensions and mismatched contents', async () => {
    const author = await userWithRole('Author');
    const categoryId = (await Category.findOne()).id;
    const extension = await request(app).post('/api/books/submit').set(auth(author.token))
      .field({ title: 'Bad extension', categoryId }).attach('file', fixture('book.txt'));
    expect(extension.status).toBe(400);
    const content = await request(app).post('/api/books/submit').set(auth(author.token))
      .field({ title: 'Bad content', categoryId }).attach('file', invalidFixture());
    expect(content.status).toBe(400);
  });

  test('requires title, category, and file', async () => {
    const author = await userWithRole('Author');
    expect((await request(app).post('/api/books/submit').set(auth(author.token)).send({ title: 'Missing file' })).status).toBe(400);
  });
});
