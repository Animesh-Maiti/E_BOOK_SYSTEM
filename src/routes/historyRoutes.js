const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../utils/helpers');
const controller = require('../controllers/historyController');

router.use(auth);
router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.create));
router.put('/:bookId', asyncHandler(controller.update));
router.delete('/', asyncHandler(controller.clear));
router.delete('/:bookId', asyncHandler(controller.remove));

module.exports = router;
