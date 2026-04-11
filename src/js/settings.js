// Frieren Chronomark — Settings Module

const DEFAULT_SETTINGS = {
  // Appearance
  accentColor: '#7c5cbf',
  secondaryColor: '#3d8b7a',
  bgColor: '#050510',
  fontSize: 14,
  particleEffects: true,
  borderAnimations: true,
  sidebarWidth: 220,
  progressBarStyle: 'mana',
  // Animation
  bgEffect: 'particles',    // 'particles' | 'sparkles' | 'matrix' | 'starfield' | 'aurora' | 'none'
  tabTransition: 'slide',   // 'slide' | 'fade' | 'zoom' | 'none'
  uiAnimations: true,       // master toggle: ripples, hover lifts, pop-ins
  // Timer
  defaultWorkDuration: 60,
  defaultStudyDuration: 90,
  autoSaveSessions: true,
  timerSounds: true,
  breakReminderInterval: 30,
  customTimerLabels: [],
  // Notifications
  desktopNotifications: true,
  timerCompleteNotif: true,
  breakReminders: true,
  dailyReminder: true,
  dailyReminderTime: '09:00',
  uiScale: 1.0,
  autoPomodoro: false,
  focusHidesSidebar: true,
  hyperfocusTimer: 120,
  progressPulse: true,
  timeBlindenessHelper: true,
  encouragementMessages: true
};

// Companion (3D character) settings stored separately for clarity
const DEFAULT_COMPANION = {
  model: 'model1',
  visible: false,
  waistFraction: 0.68,       // camera frame bottom (fraction of skeleton height)
  headFraction: 1.12,        // camera frame top
  fov: 52,                   // camera field-of-view
  zoomFactor: 1.0,           // extra zoom multiplier
  cameraXOffset: 0,          // horizontal camera shift
  cameraYOffset: 0.08,       // vertical camera shift
  sizePreset: 'medium',      // 'small' | 'medium' | 'large' | 'xlarge' | 'custom'
  width: 340,
  height: 370,
};

const COMPANION_SIZE_PRESETS = {
  small:  [280, 310],
  medium: [340, 370],
  large:  [420, 460],
  xlarge: [520, 560],
};

