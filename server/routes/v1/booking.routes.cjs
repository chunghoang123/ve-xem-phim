const express = require('express');
const router = express.Router();
const BookingV1Controller = require('../../controllers/v1/booking.controller.cjs');
const { authenticate } = require('../../middleware/auth.cjs');

router.post('/seat-holds', authenticate, BookingV1Controller.seatHold);
router.delete('/seat-holds/:holdCode', authenticate, BookingV1Controller.releaseHold);
router.post('/bookings', authenticate, BookingV1Controller.createBooking);
router.get('/bookings/history', authenticate, BookingV1Controller.history);
router.get('/bookings/:bookingCode/bill', authenticate, BookingV1Controller.getBill);

module.exports = router;
