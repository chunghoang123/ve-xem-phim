const pool = require('../config/database.cjs');

async function check() {
  const conn = await pool.getConnection();
  try {
    // Find a valid showtime
    const [showtimes] = await conn.query('SELECT id, movie_id FROM showtimes LIMIT 1');
    if (showtimes.length === 0) {
      console.log('NO SHOWTIMES exist - this is the root cause!');
      console.log('The init.sql or seed data was never run.');
      
      const [movies] = await conn.query('SELECT id FROM movies LIMIT 1');
      const [cinemas] = await conn.query('SELECT id FROM cinemas LIMIT 1');
      console.log(`Movies: ${movies.length}, Cinemas: ${cinemas.length}`);
      return;
    }
    
    const sid = showtimes[0].id;
    console.log(`Using showtime_id = ${sid}, movie_id = ${showtimes[0].movie_id}`);

    // Find a valid user
    const [users] = await conn.query('SELECT id FROM users LIMIT 1');
    if (users.length === 0) {
      console.log('NO USERS exist - root cause!');
      return;
    }
    const uid = users[0].id;
    console.log(`Using user_id = ${uid}`);

    // Find a valid seat for this showtime
    const [seats] = await conn.query('SELECT id FROM seats WHERE showtime_id = ? LIMIT 1', [sid]);
    if (seats.length === 0) {
      console.log(`NO SEATS for showtime ${sid} - seats need to be initialized`);
      // Try to init
      const SeatModel = require('../models/seat.model.cjs');
      const layout = await SeatModel.getLayout(sid);
      console.log(`Seats initialized: ${layout.seats.length} seats`);
    }
    
    const [seats2] = await conn.query('SELECT id FROM seats WHERE showtime_id = ? LIMIT 3', [sid]);
    console.log(`Found ${seats2.length} seats for test`);

    // Test the full flow
    const testCode = 'TEST-' + Date.now();
    console.log(`\n--- Testing INSERT into seat_holds ---`);
    
    await conn.beginTransaction();
    try {
      const [r] = await conn.query(
        "INSERT INTO seat_holds (hold_code, user_id, showtime_id, expires_at, status) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 'ACTIVE')",
        [testCode, uid, sid]
      );
      console.log(`seat_holds INSERT OK, id=${r.insertId}`);

      for (const s of seats2) {
        await conn.query(
          'INSERT INTO seat_hold_seats (hold_id, seat_id, unit_price) VALUES (?, ?, 75000)',
          [r.insertId, s.id]
        );
        console.log(`  seat_hold_seats for seat ${s.id} OK`);
      }
      
      console.log('\n=== FULL FLOW WORKS! ===');
      console.log('The issue is likely data-related (missing showtime/user/seats)');
      await conn.rollback();
      console.log('(rolled back)');
    } catch (e) {
      await conn.rollback();
      console.log(`ERROR: ${e.message}`);
      console.log(`SQL: ${e.sql || 'N/A'}`);
    }
    
  } finally {
    conn.release();
  }
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
