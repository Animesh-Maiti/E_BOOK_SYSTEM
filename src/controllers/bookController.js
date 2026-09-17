const Book = require('../models/Book');
const Category = require('../models/Category');
const path = require('path');
const fs = require('fs');
const { storageRoot } = require('../middlewares/uploadMiddleware');
const { safeStoragePath } = require('../utils/helpers');
const User = require('../models/User');
const Feedback = require('../models/Feedback');
const History = require('../models/History');
const Bookmark = require('../models/Bookmark');
const mongoose = require('mongoose');
const { escapeRegex, boundedSearch } = require('../utils/validation');

function removeUploadedFile(file) {
  if (file && file.path) fs.unlink(file.path, () => {});
}

function validateBookFields({ title, description, published_date, keywords }, requireTitle = false) {
  if (requireTitle && (typeof title !== 'string' || !title.trim())) return 'Title is required';
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) return 'Title is required';
  if (typeof title === 'string' && title.trim().length > 240) return 'Title must be 240 characters or fewer';
  if (description !== undefined && typeof description !== 'string') return 'Description must be text';
  if (typeof description === 'string' && description.trim().length > 5000) return 'Description must be 5000 characters or fewer';
  if (published_date !== undefined && published_date !== '') {
    const parsedDate = new Date(published_date);
    if (Number.isNaN(parsedDate.getTime())) return 'Published date must be valid';
  }
  if (keywords !== undefined && !Array.isArray(keywords) && typeof keywords !== 'string') {
    return 'Keywords must be text or an array';
  }
  const keywordList = Array.isArray(keywords) ? keywords : typeof keywords === 'string' ? keywords.split(',') : [];
  if (keywordList.length > 20) return 'A maximum of 20 keywords is allowed';
  if (keywordList.some(keyword => typeof keyword !== 'string' || keyword.trim().length > 80)) {
    return 'Each keyword must be 80 characters or fewer';
  }
  return null;
}

