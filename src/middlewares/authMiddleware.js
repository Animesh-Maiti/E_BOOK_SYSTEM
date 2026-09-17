const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mongoose = require('mongoose');

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader !== 'string' || !/^Bearer\s+\S+$/.test(authHeader)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(500).json({ success: false, message: 'Authentication is not configured securely' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || typeof decoded.id !== 'string' || !mongoose.isValidObjectId(decoded.id)) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
    const user = await User.findById(decoded.id).populate('role', 'role_name').lean();
    if (!user || user.is_active === false) return res.status(401).json({ success: false, message: 'Unauthorized' });
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role && user.role.role_name,
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
