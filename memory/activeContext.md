> Cập nhật: 2026-11-02

## Đang làm
- Video motion (Remotion, dự án `D:\Project\Studeal_motion_graphic\studeal-video`) phủ vùng hero trang chủ: tự phát 1 lần (muted), hết video / bấm "Bỏ qua" thì hero hiện lại + nút play giữa hero để xem lại. Gói deploy mới nhất: `studeal-deploy-20261102-mobile.tar.gz` (có cả video dọc).
- Đưa gửi OTP thật qua Resend SMTP (domain `studeal.namprojects.site`) lên VM Google Cloud.
- Đăng ký trên web báo "Hệ thống chưa cấu hình gửi email" => `.env` trên VM chưa có SMTP hợp lệ (`EMAIL_USER`/`EMAIL_APP_PASSWORD`) hoặc chưa restart server.

## Quyết định gần nhất
- Logo mới lấy từ ảnh người dùng cung cấp: `images/logo-mark.png` cho header/footer/demo, `images/logo.png` cho SEO; favicon PNG/ICO và Apple touch icon dùng biểu tượng sách, bỏ chữ và lề trắng.
- Nút Maps CS2 tại `/about/#routine` dùng link chính xác `https://maps.app.goo.gl/k9s2HivTu9jne7dBA`, thay cho tìm kiếm chung Linh Trung.
- Gửi mail: Resend SMTP (465). Nhận mail: Cloudflare Email Routing chuyển về Gmail.
- Chỉ 3 tài khoản demo dùng OTP cố định `DEMO_ACCOUNT_OTP` (không gửi mail); tài khoản khác bắt buộc OTP thật.
- Đăng ký bằng email `.edu.vn` tự xác thực sinh viên sau OTP.
- Bỏ ô "Giá gốc" và phần hiển thị giá gạch/% giảm trên giao diện.
- Đã bỏ dải chữ chạy tên trường (marquee) dưới hero và nút "Bỏ qua" của video (theo yêu cầu).
- Email liên hệ cuối trang: `contact@studeal.namprojects.site`.
- Video hero: `static/video/studeal-promo.mp4` (28s, render --scale=1.5 -> 2880x1620, H.264 CRF 23 -tune animation, faststart, không tiếng, ~9,7MB; 1080p CRF 27 bị mờ chữ trên màn DPI cao). Video có outro 1,6s: chữ rút, thẻ escrow trượt + thu nhỏ về đúng chỗ thẻ hero (đo ở 1440px), nền về #f0f9ff; web chỉ hòa tan 0,9s ở 0,4s cuối, thẻ hero hiện trước rồi chữ trái. Nút play 35px (màn hẹp 30px). URL video có ?v= để Cloudflare không giữ bản cũ. Logic trong `studeal.js` (`initHeroVideo`), CSS `.hero-frame/.hero-video/.hero-play` trong `studeal.css`. Không tự phát khi `prefers-reduced-motion`; không phát được trong 3s thì hiện hero luôn. Màn < 1024px: khung hero thu về cao 16:9 khi phát, nút play ở góc phải trên.
- Bản video dọc cho điện thoại: `static/video/studeal-promo-mobile.mp4` (composition `StudealPortrait` 1080x1920, cắt lại từ cảnh ngang: chữ bước ở trên, panel ở dưới; outro thẻ mờ dần thay vì trượt). `<video>` không có `src`, JS chọn `data-src-mobile` khi màn ≤ 767px, ngược lại `data-src` (chỉ tải 1 file). Màn < 768px khung hero cao `min(177.78vw, 100svh)` khi phát.
- Version cache hiện tại: CSS/JS `?v=2601`, video ngang `?v=2513`, video dọc `?v=2601`. Đổi video nào thì tăng ?v của video đó, và đừng curl URL mới trước khi deploy (Cloudflare sẽ cache bản cũ).

## Chưa commit
- Thay đổi OTP/đăng ký thật, bỏ giá gốc, footer wrap, logo, video hero, `CLAUDE.md`, `memory/`, `.claude/launch.json` (cấu hình preview local).

## Lưu ý triển khai
- Đóng gói: build Hugo rồi tar `backend` + `frontend/public` (loại `.env`, `node_modules`, `data`, `uploads`).
- Cloudflare cache JS tĩnh: cần purge cache sau khi deploy.
