// ===== STATE & STORAGE =====

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STORAGE_KEY = 'aureole_state';

const DEFAULT_STATE = {
  timer: {
    startTimestamp: null,
    endTimestamp: null,
    totalDuration: 0,
    category: 'Working',
    isRunning: false,
    isPaused: false,
    pausedAt: null,
    totalPausedMs: 0,
    sessionNotes: '',
    energyLevel: null,
    pomodoroMode: false,
    pomodoroPhase: 'work',
    pomodoroCount: 0,
    lastBreakTimestamp: null,
    hyperfocusWarningShown: false,
  },
  sessions: [],
  journal: { entries: {} },
  grimoire: {
    notes: [],
    categories: ['General', 'Ideas', 'Research', 'Goals']
  },
  profile: {
    name: 'Traveler',
    image: null,
    achievements: {},
    streakData: { lastActiveDate: null, currentStreak: 0 },
  },
  dailyPlanner: { tasks: [], lastResetDate: null },
  routines: [],
  reminders: [],
  settings: {
    backgroundImage: null,
    walkingCharacter: null,
    accentColor: '#c3b7e6',
    fontSize: 16,
    animationIntensity: 100,
    borderStyle: 'ornate',
    defaultDuration: 25,
    pomodoroWork: 25,
    pomodoroBreak: 5,
    breakInterval: 60,
    soundEnabled: true,
    notificationsEnabled: true,
    hyperfocusGuard: 120,
    categories: [
      { name: 'Working', icon: '⚒️', color: '#7eb8da' },
      { name: 'Studying', icon: '📚', color: '#c3b7e6' }
    ],
    youtubeUrl: '',
    playerSize: 'medium',
    reduceAnimations: false,
    highContrast: false,
    autoBreakEnforcement: false,
    taskChunkingMode: false,
    focusMode: false,
    lowDemandMode: false,
  },
  weeklyReview: { lastPromptDate: null },
  breathingCount: 0,
  chronicle: [],
};

let state = {};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      state = deepMerge(DEFAULT_STATE, parsed);
    } else {
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  } catch (e) {
    console.error('Failed to load state:', e);
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

function deepMerge(target, source) {
  const result = JSON.parse(JSON.stringify(target));
  for (const key of Object.keys(source)) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// ===== TIMER SECTION =====

let timerInterval = null;
let currentEnergyLevel = null;

function startTimer() {
  if (state.timer.energyLevel === null) {
    const checkin = document.getElementById('energy-checkin');
    if (checkin) {
      checkin.classList.add('highlight-flash');
      setTimeout(() => checkin.classList.remove('highlight-flash'), 1000);
    }
    showToast('Please select your energy level first!');
    return;
  }

  const startInput = document.getElementById('start-time-input');
  const endInput = document.getElementById('end-time-input');
  let totalDuration;

  if (endInput && endInput.value) {
    const parts = endInput.value.split(':');
    const endHours = parseInt(parts[0], 10);
    const endMinutes = parseInt(parts[1], 10);
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHours, endMinutes, 0, 0);
    if (endDate.getTime() <= now.getTime()) {
      endDate.setDate(endDate.getDate() + 1);
    }
    totalDuration = endDate.getTime() - now.getTime();
  } else if (state.timer.pomodoroMode) {
    totalDuration = state.settings.pomodoroWork * 60 * 1000;
  } else {
    totalDuration = state.settings.defaultDuration * 60 * 1000;
  }

  if (startInput && startInput.value) {
    const parts = startInput.value.split(':');
    const startHours = parseInt(parts[0], 10);
    const startMinutes = parseInt(parts[1], 10);
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHours, startMinutes, 0, 0);
    const offset = now.getTime() - startDate.getTime();
    if (offset > 0) {
      totalDuration = Math.max(0, totalDuration - offset);
    }
  }

  state.timer.startTimestamp = Date.now();
  state.timer.endTimestamp = state.timer.startTimestamp + totalDuration;
  state.timer.totalDuration = totalDuration;
  state.timer.isRunning = true;
  state.timer.isPaused = false;
  state.timer.totalPausedMs = 0;
  state.timer.lastBreakTimestamp = Date.now();
  state.timer.hyperfocusWarningShown = false;

  const catSelect = document.getElementById('category-select');
  if (catSelect) state.timer.category = catSelect.value;

  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const energyCheckin = document.getElementById('energy-checkin');

  if (startBtn) startBtn.classList.add('hidden');
  if (pauseBtn) { pauseBtn.classList.remove('hidden'); pauseBtn.textContent = '⏸ Pause'; }
  if (resetBtn) resetBtn.classList.remove('hidden');
  if (energyCheckin) energyCheckin.classList.add('hidden');

  timerInterval = setInterval(updateTimer, 500);
  addChronicleEvent('session_start', 'Session Started', `Started ${state.timer.category} session`, 'session_start');
  saveState();
}

function pauseTimer() {
  if (state.timer.isRunning) {
    state.timer.isPaused = true;
    state.timer.pausedAt = Date.now();
    state.timer.isRunning = false;
    clearInterval(timerInterval);
    const pauseBtn = document.getElementById('pause-btn');
    if (pauseBtn) pauseBtn.textContent = '▶ Resume';
    saveState();
  }
}

function resumeTimer() {
  state.timer.totalPausedMs += Date.now() - state.timer.pausedAt;
  state.timer.pausedAt = null;
  state.timer.isPaused = false;
  state.timer.isRunning = true;
  timerInterval = setInterval(updateTimer, 500);
  const pauseBtn = document.getElementById('pause-btn');
  if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
  saveState();
}

function resetTimer() {
  clearInterval(timerInterval);
  state.timer.startTimestamp = null;
  state.timer.endTimestamp = null;
  state.timer.totalDuration = 0;
  state.timer.isRunning = false;
  state.timer.isPaused = false;
  state.timer.pausedAt = null;
  state.timer.totalPausedMs = 0;
  state.timer.lastBreakTimestamp = null;
  state.timer.hyperfocusWarningShown = false;
  state.timer.energyLevel = null;

  updateProgressBar(0);
  updateWalkingCharacter(0);

  const timeDisplay = document.getElementById('time-left-display');
  const timeWords = document.getElementById('time-in-words');
  const timePct = document.getElementById('time-percentage');
  if (timeDisplay) timeDisplay.textContent = '00:00:00';
  if (timeWords) timeWords.textContent = 'Set a timer to begin your quest';
  if (timePct) timePct.textContent = '0%';

  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const energyCheckin = document.getElementById('energy-checkin');
  if (startBtn) startBtn.classList.remove('hidden');
  if (pauseBtn) pauseBtn.classList.add('hidden');
  if (resetBtn) resetBtn.classList.add('hidden');
  if (energyCheckin) energyCheckin.classList.remove('hidden');

  currentEnergyLevel = null;
  document.querySelectorAll('.energy-btn').forEach(btn => btn.classList.remove('selected'));

  saveState();
}

function updateTimer() {
  if (!state.timer.isRunning) return;

  const effectiveElapsed = Date.now() - state.timer.startTimestamp - state.timer.totalPausedMs;
  const remaining = state.timer.totalDuration - effectiveElapsed;

  if (remaining <= 0) {
    completeTimer();
    return;
  }

  const percent = Math.min(100, (effectiveElapsed / state.timer.totalDuration) * 100);

  const timeDisplay = document.getElementById('time-left-display');
  const timeWords = document.getElementById('time-in-words');
  const timePct = document.getElementById('time-percentage');
  if (timeDisplay) timeDisplay.textContent = formatTime(remaining);
  if (timeWords) timeWords.textContent = formatTimeWords(remaining);
  if (timePct) timePct.textContent = Math.round(percent) + '%';

  updateProgressBar(percent);
  updateWalkingCharacter(percent);

  if (state.timer.lastBreakTimestamp && (Date.now() - state.timer.lastBreakTimestamp) > state.settings.breakInterval * 60 * 1000) {
    sendNotification('Break Time!', "You've been working for a while. Time for a short break!");
    showToast("⏰ Break time! You've earned it.");
    state.timer.lastBreakTimestamp = Date.now();
  }

  if (effectiveElapsed > state.settings.hyperfocusGuard * 60 * 1000 && !state.timer.hyperfocusWarningShown) {
    state.timer.hyperfocusWarningShown = true;
    const hyperfocusDiv = document.getElementById('hyperfocus-warning');
    if (hyperfocusDiv) hyperfocusDiv.classList.remove('hidden');
  }
}

function completeTimer() {
  clearInterval(timerInterval);
  state.timer.isRunning = false;

  const notesEl = document.getElementById('session-notes');
  const session = {
    id: generateId(),
    startTimestamp: state.timer.startTimestamp,
    endTimestamp: Date.now(),
    category: state.timer.category,
    duration: state.timer.totalDuration,
    notes: notesEl ? notesEl.value : '',
    energyLevel: state.timer.energyLevel,
    date: new Date().toISOString().split('T')[0]
  };

  state.sessions.push(session);

  if (state.settings.soundEnabled) {
    playCompletionSound();
  }

  calculateStreak();
  checkAchievements();
  addChronicleEvent('session', 'Session Complete', `Completed ${state.timer.category} session (${formatTime(state.timer.totalDuration)})`, 'session');
  showReinforcementMessage();

  if (state.timer.pomodoroMode) {
    if (state.timer.pomodoroPhase === 'work') {
      state.timer.pomodoroCount++;
      state.timer.pomodoroPhase = 'break';
      showToast(`🍵 Pomodoro #${state.timer.pomodoroCount} done! Time for a ${state.settings.pomodoroBreak}-min break.`);
    } else {
      state.timer.pomodoroPhase = 'work';
      showToast('🔮 Break over! Ready for the next pomodoro?');
    }
  }

  resetTimer();
  updateProfileUI();
  saveState();
}

function playCompletionSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99];
    const durations = [0.2, 0.2, 0.3];
    let startTime = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + durations[i]);
      osc.start(startTime);
      osc.stop(startTime + durations[i]);
      startTime += durations[i];
    });
  } catch (e) {
    console.warn('Could not play completion sound:', e);
  }
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
}

function formatTimeWords(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (totalSeconds > 3600) {
    return `About ${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  } else if (totalSeconds > 60) {
    return `About ${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  } else {
    return 'Less than a minute remaining';
  }
}

function setupTimerControls() {
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const pomodoroToggle = document.getElementById('pomodoro-toggle');
  const pomodoroInfo = document.getElementById('pomodoro-info');
  const categorySelect = document.getElementById('category-select');

  if (startBtn) startBtn.addEventListener('click', startTimer);

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (state.timer.isRunning) {
        pauseTimer();
      } else if (state.timer.isPaused) {
        resumeTimer();
      }
    });
  }

  if (resetBtn) resetBtn.addEventListener('click', resetTimer);

  document.querySelectorAll('.energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const level = parseInt(btn.dataset.level, 10);
      state.timer.energyLevel = level;
      currentEnergyLevel = level;
      document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateEnergySuggestion(level);
    });
  });

  if (pomodoroToggle) {
    pomodoroToggle.addEventListener('change', () => {
      state.timer.pomodoroMode = pomodoroToggle.checked;
      if (pomodoroInfo) {
        if (pomodoroToggle.checked) {
          pomodoroInfo.classList.remove('hidden');
        } else {
          pomodoroInfo.classList.add('hidden');
        }
      }
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      state.timer.category = categorySelect.value;
    });
  }
}

// ===== PROGRESS BAR =====

function updateProgressBar(percent) {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = percent + '%';
  const pctEl = document.getElementById('time-percentage');
  if (pctEl) pctEl.textContent = Math.round(percent) + '%';
}

function updateWalkingCharacter(percent) {
  const char = document.getElementById('walking-character');
  if (char) char.style.left = Math.min(95, percent) + '%';
}

// ===== JOURNAL SECTION =====

let journalAutoSaveTimeout = null;
let currentJournalMood = null;

function initJournalDate() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('journal-date');
  if (dateInput) dateInput.value = today;
  loadJournalEntry(today);
}

function loadJournalEntry(dateStr) {
  const entry = state.journal.entries[dateStr] || {};
  const content = document.getElementById('journal-content');
  const gratitude = document.getElementById('gratitude-input');
  const selectedMoodEl = document.getElementById('selected-mood');

  if (content) content.innerHTML = entry.content || '';
  if (gratitude) gratitude.value = entry.gratitude || '';

  currentJournalMood = entry.mood || null;
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.classList.remove('selected');
    if (entry.mood && btn.dataset.mood === entry.mood) {
      btn.classList.add('selected');
    }
  });

  if (selectedMoodEl) {
    selectedMoodEl.textContent = currentJournalMood ? `Mood: ${currentJournalMood}` : '';
  }
}

function saveJournalEntry() {
  const dateInput = document.getElementById('journal-date');
  const contentEl = document.getElementById('journal-content');
  const gratitudeEl = document.getElementById('gratitude-input');
  if (!dateInput) return;

  const dateStr = dateInput.value;
  const content = contentEl ? contentEl.innerHTML : '';
  const gratitude = gratitudeEl ? gratitudeEl.value : '';

  state.journal.entries[dateStr] = {
    content,
    gratitude,
    mood: currentJournalMood,
    timestamp: Date.now()
  };

  addChronicleEvent('journal_save', 'Journal Entry', `Saved entry for ${dateStr}`, 'journal');

  const statusEl = document.getElementById('journal-save-status');
  if (statusEl) {
    statusEl.textContent = '✓ Saved!';
    statusEl.classList.remove('hidden');
    setTimeout(() => statusEl.classList.add('hidden'), 2000);
  }

  renderJournalList();
  checkAchievements();
  saveState();
}

function renderJournalList(filteredEntries) {
  const listEl = document.getElementById('journal-entries-list');
  if (!listEl) return;

  let entries;
  if (filteredEntries !== undefined) {
    entries = filteredEntries;
  } else {
    entries = Object.entries(state.journal.entries).map(([date, entry]) => ({ date, ...entry }));
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = '';

  if (entries.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No journal entries yet. Start writing!</div>';
    return;
  }

  entries.forEach(({ date, content, mood }) => {
    const card = document.createElement('div');
    card.className = 'journal-entry-card';
    const rawText = stripHtml(content || '');
    const excerptText = (rawText.substring(0, 80) + (rawText.length > 80 ? '...' : '')) || '(no content)';

    const dateDiv = document.createElement('div');
    dateDiv.className = 'entry-date';
    dateDiv.textContent = date + (mood ? ' ' + mood : '');

    const excerptDiv = document.createElement('div');
    excerptDiv.className = 'entry-excerpt';
    excerptDiv.textContent = excerptText;

    card.appendChild(dateDiv);
    card.appendChild(excerptDiv);
    card.addEventListener('click', () => {
      const dateInput = document.getElementById('journal-date');
      if (dateInput) dateInput.value = date;
      loadJournalEntry(date);
    });
    listEl.appendChild(card);
  });
}

function journalSearch(query) {
  if (!query.trim()) {
    renderJournalList();
    return;
  }
  const lq = query.toLowerCase();
  const filtered = Object.entries(state.journal.entries)
    .filter(([date, entry]) => {
      const text = stripHtml(entry.content || '').toLowerCase();
      return text.includes(lq) || date.includes(lq);
    })
    .map(([date, entry]) => ({ date, ...entry }));
  renderJournalList(filtered);
}

function setupJournalControls() {
  const saveBtn = document.getElementById('save-journal-btn');
  const dateInput = document.getElementById('journal-date');
  const contentEl = document.getElementById('journal-content');
  const searchEl = document.getElementById('journal-search');

  if (saveBtn) saveBtn.addEventListener('click', saveJournalEntry);

  if (dateInput) {
    dateInput.addEventListener('change', () => loadJournalEntry(dateInput.value));
  }

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      currentJournalMood = mood;
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const selectedMoodEl = document.getElementById('selected-mood');
      if (selectedMoodEl) selectedMoodEl.textContent = `Mood: ${mood}`;
    });
  });

  document.querySelectorAll('.journal-format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.command;
      const value = btn.dataset.value || null;
      if (contentEl) contentEl.focus();
      try { document.execCommand(command, false, value); } catch (e) { console.warn('execCommand error:', e); }
    });
  });

  if (contentEl) {
    contentEl.addEventListener('input', () => {
      clearTimeout(journalAutoSaveTimeout);
      journalAutoSaveTimeout = setTimeout(saveJournalEntry, 2000);
    });
  }

  if (searchEl) {
    searchEl.addEventListener('input', () => journalSearch(searchEl.value));
  }
}

// ===== GRIMOIRE SECTION =====

let currentNoteId = null;
let grimoire_currentFilter = 'all';
let grimoire_searchQuery = '';

function loadGrimoire() {
  renderCategoryFilters();
  renderNotesList(getFilteredNotes());
}

function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) return;
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn' + (grimoire_currentFilter === 'all' ? ' active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    grimoire_currentFilter = 'all';
    renderCategoryFilters();
    renderNotesList(getFilteredNotes());
  });
  container.appendChild(allBtn);

  state.grimoire.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (grimoire_currentFilter === cat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      grimoire_currentFilter = cat;
      renderCategoryFilters();
      renderNotesList(getFilteredNotes());
    });
    container.appendChild(btn);
  });
}

