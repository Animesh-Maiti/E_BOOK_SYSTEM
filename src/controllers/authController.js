const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const { normalizeEmail, validatePassword, isValidEmail } = require('../utils/validation');
const { publicUser } = require('../utils/helpers');

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!name || !normalizedEmail || !password) return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
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

    const user = await User.create({ name: name.trim(), email: normalizedEmail, password_hash, role: role._id });
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

    const user = await User.findOne({ email: emailAddress }).populate('role');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, user: publicUser(user), token });
  } catch (err) {
    throw err;
  }
};
