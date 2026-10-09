const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

/**
 * Kiểm tra kết nối database lúc khởi động
 */
pool.testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log(`Kết nối MySQL thành công: ${process.env.DB_NAME}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('Lỗi kết nối MySQL nghiêm trọng:', error.message);
        throw error;
    }
};

/**
 * Health check kết nối MySQL
 */
pool.healthCheck = async () => {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Đóng kết nối MySQL an toàn (Graceful shutdown)
 */
pool.closePool = async () => {
    try {
        await pool.end();
        console.log('Đã đóng kết nối MySQL pool an toàn.');
    } catch (error) {
        console.error('Lỗi khi đóng MySQL pool:', error.message);
    }
};

module.exports = pool;
