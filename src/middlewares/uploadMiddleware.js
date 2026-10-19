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
  limits: { fileSize: 20 * 1024 * 1024, files: 2, fields: 20, parts: 22, fieldSize: 100 * 1024 },
  fileFilter: (req, file, callback) => {
    if (file.originalname.length > 255
      || path.basename(file.originalname) !== file.originalname
      || /[\0\r\n]/.test(file.originalname)) {
      return callback(new Error('Invalid file name'));
    }
    const extension = path.extname(file.originalname).toLowerCase();
    const validBook = ['bookFile', 'file'].includes(file.fieldname)
      && ((extension === '.pdf' && file.mimetype === 'application/pdf')
        || (extension === '.epub' && file.mimetype === 'application/epub+zip'));
    const validCover = file.fieldname === 'coverImage'
      && ((extension === '.png' && file.mimetype === 'image/png')
        || (['.jpg', '.jpeg'].includes(extension) && file.mimetype === 'image/jpeg')
        || (extension === '.webp' && file.mimetype === 'image/webp'));
    if (!validBook && !validCover) {
      const error = new Error('Book files must be PDF/ePub and covers must be PNG, JPEG, or WebP');
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

function validateUploadedBook(req, res, next) {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();
  if (!files.length) return next();

  for (const file of files) {
    const extension = path.extname(file.originalname).toLowerCase();
    const expected = file.fieldname === 'coverImage'
      ? extension === '.png' ? Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : ['.jpg', '.jpeg'].includes(extension) ? Buffer.from([0xff, 0xd8, 0xff])
          : Buffer.from('RIFF')
      : extension === '.pdf' ? Buffer.from('%PDF-') : Buffer.from('PK');
    const handle = fs.openSync(file.path, 'r');
    const header = Buffer.alloc(expected.length);
    try {
      fs.readSync(handle, header, 0, expected.length, 0);
      if (file.fieldname === 'coverImage' && extension === '.webp') {
        const webpHeader = Buffer.alloc(4);
        fs.readSync(handle, webpHeader, 0, 4, 8);
        if (!header.equals(expected) || webpHeader.toString() !== 'WEBP') {
          files.forEach(upload => fs.unlink(upload.path, () => {}));
          return res.status(400).json({ success: false, message: 'The uploaded cover content does not match its type' });
        }
      } else if (!header.equals(expected)) {
        files.forEach(upload => fs.unlink(upload.path, () => {}));
        return res.status(400).json({ success: false, message: 'The uploaded file content does not match its type' });
      }
    } finally {
      fs.closeSync(handle);
    }
  }
  return next();
}

module.exports = { uploadBook, storageRoot, validateUploadedBook };
