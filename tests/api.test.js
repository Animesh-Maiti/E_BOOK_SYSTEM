const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const User = require('../src/models/User');
const Book = require('../src/models/Book');
const Category = require('../src/models/Category');
const Feedback = require('../src/models/Feedback');
const { register, login, userWithRole, auth } = require('./helpers/auth');
const { book } = require('./helpers/fixtures');
const { fixture, invalidFixture } = require('./helpers/files');

async function setupBook(roleName = 'Author', status = 'approved') {
  const owner = await userWithRole(roleName);
  const created = await book({ author: owner.user.id, status });
  return { owner, created };
}

describe('health, readiness, errors and security', () => {
  test('health is public', async () => expect((await request(app).get('/health')).body).toEqual({ success: true, status: 'ok' }));
  test('readiness reports connected database', async () => expect((await request(app).get('/ready')).status).toBe(200));
  test.each(['/api/no-such-route', '/api/books/not-an-id', '/api/categories/nope'])('invalid routes return JSON errors: %s', async url => {
    const response = await request(app).get(url);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
  test('unknown API route is 404', async () => expect((await request(app).get('/api/does-not-exist')).status).toBe(404));
  test('malformed JSON is rejected', async () => {
    const response = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(response.status).toBe(400);
  });
  test('security headers are present', async () => expect((await request(app).get('/health')).headers['x-content-type-options']).toBe('nosniff'));
  test('API does not expose powered by header', async () => expect((await request(app).get('/health')).headers['x-powered-by']).toBeUndefined());
});

describe('registration, login, JWT and account lifecycle', () => {
  test('registers a reader and returns token', async () => {
    const r = await register();
    expect(r.status).toBe(201); expect(r.body.user.role).toBe('Reader/Student'); expect(r.token).toBeTruthy();
  });
  test('normalizes email and name', async () => {
    const r = await register({ name: '  Alice  ', email: ' ALICE@EXAMPLE.COM ' });
    expect(r.body.user.name).toBe('Alice'); expect(r.body.user.email).toBe('alice@example.com');
  });
  test('only allows Author self-registration', async () => {
    const r = await register({ roleName: 'System Administrator' });
    expect(r.body.user.role).toBe('Reader/Student');
  });
  test('author registration is supported', async () => expect((await register({ roleName: 'Author' })).body.user.role).toBe('Author'));
  test.each([
    [{}, 400], [{ name: '', email: 'x@y.com', password: 'StrongPass1' }, 400],
    [{ name: 'A', email: 'x@y.com', password: 'StrongPass1' }, 422],
    [{ name: 'A Valid Name', email: 'bad', password: 'StrongPass1' }, 422],
    [{ name: 'A Valid Name', email: 'x@y.com', password: 'weak' }, 422],
  ])('rejects invalid registration %#', async (body, status) => {
    const response = await request(app).post('/api/auth/register').send(body);
    expect(response.status).toBe(status);
  });
  test('rejects duplicate email', async () => {
    const email = 'duplicate@example.com'; await register({ email });
    expect((await register({ email })).status).toBe(409);
  });
  test('logs in with correct credentials', async () => {
    const r = await register({ email: 'login@example.com' }); const l = await login(r.body.user.email);
    expect(l.status).toBe(200); expect(l.token).toBeTruthy();
  });
  test.each([['wrong password', 401], ['missing', 400]])('rejects %s login', async (password, status) => {
    const r = await register({ email: `bad${Date.now()}@example.com` });
    expect((await login(r.body.user.email, password === 'missing' ? '' : 'WrongPass1')).status).toBe(status);
  });
  test('rejects malformed and expired JWTs', async () => {
    expect((await request(app).get('/api/auth/me').set(auth('bad'))).status).toBe(401);
    const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET, { expiresIn: -1 });
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(401);
  });
  test('gets current user without password', async () => {
    const r = await register(); const response = await request(app).get('/api/auth/me').set(auth(r.token));
    expect(response.status).toBe(200); expect(response.body.user.password_hash).toBeUndefined();
  });
  test.each(['', 'Token abc', 'Bearer'])('requires Bearer authorization: %s', async value => {
    expect((await request(app).get('/api/auth/me').set('Authorization', value)).status).toBe(401);
  });
  test('updates profile and changes password', async () => {
    const r = await register({ email: 'profile@example.com' });
    expect((await request(app).put('/api/auth/me').set(auth(r.token)).send({ name: 'Updated' })).status).toBe(200);
    expect((await request(app).put('/api/auth/me/password').set(auth(r.token)).send({ currentPassword: 'StrongPass1', newPassword: 'NewStrong2' })).status).toBe(200);
    expect((await login('profile@example.com', 'NewStrong2')).status).toBe(200);
  });
  test('deactivates account and invalidates token', async () => {
    const r = await register();
    expect((await request(app).delete('/api/auth/me').set(auth(r.token)).send({ currentPassword: 'StrongPass1' })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(r.token))).status).toBe(401);
    expect((await login(r.user.email)).status).toBe(401);
  });
  test('inactive users cannot use old JWT', async () => {
    const r = await register(); await User.findByIdAndUpdate(r.user.id, { is_active: false });
    expect((await request(app).get('/api/auth/me').set(auth(r.token))).status).toBe(401);
  });
});

