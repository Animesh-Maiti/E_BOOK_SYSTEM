const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const { asyncHandler } = require('../utils/helpers');

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));

module.exports = router;
