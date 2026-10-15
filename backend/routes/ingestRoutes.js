const express = require('express');
const router = express.Router();
const ingestController = require('../controllers/ingestController');
const { requireIngestToken, ingestRateLimiter } = require('../middleware/ingestAuthMiddleware');

// POST /api/ingest: Xác thực bằng Bearer token riêng, rate-limited (SPEC 7 & 10)
router.post('/', ingestRateLimiter, requireIngestToken, ingestController.handleIngest);

module.exports = router;