function getFilteredNotes() {
  let notes = [...state.grimoire.notes];
  if (grimoire_currentFilter !== 'all') {
    notes = notes.filter(n => n.category === grimoire_currentFilter);
  }
  if (grimoire_searchQuery.trim()) {
    const q = grimoire_searchQuery.toLowerCase();
    notes = notes.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  return notes;
}

function renderNotesList(notes) {
  const listEl = document.getElementById('grimoire-notes-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!notes || notes.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No notes found. Create one!</div>';
    return;
  }

  notes.forEach(note => {
    const card = document.createElement('div');
    card.className = 'note-card' + (note.id === currentNoteId ? ' active' : '');
    const tagsHtml = (note.tags || []).map(t => `<span class="note-tag">${escapeHtml(t)}</span>`).join('');
    const date = note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '';
    card.innerHTML = `
      <div class="note-card-title">${note.pinned ? '📌 ' : ''}${escapeHtml(note.title || 'Untitled')}</div>
      <div class="note-card-meta">${escapeHtml(note.category || '')} · ${escapeHtml(date)}</div>
      <div class="note-tags-display">${tagsHtml}</div>
    `;
    card.addEventListener('click', () => openNote(note.id));
    listEl.appendChild(card);
  });
}

function openNote(id) {
  const note = state.grimoire.notes.find(n => n.id === id);
  if (!note) return;
  currentNoteId = id;

  const titleInput = document.getElementById('note-title-input');
  const contentEl = document.getElementById('note-content');
  const categoryEl = document.getElementById('note-category');
  const tagsEl = document.getElementById('note-tags');
  const pinBtn = document.getElementById('pin-note-btn');
  const editorPanel = document.getElementById('note-editor-panel');
  const placeholder = document.querySelector('.grimoire-placeholder');

  if (titleInput) titleInput.value = note.title || '';
  if (contentEl) contentEl.value = note.content || '';
  if (tagsEl) tagsEl.value = (note.tags || []).join(', ');
  if (pinBtn) pinBtn.textContent = note.pinned ? '📌 Unpin' : '📌 Pin';

  loadNoteCategorySelect();
  if (categoryEl) categoryEl.value = note.category || '';

  if (editorPanel) editorPanel.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');

  renderNotesList(getFilteredNotes());
}

function newNote() {
  const note = {
    id: generateId(),
    title: 'New Note',
    content: '',
    category: state.grimoire.categories[0] || 'General',
    tags: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.grimoire.notes.push(note);
  saveState();
  openNote(note.id);
  const titleInput = document.getElementById('note-title-input');
  if (titleInput) {
    titleInput.focus();
    titleInput.select();
  }
}

function saveNote() {
  if (currentNoteId === null) return;
  const idx = state.grimoire.notes.findIndex(n => n.id === currentNoteId);
  if (idx === -1) return;

  const titleInput = document.getElementById('note-title-input');
  const contentEl = document.getElementById('note-content');
  const categoryEl = document.getElementById('note-category');
  const tagsEl = document.getElementById('note-tags');

  state.grimoire.notes[idx].title = titleInput ? titleInput.value : state.grimoire.notes[idx].title;
  state.grimoire.notes[idx].content = contentEl ? contentEl.value : state.grimoire.notes[idx].content;
  state.grimoire.notes[idx].category = categoryEl ? categoryEl.value : state.grimoire.notes[idx].category;
  state.grimoire.notes[idx].tags = tagsEl ? tagsEl.value.split(',').map(t => t.trim()).filter(Boolean) : state.grimoire.notes[idx].tags;
  state.grimoire.notes[idx].updatedAt = Date.now();

  renderNotesList(getFilteredNotes());
  showToast('✓ Note saved!');
  checkAchievements();
  saveState();
}

function deleteNote(id) {
  if (!id) return;
  showConfirmModal('Delete Note', 'Delete this note? This cannot be undone.', () => {
    state.grimoire.notes = state.grimoire.notes.filter(n => n.id !== id);
    currentNoteId = null;
    const editorPanel = document.getElementById('note-editor-panel');
    const placeholder = document.querySelector('.grimoire-placeholder');
    if (editorPanel) editorPanel.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    renderNotesList(getFilteredNotes());
    saveState();
  });
}

function pinNote(id) {
  if (!id) return;
  const note = state.grimoire.notes.find(n => n.id === id);
  if (!note) return;
  note.pinned = !note.pinned;
  const pinBtn = document.getElementById('pin-note-btn');
  if (pinBtn) pinBtn.textContent = note.pinned ? '📌 Unpin' : '📌 Pin';
  saveState();
  renderNotesList(getFilteredNotes());
}

function loadNoteCategorySelect() {
  const sel = document.getElementById('note-category');
  if (!sel) return;
  sel.innerHTML = '';
  state.grimoire.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    sel.appendChild(opt);
  });
}

function setupGrimoireControls() {
  const newNoteBtn = document.getElementById('new-note-btn');
  const saveNoteBtn = document.getElementById('save-note-btn');
  const deleteNoteBtn = document.getElementById('delete-note-btn');
  const pinNoteBtn = document.getElementById('pin-note-btn');
  const closeNoteBtn = document.getElementById('close-note-btn');
  const searchEl = document.getElementById('grimoire-search');

  if (newNoteBtn) newNoteBtn.addEventListener('click', newNote);
  if (saveNoteBtn) saveNoteBtn.addEventListener('click', saveNote);
  if (deleteNoteBtn) deleteNoteBtn.addEventListener('click', () => deleteNote(currentNoteId));
  if (pinNoteBtn) pinNoteBtn.addEventListener('click', () => pinNote(currentNoteId));

  if (closeNoteBtn) {
    closeNoteBtn.addEventListener('click', () => {
      const editorPanel = document.getElementById('note-editor-panel');
      const placeholder = document.querySelector('.grimoire-placeholder');
      if (editorPanel) editorPanel.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
      currentNoteId = null;
      renderNotesList(getFilteredNotes());
    });
  }

  if (searchEl) {
    searchEl.addEventListener('input', () => {
      grimoire_searchQuery = searchEl.value;
      renderNotesList(getFilteredNotes());
    });
  }
}

// ===== CHRONICLE SECTION =====

function addChronicleEvent(id, title, description, type) {
  state.chronicle.push({
    id: generateId(),
    eventId: id,
    title,
    description,
    type,
    timestamp: Date.now()
  });
  if (state.chronicle.length > 1000) {
    state.chronicle = state.chronicle.slice(-1000);
  }
}

function buildChronicleItems() {
  let items = [...state.chronicle];

  const startEl = document.getElementById('chronicle-start');
  const endEl = document.getElementById('chronicle-end');
  const filterEl = document.getElementById('chronicle-filter');

  if (startEl && startEl.value) {
    const startTs = new Date(startEl.value + 'T00:00:00').getTime();
    items = items.filter(item => item.timestamp >= startTs);
  }
  if (endEl && endEl.value) {
    const endTs = new Date(endEl.value + 'T23:59:59').getTime();
    items = items.filter(item => item.timestamp <= endTs);
  }
  if (filterEl && filterEl.value && filterEl.value !== 'all') {
    items = items.filter(item => item.type === filterEl.value);
  }

  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}

function renderChronicle(items) {
  const timeline = document.getElementById('chronicle-timeline');
  if (!timeline) return;
  timeline.innerHTML = '';

  if (!items || items.length === 0) {
    timeline.innerHTML = '<div class="empty-state">No chronicle events yet. Start a session or write in your journal!</div>';
    return;
  }

  const typeIcons = {
    session: '⏱️',
    session_start: '▶️',
    journal: '📖',
    journal_save: '📖',
    grimoire: '📚',
    achievement: '🏅'
  };

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = `timeline-item timeline-${item.type || 'session'}`;

    const dot = document.createElement('div');
    dot.className = `timeline-dot ${item.type || 'session'}`;

    const content = document.createElement('div');
    content.className = 'timeline-content';

    const icon = typeIcons[item.type] || '✦';
    const date = new Date(item.timestamp);
    const formatted = date.toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    content.innerHTML = `
      <span class="timeline-icon">${escapeHtml(icon)}</span>
      <strong class="timeline-title">${escapeHtml(item.title)}</strong>
      <span class="timeline-desc">${escapeHtml(item.description)}</span>
      <span class="timeline-time">${escapeHtml(formatted)}</span>
    `;

    div.appendChild(dot);
    div.appendChild(content);
    timeline.appendChild(div);
  });
}

function loadChronicle() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const startEl = document.getElementById('chronicle-start');
  const endEl = document.getElementById('chronicle-end');
  if (startEl && !startEl.value) startEl.value = thirtyDaysAgo;
  if (endEl && !endEl.value) endEl.value = today;
  renderChronicle(buildChronicleItems());
}

function setupChronicleControls() {
  const startEl = document.getElementById('chronicle-start');
  const endEl = document.getElementById('chronicle-end');
  const filterEl = document.getElementById('chronicle-filter');
  const exportBtn = document.getElementById('chronicle-export-btn');

  if (startEl) startEl.addEventListener('change', () => renderChronicle(buildChronicleItems()));
  if (endEl) endEl.addEventListener('change', () => renderChronicle(buildChronicleItems()));
  if (filterEl) filterEl.addEventListener('change', () => renderChronicle(buildChronicleItems()));
  if (exportBtn) exportBtn.addEventListener('click', exportChronicle);
}

