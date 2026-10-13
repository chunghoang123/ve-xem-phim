const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/database.cjs');

const replaceExisting = process.argv.includes('--replace');
const sourceArgument = process.argv.slice(2).find(arg => arg !== '--replace');
const sourcePath = path.resolve(sourceArgument || 'D:/Downloads/cinema_seed_postgres.sql');

function decodeSqlString(value) {
  if (value === 'NULL') return null;
  if (!value.startsWith("'")) return Number(value);
  return value.slice(1, -1).replace(/''/g, "'");
}

function parseTuples(sql, table) {
  const marker = `INSERT INTO ${table} `;
  const rows = [];
  let cursor = 0;
  while ((cursor = sql.indexOf(marker, cursor)) !== -1) {
    const valuesAt = sql.indexOf('VALUES', cursor + marker.length);
    const end = sql.indexOf(';', valuesAt);
    const body = sql.slice(valuesAt + 6, end);
    let tuple = [];
    let token = '';
    let quoted = false;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (quoted) {
        token += ch;
        if (ch === "'" && body[i + 1] === "'") token += body[++i];
        else if (ch === "'") quoted = false;
      } else if (ch === "'") {
        quoted = true;
        token += ch;
      } else if (ch === '(') {
        tuple = [];
        token = '';
      } else if (ch === ',' || ch === ')') {
        if (token.trim()) tuple.push(decodeSqlString(token.trim()));
        token = '';
        if (ch === ')' && tuple.length) rows.push(tuple);
      } else {
        token += ch;
      }
    }
    cursor = end + 1;
  }
  return rows;
}

async function insertBatches(conn, sql, rows, size = 1000) {
  for (let i = 0; i < rows.length; i += size) {
    await conn.query(sql, [rows.slice(i, i + size)]);
  }
}

async function run() {
  if (!fs.existsSync(sourcePath)) throw new Error(`Không tìm thấy file: ${sourcePath}`);
  const sql = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const provinces = parseTuples(sql, 'province');
  const brands = parseTuples(sql, 'cinema_brand');
  const cinemas = parseTuples(sql, 'cinema');
  const rooms = parseTuples(sql, 'room');
  const seats = parseTuples(sql, 'seat');

  if (provinces.length !== 54 || brands.length !== 13 || cinemas.length !== 221 || rooms.length !== 1121 || seats.length !== 44649) {
    throw new Error(`Dữ liệu không đủ: ${provinces.length} tỉnh, ${brands.length} hãng, ${cinemas.length} rạp, ${rooms.length} phòng, ${seats.length} ghế`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`CREATE TABLE IF NOT EXISTS screen_seats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      screen_id INT NOT NULL,
      row_label VARCHAR(5) NOT NULL,
      seat_number INT NOT NULL,
      seat_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
      FOREIGN KEY (screen_id) REFERENCES screens(id) ON DELETE CASCADE,
      UNIQUE KEY uk_screen_seat (screen_id, row_label, seat_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    if (replaceExisting) {
      // Booking data depends on showtimes, seats, screens and cinemas. Clear it in
      // dependency order so the imported dataset becomes the only cinema dataset.
      await conn.query('UPDATE bookings SET bill_id = NULL');
      await conn.query('UPDATE seats SET booking_id = NULL');
      for (const table of [
        'tickets', 'payments', 'seat_hold_seats', 'booking_seats', 'bills',
        'bookings', 'seat_holds', 'seats', 'showtimes', 'screen_seats',
        'screens', 'cinemas', 'provinces',
      ]) {
        await conn.query(`DELETE FROM ${table}`);
      }
    }
    for (const [, code, name] of provinces) {
      await conn.query(
        `INSERT INTO provinces (code, name, region, latitude, longitude) VALUES (?, ?, 'Việt Nam', 0, 0)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [code, name]
      );
    }
    const [provinceRows] = await conn.query('SELECT id, code FROM provinces');
    const provinceIds = new Map(provinceRows.map(row => [row.code, row.id]));
    const provinceBySourceId = new Map(provinces.map(([id, code]) => [id, provinceIds.get(code)]));
    const brandBySourceId = new Map(brands.map(([id, , name]) => [id, name]));
    const provinceNameBySourceId = new Map(provinces.map(([id, , name]) => [id, name]));

    const cinemaIds = new Map();
    for (const [sourceId, name, brandId, provinceId, address] of cinemas) {
      const brand = brandBySourceId.get(brandId);
      const city = provinceNameBySourceId.get(provinceId);
      await conn.query(
        `INSERT INTO cinemas (province_id, name, address, city, region, brand)
         VALUES (?, ?, ?, ?, 'Việt Nam', ?)
         ON DUPLICATE KEY UPDATE province_id=VALUES(province_id), city=VALUES(city), brand=VALUES(brand)`,
        [provinceBySourceId.get(provinceId), name, address, city, brand]
      );
      const [[row]] = await conn.query('SELECT id FROM cinemas WHERE brand=? AND name=? AND address=? LIMIT 1', [brand, name, address]);
      cinemaIds.set(sourceId, row.id);
    }

    const screenIds = new Map();
    for (const [sourceId, cinemaSourceId, name, seatCount] of rooms) {
      const cinemaId = cinemaIds.get(cinemaSourceId);
      await conn.query(
        `INSERT INTO screens (cinema_id, name, capacity, format) VALUES (?, ?, ?, '2D')
         ON DUPLICATE KEY UPDATE capacity=VALUES(capacity)`,
        [cinemaId, name, seatCount]
      );
      const [[row]] = await conn.query('SELECT id FROM screens WHERE cinema_id=? AND name=? LIMIT 1', [cinemaId, name]);
      screenIds.set(sourceId, row.id);
    }

    const importedScreenIds = [...screenIds.values()];
    for (let i = 0; i < importedScreenIds.length; i += 500) {
      await conn.query('DELETE FROM screen_seats WHERE screen_id IN (?)', [importedScreenIds.slice(i, i + 500)]);
    }
    const seatRows = seats.map(([, roomId, row, number, type]) => [screenIds.get(roomId), row, number, type]);
    await insertBatches(conn, 'INSERT INTO screen_seats (screen_id, row_label, seat_number, seat_type) VALUES ?', seatRows);
    await conn.commit();
    console.log(`Đã cập nhật ${provinces.length} tỉnh/thành, ${cinemas.length} rạp, ${rooms.length} phòng và ${seats.length} ghế.`);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
