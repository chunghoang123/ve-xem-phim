const pool = require('../config/database.cjs');

const ShowtimeModel = {
  async findAll({ page = 1, limit = 20, movie_id, cinema_id, date, province_id, city, brand, search = '' }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (movie_id) { conditions.push('s.movie_id = ?'); params.push(movie_id); }
    if (cinema_id) { conditions.push('s.cinema_id = ?'); params.push(cinema_id); }
    if (date) { conditions.push('s.date = ?'); params.push(date); }
    if (province_id) { conditions.push('c.province_id = ?'); params.push(province_id); }
    if (city) { conditions.push('c.city = ?'); params.push(city); }
    if (brand) { conditions.push('c.brand = ?'); params.push(brand); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM showtimes s JOIN cinemas c ON s.cinema_id = c.id ${where}`, params
    );
    const total = countRows[0].total;

    const sql = `
      SELECT s.*, m.title as movie_title, m.poster as movie_poster, m.duration, m.rating,
             m.ticket_price, m.vip_price, c.name as cinema_name, c.address as cinema_address,
             c.city, c.district, c.province_id, c.brand
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      ${where}
      ORDER BY s.date ASC, s.time ASC
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query(`
      SELECT s.*, m.title as movie_title, m.poster as movie_poster, m.duration, m.rating,
             m.ticket_price, m.vip_price, c.name as cinema_name
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE s.id = ?`, [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO showtimes (movie_id, cinema_id, date, time) VALUES (?, ?, ?, ?)',
      [data.movie_id, data.cinema_id || 1, data.date, data.time]
    );
    return { id: result.insertId, ...data };
  },

  async update(id, data) {
    const sets = [];
    const params = [];
    if (data.movie_id !== undefined) { sets.push('movie_id = ?'); params.push(data.movie_id); }
    if (data.cinema_id !== undefined) { sets.push('cinema_id = ?'); params.push(data.cinema_id); }
    if (data.date !== undefined) { sets.push('date = ?'); params.push(data.date); }
    if (data.time !== undefined) { sets.push('time = ?'); params.push(data.time); }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE showtimes SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM showtimes WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async hasBookings(id) {
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM bookings WHERE showtime_id = ?', [id]);
    return rows[0].cnt > 0;
  },

  async getDates(movie_id) {
    const [rows] = await pool.query(
      'SELECT DISTINCT date FROM showtimes WHERE movie_id = ? ORDER BY date ASC',
      [movie_id]
    );
    return rows.map(r => r.date);
  },

  async findByMovieGrouped(movieId, filters = {}) {
    const conditions = ['s.movie_id = ?'];
    const params = [movieId];

    if (filters.province_id) {
      conditions.push('c.province_id = ?');
      params.push(filters.province_id);
    }
    if (filters.city) {
      conditions.push('c.city = ?');
      params.push(filters.city);
    }
    if (filters.brand) {
      conditions.push('c.brand = ?');
      params.push(filters.brand);
    }
    if (filters.date) {
      conditions.push('s.date = ?');
      params.push(filters.date);
    }

    const where = conditions.join(' AND ');

    const [rows] = await pool.query(`
      SELECT s.id, s.movie_id, s.cinema_id, s.screen_id, s.date, s.time,
             s.start_time, s.end_time, s.format, s.language, s.price, s.status,
             sc.name AS screen_name, sc.capacity AS screen_capacity,
             c.name AS cinema_name, c.address AS cinema_address,
             c.city, c.district, c.brand, c.lat, c.lng, c.province_id
      FROM showtimes s
      JOIN screens sc ON s.screen_id = sc.id
      JOIN cinemas c ON s.cinema_id = c.id
      WHERE ${where}
      ORDER BY c.city, c.district, c.brand, c.name, s.date, s.time
    `, params);

    return rows;
  },
};

module.exports = ShowtimeModel;
