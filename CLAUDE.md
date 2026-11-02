# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Studeal is a Vietnamese student marketplace (second-hand textbooks and gear for HCMC universities) with escrow and a 2% platform fee. The UI text and most code comments are in Vietnamese. There is no test suite and no linter.

## Commands

Backend (Node >= 18, run from `backend/`):
```bash
npm install
npm start          # node server.js -> http://localhost:3001 (API + static frontend)
npm run dev        # node --watch server.js
node --check server.js   # quick syntax check
```

Frontend (Hugo Extended >= 0.146, run from `frontend/`):
```bash
hugo server -D                      # dev server on :1313
hugo --gc --minify                  # build into frontend/public/
```

Deploy artifact (this is how code reaches the Google Cloud VM): build Hugo, then tar `backend` + `frontend/public` from the repo root, excluding `backend/.env`, `node_modules`, `data`, `uploads` so the VM's secrets, DB and uploads survive extraction:
```bash
tar -czf studeal-deploy-<stamp>.tar.gz --exclude=backend/node_modules --exclude=backend/.env --exclude=backend/data --exclude=backend/uploads backend frontend/public
```
`*.tar.gz` and `frontend/public/` are git-ignored. The domain `studeal.namprojects.site` sits behind Cloudflare, which caches the static JS, so a deploy may need a cache purge before changes show up.

## Architecture

**One process serves everything.** `backend/server.js` (~2000 lines, deliberately a single file, sections numbered in banner comments) is an Express app that exposes `/api/*` and also serves `FRONTEND_DIR` (default `../frontend/public`) and `/uploads`. The backend therefore needs the Hugo build to sit next to it: `backend/` and `frontend/public/` must be siblings.

**Database is sql.js (SQLite in WASM), held in memory** and written to `DB_FILE` (`backend/data/studeal.sqlite`) after each change. Schema and seed data are created in `server.js` on first run only. Editing the seed (accounts, products) does not change an existing DB; migrate it with a one-off sql.js script (stop the server first, since it overwrites the file from memory).

**Frontend is two separate JS apps, not one:**
- `frontend/layouts/` + `frontend/static/js/studeal-market.js`: the Hugo landing page, with the real marketplace UI (auth modal, cart, sell form, offers, orders) injected by `studeal-market.js`. It calls the API on the same origin.
- `frontend/static/demo/` (served at `/demo/`): an independent vanilla-JS demo app (`assets/app.js`, `styles.css`) with its own copies of the forms and product cards. UI changes usually have to be made in both.
- `frontend/data/*.yaml` feeds the static product cards on the Hugo pages; it is separate from the DB products.

**Auth flow is email + password, then an OTP, for every login.** `register`/`login` -> `verify-otp` returns a JWT. OTPs are stored on the `users` row (`otp_code`, `otp_expires`, `otp_purpose` = LOGIN | REGISTER | STUDENT). Purpose STUDENT verifies a `.edu.vn` address and sets the school badge (`UNIVERSITY_DOMAINS` / `resolveUniversity`); registering with a `.edu.vn` email auto-verifies on the REGISTER OTP.

**Email and demo accounts:**
- OTP mail is sent through nodemailer over SMTP (Resend: `smtp.resend.com`, user `resend`, API key in `EMAIL_APP_PASSWORD`, sender on `studeal.namprojects.site`). Inbound mail is handled outside the code by Cloudflare Email Routing.
- Only the 3 seeded demo accounts (`DEMO_EMAILS` in `server.js`) use a fixed OTP (`DEMO_ACCOUNT_OTP`, default `246810`), skip email, and get `debug_otp` in the JSON. All other accounts need a real emailed OTP, and the API fails with 503/502 if SMTP is missing or broken. `DEMO_MODE` now only gates `POST /api/demo/reset`.
- If you change the demo emails, update `DEMO_EMAILS`, the seed rows, the quick-login buttons in `studeal-market.js`, `layouts/index.html` and `demo/assets/app.js`. Emails are always lowercased by `normalizeEmail`, so seed and constants must be lowercase.

**Business rules to preserve:** buyer/seller identities are hidden (only an alias plus school badge is exposed); `cleanText`-style filters mask phone numbers, emails and Zalo/Facebook links in free text; offers are ACCEPT/REJECT only (no chat); checkout moves the product to SOLD and the money to HOLDING, and `confirm-received` releases 98% to the seller wallet and keeps `PLATFORM_FEE_PERCENT`. `original_price` is no longer collected by the UI; the API defaults it to the sale price.

Configuration is `backend/.env` (never committed; copy `backend/.env.example`). `backend/README.md` documents every endpoint, env var and the demo accounts, and the Resend/Cloudflare setup steps.

## Project Memory Guidelines

- Trước khi bắt đầu nhiệm vụ: Đọc `memory/activeContext.md` và `memory/progress.md`.
- Sau khi hoàn thành hoặc đổi hướng triển khai: Cập nhật lại `memory/activeContext.md` và `memory/progress.md`.
- Khi cấu trúc dự án, stack hoặc quy ước code thay đổi: Cập nhật `memory/architecture.md`.
