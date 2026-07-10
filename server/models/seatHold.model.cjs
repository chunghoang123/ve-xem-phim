const pool = require('../config/database.cjs');
const crypto = require('crypto');

const SeatHoldModel = {
  generateCode() {
    return 'HOLD-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  },

  async create({ userId, showtimeId, seatIds, seatPrices }) {
    const holdCode = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      const placeholders = seatIds.map(() => '?').join(',');
      const [lockedSeats] = await conn.query(
        `SELECT id FROM seats WHERE showtime_id = ? AND id IN (${placeholders}) FOR UPDATE`,
        [showtimeId, ...seatIds]
      );
      if (lockedSeats.length !== seatIds.length) {
        throw Object.assign(new Error('Một số ghế không thuộc suất chiếu này'), { code: 'INVALID_SEATS' });
      }

      const [conflicts] = await conn.query(
        `SELECT s.id FROM seats s
         WHERE s.id IN (${placeholders}) AND (
           s.is_booked = 1 OR EXISTS (
             SELECT 1 FROM seat_hold_seats shs
             JOIN seat_holds sh ON sh.id = shs.hold_id
             WHERE shs.seat_id = s.id AND sh.status = 'ACTIVE' AND sh.expires_at > NOW()
           ) OR EXISTS (
             SELECT 1 FROM booking_seats bs
             JOIN bookings b ON b.id = bs.booking_id
             WHERE bs.seat_id = s.id AND b.status IN ('PENDING_PAYMENT', 'PAID', 'CONFIRMED')
           )
         )`,
        seatIds
      );
      if (conflicts.length > 0) {
        throw Object.assign(new Error('Ghế vừa được người khác chọn. Vui lòng chọn ghế khác.'), { code: 'SEATS_UNAVAILABLE' });
      }

      const [result] = await conn.query(
        'INSERT INTO seat_holds (hold_code, user_id, showtime_id, expires_at, status) VALUES (?, ?, ?, ?, ?)',
        [holdCode, userId, showtimeId, expiresAt, 'ACTIVE']
      );
      const holdId = result.insertId;
      for (let i = 0; i < seatIds.length; i++) {
        const seatId = seatIds[i];
        const price = (seatPrices && seatPrices[i]) || 0;

        await conn.query(
          'INSERT INTO seat_hold_seats (hold_id, seat_id, unit_price) VALUES (?, ?, ?)',
          [holdId, seatId, price]
        );
      }

      await conn.commit();
      return { id: holdId, hold_code: holdCode, expires_at: expiresAt };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findByCode(holdCode) {
    const [rows] = await pool.query(
      'SELECT * FROM seat_holds WHERE hold_code = ?',
      [holdCode]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM seat_holds WHERE id = ?', [id]);
    return rows[0] || null;
  },

  async getSeatsByHold(holdId) {
    const [rows] = await pool.query(
      `SELECT shs.*, s.row_label, s.seat_number, s.is_vip, s.id as seat_id
       FROM seat_hold_seats shs
       JOIN seats s ON shs.seat_id = s.id
       WHERE shs.hold_id = ?`,
      [holdId]
    );
    return rows;
  },

  async updateStatus(id, status) {
    await pool.query('UPDATE seat_holds SET status = ? WHERE id = ?', [status, id]);
  },

  async expireExpiredHolds() {
    const [rows] = await pool.query(
      `SELECT id FROM seat_holds WHERE status = 'ACTIVE' AND expires_at <= NOW()`
    );
    for (const row of rows) {
      await pool.query("UPDATE seat_holds SET status = 'EXPIRED' WHERE id = ?", [row.id]);
    }
    return rows;
  },

  async releaseByHold(holdId) {
    await pool.query("UPDATE seat_holds SET status = 'RELEASED' WHERE id = ?", [holdId]);
  },
};

module.exports = SeatHoldModel;
