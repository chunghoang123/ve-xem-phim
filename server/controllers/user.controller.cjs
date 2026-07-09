const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model.cjs');
const { success, error, paginated, validateEmail } = require('../utils/helpers.cjs');

const UserController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 10, search = '', sort_by: sortBy, sort_order: sortOrder } = req.query;
      const result = await UserModel.findAll({ page, limit, search, sortBy, sortOrder });
      return paginated(res, result.rows, result.total, page, limit);
    } catch (err) {
      return error(res, 'Lỗi lấy danh sách người dùng', 500);
    }
  },

  async getById(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return error(res, 'Không tìm thấy người dùng', 404);
      return success(res, user);
    } catch (err) {
      return error(res, 'Lỗi lấy chi tiết người dùng', 500);
    }
  },

  async create(req, res) {
    try {
      const { name, email, password, phone, role_id } = req.body;
      if (!name || !email || !password) {
        return error(res, 'Vui lòng nhập họ tên, email và mật khẩu', 400);
      }
      if (!validateEmail(email)) {
        return error(res, 'Email không hợp lệ', 400);
      }
      if (password.length < 6) {
        return error(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
      }

      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return error(res, 'Email đã được sử dụng', 409);
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserModel.create({ name, email, password: hashedPassword, phone, role_id: role_id || 3 });
      return success(res, user, 'Thêm người dùng thành công', 201);
    } catch (err) {
      return error(res, 'Lỗi thêm người dùng', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await UserModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy người dùng', 404);

      const data = { ...req.body };
      if (data.email) {
        if (!validateEmail(data.email)) return error(res, 'Email không hợp lệ', 400);
        const dup = await UserModel.findByEmail(data.email);
        if (dup && dup.id !== parseInt(req.params.id)) {
          return error(res, 'Email đã được sử dụng', 409);
        }
      }
      if (data.password) {
        if (data.password.length < 6) return error(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);
        data.password = await bcrypt.hash(data.password, 10);
      }

      const user = await UserModel.update(req.params.id, data);
      return success(res, user, 'Cập nhật người dùng thành công');
    } catch (err) {
      return error(res, 'Lỗi cập nhật người dùng', 500);
    }
  },

  async delete(req, res) {
    try {
      if (parseInt(req.params.id) === req.user.userId) {
        return error(res, 'Không thể xóa tài khoản của chính mình', 400);
      }

      const existing = await UserModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy người dùng', 404);

      await UserModel.delete(req.params.id);
      return success(res, { id: parseInt(req.params.id) }, 'Xóa người dùng thành công');
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2') {
        return error(res, 'Không thể xóa người dùng đang có dữ liệu liên quan', 409);
      }
      return error(res, 'Lỗi xóa người dùng', 500);
    }
  },
};

module.exports = UserController;
