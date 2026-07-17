const pool = require('../config/database.cjs');

const ConcessionModel = {
  async findActive() {
    const [rows] = await pool.query(
      `SELECT id, name, description, price, image, stock
       FROM concessions
       WHERE status = 'ACTIVE' AND stock > 0
       ORDER BY name`
    );
    return rows.map((item) => ({
      ...item,
      price: Number(item.price),
      stock: Number(item.stock),
    }));
  },
};

module.exports = ConcessionModel;
