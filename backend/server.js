/**
 * ============================================================================
 *  STUDEAL - BACKEND API
 *  Nền tảng mua bán giáo trình cũ & đồ dùng sinh viên các trường ĐH TP.HCM
 * ----------------------------------------------------------------------------
 *  Stack : Node.js + Express + sql.js (SQLite WASM - không cần biên dịch C++)
 *          Multer + CORS + Nodemailer + JWT + bcryptjs
 *  Chạy  : node server.js  ->  http://localhost:3001
 *  Static: ../frontend/public (Hugo public) + /uploads
 *  Phí   : 2% mỗi giao dịch, escrow HOLDING -> COMPLETED
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const initSqlJs = require('sql.js');

require('dotenv').config({ path: path.join(__dirname, '.env') });

/* ============================================================================
 * 1. CẤU HÌNH
 * ========================================================================== */

const PORT = Number(process.env.PORT || 3001);
const NODE_ENV = process.env.NODE_ENV || 'development';
const DEMO_MODE = String(process.env.DEMO_MODE || 'true').toLowerCase() !== 'false';

const JWT_SECRET = process.env.JWT_SECRET || 'studeal_dev_secret_change_me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const OTP_TTL_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRES_MINUTES || 5));
const PLATFORM_FEE_RATE = Math.max(0, Number(process.env.PLATFORM_FEE_PERCENT || 2)) / 100;
const VIP_FEE = Math.max(0, Number(process.env.VIP_FEE || 15000));

const DB_FILE = path.resolve(__dirname, process.env.DB_FILE || './data/studeal.sqlite');
const UPLOAD_DIR = path.resolve(__dirname, process.env.UPLOAD_DIR || './uploads');
const FRONTEND_DIR = path.resolve(__dirname, process.env.FRONTEND_DIR || '../frontend/public');
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');

const CATEGORIES = ['Giáo trình', 'Điện tử', 'Đồ trọ', 'Dụng cụ học tập'];
const CONDITIONS = ['Mới 99%', 'Khá 90%', 'Cũ dùng tốt'];
const DELIVERY_METHODS = ['MEETUP', 'SHIP_3RD', 'KHTN_ROUTINE'];
const DELIVERY_LABELS = {
  MEETUP: 'Gặp trực tiếp',
  SHIP_3RD: 'Ship bên thứ 3',
  KHTN_ROUTINE: 'Tuyến KHTN miễn phí',
};

// Bản đồ email sinh viên -> tên trường hiển thị trên huy hiệu.
// domains khớp cả domain con, ví dụ gm.uit.edu.vn, student.hcmus.edu.vn, st.ueh.edu.vn.
const UNIVERSITY_DOMAINS = [
  { domains: ['hcmus.edu.vn'], name: 'SV ĐH KHTN' },
  { domains: ['uit.edu.vn'], name: 'SV ĐH CNTT' },
  { domains: ['hcmut.edu.vn'], name: 'SV ĐH Bách Khoa' },
  { domains: ['ueh.edu.vn'], name: 'SV ĐH Kinh tế TP.HCM' },
  { domains: ['vanlanguni.edu.vn'], name: 'SV ĐH Văn Lang' },
  { domains: ['hcmute.edu.vn'], name: 'SV ĐH Sư phạm Kỹ thuật TP.HCM' },
  { domains: ['ufm.edu.vn'], name: 'SV ĐH Tài chính - Marketing' },
  { domains: ['iu.edu.vn'], name: 'SV ĐH Quốc tế - VNU' },
  { domains: ['hcmulaw.edu.vn'], name: 'SV ĐH Luật TP.HCM' },
  { domains: ['uhs.edu.vn'], name: 'SV ĐH KHXH&NV' },
  { domains: ['ump.edu.vn'], name: 'SV ĐH Y Dược TP.HCM' },
  { domains: ['hcmuaf.edu.vn'], name: 'SV ĐH Nông Lâm TP.HCM' },
  { domains: ['hcmue.edu.vn'], name: 'SV ĐH Sư phạm TP.HCM' },
  { domains: ['tdtu.edu.vn'], name: 'SV ĐH Tôn Đức Thắng' },
  { domains: ['ntt.edu.vn'], name: 'SV ĐH Nguyễn Tất Thành' },
  { domains: ['huflit.edu.vn'], name: 'SV ĐH Ngoại ngữ - Tin học TP.HCM' },
  { domains: ['ou.edu.vn'], name: 'SV ĐH Mở TP.HCM' },
  { domains: ['ut.edu.vn'], name: 'SV ĐH Giao thông Vận tải TP.HCM' },
  { domains: ['buh.edu.vn'], name: 'SV ĐH Ngân hàng TP.HCM' },
  { domains: ['sgu.edu.vn'], name: 'SV ĐH Sài Gòn' },
  { domains: ['vlu.edu.vn'], name: 'SV ĐH Văn Lang' },
];

/* ============================================================================
 * 2. TIỆN ÍCH CHUNG
 * ========================================================================== */

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

const fail = (status, message, details) => {
  throw new HttpError(status, message, details);
};

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const cleanText = (value, maxLength = 500) =>
  String(value == null ? '' : value)
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLength);

const normalizeEmail = (value) => cleanText(value, 160).toLowerCase();

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || '');

const parseId = (value, label = 'ID') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) fail(400, `${label} không hợp lệ`);
  return id;
};

const parseMoney = (value, label = 'Số tiền') => {
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d]/g, '');
    if (normalized === '') fail(400, `${label} không hợp lệ`);
    return Number(normalized);
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) fail(400, `${label} không hợp lệ`);
  return Math.round(amount);
};

const parseBool = (value) => {
  if (value === true || value === 1) return true;
  if (value === false || value === 0 || value == null) return false;
  return ['1', 'true', 'on', 'yes', 'y', 'có'].includes(String(value).trim().toLowerCase());
};

const asBool = (value) => value === 1 || value === true || value === '1';

const escapeHtml = (value) =>
  String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const nowIso = () => new Date().toISOString();

const otpExpiryIso = () => new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Chống giao dịch ngoài luồng: che SĐT 10 số, email, link Zalo/Facebook...
 * Ví dụ: "Alo 0912 345 678, zalo.me/abc" -> "Alo ***, ***"
 */
const sanitizeDescription = (input) => {
  let text = String(input == null ? '' : input).slice(0, 3000);
  // Link liên hệ / sàn ngoài
  text = text.replace(
    /\b(?:https?:\/\/|www\.)\S+/gi,
    '***'
  );
  text = text.replace(
    /\b(?:zalo\.me|zalo\.com|facebook\.com|fb\.com|fb\.me|messenger\.com|m\.me|t\.me|telegram\.me|instagram\.com|tiktok\.com|shopee\.vn|lazada\.vn)\S*/gi,
    '***'
  );
  // Email
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '***');
  // SĐT Việt Nam: 0xxxxxxxxx / +84xxxxxxxxx (cho phép khoảng trắng, dấu chấm, gạch)
  text = text.replace(/(?:\+?84|0)(?:[ .-]?\d){9}\b/g, '***');
  // Mọi chuỗi 10 chữ số còn lại
  text = text.replace(/\b\d{10}\b/g, '***');
  return text.trim();
};

const resolveUniversity = (studentEmail) => {
  const domain = studentEmail.split('@')[1] || '';
  if (!domain.endsWith('.edu.vn')) {
    fail(400, 'Vui lòng dùng email sinh viên có đuôi .edu.vn (ví dụ: @student.hcmus.edu.vn, @gm.uit.edu.vn).');
  }
  const matched = UNIVERSITY_DOMAINS.find((item) =>
    item.domains.some((base) => domain === base || domain.endsWith(`.${base}`))
  );
  if (matched) return matched.name;
  // Chấp nhận mọi trường .edu.vn khác, tạo huy hiệu ngắn từ tên miền.
  const label = domain.replace(/\.edu\.vn$/i, '').split('.').pop().toUpperCase();
  return `SV ${label}`;
};

/* ============================================================================
 * 3. DATABASE (sql.js - SQLite WASM)
 * ========================================================================== */

let db = null;
let txDepth = 0;

function persist() {
  if (!db) return;
  const bytes = Buffer.from(db.export());
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, bytes);
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    // Fallback cho Windows nếu rename bị khóa bởi antivirus/indexer.
    fs.writeFileSync(DB_FILE, bytes);
    try { fs.unlinkSync(tempFile); } catch { /* ignore */ }
  }
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  const result = {
    changes: db.getRowsModified(),
    lastInsertId: Number((get('SELECT last_insert_rowid() AS id') || {}).id || 0),
  };
  if (txDepth === 0) persist();
  return result;
}

