const pool = require('../config/database.cjs');

const BookingModel = {
  async findAll({ page = 1, limit = 10, user_id, status, search = '' }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (user_id) { conditions.push('b.user_id = ?'); params.push(user_id); }
    if (status) { conditions.push('b.status = ?'); params.push(status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM bookings b ${where}`, params);
    const total = countRows[0].total;

    const sql = `
      SELECT b.*, m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, c.name as cinema_name
      FROM bookings b
      JOIN showtimes s ON b.showtime_id = s.id
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
      SELECT b.*, m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, c.name as cinema_name,
             u.name as user_name, u.email as user_email
      FROM bookings b
      JOIN showtimes s ON b.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`, [id]);
    return rows[0] || null;
  },

  async create(data) {
    const code = `BK${Date.now()}`;
    const seatsJson = JSON.stringify(data.seats);
    const [result] = await pool.query(
      'INSERT INTO bookings (code, user_id, showtime_id, seats_json, total, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, data.user_id, data.showtime_id, seatsJson, data.total, data.payment_method || 'cash', data.status || 'confirmed']
    );
    return { id: result.insertId, code, ...data };
  },

  async cancel(id) {
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [id]);
    await pool.query('UPDATE seats SET is_booked = 0, booking_id = NULL WHERE booking_id = ?', [id]);
    return this.findById(id);
  },

  async isOwner(id, userId) {
    const [rows] = await pool.query('SELECT id FROM bookings WHERE id = ? AND user_id = ?', [id, userId]);
    return rows.length > 0;
  },
};

module.exports = BookingModel;
