const WebhookService = require('../../services/webhook.service.cjs');

const WebhookV1Controller = {
  async payos(req, res) {
    try {
      const result = await WebhookService.handlePayOSWebhook(req.body);
      return res.status(result.status).json({
        success: result.success,
        message: result.message,
        code: result.code,
      });
    } catch (err) {
      console.error('Webhook error:', err);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  },
};

module.exports = WebhookV1Controller;
