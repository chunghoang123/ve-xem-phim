const pool = require('../config/database.cjs');
const { escapeLike } = require('../utils/helpers.cjs');
const { haversine } = require('../services/geo.service.cjs');

const CinemaModel = {
  async findAll({ page = 1, limit = 10, search = '', city, district, brand, region, province_id }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(c.name LIKE ? OR c.address LIKE ? OR c.brand LIKE ?)');
      const s = `%${escapeLike(search)}%`;
      params.push(s, s, s);
    }
    if (city) {
      conditions.push('c.city = ?');
      params.push(city);
    }
    if (district) {
      conditions.push('c.district = ?');
      params.push(district);
    }
    if (brand) {
      conditions.push('c.brand = ?');
      params.push(brand);
    }
    if (region) {
      conditions.push('c.region = ?');
      params.push(region);
    }
    if (province_id) {
      conditions.push('c.province_id = ?');
      params.push(province_id);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM cinemas c ${where}`, params);
    const total = countRows[0].total;

    const sql = `SELECT c.*, p.name as province_name, p.region FROM cinemas c LEFT JOIN provinces p ON c.province_id = p.id ${where} ORDER BY c.brand ASC, c.name ASC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query(
      'SELECT c.*, p.name as province_name, p.region FROM cinemas c LEFT JOIN provinces p ON c.province_id = p.id WHERE c.id = ?', [id]);
    return rows[0] || null;
  },

  async findByProvince(provinceId) {
    const [rows] = await pool.query(
      'SELECT c.*, p.name as province_name FROM cinemas c LEFT JOIN provinces p ON c.province_id = p.id WHERE c.province_id = ? ORDER BY c.brand, c.name',
      [provinceId]
    );
    return rows;
  },

  async findNearby({ lat, lng, radius = 50, limit = 20, brand, city }) {
    const conditions = [];
    const params = [];

    if (lat && lng) {
      conditions.push('c.lat IS NOT NULL AND c.lng IS NOT NULL');
    }
    if (brand) {
      conditions.push('c.brand = ?');
      params.push(brand);
    }
    if (city) {
      conditions.push('c.city = ?');
      params.push(city);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT c.*, p.name as province_name FROM cinemas c LEFT JOIN provinces p ON c.province_id = p.id ${where} ORDER BY c.brand ASC, c.name ASC`,
      params
    );

    let result = rows;
    if (lat && lng) {
      result = rows.map(c => ({
        ...c,
        distanceKm: haversine(lat, lng, parseFloat(c.lat), parseFloat(c.lng)),
      }));
      result.sort((a, b) => a.distanceKm - b.distanceKm);
      if (radius) {
        result = result.filter(c => c.distanceKm <= radius);
      }
    } else {
      result = rows.map(c => ({ ...c, distanceKm: null }));
    }

    return result.slice(0, limit);
  },

  async getLocations() {
    const [cities] = await pool.query(
      `SELECT city, COUNT(*) as cinema_count
       FROM cinemas
       WHERE lat IS NOT NULL
       GROUP BY city
       ORDER BY city`
    );
    const [provinces] = await pool.query(
      'SELECT id, code, name, region, latitude, longitude FROM provinces ORDER BY name'
    );
    return { cities, provinces };
  },

  async getBrands() {
    const [rows] = await pool.query(
      `SELECT brand, COUNT(*) as cinema_count
       FROM cinemas
       WHERE brand IS NOT NULL
       GROUP BY brand
       ORDER BY brand`
    );
    return rows;
  },

  async create(data) {
    const [result] = await pool.query(
      `INSERT INTO cinemas (province_id, name, address, lat, lng, district, city, region, brand)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.province_id || null, data.name, data.address, data.lat || null, data.lng || null,
       data.district || null, data.city || 'Hà Nội', data.region || null, data.brand || null]
    );
    return { id: result.insertId, ...data };
  },

  async update(id, data) {
    const allowed = ['province_id', 'name', 'address', 'lat', 'lng', 'district', 'city', 'region', 'brand'];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(data[key]);
      }
    }
    if (sets.length === 0) return null;
    params.push(id);
    await pool.query(`UPDATE cinemas SET ${sets.join(', ')} WHERE id = ?`, params);
    return this.findById(id);
  },

  async delete(id) {
    const [result] = await pool.query('DELETE FROM cinemas WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  async hasShowtimes(id) {
    const [rows] = await pool.query('SELECT COUNT(*) as cnt FROM showtimes WHERE cinema_id = ?', [id]);
    return rows[0].cnt > 0;
  },
};

module.exports = CinemaModel;
