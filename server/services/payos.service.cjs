const pool = require('../config/database.cjs');

const WEBHOOK_TABLE = 'payos_webhooks';

const PayOSService = {
  async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`${WEBHOOK_TABLE}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        webhook_id VARCHAR(255) NOT NULL UNIQUE,
        order_code BIGINT NOT NULL,
        status VARCHAR(50) NOT NULL,
        raw_body JSON,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_webhook_id (webhook_id),
        INDEX idx_order_code (order_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  },

  async isProcessed(webhookId) {
    const [rows] = await pool.query(
      `SELECT id FROM \`${WEBHOOK_TABLE}\` WHERE webhook_id = ?`,
      [webhookId]
    );
    return rows.length > 0;
  },

  async markProcessed(webhookId, orderCode, status, rawBody) {
    await pool.query(
      `INSERT IGNORE INTO \`${WEBHOOK_TABLE}\` (webhook_id, order_code, status, raw_body) VALUES (?, ?, ?, ?)`,
      [webhookId, orderCode, status, JSON.stringify(rawBody)]
    );
  },

  async updateBillStatus(orderCode, status) {
    if (status === 'PAID') {
      await pool.query(
        `UPDATE bills SET status = 'PAID', paid_at = NOW() WHERE id = ? AND status = 'PENDING_PAYMENT'`,
        [orderCode]
      );
      const [bills] = await pool.query(
        `SELECT * FROM bills WHERE id = ? AND status = 'PAID'`,
        [orderCode]
      );
      if (bills.length > 0) {
        const bill = bills[0];
        await pool.query(
          `UPDATE booking_seats SET status = 'BOOKED' WHERE booking_id = ?`,
          [bill.booking_id]
        );
        await pool.query(
          `UPDATE seats s JOIN booking_seats bs ON s.id = bs.seat_id AND bs.booking_id = ? SET s.status = 'booked'`,
          [bill.booking_id]
        );
      }
    } else if (status === 'CANCELLED') {
      await pool.query(
        `UPDATE bills SET status = 'CANCELLED' WHERE id = ? AND status = 'PENDING_PAYMENT'`,
        [orderCode]
      );
    }
  },
};

module.exports = PayOSService;
