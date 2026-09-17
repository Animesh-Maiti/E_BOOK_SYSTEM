const express = require('express');
const router = express.Router();
const {
  register, login, getCurrentUser, updateProfile, changePassword, deactivateAccount,
} = require('../controllers/authController');
const { asyncHandler } = require('../utils/helpers');
const { createRateLimiter } = require('../middlewares/securityMiddleware');
const auth = require('../middlewares/authMiddleware');

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });
const accountLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

router.post('/register', authLimiter, asyncHandler(register));
router.post('/login', authLimiter, asyncHandler(login));
router.get('/me', auth, asyncHandler(getCurrentUser));
router.put('/me', auth, asyncHandler(updateProfile));
router.put('/me/password', auth, accountLimiter, asyncHandler(changePassword));
router.delete('/me', auth, accountLimiter, asyncHandler(deactivateAccount));

module.exports = router;
