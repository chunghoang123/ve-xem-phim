const pool = require('../config/database.cjs');

const PaymentModel = {
  generateCode() {
    return 'PAY' + Date.now();
  },

  async create(data) {
    const paymentCode = this.generateCode();
    const [result] = await pool.query(
      `INSERT INTO payments (payment_code, booking_id, provider, order_code, amount, description, checkout_url, qr_code,
                             account_name, account_number, bank_bin, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [paymentCode, data.booking_id, data.provider || 'PAYOS', data.order_code,
       data.amount, data.description || '', data.checkout_url || '', data.qr_code || '',
       data.account_name || '', data.account_number || '', data.bank_bin || '',
       data.status || 'PENDING', data.expires_at]
    );
    return { id: result.insertId, payment_code: paymentCode, ...data };
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async findByCode(paymentCode) {
    const [rows] = await pool.query('SELECT * FROM payments WHERE payment_code = ?', [paymentCode]);
    return rows[0] || null;
  },

  async findByOrderCode(orderCode) {
    const [rows] = await pool.query('SELECT * FROM payments WHERE order_code = ?', [orderCode]);
    return rows[0] || null;
  },

  async findActiveByBooking(bookingId) {
    const [rows] = await pool.query(
      "SELECT * FROM payments WHERE booking_id = ? AND status IN ('PENDING','PROCESSING') ORDER BY created_at DESC LIMIT 1",
      [bookingId]
    );
    return rows[0] || null;
  },

  async findByBooking(bookingId) {
    const [rows] = await pool.query(
      'SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC',
      [bookingId]
    );
    return rows;
  },

  async updateStatus(id, status, extra = {}) {
    const sets = ["status = ?"];
    const params = [status];
    if (status === 'PAID' && extra.paid_at !== false) {
      sets.push("paid_at = NOW()");
    }
    if (status === 'FAILED') {
      sets.push("failed_at = NOW()");
    }
    if (extra.transaction_reference) {
      sets.push("transaction_reference = ?");
      params.push(extra.transaction_reference);
    }
    if (extra.version != null) {
      sets.push("version = version + 1");
    }
    params.push(id);
    let where = 'id = ?';
    if (extra.version != null) {
      where += ' AND version = ?';
      params.push(extra.version);
    }
    const [result] = await pool.query(
      `UPDATE payments SET ${sets.join(', ')} WHERE ${where}`,
      params
    );
    return result.affectedRows > 0;
  },

  async expireExpiredPayments() {
    const [rows] = await pool.query(
      "SELECT id FROM payments WHERE status IN ('PENDING','PROCESSING') AND expires_at <= NOW()"
    );
    for (const row of rows) {
      await pool.query("UPDATE payments SET status = 'EXPIRED' WHERE id = ? AND status IN ('PENDING','PROCESSING')", [row.id]);
    }
    return rows;
  },
};

module.exports = PaymentModel;
