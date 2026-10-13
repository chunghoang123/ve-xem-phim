const express = require('express');
const router = express.Router();
const PayOSController = require('../controllers/payos.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');

router.post('/checkout', authenticate, PayOSController.checkout);
router.get('/payment/:orderCode', authenticate, PayOSController.getPaymentLinkInfo);
router.post('/payment/:orderCode/cancel', authenticate, PayOSController.cancelPaymentLink);
router.post('/confirm-webhook', authenticate, PayOSController.confirmWebhook);

module.exports = router;