function tx(fn) {
  if (txDepth > 0) return fn();
  db.run('BEGIN IMMEDIATE');
  txDepth += 1;
  try {
    const result = fn();
    db.run('COMMIT');
    txDepth -= 1;
    persist();
    return result;
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* ignore */ }
    txDepth -= 1;
    throw error;
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  email                 TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  is_student_verified   INTEGER NOT NULL DEFAULT 0,
  student_email         TEXT,
  university_name       TEXT,
  wallet_balance        INTEGER NOT NULL DEFAULT 0,
  otp_code              TEXT,
  otp_expires           TEXT,
  otp_purpose           TEXT,
  pending_student_email TEXT,
  pending_university_name TEXT,
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id          INTEGER NOT NULL,
  title              TEXT NOT NULL,
  category           TEXT NOT NULL,
  condition_text     TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  original_price     INTEGER NOT NULL DEFAULT 0,
  price              INTEGER NOT NULL,
  image_url          TEXT,
  allow_meetup       INTEGER NOT NULL DEFAULT 1,
  meetup_location    TEXT,
  allow_ship_3rd     INTEGER NOT NULL DEFAULT 0,
  allow_khtn_routine INTEGER NOT NULL DEFAULT 0,
  is_promoted        INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'AVAILABLE',
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL,
  buyer_id    INTEGER NOT NULL,
  seller_id   INTEGER NOT NULL,
  offer_price INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'PENDING',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (buyer_id)   REFERENCES users(id),
  FOREIGN KEY (seller_id)  REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS orders (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  buyer_id                 INTEGER NOT NULL,
  seller_id                INTEGER NOT NULL,
  product_id               INTEGER NOT NULL,
  final_price              INTEGER NOT NULL,
  discount_amount          INTEGER NOT NULL DEFAULT 0,
  buyer_paid_amount        INTEGER NOT NULL,
  platform_fee_2_percent   INTEGER NOT NULL,
  seller_receive_amount    INTEGER NOT NULL,
  delivery_method          TEXT NOT NULL,
  delivery_detail          TEXT,
  escrow_status            TEXT NOT NULL DEFAULT 'HOLDING',
  offer_id                 INTEGER,
  voucher_code             TEXT,
  created_at               TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id)   REFERENCES users(id),
  FOREIGN KEY (seller_id)  REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS vouchers (
  code             TEXT PRIMARY KEY,
  discount_percent REAL NOT NULL,
  max_discount     INTEGER NOT NULL DEFAULT 0,
  description      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_products_status      ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_seller      ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_promoted    ON products(is_promoted);
CREATE INDEX IF NOT EXISTS idx_offers_product       ON offers(product_id);
CREATE INDEX IF NOT EXISTS idx_offers_buyer         ON offers(buyer_id);
CREATE INDEX IF NOT EXISTS idx_offers_seller        ON offers(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer         ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller        ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_escrow        ON orders(escrow_status);
`;

async function initDatabase() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, 'node_modules', 'sql.js', 'dist', file),
  });

  const exists = fs.existsSync(DB_FILE) && fs.statSync(DB_FILE).size > 0;
  if (exists) {
    db = new SQL.Database(new Uint8Array(fs.readFileSync(DB_FILE)));
    console.log(`[db] Đã mở CSDL: ${DB_FILE}`);
  } else {
    db = new SQL.Database();
    console.log(`[db] Tạo CSDL mới: ${DB_FILE}`);
  }

  db.run('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  const userCount = Number((get('SELECT COUNT(*) AS count FROM users') || {}).count || 0);
  if (userCount === 0) {
    seedDatabase();
    console.log('[db] Đã nạp dữ liệu mẫu (3 users, 8 products, 3 vouchers).');
  }

  persist();
}

function seedDatabase() {
  const passwordHash = bcrypt.hashSync('123456', 10);
  const now = Date.now();
  const iso = (daysAgo, hoursAgo = 0) =>
    new Date(now - daysAgo * 86_400_000 - hoursAgo * 3_600_000).toISOString();

  tx(() => {
    /* ---------------------------- USERS ---------------------------- */
    run(
      `INSERT INTO users
        (id, name, email, password_hash, is_student_verified, student_email, university_name, wallet_balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Nguyễn Minh Anh', '2612205118@student.hcmus.edu.vn', passwordHash, 1,
        'minhanh@student.hcmus.edu.vn', 'SV ĐH KHTN', 0, iso(60)]
    );
    run(
      `INSERT INTO users
        (id, name, email, password_hash, is_student_verified, student_email, university_name, wallet_balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [2, 'Trần Quốc Bảo', 'nnamhuynh2008luuanh1@gmail.com', passwordHash, 1,
        'baotq@gm.uit.edu.vn', 'SV ĐH CNTT', 0, iso(55)]
    );
    run(
      `INSERT INTO users
        (id, name, email, password_hash, is_student_verified, student_email, university_name, wallet_balance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [3, 'Lê Thu Hà', 'namhuynhnhat2008@gmail.com', passwordHash, 0, null, null, 0, iso(50)]
    );

    /* --------------------------- PRODUCTS -------------------------- */
    const products = [
      {
        sellerId: 1,
        title: 'Giáo trình Giải tích 1 - ĐH KHTN (bản in mới)',
        category: 'Giáo trình',
        condition: 'Khá 90%',
        description:
          'Giáo trình Giải tích 1 bản in ĐH KHTN, sách sạch, chỉ vài nét gạch chân bằng bút chì. ' +
          'Tặng kèm đề cương ôn tập HK1 và bộ đề giữa kỳ. Nhận tại CS1 Nguyễn Văn Cừ hoặc gửi tuyến KHTN miễn phí sang CS2 Linh Trung.',
        originalPrice: 135000,
        price: 55000,
        image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH KHTN CS1 - 227 Nguyễn Văn Cừ, Quận 5',
        ship: true,
        khtn: true,
        promoted: true,
        daysAgo: 1,
      },
      {
        sellerId: 2,
        title: 'Sách Cấu trúc dữ liệu & Giải thuật (UIT)',
        category: 'Giáo trình',
        condition: 'Khá 90%',
        description:
          'Sách Cấu trúc dữ liệu và Giải thuật dùng cho môn CTDL&GT tại UIT. Còn đầy đủ phụ lục, ' +
          'một số trang có ghi chú highlight phục vụ ôn thi. Phù hợp SV năm 2 chuẩn bị qua môn.',
        originalPrice: 165000,
        price: 75000,
        image: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH CNTT - Khu phố 6, Linh Trung, Thủ Đức',
        ship: true,
        khtn: false,
        promoted: false,
        daysAgo: 2,
      },
      {
        sellerId: 1,
        title: 'Máy tính Casio FX-580VNX chính hãng',
        category: 'Dụng cụ học tập',
        condition: 'Mới 99%',
        description:
          'Máy tính Casio FX-580VNX mua đầu năm học, dùng thi 1 kỳ nên còn rất mới. Đầy đủ hộp, ' +
          'sách hướng dẫn và pin. Đã dán keo bảo vệ màn hình, phím bấm êm, không lỗi.',
        originalPrice: 780000,
        price: 390000,
        image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH KHTN CS1 - 227 Nguyễn Văn Cừ, Quận 5',
        ship: true,
        khtn: true,
        promoted: true,
        daysAgo: 3,
      },
      {
        sellerId: 2,
        title: 'Đèn học chống cận 3 chế độ sáng',
        category: 'Đồ trọ',
        condition: 'Khá 90%',
        description:
          'Đèn bàn LED chống cận, 3 chế độ ánh sáng trắng - vàng - tự nhiên, có ngăn đựng bút. ' +
          'Phù hợp phòng trọ nhỏ, đã dùng 6 tháng, hoạt động ổn định. Tặng kèm bóng LED dự phòng.',
        originalPrice: 320000,
        price: 115000,
        image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH CNTT - Linh Trung, Thủ Đức',
        ship: true,
        khtn: false,
        promoted: false,
        daysAgo: 4,
      },
      {
        sellerId: 1,
        title: 'Balo laptop chống sốc 15.6 inch',
        category: 'Đồ trọ',
        condition: 'Khá 90%',
        description:
          'Balo laptop chống sốc vừa 15.6 inch, nhiều ngăn, có cổng sạc USB. Quai đeo êm, ' +
          'khóa kéo trơn, chỉ hơi cũ ở phần đáy. Rất hợp cho SV đi học cả ngày.',
        originalPrice: 620000,
        price: 245000,
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH KHTN CS2 - Linh Trung, Thủ Đức',
        ship: true,
        khtn: true,
        promoted: false,
        daysAgo: 5,
      },
      {
        sellerId: 2,
        title: 'Giáo trình Kinh tế vi mô (UEH) - bản đẹp',
        category: 'Giáo trình',
        condition: 'Mới 99%',
        description:
          'Giáo trình Kinh tế vi mô bản UEH, gần như mới, không ghi chú. Dùng cho môn Kinh tế vi mô ' +
          'đại cương, có phần bài tập tình huống và đề mẫu cuối kỳ. Phù hợp cả SV ngoài UEH học liên thông.',
        originalPrice: 145000,
        price: 65000,
        image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH CNTT - Linh Trung, Thủ Đức',
        ship: true,
        khtn: false,
        promoted: false,
        daysAgo: 6,
      },
      {
        sellerId: 2,
        title: 'Tai nghe Bluetooth không dây pin 30h',
        category: 'Điện tử',
        condition: 'Cũ dùng tốt',
        description:
          'Tai nghe Bluetooth over-ear, pin dùng được khoảng 30 giờ, kết nối ổn định. ' +
          'Đã thay đệm tai mới, âm bass tốt. Phù hợp học online và nghe nhạc. Tặng kèm cáp sạc Type-C.',
        originalPrice: 850000,
        price: 320000,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH CNTT - Linh Trung, Thủ Đức',
        ship: true,
        khtn: false,
        promoted: false,
        daysAgo: 7,
      },
      {
        sellerId: 1,
        title: 'Bộ dụng cụ vẽ kỹ thuật cho SV năm 1',
        category: 'Dụng cụ học tập',
        condition: 'Khá 90%',
        description:
          'Bộ compa, thước chữ T, thước đo độ, bút chì kim và bộ màu vẽ kỹ thuật. Đã dùng cho ' +
          'môn Hình học họa hình, còn đủ bộ và sạch. Phù hợp SV KHTN, Bách Khoa, Kiến trúc.',
        originalPrice: 190000,
        price: 78000,
        image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=80',
        meetup: true,
        meetupLocation: 'ĐH KHTN CS1 - 227 Nguyễn Văn Cừ, Quận 5',
        ship: false,
        khtn: true,
        promoted: false,
        daysAgo: 8,
      },
    ];

    for (const product of products) {
      run(
        `INSERT INTO products
          (seller_id, title, category, condition_text, description, original_price, price, image_url,
           allow_meetup, meetup_location, allow_ship_3rd, allow_khtn_routine, is_promoted, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
        [
          product.sellerId,
          product.title,
          product.category,
          product.condition,
          sanitizeDescription(product.description),
          product.originalPrice,
          product.price,
          product.image,
          product.meetup ? 1 : 0,
          product.meetupLocation,
          product.ship ? 1 : 0,
          product.khtn ? 1 : 0,
          product.promoted ? 1 : 0,
          iso(product.daysAgo),
        ]
      );
    }

    /* --------------------------- VOUCHERS -------------------------- */
    run(
      'INSERT INTO vouchers (code, discount_percent, max_discount, description) VALUES (?, ?, ?, ?)',
      ['STUDEAL50', 20, 50000, 'Giảm 20% tối đa 50.000đ cho mọi đơn hàng']
    );
    run(
      'INSERT INTO vouchers (code, discount_percent, max_discount, description) VALUES (?, ?, ?, ?)',
      ['KHTNFREE', 100, 15000, 'Giảm thẳng 15.000đ - ưu đãi sinh viên KHTN']
    );
    run(
      'INSERT INTO vouchers (code, discount_percent, max_discount, description) VALUES (?, ?, ?, ?)',
      ['TANSV2026', 10, 0, 'Tân sinh viên 2026 giảm 10%, không giới hạn mức giảm']
    );
  });
}

/* ============================================================================
 * 4. EMAIL / OTP
 * ========================================================================== */

let transporter = null;
let emailConfigured = false;

function setupMailer() {
  const user = cleanText(process.env.EMAIL_USER, 160);
  const rawPassword = cleanText(process.env.EMAIL_APP_PASSWORD, 100);
  const password = rawPassword.replace(/\s+/g, '');

  if (!user || !password) {
    emailConfigured = false;
    console.log('[email] Chưa cấu hình SMTP (EMAIL_USER / EMAIL_APP_PASSWORD) -> chạy DEMO MODE (OTP in ra console + debug_otp).');
    return;
  }

  const port = Number(process.env.EMAIL_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure: String(process.env.EMAIL_SECURE || 'true').toLowerCase() !== 'false',
    auth: { user, pass: password },
  });
  emailConfigured = true;

  transporter.verify()
    .then(() => console.log(`[email] SMTP sẵn sàng, gửi OTP từ ${user}.`))
    .catch((error) => console.warn(`[email] Không kết nối được SMTP: ${error.message}. Sẽ dùng debug_otp khi DEMO_MODE=true.`));
}

function otpEmailHtml({ name, code, purpose }) {
  const action = purpose === 'STUDENT'
    ? 'xác thực email sinh viên'
    : purpose === 'REGISTER'
      ? 'hoàn tất đăng ký'
      : 'đăng nhập';

  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#14261d;">
    <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2ebe6;">
      <div style="background:linear-gradient(135deg,#0f5132,#1f8a5b);padding:26px 28px;color:#fff;">
        <div style="font-size:13px;letter-spacing:2px;opacity:.8;text-transform:uppercase;">Studeal</div>
        <h1 style="margin:8px 0 0;font-size:23px;">Mã OTP ${escapeHtml(action)}</h1>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 12px;font-size:15px;">Xin chào <strong>${escapeHtml(name)}</strong>,</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;">
          Đây là mã OTP của bạn. Mã có hiệu lực trong <strong>${OTP_TTL_MINUTES} phút</strong>.
        </p>
        <div style="background:#eef8f2;border:1px dashed #1f8a5b;border-radius:14px;padding:18px;text-align:center;">
          <div style="font-size:12px;color:#547064;letter-spacing:2px;text-transform:uppercase;">Mã xác thực</div>
          <div style="font-size:38px;font-weight:800;letter-spacing:10px;color:#0f5132;margin-top:6px;">${code}</div>
        </div>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#5b6f65;">
          Vì lý do bảo mật, tuyệt đối không chia sẻ mã này cho bất kỳ ai.
          Studeal chỉ giao dịch qua nền tảng và giữ tiền escrow đến khi bạn xác nhận đã nhận hàng.
        </p>
      </div>
      <div style="padding:16px 28px;background:#f7faf8;font-size:12px;color:#7b8d84;border-top:1px solid #e2ebe6;">
        Email tự động từ Studeal - Nền tảng mua bán đồ dùng sinh viên TP.HCM.
      </div>
    </div>
  </body>
</html>`;
}

async function deliverOtp({ to, code, name, purpose }) {
  if (!transporter) {
    console.log(
      `\n[Studeal][DEMO OTP] ${String(purpose || 'LOGIN').padEnd(8)} | ${to} | ${code} | hết hạn ${OTP_TTL_MINUTES} phút\n`
    );
    if (!DEMO_MODE) {
      fail(503, 'Chưa cấu hình EMAIL_USER / EMAIL_APP_PASSWORD nên không thể gửi OTP. Hãy bật DEMO_MODE=true để demo.');
    }
    return { sent: false, demo: true };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `Studeal <${process.env.EMAIL_USER}>`,
      to,
      subject: `[Studeal] Mã OTP ${purpose === 'STUDENT' ? 'xác thực sinh viên' : 'đăng nhập'} của bạn`,
      text: `Xin chào ${name}, mã OTP Studeal của bạn là ${code}. Mã có hiệu lực ${OTP_TTL_MINUTES} phút.`,
      html: otpEmailHtml({ name, code, purpose }),
    });
    console.log(`[email] Đã gửi OTP tới ${to} (${info.messageId || 'ok'}).`);
    return { sent: true };
  } catch (error) {
    console.error(`[email] Gửi OTP thất bại: ${error.message}`);
    if (!DEMO_MODE) {
      fail(502, 'Không gửi được email OTP. Vui lòng thử lại sau hoặc kiểm tra cấu hình SMTP.');
    }
    console.log(`[Studeal][DEMO OTP FALLBACK] ${to} | ${code}`);
    return { sent: false, error: error.message };
  }
}

function otpResponse(user, purpose, delivery, message) {
  const payload = {
    requires_otp: true,
    message,
    purpose,
    email: purpose === 'STUDENT' ? user.pending_student_email : user.email,
    account_email: user.email,
    otp_expires_at: user.otp_expires,
    email_sent: Boolean(delivery && delivery.sent),
  };
  if (delivery && delivery.error && DEMO_MODE) payload.email_error = delivery.error;
  if (DEMO_MODE) payload.debug_otp = user.otp_code;
  return payload;
}

/* ============================================================================
 * 5. AUTH HELPERS & MAPPERS
 * ========================================================================== */

function signToken(user) {
  return jwt.sign(
    { sub: String(user.id), id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    is_student_verified: asBool(row.is_student_verified),
    student_email: row.student_email || null,
    university_name: row.university_name || null,
    university_badge: asBool(row.is_student_verified) ? row.university_name : null,
    wallet_balance: Number(row.wallet_balance || 0),
    created_at: row.created_at,
  };
}

const aliasFor = (id) => `Sinh viên #${100 + Number(id)}`;

function authRequired(req, res, next) {
  const header = String(req.headers.authorization || '');
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Thiếu token xác thực. Hãy đăng nhập để tiếp tục.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.id || decoded.sub);
    const user = get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
  }
}

function mapProduct(row, { owner = false } = {}) {
  const deliveryMethods = [];
  if (asBool(row.allow_meetup)) deliveryMethods.push({ code: 'MEETUP', label: DELIVERY_LABELS.MEETUP });
  if (asBool(row.allow_ship_3rd)) deliveryMethods.push({ code: 'SHIP_3RD', label: DELIVERY_LABELS.SHIP_3RD });
  if (asBool(row.allow_khtn_routine)) deliveryMethods.push({ code: 'KHTN_ROUTINE', label: DELIVERY_LABELS.KHTN_ROUTINE });

  const item = {
    id: row.id,
    title: row.title,
    category: row.category,
    condition_text: row.condition_text,
    description: row.description,
    original_price: Number(row.original_price || 0),
    price: Number(row.price || 0),
    image_url: row.image_url || null,
    allow_meetup: asBool(row.allow_meetup),
    meetup_location: row.meetup_location || null,
    allow_ship_3rd: asBool(row.allow_ship_3rd),
    allow_khtn_routine: asBool(row.allow_khtn_routine),
    is_promoted: asBool(row.is_promoted),
    status: row.status,
    created_at: row.created_at,
    seller_badge: row.university_name || null,
    seller: {
      alias: aliasFor(row.seller_uid || row.seller_id),
      university: row.university_name || null,
      is_verified: asBool(row.is_student_verified),
    },
    delivery_methods: deliveryMethods,
  };

  if (row.pending_offers != null) item.pending_offers = Number(row.pending_offers);
  if (owner) {
    item.seller_id = row.seller_id;
    item.promotion_fee = asBool(row.is_promoted) ? VIP_FEE : 0;
  }
  return item;
}

const OFFER_SELECT = `
  SELECT o.*,
         p.title AS product_title,
         p.price AS product_price,
         p.image_url AS product_image,
         p.status AS product_status,
         bu.id AS buyer_uid,
         bu.university_name AS buyer_university,
         bu.is_student_verified AS buyer_verified,
         su.id AS seller_uid,
         su.university_name AS seller_university,
         su.is_student_verified AS seller_verified
  FROM offers o
  JOIN products p ON p.id = o.product_id
  JOIN users bu ON bu.id = o.buyer_id
  JOIN users su ON su.id = o.seller_id
`;

function mapOffer(row, role) {
  return {
    id: row.id,
    product_id: row.product_id,
    offer_price: Number(row.offer_price),
    status: row.status,
    created_at: row.created_at,
    role,
    product: {
      id: row.product_id,
      title: row.product_title,
      price: Number(row.product_price),
      image_url: row.product_image || null,
      status: row.product_status,
    },
    buyer: {
      alias: aliasFor(row.buyer_uid),
      university: row.buyer_university || null,
      is_verified: asBool(row.buyer_verified),
    },
    seller: {
      alias: aliasFor(row.seller_uid),
      university: row.seller_university || null,
      is_verified: asBool(row.seller_verified),
    },
  };
}

const ORDER_SELECT = `
  SELECT o.*,
         p.title AS product_title,
         p.image_url AS product_image,
         p.category AS product_category,
         p.condition_text AS product_condition,
         bu.id AS buyer_uid,
         bu.university_name AS buyer_university,
         bu.is_student_verified AS buyer_verified,
         su.id AS seller_uid,
         su.university_name AS seller_university,
         su.is_student_verified AS seller_verified
  FROM orders o
  JOIN products p ON p.id = o.product_id
  JOIN users bu ON bu.id = o.buyer_id
  JOIN users su ON su.id = o.seller_id
`;

function mapOrder(row, viewerId) {
  return {
    id: row.id,
    product: {
      id: row.product_id,
      title: row.product_title,
      image_url: row.product_image || null,
      category: row.product_category,
      condition_text: row.product_condition,
    },
    final_price: Number(row.final_price),
    discount_amount: Number(row.discount_amount || 0),
    buyer_paid_amount: Number(row.buyer_paid_amount),
    platform_fee_2_percent: Number(row.platform_fee_2_percent),
    seller_receive_amount: Number(row.seller_receive_amount),
    delivery_method: row.delivery_method,
    delivery_method_label: DELIVERY_LABELS[row.delivery_method] || row.delivery_method,
    delivery_detail: row.delivery_detail || null,
    escrow_status: row.escrow_status,
    offer_id: row.offer_id || null,
    voucher_code: row.voucher_code || null,
    created_at: row.created_at,
    buyer: {
      alias: aliasFor(row.buyer_uid),
      university: row.buyer_university || null,
      is_verified: asBool(row.buyer_verified),
    },
    seller: {
      alias: aliasFor(row.seller_uid),
      university: row.seller_university || null,
      is_verified: asBool(row.seller_verified),
    },
    viewer_role: Number(viewerId) === Number(row.buyer_id) ? 'BUYER' : 'SELLER',
    can_confirm_received:
      Number(viewerId) === Number(row.buyer_id) && row.escrow_status === 'HOLDING',
  };
}

function calculateVoucher(codeRaw, amount) {
  const code = cleanText(codeRaw, 40).toUpperCase();
  if (!code) fail(400, 'Vui lòng nhập mã giảm giá.');

  const voucher = get('SELECT * FROM vouchers WHERE code = ?', [code]);
  if (!voucher) fail(404, `Mã giảm giá "${code}" không tồn tại.`);

  const percent = Number(voucher.discount_percent || 0);
  const maxDiscount = Number(voucher.max_discount || 0);
  const base = Math.max(0, Math.round(Number(amount) || 0));

  let discount = percent >= 100 ? base : (base * percent) / 100;
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);
  discount = Math.max(0, Math.min(Math.round(discount), base));

  return {
    voucher,
    code,
    discount_amount: discount,
    final_amount: Math.max(0, base - discount),
  };
}

