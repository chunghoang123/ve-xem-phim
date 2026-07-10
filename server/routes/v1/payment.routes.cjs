const express = require('express');
const router = express.Router();
const PaymentV1Controller = require('../../controllers/v1/payment.controller.cjs');
const { authenticate } = require('../../middleware/auth.cjs');

router.post('/payments/payos', authenticate, PaymentV1Controller.createPayOS);
router.get('/payments/:paymentCode/status', authenticate, PaymentV1Controller.getStatus);
router.get('/payments/order/:orderCode/status', authenticate, PaymentV1Controller.getStatusByOrderCode);
router.post('/payments/order/:orderCode/cancel', authenticate, PaymentV1Controller.cancelByOrderCode);
router.post('/payments/:paymentCode/cancel', authenticate, PaymentV1Controller.cancel);
router.get('/payments/stream', authenticate, PaymentV1Controller.streamSSE);

module.exports = router;
