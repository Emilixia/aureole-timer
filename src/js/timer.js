// Frieren Chronomark — Journey Timer Logic

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
    lastBreakReminder: 0,
    tenMinWarnFired: false,
    oneMinWarnFired: false
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

  // ── Alternative progress bar state ──────────────────────────
  let manaSparkleAnimId = null;
  let manaSparkles = [];
  const CIRCUMFERENCE = 2 * Math.PI * 80; // r=80 for doughnut SVG

  function updateDisplay() {
    const display = document.getElementById('timerDisplay');
    const timeLeftEl = document.getElementById('timeLeft');
    const progressFill = document.getElementById('progressFill');
    const progressPercent = document.getElementById('progressPercent');

    if (display) display.textContent = formatTime(state.elapsed);

    // Navbar running-timer pill
    const navPill = document.getElementById('navTimerPill');
    const navVal  = document.getElementById('navTimerVal');
    if (navPill) {
      navPill.style.display = state.isRunning ? 'flex' : 'none';
      if (navVal) navVal.textContent = formatTime(state.elapsed);
    }

    const percent = state.totalDuration > 0
      ? Math.max(0, ((state.totalDuration - state.elapsed) / state.totalDuration) * 100)
      : 0;

    if (state.totalDuration > 0) {
      const remaining = Math.max(0, state.totalDuration - state.elapsed);
      if (timeLeftEl) timeLeftEl.textContent = 'Time Left: ' + formatTime(remaining);

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

    updateAltProgressBars(percent);

    // Time blindness helper — update document title
    const settings = window.AppSettings || {};
    if (settings.timeBlindenessHelper && state.isRunning) {
      const pct = state.totalDuration > 0
        ? Math.round((state.elapsed / state.totalDuration) * 100) + '% — '
        : '';
      document.title = '[' + formatTime(state.elapsed) + '] ' + pct + 'Frieren Chronomark';
    }
  }

  function updateAltProgressBars(percent) {
    updateDoughnut(percent);
    updateHourglass(percent);
    updateManaBar(percent);
  }

  function updateDoughnut(percent) {
    const fill = document.getElementById('doughnutFill');
    const pctText = document.getElementById('doughnutPct');
    if (!fill) return;
    const offset = CIRCUMFERENCE * (1 - percent / 100);
    fill.style.strokeDashoffset = offset;
    if (pctText) pctText.textContent = Math.round(percent) + '%';
  }

  function updateHourglass(percent) {
    // Sand falls from top to bottom as time passes
    // Top triangle empties (sand falls): clip from bottom up
    // Bot triangle fills (sand accumulates): clip from top down
    const sandTop = document.getElementById('hgSandTop');
    const sandBot = document.getElementById('hgSandBot');
    const particle = document.getElementById('hgParticle');
    const pctText = document.getElementById('hgPct');

    if (!sandTop || !sandBot) return;

    // Hourglass SVG coords: top triangle vertices (10,10)(110,10)(60,100)
    // As percent goes 0→100 the top sand level drops from y=10 toward y=100
    const topFull = 10;
    const topEmpty = 100; // converges to pinch point
    const topSandLevel = topFull + (topEmpty - topFull) * (percent / 100);

    // Remaining sand top: from current level to pinch
    // Interpolate left/right edges at current level
    const leftX = 10 + (60 - 10) * ((topSandLevel - 10) / 90);  // lerp from 10 to 60
    const rightX = 110 - (110 - 60) * ((topSandLevel - 10) / 90); // lerp from 110 to 60
    sandTop.setAttribute('points',
      leftX + ',' + topSandLevel + ' ' +
      rightX + ',' + topSandLevel + ' ' +
      '60,100'
    );

    // Bottom sand: fills from pinch (60,100) upward
    // Bottom triangle vertices: (10,190)(110,190)(60,100)
    const botFull = 190;
    const botEmpty = 100; // pinch
    const botSandLevel = botFull - (botFull - botEmpty) * (percent / 100);
    const bLeftX = 10 + (60 - 10) * ((190 - botSandLevel) / 90);
    const bRightX = 110 - (110 - 60) * ((190 - botSandLevel) / 90);
    sandBot.setAttribute('points',
      '10,190 110,190 ' +
      bRightX + ',' + botSandLevel + ' ' +
      bLeftX + ',' + botSandLevel
    );

    // Falling particle: animate between topSandLevel and 100 only when running
    if (particle) {
      const isRunning = state.isRunning;
      particle.style.display = isRunning && percent < 100 ? '' : 'none';
    }

    if (pctText) pctText.textContent = Math.round(percent) + '%';
  }

  function updateManaBar(percent) {
    const fill = document.getElementById('manaFill');
    const pctText = document.getElementById('manaPct');
    if (fill) fill.style.width = percent + '%';
    if (pctText) pctText.textContent = Math.round(percent) + '%';
  }

  // ── Mana sparkle particle system ────────────────────────────
  function startManaSparkles() {
    stopManaSparkles();
    const canvas = document.getElementById('manaSparkleCanvas');
    if (!canvas) return;

    function resizeCanvas() {
      const fill = document.getElementById('manaFill');
      if (!fill) return;
      canvas.width = fill.offsetWidth || 200;
      canvas.height = fill.offsetHeight || 28;
    }
    resizeCanvas();

    manaSparkles = [];
    for (let i = 0; i < 18; i++) {
      manaSparkles.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 2 + 1,
        speed: Math.random() * 0.4 + 0.2,
        alpha: Math.random() * 0.8 + 0.2,
        alphaDelta: (Math.random() - 0.5) * 0.04
      });
    }

    function loop() {
      resizeCanvas();
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of manaSparkles) {
        p.y -= p.speed / canvas.height;
        p.alpha += p.alphaDelta;
        if (p.alpha <= 0.1) p.alphaDelta = Math.abs(p.alphaDelta);
        if (p.alpha >= 0.9) p.alphaDelta = -Math.abs(p.alphaDelta);
        if (p.y < 0) { p.y = 1; p.x = Math.random(); }

        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 230, 255, ' + p.alpha + ')';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(100, 200, 255, 0.8)';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      manaSparkleAnimId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopManaSparkles() {
    if (manaSparkleAnimId) {
      cancelAnimationFrame(manaSparkleAnimId);
      manaSparkleAnimId = null;
    }
    const canvas = document.getElementById('manaSparkleCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    manaSparkles = [];
  }

  function applyProgressStyle(style) {
    const container = document.getElementById('progressContainer');
    if (container) container.dataset.style = style || 'bar';
    if (style === 'mana') {
      startManaSparkles();
    } else {
      stopManaSparkles();
    }
    // Reset all alternative displays to current percent (remaining fraction)
    const percent = state.totalDuration > 0
      ? Math.max(0, ((state.totalDuration - state.elapsed) / state.totalDuration) * 100)
      : 0;
    updateAltProgressBars(percent);
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
      state.tenMinWarnFired = false;
      state.oneMinWarnFired = false;
    }

    state.intervalId = setInterval(function () {
      state.elapsed++;
      updateDisplay();
      checkBreakReminder();
      checkTenMinuteWarning();
      checkOneMinuteWarning();
    }, 1000);

    // Visual running states
    const display = document.getElementById('timerDisplay');
    if (display) display.classList.add('running');
    const walker = document.getElementById('progressWalker');
    if (walker) walker.classList.add('running');

    // Start mana sparkles if that style is active
    const settings = window.AppSettings || {};
    if ((settings.progressBarStyle || 'bar') === 'mana') {
      startManaSparkles();
    }

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
    const display = document.getElementById('timerDisplay');
    if (display) display.classList.remove('running');
    const walker = document.getElementById('progressWalker');
    if (walker) walker.classList.remove('running');
    stopManaSparkles();
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
    state.tenMinWarnFired = false;

    updateDisplay();
    updateButtonStates();
    if (window.App) window.App.stopEncouragement();
    document.title = 'Frieren Chronomark';
    stopManaSparkles();
    // Clear running visual state
    const displayStop = document.getElementById('timerDisplay');
    if (displayStop) displayStop.classList.remove('running');
    const walkerStop = document.getElementById('progressWalker');
    if (walkerStop) walkerStop.classList.remove('running');
  }

  function resetTimer() {
    clearInterval(state.intervalId);
    state.intervalId = null;
    state.isRunning = false;
    state.isPaused = false;
    state.elapsed = 0;
    state.sessionStartTimestamp = null;
    state.tenMinWarnFired = false;
    state.oneMinWarnFired = false;

    updateDisplay();
    updateButtonStates();
    if (window.App) window.App.stopEncouragement();
    document.title = 'Frieren Chronomark';
    stopManaSparkles();
    const displayReset = document.getElementById('timerDisplay');
    if (displayReset) displayReset.classList.remove('running');
    const walkerReset = document.getElementById('progressWalker');
    if (walkerReset) walkerReset.classList.remove('running');
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

    // Track early-bird (before 7 AM) and night-owl (after 10 PM) session counts
    const earlyBirdSessions = allSessions.filter(function (s) {
      var ts = s.startTimestamp || s.endTimestamp;
      var h = ts ? new Date(ts).getHours() : 12;
      return h < 7;
    }).length;
    const nightOwlSessions = allSessions.filter(function (s) {
      var ts = s.startTimestamp || s.endTimestamp;
      var h = ts ? new Date(ts).getHours() : 12;
      return h >= 22;
    }).length;
    if (earlyBirdSessions >= 5)  specialStats.medal_early_bird = true;
    if (nightOwlSessions >= 5)   specialStats.medal_night_owl = true;

    // Pomodoro counter (sessions <= 30 minutes)
    const pomodoroSessions = allSessions.filter(function (s) {
      return s.duration <= 1800;
    }).length;
    if (pomodoroSessions >= 25)  specialStats.medal_pomodoro_25 = true;

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

  function checkTenMinuteWarning() {
    if (!state.isRunning || state.tenMinWarnFired) return;
    if (state.totalDuration <= 0) return;
    const remaining = state.totalDuration - state.elapsed;
    if (remaining <= 600 && remaining > 0) {
      state.tenMinWarnFired = true;
      if (window.showToast) window.showToast('⏰ 10 minutes remaining in your session!', 'info');
      const settings = window.AppSettings || {};
      if (window.aureole && settings.desktopNotifications) {
        window.aureole.showNotification('10 Minutes Left ⏰', 'You\'re about to finish your session. Keep going!');
      }
    }
  }

  function checkOneMinuteWarning() {
    if (!state.isRunning || state.oneMinWarnFired) return;
    if (state.totalDuration <= 0) return;
    const remaining = state.totalDuration - state.elapsed;
    if (remaining <= 60 && remaining > 0) {
      state.oneMinWarnFired = true;
      if (window.showToast) window.showToast('⏰ 1 minute remaining in your session!', 'info');
      const settings = window.AppSettings || {};
      if (window.aureole && settings.desktopNotifications) {
        window.aureole.showNotification('1 Minute Left ⏰', 'Almost done! Finish strong!');
      }
    }
  }

  function showBellOverlay() {
    var bellOverlay = document.getElementById('bellOverlay');
    var bellGif = document.getElementById('bellGif');
    var bellClose = document.getElementById('bellClose');
    if (bellOverlay) {
      // Force GIF restart by reloading src
      if (bellGif) {
        var src = bellGif.getAttribute('src');
        bellGif.setAttribute('src', '');
        bellGif.setAttribute('src', src);
      }
      bellOverlay.style.display = 'flex';
      // Close button
      if (bellClose && !bellClose._bound) {
        bellClose._bound = true;
        bellClose.addEventListener('click', function () {
          bellOverlay.style.display = 'none';
        });
      }
      // Also close on overlay backdrop click (not on the gif itself)
      if (!bellOverlay._bound) {
        bellOverlay._bound = true;
        bellOverlay.addEventListener('click', function (e) {
          if (e.target === bellOverlay) bellOverlay.style.display = 'none';
        });
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
    document.title = 'Frieren Chronomark';
    if (window.App) window.App.stopEncouragement();
    if (window.SoundSystem) window.SoundSystem.play('timer');
    if (window.showToast) window.showToast('✨ Session complete! Amazing work!', 'success');

    showBellOverlay();
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
    let endSec   = parts2[0] * 3600 + parts2[1] * 60;
    if (endSec <= startSec) endSec += 86400;

    const totalDuration = endSec - startSec;

    // If current time is already past the start time, pre-advance elapsed
    const now = new Date();
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    // Normalise nowSec relative to startSec (handle midnight wraparound)
    let normNow = nowSec;
    if (normNow < startSec) normNow += 86400; // now is next-day relative to start
    const alreadyElapsed = normNow - startSec;

    if (alreadyElapsed > 0 && alreadyElapsed < totalDuration) {
      state.elapsed = alreadyElapsed;
      if (window.showToast) window.showToast(
        'Started ' + Math.floor(alreadyElapsed / 60) + ' min ago — timer offset applied.', 'info'
      );
    } else if (alreadyElapsed >= totalDuration) {
      if (window.showToast) window.showToast('End time is already in the past!', 'error');
      return;
    } else {
      state.elapsed = 0;
    }

    state.totalDuration = totalDuration;

    const startLabel = document.getElementById('progressStart');
    const endLabel = document.getElementById('progressEnd');
    if (startLabel) startLabel.textContent = startInput.value;
    if (endLabel) endLabel.textContent = endInput.value;

    updateDisplay();
    if (window.showToast) {
      const remaining = totalDuration - state.elapsed;
      window.showToast('Timer set: ' + Math.round(remaining / 60) + ' min remaining', 'info');
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

  const DEFAULT_BG_URL = 'https://github.com/user-attachments/assets/9f47780c-bd58-444c-b733-7e5e47fc7fd8';

  async function loadCustomImages() {
    const customBg = await Storage.get('customBg');
    const bgOverlay = document.getElementById('timerBgOverlay');
    if (bgOverlay) {
      const bgUrl = customBg || DEFAULT_BG_URL;
      bgOverlay.style.backgroundImage = 'url(' + bgUrl + ')';
      bgOverlay.style.backgroundSize = 'cover';
      bgOverlay.style.backgroundPosition = 'center';
    }

    const customWalker = await Storage.get('customWalker');
    const walkerImg = document.getElementById('walkerImg');
    if (walkerImg) {
      walkerImg.src = customWalker || '../assets/Sprite.png';
    }
  }

  function init() {
    const startBtn = document.getElementById('timerStart');
    const pauseBtn = document.getElementById('timerPause');
    const stopBtn = document.getElementById('timerStop');
    const resetBtn = document.getElementById('timerReset');
    const applyBtn = document.getElementById('applyTimesBtn');
    const setDurationBtn = document.getElementById('setDurationBtn');
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

    const setNowBtn = document.getElementById('setNowBtn');
    if (setNowBtn) {
      setNowBtn.addEventListener('click', function () {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const startInput = document.getElementById('startTimeInput');
        if (startInput) startInput.value = hh + ':' + mm;
        if (window.showToast) window.showToast('Start time set to now (' + hh + ':' + mm + ')', 'info');
      });
    }

    if (setDurationBtn) {
      setDurationBtn.addEventListener('click', function () {
        const hoursEl = document.getElementById('durationHours');
        const minsEl = document.getElementById('durationMinutes');
        const hours = parseInt((hoursEl && hoursEl.value) || 0, 10) || 0;
        const mins = parseInt((minsEl && minsEl.value) || 0, 10) || 0;
        const totalSecs = hours * 3600 + mins * 60;
        if (totalSecs <= 0) {
          if (window.showToast) window.showToast('Please enter a duration greater than 0.', 'error');
          return;
        }
        state.totalDuration = totalSecs;
        const startLabel = document.getElementById('progressStart');
        const endLabel = document.getElementById('progressEnd');
        if (startLabel) startLabel.textContent = '--:--';
        if (endLabel) endLabel.textContent = '--:--';
        updateDisplay();
        const label = (hours > 0 ? hours + 'h ' : '') + (mins > 0 ? mins + 'min' : '');
        if (window.showToast) window.showToast('Duration set: ' + label.trim(), 'info');
      });
    }

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

    // Apply saved progress bar style
    applyProgressStyle(settings.progressBarStyle || 'mana');
  }

  function getState() { return state; }

  return {
    init: init,
    start: startTimer,
    pause: pauseTimer,
    stop: stopTimer,
    reset: resetTimer,
    applyManualTimes: applyManualTimes,
    applyProgressStyle: applyProgressStyle,
    getState: getState,
    showBellOverlay: showBellOverlay
  };
})();

window.Timer = Timer;
