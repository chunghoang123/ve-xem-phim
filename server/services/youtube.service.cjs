const pool = require('../config/database.cjs');
require('dotenv').config();

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

function isConfigured() {
  return Boolean(YOUTUBE_API_KEY);
}

async function searchYouTubeTrailer(title, releaseDate = null) {
  if (!isConfigured()) return null;

  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const query = [title, year || '', 'official trailer'].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    key: YOUTUBE_API_KEY,
    maxResults: '5',
    type: 'video',
    order: 'relevance',
    videoEmbeddable: 'true',
    safeSearch: 'moderate',
    regionCode: 'VN',
    relevanceLanguage: 'vi',
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error(`YouTube API returned HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const videos = data.items || [];
  const video = videos.find(item => /official|trailer|teaser/i.test(item.snippet?.title || '')) || videos[0];
  if (!video?.id?.videoId) return null;

  return {
    videoId: video.id.videoId,
    title: video.snippet?.title || '',
    url: `https://youtube.com/watch?v=${video.id.videoId}`,
  };
}

async function updateMissingTrailers(limit = 50) {
  if (!isConfigured()) return { configured: false, checked: 0, updated: 0, notFound: 0 };

  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 50));
  const [movies] = await pool.query(
    `SELECT id, title, release_date
     FROM movies
     WHERE trailer_url IS NULL OR trailer_url = ''
     ORDER BY updated_at ASC
     LIMIT ?`,
    [safeLimit]
  );

  let checked = 0;
  let updated = 0;
  let notFound = 0;
  for (const movie of movies) {
    try {
      const trailer = await searchYouTubeTrailer(movie.title, movie.release_date);
      checked++;
      if (trailer) {
        await pool.query(
          'UPDATE movies SET trailer_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [trailer.url, movie.id]
        );
        updated++;
      } else {
        await pool.query('UPDATE movies SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [movie.id]);
        notFound++;
      }
    } catch (error) {
      console.error(`YouTube trailer lookup failed for "${movie.title}": ${error.message}`);
      if (error.status === 403 || error.status === 429) break;
      notFound++;
    }
  }

  return { configured: true, checked, updated, notFound };
}

module.exports = { isConfigured, searchYouTubeTrailer, updateMissingTrailers };
