const SeatHoldModel = require('../../models/seatHold.model.cjs');
const BookingService = require('../../services/booking.service.cjs');
const BookingModel = require('../../models/booking.model.cjs');
const BillModel = require('../../models/bill.model.cjs');
const { success, error } = require('../../utils/helpers.cjs');

const BookingV1Controller = {
  async history(req, res) {
    try {
      const bookings = await BookingModel.findHistoryByUser(req.user.userId);
      return success(res, bookings, 'Lấy lịch sử đặt vé thành công');
    } catch (err) {
      console.error('bookingHistory error:', err);
      return error(res, 'Không thể tải lịch sử đặt vé', 500);
    }
  },

  async seatHold(req, res) {
    try {
      const { showtime_id, seat_ids } = req.body;
      if (!showtime_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
        return error(res, 'Thiếu thông tin suất chiếu hoặc ghế', 400);
      }

      const ShowtimeModel = require('../../models/showtime.model.cjs');
      const showtime = await ShowtimeModel.findById(showtime_id);
      if (!showtime) return error(res, 'Suất chiếu không tồn tại', 404);

      const pool = require('../../config/database.cjs');
      const placeholders = seat_ids.map(() => '?').join(',');
      const userId = req.user.userId;

      const [foundSeats] = await pool.query(
        `SELECT id, row_label, seat_number, is_vip, is_booked FROM seats WHERE showtime_id = ? AND id IN (${placeholders})`,
        [showtime_id, ...seat_ids]
      );
      if (foundSeats.length !== seat_ids.length) {
        return error(res, 'Một số ghế không tồn tại trong suất chiếu này', 400);
      }

      const [conflictSeats] = await pool.query(
        `SELECT s.id, s.row_label, s.seat_number FROM seats s
         WHERE s.showtime_id = ? AND s.id IN (${placeholders})
           AND (
             s.is_booked = 1
             OR EXISTS (
               SELECT 1 FROM seat_hold_seats shs
               INNER JOIN seat_holds sh ON shs.hold_id = sh.id
               WHERE shs.seat_id = s.id AND sh.showtime_id = s.showtime_id
                 AND sh.status = 'ACTIVE' AND sh.expires_at > NOW() AND sh.user_id != ?
             )
             OR EXISTS (
               SELECT 1 FROM booking_seats bs
               INNER JOIN bookings b ON bs.booking_id = b.id
               WHERE bs.seat_id = s.id AND b.showtime_id = s.showtime_id
                 AND b.status IN ('PENDING_PAYMENT', 'PAID', 'CONFIRMED')
             )
           )`,
        [showtime_id, ...seat_ids, userId]
      );

      if (conflictSeats.length > 0) {
        return error(res, `Ghế ${conflictSeats.map(s => `${s.row_label}${s.seat_number}`).join(', ')} không khả dụng`, 409);
      }

      const seatPrices = foundSeats.map(s =>
        s.is_vip ? (showtime.vip_price || showtime.ticket_price || showtime.price || 75000)
                 : (showtime.ticket_price || showtime.price || 75000)
      );

      const hold = await SeatHoldModel.create({
        userId: req.user.userId,
        showtimeId: showtime_id,
        seatIds: seat_ids,
        seatPrices,
      });

      return success(res, {
        hold_code: hold.hold_code,
        showtime_id,
        seats: foundSeats.map(s => `${s.row_label}${s.seat_number}`),
        expires_at: hold.expires_at,
      }, 'Giữ ghế thành công', 201);
    } catch (err) {
      console.error('seatHold error:', err);
      const status = ['SEATS_UNAVAILABLE', 'INVALID_SEATS', 'SHOWTIME_CLOSED'].includes(err.code) ? 409 : 500;
      return error(res, err.message || 'Lỗi giữ ghế', status);
    }
  },

  async createBooking(req, res) {
    try {
      const { seat_hold_code, concessions } = req.body;
      if (!seat_hold_code) {
        return error(res, 'Thiếu mã giữ ghế', 400);
      }

      const result = await BookingService.createBookingFromHold({
        userId: req.user.userId,
        seatHoldCode: seat_hold_code,
        concessions,
      });

      if (!result.success) {
        return error(res, result.message, 400);
      }

      return success(res, {
        booking_code: result.booking.code,
        status: result.booking.status,
        movie_name: result.movie_title,
        cinema_name: result.cinema_name,
        cinema_address: result.cinema_address,
        room_name: result.room_name || '',
        show_date: result.show_date,
        show_time: result.show_time,
        seat_codes: result.seatCodes,
        subtotal: result.subtotal,
        service_fee: result.serviceFee,
        concessions: result.concessions || [],
        concessions_total: result.concessionTotal || 0,
        discount_amount: 0,
        total_amount: result.totalAmount,
        expires_at: result.expiresAt,
      }, 'Tạo đơn đặt vé thành công', 201);
    } catch (err) {
      console.error('createBooking error:', err);
      return error(res, err.message || 'Lỗi tạo đơn đặt vé', 500);
    }
  },

  async releaseHold(req, res) {
    try {
      const { holdCode } = req.params;
      if (!holdCode) return error(res, 'Thiếu mã giữ ghế', 400);

      const hold = await SeatHoldModel.findByCode(holdCode);
      if (!hold) return error(res, 'Mã giữ ghế không hợp lệ', 404);
      if (hold.user_id !== req.user.userId) return error(res, 'Forbidden', 403);
      if (hold.status !== 'ACTIVE') return success(res, null, 'Ghế đã được giải phóng');

      await SeatHoldModel.releaseByHold(hold.id);
      return success(res, null, 'Giải phóng ghế thành công');
    } catch (err) {
      console.error('releaseHold error:', err);
      return error(res, 'Lỗi giải phóng ghế', 500);
    }
  },

  async cancelBooking(req, res) {
    try {
      const booking = await BookingModel.findByCode(req.params.bookingCode);
      if (!booking) return error(res, 'Không tìm thấy đơn đặt vé', 404);
      const result = await BookingService.cancelBooking(booking.id, req.user.userId);
      if (!result.success) {
        const status = result.code === 'FORBIDDEN' ? 403 : result.code === 'INVALID_BOOKING_STATUS' ? 409 : 400;
        return error(res, result.message, status);
      }
      return success(res, null, result.message);
    } catch (err) {
      console.error('cancelBooking error:', err);
      return error(res, 'Lỗi hủy đơn đặt vé', 500);
    }
  },

  async getBill(req, res) {
    try {
      const { bookingCode } = req.params;
      const booking = await BookingModel.findByCode(bookingCode);
      if (!booking) return error(res, 'Không tìm thấy đơn đặt vé', 404);
      if (booking.user_id !== req.user.userId && req.user.role !== 'admin') {
        return error(res, 'Forbidden', 403);
      }

      const bill = await BillModel.findByBookingId(booking.id);
      if (!bill) return error(res, 'Không tìm thấy hóa đơn', 404);

      const pool = require('../../config/database.cjs');
      const [showtimeRows] = await pool.query(
        `SELECT s.*, m.title as movie_title, m.ticket_price, m.vip_price,
                c.name as cinema_name, c.address as cinema_address,
                sc.name as room_name
         FROM showtimes s
         JOIN movies m ON s.movie_id = m.id
         JOIN cinemas c ON s.cinema_id = c.id
         LEFT JOIN screens sc ON s.screen_id = sc.id
         WHERE s.id = ?`,
        [booking.showtime_id]
      );
      const showtime = showtimeRows[0];

      const [bookingSeats] = await pool.query(
        `SELECT bs.*, s.row_label, s.seat_number, s.is_vip
         FROM booking_seats bs
         JOIN seats s ON bs.seat_id = s.id
         WHERE bs.booking_id = ?`,
        [booking.id]
      );

      const seatDetails = bookingSeats.map(bs => ({
        code: `${bs.row_label}${bs.seat_number}`,
        type: bs.is_vip ? 'VIP' : 'Thường',
        price: bs.unit_price || 0,
      }));

      return success(res, {
        booking_code: booking.code,
        status: booking.status,
        customer_name: req.user.name || '',
        movie_name: showtime?.movie_title || '',
        cinema_name: showtime?.cinema_name || '',
        cinema_address: showtime?.cinema_address || '',
        room_name: showtime?.room_name || '',
        show_date: showtime?.date,
        show_time: showtime?.time,
        seats: seatDetails,
        subtotal: seatDetails.reduce((sum, s) => sum + s.price, 0),
        concessions: JSON.parse(booking.concessions_json || '[]'),
        concessions_total: JSON.parse(booking.concessions_json || '[]').reduce((sum, item) => sum + Number(item.line_total || 0), 0),
        service_fee: bill.total - seatDetails.reduce((sum, s) => sum + s.price, 0) - JSON.parse(booking.concessions_json || '[]').reduce((sum, item) => sum + Number(item.line_total || 0), 0),
        discount_amount: 0,
        total_amount: bill.total,
        expires_at: bill.expires_at,
      });
    } catch (err) {
      console.error('getBill error:', err);
      return error(res, 'Lỗi lấy hóa đơn', 500);
    }
  },
};

module.exports = BookingV1Controller;
