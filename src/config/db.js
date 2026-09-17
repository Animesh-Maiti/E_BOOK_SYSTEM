const mongoose = require('mongoose');
require('dotenv').config();
const Role = require('../models/Role');
const Category = require('../models/Category');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ebook_db';
let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await Role.bulkWrite([
      'Reader/Student',
      'Librarian',
      'Content Manager',
      'Author',
      'System Administrator',
    ].map(role_name => ({
      updateOne: { filter: { role_name }, update: { $setOnInsert: { role_name } }, upsert: true },
    })));
    await Category.bulkWrite([
      ['Computer Science', 'Programming, algorithms, and systems'],
      ['Mathematics', 'Math textbooks and notes'],
      ['Science', 'Physics, chemistry, biology'],
      ['Literature', 'Novels, poetry, and essays'],
      ['Engineering', 'Engineering theory and practice'],
      ['Business', 'Business and management'],
      ['History', 'Historical works and research'],
      ['Arts', 'Visual and performing arts'],
    ].map(([category_name, description]) => ({
      updateOne: {
        filter: { category_name },
        update: { $setOnInsert: { category_name, category_key: category_name.toLocaleLowerCase(), description } },
        upsert: true,
      },
    })));
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    await mongoose.disconnect().catch(() => {});
    throw err;
  } finally {
    connectionPromise = null;
  }
  })();

  return connectionPromise;
};

module.exports = connectDB;
module.exports.isDatabaseReady = () => mongoose.connection.readyState === 1;
module.exports.disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
};
