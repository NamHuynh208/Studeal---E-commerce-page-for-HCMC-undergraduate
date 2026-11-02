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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  // Video motion phủ hero: tự phát 1 lần, hết video (hoặc lỗi) thì hero hiện lại kèm nút phát lại.
  function initHeroVideo() {
    var frame = document.querySelector('[data-hero-frame]');
    if (!frame) return;
    var video = frame.querySelector('[data-hero-video]');
    var content = frame.querySelector('[data-hero-content]');
    var play = frame.querySelector('[data-hero-play]');
    var stallTimer = null;
    var startTimer = null;
    // điện thoại dùng bản dọc 9:16; chỉ gán 1 nguồn để không tải cả 2 file
    // shortcut: chọn 1 lần lúc tải trang, xoay màn hình không đổi bản video
    var mobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    video.src = (mobile && video.dataset.srcMobile) || video.dataset.src;

    function setPlaying(playing) {
      frame.classList.toggle('is-playing', playing);
      frame.classList.toggle('is-done', !playing);
      content.inert = playing;
      play.tabIndex = playing ? -1 : 0;
    }

    // keepRolling: hòa tan khi video còn chạy nốt những frame cuối (không đóng băng hình)
    function finish(keepRolling) {
      clearTimeout(stallTimer);
      clearTimeout(startTimer);
      if (frame.classList.contains('is-done')) return;
      var hadFocus = frame.contains(document.activeElement);
      if (keepRolling !== true) video.pause();
      setPlaying(false);
      if (hadFocus) play.focus({ preventScroll: true });
    }

    function start() {
      clearTimeout(startTimer);
      setPlaying(true);
      // mạng chậm / trình duyệt chặn autoplay: không để hero bị che quá 3s
      stallTimer = setTimeout(finish, 3000);
      try { video.currentTime = 0; } catch (e) { /* metadata chưa tải */ }
      var p = video.play();
      if (p && p.catch) p.catch(finish);
    }

    video.addEventListener('playing', function () { clearTimeout(stallTimer); });
    // video tự có outro (thẻ trượt về chỗ thẻ hero, nền về màu hero) -> chỉ hòa tan ở 0,4s cuối
    video.addEventListener('timeupdate', function () {
      if (video.duration && video.duration - video.currentTime <= 0.4) finish(true);
    });
    video.addEventListener('ended', function () { finish(true); });
    video.addEventListener('error', finish);
    play.addEventListener('click', function () {
      setPlaying(true);
      // đợi nội dung hero rút đi rồi mới phát từ đầu
      startTimer = setTimeout(start, 300);
    });

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) setPlaying(false);
    else start();
  }

  function init() {
    initReveal();
    initIcons();
    initHeroVideo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('alpine:initialized', initIcons);
})();
