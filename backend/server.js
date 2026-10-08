process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    process.exit(1);
});

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const db = require('./config/db.js');

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => {
    res.send('Finance Tracker API đang hoạt động.');
});

app.get('/health', async (req, res) => {
    const isDbConnected = await db.healthCheck();
    if (isDbConnected) {
        return res.status(200).json({ status: 'UP', database: 'connected' });
    }
    return res.status(503).json({ status: 'DOWN', database: 'disconnected' });
});

app.use('/api', apiLimiter);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

const startServer = async () => {
    try {
        await db.testConnection();
        server = app.listen(PORT, () => {
            console.log(`Server đang chạy tại http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Không thể khởi động server do lỗi kết nối Database.');
        process.exit(1);
    }
};

const gracefulShutdown = () => {
    console.log('Đang tắt server an toàn...');
    if (server) {
        server.close(async () => {
            console.log('Đã đóng HTTP server.');
            await db.closePool();
            process.exit(0);
        });
    } else {
        db.closePool().then(() => process.exit(0));
    }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    gracefulShutdown();
});

startServer();
