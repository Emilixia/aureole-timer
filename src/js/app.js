// Frieren Chronomark — Main Application Orchestrator

const ENCOURAGEMENTS = [
  '✨ You\'re doing amazing, keep going!',
  '🌟 Every moment you work is a spell cast!',
  '⚡ Your focus is powerful magic!',
  '🧙 Frieren studied for centuries. You can do this!',
  '💜 Progress, not perfection!',
  '🔮 Your dedication is building something great!',
  '⚜ The journey of Frieren continues...',
  '🌸 Small steps lead to great distances.',
  '✨ You are the mage of your own story!',
  '🌊 Steady as the tide, powerful as the storm.',
  '🔥 Your streak is growing — don\'t stop now!',
  '💎 Rare gems take time to form.',
  '🧝 Every great mage started where you are.',
  '⭐ The stars align for those who persist.'
];

// ── Particle System ──────────────────────────────────────────
let particleAnimId = null;
let particles = [];

function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Create particles
  particles = [];
  const count = 70;
  const colors = ['rgba(124,92,191,', 'rgba(61,139,122,', 'rgba(212,168,67,', 'rgba(155,143,192,'];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.4 + 0.1,
      drift: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
      alphaDelta: (Math.random() - 0.5) * 0.008,
      colorBase: colors[Math.floor(Math.random() * colors.length)]
    });
  }
}

function startParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  if (particleAnimId) return;

  const ctx = canvas.getContext('2d');

  function animate() {
    if (!canvas.width) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.y -= p.speed;
      p.x += p.drift;
      p.alpha += p.alphaDelta;

      if (p.alpha <= 0.05) p.alphaDelta = Math.abs(p.alphaDelta);
      if (p.alpha >= 0.65) p.alphaDelta = -Math.abs(p.alphaDelta);

      if (p.y < -10) {
        p.y = canvas.height + 10;
        p.x = Math.random() * canvas.width;
      }
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.colorBase + p.alpha + ')';
      ctx.fill();

      // Occasional sparkle cross
      if (p.r > 2 && p.alpha > 0.4) {
        ctx.strokeStyle = p.colorBase + (p.alpha * 0.6) + ')';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.r * 2, p.y);
        ctx.lineTo(p.x + p.r * 2, p.y);
        ctx.moveTo(p.x, p.y - p.r * 2);
        ctx.lineTo(p.x, p.y + p.r * 2);
        ctx.stroke();
      }
    }

    particleAnimId = requestAnimationFrame(animate);
  }
  animate();
}

