const payos = require('../config/payos.cjs');
const WebhookLogModel = require('../models/webhookLog.model.cjs');
const PaymentModel = require('../models/payment.model.cjs');
const BookingService = require('./booking.service.cjs');
const SSEService = require('./sse.service.cjs');

const WebhookService = {
  async handlePayOSWebhook(reqBody) {
    // Step 1: Verify signature
    let webhookData;
    try {
      webhookData = await payos.webhooks.verify(reqBody);
    } catch {
      return { status: 400, success: false, message: 'Webhook signature invalid', code: 'INVALID_WEBHOOK_SIGNATURE' };
    }

    const { orderCode, amount, code, transactionId, reference, paymentLinkId } = webhookData;
    const transactionRef = transactionId || reference || paymentLinkId || `ORDER-${orderCode}`;

    // Step 2: Idempotency check before inserting the current delivery.
    const alreadyProcessed = await WebhookLogModel.existsByOrderCode(orderCode);
    if (alreadyProcessed) {
      return { status: 200, success: true, message: 'Webhook already processed', code: 'DUPLICATE' };
    }

    let log;
    try {
      log = await WebhookLogModel.create({
        provider: 'PAYOS',
        order_code: orderCode,
        transaction_reference: transactionRef,
        payload: reqBody,
        signature: reqBody.signature || '',
        processing_status: 'VERIFIED',
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return { status: 200, success: true, message: 'Webhook already received', code: 'DUPLICATE' };
      }
      throw err;
    }

    // A verified payOS payment webhook reports success with data.code === '00'.
    if (code !== '00') {
      await WebhookLogModel.updateStatus(log.id, 'FAILED', `PayOS code: ${code || 'unknown'}`);
      return { status: 200, success: true, message: `Webhook received with code: ${code || 'unknown'}` };
    }

    // Step 3: Find payment and verify amount
    const payment = await PaymentModel.findByOrderCode(orderCode);
    if (!payment) {
      // PayOS sends a sample webhook while confirming the endpoint.
      await WebhookLogModel.markProcessed(orderCode, transactionRef, log.id);
      return { status: 200, success: true, message: 'Payment not found, skipping' };
    }

    if (Number(payment.amount) !== Number(amount)) {
      await WebhookLogModel.updateStatus(log.id, 'FAILED', `Amount mismatch: expected ${payment.amount}, got ${amount}`);
      return { status: 400, success: false, message: 'Amount mismatch', code: 'PAYMENT_AMOUNT_MISMATCH' };
    }

    // Step 4: Confirm payment and issue tickets atomically.
    const result = await BookingService.confirmPayment(orderCode);
    if (!result.success) {
      await WebhookLogModel.updateStatus(log.id, 'FAILED', result.message);
      return { status: 500, success: false, message: result.message, code: result.code };
    }

    await PaymentModel.updateStatus(payment.id, 'PAID', { transaction_reference: transactionRef });
    await WebhookLogModel.markProcessed(orderCode, transactionRef, log.id);

    // Step 5: Send SSE notification
    if (result.success && result.tickets) {
      const BookingModel = require('../models/booking.model.cjs');
      const booking = await BookingModel.findById(result.booking_id);
      if (booking) {
        SSEService.sendToUser(booking.user_id, {
          event: 'PAYMENT_SUCCESS',
          payment_code: payment.payment_code,
          booking_code: result.booking_code,
          booking_status: 'CONFIRMED',
          ticket_code: result.tickets[0]?.ticket_code || null,
        });
      }
    }

    return { status: 200, success: true, message: 'Webhook processed successfully' };
  },
};

module.exports = WebhookService;
