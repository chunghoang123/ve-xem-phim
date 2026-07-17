const SeatModel = require('../models/seat.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const SeatController = {
  async getLayout(req, res) {
    try {
      const ShowtimeModel = require('../models/showtime.model.cjs');
      const showtime = await ShowtimeModel.findById(req.params.showtimeId);
      if (!showtime) return error(res, 'Suất chiếu không tồn tại', 404);
      if (!(await ShowtimeModel.isBookable(req.params.showtimeId))) {
        return error(res, 'Suất chiếu đã bắt đầu hoặc đã bị khóa', 409);
      }

      const layout = await SeatModel.getLayout(req.params.showtimeId);
      return success(res, layout);
    } catch {
      return error(res, 'Lỗi lấy sơ đồ ghế', 500);
    }
  },
};

module.exports = SeatController;
