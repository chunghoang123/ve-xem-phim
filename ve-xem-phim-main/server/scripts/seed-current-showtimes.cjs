const pool = require('../config/database.cjs');

const DAYS_AHEAD = 7;
const BATCH_SIZE = 1000;
const OPENING_MINUTE = 8 * 60;
const CLOSING_MINUTE = 23 * 60 + 30;
const CLEANUP_MINUTES = 30;

function addDays(date, days) {
  const result = new Date(`${date}T00:00:00+07:00`);
  result.setDate(result.getDate() + days);
  return result.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function addMinutes(date, time, minutes) {
  const value = new Date(`${date}T${time}:00+07:00`);
  value.setMinutes(value.getMinutes() + minutes);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function minuteToTime(minute) {
  const hour = Math.floor(minute / 60).toString().padStart(2, '0');
  const value = (minute % 60).toString().padStart(2, '0');
  return `${hour}:${value}`;
}

async function insertBatches(conn, rows) {
  const statement = `INSERT INTO showtimes
    (movie_id, cinema_id, screen_id, date, time, start_time, end_time, format, language, price, status)
    VALUES ?`;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await conn.query(statement, [rows.slice(i, i + BATCH_SIZE)]);
  }
}

async function run() {
  const conn = await pool.getConnection();
  try {
    const [[clock]] = await conn.query(
      'SELECT DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 DAY), "%Y-%m-%d") AS start_date'
    );
    const [movies] = await conn.query(
      `SELECT id, COALESCE(NULLIF(duration, 0), 120) AS duration,
              COALESCE(NULLIF(ticket_price, 0), 75000) AS ticket_price
       FROM movies WHERE status = 'active' ORDER BY id`
    );
    const [screens] = await conn.query(
      `SELECT sc.id, sc.cinema_id, COALESCE(NULLIF(sc.format, ''), '2D') AS format
       FROM screens sc JOIN cinemas c ON c.id = sc.cinema_id
       ORDER BY sc.cinema_id, sc.id`
    );
    if (movies.length === 0) throw new Error('Không có phim đang hoạt động để tạo lịch chiếu.');
    if (screens.length === 0) throw new Error('Không có phòng chiếu để tạo lịch.');

    const [[bookingCount]] = await conn.query('SELECT COUNT(*) AS total FROM bookings');
    if (Number(bookingCount.total) > 0) {
      throw new Error('Đang có đơn đặt vé; không thể tạo lại toàn bộ lịch chiếu.');
    }

    const rows = [];
    for (let day = 0; day < DAYS_AHEAD; day++) {
      const date = addDays(clock.start_date, day);
      for (let screenIndex = 0; screenIndex < screens.length; screenIndex++) {
        const screen = screens[screenIndex];
        let startMinute = OPENING_MINUTE;
        let slotIndex = 0;
        while (startMinute < CLOSING_MINUTE) {
          const movie = movies[(screenIndex + slotIndex + day) % movies.length];
          const duration = Number(movie.duration);
          if (startMinute + duration > CLOSING_MINUTE) break;
          const time = minuteToTime(startMinute);
          const format = screen.format;
          const price = format === 'IMAX' ? 120000 : format === '3D' ? 90000 : Number(movie.ticket_price);
          rows.push([
            movie.id, screen.cinema_id, screen.id, date, time,
            `${date} ${time}:00`, addMinutes(date, time, duration),
            format, (screenIndex + slotIndex) % 3 === 0 ? 'Lồng tiếng' : 'Phụ đề',
            price, 'AVAILABLE',
          ]);
          startMinute += duration + CLEANUP_MINUTES;
          slotIndex++;
        }
      }
    }

    await conn.beginTransaction();
    await conn.query('DELETE FROM seats');
    await conn.query('DELETE FROM showtimes');
    await insertBatches(conn, rows);
    await conn.commit();
    console.log(`Đã tạo ${rows.length} suất chiếu cho ${screens.length} phòng, từ ${clock.start_date} trong ${DAYS_AHEAD} ngày.`);
  } catch (error) {
    if (conn.connection._transaction) await conn.rollback().catch(() => {});
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
