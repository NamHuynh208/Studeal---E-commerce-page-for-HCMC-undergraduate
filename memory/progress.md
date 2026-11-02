> Cập nhật: 2026-11-02

## Đã xong
- [x] Video motion ở hero: tự phát, chuyển cảnh mờ/phóng về hero, nút xem lại, nút bỏ qua, hỗ trợ reduced-motion và màn hẹp
- [x] Bản video dọc 9:16 riêng cho điện thoại (`StudealPortrait`)
- [x] Thay logo hiển thị (header/footer và demo), favicon trình duyệt và logo SEO bằng ảnh người dùng cung cấp.
- [x] Sửa link nút Maps CS2 tại `/about/#routine` theo địa chỉ cơ sở 2 được cung cấp.
- [x] Backend Express + sql.js: auth OTP, sản phẩm, trả giá, voucher, đơn hàng escrow (phí 2%)
- [x] Gửi OTP qua SMTP (nodemailer), cấu hình mặc định Resend
- [x] OTP cố định cho 3 tài khoản demo, tài khoản thật không lộ `debug_otp`
- [x] Đăng ký thật, tự xác thực sinh viên với email `.edu.vn`, giới hạn gửi lại OTP 60s
- [x] Đổi email demo sang email thật; bỏ giá gốc; sửa footer
- [x] Tài liệu: `backend/README.md`, `CLAUDE.md`

## Việc tiếp theo
- [ ] Thêm SMTP đúng vào `.env` trên VM, restart, kiểm tra `/api/health` có `email_configured: true`
- [ ] Chạy lệnh đổi email 3 tài khoản demo trong database trên VM
- [ ] Commit và push các thay đổi chưa commit
- [ ] (Tùy chọn) Giới hạn số lần nhập sai OTP
- [ ] Thẻ mẫu ở hero vẫn hiện giá gạch 135.000đ / -59% (chưa bỏ, hỏi lại người dùng)
- [ ] Sửa video thì render lại: `npx remotion render StudealPromo out/studeal-promo-hd.mp4 --codec=h264 --crf=16 --scale=1.5`, nén `-crf 23 -tune animation -movflags +faststart` vào `frontend/static/video/`, tăng `?v=`; bản dọc: `npx remotion render StudealPortrait out/portrait_raw.mp4 --crf=16` rồi nén giống vậy vào `studeal-promo-mobile.mp4`
