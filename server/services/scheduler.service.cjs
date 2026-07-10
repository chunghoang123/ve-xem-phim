const pool = require('../config/database.cjs');
const SeatHoldModel = require('../models/seatHold.model.cjs');
const PaymentModel = require('../models/payment.model.cjs');
const BookingService = require('./booking.service.cjs');

let intervalId = null;

const SchedulerService = {
  start(intervalMs = 30000) {
    if (intervalId) return;
    console.log(`Scheduler started (interval: ${intervalMs}ms)`);

    intervalId = setInterval(async () => {
      try {
        const expiredHolds = await SeatHoldModel.expireExpiredHolds();
        if (expiredHolds.length > 0) {
          console.log(`Expired ${expiredHolds.length} seat holds`);
        }

        const expiredPayments = await PaymentModel.expireExpiredPayments();
        if (expiredPayments.length > 0) {
          console.log(`Expired ${expiredPayments.length} payments`);

          for (const pay of expiredPayments) {
            const [payment] = await pool.query('SELECT booking_id FROM payments WHERE id = ?', [pay.id]);
            if (payment[0]?.booking_id) {
              const bid = payment[0].booking_id;
              await BookingService.expireBooking(bid);
            }
          }
        }
      } catch (err) {
        console.error('Scheduler error:', err.message);
      }
    }, intervalMs);
  },

  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      console.log('Scheduler stopped');
    }
  },
};

module.exports = SchedulerService;
