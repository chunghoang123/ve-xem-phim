const pool = require('../config/database.cjs');
const { fetchTMDB, searchMovieByTitle } = require('../services/tmdb.service.cjs');

async function fetchAllTrailers() {
  console.log('Đang lấy danh sách phim từ database...');
  const [rows] = await pool.query('SELECT id, title, tmdb_id, trailer_url FROM movies');

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const movie of rows) {
    if (movie.trailer_url) {
      skipped++;
      continue;
    }

    try {
      let tmdbId = movie.tmdb_id;

      if (!tmdbId) {
        const results = await searchMovieByTitle(movie.title);
        if (results.length === 0) {
          console.log(`  Không tìm thấy "${movie.title}" trên TMDB`);
          notFound++;
          continue;
        }
        tmdbId = results[0].tmdbId;
      }

      const detail = await fetchTMDB(`/movie/${tmdbId}`, { append_to_response: 'videos' });
      const trailer = (detail.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
      const trailerUrl = trailer ? `https://youtube.com/watch?v=${trailer.key}` : null;

      await pool.query(
        'UPDATE movies SET tmdb_id = ?, trailer_url = ? WHERE id = ?',
        [tmdbId, trailerUrl, movie.id]
      );

      if (trailerUrl) {
        console.log(`  [OK] "${movie.title}" -> trailer: ${trailerUrl}`);
        updated++;
      } else {
        console.log(`  [--] "${movie.title}" -> không có trailer trên TMDB`);
        skipped++;
      }
    } catch (err) {
      console.error(`  [ERR] "${movie.title}": ${err.message}`);
      notFound++;
    }
  }

  console.log(`\nHoàn tất!`);
  console.log(`  - Đã cập nhật trailer: ${updated}`);
  console.log(`  - Không có trailer: ${skipped}`);
  console.log(`  - Lỗi/không tìm thấy: ${notFound}`);
  process.exit(0);
}

fetchAllTrailers().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