function exportChronicle() {
  const items = buildChronicleItems();
  const lines = items.map(item => {
    const date = new Date(item.timestamp).toLocaleString();
    return `[${date}] [${item.type}] ${item.title}: ${item.description}`;
  });
  const text = lines.join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aureole-chronicle.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== PROFILE SECTION =====

function getTotalHours(category, s) {
  s = s || state;
  return s.sessions.filter(sess => sess.category === category)
    .reduce((acc, sess) => acc + (sess.duration || 0), 0) / 3600000;
}

function getAllTotalHours(s) {
  s = s || state;
  return s.sessions.reduce((acc, sess) => acc + (sess.duration || 0), 0) / 3600000;
}

function calculateRank(totalHours) {
  if (totalHours >= 500) return 'Aureole';
  if (totalHours >= 100) return 'Grand Sage';
  if (totalHours >= 50) return 'Archmage';
  if (totalHours >= 10) return 'Mage';
  if (totalHours >= 1) return 'Journeyman';
  return 'Apprentice';
}

function calculateStreak() {
  const dates = [...new Set(state.sessions.map(s => s.date))].sort((a, b) => b.localeCompare(a));
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (!dates.includes(today) && !dates.includes(yesterday)) {
    state.profile.streakData.currentStreak = 0;
    state.profile.streakData.lastActiveDate = dates[0] || null;
    return;
  }

  let streak = 0;
  let checkDate = dates.includes(today) ? today : yesterday;
  const startIdx = dates.indexOf(checkDate);
  if (startIdx === -1) { state.profile.streakData.currentStreak = 0; return; }

  for (let i = startIdx; i < dates.length; i++) {
    const expected = new Date(new Date(checkDate).getTime() - (i - startIdx) * 86400000).toISOString().split('T')[0];
    if (dates[i] === expected) {
      streak++;
    } else {
      break;
    }
  }

  state.profile.streakData.currentStreak = streak;
  state.profile.streakData.lastActiveDate = today;
}

function calculateFocusScore() {
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = state.sessions.filter(s => s.date === today);
  const sessionScore = Math.min(50, todaySessions.length * 10);
  const journalScore = state.journal.entries[today] ? 20 : 0;
  const grimoireScore = state.grimoire.notes.some(n => n.createdAt && new Date(n.createdAt).toISOString().split('T')[0] === today) ? 15 : 0;
  const streakScore = state.profile.streakData.currentStreak > 7 ? 15 : 0;
  return Math.min(100, sessionScore + journalScore + grimoireScore + streakScore);
}

function updateProfileUI() {
  const nameInput = document.getElementById('profile-name-input');
  const rankEl = document.getElementById('profile-rank');
  const totalHoursEl = document.getElementById('profile-total-hours');
  const profileImg = document.getElementById('profile-image');

  if (nameInput) nameInput.value = state.profile.name || 'Traveler';

  const totalHours = getAllTotalHours();
  const rank = calculateRank(totalHours);

  if (rankEl) rankEl.textContent = rank;
  if (totalHoursEl) totalHoursEl.textContent = totalHours.toFixed(1) + 'h';

  const totalHoursStat = document.getElementById('stat-total-hours');
  const streakStat = document.getElementById('stat-streak');
  const sessionsStat = document.getElementById('stat-sessions');
  const journalStat = document.getElementById('stat-journal');
  const grimoireStat = document.getElementById('stat-grimoire');
  const focusStat = document.getElementById('stat-focus');

  if (totalHoursStat) totalHoursStat.textContent = totalHours.toFixed(1);
  if (streakStat) streakStat.textContent = state.profile.streakData.currentStreak + ' days';
  if (sessionsStat) sessionsStat.textContent = state.sessions.length;
  if (journalStat) journalStat.textContent = Object.keys(state.journal.entries).length;
  if (grimoireStat) grimoireStat.textContent = state.grimoire.notes.length;
  if (focusStat) focusStat.textContent = calculateFocusScore();

  if (state.profile.image && profileImg) {
    profileImg.src = state.profile.image;
    profileImg.classList.remove('hidden');
  }

  renderWeeklyChart();
  renderAchievementRack();
}

function renderWeeklyChart() {
  const chart = document.getElementById('weekly-chart');
  if (!chart) return;
  chart.innerHTML = '';

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ date: d.toISOString().split('T')[0], label: d.toLocaleDateString('en-US', { weekday: 'short' }) });
  }

  const hours = days.map(d => {
    return state.sessions.filter(s => s.date === d.date).reduce((acc, s) => acc + (s.duration || 0), 0) / 3600000;
  });

  const maxH = Math.max(...hours, 0.1);

  days.forEach((d, i) => {
    const item = document.createElement('div');
    item.className = 'bar-item';
    const heightPct = Math.max(2, (hours[i] / maxH) * 100);
    item.innerHTML = `
      <div class="bar-fill" style="height:${heightPct}%" title="${hours[i].toFixed(1)}h"></div>
      <div class="bar-label">${d.label}</div>
    `;
    chart.appendChild(item);
  });
}

function setupProfileControls() {
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const changeImageBtn = document.getElementById('change-profile-image-btn');
  const imageUpload = document.getElementById('profile-image-upload');
  const nameInput = document.getElementById('profile-name-input');

  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      if (nameInput) state.profile.name = nameInput.value;
      saveState();
      showToast('Profile saved!');
    });
  }

  if (changeImageBtn && imageUpload) {
    changeImageBtn.addEventListener('click', () => imageUpload.click());
  }

  if (imageUpload) {
    imageUpload.addEventListener('change', () => {
      const file = imageUpload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        state.profile.image = e.target.result;
        const profileImg = document.getElementById('profile-image');
        if (profileImg) {
          profileImg.src = e.target.result;
          profileImg.classList.remove('hidden');
        }
        saveState();
      };
      reader.readAsDataURL(file);
    });
  }

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      state.profile.name = nameInput.value;
    });
  }
}

// ===== ACHIEVEMENTS SECTION =====

const ACHIEVEMENTS = [
  { id: 'work_1h', category: 'work', icon: '⚒️', name: 'First Hour', desc: 'Work for 1 hour total', condition: s => getTotalHours('Working', s) >= 1 },
  { id: 'work_5h', category: 'work', icon: '🔨', name: 'Apprentice Worker', desc: 'Work for 5 hours total', condition: s => getTotalHours('Working', s) >= 5 },
  { id: 'work_10h', category: 'work', icon: '⚙️', name: 'Diligent Craftsman', desc: 'Work for 10 hours total', condition: s => getTotalHours('Working', s) >= 10 },
  { id: 'work_20h', category: 'work', icon: '🛠️', name: 'Skilled Artisan', desc: 'Work for 20 hours total', condition: s => getTotalHours('Working', s) >= 20 },
  { id: 'work_50h', category: 'work', icon: '⚡', name: 'Power Wielder', desc: 'Work for 50 hours total', condition: s => getTotalHours('Working', s) >= 50 },
  { id: 'work_100h', category: 'work', icon: '🌟', name: 'Century Worker', desc: 'Work for 100 hours total', condition: s => getTotalHours('Working', s) >= 100 },
  { id: 'work_250h', category: 'work', icon: '💫', name: 'Legendary Craftsman', desc: 'Work for 250 hours total', condition: s => getTotalHours('Working', s) >= 250 },
  { id: 'work_500h', category: 'work', icon: '🏆', name: 'Master Artisan', desc: 'Work for 500 hours total', condition: s => getTotalHours('Working', s) >= 500 },
  { id: 'work_1000h', category: 'work', icon: '👑', name: 'Grand Master', desc: 'Work for 1000 hours total', condition: s => getTotalHours('Working', s) >= 1000 },
  { id: 'study_1h', category: 'study', icon: '📖', name: 'First Lesson', desc: 'Study for 1 hour total', condition: s => getTotalHours('Studying', s) >= 1 },
  { id: 'study_5h', category: 'study', icon: '📚', name: 'Eager Student', desc: 'Study for 5 hours total', condition: s => getTotalHours('Studying', s) >= 5 },
  { id: 'study_10h', category: 'study', icon: '🎓', name: 'Scholar Initiate', desc: 'Study for 10 hours total', condition: s => getTotalHours('Studying', s) >= 10 },
  { id: 'study_20h', category: 'study', icon: '🔮', name: 'Arcane Student', desc: 'Study for 20 hours total', condition: s => getTotalHours('Studying', s) >= 20 },
  { id: 'study_50h', category: 'study', icon: '✨', name: 'Knowledge Seeker', desc: 'Study for 50 hours total', condition: s => getTotalHours('Studying', s) >= 50 },
  { id: 'study_100h', category: 'study', icon: '🌙', name: 'Moonlit Scholar', desc: 'Study for 100 hours total', condition: s => getTotalHours('Studying', s) >= 100 },
  { id: 'study_250h', category: 'study', icon: '⭐', name: 'Star Reader', desc: 'Study for 250 hours total', condition: s => getTotalHours('Studying', s) >= 250 },
  { id: 'study_500h', category: 'study', icon: '🌟', name: 'Grand Scholar', desc: 'Study for 500 hours total', condition: s => getTotalHours('Studying', s) >= 500 },
  { id: 'study_1000h', category: 'study', icon: '👑', name: 'Sage of Aureole', desc: 'Study for 1000 hours total', condition: s => getTotalHours('Studying', s) >= 1000 },
  { id: 'streak_3', category: 'streak', icon: '🔥', name: 'Spark Kindled', desc: '3-day streak', condition: s => s.profile.streakData.currentStreak >= 3 },
  { id: 'streak_7', category: 'streak', icon: '🔥', name: 'Week Warrior', desc: '7-day streak', condition: s => s.profile.streakData.currentStreak >= 7 },
  { id: 'streak_14', category: 'streak', icon: '💥', name: 'Fortnight Flame', desc: '14-day streak', condition: s => s.profile.streakData.currentStreak >= 14 },
  { id: 'streak_30', category: 'streak', icon: '🌟', name: 'Monthly Mage', desc: '30-day streak', condition: s => s.profile.streakData.currentStreak >= 30 },
  { id: 'streak_60', category: 'streak', icon: '✨', name: 'Consistent Caster', desc: '60-day streak', condition: s => s.profile.streakData.currentStreak >= 60 },
  { id: 'streak_100', category: 'streak', icon: '💫', name: 'Eternal Flame', desc: '100-day streak', condition: s => s.profile.streakData.currentStreak >= 100 },
  { id: 'streak_365', category: 'streak', icon: '👑', name: 'Year of Aureole', desc: '365-day streak', condition: s => s.profile.streakData.currentStreak >= 365 },
  { id: 'journal_1', category: 'journal', icon: '✏️', name: 'First Words', desc: 'Write your first journal entry', condition: s => Object.keys(s.journal.entries).length >= 1 },
  { id: 'journal_10', category: 'journal', icon: '📓', name: 'Diary Keeper', desc: '10 journal entries', condition: s => Object.keys(s.journal.entries).length >= 10 },
  { id: 'journal_50', category: 'journal', icon: '📔', name: 'Chronicle Writer', desc: '50 journal entries', condition: s => Object.keys(s.journal.entries).length >= 50 },
  { id: 'journal_100', category: 'journal', icon: '📒', name: 'Prolific Scribe', desc: '100 journal entries', condition: s => Object.keys(s.journal.entries).length >= 100 },
  { id: 'journal_365', category: 'journal', icon: '📗', name: 'Yearlong Narrator', desc: '365 journal entries', condition: s => Object.keys(s.journal.entries).length >= 365 },
  { id: 'grimoire_1', category: 'grimoire', icon: '🔮', name: 'First Spell', desc: 'Create your first grimoire note', condition: s => s.grimoire.notes.length >= 1 },
  { id: 'grimoire_25', category: 'grimoire', icon: '📜', name: 'Spellcrafter', desc: '25 grimoire notes', condition: s => s.grimoire.notes.length >= 25 },
  { id: 'grimoire_50', category: 'grimoire', icon: '📚', name: 'Tome Collector', desc: '50 grimoire notes', condition: s => s.grimoire.notes.length >= 50 },
  { id: 'grimoire_100', category: 'grimoire', icon: '🏛️', name: 'Arcane Library', desc: '100 grimoire notes', condition: s => s.grimoire.notes.length >= 100 },
  { id: 'session_1', category: 'session', icon: '⏱️', name: 'First Quest', desc: 'Complete your first session', condition: s => s.sessions.length >= 1 },
  { id: 'session_10', category: 'session', icon: '🎯', name: 'Focused Traveler', desc: '10 completed sessions', condition: s => s.sessions.length >= 10 },
  { id: 'session_50', category: 'session', icon: '🎪', name: 'Experienced Mage', desc: '50 completed sessions', condition: s => s.sessions.length >= 50 },
  { id: 'session_100', category: 'session', icon: '💎', name: 'Century Caster', desc: '100 completed sessions', condition: s => s.sessions.length >= 100 },
  { id: 'session_500', category: 'session', icon: '🌌', name: 'Archmage of Focus', desc: '500 completed sessions', condition: s => s.sessions.length >= 500 },
  { id: 'night_owl', category: 'special', icon: '🦉', name: 'Night Owl', desc: 'Complete a session after midnight', condition: s => s.sessions.some(sess => new Date(sess.startTimestamp).getHours() >= 0 && new Date(sess.startTimestamp).getHours() < 4) },
  { id: 'early_bird', category: 'special', icon: '🐦', name: 'Early Bird', desc: 'Complete a session before 6 AM', condition: s => s.sessions.some(sess => new Date(sess.startTimestamp).getHours() < 6) },
  { id: 'marathon', category: 'special', icon: '🏃', name: 'Marathon Runner', desc: 'Complete a session of 4+ hours', condition: s => s.sessions.some(sess => sess.duration >= 4 * 3600000) },
  { id: 'zen_master', category: 'special', icon: '🧘', name: 'Zen Master', desc: 'Use breathing exercise 10 times', condition: s => (s.breathingCount || 0) >= 10 },
  { id: 'century_scholar', category: 'special', icon: '📐', name: 'Century Scholar', desc: 'Accumulate 100 total hours', condition: s => getAllTotalHours(s) >= 100 },
  { id: 'millennium_mage', category: 'special', icon: '🌌', name: 'Millennium Mage', desc: 'Accumulate 1000 total hours', condition: s => getAllTotalHours(s) >= 1000 },
];

