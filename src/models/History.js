const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  last_accessed: { type: Date, default: Date.now },
  progress: { type: Number, min: 0, max: 100, default: 0 },
}, { timestamps: true });

HistorySchema.index({ user: 1, book: 1 }, { unique: true });
HistorySchema.index({ user: 1, last_accessed: -1 });

module.exports = mongoose.model('History', HistorySchema);
