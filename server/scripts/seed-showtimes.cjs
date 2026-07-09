const pool = require('../config/database.cjs');
require('dotenv').config();

const BRANDS = ['CGV', 'Lotte', 'Galaxy', 'BHD', 'Beta', 'CineStar', 'Mega GS'];

const VIETNAM_CINEMAS = [
  // Hà Nội (province_id: 1)
  { brand: 'CGV', name: 'CGV Vincom Bà Triệu', address: '191 Bà Triệu, Hai Bà Trưng', district: 'Hai Bà Trưng', city: 'Hà Nội', province_id: 1, lat: 21.0142, lng: 105.8530 },
  { brand: 'CGV', name: 'CGV Vincom Nguyễn Chí Thanh', address: '54A Nguyễn Chí Thanh, Đống Đa', district: 'Đống Đa', city: 'Hà Nội', province_id: 1, lat: 21.0181, lng: 105.8224 },
  { brand: 'CGV', name: 'CGV Vincom Trần Duy Hưng', address: '119 Trần Duy Hưng, Cầu Giấy', district: 'Cầu Giấy', city: 'Hà Nội', province_id: 1, lat: 21.0086, lng: 105.7971 },
  { brand: 'CGV', name: 'CGV Aeon Mall Hà Đông', address: 'Dương Nội, Hà Đông', district: 'Hà Đông', city: 'Hà Nội', province_id: 1, lat: 20.9668, lng: 105.7781 },
  { brand: 'CGV', name: 'CGV Mipec Long Biên', address: '2 Long Biên, Long Biên', district: 'Long Biên', city: 'Hà Nội', province_id: 1, lat: 21.0373, lng: 105.8642 },
  { brand: 'Lotte', name: 'Lotte Cinema Láng Hạ', address: '53 Láng Hạ, Ba Đình', district: 'Ba Đình', city: 'Hà Nội', province_id: 1, lat: 21.0220, lng: 105.8128 },
  { brand: 'Lotte', name: 'Lotte Cinema Đống Đa', address: '1 Nguyễn Lương Bằng, Đống Đa', district: 'Đống Đa', city: 'Hà Nội', province_id: 1, lat: 21.0139, lng: 105.8286 },
  { brand: 'Galaxy', name: 'Galaxy Nguyễn Du', address: '116 Nguyễn Du, Hai Bà Trưng', district: 'Hai Bà Trưng', city: 'Hà Nội', province_id: 1, lat: 21.0198, lng: 105.8457 },
  { brand: 'Galaxy', name: 'Galaxy Trần Duy Hưng', address: '112 Trần Duy Hưng, Cầu Giấy', district: 'Cầu Giấy', city: 'Hà Nội', province_id: 1, lat: 21.0079, lng: 105.7985 },
  { brand: 'BHD', name: 'BHD Star Cineplex Vincom Thái Hà', address: '80 Thái Hà, Đống Đa', district: 'Đống Đa', city: 'Hà Nội', province_id: 1, lat: 21.0152, lng: 105.8183 },
  { brand: 'Beta', name: 'Beta Cineplex Mỹ Đình', address: 'KĐT Mỹ Đình 1, Nam Từ Liêm', district: 'Nam Từ Liêm', city: 'Hà Nội', province_id: 1, lat: 21.0272, lng: 105.7692 },
  { brand: 'CineStar', name: 'CineStar Lê Trọng Tấn', address: '37 Lê Trọng Tấn, Thanh Xuân', district: 'Thanh Xuân', city: 'Hà Nội', province_id: 1, lat: 20.9937, lng: 105.8017 },
  { brand: 'Mega GS', name: 'Mega GS Cao Thắng', address: '124 Cao Thắng, Đống Đa', district: 'Đống Đa', city: 'Hà Nội', province_id: 1, lat: 21.0125, lng: 105.8241 },

  // TP. Hồ Chí Minh (province_id: 2)
  { brand: 'CGV', name: 'CGV Vincom Lê Văn Lương', address: '50 Lê Văn Lương, Nhà Bè', district: 'Nhà Bè', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7517, lng: 106.6921 },
  { brand: 'CGV', name: 'CGV Vivo City', address: '1058 Nguyễn Văn Linh, Quận 7', district: 'Quận 7', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7293, lng: 106.7017 },
  { brand: 'CGV', name: 'CGV Crescent Mall', address: '101 Tôn Dật Tiên, Quận 7', district: 'Quận 7', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7271, lng: 106.7189 },
  { brand: 'CGV', name: 'CGV Vincom Thủ Đức', address: '216 Võ Văn Ngân, Thủ Đức', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.8493, lng: 106.7644 },
  { brand: 'CGV', name: 'CGV Aeon Mall Tân Phú', address: '30 Bờ Bao Tân Thắng, Tân Phú', district: 'Tân Phú', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7912, lng: 106.6215 },
  { brand: 'CGV', name: 'CGV Saigon Nguyễn Huệ', address: '135 Nguyễn Huệ, Quận 1', district: 'Quận 1', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7736, lng: 106.7038 },
  { brand: 'Lotte', name: 'Lotte Cinema Cantavil', address: '1 Song Hành, Quận 2', district: 'Quận 2', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7918, lng: 106.7540 },
  { brand: 'Lotte', name: 'Lotte Cinema Phú Thọ', address: '138 Lý Tự Trọng, Quận 10', district: 'Quận 10', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7694, lng: 106.6696 },
  { brand: 'Lotte', name: 'Lotte Cinema Gò Vấp', address: '242 Nguyễn Văn Lượng, Gò Vấp', district: 'Gò Vấp', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.8374, lng: 106.6644 },
  { brand: 'Galaxy', name: 'Galaxy Tân Bình', address: '246 Trường Chinh, Tân Bình', district: 'Tân Bình', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7972, lng: 106.6467 },
  { brand: 'Galaxy', name: 'Galaxy Quận 9', address: 'Lê Văn Việt, Quận 9', district: 'Quận 9', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.8426, lng: 106.7735 },
  { brand: 'Galaxy', name: 'Galaxy Kinh Dương Vương', address: '702 Kinh Dương Vương, Bình Tân', district: 'Bình Tân', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7566, lng: 106.6095 },
  { brand: 'BHD', name: 'BHD Star Cineplex Phạm Hùng', address: '8 Phạm Hùng, Quận 8', district: 'Quận 8', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7232, lng: 106.6508 },
  { brand: 'BHD', name: 'BHD Star Cineplex Bình Thạnh', address: '123 Xô Viết Nghệ Tĩnh, Bình Thạnh', district: 'Bình Thạnh', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.8089, lng: 106.7078 },
  { brand: 'Beta', name: 'Beta Cineplex Quận 12', address: 'QL1A, Quận 12', district: 'Quận 12', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.8492, lng: 106.6156 },
  { brand: 'CineStar', name: 'CineStar Hai Bà Trưng SG', address: '71 Hai Bà Trưng, Quận 1', district: 'Quận 1', city: 'TP. Hồ Chí Minh', province_id: 2, lat: 10.7745, lng: 106.7063 },

  // Đà Nẵng (province_id: 4)
  { brand: 'CGV', name: 'CGV Vincom Đà Nẵng', address: '118 Ngô Gia Tự, Hải Châu', district: 'Hải Châu', city: 'Đà Nẵng', province_id: 4, lat: 16.0643, lng: 108.2206 },
  { brand: 'CGV', name: 'CGV Aeon Mall Đà Nẵng', address: '20 Ngô Quyền, Sơn Trà', district: 'Sơn Trà', city: 'Đà Nẵng', province_id: 4, lat: 16.0498, lng: 108.2349 },
  { brand: 'Lotte', name: 'Lotte Cinema Đà Nẵng', address: '459 Nguyễn Hữu Thọ, Cẩm Lệ', district: 'Cẩm Lệ', city: 'Đà Nẵng', province_id: 4, lat: 16.0162, lng: 108.2131 },
  { brand: 'Galaxy', name: 'Galaxy Đà Nẵng', address: '255 Hùng Vương, Thanh Khê', district: 'Thanh Khê', city: 'Đà Nẵng', province_id: 4, lat: 16.0577, lng: 108.2021 },
  { brand: 'Beta', name: 'Beta Cineplex Đà Nẵng', address: '86 Lê Độ, Hải Châu', district: 'Hải Châu', city: 'Đà Nẵng', province_id: 4, lat: 16.0446, lng: 108.2151 },

  // Hải Phòng (province_id: 3)
  { brand: 'CGV', name: 'CGV Vincom Hải Phòng', address: '18 Lạch Tray, Ngô Quyền', district: 'Ngô Quyền', city: 'Hải Phòng', province_id: 3, lat: 20.8434, lng: 106.6853 },
  { brand: 'CGV', name: 'CGV Aeon Mall Hải Phòng', address: '10 Lê Hồng Phong, Hồng Bàng', district: 'Hồng Bàng', city: 'Hải Phòng', province_id: 3, lat: 20.8612, lng: 106.6818 },
  { brand: 'Lotte', name: 'Lotte Cinema Hải Phòng', address: '57 Điện Biên Phủ, Lê Chân', district: 'Lê Chân', city: 'Hải Phòng', province_id: 3, lat: 20.8454, lng: 106.6907 },

  // Cần Thơ (province_id: 5)
  { brand: 'CGV', name: 'CGV Vincom Cần Thơ', address: '209 Nguyễn Trãi, Ninh Kiều', district: 'Ninh Kiều', city: 'Cần Thơ', province_id: 5, lat: 10.0323, lng: 105.7833 },
  { brand: 'Lotte', name: 'Lotte Cinema Cần Thơ', address: '1 Hùng Vương, Ninh Kiều', district: 'Ninh Kiều', city: 'Cần Thơ', province_id: 5, lat: 10.0360, lng: 105.7887 },
  { brand: 'Galaxy', name: 'Galaxy Cần Thơ', address: '52 Nguyễn Trãi, Ninh Kiều', district: 'Ninh Kiều', city: 'Cần Thơ', province_id: 5, lat: 10.0296, lng: 105.7801 },

  // An Giang (province_id: 6)
  { brand: 'CGV', name: 'CGV An Giang', address: '2 Hà Hoàng Hổ, Long Xuyên', district: 'Long Xuyên', city: 'An Giang', province_id: 6, lat: 10.3818, lng: 105.4218 },
  { brand: 'Lotte', name: 'Lotte Cinema An Giang', address: '5 Hai Bà Trưng, Long Xuyên', district: 'Long Xuyên', city: 'An Giang', province_id: 6, lat: 10.3844, lng: 105.4235 },
  { brand: 'Beta', name: 'Beta Cineplex An Giang', address: '19 Nguyễn Văn Cư, Long Xuyên', district: 'Long Xuyên', city: 'An Giang', province_id: 6, lat: 10.3831, lng: 105.4267 },

  // Bà Rịa - Vũng Tàu (province_id: 7)
  { brand: 'CGV', name: 'CGV Vũng Tàu', address: '105 Lê Hồng Phong, TP. Vũng Tàu', district: 'Vũng Tàu', city: 'Bà Rịa - Vũng Tàu', province_id: 7, lat: 10.3478, lng: 107.0809 },
  { brand: 'Beta', name: 'Beta Cineplex Vũng Tàu', address: '67 Ba Cu, TP. Vũng Tàu', district: 'Vũng Tàu', city: 'Bà Rịa - Vũng Tàu', province_id: 7, lat: 10.3450, lng: 107.0831 },

  // Bắc Giang (province_id: 8) through Yên Bái (province_id: 63) - one CGV each
  { brand: 'CGV', name: 'CGV Bắc Giang', address: '01 Nguyễn Văn Cừ, Bắc Giang', district: 'Bắc Giang', city: 'Bắc Giang', province_id: 8, lat: 21.2731, lng: 106.1946 },
  { brand: 'CGV', name: 'CGV Bắc Kạn', address: '02 Phùng Chí Kiên, Bắc Kạn', district: 'Bắc Kạn', city: 'Bắc Kạn', province_id: 9, lat: 22.1470, lng: 105.8348 },
  { brand: 'CGV', name: 'CGV Bạc Liêu', address: '01 Trần Huỳnh, Bạc Liêu', district: 'Bạc Liêu', city: 'Bạc Liêu', province_id: 10, lat: 9.2940, lng: 105.7216 },
  { brand: 'CGV', name: 'CGV Bắc Ninh', address: '10 Ngô Gia Tự, Bắc Ninh', district: 'Bắc Ninh', city: 'Bắc Ninh', province_id: 11, lat: 21.1861, lng: 106.0763 },
  { brand: 'Lotte', name: 'Lotte Cinema Bắc Ninh', address: '18 Lý Thường Kiệt, Bắc Ninh', district: 'Bắc Ninh', city: 'Bắc Ninh', province_id: 11, lat: 21.1882, lng: 106.0798 },
  { brand: 'CGV', name: 'CGV Bến Tre', address: '12 Đồng Văn Cống, Bến Tre', district: 'Bến Tre', city: 'Bến Tre', province_id: 12, lat: 10.2433, lng: 106.3756 },
  { brand: 'CGV', name: 'CGV Quy Nhơn', address: '15 Nguyễn Tất Thành, Quy Nhơn', district: 'Quy Nhơn', city: 'Bình Định', province_id: 13, lat: 13.7820, lng: 109.2190 },
  { brand: 'CGV', name: 'CGV Bình Dương', address: '88 Đại lộ Bình Dương, Thủ Dầu Một', district: 'Thủ Dầu Một', city: 'Bình Dương', province_id: 14, lat: 10.9804, lng: 106.6519 },
  { brand: 'Beta', name: 'Beta Cineplex Bình Dương', address: '15 Nguyễn Đình Chiểu, Thủ Dầu Một', district: 'Thủ Dầu Một', city: 'Bình Dương', province_id: 14, lat: 10.9770, lng: 106.6480 },
  { brand: 'CGV', name: 'CGV Bình Phước', address: '01 Hùng Vương, Đồng Xoài', district: 'Đồng Xoài', city: 'Bình Phước', province_id: 15, lat: 11.7512, lng: 106.7235 },
  { brand: 'CGV', name: 'CGV Bình Thuận', address: '01 Trần Hưng Đạo, Phan Thiết', district: 'Phan Thiết', city: 'Bình Thuận', province_id: 16, lat: 10.9333, lng: 108.1000 },
  { brand: 'CGV', name: 'CGV Cà Mau', address: '2 Hùng Vương, Cà Mau', district: 'Cà Mau', city: 'Cà Mau', province_id: 17, lat: 9.1769, lng: 105.1524 },
  { brand: 'CGV', name: 'CGV Cao Bằng', address: '02 Kim Đồng, Cao Bằng', district: 'Cao Bằng', city: 'Cao Bằng', province_id: 18, lat: 22.6667, lng: 106.2500 },
  { brand: 'CGV', name: 'CGV Buôn Ma Thuột', address: '78 Nguyễn Tất Thành, Buôn Ma Thuột', district: 'Buôn Ma Thuột', city: 'Đắk Lắk', province_id: 19, lat: 12.6667, lng: 108.0500 },
  { brand: 'Lotte', name: 'Lotte Cinema Buôn Ma Thuột', address: '52 Nguyễn Tất Thành, Buôn Ma Thuột', district: 'Buôn Ma Thuột', city: 'Đắk Lắk', province_id: 19, lat: 12.6700, lng: 108.0480 },
  { brand: 'CGV', name: 'CGV Đắk Nông', address: '01 Hùng Vương, Gia Nghĩa', district: 'Gia Nghĩa', city: 'Đắk Nông', province_id: 20, lat: 12.2646, lng: 107.6098 },
  { brand: 'CGV', name: 'CGV Điện Biên', address: '5 Nguyễn Hữu Thọ, Điện Biên Phủ', district: 'Điện Biên Phủ', city: 'Điện Biên', province_id: 21, lat: 21.3860, lng: 103.0230 },
  { brand: 'CGV', name: 'CGV Đồng Nai', address: '28 Cách Mạng Tháng 8, Biên Hòa', district: 'Biên Hòa', city: 'Đồng Nai', province_id: 22, lat: 10.9574, lng: 106.8427 },
  { brand: 'Galaxy', name: 'Galaxy Đồng Nai', address: '10 Phan Trung, Biên Hòa', district: 'Biên Hòa', city: 'Đồng Nai', province_id: 22, lat: 10.9550, lng: 106.8460 },
  { brand: 'CGV', name: 'CGV Đồng Tháp', address: '1 Nguyễn Huệ, Cao Lãnh', district: 'Cao Lãnh', city: 'Đồng Tháp', province_id: 23, lat: 10.4938, lng: 105.6882 },
  { brand: 'CGV', name: 'CGV Gia Lai', address: '10 Hùng Vương, Pleiku', district: 'Pleiku', city: 'Gia Lai', province_id: 24, lat: 13.9833, lng: 108.0000 },
  { brand: 'CGV', name: 'CGV Hà Giang', address: '1 Nguyễn Trãi, Hà Giang', district: 'Hà Giang', city: 'Hà Giang', province_id: 25, lat: 22.8233, lng: 104.9836 },
  { brand: 'CGV', name: 'CGV Hà Nam', address: '2 Biên Hòa, Phủ Lý', district: 'Phủ Lý', city: 'Hà Nam', province_id: 26, lat: 20.5835, lng: 105.9229 },
  { brand: 'CGV', name: 'CGV Hà Tĩnh', address: '25 Phan Đình Phùng, Hà Tĩnh', district: 'Hà Tĩnh', city: 'Hà Tĩnh', province_id: 27, lat: 18.3559, lng: 105.8877 },
  { brand: 'CGV', name: 'CGV Hải Dương', address: '15 Nguyễn Văn Linh, Hải Dương', district: 'Hải Dương', city: 'Hải Dương', province_id: 28, lat: 20.9373, lng: 106.3145 },
  { brand: 'Lotte', name: 'Lotte Cinema Hải Dương', address: '22 Nguyễn Du, Hải Dương', district: 'Hải Dương', city: 'Hải Dương', province_id: 28, lat: 20.9345, lng: 106.3112 },
  { brand: 'CGV', name: 'CGV Hậu Giang', address: '1 Hòa Bình, Vị Thanh', district: 'Vị Thanh', city: 'Hậu Giang', province_id: 29, lat: 9.7845, lng: 105.4701 },
  { brand: 'CGV', name: 'CGV Hòa Bình', address: '1 Cù Chính Lan, Hòa Bình', district: 'Hòa Bình', city: 'Hòa Bình', province_id: 30, lat: 20.8172, lng: 105.3376 },
  { brand: 'CGV', name: 'CGV Hưng Yên', address: '2 Nguyễn Văn Linh, Hưng Yên', district: 'Hưng Yên', city: 'Hưng Yên', province_id: 31, lat: 20.6464, lng: 106.0511 },
  { brand: 'CGV', name: 'CGV Nha Trang', address: '1 Trần Phú, Nha Trang', district: 'Nha Trang', city: 'Khánh Hòa', province_id: 32, lat: 12.2388, lng: 109.1967 },
  { brand: 'Lotte', name: 'Lotte Cinema Nha Trang', address: '25 Trần Phú, Nha Trang', district: 'Nha Trang', city: 'Khánh Hòa', province_id: 32, lat: 12.2400, lng: 109.1940 },
  { brand: 'CGV', name: 'CGV Kiên Giang', address: '2 Mạc Cửu, Rạch Giá', district: 'Rạch Giá', city: 'Kiên Giang', province_id: 33, lat: 10.0125, lng: 105.0809 },
  { brand: 'CGV', name: 'CGV Kon Tum', address: '2 Trần Hưng Đạo, Kon Tum', district: 'Kon Tum', city: 'Kon Tum', province_id: 34, lat: 14.3497, lng: 108.0000 },
  { brand: 'CGV', name: 'CGV Lai Châu', address: '1 Nguyễn Trãi, Lai Châu', district: 'Lai Châu', city: 'Lai Châu', province_id: 35, lat: 22.3964, lng: 103.4582 },
  { brand: 'CGV', name: 'CGV Đà Lạt', address: '15 Nguyễn Văn Trỗi, Đà Lạt', district: 'Đà Lạt', city: 'Lâm Đồng', province_id: 36, lat: 11.9404, lng: 108.4583 },
  { brand: 'CGV', name: 'CGV Lạng Sơn', address: '1 Nguyễn Du, Lạng Sơn', district: 'Lạng Sơn', city: 'Lạng Sơn', province_id: 37, lat: 21.8537, lng: 106.7615 },
  { brand: 'CGV', name: 'CGV Lào Cai', address: '1 Nguyễn Huệ, Lào Cai', district: 'Lào Cai', city: 'Lào Cai', province_id: 38, lat: 22.4809, lng: 103.9755 },
  { brand: 'CGV', name: 'CGV Long An', address: '1 Hùng Vương, Tân An', district: 'Tân An', city: 'Long An', province_id: 39, lat: 10.6956, lng: 106.2431 },
  { brand: 'Galaxy', name: 'Galaxy Long An', address: '15 Nguyễn Đình Chiểu, Tân An', district: 'Tân An', city: 'Long An', province_id: 39, lat: 10.6930, lng: 106.2400 },
  { brand: 'CGV', name: 'CGV Nam Định', address: '1 Hùng Vương, Nam Định', district: 'Nam Định', city: 'Nam Định', province_id: 40, lat: 20.4388, lng: 106.1621 },
  { brand: 'CGV', name: 'CGV Vinh', address: '1 Trần Phú, Vinh', district: 'Vinh', city: 'Nghệ An', province_id: 41, lat: 18.6796, lng: 105.6813 },
  { brand: 'CGV', name: 'CGV Ninh Bình', address: '2 Trần Hưng Đạo, Ninh Bình', district: 'Ninh Bình', city: 'Ninh Bình', province_id: 42, lat: 20.2506, lng: 105.9745 },
  { brand: 'CGV', name: 'CGV Ninh Thuận', address: '1 Ngô Gia Tự, Phan Rang', district: 'Phan Rang', city: 'Ninh Thuận', province_id: 43, lat: 11.5643, lng: 108.9886 },
  { brand: 'CGV', name: 'CGV Phú Thọ', address: '1 Hùng Vương, Việt Trì', district: 'Việt Trì', city: 'Phú Thọ', province_id: 44, lat: 21.3227, lng: 105.4020 },
  { brand: 'CGV', name: 'CGV Phú Yên', address: '1 Nguyễn Huệ, Tuy Hòa', district: 'Tuy Hòa', city: 'Phú Yên', province_id: 45, lat: 13.0882, lng: 109.0929 },
  { brand: 'CGV', name: 'CGV Quảng Bình', address: '1 Lý Thái Tổ, Đồng Hới', district: 'Đồng Hới', city: 'Quảng Bình', province_id: 46, lat: 17.4688, lng: 106.6223 },
  { brand: 'CGV', name: 'CGV Hội An', address: '1 Nguyễn Duy Hiệu, Hội An', district: 'Hội An', city: 'Quảng Nam', province_id: 47, lat: 15.5394, lng: 108.0191 },
  { brand: 'CGV', name: 'CGV Quảng Ngãi', address: '1 Hùng Vương, Quảng Ngãi', district: 'Quảng Ngãi', city: 'Quảng Ngãi', province_id: 48, lat: 15.1205, lng: 108.7923 },
  { brand: 'CGV', name: 'CGV Hạ Long', address: '1 Lê Thánh Tông, Hạ Long', district: 'Hạ Long', city: 'Quảng Ninh', province_id: 49, lat: 20.9712, lng: 107.0448 },
  { brand: 'Lotte', name: 'Lotte Cinema Hạ Long', address: '2 Nguyễn Văn Cừ, Hạ Long', district: 'Hạ Long', city: 'Quảng Ninh', province_id: 49, lat: 20.9690, lng: 107.0470 },
  { brand: 'CGV', name: 'CGV Quảng Trị', address: '1 Trần Hưng Đạo, Đông Hà', district: 'Đông Hà', city: 'Quảng Trị', province_id: 50, lat: 16.7403, lng: 107.1855 },
  { brand: 'CGV', name: 'CGV Sóc Trăng', address: '1 Nguyễn Văn Linh, Sóc Trăng', district: 'Sóc Trăng', city: 'Sóc Trăng', province_id: 51, lat: 9.6025, lng: 105.9739 },
  { brand: 'CGV', name: 'CGV Sơn La', address: '1 Nguyễn Trãi, Sơn La', district: 'Sơn La', city: 'Sơn La', province_id: 52, lat: 21.3270, lng: 103.9141 },
  { brand: 'CGV', name: 'CGV Tây Ninh', address: '1 Cách Mạng Tháng 8, Tây Ninh', district: 'Tây Ninh', city: 'Tây Ninh', province_id: 53, lat: 11.3352, lng: 106.1099 },
  { brand: 'CGV', name: 'CGV Thái Bình', address: '1 Lý Bôn, Thái Bình', district: 'Thái Bình', city: 'Thái Bình', province_id: 54, lat: 20.4463, lng: 106.3366 },
  { brand: 'CGV', name: 'CGV Thái Nguyên', address: '1 Cách Mạng Tháng 8, Thái Nguyên', district: 'Thái Nguyên', city: 'Thái Nguyên', province_id: 55, lat: 21.5672, lng: 105.8252 },
  { brand: 'Galaxy', name: 'Galaxy Thái Nguyên', address: '2 Nguyễn Du, Thái Nguyên', district: 'Thái Nguyên', city: 'Thái Nguyên', province_id: 55, lat: 21.5690, lng: 105.8230 },
  { brand: 'CGV', name: 'CGV Thanh Hóa', address: '1 Lê Hoàn, Thanh Hóa', district: 'Thanh Hóa', city: 'Thanh Hóa', province_id: 56, lat: 19.8075, lng: 105.7764 },
  { brand: 'Mega GS', name: 'Mega GS Thanh Hóa', address: '2 Trường Thi, Thanh Hóa', district: 'Thanh Hóa', city: 'Thanh Hóa', province_id: 56, lat: 19.8100, lng: 105.7790 },
  { brand: 'CGV', name: 'CGV Huế', address: '1 Hùng Vương, Huế', district: 'Huế', city: 'Thừa Thiên Huế', province_id: 57, lat: 16.4637, lng: 107.5909 },
  { brand: 'BHD', name: 'BHD Star Cineplex Huế', address: '5 Nguyễn Huệ, Huế', district: 'Huế', city: 'Thừa Thiên Huế', province_id: 57, lat: 16.4650, lng: 107.5880 },
  { brand: 'CGV', name: 'CGV Tiền Giang', address: '1 Cách Mạng Tháng 8, Mỹ Tho', district: 'Mỹ Tho', city: 'Tiền Giang', province_id: 58, lat: 10.4493, lng: 106.3421 },
  { brand: 'CGV', name: 'CGV Trà Vinh', address: '1 Nguyễn Đáng, Trà Vinh', district: 'Trà Vinh', city: 'Trà Vinh', province_id: 59, lat: 9.9347, lng: 106.3453 },
  { brand: 'CGV', name: 'CGV Tuyên Quang', address: '1 Nguyễn Trãi, Tuyên Quang', district: 'Tuyên Quang', city: 'Tuyên Quang', province_id: 60, lat: 21.8233, lng: 105.2181 },
  { brand: 'CGV', name: 'CGV Vĩnh Long', address: '1 Nguyễn Huệ, Vĩnh Long', district: 'Vĩnh Long', city: 'Vĩnh Long', province_id: 61, lat: 10.2537, lng: 105.9722 },
  { brand: 'CGV', name: 'CGV Vĩnh Phúc', address: '1 Nguyễn Tất Thành, Vĩnh Yên', district: 'Vĩnh Yên', city: 'Vĩnh Phúc', province_id: 62, lat: 21.3089, lng: 105.6049 },
  { brand: 'CGV', name: 'CGV Yên Bái', address: '1 Nguyễn Du, Yên Bái', district: 'Yên Bái', city: 'Yên Bái', province_id: 63, lat: 21.7051, lng: 104.8750 },
];

