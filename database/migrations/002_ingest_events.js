/**
 * Migration 002: Tạo bảng ingest_events phục vụ tiếp nhận tin nhắn SMS/Banking và Inbox
 */
module.exports = {
  version: '002_ingest_events',
  name: 'Tạo bảng ingest_events và idempotency cho Ingest API',

  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ingest_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        raw_message TEXT NOT NULL,
        parsed_data JSON NULL,
        status ENUM('pending', 'converted', 'ignored') NOT NULL DEFAULT 'pending',
        transaction_id INT NULL,
        idempotency_key VARCHAR(128) NOT NULL,
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_ingest_idempotency_key (idempotency_key),
        KEY idx_ingest_events_status (status),
        KEY idx_ingest_events_received (received_at),
        CONSTRAINT fk_ingest_events_transaction
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS ingest_events');
  }
};

