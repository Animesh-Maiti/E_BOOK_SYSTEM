const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  category_name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);
