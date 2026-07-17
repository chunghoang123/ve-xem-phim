const pool = require('../config/database.cjs');
const { escapeLike } = require('../utils/helpers.cjs');

const MovieModel = {
  async findAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC', status }) {
    const offset = (page - 1) * limit;
    const allowedSort = ['id', 'title', 'duration', 'ticket_price', 'release_date', 'created_at'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(m.title LIKE ? OR m.genre LIKE ? OR m.director LIKE ?)');
      const s = `%${escapeLike(search)}%`;
      params.push(s, s, s);
    }
    if (status) {
      conditions.push('m.status = ?');
      params.push(status);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM movies m ${where}`, params);
    const total = countRows[0].total;

    const sql = `SELECT * FROM movies m ${where} ORDER BY m.${sort} ${order} LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM movies WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO movies (title, genre, duration, rating, poster, backdrop, director, cast, description, release_date, ticket_price, vip_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.title, data.genre, data.duration, data.rating, data.poster, data.backdrop,
       data.director, data.cast, data.description, data.releaseDate, data.ticketPrice, data.vipPrice]
    );
    return { id: result.insertId, ...data };
  },

  async update(id, data) {
    const allowed = ['title', 'genre', 'duration', 'rating', 'poster', 'backdrop', 'director', 'cast', 'description', 'release_date', 'ticket_price', 'vip_price', 'status'];
    const sets = [];
    const params = [];
    const fieldMap = {
      releaseDate: 'release_date', ticketPrice: 'ticket_price', vipPrice: 'vip_price'
    };
    for (const [key, value] of Object.entries(data)) {
      const dbField = fieldMap[key] || key;
      if (allowed.includes(dbField)) {
        sets.push(`${dbField} = ?`);
        params.push(value);
      }
    }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE movies SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM movies WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async hasShowtimes(id) {
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM showtimes WHERE movie_id = ?', [id]);
    return rows[0].cnt > 0;
  },

  async findAvailable() {
    const [rows] = await pool.query(`
      SELECT DISTINCT m.* FROM movies m
      JOIN showtimes s ON m.id = s.movie_id
      WHERE m.status = 'active'
      AND s.date >= CURDATE()
      ORDER BY m.title ASC
    `);
    return rows;
  },

  async findHomeSections({ nowLimit = 8, upcomingLimit = 8 } = {}) {
    const safeNowLimit = Math.max(1, Math.min(50, Number(nowLimit) || 8));
    const safeUpcomingLimit = Math.max(1, Math.min(50, Number(upcomingLimit) || 8));
    const [nowShowing] = await pool.query(`
      SELECT m.*
      FROM movies m
      WHERE m.status = 'active'
        AND (m.release_date IS NULL OR m.release_date <= CURDATE())
        AND EXISTS (
          SELECT 1 FROM showtimes s
          WHERE s.movie_id = m.id
            AND TIMESTAMP(s.date, s.time) > NOW()
            AND COALESCE(s.status, 'AVAILABLE') = 'AVAILABLE'
        )
      ORDER BY m.popularity DESC, m.release_date DESC, m.title ASC
      LIMIT ?
    `, [safeNowLimit]);
    const [upcoming] = await pool.query(`
      SELECT m.*
      FROM movies m
      WHERE m.release_date > CURDATE()
      ORDER BY m.release_date ASC, m.popularity DESC, m.title ASC
      LIMIT ?
    `, [safeUpcomingLimit]);
    return { nowShowing, upcoming };
  },
};

module.exports = MovieModel;
