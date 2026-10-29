const mysql = require('mysql2/promise');
const { env } = require('./env');

const poolOptions = {
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
};

// Cấu hình kết nối mã hóa SSL nếu được bật trong môi trường Production (SPEC 5.2)
if (env.db.ssl) {
    poolOptions.ssl = {
        rejectUnauthorized: env.db.sslRejectUnauthorized
    };
    if (env.db.sslCa) {
        poolOptions.ssl.ca = env.db.sslCa;
    }
}

const pool = mysql.createPool(poolOptions);

/**
 * Kiểm tra kết nối database lúc khởi động
 */
pool.testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        connection.release();
        return true;
    } catch (error) {
        throw error;
    }
};

/**
 * Health check kết nối MySQL kèm đo độ trễ (latency)
 */
pool.healthCheck = async () => {
    const startTime = Date.now();
    try {
        await pool.query('SELECT 1');
        const latencyMs = Date.now() - startTime;
        return {
            connected: true,
            latencyMs
        };
    } catch (error) {
        return {
            connected: false,
            latencyMs: Date.now() - startTime,
            error: error.message
        };
    }
};

/**
 * Đóng kết nối MySQL an toàn (Graceful shutdown)
 */
pool.closePool = async () => {
    try {
        await pool.end();
    } catch (error) {
        // Ignored during shutdown
    }
};

module.exports = pool;
