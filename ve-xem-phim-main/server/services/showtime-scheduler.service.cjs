const pool = require('../config/database.cjs');

async function updateTmdbMovieStatuses() {
  const [result] = await pool.query(`
    UPDATE movies
    SET status = CASE
      WHEN release_date IS NOT NULL AND release_date > CURDATE() THEN 'inactive'
      ELSE 'active'
    END
    WHERE tmdb_id IS NOT NULL
  `);
  return result.affectedRows;
}

async function reassignShowtimes(movie, protectedMovieIds, daysAhead) {
  const excludedIds = protectedMovieIds.length ? protectedMovieIds : [movie.id];
  const placeholders = excludedIds.map(() => '?').join(', ');
  const [candidates] = await pool.query(`
    WITH ranked AS (
      SELECT s.id, s.cinema_id, s.date,
        ROW_NUMBER() OVER (
          PARTITION BY s.cinema_id, s.date
          ORDER BY CRC32(CONCAT(s.id, ?))
        ) AS position_in_day
      FROM showtimes s
      WHERE s.movie_id NOT IN (${placeholders})
        AND s.screen_id IS NOT NULL
        AND COALESCE(s.status, 'AVAILABLE') = 'AVAILABLE'
        AND COALESCE(TIMESTAMPDIFF(MINUTE, s.start_time, s.end_time), 120) >= ?
        AND TIMESTAMP(s.date, s.time) > NOW()
        AND s.date BETWEEN GREATEST(CURDATE(), COALESCE(?, CURDATE()))
          AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.showtime_id = s.id)
        AND NOT EXISTS (SELECT 1 FROM seats st WHERE st.showtime_id = s.id)
        AND NOT EXISTS (
          SELECT 1 FROM seat_holds sh
          WHERE sh.showtime_id = s.id AND sh.status = 'ACTIVE'
        )
    )
    SELECT id FROM ranked WHERE position_in_day = 1
  `, [movie.id, ...excludedIds, Number(movie.duration) || 120, movie.release_date, daysAhead - 1]);

  let updated = 0;
  for (let offset = 0; offset < candidates.length; offset += 500) {
    const ids = candidates.slice(offset, offset + 500).map(row => row.id);
    if (!ids.length) continue;
    const marks = ids.map(() => '?').join(', ');
    const [result] = await pool.query(`
      UPDATE showtimes
      SET movie_id = ?,
          end_time = ADDTIME(start_time, SEC_TO_TIME(? * 60)),
          price = CASE
            WHEN format = 'IMAX' THEN GREATEST(120000, ?)
            WHEN format = '3D' THEN GREATEST(90000, ?)
            ELSE ?
          END
      WHERE id IN (${marks})
    `, [
      movie.id,
      Number(movie.duration) || 120,
      Number(movie.ticket_price) || 75000,
      Number(movie.ticket_price) || 75000,
      Number(movie.ticket_price) || 75000,
      ...ids,
    ]);
    updated += result.affectedRows;
  }
  return updated;
}

async function ensureShowtimesForNewMovies(options = {}) {
  const daysAhead = Math.max(1, Math.min(30, Number(options.daysAhead) || 7));
  const movieLimit = Math.max(1, Math.min(20, Number(options.movieLimit) || 20));

  await updateTmdbMovieStatuses();
  const [movies] = await pool.query(`
    SELECT m.id, m.title, m.duration, m.ticket_price, m.release_date
    FROM movies m
    WHERE m.release_date IS NOT NULL
      AND m.release_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      AND m.release_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
      AND NOT EXISTS (
        SELECT 1 FROM showtimes s
        WHERE s.movie_id = m.id
          AND TIMESTAMP(s.date, s.time) > NOW()
          AND COALESCE(s.status, 'AVAILABLE') = 'AVAILABLE'
      )
    ORDER BY
      CASE WHEN m.release_date <= CURDATE() THEN 0 ELSE 1 END,
      CASE WHEN m.release_date <= CURDATE() THEN m.release_date END DESC,
      CASE WHEN m.release_date > CURDATE() THEN m.release_date END ASC,
      m.popularity DESC
    LIMIT ?
  `, [daysAhead - 1, movieLimit]);

  const protectedMovieIds = movies.map(movie => movie.id);
  const results = [];
  for (const movie of movies) {
    const created = await reassignShowtimes(movie, protectedMovieIds, daysAhead);
    results.push({ movieId: movie.id, title: movie.title, created });
  }
  return results;
}

module.exports = { ensureShowtimesForNewMovies, updateTmdbMovieStatuses };
