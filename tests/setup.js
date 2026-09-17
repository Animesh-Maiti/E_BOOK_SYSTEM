const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');
const Role = require('../src/models/Role');
const Category = require('../src/models/Category');
jest.setTimeout(30000);
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-jwt-tests-123';
process.env.NODE_ENV = 'test';
const testStorageDir = path.join(process.cwd(), '.test-storage');
process.env.STORAGE_DIR = testStorageDir;
const roles = ['Reader/Student', 'Librarian', 'Content Manager', 'Author', 'System Administrator'];
const categories = [
  ['Computer Science', 'Programming, algorithms, and systems'],
  ['Mathematics', 'Math textbooks and notes'],
  ['Science', 'Physics, chemistry, biology'],
  ['Literature', 'Novels, poetry, and essays'],
  ['Engineering', 'Engineering theory and practice'],
  ['Business', 'Business and management'],
  ['History', 'Historical works and research'],
  ['Arts', 'Visual and performing arts'],
];
let mongo;
async function seedReferenceData() {
  await Role.insertMany(roles.map(role_name => ({ role_name })));
  await Category.insertMany(categories.map(([category_name, description]) => ({
    category_name,
    category_key: category_name.toLowerCase(),
    description,
  })));
}
async function clearTestState() {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  await seedReferenceData();
  fs.rmSync(testStorageDir, { recursive: true, force: true });
  fs.mkdirSync(testStorageDir, { recursive: true });
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  await require('../src/config/db')();
  await clearTestState();
});
afterEach(async () => {
  await clearTestState();
});
afterAll(async () => {
  await require('../src/config/db').disconnectDB();
  if (mongo) await mongo.stop();
  fs.rmSync(testStorageDir, { recursive: true, force: true });
});
