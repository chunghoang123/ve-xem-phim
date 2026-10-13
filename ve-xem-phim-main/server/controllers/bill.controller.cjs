const BillModel = require('../models/bill.model.cjs');
const BookingSeatModel = require('../models/bookingSeat.model.cjs');
const TicketModel = require('../models/ticket.model.cjs');
const SeatModel = require('../models/seat.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const BillController = {
  async getById(req, res) {
    try {
      const bill = await BillModel.findById(req.params.id);
      if (!bill) return error(res, 'Không tìm thấy hóa đơn', 404);

      if (req.user.role === 'user' && bill.user_id !== req.user.userId) {
        return error(res, 'Forbidden', 403);
      }

      const tickets = await TicketModel.findByBill(bill.id);
      const bookingSeats = await BookingSeatModel.findByBooking(bill.booking_id);

      return success(res, { ...bill, tickets, seats: bookingSeats });
    } catch (err) {
      console.error('getBill error:', err);
      return error(res, 'Lỗi lấy hóa đơn', 500);
    }
  },

  async getMyBills(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const result = await BillModel.findAll({ page, limit, user_id: req.user.userId, status });
      return success(res, { bills: result.rows, total: result.total, page, limit });
    } catch {
      return error(res, 'Lỗi lấy danh sách hóa đơn', 500);
    }
  },

  async payDemo(req, res) {
    try {
      const bill = await BillModel.findById(req.params.id);
      if (!bill) return error(res, 'Không tìm thấy hóa đơn', 404);

      if (bill.user_id !== req.user.userId) {
        return error(res, 'Forbidden', 403);
      }

      if (bill.status !== 'PENDING_PAYMENT') {
        return error(res, `Hóa đơn đã ${bill.status === 'PAID' ? 'thanh toán' : 'hủy'}`, 400);
      }

      const paid = await BillModel.markPaid(bill.id, req.body.payment_method || 'demo');
      if (!paid) return error(res, 'Thanh toán thất bại', 500);

      const updatedBill = await BillModel.findById(bill.id);

      await BookingSeatModel.updateStatus(bill.booking_id, 'BOOKED');

      await SeatModel.confirmSeats(bill.booking_id);

      return success(res, updatedBill, 'Thanh toán demo thành công! Tính năng thanh toán thật sẽ được nâng cấp sau.');
    } catch (err) {
      console.error('payDemo error:', err);
      return error(res, 'Lỗi thanh toán', 500);
    }
  },
};

module.exports = BillController;
