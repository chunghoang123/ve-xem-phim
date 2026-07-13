const pool = require('../config/database.cjs');

const UserModel = {
  async findAll({ page = 1, limit = 10, search = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
    const offset = (page - 1) * limit;
    const allowedSort = ['id', 'name', 'email', 'role_id', 'created_at'];
    const sort = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    let where = '';
    const params = [];
    if (search) {
      where = 'WHERE (u.name LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM users u ${where}`;
    const [countRows] = await pool.query(countSql, params);
    const total = countRows[0].total;

    const sql = `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.role_id, r.name as role_name, u.created_at, u.updated_at FROM users u LEFT JOIN roles r ON u.role_id = r.id ${where} ORDER BY u.${sort} ${order} LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.auth_provider, u.role_id, r.name as role_name, u.created_at, u.updated_at FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  },

  async findByPhone(phone) {
    const [rows] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    return rows[0] || null;
  },

  async findBySocialId(authProvider, socialId) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE auth_provider = ? AND social_id = ?',
      [authProvider, socialId]
    );
    return rows[0] || null;
  },

  async create({ name, email, password, phone, avatar, role_id = 3, auth_provider, social_id }) {
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, phone, avatar, role_id, auth_provider, social_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email || null, password || null, phone || null, avatar || null, role_id, auth_provider || null, social_id || null]
    );
    return { id: result.insertId, name, email, role_id };
  },

  async update(id, fields) {
    const allowed = ['name', 'email', 'phone', 'avatar', 'role_id', 'auth_provider', 'social_id'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }
    if (fields.password) {
      sets.push('password = ?');
      params.push(fields.password);
    }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },
};

module.exports = UserModel;
