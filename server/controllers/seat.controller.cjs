const SeatModel = require('../models/seat.model.cjs');
const BookingModel = require('../models/booking.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const SeatController = {
  async getLayout(req, res) {
    try {
      const layout = await SeatModel.getLayout(req.params.showtimeId);
      return success(res, layout);
    } catch (err) {
      return error(res, 'Lỗi lấy sơ đồ ghế', 500);
    }
  },

  async book(req, res) {
    try {
      const { showtime_id, seats } = req.body;
      if (!showtime_id || !seats || !Array.isArray(seats) || seats.length === 0) {
        return error(res, 'Vui lòng chọn ghế', 400);
      }

      const ShowtimeModel = require('../models/showtime.model.cjs');
      const showtime = await ShowtimeModel.findById(showtime_id);
      if (!showtime) return error(res, 'Suất chiếu không tồn tại', 404);

      const total = seats.length * showtime.ticket_price;

      const booking = await BookingModel.create({
        user_id: req.user.userId,
        showtime_id,
        seats,
        total,
        payment_method: req.body.payment_method || 'cash',
      });

      const affected = await SeatModel.bookSeats(showtime_id, seats, booking.id);

      if (affected === 0) {
        await BookingModel.cancel(booking.id);
        return error(res, 'Ghế đã được đặt trước đó, vui lòng chọn ghế khác', 409);
      }

      return success(res, { ...booking, seats_booked: affected }, 'Đặt vé thành công', 201);
    } catch (err) {
      return error(res, 'Lỗi đặt vé', 500);
    }
  },

  async reset(req, res) {
    try {
      await SeatModel.resetShowtime(req.params.showtimeId);
      return success(res, null, 'Reset ghế thành công');
    } catch (err) {
      return error(res, 'Lỗi reset ghế', 500);
    }
  },
};

module.exports = SeatController;
