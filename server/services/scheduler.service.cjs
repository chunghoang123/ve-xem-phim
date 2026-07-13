const pool = require('../config/database.cjs');
const SeatHoldModel = require('../models/seatHold.model.cjs');
const PaymentModel = require('../models/payment.model.cjs');
const BookingService = require('./booking.service.cjs');

let intervalId = null;
let running = false;
let lastRollingDate = null;

async function closeStartedShowtimes() {
  const [result] = await pool.query(
    `UPDATE showtimes
     SET status = 'CLOSED'
     WHERE status = 'AVAILABLE' AND TIMESTAMP(date, time) <= NOW()`
  );

  await pool.query(
    `UPDATE seat_holds sh
     JOIN showtimes s ON s.id = sh.showtime_id
     SET sh.status = 'EXPIRED'
     WHERE sh.status = 'ACTIVE' AND s.status = 'CLOSED'`
  );

  return result.affectedRows;
}

async function ensureRollingShowtimes(daysAhead = 7) {
  const [[range]] = await pool.query(
    `SELECT MAX(s.date) AS max_date
     FROM showtimes s
     JOIN movies m ON m.id = s.movie_id AND m.status = 'active'`
  );
  if (!range.max_date) return 0;

  const [[target]] = await pool.query(
    'SELECT CURDATE() AS today, DATE_ADD(CURDATE(), INTERVAL ? DAY) AS last_date',
    [daysAhead - 1]
  );

  let sourceDate = range.max_date;
  let inserted = 0;
  while (sourceDate < target.last_date) {
    const [[next]] = await pool.query(
      'SELECT DATE_ADD(?, INTERVAL 1 DAY) AS target_date',
      [sourceDate]
    );
    const targetDate = next.target_date;

    const [result] = await pool.query(
      `INSERT IGNORE INTO showtimes
        (movie_id, cinema_id, screen_id, date, time, start_time, end_time, format, language, price, status)
       SELECT s.movie_id, s.cinema_id, s.screen_id, ?, s.time,
              TIMESTAMP(?, s.time),
              ADDTIME(
                TIMESTAMP(?, s.time),
                SEC_TO_TIME(COALESCE(TIMESTAMPDIFF(SECOND, s.start_time, s.end_time), m.duration * 60, 7200))
              ),
              s.format, s.language, s.price, 'AVAILABLE'
       FROM showtimes s
       JOIN movies m ON m.id = s.movie_id AND m.status = 'active'
       WHERE s.date = ?`,
      [targetDate, targetDate, targetDate, sourceDate]
    );
    inserted += result.affectedRows;
    sourceDate = targetDate;
  }
  return inserted;
}

async function runMaintenance() {
  if (running) return;
  running = true;
  try {
    const closed = await closeStartedShowtimes();
    const [[clock]] = await pool.query('SELECT CURDATE() AS today');
    let inserted = 0;
    if (lastRollingDate !== clock.today) {
      const [[setting]] = await pool.query("SELECT setting_value FROM app_settings WHERE setting_key='showtime_days_ahead'");
      const daysAhead = Math.max(1, Math.min(30, Number(setting?.setting_value) || 7));
      inserted = await ensureRollingShowtimes(daysAhead);
      await pool.query('DELETE FROM token_blacklist WHERE expires_at <= NOW()');
      await pool.query("DELETE FROM refresh_tokens WHERE expires_at <= NOW() OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))");
      lastRollingDate = clock.today;
    }
    if (closed || inserted) {
      console.log(`Showtime maintenance: ${closed} closed, ${inserted} created`);
    }
  } finally {
    running = false;
  }
}

const SchedulerService = {
  start(intervalMs = 30000) {
    if (intervalId) return;
    console.log(`Scheduler started (interval: ${intervalMs}ms)`);

    runMaintenance().catch(err => console.error('Showtime maintenance error:', err.message));

    intervalId = setInterval(async () => {
      try {
        await runMaintenance();
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

  closeStartedShowtimes,
  ensureRollingShowtimes,
  runMaintenance,
};

module.exports = SchedulerService;
