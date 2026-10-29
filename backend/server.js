const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

const { env, validateEnvironment } = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');

const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const accountRoutes = require('./routes/accountRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const ingestRoutes = require('./routes/ingestRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const ruleRoutes = require('./routes/ruleRoutes');
const importRoutes = require('./routes/importRoutes');
const reconciliationRoutes = require('./routes/reconciliationRoutes');
const { requireAuth } = require('./middleware/authMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// 1. Cấu hình Trust Proxy cho Reverse Proxy (Nginx, Cloudflare, Render...)
app.set('trust proxy', env.trustProxy);

// 2. Bảo mật HTTP Headers (Security Headers)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (env.isProduction) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// 3. CORS Configuration
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || env.cors.origins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin không được phép truy cập theo chính sách CORS.'));
    },
    credentials: true,
}));

// 4. Rate Limiter cho các API chung
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests, please try again later.' }
});

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// 5. Ngăn chặn triệt để cache trình duyệt cho tất cả các endpoint API (SPEC 5.1 & 5.4)
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.send('Finance Tracker API đang hoạt động.');
});

// 6. Health check endpoints (Liveness & Readiness Probes)
// GET /health: Liveness probe (kiểm tra tiến trình còn sống)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// GET /health/ready: Readiness probe (kiểm tra kết nối cơ sở dữ liệu MySQL)
app.get('/health/ready', async (req, res) => {
    const dbStatus = await db.healthCheck();
    if (dbStatus.connected) {
        return res.status(200).json({
            status: 'READY',
            database: 'connected',
            latencyMs: dbStatus.latencyMs,
            timestamp: new Date().toISOString()
        });
    }
    return res.status(503).json({
        status: 'DOWN',
        database: 'disconnected',
        error: dbStatus.error,
        timestamp: new Date().toISOString()
    });
});

// Mount Routes
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);

// Ingest API xác thực qua Bearer Token riêng từ điện thoại (SPEC 7 & 10)
app.use('/api/ingest', ingestRoutes);

// Tất cả tài nguyên nghiệp vụ được bảo vệ bởi phiên đăng nhập (SPEC 5.1 & 10)
app.use('/api/accounts', requireAuth, accountRoutes);
app.use('/api/categories', requireAuth, categoryRoutes);
app.use('/api/transactions', requireAuth, transactionRoutes);
app.use('/api/budgets', requireAuth, budgetRoutes);
app.use('/api/reports', requireAuth, reportRoutes);
app.use('/api/inbox', requireAuth, inboxRoutes);
app.use('/api/rules', requireAuth, ruleRoutes);
app.use('/api/import', requireAuth, importRoutes);
app.use('/api/reconciliations', requireAuth, reconciliationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

let server;

const gracefulShutdown = (exitCode = 0) => {
    logger.info('Đang tắt máy chủ an toàn (Graceful Shutdown)...', null, 'SYSTEM');

    // Chống treo tiến trình nếu đóng kết nối bị kẹt
    setTimeout(() => {
        logger.error('Quá thời gian chờ tắt máy chủ, buộc dừng tiến trình.', null, 'SYSTEM');
        process.exit(1);
    }, 5000).unref();

    if (server) {
        server.close(async () => {
            logger.info('Đã đóng HTTP server.', null, 'SYSTEM');
            if (db && typeof db.closePool === 'function') {
                await db.closePool();
            }
            process.exit(exitCode);
        });
    } else {
        if (db && typeof db.closePool === 'function') {
            db.closePool().finally(() => process.exit(exitCode));
        } else {
            process.exit(exitCode);
        }
    }
};

process.on('uncaughtException', (err) => {
    logger.error('UNCAUGHT EXCEPTION! Tiến trình sẽ dừng...', err, 'SYSTEM');
    gracefulShutdown(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('UNHANDLED REJECTION! Tiến trình sẽ dừng...', err, 'SYSTEM');
    gracefulShutdown(1);
});

process.on('SIGTERM', () => gracefulShutdown(0));
process.on('SIGINT', () => gracefulShutdown(0));

const startServer = async () => {
    try {
        // Kiểm tra biến môi trường bắt buộc trước khi mở cổng
        const { warnings } = validateEnvironment();
        if (warnings && warnings.length > 0) {
            warnings.forEach(w => logger.warn(`Cảnh báo cấu hình: ${w}`, null, 'CONFIG'));
        }

        await db.testConnection();
        logger.info(`Kết nối MySQL thành công tới database: ${env.db.name}`, null, 'DATABASE');

        server = app.listen(env.PORT, () => {
            logger.info(`Server đang chạy tại http://localhost:${env.PORT} [ENV: ${env.NODE_ENV}]`, null, 'SERVER');
        });
    } catch (error) {
        logger.error('Không thể khởi động server', error.message, 'SERVER');
        process.exit(1);
    }
};

startServer();
