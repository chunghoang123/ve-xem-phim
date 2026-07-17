const express = require('express');
const router = express.Router();
const SeatController = require('../controllers/seat.controller.cjs');

router.get('/:showtimeId', SeatController.getLayout);

module.exports = router;
