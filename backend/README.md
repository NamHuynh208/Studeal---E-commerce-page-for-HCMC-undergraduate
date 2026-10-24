# Studeal Backend

Nền tảng mua bán giáo trình cũ & đồ dùng sinh viên cho các trường ĐH tại TP.HCM.
Backend dùng **Node.js + Express + sql.js** (SQLite chạy trên WASM, không cần biên dịch C++), kèm escrow (giữ tiền) và phí sàn **2%**.

---

## 1. Chạy nhanh

```bash
cd backend
npm install
npm start
```

Mở: **http://localhost:3001**

`npm start` chạy `node server.js`. Chế độ tự reload: `npm run dev`.

Yêu cầu: **Node.js >= 18** (đã test trên Node v24, Windows 11).

Lần chạy đầu tiên, hệ thống tự tạo CSDL `backend/data/studeal.sqlite` và nạp dữ liệu mẫu.

---

## 2. Tài khoản demo

Mật khẩu chung: **`123456`**

| Email | Vai trò |
|---|---|
| `seller.khtn@studeal.vn` | Người bán – SV ĐH KHTN (đã xác thực) |
| `seller.uit@studeal.vn` | Người bán – SV ĐH CNTT (đã xác thực) |
| `buyer@studeal.vn` | Người mua |

> **Đăng nhập:** nhập email → nhận OTP 6 số → nhập OTP.
> Ở **DEMO MODE**, OTP hiện ngay trên màn hình (ô OTP được tự điền) và in ra console server.

---

## 3. Cấu hình `.env`

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3001` | Cổng chạy API + frontend |
| `DEMO_MODE` | `true` | `true`: trả `debug_otp` trong JSON; `false`: bắt buộc gửi mail thật |
| `JWT_SECRET` | (chuỗi mẫu) | **Đổi trước khi deploy** |
| `EMAIL_USER` | (trống) | Gmail dùng để gửi OTP |
| `EMAIL_APP_PASSWORD` | (trống) | Gmail App Password 16 ký tự |
| `OTP_EXPIRES_MINUTES` | `5` | Hạn OTP |
| `PLATFORM_FEE_PERCENT` | `2` | Phí sàn (%) |
| `VIP_FEE` | `15000` | Phí đẩy tin VIP (đ) |
| `DB_FILE` | `./data/studeal.sqlite` | File CSDL |
| `UPLOAD_DIR` | `./uploads` | Thư mục ảnh upload |
| `FRONTEND_DIR` | `../frontend/public` | Thư mục frontend tĩnh |

### Bật gửi OTP qua Gmail thật

1. Bật **2-Step Verification** cho tài khoản Google.
2. Vào **Google Account → Security → App passwords**, tạo mật khẩu ứng dụng (16 ký tự).
3. Điền vào `.env`:
   ```env
   EMAIL_USER=yourmail@gmail.com
   EMAIL_APP_PASSWORD=abcdefghijklmnop
   ```
4. Đặt `DEMO_MODE=false` nếu muốn ẩn `debug_otp` và bắt buộc gửi mail thành công.
   (Nếu để trống `EMAIL_USER`/`EMAIL_APP_PASSWORD`, hệ thống tự chuyển sang DEMO MODE.)

---

## 4. Nghiệp vụ chính

- **Xác thực sinh viên:** chỉ chấp nhận email `*.edu.vn`; tự nhận diện trường từ tên miền (`hcmus.edu.vn` → `SV ĐH KHTN`, `uit.edu.vn` → `SV ĐH CNTT`, ...). Chỉ sinh viên đã xác thực mới được đăng tin.
- **Đăng tin:** tiêu đề, mô tả, giá, tình trạng, danh mục, ảnh (upload hoặc URL), hình thức giao (meetup / ship / routine KHTN). Tùy chọn **VIP +15.000đ** để đẩy tin lên đầu.
- **Danh sách sản phẩm:** chỉ trả về tin `AVAILABLE`; tin VIP đứng trước. Ẩn email/số điện thoại người bán, chỉ hiện **bí danh ẩn danh** + huy hiệu trường.
- **Trả giá:** chỉ `ACCEPT` / `REJECT`, không có chat. Giá được chấp nhận dùng làm giá thanh toán.
- **Voucher:**
  - `STUDEAL50` — giảm 20%, tối đa 50.000đ
  - `KHTNFREE` — giảm cố định 15.000đ
  - `TANSV2026` — giảm 10%
- **Thanh toán (escrow):** đặt hàng → sản phẩm chuyển `SOLD` ngay, tiền ở trạng thái `HOLDING`.
- **Xác nhận đã nhận hàng:** đơn `COMPLETED`, trừ **2%** phí sàn, cộng **98%** vào ví người bán.

---

## 5. API

Tất cả endpoint dưới `/api`. Endpoint cần đăng nhập dùng header:

```
Authorization: Bearer <token>
```

### Hệ thống
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái + số lượng bản ghi |

### Xác thực
| Method | Endpoint | Body chính |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` → gửi OTP |
| POST | `/api/auth/verify-otp` | `{ email, otp }` → trả `token` |
| POST | `/api/auth/resend-otp` | `{ email }` |
| POST | `/api/auth/verify-student` | `{ student_email }` (cần đăng nhập) |
| GET | `/api/auth/me` | Hồ sơ + ví (cần đăng nhập) |

