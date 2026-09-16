const Category = require('../models/Category');
const Book = require('../models/Book');
const mongoose = require('mongoose');

exports.list = async (req, res) => {
  const categories = await Category.find().sort('category_name').lean();
  res.json({ success: true, data: categories });
};

exports.get = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, message: 'Category not found' });
  }
  const category = await Category.findById(req.params.id).lean();
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  res.json({ success: true, data: category });
};

exports.create = async (req, res) => {
  const category_name = String(req.body.category_name || '').trim();
  if (!category_name) return res.status(422).json({ success: false, message: 'Category name is required' });
  try {
    const category = await Category.create({ category_name, description: req.body.description });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Category already exists' });
    throw error;
  }
};

exports.update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const categoryName = String(req.body.category_name || '').trim();
  if (!categoryName) return res.status(422).json({ success: false, message: 'Category name is required' });
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, {
    category_name: categoryName,
    description: req.body.description,
    }, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
    res.json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Category already exists' });
    throw error;
  }
};

exports.remove = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const booksUsingCategory = await Book.exists({ category: req.params.id });
  if (booksUsingCategory) {
    return res.status(409).json({ success: false, message: 'Category cannot be deleted while books reference it' });
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
  res.json({ success: true, message: 'Category deleted' });
};
