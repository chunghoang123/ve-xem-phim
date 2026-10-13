const express = require('express');
const router = express.Router();
const WebhookV1Controller = require('../../controllers/v1/webhook.controller.cjs');

router.post('/webhooks/payos', WebhookV1Controller.payos);

module.exports = router;
