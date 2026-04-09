// Frieren Chronomark — Grimoire (Kanban Tasks + Habits)

const Grimoire = (function () {
  let editingSpellId = null;
  let draggedCardId = null;
  let dragOverCardId = null;
  let dragInsertBefore = true;

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function loadSpells() {
    return await Storage.get('spells', []);
  }

  async function saveSpells(spells) {
    await Storage.set('spells', spells);
  }

  async function renderBoards() {
    const spells = await loadSpells();
    const statuses = ['todo', 'inprogress', 'done'];

    for (const status of statuses) {
      const board = document.getElementById('board-' + status);
      if (!board) continue;
      board.innerHTML = '';

      const filtered = spells.filter(function (s) { return s.status === status; });
      for (const spell of filtered) {
        board.appendChild(createSpellCard(spell));
      }
    }
  }

  function priorityBadge(priority) {
    const map = { low: '🟢', medium: '🟡', high: '🔴' };
    return map[priority] || '🟢';
  }

  function createSpellCard(spell) {
    const card = document.createElement('div');
    card.className = 'spell-card priority-' + (spell.priority || 'low');
    card.dataset.id = spell.id;
    card.draggable = true;

    card.innerHTML = `
      <div class="spell-card-header">
        <span class="spell-priority">${priorityBadge(spell.priority)}</span>
        <span class="spell-title">${escapeHtml(spell.title)}</span>
        <button class="spell-edit-btn" title="Edit">✏️</button>
      </div>
      ${spell.desc ? `<div class="spell-desc">${escapeHtml(spell.desc)}</div>` : ''}
    `;

    card.querySelector('.spell-edit-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      openSpellModal(spell.id);
    });

    // Drag events
    card.addEventListener('dragstart', function (e) {
      draggedCardId = spell.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', function () {
      card.classList.remove('dragging');
      draggedCardId = null;
      dragOverCardId = null;
      // Remove all drop-indicators
      document.querySelectorAll('.spell-card').forEach(function (c) {
        c.classList.remove('drag-above', 'drag-below');
      });
    });

    card.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedCardId || draggedCardId === spell.id) return;
      const rect = card.getBoundingClientRect();
      dragInsertBefore = e.clientY < rect.top + rect.height / 2;
      dragOverCardId = spell.id;
      // Visual indicator
      document.querySelectorAll('.spell-card').forEach(function (c) {
        c.classList.remove('drag-above', 'drag-below');
      });
      card.classList.add(dragInsertBefore ? 'drag-above' : 'drag-below');
    });

    card.addEventListener('drop', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!draggedCardId || draggedCardId === spell.id) return;
      card.classList.remove('drag-above', 'drag-below');

      const spells = await loadSpells();
      const draggedIdx = spells.findIndex(function (s) { return s.id === draggedCardId; });
      const targetIdx = spells.findIndex(function (s) { return s.id === spell.id; });
      if (draggedIdx < 0 || targetIdx < 0) return;

      const draggedSpell = spells.splice(draggedIdx, 1)[0];
      const newTargetIdx = spells.findIndex(function (s) { return s.id === spell.id; });
      const insertIdx = dragInsertBefore ? newTargetIdx : newTargetIdx + 1;

      // Move to target column if different
      draggedSpell.status = spell.status;
      draggedSpell.updatedAt = Date.now();
      spells.splice(insertIdx, 0, draggedSpell);

      await saveSpells(spells);
      await renderBoards();

      const doneTasks = spells.filter(function (s) { return s.status === 'done'; }).length;
      if (window.Achievements) {
        await window.Achievements.checkAchievements({ tasksDone: doneTasks });
      }
    });

    return card;
  }

  function setupDropZones() {
    const boards = document.querySelectorAll('.board-cards');
    boards.forEach(function (board) {
      board.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        board.classList.add('drag-over');
      });
      board.addEventListener('dragleave', function (e) {
        // Only remove if leaving the board entirely (not entering a child card)
        if (!board.contains(e.relatedTarget)) {
          board.classList.remove('drag-over');
        }
      });
      board.addEventListener('drop', async function (e) {
        e.preventDefault();
        board.classList.remove('drag-over');
        // If drop was handled by a child card, skip
        if (!draggedCardId) return;
        if (dragOverCardId) { dragOverCardId = null; return; }

        // Dropped on empty board area — append to end of column
        const newStatus = board.closest('.grimoire-board').dataset.status;
        const spells = await loadSpells();
        const spell = spells.find(function (s) { return s.id === draggedCardId; });
        if (spell && spell.status !== newStatus) {
          spell.status = newStatus;
          spell.updatedAt = Date.now();
          await saveSpells(spells);
          await renderBoards();

          const doneTasks = spells.filter(function (s) { return s.status === 'done'; }).length;
          if (window.Achievements) {
            await window.Achievements.checkAchievements({ tasksDone: doneTasks });
          }
        }
      });
    });
  }

  async function openSpellModal(id) {
    editingSpellId = id || null;
    const modal = document.getElementById('spellModal');
    if (!modal) return;

    const titleInput = document.getElementById('spellTitle');
    const descInput = document.getElementById('spellDesc');
    const prioritySelect = document.getElementById('spellPriority');
    const statusSelect = document.getElementById('spellStatus');
    const deleteBtn = document.getElementById('deleteSpell');

    if (id) {
      const spells = await loadSpells();
      const spell = spells.find(function (s) { return s.id === id; });
      if (spell) {
        if (titleInput) titleInput.value = spell.title || '';
        if (descInput) descInput.value = spell.desc || '';
        if (prioritySelect) prioritySelect.value = spell.priority || 'low';
        if (statusSelect) statusSelect.value = spell.status || 'todo';
      }
      if (deleteBtn) deleteBtn.style.display = 'inline-block';
    } else {
      if (titleInput) titleInput.value = '';
      if (descInput) descInput.value = '';
      if (prioritySelect) prioritySelect.value = 'medium';
      if (statusSelect) statusSelect.value = 'todo';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
    if (titleInput) titleInput.focus();
  }

  function closeSpellModal() {
    const modal = document.getElementById('spellModal');
    if (modal) modal.style.display = 'none';
    editingSpellId = null;
  }

  async function saveSpell() {
    const titleInput = document.getElementById('spellTitle');
    const descInput = document.getElementById('spellDesc');
    const prioritySelect = document.getElementById('spellPriority');
    const statusSelect = document.getElementById('spellStatus');

    const title = (titleInput && titleInput.value.trim()) || 'Untitled Spell';
    const desc = (descInput && descInput.value.trim()) || '';
    const priority = (prioritySelect && prioritySelect.value) || 'medium';
    const status = (statusSelect && statusSelect.value) || 'todo';
    const now = Date.now();

    let spells = await loadSpells();

    if (editingSpellId) {
      const idx = spells.findIndex(function (s) { return s.id === editingSpellId; });
      if (idx >= 0) {
        spells[idx] = Object.assign({}, spells[idx], { title, desc, priority, status, updatedAt: now });
      }
    } else {
      spells.push({ id: generateId(), title, desc, priority, status, createdAt: now, updatedAt: now });
    }

    await saveSpells(spells);
    closeSpellModal();
    await renderBoards();
    if (window.showToast) window.showToast('Spell saved! ✨', 'success');
  }

  async function deleteSpell() {
    if (!editingSpellId) return;
    if (!confirm('Delete this spell?')) return;

    let spells = await loadSpells();
    spells = spells.filter(function (s) { return s.id !== editingSpellId; });
    await saveSpells(spells);
    closeSpellModal();
    await renderBoards();
    if (window.showToast) window.showToast('Spell deleted.', 'info');
  }

  // ──────────────────────────────────────────────────────────
  // Habit Tracker
  // ──────────────────────────────────────────────────────────

  async function loadHabits() {
    return await Storage.get('habits', []);
  }

  async function saveHabits(habits) {
    await Storage.set('habits', habits);
  }

  function getTodayStr() {
    return new Date().toISOString().split('T')[0];
  }

  function calcHabitStreak(habit) {
    const dates = (habit.completedDates || []).sort();
    if (dates.length === 0) return 0;
    let streak = 0;
    const d = new Date();
    let check = d.toISOString().split('T')[0];
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] === check) {
        streak++;
        d.setDate(d.getDate() - 1);
        check = d.toISOString().split('T')[0];
      } else {
        break;
      }
    }
    return streak;
  }

  async function renderHabitList() {
    const container = document.getElementById('habitList');
    if (!container) return;
    const habits = await loadHabits();
    const today = getTodayStr();
    container.innerHTML = '';

    if (habits.length === 0) {
      container.innerHTML = '<p class="empty-state">No rituals yet. Add one above!</p>';
      return;
    }

    for (const habit of habits) {
      const isComplete = (habit.completedDates || []).includes(today);
      const streak = calcHabitStreak(habit);
      const item = document.createElement('div');
      item.className = 'habit-item' + (isComplete ? ' completed' : '');
      item.innerHTML = `
        <span class="habit-emoji">${habit.emoji || '⭐'}</span>
        <span class="habit-name">${escapeHtml(habit.name)}</span>
        <span class="habit-streak" title="Current streak">🔥 ${streak}</span>
        <button class="habit-check-btn${isComplete ? ' done' : ''}" data-id="${habit.id}" title="${isComplete ? 'Mark incomplete' : 'Mark complete'}">
          ${isComplete ? '✅' : '⬜'}
        </button>
        <button class="habit-delete-btn btn-icon btn-danger-icon" data-id="${habit.id}" title="Delete">✕</button>
      `;
      container.appendChild(item);
    }

    container.querySelectorAll('.habit-check-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { toggleHabitToday(btn.dataset.id); });
    });
    container.querySelectorAll('.habit-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { deleteHabit(btn.dataset.id); });
    });
  }

  async function addHabit() {
    const nameInput = document.getElementById('habitName');
    const emojiSelect = document.getElementById('habitEmoji');
    const name = nameInput && nameInput.value.trim();
    if (!name) return;

    const habits = await loadHabits();
    habits.push({
      id: generateId(),
      name: name,
      emoji: (emojiSelect && emojiSelect.value) || '⭐',
      completedDates: [],
      createdAt: Date.now()
    });
    await saveHabits(habits);
    if (nameInput) nameInput.value = '';
    await renderHabitList();
    if (window.showToast) window.showToast('Ritual added! 🌱', 'success');
  }

  async function toggleHabitToday(id) {
    const habits = await loadHabits();
    const habit = habits.find(function (h) { return h.id === id; });
    if (!habit) return;
    const today = getTodayStr();
    const idx = (habit.completedDates || []).indexOf(today);
    if (!habit.completedDates) habit.completedDates = [];
    if (idx >= 0) {
      habit.completedDates.splice(idx, 1);
    } else {
      habit.completedDates.push(today);
    }
    await saveHabits(habits);
    await renderHabitList();
  }

  async function deleteHabit(id) {
    let habits = await loadHabits();
    habits = habits.filter(function (h) { return h.id !== id; });
    await saveHabits(habits);
    await renderHabitList();
  }

  function init() {
    const newSpellBtn = document.getElementById('newSpell');
    const saveSpellBtn = document.getElementById('saveSpell');
    const cancelSpellBtn = document.getElementById('cancelSpell');
    const deleteSpellBtn = document.getElementById('deleteSpell');
    const addHabitBtn = document.getElementById('addHabit');

    if (newSpellBtn) newSpellBtn.addEventListener('click', function () { openSpellModal(null); });
    if (saveSpellBtn) saveSpellBtn.addEventListener('click', saveSpell);
    if (cancelSpellBtn) cancelSpellBtn.addEventListener('click', closeSpellModal);
    if (deleteSpellBtn) deleteSpellBtn.addEventListener('click', deleteSpell);
    if (addHabitBtn) addHabitBtn.addEventListener('click', addHabit);

    // Add spell from board "+" buttons
    document.querySelectorAll('.add-card-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const status = btn.dataset.status;
        openSpellModal(null);
        // Pre-select status
        setTimeout(function () {
          const statusSelect = document.getElementById('spellStatus');
          if (statusSelect) statusSelect.value = status;
        }, 50);
      });
    });

    // Close modal on overlay click
    const modal = document.getElementById('spellModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeSpellModal();
      });
    }

    setupDropZones();
    renderBoards();
    renderHabitList();
  }

  return {
    init: init,
    renderBoards: renderBoards,
    renderHabitList: renderHabitList,
    openSpellModal: openSpellModal
  };
})();

window.Grimoire = Grimoire;