let achievementQueue = [];

function checkAchievements() {
  let newUnlocks = false;
  ACHIEVEMENTS.forEach(achievement => {
    if (!state.profile.achievements[achievement.id]) {
      try {
        if (achievement.condition(state)) {
          state.profile.achievements[achievement.id] = { unlockedAt: Date.now() };
          addChronicleEvent('achievement', achievement.name, achievement.desc, 'achievement');
          achievementQueue.push(achievement);
          newUnlocks = true;
        }
      } catch (e) {
        console.warn('Achievement check error:', achievement.id, e);
      }
    }
  });
  if (newUnlocks) {
    showNextAchievement();
  }
}

function showNextAchievement() {
  if (achievementQueue.length === 0) return;
  const achievement = achievementQueue.shift();

  const modal = document.getElementById('achievement-modal');
  const iconEl = document.getElementById('achievement-icon-large');
  const nameEl = document.getElementById('achievement-modal-name');
  const descEl = document.getElementById('achievement-modal-desc');
  const closeBtn = document.getElementById('close-achievement-modal');

  if (iconEl) iconEl.textContent = achievement.icon;
  if (nameEl) nameEl.textContent = achievement.name;
  if (descEl) descEl.textContent = achievement.desc;
  if (modal) modal.classList.remove('hidden');

  if (closeBtn) {
    const handler = () => {
      modal.classList.add('hidden');
      closeBtn.removeEventListener('click', handler);
      showNextAchievement();
    };
    closeBtn.addEventListener('click', handler);
  }

  const rankEl = document.getElementById('profile-rank');
  if (rankEl) rankEl.textContent = calculateRank(getAllTotalHours());
  renderAchievementRack();
  saveState();
}

function renderAchievementRack() {
  const rack = document.getElementById('achievement-rack');
  if (!rack) return;
  rack.innerHTML = '';

  const categories = ['work', 'study', 'streak', 'journal', 'grimoire', 'session', 'special'];
  const categoryLabels = {
    work: '⚒️ Work', study: '📚 Study', streak: '🔥 Streaks',
    journal: '📖 Journal', grimoire: '🔮 Grimoire', session: '⏱️ Sessions', special: '✨ Special'
  };

  categories.forEach(cat => {
    const catAchievements = ACHIEVEMENTS.filter(a => a.category === cat);
    if (catAchievements.length === 0) return;

    const group = document.createElement('div');
    group.className = 'achievement-group';
    group.innerHTML = `<div class="achievement-category-label">${categoryLabels[cat]}</div>`;

    const badgesRow = document.createElement('div');
    badgesRow.className = 'achievement-badges-row';

    catAchievements.forEach(a => {
      const isUnlocked = !!state.profile.achievements[a.id];
      const badge = document.createElement('div');
      badge.className = 'achievement-badge ' + (isUnlocked ? 'unlocked' : 'locked');
      badge.textContent = isUnlocked ? a.icon : '?';

      const tooltip = document.createElement('div');
      tooltip.className = 'badge-tooltip';
      const nameEl = document.createElement('strong');
      nameEl.textContent = a.name;
      const descEl = document.createElement('span');
      descEl.textContent = a.desc;
      tooltip.appendChild(nameEl);
      tooltip.appendChild(document.createElement('br'));
      tooltip.appendChild(descEl);
      if (isUnlocked) {
        const unlockDate = new Date(state.profile.achievements[a.id].unlockedAt).toLocaleDateString();
        tooltip.appendChild(document.createElement('br'));
        const dateEl = document.createElement('em');
        dateEl.textContent = 'Unlocked: ' + unlockDate;
        tooltip.appendChild(dateEl);
      }
      badge.appendChild(tooltip);
      badgesRow.appendChild(badge);
    });

    group.appendChild(badgesRow);
    rack.appendChild(group);
  });
}

// ===== SETTINGS SECTION =====

function loadSettings() {
  const s = state.settings;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('accent-color', s.accentColor);
  set('font-size-range', s.fontSize);
  setText('font-size-display', s.fontSize);
  set('animation-intensity', s.animationIntensity);
  setText('animation-intensity-display', s.animationIntensity);
  set('border-style', s.borderStyle);
  set('default-duration', s.defaultDuration);
  set('pomodoro-work', s.pomodoroWork);
  set('pomodoro-break', s.pomodoroBreak);
  set('break-interval', s.breakInterval);
  set('hyperfocus-guard', s.hyperfocusGuard);
  setChecked('sound-enabled', s.soundEnabled);
  setChecked('notifications-enabled', s.notificationsEnabled);
  set('youtube-url', s.youtubeUrl);
  set('player-size', s.playerSize);
  setChecked('reduce-animations', s.reduceAnimations);
  setChecked('high-contrast', s.highContrast);
  setChecked('auto-break', s.autoBreakEnforcement);
  setChecked('task-chunking', s.taskChunkingMode);
  setChecked('low-demand', s.lowDemandMode);

  renderCategoriesList();
}

function saveSettings() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : null; };
  const getChecked = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const getNum = id => { const v = get(id); return v !== null ? parseFloat(v) : null; };

  if (get('accent-color')) state.settings.accentColor = get('accent-color');
  if (getNum('font-size-range') !== null) state.settings.fontSize = getNum('font-size-range');
  if (getNum('animation-intensity') !== null) state.settings.animationIntensity = getNum('animation-intensity');
  if (get('border-style')) state.settings.borderStyle = get('border-style');
  if (getNum('default-duration') !== null) state.settings.defaultDuration = getNum('default-duration');
  if (getNum('pomodoro-work') !== null) state.settings.pomodoroWork = getNum('pomodoro-work');
  if (getNum('pomodoro-break') !== null) state.settings.pomodoroBreak = getNum('pomodoro-break');
  if (getNum('break-interval') !== null) state.settings.breakInterval = getNum('break-interval');
  if (getNum('hyperfocus-guard') !== null) state.settings.hyperfocusGuard = getNum('hyperfocus-guard');
  state.settings.soundEnabled = getChecked('sound-enabled');
  state.settings.notificationsEnabled = getChecked('notifications-enabled');
  state.settings.reduceAnimations = getChecked('reduce-animations');
  state.settings.highContrast = getChecked('high-contrast');
  state.settings.autoBreakEnforcement = getChecked('auto-break');
  state.settings.taskChunkingMode = getChecked('task-chunking');
  state.settings.lowDemandMode = getChecked('low-demand');

  applySettings();
  saveState();
}

