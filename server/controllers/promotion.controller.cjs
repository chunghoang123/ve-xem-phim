const PromotionModel = require('../models/promotion.model.cjs');
const { success, error, paginated } = require('../utils/helpers.cjs');

const PromotionController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const result = await PromotionModel.findAll({ page, limit, search });
      return paginated(res, result.rows, result.total, page, limit);
    } catch {
      return error(res, 'Lỗi lấy danh sách khuyến mãi', 500);
    }
  },

  async getById(req, res) {
    try {
      const promo = await PromotionModel.findById(req.params.id);
      if (!promo) return error(res, 'Không tìm thấy khuyến mãi', 404);
      return success(res, promo);
    } catch {
      return error(res, 'Lỗi lấy chi tiết khuyến mãi', 500);
    }
  },

  async create(req, res) {
    try {
      const { title, discount } = req.body;
      if (!title || !discount) {
        return error(res, 'Vui lòng nhập tiêu đề và giảm giá', 400);
      }
      const promo = await PromotionModel.create(req.body);
      return success(res, promo, 'Thêm khuyến mãi thành công', 201);
    } catch {
      return error(res, 'Lỗi thêm khuyến mãi', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await PromotionModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy khuyến mãi', 404);

      const promo = await PromotionModel.update(req.params.id, req.body);
      return success(res, promo, 'Cập nhật khuyến mãi thành công');
    } catch {
      return error(res, 'Lỗi cập nhật khuyến mãi', 500);
    }
  },

  async delete(req, res) {
    try {
      const existing = await PromotionModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy khuyến mãi', 404);

      await PromotionModel.delete(req.params.id);
      return success(res, { id: parseInt(req.params.id) }, 'Xóa khuyến mãi thành công');
    } catch {
      return error(res, 'Lỗi xóa khuyến mãi', 500);
    }
  },
};

module.exports = PromotionController;
