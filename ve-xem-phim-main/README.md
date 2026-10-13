# CineX - Website đặt vé xem phim tích hợp AI

CineX là website hỗ trợ người dùng tìm phim, chọn rạp và suất chiếu, đặt ghế, thanh toán và quản lý vé trực tuyến. Trợ lý AI giúp tìm kiếm và thực hiện quy trình đặt vé bằng hội thoại.

## Phạm vi

Hệ thống có hai vai trò:

- `user`: xem phim, tìm suất chiếu, đặt ghế, thanh toán và quản lý vé cá nhân.
- `admin`: quản lý dữ liệu phim, rạp, suất chiếu, khuyến mãi, người dùng và theo dõi đơn đặt vé.

Đây là website đặt vé trực tuyến, không phải hệ thống quản lý vận hành rạp hoặc bán vé tại quầy.

## Chạy dự án

```bash
npm install
npm run dev:all
```

Frontend mặc định chạy bằng Vite; backend được khởi động từ `server/index.cjs`.

## Khởi tạo cơ sở dữ liệu

Trên Windows, chạy `setup.bat` và nhập mật khẩu MySQL khi được yêu cầu.

Tài khoản quản trị mẫu:

- Email: `admin@cinex.vn`
- Mật khẩu: `admin123`

## Kiểm tra chất lượng

```bash
npm test
npm run lint
npm run build
```

## Dịch vụ bên ngoài

Một số chức năng cần cấu hình biến môi trường trong `.env`, gồm TMDB, Google Maps/Places, Firebase, PayOS và dịch vụ AI. Xem `.env.example` để biết các biến cần thiết; không đưa khóa bí mật thật vào Git.

Khi `TMDB_API_KEY` được cấu hình, backend tự đồng bộ thông tin phim lúc khởi động và sau mỗi 12 giờ. Có thể điều chỉnh lịch và phạm vi đồng bộ bằng các biến `TMDB_SYNC_*` trong `.env`.

Nếu phim chưa có trailer, backend dùng YouTube Data API để tìm và bổ sung tự động trong cùng chu kỳ. Cấu hình `YOUTUBE_API_KEY` và giới hạn lượt tìm bằng `YOUTUBE_TRAILER_SYNC_LIMIT` để kiểm soát quota.

Sau khi đồng bộ phim, backend tự phân bổ lịch chiếu an toàn cho phim mới bằng các suất tương lai chưa có người đặt hoặc giữ ghế. Trang chủ chỉ dùng phim thật sự có lịch tương lai cho banner và mục Đang chiếu; mục Sắp chiếu được xếp theo ngày phát hành gần nhất.
