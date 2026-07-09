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

    const bookedSeats = rows.filter(r => r.is_booked).map(r => `${r.row_label}${r.seat_number}`);

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
        isBooked: !!r.is_booked,
        bookingId: r.booking_id,
      })),
    };
  },

  async initLayout(showtimeId) {
    const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const vipRowSet = new Set(['E', 'F']);
    const seatsPerRow = 12;

    const values = [];
    for (const row of rowLabels) {
      for (let num = 1; num <= seatsPerRow; num++) {
        values.push([showtimeId, row, num, vipRowSet.has(row) ? 1 : 0, 0, null]);
      }
    }

    await pool.query(
      'INSERT INTO seats (showtime_id, row_label, seat_number, is_vip, is_booked, booking_id) VALUES ?',
      [values]
    );

    return {
      rows: rowLabels,
      seatsPerRow,
      vipRows: ['E', 'F'],
      bookedSeats: [],
      seats: values.map(v => ({
        row: v[1],
        number: v[2],
        isVip: !!v[3],
        isBooked: false,
        bookingId: null,
      })),
    };
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
};

module.exports = SeatModel;