function stopParticles() {
  if (particleAnimId) {
    cancelAnimationFrame(particleAnimId);
    particleAnimId = null;
  }
  const canvas = document.getElementById('particleCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ── Toast Notification System ────────────────────────────────
// Cached thumbs-up data URL (loaded once from Storage at startup)
let _thumbsUpUrl = null;

function showToast(message, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;

  let icon = '';
  if (type === 'success') icon = '✅ ';
  else if (type === 'error') icon = '❌ ';
  else if (type === 'achievement') icon = '🏆 ';
  else icon = 'ℹ️ ';

  // Build toast contents with optional thumbs-up image
  if (_thumbsUpUrl) {
    const img = document.createElement('img');
    img.src = _thumbsUpUrl;
    img.className = 'toast-thumb';
    img.alt = '👍';
    toast.appendChild(img);
  }
  const textNode = document.createTextNode(icon + message);
  toast.appendChild(textNode);

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(function () {
    toast.classList.add('show');
  });

  const duration = type === 'achievement' ? 5000 : 3500;
  setTimeout(function () {
    toast.classList.remove('show');
    toast.classList.add('hide');
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 400);
  }, duration);
}

window.showToast = showToast;

// ── Sound System ─────────────────────────────────────────────
// Custom audio for timer-complete, toast and achievement events.
var SoundSystem = (function () {
  var _volume = 0.8; // 0-1
  var _sounds = { timer: null, toast: null, achieve: null };

  function setVolume(v) { _volume = Math.max(0, Math.min(1, v)); }

  function play(type) {
    var dataUrl = _sounds[type];
    if (!dataUrl) return;
    var audio = new Audio(dataUrl);
    audio.volume = _volume;
    audio.play().catch(function () {});
  }

  function setSound(type, dataUrl) { _sounds[type] = dataUrl; }
  function clearSound(type) { _sounds[type] = null; }

  async function load() {
    var vol = await Storage.get('soundVolume', 80);
    _volume = Math.max(0, Math.min(100, vol)) / 100;
    _sounds.timer   = await Storage.get('timerSound', null);
    _sounds.toast   = await Storage.get('toastSound', null);
    _sounds.achieve = await Storage.get('achieveSound', null);
  }

  return { play: play, setSound: setSound, clearSound: clearSound, setVolume: setVolume, load: load };
})();
window.SoundSystem = SoundSystem;

// Play toast sound on every toast call
var _origShowToast = window.showToast;
window.showToast = function (message, type) {
  if (type === 'achievement') {
    SoundSystem.play('achieve');
  } else {
    SoundSystem.play('toast');
  }
  return _origShowToast(message, type);
};
// Keep internal reference in sync
showToast = window.showToast;

function initSoundSettings() {
  function wireSound(uploadId, playBtnId, clearBtnId, nameId, storageKey, soundType) {
    var upload = document.getElementById(uploadId);
    var playBtn = document.getElementById(playBtnId);
    var clearBtn = document.getElementById(clearBtnId);
    var nameEl = document.getElementById(nameId);

    // Restore saved name label
    Storage.get(storageKey + '_name', '').then(function (n) {
      if (nameEl && n) nameEl.textContent = n;
    });

    if (upload) {
      upload.addEventListener('change', function () {
        var file = upload.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var dataUrl = e.target.result;
          SoundSystem.setSound(soundType, dataUrl);
          Storage.set(storageKey, dataUrl);
          Storage.set(storageKey + '_name', file.name);
          if (nameEl) nameEl.textContent = file.name;
          if (window.showToast) showToast('Sound uploaded: ' + file.name + ' 🔊', 'success');
        };
        reader.readAsDataURL(file);
      });
    }
    if (playBtn) {
      playBtn.addEventListener('click', function () { SoundSystem.play(soundType); });
    }
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        SoundSystem.clearSound(soundType);
        Storage.set(storageKey, null);
        Storage.set(storageKey + '_name', '');
        if (nameEl) nameEl.textContent = '';
        if (upload) upload.value = '';
      });
    }
  }

  wireSound('uploadTimerSound',  'playTimerSound',  'clearTimerSound',  'timerSoundName',  'timerSound',  'timer');
  wireSound('uploadToastSound',  'playToastSound',  'clearToastSound',  'toastSoundName',  'toastSound',  'toast');
  wireSound('uploadAchieveSound','playAchieveSound','clearAchieveSound','achieveSoundName','achieveSound','achieve');

  var volSlider = document.getElementById('soundVolume');
  var volLabel  = document.getElementById('soundVolumeLabel');
  if (volSlider) {
    Storage.get('soundVolume', 80).then(function (v) {
      volSlider.value = v;
      if (volLabel) volLabel.textContent = v + '%';
      SoundSystem.setVolume(v / 100);
    });
    volSlider.addEventListener('input', function () {
      var v = parseInt(volSlider.value);
      if (volLabel) volLabel.textContent = v + '%';
      SoundSystem.setVolume(v / 100);
      Storage.set('soundVolume', v);
    });
  }
}

// ── Live Clock ───────────────────────────────────────────────
var _worldClockTz   = null;  // IANA timezone string
var _worldClockName = '🌍';   // display label

function updateClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const sidebarClock = document.getElementById('sidebarClock');
  if (sidebarClock) sidebarClock.textContent = timeStr;

  const sidebarDate = document.getElementById('sidebarDate');
  if (sidebarDate) sidebarDate.textContent = dateStr;

  const liveDatetime = document.getElementById('liveDatetime');
  if (liveDatetime) liveDatetime.textContent =
    now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + ' · ' + timeStr;

  // World clock
  if (_worldClockTz) {
    try {
      const wcTime = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit',
        timeZone: _worldClockTz
      });
      const wcEl = document.getElementById('worldClockTime');
      if (wcEl) wcEl.textContent = wcTime;
    } catch (e) {}
  }
}

function _buildTzList() {
  // Standard IANA timezone list
  return [
    'Africa/Cairo','Africa/Lagos','Africa/Nairobi','Africa/Johannesburg',
    'America/Anchorage','America/Chicago','America/Denver','America/Los_Angeles',
    'America/Mexico_City','America/New_York','America/Sao_Paulo','America/Toronto',
    'America/Vancouver','America/Phoenix',
    'Asia/Bangkok','Asia/Colombo','Asia/Dubai','Asia/Hong_Kong','Asia/Jakarta',
    'Asia/Karachi','Asia/Kolkata','Asia/Kuala_Lumpur','Asia/Manila','Asia/Seoul',
    'Asia/Shanghai','Asia/Singapore','Asia/Taipei','Asia/Tehran','Asia/Tokyo',
    'Asia/Vladivostok','Asia/Yangon',
    'Atlantic/Azores','Atlantic/Cape_Verde','Atlantic/Reykjavik',
    'Australia/Adelaide','Australia/Brisbane','Australia/Melbourne','Australia/Perth',
    'Australia/Sydney',
    'Europe/Amsterdam','Europe/Athens','Europe/Berlin','Europe/Brussels',
    'Europe/Budapest','Europe/Dublin','Europe/Helsinki','Europe/Istanbul',
    'Europe/Kiev','Europe/Lisbon','Europe/London','Europe/Madrid','Europe/Moscow',
    'Europe/Oslo','Europe/Paris','Europe/Prague','Europe/Rome','Europe/Stockholm',
    'Europe/Vienna','Europe/Warsaw','Europe/Zurich',
    'Pacific/Auckland','Pacific/Fiji','Pacific/Guam','Pacific/Honolulu',
    'Pacific/Midway','Pacific/Noumea','Pacific/Port_Moresby',
    'UTC'
  ];
}

