const pool = require('../config/database.cjs');

async function migrateAll() {
  const conn = await pool.getConnection();
  try {
    console.log('=== Running all migrations ===\n');

    // --- V3: Create PayOS tables ---
    console.log('[v3] Creating PayOS tables...');
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
    console.log('  seat_holds OK');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS seat_hold_seats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hold_id INT NOT NULL,
        seat_id INT NOT NULL,
        booking_seat_id INT NULL,
        unit_price INT NOT NULL DEFAULT 0,
        FOREIGN KEY (hold_id) REFERENCES seat_holds(id) ON DELETE CASCADE,
        FOREIGN KEY (seat_id) REFERENCES seats(id),
        UNIQUE KEY uk_hold_seat (hold_id, seat_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('  seat_hold_seats OK (booking_seat_id nullable)');

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
        account_name VARCHAR(255),
        account_number VARCHAR(100),
        bank_bin VARCHAR(20),
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
    console.log('  payments OK');

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
    console.log('  payment_webhook_logs OK');

    // --- V3: Alter existing tables ---
    const addColIfMissing = async (table, col, def) => {
      const [rows] = await conn.query(`SHOW COLUMNS FROM ?? LIKE ?`, [table, col]);
      if (rows.length === 0) {
        await conn.query(`ALTER TABLE ?? ADD COLUMN ${def}`, [table]);
        console.log(`  ${table}.${col} added`);
      } else {
        console.log(`  ${table}.${col} already exists`);
      }
    };

    await addColIfMissing('bookings', 'version', 'INT DEFAULT 1');
    await addColIfMissing('bookings', 'seat_hold_id', 'INT NULL');
    await addColIfMissing('bookings', 'payment_id', 'INT NULL');
    await addColIfMissing('bookings', 'paid_at', 'TIMESTAMP NULL');
    await addColIfMissing('bookings', 'confirmed_at', 'TIMESTAMP NULL');
    await addColIfMissing('bookings', 'cancelled_at', 'TIMESTAMP NULL');
    await addColIfMissing('bookings', 'expires_at', 'TIMESTAMP NULL');

    const [idxRows] = await conn.query(
      "SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND INDEX_NAME = 'idx_status_expires'"
    );
    if (idxRows[0].cnt === 0) {
      await conn.query('ALTER TABLE bookings ADD INDEX idx_status_expires (status, expires_at)');
      console.log('  bookings.idx_status_expires added');
    }

    await addColIfMissing('booking_seats', 'unit_price', 'INT DEFAULT 0');
    await addColIfMissing('tickets', 'payment_id', 'INT NULL');

    console.log('\n=== All migrations completed successfully! ===');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

migrateAll().then(() => process.exit(0)).catch(() => process.exit(1));
