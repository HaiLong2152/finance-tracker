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
require('./config/db.js');

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
    try {
        const pool = require('./config/db.js');
        await pool.query('SELECT 1');
        res.status(200).json({ status: 'UP', database: 'connected' });
    } catch (error) {
        res.status(503).json({ status: 'DOWN', database: 'disconnected' });
    }
});

app.use('/api', apiLimiter);
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

const gracefulShutdown = () => {
    console.log('Đang tắt server an toàn...');
    server.close(async () => {
        console.log('Đã đóng HTTP server.');
        try {
            const pool = require('./config/db.js');
            await pool.end();
            console.log('Đã đóng kết nối Database.');
            process.exit(0);
        } catch (err) {
            console.error('Lỗi khi đóng kết nối DB:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message);
    gracefulShutdown();
});
