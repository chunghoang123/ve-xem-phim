const pool = require('../config/database.cjs');

const RoleModel = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM roles ORDER BY id ASC');
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM roles WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async create(data) {
    const [result] = await pool.query('INSERT INTO roles (name, description) VALUES (?, ?)', [data.name, data.description || null]);
    return { id: result.insertId, name: data.name };
  },

  async update(id, data) {
    const sets = [];
    const params = [];
    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name); }
    if (data.description !== undefined) { sets.push('description = ?'); params.push(data.description); }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE roles SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM users WHERE role_id = ?', [id]);
    if (rows[0].cnt > 0) return { affectedRows: 0, message: 'Không thể xóa role đang có người dùng' };
    const [result] = await pool.query('DELETE FROM roles WHERE id = ?', [id]);
    return { affectedRows: result.affectedRows };
  },
};

module.exports = RoleModel;