function applySettings() {
  const s = state.settings;
  const root = document.documentElement;

  root.style.setProperty('--accent-primary', s.accentColor);
  root.style.setProperty('--font-size-base', s.fontSize + 'px');
  root.style.setProperty('--animation-speed', s.animationIntensity / 100);

  if (s.reduceAnimations) {
    document.body.classList.add('reduce-animations');
  } else {
    document.body.classList.remove('reduce-animations');
  }

  if (s.highContrast) {
    document.body.classList.add('high-contrast');
  } else {
    document.body.classList.remove('high-contrast');
  }

  if (s.backgroundImage) {
    root.style.setProperty('--bg-image', 'url(' + s.backgroundImage + ')');
  } else {
    root.style.removeProperty('--bg-image');
  }

  const walkingChar = document.getElementById('walking-character');
  if (walkingChar && s.walkingCharacter) {
    const img = document.createElement('img');
    img.alt = 'Character';
    img.style.height = '100%';
    img.style.width = 'auto';
    img.src = s.walkingCharacter;
    walkingChar.innerHTML = '';
    walkingChar.appendChild(img);
  } else if (walkingChar && !s.walkingCharacter) {
    walkingChar.innerHTML = '<div class="character-emoji">🧙</div>';
  }

  if (s.youtubeUrl) {
    const match = s.youtubeUrl.match(/(?:v=|youtu\.be\/|embed\/)([^&?/]+)/);
    if (match) {
      const videoId = match[1];
      const iframe = document.getElementById('youtube-iframe');
      if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        iframe.className = 'youtube-iframe player-' + (s.playerSize || 'medium');
      }
    }
  }

  populateCategorySelects();
}

function populateCategorySelects() {
  const selects = ['category-select', 'capture-category'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '';
    state.settings.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = `${cat.icon} ${cat.name}`;
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
  });
}

function renderCategoriesList() {
  const listEl = document.getElementById('categories-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  state.settings.categories.forEach((cat, idx) => {
    const item = document.createElement('div');
    item.className = 'category-item';
    item.innerHTML = `
      <span class="cat-icon">${escapeHtml(cat.icon)}</span>
      <span class="cat-name">${escapeHtml(cat.name)}</span>
      <button class="btn-delete-cat" data-idx="${idx}" title="Delete category">✕</button>
    `;
    item.querySelector('.btn-delete-cat').addEventListener('click', () => {
      state.settings.categories.splice(idx, 1);
      renderCategoriesList();
      populateCategorySelects();
      saveState();
    });
    listEl.appendChild(item);
  });
}

function addCategory() {
  const nameEl = document.getElementById('new-category-name');
  const iconEl = document.getElementById('new-category-icon');
  if (!nameEl) return;
  const name = nameEl.value.trim();
  const icon = iconEl ? iconEl.value.trim() || '📌' : '📌';
  if (!name) return;

  state.settings.categories.push({ name, icon, color: '#c3b7e6' });
  if (nameEl) nameEl.value = '';
  if (iconEl) iconEl.value = '';
  renderCategoriesList();
  populateCategorySelects();
  saveState();
}

function setupSettingsControls() {
  const settingsInputIds = [
    'accent-color', 'border-style', 'default-duration', 'pomodoro-work',
    'pomodoro-break', 'break-interval', 'hyperfocus-guard', 'sound-enabled',
    'notifications-enabled', 'player-size', 'reduce-animations', 'high-contrast',
    'auto-break', 'task-chunking', 'low-demand'
  ];

  settingsInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', saveSettings);
  });

  const fontRange = document.getElementById('font-size-range');
  const fontDisplay = document.getElementById('font-size-display');
  if (fontRange) {
    fontRange.addEventListener('input', () => {
      if (fontDisplay) fontDisplay.textContent = fontRange.value;
      saveSettings();
    });
  }

  const animRange = document.getElementById('animation-intensity');
  const animDisplay = document.getElementById('animation-intensity-display');
  if (animRange) {
    animRange.addEventListener('input', () => {
      if (animDisplay) animDisplay.textContent = animRange.value;
      saveSettings();
    });
  }

  const bgUpload = document.getElementById('bg-upload');
  if (bgUpload) {
    bgUpload.addEventListener('change', () => {
      const file = bgUpload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        state.settings.backgroundImage = e.target.result;
        applySettings();
        saveState();
      };
      reader.readAsDataURL(file);
    });
  }

  const charUpload = document.getElementById('character-upload');
  if (charUpload) {
    charUpload.addEventListener('change', () => {
      const file = charUpload.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        state.settings.walkingCharacter = e.target.result;
        applySettings();
        saveState();
      };
      reader.readAsDataURL(file);
    });
  }

  const applyYoutubeBtn = document.getElementById('apply-youtube-btn');
  if (applyYoutubeBtn) {
    applyYoutubeBtn.addEventListener('click', () => {
      const urlEl = document.getElementById('youtube-url');
      if (urlEl) state.settings.youtubeUrl = urlEl.value;
      applySettings();
      saveState();
    });
  }

  const addCatBtn = document.getElementById('add-category-btn');
  if (addCatBtn) addCatBtn.addEventListener('click', addCategory);

  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importInput = document.getElementById('import-data-input');
  if (importInput) {
    importInput.addEventListener('change', () => {
      const file = importInput.files[0];
      if (file) importData(file);
    });
  }

  const resetBtn = document.getElementById('reset-data-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      showConfirmModal('Reset All Data', 'This will permanently delete all your data. Are you sure?', () => {
        localStorage.clear();
        location.reload();
      });
    });
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'aureole-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      state = deepMerge(DEFAULT_STATE, parsed);
      saveState();
      location.reload();
    } catch (err) {
      showToast('❌ Failed to import data. Invalid file format.');
    }
  };
  reader.readAsText(file);
}

// ===== BREATHING EXERCISE =====

let breathingState = {
  isRunning: false,
  phase: 0,
  count: 0,
  cycleCount: 0,
  countInterval: null,
  phaseTimeout: null
};

const breathingPhases = ['Inhale', 'Hold', 'Exhale', 'Hold'];
const breathingClasses = ['breathing-inhale', 'breathing-hold', 'breathing-exhale', 'breathing-hold'];

function startBreathing() {
  breathingState.isRunning = true;
  breathingState.phase = 0;
  breathingState.count = 4;
  breathingState.cycleCount = 0;

  const startBtn = document.getElementById('start-breathing-btn');
  const stopBtn = document.getElementById('stop-breathing-btn');
  if (startBtn) startBtn.classList.add('hidden');
  if (stopBtn) stopBtn.classList.remove('hidden');

  runBreathingPhase();
}

function runBreathingPhase() {
  if (!breathingState.isRunning) return;

  const phaseName = breathingPhases[breathingState.phase];
  const phaseClass = breathingClasses[breathingState.phase];

  const phaseEl = document.getElementById('breathing-phase');
  const circle = document.querySelector('.breathing-circle');
  const countEl = document.querySelector('.breathing-count');
  const textEl = document.querySelector('.breathing-text');

  if (phaseEl) phaseEl.textContent = phaseName;

  if (circle) {
    circle.classList.remove('breathing-inhale', 'breathing-hold', 'breathing-exhale');
    circle.classList.add(phaseClass);
  }

  if (textEl) textEl.textContent = phaseName;

  breathingState.count = 4;
  if (countEl) countEl.textContent = breathingState.count;

  clearInterval(breathingState.countInterval);
  breathingState.countInterval = setInterval(() => {
    breathingState.count--;
    if (countEl) countEl.textContent = Math.max(0, breathingState.count);
    if (breathingState.count <= 0) {
      clearInterval(breathingState.countInterval);
      nextBreathingPhase();
    }
  }, 1000);
}

function nextBreathingPhase() {
  if (!breathingState.isRunning) return;
  breathingState.phase = (breathingState.phase + 1) % 4;
  if (breathingState.phase === 0) {
    breathingState.cycleCount++;
    const cycleEl = document.getElementById('breathing-cycles');
    if (cycleEl) cycleEl.textContent = breathingState.cycleCount;
  }
  if (breathingState.isRunning) {
    runBreathingPhase();
  }
}

function stopBreathing() {
  clearInterval(breathingState.countInterval);
  clearTimeout(breathingState.phaseTimeout);
  breathingState.isRunning = false;

  const circle = document.querySelector('.breathing-circle');
  if (circle) circle.classList.remove('breathing-inhale', 'breathing-hold', 'breathing-exhale');

  const phaseEl = document.getElementById('breathing-phase');
  const textEl = document.querySelector('.breathing-text');
  const countEl = document.querySelector('.breathing-count');
  if (phaseEl) phaseEl.textContent = 'Ready';
  if (textEl) textEl.textContent = '';
  if (countEl) countEl.textContent = '';

  const startBtn = document.getElementById('start-breathing-btn');
  const stopBtn = document.getElementById('stop-breathing-btn');
  if (startBtn) startBtn.classList.remove('hidden');
  if (stopBtn) stopBtn.classList.add('hidden');

  state.breathingCount = (state.breathingCount || 0) + 1;
  saveState();
  checkAchievements();
}

function setupBreathingExercise() {
  const fab = document.getElementById('breathing-fab');
  const modal = document.getElementById('breathing-modal');
  const closeBtn = document.getElementById('close-breathing-modal');
  const startBtn = document.getElementById('start-breathing-btn');
  const stopBtn = document.getElementById('stop-breathing-btn');

  if (fab) {
    fab.addEventListener('click', () => {
      if (modal) modal.classList.remove('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
      if (breathingState.isRunning) stopBreathing();
    });
  }

  if (startBtn) startBtn.addEventListener('click', startBreathing);
  if (stopBtn) stopBtn.addEventListener('click', stopBreathing);

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.classList.add('hidden');
        if (breathingState.isRunning) stopBreathing();
      }
    });
  }
}

// ===== QUICK CAPTURE =====

function openQuickCapture() {
  const modal = document.getElementById('quick-capture-modal');
  const textarea = document.getElementById('quick-capture-text');
  const categoryEl = document.getElementById('capture-category');

  if (modal) modal.classList.remove('hidden');
  if (textarea) {
    textarea.value = '';
    setTimeout(() => textarea.focus(), 100);
  }

  if (categoryEl) {
    categoryEl.innerHTML = '';
    state.grimoire.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryEl.appendChild(opt);
    });
  }
}

