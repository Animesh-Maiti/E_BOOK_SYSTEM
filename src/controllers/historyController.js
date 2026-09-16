const History = require('../models/History');
const Book = require('../models/Book');
const mongoose = require('mongoose');

exports.list = async (req, res) => {
  const history = await History.find({ user: req.user.id }).populate('book').sort('-last_accessed');
  res.json({ success: true, data: history });
};

exports.update = async (req, res) => {
  const book = await Book.findOne({ _id: req.params.bookId, status: 'approved' });
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const progress = Math.min(Math.max(Number(req.body.progress) || 0, 0), 100);
  const history = await History.findOneAndUpdate(
    { user: req.user.id, book: book._id },
    { $set: { last_accessed: new Date(), progress } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).populate('book');
  res.json({ success: true, data: history });
};

exports.create = async (req, res) => {
  const bookId = req.body.bookId;
  if (!mongoose.isValidObjectId(bookId)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findOne({ _id: bookId, status: 'approved' });
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const existing = await History.exists({ user: req.user.id, book: book._id });
  if (existing) return res.status(409).json({ success: false, message: 'Reading history already exists; use PUT to update it' });
  const progress = Math.min(Math.max(Number(req.body.progress) || 0, 0), 100);
  const history = await History.create({ user: req.user.id, book: book._id, progress, last_accessed: new Date() });
  await history.populate('book');
  res.status(201).json({ success: true, data: history });
};

exports.remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookId)) return res.status(404).json({ success: false, message: 'History item not found' });
  const result = await History.deleteOne({ user: req.user.id, book: req.params.bookId });
  if (!result.deletedCount) return res.status(404).json({ success: false, message: 'History item not found' });
  res.json({ success: true, message: 'History item removed' });
};

exports.clear = async (req, res) => {
  await History.deleteMany({ user: req.user.id });
  res.json({ success: true, message: 'Reading history cleared' });
};
