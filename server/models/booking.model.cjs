const pool = require('../config/database.cjs');

const BookingModel = {
  async findHistoryByUser(userId) {
    const [rows] = await pool.query(
      `SELECT b.id, b.code AS booking_code, b.status, b.total, b.payment_method, b.seats_json,
              b.created_at, b.paid_at, b.confirmed_at, b.cancelled_at,
              m.title AS movie_title, m.poster AS movie_poster,
              s.date AS show_date, s.time AS show_time,
              c.name AS cinema_name, c.address AS cinema_address,
              sc.name AS room_name,
              COALESCE((
                SELECT GROUP_CONCAT(CONCAT(st.row_label, st.seat_number)
                  ORDER BY st.row_label, st.seat_number SEPARATOR ', ')
                FROM booking_seats bs
                JOIN seats st ON st.id = bs.seat_id
                WHERE bs.booking_id = b.id
              ), '') AS seat_codes,
              COALESCE((
                SELECT GROUP_CONCAT(t.ticket_code ORDER BY t.id SEPARATOR ', ')
                FROM tickets t
                WHERE t.booking_id = b.id
              ), '') AS ticket_codes
       FROM bookings b
       JOIN showtimes s ON s.id = b.showtime_id
       JOIN movies m ON m.id = s.movie_id
       JOIN cinemas c ON c.id = s.cinema_id
       LEFT JOIN screens sc ON sc.id = s.screen_id
       WHERE b.user_id = ?
       ORDER BY b.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async findAll({ page = 1, limit = 10, user_id, status, _search = '' }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (user_id) { conditions.push('b.user_id = ?'); params.push(user_id); }
    if (status) { conditions.push('b.status = ?'); params.push(status); }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const [countRows] = await pool.query(`SELECT COUNT(*) as total FROM bookings b ${where}`, params);
    const total = countRows[0].total;

    const sql = `
      SELECT b.*, m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, c.name as cinema_name
      FROM bookings b
      JOIN showtimes s ON b.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      ${where}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(sql, [...params, parseInt(limit), parseInt(offset)]);
    return { rows, total };
  },

  async findById(id) {
    const [rows] = await pool.query(`
      SELECT b.*, m.title as movie_title, m.poster as movie_poster,
             s.date as show_date, s.time as show_time, c.name as cinema_name,
             u.name as user_name, u.email as user_email
      FROM bookings b
      JOIN showtimes s ON b.showtime_id = s.id
      JOIN movies m ON s.movie_id = m.id
      JOIN cinemas c ON s.cinema_id = c.id
      JOIN users u ON b.user_id = u.id
      WHERE b.id = ?`, [id]);
    return rows[0] || null;
  },

  async findByCode(code) {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE code = ?', [code]);
    return rows[0] || null;
  },

  async updatePaymentId(id, paymentId) {
    await pool.query('UPDATE bookings SET payment_id = ? WHERE id = ?', [paymentId, id]);
  },

  async create(data) {
    const code = `BK${Date.now()}`;
    const seatsJson = JSON.stringify(data.seats);
    const [result] = await pool.query(
      'INSERT INTO bookings (code, user_id, showtime_id, seats_json, total, payment_method, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, data.user_id, data.showtime_id, seatsJson, data.total, data.payment_method || 'cash', data.status || 'confirmed']
    );
    return { id: result.insertId, code, ...data };
  },

  async cancel(id) {
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [id]);
    await pool.query('UPDATE seats SET is_booked = 0, booking_id = NULL WHERE booking_id = ?', [id]);
    return this.findById(id);
  },

  async isOwner(id, userId) {
    const [rows] = await pool.query('SELECT id FROM bookings WHERE id = ? AND user_id = ?', [id, userId]);
    return rows.length > 0;
  },

  async autoBooking({ userId, showtimeId, seats, total }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const code = `BK${Date.now()}`;
      const seatsJson = JSON.stringify(seats);
      const [bookingResult] = await conn.query(
        'INSERT INTO bookings (code, user_id, showtime_id, seats_json, total, payment_method, status, booking_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [code, userId, showtimeId, seatsJson, total, 'pending', 'pending', 'ai']
      );
      const bookingId = bookingResult.insertId;

      const seatLabels = seats;
      const seatIds = [];
      const conditions = seatLabels.map(() => '(row_label = ? AND seat_number = ?)');
      const seatParams = [showtimeId];
      for (const label of seatLabels) {
        const match = label.match(/^([A-Z]+)(\d+)$/);
        if (match) {
          seatParams.push(match[1], parseInt(match[2], 10));
        }
      }
      const seatSql = `SELECT id, row_label, seat_number, is_vip FROM seats WHERE showtime_id = ? AND (${conditions.join(' OR ')}) AND is_booked = 0 FOR UPDATE`;
      const [foundSeats] = await conn.query(seatSql, seatParams);

      if (foundSeats.length !== seatLabels.length) {
        await conn.rollback();
        return { success: false, message: 'Một số ghế đã được đặt trước đó, vui lòng chọn ghế khác' };
      }

      for (const seat of foundSeats) {
        seatIds.push({ id: seat.id, row: seat.row_label, number: seat.seat_number, isVip: seat.is_vip });
      }

      const updateSql = `UPDATE seats SET is_booked = 1, booking_id = ? WHERE showtime_id = ? AND (${conditions.join(' OR ')}) AND is_booked = 0`;
      await conn.query(updateSql, [bookingId, showtimeId, ...seatParams.slice(1)]);

      for (const s of seatIds) {
        await conn.query(
          'INSERT INTO booking_seats (booking_id, seat_id, showtime_id, status) VALUES (?, ?, ?, ?)',
          [bookingId, s.id, showtimeId, 'LOCKED']
        );
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const [billResult] = await conn.query(
        'INSERT INTO bills (booking_id, user_id, total, status, payment_method, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [bookingId, userId, total, 'PENDING_PAYMENT', 'pending', expiresAt]
      );
      const billId = billResult.insertId;

      await conn.query('UPDATE bookings SET bill_id = ? WHERE id = ?', [billId, bookingId]);

      const TicketModel = require('./ticket.model.cjs');
      const tickets = [];
      for (const s of seatIds) {
        const ticketData = await TicketModel.create({
          booking_id: bookingId,
          bill_id: billId,
          seat_id: s.id,
        });
        tickets.push({ ...ticketData, ...s });
      }

      await conn.commit();

      const fullBooking = await this.findById(bookingId);
      const BillModel = require('./bill.model.cjs');
      const bill = await BillModel.findById(billId);

      return {
        success: true,
        booking: fullBooking,
        bill,
        tickets,
        seats: seatIds,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },
};

module.exports = BookingModel;