function saveCapture() {
  const textarea = document.getElementById('quick-capture-text');
  const categoryEl = document.getElementById('capture-category');
  if (!textarea) return;
  const text = textarea.value.trim();
  if (!text) return;

  const lines = text.split('\n');
  const title = lines[0].trim() || 'Quick Note';
  const category = categoryEl ? categoryEl.value : (state.grimoire.categories[0] || 'General');

  const note = {
    id: generateId(),
    title,
    content: text,
    category,
    tags: [],
    pinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  state.grimoire.notes.push(note);
  addChronicleEvent('grimoire', 'Quick Note Captured', title, 'grimoire');
  checkAchievements();

  const modal = document.getElementById('quick-capture-modal');
  if (modal) modal.classList.add('hidden');

  saveState();
  loadGrimoire();
  showToast('✨ Note captured!');
}

function setupQuickCapture() {
  const fab = document.getElementById('quick-capture-fab');
  const saveBtn = document.getElementById('save-capture-btn');
  const closeBtn = document.getElementById('close-capture-modal');
  const modal = document.getElementById('quick-capture-modal');

  if (fab) fab.addEventListener('click', openQuickCapture);
  if (saveBtn) saveBtn.addEventListener('click', saveCapture);

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
}

// ===== PARTICLES =====

function createParticles(count) {
  count = count || 8;
  let container = document.getElementById('particles-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'particles-container';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0;';
    document.body.appendChild(container);
  }

  const colors = ['rgba(195,183,230,0.7)', 'rgba(226,187,102,0.7)', 'rgba(126,184,218,0.7)'];

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    const x = Math.random() * 100;
    const size = 4 + Math.random() * 4;
    const duration = 15 + Math.random() * 10;
    const delay = -(Math.random() * 15);
    const color = colors[Math.floor(Math.random() * colors.length)];

    particle.style.cssText = `
      position: absolute;
      left: ${x}vw;
      bottom: 0;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: ${color};
      animation: float ${duration}s ${delay}s linear infinite;
      pointer-events: none;
    `;
    container.appendChild(particle);
  }
}

// ===== NOTIFICATIONS & REMINDERS =====

function requestNotificationPermission() {
  if ('Notification' in window && state.settings.notificationsEnabled) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(e => console.warn('Notification permission error:', e));
    }
  }
}

function sendNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '✨' });
    } catch (e) {
      console.warn('Notification error:', e);
    }
  }
}

function loadReminders() {
  const listEl = document.getElementById('reminders-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (state.reminders.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No reminders set.</div>';
    return;
  }

  state.reminders.forEach((reminder, idx) => {
    const item = document.createElement('div');
    item.className = 'reminder-item';
    item.innerHTML = `
      <span class="reminder-time">${escapeHtml(reminder.time)}</span>
      <span class="reminder-msg">${escapeHtml(reminder.message)}</span>
      <button class="btn-toggle-reminder" data-idx="${idx}">${reminder.enabled ? '🔔' : '🔕'}</button>
      <button class="btn-delete-reminder" data-idx="${idx}">✕</button>
    `;
    item.querySelector('.btn-toggle-reminder').addEventListener('click', () => {
      state.reminders[idx].enabled = !state.reminders[idx].enabled;
      saveState();
      loadReminders();
    });
    item.querySelector('.btn-delete-reminder').addEventListener('click', () => {
      state.reminders.splice(idx, 1);
      saveState();
      loadReminders();
    });
    listEl.appendChild(item);
  });
}

function checkReminders() {
  const now = new Date();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  state.reminders.forEach(reminder => {
    if (reminder.enabled && reminder.time === currentTime) {
      sendNotification('Aureole Reminder', reminder.message);
      showToast(`🔔 ${reminder.message}`);
    }
  });
}

function addReminder(time, message) {
  state.reminders.push({ id: generateId(), time, message, enabled: true });
  saveState();
  loadReminders();
}

function setupReminders() {
  const addBtn = document.getElementById('add-reminder-btn');
  const saveBtn = document.getElementById('save-reminder-btn');
  const closeBtn = document.getElementById('close-reminder-modal');
  const modal = document.getElementById('reminder-modal');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('hidden');
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const timeEl = document.getElementById('reminder-time-input');
      const msgEl = document.getElementById('reminder-message-input');
      if (!timeEl || !msgEl) return;
      const time = timeEl.value;
      const message = msgEl.value.trim();
      if (!time || !message) { showToast('Please set a time and message.'); return; }
      addReminder(time, message);
      timeEl.value = '';
      msgEl.value = '';
      if (modal) modal.classList.add('hidden');
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
    });
  }

  if (modal) {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  setInterval(checkReminders, 60000);
}

function loadDailyPlanner() {
  const today = new Date().toISOString().split('T')[0];
  if (state.dailyPlanner.lastResetDate !== today) {
    state.dailyPlanner.tasks = state.dailyPlanner.tasks.filter(t => !t.done);
    state.dailyPlanner.lastResetDate = today;
    saveState();
  }
  renderTaskList();
}

function renderTaskList() {
  const listEl = document.getElementById('task-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (state.dailyPlanner.tasks.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No tasks yet. Add one!</div>';
    return;
  }

  state.dailyPlanner.tasks.forEach((task, idx) => {
    const item = document.createElement('div');
    item.className = 'task-item priority-' + (task.priority || 'medium') + (task.done ? ' done' : '');
    item.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''}>
      <span class="task-text">${escapeHtml(task.text)}</span>
      <span class="task-priority-badge">${escapeHtml(task.priority || 'medium')}</span>
      <button class="btn-delete-task" data-idx="${idx}">✕</button>
    `;
    item.querySelector('.task-checkbox').addEventListener('change', e => {
      state.dailyPlanner.tasks[idx].done = e.target.checked;
      saveState();
      renderTaskList();
    });
    item.querySelector('.btn-delete-task').addEventListener('click', () => {
      state.dailyPlanner.tasks.splice(idx, 1);
      saveState();
      renderTaskList();
    });
    listEl.appendChild(item);
  });
}

function addTask(text, priority) {
  if (!text || !text.trim()) return;
  state.dailyPlanner.tasks.push({
    id: generateId(),
    text: text.trim(),
    priority: priority || 'normal',
    done: false,
    createdAt: Date.now()
  });
  saveState();
  renderTaskList();
}

function loadRoutines() {
  const listEl = document.getElementById('routines-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (state.routines.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No routines saved.</div>';
    return;
  }

  state.routines.forEach((routine, idx) => {
    const item = document.createElement('div');
    item.className = 'routine-item';
    item.innerHTML = `
      <div class="routine-info">
        <span class="routine-name">${escapeHtml(routine.name)}</span>
        <span class="routine-meta">${escapeHtml(routine.category)} · ${escapeHtml(String(routine.durationMinutes))}min</span>
      </div>
      <div class="routine-actions">
        <button class="btn-start-routine" data-idx="${idx}">▶ Start</button>
        <button class="btn-delete-routine" data-idx="${idx}">✕</button>
      </div>
    `;
    item.querySelector('.btn-start-routine').addEventListener('click', () => {
      state.settings.defaultDuration = routine.durationMinutes;
      state.timer.category = routine.category;
      const catSelect = document.getElementById('category-select');
      if (catSelect) catSelect.value = routine.category;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const journeyTab = document.querySelector('[data-tab="journey"]');
      const journeyPanel = document.getElementById('tab-journey');
      if (journeyTab) journeyTab.classList.add('active');
      if (journeyPanel) journeyPanel.classList.add('active');
      showToast(`⚔️ Routine "${routine.name}" loaded! Set your energy and start.`);
    });
    item.querySelector('.btn-delete-routine').addEventListener('click', () => {
      state.routines.splice(idx, 1);
      saveState();
      loadRoutines();
    });
    listEl.appendChild(item);
  });
}

function addRoutine(name, category, durationMinutes) {
  state.routines.push({
    id: generateId(),
    name,
    category,
    durationMinutes: parseInt(durationMinutes, 10)
  });
  saveState();
  loadRoutines();
}

// ===== ADHD FEATURES =====

const MOTIVATIONAL_QUOTES = [
  "Every wizard begins with a single spell. Begin yours today.",
  "The journey of a thousand miles begins with one focused step.",
  "Your quest is not about perfection—it's about progress.",
  "Even the mightiest archmage started as an apprentice.",
  "Magic is just consistent effort, made visible.",
  "You have survived every challenge so far. This one is no different.",
  "Small consistent steps forge the greatest legends.",
  "The grimoire of success is written one page at a time.",
  "Your focus is your most powerful spell. Cast it wisely.",
  "Rest is not giving up—it's recharging your power.",
  "You don't have to be great to start, but you have to start to be great.",
  "The path forward is one breath, one moment, one task at a time.",
  "Every day you show up, the universe conspires to help you.",
  "Brave is not the absence of fear—it's sitting down to work anyway.",
  "Your future self is cheering for you right now.",
  "The treasure you seek is at the end of today's task.",
  "In the kingdom of focus, even 10 minutes is gold.",
  "You are the hero of your own story. Write the next chapter.",
  "Progress over perfection—always.",
  "Your brilliance needs only direction. You have it.",
  "Even stars rest between their shining.",
  "The scroll of achievement is filled line by line.",
];

const REINFORCEMENT_MESSAGES = [
  "✨ Quest Complete! You're a legend!",
  "🌟 Session finished! The realm grows stronger!",
  "⚡ Incredible work! Your focus shines bright!",
  "🔥 You crushed it! Another victory for the chronicles!",
  "💫 Achievement unlocked! Keep wielding that focus!",
  "🎯 Bullseye! Another session conquered!",
  "🏆 The archmage would be proud of your dedication!",
  "✦ You've added another chapter to your legend!",
  "🌙 Magnificent! The stars align in your favor!",
  "⚔️ Another battle won through sheer determination!",
  "🔮 Your magic grows stronger with each session!",
  "📜 The chronicles record your triumph today!",
  "🌟 Brilliant! You made it happen again!",
  "💎 Your focus is truly a rare gem!",
  "🧙 A true mage of productivity!",
];

const QUOTE_FADE_MS = 500; // matches CSS opacity transition duration

function rotateMotivationalQuote() {
  const el = document.getElementById('motivational-quote');
  if (!el) return;
  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = '"' + quote + '"';
    el.style.opacity = '1';
  }, QUOTE_FADE_MS);
}

function showReinforcementMessage(msg) {
  msg = msg || REINFORCEMENT_MESSAGES[Math.floor(Math.random() * REINFORCEMENT_MESSAGES.length)];
  const toast = document.getElementById('reinforcement-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showToast(msg) {
  const toast = document.getElementById('toast-notification');
  if (!toast) {
    const t = document.createElement('div');
    t.id = 'toast-notification';
    t.className = 'toast-notification';
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(195,183,230,0.95);color:#1a1535;padding:12px 20px;border-radius:8px;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.3s;';
    document.body.appendChild(t);
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 2800);
    return;
  }
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

function updateEnergySuggestion(level) {
  const el = document.getElementById('energy-suggestion');
  if (!el) return;
  const suggestions = {
    1: "Low energy? Try a 15-minute gentle session. Be kind to yourself. 💙",
    2: "A bit tired? A 20-minute session with breaks can still be productive. 🌙",
    3: "Good baseline energy! A standard 25-minute session awaits. ⚡",
    4: "Great energy! Push for a full 45-minute deep work session. 🔥",
    5: "Maximum power! This is your moment for a 90-minute quest! ✨"
  };
  el.textContent = suggestions[level] || '';
}

function checkWeeklyReview() {
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek !== 0) return;

  const last = state.weeklyReview.lastPromptDate;
  const now = Date.now();
  if (last && (now - last) < 7 * 24 * 60 * 60 * 1000) return;

  const modal = document.getElementById('weekly-review-modal');
  if (!modal) return;

  const weekSessions = state.sessions.filter(s => {
    return s.startTimestamp && (now - s.startTimestamp) < 7 * 24 * 60 * 60 * 1000;
  });
  const weekHours = (weekSessions.reduce((a, s) => a + (s.duration || 0), 0) / 3600000).toFixed(1);
  const weekJournal = Object.entries(state.journal.entries).filter(([d]) => {
    const ts = new Date(d).getTime();
    return (now - ts) < 7 * 24 * 60 * 60 * 1000;
  }).length;

  const statsEl = document.getElementById('weekly-review-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div>Sessions this week: <strong>${weekSessions.length}</strong></div>
      <div>Hours this week: <strong>${weekHours}h</strong></div>
      <div>Journal entries: <strong>${weekJournal}</strong></div>
    `;
  }

  modal.classList.remove('hidden');
}

