const pool = require('../config/database.cjs');
const { execSync } = require('child_process');
require('dotenv').config();

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p';
const TMDB_KEY = process.env.TMDB_API_KEY;
const _VIETNAM_REGION = 'country:VN';
const LANGUAGE = 'vi-VN';

const GENRE_MAP = {
  28: 'Hành động', 12: 'Phiêu lưu', 16: 'Hoạt hình', 35: 'Hài hước',
  80: 'Hình sự', 99: 'Tài liệu', 18: 'Chính kịch', 10751: 'Gia đình',
  14: 'Kỳ ảo', 36: 'Lịch sử', 27: 'Kinh dị', 10402: 'Âm nhạc',
  9648: 'Bí ẩn', 10749: 'Lãng mạn', 878: 'Khoa học viễn tưởng',
  10770: 'TV Movie', 53: 'Giật gân', 10752: 'Chiến tranh', 37: 'Miền Tây'
};

async function fetchTMDB(endpoint, params = {}) {
  if (!TMDB_KEY) {
    throw new Error('TMDB_API_KEY chưa được cấu hình trong .env');
  }
  const qs = new URLSearchParams({ api_key: TMDB_KEY, language: LANGUAGE, region: 'VN', ...params });
  const url = `${TMDB_BASE}${endpoint}?${qs}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
      return res.json();
    } catch (err) {
      const code = err.cause?.code || err.message || '';
      if (code === 'ECONNRESET' && attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      // Final fallback: use curl.exe
      try {
        const stdout = execSync(`curl.exe -s --max-time 15 "${url}"`, { encoding: 'utf8', timeout: 20000 });
        return JSON.parse(stdout);
      } catch {
        throw new Error('Không thể kết nối TMDB: ' + (err.cause?.code || err.message));
      }
    }
  }
}

function mapRating(adult, voteAverage) {
  if (adult) return 'T18';
  if (voteAverage >= 7) return 'T13';
  return 'P';
}

function mapGenres(genreIds) {
  return genreIds.map(id => GENRE_MAP[id]).filter(Boolean).join(', ') || 'Khác';
}

async function syncMovies(listType = 'now_playing', page = 1) {
  const endpoint = listType === 'now_playing' ? '/movie/now_playing'
    : listType === 'popular' ? '/movie/popular'
    : listType === 'upcoming' ? '/movie/upcoming'
    : '/movie/top_rated';

  const data = await fetchTMDB(endpoint, { page, region: 'VN' });
  const results = data.results || [];

  let synced = 0;
  for (const item of results) {
    try {
    const exists = await findExisting(item.id);
    if (exists) {
      await pool.query(
        `UPDATE movies SET popularity = ?, status = ? WHERE tmdb_id = ?`,
        [item.popularity || 0, listType === 'upcoming' ? 'inactive' : 'active', item.id]
      );
      continue;
    }

    const detail = await fetchTMDB(`/movie/${item.id}`, { append_to_response: 'videos' });
    const trailer = (detail.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');

    await pool.query(
      `INSERT INTO movies (tmdb_id, title, genre, duration, rating, poster, backdrop, director, cast, description, release_date, ticket_price, vip_price, popularity, trailer_url, language, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        mapGenres(item.genre_ids || []),
        item.adult ? 120 : 90,
        mapRating(item.adult, item.vote_average),
        item.poster_path ? `${TMDB_IMAGE}/w500${item.poster_path}` : null,
        item.backdrop_path ? `${TMDB_IMAGE}/original${item.backdrop_path}` : null,
        'Đang cập nhật',
        'Đang cập nhật',
        item.overview || 'Đang cập nhật',
        item.release_date || null,
        75000,
        120000,
        item.popularity || 0,
        trailer ? `https://youtube.com/watch?v=${trailer.key}` : null,
        item.original_language || 'en',
        listType === 'upcoming' ? 'inactive' : 'active'
      ]
    );
    synced++;
    } catch (err) {
      console.error(`Sync error for movie ${item.id}:`, err.message);
    }
  }
  return synced;
}

async function findExisting(tmdbId) {
  const [rows] = await pool.query('SELECT id FROM movies WHERE tmdb_id = ?', [tmdbId]);
  return rows[0] || null;
}