### Sản phẩm
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/api/products` | Danh sách `AVAILABLE`; hỗ trợ `?q=&category=&school=&sort=` |
| GET | `/api/products/:id` | Chi tiết |
| GET | `/api/products/my` | Tin của tôi (cần đăng nhập) |
| POST | `/api/products` | Đăng tin (cần đăng nhập + đã xác thực SV), `multipart/form-data` với field `image` hoặc `image_url` |

### Trả giá
| Method | Endpoint | Body chính |
|---|---|---|
| POST | `/api/offers` | `{ product_id, offer_price }` |
| GET | `/api/offers/my` | Trả giá đã gửi + nhận được |
| POST | `/api/offers/:id/respond` | `{ status: "ACCEPT" \| "REJECT" }` |

### Voucher
| Method | Endpoint | Body chính |
|---|---|---|
| GET | `/api/vouchers` | Danh sách voucher |
| POST | `/api/vouchers/apply` | `{ code, amount }` → số tiền giảm |

### Đơn hàng & escrow
| Method | Endpoint | Body chính |
|---|---|---|
| POST | `/api/orders/checkout` | `{ product_id, offer_id?, delivery_method, delivery_detail?, voucher_code? }` |
| GET | `/api/orders/my` | Đơn mua + đơn bán |
| GET | `/api/orders/:id` | Chi tiết đơn |
| POST | `/api/orders/:id/confirm-received` | Xác nhận đã nhận → tất toán ví người bán |

### Lỗi
Lỗi trả JSON dạng `{ "error": "..." }` với HTTP status phù hợp (400/401/403/404/409/500).

---

## 6. Frontend

Server phục vụ luôn thư mục tĩnh `../frontend/public` tại `/`:

- `GET /` → `frontend/public/index.html`
- `GET /assets/*` → CSS/JS
- `GET /uploads/*` → ảnh đã upload

Đây là giao diện demo bằng HTML/CSS/JS thuần. Nếu build **Hugo**, chỉ cần trỏ output vào `frontend/public` (hoặc đổi `FRONTEND_DIR`) là dùng được cùng cổng 3001.

---

## 7. Cấu trúc thư mục

```
backend/
├── server.js            # Toàn bộ API, schema, seed, escrow, static
├── package.json
├── .env                 # Cấu hình (không commit)
├── .gitignore
├── data/
│   └── studeal.sqlite   # Tự tạo khi chạy lần đầu
├── uploads/             # Ảnh sản phẩm upload
└── README.md

frontend/public/
├── index.html
└── assets/
    ├── styles.css
    └── app.js
```

---

## 8. Reset dữ liệu về bản mẫu

Dừng server, xóa CSDL rồi chạy lại:

```powershell
Stop-Process -Name node -Force        # hoặc Ctrl+C tại terminal đang chạy
Remove-Item backend/data/studeal.sqlite -Force
Remove-Item backend/uploads/* -Force   # tùy chọn: xóa ảnh test
cd backend
npm start
```

Server sẽ tự tạo lại CSDL và nạp **3 tài khoản – 8 sản phẩm (2 tin VIP) – 3 voucher**.

---

## 9. Ghi chú triển khai

- Đổi `JWT_SECRET` sang chuỗi ngẫu nhiên mạnh.
- Đặt `DEMO_MODE=false` và cấu hình Gmail App Password.
- Phí VIP 15.000đ hiện được **hiển thị và ghi nhận** trong đơn đăng tin nhưng **chưa trừ tiền thật** ở bản demo.
- `sql.js` giữ CSDL trong bộ nhớ và ghi ra file sau mỗi thay đổi — phù hợp demo/đồ án, không dành cho tải cao.
