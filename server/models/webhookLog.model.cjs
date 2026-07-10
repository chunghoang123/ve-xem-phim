const pool = require('../config/database.cjs');

const WebhookLogModel = {
  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO payment_webhook_logs (provider, order_code, transaction_reference, payload, signature, processing_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.provider || 'PAYOS', data.order_code, data.transaction_reference || null,
       JSON.stringify(data.payload || {}), data.signature || '', data.processing_status || 'RECEIVED']
    );
    return { id: result.insertId, ...data };
  },

  async findByOrderCode(orderCode) {
    const [rows] = await pool.query(
      'SELECT * FROM payment_webhook_logs WHERE order_code = ? ORDER BY received_at DESC',
      [orderCode]
    );
    return rows;
  },

  async existsByOrderCode(orderCode) {
    const [rows] = await pool.query(
      "SELECT id FROM payment_webhook_logs WHERE provider = 'PAYOS' AND order_code = ? AND processing_status IN ('PROCESSED', 'DUPLICATE') LIMIT 1",
      [orderCode]
    );
    return rows.length > 0;
  },

  async updateStatus(id, status, errorMessage = null) {
    const sets = ["processing_status = ?", "processed_at = NOW()"];
    const params = [status];
    if (errorMessage) {
      sets.push("error_message = ?");
      params.push(errorMessage);
    }
    params.push(id);
    await pool.query(`UPDATE payment_webhook_logs SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  async markProcessed(orderCode, transactionRef, logId = null) {
    if (logId) {
      await pool.query(
        "UPDATE payment_webhook_logs SET processing_status = 'PROCESSED', processed_at = NOW() WHERE id = ?",
        [logId]
      );
      return;
    }
    await pool.query(
      "UPDATE payment_webhook_logs SET processing_status = 'PROCESSED', processed_at = NOW() WHERE order_code = ? AND transaction_reference <=> ?",
      [orderCode, transactionRef || null]
    );
  },
};

module.exports = WebhookLogModel;
