CREATE DATABASE IF NOT EXISTS cinex DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cinex;
SET NAMES utf8mb4;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  auth_provider VARCHAR(20) DEFAULT NULL,
  social_id VARCHAR(255) DEFAULT NULL,
  role_id INT NOT NULL DEFAULT 2,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  UNIQUE INDEX idx_email (email),
  UNIQUE INDEX idx_phone (phone),
  UNIQUE INDEX idx_social (auth_provider, social_id)
) ENGINE=InnoDB;

-- Provinces
CREATE TABLE IF NOT EXISTS provinces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL
) ENGINE=InnoDB;

-- Cinemas
CREATE TABLE IF NOT EXISTS cinemas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  province_id INT DEFAULT NULL,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(500) NOT NULL,
  lat DECIMAL(10, 8) DEFAULT NULL,
  lng DECIMAL(11, 8) DEFAULT NULL,
  district VARCHAR(100) DEFAULT NULL,
  city VARCHAR(100) DEFAULT 'Hà Nội',
  region VARCHAR(50) DEFAULT NULL,
  brand VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cinemas_city_district (city, district),
  FOREIGN KEY (province_id) REFERENCES provinces(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Movies
CREATE TABLE IF NOT EXISTS movies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tmdb_id INT DEFAULT NULL,
  popularity DECIMAL(10, 2) DEFAULT 0,
  title VARCHAR(200) NOT NULL,
  genre VARCHAR(200) DEFAULT NULL,
  duration INT NOT NULL DEFAULT 0,
  rating VARCHAR(10) DEFAULT 'P',
  poster VARCHAR(500) DEFAULT NULL,
  backdrop VARCHAR(500) DEFAULT NULL,
  director VARCHAR(200) DEFAULT NULL,
  cast TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  release_date DATE DEFAULT NULL,
  ticket_price INT NOT NULL DEFAULT 0,
  vip_price INT NOT NULL DEFAULT 0,
  trailer_url VARCHAR(500) DEFAULT NULL,
  language VARCHAR(10) DEFAULT 'vi',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_movies_tmdb (tmdb_id),
  INDEX idx_movies_popularity (popularity)
) ENGINE=InnoDB;

-- Showtimes
CREATE TABLE IF NOT EXISTS showtimes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  movie_id INT NOT NULL,
  cinema_id INT NOT NULL DEFAULT 1,
  date DATE NOT NULL,
  time VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
  FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  showtime_id INT NOT NULL,
  seats_json TEXT NOT NULL,
  total INT NOT NULL DEFAULT 0,
  payment_method VARCHAR(50) DEFAULT 'cash',
  status VARCHAR(20) DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Seats (booked seats per showtime)
CREATE TABLE IF NOT EXISTS seats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  showtime_id INT NOT NULL,
  row_label VARCHAR(5) NOT NULL,
  seat_number INT NOT NULL,
  is_vip TINYINT(1) DEFAULT 0,
  is_booked TINYINT(1) DEFAULT 0,
  booking_id INT DEFAULT NULL,
  FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE CASCADE,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Promotions
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT DEFAULT NULL,
  discount VARCHAR(50) DEFAULT NULL,
  code VARCHAR(50) DEFAULT NULL,
  valid_until DATE DEFAULT NULL,
  color VARCHAR(20) DEFAULT 'purple',
  icon VARCHAR(50) DEFAULT 'Gift',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Email OTP verification
CREATE TABLE IF NOT EXISTS email_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  name VARCHAR(100) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_otp (otp)
) ENGINE=InnoDB;

-- Phone OTP verification
CREATE TABLE IF NOT EXISTS phone_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  name VARCHAR(100) DEFAULT NULL,
  password VARCHAR(255) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_otp (otp)
) ENGINE=InnoDB;

