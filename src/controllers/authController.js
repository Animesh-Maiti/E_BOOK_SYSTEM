const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { normalizeEmail, validatePassword, isValidEmail } = require('../utils/validation');
const { publicUser } = require('../utils/helpers');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedName || !normalizedEmail || !password) return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    if (normalizedName.length > 120) return res.status(422).json({ success: false, message: 'Name must be 120 characters or fewer' });
    if (!isValidEmail(normalizedEmail)) return res.status(422).json({ success: false, message: 'Enter a valid email address' });
    if (!validatePassword(password)) return res.status(422).json({ success: false, message: 'Password must be 8-128 characters and include uppercase, lowercase, and a number' });

    const requestedRole = req.body.roleName || 'Reader/Student';
    const roleName = requestedRole === 'Author' ? 'Author' : 'Reader/Student';
    const role = await Role.findOne({ role_name: roleName });
    if (!role) return res.status(503).json({ success: false, message: 'Default roles have not been initialized' });

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await User.create({ name: normalizedName, email: normalizedEmail, password_hash, role: role._id });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ success: true, user: publicUser({ ...user.toObject(), role: roleName }), token });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already in use' });
    throw err;
  }
};

exports.login = async (req, res) => {
  try {
    const emailAddress = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (!emailAddress || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: emailAddress }).select('+password_hash').populate('role');
    if (!user || user.is_active === false) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, user: publicUser(user), token });
  } catch (err) {
    throw err;
  }
};

exports.getCurrentUser = async (req, res) => {
  const user = await User.findOne({ _id: req.user.id, is_active: { $ne: false } }).populate('role', 'role_name');
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  res.json({ success: true, user: publicUser(user) });
};

exports.updateProfile = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : undefined;
  const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : undefined;

  if (name === undefined && email === undefined) {
    return res.status(422).json({ success: false, message: 'Name or email is required' });
  }
  if (name !== undefined && !name) return res.status(422).json({ success: false, message: 'Name cannot be empty' });
  if (name !== undefined && name.length > 120) return res.status(422).json({ success: false, message: 'Name must be 120 characters or fewer' });
  if (email !== undefined && !isValidEmail(email)) return res.status(422).json({ success: false, message: 'Enter a valid email address' });

  try {
    const user = await User.findOne({ _id: req.user.id, is_active: { $ne: false } });
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    await user.save();
    await user.populate('role', 'role_name');
    res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ success: false, message: 'Email already in use' });
    throw err;
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new passwords are required' });
  }
  if (!validatePassword(newPassword)) {
    return res.status(422).json({ success: false, message: 'Password must be 8-128 characters and include uppercase, lowercase, and a number' });
  }

  const user = await User.findOne({ _id: req.user.id, is_active: { $ne: false } }).select('+password_hash');
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const currentMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!currentMatches) return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  if (currentPassword === newPassword || await bcrypt.compare(newPassword, user.password_hash)) {
    return res.status(422).json({ success: false, message: 'New password must differ from the current password' });
  }

  user.password_hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10));
  await user.save();
  res.json({ success: true, message: 'Password changed successfully' });
};

exports.deactivateAccount = async (req, res) => {
  const { currentPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({ success: false, message: 'Current password is required' });
  }

  const user = await User.findOne({ _id: req.user.id, is_active: { $ne: false } }).select('+password_hash');
  if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
  if (!await bcrypt.compare(currentPassword, user.password_hash)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect' });
  }

  user.is_active = false;
  await user.save();
  res.json({ success: true, message: 'Account deactivated successfully' });
};
