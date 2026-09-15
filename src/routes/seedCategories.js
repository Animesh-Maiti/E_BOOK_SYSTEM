// Small script-like route to seed some categories (can be called in dev only)
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

router.post('/seed', async (req, res) => {
  try {
    const initial = [
      { category_name: 'Computer Science', description: 'Programming, algorithms, and systems' },
      { category_name: 'Mathematics', description: 'Math textbooks and notes' },
      { category_name: 'Literature', description: 'Novels, poetry, essays' },
      { category_name: 'Science', description: 'Physics, chemistry, biology' },
    ];
    await Category.deleteMany({});
    const docs = await Category.insertMany(initial);
    res.json({ inserted: docs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
