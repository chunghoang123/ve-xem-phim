const pool = require('../config/database.cjs');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    // Add screens table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS screens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        cinema_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        capacity INT NOT NULL DEFAULT 80,
        format VARCHAR(20) NOT NULL DEFAULT '2D',
        FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE
      )
    `);
    console.log('screens table OK');

    // Add showtimes columns
    const showtimeCols = [
      ['screen_id', 'INT DEFAULT NULL'],
      ['start_time', 'DATETIME DEFAULT NULL'],
      ['end_time', 'DATETIME DEFAULT NULL'],
      ['format', "VARCHAR(20) DEFAULT '2D'"],
      ['language', "VARCHAR(50) DEFAULT 'Phụ đề'"],
      ['price', 'INT DEFAULT 75000'],
      ['status', "VARCHAR(20) DEFAULT 'AVAILABLE'"],
    ];

    for (const [col, def] of showtimeCols) {
      try {
        await conn.query(`ALTER TABLE showtimes ADD COLUMN ${col} ${def}`);
        console.log(`  added showtimes.${col}`);
      } catch (err) {
        if (err.errno === 1060) {
          console.log(`  showtimes.${col} already exists`);
        } else {
          // Duplicate column; ignore
        }
      }
    }

    // Unique constraint on showtimes
    try {
      await conn.query('ALTER TABLE showtimes ADD CONSTRAINT uk_showtime_unique UNIQUE (movie_id, cinema_id, screen_id, start_time)');
      console.log('  showtimes unique constraint added');
    } catch (err) {
      if (err.errno === 1061) console.log('  showtimes unique constraint exists');
      else if (err.errno === 1062) console.log('  showtimes duplicate data exists; skipping constraint');
      else throw err;
    }

    // Unique constraint on cinemas
    try {
      await conn.query('ALTER TABLE cinemas ADD CONSTRAINT uk_cinema_unique UNIQUE (brand, name, address)');
      console.log('  cinemas unique constraint added');
    } catch (err) {
      if (err.errno === 1061) console.log('  cinemas unique constraint exists');
      else if (err.errno === 1062) console.log('  cinemas duplicate data exists; skipping constraint');
      else throw err;
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

migrate();
