const request = require('supertest');
const { app } = require('../server');
const Category = require('../src/models/Category');
const { userWithRole, auth } = require('./helpers/auth');
const { fixture } = require('./helpers/files');

describe('books', () => {
  test('authors submit books through the API', async () => {
    const author = await userWithRole('Author');
    const category = await Category.findOne();
    const response = await request(app).post('/api/books/submit').set(auth(author.token))
      .field({ title: 'API Book', categoryId: category.id }).attach('file', fixture());
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('pending');
  });

  test('book details hide storage paths', async () => {
    const author = await userWithRole('Author');
    const Book = require('../src/models/Book');
    const book = await Book.create({ title: 'Visible', category: (await Category.findOne()).id, author: author.user.id, uploaded_by: author.user.id, status: 'approved', file_path: 'private.pdf', file_type: 'pdf', file_size: 10 });
    const response = await request(app).get(`/api/books/${book.id}`);
    expect(response.status).toBe(200);
    expect(response.body.data.file_path).toBeUndefined();
  });

  test('authors cannot update another authors book', async () => {
    const first = await userWithRole('Author');
    const second = await userWithRole('Author');
    const Book = require('../src/models/Book');
    const book = await Book.create({ title: 'Owned', category: (await Category.findOne()).id, author: first.user.id, uploaded_by: first.user.id, status: 'pending', file_path: 'private.pdf', file_type: 'pdf', file_size: 10 });
    expect((await request(app).put(`/api/books/${book.id}`).set(auth(second.token)).send({ title: 'Changed' })).status).toBe(403);
  });
});
