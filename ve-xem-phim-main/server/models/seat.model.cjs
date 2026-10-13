const pool = require('../config/database.cjs');

const SeatModel = {
  async getLayout(showtimeId) {
    const [rows] = await pool.query(
      'SELECT * FROM seats WHERE showtime_id = ? ORDER BY row_label, seat_number',
      [showtimeId]
    );

    if (rows.length === 0) {
      return this.initLayout(showtimeId);
    }

    const vipRowsResult = await pool.query(
      'SELECT DISTINCT row_label FROM seats WHERE showtime_id = ? AND is_vip = 1',
      [showtimeId]
    );
    const vipRows = vipRowsResult[0].map(r => r.row_label);

    const [heldOrPendingSeats] = await pool.query(
      `SELECT DISTINCT shs.seat_id FROM seat_hold_seats shs
       INNER JOIN seat_holds sh ON shs.hold_id = sh.id
       WHERE sh.showtime_id = ? AND sh.status = 'ACTIVE' AND sh.expires_at > NOW()
       UNION
       SELECT DISTINCT bs.seat_id FROM booking_seats bs
       INNER JOIN bookings b ON bs.booking_id = b.id
       WHERE b.showtime_id = ? AND b.status IN ('PENDING_PAYMENT', 'PAID', 'CONFIRMED')`,
      [showtimeId, showtimeId]
    );
    const heldSeatIds = new Set(heldOrPendingSeats.map(r => r.seat_id));

    const bookedSeats = rows.filter(r => r.is_booked || heldSeatIds.has(r.id)).map(r => `${r.row_label}${r.seat_number}`);

    const uniqueRows = [...new Set(rows.map(r => r.row_label))];
    const seatsPerRow = rows.length > 0 ? rows.filter(r => r.row_label === uniqueRows[0]).length : 12;

    return {
      rows: uniqueRows,
      seatsPerRow,
      vipRows,
      bookedSeats,
      seats: rows.map(r => ({
        id: r.id,
        row: r.row_label,
        number: r.seat_number,
        isVip: !!r.is_vip,
        isBooked: !!r.is_booked || heldSeatIds.has(r.id),
        bookingId: r.booking_id,
      })),
    };
  },

  async initLayout(showtimeId) {
    const [templates] = await pool.query(
      `SELECT ss.row_label, ss.seat_number, ss.seat_type
       FROM showtimes st
       JOIN screen_seats ss ON ss.screen_id = st.screen_id
       WHERE st.id = ?
       ORDER BY ss.row_label, ss.seat_number`,
      [showtimeId]
    ).catch(err => {
      // Older databases may not have imported room layouts yet.
      if (err.code === 'ER_NO_SUCH_TABLE') return [[]];
      throw err;
    });

    const fallbackRows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const fallbackVipRows = new Set(['E', 'F']);
    const layout = templates.length > 0
      ? templates
      : fallbackRows.flatMap(row => Array.from({ length: 12 }, (_, index) => ({
          row_label: row,
          seat_number: index + 1,
          seat_type: fallbackVipRows.has(row) ? 'VIP' : 'STANDARD',
        })));

    const values = layout.map(seat => [
      showtimeId,
      seat.row_label,
      seat.seat_number,
      seat.seat_type === 'VIP' ? 1 : 0,
      0,
      null,
    ]);

    await pool.query(
      'INSERT INTO seats (showtime_id, row_label, seat_number, is_vip, is_booked, booking_id) VALUES ?',
      [values]
    );

    return this.getLayout(showtimeId);
  },

  async bookSeats(showtimeId, seatIds, bookingId) {
    if (!seatIds.length) return 0;
    const conditions = seatIds.map(() => '(row_label = ? AND seat_number = ?)');
    const params = [bookingId, showtimeId];
    for (const seatId of seatIds) {
      const match = seatId.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        params.push(match[1], parseInt(match[2], 10));
      }
    }
    const sql = `UPDATE seats SET is_booked = 1, booking_id = ? WHERE showtime_id = ? AND (${conditions.join(' OR ')}) AND is_booked = 0`;
    const [result] = await pool.query(sql, params);
    return result.affectedRows;
  },

  async resetShowtime(showtimeId) {
    await pool.query('UPDATE seats SET is_booked = 0, booking_id = NULL WHERE showtime_id = ?', [showtimeId]);
    return true;
  },

  async lockSeats(showtimeId, seatIds, bookingId) {
    if (!seatIds.length) return 0;
    const conditions = seatIds.map(() => '(row_label = ? AND seat_number = ?)');
    const params = [bookingId, showtimeId];
    for (const seatId of seatIds) {
      const match = seatId.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        params.push(match[1], parseInt(match[2], 10));
      }
    }
    const sql = `UPDATE seats SET is_booked = 1, booking_id = ? WHERE showtime_id = ? AND (${conditions.join(' OR ')}) AND is_booked = 0`;
    const [result] = await pool.query(sql, params);
    return result.affectedRows;
  },

  async confirmSeats(bookingId) {
    await pool.query('UPDATE seats SET is_booked = 1 WHERE booking_id = ? AND is_booked = 1', [bookingId]);
  },

  async releaseSeats(bookingId) {
    await pool.query('UPDATE seats SET is_booked = 0, booking_id = NULL WHERE booking_id = ?', [bookingId]);
  },

  async findSeatIds(showtimeId, seatLabels) {
    if (!seatLabels.length) return [];
    const conditions = seatLabels.map(() => '(row_label = ? AND seat_number = ?)');
    const params = [showtimeId];
    for (const label of seatLabels) {
      const match = label.match(/^([A-Z]+)(\d+)$/);
      if (match) {
        params.push(match[1], parseInt(match[2], 10));
      }
    }
    const sql = `SELECT id, row_label, seat_number, is_vip FROM seats WHERE showtime_id = ? AND (${conditions.join(' OR ')})`;
    const [rows] = await pool.query(sql, params);
    return rows;
  },
};

module.exports = SeatModel;
