const express = require('express');
const authController = require('../controllers/authController');
const { loginRateLimiter } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', loginRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

module.exports = router;