async function initWorldClock() {
  var saved = await Storage.get('worldClock', null);
  if (saved) {
    _worldClockTz   = saved.tz || null;
    _worldClockName = saved.label || '🌍';
    var labelEl = document.getElementById('worldClockLabel');
    if (labelEl) labelEl.textContent = _worldClockName;
    var timeEl = document.getElementById('worldClockTime');
    if (timeEl && !_worldClockTz) timeEl.textContent = '--:--';
  }

  // Populate tz select
  var select = document.getElementById('wcTzSelect');
  if (select) {
    _buildTzList().forEach(function (tz) {
      var opt = document.createElement('option');
      opt.value = tz;
      opt.textContent = tz.replace(/_/g, ' ');
      if (tz === (_worldClockTz || 'UTC')) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // Config button opens modal
  var configBtn = document.getElementById('worldClockConfigBtn');
  var modal = document.getElementById('worldClockModal');
  if (configBtn && modal) {
    configBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      // Pre-fill
      var labelInput = document.getElementById('wcLabelInput');
      if (labelInput) labelInput.value = _worldClockName === '🌍' ? '' : _worldClockName;
      modal.style.display = 'flex';
    });
  }

  var cancelBtn = document.getElementById('wcModalCancel');
  if (cancelBtn && modal) {
    cancelBtn.addEventListener('click', function () { modal.style.display = 'none'; });
  }
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  var saveBtn = document.getElementById('wcModalSave');
  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      var labelInput = document.getElementById('wcLabelInput');
      var tzSelect   = document.getElementById('wcTzSelect');
      var label = (labelInput && labelInput.value.trim()) || (tzSelect ? tzSelect.value.split('/').pop().replace(/_/g,' ') : '🌍');
      var tz = tzSelect ? tzSelect.value : 'UTC';
      _worldClockTz   = tz;
      _worldClockName = label;
      var labelEl = document.getElementById('worldClockLabel');
      if (labelEl) labelEl.textContent = label;
      Storage.set('worldClock', { tz: tz, label: label });
      if (modal) modal.style.display = 'none';
      if (window.showToast) showToast('World clock set to ' + label + ' (' + tz + ') 🌍', 'success');
    });
  }
}

// ── Tab Navigation ───────────────────────────────────────────
function initTabs() {
  const navButtons = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.tab-panel');

  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const target = btn.dataset.tab;
      navButtons.forEach(function (b) { b.classList.remove('active'); });
      panels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + target);
      if (panel) panel.classList.add('active');
      const contentEl = document.getElementById('content');
      if (contentEl) contentEl.scrollTop = 0;

      // When returning to Journey, reset to mode-select unless timer is running
      if (target === 'journey') {
        const timerState = window.Timer ? window.Timer.getState() : null;
        if (!timerState || !timerState.isRunning) {
          const modeSelect = document.getElementById('journeyModeSelect');
          const timerView = document.getElementById('journeyTimerView');
          const pomPanel = document.getElementById('pomodoroPanel');
          if (modeSelect) modeSelect.style.display = 'flex';
          if (timerView) timerView.style.display = 'none';
          if (pomPanel) pomPanel.style.display = 'none';
        }
      }

      // Refresh data-heavy tabs when opened
      if (target === 'chronicle' && window.Chronicle) {
        window.Chronicle.renderChronicle();
      }
      if (target === 'profile' && window.Profile) {
        window.Profile.updateProfileStats();
      }
      if (target === 'grimoire' && window.Grimoire) {
        window.Grimoire.renderBoards();
        window.Grimoire.renderHabitList();
      }
      if (target === 'journal' && window.Journal) {
        window.Journal.renderEntryList();
      }

      Storage.set('lastTab', target);
    });
  });
}

async function restoreLastTab() {
  const last = await Storage.get('lastTab', 'journey');
  const btn = document.querySelector(`.nav-tab[data-tab="${last}"]`);
  if (btn) btn.click();
}

// ── Focus Mode ───────────────────────────────────────────────
let focusModeActive = false;

function toggleFocusMode() {
  focusModeActive = !focusModeActive;
  document.body.classList.toggle('focus-mode', focusModeActive);
  const overlay = document.getElementById('focusOverlay');
  if (overlay) overlay.style.display = focusModeActive ? 'block' : 'none';
  const btn = document.getElementById('focusModeBtn');
  if (btn) btn.textContent = focusModeActive ? '👁 Exit Focus' : '🧠 Focus Mode';

  const settings = window.AppSettings || {};
  if (settings.focusHidesSidebar) {
    const topNav = document.getElementById('topNav');
    if (topNav) topNav.style.display = focusModeActive ? 'none' : '';
  }
}

