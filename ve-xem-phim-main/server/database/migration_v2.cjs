const pool = require('../config/database.cjs');

async function migrateV2() {
  const conn = await pool.getConnection();
  try {
    console.log('Running migration v2...');

    // 1. booking_seats table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS booking_seats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        seat_id INT NOT NULL,
        showtime_id INT NOT NULL,
        status ENUM('LOCKED', 'BOOKED', 'AVAILABLE', 'CANCELLED') DEFAULT 'LOCKED',
        locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT,
        FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT,
        UNIQUE KEY uk_showtime_seat (showtime_id, seat_id)
      ) ENGINE=InnoDB
    `);
    console.log('  booking_seats table OK');

    // 2. bills table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        user_id INT NOT NULL,
        total INT NOT NULL DEFAULT 0,
        status ENUM('PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED') DEFAULT 'PENDING_PAYMENT',
        payment_method VARCHAR(50) DEFAULT NULL,
        paid_at TIMESTAMP NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        INDEX idx_bills_status (status),
        INDEX idx_bills_user (user_id)
      ) ENGINE=InnoDB
    `);
    console.log('  bills table OK');

    // 3. tickets table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        bill_id INT NOT NULL,
        ticket_code VARCHAR(20) NOT NULL UNIQUE,
        qr_data VARCHAR(255) NOT NULL,
        seat_id INT NOT NULL,
        status ENUM('ACTIVE', 'USED', 'CANCELLED', 'EXPIRED') DEFAULT 'ACTIVE',
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE RESTRICT,
        FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT,
        INDEX idx_tickets_code (ticket_code),
        INDEX idx_tickets_status (status)
      ) ENGINE=InnoDB
    `);
    console.log('  tickets table OK');

    // 4. Add columns to bookings
    const bookingCols = [
      ['bill_id', 'INT DEFAULT NULL'],
      ['booking_type', "VARCHAR(20) DEFAULT 'manual'"],
    ];

    for (const [col, def] of bookingCols) {
      try {
        await conn.query(`ALTER TABLE bookings ADD COLUMN ${col} ${def} AFTER total`);
        console.log(`  added bookings.${col}`);
      } catch (err) {
        if (err.errno === 1060) console.log(`  bookings.${col} already exists`);
      }
    }

    try {
      await conn.query('ALTER TABLE bookings ADD FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL');
      console.log('  bookings FK added');
    } catch (err) {
      if (err.errno === 1061 || err.errno === 1826) console.log('  bookings FK exists');
      else console.log('  bookings FK skipped:', err.message);
    }

    console.log('Migration v2 complete!');
    process.exit(0);
  } catch (err) {
    console.error('Migration v2 failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

migrateV2();
