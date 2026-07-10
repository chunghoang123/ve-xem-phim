const pool = require('../config/database.cjs');

async function diagnose() {
  const conn = await pool.getConnection();
  try {
    console.log('=== DATABASE DIAGNOSE ===\n');

    // 1. Check tables exist
    const tables = ['seat_holds', 'seat_hold_seats', 'payments', 'payment_webhook_logs'];
    for (const tbl of tables) {
      const [rows] = await conn.query("SHOW TABLES LIKE ?", [tbl]);
      console.log(`Table ${tbl}: ${rows.length > 0 ? 'EXISTS' : 'MISSING'}`);
      if (rows.length > 0) {
        const [cols] = await conn.query("SHOW COLUMNS FROM ??", [tbl]);
        cols.forEach(c => console.log(`  ${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default || '(none)'}`));
      }
    }

    // 2. Check showtime
    console.log('\n--- Sample Showtime ---');
    const [st] = await conn.query('SELECT id, movie_id, cinema_id, date, time, price, ticket_price FROM showtimes LIMIT 3');
    if (st.length === 0) {
      console.log('NO SHOWTIMES FOUND!');
    } else {
      st.forEach(s => console.log(`  id=${s.id} movie_id=${s.movie_id} price=${s.price} ticket_price=${s.ticket_price}`));
    }

    // 3. Check seats for first showtime
    if (st.length > 0) {
      const sid = st[0].id;
      const [seats] = await conn.query(
        'SELECT id, row_label, seat_number, is_vip, is_booked FROM seats WHERE showtime_id = ? LIMIT 5',
        [sid]
      );
      console.log(`\n--- Sample Seats for showtime ${sid} ---`);
      if (seats.length === 0) {
        console.log('NO SEATS FOUND - initLayout will create them on first query');
      } else {
        seats.forEach(s => console.log(`  id=${s.id} ${s.row_label}${s.seat_number} vip=${s.is_vip} booked=${s.is_booked}`));
      }
    }

    // 4. Check booking_seats constraints
    console.log('\n--- booking_seats schema ---');
    const [bsCols] = await conn.query("SHOW COLUMNS FROM booking_seats");
    bsCols.forEach(c => console.log(`  ${c.Field}: ${c.Type} | Null: ${c.Null} | Key: ${c.Key}`));

    // 5. Test the actual INSERT that SeatHoldModel.create does
    console.log('\n--- Test INSERT into seat_hold_seats (dry run in transaction) ---');
    await conn.beginTransaction();
    try {
      const testHoldCode = 'DIAG-' + Date.now();
      const [r] = await conn.query(
        'INSERT INTO seat_holds (hold_code, user_id, showtime_id, expires_at, status) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), ?)',
        [testHoldCode, 1, st[0]?.id || 1, 'ACTIVE']
      );
      console.log(`  seat_holds INSERT OK, id=${r.insertId}`);

      try {
        await conn.query(
          'INSERT INTO seat_hold_seats (hold_id, seat_id, unit_price) VALUES (?, ?, ?)',
          [r.insertId, 1, 75000]
        );
        console.log('  seat_hold_seats INSERT OK (booking_seat_id is nullable - migration v4 applied)');
      } catch (e2) {
        console.log(`  seat_hold_seats INSERT FAILED: ${e2.message}`);
        console.log('  ==> booking_seat_id is NOT NULL, migration v4 not effective');
      }
      await conn.rollback();
      console.log('  (rolled back)');
    } catch (e) {
      await conn.rollback();
      console.log(`  FAILED at seat_holds INSERT: ${e.message}`);
    }

    console.log('\n=== DIAGNOSE COMPLETE ===');
  } finally {
    conn.release();
  }
  process.exit(0);
}

diagnose().catch(err => {
  console.error('DIAGNOSE CRASHED:', err);
  process.exit(1);
});
