const pool = require('../config/database.cjs');

async function migrateV3() {
  const conn = await pool.getConnection();
  try {
    console.log('Running migration v3 (PayOS payment)...');

    // 1. seat_holds table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS seat_holds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hold_code VARCHAR(50) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        showtime_id INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        status ENUM('ACTIVE','CONVERTED','EXPIRED','RELEASED') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (showtime_id) REFERENCES showtimes(id),
        INDEX idx_status_expires (status, expires_at),
        INDEX idx_user_showtime (user_id, showtime_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  seat_holds table OK');

    // 2. seat_hold_seats table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS seat_hold_seats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hold_id INT NOT NULL,
        seat_id INT NOT NULL,
        booking_seat_id INT NOT NULL,
        unit_price INT NOT NULL DEFAULT 0,
        FOREIGN KEY (hold_id) REFERENCES seat_holds(id) ON DELETE CASCADE,
        FOREIGN KEY (seat_id) REFERENCES seats(id),
        FOREIGN KEY (booking_seat_id) REFERENCES booking_seats(id),
        UNIQUE KEY uk_hold_seat (hold_id, seat_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  seat_hold_seats table OK');

    // 3. payments table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_code VARCHAR(50) NOT NULL UNIQUE,
        booking_id INT NOT NULL,
        provider VARCHAR(20) NOT NULL DEFAULT 'PAYOS',
        order_code BIGINT NOT NULL UNIQUE,
        amount INT NOT NULL,
        description VARCHAR(255),
        checkout_url VARCHAR(500),
        qr_code TEXT,
        transaction_reference VARCHAR(100),
        status ENUM('PENDING','PROCESSING','PAID','FAILED','CANCELLED','EXPIRED') DEFAULT 'PENDING',
        expires_at TIMESTAMP NOT NULL,
        paid_at TIMESTAMP NULL,
        failed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        version INT DEFAULT 1,
        FOREIGN KEY (booking_id) REFERENCES bookings(id),
        INDEX idx_order_code (order_code),
        INDEX idx_status_expires (status, expires_at),
        INDEX idx_booking (booking_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  payments table OK');

    // 4. payment_webhook_logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS payment_webhook_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider VARCHAR(20) NOT NULL DEFAULT 'PAYOS',
        order_code BIGINT NOT NULL,
        transaction_reference VARCHAR(100),
        payload JSON,
        signature VARCHAR(500),
        processing_status ENUM('RECEIVED','VERIFIED','PROCESSED','DUPLICATE','FAILED','INVALID_SIGNATURE') DEFAULT 'RECEIVED',
        received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP NULL,
        error_message TEXT,
        UNIQUE KEY uk_provider_order_txn (provider, order_code, transaction_reference(50))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  payment_webhook_logs table OK');

    // 5. Add columns to bookings
    const [bkCols] = await conn.query('SHOW COLUMNS FROM bookings LIKE "version"');
    if (bkCols.length === 0) {
      await conn.query('ALTER TABLE bookings ADD COLUMN version INT DEFAULT 1');
      await conn.query('ALTER TABLE bookings ADD COLUMN seat_hold_id INT NULL');
      await conn.query('ALTER TABLE bookings ADD COLUMN payment_id INT NULL');
      await conn.query('ALTER TABLE bookings ADD COLUMN paid_at TIMESTAMP NULL');
      await conn.query('ALTER TABLE bookings ADD COLUMN confirmed_at TIMESTAMP NULL');
      await conn.query('ALTER TABLE bookings ADD COLUMN cancelled_at TIMESTAMP NULL');
      await conn.query('ALTER TABLE bookings ADD COLUMN expires_at TIMESTAMP NULL');
      await conn.query('ALTER TABLE bookings ADD INDEX idx_status_expires (status, expires_at)');
      console.log('  bookings columns added OK');
    } else {
      console.log('  bookings columns already exist');
    }

    // 6. Add unit_price to booking_seats
    const [bsCols] = await conn.query('SHOW COLUMNS FROM booking_seats LIKE "unit_price"');
    if (bsCols.length === 0) {
      await conn.query('ALTER TABLE booking_seats ADD COLUMN unit_price INT DEFAULT 0');
      console.log('  booking_seats.unit_price added OK');
    } else {
      console.log('  booking_seats.unit_price already exists');
    }

    // 7. Add payment_id and issued_at to tickets
    const [tkCols] = await conn.query('SHOW COLUMNS FROM tickets LIKE "payment_id"');
    if (tkCols.length === 0) {
      await conn.query('ALTER TABLE tickets ADD COLUMN payment_id INT NULL');
      await conn.query('ALTER TABLE tickets ADD INDEX idx_payment (payment_id)');
      console.log('  tickets columns added OK');
    } else {
      console.log('  tickets columns already exist');
    }

    console.log('Migration v3 completed successfully!');
  } catch (err) {
    console.error('Migration v3 failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

migrateV3().then(() => process.exit(0)).catch(() => process.exit(1));
