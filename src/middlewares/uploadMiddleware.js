const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { randomFilename } = require('./securityMiddleware');

const storageRoot = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'), 'books');
fs.mkdirSync(storageRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, storageRoot),
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, randomFilename(extension));
  },
});

const uploadBook = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 20, parts: 21, fieldSize: 100 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.originalname.length > 255
      || path.basename(file.originalname) !== file.originalname
      || /[\0\r\n]/.test(file.originalname)) {
      return callback(new Error('Invalid file name'));
    }
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = (extension === '.pdf' && file.mimetype === 'application/pdf')
      || (extension === '.epub' && file.mimetype === 'application/epub+zip');
    callback(valid ? null : new Error('Only PDF and ePub files are allowed'), valid);
  },
});

function validateUploadedBook(req, res, next) {
  if (!req.file) return next();
  const extension = path.extname(req.file.originalname).toLowerCase();
  const expected = extension === '.pdf' ? Buffer.from('%PDF-') : Buffer.from('PK');
  const handle = fs.openSync(req.file.path, 'r');
  const header = Buffer.alloc(expected.length);
  try {
    fs.readSync(handle, header, 0, expected.length, 0);
  } finally {
    fs.closeSync(handle);
  }
  if (!header.equals(expected)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ success: false, message: 'The uploaded file content does not match its type' });
  }
  return next();
}

module.exports = { uploadBook, storageRoot, validateUploadedBook };
