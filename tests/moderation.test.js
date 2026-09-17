const request = require('supertest');
const { app } = require('../server');
const Book = require('../src/models/Book');
const Category = require('../src/models/Category');
const { userWithRole, auth } = require('./helpers/auth');
const { fixture } = require('./helpers/files');

async function makeBook(author, status = 'pending') {
  return Book.create({ title: 'Moderated', category: (await Category.findOne()).id, author: author.user.id, uploaded_by: author.user.id, status, file_path: 'fixture.pdf', file_type: 'pdf', file_size: 10 });
}

describe('moderation', () => {
  test('moderators approve and reject pending books', async () => {
    const author = await userWithRole('Author');
    const moderator = await userWithRole('Librarian');
    const book = await makeBook(author);
    expect((await request(app).patch(`/api/books/${book.id}/review`).set(auth(moderator.token)).send({ status: 'approved' })).status).toBe(200);
    const rejected = await makeBook(author);
    const response = await request(app).patch(`/api/books/${rejected.id}/review`).set(auth(moderator.token)).send({ status: 'rejected', rejection_reason: 'Needs changes' });
    expect(response.body.data.status).toBe('rejected');
  });

  test('rejected books can be resubmitted by their owner', async () => {
    const author = await userWithRole('Author');
    const moderator = await userWithRole('Content Manager');
    const book = await makeBook(author, 'rejected');
    const category = await Category.findOne();
    const response = await request(app).put(`/api/books/${book.id}`).set(auth(author.token))
      .field({ title: 'Resubmitted', categoryId: category.id }).attach('file', fixture());
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('pending');
    expect((await request(app).get('/api/books/moderation/pending').set(auth(moderator.token))).body.data).toHaveLength(1);
  });

  test('moderation pending list requires a moderator', async () => {
    const reader = await userWithRole('Reader/Student');
    expect((await request(app).get('/api/books/moderation/pending').set(auth(reader.token))).status).toBe(403);
  });
});