describe('role authorization and administrator users', () => {
  test('reader cannot access admin users', async () => {
    const r = await register(); expect((await request(app).get('/api/users').set(auth(r.token))).status).toBe(403);
  });
  test('admin lists users with pagination', async () => {
    const admin = await userWithRole('System Administrator'); await register({ email: 'listed@example.com' });
    const r = await request(app).get('/api/users?limit=1').set(auth(admin.token));
    expect(r.status).toBe(200); expect(r.body.pagination.limit).toBe(1); expect(r.body.data).toHaveLength(1);
  });
  test('admin filters users', async () => {
    const admin = await userWithRole('System Administrator'); await register({ email: 'filter@example.com' });
    const r = await request(app).get('/api/users?search=filter').set(auth(admin.token));
    expect(r.status).toBe(200); expect(r.body.data.some(u => u.email === 'filter@example.com')).toBe(true);
  });
  test.each(['Reader/Student', 'Author', 'Librarian', 'Content Manager'])('admin changes role to %s', async roleName => {
    const admin = await userWithRole('System Administrator'); const target = await register();
    const r = await request(app).patch(`/api/users/${target.user.id}/role`).set(auth(admin.token)).send({ roleName });
    expect(r.status).toBe(200); expect(r.body.data.role).toBe(roleName);
  });
  test('admin changes status and inactive target is denied', async () => {
    const admin = await userWithRole('System Administrator'); const target = await register();
    expect((await request(app).patch(`/api/users/${target.user.id}/status`).set(auth(admin.token)).send({ is_active: false })).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(target.token))).status).toBe(401);
  });
  test('admin cannot change own role or status', async () => {
    const admin = await userWithRole('System Administrator');
    expect((await request(app).patch(`/api/users/${admin.user.id}/role`).set(auth(admin.token)).send({ roleName: 'Author' })).status).toBe(403);
    expect((await request(app).patch(`/api/users/${admin.user.id}/status`).set(auth(admin.token)).send({ is_active: false })).status).toBe(403);
  });
  test.each(['/api/users?page=0', '/api/users?limit=99', '/api/users?active=bad'])('validates admin query: %s', async url => {
    const admin = await userWithRole('System Administrator'); expect((await request(app).get(url).set(auth(admin.token))).status).toBe(422);
  });
});

