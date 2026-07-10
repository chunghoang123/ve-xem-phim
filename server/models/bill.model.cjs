const pool = require('../config/database.cjs');

const BillModel = {
  async findAll({ page = 1, limit = 10, user_id, status }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (user_id) { conditions.push('b.user_id = ?'); params.push(user_id); }
    if (status) { conditions.push('b.status = ?'); params.push(status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM bills b ${where}`, params);
    const total = countRows[0].total;

    const sql = `
      SELECT b.*, bk.code as booking_code, bk.showtime_id,
             m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, c.name as cinema_name
      FROM bills b
      JOIN bookings bk ON b.booking_id = bk.id
      JOIN showtimes s ON bk.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query(`
      SELECT b.*, bk.code as booking_code, bk.showtime_id, bk.seats_json,
             m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, s.screen_id as room_id,
             c.name as cinema_name, c.address as cinema_address,
             u.name as user_name, u.email as user_email
      FROM bills b
      JOIN bookings bk ON b.booking_id = bk.id
      JOIN showtimes s ON bk.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`, [id]);
    return rows[0] || null;
  },

  async findByBookingId(bookingId) {
    const [rows] = await pool.query('SELECT * FROM bills WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1', [bookingId]);
    return rows[0] || null;
  },

  async findByBooking(bookingId) {
    const [rows] = await pool.query('SELECT * FROM bills WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1', [bookingId]);
    return rows[0] || null;
  },

  async create(data) {
    const expiresAt = data.expires_at || new Date(Date.now() + 15 * 60 * 1000);
    const [result] = await pool.query(
      'INSERT INTO bills (booking_id, user_id, total, status, payment_method, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
      [data.booking_id, data.user_id, data.total, data.status || 'PENDING_PAYMENT', data.payment_method || null, expiresAt]
    );
    return { id: result.insertId, ...data };
  },

  async updateStatus(id, status) {
    const sets = ["status = ?"];
    const params = [status];
    if (status === 'PAID') {
      sets.push("paid_at = NOW()");
    }
    params.push(id);
    await pool.query(`UPDATE bills SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async markPaid(id, paymentMethod) {
    const [result] = await pool.query(
      "UPDATE bills SET status = 'PAID', payment_method = ?, paid_at = NOW() WHERE id = ?",
      [paymentMethod, id]
    );
    return result.affectedRows > 0;
  },

  async markExpired(id) {
    await pool.query("UPDATE bills SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING_PAYMENT'", [id]);
  },

  async cancelExpiredBills(_minutes = 15) {
    const [rows] = await pool.query(
      "SELECT id FROM bills WHERE status = 'PENDING_PAYMENT' AND expires_at <= NOW()"
    );
    for (const row of rows) {
      await pool.query("UPDATE bills SET status = 'EXPIRED' WHERE id = ?", [row.id]);
    }
    return rows;
  },
};

module.exports = BillModel;
