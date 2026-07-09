const ShowtimeModel = require('../models/showtime.model.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');

const ShowtimeController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, movie_id, cinema_id, date, province_id, city, brand } = req.query;
      const result = await ShowtimeModel.findAll({ page, limit, movie_id, cinema_id, date, province_id, city, brand });
      return paginated(res, result.rows, result.total, page, limit);
    } catch (err) {
      return error(res, 'Lỗi lấy danh sách lịch chiếu', 500);
    }
  },

  async getById(req, res) {
    try {
      const showtime = await ShowtimeModel.findById(req.params.id);
      if (!showtime) return error(res, 'Không tìm thấy lịch chiếu', 404);
      return success(res, showtime);
    } catch (err) {
      return error(res, 'Lỗi lấy chi tiết lịch chiếu', 500);
    }
  },

  async create(req, res) {
    try {
      const { movie_id, date, time } = req.body;
      if (!movie_id || !date || !time) {
        return error(res, 'Vui lòng nhập phim, ngày và giờ chiếu', 400);
      }

      const MovieModel = require('../models/movie.model.cjs');
      const movie = await MovieModel.findById(movie_id);
      if (!movie) return error(res, 'Phim không tồn tại', 404);

      const showtime = await ShowtimeModel.create(req.body);
      return success(res, showtime, 'Thêm lịch chiếu thành công', 201);
    } catch (err) {
      return error(res, 'Lỗi thêm lịch chiếu', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await ShowtimeModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy lịch chiếu', 404);

      const showtime = await ShowtimeModel.update(req.params.id, req.body);
      return success(res, showtime, 'Cập nhật lịch chiếu thành công');
    } catch (err) {
      return error(res, 'Lỗi cập nhật lịch chiếu', 500);
    }
  },

  async delete(req, res) {
    try {
      const existing = await ShowtimeModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy lịch chiếu', 404);

      const hasBookings = await ShowtimeModel.hasBookings(req.params.id);
      if (hasBookings) {
        return error(res, 'Không thể xóa lịch chiếu đã có vé đặt', 409);
      }

      await ShowtimeModel.delete(req.params.id);
      return success(res, { id: parseInt(req.params.id) }, 'Xóa lịch chiếu thành công');
    } catch (err) {
      return error(res, 'Lỗi xóa lịch chiếu', 500);
    }
  },

  async getByMovieGrouped(req, res) {
    try {
      const movieId = req.params.id;
      const MovieModel = require('../models/movie.model.cjs');
      const movie = await MovieModel.findById(movieId);
      if (!movie) return error(res, 'Không tìm thấy phim', 404);

      const { province_id, city, brand, date } = req.query;
      const rows = await ShowtimeModel.findByMovieGrouped(movieId, { province_id, city, brand, date });

      const citiesMap = {};

      for (const r of rows) {
        const cityKey = r.city;
        if (!citiesMap[cityKey]) citiesMap[cityKey] = { city: cityKey, districts: {} };

        const distKey = r.district;
        if (!citiesMap[cityKey].districts[distKey]) {
          citiesMap[cityKey].districts[distKey] = { district: distKey, cinemas: {} };
        }

        const cinemaKey = r.cinema_id;
        const cinemas = citiesMap[cityKey].districts[distKey].cinemas;
        if (!cinemas[cinemaKey]) {
          cinemas[cinemaKey] = {
            cinemaId: r.cinema_id,
            cinemaName: r.cinema_name,
            address: r.cinema_address,
            dates: {},
          };
        }

        const dateKey = r.date;
        const dates = cinemas[cinemaKey].dates;
        if (!dates[dateKey]) dates[dateKey] = [];

        dates[dateKey].push({
          showtimeId: r.id,
          time: r.time,
          format: r.format,
          language: r.language,
          price: r.price,
        });
      }

      const cities = Object.values(citiesMap)
        .sort((a, b) => a.city.localeCompare(b.city, 'vi'))
        .map(city => ({
          ...city,
          districts: Object.values(city.districts)
            .sort((a, b) => a.district.localeCompare(b.district, 'vi'))
            .map(dist => ({
              ...dist,
              cinemas: Object.values(dist.cinemas)
                .sort((a, b) => a.cinemaName.localeCompare(b.cinemaName, 'vi'))
                .map(cinema => ({
                  cinemaId: cinema.cinemaId,
                  cinemaName: cinema.cinemaName,
                  address: cinema.address,
                  dates: Object.entries(cinema.dates)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, showtimes]) => ({
                      date,
                      showtimes: showtimes.sort((a, b) => a.time.localeCompare(b.time)),
                    })),
                })),
            })),
        }));

      return success(res, {
        movieId: movie.id,
        movieName: movie.title,
        poster: movie.poster,
        backdrop: movie.backdrop,
        duration: movie.duration,
        rating: movie.rating,
        genre: movie.genre,
        director: movie.director,
        cast: movie.cast,
        release_date: movie.release_date,
        ticket_price: movie.ticket_price,
        description: movie.description,
        trailer_url: movie.trailer_url,
        status: movie.status,
        cities,
      });
    } catch (err) {
      console.error('getByMovieGrouped error:', err);
      return error(res, 'Lỗi lấy lịch chiếu', 500);
    }
  },
};

module.exports = ShowtimeController;
