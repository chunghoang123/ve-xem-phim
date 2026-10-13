const payos = require('../config/payos.cjs');
const PaymentModel = require('../models/payment.model.cjs');
const BookingModel = require('../models/booking.model.cjs');
const BillModel = require('../models/bill.model.cjs');
const BookingService = require('./booking.service.cjs');

const CLIENT_URL = process.env.CLIENT_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:5173');

function parseTlv(value) {
  const fields = {};
  let offset = 0;
  while (offset + 4 <= value.length) {
    const tag = value.slice(offset, offset + 2);
    const length = Number.parseInt(value.slice(offset + 2, offset + 4), 10);
    if (!Number.isFinite(length) || offset + 4 + length > value.length) break;
    fields[tag] = value.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return fields;
}

function extractRecipientFromVietQr(qrCode) {
  if (!qrCode) return {};
  try {
    const root = parseTlv(qrCode);
    const merchantAccount = parseTlv(root['38'] || '');
    const beneficiary = parseTlv(merchantAccount['01'] || '');
    return {
      accountName: root['59'] || '',
      accountNumber: beneficiary['01'] || '',
      bin: beneficiary['00'] || '',
    };
  } catch {
    return {};
  }
}

const PaymentService = {
  async createPayOSPayment({ userId, bookingCode }) {
    const booking = await BookingModel.findByCode(bookingCode);
    if (!booking) {
      return { success: false, message: 'Không tìm thấy đơn đặt vé', code: 'BOOKING_NOT_FOUND' };
    }
    if (booking.user_id !== userId) {
      return { success: false, message: 'Forbidden', code: 'FORBIDDEN' };
    }
    if (booking.status !== 'PENDING_PAYMENT') {
      return { success: false, message: 'Trạng thái đơn không hợp lệ', code: 'INVALID_BOOKING_STATUS' };
    }
    if (new Date(booking.expires_at) <= new Date()) {
      return { success: false, message: 'Đơn đặt vé đã hết hạn', code: 'BOOKING_EXPIRED' };
    }

    const existingPayment = await PaymentModel.findActiveByBooking(booking.id);
    if (existingPayment) {
      let providerInfo = {};
      const qrRecipient = extractRecipientFromVietQr(existingPayment.qr_code);
      try {
        providerInfo = await payos.paymentRequests.get(Number(existingPayment.order_code));
      } catch {
        // The saved payment link remains usable when provider lookup is unavailable.
      }
      return {
        success: true,
        payment: {
          ...existingPayment,
          account_name: existingPayment.account_name || providerInfo.accountName || qrRecipient.accountName || '',
          account_number: existingPayment.account_number || providerInfo.accountNumber || qrRecipient.accountNumber || '',
          bank_bin: existingPayment.bank_bin || providerInfo.bin || qrRecipient.bin || '',
        },
        message: 'Đã có giao dịch đang hoạt động',
      };
    }

    const bill = await BillModel.findByBookingId(booking.id);

    const orderCode = Number(Date.now().toString().slice(-9) + Math.floor(Math.random() * 10));
    const expiresAt = booking.expires_at || new Date(Date.now() + 15 * 60 * 1000);

    const paymentData = {
      orderCode,
      amount: bill ? bill.total : booking.total,
      description: `Thanh toan ve ${booking.code}`.slice(0, 25),
      returnUrl: `${CLIENT_URL}/payment/success?orderCode=${orderCode}`,
      cancelUrl: `${CLIENT_URL}/payment/cancel?orderCode=${orderCode}`,
      // PayOS expects a Unix timestamp (seconds), not an ISO date string.
      expiredAt: Math.floor(new Date(expiresAt).getTime() / 1000),
    };

    let payosResult;
    try {
      payosResult = await payos.paymentRequests.create(paymentData);
    } catch (err) {
      if (err.code === 'ETIMEOUT' || err.code === 'ECONNABORTED') {
        return { success: false, message: 'PayOS không phản hồi', code: 'PAYOS_UNAVAILABLE' };
      }
      return { success: false, message: `Không thể tạo thanh toán: ${err.message}`, code: 'PAYOS_CREATE_PAYMENT_FAILED' };
    }

    const payment = await PaymentModel.create({
      booking_id: booking.id,
      provider: 'PAYOS',
      order_code: orderCode,
      amount: paymentData.amount,
      description: paymentData.description,
      checkout_url: payosResult.checkoutUrl || '',
      qr_code: payosResult.qrCode || '',
      account_name: payosResult.accountName || '',
      account_number: payosResult.accountNumber || '',
      bank_bin: payosResult.bin || '',
      status: 'PENDING',
      expires_at: expiresAt,
    });

    await BookingModel.updatePaymentId(booking.id, payment.id);

    return {
      success: true,
      payment: {
        payment_code: payment.payment_code || `PAY${payment.id}`,
        booking_code: booking.code,
        order_code: orderCode,
        amount: paymentData.amount,
        description: paymentData.description,
        checkout_url: payosResult.checkoutUrl,
        qr_code: payosResult.qrCode || '',
        account_name: payosResult.accountName || '',
        account_number: payosResult.accountNumber || '',
        bank_bin: payosResult.bin || '',
        status: 'PENDING',
        expires_at: expiresAt,
      },
    };
  },

  async getPaymentStatus(paymentCode, { isOrderCode = false, userId = null, userRole = null, syncProvider = true } = {}) {
    let payment = isOrderCode
      ? await PaymentModel.findByOrderCode(paymentCode)
      : await PaymentModel.findByCode(paymentCode);
    if (!payment) {
      return { success: false, message: 'Không tìm thấy giao dịch', code: 'PAYMENT_NOT_FOUND' };
    }

    let booking = await BookingModel.findById(payment.booking_id);
    if (!booking || (userId != null && booking.user_id !== userId && userRole !== 'admin')) {
      return { success: false, message: 'Forbidden', code: 'FORBIDDEN' };
    }

    // The redirect can arrive before the webhook. Reconcile with PayOS so a
    // successful payment still completes when webhook delivery is delayed.
    if (syncProvider && ['PENDING', 'PROCESSING'].includes(payment.status)) {
      try {
        const providerPayment = await payos.paymentRequests.get(Number(payment.order_code));
        if (providerPayment.status === 'PAID' && Number(providerPayment.amountPaid || providerPayment.amount) === Number(payment.amount)) {
          await BookingService.confirmPayment(payment.order_code);
        } else if (providerPayment.status === 'CANCELLED') {
          await this.cancelPaymentRecord(payment, booking.user_id, { cancelProvider: false });
        }
        payment = await PaymentModel.findById(payment.id);
        booking = await BookingModel.findById(payment.booking_id);
      } catch {
        // Keep returning the local state when PayOS is temporarily unavailable.
      }
    }

    let ticketCode = null;
    let ticketList = [];
    if (booking && booking.status === 'CONFIRMED') {
      const TicketModel = require('../models/ticket.model.cjs');
      const tickets = await TicketModel.findByBooking(booking.id);
      if (tickets.length > 0) {
        ticketCode = tickets[0].ticket_code;
        ticketList = tickets.map((ticket) => ({
          code: ticket.ticket_code,
          qrData: ticket.qr_data || ticket.ticket_code,
          seatCode: `${ticket.row_label}${String(ticket.seat_number).padStart(2, '0')}`,
          status: ticket.status,
        }));
      }
    }

    const qrRecipient = extractRecipientFromVietQr(payment.qr_code);

    return {
      success: true,
      payment_status: payment.status,
      booking_status: booking ? booking.status : null,
      booking_code: booking ? booking.code : null,
      amount: payment.amount,
      expires_at: payment.expires_at,
      ticket_code: ticketCode,
      tickets: ticketList,
      account_name: payment.account_name || qrRecipient.accountName || '',
      account_number: payment.account_number || qrRecipient.accountNumber || '',
      bank_bin: payment.bank_bin || qrRecipient.bin || '',
      qr_code: payment.qr_code || '',
      message: payment.status === 'PAID'
        ? 'Thanh toán thành công và vé đã được xác nhận.'
        : payment.status === 'EXPIRED'
        ? 'Giao dịch đã hết hạn.'
        : payment.status === 'CANCELLED'
        ? 'Giao dịch đã bị hủy.'
        : 'Giao dịch đang chờ thanh toán.',
    };
  },

  async cancelPaymentRecord(payment, userId, { cancelProvider = true } = {}) {
    if (!payment) {
      return { success: false, message: 'Không tìm thấy giao dịch', code: 'PAYMENT_NOT_FOUND' };
    }

    const booking = await BookingModel.findById(payment.booking_id);
    if (!booking || booking.user_id !== userId) {
      return { success: false, message: 'Forbidden', code: 'FORBIDDEN' };
    }

    if (!['PENDING', 'PROCESSING'].includes(payment.status)) {
      return { success: false, message: 'Chỉ có thể hủy giao dịch đang chờ', code: 'INVALID_PAYMENT_STATUS' };
    }

    const updated = await PaymentModel.updateStatus(payment.id, 'CANCELLED', { version: payment.version });
    if (!updated) {
      return { success: false, message: 'Trạng thái giao dịch vừa thay đổi, vui lòng tải lại', code: 'CONCURRENT_UPDATE_CONFLICT' };
    }
    await BookingService.cancelBooking(booking.id, userId);

    if (cancelProvider) {
      try {
        await payos.paymentRequests.cancel(payment.order_code);
      } catch {
        // PayOS may already have cancelled the link; local cleanup is complete.
      }
    }

    return { success: true, message: 'Đã hủy giao dịch thanh toán' };
  },

  async cancelPayment(paymentCode, userId) {
    const payment = await PaymentModel.findByCode(paymentCode);
    return this.cancelPaymentRecord(payment, userId);
  },

  async cancelPaymentByOrderCode(orderCode, userId) {
    const payment = await PaymentModel.findByOrderCode(orderCode);
    return this.cancelPaymentRecord(payment, userId);
  },
};

module.exports = PaymentService;
