const pool = require('../config/database.cjs');

async function migrateV4() {
  const conn = await pool.getConnection();
  try {
    console.log('Running migration v4 (nullable FK for hold phase)...');

    const [shsCols] = await conn.query("SHOW COLUMNS FROM seat_hold_seats LIKE 'booking_seat_id'");
    if (shsCols.length > 0) {
      const col = shsCols[0];
      if (col.Null === 'NO') {
        await conn.query('ALTER TABLE seat_hold_seats MODIFY booking_seat_id INT NULL');
        console.log('  seat_hold_seats.booking_seat_id is now nullable');
      } else {
        console.log('  seat_hold_seats.booking_seat_id already nullable');
      }
    }

    console.log('Migration v4 completed successfully!');
  } catch (err) {
    console.error('Migration v4 failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

migrateV4().then(() => process.exit(0)).catch(() => process.exit(1));
