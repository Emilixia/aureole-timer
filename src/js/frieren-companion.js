// Frieren Companion — fixed 3D character (bottom-right) + help panel
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

  // Periodic idle animation sequence (cycles through these)
  var IDLE_ACTIONS = ['wave', 'think', 'stretch', 'shrug', 'nod', 'bow', 'wave', 'think'];

  var speechTimer = null;
  var helpVisible = false;
  var idleActionIdx = 0;

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
      frieren3d = new FrierenCharacter(mount, { width: 260, height: 340 });
      frieren3d.init();
    }

    // ── Click — toggle help ───────────────────────────────
    companion.addEventListener('click', function () {
      toggleHelp();
    });

    // ── Hover — wave ──────────────────────────────────────
    companion.addEventListener('mouseenter', function () {
      if (frieren3d) frieren3d.wave();
      if (!helpVisible) showSpeech(pickSpeech());
    });
    companion.addEventListener('mouseleave', function () {
      if (!helpVisible) hideSpeech();
    });

    // ── Help panel toggle ─────────────────────────────────
    function toggleHelp() {
      helpVisible = !helpVisible;
      if (helpVisible) {
        hideSpeech();
        if (frieren3d) frieren3d.excited();
        if (helpPanel) {
          helpPanel.style.display = 'flex';
          positionHelpPanel();
        }
      } else {
        if (helpPanel) helpPanel.style.display = 'none';
      }
    }

    if (helpClose) {
      helpClose.addEventListener('click', function (e) {
        e.stopPropagation();
        helpVisible = false;
        if (helpPanel) helpPanel.style.display = 'none';
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

    // ── Periodic idle animation every 90 s ───────────────
    var waveInterval = setInterval(function () {
      if (helpVisible) return;
      var action = IDLE_ACTIONS[idleActionIdx % IDLE_ACTIONS.length];
      idleActionIdx++;
      if (frieren3d && typeof frieren3d[action] === 'function') frieren3d[action]();
      showSpeech(pickSpeech());
      setTimeout(function () {
        if (!helpVisible) hideSpeech();
      }, 4200);
    }, 90000);

    // ── Timer event hooks ─────────────────────────────────
    document.addEventListener('frieren:timerStart', function () {
      if (frieren3d) frieren3d.nod();
    });
    document.addEventListener('frieren:timerComplete', function () {
      if (frieren3d) frieren3d.clap();
      showSpeech('✨ Amazing work! Session complete!');
      setTimeout(function () { if (!helpVisible) hideSpeech(); }, 4500);
    });
    document.addEventListener('frieren:breakStart', function () {
      if (frieren3d) frieren3d.stretch();
      showSpeech('Time to recharge your mana! ☕');
      setTimeout(function () { if (!helpVisible) hideSpeech(); }, 4000);
    });

    window.addEventListener('beforeunload', function () {
      clearInterval(waveInterval);
      if (frieren3d) frieren3d.dispose();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

