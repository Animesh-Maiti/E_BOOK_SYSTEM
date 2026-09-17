const Category = require('../models/Category');
const Book = require('../models/Book');
const mongoose = require('mongoose');
const { escapeRegex } = require('../utils/validation');

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
  const category_name = typeof req.body.category_name === 'string' ? req.body.category_name.trim() : '';
  const description = req.body.description === undefined
    ? undefined
    : typeof req.body.description === 'string' ? req.body.description.trim() : null;
  if (!category_name) return res.status(422).json({ success: false, message: 'Category name is required' });
  if (category_name.length > 120) return res.status(422).json({ success: false, message: 'Category name must be 120 characters or fewer' });
  if (description === null) return res.status(422).json({ success: false, message: 'Category description must be text' });
  if (description && description.length > 1000) return res.status(422).json({ success: false, message: 'Category description must be 1000 characters or fewer' });
  try {
    const duplicate = await Category.exists({
      category_name: new RegExp(`^${escapeRegex(category_name)}$`, 'i'),
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Category already exists' });
    const category = await Category.create({
      category_name,
      category_key: category_name.toLocaleLowerCase(),
      description,
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Category already exists' });
    throw error;
  }
};

exports.update = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'Category not found' });
  const categoryName = typeof req.body.category_name === 'string' ? req.body.category_name.trim() : '';
  const description = req.body.description === undefined
    ? undefined
    : typeof req.body.description === 'string' ? req.body.description.trim() : null;
  if (!categoryName) return res.status(422).json({ success: false, message: 'Category name is required' });
  if (categoryName.length > 120) return res.status(422).json({ success: false, message: 'Category name must be 120 characters or fewer' });
  if (description === null) return res.status(422).json({ success: false, message: 'Category description must be text' });
  if (description && description.length > 1000) return res.status(422).json({ success: false, message: 'Category description must be 1000 characters or fewer' });
  try {
    const duplicate = await Category.exists({
      _id: { $ne: req.params.id },
      category_name: new RegExp(`^${escapeRegex(categoryName)}$`, 'i'),
    });
    if (duplicate) return res.status(409).json({ success: false, message: 'Category already exists' });
    const category = await Category.findByIdAndUpdate(req.params.id, {
    category_name: categoryName,
    category_key: categoryName.toLocaleLowerCase(),
    description,
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
