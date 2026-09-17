const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const requireRoles = require('../middlewares/roleMiddleware');
const { asyncHandler } = require('../utils/helpers');
const { listUsers, getUser, updateRole, updateStatus } = require('../controllers/userController');

router.use(auth, requireRoles('System Administrator'));
router.get('/', asyncHandler(listUsers));
router.get('/:id', asyncHandler(getUser));
router.patch('/:id/role', asyncHandler(updateRole));
router.patch('/:id/status', asyncHandler(updateStatus));

module.exports = router;
