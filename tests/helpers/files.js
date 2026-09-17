const fs = require('fs');
const path = require('path');
const { storageRoot } = require('../../src/middlewares/uploadMiddleware');
function fixture(name = 'book.pdf') {
  const file = path.join(storageRoot, `fixture-${name.replace(/[^a-z0-9.]/gi, '')}`);
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.writeFileSync(file, name.endsWith('.epub') ? Buffer.from('PK\x03\x04valid') : Buffer.from('%PDF-1.4 valid'));
  return file;
}
function invalidFixture() {
  const file = path.join(storageRoot, 'fixture-invalid.pdf');
  fs.mkdirSync(storageRoot, { recursive: true });
  fs.writeFileSync(file, Buffer.from('not a pdf'));
  return file;
}
module.exports = { fixture, invalidFixture };
