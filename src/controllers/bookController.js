const Book = require('../models/Book');
const Category = require('../models/Category');
const path = require('path');
const fs = require('fs');
const { storageRoot } = require('../middlewares/uploadMiddleware');
const { safeStoragePath } = require('../utils/helpers');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const History = require('../models/History');
const mongoose = require('mongoose');

function parseDateFilter(query, filter) {
  if (query.year) {
    const year = Number.parseInt(query.year, 10);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) return 'Publication year must be valid';
    filter.published_date = {
      $gte: new Date(Date.UTC(year, 0, 1)),
      $lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }
  if (query.publishedFrom || query.publishedTo) {
    filter.published_date = filter.published_date || {};
    if (query.publishedFrom) filter.published_date.$gte = new Date(query.publishedFrom);
    if (query.publishedTo) filter.published_date.$lte = new Date(query.publishedTo);
    if (Number.isNaN(filter.published_date.$gte && filter.published_date.$gte.getTime())
      || Number.isNaN(filter.published_date.$lte && filter.published_date.$lte.getTime())) return 'Publication dates must be valid';
  }
  return null;
}

function bookResponse(book, summary) {
  const response = { ...book };
  delete response.file_path;
  delete response.file_url;
  delete response.uploaded_by;
  if (summary) response.rating_summary = summary;
  return response;
}

async function ratingSummary(bookIds) {
  const rows = await Feedback.aggregate([
    { $match: { book: { $in: bookIds } } },
    { $group: { _id: '$book', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  return new Map(rows.map(row => [String(row._id), { average: Number(row.average.toFixed(2)), count: row.count }]));
}

function canManageBook(req, book) {
  return ['Librarian', 'Content Manager', 'System Administrator'].includes(req.user.role)
    || String(book.author) === String(req.user.id);
}

exports.submitBook = async (req, res) => {
  try {
    const { title, description, categoryId, keywords, published_date, publisher } = req.body;
    const file = req.file;

    if (!title || !categoryId || !file) return res.status(400).json({ success: false, message: 'Title, category, and an ebook file are required' });

    const category = await Category.findById(categoryId);
    if (!category) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    const book = new Book({
      title,
      description,
      category: category._id,
      author: req.user.id,
      uploaded_by: req.user.id,
      publisher,
      published_date: published_date ? new Date(published_date) : undefined,
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k=>k.trim())) : [],
      file_path: path.relative(storageRoot, file.path),
      file_type: path.extname(file.originalname).toLowerCase().slice(1),
      file_size: file.size,
    });

    try {
      await book.save();
    } catch (error) {
      fs.unlink(file.path, () => {});
      throw error;
    }
    res.status(201).json({ success: true, message: 'Book submitted for review', data: bookResponse(book.toObject()) });
  } catch (err) {
    throw err;
  }
};

exports.getCategories = async (req, res) => {
  try {
    const cats = await Category.find().sort('category_name');
    res.json({ success: true, data: cats });
  } catch (err) {
    throw err;
  }
};

exports.getBooks = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 12;
    if (!Number.isInteger(page) || page < 1) return res.status(422).json({ success: false, message: 'Page must be a positive integer' });
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(422).json({ success: false, message: 'Limit must be between 1 and 50' });
    const filter = { status: 'approved' };
    if (req.query.category) {
      if (!mongoose.isValidObjectId(req.query.category)) return res.status(422).json({ success: false, message: 'Category must be a valid ID' });
      filter.category = req.query.category;
    }
    if (req.query.author) {
      if (!mongoose.isValidObjectId(req.query.author)) return res.status(422).json({ success: false, message: 'Author must be a valid ID' });
      filter.author = req.query.author;
    }
    const dateError = parseDateFilter(req.query, filter);
    if (dateError) return res.status(422).json({ success: false, message: dateError });
    if (req.query.minRating !== undefined) {
      const minRating = Number(req.query.minRating);
      if (!Number.isFinite(minRating) || minRating < 0 || minRating > 5) {
        return res.status(422).json({ success: false, message: 'Minimum rating must be between 0 and 5' });
      }
      const ratedBooks = await Feedback.aggregate([
        { $group: { _id: '$book', average: { $avg: '$rating' } } },
        { $match: { average: { $gte: minRating } } },
      ]);
      filter._id = { $in: ratedBooks.map(row => row._id) };
    }
    if (req.query.search && String(req.query.search).trim()) {
      const search = String(req.query.search).trim();
      const authors = await User.find({ name: { $regex: search, $options: 'i' } }).select('_id').lean();
      filter.$or = [
        { $text: { $search: search } },
        { author: { $in: authors.map(author => author._id) } },
      ];
    }
    const sort = req.query.sort === 'oldest' ? 'createdAt' : req.query.sort === 'title' ? 'title' : '-createdAt';
    const [books, total] = await Promise.all([
      Book.find(filter).populate('category', 'category_name').populate('author', 'name').sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      Book.countDocuments(filter),
    ]);
    const summaries = await ratingSummary(books.map(book => book._id));
    res.json({
      success: true,
      data: books.map(book => bookResponse(book, summaries.get(String(book._id)) || { average: 0, count: 0 })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    throw err;
  }
};

exports.getBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findOne({ _id: req.params.id, status: 'approved' })
    .populate('category', 'category_name')
    .populate('author', 'name')
    .lean();
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const summaries = await ratingSummary([book._id]);
  res.json({ success: true, data: bookResponse(book, summaries.get(String(book._id)) || { average: 0, count: 0 }) });
};

exports.getPendingBooks = async (req, res) => {
  const books = await Book.find({ status: 'pending' }).populate('category', 'category_name').populate('author', 'name').sort('-createdAt');
  res.json({ success: true, data: books.map(book => bookResponse(book.toObject())) });
};

exports.getOwnBooks = async (req, res) => {
  const books = await Book.find({ author: req.user.id }).populate('category', 'category_name').sort('-createdAt').lean();
  const summaries = await ratingSummary(books.map(book => book._id));
  res.json({ success: true, data: books.map(book => bookResponse(book, summaries.get(String(book._id)) || { average: 0, count: 0 })) });
};

exports.updateBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  if (!canManageBook(req, book)) return res.status(403).json({ success: false, message: 'You cannot modify this book' });
  if (book.status === 'approved' && String(book.author) === String(req.user.id) && !['Librarian', 'Content Manager', 'System Administrator'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Approved books require catalogue management permission to edit' });
  }
  const allowed = ['title', 'description', 'categoryId', 'publisher', 'published_date', 'keywords'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      const target = field === 'categoryId' ? 'category' : field;
      book[target] = field === 'keywords' && typeof req.body[field] === 'string'
        ? req.body[field].split(',').map(value => value.trim()).filter(Boolean)
        : req.body[field];
    }
  }
  if (req.body.categoryId && !await Category.exists({ _id: req.body.categoryId })) {
    return res.status(422).json({ success: false, message: 'Invalid category' });
  }
  if (req.file) {
    const previousPath = book.file_path;
    book.file_path = path.relative(storageRoot, req.file.path);
    book.file_type = path.extname(req.file.originalname).toLowerCase().slice(1);
    book.file_size = req.file.size;
    try {
      await book.save();
      if (previousPath) {
        const oldPath = safeStoragePath(storageRoot, previousPath);
        if (oldPath) fs.unlink(oldPath, () => {});
      }
    } catch (error) {
      fs.unlink(req.file.path, () => {});
      throw error;
    }
  } else {
    await book.save();
  }
  res.json({ success: true, data: bookResponse(book.toObject()) });
};

exports.deleteBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  if (!canManageBook(req, book)) return res.status(403).json({ success: false, message: 'You cannot delete this book' });
  await book.deleteOne();
  if (book.file_path) {
    const filePath = safeStoragePath(storageRoot, book.file_path);
    if (filePath) fs.unlink(filePath, () => {});
  }
  res.json({ success: true, message: 'Book deleted' });
};

