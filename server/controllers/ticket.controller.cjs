const TicketModel = require('../models/ticket.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const TicketController = {
  async verify(req, res) {
    try {
      const { ticketCode } = req.body;
      if (!ticketCode) return error(res, 'Vui lòng cung cấp mã vé', 400);

      const result = await TicketModel.verifyTicket(ticketCode);
      if (!result.valid) return error(res, result.message, 400);

      return success(res, result.ticket, 'Vé hợp lệ');
    } catch {
      return error(res, 'Lỗi xác thực vé', 500);
    }
  },

  async consume(req, res) {
    try {
      const { ticketCode } = req.params;
      if (!ticketCode) return error(res, 'Vui lòng cung cấp mã vé', 400);

      const result = await TicketModel.consumeTicket(ticketCode);
      if (!result.success) return error(res, result.message, 400);

      return success(res, result.ticket, 'Xác nhận vé thành công. Mời quý khách vào rạp!');
    } catch {
      return error(res, 'Lỗi sử dụng vé', 500);
    }
  },
};

module.exports = TicketController;