async function getTrendingMovies(page = 1) {
  const data = await fetchTMDB('/trending/movie/week', { page });
  const results = data.results || [];
  return results.map(item => ({
    id: item.id,
    title: item.title,
    overview: item.overview,
    description: item.overview,
    poster: item.poster_path ? `${TMDB_IMAGE}/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `${TMDB_IMAGE}/original${item.backdrop_path}` : null,
    release_date: item.release_date,
    vote_average: item.vote_average,
    vote_count: item.vote_count,
    genre_ids: item.genre_ids || [],
    genres: mapGenres(item.genre_ids || []),
    genre: mapGenres(item.genre_ids || []),
    popularity: item.popularity,
    original_language: item.original_language,
    adult: item.adult,
    duration: item.adult ? 120 : 90,
    rating: mapRating(item.adult, item.vote_average),
    trailer_url: null,
    ticket_price: 75000,
    vip_price: 120000,
  }));
}

async function searchMovieByTitle(title, page = 1) {
  const data = await fetchTMDB('/search/movie', { query: title, page, region: 'VN' });
  return (data.results || []).map(item => ({
    tmdbId: item.id,
    title: item.title,
    overview: item.overview || '',
    poster: item.poster_path ? `${TMDB_IMAGE}/w500${item.poster_path}` : null,
    backdrop: item.backdrop_path ? `${TMDB_IMAGE}/original${item.backdrop_path}` : null,
    releaseDate: item.release_date,
    voteAverage: item.vote_average,
    genreIds: item.genre_ids || [],
    genres: mapGenres(item.genre_ids || []),
  }));
}

async function fetchMovieDetail(tmdbId) {
  const detail = await fetchTMDB(`/movie/${tmdbId}`, { append_to_response: 'videos,credits' });
  const trailer = (detail.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
  const director = (detail.credits?.crew || []).find(c => c.job === 'Director');
  const castList = (detail.credits?.cast || []).slice(0, 5).map(c => c.name).join(', ');
  return {
    tmdbId: detail.id,
    title: detail.title,
    genre: mapGenres(detail.genres?.map(g => g.id) || []),
    duration: detail.runtime || 120,
    rating: mapRating(detail.adult, detail.vote_average),
    poster: detail.poster_path ? `${TMDB_IMAGE}/w500${detail.poster_path}` : null,
    backdrop: detail.backdrop_path ? `${TMDB_IMAGE}/original${detail.backdrop_path}` : null,
    director: director?.name || 'Đang cập nhật',
    cast: castList || 'Đang cập nhật',
    description: detail.overview || 'Đang cập nhật',
    releaseDate: detail.release_date || null,
    trailerUrl: trailer ? `https://youtube.com/watch?v=${trailer.key}` : null,
    language: detail.original_language || 'en',
    popularity: detail.popularity || 0,
    voteAverage: detail.vote_average,
  };
}

async function enrichMovieFromTMDB(movieId) {
  const pool = require('../config/database.cjs');
  const [rows] = await pool.query('SELECT id, title, tmdb_id FROM movies WHERE id = ?', [movieId]);
  const movie = rows[0];
  if (!movie) throw new Error(`Movie ${movieId} not found`);

  let tmdbId = movie.tmdb_id;
  if (!tmdbId) {
    const results = await searchMovieByTitle(movie.title);
    if (results.length === 0) return null;
    tmdbId = results[0].tmdbId;
  }
  const detail = await fetchMovieDetail(tmdbId);

  await pool.query(
    `UPDATE movies SET
      tmdb_id = ?, genre = COALESCE(NULLIF(genre, ''), ?),
      duration = ?, rating = ?, poster = ?, backdrop = ?,
      director = ?, cast = ?, description = ?,
      release_date = COALESCE(NULLIF(release_date, ''), ?),
      trailer_url = ?, popularity = ?, language = ?
     WHERE id = ?`,
    [
      detail.tmdbId, detail.genre,
      detail.duration, detail.rating, detail.poster, detail.backdrop,
      detail.director, detail.cast, detail.description,
      detail.releaseDate, detail.trailerUrl, detail.popularity, detail.language,
      movie.id
    ]
  );

  return { ...detail, id: movie.id };
}

async function enrichAllMovies() {
  const pool = require('../config/database.cjs');
  const [rows] = await pool.query(
    `SELECT id, title FROM movies
     WHERE poster IS NULL OR poster LIKE '%placehold.co%' OR poster LIKE '%picsum.photos%'
        OR trailer_url IS NULL OR tmdb_id IS NULL`
  );
  const results = [];
  for (const movie of rows) {
    try {
      const result = await enrichMovieFromTMDB(movie.id);
      if (result) results.push({ id: movie.id, title: movie.title, success: true });
      else results.push({ id: movie.id, title: movie.title, success: false, reason: 'Not found on TMDB' });
    } catch (err) {
      results.push({ id: movie.id, title: movie.title, success: false, reason: err.message });
    }
  }
  return results;
}

async function addMovieFromTMDB(tmdbId) {
  const detail = await fetchMovieDetail(tmdbId);
  const [result] = await pool.query(
    `INSERT INTO movies (tmdb_id, title, genre, duration, rating, poster, backdrop, director, cast, description, release_date, ticket_price, vip_price, popularity, trailer_url, language, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    [
      detail.tmdbId, detail.title, detail.genre, detail.duration, detail.rating,
      detail.poster, detail.backdrop, detail.director, detail.cast, detail.description,
      detail.releaseDate, 75000, 120000, detail.popularity, detail.trailerUrl, detail.language
    ]
  );
  return { id: result.insertId, ...detail };
}

module.exports = { syncMovies, fetchTMDB, TMDB_IMAGE, getTrendingMovies, searchMovieByTitle, fetchMovieDetail, enrichMovieFromTMDB, enrichAllMovies, addMovieFromTMDB };
