const express = require('express');
const router = express.Router();
const SeatController = require('../controllers/seat.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/:showtimeId', SeatController.getLayout);
router.post('/book', authenticate, authorize('admin', 'staff'), SeatController.book);
router.post('/reset/:showtimeId', authenticate, authorize('admin'), SeatController.reset);

module.exports = router;
