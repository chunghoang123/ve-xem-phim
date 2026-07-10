const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/ticket.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.post('/verify', authenticate, authorize('admin', 'staff'), TicketController.verify);
router.post('/:ticketCode/use', authenticate, authorize('admin', 'staff'), TicketController.consume);

module.exports = router;