/* ============================================================================
 * 6. EXPRESS APP
 * ========================================================================== */

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  next();
});

/* ----------------------------- MULTER ------------------------------------ */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = /^\.[a-z0-9]{2,5}$/.test(rawExt) ? rawExt : '.jpg';
    cb(null, `product-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || '')) {
      return cb(new HttpError(400, 'Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.'));
    }
    return cb(null, true);
  },
});

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80';

/* ============================================================================
 * 7. HEALTH & AUTH ROUTES
 * ========================================================================== */

app.get('/api/health', asyncRoute((req, res) => {
  const counts = {
    users: Number((get('SELECT COUNT(*) AS n FROM users') || {}).n || 0),
    products: Number((get('SELECT COUNT(*) AS n FROM products') || {}).n || 0),
    available_products: Number((get("SELECT COUNT(*) AS n FROM products WHERE status = 'AVAILABLE'") || {}).n || 0),
    orders: Number((get('SELECT COUNT(*) AS n FROM orders') || {}).n || 0),
  };
  res.json({
    status: 'ok',
    service: 'Studeal API',
    version: '1.0.0',
    time: nowIso(),
    demo_mode: DEMO_MODE,
    email_configured: emailConfigured,
    platform_fee_percent: Math.round(PLATFORM_FEE_RATE * 10000) / 100,
    counts,
  });
}));

// Chỉ dành cho demo cục bộ trên lớp. Gọi route cần xác nhận rõ ràng từ UI;
// reset toàn bộ CSDL demo về 3 tài khoản, 8 sản phẩm và voucher seed.
app.post('/api/demo/reset', asyncRoute((req, res) => {
  if (!DEMO_MODE) fail(404, 'API reset demo không khả dụng.');
  if (req.get('X-Demo-Reset') !== 'RESET-DEMO-DATA') {
    fail(400, 'Thiếu xác nhận reset dữ liệu demo.');
  }

  tx(() => {
    run('DELETE FROM offers');
    run('DELETE FROM orders');
    run('DELETE FROM products');
    run('DELETE FROM users');
    run('DELETE FROM vouchers');
    run("DELETE FROM sqlite_sequence WHERE name IN ('users', 'products', 'offers', 'orders', 'vouchers')");
    seedDatabase();
  });

  res.json({
    message: 'Đã khôi phục dữ liệu mẫu Studeal.',
    counts: {
      users: Number((get('SELECT COUNT(*) AS n FROM users') || {}).n || 0),
      products: Number((get('SELECT COUNT(*) AS n FROM products') || {}).n || 0),
      vouchers: Number((get('SELECT COUNT(*) AS n FROM vouchers') || {}).n || 0),
      orders: Number((get('SELECT COUNT(*) AS n FROM orders') || {}).n || 0),
    },
  });
}));

/**
 * Đăng ký tài khoản -> gửi OTP 6 số (Nodemailer).
 * DEMO_MODE=true: trả thêm debug_otp để nhập nhanh trên lớp.
 */
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const name = cleanText(req.body.name, 80);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password == null ? '' : req.body.password);

  if (name.length < 2) fail(400, 'Họ tên phải có ít nhất 2 ký tự.');
  if (!isEmail(email)) fail(400, 'Email không hợp lệ.');
  if (password.length < 6) fail(400, 'Mật khẩu phải có ít nhất 6 ký tự.');
  if (password.length > 100) fail(400, 'Mật khẩu tối đa 100 ký tự.');

  const existing = get('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) fail(409, 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng chức năng gửi lại OTP.');

  const passwordHash = await bcrypt.hash(password, 10);
  const otp = generateOtp();
  const expires = otpExpiryIso();

  let userId;
  try {
    const inserted = run(
      `INSERT INTO users (name, email, password_hash, otp_code, otp_expires, otp_purpose, created_at)
       VALUES (?, ?, ?, ?, ?, 'REGISTER', ?)`,
      [name, email, passwordHash, otp, expires, nowIso()]
    );
    userId = inserted.lastInsertId;
  } catch (error) {
    if (/UNIQUE|constraint/i.test(error.message)) fail(409, 'Email này đã được đăng ký.');
    throw error;
  }

  let user = get('SELECT * FROM users WHERE id = ?', [userId]);
  const delivery = await deliverOtp({ to: email, code: otp, name, purpose: 'REGISTER' });

  res.status(201).json({
    ...otpResponse(
      user,
      'REGISTER',
      delivery,
      delivery.sent
        ? 'Đăng ký thành công! Mã OTP đã được gửi tới email của bạn.'
        : 'Đăng ký thành công! Hãy dùng mã OTP bên dưới để xác thực (chế độ demo).'
    ),
    user: publicUser(user),
  });
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password == null ? '' : req.body.password);

  if (!isEmail(email) || !password) fail(400, 'Vui lòng nhập email và mật khẩu.');

  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  // Không tiết lộ email có tồn tại hay không.
  if (!user) fail(401, 'Email hoặc mật khẩu không đúng.');

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) fail(401, 'Email hoặc mật khẩu không đúng.');

  const otp = generateOtp();
  const expires = otpExpiryIso();
  run(
    `UPDATE users
     SET otp_code = ?, otp_expires = ?, otp_purpose = 'LOGIN',
         pending_student_email = NULL, pending_university_name = NULL
     WHERE id = ?`,
    [otp, expires, user.id]
  );

  const fresh = get('SELECT * FROM users WHERE id = ?', [user.id]);
  const delivery = await deliverOtp({ to: email, code: otp, name: user.name, purpose: 'LOGIN' });

  res.json({
    ...otpResponse(
      fresh,
      'LOGIN',
      delivery,
      delivery.sent
        ? 'Mã OTP đã được gửi tới email. Vui lòng nhập OTP để hoàn tất đăng nhập.'
        : 'Đăng nhập đúng mật khẩu. Hãy dùng mã OTP bên dưới (chế độ demo).'
    ),
    user: publicUser(fresh),
  });
}));

/**
 * Xác thực OTP cho cả LOGIN / REGISTER / STUDENT.
 * Với OTP STUDENT: tự cập nhật is_student_verified = 1 và gắn huy hiệu trường.
 */
app.post('/api/auth/verify-otp', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email || req.body.account_email);
  const otp = cleanText(req.body.otp || req.body.code, 10);
  const requestedPurpose = cleanText(req.body.purpose, 20).toUpperCase();

  if (!email) fail(400, 'Vui lòng nhập email tài khoản.');
  if (!/^\d{6}$/.test(otp)) fail(400, 'Mã OTP phải gồm đúng 6 chữ số.');

  let user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) {
    user = get('SELECT * FROM users WHERE pending_student_email = ?', [email]);
  }
  if (!user) fail(404, 'Không tìm thấy tài khoản với email này.');

  if (requestedPurpose && user.otp_purpose && requestedPurpose !== user.otp_purpose) {
    fail(400, `Mã OTP hiện tại dùng cho mục đích ${user.otp_purpose}, không phải ${requestedPurpose}.`);
  }
  if (!user.otp_code || !user.otp_expires) {
    fail(400, 'Không có mã OTP đang chờ. Vui lòng bấm gửi lại OTP.');
  }
  const expiresAt = new Date(user.otp_expires).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    run('UPDATE users SET otp_code = NULL, otp_expires = NULL, otp_purpose = NULL WHERE id = ?', [user.id]);
    fail(400, 'Mã OTP đã hết hạn. Vui lòng bấm gửi lại OTP.');
  }
  if (!safeEqual(user.otp_code, otp)) {
    fail(400, 'Mã OTP không đúng. Vui lòng kiểm tra lại.');
  }

  const purpose = user.otp_purpose || 'LOGIN';

  if (purpose === 'STUDENT') {
    const studentEmail = user.pending_student_email;
    const universityName = user.pending_university_name;
    if (!studentEmail || !universityName) {
      fail(400, 'Phiên xác thực sinh viên không hợp lệ. Vui lòng gửi lại email sinh viên.');
    }
    const duplicated = get(
      'SELECT id FROM users WHERE student_email = ? AND id <> ?',
      [studentEmail, user.id]
    );
    if (duplicated) fail(409, 'Email sinh viên này đã được xác thực bởi tài khoản khác.');

    run(
      `UPDATE users
       SET is_student_verified = 1,
           student_email = ?,
           university_name = ?,
           otp_code = NULL,
           otp_expires = NULL,
           otp_purpose = NULL,
           pending_student_email = NULL,
           pending_university_name = NULL
       WHERE id = ?`,
      [studentEmail, universityName, user.id]
    );
  } else {
    run(
      `UPDATE users
       SET otp_code = NULL,
           otp_expires = NULL,
           otp_purpose = NULL,
           pending_student_email = NULL,
           pending_university_name = NULL
       WHERE id = ?`,
      [user.id]
    );
  }

  const fresh = get('SELECT * FROM users WHERE id = ?', [user.id]);
  const token = signToken(fresh);

  res.json({
    message: purpose === 'STUDENT'
      ? `Xác thực sinh viên thành công! Bạn đã có huy hiệu ${fresh.university_name}.`
      : 'Xác thực OTP thành công. Bạn đã đăng nhập Studeal.',
    token,
    token_type: 'Bearer',
    expires_in: JWT_EXPIRES_IN,
    purpose,
    student_verified: asBool(fresh.is_student_verified),
    user: publicUser(fresh),
  });
}));

/**
 * Gửi OTP tới email sinh viên .edu.vn.
 * Chỉ sau khi verify-otp thành công mới bật is_student_verified.
 */
app.post('/api/auth/verify-student', authRequired, asyncRoute(async (req, res) => {
  const studentEmail = normalizeEmail(req.body.student_email || req.body.email);
  if (!isEmail(studentEmail)) fail(400, 'Email sinh viên không hợp lệ.');

  const universityName = resolveUniversity(studentEmail);

  const duplicated = get(
    'SELECT id FROM users WHERE student_email = ? AND id <> ?',
    [studentEmail, req.user.id]
  );
  if (duplicated) fail(409, 'Email sinh viên này đã được xác thực bởi tài khoản khác.');

  const otp = generateOtp();
  const expires = otpExpiryIso();

  run(
    `UPDATE users
     SET otp_code = ?, otp_expires = ?, otp_purpose = 'STUDENT',
         pending_student_email = ?, pending_university_name = ?
     WHERE id = ?`,
    [otp, expires, studentEmail, universityName, req.user.id]
  );

  const fresh = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  const delivery = await deliverOtp({
    to: studentEmail,
    code: otp,
    name: fresh.name,
    purpose: 'STUDENT',
  });

  res.json({
    ...otpResponse(
      fresh,
      'STUDENT',
      delivery,
      delivery.sent
        ? `Đã gửi OTP tới ${studentEmail}. Nhập OTP để nhận huy hiệu ${universityName}.`
        : `Đã tạo OTP xác thực ${studentEmail} (chế độ demo).`
    ),
    university_name: universityName,
    student_email: studentEmail,
  });
}));

/** Gửi lại OTP cho phiên đang chờ (login / register / student). */
app.post('/api/auth/resend-otp', asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!isEmail(email)) fail(400, 'Email không hợp lệ.');

  const user = get('SELECT * FROM users WHERE email = ?', [email]);
  if (!user) fail(404, 'Không tìm thấy tài khoản với email này.');

  const purpose = user.otp_purpose || 'LOGIN';
  const targetEmail = purpose === 'STUDENT' && user.pending_student_email
    ? user.pending_student_email
    : user.email;

  if (purpose === 'STUDENT' && !user.pending_student_email) {
    fail(400, 'Không có email sinh viên đang chờ xác thực. Vui lòng gửi lại email sinh viên.');
  }

  const otp = generateOtp();
  const expires = otpExpiryIso();
  run('UPDATE users SET otp_code = ?, otp_expires = ? WHERE id = ?', [otp, expires, user.id]);

  const fresh = get('SELECT * FROM users WHERE id = ?', [user.id]);
  const delivery = await deliverOtp({ to: targetEmail, code: otp, name: fresh.name, purpose });

  res.json(otpResponse(fresh, purpose, delivery, `Đã gửi lại mã OTP tới ${targetEmail}.`));
}));

app.get('/api/auth/me', authRequired, asyncRoute((req, res) => {
  res.json({ user: publicUser(req.user) });
}));

/* ============================================================================
 * 8. PRODUCT ROUTES
 * ========================================================================== */

/**
 * Danh sách sản phẩm AVAILABLE.
 * - is_promoted = 1 luôn đứng đầu
 * - Ẩn hoàn toàn email/SĐT người bán, chỉ trả alias + huy hiệu trường
 * - Hỗ trợ ?category=...&q=...&page=1&limit=50
 */
app.get('/api/products', asyncRoute((req, res) => {
  const where = ["p.status = 'AVAILABLE'"];
  const params = [];

  if (req.query.category) {
    const category = cleanText(req.query.category, 50);
    if (!CATEGORIES.includes(category)) fail(400, `Danh mục không hợp lệ. Chọn: ${CATEGORIES.join(', ')}`);
    where.push('p.category = ?');
    params.push(category);
  }

  if (req.query.q) {
    const q = cleanText(req.query.q, 100);
    if (q) {
      where.push('(p.title LIKE ? OR p.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  const whereSql = where.join(' AND ');
  const total = Number((get(
    `SELECT COUNT(*) AS n FROM products p WHERE ${whereSql}`,
    params
  ) || {}).n || 0);

  const rows = all(
    `SELECT p.*,
            u.id AS seller_uid,
            u.university_name AS university_name,
            u.is_student_verified AS is_student_verified
     FROM products p
     JOIN users u ON u.id = p.seller_id
     WHERE ${whereSql}
     ORDER BY p.is_promoted DESC, p.created_at DESC, p.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    count: rows.length,
    total,
    page,
    limit,
    products: rows.map((row) => mapProduct(row)),
  });
}));