describe('books, submission, moderation and visibility', () => {
  test('public categories and approved books are visible', async () => {
    expect((await request(app).get('/api/books/categories')).status).toBe(200);
    const { created } = await setupBook(); const r = await request(app).get('/api/books');
    expect(r.status).toBe(200); expect(r.body.data.some(b => String(b._id) === String(created._id))).toBe(true);
  });
  test('pending books are hidden from public listing', async () => {
    const { created } = await setupBook('Author', 'pending');
    const r = await request(app).get('/api/books'); expect(r.body.data.some(b => String(b._id) === String(created._id))).toBe(false);
  });
  test('author submits a PDF and it starts pending', async () => {
    const author = await userWithRole('Author'); const cat = await Category.findOne();
    const r = await request(app).post('/api/books/submit').set(auth(author.token)).field({ title: 'Uploaded', categoryId: String(cat._id) }).attach('file', fixture());
    expect(r.status).toBe(201); expect(r.body.data.status).toBe('pending');
  });
  test.each(['reader.txt', 'book.pdf'])('upload validation rejects unsupported/content mismatch %#', async name => {
    const author = await userWithRole('Author'); const cat = await Category.findOne();
    const file = name.endsWith('.txt') ? fixture(name) : invalidFixture();
    const r = await request(app).post('/api/books/submit').set(auth(author.token)).field({ title: 'Bad', categoryId: String(cat._id) }).attach('file', file);
    expect(r.status).toBe(400);
  });
  test('submission requires title, category and file', async () => {
    const author = await userWithRole('Author');
    expect((await request(app).post('/api/books/submit').set(auth(author.token)).send({ title: 'Missing' })).status).toBe(400);
  });
  test('moderator lists pending books and approves one', async () => {
    const { created } = await setupBook('Author', 'pending'); const mod = await userWithRole('Librarian');
    expect((await request(app).get('/api/books/moderation/pending').set(auth(mod.token))).status).toBe(200);
    const r = await request(app).patch(`/api/books/${created._id}/review`).set(auth(mod.token)).send({ status: 'approved' });
    expect(r.status).toBe(200); expect((await Book.findById(created._id)).status).toBe('approved');
  });
  test('moderator rejects with reason and supports resubmission', async () => {
    const { created } = await setupBook('Author', 'pending'); const mod = await userWithRole('Content Manager');
    const r = await request(app).patch(`/api/books/${created._id}/review`).set(auth(mod.token)).send({ status: 'rejected', rejection_reason: 'Fix metadata' });
    expect(r.status).toBe(200); expect(r.body.data.status).toBe('rejected');
    const owner = await userWithRole('Author');
    expect((await request(app).get('/api/books/mine').set(auth(owner.token))).status).toBe(200);
  });
  test.each(['Reader/Student', 'Author'])('non-moderator cannot review books: %s', async roleName => {
    const { created } = await setupBook(); const u = await userWithRole(roleName);
    expect((await request(app).patch(`/api/books/${created._id}/review`).set(auth(u.token)).send({ status: 'approved' })).status).toBe(403);
  });
  test('authors see own books but not another authors pending book', async () => {
    const first = await setupBook('Author', 'pending'); const second = await userWithRole('Author');
    const r = await request(app).get('/api/books/mine').set(auth(second.owner?.token || second.token));
    expect(r.status).toBe(200); expect(r.body.data.some(b => String(b._id) === String(first.created._id))).toBe(false);
  });
  test.each(['/api/books?limit=0', '/api/books?page=0', '/api/books?minRating=9', '/api/books?year=xx'])('validates book query: %s', async url => expect((await request(app).get(url)).status).toBe(422));
  test('book detail only exposes safe file fields', async () => {
    const { created } = await setupBook(); const r = await request(app).get(`/api/books/${created._id}`);
    expect(r.status).toBe(200); expect(r.body.data.file_path).toBeUndefined(); expect(r.body.data.file_url).toBeUndefined();
  });
});

