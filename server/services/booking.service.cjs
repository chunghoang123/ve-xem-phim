const pool = require('../config/database.cjs');
const BookingModel = require('../models/booking.model.cjs');
const SeatHoldModel = require('../models/seatHold.model.cjs');
const TicketModel = require('../models/ticket.model.cjs');

const BookingService = {
  async createBookingFromHold({ userId, seatHoldCode }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [holdRows] = await conn.query(
        'SELECT * FROM seat_holds WHERE hold_code = ? FOR UPDATE',
        [seatHoldCode]
      );
      const hold = holdRows[0];
      if (!hold) {
        await conn.rollback();
        return { success: false, message: 'Mã giữ ghế không hợp lệ', code: 'SEAT_HOLD_NOT_FOUND' };
      }
      if (hold.status !== 'ACTIVE') {
        if (hold.status === 'CONVERTED' && hold.user_id === userId) {
          const [existingRows] = await conn.query(
            `SELECT b.*, bl.id as existing_bill_id, bl.total as bill_total,
                    m.title as movie_title, c.name as cinema_name, c.address as cinema_address,
                    sc.name as room_name, s.date as show_date, s.time as show_time
             FROM bookings b
             JOIN showtimes s ON s.id = b.showtime_id
             JOIN movies m ON m.id = s.movie_id
             JOIN cinemas c ON c.id = s.cinema_id
             LEFT JOIN screens sc ON sc.id = s.screen_id
             LEFT JOIN bills bl ON bl.booking_id = b.id
             WHERE b.seat_hold_id = ? ORDER BY b.id DESC LIMIT 1`,
            [hold.id]
          );
          const existing = existingRows[0];
          if (existing && existing.status === 'PENDING_PAYMENT') {
            const [existingSeats] = await conn.query(
              `SELECT bs.unit_price, s.id as seat_id, s.row_label, s.seat_number, s.is_vip
               FROM booking_seats bs JOIN seats s ON s.id = bs.seat_id
               WHERE bs.booking_id = ?`,
              [existing.id]
            );
            await conn.commit();
            const subtotal = existingSeats.reduce((sum, seat) => sum + Number(seat.unit_price || 0), 0);
            return {
              success: true,
              booking: existing,
              bill: { id: existing.existing_bill_id, total: existing.bill_total },
              holdSeats: existingSeats,
              movie_title: existing.movie_title,
              cinema_name: existing.cinema_name,
              cinema_address: existing.cinema_address,
              room_name: existing.room_name || '',
              show_date: existing.show_date,
              show_time: existing.show_time,
              seatCodes: existingSeats.map((seat) => `${seat.row_label}${seat.seat_number}`),
              subtotal,
              serviceFee: Number(existing.total) - subtotal,
              totalAmount: Number(existing.total),
              expiresAt: existing.expires_at,
              reused: true,
            };
          }
        }
        await conn.rollback();
        return { success: false, message: 'Ghế không còn được giữ. Vui lòng chọn lại.', code: 'SEAT_HOLD_EXPIRED' };
      }
      if (hold.user_id !== userId) {
        await conn.rollback();
        return { success: false, message: 'Bạn không sở hữu mã giữ ghế này', code: 'BOOKING_NOT_OWNED' };
      }
      if (new Date(hold.expires_at) <= new Date()) {
        await conn.query("UPDATE seat_holds SET status = 'EXPIRED' WHERE id = ?", [hold.id]);
        await conn.rollback();
        return { success: false, message: 'Thời gian giữ ghế đã hết. Vui lòng chọn lại.', code: 'SEAT_HOLD_EXPIRED' };
      }

      const [showtimeRows] = await conn.query(
        `SELECT s.*, m.title as movie_title, m.ticket_price, m.vip_price,
                c.name as cinema_name, c.address as cinema_address,
                sc.name as room_name
         FROM showtimes s
         JOIN movies m ON s.movie_id = m.id
         JOIN cinemas c ON s.cinema_id = c.id
         LEFT JOIN screens sc ON s.screen_id = sc.id
         WHERE s.id = ?`,
        [hold.showtime_id]
      );
      const showtime = showtimeRows[0];
      if (!showtime) {
        await conn.rollback();
        return { success: false, message: 'Suất chiếu không tồn tại', code: 'SHOWTIME_NOT_FOUND' };
      }

      const [holdSeats] = await conn.query(
        `SELECT shs.*, s.row_label, s.seat_number, s.is_vip, s.id as seat_id
         FROM seat_hold_seats shs
         JOIN seats s ON shs.seat_id = s.id
         WHERE shs.hold_id = ?`,
        [hold.id]
      );

      const holdSeatIds = holdSeats.map(hs => hs.seat_id);
      if (holdSeatIds.length > 0) {
        const ph = holdSeatIds.map(() => '?').join(',');
        const [paidSeats] = await conn.query(
          `SELECT s.id FROM seats s WHERE s.id IN (${ph}) AND (s.is_booked = 1 OR EXISTS (
            SELECT 1 FROM booking_seats bs
            INNER JOIN bookings b ON bs.booking_id = b.id
            WHERE bs.seat_id = s.id AND b.status IN ('PENDING_PAYMENT', 'PAID', 'CONFIRMED')
          ))`,
          holdSeatIds
        );
        if (paidSeats.length > 0) {
          await conn.rollback();
          return { success: false, message: 'Một số ghế đã có người đặt. Vui lòng chọn lại.', code: 'SEATS_UNAVAILABLE' };
        }
      }

      let subtotal = 0;
      const seatPrices = [];
      for (const hs of holdSeats) {
        const price = hs.unit_price > 0 ? hs.unit_price :
          (hs.is_vip ? (showtime.vip_price || showtime.ticket_price) : (showtime.ticket_price || showtime.price || 75000));
        subtotal += price;
        seatPrices.push({ seatId: hs.seat_id, price, rowLabel: hs.row_label, seatNumber: hs.seat_number });
      }

      const serviceFee = Math.round(subtotal * 0.02);
      const totalAmount = subtotal + serviceFee;

      const bookingCode = 'BK' + Date.now();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const seatCodes = holdSeats.map(s => `${s.row_label}${s.seat_number}`);
      const seatsJson = JSON.stringify(seatCodes);

      const [bookingResult] = await conn.query(
        `INSERT INTO bookings (code, user_id, showtime_id, seats_json, total, payment_method, status, booking_type, seat_hold_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingCode, userId, hold.showtime_id, seatsJson, totalAmount, 'payos', 'PENDING_PAYMENT', 'manual', hold.id, expiresAt]
      );
      const bookingId = bookingResult.insertId;

      for (const sp of seatPrices) {
        await conn.query(
          `INSERT INTO booking_seats (booking_id, seat_id, showtime_id, status, unit_price)
           VALUES (?, ?, ?, 'LOCKED', ?)
           ON DUPLICATE KEY UPDATE booking_id = VALUES(booking_id), status = VALUES(status), unit_price = VALUES(unit_price)`,
          [bookingId, sp.seatId, hold.showtime_id, sp.price]
        );
        const [bsRow] = await conn.query(
          'SELECT id FROM booking_seats WHERE seat_id = ? AND showtime_id = ?',
          [sp.seatId, hold.showtime_id]
        );
        const bookingSeatId = bsRow[0].id;

        await conn.query(
          'UPDATE seat_hold_seats SET booking_seat_id = ? WHERE hold_id = ? AND seat_id = ?',
          [bookingSeatId, hold.id, sp.seatId]
        );
      }

      const [billResult] = await conn.query(
        'INSERT INTO bills (booking_id, user_id, total, status, payment_method, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [bookingId, userId, totalAmount, 'PENDING_PAYMENT', 'payos', expiresAt]
      );
      const billId = billResult.insertId;

      await conn.query('UPDATE bookings SET bill_id = ? WHERE id = ?', [billId, bookingId]);
      await conn.query("UPDATE seat_holds SET status = 'CONVERTED' WHERE id = ?", [hold.id]);

      await conn.commit();

      const booking = {
        id: bookingId,
        code: bookingCode,
        user_id: userId,
        showtime_id: hold.showtime_id,
        bill_id: billId,
        total: totalAmount,
        status: 'PENDING_PAYMENT',
        expires_at: expiresAt,
      };
      const bill = {
        id: billId,
        booking_id: bookingId,
        user_id: userId,
        total: totalAmount,
        status: 'PENDING_PAYMENT',
        expires_at: expiresAt,
      };

      return {
        success: true,
        booking,
        bill,
        holdSeats,
        movie_title: showtime.movie_title,
        cinema_name: showtime.cinema_name,
        cinema_address: showtime.cinema_address,
        room_name: showtime.room_name || '',
        show_date: showtime.date,
        show_time: showtime.time,
        seatCodes,
        subtotal,
        serviceFee,
        totalAmount,
        expiresAt,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async confirmPayment(orderCode) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [paymentRows] = await conn.query(
        'SELECT * FROM payments WHERE order_code = ? FOR UPDATE',
        [orderCode]
      );
      const payment = paymentRows[0];
      if (!payment) {
        await conn.rollback();
        return { success: false, message: 'Không tìm thấy giao dịch', code: 'PAYMENT_NOT_FOUND' };
      }
      if (payment.status === 'PAID') {
        await conn.commit();
        return { success: true, message: 'Giao dịch đã được xử lý trước đó', code: 'DUPLICATE' };
      }

      const [bookingRows] = await conn.query(
        'SELECT * FROM bookings WHERE id = ? FOR UPDATE',
        [payment.booking_id]
      );
      const booking = bookingRows[0];
      if (!booking) {
        await conn.rollback();
        return { success: false, message: 'Không tìm thấy đơn đặt vé', code: 'BOOKING_NOT_FOUND' };
      }
      if (booking.status !== 'PENDING_PAYMENT') {
        await conn.rollback();
        return { success: false, message: 'Trạng thái đơn không hợp lệ', code: 'INVALID_BOOKING_STATUS' };
      }

      const [updated] = await conn.query(
        "UPDATE payments SET status = 'PAID', paid_at = NOW(), version = version + 1 WHERE id = ? AND version = ?",
        [payment.id, payment.version]
      );
      if (updated.affectedRows === 0) {
        await conn.rollback();
        return { success: false, message: 'Xung đột dữ liệu, vui lòng thử lại', code: 'CONCURRENT_UPDATE_CONFLICT' };
      }

      await conn.query(
        "UPDATE bookings SET status = 'PAID', paid_at = NOW(), payment_id = ? WHERE id = ?",
        [payment.id, booking.id]
      );

      await conn.query(
        "UPDATE booking_seats SET status = 'BOOKED' WHERE booking_id = ?",
        [booking.id]
      );

      await conn.query(
        `UPDATE seats s
         INNER JOIN booking_seats bs ON s.id = bs.seat_id
         SET s.is_booked = 1, s.booking_id = ?
         WHERE bs.booking_id = ?`,
        [booking.id, booking.id]
      );

      if (booking.seat_hold_id) {
        await conn.query(
          "UPDATE seat_holds SET status = 'CONVERTED' WHERE id = ?",
          [booking.seat_hold_id]
        );
      }

      await conn.query(
        "UPDATE bills SET status = 'PAID', paid_at = NOW() WHERE booking_id = ? AND status = 'PENDING_PAYMENT'",
        [booking.id]
      );

      const [bookingSeats] = await conn.query(
        `SELECT bs.*, s.row_label, s.seat_number
         FROM booking_seats bs
         JOIN seats s ON bs.seat_id = s.id
         WHERE bs.booking_id = ?`,
        [booking.id]
      );

      const tickets = [];
      for (const bs of bookingSeats) {
        const ticketData = await TicketModel.create({
          booking_id: booking.id,
          bill_id: booking.bill_id,
          payment_id: payment.id,
          seat_id: bs.seat_id,
          connection: conn,
        });
        tickets.push({ ...ticketData, row_label: bs.row_label, seat_number: bs.seat_number });
      }

      await conn.query(
        "UPDATE bookings SET status = 'CONFIRMED', confirmed_at = NOW() WHERE id = ?",
        [booking.id]
      );

      await conn.commit();

      const [updatedBooking] = await conn.query('SELECT * FROM bookings WHERE id = ?', [booking.id]);

      return {
        success: true,
        message: 'Xác nhận thanh toán thành công',
        booking_id: booking.id,
        booking_code: booking.code,
        booking_status: updatedBooking[0]?.status || 'CONFIRMED',
        tickets,
        payment_id: payment.id,
      };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async expireBooking(bookingId) {
    await pool.query(
      "UPDATE bookings SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING_PAYMENT'",
      [bookingId]
    );
    await pool.query(
      'UPDATE seats SET is_booked = 0, booking_id = NULL WHERE booking_id = ?',
      [bookingId]
    );
    await pool.query(
      "UPDATE booking_seats SET status = 'AVAILABLE' WHERE booking_id = ?",
      [bookingId]
    );
    await pool.query(
      "UPDATE bills SET status = 'EXPIRED' WHERE booking_id = ? AND status = 'PENDING_PAYMENT'",
      [bookingId]
    );
    await pool.query(
      "UPDATE seat_holds sh JOIN bookings b ON b.seat_hold_id = sh.id SET sh.status = 'EXPIRED' WHERE b.id = ? AND sh.status = 'ACTIVE'",
      [bookingId]
    );
  },

  async cancelBooking(bookingId, userId) {
    const booking = await BookingModel.findById(bookingId);
    if (!booking) return { success: false, message: 'Không tìm thấy đơn đặt vé', code: 'BOOKING_NOT_FOUND' };
    if (booking.user_id !== userId) return { success: false, message: 'Forbidden', code: 'FORBIDDEN' };

    await pool.query(
      "UPDATE bookings SET status = 'CANCELLED', cancelled_at = NOW() WHERE id = ? AND status = 'PENDING_PAYMENT'",
      [bookingId]
    );
    await pool.query(
      'UPDATE seats SET is_booked = 0, booking_id = NULL WHERE booking_id = ?',
      [bookingId]
    );
    await pool.query(
      "UPDATE booking_seats SET status = 'AVAILABLE' WHERE booking_id = ?",
      [bookingId]
    );
    await pool.query(
      "UPDATE bills SET status = 'CANCELLED' WHERE booking_id = ? AND status = 'PENDING_PAYMENT'",
      [bookingId]
    );
    if (booking.seat_hold_id) {
      const hold = await SeatHoldModel.findById(booking.seat_hold_id);
      if (hold && ['ACTIVE', 'CONVERTED'].includes(hold.status)) {
        await SeatHoldModel.updateStatus(booking.seat_hold_id, 'RELEASED');
      }
    }
    return { success: true, message: 'Hủy đơn thành công' };
  },
};

module.exports = BookingService;
