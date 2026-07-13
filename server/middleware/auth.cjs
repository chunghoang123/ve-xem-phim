const jwt = require('jsonwebtoken');
require('dotenv').config();

const { JWT_SECRET, isBlacklisted } = require('../services/token.service.cjs');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized - Vui lòng đăng nhập' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'access' || await isBlacklisted(decoded.jti)) {
      return res.status(401).json({ success: false, message: 'Unauthorized - Token đã bị thu hồi' });
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Unauthorized - Token không hợp lệ hoặc đã hết hạn' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded.type === 'access' && !(await isBlacklisted(decoded.jti))) req.user = decoded;
    } catch {
      // ignore invalid token
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
