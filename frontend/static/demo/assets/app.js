/* =============================================================================
 * STUDEAL DEMO FRONTEND
 * Vanilla JS - gọi trực tiếp API cùng origin (http://localhost:3001)
 * Luồng: đăng ký/đăng nhập OTP -> xác thực sinh viên -> đăng bán -> trả giá
 *        -> chấp nhận -> checkout escrow -> xác nhận nhận hàng -> giải ngân 98%
 * ========================================================================== */

(() => {
  'use strict';

  const TOKEN_KEY = 'studeal_token';
  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80';
  const FALLBACK_ATTR = FALLBACK_IMG.replace(/&/g, '&amp;');

  const CATEGORY_OPTIONS = ['Giáo trình', 'Điện tử', 'Đồ trọ', 'Dụng cụ học tập'];
  const CONDITION_OPTIONS = ['Mới 99%', 'Khá 90%', 'Cũ dùng tốt'];
  const DELIVERY_LABELS = {
    MEETUP: 'Gặp trực tiếp',
    SHIP_3RD: 'Ship bên thứ 3',
    KHTN_ROUTINE: 'Tuyến KHTN miễn phí',
  };
  const STATUS_LABELS = {
    AVAILABLE: 'Đang bán',
    SOLD: 'Đã bán',
    PENDING: 'Chờ duyệt',
    ACCEPTED: 'Đã chấp nhận',
    REJECTED: 'Đã từ chối',
    HOLDING: 'Đang giữ tiền',
    COMPLETED: 'Đã giải ngân',
  };

  let savedToken = '';
  try { savedToken = localStorage.getItem(TOKEN_KEY) || ''; } catch { /* ignore */ }

  const state = {
    token: savedToken,
    user: null,
    products: [],
    total: 0,
    category: '',
    q: '',
    vouchers: [],
    otp: null,
    afterLogin: null,
    checkout: null,
    dashboard: null,
  };

  let modalContext = { mode: '', data: {} };

  /* ------------------------------- HELPERS --------------------------------- */
  const $ = (selector, root = document) => root.querySelector(selector);

  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));

  const vnd = (value) => `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))}đ`;

  const fmtDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  };

  const aliasOf = (id) => `Sinh viên #${100 + Number(id)}`;

  const isOwnProduct = (product) =>
    Boolean(state.user && product && product.seller && product.seller.alias === aliasOf(state.user.id));

  const statusPill = (status) =>
    `<span class="status-pill status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;

  const debounce = (fn, delay = 350) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  function setLoading(button, loading, text = 'Đang xử lý...') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="btn-spinner">◌</span> ${esc(text)}`;
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) {
        button.innerHTML = button.dataset.originalHtml;
        delete button.dataset.originalHtml;
      }
    }
  }

  function showFormError(form, message) {
    if (!form) return;
    let alert = form.querySelector('.alert-error');
    if (!alert) {
      alert = document.createElement('div');
      alert.className = 'alert alert-error full';
      form.prepend(alert);
    }
    alert.textContent = message;
    alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function toast(message, type = 'info') {
    const stack = $('#toastStack');
    if (!stack) return;
    const icons = { success: '✓', error: '!', info: 'i' };
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.innerHTML = `<span class="t-icon">${icons[type] || 'i'}</span><div>${esc(message)}</div>`;
    stack.appendChild(node);
    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 230);
    }, 4600);
  }

  /* --------------------------------- API ----------------------------------- */
  async function api(pathname, { method = 'GET', body, form, token = true } = {}) {
    const headers = {};
    if (token && state.token) headers.Authorization = `Bearer ${state.token}`;

    let payload;
    if (form) {
      payload = form;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(pathname, { method, headers, body: payload });
    } catch {
      throw new Error('Không kết nối được server. Kiểm tra backend đang chạy ở cổng 3001.');
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || response.statusText }; }

    if (!response.ok) {
      const error = new Error(data.error || `Lỗi HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      if (response.status === 401 && state.token) {
        clearSession(false);
        toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
      }
      throw error;
    }
    return data;
  }

  /* --------------------------------- AUTH ---------------------------------- */
  function clearSession(notify = true) {
    state.token = '';
    state.user = null;
    state.dashboard = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
    renderAuthArea();
    if (notify) toast('Đã đăng xuất khỏi Studeal.', 'info');
  }

  function saveSession(token, user) {
    state.token = token;
    state.user = user;
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    renderAuthArea();
  }

  function renderAuthArea() {
    const area = $('#authArea');
    if (!area) return;

    if (!state.user) {
      area.innerHTML = `
        <button type="button" class="btn btn-ghost btn-sm" data-action="open-auth">Đăng nhập</button>
        <button type="button" class="btn btn-primary btn-sm" data-action="open-sell"><span>＋</span> Đăng bán</button>
      `;
      return;
    }

    const initial = (state.user.name || 'S').trim().charAt(0).toUpperCase();
    const verified = state.user.is_student_verified;
    const badge = verified ? (state.user.university_name || 'Đã xác thực') : 'Chưa xác thực';

    area.innerHTML = `
      <button type="button" class="user-chip" data-action="open-dashboard" title="Mở ví, đơn hàng và offer">
        <span class="avatar">${esc(initial)}</span>
        <span class="user-meta">
          <strong>${esc(state.user.name)}</strong>
          <small class="${verified ? '' : 'unverified'}">${esc(badge)}</small>
        </span>
        <span class="wallet-mini">${vnd(state.user.wallet_balance)}</span>
      </button>
      <button type="button" class="icon-btn" data-action="logout" title="Đăng xuất" aria-label="Đăng xuất">⏻</button>
    `;
  }

  async function loadMe() {
    if (!state.token) return;
    try {
      const data = await api('/api/auth/me');
      state.user = data.user;
      renderAuthArea();
    } catch (error) {
      if (error.status !== 401) console.warn('[me]', error.message);
    }
  }

  /* ------------------------------- VOUCHERS -------------------------------- */
  async function loadVouchers() {
    const strip = $('#voucherStrip');
    if (!strip) return;
    try {
      const data = await api('/api/vouchers', { token: false });
      state.vouchers = data.vouchers || [];
      if (!state.vouchers.length) {
        strip.innerHTML = '<span class="voucher-label">Ưu đãi</span><span class="voucher-skeleton">Chưa có mã giảm giá.</span>';
        return;
      }
      strip.innerHTML = `
        <span class="voucher-label">Ưu đãi hôm nay</span>
        ${state.vouchers.map((voucher) => `
          <button type="button" class="voucher-pill" data-action="copy-voucher" data-code="${esc(voucher.code)}" title="Bấm để sao chép mã">
            <strong>${esc(voucher.code)}</strong>
            <small>${esc(voucher.description)}</small>
          </button>
        `).join('')}
        <span class="voucher-skeleton">Bấm mã để sao chép</span>
      `;
    } catch {
      strip.innerHTML = '<span class="voucher-label">Ưu đãi</span><span class="voucher-skeleton">Không tải được mã giảm giá.</span>';
    }
  }

  async function copyVoucher(code) {
    let copied = false;
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
    } catch {
      const helper = document.createElement('textarea');
      helper.value = code;
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      helper.remove();
    }
    if (copied) toast(`Đã sao chép mã ${code}. Dán vào bước thanh toán nhé!`, 'success');
    else toast(`Mã giảm giá: ${code}`, 'info');
  }

  /* -------------------------------- PRODUCTS ------------------------------- */
  function skeletonCards(count = 8) {
    return Array.from({ length: count }).map(() => `
      <div class="skeleton" aria-hidden="true">
        <div class="sk-media"></div>
        <div class="sk-body">
          <div class="sk-line w40"></div>
          <div class="sk-line w80"></div>
          <div class="sk-line w60"></div>
          <div class="sk-line w40"></div>
        </div>
      </div>
    `).join('');
  }

  function productCard(product) {
    const own = isOwnProduct(product);
    const discount = product.original_price > product.price
      ? Math.round((1 - (product.price / product.original_price)) * 100)
      : 0;
    const deliveryTags = (product.delivery_methods || [])
      .map((method) => `<span class="delivery-tag">${esc(method.label || DELIVERY_LABELS[method.code] || method.code)}</span>`)
      .join('');

    return `
      <article class="product-card ${product.is_promoted ? 'vip' : ''}">
        <div class="card-media">
          ${product.is_promoted ? '<span class="vip-ribbon">★ Tin VIP</span>' : ''}
          <img src="${esc(product.image_url || FALLBACK_IMG)}" alt="${esc(product.title)}" loading="lazy"
               onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
          <span class="condition-tag">${esc(product.condition_text)}</span>
        </div>
        <div class="card-body">
          <div class="card-cat">${esc(product.category)}</div>
          <h3 class="card-title" title="${esc(product.title)}">${esc(product.title)}</h3>
          <div class="card-seller">
            <span class="school-badge">🎓 ${esc(product.seller_badge || 'Chưa xác thực')}</span>
            <span class="seller-alias">${esc(product.seller ? product.seller.alias : '')}</span>
          </div>
          <div class="card-delivery">${deliveryTags}</div>
          <div class="card-price-row">
            <span class="card-price">${vnd(product.price)}</span>
            ${product.original_price > product.price ? `<span class="card-old">${vnd(product.original_price)}</span>` : ''}
            ${discount > 0 ? `<span class="card-off">-${discount}%</span>` : ''}
          </div>
          <div class="card-actions">
            ${own
              ? '<span class="own-tag">Tin đăng của bạn · Quản lý trong Ví</span>'
              : `<button type="button" class="btn btn-outline" data-action="offer" data-id="${product.id}">Trả giá</button>
                 <button type="button" class="btn btn-primary" data-action="buy" data-id="${product.id}">Mua ngay</button>`}
          </div>
        </div>
      </article>
    `;
  }

  function renderProducts() {
    const grid = $('#productGrid');
    if (!grid) return;

    if (!state.products.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔎</div>
          <h3>Chưa có sản phẩm phù hợp</h3>
          <p>Thử chọn danh mục khác hoặc xoá từ khoá tìm kiếm.</p>
          <button type="button" class="btn btn-outline" data-action="reset-filters">Xoá bộ lọc</button>
        </div>
      `;
    } else {
      grid.innerHTML = state.products.map(productCard).join('');
    }

    const count = $('#productCount');
    if (count) {
      const filterText = [state.category && `danh mục ${state.category}`, state.q && `từ khoá "${state.q}"`]
        .filter(Boolean).join(' · ');
      count.textContent = `${state.total} sản phẩm đang bán${filterText ? ` · ${filterText}` : ''} · Cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  async function loadProducts() {
    const grid = $('#productGrid');
    if (!grid) return;
    if (!state.products.length) grid.innerHTML = skeletonCards();
    else grid.style.opacity = '.55';

    const params = new URLSearchParams();
    if (state.category) params.set('category', state.category);
    if (state.q) params.set('q', state.q);

    try {
      const data = await api(`/api/products${params.toString() ? `?${params}` : ''}`, { token: false });
      state.products = data.products || [];
      state.total = Number(data.total || 0);
      renderProducts();
    } catch (error) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Không tải được chợ</h3>
          <p>${esc(error.message)}</p>
          <button type="button" class="btn btn-outline" data-action="reload-products">Thử lại</button>
        </div>
      `;
    } finally {
      grid.style.opacity = '';
    }
  }

  /* -------------------------------- MODALS --------------------------------- */
  function openModal(html, mode = '', data = {}) {
    modalContext = { mode, data };
    const content = $('#modalContent');
    const modal = $('#modal');
    if (!content || !modal) return;
    content.innerHTML = html;
    const panel = $('.modal', modal);
    if (panel) panel.classList.toggle('wide', mode === 'dashboard');
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setTimeout(() => {
      const first = content.querySelector('input:not([type="hidden"]):not([disabled]), select, textarea');
      if (first) first.focus({ preventScroll: true });
    }, 40);
  }

  function closeModal() {
    const modal = $('#modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    if (['auth', 'otp', 'student'].includes(modalContext.mode)) state.afterLogin = null;
    modalContext = { mode: '', data: {} };
  }

  /* ------------------------------ AUTH MODAL ------------------------------- */
  function openAuth(tab = 'login') {
    const isLogin = tab === 'login';
    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Chào mừng đến Studeal</div>
        <h2>${isLogin ? 'Đăng nhập tài khoản' : 'Tạo tài khoản sinh viên'}</h2>
        <p>${isLogin
          ? 'Nhập email và mật khẩu. Studeal sẽ gửi mã OTP 6 số để xác thực đăng nhập.'
          : 'Đăng ký bằng email cá nhân. Sau đó xác thực email trường .edu.vn để nhận huy hiệu và đăng bán.'}</p>
      </div>

      <div class="auth-tabs">
        <button type="button" class="auth-tab ${isLogin ? 'active' : ''}" data-action="auth-tab" data-tab="login">Đăng nhập</button>
        <button type="button" class="auth-tab ${!isLogin ? 'active' : ''}" data-action="auth-tab" data-tab="register">Đăng ký</button>
      </div>

      <form data-form="${isLogin ? 'login' : 'register'}" class="form-grid" novalidate>
        ${!isLogin ? `
          <div class="field">
            <label for="authName">Họ và tên</label>
            <input class="input" id="authName" name="name" placeholder="Nguyễn Minh Anh" minlength="2" maxlength="80" required />
          </div>
        ` : ''}
        <div class="field">
          <label for="authEmail">Email</label>
          <input class="input" id="authEmail" name="email" type="email" placeholder="ban@studeal.namprojects.site" autocomplete="email" required />
        </div>
        <div class="field">
          <label for="authPassword">Mật khẩu</label>
          <input class="input" id="authPassword" name="password" type="password" placeholder="Tối thiểu 6 ký tự" minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required />
        </div>
        <button type="submit" class="btn btn-primary btn-block">${isLogin ? 'Gửi mã OTP đăng nhập' : 'Tạo tài khoản & nhận OTP'}</button>
      </form>

      <p class="form-note" style="margin-top:14px;">
        Tài khoản demo (mật khẩu 123456):
        <button type="button" class="link-btn" data-action="demo-login" data-email="namhuynhnhat2008@gmail.com">người mua</button> ·
        <button type="button" class="link-btn" data-action="demo-login" data-email="2612205118@student.hcmus.edu.vn">SV KHTN</button> ·
        <button type="button" class="link-btn" data-action="demo-login" data-email="nnamhuynh2008luuanh1@gmail.com">SV UIT</button>
      </p>
    `, 'auth');
  }

  function showOtpStep(data, context) {
    state.otp = {
      accountEmail: data.account_email,
      targetEmail: data.email,
      purpose: data.purpose,
      debug: data.debug_otp || '',
      context,
    };

    const contextNote = context === 'student'
      ? 'Xác thực email sinh viên để nhận huy hiệu trường ĐH.'
      : 'Xác thực đăng nhập Studeal.';

    openModal(`
      <div class="otp-wrap">
        <div class="otp-icon">✉️</div>
        <h2>Nhập mã OTP</h2>
        <p>${esc(contextNote)} Mã 6 số đã được gửi tới <strong>${esc(data.email || data.account_email)}</strong>.
           Mã có hiệu lực trong 5 phút.</p>

        ${data.debug_otp ? `
          <div class="demo-otp">
            <span>Mã demo</span>
            <strong>${esc(data.debug_otp)}</strong>
            <button type="button" data-action="fill-demo-otp">Điền mã</button>
          </div>
        ` : '<div class="alert alert-info" style="margin-bottom:12px;">Kiểm tra hộp thư (cả mục Spam) để lấy mã OTP.</div>'}

        <form data-form="otp" class="form-grid" novalidate>
          <input class="otp-input" name="otp" inputmode="numeric" autocomplete="one-time-code"
                 pattern="[0-9]{6}" maxlength="6" placeholder="••••••"
                 value="${esc(data.debug_otp || '')}" required />
          <button type="submit" class="btn btn-primary btn-block">Xác thực OTP</button>
        </form>

        <div class="otp-actions">
          <button type="button" data-action="resend-otp">Gửi lại mã</button>
          <button type="button" class="danger" data-action="back-auth">Đổi tài khoản</button>
        </div>
      </div>
    `, 'otp');
  }

  async function submitLogin(form, button) {
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) return showFormError(form, 'Vui lòng nhập email và mật khẩu.');

    setLoading(button, true, 'Đang gửi OTP...');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password }, token: false });
      toast(data.message || 'Đã gửi OTP.', 'success');
      showOtpStep(data, 'auth');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  async function submitRegister(form, button) {
    const name = form.elements.name.value.trim();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (name.length < 2) return showFormError(form, 'Họ tên phải có ít nhất 2 ký tự.');
    if (!email) return showFormError(form, 'Vui lòng nhập email.');

    setLoading(button, true, 'Đang tạo tài khoản...');
    try {
      const data = await api('/api/auth/register', { method: 'POST', body: { name, email, password }, token: false });
      toast(data.message || 'Đăng ký thành công.', 'success');
      showOtpStep(data, 'auth');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  async function submitOtp(form, button) {
    if (!state.otp) return;
    const otp = String(form.elements.otp.value || '').replace(/\D/g, '').slice(0, 6);
    if (otp.length !== 6) return showFormError(form, 'Mã OTP phải gồm đúng 6 chữ số.');

    setLoading(button, true, 'Đang xác thực...');
    try {
      const data = await api('/api/auth/verify-otp', {
        method: 'POST',
        token: false,
        body: { email: state.otp.accountEmail, otp, purpose: state.otp.purpose },
      });

      const wasStudent = state.otp.context === 'student';
      saveSession(data.token, data.user);
      const next = state.afterLogin;
      state.afterLogin = null;
      state.otp = null;
      closeModal();
      toast(data.message || 'Xác thực thành công!', 'success');
      await loadProducts();

      if (wasStudent) {
        if (next === 'sell') openSellModal();
        return;
      }

      if (next === 'sell') {
        if (data.user.is_student_verified) openSellModal();
        else {
          state.afterLogin = 'sell';
          openStudentModal();
          toast('Tài khoản đã đăng nhập. Hãy xác thực email sinh viên để đăng bán.', 'info');
        }
      } else if (next === 'student') {
        openStudentModal();
      }
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  async function resendOtp(button) {
    if (!state.otp) return;
    setLoading(button, true, 'Đang gửi...');
    try {
      const data = await api('/api/auth/resend-otp', {
        method: 'POST',
        token: false,
        body: { email: state.otp.accountEmail },
      });
      toast(data.message || 'Đã gửi lại mã OTP.', 'success');
      const context = state.otp.context;
      showOtpStep(data, context);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  }

  /* --------------------------- STUDENT VERIFY ------------------------------ */
  function openStudentModal() {
    if (!state.user) {
      state.afterLogin = 'student';
      openAuth('login');
      toast('Vui lòng đăng nhập trước khi xác thực sinh viên.', 'info');
      return;
    }

    const localPart = (state.user.email || 'sinhvien').split('@')[0].replace(/[^a-z0-9._-]/gi, '') || 'sinhvien';
    const suggested = `${localPart}@student.hcmus.edu.vn`;
    const current = state.user.is_student_verified
      ? `<div class="alert alert-info" style="margin-bottom:14px;">Tài khoản đang có huy hiệu <strong>${esc(state.user.university_name)}</strong> (${esc(state.user.student_email)}). Bạn có thể xác thực lại bằng email trường khác.</div>`
      : '';

    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Huy hiệu sinh viên</div>
        <h2>Xác thực email trường ĐH</h2>
        <p>Chỉ email có đuôi <strong>.edu.vn</strong> mới được xác thực. Studeal gửi OTP tới email sinh viên, không hiển thị email này cho người khác.</p>
      </div>
      ${current}
      <form data-form="student" class="form-grid" novalidate>
        <div class="field">
          <label for="studentEmail">Email sinh viên</label>
          <input class="input" id="studentEmail" name="student_email" type="email"
                 placeholder="tenban@student.hcmus.edu.vn" value="${esc(suggested)}" required />
          <span class="hint">Hỗ trợ: hcmus.edu.vn, uit.edu.vn, hcmut.edu.vn, ueh.edu.vn, vanlanguni.edu.vn và mọi email .edu.vn khác.</span>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Gửi OTP xác thực</button>
      </form>
      <p class="form-note" style="margin-top:12px;">Ví dụ hợp lệ: sinhvien@student.hcmus.edu.vn, baotq@gm.uit.edu.vn, sv@st.ueh.edu.vn.</p>
    `, 'student');
  }

  async function submitStudent(form, button) {
    const studentEmail = form.elements.student_email.value.trim();
    const submit = form.querySelector('button[type="submit"]');
    if (!studentEmail) return showFormError(form, 'Vui lòng nhập email sinh viên.');

    setLoading(button || submit, true, 'Đang gửi OTP...');
    try {
      const data = await api('/api/auth/verify-student', {
        method: 'POST',
        body: { student_email: studentEmail },
      });
      toast(data.message || 'Đã gửi OTP tới email sinh viên.', 'success');
      showOtpStep(data, 'student');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button || submit, false);
    }
  }

  /* ------------------------------- SELL MODAL ------------------------------ */
  function openSellModal() {
    if (!state.user) {
      state.afterLogin = 'sell';
      openAuth('login');
      toast('Đăng nhập để đăng bán sản phẩm.', 'info');
      return;
    }
    if (!state.user.is_student_verified) {
      state.afterLogin = 'sell';
      openStudentModal();
      toast('Bạn cần xác thực email sinh viên .edu.vn trước khi đăng bán.', 'info');
      return;
    }

    state.afterLogin = null;

    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Đăng tin miễn phí</div>
        <h2>Đăng bán đồ dùng sinh viên</h2>
        <p>Tin của bạn sẽ hiển thị ngay trên chợ. Hệ thống tự động che số điện thoại, email và link Zalo/Facebook trong mô tả.</p>
      </div>

      <form data-form="sell" class="form-grid two">
        <div class="field full">
          <label for="sellTitle">Tiêu đề sản phẩm</label>
          <input class="input" id="sellTitle" name="title" minlength="5" maxlength="160"
                 placeholder="VD: Giáo trình Giải tích 1 - ĐH KHTN" required />
        </div>

        <div class="field">
          <label for="sellCategory">Danh mục</label>
          <select class="select" id="sellCategory" name="category" required>
            ${CATEGORY_OPTIONS.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="sellCondition">Tình trạng</label>
          <select class="select" id="sellCondition" name="condition_text" required>
            ${CONDITION_OPTIONS.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="sellOriginal">Giá gốc (đ)</label>
          <input class="input" id="sellOriginal" name="original_price" type="number" min="0" step="1000" placeholder="150000" />
        </div>

        <div class="field">
          <label for="sellPrice">Giá bán (đ)</label>
          <input class="input" id="sellPrice" name="price" type="number" min="1000" step="1000" placeholder="75000" required />
        </div>

        <div class="field full">
          <label for="sellDescription">Mô tả</label>
          <textarea class="textarea" id="sellDescription" name="description" maxlength="3000"
            placeholder="Mô tả tình trạng, phụ kiện, lý do bán... Không cần ghi số điện thoại/Zalo, hệ thống sẽ tự che."></textarea>
          <span class="hint">SĐT 10 số, email, link Zalo/Facebook sẽ bị thay bằng *** để chống giao dịch ngoài luồng.</span>
        </div>

        <div class="field">
          <label for="sellImageUrl">Ảnh (URL)</label>
          <input class="input" id="sellImageUrl" name="image_url" type="url" placeholder="https://images.unsplash.com/..." />
        </div>

        <div class="field">
          <label for="sellImageFile">Hoặc tải ảnh lên</label>
          <input class="input" id="sellImageFile" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
          <span class="hint">Tối đa 5MB. Nếu có cả URL và file, file tải lên được ưu tiên.</span>
        </div>

        <div class="field full">
          <span class="field-label">Hình thức giao hàng</span>
          <div class="check-grid">
            <label class="check-row">
              <input type="checkbox" name="allow_meetup" checked />
              <span>Gặp trực tiếp
                <small>Người mua và người bán hẹn tại trường/khu vực an toàn.</small>
              </span>
            </label>
            <label class="check-row">
              <input type="checkbox" name="allow_ship_3rd" />
              <span>Ship bên thứ 3
                <small>Giao qua Grab, GHN, Viettel Post... người mua trả phí ship.</small>
              </span>
            </label>
            <label class="check-row">
              <input type="checkbox" name="allow_khtn_routine" />
              <span>Tuyến giao hàng KHTN miễn phí
                <small>Hàng tuần giữa CS1 Nguyễn Văn Cừ và CS2 Linh Trung (ĐH KHTN).</small>
              </span>
            </label>
          </div>
        </div>

        <div class="field full">
          <label for="sellMeetup">Địa điểm gặp / giao hàng</label>
          <input class="input" id="sellMeetup" name="meetup_location" maxlength="200"
                 value="ĐH KHTN CS1 - 227 Nguyễn Văn Cừ, Quận 5" list="meetupSuggestions" />
          <datalist id="meetupSuggestions">
            <option value="ĐH KHTN CS1 - 227 Nguyễn Văn Cừ, Quận 5"></option>
            <option value="ĐH KHTN CS2 - Linh Trung, Thủ Đức"></option>
            <option value="ĐH CNTT - Khu phố 6, Linh Trung, Thủ Đức"></option>
            <option value="ĐH Bách Khoa - 268 Lý Thường Kiệt, Quận 10"></option>
            <option value="ĐH Kinh tế TP.HCM - 59C Nguyễn Đình Chiểu, Quận 3"></option>
            <option value="Phường Đông Hòa, Dĩ An"></option>
          </datalist>
        </div>

        <div class="field full">
          <label class="switch-row" for="sellPromoted">
            <span>
              <strong>Quảng cáo Đẩy tin VIP <span style="color:var(--gold)">+15.000đ</span></strong>
              <small>Ưu tiên đứng đầu trang chủ, tăng lượt xem. Chế độ demo chưa trừ vào ví.</small>
            </span>
            <span class="switch">
              <input type="checkbox" id="sellPromoted" name="is_promoted" />
              <span></span>
            </span>
          </label>
        </div>

        <div class="field full">
          <button type="submit" class="btn btn-primary btn-block">Đăng bán ngay</button>
          <p class="form-note">Bằng việc đăng bán, bạn đồng ý giao dịch qua escrow Studeal. Phí sàn 2% chỉ trừ khi giao dịch thành công.</p>
        </div>
      </form>
    `, 'sell');
  }

  async function submitSell(form, button) {
    const formData = new FormData(form);
    const boolFields = ['allow_meetup', 'allow_ship_3rd', 'allow_khtn_routine', 'is_promoted'];
    boolFields.forEach((name) => {
      formData.set(name, form.elements[name] && form.elements[name].checked ? '1' : '0');
    });

    const imageFile = form.elements.image && form.elements.image.files && form.elements.image.files[0];
    if (imageFile && imageFile.size > 0) formData.set('image', imageFile);
    else formData.delete('image');

    setLoading(button, true, 'Đang đăng tin...');
    try {
      const data = await api('/api/products', { method: 'POST', form: formData });
      closeModal();
      toast(data.message || 'Đăng bán thành công!', 'success');
      state.category = '';
      state.q = '';
      const search = $('#searchInput');
      if (search) search.value = '';
      document.querySelectorAll('#categoryChips .chip').forEach((chip) => {
        chip.classList.toggle('active', chip.dataset.category === '');
      });
      await loadProducts();
      $('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  /* ------------------------------- OFFER MODAL ----------------------------- */
  function openOfferModal(product) {
    if (!state.user) {
      openAuth('login');
      toast('Đăng nhập để gửi mức giá trả.', 'info');
      return;
    }
    if (isOwnProduct(product)) {
      toast('Đây là sản phẩm của bạn.', 'info');
      return;
    }

    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Trả giá kín đáo</div>
        <h2>Đề xuất mức giá của bạn</h2>
        <p>Người bán chỉ có thể <strong>ACCEPT</strong> hoặc <strong>REJECT</strong>. Không có ô chat để bảo mật thông tin liên lạc.</p>
      </div>

      <div class="product-summary">
        <img src="${esc(product.image_url || FALLBACK_IMG)}" alt="${esc(product.title)}" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
        <div>
          <strong>${esc(product.title)}</strong>
          <small>${esc(product.seller_badge || '')} · ${esc(product.condition_text)}</small>
        </div>
        <span class="sum-price">${vnd(product.price)}</span>
      </div>

      <form data-form="offer" class="form-grid">
        <div class="field">
          <label for="offerPrice">Giá bạn muốn trả (đ)</label>
          <input class="input" id="offerPrice" name="offer_price" type="number" required
                 min="1000" max="${Math.max(1000, product.price - 1)}" step="1000" placeholder="40000" />
          <span class="hint">Phải thấp hơn giá niêm yết ${vnd(product.price)}. Nếu đồng ý giá niêm yết, hãy dùng Mua ngay.</span>
        </div>

        <div class="chips">
          ${[5, 10, 15].map((percent) => {
            const value = Math.max(1000, Math.floor((product.price * (1 - percent / 100)) / 1000) * 1000);
            return `<button type="button" class="chip" data-action="quick-offer" data-value="${value}">-${percent}% · ${vnd(value)}</button>`;
          }).join('')}
        </div>

        <div class="alert alert-info">Người bán nhận thông báo kèm mã ẩn danh của bạn. Không ai thấy email hay số điện thoại.</div>
        <button type="submit" class="btn btn-primary btn-block">Gửi mức giá trả</button>
      </form>
    `, 'offer', { product });
  }

  async function submitOffer(form, button) {
    if (!modalContext.data.product) return;
    const product = modalContext.data.product;
    const offerPrice = Number(form.elements.offer_price.value);

    if (!Number.isFinite(offerPrice) || offerPrice <= 0) return showFormError(form, 'Vui lòng nhập giá trả hợp lệ.');
    if (offerPrice >= product.price) return showFormError(form, `Giá trả phải thấp hơn ${vnd(product.price)}.`);

    setLoading(button, true, 'Đang gửi...');
    try {
      const data = await api('/api/offers', {
        method: 'POST',
        body: { product_id: product.id, offer_price: offerPrice },
      });
      closeModal();
      toast(data.message || 'Đã gửi mức giá trả.', 'success');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  /* ------------------------------ CHECKOUT -------------------------------- */
  function defaultDeliveryDetail(product, method) {
    if (method === 'MEETUP') return product.meetup_location || 'Thỏa thuận trực tiếp tại trường';
    if (method === 'KHTN_ROUTINE') return 'Tuyến KHTN: CS1 Nguyễn Văn Cừ <-> CS2 Linh Trung';
    return 'Giao qua đơn vị vận chuyển thứ 3 (địa chỉ xác nhận khi giao)';
  }

  function availableDeliveryMethods(product) {
    const methods = [];
    if (product.allow_meetup) {
      methods.push({
        code: 'MEETUP',
        label: DELIVERY_LABELS.MEETUP,
        desc: product.meetup_location || 'Hẹn gặp tại trường',
      });
    }
    if (product.allow_ship_3rd) {
      methods.push({
        code: 'SHIP_3RD',
        label: DELIVERY_LABELS.SHIP_3RD,
        desc: 'Grab / GHN / Viettel Post... người mua trả phí ship',
      });
    }
    if (product.allow_khtn_routine) {
      methods.push({
        code: 'KHTN_ROUTINE',
        label: DELIVERY_LABELS.KHTN_ROUTINE,
        desc: 'Miễn phí hàng tuần giữa CS1 Nguyễn Văn Cừ và CS2 Linh Trung',
      });
    }
    return methods;
  }

  function openCheckoutModal(product, offer = null) {
    if (!state.user) {
      openAuth('login');
      toast('Đăng nhập để thanh toán escrow.', 'info');
      return;
    }
    if (isOwnProduct(product)) {
      toast('Bạn không thể mua sản phẩm của chính mình.', 'info');
      return;
    }

    const methods = availableDeliveryMethods(product);
    if (!methods.length) {
      toast('Sản phẩm này chưa bật hình thức giao hàng nào.', 'error');
      return;
    }

    const price = offer ? Number(offer.offer_price) : Number(product.price);
    state.checkout = {
      product,
      offer,
      price,
      method: methods[0].code,
      voucher: null,
    };

    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Thanh toán escrow</div>
        <h2>Chốt đơn an toàn</h2>
        <p>Studeal giữ tiền ở trạng thái <strong>HOLDING</strong>. Người bán chỉ nhận 98% sau khi bạn xác nhận đã nhận hàng.</p>
      </div>

      <div class="product-summary">
        <img src="${esc(product.image_url || FALLBACK_IMG)}" alt="${esc(product.title)}" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
        <div>
          <strong>${esc(product.title)}</strong>
          <small>${esc(product.seller_badge || '')} · ${esc(product.seller ? product.seller.alias : '')}</small>
          ${offer ? `<span class="deal-badge">★ Giá đã deal · tiết kiệm ${vnd(Math.max(0, product.price - price))}</span>` : ''}
        </div>
        <span class="sum-price">${vnd(price)}</span>
      </div>

      <form data-form="checkout" class="form-grid">
        <div class="field">
          <span class="field-label">Hình thức nhận hàng</span>
          <div class="radio-list">
            ${methods.map((method, index) => `
              <label class="radio-card">
                <input type="radio" name="delivery_method" value="${method.code}" ${index === 0 ? 'checked' : ''} />
                <span>${esc(method.label)}<small>${esc(method.desc)}</small></span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="field">
          <label for="deliveryDetail">Chi tiết điểm hẹn / địa chỉ</label>
          <input class="input" id="deliveryDetail" name="delivery_detail" maxlength="300"
                 value="${esc(defaultDeliveryDetail(product, methods[0].code))}" />
        </div>

        <div class="field">
          <label for="voucherCode">Mã giảm giá</label>
          <div class="input-group">
            <input class="input" id="voucherCode" name="voucher_code" placeholder="STUDEAL50" maxlength="40" style="text-transform:uppercase" />
            <button type="button" class="btn btn-outline" data-action="apply-voucher">Áp dụng</button>
          </div>
        </div>

        <div id="checkoutSummary">${checkoutSummaryHtml()}</div>

        <button type="submit" class="btn btn-primary btn-block" id="payBtn">Thanh toán ${vnd(price)} (escrow)</button>
      </form>

      <p class="form-note" style="margin-top:10px;">Voucher được nền tảng tài trợ. Người bán vẫn nhận 98% trên giá chốt. Phí sàn 2% chỉ khấu trừ khi escrow COMPLETED.</p>
    `, 'checkout');

    modalContext.data.product = product;
    modalContext.data.offer = offer;
  }

  function checkoutSummaryHtml() {
    if (!state.checkout) return '';
    const { price, voucher } = state.checkout;
    const discount = voucher ? Number(voucher.discount_amount) : 0;
    const pay = Math.max(0, price - discount);
    const fee = Math.round(price * 0.02);
    const sellerReceive = price - fee;

    return `
      <div class="checkout-summary">
        <div class="sum-row"><span>Giá chốt giao dịch</span><strong>${vnd(price)}</strong></div>
        ${voucher ? `
          <div class="sum-row"><span>Voucher ${esc(voucher.code)}</span><strong style="color:var(--green-2)">-${vnd(discount)}</strong></div>
          <div class="voucher-applied">
            <span>✓ Đã áp dụng <strong>${esc(voucher.code)}</strong></span>
            <button type="button" data-action="remove-voucher">Bỏ mã</button>
          </div>
        ` : '<div class="sum-row fee"><span>Chưa áp dụng mã giảm giá</span><span>—</span></div>'}
        <div class="sum-row total"><span>Người mua thanh toán</span><strong>${vnd(pay)}</strong></div>
        <div class="sum-row fee"><span>Người bán nhận (98%)</span><span>${vnd(sellerReceive)}</span></div>
        <div class="sum-row fee"><span>Phí nền tảng (2%)</span><span>${vnd(fee)}</span></div>
      </div>
      <div class="escrow-note">
        <span>🛡</span>
        <div>Tiền được Studeal giữ ở trạng thái <strong>HOLDING</strong>. Chỉ giải ngân cho người bán sau khi bạn bấm “Xác nhận đã nhận hàng”.</div>
      </div>
    `;
  }

  function renderCheckoutSummary() {
    const wrapper = $('#checkoutSummary');
    if (wrapper) wrapper.innerHTML = checkoutSummaryHtml();
    const payButton = $('#payBtn');
    if (payButton && state.checkout) {
      const discount = state.checkout.voucher ? Number(state.checkout.voucher.discount_amount) : 0;
      payButton.textContent = `Thanh toán ${vnd(Math.max(0, state.checkout.price - discount))} (escrow)`;
    }
  }

  async function applyVoucher(button) {
    if (!state.checkout) return;
    const input = $('#voucherCode');
    const code = (input ? input.value : '').trim().toUpperCase();
    if (!code) {
      toast('Vui lòng nhập mã giảm giá.', 'error');
      return;
    }

    setLoading(button, true, 'Đang kiểm tra...');
    try {
      const data = await api('/api/vouchers/apply', {
        method: 'POST',
        token: false,
        body: { code, amount: state.checkout.price },
      });
      state.checkout.voucher = {
        code: data.code,
        discount_amount: data.discount_amount,
        description: data.description,
      };
      if (input) input.value = data.code;
      renderCheckoutSummary();
      toast(data.message, 'success');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  }

  async function submitCheckout(form, button) {
    if (!state.checkout) return;
    const methodInput = form.querySelector('input[name="delivery_method"]:checked');
    if (!methodInput) return showFormError(form, 'Vui lòng chọn hình thức nhận hàng.');

    const voucherCode = (form.elements.voucher_code.value || '').trim().toUpperCase();
    setLoading(button, true, 'Đang tạo đơn...');

    try {
      const data = await api('/api/orders/checkout', {
        method: 'POST',
        body: {
          product_id: state.checkout.product.id,
          offer_id: state.checkout.offer ? state.checkout.offer.id : undefined,
          delivery_method: methodInput.value,
          delivery_detail: form.elements.delivery_detail.value.trim(),
          voucher_code: voucherCode || undefined,
        },
      });
      state.checkout = null;
      closeModal();
      await loadProducts();
      toast('Đặt hàng thành công! Tiền đang được escrow giữ an toàn.', 'success');
      openOrderSuccess(data.order);
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setLoading(button, false);
    }
  }

  /* ---------------------------- ORDER SUCCESS ------------------------------ */
  function openOrderSuccess(order, completed = false) {
    const done = completed || order.escrow_status === 'COMPLETED';

    openModal(`
      <div class="otp-wrap" style="text-align:left;">
        <div class="otp-icon" style="margin-left:0;">${done ? '✅' : '🛡'}</div>
        <h2>${done ? 'Giao dịch hoàn tất!' : 'Đơn hàng đã được tạo'}</h2>
        <p style="margin-left:0;max-width:none;">
          ${done
            ? `Studeal đã giải ngân <strong>${vnd(order.seller_receive_amount)}</strong> (98%) cho người bán. Phí sàn 2% là ${vnd(order.platform_fee_2_percent)}.`
            : 'Studeal đang giữ tiền ở trạng thái <strong>HOLDING</strong>. Hãy kiểm tra hàng và chỉ xác nhận khi đã nhận được sản phẩm.'}
        </p>

        <div class="product-summary">
          <img src="${esc(order.product.image_url || FALLBACK_IMG)}" alt="${esc(order.product.title)}" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
          <div>
            <strong>${esc(order.product.title)}</strong>
            <small>Đơn #${order.id} · ${esc(order.delivery_method_label)}</small>
            <span style="margin-top:3px;">${statusPill(order.escrow_status)}</span>
          </div>
          <span class="sum-price">${vnd(order.final_price)}</span>
        </div>

        <div class="checkout-summary">
          <div class="sum-row"><span>Giá chốt</span><strong>${vnd(order.final_price)}</strong></div>
          ${order.discount_amount > 0 ? `<div class="sum-row"><span>Voucher ${esc(order.voucher_code || '')}</span><strong>-${vnd(order.discount_amount)}</strong></div>` : ''}
          <div class="sum-row total"><span>Người mua thanh toán</span><strong>${vnd(order.buyer_paid_amount)}</strong></div>
          <div class="sum-row fee"><span>Người bán nhận (98%)</span><span>${vnd(order.seller_receive_amount)}</span></div>
          <div class="sum-row fee"><span>Phí nền tảng (2%)</span><span>${vnd(order.platform_fee_2_percent)}</span></div>
          <div class="sum-row fee"><span>Điểm hẹn / giao hàng</span><span style="text-align:right;max-width:230px;">${esc(order.delivery_detail || '')}</span></div>
        </div>

        ${!done && order.can_confirm_received ? `
          <div class="escrow-note" style="margin:14px 0;">
            <span>⚠️</span>
            <div>Chỉ bấm xác nhận sau khi đã nhận đúng sản phẩm. Thao tác này không thể hoàn tác và sẽ giải ngân 98% cho người bán.</div>
          </div>
          <button type="button" class="btn btn-primary btn-block" data-action="confirm-order" data-id="${order.id}">
            Tôi đã nhận hàng · Giải ngân
          </button>
        ` : ''}

        <div class="form-actions" style="margin-top:10px;">
          <button type="button" class="btn btn-outline" data-action="open-dashboard">Xem đơn của tôi</button>
          <button type="button" class="btn btn-ghost" data-action="close-modal">Tiếp tục mua sắm</button>
        </div>
      </div>
    `, 'success', { order });
  }

  async function confirmOrder(orderId, button) {
    setLoading(button, true, 'Đang giải ngân...');
    try {
      const data = await api(`/api/orders/${orderId}/confirm-received`, { method: 'POST' });
      await loadMe();
      toast(data.message || 'Xác nhận nhận hàng thành công.', 'success');
      if (modalContext.mode === 'dashboard') {
        await openDashboard(state.dashboard ? state.dashboard.tab : 'buying');
      } else {
        openOrderSuccess(data.order, true);
      }
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  }

  /* -------------------------------- DASHBOARD ------------------------------ */
  async function openDashboard(tab = (state.dashboard ? state.dashboard.tab : 'buying')) {
    if (!state.user) {
      openAuth('login');
      toast('Đăng nhập để xem ví và đơn hàng.', 'info');
      return;
    }

    openModal(`
      <div class="modal-head">
        <div class="section-kicker">Tài khoản của bạn</div>
        <h2>Đang tải dữ liệu...</h2>
        <p>Ví, đơn escrow, lời trả giá và tin đăng.</p>
      </div>
      <div class="sk-body" style="padding:0;">
        <div class="sk-line w80"></div>
        <div class="sk-line w60"></div>
        <div class="sk-line w40"></div>
      </div>
    `, 'dashboard');

    try {
      const [me, offers, orders, listings] = await Promise.all([
        api('/api/auth/me'),
        api('/api/offers/my'),
        api('/api/orders/my'),
        api('/api/products/my'),
      ]);

      state.user = me.user;
      renderAuthArea();
      state.dashboard = {
        tab: ['buying', 'selling', 'received', 'sent', 'listings'].includes(tab) ? tab : 'buying',
        offers,
        buying: orders.buying || [],
        selling: orders.selling || [],
        listings: listings.products || [],
      };
      renderDashboard();
    } catch (error) {
      if (error.status === 401) {
        closeModal();
        openAuth('login');
      } else {
        toast(error.message, 'error');
        openModal(`
          <div class="modal-head">
            <div class="section-kicker">Có lỗi</div>
            <h2>Không tải được dữ liệu</h2>
            <p>${esc(error.message)}</p>
          </div>
          <button type="button" class="btn btn-primary btn-block" data-action="refresh-dashboard">Thử lại</button>
        `, 'dashboard');
      }
    }
  }

  function renderDashboard() {
    const data = state.dashboard;
    const user = state.user;
    if (!data || !user) return;

    const initial = (user.name || 'S').trim().charAt(0).toUpperCase();
    const tabs = [
      ['buying', 'Đơn mua', data.buying.length],
      ['selling', 'Đơn bán', data.selling.length],
      ['received', 'Offer nhận', data.offers.received.length],
      ['sent', 'Offer gửi', data.offers.sent.length],
      ['listings', 'Tin đăng', data.listings.length],
    ];

    openModal(`
      <div class="dash-head">
        <div class="dash-avatar">${esc(initial)}</div>
        <div class="dash-ident">
          <h2>${esc(user.name)}</h2>
          <p>${esc(user.email)}</p>
          <span class="dash-school">🎓 ${esc(user.is_student_verified ? user.university_name : 'Chưa xác thực sinh viên')}</span>
        </div>
        <div class="dash-wallet">
          <span>Số dư ví nhận tiền bán</span>
          <strong>${vnd(user.wallet_balance)}</strong>
        </div>
      </div>

      ${!user.is_student_verified ? `
        <div class="alert alert-info" style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <span>Xác thực email .edu.vn để mở khóa đăng bán và nhận huy hiệu trường.</span>
          <button type="button" class="btn btn-primary btn-sm" data-action="verify-student">Xác thực ngay</button>
        </div>
      ` : ''}

      <div class="dash-tabs">
        ${tabs.map(([key, label, count]) => `
          <button type="button" class="dash-tab ${data.tab === key ? 'active' : ''}" data-action="dashboard-tab" data-tab="${key}">
            ${esc(label)} <span>${count}</span>
          </button>
        `).join('')}
        <button type="button" class="dash-tab" data-action="refresh-dashboard" title="Làm mới">↻</button>
        <button type="button" class="dash-tab" data-action="open-sell">＋ Đăng bán</button>
      </div>

      <div class="dash-list">${dashboardBody()}</div>
    `, 'dashboard');
  }

  function dashEmpty(icon, text) {
    return `<div class="dash-empty"><span>${icon}</span>${esc(text)}</div>`;
  }

  function dashboardBody() {
    const data = state.dashboard;
    if (!data) return '';

    if (data.tab === 'buying' || data.tab === 'selling') {
      const orders = data.tab === 'buying' ? data.buying : data.selling;
      if (!orders.length) {
        return dashEmpty('🧾', data.tab === 'buying' ? 'Bạn chưa có đơn mua nào. Hãy chọn một món đồ trên chợ!' : 'Bạn chưa bán được món nào.');
      }
      return orders.map(renderOrderItem).join('');
    }

    if (data.tab === 'received') {
      const offers = data.offers.received;
      if (!offers.length) return dashEmpty('🤝', 'Chưa có ai trả giá cho tin đăng của bạn.');
      return offers.map((offer) => renderOfferItem(offer, 'received')).join('');
    }

    if (data.tab === 'sent') {
      const offers = data.offers.sent;
      if (!offers.length) return dashEmpty('💬', 'Bạn chưa gửi mức giá trả nào.');
      return offers.map((offer) => renderOfferItem(offer, 'sent')).join('');
    }

    const listings = data.listings;
    if (!listings.length) return dashEmpty('🏷️', 'Bạn chưa đăng bán sản phẩm nào.');
    return listings.map(renderListingItem).join('');
  }

  function renderOrderItem(order) {
    const isBuyer = order.viewer_role === 'BUYER';
    const amount = isBuyer ? order.buyer_paid_amount : order.seller_receive_amount;
    const caption = isBuyer ? 'Bạn đã trả' : 'Bạn nhận được';

    return `
      <div class="dash-item">
        <img src="${esc(order.product.image_url || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
        <div class="dash-item-main">
          <strong>${esc(order.product.title)}</strong>
          <small>Đơn #${order.id} · ${fmtDate(order.created_at)}</small>
          <small>${esc(order.delivery_method_label)} · ${esc(order.delivery_detail || '')}</small>
          <div style="margin-top:4px;">${statusPill(order.escrow_status)}
            ${!isBuyer ? `<span class="seller-alias">Phí sàn: ${vnd(order.platform_fee_2_percent)}</span>` : ''}
          </div>
        </div>
        <div class="dash-item-side">
          <small>${caption}</small>
          <b>${vnd(amount)}</b>
          <div class="dash-actions">
            ${order.can_confirm_received
              ? `<button type="button" class="btn btn-primary" data-action="confirm-order" data-id="${order.id}">Đã nhận hàng</button>`
              : `<button type="button" class="btn btn-outline" data-action="view-order" data-id="${order.id}">Chi tiết</button>`}
          </div>
        </div>
      </div>
    `;
  }

  function renderOfferItem(offer, mode) {
    const isReceived = mode === 'received';
    const counterpart = isReceived ? offer.buyer : offer.seller;
    const canAccept = isReceived && offer.status === 'PENDING';
    const canCheckout = !isReceived && offer.status === 'ACCEPTED' && offer.product.status === 'AVAILABLE';

    return `
      <div class="dash-item">
        <img src="${esc(offer.product.image_url || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
        <div class="dash-item-main">
          <strong>${esc(offer.product.title)}</strong>
          <small>${isReceived ? 'Người mua' : 'Người bán'}: ${esc(counterpart.alias)}${counterpart.university ? ` · ${esc(counterpart.university)}` : ''}</small>
          <small>${fmtDate(offer.created_at)} · Giá niêm yết ${vnd(offer.product.price)}</small>
          <div style="margin-top:4px;">${statusPill(offer.status)}</div>
        </div>
        <div class="dash-item-side">
          <small>Giá trả</small>
          <b>${vnd(offer.offer_price)}</b>
          <div class="dash-actions">
            ${canAccept ? `
              <button type="button" class="btn btn-primary" data-action="accept-offer" data-id="${offer.id}">ACCEPT</button>
              <button type="button" class="btn btn-danger" data-action="reject-offer" data-id="${offer.id}">REJECT</button>
            ` : ''}
            ${canCheckout ? `
              <button type="button" class="btn btn-gold" data-action="checkout-offer" data-id="${offer.id}">Mua giá deal</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderListingItem(product) {
    return `
      <div class="dash-item">
        <img src="${esc(product.image_url || FALLBACK_IMG)}" alt="" onerror="this.onerror=null;this.src='${FALLBACK_ATTR}'" />
        <div class="dash-item-main">
          <strong>${esc(product.title)}</strong>
          <small>${esc(product.category)} · ${esc(product.condition_text)} · ${fmtDate(product.created_at)}</small>
          <div style="margin-top:4px;">
            ${statusPill(product.status)}
            ${product.is_promoted ? '<span class="vip-ribbon" style="position:static;display:inline-flex;">★ VIP</span>' : ''}
            ${product.pending_offers > 0 ? `<span class="seller-alias">· ${product.pending_offers} offer chờ duyệt</span>` : ''}
          </div>
        </div>
        <div class="dash-item-side">
          <small>Giá bán</small>
          <b>${vnd(product.price)}</b>
          ${product.pending_offers > 0
            ? `<button type="button" class="btn btn-outline" data-action="dashboard-tab" data-tab="received">Xem offer</button>`
            : ''}
        </div>
      </div>
    `;
  }

  async function respondOffer(offerId, status, button) {
    setLoading(button, true, status === 'ACCEPT' ? 'Đang nhận...' : 'Đang từ chối...');
    try {
      const data = await api(`/api/offers/${offerId}/respond`, {
        method: 'POST',
        body: { status },
      });
      toast(data.message, status === 'ACCEPT' ? 'success' : 'info');
      await loadProducts();
      await openDashboard(state.dashboard ? state.dashboard.tab : 'received');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(button, false);
    }
  }

  async function checkoutOffer(offerId) {
    const offer = state.dashboard
      && state.dashboard.offers.sent.find((item) => Number(item.id) === Number(offerId));
    if (!offer) return;

    try {
      const data = await api(`/api/products/${offer.product_id}`, { token: false });
      if (!data.product || data.product.status !== 'AVAILABLE') {
        toast('Sản phẩm đã được bán hoặc không còn khả dụng.', 'error');
        await openDashboard('sent');
        return;
      }
      openCheckoutModal(data.product, offer);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  /* ------------------------------- EVENTS ---------------------------------- */
  function resetFilters() {
    state.category = '';
    state.q = '';
    const search = $('#searchInput');
    if (search) search.value = '';
    document.querySelectorAll('#categoryChips .chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.category === '');
    });
    loadProducts();
  }

  function handleGlobalClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target || target.closest('#modalContent')) return;

    switch (target.dataset.action) {
      case 'open-auth': openAuth('login'); break;
      case 'open-sell': openSellModal(); break;
      case 'open-dashboard': openDashboard(); break;
      case 'logout': clearSession(); break;
      case 'copy-voucher': copyVoucher(target.dataset.code); break;
      case 'reset-filters': resetFilters(); break;
      case 'reload-products': loadProducts(); break;
      case 'buy': {
        const product = state.products.find((item) => Number(item.id) === Number(target.dataset.id));
        if (product) openCheckoutModal(product);
        break;
      }
      case 'offer': {
        const product = state.products.find((item) => Number(item.id) === Number(target.dataset.id));
        if (product) openOfferModal(product);
        break;
      }
      default: break;
    }
  }

  function handleModalClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;

    switch (target.dataset.action) {
      case 'auth-tab':
        openAuth(target.dataset.tab === 'register' ? 'register' : 'login');
        break;

      case 'demo-login': {
        const email = target.dataset.email;
        openAuth('login');
        setTimeout(() => {
          const form = $('#modalContent form[data-form="login"]');
          if (!form) return;
          form.elements.email.value = email;
          form.elements.password.value = '123456';
          form.requestSubmit();
        }, 70);
        break;
      }

      case 'fill-demo-otp': {
        const input = $('#modalContent input[name="otp"]');
        if (input && state.otp) {
          input.value = state.otp.debug || '';
          input.focus();
        }
        break;
      }

      case 'resend-otp': resendOtp(target); break;
      case 'back-auth':
        state.otp = null;
        state.afterLogin = null;
        openAuth('login');
        break;

      case 'quick-offer': {
        const input = $('#offerPrice');
        if (input) {
          input.value = target.dataset.value;
          input.focus();
        }
        break;
      }

      case 'apply-voucher': applyVoucher(target); break;

      case 'remove-voucher': {
        if (state.checkout) state.checkout.voucher = null;
        const voucherInput = $('#voucherCode');
        if (voucherInput) voucherInput.value = '';
        renderCheckoutSummary();
        break;
      }

      case 'close-modal': closeModal(); break;
      case 'open-dashboard': openDashboard(); break;
      case 'open-sell': openSellModal(); break;
      case 'open-auth': openAuth('login'); break;
      case 'verify-student': openStudentModal(); break;
      case 'logout': clearSession(); closeModal(); break;

      case 'confirm-order':
        confirmOrder(Number(target.dataset.id), target);
        break;

      case 'accept-offer':
        respondOffer(Number(target.dataset.id), 'ACCEPT', target);
        break;

      case 'reject-offer':
        respondOffer(Number(target.dataset.id), 'REJECT', target);
        break;

      case 'checkout-offer':
        checkoutOffer(Number(target.dataset.id));
        break;

      case 'dashboard-tab':
        if (state.dashboard) {
          state.dashboard.tab = target.dataset.tab || 'buying';
          renderDashboard();
        }
        break;

      case 'refresh-dashboard':
        openDashboard(state.dashboard ? state.dashboard.tab : 'buying');
        break;

      case 'view-order':
        if (state.dashboard) {
          const allOrders = [...state.dashboard.buying, ...state.dashboard.selling];
          const order = allOrders.find((item) => Number(item.id) === Number(target.dataset.id));
          if (order) openOrderSuccess(order, order.escrow_status === 'COMPLETED');
        }
        break;

      default: break;
    }
  }

  function handleModalSubmit(event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();

    const button = form.querySelector('button[type="submit"]');
    switch (form.dataset.form) {
      case 'login': submitLogin(form, button); break;
      case 'register': submitRegister(form, button); break;
      case 'otp': submitOtp(form, button); break;
      case 'student': submitStudent(form, button); break;
      case 'sell': submitSell(form, button); break;
      case 'offer': submitOffer(form, button); break;
      case 'checkout': submitCheckout(form, button); break;
      default: break;
    }
  }

  function handleModalChange(event) {
    if (event.target.name === 'delivery_method' && state.checkout) {
      state.checkout.method = event.target.value;
      const detail = $('#deliveryDetail');
      if (detail) detail.value = defaultDeliveryDetail(state.checkout.product, event.target.value);
      renderCheckoutSummary();
    }

    if (event.target.name === 'voucher_code' && state.checkout && state.checkout.voucher) {
      const typed = event.target.value.trim().toUpperCase();
      if (typed !== state.checkout.voucher.code) {
        state.checkout.voucher = null;
        renderCheckoutSummary();
      }
    }
  }

  function bindEvents() {
    document.addEventListener('click', handleGlobalClick);

    const modal = $('#modal');
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('[data-close]')) closeModal();
      });
    }

    const modalContent = $('#modalContent');
    if (modalContent) {
      modalContent.addEventListener('click', handleModalClick);
      modalContent.addEventListener('submit', handleModalSubmit);
      modalContent.addEventListener('change', handleModalChange);
    }

    const searchForm = $('#searchForm');
    const searchInput = $('#searchInput');
    if (searchForm) {
      searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        state.q = searchInput ? searchInput.value.trim() : '';
        loadProducts();
        $('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        state.q = searchInput.value.trim();
        loadProducts();
      }, 400));
    }

    const chips = $('#categoryChips');
    if (chips) {
      chips.addEventListener('click', (event) => {
        const chip = event.target.closest('[data-category]');
        if (!chip) return;
        state.category = chip.dataset.category || '';
        chips.querySelectorAll('.chip').forEach((item) => {
          item.classList.toggle('active', item === chip);
        });
        loadProducts();
      });
    }

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });
  }

  /* --------------------------------- INIT ---------------------------------- */
  async function init() {
    bindEvents();
    renderAuthArea();
    await Promise.allSettled([loadMe(), loadVouchers(), loadProducts()]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
