const Book = require('../models/Book');
const Category = require('../models/Category');

exports.submitBook = async (req, res) => {
  try {
    const { title, description, categoryId, keywords, published_date, publisher } = req.body;
    const file = req.file; // via multer

    if (!title || !categoryId) return res.status(400).json({ message: 'Title and Category required' });

    const category = await Category.findById(categoryId);
    if (!category) return res.status(400).json({ message: 'Invalid category' });

    const book = new Book({
      title,
      description,
      category: category._id,
      author: req.user ? req.user.id : null,
      publisher,
      published_date: published_date ? new Date(published_date) : undefined,
      keywords: keywords ? (Array.isArray(keywords) ? keywords : keywords.split(',').map(k=>k.trim())) : [],
      file_url: file ? file.path : undefined,
    });

    await book.save();
    res.status(201).json({ message: 'Book submitted', book });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const cats = await Category.find().sort('category_name');
    res.json(cats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBooks = async (req, res) => {
  try {
    const books = await Book.find().populate('category', 'category_name').populate('author', 'username').sort('-createdAt');
    res.json(books);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

