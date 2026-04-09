// Aureole Timer — Journey Timer Logic

const Timer = (function () {
  const state = {
    isRunning: false,
    isPaused: false,
    startTime: null,
    endTime: null,
    elapsed: 0,
    totalDuration: 0,
    sessionType: 'working',
    sessionLabel: 'Working',
    intervalId: null,
    sessionStartTimestamp: null,
    lastBreakReminder: 0
  };

  // Pomodoro state
  const pomodoro = {
    isRunning: false,
    isPaused: false,
    intervalId: null,
    workDuration: 25,
    breakDuration: 5,
    currentPhase: 'work',
    remaining: 25 * 60,
    sessions: 0
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function formatTimeShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  function updateDisplay() {
    const display = document.getElementById('timerDisplay');
    const timeLeftEl = document.getElementById('timeLeft');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');

    if (display) display.textContent = formatTime(state.elapsed);

    if (state.totalDuration > 0) {
      const remaining = Math.max(0, state.totalDuration - state.elapsed);
      if (timeLeftEl) timeLeftEl.textContent = 'Time Left: ' + formatTime(remaining);

      const percent = Math.min(100, (state.elapsed / state.totalDuration) * 100);
      if (progressFill) progressFill.style.width = percent + '%';
      if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';
      updateWalkerPosition(percent);

      if (state.elapsed >= state.totalDuration && state.isRunning) {
        timerComplete();
      }
    } else {
      if (timeLeftEl) timeLeftEl.textContent = 'Time Left: --:--:--';
      if (progressFill) progressFill.style.width = '0%';
      if (progressPercent) progressPercent.textContent = '0%';
      updateWalkerPosition(0);
    }

    // Time blindness helper — update document title
    const settings = window.AppSettings || {};
    if (settings.timeBlindenessHelper && state.isRunning) {
      const pct = state.totalDuration > 0
        ? Math.round((state.elapsed / state.totalDuration) * 100) + '% — '
        : '';
      document.title = '[' + formatTime(state.elapsed) + '] ' + pct + 'Aureole Timer';
    }
  }

  function updateWalkerPosition(percent) {
    const walker = document.getElementById('progressWalker');
    if (walker) {
      walker.style.left = 'calc(' + percent + '% - 16px)';
    }
  }

  function startTimer() {
    if (state.isRunning && !state.isPaused) return;

    if (state.isPaused) {
      state.isPaused = false;
      state.isRunning = true;
    } else {
      if (state.isRunning) return;
      state.isRunning = true;
      state.isPaused = false;
      state.elapsed = 0;
      state.sessionStartTimestamp = Date.now();
      state.lastBreakReminder = 0;
    }

    state.intervalId = setInterval(function () {
      state.elapsed++;
      updateDisplay();
      checkBreakReminder();
    }, 1000);

    updateButtonStates();
    if (window.App) window.App.startEncouragement();
  }

  function pauseTimer() {
    if (state.isPaused) {
      startTimer();
      return;
    }
    if (!state.isRunning) return;
    state.isPaused = true;
    state.isRunning = false;
    clearInterval(state.intervalId);
    state.intervalId = null;
    updateButtonStates();
    if (window.App) window.App.stopEncouragement();
  }

  function stopTimer() {
    if (!state.isRunning && !state.isPaused && state.elapsed === 0) return;
    clearInterval(state.intervalId);
    state.intervalId = null;

    const duration = state.elapsed;
    if (duration > 10) {
      saveSession(duration);
    }

    state.isRunning = false;
    state.isPaused = false;
    state.elapsed = 0;
    state.sessionStartTimestamp = null;

    updateDisplay();
    updateButtonStates();
    if (window.App) window.App.stopEncouragement();
    document.title = 'Aureole Timer';
  }

  function resetTimer() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;
    state.isPaused = false;
    state.elapsed = 0;
    state.sessionStartTimestamp = null;

    updateDisplay();
    updateButtonStates();
    if (window.App) window.App.stopEncouragement();
    document.title = 'Aureole Timer';
  }

  async function saveSession(duration) {
    const now = new Date();
    const notesEl = document.getElementById('quickNotes');
    const session = {
      id: Date.now().toString(),
      date: now.toISOString().split('T')[0],
      type: state.sessionType,
      label: state.sessionLabel,
      duration: duration,
      startTimestamp: state.sessionStartTimestamp,
      endTimestamp: Date.now(),
      notes: notesEl ? notesEl.value : ''
    };

    await Storage.update('chronicle', function (sessions) {
      if (!Array.isArray(sessions)) sessions = [];
      sessions.push(session);
      return sessions;
    }, []);

    // Detect special achievements
    const specialStats = {};
    const hour = now.getHours();
    if (hour === 0 || hour === 1 || hour === 2 || hour === 3) {
      specialStats.night_owl = true;
    }
    if (hour >= 4 && hour < 6) {
      specialStats.early_bird = true;
    }

    // Check today total for full_day achievement
    const allSessions = await Storage.get('chronicle', []);
    const today = session.date;
    const todayTotal = allSessions
      .filter(function (s) { return s.date === today; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);
    const FULL_DAY_SECONDS = 8 * 60 * 60; // 8 hours in seconds
    if (todayTotal >= FULL_DAY_SECONDS) specialStats.full_day = true;

    // Compute aggregate stats
    const totalWork = allSessions
      .filter(function (s) { return s.type === 'working'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);
    const totalStudy = allSessions
      .filter(function (s) { return s.type === 'studying'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);
    const totalSessions = allSessions.length;

    const streak = window.Chronicle
      ? window.Chronicle.calculateStreak(allSessions)
      : 0;

    if (window.Achievements) {
      await window.Achievements.checkAchievements(Object.assign({
        totalWork: totalWork,
        totalStudy: totalStudy,
        totalSessions: totalSessions,
        streak: streak
      }, specialStats));
    }

    if (window.Chronicle) window.Chronicle.renderChronicle();
    if (window.Profile) window.Profile.updateProfileStats();

    const settings = window.AppSettings || {};
    if (settings.autoSaveSessions !== false) {
      if (window.showToast) window.showToast('Session saved to Chronicle! ✨', 'success');
    }

    if (settings.timerCompleteNotif && window.aureole) {
      window.aureole.showNotification(
        'Session Complete!',
        'Great work! ' + session.label + ' session: ' + formatTime(duration)
      );
    }
  }

  function checkBreakReminder() {
    const settings = window.AppSettings || {};
    if (!settings.breakReminders) return;
    const interval = (settings.breakReminderInterval || 30) * 60;
    if (interval <= 0) return;
    if (state.elapsed > 0 && state.elapsed % interval === 0 && state.elapsed !== state.lastBreakReminder) {
      state.lastBreakReminder = state.elapsed;
      if (window.showToast) window.showToast('🌿 Time for a short break! You\'ve earned it.', 'info');
      if (window.aureole && settings.desktopNotifications) {
        window.aureole.showNotification('Break Time! 🌿', 'You\'ve been working hard. Time for a short break!');
      }
    }
  }

  function timerComplete() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;

    const duration = state.elapsed;
    saveSession(duration);

    state.elapsed = 0;
    state.isPaused = false;
    state.sessionStartTimestamp = null;

    updateDisplay();
    updateButtonStates();
    document.title = 'Aureole Timer';
    if (window.App) window.App.stopEncouragement();
    if (window.showToast) window.showToast('✨ Session complete! Amazing work!', 'success');
  }

  function applyManualTimes() {
    const startInput = document.getElementById('startTimeInput');
    const endInput = document.getElementById('endTimeInput');
    if (!startInput || !endInput || !startInput.value || !endInput.value) {
      if (window.showToast) window.showToast('Please set both start and end times.', 'error');
      return;
    }

    const parts1 = startInput.value.split(':').map(Number);
    const parts2 = endInput.value.split(':').map(Number);
    let startSec = parts1[0] * 3600 + parts1[1] * 60;
    let endSec = parts2[0] * 3600 + parts2[1] * 60;
    if (endSec <= startSec) endSec += 86400;

    state.totalDuration = endSec - startSec;

    const startLabel = document.getElementById('progressStart');
    const endLabel = document.getElementById('progressEnd');
    if (startLabel) startLabel.textContent = startInput.value;
    if (endLabel) endLabel.textContent = endInput.value;

    updateDisplay();
    if (window.showToast) {
      window.showToast('Timer set: ' + Math.round(state.totalDuration / 60) + ' minutes', 'info');
    }
  }

  function updateButtonStates() {
    const startBtn = document.getElementById('timerStart');
    const pauseBtn = document.getElementById('timerPause');
    const stopBtn = document.getElementById('timerStop');
    const resetBtn = document.getElementById('timerReset');

    if (startBtn) {
      startBtn.disabled = state.isRunning && !state.isPaused;
    }
    if (pauseBtn) {
      pauseBtn.disabled = !state.isRunning && !state.isPaused;
      pauseBtn.textContent = state.isPaused ? '▶ Resume' : '⏸ Pause';
    }
    if (stopBtn) {
      stopBtn.disabled = !state.isRunning && !state.isPaused;
    }
    if (resetBtn) {
      resetBtn.disabled = state.elapsed === 0 && !state.isRunning && !state.isPaused;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Pomodoro
  // ──────────────────────────────────────────────────────────

  function updatePomodoroDisplay() {
    const displayEl = document.getElementById('pomodoroDisplay');
    const statusEl = document.getElementById('pomodoroStatus');
    const sessionsEl = document.getElementById('pomSessions');

    if (displayEl) displayEl.textContent = formatTimeShort(pomodoro.remaining);
    if (statusEl) statusEl.textContent = pomodoro.currentPhase === 'work' ? 'Work Session' : 'Break Time';
    if (sessionsEl) sessionsEl.textContent = pomodoro.sessions;
  }

  function startPomodoro() {
    if (pomodoro.isRunning) return;
    pomodoro.isRunning = true;
    pomodoro.isPaused = false;

    pomodoro.intervalId = setInterval(function () {
      pomodoro.remaining--;
      if (pomodoro.remaining <= 0) {
        phaseComplete();
      }
      updatePomodoroDisplay();
    }, 1000);
  }

  function resetPomodoro() {
    clearInterval(pomodoro.intervalId);
    pomodoro.intervalId = null;
    pomodoro.isRunning = false;
    pomodoro.isPaused = false;
    pomodoro.currentPhase = 'work';

    const workInput = document.getElementById('pomWork');
    const breakInput = document.getElementById('pomBreak');
    pomodoro.workDuration = parseInt((workInput && workInput.value) || 25, 10);
    pomodoro.breakDuration = parseInt((breakInput && breakInput.value) || 5, 10);
    pomodoro.remaining = pomodoro.workDuration * 60;
    pomodoro.sessions = 0;
    updatePomodoroDisplay();
  }

  async function phaseComplete() {
    clearInterval(pomodoro.intervalId);
    pomodoro.intervalId = null;
    pomodoro.isRunning = false;

    if (pomodoro.currentPhase === 'work') {
      pomodoro.sessions++;
      if (window.showToast) window.showToast('🍅 Work session done! Time for a break!', 'success');
      if (window.aureole) window.aureole.showNotification('Pomodoro Done!', 'Work session complete. Take a break!');

      // After 4 sessions, long break
      const isLongBreak = pomodoro.sessions % 4 === 0;
      pomodoro.currentPhase = 'break';
      pomodoro.remaining = isLongBreak
        ? pomodoro.breakDuration * 3 * 60
        : pomodoro.breakDuration * 60;

      if (pomodoro.sessions === 1) {
        // First pomodoro achievement
        if (window.Achievements) {
          await window.Achievements.checkAchievements({ first_pomodoro: true });
        }
      }
    } else {
      if (window.showToast) window.showToast('⚡ Break over! Back to work!', 'info');
      if (window.aureole) window.aureole.showNotification('Break Over!', 'Time to focus again!');
      pomodoro.currentPhase = 'work';
      const workInput = document.getElementById('pomWork');
      pomodoro.workDuration = parseInt((workInput && workInput.value) || 25, 10);
      pomodoro.remaining = pomodoro.workDuration * 60;
    }

    updatePomodoroDisplay();
    // Auto-start next phase
    startPomodoro();
  }

  function initPomodoroControls() {
    const pomodoroBtn = document.getElementById('pomodoroBtn');
    const closePomodoroBtn = document.getElementById('closePomodoroBtn');
    const pomPanel = document.getElementById('pomodoroPanel');
    const pomStartBtn = document.getElementById('pomStart');
    const pomResetBtn = document.getElementById('pomReset');

    if (pomodoroBtn && pomPanel) {
      pomodoroBtn.addEventListener('click', function () {
        pomPanel.style.display = pomPanel.style.display === 'none' ? 'block' : 'none';
      });
    }
    if (closePomodoroBtn && pomPanel) {
      closePomodoroBtn.addEventListener('click', function () {
        pomPanel.style.display = 'none';
      });
    }
    if (pomStartBtn) {
      pomStartBtn.addEventListener('click', function () {
        if (pomodoro.isRunning) {
          clearInterval(pomodoro.intervalId);
          pomodoro.intervalId = null;
          pomodoro.isRunning = false;
          pomStartBtn.textContent = '▶ Start';
        } else {
          startPomodoro();
          pomStartBtn.textContent = '⏸ Pause';
        }
      });
    }
    if (pomResetBtn) {
      pomResetBtn.addEventListener('click', function () {
        resetPomodoro();
        const pomStartBtn2 = document.getElementById('pomStart');
        if (pomStartBtn2) pomStartBtn2.textContent = '▶ Start';
      });
    }

    const workInput = document.getElementById('pomWork');
    const breakInput = document.getElementById('pomBreak');
    if (workInput) {
      workInput.addEventListener('change', function () {
        pomodoro.workDuration = parseInt(this.value, 10);
        if (!pomodoro.isRunning && pomodoro.currentPhase === 'work') {
          pomodoro.remaining = pomodoro.workDuration * 60;
          updatePomodoroDisplay();
        }
      });
    }
    if (breakInput) {
      breakInput.addEventListener('change', function () {
        pomodoro.breakDuration = parseInt(this.value, 10);
        if (!pomodoro.isRunning && pomodoro.currentPhase === 'break') {
          pomodoro.remaining = pomodoro.breakDuration * 60;
          updatePomodoroDisplay();
        }
      });
    }

    updatePomodoroDisplay();
  }

  async function loadCustomImages() {
    const customBg = await Storage.get('customBg');
    if (customBg) {
      const bgOverlay = document.getElementById('timerBgOverlay');
      if (bgOverlay) {
        bgOverlay.style.backgroundImage = 'url(' + customBg + ')';
        bgOverlay.style.backgroundSize = 'cover';
        bgOverlay.style.backgroundPosition = 'center';
      }
    }

    const customWalker = await Storage.get('customWalker');
    const walkerImg = document.getElementById('walkerImg');
    if (walkerImg) {
      walkerImg.src = customWalker || window.DEFAULT_WALKER_SVG;
    }
  }

  function init() {
    const startBtn = document.getElementById('timerStart');
    const pauseBtn = document.getElementById('timerPause');
    const stopBtn = document.getElementById('timerStop');
    const resetBtn = document.getElementById('timerReset');
    const applyBtn = document.getElementById('applyTimesBtn');
    const typeSelect = document.getElementById('timerTypeSelect');
    const customLabelInput = document.getElementById('customTimerLabel');
    const uploadBg = document.getElementById('uploadBg');
    const uploadWalker = document.getElementById('uploadWalker');
    const focusModeBtn = document.getElementById('focusModeBtn');

    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseTimer);
    if (stopBtn) stopBtn.addEventListener('click', stopTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    if (applyBtn) applyBtn.addEventListener('click', applyManualTimes);

    if (typeSelect) {
      typeSelect.addEventListener('change', function () {
        state.sessionType = this.value;
        if (this.value === 'custom') {
          if (customLabelInput) customLabelInput.style.display = 'inline-block';
          state.sessionLabel = (customLabelInput && customLabelInput.value) || 'Custom';
        } else {
          if (customLabelInput) customLabelInput.style.display = 'none';
          state.sessionLabel = this.value === 'working' ? 'Working' : 'Studying';
        }
        // Apply default duration from settings
        const settings = window.AppSettings || {};
        if (this.value === 'working' && settings.defaultWorkDuration) {
          state.totalDuration = settings.defaultWorkDuration * 60;
        } else if (this.value === 'studying' && settings.defaultStudyDuration) {
          state.totalDuration = settings.defaultStudyDuration * 60;
        }
        updateDisplay();
      });
    }

    if (customLabelInput) {
      customLabelInput.addEventListener('input', function () {
        state.sessionLabel = this.value || 'Custom';
      });
    }

    if (uploadBg) {
      uploadBg.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (ev) {
          const dataUrl = ev.target.result;
          const bgOverlay = document.getElementById('timerBgOverlay');
          if (bgOverlay) {
            bgOverlay.style.backgroundImage = 'url(' + dataUrl + ')';
            bgOverlay.style.backgroundSize = 'cover';
            bgOverlay.style.backgroundPosition = 'center';
          }
          await Storage.set('customBg', dataUrl);
          if (window.showToast) window.showToast('Background updated! 🖼', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    if (uploadWalker) {
      uploadWalker.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (ev) {
          const dataUrl = ev.target.result;
          const walkerImg = document.getElementById('walkerImg');
          if (walkerImg) walkerImg.src = dataUrl;
          await Storage.set('customWalker', dataUrl);
          if (window.showToast) window.showToast('Walker updated! 🧝', 'success');
        };
        reader.readAsDataURL(file);
      });
    }

    if (focusModeBtn) {
      focusModeBtn.addEventListener('click', function () {
        if (window.App) window.App.toggleFocusMode();
      });
    }

    loadCustomImages();
    updateButtonStates();
    updateDisplay();
    initPomodoroControls();

    // Set default duration from settings
    const settings = window.AppSettings || {};
    if (settings.defaultWorkDuration) {
      state.totalDuration = (settings.defaultWorkDuration || 60) * 60;
    }
  }

  function getState() { return state; }

  return {
    init: init,
    start: startTimer,
    pause: pauseTimer,
    stop: stopTimer,
    reset: resetTimer,
    applyManualTimes: applyManualTimes,
    getState: getState
  };
})();

window.Timer = Timer;
