const pool = require('../config/database.cjs');

const OtpModel = {
  async create({ email, otp, name, password }) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO email_otps (email, otp, name, password, expires_at) VALUES (?, ?, ?, ?, ?)',
      [email, otp, name || null, password || null, expiresAt]
    );
    return { email, otp, expiresAt };
  },

  async verify(email, otp) {
    const [rows] = await pool.query(
      'SELECT * FROM email_otps WHERE email = ? AND otp = ? AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, otp]
    );
    return rows[0] || null;
  },

  async markUsed(id) {
    await pool.query('UPDATE email_otps SET is_used = 1 WHERE id = ?', [id]);
  },

  async invalidateByEmail(email) {
    await pool.query('UPDATE email_otps SET is_used = 1 WHERE email = ?', [email]);
  },

  async createPhone({ phone, otp, name, password }) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      'INSERT INTO phone_otps (phone, otp, name, password, expires_at) VALUES (?, ?, ?, ?, ?)',
      [phone, otp, name || null, password || null, expiresAt]
    );
    return { phone, otp, expiresAt };
  },

  async verifyPhone(phone, otp) {
    const [rows] = await pool.query(
      'SELECT * FROM phone_otps WHERE phone = ? AND otp = ? AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [phone, otp]
    );
    return rows[0] || null;
  },

  async findLatestPhone(phone) {
    const [rows] = await pool.query(
      'SELECT * FROM phone_otps WHERE phone = ? AND is_used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [phone]
    );
    return rows[0] || null;
  },

  async markPhoneUsed(id) {
    await pool.query('UPDATE phone_otps SET is_used = 1 WHERE id = ?', [id]);
  },

  async invalidateByPhone(phone) {
    await pool.query('UPDATE phone_otps SET is_used = 1 WHERE phone = ?', [phone]);
  },
};

module.exports = OtpModel;
