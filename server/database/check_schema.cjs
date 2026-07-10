const pool = require('../config/database.cjs');

async function check() {
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query("SHOW COLUMNS FROM seat_hold_seats");
    console.log('seat_hold_seats columns:');
    cols.forEach(c => console.log(`  ${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${JSON.stringify(c.Default)} | Key: ${c.Key}`));
    
    // Test INSERT
    const testCode = 'TEST-' + Date.now();
    const [r] = await conn.query(
      "INSERT INTO seat_holds (hold_code, user_id, showtime_id, expires_at, status) VALUES (?, 1, 1, DATE_ADD(NOW(), INTERVAL 10 MINUTE), 'ACTIVE')",
      [testCode]
    );
    console.log(`\nInserted seat_hold id=${r.insertId}`);
    
    try {
      const [r2] = await conn.query(
        'INSERT INTO seat_hold_seats (hold_id, seat_id, unit_price) VALUES (?, 1, 75000)',
        [r.insertId]
      );
      console.log(`Inserted seat_hold_seats id=${r2.insertId} - SUCCESS!`);
    } catch (e) {
      console.log(`seat_hold_seats INSERT FAILED: ${e.message}`);
    }
    
    // Cleanup
    await conn.query('DELETE FROM seat_hold_seats WHERE hold_id = ?', [r.insertId]);
    await conn.query('DELETE FROM seat_holds WHERE id = ?', [r.insertId]);
    console.log('Cleanup done');
    
  } finally {
    conn.release();
  }
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