/** Sản phẩm của chính người bán (kèm cả SOLD + số offer chờ duyệt). */
app.get('/api/products/my', authRequired, asyncRoute((req, res) => {
  const rows = all(
    `SELECT p.*,
            u.id AS seller_uid,
            u.university_name AS university_name,
            u.is_student_verified AS is_student_verified,
            (SELECT COUNT(*) FROM offers o WHERE o.product_id = p.id AND o.status = 'PENDING') AS pending_offers
     FROM products p
     JOIN users u ON u.id = p.seller_id
     WHERE p.seller_id = ?
     ORDER BY p.created_at DESC, p.id DESC`,
    [req.user.id]
  );

  res.json({
    count: rows.length,
    products: rows.map((row) => mapProduct(row, { owner: true })),
  });
}));

app.get('/api/products/:id', asyncRoute((req, res) => {
  const id = parseId(req.params.id, 'Product ID');
  const row = get(
    `SELECT p.*,
            u.id AS seller_uid,
            u.university_name AS university_name,
            u.is_student_verified AS is_student_verified
     FROM products p
     JOIN users u ON u.id = p.seller_id
     WHERE p.id = ?`,
    [id]
  );
  if (!row) fail(404, 'Không tìm thấy sản phẩm.');
  res.json({ product: mapProduct(row) });
}));

