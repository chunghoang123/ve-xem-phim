const pool = require('../config/database.cjs');
const { escapeLike } = require('../utils/helpers.cjs');

const PromotionModel = {
  async findAll({ page = 1, limit = 10, search = '' }) {
    const offset = (page - 1) * limit;
    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE title LIKE ? OR code LIKE ?';
      const s = `%${escapeLike(search)}%`;
      params.push(s, s);
    }

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM promotions ${where}`, params);
    const total = countRows[0].total;

    const sql = `SELECT * FROM promotions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM promotions WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query(
      'INSERT INTO promotions (title, description, discount, code, valid_until, color, icon) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.title, data.description, data.discount, data.code, data.valid_until, data.color || 'purple', data.icon || 'Gift']
    );
    return { id: result.insertId, ...data };
  },

  async update(id, data) {
    const allowed = ['title', 'description', 'discount', 'code', 'valid_until', 'color', 'icon'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        const dbKey = key === 'valid_until' ? 'valid_until' : key;
        sets.push(`${dbKey} = ?`);
        params.push(data[key]);
      }
    }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE promotions SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM promotions WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = PromotionModel;
