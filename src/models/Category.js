const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  category_name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
  category_key: { type: String, trim: true, lowercase: true, select: false },
  description: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true });

CategorySchema.pre('validate', function normalizeCategory(next) {
  if (typeof this.category_name === 'string') {
    this.category_name = this.category_name.trim();
    this.category_key = this.category_name.toLocaleLowerCase();
  }
  next();
});

CategorySchema.index({ category_key: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Category', CategorySchema);
