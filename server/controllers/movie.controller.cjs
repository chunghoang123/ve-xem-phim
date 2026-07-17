const MovieModel = require('../models/movie.model.cjs');
const { getTrendingMovies } = require('../services/tmdb.service.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');

const MovieController = {
  async getHomeSections(req, res) {
    try {
      const sections = await MovieModel.findHomeSections({
        nowLimit: req.query.now_limit,
        upcomingLimit: req.query.upcoming_limit,
      });
      return success(res, sections);
    } catch (err) {
      console.error('Movie home sections error:', err);
      return error(res, 'Lỗi lấy phim trang chủ', 500);
    }
  },

  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', sort_by: sortBy, sort_order: sortOrder, status } = req.query;
      const result = await MovieModel.findAll({ page, limit, search, sortBy, sortOrder, status });
      return paginated(res, result.rows, result.total, page, limit);
    } catch (err) {
      console.error('Movie getAll error:', err);
      return error(res, 'Lỗi lấy danh sách phim', 500);
    }
  },

  async getById(req, res) {
    try {
      const movie = await MovieModel.findById(req.params.id);
      if (!movie) return error(res, 'Không tìm thấy phim', 404);

      const ShowtimeModel = require('../models/showtime.model.cjs');
      const dates = await ShowtimeModel.getDates(movie.id);
      movie.showtimes = dates;

      return success(res, movie);
    } catch {
      return error(res, 'Lỗi lấy chi tiết phim', 500);
    }
  },

  async create(req, res) {
    try {
      const { title, duration, ticketPrice, vipPrice } = req.body;
      if (!title || !duration || !ticketPrice) {
        return error(res, 'Vui lòng nhập tên phim, thời lượng và giá vé', 400);
      }
      if (duration <= 0 || ticketPrice <= 0 || (vipPrice && vipPrice <= 0)) {
        return error(res, 'Thời lượng và giá vé phải lớn hơn 0', 400);
      }

      const movie = await MovieModel.create(req.body);
      return success(res, movie, 'Thêm phim thành công', 201);
    } catch {
      return error(res, 'Lỗi thêm phim', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await MovieModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy phim', 404);

      const movie = await MovieModel.update(req.params.id, req.body);
      return success(res, movie, 'Cập nhật phim thành công');
    } catch {
      return error(res, 'Lỗi cập nhật phim', 500);
    }
  },

  async delete(req, res) {
    try {
      const existing = await MovieModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy phim', 404);

      const hasShowtimes = await MovieModel.hasShowtimes(req.params.id);
      if (hasShowtimes) {
        return error(res, 'Không thể xóa phim đang có lịch chiếu', 409);
      }

      await MovieModel.delete(req.params.id);
      return success(res, { id: parseInt(req.params.id) }, 'Xóa phim thành công');
    } catch {
      return error(res, 'Lỗi xóa phim', 500);
    }
  },

  async getAvailable(req, res) {
    try {
      const movies = await MovieModel.findAvailable();
      return success(res, movies);
    } catch {
      return error(res, 'Lỗi lấy danh sách phim đang chiếu', 500);
    }
  },

  async getHot(req, res) {
    try {
      const movies = await getTrendingMovies();
      return success(res, movies.slice(0, 5));
    } catch {
      return error(res, 'Lỗi lấy phim hot từ TMDB', 500);
    }
  },
};

module.exports = MovieController;
