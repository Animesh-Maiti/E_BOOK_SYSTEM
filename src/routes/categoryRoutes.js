const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const requireRoles = require('../middlewares/roleMiddleware');
const { asyncHandler } = require('../utils/helpers');
const controller = require('../controllers/categoryController');

router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(controller.create));
router.put('/:id', auth, requireRoles('Librarian', 'Content Manager', 'System Administrator'), asyncHandler(controller.update));
router.delete('/:id', auth, requireRoles('System Administrator'), asyncHandler(controller.remove));

module.exports = router;
