const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  reader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  rating: { type: Number, min: 1, max: 5 },
  comment: { type: String },
}, { timestamps: true });

FeedbackSchema.index({ reader: 1, book: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);
