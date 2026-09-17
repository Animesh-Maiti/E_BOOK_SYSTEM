const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const { escapeRegex, boundedSearch } = require('../utils/validation');

const MAX_LIMIT = 50;

function adminUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role && (user.role.role_name || user.role),
    is_active: user.is_active !== false,
    ...(user.createdAt ? { createdAt: user.createdAt } : {}),
    ...(user.updatedAt ? { updatedAt: user.updatedAt } : {}),
  };
}

function parsePagination(query) {
  const page = query.page === undefined ? 1 : Number.parseInt(query.page, 10);
  const limit = query.limit === undefined ? 20 : Number.parseInt(query.limit, 10);
  if (!Number.isInteger(page) || page < 1) return { error: 'Page must be a positive integer' };
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return { error: `Limit must be between 1 and ${MAX_LIMIT}` };
  return { page, limit };
}

exports.listUsers = async (req, res) => {
  const pagination = parsePagination(req.query);
  if (pagination.error) return res.status(422).json({ success: false, message: pagination.error });

  const filter = {};
  if (req.query.search !== undefined) {
    const search = boundedSearch(req.query.search);
    if (String(req.query.search).trim().length > 100) {
      return res.status(422).json({ success: false, message: 'Search must be 100 characters or fewer' });
    }
    if (search) {
      const expression = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: expression }, { email: expression }];
    }
  }
  if (req.query.role !== undefined) {
    if (typeof req.query.role !== 'string' || !req.query.role.trim()) {
      return res.status(422).json({ success: false, message: 'Role must be valid' });
    }
    const role = await Role.findOne({ role_name: req.query.role.trim() }).select('_id').lean();
    if (!role) return res.status(422).json({ success: false, message: 'Role must be valid' });
    filter.role = role._id;
  }
  if (req.query.active !== undefined) {
    if (!['true', 'false'].includes(String(req.query.active).toLowerCase())) {
      return res.status(422).json({ success: false, message: 'Active must be true or false' });
    }
    filter.is_active = String(req.query.active).toLowerCase() === 'true';
  }

  const { page, limit } = pagination;
  const [users, total] = await Promise.all([
    User.find(filter).select('-password_hash').populate('role', 'role_name')
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: users.map(adminUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
};

exports.getUser = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'User not found' });
  const user = await User.findById(req.params.id).select('-password_hash').populate('role', 'role_name').lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: adminUser(user) });
};

exports.updateRole = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'User not found' });
  if (String(req.params.id) === String(req.user.id)) return res.status(403).json({ success: false, message: 'You cannot change your own role' });
  const requestedRole = req.body.roleName !== undefined ? req.body.roleName : req.body.role;
  if (typeof requestedRole !== 'string' || !requestedRole.trim()) {
    return res.status(422).json({ success: false, message: 'roleName is required' });
  }
  const role = await Role.findOne({ role_name: requestedRole.trim() });
  if (!role) return res.status(422).json({ success: false, message: 'Role must be one of the existing roles' });
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { role: role._id } }, { new: true, runValidators: true })
    .populate('role', 'role_name').lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: adminUser(user) });
};

exports.updateStatus = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ success: false, message: 'User not found' });
  if (String(req.params.id) === String(req.user.id)) return res.status(403).json({ success: false, message: 'You cannot change your own status' });
  const active = req.body.is_active !== undefined ? req.body.is_active : req.body.active;
  if (typeof active !== 'boolean') return res.status(422).json({ success: false, message: 'is_active must be a boolean' });
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { is_active: active } }, { new: true, runValidators: true })
    .populate('role', 'role_name').lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: adminUser(user) });
};

module.exports = exports;
