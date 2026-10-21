const express = require('express');
const router = express.Router();
const ingestController = require('../controllers/ingestController');
const { requireIngestToken, checkIngestPayloadSize, ingestRateLimiter } = require('../middleware/ingestAuthMiddleware');

// POST /api/ingest: Xác thực bằng Bearer token riêng, giới hạn payload 64KB, rate-limited (SPEC 4.2 & 7)
router.post(
    '/',
    checkIngestPayloadSize(64 * 1024),
    ingestRateLimiter,
    requireIngestToken,
    ingestController.handleIngest
);

module.exports = router;

