const fs = require('fs');
const path = require('path');
const multer = require('multer');

const storageRoot = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'), 'books');
fs.mkdirSync(storageRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, storageRoot),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${extension}`);
  },
});

const uploadBook = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = (extension === '.pdf' && file.mimetype === 'application/pdf')
      || (extension === '.epub' && file.mimetype === 'application/epub+zip');
    callback(valid ? null : new Error('Only PDF and ePub files are allowed'), valid);
  },
});

module.exports = { uploadBook, storageRoot };
