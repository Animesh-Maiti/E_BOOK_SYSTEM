const mongoose = require('mongoose');
const Role = require('../../src/models/Role');
const Category = require('../../src/models/Category');
async function clearDatabase() {
  await Promise.all(Object.values(mongoose.connection.collections).map(c => c.deleteMany({})));
}
async function role(name) { return Role.findOne({ role_name: name }); }
async function category(name = 'Computer Science') { return Category.findOne({ category_name: name }); }
module.exports = { clearDatabase, role, category };
