const BookingModel = require('../models/booking.model.cjs');
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      return error(res, 'Lỗi đặt vé', 500);
    }
  },

  async cancel(req, res) {
    try {
      const booking = await BookingModel.findById(req.params.id);
      if (!booking) return error(res, 'Không tìm thấy vé', 404);

      if (req.user.role === 'user' && booking.user_id !== req.user.userId) {
        return error(res, 'Forbidden - Bạn không có quyền hủy vé này', 403);
      }

      if (booking.status === 'cancelled') {
        return error(res, 'Vé đã được hủy trước đó', 400);
      }

      const cancelled = await BookingModel.cancel(req.params.id);
      return success(res, cancelled, 'Hủy vé thành công');
    } catch (err) {
      return error(res, 'Lỗi hủy vé', 500);
    }
  },
};

module.exports = BookingController;