// ── Encouragement Messages ────────────────────────────────────
let encouragementIntervalId = null;

function startEncouragement() {
  stopEncouragement();
  const settings = window.AppSettings || {};
  if (!settings.encouragementMessages) return;

  encouragementIntervalId = setInterval(function () {
    const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    showToast(msg, 'info');
  }, 8 * 60 * 1000); // Every 8 minutes — frequent enough to be motivating, infrequent enough to not distract
}

function stopEncouragement() {
  if (encouragementIntervalId) {
    clearInterval(encouragementIntervalId);
    encouragementIntervalId = null;
  }
}

// ── Window Controls ───────────────────────────────────────────
function initWindowControls() {
  const minBtn = document.getElementById('btnMinimize');
  const maxBtn = document.getElementById('btnMaximize');
  const closeBtn = document.getElementById('btnClose');

  if (minBtn) {
    minBtn.addEventListener('click', function () {
      if (window.aureole) window.aureole.minimizeWindow();
    });
  }
  if (maxBtn) {
    maxBtn.addEventListener('click', function () {
      if (window.aureole) window.aureole.maximizeWindow();
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      if (window.aureole) window.aureole.closeWindow();
    });
  }
}

// ── Music Player (Spotify iFrame API) ─────────────────────────
function initMusicPlayer() {
  const loadBtn = document.getElementById('loadMusicBtn');
  const urlInput = document.getElementById('musicUrl');
  const spotifyFrame = document.getElementById('spotifyFrame');

  // Convert any Spotify web URL to the embed URL
  function toSpotifyEmbed(raw) {
    // Accept share links like https://open.spotify.com/track/ID?...
    var match = raw.match(/spotify\.com\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
    if (match) {
      return 'https://open.spotify.com/embed/' + match[1] + '/' + match[2] + '?utm_source=generator&theme=0';
    }
    // Already an embed URL?
    if (/open\.spotify\.com\/embed/.test(raw)) return raw;
    return null;
  }

  function loadMusic() {
    var raw = urlInput ? urlInput.value.trim() : '';
    if (!raw) {
      if (window.showToast) showToast('Please paste a Spotify URL.', 'error');
      return;
    }
    var embedUrl = toSpotifyEmbed(raw);
    if (!embedUrl) {
      if (window.showToast) showToast('Not a Spotify URL. Paste a track, album or playlist link.', 'error');
      return;
    }
    // Guard: only allow the Spotify embed origin we constructed
    if (!/^https:\/\/open\.spotify\.com\/embed\//.test(embedUrl)) {
      if (window.showToast) showToast('Invalid Spotify embed URL.', 'error');
      return;
    }
    if (spotifyFrame) {
      spotifyFrame.setAttribute('src', embedUrl);
      spotifyFrame.style.display = 'block';
    }
    Storage.set('musicUrl', raw);
    if (window.showToast) showToast('Spotify player loaded 🎵', 'success');
  }

  if (loadBtn) loadBtn.addEventListener('click', loadMusic);
  if (urlInput) {
    urlInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loadMusic();
    });
    urlInput.addEventListener('input', function () {
      Storage.set('musicUrl', this.value);
    });
  }

  // Restore saved URL
  Storage.get('musicUrl').then(function (savedUrl) {
    if (savedUrl && urlInput) {
      urlInput.value = savedUrl;
      var embedUrl = toSpotifyEmbed(savedUrl);
      if (embedUrl && spotifyFrame) {
        spotifyFrame.setAttribute('src', embedUrl);
        spotifyFrame.style.display = 'block';
      }
    }
  });
}

// ── Quick Notes ───────────────────────────────────────────────
function initQuickNotes() {
  const textarea = document.getElementById('quickNotes');
  const saveBtn = document.getElementById('saveNotes');

  // Load saved notes
  Storage.get('quickNotes', '').then(function (notes) {
    if (textarea) textarea.value = notes || '';
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      const notes = textarea ? textarea.value : '';
      await Storage.set('quickNotes', notes);
      showToast('Notes saved! 📝', 'success');
    });
  }

  // Auto-save on blur
  if (textarea) {
    textarea.addEventListener('blur', async function () {
      await Storage.set('quickNotes', this.value);
    });
  }
}

// ── Application Init ──────────────────────────────────────────
// ── Journey Mode Selection ────────────────────────────────────

// Which mode cards each subnav tab shows, and which to pre-select
const JMS_SUBNAVS = {
  solo:           { modes: ['working', 'studying'],                 defaultMode: 'working' },
  technique:      { modes: ['pomodoro', 'custom'],                  defaultMode: 'pomodoro' },
  'create-custom':{ modes: ['custom'],                              defaultMode: 'custom' }
};