/**
 * Đăng bán sản phẩm. Bắt buộc is_student_verified = 1.
 * Hỗ trợ JSON (image_url) hoặc multipart/form-data (field "image").
 */
app.post('/api/products', authRequired, upload.single('image'), asyncRoute(async (req, res) => {
  if (!asBool(req.user.is_student_verified)) {
    fail(403, 'Bạn cần xác thực email sinh viên .edu.vn trước khi đăng bán sản phẩm.', {
      hint: 'Gọi POST /api/auth/verify-student với email trường, sau đó POST /api/auth/verify-otp.',
    });
  }

  const title = cleanText(req.body.title, 160);
  const category = cleanText(req.body.category, 50);
  const condition = cleanText(req.body.condition_text || req.body.condition, 40);
  const description = sanitizeDescription(req.body.description);
  const price = parseMoney(req.body.price, 'Giá bán');
  const rawOriginalPrice = req.body.original_price;
  let originalPrice = rawOriginalPrice == null || String(rawOriginalPrice).trim() === ''
    ? price
    : parseMoney(rawOriginalPrice, 'Giá gốc');

  if (title.length < 5) fail(400, 'Tiêu đề sản phẩm phải có ít nhất 5 ký tự.');
  if (!CATEGORIES.includes(category)) {
    fail(400, `Danh mục không hợp lệ. Chọn một trong: ${CATEGORIES.join(', ')}.`);
  }
  if (!CONDITIONS.includes(condition)) {
    fail(400, `Tình trạng không hợp lệ. Chọn một trong: ${CONDITIONS.join(', ')}.`);
  }
  if (price <= 0) fail(400, 'Giá bán phải lớn hơn 0.');
  if (originalPrice <= 0) originalPrice = price;
  if (originalPrice < price) {
    fail(400, 'Giá gốc không thể nhỏ hơn giá bán.');
  }

  let allowMeetup = parseBool(req.body.allow_meetup);
  const allowShip = parseBool(req.body.allow_ship_3rd);
  const allowKhtn = parseBool(req.body.allow_khtn_routine);

  // Mặc định gặp trực tiếp nếu người bán không chọn hình thức nào.
  if (!allowMeetup && !allowShip && !allowKhtn) allowMeetup = true;

  let meetupLocation = cleanText(req.body.meetup_location, 200);
  if (allowMeetup && !meetupLocation) meetupLocation = 'Thỏa thuận trực tiếp tại trường';

  let imageUrl = cleanText(req.body.image_url || req.body.image, 1000);
  if (req.file) imageUrl = `/uploads/${req.file.filename}`;
  if (!imageUrl) imageUrl = DEFAULT_IMAGE;
  if (!/^(https?:\/\/|\/uploads\/)/i.test(imageUrl)) {
    fail(400, 'image_url phải là URL http(s) hoặc đường dẫn /uploads/...');
  }

  const isPromoted = parseBool(req.body.is_promoted);

  const inserted = run(
    `INSERT INTO products
      (seller_id, title, category, condition_text, description, original_price, price, image_url,
       allow_meetup, meetup_location, allow_ship_3rd, allow_khtn_routine, is_promoted, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?)`,
    [
      req.user.id,
      title,
      category,
      condition,
      description,
      originalPrice,
      price,
      imageUrl,
      allowMeetup ? 1 : 0,
      meetupLocation || null,
      allowShip ? 1 : 0,
      allowKhtn ? 1 : 0,
      isPromoted ? 1 : 0,
      nowIso(),
    ]
  );

  const row = get(
    `SELECT p.*,
            u.id AS seller_uid,
            u.university_name AS university_name,
            u.is_student_verified AS is_student_verified
     FROM products p
     JOIN users u ON u.id = p.seller_id
     WHERE p.id = ?`,
    [inserted.lastInsertId]
  );

  res.status(201).json({
    message: isPromoted
      ? `Đăng bán thành công! Đã bật gói Quảng cáo Đẩy tin VIP (+${VIP_FEE.toLocaleString('vi-VN')}đ).`
      : 'Đăng bán sản phẩm thành công!',
    promotion: {
      active: isPromoted,
      fee: isPromoted ? VIP_FEE : 0,
      note: isPromoted
        ? 'Sản phẩm được ưu tiên hiển thị đầu trang. Chế độ demo chưa trừ phí vào ví.'
        : 'Tin thường. Có thể bật VIP khi đăng bài để được đẩy lên đầu.',
    },
    product: mapProduct(row, { owner: true }),
  });
}));

