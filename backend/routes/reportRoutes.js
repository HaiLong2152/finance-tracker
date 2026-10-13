const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/summary', reportController.getSummary);
router.get('/by-category', reportController.getByCategory);
router.get('/trend', reportController.getTrend);

module.exports = router;

