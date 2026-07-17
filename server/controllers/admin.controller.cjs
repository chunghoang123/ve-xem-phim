const { syncMovies, fetchTMDB, TMDB_IMAGE, searchMovieByTitle, enrichMovieFromTMDB, enrichAllMovies, addMovieFromTMDB, fetchMovieDetail } = require('../services/tmdb.service.cjs');
const { success, error } = require('../utils/helpers.cjs');
const pool = require('../config/database.cjs');
const ShowtimeSchedulerService = require('../services/showtime-scheduler.service.cjs');

const AdminController = {
  async syncTMDB(req, res) {
    try {
      const { type = 'now_playing', pages = 1 } = req.body;
      let total = 0;
      for (let p = 1; p <= Math.min(pages, 5); p++) {
        total += await syncMovies(type, p);
      }
      const scheduledMovies = await ShowtimeSchedulerService.ensureShowtimesForNewMovies();
      const showtimes = scheduledMovies.reduce((sum, movie) => sum + movie.created, 0);
      return success(
        res,
        { synced: total, type, scheduled_movies: scheduledMovies.length, showtimes },
        `Đồng bộ ${total} phim và cập nhật ${showtimes} suất chiếu thành công`
      );
    } catch (err) {
      return error(res, err.message || 'Lỗi đồng bộ TMDB', 500);
    }
  },

  async fetchMovieFromTMDB(req, res) {
    try {
      const { tmdbId } = req.params;
      const detail = await fetchTMDB(`/movie/${tmdbId}`, { append_to_response: 'videos' });
      const trailer = (detail.videos?.results || []).find(v => v.type === 'Trailer' && v.site === 'YouTube');
      return success(res, {
        ...detail,
        poster_url: detail.poster_path ? `${TMDB_IMAGE}/w500${detail.poster_path}` : null,
        backdrop_url: detail.backdrop_path ? `${TMDB_IMAGE}/original${detail.backdrop_path}` : null,
        trailer_url: trailer ? `https://youtube.com/watch?v=${trailer.key}` : null,
      });
    } catch (err) {
      return error(res, err.message || 'Lỗi lấy thông tin phim từ TMDB', 500);
    }
  },

  async getSyncStatus(req, res) {
    try {
      const [tmdbCount] = await pool.query(
        'SELECT COUNT(*) as total FROM movies WHERE tmdb_id IS NOT NULL'
      );
      const [totalMovies] = await pool.query('SELECT COUNT(*) as total FROM movies');
      const [lastSync] = await pool.query(
        'SELECT MAX(updated_at) as last_sync FROM movies WHERE tmdb_id IS NOT NULL'
      );
      return success(res, {
        tmdb_movies: tmdbCount[0].total,
        total_movies: totalMovies[0].total,
        last_sync: lastSync[0].last_sync,
      });
    } catch {
      return error(res, 'Lỗi lấy trạng thái đồng bộ', 500);
    }
  },

  async searchTMDB(req, res) {
    try {
      const { query, page = 1 } = req.query;
      if (!query) return error(res, 'Vui lòng nhập từ khóa', 400);
      const results = await searchMovieByTitle(query, parseInt(page));
      return success(res, results);
    } catch (err) {
      return error(res, err.message || 'Lỗi tìm kiếm TMDB', 500);
    }
  },

  async enrichMovie(req, res) {
    try {
      const { id } = req.params;
      const result = await enrichMovieFromTMDB(id);
      if (!result) return error(res, 'Không tìm thấy phim trên TMDB', 404);
      return success(res, result, 'Cập nhật phim từ TMDB thành công');
    } catch (err) {
      return error(res, err.message || 'Lỗi cập nhật phim từ TMDB', 500);
    }
  },

  async enrichAllMovies(req, res) {
    try {
      const results = await enrichAllMovies();
      const succeeded = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      return success(res, results, `Đã cập nhật ${succeeded} phim, ${failed} phim không tìm thấy`);
    } catch (err) {
      return error(res, err.message || 'Lỗi cập nhật phim từ TMDB', 500);
    }
  },

  async addFromTMDB(req, res) {
    try {
      const { tmdbId } = req.body;
      if (!tmdbId) return error(res, 'Vui lòng cung cấp tmdbId', 400);
      const movie = await addMovieFromTMDB(tmdbId);
      await ShowtimeSchedulerService.ensureShowtimesForNewMovies();
      return success(res, movie, 'Thêm phim từ TMDB thành công', 201);
    } catch (err) {
      return error(res, err.message || 'Lỗi thêm phim từ TMDB', 500);
    }
  },

  async getTMDBMovieDetail(req, res) {
    try {
      const { tmdbId } = req.params;
      const detail = await fetchMovieDetail(tmdbId);
      return success(res, detail);
    } catch (err) {
      return error(res, err.message || 'Lỗi lấy chi tiết phim từ TMDB', 500);
    }
  },
};

module.exports = AdminController;
