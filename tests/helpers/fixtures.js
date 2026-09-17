const Book = require('../../src/models/Book');
const Category = require('../../src/models/Category');
async function book({ author, status = 'approved', title = `Book ${Date.now()}`, category } = {}) {
  const cat = category || await Category.findOne();
  return Book.create({ title, description: 'Fixture book', category: cat._id, author, uploaded_by: author, status, file_path: 'fixture.pdf', file_type: 'pdf', file_size: 20 });
}
module.exports = { book };
