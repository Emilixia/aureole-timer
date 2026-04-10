// Frieren Chronomark — Animations Module
// Handles: ripple effects, tab transitions, background effects, micro-animations

const Animations = (function () {
  'use strict';

  let _bgAnimId = null;
  let _bgMode   = 'particles';
  let _bgState  = {};

  // ── Ripple Effect ─────────────────────────────────────────────────────────
  function initRipples() {
    document.addEventListener('mousedown', function (e) {
      if ((window.AppSettings || {}).uiAnimations === false) return;
      const target = e.target.closest(
        'button, .btn, .btn-primary, .btn-secondary, .btn-begin-session, ' +
        '.btn-ghost, .btn-ghost-danger, .btn-danger, .btn-icon, .btn-upload, ' +
        '.nav-tab, .settings-tab, .reader-tool-btn, .spell-card-btn'
      );
      if (!target) return;

      // Ensure overflow:hidden so the ripple is clipped
      if (!target.classList.contains('ripple-host')) {
        target.classList.add('ripple-host');
      }

      const rect   = target.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2.4;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.className    = 'ripple';
      ripple.style.width  = size + 'px';
      ripple.style.height = size + 'px';
      ripple.style.left   = x    + 'px';
      ripple.style.top    = y    + 'px';
      target.appendChild(ripple);
      ripple.addEventListener('animationend', function () { ripple.remove(); });
    });
  }

  // ── Tab Panel Transitions ─────────────────────────────────────────────────
  let _tabBusy = false;

  // Fades/slides the old panel out, then calls callback() when done.
  function animateTabOut(panel, callback) {
    const settings = window.AppSettings || {};
    if (_tabBusy || settings.uiAnimations === false) { callback(); return; }
    const mode = settings.tabTransition || 'slide';
    if (mode === 'none') { callback(); return; }

    _tabBusy = true;
    if (mode === 'slide') {
      panel.style.opacity    = '0';
      panel.style.transform  = 'translateX(-22px) translateY(2px)';
      panel.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
    } else if (mode === 'zoom') {
      panel.style.opacity    = '0';
      panel.style.transform  = 'scale(0.96)';
      panel.style.transition = 'opacity 0.14s ease, transform 0.14s ease';
    } else { // fade
      panel.style.opacity    = '0';
      panel.style.transition = 'opacity 0.14s ease';
    }

    setTimeout(function () {
      panel.style.opacity    = '';
      panel.style.transform  = '';
      panel.style.transition = '';
      _tabBusy = false;
      callback();
    }, 150);
  }

  // ── Pop-in for newly inserted DOM elements ────────────────────────────────
  function popIn(el) {
    if (!el || (window.AppSettings || {}).uiAnimations === false) return;
    el.classList.add('anim-pop-in');
    el.addEventListener('animationend', function onEnd() {
      el.removeEventListener('animationend', onEnd);
      el.classList.remove('anim-pop-in');
    });
  }

  // ── Timer start/stop pulse ────────────────────────────────────────────────
  function timerPulse(el) {
    if (!el || (window.AppSettings || {}).uiAnimations === false) return;
    el.classList.remove('anim-timer-pulse');
    void el.offsetWidth; // force reflow so animation restarts
    el.classList.add('anim-timer-pulse');
    el.addEventListener('animationend', function onEnd() {
      el.removeEventListener('animationend', onEnd);
      el.classList.remove('anim-timer-pulse');
    });
  }

  // ── Background Effect Engine ──────────────────────────────────────────────
  function stopBgEffect() {
    if (_bgAnimId) { cancelAnimationFrame(_bgAnimId); _bgAnimId = null; }
    _bgState = {};
    const canvas = document.getElementById('particleCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    document.body.classList.remove('bg-aurora');
    var ao = document.getElementById('auroraOverlay');
    if (ao) ao.remove();
  }

  function startBgEffect(mode) {
    stopBgEffect();
    _bgMode = mode || 'particles';
    if (_bgMode === 'none') return;

    if (_bgMode === 'aurora') { _startAurora(); return; }

    var canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    if (!canvas.width || canvas.width < 100) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    var ctx = canvas.getContext('2d');
    _initBgState(canvas);

    function loop() {
      _renderBgEffect(canvas, ctx, _bgMode, _bgState);
      _bgAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  function _initBgState(canvas) {
    var W = canvas.width, H = canvas.height;
    var mode = _bgMode;
    _bgState = {};

    if (mode === 'particles' || mode === 'sparkles') {
      _bgState.particles = [];
      var count  = mode === 'sparkles' ? 130 : 70;
      var colors = ['rgba(124,92,191,', 'rgba(61,139,122,', 'rgba(212,168,67,', 'rgba(155,143,192,'];
      for (var i = 0; i < count; i++) {
        _bgState.particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: mode === 'sparkles' ? Math.random() * 3 + 0.6 : Math.random() * 2 + 0.5,
          speed:      Math.random() * (mode === 'sparkles' ? 0.75 : 0.4) + 0.12,
          drift:      (Math.random() - 0.5) * 0.3,
          alpha:      Math.random() * 0.5 + 0.1,
          alphaDelta: (Math.random() - 0.5) * 0.009,
          colorBase:  colors[Math.floor(Math.random() * colors.length)]
        });
      }
    }

    if (mode === 'matrix') {
      _bgState.fz    = 14;
      _bgState.cols  = Math.floor(W / _bgState.fz);
      _bgState.drops = new Array(_bgState.cols).fill(1);
      _bgState.chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF';
    }

    if (mode === 'starfield') {
      _bgState.stars = [];
      for (var j = 0; j < 220; j++) {
        _bgState.stars.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * W, pz: 0 });
      }
    }
  }

  function _renderBgEffect(canvas, ctx, mode, st) {
    var W = canvas.width, H = canvas.height;

    if (mode === 'particles' || mode === 'sparkles') {
      ctx.clearRect(0, 0, W, H);
      var maxAlpha = mode === 'sparkles' ? 0.85 : 0.65;
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        p.y -= p.speed; p.x += p.drift;
        p.alpha += p.alphaDelta;
        if (p.alpha <= 0.05) p.alphaDelta =  Math.abs(p.alphaDelta);
        if (p.alpha >= maxAlpha) p.alphaDelta = -Math.abs(p.alphaDelta);
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.colorBase + p.alpha + ')';
        ctx.fill();
        if (p.r > 1.8 && p.alpha > 0.35) {
          ctx.strokeStyle = p.colorBase + (p.alpha * 0.55) + ')';
          ctx.lineWidth   = mode === 'sparkles' ? 0.8 : 0.5;
          var sz = p.r * (mode === 'sparkles' ? 3 : 2);
          ctx.beginPath();
          ctx.moveTo(p.x - sz, p.y); ctx.lineTo(p.x + sz, p.y);
          ctx.moveTo(p.x, p.y - sz); ctx.lineTo(p.x, p.y + sz);
          ctx.stroke();
        }
      }
    }

    if (mode === 'matrix') {
      ctx.fillStyle = 'rgba(5,5,16,0.055)';
      ctx.fillRect(0, 0, W, H);
      ctx.font = st.fz + 'px monospace';
      for (var c = 0; c < st.drops.length; c++) {
        var ch = st.chars[Math.floor(Math.random() * st.chars.length)];
        var dx = c * st.fz, dy = st.drops[c] * st.fz;
        ctx.fillStyle = '#9fffaf';
        ctx.fillText(ch, dx, dy);
        if (dy > H && Math.random() > 0.975) st.drops[c] = 0;
        st.drops[c] += 0.5;
      }
    }

    if (mode === 'starfield') {
      ctx.fillStyle = 'rgba(5,5,16,0.18)';
      ctx.fillRect(0, 0, W, H);
      var CX = W / 2, CY = H / 2;
      for (var k = 0; k < st.stars.length; k++) {
        var s = st.stars[k];
        s.pz = s.z; s.z -= 2.5;
        if (s.z <= 0) { s.x = Math.random() * W; s.y = Math.random() * H; s.z = W; s.pz = W; }
        var sx  = (s.x - CX) * (W / s.z)  + CX;
        var sy  = (s.y - CY) * (W / s.z)  + CY;
        var px  = (s.x - CX) * (W / s.pz) + CX;
        var py  = (s.y - CY) * (W / s.pz) + CY;
        var str = Math.min(1, (1 - s.z / W) * 1.5);
        var rsz = Math.max(0.3, (1 - s.z / W) * 2.5);
        if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
        ctx.strokeStyle = 'rgba(200,210,255,' + (str * 0.85) + ')';
        ctx.lineWidth   = rsz;
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    }
  }

  function _startAurora() {
    document.body.classList.add('bg-aurora');
    if (!document.getElementById('auroraOverlay')) {
      var div = document.createElement('div');
      div.id = 'auroraOverlay';
      document.body.insertBefore(div, document.body.firstChild);
    }
  }

  function applyBgEffect(mode) {
    var settings = window.AppSettings || {};
    if (settings.particleEffects === false && mode !== 'none') { stopBgEffect(); return; }
    startBgEffect(mode || 'particles');
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    initRipples();
    // Resize particleCanvas on window resize and re-init state
    var canvas = document.getElementById('particleCanvas');
    if (canvas) {
      window.addEventListener('resize', function () {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
        if (_bgAnimId) _initBgState(canvas); // re-seed for new dimensions
      });
    }
  }

  return {
    init:          init,
    animateTabOut: animateTabOut,
    popIn:         popIn,
    timerPulse:    timerPulse,
    startBgEffect: startBgEffect,
    stopBgEffect:  stopBgEffect,
    applyBgEffect: applyBgEffect
  };
})();

window.Animations = Animations;