function normalizedKeywords(keywords) {
  return keywords
    ? (Array.isArray(keywords) ? keywords : keywords.split(','))
      .map(keyword => keyword.trim())
      .filter(Boolean)
    : [];
}

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

    if (!title || !categoryId || !file) {
      removeUploadedFile(file);
      return res.status(400).json({ success: false, message: 'Title, category, and an ebook file are required' });
    }
    const fieldError = validateBookFields({ title, description, published_date, keywords }, true);
    if (fieldError) {
      removeUploadedFile(file);
      return res.status(422).json({ success: false, message: fieldError });
    }
    if (typeof categoryId !== 'string' || !mongoose.isValidObjectId(categoryId)) {
      removeUploadedFile(file);
      return res.status(422).json({ success: false, message: 'Category must be a valid ID' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      removeUploadedFile(file);
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
      keywords: normalizedKeywords(keywords),
      file_path: path.relative(storageRoot, file.path),
      file_type: path.extname(file.originalname).toLowerCase().slice(1),
      file_size: file.size,
    });

    try {
      await book.save();
    } catch (error) {
      removeUploadedFile(file);
      throw error;
    }
    res.status(201).json({ success: true, message: 'Book submitted for review', data: bookResponse(book.toObject()) });
  } catch (err) {
    removeUploadedFile(req.file);
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
    const page = req.query.page === undefined ? 1 : Number.parseInt(req.query.page, 10);
    const limit = req.query.limit === undefined ? 12 : Number.parseInt(req.query.limit, 10);
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
    if (req.query.search && String(req.query.search).trim().length > 100) {
      return res.status(422).json({ success: false, message: 'Search must be 100 characters or fewer' });
    }
    if (req.query.search && boundedSearch(req.query.search)) {
      const search = boundedSearch(req.query.search);
      const authorExpression = new RegExp(escapeRegex(search), 'i');
      const authors = await User.find({ name: authorExpression }).select('_id').lean();
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
  const paginated = req.query.page !== undefined || req.query.limit !== undefined;
  const page = req.query.page === undefined ? 1 : Number.parseInt(req.query.page, 10);
  const limit = req.query.limit === undefined ? 20 : Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(page) || page < 1) return res.status(422).json({ success: false, message: 'Page must be a positive integer' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(422).json({ success: false, message: 'Limit must be between 1 and 50' });
  const filter = { status: 'pending' };
  if (req.query.author !== undefined) {
    if (!mongoose.isValidObjectId(req.query.author)) return res.status(422).json({ success: false, message: 'Author must be a valid ID' });
    filter.author = req.query.author;
  }
  if (req.query.search !== undefined) {
    if (String(req.query.search).trim().length > 100) return res.status(422).json({ success: false, message: 'Search must be 100 characters or fewer' });
    const search = boundedSearch(req.query.search);
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      const authors = await User.find({ name: expression }).select('_id').lean();
      filter.$or = [
        { title: expression },
        { description: expression },
        { publisher: expression },
        { keywords: expression },
        { author: { $in: authors.map(author => author._id) } },
      ];
    }
  }
  const query = Book.find(filter).populate('category', 'category_name').populate('author', 'name')
    .sort({ createdAt: -1, _id: -1 });
  if (paginated) query.skip((page - 1) * limit).limit(limit);
  const [books, total] = await Promise.all([query, paginated ? Book.countDocuments(filter) : Promise.resolve(null)]);
  const response = { success: true, data: books.map(book => bookResponse(book.toObject())) };
  if (paginated) response.pagination = { page, limit, total, pages: Math.ceil(total / limit) };
  res.json(response);
};

exports.getOwnBooks = async (req, res) => {
  const books = await Book.find({ author: req.user.id }).populate('category', 'category_name').sort('-createdAt').lean();
  const summaries = await ratingSummary(books.map(book => book._id));
  res.json({ success: true, data: books.map(book => bookResponse(book, summaries.get(String(book._id)) || { average: 0, count: 0 })) });
};

exports.getMyBooks = async (req, res) => {
  const page = req.query.page === undefined ? 1 : Number.parseInt(req.query.page, 10);
  const limit = req.query.limit === undefined ? 12 : Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(page) || page < 1) {
    return res.status(422).json({ success: false, message: 'Page must be a positive integer' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return res.status(422).json({ success: false, message: 'Limit must be between 1 and 50' });
  }

  const filter = { author: req.user.id };
  if (req.query.status !== undefined) {
    if (!['pending', 'approved', 'rejected'].includes(req.query.status)) {
      return res.status(422).json({ success: false, message: 'Status must be pending, approved, or rejected' });
    }
    filter.status = req.query.status;
  }
  if (req.query.search !== undefined) {
    if (String(req.query.search).trim().length > 100) {
      return res.status(422).json({ success: false, message: 'Search must be 100 characters or fewer' });
    }
    const search = boundedSearch(req.query.search);
    if (search) filter.title = new RegExp(escapeRegex(search), 'i');
  }

  const [books, total] = await Promise.all([
    Book.find(filter)
      .populate('category', 'category_name')
      .populate('reviewed_by', 'name')
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Book.countDocuments(filter),
  ]);
  const summaries = await ratingSummary(books.map(book => book._id));
  res.json({
    success: true,
    data: books.map(book => bookResponse(book, summaries.get(String(book._id)) || { average: 0, count: 0 })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

exports.updateBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    removeUploadedFile(req.file);
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  const book = await Book.findById(req.params.id);
  if (!book) {
    removeUploadedFile(req.file);
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  if (!canManageBook(req, book)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ success: false, message: 'You cannot modify this book' });
  }
  if (req.user.role === 'Reader/Student') {
    removeUploadedFile(req.file);
    return res.status(403).json({ success: false, message: 'Readers cannot modify books' });
  }
  if (book.status === 'approved' && String(book.author) === String(req.user.id) && !['Librarian', 'Content Manager', 'System Administrator'].includes(req.user.role)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ success: false, message: 'Approved books require catalogue management permission to edit' });
  }
  const allowed = ['title', 'description', 'categoryId', 'publisher', 'published_date', 'keywords'];
  const fieldError = validateBookFields(req.body);
  if (fieldError) {
    removeUploadedFile(req.file);
    return res.status(422).json({ success: false, message: fieldError });
  }
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      const target = field === 'categoryId' ? 'category' : field;
      book[target] = field === 'keywords' && typeof req.body[field] === 'string'
        ? normalizedKeywords(req.body[field])
        : req.body[field];
    }
  }
  if (req.body.categoryId && (!mongoose.isValidObjectId(req.body.categoryId)
    || !await Category.exists({ _id: req.body.categoryId }))) {
    removeUploadedFile(req.file);
    return res.status(422).json({ success: false, message: 'Invalid category' });
  }
  const wasRejected = book.status === 'rejected';
  if (wasRejected) {
    book.status = 'pending';
    book.rejection_reason = undefined;
    book.reviewed_by = undefined;
    book.reviewed_at = undefined;
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
      removeUploadedFile(req.file);
      throw error;
    }
  } else {
    try {
      await book.save();
    } catch (error) {
      removeUploadedFile(req.file);
      throw error;
    }
  }
  res.json({ success: true, data: bookResponse(book.toObject()) });
};

exports.deleteBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  if (!canManageBook(req, book)) return res.status(403).json({ success: false, message: 'You cannot delete this book' });
  if (req.user.role === 'Reader/Student') return res.status(403).json({ success: false, message: 'Readers cannot delete books' });
  await book.deleteOne();
  await Promise.all([
    Bookmark.deleteMany({ book: book._id }),
    History.deleteMany({ book: book._id }),
    Feedback.deleteMany({ book: book._id }),
  ]);
  [book.file_path, book.cover_image].forEach((storedPath) => {
    if (storedPath) {
      const filePath = safeStoragePath(storageRoot, storedPath);
      if (filePath) fs.unlink(filePath, () => {});
    }
  });
  res.json({ success: true, message: 'Book deleted' });
};

exports.reviewBook = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Book not found' });
  }
  const action = req.body.action || req.body.status;
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action;
  const { rejection_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(422).json({ success: false, message: 'Action must be approve or reject' });
  }
  if (status === 'rejected' && !String(rejection_reason || '').trim()) {
    return res.status(422).json({ success: false, message: 'A rejection reason is required' });
  }
  if (rejection_reason !== undefined
    && (typeof rejection_reason !== 'string' || rejection_reason.trim().length > 1000)) {
    return res.status(422).json({ success: false, message: 'Rejection reason must be 1000 characters or fewer' });
  }
  const book = await Book.findById(req.params.id);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  if (book.status !== 'pending') {
    return res.status(409).json({ success: false, message: 'Only pending books can be moderated' });
  }
  book.status = status;
  book.rejection_reason = status === 'rejected' ? String(rejection_reason).trim() : undefined;
  book.reviewed_by = req.user.id;
  book.reviewed_at = new Date();
  await book.save();
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