let jmsCurrentSubnav = 'solo';

function jmsApplySubnav(subnav) {
  jmsCurrentSubnav = subnav;
  const config = JMS_SUBNAVS[subnav];
  if (!config) return;

  // Update subnav button active state
  document.querySelectorAll('.jms-subbtn[data-subnav]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.subnav === subnav);
  });

  // Show/hide mode cards
  document.querySelectorAll('.jms-card[data-mode]').forEach(function (c) {
    if (config.modes.includes(c.dataset.mode)) {
      c.classList.remove('jms-hidden');
    } else {
      c.classList.add('jms-hidden');
      c.classList.remove('selected');
    }
  });

  // Hide the separator if pomodoro is hidden
  const sep = document.querySelector('.jms-card-separator');
  if (sep) {
    // Show separator only when both 'normal' modes AND pomodoro are visible
    const hasPom = config.modes.includes('pomodoro');
    const hasNormal = config.modes.some(m => m !== 'pomodoro');
    sep.style.display = hasPom && hasNormal ? '' : 'none';
  }

  // Select default mode for this subnav
  jmsSelectMode(config.defaultMode);
}

const JMS_MODES = {
  working: {
    desc: 'Authentic deep work in a distraction-free session. Track your focused work time with full timer controls.',
    submodes: [
      { id: 60,       label: 'STANDARD',        detail: '1 hour session' },
      { id: 120,      label: 'DEEP WORK',        detail: '2 hour session' },
      { id: 30,       label: 'SPRINT',           detail: '30 minute session' },
      { id: 240,      label: 'MARATHON',         detail: '4 hour session' },
      { id: 'custom', label: 'CUSTOM DURATION',  detail: 'Set your own time' }
    ]
  },
  studying: {
    desc: 'Focused study session for academic work, reading, or skill-building. Build your arcane knowledge.',
    submodes: [
      { id: 60,       label: 'STANDARD',         detail: '1 hour session' },
      { id: 90,       label: 'EXAM PREP',        detail: '90 minute session' },
      { id: 120,      label: 'DEEP STUDY',       detail: '2 hour session' },
      { id: 30,       label: 'QUICK REVIEW',     detail: '30 minute session' },
      { id: 'custom', label: 'CUSTOM DURATION',  detail: 'Set your own time' }
    ]
  },
  custom: {
    desc: 'Design your own adventure. Set a custom label and duration for any type of focused activity.',
    submodes: [
      { id: 30,       label: 'SHORT',            detail: '30 minute session' },
      { id: 60,       label: 'MEDIUM',           detail: '1 hour session' },
      { id: 90,       label: 'LONG',             detail: '90 minute session' },
      { id: 'custom', label: 'CUSTOM DURATION',  detail: 'Set your own time' }
    ]
  },
  pomodoro: {
    desc: 'The Pomodoro Technique: work in focused sprints with structured breaks to maintain peak performance.',
    submodes: [
      { id: 'pom-classic', label: 'CLASSIC',      detail: '25 min work / 5 min break' },
      { id: 'pom-short',   label: 'SHORT SPRINT', detail: '15 min work / 3 min break' },
      { id: 'pom-long',    label: 'DEEP FOCUS',   detail: '50 min work / 10 min break' },
      { id: 'pom-custom',  label: 'CUSTOM',       detail: 'Set your own intervals' }
    ]
  }
};

let jmsState = { mode: 'working', subMode: 60 };

function jmsSelectMode(mode) {
  jmsState.mode = mode;
  var modeData = JMS_MODES[mode];
  jmsState.subMode = modeData && modeData.submodes.length > 0 ? modeData.submodes[0].id : 60;

  document.querySelectorAll('.jms-card[data-mode]').forEach(function (c) {
    c.classList.toggle('selected', c.dataset.mode === mode);
  });

  var descEl = document.getElementById('jmsDescText');
  if (descEl && modeData) descEl.textContent = modeData.desc;

  var submodesEl = document.getElementById('jmsSubmodes');
  if (submodesEl && modeData) {
    submodesEl.innerHTML = modeData.submodes.map(function (sm, i) {
      return '<div class="jms-submode' + (i === 0 ? ' selected' : '') + '" data-submode="' + sm.id + '">' +
        '<span class="jms-submode-diamond">◆</span>' +
        '<span class="jms-submode-label">' + sm.label + '</span>' +
        '<span class="jms-submode-detail">' + sm.detail + '</span>' +
        '</div>';
    }).join('');

    submodesEl.querySelectorAll('.jms-submode').forEach(function (el) {
      el.addEventListener('click', function () {
        submodesEl.querySelectorAll('.jms-submode').forEach(function (s) { s.classList.remove('selected'); });
        this.classList.add('selected');
        var raw = this.dataset.submode;
        var parsed = parseInt(raw, 10);
        jmsState.subMode = isNaN(parsed) ? raw : parsed;
      });
    });
  }
}

