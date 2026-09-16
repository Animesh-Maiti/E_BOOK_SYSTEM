const mongoose = require('mongoose');
require('dotenv').config();
const Role = require('../models/Role');
const Category = require('../models/Category');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ebook_db';

const connectDB = async () => {
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
      updateOne: { filter: { category_name }, update: { $setOnInsert: { category_name, description } }, upsert: true },
    })));
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
