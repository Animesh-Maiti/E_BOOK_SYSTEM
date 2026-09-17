const express = require('express');
const router = express.Router();
const auth = require('../middlewares/authMiddleware');
const { asyncHandler } = require('../utils/helpers');
const controller = require('../controllers/feedbackController');
const { createRateLimiter } = require('../middlewares/securityMiddleware');
const feedbackLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });

router.get('/book/:bookId', asyncHandler(controller.list));
router.post('/', auth, feedbackLimiter, asyncHandler(controller.create));
router.put('/:id', auth, asyncHandler(controller.update));
router.post('/book/:bookId', auth, feedbackLimiter, asyncHandler((req, res, next) => {
  req.body.bookId = req.params.bookId;
  return controller.create(req, res, next);
}));
router.delete('/:id', auth, asyncHandler(controller.remove));

module.exports = router;