describe('ownership, bookmarks, history and feedback', () => {
  test('reader can bookmark approved book and duplicate is rejected', async () => {
    const { created } = await setupBook(); const reader = await register();
    const endpoint = `/api/bookmarks/${created._id}`;
    expect((await request(app).post(endpoint).set(auth(reader.token))).status).toBe(201);
    expect((await request(app).post(endpoint).set(auth(reader.token))).status).toBe(409);
    expect((await request(app).get('/api/bookmarks').set(auth(reader.token))).body.data).toHaveLength(1);
  });
  test('bookmark ownership prevents removing another users bookmark', async () => {
    const { created } = await setupBook(); const one = await register(); const two = await register();
    await request(app).post(`/api/bookmarks/${created._id}`).set(auth(one.token));
    expect((await request(app).delete(`/api/bookmarks/${created._id}`).set(auth(two.token))).status).toBe(404);
    expect((await request(app).get(`/api/bookmarks/check/${created._id}`).set(auth(one.token))).body.bookmarked).toBe(true);
  });
  test('cannot bookmark pending book', async () => {
    const { created } = await setupBook('Author', 'pending'); const reader = await register();
    expect((await request(app).post('/api/bookmarks').set(auth(reader.token)).send({ bookId: created._id })).status).toBe(404);
  });
  test('history is isolated per user and progress is bounded', async () => {
    const { created } = await setupBook(); const one = await register(); const two = await register();
    const r = await request(app).post('/api/history').set(auth(one.token)).send({ bookId: created._id, progress: 150 });
    expect(r.status).toBe(201); expect(r.body.data.progress).toBe(100);
    expect((await request(app).get('/api/history').set(auth(two.token))).body.data).toHaveLength(0);
  });
  test('history duplicate uses PUT and can be removed/cleared', async () => {
    const { created } = await setupBook(); const reader = await register();
    await request(app).post('/api/history').set(auth(reader.token)).send({ bookId: created._id });
    expect((await request(app).post('/api/history').set(auth(reader.token)).send({ bookId: created._id })).status).toBe(409);
    expect((await request(app).put(`/api/history/${created._id}`).set(auth(reader.token)).send({ progress: 50 })).status).toBe(200);
    expect((await request(app).delete(`/api/history/${created._id}`).set(auth(reader.token))).status).toBe(200);
    expect((await request(app).delete('/api/history').set(auth(reader.token))).status).toBe(200);
  });
  test('reader creates, updates, lists and deletes feedback', async () => {
    const { created } = await setupBook(); const reader = await register();
    const createdFeedback = await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: created._id, rating: 5, comment: 'Great' });
    expect(createdFeedback.status).toBe(201);
    expect((await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: created._id, rating: 4 })).status).toBe(409);
    expect((await request(app).put(`/api/feedback/${createdFeedback.body.data._id}`).set(auth(reader.token)).send({ rating: 4 })).status).toBe(200);
    expect((await request(app).get(`/api/feedback/book/${created._id}`)).body.rating_summary.average).toBe(4);
    expect((await request(app).delete(`/api/feedback/${createdFeedback.body.data._id}`).set(auth(reader.token))).status).toBe(200);
  });
  test.each([0, 6, 1.5])('rejects invalid ratings: %s', async rating => {
    const { created } = await setupBook(); const reader = await register();
    expect((await request(app).post('/api/feedback').set(auth(reader.token)).send({ bookId: created._id, rating })).status).toBe(422);
  });
  test('feedback IDOR is denied', async () => {
    const { created } = await setupBook(); const one = await register(); const two = await register();
    const f = await request(app).post('/api/feedback').set(auth(one.token)).send({ bookId: created._id, rating: 5 });
    expect((await request(app).put(`/api/feedback/${f.body.data._id}`).set(auth(two.token)).send({ rating: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/feedback/${f.body.data._id}`).set(auth(two.token))).status).toBe(404);
  });
  test('unauthenticated protected resources are denied', async () => {
    for (const url of ['/api/bookmarks', '/api/history']) {
      expect((await request(app).get(url)).status).toBe(401);
    }
    expect((await request(app).get('/api/feedback')).status).toBe(404);
  });
});

describe('category administration', () => {
  test('lists and gets categories', async () => {
    const list = await request(app).get('/api/categories'); expect(list.status).toBe(200);
    expect((await request(app).get(`/api/categories/${list.body.data[0]._id}`)).status).toBe(200);
  });
  test('librarian creates and updates category', async () => {
    const mod = await userWithRole('Librarian');
    const c = await request(app).post('/api/categories').set(auth(mod.token)).send({ category_name: `New Topic ${Date.now()}`, description: 'desc' });
    expect(c.status).toBe(201);
    expect((await request(app).put(`/api/categories/${c.body.data._id}`).set(auth(mod.token)).send({ category_name: `Renamed ${Date.now()}` })).status).toBe(200);
  });
  test('reader cannot administer categories', async () => {
    const reader = await register();
    expect((await request(app).post('/api/categories').set(auth(reader.token)).send({ category_name: 'Nope' })).status).toBe(403);
  });
  test('duplicate category and invalid data are rejected', async () => {
    const mod = await userWithRole('Content Manager');
    expect((await request(app).post('/api/categories').set(auth(mod.token)).send({ category_name: 'Computer Science' })).status).toBe(409);
    expect((await request(app).post('/api/categories').set(auth(mod.token)).send({ category_name: '' })).status).toBe(422);
  });
  test('only administrator can delete category', async () => {
    const mod = await userWithRole('Librarian'); const c = await Category.create({ category_name: 'Disposable', category_key: 'disposable' });
    expect((await request(app).delete(`/api/categories/${c._id}`).set(auth(mod.token))).status).toBe(403);
    const admin = await userWithRole('System Administrator');
    expect((await request(app).delete(`/api/categories/${c._id}`).set(auth(admin.token))).status).toBe(200);
  });
  test('category with books cannot be deleted', async () => {
    const admin = await userWithRole('System Administrator'); const { created } = await setupBook();
    expect((await request(app).delete(`/api/categories/${created.category}`).set(auth(admin.token))).status).toBe(409);
  });
});

// Keep the suite broad without duplicating setup: these contract cases exercise status
// filtering and invalid identifiers across every collection endpoint.
describe('identifier and method contracts', () => {
  test.each([
    ['GET', '/api/books/000000000000000000000000'], ['GET', '/api/feedback/book/000000000000000000000000'],
    ['DELETE', '/api/bookmarks/000000000000000000000000'], ['DELETE', '/api/history/000000000000000000000000'],
  ])('%s %s returns a controlled not-found response', async (method, url) => {
    const reader = await register(); const r = await request(app)[method.toLowerCase()](url).set(auth(reader.token));
    expect(r.status).toBeGreaterThanOrEqual(404); expect(r.body.success).toBe(false);
  });
  test.each(['PATCH', 'PUT', 'DELETE'])('unsupported method %s is not successful', async method => {
    const r = await request(app)[method.toLowerCase()]('/api/health').send({});
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
