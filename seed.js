require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Role = require('./src/models/Role');
const Category = require('./src/models/Category');
const User = require('./src/models/User');
const Book = require('./src/models/Book');

if (!process.env.MONGO_URI) {
  console.error('Missing MONGO_URI environment variable. Please add it to your .env file before running the seed script.');
  process.exit(1);
}

const adminPassword = 'AdminPassword123!';
const adminEmail = 'admin@example.com';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function withRetry(operation, fallbackLabel, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRetryable = error && (
        error.name === 'MongoNetworkError'
        || error.name === 'MongoServerSelectionError'
        || error.code === 'ECONNRESET'
        || error.code === 'EAI_AGAIN'
        || /ECONNRESET|querySrv|ESERVFAIL|timed out|reset by peer/i.test(String(error.message))
      );

      if (!isRetryable || attempt >= retries) {
        throw error;
      }

      console.warn(`${fallbackLabel} failed (attempt ${attempt + 1}/${retries + 1}), retrying in 500ms...`);
      await sleep(500);
    }
  }
  throw lastError;
}

async function ensureRole(roleName) {
  const role = await withRetry(async () => Role.findOneAndUpdate(
    { role_name: roleName },
    { $setOnInsert: { role_name: roleName } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ), `ensureRole:${roleName}`);

  console.log(`Verified role: ${role.role_name} (${role._id})`);
  return role;
}

async function ensureCategory(name, description) {
  const category = await withRetry(async () => Category.findOneAndUpdate(
    { category_name: name },
    { $setOnInsert: { category_name: name, category_key: name.toLowerCase(), description } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ), `ensureCategory:${name}`);

  console.log(`Verified category: ${category.category_name} (${category._id})`);
  return category;
}

async function ensureAdminUser(adminRole) {
  let user = await withRetry(async () => User.findOne({ email: adminEmail.toLowerCase() }), 'findAdminUser');

  if (!user) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    user = await withRetry(async () => User.create({
      name: 'System Administrator',
      email: adminEmail.toLowerCase(),
      password_hash: passwordHash,
      role: adminRole._id,
      is_active: true,
    }), 'createAdminUser');

    console.log(`Created admin user: ${user.email} (${user._id})`);
  } else {
    console.log(`Admin user already exists: ${user.email} (${user._id})`);
  }

  return user;
}

async function ensureSampleBooks(adminUser, categoryMap) {
  const sampleBooks = [
    {
      title: 'Frankenstein',
      author: 'Mary Shelley',
      file_path: 'sample_books/book1.pdf',
      categoryName: 'Classic Literature',
    },
    {
      title: 'Clean Code Guide',
      author: 'Tech Writer',
      file_path: 'sample_books/book2.pdf',
      categoryName: 'Technology',
    },
    {
      title: 'Astrophysics Basics',
      author: 'Neil G.',
      file_path: 'sample_books/book3.pdf',
      categoryName: 'Science',
    },
  ];

  for (const sampleBook of sampleBooks) {
    const category = categoryMap.get(sampleBook.categoryName);
    if (!category) {
      console.warn(`Category not found for book seed: ${sampleBook.categoryName}`);
      continue;
    }

    const existingBook = await withRetry(async () => Book.findOne({ title: sampleBook.title }), `findBook:${sampleBook.title}`);
    if (existingBook) {
      console.log(`Sample book already exists: ${existingBook.title} (${existingBook.file_path})`);
      continue;
    }

    const createdBook = await withRetry(async () => Book.create({
      title: sampleBook.title,
      description: `Sample ${sampleBook.categoryName.toLowerCase()} book for demonstration purposes.`,
      file_path: sampleBook.file_path,
      file_url: sampleBook.file_path,
      file_type: 'pdf',
      category: category._id,
      author: adminUser._id,
      uploaded_by: adminUser._id,
      publisher: sampleBook.author,
      status: 'approved',
      reviewed_by: adminUser._id,
      reviewed_at: new Date(),
      keywords: [sampleBook.categoryName.toLowerCase(), sampleBook.title.toLowerCase()],
    }), `createBook:${sampleBook.title}`);

    console.log(`Created approved sample book: ${createdBook.title} (${createdBook.file_path})`);
    await sleep(300);
  }
}

async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log('Connected successfully to MongoDB Atlas.');

    const adminRole = await ensureRole('admin');
    const userRole = await ensureRole('user');

    const categoryInputs = [
      ['Classic Literature', 'Timeless literature and classic writing.'],
      ['Technology', 'Modern technology, programming, and digital systems.'],
      ['Science', 'Scientific knowledge and research topics.'],
    ];

    const categories = [];
    for (const [name, description] of categoryInputs) {
      categories.push(await ensureCategory(name, description));
      await sleep(300);
    }

    const categoryMap = new Map(categories.map((category) => [category.category_name, category]));
    const adminUser = await ensureAdminUser(adminRole);
    await ensureSampleBooks(adminUser, categoryMap);

    console.log('Role IDs:', { admin: adminRole._id.toString(), user: userRole._id.toString() });
    console.log('Category IDs:', Object.fromEntries(categories.map((category) => [category.category_name, category._id.toString()])));
    console.log('Admin user ID:', adminUser._id.toString());
  } catch (error) {
    console.error('Connection/Seeding error details:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('Seeding script completed and database connection closed.');
  }
}

main();