const Settings = (function () {
  let current = Object.assign({}, DEFAULT_SETTINGS);

  async function loadSettings() {
    const saved = await Storage.get('settings', DEFAULT_SETTINGS);
    current = Object.assign({}, DEFAULT_SETTINGS, saved);
    window.AppSettings = current;
    return current;
  }

  async function saveSettings() {
    await Storage.set('settings', current);
    window.AppSettings = current;
    applySettings();
    if (window.showToast) window.showToast('Settings saved! ⚙️', 'success');
  }

  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--accent', current.accentColor || '#7c5cbf');
    root.style.setProperty('--accent-hover', lightenColor(current.accentColor || '#7c5cbf', 20));
    root.style.setProperty('--accent-glow', hexToRgba(current.accentColor || '#7c5cbf', 0.4));
    root.style.setProperty('--secondary', current.secondaryColor || '#3d8b7a');
    root.style.setProperty('--bg-base', current.bgColor || '#050510');
    root.style.setProperty('--font-size', (current.fontSize || 14) + 'px');
    root.style.setProperty('--sidebar-width', (current.sidebarWidth || 220) + 'px');

    document.body.style.fontSize = (current.fontSize || 14) + 'px';

    // UI zoom/scale
    const scale = current.uiScale || 1.0;
    document.documentElement.style.zoom = scale;

    // UI animations master toggle
    document.body.classList.toggle('no-ui-animations', current.uiAnimations === false);

    // Particle effects / background effect
    if (window.Animations) {
      if (current.particleEffects !== false) {
        Animations.applyBgEffect(current.bgEffect || 'particles');
      } else {
        Animations.stopBgEffect();
      }
    } else if (window.App) {
      if (current.particleEffects) {
        window.App.startParticles();
      } else {
        window.App.stopParticles();
      }
    }

    // Border animations
    const journeyFrame = document.querySelector('.journey-frame');
    if (journeyFrame) {
      if (current.borderAnimations) {
        journeyFrame.classList.remove('no-animation');
      } else {
        journeyFrame.classList.add('no-animation');
      }
    }

    // Progress bar style
    applyProgressBarStyle(current.progressBarStyle || 'mana');
  }

  function applyProgressBarStyle(style) {
    const container = document.getElementById('progressContainer');
    if (!container) return;
    const allowed = ['bar', 'doughnut', 'hourglass', 'mana'];
    const safeStyle = allowed.includes(style) ? style : 'mana';
    container.dataset.style = safeStyle;
    // Notify timer module so it can update its alternative display elements
    if (window.Timer && window.Timer.applyProgressStyle) {
      window.Timer.applyProgressStyle(safeStyle);
    }
  }

  function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgba(124,92,191,' + alpha + ')';
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function lightenColor(hex, amount) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;
    const r = Math.min(255, parseInt(result[1], 16) + amount);
    const g = Math.min(255, parseInt(result[2], 16) + amount);
    const b = Math.min(255, parseInt(result[3], 16) + amount);
    return '#' + [r, g, b].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  function populateForm() {
    const fields = {
      'accentColor': current.accentColor,
      'secondaryColor': current.secondaryColor,
      'bgColor': current.bgColor,
      'fontSize': current.fontSize,
      'uiScale': current.uiScale,
      'particleEffects': current.particleEffects,
      'borderAnimations': current.borderAnimations,
      'sidebarWidth': current.sidebarWidth,
      'progressBarStyle': current.progressBarStyle,
      'bgEffect': current.bgEffect,
      'tabTransition': current.tabTransition,
      'uiAnimations': current.uiAnimations,
      'defaultWorkDuration': current.defaultWorkDuration,
      'defaultStudyDuration': current.defaultStudyDuration,
      'autoSaveSessions': current.autoSaveSessions,
      'timerSounds': current.timerSounds,
      'breakReminderInterval': current.breakReminderInterval,
      'desktopNotifications': current.desktopNotifications,
      'timerCompleteNotif': current.timerCompleteNotif,
      'breakReminders': current.breakReminders,
      'dailyReminder': current.dailyReminder,
      'dailyReminderTime': current.dailyReminderTime,
      'autoPomodoro': current.autoPomodoro,
      'focusHidesSidebar': current.focusHidesSidebar,
      'hyperfocusTimer': current.hyperfocusTimer,
      'progressPulse': current.progressPulse,
      'timeBlindenessHelper': current.timeBlindenessHelper,
      'encouragementMessages': current.encouragementMessages
    };

    for (const [id, value] of Object.entries(fields)) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value;
      }
    }

    const fontSizeVal = document.getElementById('fontSizeVal');
    if (fontSizeVal) fontSizeVal.textContent = (current.fontSize || 14) + 'px';
    const uiScaleVal = document.getElementById('uiScaleVal');
    if (uiScaleVal) uiScaleVal.textContent = Math.round((current.uiScale || 1) * 100) + '%';
    const sidebarWidthVal = document.getElementById('sidebarWidthVal');
    if (sidebarWidthVal) sidebarWidthVal.textContent = (current.sidebarWidth || 220) + 'px';

    renderCustomLabels();
  }

  function readForm() {
    const fields = [
      'accentColor', 'secondaryColor', 'bgColor',
      'defaultWorkDuration', 'defaultStudyDuration', 'breakReminderInterval',
      'hyperfocusTimer', 'dailyReminderTime', 'sidebarWidth', 'fontSize', 'uiScale',
      'progressBarStyle', 'bgEffect', 'tabTransition'
    ];
    const checkboxes = [
      'particleEffects', 'borderAnimations', 'autoSaveSessions', 'timerSounds',
      'desktopNotifications', 'timerCompleteNotif', 'breakReminders',
      'dailyReminder', 'autoPomodoro', 'focusHidesSidebar', 'progressPulse',
      'timeBlindenessHelper', 'encouragementMessages', 'uiAnimations'
    ];

    for (const id of fields) {
      const el = document.getElementById(id);
      if (el) {
        const v = el.value;
        current[id] = (el.type === 'number' || el.type === 'range') ? Number(v) : v;
      }
    }
    for (const id of checkboxes) {
      const el = document.getElementById(id);
      if (el) current[id] = el.checked;
    }
  }

  function bindLiveUpdates() {
    const accentEl = document.getElementById('accentColor');
    const secondaryEl = document.getElementById('secondaryColor');
    const bgColorEl = document.getElementById('bgColor');
    const fontSizeEl = document.getElementById('fontSize');
    const sidebarWidthEl = document.getElementById('sidebarWidth');

    if (accentEl) {
      accentEl.addEventListener('input', function () {
        current.accentColor = this.value;
        document.documentElement.style.setProperty('--accent', this.value);
        document.documentElement.style.setProperty('--accent-hover', lightenColor(this.value, 20));
        document.documentElement.style.setProperty('--accent-glow', hexToRgba(this.value, 0.4));
      });
    }
    if (secondaryEl) {
      secondaryEl.addEventListener('input', function () {
        current.secondaryColor = this.value;
        document.documentElement.style.setProperty('--secondary', this.value);
      });
    }
    if (bgColorEl) {
      bgColorEl.addEventListener('input', function () {
        current.bgColor = this.value;
        document.documentElement.style.setProperty('--bg-base', this.value);
      });
    }
    if (fontSizeEl) {
      fontSizeEl.addEventListener('input', function () {
        current.fontSize = Number(this.value);
        document.documentElement.style.setProperty('--font-size', this.value + 'px');
        document.body.style.fontSize = this.value + 'px';
        const val = document.getElementById('fontSizeVal');
        if (val) val.textContent = this.value + 'px';
      });
    }
    const uiScaleEl = document.getElementById('uiScale');
    if (uiScaleEl) {
      uiScaleEl.addEventListener('input', function () {
        current.uiScale = Number(this.value);
        document.documentElement.style.zoom = current.uiScale;
        const val = document.getElementById('uiScaleVal');
        if (val) val.textContent = Math.round(current.uiScale * 100) + '%';
      });
    }
    if (sidebarWidthEl) {
      sidebarWidthEl.addEventListener('input', function () {
        current.sidebarWidth = Number(this.value);
        document.documentElement.style.setProperty('--sidebar-width', this.value + 'px');
        const val = document.getElementById('sidebarWidthVal');
        if (val) val.textContent = this.value + 'px';
      });
    }

    const progressBarStyleEl = document.getElementById('progressBarStyle');
    if (progressBarStyleEl) {
      progressBarStyleEl.addEventListener('change', function () {
        current.progressBarStyle = this.value;
        applyProgressBarStyle(this.value);
      });
    }

    const bgEffectEl = document.getElementById('bgEffect');
    if (bgEffectEl) {
      bgEffectEl.addEventListener('change', function () {
        current.bgEffect = this.value;
        if (window.Animations) Animations.applyBgEffect(this.value);
      });
    }

    const tabTransEl = document.getElementById('tabTransition');
    if (tabTransEl) {
      tabTransEl.addEventListener('change', function () {
        current.tabTransition = this.value;
      });
    }

    const uiAnimEl = document.getElementById('uiAnimations');
    if (uiAnimEl) {
      uiAnimEl.addEventListener('change', function () {
        current.uiAnimations = this.checked;
        document.body.classList.toggle('no-ui-animations', !this.checked);
      });
    }
  }

  function renderCustomLabels() {
    const container = document.getElementById('customTimerLabelsList');
    if (!container) return;
    container.innerHTML = '';
    const labels = current.customTimerLabels || [];
    if (labels.length === 0) {
      container.innerHTML = '<p class="empty-state" style="font-size:0.8rem">No custom labels.</p>';
      return;
    }
    for (let i = 0; i < labels.length; i++) {
      const item = document.createElement('div');
      item.className = 'custom-label-item';
      item.innerHTML = `
        <span>${escapeHtml(labels[i])}</span>
        <button class="btn-icon btn-danger-icon" data-index="${i}" title="Remove">✕</button>
      `;
      item.querySelector('button').addEventListener('click', function () {
        current.customTimerLabels.splice(Number(this.dataset.index), 1);
        renderCustomLabels();
      });
      container.appendChild(item);
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  async function exportAllData() {
    const keys = ['chronicle', 'journal', 'spells', 'habits', 'achievements', 'profile', 'settings', 'reminders'];
    const data = {};
    for (const key of keys) {
      data[key] = await Storage.get(key);
    }
    data.exportedAt = new Date().toISOString();
    data.version = '1.0.0';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'frieren-chronomark-data-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('Data exported! 💾', 'success');
  }

  async function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (ev) {
      try {
        const data = JSON.parse(ev.target.result);
        const keys = ['chronicle', 'journal', 'spells', 'habits', 'achievements', 'profile', 'settings', 'reminders'];
        for (const key of keys) {
          if (data[key] !== undefined && data[key] !== null) {
            await Storage.set(key, data[key]);
          }
        }
        if (window.showToast) window.showToast('Data imported! Reloading... ✨', 'success');
        setTimeout(function () { location.reload(); }, 1200);
      } catch (e) {
        if (window.showToast) window.showToast('Import failed: invalid file.', 'error');
      }
    };
    reader.readAsText(file);
  }

  async function clearAllData() {
    if (!confirm('⚠️ This will permanently delete ALL your data (sessions, journal, tasks, achievements). Are you sure?')) return;
    const keys = ['chronicle', 'journal', 'spells', 'habits', 'achievements', 'profile', 'reminders', 'customBg', 'customWalker', 'customSplashLogo', 'customThumbsUp', 'musicUrl', 'lastDailyReminder'];
    for (const key of keys) {
      await Storage.remove(key);
    }
    if (window.showToast) window.showToast('All data cleared.', 'info');
    setTimeout(function () { location.reload(); }, 1000);
  }

  function initSettingsTabs() {
    const tabs = document.querySelectorAll('.settings-tab');
    const panels = document.querySelectorAll('.settings-panel');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        const target = document.getElementById('settings-' + tab.dataset.settings);
        if (target) target.classList.add('active');
        Storage.set('lastSettingsTab', tab.dataset.settings);
      });
    });
  }

  async function restoreLastTab() {
    const last = await Storage.get('lastSettingsTab', 'appearance');
    const tab = document.querySelector(`.settings-tab[data-settings="${last}"]`);
    if (tab) tab.click();
  }

  async function init() {
    await loadSettings();
    applySettings();
    populateForm();
    bindLiveUpdates();
    initSettingsTabs();
    await restoreLastTab();

    // Companion settings — load, populate, and bind controls
    const companionSaved = loadCompanionSettings();
    populateCompanionForm(companionSaved);
    bindCompanionControls();
    // Apply on startup (after a tick so FrierenCompanion is ready)
    setTimeout(function () { applyCompanionSettings(companionSaved); }, 250);

    // Save buttons
    document.querySelectorAll('#saveTimerSettings, #saveNotifSettings, #saveAdhdSettings').forEach(function (btn) {
      btn.addEventListener('click', function () {
        readForm();
        saveSettings();
      });
    });

    const resetAppearanceBtn = document.getElementById('resetAppearance');
    if (resetAppearanceBtn) {
      resetAppearanceBtn.addEventListener('click', async function () {
        const defaults = ['accentColor', 'secondaryColor', 'bgColor', 'fontSize', 'particleEffects', 'borderAnimations', 'sidebarWidth'];
        defaults.forEach(function (key) { current[key] = DEFAULT_SETTINGS[key]; });
        populateForm();
        applySettings();
        await saveSettings();
      });
    }

    const exportBtn = document.getElementById('exportAllData');
    if (exportBtn) exportBtn.addEventListener('click', exportAllData);

    const importInput = document.getElementById('importData');
    if (importInput) {
      importInput.addEventListener('change', function (e) { importData(e.target.files[0]); });
    }

    const clearBtn = document.getElementById('clearAllData');
    if (clearBtn) clearBtn.addEventListener('click', clearAllData);

    const testNotifBtn = document.getElementById('testNotification');
    if (testNotifBtn) {
      testNotifBtn.addEventListener('click', function () {
        if (window.aureole) {
          window.aureole.showNotification('🔔 Test Notification', 'Frieren Chronomark notifications are working!');
        }
        if (window.showToast) window.showToast('Test notification sent! 🔔', 'success');
      });
    }

    const addLabelBtn = document.getElementById('addCustomLabel');
    if (addLabelBtn) {
      addLabelBtn.addEventListener('click', function () {
        const input = document.getElementById('newCustomLabel');
        const val = input && input.value.trim();
        if (val) {
          if (!current.customTimerLabels) current.customTimerLabels = [];
          current.customTimerLabels.push(val);
          renderCustomLabels();
          if (input) input.value = '';
        }
      });
    }
  }

  // ── Companion settings helpers ────────────────────────────────────────────
  function loadCompanionSettings() {
    try {
      const raw = localStorage.getItem('companionSettings');
      return raw ? Object.assign({}, DEFAULT_COMPANION, JSON.parse(raw)) : Object.assign({}, DEFAULT_COMPANION);
    } catch (e) {
      return Object.assign({}, DEFAULT_COMPANION);
    }
  }

  function saveCompanionSettings(cs) {
    localStorage.setItem('companionSettings', JSON.stringify(cs));
  }

  // ── AI Chat key helpers (stored separately from companion layout settings) ──
  function loadAiSettings() {
    try {
      const raw = localStorage.getItem('companionAiSettings');
      return raw ? JSON.parse(raw) : { provider: 'gemini', key: '' };
    } catch (e) {
      return { provider: 'gemini', key: '' };
    }
  }

  function saveAiSettings(provider, key) {
    localStorage.setItem('companionAiSettings', JSON.stringify({ provider, key }));
    // Notify companion module so it picks up the new key immediately
    if (window.FrierenCompanion && window.FrierenCompanion.reloadAiSettings) {
      window.FrierenCompanion.reloadAiSettings();
    }
  }

  function populateCompanionForm(cs) {
    const set = function (id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!val;
      else el.value = val;
    };
    set('companionModel', 'model1');
    set('companionVisible', cs.visible !== false);
    set('companionHeadFraction', cs.headFraction);
    set('companionWaistFraction', cs.waistFraction);
    set('companionFov', cs.fov);
    set('companionZoom', cs.zoomFactor);
    set('companionCameraX', cs.cameraXOffset);
    set('companionCameraY', cs.cameraYOffset);
    set('companionSizePreset', cs.sizePreset || 'medium');
    set('companionWidth', cs.width || 340);
    set('companionHeight', cs.height || 370);

    // AI Chat fields
    const aiSettings = loadAiSettings();
    set('companionAiProvider', aiSettings.provider || 'gemini');
    set('companionAiKey', aiSettings.key || '');

    updateCompanionSliderLabels(cs);

    const customRow = document.getElementById('companionCustomSizeRow');
    if (customRow) customRow.style.display = cs.sizePreset === 'custom' ? '' : 'none';
  }

  function updateCompanionSliderLabels(cs) {
    const lbl = function (id, val, suffix) {
      const el = document.getElementById(id);
      if (el) el.textContent = (typeof val === 'number' ? val.toFixed(2) : val) + (suffix || '');
    };
    lbl('companionHeadFractionVal', +cs.headFraction);
    lbl('companionWaistFractionVal', +cs.waistFraction);
    lbl('companionFovVal', Math.round(+cs.fov), '°');
    lbl('companionZoomVal', (+cs.zoomFactor).toFixed(2), '×');
    lbl('companionCameraXVal', (+cs.cameraXOffset).toFixed(2));
    lbl('companionCameraYVal', (+cs.cameraYOffset).toFixed(2));
  }

  function readCompanionForm() {
    const get = function (id) { const el = document.getElementById(id); return el ? el.value : null; };
    const chk = function (id) { const el = document.getElementById(id); return el ? el.checked : true; };
    return {
      model:         'model1',
      visible:       chk('companionVisible'),
      headFraction:  parseFloat(get('companionHeadFraction')) || DEFAULT_COMPANION.headFraction,
      waistFraction: parseFloat(get('companionWaistFraction')) || DEFAULT_COMPANION.waistFraction,
      fov:           parseFloat(get('companionFov')) || DEFAULT_COMPANION.fov,
      zoomFactor:    parseFloat(get('companionZoom')) || DEFAULT_COMPANION.zoomFactor,
      cameraXOffset: parseFloat(get('companionCameraX')) || 0,
      cameraYOffset: parseFloat(get('companionCameraY')) || DEFAULT_COMPANION.cameraYOffset,
      sizePreset:    get('companionSizePreset') || 'medium',
      width:         parseInt(get('companionWidth'))  || 340,
      height:        parseInt(get('companionHeight')) || 370,
    };
  }

  function applyCompanionSettings(cs) {
    const companion = document.getElementById('frierenCompanion');
    if (!companion) return;

    // Visibility
    companion.style.display = cs.visible !== false ? '' : 'none';

    // Determine dimensions
    let w = cs.width || 340;
    let h = cs.height || 370;
    if (cs.sizePreset && COMPANION_SIZE_PRESETS[cs.sizePreset]) {
      [w, h] = COMPANION_SIZE_PRESETS[cs.sizePreset];
    }
    companion.style.width  = w + 'px';
    companion.style.height = h + 'px';

    // Model path — model2 has been removed; always use model1
    const glbPath = '../assets/vrchat_frieren.glb';

    // Apply to 3D character
    if (window.FrierenCompanion && window.FrierenCompanion.reconfigure) {
      window.FrierenCompanion.reconfigure({
        glbPath:       glbPath,
        waistFraction: cs.waistFraction,
        headFraction:  cs.headFraction,
        fov:           cs.fov,
        zoomFactor:    cs.zoomFactor,
        cameraXOffset: cs.cameraXOffset,
        cameraYOffset: cs.cameraYOffset,
      });
      if (window.FrierenCompanion.resize) {
        window.FrierenCompanion.resize(w, h);
      }
    }
  }

  function bindCompanionControls() {
    // Live label updates for sliders
    const sliderBindings = [
      ['companionHeadFraction',  'companionHeadFractionVal',  '', 2],
      ['companionWaistFraction', 'companionWaistFractionVal', '', 2],
      ['companionFov',           'companionFovVal',           '°', 0],
      ['companionZoom',          'companionZoomVal',          '×', 2],
      ['companionCameraX',       'companionCameraXVal',       '', 2],
      ['companionCameraY',       'companionCameraYVal',       '', 2],
    ];
    sliderBindings.forEach(function ([inputId, labelId, suffix, decimals]) {
      const el = document.getElementById(inputId);
      const lbl = document.getElementById(labelId);
      if (el && lbl) {
        el.addEventListener('input', function () {
          lbl.textContent = parseFloat(this.value).toFixed(decimals) + suffix;
        });
      }
    });

    // Size preset toggle
    const presetEl = document.getElementById('companionSizePreset');
    const customRow = document.getElementById('companionCustomSizeRow');
    if (presetEl && customRow) {
      presetEl.addEventListener('change', function () {
        customRow.style.display = this.value === 'custom' ? '' : 'none';
      });
    }

    // Preview button — applies without saving
    const previewBtn = document.getElementById('previewCompanionSettings');
    if (previewBtn) {
      previewBtn.addEventListener('click', function () {
        const cs = readCompanionForm();
        applyCompanionSettings(cs);
        if (window.showToast) window.showToast('Preview applied! 👁', 'info');
      });
    }

    // Save & Apply
    const saveBtn = document.getElementById('saveCompanionSettings');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        const cs = readCompanionForm();
        saveCompanionSettings(cs);
        applyCompanionSettings(cs);
        if (window.showToast) window.showToast('Companion settings saved! 🧝', 'success');
      });
    }

    // Reset defaults
    const resetBtn = document.getElementById('resetCompanionSettings');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        const def = Object.assign({}, DEFAULT_COMPANION);
        saveCompanionSettings(def);
        populateCompanionForm(def);
        applyCompanionSettings(def);
        if (window.showToast) window.showToast('Companion settings reset! ↺', 'info');
      });
    }

    // AI Chat — Save Key
    const saveAiBtn = document.getElementById('saveAiKey');
    if (saveAiBtn) {
      saveAiBtn.addEventListener('click', function () {
        const provider = (document.getElementById('companionAiProvider') || {}).value || 'gemini';
        const key = ((document.getElementById('companionAiKey') || {}).value || '').trim();
        saveAiSettings(provider, key);
        const statusEl = document.getElementById('aiKeyStatus');
        if (statusEl) {
          statusEl.style.color = 'var(--success, #4caf50)';
          statusEl.textContent = key ? '✔ Key saved.' : '✔ Key cleared.';
          setTimeout(function () { statusEl.textContent = ''; }, 3000);
        }
        if (window.showToast) window.showToast('AI key saved! 🤖', 'success');
      });
    }

    // AI Chat — Test Connection
    const testAiBtn = document.getElementById('testAiKey');
    if (testAiBtn) {
      testAiBtn.addEventListener('click', async function () {
        const provider = (document.getElementById('companionAiProvider') || {}).value || 'gemini';
        const key = ((document.getElementById('companionAiKey') || {}).value || '').trim();
        const statusEl = document.getElementById('aiKeyStatus');
        if (!key) {
          if (statusEl) { statusEl.style.color = 'var(--danger, #e05c72)'; statusEl.textContent = '✗ No key entered.'; }
          return;
        }
        testAiBtn.disabled = true;
        if (statusEl) { statusEl.style.color = 'var(--text-muted)'; statusEl.textContent = 'Testing…'; }
        try {
          await testAiConnection(provider, key);
          if (statusEl) { statusEl.style.color = 'var(--success, #4caf50)'; statusEl.textContent = '✔ Connection successful!'; }
        } catch (err) {
          if (statusEl) { statusEl.style.color = 'var(--danger, #e05c72)'; statusEl.textContent = '✗ ' + (err.message || 'Connection failed.'); }
        } finally {
          testAiBtn.disabled = false;
        }
      });
    }
  }

  async function testAiConnection(provider, key) {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error?.message || 'HTTP ' + res.status); }
    } else {
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }], generationConfig: { maxOutputTokens: 5 } }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error?.message || 'HTTP ' + res.status); }
    }
  }

  return {
    init: init,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    applySettings: applySettings,
    getCurrent: function () { return current; },
    getCompanionDefaults: function () { return Object.assign({}, DEFAULT_COMPANION); },
  };
})();

window.Settings = Settings;
