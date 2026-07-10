const PaymentService = require('../../services/payment.service.cjs');
const { success, error } = require('../../utils/helpers.cjs');

const PaymentV1Controller = {
  async createPayOS(req, res) {
    try {
      const { booking_code } = req.body;
      if (!booking_code) {
        return error(res, 'Thiếu mã đặt vé', 400);
      }

      const result = await PaymentService.createPayOSPayment({
        userId: req.user.userId,
        bookingCode: booking_code,
      });

      if (!result.success) {
        const statusMap = {
          'BOOKING_NOT_FOUND': 404,
          'FORBIDDEN': 403,
          'INVALID_BOOKING_STATUS': 400,
          'BOOKING_EXPIRED': 410,
          'PAYOS_UNAVAILABLE': 503,
          'PAYOS_CREATE_PAYMENT_FAILED': 502,
        };
        return error(res, result.message, statusMap[result.code] || 400);
      }

      return success(res, result.payment, 'Tạo thanh toán thành công', 201);
    } catch (err) {
      console.error('createPayOS error:', err);
      return error(res, 'Lỗi tạo thanh toán', 500);
    }
  },

  async getStatus(req, res) {
    try {
      const { paymentCode } = req.params;
      const result = await PaymentService.getPaymentStatus(paymentCode, {
        userId: req.user.userId,
        userRole: req.user.role,
      });
      if (!result.success) {
        return error(res, result.message, result.code === 'FORBIDDEN' ? 403 : 404);
      }
      return success(res, result);
    } catch (err) {
      console.error('getPaymentStatus error:', err);
      return error(res, 'Lỗi kiểm tra trạng thái', 500);
    }
  },

  async getStatusByOrderCode(req, res) {
    try {
      const { orderCode } = req.params;
      const result = await PaymentService.getPaymentStatus(orderCode, {
        isOrderCode: true,
        userId: req.user.userId,
        userRole: req.user.role,
      });
      if (!result.success) {
        return error(res, result.message, result.code === 'FORBIDDEN' ? 403 : 404);
      }
      return success(res, result);
    } catch (err) {
      console.error('getStatusByOrderCode error:', err);
      return error(res, 'Lỗi kiểm tra trạng thái', 500);
    }
  },

  async cancel(req, res) {
    try {
      const { paymentCode } = req.params;
      const result = await PaymentService.cancelPayment(paymentCode, req.user.userId);
      if (!result.success) {
        const statusMap = {
          'PAYMENT_NOT_FOUND': 404,
          'FORBIDDEN': 403,
          'INVALID_PAYMENT_STATUS': 400,
        };
        return error(res, result.message, statusMap[result.code] || 400);
      }
      return success(res, null, result.message);
    } catch (err) {
      console.error('cancelPayment error:', err);
      return error(res, 'Lỗi hủy giao dịch', 500);
    }
  },

  async cancelByOrderCode(req, res) {
    try {
      const result = await PaymentService.cancelPaymentByOrderCode(req.params.orderCode, req.user.userId);
      if (!result.success) {
        const statusMap = { PAYMENT_NOT_FOUND: 404, FORBIDDEN: 403, INVALID_PAYMENT_STATUS: 409, CONCURRENT_UPDATE_CONFLICT: 409 };
        return error(res, result.message, statusMap[result.code] || 400);
      }
      return success(res, null, result.message);
    } catch (err) {
      console.error('cancelPaymentByOrderCode error:', err);
      return error(res, 'Lỗi hủy giao dịch', 500);
    }
  },

  async streamSSE(req, res) {
    const SSEService = require('../../services/sse.service.cjs');
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');

    SSEService.addClient(req.user.userId, res);
  },
};

module.exports = PaymentV1Controller;
