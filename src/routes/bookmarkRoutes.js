const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../utils/helpers');
const controller = require('../controllers/bookmarkController');

router.use(auth);
router.get('/', asyncHandler(controller.list));
router.post('/', asyncHandler(controller.add));
router.post('/:bookId', asyncHandler(controller.add));
router.get('/check/:bookId', asyncHandler(controller.check));
router.delete('/:bookId', asyncHandler(controller.remove));

module.exports = router;
