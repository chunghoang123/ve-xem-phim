const pool = require('../config/database.cjs');

const BookingSeatModel = {
  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO booking_seats (booking_id, seat_id, showtime_id, status) VALUES (?, ?, ?, ?)',
      [data.booking_id, data.seat_id, data.showtime_id, data.status || 'LOCKED']
    );
    return { id: result.insertId, ...data };
  },

  async findByBooking(bookingId) {
    const [rows] = await pool.query(`
      SELECT bs.*, s.row_label, s.seat_number, s.is_vip
      FROM booking_seats bs
      JOIN seats s ON bs.seat_id = s.id
      WHERE bs.booking_id = ?
      ORDER BY s.row_label, s.seat_number
    `, [bookingId]);
    return rows;
  },

  async findByShowtime(showtimeId) {
    const [rows] = await pool.query(
      'SELECT * FROM booking_seats WHERE showtime_id = ?',
      [showtimeId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    await pool.query(
      'UPDATE booking_seats SET status = ? WHERE id = ?',
      [status, id]
    );
    return { id, status };
  },

  async releaseByBooking(bookingId) {
    const [result] = await pool.query(
      "UPDATE booking_seats SET status = 'AVAILABLE' WHERE booking_id = ? AND status IN ('LOCKED', 'BOOKED')",
      [bookingId]
    );
    return result.affectedRows;
  },

  async releaseExpired(_minutes = 15) {
    const [result] = await pool.query(`
      UPDATE booking_seats bs
      JOIN bills b ON bs.booking_id = b.booking_id
      SET bs.status = 'AVAILABLE', b.status = 'EXPIRED'
      WHERE bs.status = 'LOCKED'
      AND b.status = 'PENDING_PAYMENT'
      AND b.expires_at <= NOW()
    `);
    return result.affectedRows;
  },

  async getLockedSeats(showtimeId) {
    const [rows] = await pool.query(
      "SELECT seat_id FROM booking_seats WHERE showtime_id = ? AND status IN ('LOCKED', 'BOOKED')",
      [showtimeId]
    );
    return rows.map(r => r.seat_id);
  },
};

module.exports = BookingSeatModel;
