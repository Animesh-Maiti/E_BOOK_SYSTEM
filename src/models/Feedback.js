const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  reader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    validate: { validator: Number.isInteger, message: 'Rating must be an integer from 1 to 5' },
  },
  comment: { type: String, trim: true, maxlength: 2000 },
}, { timestamps: true });

FeedbackSchema.index({ reader: 1, book: 1 }, { unique: true });
FeedbackSchema.index({ book: 1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
