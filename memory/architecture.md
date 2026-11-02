> Cập nhật: 2026-11-02

## Stack
- Backend: Node >= 18, Express, sql.js (SQLite WASM, giữ trong RAM, ghi ra `backend/data/studeal.sqlite`), nodemailer, JWT, bcryptjs, multer
- Frontend: Hugo Extended (không theme), Tailwind, JS thuần
- Hạ tầng: VM Google Cloud (E2 small), Cloudflare (DNS + cache), Resend (gửi mail), Cloudflare Email Routing (nhận mail)

## Cấu trúc
- `backend/server.js`: một file duy nhất, chia mục bằng banner (cấu hình, tiện ích, DB, email/OTP, auth, route)
- Express phục vụ luôn `/api/*`, `/uploads` và `frontend/public` => hai thư mục phải nằm cạnh nhau
- `frontend/static/js/studeal-market.js`: giao diện chợ chính; `frontend/static/demo/`: app demo riêng (sửa UI thường phải sửa cả hai)

## Quy ước
- Email luôn chuẩn hóa chữ thường (`normalizeEmail`); hằng số và dữ liệu mẫu phải viết thường
- Đổi dữ liệu mẫu trong code không đổi DB đã tồn tại; cần script migrate (dừng server trước)
- `backend/.env` không commit; `*.tar.gz` và `frontend/public/` bị gitignore
- Video hero lấy từ dự án Remotion riêng `D:\Project\Studeal_motion_graphic\studeal-video` (composition `StudealPromo`, 1920x1080, 30fps, 28s; bản dọc `StudealPortrait` 1080x1920 cho điện thoại); bản web nằm ở `frontend/static/video/`
- Đổi CSS/JS tĩnh thì tăng `?v=` trong `baseof.html` / `index.html` (Cloudflare cache)
