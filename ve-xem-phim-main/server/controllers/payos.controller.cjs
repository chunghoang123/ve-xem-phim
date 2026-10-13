const payos = require('../config/payos.cjs');
const PayOSService = require('../services/payos.service.cjs');
const { success, error } = require('../utils/helpers.cjs');

const CLIENT_URL = process.env.CLIENT_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:5173');

const PayOSController = {
  async checkout(req, res) {
    try {
      const { orderCode, amount, description, items, buyerName, buyerEmail, buyerPhone } = req.body;

      if (!orderCode || !amount || !description) {
        return error(res, 'Thiếu thông tin đơn hàng (orderCode, amount, description)', 400);
      }
      if (typeof orderCode !== 'number' || !Number.isInteger(orderCode) || orderCode <= 0) {
        return error(res, 'orderCode phải là số nguyên dương', 400);
      }
      if (amount < 100) {
        return error(res, 'Số tiền tối thiểu là 100 VND', 400);
      }

      const paymentData = {
        orderCode,
        amount,
        description: description.slice(0, 25),
        returnUrl: `${CLIENT_URL}/payment/success?orderCode=${orderCode}`,
        cancelUrl: `${CLIENT_URL}/payment/cancel?orderCode=${orderCode}`,
      };

      if (items && Array.isArray(items) && items.length > 0) {
        paymentData.items = items.map(item => ({
          name: item.name || 'Sản phẩm',
          quantity: item.quantity || 1,
          price: item.price || 0,
        }));
      }

      if (buyerName) paymentData.buyerName = buyerName;
      if (buyerEmail) paymentData.buyerEmail = buyerEmail;
      if (buyerPhone) paymentData.buyerPhone = buyerPhone;

      const result = await payos.paymentRequests.create(paymentData);

      return success(res, {
        checkoutUrl: result.checkoutUrl,
        orderCode: result.orderCode,
        paymentLinkId: result.id,
      }, 'Tạo link thanh toán thành công');
    } catch (err) {
      if (err.code === 'ETIMEOUT' || err.code === 'ECONNABORTED') {
        return error(res, 'PayOS không phản hồi, vui lòng thử lại sau', 504);
      }
      if (err.statusCode === 400 || err.status === 400) {
        return error(res, `Dữ liệu không hợp lệ: ${err.message}`, 400);
      }
      console.error('PayOS checkout error:', err);
      return error(res, 'Không thể tạo link thanh toán, vui lòng thử lại', 502);
    }
  },

  async getPaymentLinkInfo(req, res) {
    try {
      const { orderCode } = req.params;
      if (!orderCode) return error(res, 'Thiếu orderCode', 400);

      const paymentInfo = await payos.paymentRequests.get(Number(orderCode));
      return success(res, paymentInfo);
    } catch (err) {
      console.error('PayOS getPaymentLinkInfo error:', err);
      return error(res, 'Không thể lấy thông tin thanh toán', 502);
    }
  },

  async cancelPaymentLink(req, res) {
    try {
      const { orderCode } = req.params;
      if (!orderCode) return error(res, 'Thiếu orderCode', 400);

      const result = await payos.paymentRequests.cancel(Number(orderCode));
      return success(res, result, 'Hủy link thanh toán thành công');
    } catch (err) {
      console.error('PayOS cancelPaymentLink error:', err);
      return error(res, 'Không thể hủy link thanh toán', 502);
    }
  },

  async webhook(req, res) {
    try {
      const webhookData = await payos.webhooks.verify(req.body);

      if (!webhookData || !webhookData.orderCode) {
        return res.status(400).json({ success: false, message: 'Dữ liệu webhook không hợp lệ' });
      }

      await PayOSService.ensureTable();

      const webhookId = webhookData.id || String(webhookData.orderCode);
      const isProcessed = await PayOSService.isProcessed(webhookId);
      if (isProcessed) {
        return res.status(200).json({ success: true, message: 'Webhook đã được xử lý trước đó' });
      }

      const payosStatus = webhookData.status;
      await PayOSService.markProcessed(webhookId, webhookData.orderCode, payosStatus, req.body);
      await PayOSService.updateBillStatus(webhookData.orderCode, payosStatus);

      return res.status(200).json({ success: true, message: 'Webhook processed' });
    } catch (err) {
      console.error('PayOS webhook verification error:', err);
      return res.status(400).json({ success: false, message: 'Webhook signature invalid' });
    }
  },

  async confirmWebhook(req, res) {
    try {
      const { webhookUrl } = req.body;
      if (!webhookUrl) return error(res, 'Thiếu webhookUrl', 400);

      const result = await payos.webhooks.confirm(webhookUrl);
      return success(res, result, 'Xác nhận webhook thành công');
    } catch (err) {
      console.error('PayOS confirmWebhook error:', err);
      return error(res, 'Không thể xác nhận webhook với PayOS', 502);
    }
  },
};

module.exports = PayOSController;
