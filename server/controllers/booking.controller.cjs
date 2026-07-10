const BookingModel = require('../models/booking.model.cjs');
const BookingSeatModel = require('../models/bookingSeat.model.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');

const BookingController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      let userId = null;

      if (req.user.role === 'user') {
        userId = req.user.userId;
      }

      const result = await BookingModel.findAll({ page, limit, user_id: userId, status });
      return paginated(res, result.rows, result.total, page, limit);
    } catch {
      return error(res, 'Lỗi lấy danh sách vé', 500);
    }
  },

  async getById(req, res) {
    try {
      const booking = await BookingModel.findById(req.params.id);
      if (!booking) return error(res, 'Không tìm thấy vé', 404);

      if (req.user.role === 'user' && booking.user_id !== req.user.userId) {
        return error(res, 'Forbidden - Bạn không có quyền xem vé này', 403);
      }

      return success(res, booking);
    } catch {
      return error(res, 'Lỗi lấy chi tiết vé', 500);
    }
  },

  async create(req, res) {
    try {
      const { showtime_id, seats, payment_method } = req.body;
      if (!showtime_id || !seats || !Array.isArray(seats) || seats.length === 0) {
        return error(res, 'Vui lòng chọn ghế', 400);
      }

      const SeatModel = require('../models/seat.model.cjs');
      const ShowtimeModel = require('../models/showtime.model.cjs');

      const showtime = await ShowtimeModel.findById(showtime_id);
      if (!showtime) return error(res, 'Suất chiếu không tồn tại', 404);

      const total = seats.length * showtime.ticket_price;

      const booking = await BookingModel.create({
        user_id: req.user.userId,
        showtime_id,
        seats,
        total,
        payment_method: payment_method || 'cash',
      });

      const affected = await SeatModel.bookSeats(showtime_id, seats, booking.id);
      if (affected === 0) {
        await BookingModel.cancel(booking.id);
        return error(res, 'Ghế đã được đặt trước đó, vui lòng chọn ghế khác', 409);
      }

      const fullBooking = await BookingModel.findById(booking.id);
      return success(res, fullBooking, 'Đặt vé thành công', 201);
    } catch {
      return error(res, 'Lỗi đặt vé', 500);
    }
  },

  async autoBooking(req, res) {
    try {
      const { showtime_id, seats } = req.body;
      if (!showtime_id || !seats || !Array.isArray(seats) || seats.length === 0) {
        return error(res, 'Vui lòng chọn suất chiếu và ghế', 400);
      }

      const ShowtimeModel = require('../models/showtime.model.cjs');
      const showtime = await ShowtimeModel.findById(showtime_id);
      if (!showtime) return error(res, 'Suất chiếu không tồn tại', 404);

      const total = seats.length * (showtime.ticket_price || showtime.price || 75000);

      const result = await BookingModel.autoBooking({
        userId: req.user.userId,
        showtimeId: parseInt(showtime_id),
        seats,
        total,
      });

      if (!result.success) {
        return error(res, result.message, 409);
      }

      return success(res, {
        booking: result.booking,
        bill: result.bill,
        tickets: result.tickets,
        seats: result.seats,
      }, 'Đặt vé thành công! Vui lòng thanh toán trong vòng 15 phút.', 201);
    } catch (err) {
      console.error('autoBooking error:', err);
      return error(res, 'Lỗi đặt vé tự động', 500);
    }
  },

  async cancel(req, res) {
    try {
      const booking = await BookingModel.findById(req.params.id);
      if (!booking) return error(res, 'Không tìm thấy vé', 404);

      if (req.user.role === 'user' && booking.user_id !== req.user.userId) {
        return error(res, 'Forbidden - Bạn không có quyền hủy vé này', 403);
      }

      if (!['pending', 'PENDING_PAYMENT'].includes(booking.status)) {
        return error(res, 'Chỉ có thể hủy đơn đang chờ thanh toán', 409);
      }

      const cancelled = await BookingModel.cancel(req.params.id);

      await BookingSeatModel.releaseByBooking(req.params.id);

      const SeatModel = require('../models/seat.model.cjs');
      await SeatModel.releaseSeats(req.params.id);

      const BillModel = require('../models/bill.model.cjs');
      const bill = await BillModel.findByBooking(req.params.id);
      if (bill && bill.status === 'PENDING_PAYMENT') {
        await BillModel.updateStatus(bill.id, 'CANCELLED');
      }

      const TicketModel = require('../models/ticket.model.cjs');
      await TicketModel.cancelByBooking(req.params.id);

      return success(res, cancelled, 'Hủy vé thành công');
    } catch {
      return error(res, 'Lỗi hủy vé', 500);
    }
  },
};

module.exports = BookingController;