-- Migration for existing databases (MySQL 8.0+)
-- These ALTER statements handle upgrading from older schema versions
-- Commented out because CREATE TABLE already includes these columns
-- ALTER TABLE users MODIFY email VARCHAR(100) NULL;
-- ALTER TABLE users MODIFY password VARCHAR(255) NULL;
-- ALTER TABLE users ADD COLUMN auth_provider VARCHAR(20) DEFAULT NULL AFTER avatar;
-- ALTER TABLE users ADD COLUMN social_id VARCHAR(255) DEFAULT NULL AFTER auth_provider;
-- ALTER TABLE users ADD UNIQUE INDEX idx_phone (phone);
-- ALTER TABLE users ADD UNIQUE INDEX idx_social (auth_provider, social_id);
-- ALTER TABLE users ADD UNIQUE INDEX idx_email (email);

-- =====================
-- SEED DATA
-- =====================

-- Provinces (63 tỉnh/thành)
DELETE FROM provinces;
INSERT INTO provinces (id, code, name, region, latitude, longitude) VALUES
(1, 'HN', 'Hà Nội', 'Miền Bắc', 21.0285, 105.8542),
(2, 'HCM', 'TP. Hồ Chí Minh', 'Miền Nam', 10.7769, 106.7009),
(3, 'HP', 'Hải Phòng', 'Miền Bắc', 20.8449, 106.6881),
(4, 'DN', 'Đà Nẵng', 'Miền Trung', 16.0471, 108.2068),
(5, 'CT', 'Cần Thơ', 'Miền Nam', 10.0452, 105.7469),
(6, 'AG', 'An Giang', 'Miền Nam', 10.5216, 105.1259),
(7, 'BRVT', 'Bà Rịa - Vũng Tàu', 'Miền Nam', 10.5417, 107.2429),
(8, 'BG', 'Bắc Giang', 'Miền Bắc', 21.2731, 106.1946),
(9, 'BK', 'Bắc Kạn', 'Miền Bắc', 22.147, 105.8348),
(10, 'BL', 'Bạc Liêu', 'Miền Nam', 9.294, 105.7216),
(11, 'BN', 'Bắc Ninh', 'Miền Bắc', 21.1861, 106.0763),
(12, 'BTE', 'Bến Tre', 'Miền Nam', 10.2433, 106.3756),
(13, 'BDI', 'Bình Định', 'Miền Trung', 13.782, 109.219),
(14, 'BD', 'Bình Dương', 'Miền Nam', 10.9804, 106.6519),
(15, 'BP', 'Bình Phước', 'Miền Nam', 11.7512, 106.7235),
(16, 'BTH', 'Bình Thuận', 'Miền Trung', 10.9333, 108.1),
(17, 'CM', 'Cà Mau', 'Miền Nam', 9.1769, 105.1524),
(18, 'CB', 'Cao Bằng', 'Miền Bắc', 22.6667, 106.25),
(19, 'DL', 'Đắk Lắk', 'Tây Nguyên', 12.6667, 108.05),
(20, 'DNO', 'Đắk Nông', 'Tây Nguyên', 12.2646, 107.6098),
(21, 'DB', 'Điện Biên', 'Miền Bắc', 21.386, 103.023),
(22, 'DNA', 'Đồng Nai', 'Miền Nam', 10.9574, 106.8427),
(23, 'DT', 'Đồng Tháp', 'Miền Nam', 10.4938, 105.6882),
(24, 'GL', 'Gia Lai', 'Tây Nguyên', 13.9833, 108.0),
(25, 'HG', 'Hà Giang', 'Miền Bắc', 22.8233, 104.9836),
(26, 'HNA', 'Hà Nam', 'Miền Bắc', 20.5835, 105.9229),
(27, 'HT', 'Hà Tĩnh', 'Miền Trung', 18.3559, 105.8877),
(28, 'HD', 'Hải Dương', 'Miền Bắc', 20.9373, 106.3145),
(29, 'HGI', 'Hậu Giang', 'Miền Nam', 9.7845, 105.4701),
(30, 'HB', 'Hòa Bình', 'Miền Bắc', 20.8172, 105.3376),
(31, 'HY', 'Hưng Yên', 'Miền Bắc', 20.6464, 106.0511),
(32, 'KH', 'Khánh Hòa', 'Miền Trung', 12.2388, 109.1967),
(33, 'KG', 'Kiên Giang', 'Miền Nam', 10.0125, 105.0809),
(34, 'KT', 'Kon Tum', 'Tây Nguyên', 14.3497, 108.0),
(35, 'LC', 'Lai Châu', 'Miền Bắc', 22.3964, 103.4582),
(36, 'LD', 'Lâm Đồng', 'Tây Nguyên', 11.9404, 108.4583),
(37, 'LS', 'Lạng Sơn', 'Miền Bắc', 21.8537, 106.7615),
(38, 'LCA', 'Lào Cai', 'Miền Bắc', 22.4809, 103.9755),
(39, 'LA', 'Long An', 'Miền Nam', 10.6956, 106.2431),
(40, 'ND', 'Nam Định', 'Miền Bắc', 20.4388, 106.1621),
(41, 'NA', 'Nghệ An', 'Miền Trung', 18.6796, 105.6813),
(42, 'NB', 'Ninh Bình', 'Miền Bắc', 20.2506, 105.9745),
(43, 'NT', 'Ninh Thuận', 'Miền Trung', 11.5643, 108.9886),
(44, 'PT', 'Phú Thọ', 'Miền Bắc', 21.3227, 105.402),
(45, 'PY', 'Phú Yên', 'Miền Trung', 13.0882, 109.0929),
(46, 'QB', 'Quảng Bình', 'Miền Trung', 17.4688, 106.6223),
(47, 'QNA', 'Quảng Nam', 'Miền Trung', 15.5394, 108.0191),
(48, 'QNG', 'Quảng Ngãi', 'Miền Trung', 15.1205, 108.7923),
(49, 'QNI', 'Quảng Ninh', 'Miền Bắc', 20.9712, 107.0448),
(50, 'QT', 'Quảng Trị', 'Miền Trung', 16.7403, 107.1855),
(51, 'ST', 'Sóc Trăng', 'Miền Nam', 9.6025, 105.9739),
(52, 'SL', 'Sơn La', 'Miền Bắc', 21.327, 103.9141),
(53, 'TN', 'Tây Ninh', 'Miền Nam', 11.3352, 106.1099),
(54, 'TB', 'Thái Bình', 'Miền Bắc', 20.4463, 106.3366),
(55, 'TNG', 'Thái Nguyên', 'Miền Bắc', 21.5672, 105.8252),
(56, 'TH', 'Thanh Hóa', 'Miền Trung', 19.8075, 105.7764),
(57, 'TTH', 'Thừa Thiên Huế', 'Miền Trung', 16.4637, 107.5909),
(58, 'TG', 'Tiền Giang', 'Miền Nam', 10.4493, 106.3421),
(59, 'TV', 'Trà Vinh', 'Miền Nam', 9.9347, 106.3453),
(60, 'TQ', 'Tuyên Quang', 'Miền Bắc', 21.8233, 105.2181),
(61, 'VL', 'Vĩnh Long', 'Miền Nam', 10.2537, 105.9722),
(62, 'VP', 'Vĩnh Phúc', 'Miền Bắc', 21.3089, 105.6049),
(63, 'YB', 'Yên Bái', 'Miền Bắc', 21.7051, 104.875);

