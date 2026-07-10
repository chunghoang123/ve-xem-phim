const RoleModel = require('../models/role.model.cjs');
const { success, error } = require('../utils/helpers.cjs');

const RoleController = {
  async getAll(req, res) {
    try {
      const roles = await RoleModel.findAll();
      return success(res, roles);
    } catch {
      return error(res, 'Lỗi lấy danh sách vai trò', 500);
    }
  },

  async getById(req, res) {
    try {
      const role = await RoleModel.findById(req.params.id);
      if (!role) return error(res, 'Không tìm thấy vai trò', 404);
      return success(res, role);
    } catch {
      return error(res, 'Lỗi lấy chi tiết vai trò', 500);
    }
  },

  async create(req, res) {
    try {
      const { name } = req.body;
      if (!name) return error(res, 'Vui lòng nhập tên vai trò', 400);
      const role = await RoleModel.create(req.body);
      return success(res, role, 'Thêm vai trò thành công', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return error(res, 'Tên vai trò đã tồn tại', 409);
      }
      return error(res, 'Lỗi thêm vai trò', 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await RoleModel.findById(req.params.id);
      if (!existing) return error(res, 'Không tìm thấy vai trò', 404);

      const role = await RoleModel.update(req.params.id, req.body);
      return success(res, role, 'Cập nhật vai trò thành công');
    } catch {
      return error(res, 'Lỗi cập nhật vai trò', 500);
    }
  },

  async delete(req, res) {
    try {
      const result = await RoleModel.delete(req.params.id);
      if (result.affectedRows === 0) {
        return error(res, result.message || 'Không thể xóa vai trò', 409);
      }
      return success(res, { id: parseInt(req.params.id) }, 'Xóa vai trò thành công');
    } catch {
      return error(res, 'Lỗi xóa vai trò', 500);
    }
  },
};

module.exports = RoleController;
