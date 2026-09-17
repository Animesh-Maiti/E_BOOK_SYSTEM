const Feedback = require('../models/Feedback');
const Book = require('../models/Book');
const mongoose = require('mongoose');

exports.list = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.bookId)) return res.status(404).json({ success: false, message: 'Book not found' });
  const book = await Book.findOne({ _id: req.params.bookId, status: 'approved' }).select('_id').lean();
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const feedback = await Feedback.find({ book: req.params.bookId }).populate('reader', 'name').sort('-createdAt').lean();
  const summary = await Feedback.aggregate([
    { $match: { book: new mongoose.Types.ObjectId(req.params.bookId) } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const result = summary[0] ? { average: Number(summary[0].average.toFixed(2)), count: summary[0].count } : { average: 0, count: 0 };
  res.json({ success: true, data: feedback, rating_summary: result });
};

async function validateBook(bookId) {
  if (!mongoose.isValidObjectId(bookId)) return null;
  return Book.findOne({ _id: bookId, status: 'approved' });
}

exports.create = async (req, res) => {
  const bookId = req.body.bookId;
  const book = await validateBook(bookId);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(422).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
  if (req.body.comment !== undefined && typeof req.body.comment !== 'string') {
    return res.status(422).json({ success: false, message: 'Comment must be text' });
  }
  if (typeof req.body.comment === 'string' && req.body.comment.trim().length > 2000) {
    return res.status(422).json({ success: false, message: 'Comment must be 2000 characters or fewer' });
  }
  if (await Feedback.exists({ reader: req.user.id, book: book._id })) {
    return res.status(409).json({ success: false, message: 'You have already reviewed this book' });
  }
  const feedback = await Feedback.create({ reader: req.user.id, book: book._id, rating, comment: String(req.body.comment || '').trim() });
  res.status(201).json({ success: true, data: feedback });
};

exports.update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Review not found' });
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(422).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
  if (req.body.comment !== undefined && typeof req.body.comment !== 'string') {
    return res.status(422).json({ success: false, message: 'Comment must be text' });
  }
  if (typeof req.body.comment === 'string' && req.body.comment.trim().length > 2000) {
    return res.status(422).json({ success: false, message: 'Comment must be 2000 characters or fewer' });
  }
  const feedback = await Feedback.findOneAndUpdate(
    { _id: req.params.id, reader: req.user.id },
    { rating, comment: String(req.body.comment || '').trim() },
    { new: true, runValidators: true },
  );
  if (!feedback) return res.status(404).json({ success: false, message: 'Review not found' });
  res.json({ success: true, data: feedback });
};

exports.remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Review not found' });
  const result = await Feedback.deleteOne({ _id: req.params.id, reader: req.user.id });
  if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Review not found' });
  res.json({ success: true, message: 'Review deleted' });
};
