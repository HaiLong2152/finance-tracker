const mysql = require('mysql2/promise');
require('dotenv').config();

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

pool.getConnection()
    .then((connection) => {
        console.log(`Kết nối MySQL thành công: ${process.env.DB_NAME}`);
        connection.release();
    })
    .catch((error) => {
        console.error('Lỗi kết nối MySQL:', error.message);
        process.exit(1);
    });

module.exports = pool;
