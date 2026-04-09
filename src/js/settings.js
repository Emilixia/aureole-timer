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
  // Focus/ADHD
  autoPomodoro: false,
  focusHidesSidebar: true,
  hyperfocusTimer: 120,
  progressPulse: true,
  timeBlindenessHelper: true,
  encouragementMessages: true
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

    // Particle effects
    if (window.App) {
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
      'particleEffects': current.particleEffects,
      'borderAnimations': current.borderAnimations,
      'sidebarWidth': current.sidebarWidth,
      'progressBarStyle': current.progressBarStyle,
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
    const sidebarWidthVal = document.getElementById('sidebarWidthVal');
    if (sidebarWidthVal) sidebarWidthVal.textContent = (current.sidebarWidth || 220) + 'px';

    renderCustomLabels();
  }

  function readForm() {
    const fields = [
      'accentColor', 'secondaryColor', 'bgColor',
      'defaultWorkDuration', 'defaultStudyDuration', 'breakReminderInterval',
      'hyperfocusTimer', 'dailyReminderTime', 'sidebarWidth', 'fontSize',
      'progressBarStyle'
    ];
    const checkboxes = [
      'particleEffects', 'borderAnimations', 'autoSaveSessions', 'timerSounds',
      'desktopNotifications', 'timerCompleteNotif', 'breakReminders',
      'dailyReminder', 'autoPomodoro', 'focusHidesSidebar', 'progressPulse',
      'timeBlindenessHelper', 'encouragementMessages'
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
    const keys = ['chronicle', 'journal', 'spells', 'habits', 'achievements', 'profile', 'reminders', 'customBg', 'customWalker', 'lastDailyReminder'];
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

  return {
    init: init,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    applySettings: applySettings,
    getCurrent: function () { return current; }
  };
})();

window.Settings = Settings;
