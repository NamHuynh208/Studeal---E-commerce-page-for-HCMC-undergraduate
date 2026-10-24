/* =============================================================================
 * STUDEAL MARKETPLACE
 * Trang chủ gọi trực tiếp API /api: sản phẩm, offer, voucher, escrow, VietQR.
 * Vanilla JS, không framework, không dùng cú pháp template phía server.
 * ========================================================================== */
(() => {
  'use strict';

  const API_BASE = '';
  const TOKEN_KEY = 'studeal_token';
  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=900&q=80';
  const VIETQR_BANK = {
    bin: '970436',
    account: '0000000000',
    name: 'STUDEAL DEMO',
    label: 'Vietcombank · Tài khoản minh họa',
  };
  const VOUCHER_FALLBACK = [
    { code: 'STUDEAL50', description: 'Giảm 20% tối đa 50.000đ' },
    { code: 'KHTNFREE', description: 'Giảm 15.000đ cho sinh viên KHTN' },
    { code: 'TANSV2026', description: 'Giảm 10% cho tân sinh viên 2026' },
  ];
  const VOUCHER_ORDER = { STUDEAL50: 1, KHTNFREE: 2, TANSV2026: 3 };
  const DELIVERY_META = {
    MEETUP: {
      label: 'Gặp mặt trực tiếp',
      short: 'Gặp mặt',
      icon: 'fa-handshake',
      desc: 'Tại trường, quận hoặc phường theo điểm hẹn của người bán.',
      tone: 'bg-sky-50 text-sky-700 ring-sky-100',
    },
    SHIP_3RD: {
      label: 'Ship bên thứ 3',
      short: 'Ship 3rd',
      icon: 'fa-truck-fast',
      desc: 'Tự đặt Grab/AhaMove, phí ship thanh toán riêng cho tài xế.',
      tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    },
    KHTN_ROUTINE: {
      label: 'Tuyến KHTN miễn phí',
      short: 'Tuyến KHTN',
      icon: 'fa-route',
      desc: 'CS1 ↔ CS2, miễn phí, chọn chuyến Thứ 4 hoặc Thứ 7.',
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
  };
  const STATUS_META = {
    PENDING: { label: 'Chờ phản hồi', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
    ACCEPTED: { label: 'Đã chấp nhận', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    REJECTED: { label: 'Đã từ chối', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
    AVAILABLE: { label: 'Đang bán', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
    SOLD: { label: 'Đã bán', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
    HOLDING: { label: 'Đang giữ tiền', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
    COMPLETED: { label: 'Hoàn tất', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
    CANCELLED: { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  };
  const BTN = {
    primary: 'inline-flex h-10 w-full items-center justify-center gap-2 bg-sky-600 px-3 text-xs font-extrabold text-white shadow-lg shadow-sky-500/15 transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70',
    outline: 'inline-flex h-10 w-full items-center justify-center gap-2 border border-sky-200 bg-white px-3 text-xs font-extrabold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-70',
    gold: 'inline-flex h-10 w-full items-center justify-center gap-2 bg-amber-400 px-3 text-xs font-extrabold text-amber-950 shadow-lg shadow-amber-400/25 transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-70',
    soft: 'inline-flex h-9 items-center justify-center gap-2 bg-sky-50 px-3.5 text-[11px] font-extrabold text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-100 disabled:cursor-wait disabled:opacity-70',
    danger: 'inline-flex h-9 items-center justify-center gap-2 bg-rose-50 px-3.5 text-[11px] font-extrabold text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70',
    success: 'inline-flex h-9 items-center justify-center gap-2 bg-emerald-600 px-3.5 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-70',
  };

  const state = {
    token: '',
    sessionGeneration: 0,
    authReady: true,
    user: null,
    products: [],
    productsLoaded: false,
    loadingProducts: false,
    productError: null,
    marketSig: '',
    filters: { q: '', category: '', delivery: '' },
    offers: { sent: [], received: [] },
    orders: { buying: [], selling: [], orders: [] },
    vouchers: [],
    cart: null,
    cartOpen: false,
    offersTab: 'received',
    afterAuth: null,
    authFlow: null,
    authTab: 'login',
    modalSeq: 0,
    cartSeq: 0,
    lastFocused: null,
    sessionNoticeShown: false,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const vnd = (value) => `${new Intl.NumberFormat('vi-VN').format(Math.round(Number(value) || 0))}đ`;
  const digits = (value) => String(value == null ? '' : value).replace(/\D/g, '');
  const normalize = (value) => String(value == null ? '' : value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  const aliasFor = (id) => `Sinh viên #${100 + Number(id)}`;
  const userInitial = (user) => {
    const name = String(user && user.name ? user.name : 'S').trim();
    return esc(name.charAt(0).toUpperCase() || 'S');
  };
  const fmtDate = (value) => {
    try {
      return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return '';
    }
  };
  const fmtShortDate = (value) => {
    try {
      return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };
  const storageGet = (key) => {
    try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
  };
  const storageSet = (key, value) => {
    try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
  };
  const storageRemove = (key) => {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  };
  const debounce = (fn, delay = 180) => {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  };

  function api(path, { method = 'GET', body, form, auth = true, headers: extraHeaders = {} } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
    if (auth && state.token) headers.Authorization = `Bearer ${state.token}`;
    Object.assign(headers, extraHeaders);

    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: form || (body === undefined ? undefined : JSON.stringify(body)),
      cache: 'no-store',
    }).catch(() => {
      const error = new Error('Không kết nối được API Studeal. Kiểm tra backend ở cổng 3001.');
      error.network = true;
      throw error;
    }).then(async (response) => {
      const text = await response.text();
      let data = {};
      if (text) {
        try { data = JSON.parse(text); } catch { data = { message: text.slice(0, 300) }; }
      }
      if (!response.ok) {
        if (response.status === 401 && auth) handleSessionExpired();
        const error = new Error(data.error || data.message || `Yêu cầu thất bại (${response.status}).`);
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    });
  }

  function toast(message, type = 'info', timeout = 4200) {
    const stack = $('#marketToastStack');
    if (!stack) return;
    const meta = {
      success: { icon: 'fa-circle-check', tone: 'bg-emerald-400/15 text-emerald-300' },
      error: { icon: 'fa-circle-exclamation', tone: 'bg-rose-400/15 text-rose-300' },
      info: { icon: 'fa-circle-info', tone: 'bg-sky-400/15 text-sky-300' },
    }[type] || { icon: 'fa-circle-info', tone: 'bg-sky-400/15 text-sky-300' };

    while (stack.children.length >= 4) stack.firstElementChild.remove();
    const item = document.createElement('div');
    item.className = 'toast-card pointer-events-auto flex items-start gap-3 border border-white/10 bg-slate-950/95 p-3.5 text-sm text-white shadow-2xl shadow-slate-950/25 backdrop-blur';
    item.innerHTML = `
      <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center ${meta.tone}">
        <i class="fa-solid ${meta.icon} text-xs" aria-hidden="true"></i>
      </span>
      <p class="min-w-0 flex-1 pt-0.5 text-[12px] font-semibold leading-relaxed">${esc(message)}</p>
    `;
    stack.appendChild(item);
    window.setTimeout(() => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(8px)';
      item.style.transition = 'opacity .2s ease, transform .2s ease';
      window.setTimeout(() => item.remove(), 220);
    }, timeout);
  }

  function setButtonLoading(button, loading, label = 'Đang xử lý…') {
    if (!button) return;
    if (loading) {
      if (!button.dataset.originalContent) button.dataset.originalContent = button.innerHTML;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.classList.add('opacity-70', 'cursor-wait');
      button.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true"></i><span>${esc(label)}</span>`;
    } else {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.classList.remove('opacity-70', 'cursor-wait');
      if (button.dataset.originalContent) {
        button.innerHTML = button.dataset.originalContent;
        delete button.dataset.originalContent;
      }
    }
  }

  function showFormError(form, message) {
    const box = form ? form.querySelector('[data-form-error]') : null;
    if (box) {
      box.textContent = message;
      box.classList.remove('hidden');
    }
    const first = form ? form.querySelector('input, select, textarea') : null;
    if (first) first.focus();
  }

  function resetFormError(form) {
    const box = form ? form.querySelector('[data-form-error]') : null;
    if (box) {
      box.textContent = '';
      box.classList.add('hidden');
    }
  }

  function syncBodyLock() {
    const modal = $('#marketModal');
    const cart = $('#marketCartRoot');
    const open = (modal && !modal.classList.contains('hidden')) || (cart && !cart.classList.contains('hidden'));
    document.body.classList.toggle('overflow-hidden', Boolean(open));
  }

  function openModal(html, { wide = false, label = 'Hộp thoại Studeal' } = {}) {
    const root = $('#marketModal');
    const panel = $('#marketModalPanel');
    const content = $('#marketModalContent');
    if (!root || !panel || !content) return;

    if (root.classList.contains('hidden')) state.lastFocused = document.activeElement;
    content.innerHTML = html;
    state.modalSeq += 1;
    panel.classList.toggle('max-w-3xl', wide);
    panel.classList.toggle('max-w-lg', !wide);
    panel.setAttribute('aria-label', label);
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    window.requestAnimationFrame(() => {
      root.classList.add('is-open');
      window.setTimeout(() => {
        const target = content.querySelector('input:not([type="hidden"]), select, textarea, button');
        if (target) target.focus({ preventScroll: true });
      }, 60);
    });
  }

  function closeModal() {
    const root = $('#marketModal');
    const content = $('#marketModalContent');
    if (!root || root.classList.contains('hidden')) return;
    root.classList.remove('is-open');
    const token = ++state.modalSeq;
    window.setTimeout(() => {
      if (token !== state.modalSeq) return;
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
      if (content) content.innerHTML = '';
      syncBodyLock();
      if (state.lastFocused && document.contains(state.lastFocused)) {
        try { state.lastFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    }, 190);
  }

  function openCart() {
    const root = $('#marketCartRoot');
    const panel = $('#marketCartPanel');
    const backdrop = $('#marketCartBackdrop');
    if (!root || !panel) return;
    renderCart();
    state.cartSeq += 1;
    root.classList.remove('hidden');
    root.setAttribute('aria-hidden', 'false');
    syncBodyLock();
    window.requestAnimationFrame(() => {
      if (backdrop) backdrop.classList.add('opacity-100');
      panel.classList.remove('translate-x-full');
      panel.focus({ preventScroll: true });
    });
  }

  function closeCart() {
    const root = $('#marketCartRoot');
    const panel = $('#marketCartPanel');
    const backdrop = $('#marketCartBackdrop');
    if (!root || root.classList.contains('hidden')) return;
    if (backdrop) backdrop.classList.remove('opacity-100');
    if (panel) panel.classList.add('translate-x-full');
    const token = ++state.cartSeq;
    window.setTimeout(() => {
      if (token !== state.cartSeq) return;
      root.classList.add('hidden');
      root.setAttribute('aria-hidden', 'true');
      syncBodyLock();
    }, 300);
  }

  function trapFocus(event, container) {
    if (!container || event.key !== 'Tab') return;
    const items = $$('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', container)
      .filter((node) => node.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function statusPill(status) {
    const meta = STATUS_META[status] || { label: status || 'Không rõ', cls: 'bg-slate-100 text-slate-600 ring-slate-200' };
    return `<span class="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-extrabold ring-1 ${meta.cls}">${esc(meta.label)}</span>`;
  }

  function categoryMeta(category) {
    const map = {
      'Giáo trình': { icon: 'fa-book-open', cls: 'bg-sky-50 text-sky-700 ring-sky-100' },
      'Điện tử': { icon: 'fa-laptop', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-100' },
      'Đồ trọ': { icon: 'fa-couch', cls: 'bg-amber-50 text-amber-700 ring-amber-100' },
      'Dụng cụ học tập': { icon: 'fa-pencil-ruler', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
    };
    return map[category] || { icon: 'fa-tag', cls: 'bg-slate-50 text-slate-600 ring-slate-100' };
  }

  function shortLocation(location) {
    const text = String(location || '').trim();
    if (!text) return 'Điểm hẹn tại trường';
    const head = text.split(/\s+[-–—]\s+/)[0] || text;
    return head.length > 34 ? `${head.slice(0, 31)}…` : head;
  }

  function deliveryTags(product) {
    return (product.delivery_methods || []).map((method) => {
      const meta = DELIVERY_META[method.code] || { icon: 'fa-truck', tone: 'bg-slate-50 text-slate-600 ring-slate-100' };
      let label = meta.short;
      if (method.code === 'MEETUP') label = `Tại ${shortLocation(product.meetup_location)}`;
      if (method.code === 'KHTN_ROUTINE') label = 'Miễn phí CS1-CS2';
      return `<span class="inline-flex max-w-full items-center gap-1 px-2 py-1 text-[9px] font-extrabold ring-1 ${meta.tone}">
        <i class="fa-solid ${meta.icon}" aria-hidden="true"></i><span class="truncate">${esc(label)}</span>
      </span>`;
    }).join('');
  }

  function sellerBadge(product) {
    const badge = product.seller_badge || (product.seller && product.seller.university) || 'sinh viên';
    return `<div class="flex min-w-0 items-center gap-1.5">
      <span class="inline-flex max-w-full items-center gap-1 bg-emerald-50 px-2 py-1 text-[9px] font-extrabold text-emerald-700 ring-1 ring-emerald-100" title="Bảo mật 100% thông tin liên lạc">
        <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
        <span class="truncate">Đã xác thực ${esc(badge)}</span>
      </span>
      <i class="fa-solid fa-lock shrink-0 text-[8px] text-emerald-500" title="Không hiển thị email, số điện thoại hay Zalo" aria-hidden="true"></i>
      <span class="hidden shrink-0 text-[8px] font-bold text-emerald-600 sm:inline">Liên hệ ẩn 100%</span>
      <span class="sr-only">Bảo mật 100% thông tin liên lạc</span>
    </div>`;
  }

  function isOwnProduct(product) {
    return Boolean(state.user && product && product.seller && product.seller.alias === aliasFor(state.user.id));
  }

  function acceptedOfferFor(productId) {
    return state.offers.sent.find((offer) => (
      Number(offer.product_id) === Number(productId)
      && offer.status === 'ACCEPTED'
      && offer.product
      && offer.product.status === 'AVAILABLE'
    )) || null;
  }

  function actionButtons(product, deal) {
    if (isOwnProduct(product)) {
      return `<button type="button" data-market-action="open-offers" class="${BTN.outline}">
        <i class="fa-solid fa-handshake-angle" aria-hidden="true"></i> Quản lý offer của tin này
      </button>`;
    }
    const offerButton = `<button type="button" data-market-action="offer" data-product-id="${product.id}" class="${BTN.outline}">
      <i class="fa-solid fa-tag" aria-hidden="true"></i> Trả giá (Deal giá)
    </button>`;
    if (deal) {
      return `<button type="button" data-market-action="buy" data-product-id="${product.id}" data-offer-id="${deal.id}" class="${BTN.gold}">
          <i class="fa-solid fa-bolt" aria-hidden="true"></i> Mua ngay với giá Deal
        </button>${offerButton}`;
    }
    return `${offerButton}
      <button type="button" data-market-action="buy" data-product-id="${product.id}" class="${BTN.primary}">
        <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Mua ngay
      </button>`;
  }

  function priceBlock(product, deal) {
    const listed = Number(product.price) || 0;
    const price = deal ? Number(deal.offer_price) || 0 : listed;
    const original = Number(product.original_price) || 0;
    const discount = original > listed && listed > 0 ? Math.round((1 - listed / original) * 100) : 0;
    return `
      <div class="min-w-0">
        <div class="flex flex-wrap items-baseline gap-2">
          <span class="text-lg font-extrabold tracking-tight ${deal ? 'text-amber-600' : 'text-sky-700'}">${vnd(price)}</span>
          ${deal ? `<span class="text-[10px] font-bold text-slate-400 line-through">${vnd(listed)}</span>` : ''}
          ${!deal && original > listed ? `<span class="text-[10px] font-semibold text-slate-400 line-through">${vnd(original)}</span>` : ''}
          ${!deal && discount > 0 ? `<span class=" bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-700">-${discount}%</span>` : ''}
        </div>
        ${deal ? '<p class="mt-1 inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-600"><i class="fa-solid fa-handshake" aria-hidden="true"></i> Giá Deal đã chốt</p>' : ''}
      </div>`;
  }

  function productCard(product) {
    const deal = acceptedOfferFor(product.id);
    const cat = categoryMeta(product.category);
    const img = product.image_url || FALLBACK_IMG;
    const own = isOwnProduct(product);
    return `
      <article class="group flex h-full min-w-0 flex-col overflow-hidden border border-sky-100 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-soft" data-product-card="${product.id}">
        <div class="relative aspect-[4/3] shrink-0 overflow-hidden bg-sky-50">
          <img src="${esc(img)}" alt="${esc(product.title)}" loading="lazy" data-fallback="${esc(FALLBACK_IMG)}"
               class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
          <span class="absolute left-3 top-3 inline-flex items-center gap-1 px-2 py-1 text-[9px] font-extrabold ring-1 backdrop-blur ${cat.cls}">
            <i class="fa-solid ${cat.icon}" aria-hidden="true"></i> ${esc(product.category)}
          </span>
          ${deal ? '<span class="absolute bottom-3 left-3 inline-flex items-center gap-1 bg-amber-300 px-2.5 py-1 text-[9px] font-extrabold text-amber-950 shadow-lg"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Deal đã chấp nhận</span>' : ''}
          ${own ? '<span class="absolute right-3 top-3 bg-slate-950/75 px-2.5 py-1 text-[9px] font-extrabold text-white backdrop-blur">Tin của bạn</span>' : ''}
        </div>
        <div class="flex flex-1 flex-col p-5">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class=" bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-100">${esc(product.condition_text)}</span>
            <span class="text-[10px] font-semibold text-slate-400">${esc(product.seller ? product.seller.alias : '')}</span>
          </div>
          <h3 class="mt-2 line-clamp-2 min-h-[2.5rem] text-[15px] font-extrabold leading-snug text-ink">${esc(product.title)}</h3>
          <div class="mt-2">${sellerBadge(product)}</div>
          <div class="mt-3 flex flex-wrap gap-1.5">${deliveryTags(product)}</div>
          <div class="mt-auto pt-4">
            ${priceBlock(product, deal)}
            <div class="mt-3 ${deal || own ? 'grid gap-2' : 'grid grid-cols-2 gap-2'}">${actionButtons(product, deal)}</div>
          </div>
        </div>
      </article>`;
  }

  function vipCard(product) {
    const deal = acceptedOfferFor(product.id);
    const cat = categoryMeta(product.category);
    const img = product.image_url || FALLBACK_IMG;
    const own = isOwnProduct(product);
    return `
      <article class="vip-card group grid min-w-0 overflow-hidden lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" data-product-card="${product.id}">
        <div class="relative min-h-[190px] overflow-hidden bg-sky-50 lg:min-h-full">
          <img src="${esc(img)}" alt="${esc(product.title)}" loading="lazy" data-fallback="${esc(FALLBACK_IMG)}"
               class="h-full w-full object-cover transition duration-500 group-hover:scale-105">
          <span class="absolute left-3 top-3 inline-flex items-center gap-1 bg-sky-600 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white shadow-lg">
            <i class="fa-solid fa-crown" aria-hidden="true"></i> VIP
          </span>
          <span class="absolute right-3 top-3 bg-amber-300 px-2.5 py-1 text-[9px] font-extrabold text-amber-950 shadow-lg">Quảng cáo</span>
        </div>
        <div class="flex min-w-0 flex-col p-5 sm:p-6">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="inline-flex items-center gap-1 px-2 py-1 text-[9px] font-extrabold ring-1 ${cat.cls}">
              <i class="fa-solid ${cat.icon}" aria-hidden="true"></i> ${esc(product.category)}
            </span>
            <span class=" bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500 ring-1 ring-slate-100">${esc(product.condition_text)}</span>
            ${own ? '<span class=" bg-slate-950/80 px-2 py-1 text-[9px] font-extrabold text-white">Tin của bạn</span>' : ''}
          </div>
          <h3 class="mt-3 line-clamp-2 text-lg font-extrabold leading-snug tracking-tight text-ink">${esc(product.title)}</h3>
          <p class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">${esc(product.description || 'Tin tài trợ nổi bật từ sinh viên đã xác thực.')}</p>
          <div class="mt-3">${sellerBadge(product)}</div>
          <div class="mt-3 flex flex-wrap gap-1.5">${deliveryTags(product)}</div>
          <div class="mt-auto pt-4">
            ${priceBlock(product, deal)}
            <div class="mt-3 flex flex-col gap-2 sm:flex-row">${actionButtons(product, deal)}</div>
          </div>
        </div>
      </article>`;
  }

  function getFilteredProducts(promoted) {
    const q = normalize(state.filters.q.trim());
    const category = state.filters.category;
    const delivery = state.filters.delivery;
    return state.products.filter((product) => {
      if (Boolean(product.is_promoted) !== Boolean(promoted)) return false;
      if (category && product.category !== category) return false;
      if (delivery && !(product.delivery_methods || []).some((method) => method.code === delivery)) return false;
      if (q) {
        const haystack = normalize(`${product.title} ${product.description || ''} ${product.category} ${product.seller_badge || ''}`);
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function hasActiveFilters() {
    return Boolean(state.filters.q.trim() || state.filters.category || state.filters.delivery);
  }

  function updateFilterUI() {
    $$('[data-filter-category]').forEach((button) => {
      button.classList.toggle('is-active', (button.dataset.filterCategory || '') === state.filters.category);
    });
    $$('[data-filter-delivery]').forEach((button) => {
      button.classList.toggle('is-active', (button.dataset.filterDelivery || '') === state.filters.delivery);
    });
    const input = $('#marketSearchInput');
    if (input && input.value !== state.filters.q) input.value = state.filters.q;
    const clear = $('#marketSearchClear');
    if (clear) {
      const show = Boolean(state.filters.q);
      clear.classList.toggle('hidden', !show);
      clear.classList.toggle('flex', show);
    }
    const reset = $('#marketResetFilters');
    if (reset) {
      const show = hasActiveFilters();
      reset.classList.toggle('hidden', !show);
      reset.classList.toggle('inline-flex', show);
    }
  }

  function updateResultCount(total, vipCount, normalCount) {
    const el = $('#marketResultCount');
    if (!el) return;
    if (state.productError && !state.products.length) {
      el.textContent = 'Không tải được dữ liệu từ API';
      return;
    }
    if (!state.productsLoaded) {
      el.textContent = 'Đang tải danh sách sản phẩm…';
      return;
    }
    if (!total) {
      el.textContent = 'Không có tin phù hợp';
    } else if (hasActiveFilters()) {
      el.textContent = `${total} tin phù hợp bộ lọc`;
    } else {
      el.textContent = `${normalCount} tin thường · ${vipCount} tin tài trợ`;
    }
  }

  function renderMarket(force = false) {
    const vipGrid = $('#marketVipGrid');
    const grid = $('#marketGrid');
    if (!vipGrid || !grid) return;
    const signature = JSON.stringify({
      userId: state.user ? state.user.id : null,
      products: state.products.map((product) => [product.id, product.price, product.is_promoted]),
      offers: state.offers.sent.map((offer) => [offer.id, offer.status, offer.offer_price]),
    });
    if (!force && signature === state.marketSig) {
      updateResultCount(
        getFilteredProducts(true).length + getFilteredProducts(false).length,
        getFilteredProducts(true).length,
        getFilteredProducts(false).length
      );
      return;
    }
    state.marketSig = signature;

    const skeleton = $('#marketSkeleton');
    const empty = $('#marketEmpty');
    const errorBox = $('#marketError');
    const vipSection = $('#marketVipSection');
    if (skeleton) skeleton.classList.add('hidden');
    if (errorBox) errorBox.classList.add('hidden');

    if (state.productError && !state.products.length) {
      if (grid) grid.classList.add('hidden');
      if (empty) empty.classList.add('hidden');
      if (vipSection) vipSection.classList.add('hidden');
      if (errorBox) {
        errorBox.classList.remove('hidden');
        const text = $('#marketErrorText');
        if (text) text.textContent = state.productError;
      }
      updateResultCount(0, 0, 0);
      return;
    }

    const vipProducts = getFilteredProducts(true);
    const normalProducts = getFilteredProducts(false);
    const total = vipProducts.length + normalProducts.length;

    if (vipSection) vipSection.classList.toggle('hidden', vipProducts.length === 0);
    vipGrid.innerHTML = vipProducts.slice(0, 4).map(vipCard).join('');

    if (empty) empty.classList.toggle('hidden', total > 0);
    if (!total) {
      if (grid) {
        grid.innerHTML = '';
        grid.classList.add('hidden');
      }
    } else if (normalProducts.length) {
      grid.innerHTML = normalProducts.map(productCard).join('');
      grid.classList.remove('hidden');
    } else {
      grid.innerHTML = '<div class="col-span-full border border-dashed border-amber-200 bg-amber-50 px-5 py-8 text-center text-xs font-semibold text-amber-800">Các tin phù hợp đang nằm trong khu vực Tin đăng tài trợ (VIP) phía trên.</div>';
      grid.classList.remove('hidden');
    }

    updateResultCount(total, vipProducts.length, normalProducts.length);
    updateFilterUI();
    const aria = $('#marketAriaStatus');
    if (aria) aria.textContent = total ? `Đã tải ${total} tin phù hợp.` : 'Không có tin phù hợp bộ lọc.';
  }

  function updateCounts() {
    const offersCount = $('#marketOffersCount');
    if (offersCount) {
      const pending = state.user ? state.offers.received.filter((offer) => offer.status === 'PENDING').length : 0;
      offersCount.textContent = String(pending);
      offersCount.classList.toggle('hidden', pending === 0);
      offersCount.classList.toggle('inline-flex', pending > 0);
    }
    const cartCount = $('#marketCartCount');
    if (cartCount) cartCount.textContent = state.cart ? '1' : '0';
  }

  function updateAuthUI() {
    const area = $('#marketAuthArea');
    if (!area) return;
    if (state.token && !state.authReady && !state.user) {
      area.innerHTML = '<span class="inline-flex h-11 items-center gap-2 border border-sky-100 bg-white px-4 text-xs font-bold text-slate-400"><i class="fa-solid fa-circle-notch fa-spin" aria-hidden="true"></i><span class="hidden sm:inline">Đang xác thực…</span></span>';
      return;
    }
    if (!state.user) {
      area.innerHTML = `<button type="button" data-market-action="login" class="inline-flex h-11 items-center justify-center gap-2 border border-sky-200 bg-white px-4 text-xs font-extrabold text-sky-700 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50">
        <i class="fa-solid fa-user" aria-hidden="true"></i><span>Đăng nhập</span>
      </button>`;
      return;
    }
    const verified = Boolean(state.user.is_student_verified);
    area.innerHTML = `<button type="button" data-market-action="open-account" class="group flex h-11 max-w-[15rem] items-center gap-2 border border-sky-200 bg-white py-1 pl-1 pr-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50" aria-label="Mở tài khoản ${esc(state.user.name)}">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-sky-600 text-xs font-extrabold text-white shadow-md shadow-sky-500/20">${userInitial(state.user)}</span>
      <span class="hidden min-w-0 sm:block">
        <span class="block truncate text-[11px] font-extrabold text-ink">${esc(state.user.name)}</span>
        <span class="block truncate text-[9px] font-bold ${verified ? 'text-emerald-600' : 'text-slate-400'}">${verified ? `Đã xác thực ${esc(state.user.university_name || '.edu.vn')}` : 'Tài khoản sinh viên'}</span>
      </span>
      <i class="fa-solid fa-chevron-down hidden text-[8px] text-slate-400 sm:block" aria-hidden="true"></i>
    </button>`;
  }

  function showLoadingState() {
    const skeleton = $('#marketSkeleton');
    if (skeleton) skeleton.classList.remove('hidden');
    const grid = $('#marketGrid');
    if (grid) grid.classList.add('hidden');
    const empty = $('#marketEmpty');
    if (empty) empty.classList.add('hidden');
    const error = $('#marketError');
    if (error) error.classList.add('hidden');
  }

  async function loadProducts({ silent = false } = {}) {
    if (state.loadingProducts) return;
    state.loadingProducts = true;
    if (!silent) showLoadingState();
    try {
      const data = await api('/api/products?limit=100', { auth: false });
      state.products = Array.isArray(data.products) ? data.products : [];
      state.productsLoaded = true;
      state.productError = null;
      reconcileCartAfterProducts();
      renderMarket(!silent);
    } catch (error) {
      state.productError = error.message;
      state.productsLoaded = true;
      if (!silent) {
        renderMarket(true);
        toast(error.message, 'error', 6000);
      }
    } finally {
      state.loadingProducts = false;
    }
  }

  async function loadVouchers() {
    try {
      const data = await api('/api/vouchers', { auth: false });
      state.vouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
    } catch {
      state.vouchers = VOUCHER_FALLBACK.slice();
    }
    if (state.cartOpen) renderCart(true);
  }

  function reconcileCartAfterProducts() {
    if (!state.cart) return;
    const fresh = state.products.find((product) => Number(product.id) === Number(state.cart.product.id));
    if (!fresh) {
      state.cart = null;
      updateCounts();
      if (state.cartOpen) closeCart();
      toast('Sản phẩm trong giỏ vừa được người khác mua. Giỏ escrow đã được làm mới.', 'error', 5200);
      return;
    }
    const oldPrice = Number(state.cart.product.price);
    state.cart.product = fresh;
    if (!state.cart.offer) state.cart.price = Number(fresh.price);
    if (state.cartOpen && oldPrice !== Number(fresh.price)) renderCart(true);
  }

  function clearSession() {
    state.sessionGeneration += 1;
    state.token = '';
    state.user = null;
    state.authReady = true;
    state.offers = { sent: [], received: [] };
    state.orders = { buying: [], selling: [], orders: [] };
    state.cart = null;
    state.afterAuth = null;
    storageRemove(TOKEN_KEY);
    updateAuthUI();
    updateCounts();
    renderMarket(true);
  }

  function handleSessionExpired() {
    if (!state.token) return;
    clearSession();
    if (state.cartOpen) closeCart();
    if (!state.sessionNoticeShown) {
      state.sessionNoticeShown = true;
      toast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error', 5200);
    }
  }

  function saveSession(token, user) {
    state.sessionGeneration += 1;
    state.token = token || '';
    state.user = user || null;
    state.authReady = true;
    state.sessionNoticeShown = false;
    if (state.token) storageSet(TOKEN_KEY, state.token);
    updateAuthUI();
    updateCounts();
  }

  function logout() {
    clearSession();
    state.sessionNoticeShown = true;
    closeModal();
    closeCart();
    updateAuthUI();
    updateCounts();
    toast('Đã đăng xuất khỏi Studeal.', 'success');
  }

  async function refreshSession({ silent = false } = {}) {
    if (!state.token) {
      state.authReady = true;
      updateAuthUI();
      updateCounts();
      return;
    }
    const version = state.sessionGeneration;
    const token = state.token;
    const results = await Promise.allSettled([
      api('/api/auth/me'),
      api('/api/offers/my'),
      api('/api/orders/my'),
    ]);
    const [me, offers, orders] = results;
    if (version !== state.sessionGeneration || token !== state.token) return;
    if (me.status === 'fulfilled' && me.value.user) state.user = me.value.user;
    if (offers.status === 'fulfilled') {
      state.offers = {
        sent: Array.isArray(offers.value.sent) ? offers.value.sent : [],
        received: Array.isArray(offers.value.received) ? offers.value.received : [],
      };
    }
    if (orders.status === 'fulfilled') {
      state.orders = {
        buying: Array.isArray(orders.value.buying) ? orders.value.buying : [],
        selling: Array.isArray(orders.value.selling) ? orders.value.selling : [],
        orders: Array.isArray(orders.value.orders) ? orders.value.orders : [],
      };
    }
    state.authReady = true;
    updateAuthUI();
    updateCounts();
    renderMarket(false);
    if (!silent && me.status === 'rejected' && me.reason && !me.reason.status) {
      toast(me.reason.message, 'error', 6000);
    }
  }

  function runAfterAuth(action) {
    if (!action) return;
    state.afterAuth = null;
    if (action.type === 'offer') openOfferModal(action.productId);
    else if (action.type === 'buy') addToCart(action.productId, action.offerId || null);
    else if (action.type === 'offers') openOffersModal('received');
    else if (action.type === 'sell') openSellModal();
    else if (action.type === 'verify-student') openStudentVerification();
    else if (action.type === 'checkout') {
      openCart();
      window.setTimeout(() => { if (state.cart) checkout(); }, 260);
    }
  }

  function openAuth(tab = 'login', afterAuth = null) {
    if (state.user) {
      openOffersModal('received');
      return;
    }
    if (afterAuth) state.afterAuth = afterAuth;
    state.authFlow = null;
    renderAuthModal(tab);
  }

  function authTabButton(tab, label) {
    const active = state.authTab === tab;
    return `<button type="button" data-market-action="auth-tab" data-auth-tab="${tab}"
      class="inline-flex h-10 flex-1 items-center justify-center gap-2 text-xs font-extrabold transition ${active ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-sky-700'}">${label}</button>`;
  }

  function renderAuthModal(tab = 'login') {
    state.authTab = tab;
    const isLogin = tab === 'login';
    const continueNote = state.afterAuth
      ? '<p class="mt-3 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100"><i class="fa-solid fa-circle-info mr-1" aria-hidden="true"></i>Đăng nhập để tiếp tục thao tác bạn vừa chọn.</p>'
      : '';
    const form = isLogin ? `
      <form data-market-form="login" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <div>
          <label for="marketLoginEmail" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Email tài khoản</label>
          <input id="marketLoginEmail" name="email" type="email" autocomplete="email" required
                 class="h-11 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="ban@studeal.vn">
        </div>
        <div>
          <label for="marketLoginPassword" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Mật khẩu</label>
          <input id="marketLoginPassword" name="password" type="password" autocomplete="current-password" required
                 class="h-11 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="Ít nhất 6 ký tự">
        </div>
        <button type="submit" class="${BTN.primary} h-11">
          <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i> Đăng nhập &amp; nhận OTP
        </button>
      </form>
      <div class="mt-4 border border-sky-100 bg-sky-50/70 p-3.5">
        <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-700">Tài khoản demo</p>
        <p class="mt-1 text-[10px] leading-relaxed text-slate-500">Mật khẩu <strong class="text-slate-700">123456</strong>. OTP demo hiện ngay ở bước sau.</p>
        <div class="mt-2.5 grid grid-cols-2 gap-2">
          <button type="button" data-market-action="quick-login" data-email="buyer@studeal.vn" class="inline-flex h-9 items-center justify-center gap-1.5 bg-white px-2 text-[10px] font-extrabold text-sky-700 ring-1 ring-sky-100 transition hover:bg-sky-100">
            <i class="fa-solid fa-bag-shopping" aria-hidden="true"></i> Người mua
          </button>
          <button type="button" data-market-action="quick-login" data-email="seller.khtn@studeal.vn" class="inline-flex h-9 items-center justify-center gap-1.5 bg-white px-2 text-[10px] font-extrabold text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-50">
            <i class="fa-solid fa-store" aria-hidden="true"></i> Người bán
          </button>
        </div>
      </div>` : `
      <form data-market-form="register" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <div>
          <label for="marketRegisterName" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Họ và tên</label>
          <input id="marketRegisterName" name="name" type="text" autocomplete="name" required maxlength="80"
                 class="h-11 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="Nguyễn Minh Anh">
        </div>
        <div>
          <label for="marketRegisterEmail" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Email</label>
          <input id="marketRegisterEmail" name="email" type="email" autocomplete="email" required
                 class="h-11 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="ban@studeal.vn">
        </div>
        <div>
          <label for="marketRegisterPassword" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Mật khẩu</label>
          <input id="marketRegisterPassword" name="password" type="password" autocomplete="new-password" required minlength="6"
                 class="h-11 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="Ít nhất 6 ký tự">
        </div>
        <button type="submit" class="${BTN.primary} h-11">
          <i class="fa-solid fa-user-plus" aria-hidden="true"></i> Tạo tài khoản &amp; nhận OTP
        </button>
      </form>`;

    openModal(`
      <div class="pr-8">
        <span class="inline-flex items-center gap-2 bg-sky-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-700 ring-1 ring-sky-100">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Tài khoản Studeal
        </span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">${isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản sinh viên'}</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">${isLogin ? 'Đăng nhập bằng email và mật khẩu, sau đó xác thực OTP 6 số.' : 'Đăng ký bằng email cá nhân. Bạn có thể xác thực email trường sau để nhận huy hiệu.'}</p>
        ${continueNote}
      </div>
      <div class="mt-5 flex bg-slate-100 p-1">
        ${authTabButton('login', 'Đăng nhập')}
        ${authTabButton('register', 'Đăng ký')}
      </div>
      ${form}
      <p class="mt-4 text-center text-[10px] leading-relaxed text-slate-400">Không chia sẻ số điện thoại, Zalo hay email cá nhân trong nội dung trả giá.</p>
    `, { label: isLogin ? 'Đăng nhập Studeal' : 'Đăng ký Studeal' });
  }

  async function startLogin(email, password, button) {
    setButtonLoading(button, true, 'Đang kiểm tra…');
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: String(email || '').trim(), password: String(password || '') },
      });
      state.authFlow = {
        purpose: data.purpose || 'LOGIN',
        email: data.email || data.account_email || email,
        accountEmail: data.account_email || data.email || email,
        message: data.message,
        debugOtp: data.debug_otp || '',
        emailSent: Boolean(data.email_sent),
      };
      renderOtpModal();
    } catch (error) {
      const form = $('#marketModalContent form[data-market-form="login"]');
      if (form) showFormError(form, error.message);
      else toast(error.message, 'error', 5200);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function renderOtpModal() {
    const flow = state.authFlow;
    if (!flow) {
      renderAuthModal('login');
      return;
    }
    const debugBox = flow.debugOtp ? `
      <div class="absolute right-14 top-3 border border-dashed border-amber-300 bg-amber-50 px-3 py-2 shadow-lg sm:right-16 sm:top-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-[8px] font-extrabold uppercase tracking-[0.12em] text-amber-700">OTP gợi ý · demo</p>
            <p class="mt-0.5 text-base font-extrabold tracking-[0.25em] text-amber-900">${esc(flow.debugOtp)}</p>
          </div>
          <button type="button" data-market-action="fill-otp" class="inline-flex h-8 items-center gap-1 bg-white px-3 text-[10px] font-extrabold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-100">
            <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Điền mã
          </button>
        </div>
      </div>` : '';

    openModal(`
      <div class="relative pr-8">
        <span class="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 ring-1 ring-emerald-100">
          <i class="fa-solid fa-envelope-circle-check" aria-hidden="true"></i> Xác thực OTP
        </span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">Nhập mã 6 chữ số</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">${esc(flow.message || 'Mã OTP đã được gửi tới email tài khoản.')}</p>
        <p class="mt-2 inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
          <i class="fa-solid fa-at text-slate-400" aria-hidden="true"></i> ${esc(flow.accountEmail || '')}
        </p>
        ${debugBox}
      </div>
      <form data-market-form="otp" data-email="${esc(flow.accountEmail || '')}" data-purpose="${esc(flow.purpose || 'LOGIN')}" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <div>
          <label for="marketOtp" class="mb-1.5 block text-[11px] font-extrabold text-slate-700">Mã OTP</label>
          <input id="marketOtp" name="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required
                 class="h-14 w-full border border-slate-200 bg-slate-50 px-3 text-center text-xl font-extrabold tracking-[0.4em] text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"
                 placeholder="••••••">
        </div>
        <button type="submit" class="${BTN.primary} h-11">
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Xác thực &amp; đăng nhập
        </button>
        <div class="flex items-center justify-between gap-2">
          <button type="button" data-market-action="resend-otp" class="text-[10px] font-bold text-sky-700 hover:text-sky-800">Gửi lại OTP</button>
          <button type="button" data-market-action="auth-back" class="text-[10px] font-bold text-slate-500 hover:text-slate-700">Quay lại</button>
        </div>
      </form>
    `, { label: 'Xác thực OTP' });
  }

  async function resendOtp(button) {
    const email = state.authFlow && state.authFlow.accountEmail;
    if (!email) {
      toast('Không tìm thấy email tài khoản để gửi lại OTP.', 'error');
      return;
    }
    setButtonLoading(button, true, 'Đang gửi…');
    try {
      const data = await api('/api/auth/resend-otp', { method: 'POST', auth: false, body: { email: state.authFlow.accountEmail } });
      state.authFlow = {
        ...state.authFlow,
        email: data.email || state.authFlow.email,
        message: data.message,
        debugOtp: data.debug_otp || '',
        emailSent: Boolean(data.email_sent),
        purpose: data.purpose || state.authFlow.purpose,
      };
      renderOtpModal();
      toast(data.message || 'Đã gửi lại OTP.', 'success');
    } catch (error) {
      toast(error.message, 'error', 5200);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function submitOtp(form, button) {
    const otp = digits(form.elements.otp.value);
    form.elements.otp.value = otp;
    if (!/^\d{6}$/.test(otp)) {
      showFormError(form, 'Mã OTP phải gồm đúng 6 chữ số.');
      return;
    }
    resetFormError(form);
    setButtonLoading(button, true, 'Đang xác thực…');
    try {
      const data = await api('/api/auth/verify-otp', {
        method: 'POST',
        auth: false,
        body: {
          email: state.authFlow && state.authFlow.email ? state.authFlow.email : form.dataset.email,
          otp,
          purpose: form.dataset.purpose || 'LOGIN',
        },
      });
      const wasStudentVerification = (form.dataset.purpose || '') === 'STUDENT';
      saveSession(data.token, data.user);
      state.authFlow = null;
      const after = state.afterAuth;
      state.afterAuth = null;
      closeModal();
      await refreshSession({ silent: true });
      toast(data.message || 'Đăng nhập thành công.', 'success');
      if (wasStudentVerification) {
        toast(`Huy hiệu sinh viên đã được cấp: ${data.user && data.user.university_name ? data.user.university_name : 'đã xác thực .edu.vn'}.`, 'success', 5200);
        if (after && after.type === 'sell') window.setTimeout(openSellModal, 240);
        else window.setTimeout(() => openOffersModal('received'), 240);
      } else if (after) window.setTimeout(() => runAfterAuth(after), 240);
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function openStudentVerification() {
    if (!state.user) {
      openAuth('login', { type: 'verify-student' });
      return;
    }
    if (!state.afterAuth) state.afterAuth = { type: 'verify-student' };
    const local = String(state.user.email || 'sinhvien').split('@')[0].replace(/[^a-z0-9._-]/gi, '') || 'sinhvien';
    openModal(`
      <div class="pr-8">
        <span class="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-100"><i class="fa-solid fa-graduation-cap"></i>Xác thực sinh viên</span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">Xác thực email trường</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">Nhập email .edu.vn để nhận OTP và cấp huy hiệu trường. Email trường không hiển thị cho người mua; xác thực mở khóa chức năng đăng bán.</p>
      </div>
      ${state.user.is_student_verified ? `<div class="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-800"><i class="fa-solid fa-circle-check mr-1"></i>Đã xác thực ${esc(state.user.university_name || '.edu.vn')} · ${esc(state.user.student_email || '')}</div>` : ''}
      <form data-market-form="student" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <label for="marketStudentEmail" class="block text-[11px] font-extrabold text-slate-700">Email sinh viên .edu.vn</label>
        <input id="marketStudentEmail" name="student_email" type="email" autocomplete="email" required value="${esc(`${local}@student.hcmus.edu.vn`)}" placeholder="tenban@student.hcmus.edu.vn" class="h-12 w-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-ink outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100">
        <div class=" bg-sky-50 p-3 text-[10px] leading-relaxed text-sky-800 ring-1 ring-sky-100"><strong>Hỗ trợ:</strong> @student.hcmus.edu.vn, @gm.uit.edu.vn, @hcmut.edu.vn, @st.ueh.edu.vn và các email trường .edu.vn khác.</div>
        <button type="submit" class="${BTN.primary} h-11"><i class="fa-solid fa-paper-plane"></i>Gửi OTP xác thực</button>
      </form>
    `, { label: 'Xác thực email sinh viên' });
  }

  async function submitStudentVerification(form, button) {
    const studentEmail = String(form.elements.student_email.value || '').trim();
    if (!studentEmail || !studentEmail.includes('@')) return showFormError(form, 'Vui lòng nhập email trường hợp lệ.');
    setButtonLoading(button, true, 'Đang gửi OTP…');
    try {
      const data = await api('/api/auth/verify-student', {
        method: 'POST', body: { student_email: studentEmail },
      });
      state.authFlow = {
        purpose: data.purpose || 'STUDENT',
        email: data.email || data.student_email || studentEmail,
        accountEmail: data.account_email || (state.user && state.user.email) || '',
        message: data.message,
        debugOtp: data.debug_otp || '',
        emailSent: Boolean(data.email_sent),
      };
      if (!state.afterAuth) state.afterAuth = { type: 'verify-student' };
      renderOtpModal();
      toast(data.email_sent ? 'Đã gửi OTP tới email sinh viên.' : 'OTP demo đã sẵn sàng; email thật được gửi nếu SMTP đã cấu hình.', 'success');
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function openSellModal() {
    if (!state.user) {
      openAuth('login', { type: 'sell' });
      return;
    }
    if (!state.user.is_student_verified) {
      state.afterAuth = { type: 'sell' };
      openModal(`
        <div class="pr-8"><span class="inline-flex items-center gap-2 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-800"><i class="fa-solid fa-lock"></i>Cần xác thực</span>
        <h2 class="mt-3 text-2xl font-extrabold text-ink">Mở khóa Đăng bán</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">Xác thực email sinh viên .edu.vn để đăng tin và nhận huy hiệu trường.</p></div>
        <div class="mt-5 grid gap-2"><button type="button" data-market-action="verify-student" class="${BTN.primary} h-11"><i class="fa-solid fa-graduation-cap"></i>Xác thực email sinh viên</button><button type="button" data-market-action="sell-demo-link" class="inline-flex h-10 items-center justify-center bg-slate-100 text-xs font-bold text-slate-600">Quay lại</button></div>
      `, { label: 'Xác thực để đăng bán' });
      return;
    }
    const categories = ['Giáo trình', 'Điện tử', 'Đồ trọ', 'Dụng cụ học tập'];
    const conditions = ['Mới 99%', 'Khá 90%', 'Cũ dùng tốt'];
    openModal(`
      <div class="pr-8"><span class="inline-flex items-center gap-2 bg-sky-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-sky-700"><i class="fa-solid fa-store"></i>Đăng bán miễn phí</span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">Đăng món đồ lên chợ</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">Thông tin liên lạc được ẩn. Chỉ sinh viên đã xác thực mới đăng bán được.</p></div>
      <form data-market-form="sell" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <div><label for="marketSellTitle" class="mb-1 block text-[10px] font-extrabold text-slate-700">Tên món đồ</label><input id="marketSellTitle" name="title" required minlength="5" maxlength="160" placeholder="Ví dụ: Giáo trình Giải tích 1" class="h-10 w-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-ink outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"></div>
        <div class="grid grid-cols-2 gap-2">
          <div><label for="marketSellCategory" class="mb-1 block text-[10px] font-extrabold text-slate-700">Danh mục</label><select id="marketSellCategory" name="category" class="h-10 w-full border border-slate-200 bg-white px-2 text-xs font-semibold text-ink">${categories.map((item) => `<option>${esc(item)}</option>`).join('')}</select></div>
          <div><label for="marketSellCondition" class="mb-1 block text-[10px] font-extrabold text-slate-700">Tình trạng</label><select id="marketSellCondition" name="condition_text" class="h-10 w-full border border-slate-200 bg-white px-2 text-xs font-semibold text-ink">${conditions.map((item) => `<option>${esc(item)}</option>`).join('')}</select></div>
        </div>
        <div class="grid grid-cols-2 gap-2"><div><label for="marketSellPrice" class="mb-1 block text-[10px] font-extrabold text-slate-700">Giá bán (đ)</label><input id="marketSellPrice" name="price" type="number" min="1000" step="1000" required placeholder="75000" class="h-10 w-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-ink outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"></div><div><label for="marketSellOriginal" class="mb-1 block text-[10px] font-extrabold text-slate-700">Giá gốc (đ)</label><input id="marketSellOriginal" name="original_price" type="number" min="1000" step="1000" placeholder="150000" class="h-10 w-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-ink outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"></div></div>
        <div><label for="marketSellDescription" class="mb-1 block text-[10px] font-extrabold text-slate-700">Mô tả</label><textarea id="marketSellDescription" name="description" maxlength="3000" rows="3" placeholder="Mô tả tình trạng, phụ kiện, lý do bán…" class="w-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-ink outline-none focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100"></textarea><p id="marketPhoneWarning" class="mt-1 hidden bg-rose-50 px-2.5 py-2 text-[10px] font-bold text-rose-700"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Phát hiện số điện thoại. Không đăng thông tin liên lạc để giữ ẩn danh.</p></div>
        <div class="grid gap-2 sm:grid-cols-2"><div><label for="marketSellImageUrl" class="mb-1 block text-[10px] font-extrabold text-slate-700">Link ảnh (tùy chọn)</label><input id="marketSellImageUrl" name="image_url" type="url" placeholder="https://…" class="h-10 w-full border border-slate-200 bg-slate-50 px-3 text-xs text-ink outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"></div><div><label for="marketSellImageFile" class="mb-1 block text-[10px] font-extrabold text-slate-700">Hoặc tải ảnh lên</label><input id="marketSellImageFile" name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" class="block w-full text-[10px] text-slate-500 file:mr-2 file:border-0 file:bg-sky-50 file:px-2 file:py-2 file:text-[10px] file:font-bold file:text-sky-700"><p class="mt-1 text-[9px] text-slate-400">JPG/PNG/WEBP/GIF · tối đa 5MB</p></div></div>
        <div class=" border border-slate-200 bg-slate-50 p-3">
          <p class="mb-2 text-[10px] font-extrabold text-slate-700">Phương thức giao dịch chấp nhận</p>
          <div class="space-y-2 text-[10px] font-semibold text-slate-600">
            <label class="flex items-center gap-2"><input type="checkbox" name="allow_meetup" checked class=" border-slate-300 text-sky-600 focus:ring-sky-500">Gặp mặt tại trường / phường</label>
            <label class="flex items-center gap-2"><input type="checkbox" name="allow_ship_3rd" class=" border-slate-300 text-sky-600 focus:ring-sky-500">Ship bên thứ 3 (Grab/AhaMove)</label>
            <label class="flex items-center gap-2"><input type="checkbox" name="allow_khtn_routine" class=" border-slate-300 text-emerald-600 focus:ring-emerald-500">Tuyến cố định KHTN CS1-CS2 miễn phí</label>
          </div>
          <div class="mt-2"><label for="marketMeetupLocation" class="mb-1 block text-[9px] font-bold text-slate-500">Tên trường / phường / điểm hẹn</label><input id="marketMeetupLocation" name="meetup_location" maxlength="200" value="${esc(state.user.university_name || '')}" placeholder="ĐH KHTN CS1 hoặc Phường Đông Hòa" class="h-9 w-full border border-slate-200 bg-white px-3 text-[10px] font-semibold text-ink outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"></div>
        </div>
        <label class="flex cursor-pointer items-start gap-2 border border-sky-200 bg-sky-50 p-3"><input type="checkbox" name="is_promoted" class="mt-0.5 border-sky-300 text-sky-600 focus:ring-sky-500"><span><strong class="block text-[10px] font-extrabold text-sky-900">Mua gói Quảng cáo Đẩy tin Đầu trang (+15.000đ)</strong><span class="mt-0.5 block text-[9px] text-sky-700">Gắn nhãn Quảng cáo và ưu tiên hiển thị VIP. Phí demo ghi nhận theo gói đăng.</span></span></label>
        <button type="submit" class="${BTN.primary} h-11"><i class="fa-solid fa-cloud-arrow-up"></i>Đăng bán ngay</button>
      </form>
    `, { wide: true, label: 'Đăng bán sản phẩm' });
  }

  async function submitSell(form, button) {
    const formData = new FormData(form);
    for (const name of ['allow_meetup', 'allow_ship_3rd', 'allow_khtn_routine', 'is_promoted']) {
      formData.set(name, form.elements[name].checked ? '1' : '0');
    }
    const file = form.elements.image.files && form.elements.image.files[0];
    if (!file) formData.delete('image');
    if (file && file.size > 5 * 1024 * 1024) return showFormError(form, 'Ảnh tải lên vượt quá giới hạn 5MB.');
    if (!form.elements.allow_meetup.checked && !form.elements.allow_ship_3rd.checked && !form.elements.allow_khtn_routine.checked) {
      return showFormError(form, 'Chọn ít nhất một phương thức giao dịch.');
    }
    const price = Number(form.elements.price.value);
    const original = Number(form.elements.original_price.value || price);
    if (original < price) return showFormError(form, 'Giá gốc không được thấp hơn giá bán.');
    setButtonLoading(button, true, 'Đang đăng tin…');
    try {
      const data = await api('/api/products', { method: 'POST', form: formData });
      closeModal();
      toast(data.message || 'Đăng bán thành công.', 'success');
      await loadProducts();
      window.setTimeout(() => $('#san-pham')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function accountLoading() {
    return `<div class="flex flex-col items-center justify-center py-14 text-center">
      <i class="fa-solid fa-circle-notch fa-spin text-2xl text-sky-500" aria-hidden="true"></i>
      <p class="mt-3 text-sm font-bold text-slate-500">Đang tải tài khoản và giao dịch…</p>
    </div>`;
  }

  async function openOffersModal(tab = 'received') {
    if (!state.user) {
      openAuth('login', { type: 'offers' });
      return;
    }
    state.offersTab = tab;
    openModal(accountLoading(), { wide: true, label: 'Quản lý trả giá' });
    const token = state.modalSeq;
    await refreshSession({ silent: true });
    if (!state.user) {
      openAuth('login', { type: 'offers' });
      return;
    }
    if (token !== state.modalSeq) return;
    renderAccountModal();
  }

  function accountTabButton(tab, label, count, icon) {
    const active = state.offersTab === tab;
    return `<button type="button" data-market-action="offers-tab" data-tab="${tab}"
      class="inline-flex shrink-0 items-center gap-2 px-3.5 py-2.5 text-[11px] font-extrabold transition ${active ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/20' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-sky-50 hover:text-sky-700'}">
      <i class="fa-solid ${icon}" aria-hidden="true"></i> ${label}
      <span class="inline-flex h-4 min-w-4 items-center justify-center px-1 text-[9px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}">${count}</span>
    </button>`;
  }

  function offerCard(offer, role) {
    const pending = offer.status === 'PENDING';
    const accepted = offer.status === 'ACCEPTED';
    const available = offer.product && offer.product.status === 'AVAILABLE';
    const received = role === 'received';
    const other = received ? offer.buyer : offer.seller;
    const otherLabel = received ? 'Người mua' : 'Người bán';
    const image = (offer.product && offer.product.image_url) || FALLBACK_IMG;
    const listed = Number(offer.product && offer.product.price) || 0;
    const offered = Number(offer.offer_price) || 0;
    const actions = pending && received ? `
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-market-action="respond-offer" data-offer-id="${offer.id}" data-status="ACCEPT" class="${BTN.success}">
          <i class="fa-solid fa-check" aria-hidden="true"></i> Chấp nhận (Accept)
        </button>
        <button type="button" data-market-action="respond-offer" data-offer-id="${offer.id}" data-status="REJECT" class="${BTN.danger}">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i> Từ chối (Reject)
        </button>
      </div>` : '';
    const buyDeal = !received && accepted && available ? `
      <button type="button" data-market-action="buy" data-product-id="${offer.product_id}" data-offer-id="${offer.id}" class="${BTN.gold} mt-3">
        <i class="fa-solid fa-bolt" aria-hidden="true"></i> Mua ngay với giá Deal
      </button>` : '';
    return `
      <article class=" border border-slate-200 bg-white p-3.5 shadow-sm">
        <div class="flex items-start gap-3">
          <img src="${esc(image)}" alt="" data-fallback="${esc(FALLBACK_IMG)}" class="h-16 w-16 shrink-0 object-cover ring-1 ring-slate-100">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="line-clamp-2 text-[12px] font-extrabold leading-snug text-ink">${esc(offer.product ? offer.product.title : 'Sản phẩm')}</p>
              ${statusPill(offer.status)}
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
              <span>${otherLabel}: <strong class="text-slate-700">${esc(other ? other.alias : 'Sinh viên ẩn danh')}</strong></span>
              ${other && other.university ? `<span class=" bg-sky-50 px-1.5 py-0.5 font-bold text-sky-700">${esc(other.university)}</span>` : ''}
              <span>· ${fmtDate(offer.created_at)}</span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class=" bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">Niêm yết <strong class="text-slate-700">${vnd(listed)}</strong></span>
              <span class=" bg-amber-50 px-2 py-1 text-[10px] font-extrabold text-amber-800 ring-1 ring-amber-100">Offer <strong>${vnd(offered)}</strong></span>
            </div>
            ${actions}
            ${buyDeal}
            ${!received && accepted && !available ? '<p class="mt-2 text-[10px] font-semibold text-slate-400"><i class="fa-solid fa-circle-info mr-1"></i>Sản phẩm đã được bán hoặc không còn khả dụng.</p>' : ''}
            ${!pending && received && accepted ? '<p class="mt-2 text-[10px] font-semibold text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>Đã chấp nhận. Người mua có thể thanh toán escrow.</p>' : ''}
          </div>
        </div>
      </article>`;
  }

  function orderCard(order) {
    const isBuyer = order.viewer_role === 'BUYER';
    const amount = isBuyer ? order.buyer_paid_amount : order.seller_receive_amount;
    const image = (order.product && order.product.image_url) || FALLBACK_IMG;
    const canConfirm = isBuyer && (order.can_confirm_received || order.escrow_status === 'HOLDING');
    const actions = order.escrow_status === 'HOLDING' ? `
      <div class="mt-3 flex flex-wrap gap-2">
        ${isBuyer ? `<button type="button" data-market-action="view-order-qr" data-order-id="${order.id}" class="${BTN.soft}">
          <i class="fa-solid fa-qrcode" aria-hidden="true"></i> Xem QR
        </button>` : ''}
        ${canConfirm ? `<button type="button" data-market-action="confirm-received" data-order-id="${order.id}" class="${BTN.success}">
          <i class="fa-solid fa-box-open" aria-hidden="true"></i> Đã nhận hàng
        </button>` : ''}
      </div>` : '';
    return `
      <article class=" border border-slate-200 bg-white p-3.5 shadow-sm">
        <div class="flex items-start gap-3">
          <img src="${esc(image)}" alt="" data-fallback="${esc(FALLBACK_IMG)}" class="h-16 w-16 shrink-0 object-cover ring-1 ring-slate-100">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <p class="line-clamp-2 text-[12px] font-extrabold leading-snug text-ink">${esc(order.product ? order.product.title : 'Đơn hàng')}</p>
              ${statusPill(order.escrow_status)}
            </div>
            <p class="mt-1 text-[10px] font-semibold text-slate-500">${isBuyer ? 'Bạn mua' : 'Bạn bán'} · Mã đơn <strong class="text-slate-700">#${order.id}</strong> · ${esc(order.delivery_method_label)}</p>
            ${order.delivery_detail ? `<p class="mt-1 line-clamp-1 text-[10px] text-slate-400">${esc(order.delivery_detail)}</p>` : ''}
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-3 py-2">
              <span class="text-[10px] font-semibold text-slate-500">${isBuyer ? 'Bạn đã thanh toán' : 'Bạn nhận được (98%)'}</span>
              <strong class="text-sm font-extrabold ${isBuyer ? 'text-sky-700' : 'text-emerald-700'}">${vnd(amount)}</strong>
            </div>
            ${order.voucher_code ? `<p class="mt-1 text-[9px] font-bold text-emerald-600">Voucher ${esc(order.voucher_code)} · giảm ${vnd(order.discount_amount)}</p>` : ''}
            ${actions}
            ${order.escrow_status === 'COMPLETED' ? `<div class="mt-2 border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] leading-relaxed text-emerald-800"><p class="font-extrabold"><i class="fa-solid fa-circle-check mr-1"></i>Giao dịch hoàn tất</p><p class="mt-0.5">${isBuyer ? 'Đã cộng' : 'Được cộng'} ${vnd(order.seller_receive_amount)} (98%) vào Ví người bán · Phí sàn 2%: ${vnd(order.platform_fee_2_percent)}.</p></div>` : ''}
          </div>
        </div>
      </article>`;
  }

  function emptyAccountPanel(icon, title, text) {
    return `<div class=" border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center">
      <i class="fa-solid ${icon} text-2xl text-slate-300" aria-hidden="true"></i>
      <p class="mt-3 text-sm font-extrabold text-slate-700">${title}</p>
      <p class="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-slate-400">${text}</p>
    </div>`;
  }

  function renderAccountModal() {
    if (!state.user) {
      openAuth('login', { type: 'offers' });
      return;
    }
    const user = state.user;
    const verified = Boolean(user.is_student_verified);
    const pendingReceived = state.offers.received.filter((offer) => offer.status === 'PENDING').length;
    const acceptedSent = state.offers.sent.filter((offer) => offer.status === 'ACCEPTED').length;
    const orderCount = state.orders.orders.length;
    let content = '';
    if (state.offersTab === 'received') {
      content = state.offers.received.length
        ? `<div class="space-y-2.5">${state.offers.received.map((offer) => offerCard(offer, 'received')).join('')}</div>`
        : emptyAccountPanel('fa-handshake', 'Chưa có ai trả giá', 'Khi người mua gửi mức giá cho tin của bạn, offer sẽ xuất hiện tại đây để bạn Chấp nhận hoặc Từ chối.');
    } else if (state.offersTab === 'sent') {
      content = state.offers.sent.length
        ? `<div class="space-y-2.5">${state.offers.sent.map((offer) => offerCard(offer, 'sent')).join('')}</div>`
        : emptyAccountPanel('fa-tag', 'Bạn chưa gửi offer nào', 'Mở một sản phẩm và bấm “Trả giá (Deal giá)” để gửi mức giá bằng con số. Không cần chat, không lộ thông tin liên lạc.');
    } else {
      const buying = state.orders.buying;
      const selling = state.orders.selling;
      content = orderCount
        ? `<div class="space-y-5">
            <div>
              <h4 class="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Đơn mua (${buying.length})</h4>
              <div class="space-y-2.5">${buying.length ? buying.map(orderCard).join('') : '<p class=" bg-slate-50 px-3 py-4 text-[11px] text-slate-400">Bạn chưa có đơn mua nào.</p>'}</div>
            </div>
            <div>
              <h4 class="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Đơn bán (${selling.length})</h4>
              <div class="space-y-2.5">${selling.length ? selling.map(orderCard).join('') : '<p class=" bg-slate-50 px-3 py-4 text-[11px] text-slate-400">Bạn chưa có đơn bán nào.</p>'}</div>
            </div>
          </div>`
        : emptyAccountPanel('fa-receipt', 'Chưa có đơn escrow', 'Sau khi thanh toán, đơn hàng sẽ xuất hiện tại đây. Bạn xác nhận đã nhận hàng để Studeal giải ngân 98% cho người bán.');
    }

    openModal(`
      <div class="pr-8">
        <div class="flex items-start gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-sky-600 text-base font-extrabold text-white shadow-lg shadow-sky-500/20">${userInitial(user)}</span>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-sky-600">${state.offersTab === 'orders' ? 'Escrow Holding · ví người bán' : 'Quản lý trả giá &amp; đơn hàng'}</p>
            <h2 class="mt-0.5 truncate text-xl font-extrabold tracking-tight text-ink">${esc(user.name)}</h2>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <span class="truncate text-[10px] font-semibold text-slate-400">${esc(user.email)}</span>
              <span class=" px-2 py-0.5 text-[9px] font-extrabold ${verified ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-slate-100 text-slate-500'}">${verified ? `Đã xác thực ${esc(user.university_name || '.edu.vn')}` : 'Chưa xác thực .edu.vn'}</span>
            </div>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-2">
          <div class=" bg-sky-50 px-3 py-2.5 ring-1 ring-sky-100"><p class="text-[9px] font-bold text-sky-600">Ví người bán</p><p class="mt-0.5 truncate text-xs font-extrabold text-sky-800">${vnd(user.wallet_balance)}</p></div>
          <div class=" bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100"><p class="text-[9px] font-bold text-amber-600">Offer chờ</p><p class="mt-0.5 text-xs font-extrabold text-amber-800">${pendingReceived}</p></div>
          <div class=" bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100"><p class="text-[9px] font-bold text-emerald-600">Deal đã nhận</p><p class="mt-0.5 text-xs font-extrabold text-emerald-800">${acceptedSent}</p></div>
        </div>
      </div>
      <div class="no-scrollbar mt-4 flex gap-1.5 overflow-x-auto pb-1">
        ${accountTabButton('received', 'Nhận được', state.offers.received.length, 'fa-inbox')}
        ${accountTabButton('sent', 'Đã gửi', state.offers.sent.length, 'fa-paper-plane')}
        ${accountTabButton('orders', 'Đơn hàng & Ví Trung Gian', orderCount, 'fa-wallet')}
      </div>
      <div class="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" data-market-action="verify-student" class="inline-flex h-9 items-center justify-center gap-2 border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-extrabold text-emerald-800 transition hover:bg-emerald-100"><i class="fa-solid fa-graduation-cap"></i>${verified ? 'Quản lý huy hiệu sinh viên' : 'Xác thực email .edu.vn'}</button>
        <button type="button" data-market-action="open-sell" class="inline-flex h-9 items-center justify-center gap-2 bg-sky-600 px-3 text-[10px] font-extrabold text-white transition hover:bg-sky-700"><i class="fa-solid fa-plus"></i>Đăng bán sản phẩm</button>
      </div>
      <div class="mt-4">${content}</div>
      <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p class="text-[10px] leading-relaxed text-slate-400"><i class="fa-solid fa-user-secret mr-1 text-sky-400"></i>Thông tin liên lạc được ẩn hoàn toàn.</p>
        <button type="button" data-market-action="logout" class="inline-flex h-8 items-center gap-1.5 bg-slate-100 px-3 text-[10px] font-extrabold text-slate-600 transition hover:bg-rose-50 hover:text-rose-700">
          <i class="fa-solid fa-arrow-right-from-bracket" aria-hidden="true"></i> Đăng xuất
        </button>
      </div>
    `, { wide: true, label: 'Quản lý trả giá và đơn hàng' });
  }

  async function respondOffer(offerId, status, button) {
    setButtonLoading(button, true, status === 'ACCEPT' ? 'Đang chấp nhận…' : 'Đang từ chối…');
    try {
      const data = await api(`/api/offers/${offerId}/respond`, { method: 'POST', body: { status } });
      toast(data.message || (status === 'ACCEPT' ? 'Đã chấp nhận offer.' : 'Đã từ chối offer.'), 'success');
      await refreshSession({ silent: true });
      if (state.user) renderAccountModal();
      renderMarket(true);
    } catch (error) {
      toast(error.message, 'error', 5200);
      if (error.status === 409) {
        await refreshSession({ silent: true });
        if (state.user) renderAccountModal();
      }
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function confirmReceived(orderId, button) {
    if (!window.confirm('Xác nhận bạn đã nhận hàng đúng mô tả? Studeal sẽ giải ngân 98% cho người bán.')) return;
    setButtonLoading(button, true, 'Đang xác nhận…');
    try {
      const data = await api(`/api/orders/${orderId}/confirm-received`, { method: 'POST', body: {} });
      toast(data.message || 'Đã xác nhận nhận hàng. Người bán được giải ngân 98%.', 'success');
      await refreshSession({ silent: true });
      if (state.user) renderAccountModal();
    } catch (error) {
      toast(error.message, 'error', 5200);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function openOrderQr(orderId) {
    const local = state.orders.orders.find((order) => Number(order.id) === Number(orderId));
    if (local) {
      openQrModal(local);
      return;
    }
    try {
      const data = await api(`/api/orders/${orderId}`);
      if (data.order) openQrModal(data.order);
    } catch (error) {
      toast(error.message, 'error', 5200);
    }
  }

  function productById(productId) {
    return state.products.find((product) => Number(product.id) === Number(productId)) || null;
  }

  function openOfferModal(productId) {
    const product = productById(productId);
    if (!product) {
      toast('Tin đăng không còn khả dụng. Danh sách vừa được cập nhật.', 'error');
      loadProducts({ silent: true });
      return;
    }
    if (!state.user) {
      openAuth('login', { type: 'offer', productId });
      return;
    }
    if (isOwnProduct(product)) {
      openOffersModal('received');
      return;
    }
    const prior = state.offers.sent.find((offer) => Number(offer.product_id) === Number(productId) && offer.status === 'PENDING');
    const image = product.image_url || FALLBACK_IMG;
    openModal(`
      <div class="pr-8">
        <span class="inline-flex items-center gap-2 bg-amber-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">
          <i class="fa-solid fa-tag" aria-hidden="true"></i> Trả giá an toàn
        </span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">Đề xuất mức giá</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">Chỉ nhập con số. Studeal không có khung chat và không chia sẻ email, số điện thoại hay Zalo.</p>
      </div>
      <div class="mt-5 flex items-center gap-3 border border-slate-100 bg-slate-50 p-3">
        <img src="${esc(image)}" alt="" data-fallback="${esc(FALLBACK_IMG)}" class="h-16 w-16 object-cover">
        <div class="min-w-0 flex-1">
          <p class="line-clamp-2 text-xs font-extrabold leading-snug text-ink">${esc(product.title)}</p>
          <p class="mt-1 text-[10px] font-semibold text-slate-500">Giá niêm yết <strong class="text-sky-700">${vnd(product.price)}</strong></p>
        </div>
      </div>
      <form data-market-form="offer" data-product-id="${product.id}" class="mt-5 space-y-3" novalidate>
        <p data-form-error class="hidden bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100"></p>
        <label for="marketOfferPrice" class="block text-[11px] font-extrabold text-slate-700">Mức giá bạn đề xuất (VNĐ)</label>
        <div class="relative">
          <input id="marketOfferPrice" name="offer_price" type="number" inputmode="numeric" min="1" max="${Math.max(1, Number(product.price) - 1)}" step="1000" required
                 value="${esc(prior ? prior.offer_price : '')}" placeholder="Ví dụ: ${Math.max(1000, Math.floor(Number(product.price) * 0.85 / 1000) * 1000)}"
                 class="h-14 w-full border border-slate-200 bg-white px-4 pr-14 text-lg font-extrabold text-ink outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
          <span class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">VNĐ</span>
        </div>
        <div class="flex flex-wrap gap-2">
          ${[5, 10, 15].map((pct) => `<button type="button" data-market-action="offer-suggest" data-percent="${pct}" data-price="${product.price}" class="inline-flex h-8 items-center bg-slate-100 px-3 text-[10px] font-extrabold text-slate-600 transition hover:bg-sky-50 hover:text-sky-700">-${pct}% · ${vnd(Math.floor(Number(product.price) * (100 - pct) / 100 / 1000) * 1000)}</button>`).join('')}
        </div>
        <p class=" bg-sky-50 px-3 py-2.5 text-[10px] leading-relaxed text-sky-800 ring-1 ring-sky-100"><i class="fa-solid fa-lock mr-1" aria-hidden="true"></i>Offer chỉ gồm giá đề xuất. Không gửi tin nhắn hoặc thông tin liên lạc.</p>
        <button type="submit" class="${BTN.primary} h-11"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i>${prior ? 'Cập nhật mức trả giá' : 'Gửi offer cho người bán'}</button>
      </form>
    `, { label: 'Trả giá sản phẩm' });
  }

  async function submitOffer(form, button) {
    const productId = Number(form.dataset.productId);
    const product = productById(productId);
    const price = Number(digits(form.elements.offer_price.value));
    if (!product || !Number.isFinite(price) || price <= 0 || price >= Number(product.price)) {
      showFormError(form, 'Mức giá phải là số lớn hơn 0 và thấp hơn giá niêm yết.');
      return;
    }
    resetFormError(form);
    setButtonLoading(button, true, 'Đang gửi offer…');
    try {
      const data = await api('/api/offers', { method: 'POST', body: { product_id: productId, offer_price: price } });
      closeModal();
      await refreshSession({ silent: true });
      toast(data.message || 'Đã gửi đề xuất giá đến người bán.', 'success');
      renderMarket(true);
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function addToCart(productId, offerId = null) {
    const product = productById(productId);
    if (!product) {
      toast('Sản phẩm đã hết hàng. Đang làm mới danh sách.', 'error');
      loadProducts({ silent: true });
      return;
    }
    if (isOwnProduct(product)) {
      toast('Bạn không thể mua sản phẩm do chính mình đăng.', 'error');
      return;
    }
    const offer = offerId
      ? state.offers.sent.find((item) => Number(item.id) === Number(offerId) && item.status === 'ACCEPTED')
      : acceptedOfferFor(productId);
    if (offerId && !offer) {
      toast('Không tìm thấy deal đã được chấp nhận. Hãy tải lại offer.', 'error');
      refreshSession({ silent: true });
      return;
    }
    if (state.cart && Number(state.cart.product.id) !== Number(productId)) {
      const replace = window.confirm('Giỏ escrow xử lý một sản phẩm mỗi đơn. Thay sản phẩm hiện tại bằng món này?');
      if (!replace) return;
    }
    const methods = (product.delivery_methods || []).map((item) => item.code);
    const method = methods[0] || 'MEETUP';
    const price = offer ? Number(offer.offer_price) : Number(product.price);
    state.cart = {
      product,
      offer: offer || null,
      price,
      method,
      meetupDetail: product.meetup_location || '',
      shipDetail: '',
      weekday: 'Thứ 4',
      direction: 'CS1 → CS2',
      voucherCode: '',
      voucher: null,
      applyingVoucher: false,
      checkoutBusy: false,
    };
    updateCounts();
    const modal = $('#marketModal');
    const openedFromModal = Boolean(modal && !modal.classList.contains('hidden'));
    if (openedFromModal) {
      closeModal();
      window.setTimeout(openCart, 205);
    } else {
      openCart();
    }
  }

  function cartMethodOptions(cart) {
    const methods = (cart.product.delivery_methods || []).map((method) => method.code);
    return methods.map((code) => {
      const meta = DELIVERY_META[code];
      if (!meta) return '';
      const checked = cart.method === code;
      return `<label class="group flex cursor-pointer items-start gap-3 border p-3.5 transition ${checked ? 'border-sky-400 bg-sky-50/80 ring-2 ring-sky-100' : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'}">
        <input type="radio" name="delivery_method" value="${code}" ${checked ? 'checked' : ''} class="mt-0.5 h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center ${meta.tone}"><i class="fa-solid ${meta.icon} text-sm" aria-hidden="true"></i></span>
        <span class="min-w-0 flex-1">
          <span class="block text-[11px] font-extrabold text-ink">${meta.label}</span>
          <span class="mt-0.5 block text-[10px] leading-relaxed text-slate-500">${meta.desc}</span>
        </span>
      </label>`;
    }).join('');
  }

  function cartDetailPanel(cart) {
    if (cart.method === 'MEETUP') {
      return `<div class=" bg-sky-50/80 p-3.5 ring-1 ring-sky-100">
        <label for="marketMeetupDetail" class="mb-1.5 block text-[10px] font-extrabold text-sky-900">Điểm hẹn theo đề xuất người bán</label>
        <input id="marketMeetupDetail" data-cart-field="meetupDetail" type="text" maxlength="240" value="${esc(cart.meetupDetail)}" placeholder="Ví dụ: ĐH KHTN CS1, cổng Nguyễn Văn Cừ"
               class="h-10 w-full border border-sky-200 bg-white px-3 text-xs font-semibold text-ink outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100">
        <p class="mt-1.5 text-[9px] leading-relaxed text-sky-700"><i class="fa-solid fa-location-dot mr-1"></i>Ưu tiên địa điểm công cộng. Không nhập số điện thoại hoặc thông tin liên lạc.</p>
      </div>`;
    }
    if (cart.method === 'SHIP_3RD') {
      return `<div class=" bg-indigo-50/80 p-3.5 ring-1 ring-indigo-100">
        <label for="marketShipDetail" class="mb-1.5 block text-[10px] font-extrabold text-indigo-900">Địa chỉ / ghi chú giao hàng</label>
        <textarea id="marketShipDetail" data-cart-field="shipDetail" rows="2" maxlength="500" placeholder="Nhập địa chỉ nhận hàng và ghi chú cần thiết">${esc(cart.shipDetail)}</textarea>
        <p class="mt-1.5 text-[9px] leading-relaxed text-indigo-700"><i class="fa-solid fa-truck-fast mr-1"></i>Bạn tự đặt Grab/AhaMove; phí tài xế không nằm trong khoản escrow này.</p>
      </div>`;
    }
    const directionOptions = ['CS1 → CS2', 'CS2 → CS1'].map((value) => `<option value="${value}" ${cart.direction === value ? 'selected' : ''}>${value}</option>`).join('');
    return `<div class=" bg-emerald-50/80 p-3.5 ring-1 ring-emerald-100">
      <p class="text-[10px] font-extrabold text-emerald-900">Chọn chuyến tuyến KHTN miễn phí</p>
      <div class="mt-2 grid grid-cols-2 gap-2">
        ${['Thứ 4', 'Thứ 7'].map((day) => `<label class="flex cursor-pointer items-center justify-center gap-2 border px-3 py-2.5 text-[11px] font-extrabold transition ${cart.weekday === day ? 'border-emerald-400 bg-white text-emerald-800 shadow-sm' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}">
          <input type="radio" name="routine_weekday" value="${day}" ${cart.weekday === day ? 'checked' : ''} class="h-3.5 w-3.5 border-emerald-300 text-emerald-600 focus:ring-emerald-500">${day}
        </label>`).join('')}
      </div>
      <label for="marketRoutineDirection" class="mb-1.5 mt-3 block text-[10px] font-extrabold text-emerald-900">Chiều giao</label>
      <select id="marketRoutineDirection" data-cart-field="direction" class="h-10 w-full border border-emerald-200 bg-white px-3 text-xs font-bold text-ink outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100">${directionOptions}</select>
      <p class="mt-1.5 text-[9px] leading-relaxed text-emerald-700"><i class="fa-solid fa-leaf mr-1"></i>Điểm nhận/giao tại CS1 Nguyễn Văn Cừ và CS2 Linh Trung. Phí vận chuyển: 0đ.</p>
    </div>`;
  }

  function cartSummary(cart) {
    const price = Number(cart.price) || 0;
    const discount = cart.voucher ? Number(cart.voucher.discount_amount) || 0 : 0;
    const buyerPay = Math.max(0, price - discount);
    const fee = Math.round(price * 0.02);
    const sellerReceive = price - fee;
    return { price, discount, buyerPay, fee, sellerReceive };
  }

  function cartVoucherButtons() {
    const available = new Map(state.vouchers.map((voucher) => [voucher.code, voucher]));
    const codes = Object.keys(VOUCHER_ORDER).sort((a, b) => VOUCHER_ORDER[a] - VOUCHER_ORDER[b]);
    return codes.map((code) => {
      const voucher = available.get(code) || VOUCHER_FALLBACK.find((item) => item.code === code);
      const active = state.cart && state.cart.voucherCode === code && state.cart.voucher;
      const desc = voucher ? voucher.description : '';
      return `<button type="button" data-market-action="quick-voucher" data-code="${code}" title="${esc(desc)}"
        class="inline-flex h-8 items-center gap-1 border px-2.5 text-[9px] font-extrabold transition ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-sky-100 bg-white text-sky-700 hover:border-sky-300 hover:bg-sky-50'}">
        <i class="fa-solid ${active ? 'fa-circle-check' : 'fa-ticket'}" aria-hidden="true"></i>${code}
      </button>`;
    }).join('');
  }

  function cartHtml(cart) {
    const product = cart.product;
    const summary = cartSummary(cart);
    const image = product.image_url || FALLBACK_IMG;
    const dealCopy = cart.offer ? `<span class="mt-1 inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-700"><i class="fa-solid fa-bolt" aria-hidden="true"></i>Deal đã chấp nhận · offer #${cart.offer.id}</span>` : '';
    const authNotice = state.user ? '' : `<button type="button" data-market-action="cart-login" class="mt-3 w-full border border-amber-200 bg-amber-50 p-3 text-left text-[10px] font-bold leading-relaxed text-amber-900 transition hover:bg-amber-100"><i class="fa-solid fa-lock mr-1"></i>Đăng nhập để tạo đơn escrow. Giỏ hàng sẽ được giữ trong phiên này.</button>`;
    const checkoutLabel = cart.checkoutBusy ? 'Đang tạo đơn…' : `Thanh toán escrow · ${vnd(summary.buyerPay)}`;
    return `
      <header class="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
        <div>
          <p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-600">Thanh toán an toàn</p>
          <h2 class="mt-0.5 text-lg font-extrabold tracking-tight text-ink">Giỏ hàng escrow</h2>
        </div>
        <button type="button" data-market-close-cart aria-label="Đóng giỏ hàng" class="flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </header>
      <div class="cart-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
        <div class=" border border-slate-200 bg-white p-3.5 shadow-sm">
          <div class="flex items-start gap-3">
            <img src="${esc(image)}" alt="${esc(product.title)}" data-fallback="${esc(FALLBACK_IMG)}" class="h-20 w-20 shrink-0 object-cover ring-1 ring-slate-100">
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <h3 class="line-clamp-2 text-xs font-extrabold leading-snug text-ink">${esc(product.title)}</h3>
                <button type="button" data-market-action="remove-cart" aria-label="Bỏ sản phẩm khỏi giỏ" class="flex h-7 w-7 shrink-0 items-center justify-center text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"><i class="fa-solid fa-trash-can text-[10px]" aria-hidden="true"></i></button>
              </div>
              <p class="mt-1 text-[10px] font-semibold text-slate-400">${esc(product.condition_text)} · ${esc(product.seller ? product.seller.alias : '')}</p>
              <div class="mt-1.5 flex flex-wrap items-baseline gap-2">
                <strong class="text-base font-extrabold ${cart.offer ? 'text-amber-600' : 'text-sky-700'}">${vnd(summary.price)}</strong>
                ${cart.offer ? `<span class="text-[10px] font-bold text-slate-400 line-through">${vnd(product.price)}</span>` : ''}
              </div>
              ${dealCopy}
            </div>
          </div>
        </div>

        <section class="mt-5" aria-labelledby="deliveryHeading">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h3 id="deliveryHeading" class="text-[11px] font-extrabold text-ink">Chọn phương thức giao dịch</h3>
            <span class="text-[9px] font-bold text-slate-400">Theo tin đăng</span>
          </div>
          <div class="space-y-2">${cartMethodOptions(cart)}</div>
          <div class="mt-2.5">${cartDetailPanel(cart)}</div>
        </section>

        <section class="mt-5 border border-slate-200 bg-white p-3.5" aria-labelledby="voucherHeading">
          <div class="flex items-center justify-between gap-2">
            <h3 id="voucherHeading" class="text-[11px] font-extrabold text-ink"><i class="fa-solid fa-ticket mr-1 text-amber-500" aria-hidden="true"></i>Mã giảm giá</h3>
            ${cart.voucher ? `<button type="button" data-market-action="remove-voucher" class="text-[9px] font-extrabold text-rose-600 hover:text-rose-700">Gỡ mã</button>` : ''}
          </div>
          <div class="mt-2 flex gap-2">
            <label for="marketVoucherCode" class="sr-only">Nhập mã giảm giá</label>
            <input id="marketVoucherCode" type="text" maxlength="40" autocomplete="off" value="${esc(cart.voucherCode)}" placeholder="Nhập mã voucher"
                   class="h-10 min-w-0 flex-1 border border-slate-200 bg-slate-50 px-3 text-xs font-extrabold uppercase text-ink outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100">
            <button type="button" data-market-action="apply-voucher" class="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 bg-slate-900 px-3 text-[10px] font-extrabold text-white transition hover:bg-slate-700 disabled:opacity-60" ${cart.applyingVoucher ? 'disabled' : ''}>
              ${cart.applyingVoucher ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Kiểm tra' : 'Áp dụng'}
            </button>
          </div>
          <div class="mt-2 flex flex-wrap gap-1.5">${cartVoucherButtons()}</div>
          ${cart.voucher ? `<p class="mt-2 bg-emerald-50 px-2.5 py-2 text-[10px] font-bold text-emerald-700"><i class="fa-solid fa-circle-check mr-1"></i>${esc(cart.voucher.code)} · tiết kiệm ${vnd(cart.voucher.discount_amount)}</p>` : ''}
        </section>

        <section class="mt-5 border border-slate-200 bg-white p-3.5" aria-labelledby="summaryHeading">
          <h3 id="summaryHeading" class="text-[11px] font-extrabold text-ink">Tổng kết thanh toán</h3>
          <div class="mt-2.5 space-y-2 text-[10px]">
            <div class="flex items-center justify-between gap-2 text-slate-500"><span>Giá sản phẩm${cart.offer ? ' (giá deal)' : ''}</span><strong class="text-slate-700">${vnd(summary.price)}</strong></div>
            <div class="flex items-center justify-between gap-2 text-slate-500"><span>Voucher${cart.voucher ? ` · ${esc(cart.voucher.code)}` : ''}</span><strong class="text-emerald-600">− ${vnd(summary.discount)}</strong></div>
            <div class="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-slate-700"><span class="font-extrabold">Bạn thanh toán</span><strong class="text-base font-extrabold text-sky-700">${vnd(summary.buyerPay)}</strong></div>
            <div class="flex items-center justify-between gap-2 text-slate-400"><span>Phí Studeal (2% giá deal/niêm yết)</span><span>${vnd(summary.fee)}</span></div>
            <div class="flex items-center justify-between gap-2 text-slate-400"><span>Người bán nhận khi hoàn tất (98%)</span><span class="font-bold text-emerald-700">${vnd(summary.sellerReceive)}</span></div>
          </div>
        </section>

        <div class="mt-4 flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-950">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-emerald-100 text-emerald-700"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i></span>
          <p class="text-[10px] font-semibold leading-relaxed">Studeal tạm giữ 100% số tiền. Sau khi giao dịch hoàn tất, người bán nhận 98% và Studeal thu 2% phí dịch vụ</p>
        </div>
        <p class="mt-3 text-center text-[9px] leading-relaxed text-slate-400">Mỗi đơn escrow xử lý một sản phẩm. Voucher giảm phần người mua thanh toán; phí 2% tính theo giá sản phẩm/deal.</p>
        ${authNotice}
      </div>
      <footer class="shrink-0 border-t border-slate-100 bg-white px-5 py-4 sm:px-6">
        <button type="button" data-market-action="checkout" class="${BTN.primary} h-12 text-sm" ${cart.checkoutBusy ? 'disabled' : ''}>
          <i class="fa-solid fa-lock" aria-hidden="true"></i> ${checkoutLabel}
        </button>
        <p class="mt-2 text-center text-[9px] font-semibold text-slate-400"><i class="fa-solid fa-qrcode mr-1 text-sky-400"></i>Sau khi tạo đơn, trang sẽ hiển thị QR VietQR minh họa.</p>
      </footer>`;
  }

  function renderCart() {
    const content = $('#marketCartContent');
    if (!content) return;
    if (!state.cart) {
      content.innerHTML = `<header class="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><p class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-sky-600">Studeal escrow</p><h2 class="mt-0.5 text-lg font-extrabold text-ink">Giỏ hàng</h2></div><button type="button" data-market-close-cart aria-label="Đóng" class="flex h-9 w-9 items-center justify-center bg-slate-100 text-slate-500"><i class="fa-solid fa-xmark"></i></button></header><div class="flex flex-1 flex-col items-center justify-center px-6 text-center"><span class="flex h-16 w-16 items-center justify-center bg-sky-50 text-2xl text-sky-500"><i class="fa-solid fa-bag-shopping" aria-hidden="true"></i></span><h3 class="mt-4 text-base font-extrabold text-ink">Giỏ escrow đang trống</h3><p class="mt-2 max-w-xs text-xs leading-relaxed text-slate-500">Chọn một sản phẩm rồi bấm “Mua ngay” hoặc “Mua ngay với giá Deal” để bắt đầu.</p><button type="button" data-market-action="close-cart" class="mt-5 inline-flex h-10 items-center gap-2 bg-sky-600 px-5 text-xs font-extrabold text-white"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Tiếp tục xem chợ</button></div>`;
      return;
    }
    content.innerHTML = cartHtml(state.cart);
    bindImageFallbacks(content);
  }

  function composeDeliveryDetail(cart) {
    if (cart.method === 'MEETUP') return String(cart.meetupDetail || '').trim();
    if (cart.method === 'SHIP_3RD') return String(cart.shipDetail || '').trim();
    return `Tuyến KHTN · ${cart.weekday} · ${cart.direction} · CS1 Nguyễn Văn Cừ ↔ CS2 Linh Trung`;
  }

  async function applyVoucher(code, button) {
    if (!state.cart) return;
    const value = String(code || '').trim().toUpperCase();
    if (!value) {
      toast('Nhập hoặc chọn một mã giảm giá trước.', 'error');
      return;
    }
    state.cart.voucherCode = value;
    state.cart.applyingVoucher = true;
    renderCart(true);
    try {
      const data = await api('/api/vouchers/apply', {
        method: 'POST', auth: false,
        body: { code: value, amount: Number(state.cart.price) },
      });
      state.cart.voucherCode = data.code;
      state.cart.voucher = {
        code: data.code,
        discount_amount: Number(data.discount_amount) || 0,
        description: data.description || '',
      };
      toast(data.message || `Đã áp dụng mã ${data.code}.`, 'success');
    } catch (error) {
      state.cart.voucher = null;
      toast(error.message, 'error', 5200);
    } finally {
      if (state.cart) {
        state.cart.applyingVoucher = false;
        renderCart(true);
      }
    }
  }

  async function checkout(button) {
    if (!state.cart || state.cart.checkoutBusy) return;
    if (!state.user) {
      state.afterAuth = { type: 'checkout' };
      openAuth('login', state.afterAuth);
      return;
    }
    const detail = composeDeliveryDetail(state.cart);
    if (!detail) {
      toast(state.cart.method === 'MEETUP' ? 'Nhập điểm hẹn để tiếp tục.' : 'Nhập địa chỉ hoặc ghi chú giao hàng để tiếp tục.', 'error');
      return;
    }
    const cart = state.cart;
    cart.checkoutBusy = true;
    renderCart(true);
    try {
      const body = {
        product_id: Number(cart.product.id),
        delivery_method: cart.method,
        delivery_detail: detail,
      };
      if (cart.offer) body.offer_id = Number(cart.offer.id);
      if (cart.voucher) body.voucher_code = cart.voucher.code;
      const result = await api('/api/orders/checkout', { method: 'POST', body });
      const order = result.order;
      state.cart = null;
      updateCounts();
      closeCart();
      if (order) {
        state.orders.orders.unshift(order);
        state.orders.buying.unshift(order);
      }
      state.products = state.products.filter((product) => Number(product.id) !== Number(body.product_id));
      state.marketSig = '';
      renderMarket(true);
      loadProducts({ silent: true });
      refreshSession({ silent: true });
      toast('Đã tạo đơn escrow. Sản phẩm được khóa khỏi danh sách ngay lập tức.', 'success', 5000);
      if (order) openQrModal(order);
    } catch (error) {
      toast(error.message, 'error', 6000);
      if (error.status === 409) {
        state.cart = null;
        updateCounts();
        closeCart();
        await loadProducts({ silent: true });
      } else if (state.cart) {
        state.cart.checkoutBusy = false;
        renderCart(true);
      }
    } finally {
      if (state.cart) state.cart.checkoutBusy = false;
    }
  }

  function qrImageUrl(order) {
    const content = `STUDEAL DH${order.id}`;
    const amount = Math.max(0, Number(order.buyer_paid_amount) || 0);
    const params = new URLSearchParams({
      amount: String(amount),
      addInfo: content,
      accountName: VIETQR_BANK.name,
    });
    return `https://img.vietqr.io/image/${VIETQR_BANK.bin}-${VIETQR_BANK.account}-compact2.png?${params.toString()}`;
  }

  function openQrModal(order) {
    const image = qrImageUrl(order);
    const product = order.product || {};
    const isHolding = order.escrow_status === 'HOLDING';
    openModal(`
      <div class="pr-8">
        <span class="inline-flex items-center gap-2 bg-emerald-50 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-700 ring-1 ring-emerald-100">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Đơn escrow đã tạo
        </span>
        <h2 class="mt-3 text-2xl font-extrabold tracking-tight text-ink">${isHolding ? 'Quét mã VietQR' : 'Chi tiết đơn hàng'}</h2>
        <p class="mt-2 text-xs leading-relaxed text-slate-500">Mã đơn <strong class="text-ink">#${order.id}</strong> · trạng thái ${statusPill(order.escrow_status)}</p>
      </div>
      <div class="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div class=" border border-sky-100 bg-sky-50 p-4 text-center">
          <div class="mx-auto flex aspect-square max-w-[240px] items-center justify-center overflow-hidden border border-sky-100 bg-white p-2 shadow-sm">
            <img src="${esc(image)}" alt="Mã VietQR minh họa cho đơn Studeal ${order.id}" class="h-full w-full object-contain" loading="eager" onerror="this.onerror=null;this.src='https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=STUDEAL-DEMO-${encodeURIComponent(String(order.id))}-${encodeURIComponent(String(order.buyer_paid_amount))}'">
          </div>
          <span class="mt-3 inline-flex items-center gap-1.5 bg-white px-2.5 py-1 text-[9px] font-extrabold text-sky-700 ring-1 ring-sky-100"><i class="fa-solid fa-building-columns" aria-hidden="true"></i>${esc(VIETQR_BANK.label)}</span>
        </div>
        <div class="flex flex-col">
          <div class=" border border-slate-200 bg-white p-4">
            <p class="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Thông tin chuyển khoản demo</p>
            <div class="mt-3 space-y-2.5 text-[10px]">
              <div class="flex items-center justify-between gap-2"><span class="text-slate-500">Số tiền</span><strong class="text-lg font-extrabold text-sky-700">${vnd(order.buyer_paid_amount)}</strong></div>
              <div class="flex items-center justify-between gap-2"><span class="text-slate-500">Nội dung</span><strong class=" bg-slate-50 px-2 py-1 font-extrabold text-slate-700">STUDEAL DH${order.id}</strong></div>
              <div class="flex items-center justify-between gap-2"><span class="text-slate-500">Trạng thái escrow</span>${statusPill(order.escrow_status)}</div>
            </div>
          </div>
          <div class="mt-3 border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-900">
            <strong><i class="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true"></i>QR minh họa cho môi trường demo.</strong>
            Tài khoản nhận không phải tài khoản thanh toán thật. Backend đã ghi nhận đơn ở trạng thái HOLDING; không chuyển tiền thật.
          </div>
          <div class="mt-auto flex flex-col gap-2 pt-4">
            <button type="button" data-market-action="qr-orders" class="${BTN.primary} h-11"><i class="fa-solid fa-receipt" aria-hidden="true"></i>Xem đơn hàng của tôi</button>
            <button type="button" data-market-action="qr-done" class="inline-flex h-10 items-center justify-center gap-2 bg-slate-100 text-xs font-extrabold text-slate-600 transition hover:bg-slate-200"><i class="fa-solid fa-check" aria-hidden="true"></i>Đóng màn hình</button>
          </div>
        </div>
      </div>
      <div class="mt-4 flex items-start gap-2 bg-emerald-50 px-3 py-2.5 text-[10px] leading-relaxed text-emerald-800 ring-1 ring-emerald-100">
        <i class="fa-solid fa-lock mt-0.5" aria-hidden="true"></i>
        <span>Studeal tạm giữ 100% số tiền. Người bán chỉ nhận 98% sau khi bạn xác nhận đã nhận hàng; phí dịch vụ 2%.</span>
      </div>
      <p class="mt-3 line-clamp-2 text-[10px] font-semibold text-slate-500"><i class="fa-solid fa-box mr-1 text-sky-400" aria-hidden="true"></i>${esc(product.title || 'Sản phẩm Studeal')}</p>
    `, { wide: true, label: `QR VietQR demo cho đơn hàng ${order.id}` });
  }

  async function submitRegister(form, button) {
    const name = String(form.elements.name.value || '').trim();
    const email = String(form.elements.email.value || '').trim();
    const password = String(form.elements.password.value || '');
    if (name.length < 2) return showFormError(form, 'Họ tên cần có ít nhất 2 ký tự.');
    if (!email || !email.includes('@')) return showFormError(form, 'Nhập email hợp lệ.');
    if (password.length < 6) return showFormError(form, 'Mật khẩu cần có ít nhất 6 ký tự.');
    resetFormError(form);
    setButtonLoading(button, true, 'Đang tạo tài khoản…');
    try {
      const data = await api('/api/auth/register', {
        method: 'POST', auth: false, body: { name, email, password },
      });
      state.authFlow = {
        purpose: data.purpose || 'REGISTER',
        email: data.email || data.account_email || email,
        accountEmail: data.account_email || data.email || email,
        message: data.message,
        debugOtp: data.debug_otp || '',
        emailSent: Boolean(data.email_sent),
      };
      renderOtpModal();
    } catch (error) {
      showFormError(form, error.message);
    } finally {
      setButtonLoading(button, false);
    }
  }

  async function switchDemoAccount(email) {
    const accounts = {
      'buyer@studeal.vn': 'Tài khoản Người Mua',
      'seller.khtn@studeal.vn': 'Người Bán SV KHTN',
    };
    if (!accounts[email]) return;
    if (!window.confirm(`Chuyển sang ${accounts[email]}? Phiên đăng nhập hiện tại sẽ kết thúc.`)) return;
    closeModal();
    closeCart();
    clearSession();
    try {
      const login = await api('/api/auth/login', {
        method: 'POST', auth: false,
        body: { email, password: '123456' },
      });
      if (!login.debug_otp) {
        state.authFlow = {
          purpose: login.purpose || 'LOGIN', email: login.email || email,
          accountEmail: login.account_email || email, message: login.message,
          debugOtp: '', emailSent: Boolean(login.email_sent),
        };
        renderOtpModal();
        toast('OTP đã được gửi email. Nhập mã để hoàn tất chuyển tài khoản.', 'info');
        return;
      }
      toast(`OTP demo ${login.debug_otp} · đang xác thực ${accounts[email]}…`, 'info', 2500);
      const verified = await api('/api/auth/verify-otp', {
        method: 'POST', auth: false,
        body: { email: login.account_email || email, otp: login.debug_otp, purpose: login.purpose || 'LOGIN' },
      });
      saveSession(verified.token, verified.user);
      await refreshSession({ silent: true });
      toast(`Đã chuyển sang ${accounts[email]}.`, 'success');
    } catch (error) {
      toast(error.message, 'error', 6000);
      openAuth('login');
    }
  }

  async function resetDemoData(button) {
    const yes = window.confirm('Reset sẽ xóa toàn bộ dữ liệu hiện tại trong CSDL DEMO (tài khoản đăng ký, tin đăng, offer và đơn hàng) rồi khôi phục 3 tài khoản mẫu + 8 sản phẩm. Tiếp tục?');
    if (!yes) return;
    setButtonLoading(button, true, 'Đang reset…');
    try {
      const data = await api('/api/demo/reset', {
        method: 'POST', auth: false,
        headers: { 'X-Demo-Reset': 'RESET-DEMO-DATA' },
      });
      clearSession();
      state.marketSig = '';
      await Promise.allSettled([loadProducts(), loadVouchers()]);
      toast(`${data.message} ${data.counts.products} sản phẩm, ${data.counts.orders} đơn hàng.`, 'success', 6000);
    } catch (error) {
      toast(error.message, 'error', 6000);
    } finally {
      setButtonLoading(button, false);
    }
  }

  function bindImageFallbacks(root = document) {
    $$('img[data-fallback]', root).forEach((image) => {
      if (image.dataset.fallbackBound) return;
      image.dataset.fallbackBound = 'true';
      image.addEventListener('error', () => {
        if (image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
      }, { once: true });
    });
  }

  function setSearch(value) {
    state.filters.q = String(value || '').trim();
    updateFilterUI();
    renderMarket(true);
  }

  function resetFilters() {
    state.filters = { q: '', category: '', delivery: '' };
    updateFilterUI();
    renderMarket(true);
    const input = $('#marketSearchInput');
    if (input) input.focus();
  }

  async function quickLogin(email, button) {
    const content = $('#marketModalContent');
    if (content) {
      const emailInput = $('#marketLoginEmail', content);
      const passwordInput = $('#marketLoginPassword', content);
      if (emailInput) emailInput.value = email;
      if (passwordInput) passwordInput.value = '123456';
    }
    await startLogin(email, '123456', button);
  }

  function handleAction(action, element) {
    const productId = Number(element.dataset.productId);
    switch (action) {
      case 'login':
        openAuth('login');
        break;
      case 'open-account':
        openOffersModal('received');
        break;
      case 'open-offers':
        openOffersModal('received');
        break;
      case 'open-cart':
        openCart();
        break;
      case 'close-cart':
        closeCart();
        break;
      case 'clear-search':
        setSearch('');
        break;
      case 'reset-filters':
        resetFilters();
        break;
      case 'retry-products':
        loadProducts();
        break;
      case 'offer':
        openOfferModal(productId);
        break;
      case 'buy':
        addToCart(productId, element.dataset.offerId || null);
        break;
      case 'auth-tab':
        renderAuthModal(element.dataset.authTab === 'register' ? 'register' : 'login');
        break;
      case 'auth-back':
        state.authFlow = null;
        renderAuthModal('login');
        break;
      case 'fill-otp': {
        const input = $('#marketOtp');
        if (input && state.authFlow) {
          input.value = state.authFlow.debugOtp || '';
          input.focus();
        }
        break;
      }
      case 'resend-otp':
        resendOtp(element);
        break;
      case 'quick-login':
        quickLogin(element.dataset.email, element);
        break;
      case 'offers-tab':
        state.offersTab = element.dataset.tab || 'received';
        renderAccountModal();
        break;
      case 'respond-offer':
        respondOffer(Number(element.dataset.offerId), element.dataset.status, element);
        break;
      case 'logout':
        logout();
        break;
      case 'confirm-received':
        confirmReceived(Number(element.dataset.orderId), element);
        break;
      case 'view-order-qr':
        openOrderQr(Number(element.dataset.orderId));
        break;
      case 'remove-cart':
        state.cart = null;
        updateCounts();
        renderCart();
        toast('Đã bỏ sản phẩm khỏi giỏ escrow.', 'info');
        break;
      case 'apply-voucher':
        applyVoucher($('#marketVoucherCode') ? $('#marketVoucherCode').value : '', element);
        break;
      case 'quick-voucher':
        applyVoucher(element.dataset.code, element);
        break;
      case 'remove-voucher':
        if (state.cart) {
          state.cart.voucher = null;
          state.cart.voucherCode = '';
          renderCart();
          toast('Đã gỡ mã giảm giá.', 'info');
        }
        break;
      case 'checkout':
        checkout(element);
        break;
      case 'cart-login':
        state.afterAuth = { type: 'checkout' };
        openAuth('login', state.afterAuth);
        break;
      case 'qr-orders':
        closeModal();
        window.setTimeout(() => openOffersModal('orders'), 240);
        break;
      case 'qr-done':
        closeModal();
        break;
      case 'verify-student':
        openStudentVerification();
        break;
      case 'open-sell':
        openSellModal();
        break;
      case 'sell-demo-link':
        closeModal();
        break;
      case 'toggle-demo-toolbar': {
        const actions = $('#marketDemoActions');
        const chevron = $('#marketDemoChevron');
        const collapsed = actions && !actions.classList.contains('hidden');
        if (actions) actions.classList.toggle('hidden', collapsed);
        if (chevron) chevron.classList.toggle('rotate-180', collapsed);
        break;
      }
      case 'demo-switch':
        switchDemoAccount(element.dataset.email);
        break;
      case 'demo-reset':
        resetDemoData(element);
        break;
      case 'offer-suggest': {
        const input = $('#marketOfferPrice');
        if (input) {
          const price = Number(element.dataset.price) || 0;
          const percent = Number(element.dataset.percent) || 0;
          input.value = String(Math.floor(price * (100 - percent) / 100 / 1000) * 1000);
          input.focus();
        }
        break;
      }
      default:
        break;
    }
  }

  function onClick(event) {
    const closeModalButton = event.target.closest('[data-market-close-modal]');
    if (closeModalButton) {
      closeModal();
      return;
    }
    const closeCartButton = event.target.closest('[data-market-close-cart]');
    if (closeCartButton) {
      closeCart();
      return;
    }
    const category = event.target.closest('[data-filter-category]');
    if (category) {
      state.filters.category = category.dataset.filterCategory || '';
      updateFilterUI();
      renderMarket(true);
      return;
    }
    const delivery = event.target.closest('[data-filter-delivery]');
    if (delivery) {
      state.filters.delivery = delivery.dataset.filterDelivery || '';
      updateFilterUI();
      renderMarket(true);
      return;
    }
    const button = event.target.closest('[data-market-action]');
    if (!button || button.disabled) return;
    event.preventDefault();
    handleAction(button.dataset.marketAction, button);
  }

  function onSubmit(event) {
    const form = event.target.closest('form[data-market-form]');
    if (form) {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      switch (form.dataset.marketForm) {
        case 'login':
          startLogin(form.elements.email.value, form.elements.password.value, button);
          break;
        case 'register':
          submitRegister(form, button);
          break;
        case 'otp':
          submitOtp(form, button);
          break;
        case 'offer':
          submitOffer(form, button);
          break;
        case 'student':
          submitStudentVerification(form, button);
          break;
        case 'sell':
          submitSell(form, button);
          break;
        default:
          break;
      }
      return;
    }
    if (event.target.id === 'marketSearchForm') {
      event.preventDefault();
      setSearch($('#marketSearchInput') ? $('#marketSearchInput').value : '');
    }
  }

  function onInput(event) {
    const target = event.target;
    if (target.id === 'marketSearchInput') {
      state.filters.q = target.value.trim();
      updateFilterUI();
      debouncedRenderMarket();
      return;
    }
    if (target.name === 'otp') {
      target.value = digits(target.value).slice(0, 6);
      return;
    }
    if (target.name === 'offer_price') {
      target.value = digits(target.value);
      return;
    }
    if (target.id === 'marketSellDescription') {
      const warning = $('#marketPhoneWarning');
      const phoneLike = /(?:\+?84|0)(?:[\s().-]*\d){8,10}/.test(target.value);
      if (warning) warning.classList.toggle('hidden', !phoneLike);
      return;
    }
    if (!state.cart) return;
    if (target.dataset.cartField === 'meetupDetail') state.cart.meetupDetail = target.value;
    if (target.dataset.cartField === 'shipDetail') state.cart.shipDetail = target.value;
    if (target.id === 'marketVoucherCode') state.cart.voucherCode = target.value.toUpperCase();
  }

  function onChange(event) {
    const target = event.target;
    if (!state.cart) return;
    if (target.name === 'delivery_method') {
      state.cart.method = target.value;
      if (target.value === 'MEETUP' && !state.cart.meetupDetail) state.cart.meetupDetail = state.cart.product.meetup_location || '';
      renderCart(true);
      return;
    }
    if (target.name === 'routine_weekday') {
      state.cart.weekday = target.value;
      renderCart(true);
      return;
    }
    if (target.dataset.cartField === 'direction') {
      state.cart.direction = target.value;
      renderCart(true);
    }
  }

  const debouncedRenderMarket = debounce(() => renderMarket(true), 130);

  function onKeydown(event) {
    const modal = $('#marketModal');
    const cart = $('#marketCartRoot');
    if (event.key === 'Escape') {
      if (modal && !modal.classList.contains('hidden')) closeModal();
      else if (cart && !cart.classList.contains('hidden')) closeCart();
    }
    if (modal && !modal.classList.contains('hidden')) trapFocus(event, $('#marketModalPanel'));
    else if (cart && !cart.classList.contains('hidden')) trapFocus(event, $('#marketCartPanel'));
  }

  async function init() {
    if (!$('#marketGrid')) return;
    state.token = storageGet(TOKEN_KEY);
    state.authReady = !state.token;
    updateAuthUI();
    updateCounts();
    bindImageFallbacks(document);

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);

    await Promise.allSettled([loadProducts(), loadVouchers()]);
    if (state.token) await refreshSession({ silent: true });
    else {
      state.authReady = true;
      updateAuthUI();
    }

    window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadProducts({ silent: true });
        if (state.token) refreshSession({ silent: true });
      }
    }, 12000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        loadProducts({ silent: true });
        if (state.token) refreshSession({ silent: true });
      }
    });
    window.addEventListener('focus', () => {
      loadProducts({ silent: true });
      if (state.token) refreshSession({ silent: true });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