/* ============================================================================
 * 9. OFFER ROUTES (trả giá - không có chat văn bản)
 * ========================================================================== */

app.post('/api/offers', authRequired, asyncRoute((req, res) => {
  const productId = parseId(req.body.product_id, 'Product ID');
  const offerPrice = parseMoney(req.body.offer_price ?? req.body.price, 'Giá trả');

  const product = get('SELECT * FROM products WHERE id = ?', [productId]);
  if (!product) fail(404, 'Không tìm thấy sản phẩm.');
  if (product.status !== 'AVAILABLE') fail(409, 'Sản phẩm đã được bán, không thể trả giá.');
  if (Number(product.seller_id) === Number(req.user.id)) {
    fail(400, 'Bạn không thể trả giá cho sản phẩm của chính mình.');
  }
  if (offerPrice <= 0) fail(400, 'Giá trả phải lớn hơn 0.');
  if (offerPrice >= Number(product.price)) {
    fail(400, `Giá trả phải thấp hơn giá niêm yết ${Number(product.price).toLocaleString('vi-VN')}đ. Nếu đồng ý giá này, hãy bấm Mua ngay.`);
  }

  const existing = get(
    "SELECT * FROM offers WHERE product_id = ? AND buyer_id = ? AND status = 'PENDING'",
    [productId, req.user.id]
  );

  let offerId;
  if (existing) {
    run('UPDATE offers SET offer_price = ?, created_at = ? WHERE id = ?', [offerPrice, nowIso(), existing.id]);
    offerId = existing.id;
  } else {
    const inserted = run(
      `INSERT INTO offers (product_id, buyer_id, seller_id, offer_price, status, created_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`,
      [productId, req.user.id, product.seller_id, offerPrice, nowIso()]
    );
    offerId = inserted.lastInsertId;
  }

  const row = get(`${OFFER_SELECT} WHERE o.id = ?`, [offerId]);
  res.status(existing ? 200 : 201).json({
    message: existing
      ? 'Đã cập nhật mức giá trả. Người bán sẽ thấy mức giá mới nhất.'
      : 'Đã gửi đề xuất giá tới người bán. Bạn sẽ nhận kết quả ACCEPT / REJECT.',
    offer: mapOffer(row, 'buyer'),
  });
}));

