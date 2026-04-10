// Frieren Companion — draggable peek character + help panel
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
  ];

  var speechTimer = null;
  var helpVisible = false;

  function init() {
    var companion = document.getElementById('frierenCompanion');
    var helpPanel  = document.getElementById('frierenHelpPanel');
    var helpClose  = document.getElementById('frierenHelpClose');
    var speechEl   = document.getElementById('frierenSpeech');
    var speechText = document.getElementById('frierenSpeechText');

    if (!companion) return;

    // ── Drag ──────────────────────────────────────────────
    var dragging = false;
    var dragOffX = 0, dragOffY = 0;
    var posX = null, posY = null; // null = use CSS default (bottom-right)

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
      companion.classList.add('dragging');
      companion.classList.add('out');

      var rect = companion.getBoundingClientRect();
      dragOffX = e.clientX - rect.left;
      dragOffY = e.clientY - rect.top;

      // Fix position so we can freely move
      if (posX === null) {
        posX = rect.left;
        posY = rect.top;
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      posX = e.clientX - dragOffX;
      posY = e.clientY - dragOffY;
      applyPos();
    });

    document.addEventListener('mouseup', function (e) {
      if (!dragging) return;
      dragging = false;
      companion.classList.remove('dragging');
      if (Math.abs(e.movementX) < 3 && Math.abs(e.movementY) < 3) {
        // Was a click, not a drag
        toggleHelp();
      } else {
        // After drag, stay "out" only if help is open
        if (!helpVisible) {
          companion.classList.remove('out');
        }
      }
    });

    // ── Hover speech bubble ───────────────────────────────
    companion.addEventListener('mouseenter', function () {
      if (helpVisible) return;
      showSpeech(pickSpeech());
    });
    companion.addEventListener('mouseleave', function () {
      if (!helpVisible) hideSpeech();
    });

    // ── Help panel toggle ─────────────────────────────────
    function toggleHelp() {
      helpVisible = !helpVisible;
      if (helpVisible) {
        hideSpeech();
        if (helpPanel) {
          helpPanel.style.display = 'flex';
          positionHelpPanel();
        }
        companion.classList.add('out');
      } else {
        if (helpPanel) helpPanel.style.display = 'none';
        companion.classList.remove('out');
      }
    }

    if (helpClose) {
      helpClose.addEventListener('click', function () {
        helpVisible = false;
        if (helpPanel) helpPanel.style.display = 'none';
        companion.classList.remove('out');
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
      var top = rect.bottom - helpPanel.offsetHeight;
      if (top < 8) top = 8;
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
      speechTimer = setTimeout(hideSpeech, 3500);
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

    // ── Periodic peek-and-speak ───────────────────────────
    var peekInterval = setInterval(function () {
      if (helpVisible || dragging) return;
      // Briefly pop out and say something
      companion.classList.add('out');
      showSpeech(pickSpeech());
      setTimeout(function () {
        if (!helpVisible) companion.classList.remove('out');
      }, 4000);
    }, 90000); // every 90 s

    // Cleanup on page unload
    window.addEventListener('beforeunload', function () { clearInterval(peekInterval); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
