> Cập nhật: 2026-11-10

## Đã xong
- [x] Thiết kế lại kiểu Apple cho trang chủ, /about/, header, footer, toàn bộ chợ; chế độ sáng/tối
- [x] Trang chi tiết sản phẩm + link chia sẻ `#sp-<id>`, sắp xếp + lọc giá, lưu tin, dải Bạn vừa xem
- [x] Sửa: ảnh sản phẩm lỗi không đổi sang ảnh dự phòng, chữ quá nhỏ, nội dung bé trên màn rất rộng, bảng Demo đè nút lên đầu trang
- [x] Poster A1 `poster/poster.pdf` (còn chờ điền 5 thành viên)
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
- [ ] Deploy gói `studeal-deploy-20261110-apple.tar.gz` lên VM, purge cache Cloudflare, xem lại trên điện thoại thật
- [ ] Commit các thay đổi thiết kế lại (chưa commit)
- [ ] Render lại video hero + poster theo phong cách bo góc mới (hiện vẫn góc vuông)
- [ ] Trang /about/: còn vài chỗ thẻ lồng trong thẻ
- [ ] DB local dùng email demo cũ -> nút Demo đổi tài khoản không đăng nhập được ở local
- [ ] Thêm SMTP đúng vào `.env` trên VM, restart, kiểm tra `/api/health` có `email_configured: true`
- [ ] Chạy lệnh đổi email 3 tài khoản demo trong database trên VM
- [ ] Commit và push các thay đổi chưa commit
- [ ] (Tùy chọn) Giới hạn số lần nhập sai OTP
- [ ] Thẻ mẫu ở hero vẫn hiện giá gạch 135.000đ / -59% (chưa bỏ, hỏi lại người dùng)
- [ ] Sửa video thì render lại: `npx remotion render StudealPromo out/studeal-promo-hd.mp4 --codec=h264 --crf=16 --scale=1.5`, nén `-crf 23 -tune animation -movflags +faststart` vào `frontend/static/video/`, tăng `?v=`; bản dọc: `npx remotion render StudealPortrait out/portrait_raw.mp4 --crf=16` rồi nén giống vậy vào `studeal-promo-mobile.mp4`
