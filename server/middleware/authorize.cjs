function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Vui lòng đăng nhập' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden - Bạn không có quyền thực hiện hành động này' });
    }
    next();
  };
}

module.exports = authorize;
