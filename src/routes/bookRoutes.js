const express = require('express');
const router = express.Router();
const {
  submitBook, getCategories, getBooks, getBook, getPendingBooks, getOwnBooks, reviewBook, readBook, downloadBook, updateBook, deleteBook,
} = require('../controllers/bookController');
const auth = require('../middlewares/authMiddleware');
const { uploadBook } = require('../middlewares/uploadMiddleware');
const { asyncHandler } = require('../utils/helpers');
const requireRoles = require('../middlewares/roleMiddleware');

// Category list
router.get('/categories', asyncHandler(getCategories));
router.get('/moderation/pending', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(getPendingBooks));
router.get('/mine', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), asyncHandler(getOwnBooks));
router.get('/:id/read', auth, asyncHandler(readBook));
router.get('/:id/download', auth, asyncHandler(downloadBook));
router.patch('/:id/review', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(reviewBook));
router.post('/submit', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), uploadBook.single('file'), asyncHandler(submitBook));
router.put('/:id', auth, uploadBook.single('file'), asyncHandler(updateBook));
router.delete('/:id', auth, asyncHandler(deleteBook));

// Get all books
router.get('/', asyncHandler(getBooks));
router.get('/:id', asyncHandler(getBook));

module.exports = router;
