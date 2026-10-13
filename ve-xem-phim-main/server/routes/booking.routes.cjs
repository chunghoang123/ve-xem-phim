const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/booking.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');

router.get('/', authenticate, BookingController.getAll);
router.get('/:id', authenticate, BookingController.getById);
router.put('/:id/cancel', authenticate, BookingController.cancel);

module.exports = router;
