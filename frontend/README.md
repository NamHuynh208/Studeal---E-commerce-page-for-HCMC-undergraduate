# Studeal – Hugo Frontend

Mã nguồn website Studeal (trang chủ + giới thiệu) viết bằng **Hugo**, không dùng theme rời. Toàn bộ layout nằm trong `layouts/`.

## 1. Yêu cầu

- **Hugo Extended ≥ 0.146** (đã kiểm thử với Hugo 0.168 Extended trên Windows 11)
- Không cần Node.js để build website (Node chỉ cần cho backend).

Cài Hugo trên Windows:

```powershell
winget install Hugo.Hugo.Extended
# hoặc tải bản portable tại https://github.com/gohugoio/hugo/releases
```

Kiểm tra:

```powershell
hugo version
```

## 2. Chạy local

```powershell
cd frontend
hugo server -D
```

Mở **http://localhost:1313**. Server tự reload khi sửa layout/content.

## 3. Build

```powershell
cd frontend
hugo --minify --cleanDestinationDir
```

Kết quả nằm trong `frontend/public/`.

Backend Express đang phục vụ chính thư mục này tại **http://localhost:3001**:

```powershell
cd backend
npm start
```

Sau khi build lại Hugo, chỉ cần tải lại trang 3001 (không cần khởi động lại backend, trừ khi thay đổi `.env`).

> Ứng dụng chợ demo đầy đủ (đăng nhập OTP, đăng tin, trả giá, thanh toán) được giữ tại **`/demo/`** nhờ `static/demo/`. Trang chủ Hugo nằm ở `/`.

## 4. Cấu trúc

```
frontend/
├── hugo.toml                 # Cấu hình site, menu, SEO, sitemap
├── content/
│   └── about.md              # Nội dung trang /about/ (câu chuyện, sứ mệnh)
├── data/
│   ├── products.yaml         # 8 sản phẩm minh họa cho trang chủ
│   ├── faq.yaml              # Câu hỏi thường gặp (xuất cả FAQPage schema)
│   └── routine.yaml          # Lịch tuyến giao hàng xanh CS1 ↔ CS2
├── layouts/
│   ├── _default/
│   │   ├── baseof.html       # Khung HTML, Tailwind/Alpine/FontAwesome/Lucide
│   │   └── single.html       # Trang /about/ + fallback cho trang nội dung
│   ├── partials/
│   │   ├── header.html
│   │   ├── footer.html
│   │   ├── seo.html          # Meta SEO, OpenGraph, Twitter, JSON-LD
│   │   ├── product-card.html
│   │   └── routine-map.html  # Bản đồ SVG tuyến CS1 ↔ CS2
│   ├── index.html            # Trang chủ
│   ├── 404.html
│   ├── robots.txt
│   └── sitemap.xml           # Hugo tự sinh
├── static/
│   ├── css/studeal.css       # Animation, prose, slider, reveal
│   ├── js/studeal.js         # IntersectionObserver + Lucide
│   ├── images/               # favicon, logo, og-cover
│   └── demo/                 # Ứng dụng chợ demo (giữ nguyên)
└── public/                   # Output build (backend phục vụ)
```

## 5. Công nghệ giao diện

- **Tailwind CSS 3** qua CDN, cấu hình palette `brand` (Sky Blue `#0284c7`, `#0ea5e9`, `#f0f9ff`).
- **Alpine.js 3** cho menu mobile, bộ lọc sản phẩm, accordion FAQ, máy tính phí escrow.
- **Font Awesome 6** + **Lucide** cho icon.
- **Plus Jakarta Sans** từ Google Fonts.
- Hiệu ứng: float, marquee trường ĐH, scroll reveal, route dash animation, pulse marker; tôn trọng `prefers-reduced-motion`.

### Quy ước quan trọng: không dùng `{{ }}` trong JavaScript

Hugo dùng `{{ }}` cho Go Template. Vì vậy toàn bộ logic phía client dùng **Alpine.js directives** (`x-data`, `x-text`, `x-bind`, `x-show`, `@click`) và JavaScript thuần trong `static/js/` — không có biến JS nào dùng cú pháp `{{ }}`.

Ví dụ máy tính phí trong `layouts/_default/single.html`:

```html
<div x-data="{ amount: 200000, get fee() { return Math.round(amount * 0.02) } }">
  <span x-text="fee"></span>
</div>
```

Khi thêm code mới, tránh viết hai dấu `{` liền nhau trong file layout.

## 6. SEO

`layouts/partials/seo.html` xuất:

- Title, description, keywords, author, canonical, robots.
- OpenGraph + Twitter Card đầy đủ, ảnh `images/og-cover.png` (1200×630).
- JSON-LD: `Organization`, `WebSite`, `BreadcrumbList`, `ItemList` (sản phẩm trang chủ), `AboutPage` + `FAQPage` (trang giới thiệu).
- `robots.txt` (bật bằng `enableRobotsTXT = true`) và `sitemap.xml` tự sinh.

Sau khi triển khai, kiểm tra:

- `https://namprojects.site/sitemap.xml`
- `https://namprojects.site/robots.txt`
- Rich Results Test cho `AboutPage` / `FAQPage`.

> Khi đổi tên miền, cập nhật `baseURL` trong `hugo.toml`. Ảnh OG và canonical dùng URL tuyệt đối theo `baseURL`.

## 7. Chỉnh nội dung

| Muốn đổi | Sửa tại |
|---|---|
| Sản phẩm trang chủ | `data/products.yaml` |
| Câu hỏi thường gặp | `data/faq.yaml` |
| Lịch tuyến giao hàng | `data/routine.yaml` |
| Câu chuyện, sứ mệnh | `content/about.md` |
| Phí sàn / phí VIP | `hugo.toml` → `[params] platformFee`, `vipFee` |
| Menu | `hugo.toml` → `[[menu.main]]` |
| Màu sắc, animation | `static/css/studeal.css` + `tailwind.config` trong `baseof.html` |

## 8. Triển khai tĩnh

Build xong, upload toàn bộ `frontend/public/` lên hosting tĩnh (Netlify, Vercel, Cloudflare Pages, GitHub Pages…). Không cần server Node cho phần giới thiệu; API demo chỉ hoạt động khi backend chạy.

Nếu deploy lên **GitHub Pages** với đường dẫn con, đổi `baseURL` tương ứng, ví dụ `https://user.github.io/studeal/`.
