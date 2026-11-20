> Cập nhật: 2026-11-16

## Đang làm
- Thiết kế lại giao diện kiểu Apple (2026-11-10, CHƯA commit; gói deploy `studeal-deploy-20261110-apple.tar.gz`): bo góc mềm, nav kính mờ, chữ lớn, font Be Vietnam Pro (SF trên máy Apple), chế độ sáng/tối. Đã viết lại `baseof.html`, `header.html`, `footer.html`, `index.html`, `studeal.css`, `studeal.js`; thẻ sản phẩm + bộ lọc trong `studeal-market.js`. Trang /about/: hero viết lại, các mục còn lại chỉnh đồng loạt (bỏ nhãn nhỏ, tăng cỡ chữ). /demo/ giữ nguyên. Version cache CSS/JS `?v=3002`.
- Tính năng mới trên chợ: trang chi tiết sản phẩm (sheet, link chia sẻ `#sp-<id>`), sắp xếp + lọc giá, lưu tin (tim) và dải Bạn vừa xem (localStorage `studeal_saved`, `studeal_recent`), nút sáng/tối (`studeal_theme`). Video hero giờ nằm trong khung bo góc, tự phát lặp khi vào khung nhìn, có nút tạm dừng; ảnh poster `images/hero-poster*.jpg`.
- Còn lại: xem lại thực tế trên điện thoại thật, viết lại bố cục /about/, đóng gói tar.gz, commit. DB local vẫn dùng email demo cũ nên nút Demo đổi tài khoản không đăng nhập được ở local (VM không bị).
- Poster A1 dọc cho Đồ án 1 (CSC00006): `poster/poster.html` (nguồn, đơn vị mm) -> `poster/poster.pdf` (594x841mm). Ảnh chụp web + QR trong `poster/assets/`. Còn chờ nhóm điền 5 thành viên (ảnh, tên, vai trò, MSSV). Xuất lại PDF bằng puppeteer-core + Chrome đã cài (`page.pdf` width 594mm, height 841mm, printBackground).
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

- 2026-11-10: Header thêm nút "Đăng nhập" (data-header-login; trang chủ mở modal, trang khác về /#dang-nhap rồi tự mở modal; ẩn khi đã đăng nhập). Bỏ thanh "Tuyến giao hàng xanh" trên cùng. Hero: "Đồ cũ. / Giá trị mới.". Cache ?v=3003.
- 2026-11-10 (2): Hero "Đồ cũ / Giá trị mới." (bỏ chấm), mô tả tách 2 dòng; "xác thực .edu.vn" → "xác thực mail sinh viên" (footer, hugo.toml, market.js, product-card); khối bento #vi-sao đưa lên trước #san-pham, bỏ dòng "Không phải cho thương lái". Cache ?v=3004.
- 2026-11-10 (3): Tài khoản demo mới: Nguyễn Văn A <nguyenvana@gmail.com> (người mua, user #3), Trần Thị B <xxxxxxxxxx@student.hcmus.edu.vn> (người bán SV KHTN, user #1), mật khẩu 123456. `ensureDemoAccounts()` trong server.js tự đổi tên/email user #1, #3 khi khởi động → deploy lên VM là tự cập nhật, không cần script migrate. Tài khoản UIT (#2) giữ nguyên. Cache ?v=3005.
- 2026-11-10 (4): Tài khoản UIT (#2) → Lê Văn C <xxxxxxxx@gm.uit.edu.vn>, có trong DEMO_ACCOUNT_ROWS; hộp đăng nhập có 3 nút demo (Mua / KHTN / UIT), thanh Demo có thêm nút UIT. Cache ?v=3006.
- 2026-11-10 (5): Nút Đăng nhập header ẩn bằng class `.has-session` trên <html> (pre-paint script đặt khi có `studeal_token`; trang chủ cập nhật lại theo phiên thật trong updateAuthUI). Cache ?v=3007.
- 2026-11-10 (6): Làm rõ định vị "sàn trung gian mua bán đồ cũ giữa sinh viên": pill trên hero (trang chủ + giới thiệu), mô tả hero mới, partial `what-is.html` (Sinh viên bán → Studeal ở giữa → Sinh viên mua) chèn sau hero ở cả 2 trang; about.md có heroTitle mới và mục "Studeal làm gì?".
- 2026-11-10 (7): Bỏ pill "Sàn trung gian…" trên hero (cả 2 trang) theo yêu cầu; giữ mô tả + khối what-is.
- 2026-11-11: Hero có 4 bản video (ngang/dọc × sáng/tối: studeal-promo[-mobile][-dark].mp4, ?v=3101). studeal.js chọn theo .dark + màn ≤767px, đổi theme thì thay nguồn và giữ vị trí (sự kiện 'studeal:theme'). Cache ?v=3008. Deploy: studeal-deploy-20261111-video.tar.gz.
- 2026-11-11 (2): Header có ô tài khoản (avatar + tên + 'Đã xác thực …'/'Chưa xác thực') thay nút Đăng nhập; market.js lưu tóm tắt user vào localStorage 'studeal_user' + phát 'studeal:auth', studeal.js vẽ ở mọi trang; bấm ô → /#tai-khoan mở modal tài khoản. Ở 1024–1279px chỉ hiện avatar để không đè menu. Cache ?v=3009.
- 2026-11-11 (3): Ảnh chia sẻ mới images/og-share-v2.png (tên file mới để Facebook/Messenger không dùng cache ảnh cũ); hugo.toml ogImage + about.md image trỏ tới nó.
- 2026-11-16: Sửa viền trắng quanh video tối: .dark .hero-tile nền #000, video phủ dư 1px; ảnh bìa hero mới cắt từ video mới, có bản tối (hero-poster[-mobile]-v2[-dark].jpg, chọn bằng dark:hidden / hidden dark:block). Cache ?v=3010. Kiểm tra web thật: không tràn ngang/lỗi JS; 4 video không lỗi nội dung (không render lại). CÒN LẠI: viết lại chữ (giảm từ 'escrow', thẻ .edu.vn ở bento trống), chữ <12px ở trang Giới thiệu (46 chỗ), link footer/Maps khó bấm trên điện thoại, tin 'Test1' trên DB thật.
- 2026-11-16 (2): Viết lại chữ: giảm từ "escrow" (chỉ chú thích 1 lần, còn lại "Studeal giữ tiền hộ"), ".edu.vn" → "mail sinh viên", thẻ bento "Chỉ sinh viên thật" có mock mail + huy hiệu; about.md gọn lại (bỏ mục trùng "Studeal làm gì?"), FAQ sửa 2 câu. Chữ <12px nâng lên text-xs (single, index, partials, nhãn "Quảng cáo"); vùng bấm ≥40px cho link footer/link-arrow/Maps trên điện thoại (mục 12 trong studeal.css). Cache ?v=3011. Deploy: studeal-deploy-20261116.tar.gz. Tin "Test1" trên DB thật chưa xóa (dữ liệu của người dùng).
