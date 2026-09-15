const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  file_url: { type: String },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publisher: { type: String },
  published_date: { type: Date },
  keywords: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Book', BookSchema);
