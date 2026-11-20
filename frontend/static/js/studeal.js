/* ============================================================
   Studeal – progressive enhancements (no framework needed)
   ============================================================ */
(function () {
  'use strict';

  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (!('IntersectionObserver' in window)) {
      items.forEach(function (item) {
        item.classList.add('is-visible');
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  // Nút sáng/tối: mặc định theo hệ thống, bấm thì nhớ lựa chọn trên thiết bị.
  function initTheme() {
    var root = document.documentElement;
    var meta = document.querySelector('[data-theme-color]');

    function sync() {
      if (meta) meta.setAttribute('content', root.classList.contains('dark') ? '#000000' : '#ffffff');
      document.dispatchEvent(new Event('studeal:theme'));
    }

    sync();
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-theme-toggle]');
      if (!button) return;
      var dark = !root.classList.contains('dark');
      root.classList.toggle('dark', dark);
      try { localStorage.setItem('studeal_theme', dark ? 'dark' : 'light'); } catch (e) { /* chế độ riêng tư */ }
      sync();
    });

    if (window.matchMedia) {
      var query = window.matchMedia('(prefers-color-scheme: dark)');
      var follow = function (event) {
        var saved = '';
        try { saved = localStorage.getItem('studeal_theme') || ''; } catch (e) { /* ignore */ }
        if (saved) return; // người dùng đã tự chọn
        root.classList.toggle('dark', event.matches);
        sync();
      };
      if (query.addEventListener) query.addEventListener('change', follow);
    }
  }

  // Ô tài khoản trên header: thay nút Đăng nhập khi đã đăng nhập (trang chủ cập nhật qua sự kiện studeal:auth)
  function initHeaderAccount() {
    var chip = document.querySelector('[data-header-account]');
    if (!chip) return;
    function render() {
      var user = null;
      try {
        if (localStorage.getItem('studeal_token')) user = JSON.parse(localStorage.getItem('studeal_user') || 'null');
      } catch (e) { user = null; }
      chip.classList.toggle('hidden', !user);
      document.documentElement.classList.toggle('has-session', Boolean(user));
      if (!user) return;
      var name = String(user.name || 'Sinh viên').trim();
      chip.querySelector('[data-account-initial]').textContent = name.charAt(0).toUpperCase();
      chip.querySelector('[data-account-name]').textContent = name;
      var status = chip.querySelector('[data-account-status]');
      status.textContent = user.verified ? 'Đã xác thực ' + (user.school || 'mail sinh viên') : 'Chưa xác thực';
      status.className = 'block truncate text-[11px] leading-tight ' + (user.verified ? 'text-emerald-600' : 'text-slate-400');
      chip.setAttribute('aria-label', 'Mở tài khoản ' + name);
    }
    render();
    document.addEventListener('studeal:auth', render);
  }

  // Video giới thiệu trong khung hero: tự phát (tắt tiếng, lặp) khi nằm trong khung nhìn,
  // dừng khi cuộn đi; người dùng bấm tạm dừng thì không tự phát lại.
  function initHeroVideo() {
    var tile = document.querySelector('[data-hero-tile]');
    if (!tile) return;
    var video = tile.querySelector('[data-hero-video]');
    var button = tile.querySelector('[data-hero-toggle]');
    if (!video || !button) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var userPaused = reduced; // giảm chuyển động: chỉ phát khi người dùng bấm
    var loaded = false;

    // shortcut: chọn bản dọc/ngang 1 lần lúc tải trang, xoay màn hình không đổi bản video
    var mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;

    // điện thoại dùng bản dọc 9:16, giao diện tối dùng bản nền tối; chỉ gán 1 nguồn để không tải nhiều file
    function pickSrc() {
      var d = video.dataset;
      var dark = document.documentElement.classList.contains('dark');
      if (mobile) return (dark && d.srcMobileDark) || d.srcMobile || d.src;
      return (dark && d.srcDark) || d.src;
    }

    function load() {
      if (loaded) return;
      loaded = true;
      video.src = pickSrc();
    }

    // Đổi sáng/tối khi video đã tải: thay nguồn, giữ vị trí đang xem
    document.addEventListener('studeal:theme', function () {
      if (!loaded) return;
      var next = pickSrc();
      if (video.getAttribute('src') === next) return;
      var time = video.currentTime;
      var wasPlaying = !video.paused;
      video.addEventListener('loadedmetadata', function () {
        try { video.currentTime = time; } catch (e) { /* ignore */ }
      }, { once: true });
      video.preload = 'auto'; // preload="none" sẽ không tải nguồn mới cho đến khi play()
      video.src = next;
      if (wasPlaying) play();
    });

    function setIcon(playing) {
      button.innerHTML = '<i class="fa-solid ' + (playing ? 'fa-pause' : 'fa-play') + '" aria-hidden="true"></i>';
      button.setAttribute('aria-label', playing ? 'Tạm dừng video giới thiệu' : 'Phát video giới thiệu');
    }

    function play() {
      load();
      var promise = video.play();
      if (promise && promise.catch) promise.catch(function () { setIcon(false); });
    }

    video.addEventListener('playing', function () {
      tile.classList.add('is-playing');
      setIcon(true);
    });
    video.addEventListener('pause', function () { setIcon(false); });
    video.addEventListener('error', function () { tile.classList.remove('is-playing'); setIcon(false); });

    button.addEventListener('click', function () {
      if (video.paused) {
        userPaused = false;
        play();
      } else {
        userPaused = true;
        video.pause();
      }
    });

    if (!('IntersectionObserver' in window)) {
      if (!userPaused) play();
      return;
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!userPaused) play();
        } else if (!video.paused) {
          video.pause();
        }
      });
    }, { threshold: 0.35 }).observe(tile);
  }

  function init() {
    initReveal();
    initTheme();
    initHeaderAccount();
    initHeroVideo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