const SCREEN_NAMES = ['Screen 1', 'Screen 2', 'Screen 3', 'Screen 4', 'Screen 5'];
const SCREEN_FORMATS = ['2D', '2D', '2D', '3D', 'IMAX'];
const FORMATS = ['2D', '3D', 'IMAX'];
const LANGUAGES = ['Phụ đề', 'Lồng tiếng'];
const TIME_SLOTS = ['09:00', '11:30', '14:00', '16:30', '19:00', '21:30'];
const DAYS_AHEAD = 7;

function pad(n) { return n.toString().padStart(2, '0'); }
function formatDate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function getDates() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(formatDate(d));
  }
  return dates;
}

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function seed() {
  const conn = await pool.getConnection();

  try {
    // Clean up
    console.log('Cleaning existing data...');
    await conn.query('DELETE FROM seats');
    await conn.query('DELETE FROM bookings');
    await conn.query('DELETE FROM showtimes');
    await conn.query('DELETE FROM screens');
    await conn.query('DELETE FROM cinemas WHERE id > 0');
    await conn.query('ALTER TABLE cinemas AUTO_INCREMENT = 1');
    console.log('  done');

    // Insert cinemas
    console.log(`Inserting ${VIETNAM_CINEMAS.length} cinemas...`);
    for (const c of VIETNAM_CINEMAS) {
      await conn.query(
        'INSERT INTO cinemas (name, address, district, city, brand, province_id, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [c.name, c.address, c.district, c.city, c.brand, c.province_id, c.lat, c.lng]
      );
    }

    // Add unique constraint (safe now since data is clean)
    try {
      await conn.query('ALTER TABLE cinemas ADD CONSTRAINT uk_cinema_unique UNIQUE (brand, name, address)');
      console.log('  unique constraint added');
    } catch (err) {
      if (err.errno !== 1061) throw err;
    }

    // Get cinemas and movies
    const [cinemas] = await conn.query('SELECT * FROM cinemas ORDER BY id');
    const [movies] = await conn.query("SELECT id, duration FROM movies WHERE status = 'active'");
    console.log(`  ${cinemas.length} cinemas, ${movies.length} active movies`);

    // Create screens for each cinema
    console.log('Creating screens...');
    const screenMap = {};
    let screenId = 1;
    for (const cinema of cinemas) {
      const numScreens = cinema.brand === 'CGV' || cinema.brand === 'Lotte' ? 5 : 3;
      screenMap[cinema.id] = [];
      for (let i = 0; i < numScreens; i++) {
        const fmt = SCREEN_FORMATS[i] || '2D';
        await conn.query(
          'INSERT INTO screens (id, cinema_id, name, capacity, format) VALUES (?, ?, ?, ?, ?)',
          [screenId, cinema.id, SCREEN_NAMES[i] || `Screen ${i + 1}`, 80 + Math.floor(Math.random() * 60), fmt]
        );
        screenMap[cinema.id].push({ id: screenId, format: fmt });
        screenId++;
      }
    }
    console.log(`  ${screenId - 1} screens created`);

    // Generate showtimes
    console.log('Generating showtimes...');
    const dates = getDates();
    const MOVIES_PER_CINEMA = Math.min(movies.length, 4);
    let totalInserted = 0;
    const batchSize = 200;
    let batch = [];

    for (const cinema of cinemas) {
      const assignedMovies = pickRandom(movies, MOVIES_PER_CINEMA);
      const screens = screenMap[cinema.id] || [];

      for (const movie of assignedMovies) {
        const numSlotsPerDay = screens.length >= 3 ? 3 : 2;
        const dailySlots = pickRandom(TIME_SLOTS, numSlotsPerDay).sort();

        for (const date of dates) {
          for (let si = 0; si < dailySlots.length; si++) {
            const time = dailySlots[si];
            const screen = screens[si % screens.length];
            if (!screen) continue;

            const [h, m] = time.split(':').map(Number);
            const startDt = new Date(date + 'T' + time + ':00');
            const endDt = new Date(startDt.getTime() + (movie.duration || 120) * 60000);
            const startStr = formatDate(startDt) + ' ' + time + ':00';
            const endStr = formatDate(endDt) + ' ' + pad(endDt.getHours()) + ':' + pad(endDt.getMinutes()) + ':00';

            const fmt = screen.format === 'IMAX' ? 'IMAX' : pickRandom(FORMATS, 1)[0];
            const lang = pickRandom(LANGUAGES, 1)[0];
            const price = fmt === 'IMAX' ? 120000 : fmt === '3D' ? 90000 : 75000;

            batch.push([movie.id, cinema.id, screen.id, date, time, startStr, endStr, fmt, lang, price, 'AVAILABLE']);
            totalInserted++;

            if (batch.length >= batchSize) {
              await conn.query(
                'INSERT INTO showtimes (movie_id, cinema_id, screen_id, date, time, start_time, end_time, format, language, price, status) VALUES ?',
                [batch]
              );
              batch = [];
            }
          }
        }
      }
    }

    if (batch.length > 0) {
      await conn.query(
        'INSERT INTO showtimes (movie_id, cinema_id, screen_id, date, time, start_time, end_time, format, language, price, status) VALUES ?',
        [batch]
      );
    }

    console.log(`  ${totalInserted} showtimes inserted`);

    // Add showtimes unique constraint
    try {
      await conn.query('ALTER TABLE showtimes ADD CONSTRAINT uk_showtime_unique UNIQUE (movie_id, cinema_id, screen_id, start_time)');
      console.log('  showtimes unique constraint added');
    } catch (err) {
      if (err.errno !== 1061) throw err;
    }

    console.log('Seed complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

seed();
