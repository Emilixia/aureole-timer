// Frieren Chronomark — Reminders & Notifications

const Reminders = (function () {
  let checkInterval = null;

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  async function loadReminders() {
    return await Storage.get('reminders', []);
  }

  async function saveReminders(list) {
    await Storage.set('reminders', list);
  }

  async function addReminder(text, time) {
    if (!text || !time) return;
    const list = await loadReminders();
    list.push({ id: generateId(), text, time, enabled: true, lastTriggered: null });
    await saveReminders(list);
    renderRemindersList();
    if (window.showToast) window.showToast('Reminder added ✨', 'success');
  }

  async function deleteReminder(id) {
    const list = await loadReminders();
    const filtered = list.filter(r => r.id !== id);
    await saveReminders(filtered);
    renderRemindersList();
  }

  async function toggleReminder(id) {
    const list = await loadReminders();
    const reminder = list.find(r => r.id === id);
    if (reminder) reminder.enabled = !reminder.enabled;
    await saveReminders(list);
    renderRemindersList();
  }

  async function renderRemindersList() {
    const container = document.getElementById('remindersList');
    if (!container) return;
    const list = await loadReminders();
    container.innerHTML = '';
    if (list.length === 0) {
      container.innerHTML = '<p class="empty-state">No reminders set.</p>';
      return;
    }
    for (const reminder of list) {
      const item = document.createElement('div');
      item.className = 'reminder-item' + (reminder.enabled ? '' : ' disabled');
      item.innerHTML = `
        <span class="reminder-time">${reminder.time}</span>
        <span class="reminder-text">${escapeHtml(reminder.text)}</span>
        <div class="reminder-actions">
          <button class="btn-icon" title="${reminder.enabled ? 'Disable' : 'Enable'}" data-id="${reminder.id}" data-action="toggle">
            ${reminder.enabled ? '🔔' : '🔕'}
          </button>
          <button class="btn-icon btn-danger-icon" title="Delete" data-id="${reminder.id}" data-action="delete">✕</button>
        </div>
      `;
      container.appendChild(item);
    }

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteReminder(btn.dataset.id));
    });
    container.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', () => toggleReminder(btn.dataset.id));
    });
  }

  async function checkReminders() {
    const settings = window.AppSettings || {};
    if (!settings.desktopNotifications) return;

    const list = await loadReminders();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const today = now.toISOString().split('T')[0];

    for (const reminder of list) {
      if (!reminder.enabled) continue;
      if (reminder.time !== currentTime) continue;
      if (reminder.lastTriggered === today) continue;

      reminder.lastTriggered = today;
      if (window.aureole) {
        window.aureole.showNotification('⏰ Frieren Chronomark', reminder.text);
      }
      if (window.showToast) window.showToast(`⏰ ${reminder.text}`, 'info');
    }

    await saveReminders(list);

    // Daily reminder check
    if (settings.dailyReminder && settings.dailyReminderTime) {
      if (settings.dailyReminderTime === currentTime) {
        const lastDailyReminder = await Storage.get('lastDailyReminder', '');
        if (lastDailyReminder !== today) {
          await Storage.set('lastDailyReminder', today);
          if (window.aureole) {
            window.aureole.showNotification('✨ Frieren Chronomark', 'Time to start your magical journey today!');
          }
        }
      }
    }
  }

  function startChecking() {
    if (checkInterval) clearInterval(checkInterval);
    checkInterval = setInterval(checkReminders, 60000);
    checkReminders();
  }

  function stopChecking() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function init() {
    const addBtn = document.getElementById('addReminder');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const text = document.getElementById('reminderText').value.trim();
        const time = document.getElementById('reminderTime').value;
        if (text && time) {
          addReminder(text, time);
          document.getElementById('reminderText').value = '';
          document.getElementById('reminderTime').value = '';
        }
      });
    }
    await renderRemindersList();
    startChecking();
  }

  return {
    init,
    addReminder,
    deleteReminder,
    renderRemindersList,
    checkReminders,
    startChecking,
    stopChecking
  };
})();

window.Reminders = Reminders;
