const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, trim: true, maxlength: 5000 },
  file_path: { type: String, trim: true },
  file_url: { type: String, trim: true },
  file_type: { type: String, enum: ['pdf', 'epub'] },
  file_size: { type: Number, min: 0 },
  cover_image: { type: String, trim: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  publisher: { type: String, trim: true, maxlength: 240 },
  published_date: { type: Date },
  keywords: [{ type: String, trim: true, maxlength: 80 }],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejection_reason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

BookSchema.index({ title: 'text', description: 'text', publisher: 'text', keywords: 'text' });
BookSchema.index({ category: 1, status: 1, createdAt: -1 });
BookSchema.index({ author: 1, status: 1 });
BookSchema.index({ published_date: 1, status: 1 });

module.exports = mongoose.model('Book', BookSchema);
