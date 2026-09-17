const path = require('path');

const roles = ['Reader/Student', 'Librarian', 'Content Manager', 'Author', 'System Administrator'];
const elevatedRoles = ['Librarian', 'Content Manager', 'System Administrator'];
const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role && (user.role.role_name || user.role),
    profile_image: user.profile_image || null,
    ...(user.createdAt ? { createdAt: user.createdAt } : {}),
    ...(user.updatedAt ? { updatedAt: user.updatedAt } : {}),
  };
}

function safeStoragePath(storageRoot, storedPath) {
  const root = path.resolve(storageRoot);
  const resolved = path.resolve(root, storedPath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

module.exports = { roles, elevatedRoles, publicUser, safeStoragePath, asyncHandler };
