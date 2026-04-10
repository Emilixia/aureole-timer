// Frieren Companion — draggable 3D peek character + help panel
(function () {
  'use strict';

  var SPEECHES = [
    'Hello, adventurer! Need help?',
    'Stay focused. You can do it!',
    'Time flies when you\'re working hard.',
    'Remember to take breaks!',
    'A thousand-year journey begins with one step.',
    'You\'re doing great, keep going!',
    'Tap me to open the guide ✨',
    'Set your start time and click Apply!',
    'Even a mage of a thousand years takes one step at a time.',
    'The Pomodoro technique is Frieren-approved! 🍅',
    'Don\'t forget — short breaks restore your mana.',
    'Focus mode engaged. Nothing can distract you now.',
  ];

  var speechTimer = null;
  var helpVisible = false;

  function init() {
    var companion  = document.getElementById('frierenCompanion');
    var mount      = document.getElementById('frieren3dMount');
    var helpPanel  = document.getElementById('frierenHelpPanel');
    var helpClose  = document.getElementById('frierenHelpClose');
    var speechEl   = document.getElementById('frierenSpeech');
    var speechText = document.getElementById('frierenSpeechText');

    if (!companion) return;

    // ── Init 3D character ─────────────────────────────────
    var frieren3d = null;
    if (mount && typeof FrierenCharacter !== 'undefined') {
      frieren3d = new FrierenCharacter(mount, { width: 200, height: 340 });
      frieren3d.init();
      // Default: only head peeking (progress 0.18 → head at bottom edge)
      frieren3d._peekTarget   = 0.18;
      frieren3d._peekProgress = 0.18;
      frieren3d._applyPeek();
    }

    // ── Drag ──────────────────────────────────────────────
    var dragging = false;
    var dragOffX = 0, dragOffY = 0;
    var dragTotalMove = 0;
    var posX = null, posY = null;

    function applyPos() {
      if (posX !== null && posY !== null) {
        companion.style.right  = 'auto';
        companion.style.bottom = 'auto';
        companion.style.left   = posX + 'px';
        companion.style.top    = posY + 'px';
        companion.style.transform = 'none';
      }
    }

    companion.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      dragTotalMove = 0;
      companion.classList.add('dragging');

      var rect = companion.getBoundingClientRect();
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;
      if (posX === null) { posX = rect.left; posY = rect.top; }

      // Slide fully in when grabbed
      if (frieren3d) frieren3d.peek(true);
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      dragTotalMove += Math.abs(e.movementX) + Math.abs(e.movementY);
      posX = e.clientX - dragOffX;
      posY = e.clientY - dragOffY;
      applyPos();
    });

    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      companion.classList.remove('dragging');

      if (dragTotalMove < 5) {
        // Click — toggle help
        toggleHelp();
      } else {
        // After drag — stay full-out only if help open, else return to peek
        if (!helpVisible) {
          if (frieren3d) frieren3d.peek(false); // back to peek
        }
      }
    });

    // ── Touch drag ────────────────────────────────────────
    var touchStartX, touchStartY, touchMoved;
    companion.addEventListener('touchstart', function (e) {
      var t = e.touches[0];
      touchStartX = t.clientX; touchStartY = t.clientY; touchMoved = false;
      var rect = companion.getBoundingClientRect();
      dragOffX = t.clientX - rect.left; dragOffY = t.clientY - rect.top;
      if (posX === null) { posX = rect.left; posY = rect.top; }
      if (frieren3d) frieren3d.peek(true);
      e.preventDefault();
    }, { passive: false });
    companion.addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (Math.abs(t.clientX - touchStartX) > 4 || Math.abs(t.clientY - touchStartY) > 4) touchMoved = true;
      posX = t.clientX - dragOffX; posY = t.clientY - dragOffY;
      applyPos(); e.preventDefault();
    }, { passive: false });
    companion.addEventListener('touchend', function () {
      if (!touchMoved) { toggleHelp(); }
      else if (!helpVisible) { if (frieren3d) frieren3d.peek(false); }
    });

    // ── Hover — slide fully out & wave ────────────────────
    companion.addEventListener('mouseenter', function () {
      if (dragging) return;
      if (frieren3d) { frieren3d.peek(true); frieren3d.wave(); }
      if (!helpVisible) showSpeech(pickSpeech());
    });
    companion.addEventListener('mouseleave', function () {
      if (dragging || helpVisible) return;
      hideSpeech();
      if (frieren3d) frieren3d.peek(false);
    });

    // ── Help panel toggle ─────────────────────────────────
    function toggleHelp() {
      helpVisible = !helpVisible;
      if (helpVisible) {
        hideSpeech();
        if (frieren3d) { frieren3d.peek(true); frieren3d.excited(); }
        if (helpPanel) {
          helpPanel.style.display = 'flex';
          positionHelpPanel();
        }
      } else {
        if (helpPanel) helpPanel.style.display = 'none';
        if (frieren3d) frieren3d.peek(false);
      }
    }

    if (helpClose) {
      helpClose.addEventListener('click', function () {
        helpVisible = false;
        if (helpPanel) helpPanel.style.display = 'none';
        if (frieren3d) frieren3d.peek(false);
      });
    }

    // ── Help panel tabs ───────────────────────────────────
    document.querySelectorAll('.frieren-help-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.dataset.ftab;
        document.querySelectorAll('.frieren-help-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.frieren-help-section').forEach(function (s) { s.classList.remove('active'); });
        this.classList.add('active');
        var sec = document.getElementById('ftab-' + target);
        if (sec) sec.classList.add('active');
      });
    });

    // ── Position help panel near companion ───────────────
    function positionHelpPanel() {
      if (!helpPanel) return;
      var rect = companion.getBoundingClientRect();
      var panelW = 360;
      var left = rect.left - panelW - 8;
      if (left < 8) left = rect.right + 8;
      var top = Math.max(8, rect.bottom - helpPanel.offsetHeight);
      helpPanel.style.right  = 'auto';
      helpPanel.style.bottom = 'auto';
      helpPanel.style.left   = left + 'px';
      helpPanel.style.top    = top + 'px';
    }

    // ── Speech helpers ────────────────────────────────────
    function showSpeech(text) {
      clearTimeout(speechTimer);
      if (!speechEl || !speechText) return;
      speechText.textContent = text;
      speechEl.style.display = 'block';
      speechTimer = setTimeout(hideSpeech, 3800);
    }
    function hideSpeech() {
      if (speechEl) speechEl.style.display = 'none';
    }
    var speechIdx = 0;
    function pickSpeech() {
      var msg = SPEECHES[speechIdx % SPEECHES.length];
      speechIdx++;
      return msg;
    }

    // ── Periodic auto-peek every 90 s ────────────────────
    var peekInterval = setInterval(function () {
      if (helpVisible || dragging) return;
      if (frieren3d) { frieren3d.peek(true); frieren3d.wave(); }
      showSpeech(pickSpeech());
      setTimeout(function () {
        if (!helpVisible) {
          hideSpeech();
          if (frieren3d) frieren3d.peek(false);
        }
      }, 4200);
    }, 90000);

    window.addEventListener('beforeunload', function () {
      clearInterval(peekInterval);
      if (frieren3d) frieren3d.dispose();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

