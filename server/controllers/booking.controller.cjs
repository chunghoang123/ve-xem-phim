const BookingModel = require('../models/booking.model.cjs');
const BookingSeatModel = require('../models/bookingSeat.model.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');

const BookingController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const userId = req.user.role === 'user' ? req.user.userId : null;
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
        return error(res, 'Bạn không có quyền xem vé này', 403);
      }

      return success(res, booking);
    } catch {
      return error(res, 'Lỗi lấy chi tiết vé', 500);
    }
  },

  async cancel(req, res) {
    try {
      const booking = await BookingModel.findById(req.params.id);
      if (!booking) return error(res, 'Không tìm thấy vé', 404);

      if (req.user.role === 'user' && booking.user_id !== req.user.userId) {
        return error(res, 'Bạn không có quyền hủy vé này', 403);
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
