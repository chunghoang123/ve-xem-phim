const pool = require('../config/database.cjs');
require('dotenv').config();

const YT_KEY = 'AIzaSyDX02xnv6IZCPOMv-zmrkmNYEqGLrLFI14';
const YT_BASE = 'https://www.googleapis.com/youtube/v3/search';

async function searchYouTubeTrailer(title) {
  const q = encodeURIComponent(`${title} trailer`);
  const url = `${YT_BASE}?part=snippet&q=${q}&key=${YT_KEY}&maxResults=1&type=video&relevanceLanguage=vi`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const video = data.items?.[0];
  if (!video) return null;
  return {
    videoId: video.id.videoId,
    title: video.snippet.title,
  };
}

async function fetchAllTrailers() {
  console.log('Đang lấy danh sách phim từ database...');
  const [rows] = await pool.query(
    'SELECT id, title, tmdb_id, trailer_url FROM movies WHERE trailer_url IS NULL'
  );

  let updated = 0;
  let notFound = 0;

  for (const movie of rows) {
    try {
      const result = await searchYouTubeTrailer(movie.title);
      if (result) {
        const trailerUrl = `https://youtube.com/watch?v=${result.videoId}`;
        await pool.query('UPDATE movies SET trailer_url = ? WHERE id = ?', [trailerUrl, movie.id]);
        console.log(`  [OK] "${movie.title}" -> ${trailerUrl}`);
        updated++;
      } else {
        console.log(`  [--] "${movie.title}" -> không tìm thấy trailer trên YouTube`);
        notFound++;
      }
    } catch (err) {
      console.error(`  [ERR] "${movie.title}": ${err.message}`);
      notFound++;
    }
  }

  console.log(`\nHoàn tất! Đã cập nhật: ${updated}, Không tìm thấy: ${notFound}`);
  process.exit(0);
}

fetchAllTrailers();
