function success(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function paginated(res, rows, total, page, limit) {
  return res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

function error(res, message = 'Internal Server Error', statusCode = 500) {
  return res.status(statusCode).json({ success: false, message });
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeLike(str) {
  return str.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

module.exports = { success, paginated, error, validateEmail, escapeLike };
