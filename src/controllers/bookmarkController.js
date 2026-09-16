const Bookmark = require('../models/Bookmark');
const Book = require('../models/Book');
const mongoose = require('mongoose');

exports.list = async (req, res) => {
  const bookmarks = await Bookmark.find({ user: req.user.id }).populate({
    path: 'book', populate: [{ path: 'author', select: 'name' }, { path: 'category', select: 'category_name' }],
  }).sort('-created_at');
  res.json({ success: true, data: bookmarks });
};

exports.add = async (req, res) => {
  const bookId = req.params.bookId || req.body.bookId;
  if (!mongoose.isValidObjectId(bookId)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findOne({ _id: bookId, status: 'approved' });
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const existing = await Bookmark.exists({ user: req.user.id, book: book._id });
  if (existing) return res.status(409).json({ success: false, message: 'Book is already bookmarked' });
  const bookmark = await Bookmark.create({ user: req.user.id, book: book._id });
  res.status(201).json({ success: true, data: bookmark });
};

exports.remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookId)) return res.status(404).json({ success: false, message: 'Bookmark not found' });
  const result = await Bookmark.deleteOne({ user: req.user.id, book: req.params.bookId });
  if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Bookmark not found' });
  res.json({ success: true, message: 'Bookmark removed' });
};

exports.check = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookId)) return res.status(200).json({ success: true, bookmarked: false });
  const bookmarked = Boolean(await Bookmark.exists({ user: req.user.id, book: req.params.bookId }));
  res.json({ success: true, bookmarked });
};