app.get('/api/offers/my', authRequired, asyncRoute((req, res) => {
  const role = cleanText(req.query.role, 10).toLowerCase();

  const sent = role === 'received'
    ? []
    : all(`${OFFER_SELECT} WHERE o.buyer_id = ? ORDER BY o.created_at DESC, o.id DESC`, [req.user.id])
      .map((row) => mapOffer(row, 'buyer'));

  const received = role === 'sent'
    ? []
    : all(`${OFFER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC, o.id DESC`, [req.user.id])
      .map((row) => mapOffer(row, 'seller'));

  res.json({ sent, received });
}));

app.post('/api/offers/:id/respond', authRequired, asyncRoute((req, res) => {
  const offerId = parseId(req.params.id, 'Offer ID');
  const rawAction = cleanText(req.body.status || req.body.action, 20).toUpperCase();

  const action = ['ACCEPT', 'ACCEPTED', 'DONG_Y'].includes(rawAction)
    ? 'ACCEPTED'
    : ['REJECT', 'REJECTED', 'TU_CHOI'].includes(rawAction)
      ? 'REJECTED'
      : null;

  if (!action) fail(400, 'Hành động không hợp lệ. Chỉ chấp nhận ACCEPT hoặc REJECT.');

  const offer = get('SELECT * FROM offers WHERE id = ?', [offerId]);
  if (!offer) fail(404, 'Không tìm thấy lời trả giá.');
  if (Number(offer.seller_id) !== Number(req.user.id)) {
    fail(403, 'Chỉ người bán mới được phản hồi lời trả giá này.');
  }
  if (offer.status !== 'PENDING') {
    fail(409, `Lời trả giá này đã được xử lý (${offer.status}).`);
  }

  tx(() => {
    run('UPDATE offers SET status = ? WHERE id = ?', [action, offerId]);
    if (action === 'ACCEPTED') {
      // Một sản phẩm chỉ nên có 1 deal được chấp nhận.
      run(
        `UPDATE offers
         SET status = 'REJECTED'
         WHERE product_id = ? AND id <> ? AND status = 'PENDING'`,
        [offer.product_id, offerId]
      );
    }
  });

  const row = get(`${OFFER_SELECT} WHERE o.id = ?`, [offerId]);
  res.json({
    message: action === 'ACCEPTED'
      ? `Đã chấp nhận mức giá ${Number(offer.offer_price).toLocaleString('vi-VN')}đ. Người mua có thể thanh toán escrow ngay.`
      : 'Đã từ chối lời trả giá.',
    offer: mapOffer(row, 'seller'),
  });
}));

/* ============================================================================
 * 10. VOUCHER ROUTES
 * ========================================================================== */

app.get('/api/vouchers', asyncRoute((req, res) => {
  const rows = all('SELECT * FROM vouchers ORDER BY code ASC');
  res.json({
    count: rows.length,
    vouchers: rows.map((row) => ({
      code: row.code,
      discount_percent: Number(row.discount_percent),
      max_discount: Number(row.max_discount),
      description: row.description,
    })),
  });
}));

app.post('/api/vouchers/apply', asyncRoute((req, res) => {
  const amount = parseMoney(req.body.amount ?? req.body.order_amount ?? req.body.price, 'Giá trị đơn hàng');
  if (amount <= 0) fail(400, 'Giá trị đơn hàng phải lớn hơn 0.');

  const result = calculateVoucher(req.body.code, amount);

  res.json({
    valid: true,
    code: result.code,
    description: result.voucher.description,
    discount_percent: Number(result.voucher.discount_percent),
    max_discount: Number(result.voucher.max_discount),
    original_amount: amount,
    discount_amount: result.discount_amount,
    final_amount: result.final_amount,
    message: `Áp dụng mã ${result.code} thành công, giảm ${result.discount_amount.toLocaleString('vi-VN')}đ.`,
  });
}));

/* ============================================================================
 * 11. ORDER / ESCROW ROUTES
 * ========================================================================== */

/**
 * Tạo đơn escrow:
 * - Khóa sản phẩm: AVAILABLE -> SOLD (biến mất khỏi trang chủ ngay)
 * - Tiền ở trạng thái HOLDING
 * - final_price lấy theo offer ACCEPTED (nếu có), sau đó trừ voucher
 * - Phí sàn 2% tính trên final_price
 */