function jmsConfirm() {
  var mode = jmsState.mode;
  var subMode = jmsState.subMode;

  var modeSelect = document.getElementById('journeyModeSelect');
  var timerView = document.getElementById('journeyTimerView');
  if (modeSelect) modeSelect.style.display = 'none';
  if (timerView) timerView.style.display = 'flex';

  var modeNames = {
    working:  '⚔️ Work Session',
    studying: '📖 Study Session',
    custom:   '✨ Custom Session',
    pomodoro: '🍅 Pomodoro'
  };
  var labelEl = document.getElementById('journeyActiveModeLabel');
  if (labelEl) labelEl.textContent = modeNames[mode] || mode;

  var typeSelect = document.getElementById('timerTypeSelect');

  if (mode === 'pomodoro') {
    if (typeSelect) { typeSelect.value = 'working'; typeSelect.dispatchEvent(new Event('change')); }
    var pomWork = document.getElementById('pomWork');
    var pomBreak = document.getElementById('pomBreak');
    if (subMode === 'pom-short') {
      if (pomWork) pomWork.value = 15;
      if (pomBreak) pomBreak.value = 3;
    } else if (subMode === 'pom-long') {
      if (pomWork) pomWork.value = 50;
      if (pomBreak) pomBreak.value = 10;
    } else {
      if (pomWork) pomWork.value = 25;
      if (pomBreak) pomBreak.value = 5;
    }
    if (pomWork) pomWork.dispatchEvent(new Event('change'));
    if (pomBreak) pomBreak.dispatchEvent(new Event('change'));
    var pomPanel = document.getElementById('pomodoroPanel');
    if (pomPanel) pomPanel.style.display = 'block';
  } else {
    if (typeSelect) { typeSelect.value = mode; typeSelect.dispatchEvent(new Event('change')); }
    var durationMins = typeof subMode === 'number' ? subMode : parseInt(subMode, 10);
    if (!isNaN(durationMins) && durationMins > 0) {
      var hours = Math.floor(durationMins / 60);
      var mins = durationMins % 60;
      var hoursInput = document.getElementById('durationHours');
      var minsInput = document.getElementById('durationMinutes');
      if (hoursInput) hoursInput.value = hours;
      if (minsInput) minsInput.value = mins;
      var setBtn = document.getElementById('setDurationBtn');
      if (setBtn) setBtn.click();
    }
  }
}

function initModeSelection() {
  document.querySelectorAll('.jms-card[data-mode]').forEach(function (card) {
    card.addEventListener('click', function () { jmsSelectMode(this.dataset.mode); });
  });

  // Wire subnav tab buttons
  document.querySelectorAll('.jms-subbtn[data-subnav]').forEach(function (btn) {
    btn.addEventListener('click', function () { jmsApplySubnav(this.dataset.subnav); });
  });

  var confirmBtn = document.getElementById('jmsConfirmBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', jmsConfirm);

  var backBtn = document.getElementById('journeyBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      var modeSelect = document.getElementById('journeyModeSelect');
      var timerView = document.getElementById('journeyTimerView');
      var pomPanel = document.getElementById('pomodoroPanel');
      if (modeSelect) modeSelect.style.display = 'flex';
      if (timerView) timerView.style.display = 'none';
      if (pomPanel) pomPanel.style.display = 'none';
    });
  }

  // Render initial selected state with solo subnav
  jmsApplySubnav('solo');
}

// ── Nav Profile Mini-Widget ───────────────────────────────────

async function initNavProfile() {
  var profile = await Storage.get('profile', { name: 'Adventurer', avatarDataUrl: '' });
  var sessions = await Storage.get('chronicle', []);
  var totalSecs = sessions.reduce(function (sum, s) { return sum + (s.duration || 0); }, 0);
  var totalMins = Math.floor(totalSecs / 60);
  // XP level: same formula as profile.js — level n needs n*60 minutes
  var level = 1;
  var xpUsed = 0;
  while (totalMins >= xpUsed + level * 60) { xpUsed += level * 60; level++; }

  var nameEl = document.getElementById('navPfName');
  var levelEl = document.getElementById('navPfLevel');
  var avatarEl = document.getElementById('navPfAvatar');

  if (nameEl) nameEl.textContent = profile.name || 'Adventurer';
  if (levelEl) levelEl.textContent = level;
  if (avatarEl) {
    if (profile.avatarDataUrl) {
      avatarEl.src = profile.avatarDataUrl;
    } else {
      avatarEl.src = '../assets/frieren-default.gif';
    }
  }

  var widget = document.getElementById('navProfileWidget');
  if (widget && !widget._clickBound) {
    widget._clickBound = true;
    widget.addEventListener('click', function () {
      document.querySelectorAll('.nav-tab').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      var profilePanel = document.getElementById('tab-profile');
      if (profilePanel) profilePanel.classList.add('active');
      var contentEl = document.getElementById('content');
      if (contentEl) contentEl.scrollTop = 0;
      Storage.set('lastTab', 'profile');
      if (window.Profile) window.Profile.updateProfileStats();
    });
  }
}

