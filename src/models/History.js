const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  last_accessed: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('History', HistorySchema);
