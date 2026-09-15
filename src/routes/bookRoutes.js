const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { submitBook, getCategories, getBooks } = require('../controllers/bookController');
const auth = require('../middlewares/authMiddleware');

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});
// Multer with file size limit and basic file filter
const upload = multer({ 
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: function (req, file, cb) {
    const allowed = ['application/pdf', 'application/epub+zip'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and ePub are allowed.'), false);
    }
  }
});

// Category list
router.get('/categories', getCategories);

// Get all books
router.get('/', getBooks);

// Submit a book/topic (protected)
router.post('/submit', auth, function (req, res, next) {
  // Wrap multer single call to capture multer errors and surface them as JSON
  const handler = upload.single('file');
  handler(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      // Multer threw an error (file too large or invalid type)
      return res.status(400).json({ message: err.message || 'File upload error' });
    }
    // proceed to controller
    return submitBook(req, res, next);
  });
});

module.exports = router;
