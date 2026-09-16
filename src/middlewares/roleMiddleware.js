const User = require('../models/User');

function requireRoles(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id).populate('role', 'role_name').lean();
      const roleName = user && user.role && user.role.role_name;
      if (!roleName || !allowedRoles.includes(roleName)) {
        return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
      }
      req.user.role = roleName;
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = requireRoles;
