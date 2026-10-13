# Triển khai CineX lên Railway

Ứng dụng được triển khai thành một dịch vụ web duy nhất (React + API Node.js) và một dịch vụ MySQL. Railway cấp domain HTTPS công khai nên không cần chạy máy local hoặc ngrok.

## 1. Đưa mã nguồn lên GitHub

Tạo một repository riêng tư, sau đó đẩy dự án lên đó. File `.env`, `node_modules` và `dist` đã được loại khỏi Git; tuyệt đối không đưa khóa bí mật trong `.env` lên GitHub.

## 2. Tạo dự án Railway

1. Mở <https://railway.com/new> và đăng nhập.
2. Chọn **Empty Project**.
3. Chọn **+ New → Database → MySQL**.
4. Chọn **+ New → GitHub Repo**, rồi chọn repository CineX.

## 3. Kết nối ứng dụng với MySQL

Trong dịch vụ web, mở **Variables → Raw Editor** và thêm các biến sau. Nếu dịch vụ database không tên `MySQL`, thay `MySQL` bằng đúng tên hiển thị trên Railway.

```env
NODE_ENV=production
MYSQLHOST=${{MySQL.MYSQLHOST}}
MYSQLPORT=${{MySQL.MYSQLPORT}}
MYSQLUSER=${{MySQL.MYSQLUSER}}
MYSQLPASSWORD=${{MySQL.MYSQLPASSWORD}}
MYSQLDATABASE=${{MySQL.MYSQLDATABASE}}
JWT_SECRET=thay-bang-chuoi-ngau-nhien-dai-it-nhat-32-ky-tu
```

Không cần đặt `PORT`; Railway tự cấp biến này. Lần triển khai đầu, lệnh `db:prepare` sẽ chỉ khởi tạo dữ liệu mẫu khi database còn trống, sau đó áp dụng migration.

## 4. Thêm khóa dịch vụ

Trong cùng phần **Variables**, sao chép các giá trị thật cần dùng từ `.env` local. Tối thiểu cho luồng thanh toán và dữ liệu phim:

```env
PAYOS_CLIENT_ID=...
PAYOS_API_KEY=...
PAYOS_CHECKSUM_KEY=...
TMDB_API_KEY=...
NVIDIA_API_KEY=...
YOUTUBE_API_KEY=...
```

Nếu dùng đăng nhập Firebase/Google, thêm cả các biến `VITE_FIREBASE_*`, `FIREBASE_*` và `GOOGLE_CLIENT_ID` trong `.env.example`. Các biến `VITE_*` được đóng gói lúc build, vì vậy thay đổi chúng sẽ kích hoạt một lần build/deploy mới.

## 5. Cấp domain và triển khai

1. Trong dịch vụ web, mở **Settings → Networking → Generate Domain**.
2. Chọn **Deploy** nếu Railway đang chờ áp dụng thay đổi.
3. Khi hoàn tất, kiểm tra:
   - Trang web: `https://<domain-railway>`
   - API: `https://<domain-railway>/api/health`

Ứng dụng tự dùng `RAILWAY_PUBLIC_DOMAIN` cho CORS và URL quay lại từ PayOS. Nếu gắn domain riêng, thêm:

```env
CLIENT_URL=https://ten-mien-cua-ban.vn
```

## 6. Cập nhật PayOS webhook

Trong trang quản trị PayOS, đặt webhook thành:

```text
https://<domain-cua-ban>/api/v1/webhooks/payos
```

Sau đó thử một giao dịch giá trị nhỏ và xác nhận trang thành công, trạng thái booking và vé đều được cập nhật. Từ thời điểm này không dùng URL ngrok nữa.

## 7. Cập nhật về sau

Mỗi lần đẩy commit mới lên nhánh đã kết nối, Railway sẽ tự build và triển khai lại. Theo dõi **Deploy Logs** nếu health check hoặc migration thất bại.
