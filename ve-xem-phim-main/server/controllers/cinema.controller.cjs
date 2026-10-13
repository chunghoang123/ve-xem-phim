const CinemaModel = require('../models/cinema.model.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');
const { geocodeAddress } = require('../services/geo.service.cjs');
const { searchNearby, getPlaceDetails, getPlacePhoto } = require('../services/places.service.cjs');

const CinemaController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', city, district, brand } = req.query;
      const result = await CinemaModel.findAll({ page, limit, search, city, district, brand });
      return paginated(res, result.rows, result.total, page, limit);
    } catch {
      return error(res, 'Lỗi lấy danh sách rạp', 500);
    }
  },

  async getById(req, res) {
    try {
      const cinema = await CinemaModel.findById(req.params.id);
      if (!cinema) return error(res, 'Không tìm thấy rạp', 404);
      return success(res, cinema);
    } catch {
      return error(res, 'Lỗi lấy chi tiết rạp', 500);
    }
  },

  async getNearby(req, res) {
    try {
      const { lat, lng, radius = 50, limit = 20, brand, city } = req.query;
      const cinemas = await CinemaModel.findNearby({
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        radius: parseFloat(radius),
        limit: parseInt(limit),
        brand,
        city,
      });
      return success(res, cinemas);
    } catch {
      return error(res, 'Lỗi tìm rạp gần đây', 500);
    }
  },

  async getLocations(req, res) {
    try {
      const locations = await CinemaModel.getLocations();
      const brands = await CinemaModel.getBrands();
      return success(res, { locations, brands });
    } catch {
      return error(res, 'Lỗi lấy danh sách khu vực', 500);
    }
  },

  async searchNearbyPlaces(req, res) {
    try {
      const { lat, lng, radius = 50000, maxResults = 20, types } = req.query;
      if (!lat || !lng) {
        return error(res, 'Vui lòng cung cấp lat và lng', 400);
      }
      const typeArray = types ? types.split(',') : ['movie_theater'];
      const places = await searchNearby({
        lat: parseFloat(lat), lng: parseFloat(lng),
        radius: parseFloat(radius), maxResults: parseInt(maxResults),
        types: typeArray,
      });
      return success(res, places);
    } catch {
      return error(res, 'Lỗi tìm rạp qua Google Places', 500);
    }
  },

  async getPlaceDetails(req, res) {
    try {
      const { placeId } = req.params;
      if (!placeId) return error(res, 'Vui lòng cung cấp placeId', 400);
      const place = await getPlaceDetails(placeId);
      if (!place) return error(res, 'Không tìm thấy địa điểm', 404);
      return success(res, place);
    } catch {
      return error(res, 'Lỗi lấy chi tiết địa điểm', 500);
    }
  },

  async getPlacePhotoUrl(req, res) {
    try {
      const { photoName } = req.params;
      const { maxWidthPx = 400 } = req.query;
      if (!photoName) return error(res, 'Vui lòng cung cấp photoName', 400);
      const url = await getPlacePhoto(photoName, parseInt(maxWidthPx));
      if (!url) return error(res, 'Không tìm thấy ảnh', 404);
      return success(res, { url });
    } catch {
      return error(res, 'Lỗi lấy ảnh địa điểm', 500);
    }
  },

  async create(req, res) {
    try {
      const { name, address } = req.body;
      if (!name || !address) {
        return error(res, 'Vui lòng nhập tên rạp và địa chỉ', 400);
      }
      let data = { ...req.body };
      if (!data.lat || !data.lng) {
        const coords = await geocodeAddress(address);
        if (coords) { data.lat = coords.lat; data.lng = coords.lng; }
      }
      const cinema = await CinemaModel.create(data);
      return success(res, cinema, 'Thêm rạp thành công', 201);
    } catch {
      return error(res, 'Lỗi thêm rạp', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await CinemaModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy rạp', 404);

      let data = { ...req.body };
      if (data.address && data.address !== existing.address && !data.lat && !data.lng) {
        const coords = await geocodeAddress(data.address);
        if (coords) { data.lat = coords.lat; data.lng = coords.lng; }
      }

      const cinema = await CinemaModel.update(req.params.id, data);
      return success(res, cinema, 'Cập nhật rạp thành công');
    } catch {
      return error(res, 'Lỗi cập nhật rạp', 500);
    }
  },

  async delete(req, res) {
    try {
      const existing = await CinemaModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy rạp', 404);

      const hasShowtimes = await CinemaModel.hasShowtimes(req.params.id);
      if (hasShowtimes) {
        return error(res, 'Không thể xóa rạp đang có lịch chiếu', 409);
      }

      await CinemaModel.delete(req.params.id);
      return success(res, { id: parseInt(req.params.id) }, 'Xóa rạp thành công');
    } catch {
      return error(res, 'Lỗi xóa rạp', 500);
    }
  },
};

module.exports = CinemaController;
