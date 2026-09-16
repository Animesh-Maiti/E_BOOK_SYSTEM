const mongoose = require('mongoose');

const BookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
}, { timestamps: { createdAt: 'created_at' } });

BookmarkSchema.index({ user: 1, book: 1 }, { unique: true });

module.exports = mongoose.model('Bookmark', BookmarkSchema);