-- Roles
INSERT INTO roles (id, name, description) VALUES
(1, 'admin', 'Toàn quyền quản trị hệ thống'),
(2, 'user', 'Người dùng thông thường - chỉ xem và đặt vé');

-- Users (password hashed with bcrypt, plain: admin123 / user123)
-- Passwords are hashed with bcrypt (salt rounds: 10)
-- admin123 / user123
INSERT INTO users (id, name, email, password, phone, role_id) VALUES
(1, 'Admin CineX', 'admin@cinex.vn', '$2b$10$kGR1rpb3W3waMIWueyHnYO2QbWsZ6.ojlx55ScF2xfpayNhIwxUmO', '0901000001', 1),
(2, 'Nguyễn Văn A', 'user1@cinex.vn', '$2b$10$jR/sIIF8AFK9IrS/HS9XoegpPukJUMMyyd5zgMUeQ/n9qWaDuSI5u', '0901000003', 2),
(3, 'Trần Thị B', 'user2@cinex.vn', '$2b$10$RXfWBKMO46mxDdDbzQpnsO9uXBcp5HN/oJVr0lXjel3r3RSIp4d2u', '0901000004', 2);

-- Cinemas (data from Vietnamese cinema chains - estimated, based on 2025 market statistics)
INSERT INTO cinemas (id, name, address, city, brand) VALUES
(1, 'CGV Đà Nẵng', 'Đà Nẵng', 'Đà Nẵng', 'CGV'),
(2, 'CGV Nghệ An', 'Nghệ An', 'Nghệ An', 'CGV'),
(3, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(4, 'CGV Quảng Ninh', 'Quảng Ninh', 'Quảng Ninh', 'CGV'),
(5, 'CGV Hải Phòng', 'Hải Phòng', 'Hải Phòng', 'CGV'),
(6, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(7, 'CGV Đà Nẵng', 'Đà Nẵng', 'Đà Nẵng', 'CGV'),
(8, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(9, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(10, 'CGV Hải Dương', 'Hải Dương', 'Hải Dương', 'CGV'),
(11, 'CGV Buôn Ma Thuột', 'Buôn Ma Thuột', 'Buôn Ma Thuột', 'CGV'),
(12, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(13, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(14, 'CGV An Giang', 'An Giang', 'An Giang', 'CGV'),
(15, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(16, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(17, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(18, 'CGV Đắk Lắk', 'Đắk Lắk', 'Đắk Lắk', 'CGV'),
(19, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(20, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(21, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(22, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(23, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(24, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(25, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(26, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(27, 'CGV Thái Nguyên', 'Thái Nguyên', 'Thái Nguyên', 'CGV'),
(28, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(29, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(30, 'CGV Quy Nhơn', 'Quy Nhơn', 'Quy Nhơn', 'CGV'),
(31, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(32, 'CGV Khánh Hòa', 'Khánh Hòa', 'Khánh Hòa', 'CGV'),
(33, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(34, 'CGV Đắk Lắk', 'Đắk Lắk', 'Đắk Lắk', 'CGV'),
(35, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(36, 'CGV Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'CGV'),
(37, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(38, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(39, 'CGV Lâm Đồng', 'Lâm Đồng', 'Lâm Đồng', 'CGV'),
(40, 'CGV Buôn Ma Thuột', 'Buôn Ma Thuột', 'Buôn Ma Thuột', 'CGV'),
(41, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(42, 'CGV Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'CGV'),
(43, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(44, 'CGV Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'CGV'),
(45, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(46, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(47, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(48, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(49, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(50, 'CGV Quy Nhơn', 'Quy Nhơn', 'Quy Nhơn', 'CGV'),
(51, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(52, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(53, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(54, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(55, 'CGV Nha Trang', 'Nha Trang', 'Nha Trang', 'CGV'),
(56, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(57, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(58, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(59, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(60, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(61, 'CGV An Giang', 'An Giang', 'An Giang', 'CGV'),
(62, 'CGV Đà Nẵng', 'Đà Nẵng', 'Đà Nẵng', 'CGV'),
(63, 'CGV Hải Dương', 'Hải Dương', 'Hải Dương', 'CGV'),
(64, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(65, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(66, 'CGV Bến Tre', 'Bến Tre', 'Bến Tre', 'CGV'),
(67, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(68, 'CGV Buôn Ma Thuột', 'Buôn Ma Thuột', 'Buôn Ma Thuột', 'CGV'),
(69, 'CGV Bến Tre', 'Bến Tre', 'Bến Tre', 'CGV'),
(70, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(71, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(72, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(73, 'CGV Hải Dương', 'Hải Dương', 'Hải Dương', 'CGV'),
(74, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(75, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(76, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(77, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(78, 'CGV Thanh Hóa', 'Thanh Hóa', 'Thanh Hóa', 'CGV'),
(79, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(80, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(81, 'CGV Đồng Nai', 'Đồng Nai', 'Đồng Nai', 'CGV'),
(82, 'CGV Hà Nội', 'Hà Nội', 'Hà Nội', 'CGV'),
(83, 'CGV TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CGV'),
(84, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(85, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(86, 'Lotte Cinema Quảng Ninh', 'Quảng Ninh', 'Quảng Ninh', 'Lotte'),
(87, 'Lotte Cinema Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'Lotte'),
(88, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(89, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(90, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(91, 'Lotte Cinema Nha Trang', 'Nha Trang', 'Nha Trang', 'Lotte'),
(92, 'Lotte Cinema Đà Nẵng', 'Đà Nẵng', 'Đà Nẵng', 'Lotte'),
(93, 'Lotte Cinema Đồng Nai', 'Đồng Nai', 'Đồng Nai', 'Lotte'),
(94, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(95, 'Lotte Cinema Hải Dương', 'Hải Dương', 'Hải Dương', 'Lotte'),
(96, 'Lotte Cinema Vĩnh Long', 'Vĩnh Long', 'Vĩnh Long', 'Lotte'),
(97, 'Lotte Cinema Nha Trang', 'Nha Trang', 'Nha Trang', 'Lotte'),
(98, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(99, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(100, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(101, 'Lotte Cinema Huế', 'Huế', 'Huế', 'Lotte'),
(102, 'Lotte Cinema An Giang', 'An Giang', 'An Giang', 'Lotte'),
(103, 'Lotte Cinema Huế', 'Huế', 'Huế', 'Lotte'),
(104, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(105, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(106, 'Lotte Cinema Nha Trang', 'Nha Trang', 'Nha Trang', 'Lotte'),
(107, 'Lotte Cinema Kiên Giang', 'Kiên Giang', 'Kiên Giang', 'Lotte'),
(108, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(109, 'Lotte Cinema Đồng Nai', 'Đồng Nai', 'Đồng Nai', 'Lotte'),
(110, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(111, 'Lotte Cinema Đắk Lắk', 'Đắk Lắk', 'Đắk Lắk', 'Lotte'),
(112, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(113, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(114, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(115, 'Lotte Cinema Vĩnh Long', 'Vĩnh Long', 'Vĩnh Long', 'Lotte'),
(116, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(117, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(118, 'Lotte Cinema Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'Lotte'),
(119, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(120, 'Lotte Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Lotte'),
(121, 'Lotte Cinema Tiền Giang', 'Tiền Giang', 'Tiền Giang', 'Lotte'),
(122, 'Lotte Cinema Kiên Giang', 'Kiên Giang', 'Kiên Giang', 'Lotte'),
(123, 'Lotte Cinema An Giang', 'An Giang', 'An Giang', 'Lotte'),
(124, 'Lotte Cinema Buôn Ma Thuột', 'Buôn Ma Thuột', 'Buôn Ma Thuột', 'Lotte'),
(125, 'Lotte Cinema Kiên Giang', 'Kiên Giang', 'Kiên Giang', 'Lotte'),
(126, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(127, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(128, 'Lotte Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Lotte'),
(129, 'Galaxy Cinema Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'Galaxy'),
(130, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(131, 'Galaxy Cinema Cần Thơ', 'Cần Thơ', 'Cần Thơ', 'Galaxy'),
(132, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(133, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(134, 'Galaxy Cinema Quy Nhơn', 'Quy Nhơn', 'Quy Nhơn', 'Galaxy'),
(135, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(136, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(137, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(138, 'Galaxy Cinema Thái Nguyên', 'Thái Nguyên', 'Thái Nguyên', 'Galaxy'),
(139, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(140, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(141, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(142, 'Galaxy Cinema Đồng Nai', 'Đồng Nai', 'Đồng Nai', 'Galaxy'),
(143, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(144, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(145, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(146, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(147, 'Galaxy Cinema Long An', 'Long An', 'Long An', 'Galaxy'),
(148, 'Galaxy Cinema Hà Nội', 'Hà Nội', 'Hà Nội', 'Galaxy'),
(149, 'Galaxy Cinema Nha Trang', 'Nha Trang', 'Nha Trang', 'Galaxy'),
(150, 'Galaxy Cinema TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Galaxy'),
(151, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(152, 'Beta Cineplex Buôn Ma Thuột', 'Buôn Ma Thuột', 'Buôn Ma Thuột', 'Beta'),
(153, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(154, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(155, 'Beta Cineplex Bình Dương', 'Bình Dương', 'Bình Dương', 'Beta'),
(156, 'Beta Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Beta'),
(157, 'Beta Cineplex An Giang', 'An Giang', 'An Giang', 'Beta'),
(158, 'Beta Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Beta'),
(159, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(160, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(161, 'Beta Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Beta'),
(162, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(163, 'Beta Cineplex Bắc Ninh', 'Bắc Ninh', 'Bắc Ninh', 'Beta'),
(164, 'Beta Cineplex Thái Nguyên', 'Thái Nguyên', 'Thái Nguyên', 'Beta'),
(165, 'Beta Cineplex Đà Nẵng', 'Đà Nẵng', 'Đà Nẵng', 'Beta'),
(166, 'Beta Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'Beta'),
(167, 'Beta Cineplex Đồng Nai', 'Đồng Nai', 'Đồng Nai', 'Beta'),
(168, 'Beta Cineplex Long An', 'Long An', 'Long An', 'Beta'),
(169, 'Beta Cineplex Nha Trang', 'Nha Trang', 'Nha Trang', 'Beta'),
(170, 'Beta Cineplex Vũng Tàu', 'Vũng Tàu', 'Vũng Tàu', 'Beta'),
(171, 'Beta Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'Beta'),
(172, 'BHD Star Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'BHD'),
(173, 'BHD Star Cineplex Đắk Lắk', 'Đắk Lắk', 'Đắk Lắk', 'BHD'),
(174, 'BHD Star Cineplex Kiên Giang', 'Kiên Giang', 'Kiên Giang', 'BHD'),
(175, 'BHD Star Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'BHD'),
(176, 'BHD Star Cineplex Bắc Ninh', 'Bắc Ninh', 'Bắc Ninh', 'BHD'),
(177, 'BHD Star Cineplex Huế', 'Huế', 'Huế', 'BHD'),
(178, 'BHD Star Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'BHD'),
(179, 'BHD Star Cineplex TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'BHD'),
(180, 'BHD Star Cineplex Hà Nội', 'Hà Nội', 'Hà Nội', 'BHD'),
(181, 'BHD Star Cineplex Bến Tre', 'Bến Tre', 'Bến Tre', 'BHD'),
(182, 'BHD Star Cineplex Kiên Giang', 'Kiên Giang', 'Kiên Giang', 'BHD'),
(183, 'CineStar Long An', 'Long An', 'Long An', 'CineStar'),
(184, 'CineStar Hà Nội', 'Hà Nội', 'Hà Nội', 'CineStar'),
(185, 'CineStar Hà Nội', 'Hà Nội', 'Hà Nội', 'CineStar'),
(186, 'CineStar TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CineStar'),
(187, 'CineStar TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CineStar'),
(188, 'CineStar TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'TP. Hồ Chí Minh', 'CineStar'),
(189, 'CineStar Hà Nội', 'Hà Nội', 'Hà Nội', 'CineStar'),
(190, 'CineStar Hà Nội', 'Hà Nội', 'Hà Nội', 'CineStar'),
(191, 'CineStar Hà Nội', 'Hà Nội', 'Hà Nội', 'CineStar'),
(192, 'Mega GS Thanh Hóa', 'Thanh Hóa', 'Thanh Hóa', 'Mega GS'),
(193, 'Mega GS Hà Nội', 'Hà Nội', 'Hà Nội', 'Mega GS');

-- Cập nhật province_id cho rạp dựa trên city
UPDATE cinemas SET province_id = CASE city
  WHEN 'Hà Nội' THEN 1 WHEN 'TP. Hồ Chí Minh' THEN 2
  WHEN 'Hải Phòng' THEN 3 WHEN 'Đà Nẵng' THEN 4
  WHEN 'Cần Thơ' THEN 5 WHEN 'An Giang' THEN 6
  WHEN 'Bến Tre' THEN 12 WHEN 'Bình Dương' THEN 14
  WHEN 'Bắc Ninh' THEN 11 WHEN 'Nghệ An' THEN 41
  WHEN 'Quảng Ninh' THEN 49 WHEN 'Hải Dương' THEN 28
  WHEN 'Thái Nguyên' THEN 55 WHEN 'Thanh Hóa' THEN 56
  WHEN 'Đắk Lắk' THEN 19 WHEN 'Lâm Đồng' THEN 36
  WHEN 'Khánh Hòa' THEN 32 WHEN 'Đồng Nai' THEN 22
  WHEN 'Vĩnh Long' THEN 61 WHEN 'Tiền Giang' THEN 58
  WHEN 'Kiên Giang' THEN 33 WHEN 'Bình Định' THEN 13
  WHEN 'Long An' THEN 39 WHEN 'Buôn Ma Thuột' THEN 19
  WHEN 'Nha Trang' THEN 32 WHEN 'Huế' THEN 57
  WHEN 'Vũng Tàu' THEN 7  WHEN 'Quy Nhơn' THEN 13
END;

-- Thêm rạp cho 38 tỉnh thành còn thiếu
INSERT INTO cinemas (id, name, address, city, brand, province_id) VALUES
(194, 'CGV Bắc Giang', 'Bắc Giang', 'Bắc Giang', 'CGV', 8),
(195, 'CGV Bắc Kạn', 'Bắc Kạn', 'Bắc Kạn', 'CGV', 9),
(196, 'CGV Bạc Liêu', 'Bạc Liêu', 'Bạc Liêu', 'CGV', 10),
(197, 'CGV Bình Phước', 'Bình Phước', 'Bình Phước', 'CGV', 15),
(198, 'CGV Bình Thuận', 'Bình Thuận', 'Bình Thuận', 'CGV', 16),
(199, 'CGV Cà Mau', 'Cà Mau', 'Cà Mau', 'CGV', 17),
(200, 'CGV Cao Bằng', 'Cao Bằng', 'Cao Bằng', 'CGV', 18),
(201, 'CGV Đắk Nông', 'Đắk Nông', 'Đắk Nông', 'CGV', 20),
(202, 'CGV Điện Biên', 'Điện Biên', 'Điện Biên', 'CGV', 21),
(203, 'CGV Đồng Tháp', 'Đồng Tháp', 'Đồng Tháp', 'CGV', 23),
(204, 'CGV Gia Lai', 'Pleiku', 'Gia Lai', 'CGV', 24),
(205, 'CGV Hà Giang', 'Hà Giang', 'Hà Giang', 'CGV', 25),
(206, 'CGV Hà Nam', 'Phủ Lý', 'Hà Nam', 'CGV', 26),
(207, 'CGV Hà Tĩnh', 'Hà Tĩnh', 'Hà Tĩnh', 'CGV', 27),
(208, 'CGV Hậu Giang', 'Hậu Giang', 'Hậu Giang', 'CGV', 29),
(209, 'CGV Hòa Bình', 'Hòa Bình', 'Hòa Bình', 'CGV', 30),
(210, 'CGV Hưng Yên', 'Hưng Yên', 'Hưng Yên', 'CGV', 31),
(211, 'CGV Kon Tum', 'Kon Tum', 'Kon Tum', 'CGV', 34),
(212, 'CGV Lai Châu', 'Lai Châu', 'Lai Châu', 'CGV', 35),
(213, 'CGV Lạng Sơn', 'Lạng Sơn', 'Lạng Sơn', 'CGV', 37),
(214, 'CGV Lào Cai', 'Lào Cai', 'Lào Cai', 'CGV', 38),
(215, 'CGV Nam Định', 'Nam Định', 'Nam Định', 'CGV', 40),
(216, 'CGV Ninh Bình', 'Ninh Bình', 'Ninh Bình', 'CGV', 42),
(217, 'CGV Ninh Thuận', 'Phan Rang', 'Ninh Thuận', 'CGV', 43),
(218, 'CGV Phú Thọ', 'Phú Thọ', 'Phú Thọ', 'CGV', 44),
(219, 'CGV Phú Yên', 'Tuy Hòa', 'Phú Yên', 'CGV', 45),
(220, 'CGV Quảng Bình', 'Đồng Hới', 'Quảng Bình', 'CGV', 46),
(221, 'CGV Quảng Nam', 'Hội An', 'Quảng Nam', 'CGV', 47),
(222, 'CGV Quảng Ngãi', 'Quảng Ngãi', 'Quảng Ngãi', 'CGV', 48),
(223, 'CGV Quảng Trị', 'Quảng Trị', 'Quảng Trị', 'CGV', 50),
(224, 'CGV Sóc Trăng', 'Sóc Trăng', 'Sóc Trăng', 'CGV', 51),
(225, 'CGV Sơn La', 'Sơn La', 'Sơn La', 'CGV', 52),
(226, 'CGV Tây Ninh', 'Tây Ninh', 'Tây Ninh', 'CGV', 53),
(227, 'CGV Thái Bình', 'Thái Bình', 'Thái Bình', 'CGV', 54),
(228, 'CGV Trà Vinh', 'Trà Vinh', 'Trà Vinh', 'CGV', 59),
(229, 'CGV Tuyên Quang', 'Tuyên Quang', 'Tuyên Quang', 'CGV', 60),
(230, 'CGV Vĩnh Phúc', 'Vĩnh Phúc', 'Vĩnh Phúc', 'CGV', 62),
(231, 'CGV Yên Bái', 'Yên Bái', 'Yên Bái', 'CGV', 63);

-- Promotions
INSERT INTO promotions (id, title, description, discount, code, valid_until, color, icon) VALUES
(1, 'Giá vé sinh viên', 'Giảm 20% cho sinh viên khi xuất trình thẻ', '20%', 'SINHVIEN', '2026-12-31', 'purple', 'GraduationCap'),
(2, 'Mua 1 tặng 1', 'Mua 1 vé tặng 1 vé cho người đi cùng vào thứ 2 hàng tuần', '50%', 'MONDAY', '2026-09-30', 'pink', 'Gift'),
(3, 'Vé VIP giảm 30%', 'Giảm 30% khi mua vé VIP trước 10h sáng', '30%', 'VIPMORNING', '2026-08-31', 'amber', 'Crown'),
(4, 'Combo cuối tuần', 'Giảm 15% khi mua từ 3 vé trở lên vào cuối tuần', '15%', 'WEEKEND3', '2026-12-31', 'emerald', 'Ticket');
