const express = require('express');
const router = express.Router();
const {
  submitBook, getCategories, getBooks, getBook, getPendingBooks, getOwnBooks, getMyBooks, reviewBook, readBook, downloadBook, updateBook, deleteBook,
} = require('../controllers/bookController');
const auth = require('../middlewares/authMiddleware');
const { uploadBook, validateUploadedBook } = require('../middlewares/uploadMiddleware');
const { asyncHandler } = require('../utils/helpers');
const requireRoles = require('../middlewares/roleMiddleware');
const { createRateLimiter } = require('../middlewares/securityMiddleware');
const uploadLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

// Category list
router.get('/categories', asyncHandler(getCategories));
router.get('/moderation/pending', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(getPendingBooks));
router.get('/my', auth, requireRoles('Author'), asyncHandler(getMyBooks));
router.get('/mine', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), asyncHandler(getOwnBooks));
router.get('/:id/read', auth, asyncHandler(readBook));
router.get('/:id/download', auth, asyncHandler(downloadBook));
router.patch('/:id/review', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(reviewBook));
router.post('/submit', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), uploadLimiter, uploadBook.single('file'), validateUploadedBook, asyncHandler(submitBook));
router.put('/:id', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), uploadLimiter, uploadBook.single('file'), validateUploadedBook, asyncHandler(updateBook));
router.delete('/:id', auth, requireRoles('Author', 'Content Manager', 'Librarian', 'System Administrator'), asyncHandler(deleteBook));

// Get all books
router.get('/', asyncHandler(getBooks));
router.get('/:id', asyncHandler(getBook));

module.exports = router;