exports.reviewBook = async (req, res) => {
  const { status, rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Status must be approved or rejected' });
  }
  if (status === 'rejected' && !String(rejection_reason || '').trim()) {
    return res.status(422).json({ success: false, message: 'A rejection reason is required' });
  }
  const book = await Book.findByIdAndUpdate(
    req.params.id,
    { status, rejection_reason: status === 'rejected' ? String(rejection_reason).trim() : undefined },
    { new: true, runValidators: true },
  );
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  res.json({ success: true, message: `Book ${status}`, data: bookResponse(book.toObject()) });
};

async function sendBookFile(req, res, disposition) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Book file not found' });
  const book = await Book.findOne({ _id: req.params.id, status: 'approved' }).lean();
  if (!book || !book.file_path) return res.status(404).json({ success: false, message: 'Book file not found' });
  const filePath = safeStoragePath(storageRoot, book.file_path);
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Book file not found' });
  if (disposition === 'inline' && req.user) {
    await History.findOneAndUpdate(
      { user: req.user.id, book: book._id },
      { $set: { last_accessed: new Date() }, $setOnInsert: { progress: 0 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  if (disposition === 'attachment') return res.download(filePath, path.basename(filePath));
  return res.type(book.file_type === 'epub' ? 'application/epub+zip' : 'application/pdf').sendFile(filePath);
}

exports.readBook = (req, res) => sendBookFile(req, res, 'inline');
exports.downloadBook = (req, res) => sendBookFile(req, res, 'attachment');
