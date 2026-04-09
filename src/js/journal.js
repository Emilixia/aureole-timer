// Aureole Timer — Journal Module

const Journal = (function () {
  let currentEntryId = null;

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function loadEntries() {
    return await Storage.get('journal', []);
  }

  async function saveEntries(entries) {
    await Storage.set('journal', entries);
  }

  function countWords(text) {
    const cleaned = text.replace(/<[^>]+>/g, ' ').trim();
    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(dateStr) {
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  async function renderEntryList(filter) {
    const container = document.getElementById('journalEntryList');
    if (!container) return;

    let entries = await loadEntries();
    entries.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });

    if (filter && filter.trim()) {
      const q = filter.toLowerCase();
      entries = entries.filter(function (e) {
        return (e.title && e.title.toLowerCase().includes(q)) ||
          (e.content && e.content.toLowerCase().includes(q));
      });
    }

    container.innerHTML = '';
    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">No entries found.</p>';
      return;
    }

    for (const entry of entries) {
      const item = document.createElement('div');
      item.className = 'journal-entry-item' + (entry.id === currentEntryId ? ' active' : '');
      item.dataset.id = entry.id;

      // Use DOMParser to safely extract plain text from rich HTML content
      let preview = '';
      if (entry.content) {
        const parsed = new DOMParser().parseFromString(entry.content, 'text/html');
        const plain = parsed.body.textContent || '';
        preview = plain.slice(0, 60) + (plain.length > 60 ? '…' : '');
      }

      item.innerHTML = `
        <div class="entry-item-header">
          <span class="entry-item-mood">${entry.mood || ''}</span>
          <span class="entry-item-date">${formatDate(entry.date)}</span>
        </div>
        <div class="entry-item-title">${escapeHtml(entry.title || 'Untitled')}</div>
        <div class="entry-item-preview">${escapeHtml(preview)}</div>
        ${entry.energyLevel ? `<div class="entry-item-energy">${'⚡'.repeat(parseInt(entry.energyLevel, 10))}</div>` : ''}
      `;
      item.addEventListener('click', function () { loadEntry(entry.id); });
      container.appendChild(item);
    }
  }

  async function loadEntry(id) {
    const entries = await loadEntries();
    const entry = entries.find(function (e) { return e.id === id; });
    if (!entry) return;

    currentEntryId = id;

    const titleInput = document.getElementById('journalTitle');
    const editor = document.getElementById('journalEditor');
    const moodSelect = document.getElementById('journalMood');
    const energySelect = document.getElementById('journalEnergyLevel');
    const dateInput = document.getElementById('journalDate');

    if (titleInput) titleInput.value = entry.title || '';
    if (editor) editor.innerHTML = entry.content || '';
    if (moodSelect) moodSelect.value = entry.mood || '';
    if (energySelect) energySelect.value = entry.energyLevel || '';
    if (dateInput) dateInput.value = entry.date || '';

    updateWordCount();
    renderEntryList();
  }

  function updateWordCount() {
    const editor = document.getElementById('journalEditor');
    const counter = document.getElementById('journalWordCount');
    if (!editor || !counter) return;
    const words = countWords(editor.innerHTML);
    counter.textContent = words + ' word' + (words !== 1 ? 's' : '');
  }

  async function saveEntry() {
    const titleInput = document.getElementById('journalTitle');
    const editor = document.getElementById('journalEditor');
    const moodSelect = document.getElementById('journalMood');
    const energySelect = document.getElementById('journalEnergyLevel');
    const dateInput = document.getElementById('journalDate');

    const title = (titleInput && titleInput.value.trim()) || 'Untitled';
    const content = editor ? editor.innerHTML : '';
    const mood = moodSelect ? moodSelect.value : '';
    const energyLevel = energySelect ? energySelect.value : '';
    const date = (dateInput && dateInput.value) || new Date().toISOString().split('T')[0];
    const wordCount = countWords(content);
    const now = Date.now();

    let entries = await loadEntries();

    if (currentEntryId) {
      const idx = entries.findIndex(function (e) { return e.id === currentEntryId; });
      if (idx >= 0) {
        entries[idx] = Object.assign({}, entries[idx], {
          title, content, mood, energyLevel, date, wordCount, updatedAt: now
        });
      }
    } else {
      const newEntry = {
        id: generateId(),
        title, content, mood, energyLevel, date, wordCount,
        createdAt: now, updatedAt: now
      };
      currentEntryId = newEntry.id;
      entries.push(newEntry);
    }

    await saveEntries(entries);
    renderEntryList();

    // Check journal achievements
    if (window.Achievements) {
      await window.Achievements.checkAchievements({ journalEntries: entries.length });
    }

    if (window.showToast) window.showToast('Journal entry saved! 📖', 'success');
  }

  async function deleteEntry(id) {
    const targetId = id || currentEntryId;
    if (!targetId) return;
    if (!confirm('Delete this journal entry?')) return;

    let entries = await loadEntries();
    entries = entries.filter(function (e) { return e.id !== targetId; });
    await saveEntries(entries);

    if (targetId === currentEntryId) {
      currentEntryId = null;
      clearEditor();
    }

    renderEntryList();
    if (window.showToast) window.showToast('Entry deleted.', 'info');
  }

  function clearEditor() {
    const titleInput = document.getElementById('journalTitle');
    const editor = document.getElementById('journalEditor');
    const moodSelect = document.getElementById('journalMood');
    const energySelect = document.getElementById('journalEnergyLevel');
    const counter = document.getElementById('journalWordCount');

    if (titleInput) titleInput.value = '';
    if (editor) editor.innerHTML = '';
    if (moodSelect) moodSelect.value = '';
    if (energySelect) energySelect.value = '';
    if (counter) counter.textContent = '0 words';

    currentEntryId = null;
  }

  function newEntry() {
    clearEditor();
    const dateInput = document.getElementById('journalDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    renderEntryList();
    const titleInput = document.getElementById('journalTitle');
    if (titleInput) titleInput.focus();
  }

  function init() {
    const newBtn = document.getElementById('newJournalEntry');
    const saveBtn = document.getElementById('saveJournalEntry');
    const deleteBtn = document.getElementById('deleteJournalEntry');
    const searchInput = document.getElementById('journalSearch');
    const editor = document.getElementById('journalEditor');
    const dateInput = document.getElementById('journalDate');

    if (newBtn) newBtn.addEventListener('click', newEntry);
    if (saveBtn) saveBtn.addEventListener('click', saveEntry);
    if (deleteBtn) deleteBtn.addEventListener('click', function () { deleteEntry(null); });
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        renderEntryList(this.value);
      });
    }
    if (editor) {
      editor.addEventListener('input', updateWordCount);
    }

    // Set today's date in the date picker
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    renderEntryList();
  }

  return {
    init: init,
    renderEntryList: renderEntryList,
    loadEntry: loadEntry,
    saveEntry: saveEntry,
    deleteEntry: deleteEntry,
    newEntry: newEntry
  };
})();

window.Journal = Journal;
