const express = require('express');
const router = express.Router();
const BookingController = require('../controllers/booking.controller.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const authorize = require('../middleware/authorize.cjs');

router.get('/', authenticate, BookingController.getAll);
router.get('/:id', authenticate, BookingController.getById);
router.post('/', authenticate, authorize('admin', 'staff'), BookingController.create);
router.post('/auto', authenticate, authorize('admin', 'staff'), BookingController.autoBooking);
router.put('/:id/cancel', authenticate, BookingController.cancel);

module.exports = router;