function setupADHDFeatures() {
  const addTaskBtn = document.getElementById('add-task-btn');
  const taskInput = document.getElementById('task-input');
  const taskPriority = document.getElementById('priority-select');

  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => {
      if (!taskInput) return;
      const priority = taskPriority ? taskPriority.value : 'normal';
      addTask(taskInput.value, priority);
      taskInput.value = '';
    });
  }

  if (taskInput) {
    taskInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const priority = taskPriority ? taskPriority.value : 'normal';
        addTask(taskInput.value, priority);
        taskInput.value = '';
      }
    });
  }

  const addRoutineBtn = document.getElementById('add-routine-btn');
  const routineModal = document.getElementById('routine-modal');
  const saveRoutineBtn = document.getElementById('save-routine-btn');
  const closeRoutineModal = document.getElementById('close-routine-modal');

  if (addRoutineBtn) {
    addRoutineBtn.addEventListener('click', () => {
      if (routineModal) routineModal.classList.remove('hidden');
    });
  }

  if (saveRoutineBtn) {
    saveRoutineBtn.addEventListener('click', () => {
      const nameEl = document.getElementById('routine-name-input');
      const catEl = document.getElementById('routine-category-input');
      const durEl = document.getElementById('routine-duration-input');
      if (!nameEl || !durEl) return;
      const name = nameEl.value.trim();
      const cat = catEl ? catEl.value.trim() || 'Working' : 'Working';
      const dur = durEl.value;
      if (!name || !dur) { showToast('Please fill in all routine fields.'); return; }
      addRoutine(name, cat, dur);
      nameEl.value = '';
      if (catEl) catEl.value = '';
      durEl.value = '';
      if (routineModal) routineModal.classList.add('hidden');
    });
  }

  if (closeRoutineModal) {
    closeRoutineModal.addEventListener('click', () => {
      if (routineModal) routineModal.classList.add('hidden');
    });
  }

  if (routineModal) {
    routineModal.addEventListener('click', e => {
      if (e.target === routineModal) routineModal.classList.add('hidden');
    });
  }

  const dismissHyperfocus = document.getElementById('dismiss-hyperfocus-btn');
  if (dismissHyperfocus) {
    dismissHyperfocus.addEventListener('click', () => {
      const warning = document.getElementById('hyperfocus-warning');
      if (warning) warning.classList.add('hidden');
    });
  }

  const saveWeeklyReview = document.getElementById('save-weekly-review-btn');
  if (saveWeeklyReview) {
    saveWeeklyReview.addEventListener('click', () => {
      state.weeklyReview.lastPromptDate = Date.now();
      const modal = document.getElementById('weekly-review-modal');
      if (modal) modal.classList.add('hidden');
      saveState();
    });
  }

  const dismissWeeklyReview = document.getElementById('dismiss-weekly-review-btn');
  if (dismissWeeklyReview) {
    dismissWeeklyReview.addEventListener('click', () => {
      state.weeklyReview.lastPromptDate = Date.now();
      const modal = document.getElementById('weekly-review-modal');
      if (modal) modal.classList.add('hidden');
      saveState();
    });
  }
}

// ===== KEYBOARD SHORTCUTS =====

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const tag = e.target.tagName.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || e.target.contentEditable === 'true';

    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
      if (breathingState.isRunning) stopBreathing();
      return;
    }

    if (isTyping) return;

    if (e.key === 'b' || e.key === 'B') {
      const modal = document.getElementById('breathing-modal');
      if (modal) modal.classList.toggle('hidden');
    }

    if (e.key === 'f' || e.key === 'F') {
      toggleFocusMode();
    }

    if (e.key === ' ') {
      e.preventDefault();
      if (state.timer.isRunning) {
        pauseTimer();
      } else if (state.timer.isPaused) {
        resumeTimer();
      } else {
        startTimer();
      }
    }

    if (e.key === 'q' || e.key === 'Q') {
      openQuickCapture();
    }
  });
}

function toggleFocusMode() {
  state.settings.focusMode = !state.settings.focusMode;
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.style.display = state.settings.focusMode ? 'none' : 'flex';
  }
}

// ===== INIT =====

function showConfirmModal(title, message, onConfirm) {
  let modal = document.getElementById('confirm-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#1e1a3a;border:1px solid #c3b7e6;border-radius:12px;padding:32px;max-width:400px;width:90%;text-align:center;">
        <h3 id="confirm-title" style="color:#c3b7e6;margin-bottom:12px;"></h3>
        <p id="confirm-message" style="color:#b0a8d0;margin-bottom:24px;"></p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button id="confirm-yes" style="background:#c3b7e6;color:#1a1535;border:none;padding:10px 24px;border-radius:8px;cursor:pointer;font-weight:bold;">Confirm</button>
          <button id="confirm-no" style="background:transparent;color:#b0a8d0;border:1px solid #4a3f72;padding:10px 24px;border-radius:8px;cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  modal.style.display = 'flex';

  const yesBtn = document.getElementById('confirm-yes');
  const noBtn = document.getElementById('confirm-no');

  const yesHandler = () => {
    modal.style.display = 'none';
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
    onConfirm();
  };
  const noHandler = () => {
    modal.style.display = 'none';
    yesBtn.removeEventListener('click', yesHandler);
    noBtn.removeEventListener('click', noHandler);
  };

  yesBtn.addEventListener('click', yesHandler);
  noBtn.addEventListener('click', noHandler);
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.style.display = 'none';
      yesBtn.removeEventListener('click', yesHandler);
      noBtn.removeEventListener('click', noHandler);
    }
  }, { once: true });
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  applySettings();
  setupTabNavigation();
  setupTimerControls();
  setupJournalControls();
  setupGrimoireControls();
  setupChronicleControls();
  setupProfileControls();
  setupSettingsControls();
  setupBreathingExercise();
  setupQuickCapture();
  setupReminders();
  setupKeyboardShortcuts();
  setupADHDFeatures();
  createParticles(8);
  initDateTimeDisplay();
  initJournalDate();
  renderJournalList();
  loadGrimoire();
  loadChronicle();
  updateProfileUI();
  loadSettings();
  populateCategorySelects();
  rotateMotivationalQuote();
  setInterval(rotateMotivationalQuote, 30000);
  checkWeeklyReview();
  requestNotificationPermission();
  loadDailyPlanner();
  loadRoutines();
});

function setupTabNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + tabName);
      if (panel) panel.classList.add('active');
      if (tabName === 'profile') updateProfileUI();
      if (tabName === 'chronicle') loadChronicle();
      if (tabName === 'grimoire') loadGrimoire();
      if (tabName === 'settings') loadSettings();
    });
  });
}

function initDateTimeDisplay() {
  function update() {
    const now = new Date();
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    if (dateEl) dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  update();
  setInterval(update, 1000);
}