// Expose so profile.js can call after save
window.refreshNavProfile = initNavProfile;

async function initApp() {
  // 0. Load custom assets (splash logo, thumbs-up) before anything else shows
  const [savedSplashLogo, savedThumbsUp] = await Promise.all([
    Storage.get('customSplashLogo'),
    Storage.get('customThumbsUp')
  ]);

  // Apply custom splash logo if set
  const splashLogoEl = document.getElementById('splashLogo');
  if (splashLogoEl && savedSplashLogo) {
    splashLogoEl.src = savedSplashLogo;
  }

  // Cache thumbs-up URL for use in showToast
  _thumbsUpUrl = savedThumbsUp || null;

  // 1. Load settings first (sets AppSettings global)
  await Settings.init();

  // 1b. Load custom sounds
  await SoundSystem.load();

  // 2. Initialize window chrome
  initWindowControls();

  // 3. Start clock + world clock
  updateClock();
  setInterval(updateClock, 1000);
  await initWorldClock();

  // 4. Particle system
  initParticles();
  const settings = window.AppSettings || {};
  if (settings.particleEffects !== false) {
    startParticles();
  }

  // 5. Initialize all feature modules
  await Reminders.init();
  Timer.init();
  Journal.init();
  Grimoire.init();
  Chronicle.init();
  Profile.init();

  // 6. Initialize music + quick notes + sounds
  initMusicPlayer();
  initQuickNotes();
  initSoundSettings();

  // 7. Mode selection + nav profile widget
  initModeSelection();
  await initNavProfile();

  // 8. Tab navigation
  initTabs();
  await restoreLastTab();

  // 9. Focus overlay click to exit
  const overlay = document.getElementById('focusOverlay');
  if (overlay) {
    overlay.addEventListener('click', function () {
      if (focusModeActive) toggleFocusMode();
    });
  }

  // 10. Splash logo upload
  const uploadSplashLogoEl = document.getElementById('uploadSplashLogo');
  if (uploadSplashLogoEl) {
    uploadSplashLogoEl.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (ev) {
        const dataUrl = ev.target.result;
        await Storage.set('customSplashLogo', dataUrl);
        if (window.showToast) showToast('Startup logo updated! ✨', 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  // 11. Thumbs-up upload
  const uploadThumbsUpEl = document.getElementById('uploadThumbsUp');
  if (uploadThumbsUpEl) {
    uploadThumbsUpEl.addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (ev) {
        const dataUrl = ev.target.result;
        _thumbsUpUrl = dataUrl;
        await Storage.set('customThumbsUp', dataUrl);
        if (window.showToast) showToast('Thumbs-up image updated! 👍', 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  // 12. Fade out splash screen — wait 2 s so startup GIF can fully play, then fade 0.7 s
  const splash = document.getElementById('splashScreen');
  if (splash) {
    setTimeout(function () {
      splash.classList.add('splash-fade');
      setTimeout(function () {
        splash.style.display = 'none';
      }, 700);
    }, 2000);
  }

  // 13. Debug panel
  initDebugPanel();
}

// Expose public API
window.App = {
  showToast: showToast,
  startParticles: startParticles,
  stopParticles: stopParticles,
  toggleFocusMode: toggleFocusMode,
  startEncouragement: startEncouragement,
  stopEncouragement: stopEncouragement
};

// ── Debug / Cheat Mode ────────────────────────────────────────
// Unlock: click the Settings heading (⚙️ Settings) 5 times within 3 seconds
(function () {
  var clicks = 0;
  var timer = null;
  var unlocked = false;

  function onHeadingClick() {
    clicks++;
    clearTimeout(timer);
    timer = setTimeout(function () { clicks = 0; }, 3000);
    if (clicks >= 5 && !unlocked) {
      unlocked = true;
      var tab = document.getElementById('debugTab');
      if (tab) tab.style.display = '';
      if (window.showToast) showToast('🐛 Debug Mode unlocked!', 'achievement');
    }
  }

  // Bind after DOM ready
  function bindDebugUnlock() {
    var h = document.getElementById('settingsHeading');
    if (h) h.addEventListener('click', onHeadingClick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDebugUnlock);
  } else {
    bindDebugUnlock();
  }
})();

function initDebugPanel() {
  // Helper to add a fake session
  async function addFakeSession(minutes, type) {
    var sessions = await Storage.get('chronicle', []);
    var now = Date.now();
    sessions.push({
      id: now,
      type: type,
      label: type.charAt(0).toUpperCase() + type.slice(1),
      duration: minutes * 60,
      date: new Date(now).toISOString().split('T')[0],
      startTime: new Date(now - minutes * 60000).toTimeString().slice(0, 5),
      endTime: new Date(now).toTimeString().slice(0, 5)
    });
    await Storage.set('chronicle', sessions);
    if (window.Profile) window.Profile.updateProfileStats();
    if (window.Chronicle) window.Chronicle.renderTable();
    showToast('Added ' + minutes + ' min ' + type + ' session ✅', 'success');
  }

  var addSessionBtn = document.getElementById('dbgAddSession');
  if (addSessionBtn) {
    addSessionBtn.addEventListener('click', function () {
      var mins = parseInt(document.getElementById('dbgAddMinutes').value) || 60;
      var type = document.getElementById('dbgSessionType').value;
      addFakeSession(mins, type);
    });
  }

  var bulkBtn = document.getElementById('dbgSetSessions');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', async function () {
      var count = parseInt(document.getElementById('dbgSessionCount').value) || 10;
      for (var i = 0; i < count; i++) {
        var sessions = await Storage.get('chronicle', []);
        var ts = Date.now() - i * 3600000;
        sessions.push({
          id: ts,
          type: 'working',
          label: 'Working',
          duration: 3600,
          date: new Date(ts).toISOString().split('T')[0],
          startTime: '00:00',
          endTime: '01:00'
        });
        await Storage.set('chronicle', sessions);
      }
      if (window.Profile) window.Profile.updateProfileStats();
      if (window.Chronicle) window.Chronicle.renderTable();
      showToast('Added ' + count + ' sessions ✅', 'success');
    });
  }

  var streakBtn = document.getElementById('dbgSetStreak');
  if (streakBtn) {
    streakBtn.addEventListener('click', async function () {
      var days = parseInt(document.getElementById('dbgStreakDays').value) || 7;
      var sessions = await Storage.get('chronicle', []);
      var today = new Date();
      for (var d = 0; d < days; d++) {
        var date = new Date(today);
        date.setDate(today.getDate() - d);
        var dateStr = date.toISOString().split('T')[0];
        // Only add if not already present for that day
        if (!sessions.some(function (s) { return s.date === dateStr; })) {
          sessions.push({
            id: date.getTime(),
            type: 'working',
            label: 'Working',
            duration: 3600,
            date: dateStr,
            startTime: '10:00',
            endTime: '11:00'
          });
        }
      }
      await Storage.set('chronicle', sessions);
      if (window.Profile) window.Profile.updateProfileStats();
      showToast('Streak set to ' + days + ' days ✅', 'success');
    });
  }

  var unlockAllBtn = document.getElementById('dbgUnlockAll');
  if (unlockAllBtn) {
    unlockAllBtn.addEventListener('click', async function () {
      if (window.Achievements && window.Achievements.ACHIEVEMENTS) {
        var data = {};
        window.Achievements.ACHIEVEMENTS.forEach(function (a) {
          data[a.id] = true;
        });
        await Storage.set('achievements', data);
        if (window.Profile) window.Profile.updateProfileStats();
        showToast('All achievements unlocked! 🏆', 'achievement');
      }
    });
  }

  var bellBtn = document.getElementById('dbgTriggerBell');
  if (bellBtn) {
    bellBtn.addEventListener('click', function () {
      if (window.Timer && window.Timer.showBellOverlay) {
        window.Timer.showBellOverlay();
      } else {
        var bellOverlay = document.getElementById('bellOverlay');
        if (bellOverlay) bellOverlay.style.display = 'flex';
      }
      showToast('Bell triggered! 🔔', 'info');
    });
  }

  var tSuccess = document.getElementById('dbgToastSuccess');
  if (tSuccess) tSuccess.addEventListener('click', function () { showToast('Test success toast!', 'success'); });
  var tError = document.getElementById('dbgToastError');
  if (tError) tError.addEventListener('click', function () { showToast('Test error toast!', 'error'); });
  var tAchieve = document.getElementById('dbgToastAchieve');
  if (tAchieve) tAchieve.addEventListener('click', function () { showToast('Test achievement toast! 🏆', 'achievement'); });

  var clearChronicleBtn = document.getElementById('dbgClearChronicle');
  if (clearChronicleBtn) {
    clearChronicleBtn.addEventListener('click', async function () {
      if (!confirm('Clear all session data?')) return;
      await Storage.set('chronicle', []);
      if (window.Profile) window.Profile.updateProfileStats();
      if (window.Chronicle) window.Chronicle.renderTable();
      showToast('Chronicle cleared.', 'info');
    });
  }

  var clearAchBtn = document.getElementById('dbgClearAchievements');
  if (clearAchBtn) {
    clearAchBtn.addEventListener('click', async function () {
      if (!confirm('Clear all achievements?')) return;
      await Storage.set('achievements', {});
      if (window.Profile) window.Profile.updateProfileStats();
      showToast('Achievements cleared.', 'info');
    });
  }
}

// Boot on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