app.post('/api/orders/checkout', authRequired, asyncRoute(async (req, res) => {
  const productId = parseId(req.body.product_id, 'Product ID');
  const requestedOfferId = req.body.offer_id ? parseId(req.body.offer_id, 'Offer ID') : null;
  const deliveryMethod = cleanText(req.body.delivery_method, 30).toUpperCase();
  let deliveryDetail = cleanText(req.body.delivery_detail, 300);
  const voucherCode = cleanText(req.body.voucher_code, 40).toUpperCase();

  if (!DELIVERY_METHODS.includes(deliveryMethod)) {
    fail(400, `Hình thức giao hàng không hợp lệ. Chọn: ${DELIVERY_METHODS.join(', ')}.`);
  }

  const orderId = tx(() => {
    const product = get('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) fail(404, 'Không tìm thấy sản phẩm.');
    if (product.status !== 'AVAILABLE') {
      fail(409, 'Sản phẩm đã được người khác mua. Vui lòng chọn sản phẩm khác.');
    }
    if (Number(product.seller_id) === Number(req.user.id)) {
      fail(400, 'Bạn không thể mua sản phẩm của chính mình.');
    }

    // Giá deal: ưu tiên offer_id, nếu không có thì tự tìm offer ACCEPTED của buyer.
    let usedOffer = null;
    if (requestedOfferId) {
      usedOffer = get('SELECT * FROM offers WHERE id = ?', [requestedOfferId]);
      if (!usedOffer) fail(404, 'Không tìm thấy lời trả giá.');
      if (Number(usedOffer.buyer_id) !== Number(req.user.id)) {
        fail(403, 'Lời trả giá này không thuộc về bạn.');
      }
      if (Number(usedOffer.product_id) !== Number(product.id)) {
        fail(400, 'Lời trả giá không khớp với sản phẩm.');
      }
      if (usedOffer.status !== 'ACCEPTED') {
        fail(409, `Lời trả giá chưa được người bán chấp nhận (${usedOffer.status}).`);
      }
    } else {
      usedOffer = get(
        `SELECT * FROM offers
         WHERE product_id = ? AND buyer_id = ? AND status = 'ACCEPTED'
         ORDER BY id DESC LIMIT 1`,
        [product.id, req.user.id]
      );
    }

    const finalPrice = usedOffer ? Number(usedOffer.offer_price) : Number(product.price);

    // Kiểm tra hình thức giao hàng có được người bán bật không.
    if (deliveryMethod === 'MEETUP' && !asBool(product.allow_meetup)) {
      fail(400, 'Người bán không bật hình thức gặp trực tiếp.');
    }
    if (deliveryMethod === 'SHIP_3RD' && !asBool(product.allow_ship_3rd)) {
      fail(400, 'Người bán không bật hình thức ship bên thứ 3.');
    }
    if (deliveryMethod === 'KHTN_ROUTINE' && !asBool(product.allow_khtn_routine)) {
      fail(400, 'Sản phẩm không hỗ trợ tuyến giao hàng KHTN.');
    }

    if (!deliveryDetail) {
      if (deliveryMethod === 'MEETUP') {
        deliveryDetail = product.meetup_location || 'Thỏa thuận trực tiếp tại trường';
      } else if (deliveryMethod === 'KHTN_ROUTINE') {
        deliveryDetail = 'Tuyến KHTN: CS1 Nguyễn Văn Cừ <-> CS2 Linh Trung';
      } else {
        deliveryDetail = 'Giao qua đơn vị vận chuyển thứ 3 (địa chỉ xác nhận khi giao)';
      }
    }

    let discountAmount = 0;
    if (voucherCode) {
      const voucherResult = calculateVoucher(voucherCode, finalPrice);
      discountAmount = voucherResult.discount_amount;
    }

    const buyerPaidAmount = Math.max(0, finalPrice - discountAmount);
    const platformFee = Math.round(finalPrice * PLATFORM_FEE_RATE);
    const sellerReceiveAmount = finalPrice - platformFee;

    const updated = run(
      "UPDATE products SET status = 'SOLD' WHERE id = ? AND status = 'AVAILABLE'",
      [product.id]
    );
    if (updated.changes !== 1) {
      fail(409, 'Sản phẩm vừa được người khác mua. Vui lòng thử lại.');
    }

    const inserted = run(
      `INSERT INTO orders
        (buyer_id, seller_id, product_id, final_price, discount_amount, buyer_paid_amount,
         platform_fee_2_percent, seller_receive_amount, delivery_method, delivery_detail,
         escrow_status, offer_id, voucher_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'HOLDING', ?, ?, ?)`,
      [
        req.user.id,
        product.seller_id,
        product.id,
        finalPrice,
        discountAmount,
        buyerPaidAmount,
        platformFee,
        sellerReceiveAmount,
        deliveryMethod,
        deliveryDetail,
        usedOffer ? usedOffer.id : null,
        voucherCode || null,
        nowIso(),
      ]
    );

    // Các offer PENDING khác không còn cơ hội.
    run(
      `UPDATE offers SET status = 'REJECTED'
       WHERE product_id = ? AND status = 'PENDING'`,
      [product.id]
    );

    return inserted.lastInsertId;
  });

  const row = get(`${ORDER_SELECT} WHERE o.id = ?`, [orderId]);

  res.status(201).json({
    message: 'Đặt hàng thành công! Studeal đang giữ tiền (HOLDING) đến khi bạn xác nhận đã nhận hàng.',
    escrow_status: 'HOLDING',
    order: mapOrder(row, req.user.id),
    breakdown: {
      final_price: Number(row.final_price),
      discount_amount: Number(row.discount_amount),
      buyer_paid_amount: Number(row.buyer_paid_amount),
      platform_fee_2_percent: Number(row.platform_fee_2_percent),
      seller_receive_amount: Number(row.seller_receive_amount),
      platform_fee_percent: Math.round(PLATFORM_FEE_RATE * 10000) / 100,
    },
  });
}));

app.get('/api/orders/my', authRequired, asyncRoute((req, res) => {
  const rows = all(
    `${ORDER_SELECT}
     WHERE o.buyer_id = ? OR o.seller_id = ?
     ORDER BY o.created_at DESC, o.id DESC`,
    [req.user.id, req.user.id]
  );

  const orders = rows.map((row) => mapOrder(row, req.user.id));
  res.json({
    count: orders.length,
    buying: orders.filter((order) => order.viewer_role === 'BUYER'),
    selling: orders.filter((order) => order.viewer_role === 'SELLER'),
    orders,
  });
}));

app.get('/api/orders/:id', authRequired, asyncRoute(async (req, res) => {
  const orderId = parseId(req.params.id, 'Order ID');
  const row = get(`${ORDER_SELECT} WHERE o.id = ?`, [orderId]);
  if (!row) fail(404, 'Không tìm thấy đơn hàng.');
  if (Number(row.buyer_id) !== Number(req.user.id) && Number(row.seller_id) !== Number(req.user.id)) {
    fail(403, 'Bạn không có quyền xem đơn hàng này.');
  }
  res.json({ order: mapOrder(row, req.user.id) });
}));

/**
 * Người mua xác nhận đã nhận hàng:
 * HOLDING -> COMPLETED, cộng 98% vào wallet_balance người bán.
 */
app.post('/api/orders/:id/confirm-received', authRequired, asyncRoute(async (req, res) => {
  const orderId = parseId(req.params.id, 'Order ID');

  const result = tx(() => {
    const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) fail(404, 'Không tìm thấy đơn hàng.');
    if (Number(order.buyer_id) !== Number(req.user.id)) {
      fail(403, 'Chỉ người mua mới được xác nhận đã nhận hàng.');
    }
    if (order.escrow_status === 'COMPLETED') {
      fail(409, 'Đơn hàng này đã được xác nhận nhận hàng trước đó.');
    }
    if (order.escrow_status !== 'HOLDING') {
      fail(409, `Trạng thái escrow không hợp lệ (${order.escrow_status}).`);
    }

    const updated = run(
      `UPDATE orders
       SET escrow_status = 'COMPLETED'
       WHERE id = ? AND buyer_id = ? AND escrow_status = 'HOLDING'`,
      [orderId, req.user.id]
    );
    if (updated.changes !== 1) {
      fail(409, 'Không thể xác nhận đơn hàng lúc này. Vui lòng tải lại trang.');
    }

    run(
      'UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?',
      [Number(order.seller_receive_amount), order.seller_id]
    );

    const freshOrder = get(`${ORDER_SELECT} WHERE o.id = ?`, [orderId]);
    const seller = get('SELECT wallet_balance FROM users WHERE id = ?', [order.seller_id]);
    const buyer = get('SELECT wallet_balance FROM users WHERE id = ?', [order.buyer_id]);

    return {
      order: freshOrder,
      sellerWallet: Number((seller || {}).wallet_balance || 0),
      buyerWallet: Number((buyer || {}).wallet_balance || 0),
    };
  });

  res.json({
    message: `Xác nhận nhận hàng thành công! Đã giải ngân ${Number(result.order.seller_receive_amount).toLocaleString('vi-VN')}đ (98%) cho người bán, phí sàn 2% là ${Number(result.order.platform_fee_2_percent).toLocaleString('vi-VN')}đ.`,
    escrow_status: 'COMPLETED',
    order: mapOrder(result.order, req.user.id),
    payout: {
      seller_receive_amount: Number(result.order.seller_receive_amount),
      platform_fee_2_percent: Number(result.order.platform_fee_2_percent),
      seller_wallet_balance: result.sellerWallet,
    },
    wallet_balance: result.buyerWallet,
  });
}));

/* ============================================================================
 * 12. STATIC FRONTEND + UPLOADS + 404 + ERROR HANDLER
 * ========================================================================== */

// API không tồn tại -> JSON, không rơi vào index.html
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'API endpoint không tồn tại.',
    method: req.method,
    path: `/api${req.path}`,
  });
});

// Ảnh upload
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '1h',
  fallthrough: true,
}));

// Website Hugo (hugo -> frontend/public) + demo SPA
app.use(express.static(FRONTEND_DIR, {
  index: 'index.html',
  extensions: ['html'],
  maxAge: NODE_ENV === 'production' ? '1h' : 0,
}));

app.use((req, res) => {
  if (req.method === 'GET' && req.accepts('html')) {
    const custom404 = path.join(FRONTEND_DIR, '404.html');
    if (fs.existsSync(custom404)) return res.status(404).sendFile(custom404);
  }
  res.status(404).json({
    error: 'Không tìm thấy tài nguyên.',
    path: req.originalUrl,
    hint: fs.existsSync(FRONTEND_DIR)
      ? undefined
      : 'Chưa có frontend/public. Hãy build Hugo hoặc tạo frontend/public/index.html.',
  });
});

app.use((error, req, res, next) => {
  // Dọn ảnh vừa upload nếu request thất bại.
  if (req.file && req.file.path) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
  }

  if (res.headersSent) return next(error);

  let status = error.status || error.statusCode || 500;
  let message = error.message || 'Lỗi máy chủ.';

  if (error instanceof multer.MulterError) {
    status = 400;
    if (error.code === 'LIMIT_FILE_SIZE') message = 'Ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.';
    else if (error.code === 'LIMIT_UNEXPECTED_FILE') message = 'Chỉ được upload 1 ảnh với field tên "image".';
    else message = `Lỗi upload: ${error.message}`;
  }

  if (error.type === 'entity.parse.failed') {
    status = 400;
    message = 'JSON body không hợp lệ.';
  }

  if (status >= 500) {
    console.error('[error]', error);
  }

  const body = { error: message };
  if (error.details) body.details = error.details;
  if (NODE_ENV !== 'production' && status >= 500) body.stack = error.stack;

  res.status(status).json(body);
});

/* ============================================================================
 * 13. START SERVER
 * ========================================================================== */

let server = null;

async function start() {
  await initDatabase();
  setupMailer();

  server = app.listen(PORT, () => {
    console.log('');
    console.log('============================================================');
    console.log('  STUDEAL API đang chạy');
    console.log(`  Local     : http://localhost:${PORT}`);
    console.log(`  Health    : http://localhost:${PORT}/api/health`);
    console.log(`  Frontend  : ${FRONTEND_DIR}`);
    console.log(`  Database  : ${DB_FILE}`);
    console.log(`  Uploads   : ${UPLOAD_DIR}`);
    console.log(`  Demo mode : ${DEMO_MODE ? 'BẬT (debug_otp trong JSON)' : 'TẮT'}`);
    console.log(`  Phí sàn   : ${Math.round(PLATFORM_FEE_RATE * 10000) / 100}% | VIP: ${VIP_FEE.toLocaleString('vi-VN')}đ`);
    console.log('------------------------------------------------------------');
    console.log('  Tài khoản demo (mật khẩu: 123456)');
    console.log('   - 2612205118@student.hcmus.edu.vn  (SV ĐH KHTN)');
    console.log('   - nnamhuynh2008luuanh1@gmail.com   (SV ĐH CNTT)');
    console.log('   - namhuynhnhat2008@gmail.com        (Người mua)');
    console.log('============================================================');
    console.log('');
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] Cổng ${PORT} đang bị chiếm. Hãy tắt process cũ hoặc đổi PORT trong .env.`);
    } else {
      console.error('[server]', error);
    }
    process.exitCode = 1;
  });
}

function shutdown(signal) {
  console.log(`\n[server] Nhận ${signal}, đang lưu CSDL và thoát...`);
  try { persist(); } catch { /* ignore */ }
  const finish = () => {
    try { if (db) db.close(); } catch { /* ignore */ }
    process.exit(0);
  };
  if (server) {
    server.close(finish);
    setTimeout(finish, 2500).unref();
  } else {
    finish();
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[startup] Không thể khởi động Studeal:', error);
  process.exit(1);
});
