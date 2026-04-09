// Aureole Timer — Chronicle (Session History & Stats)

const Chronicle = (function () {

  function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h + 'h ' + m + 'm';
  }

  function formatDurationShort(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }

  function calculateStreak(sessions) {
    if (!sessions || sessions.length === 0) return 0;
    // ISO date format (YYYY-MM-DD) sorts correctly with the default lexicographic comparison
    const dates = [...new Set(sessions.map(function (s) { return s.date; }))].sort();
    if (dates.length === 0) return 0;

    let streak = 0;
    const now = new Date();
    let check = now.toISOString().split('T')[0];

    // Allow today or yesterday as starting point
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const hasToday = dates.includes(check);
    const hasYesterday = dates.includes(yesterdayStr);

    if (!hasToday && !hasYesterday) return 0;
    if (!hasToday) check = yesterdayStr;

    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] === check) {
        streak++;
        const d = new Date(check + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        check = d.toISOString().split('T')[0];
      } else if (dates[i] < check) {
        break;
      }
    }
    return streak;
  }

  async function renderStats() {
    const sessions = await Storage.get('chronicle', []);
    const today = new Date().toISOString().split('T')[0];

    const totalWork = sessions
      .filter(function (s) { return s.type === 'working'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);

    const totalStudy = sessions
      .filter(function (s) { return s.type === 'studying'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);

    const todaySeconds = sessions
      .filter(function (s) { return s.date === today; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);

    const streak = calculateStreak(sessions);

    const totalWorkEl = document.getElementById('totalWorkTime');
    const totalStudyEl = document.getElementById('totalStudyTime');
    const todayTimeEl = document.getElementById('todayTime');
    const streakEl = document.getElementById('currentStreak');

    if (totalWorkEl) totalWorkEl.textContent = formatDuration(totalWork);
    if (totalStudyEl) totalStudyEl.textContent = formatDuration(totalStudy);
    if (todayTimeEl) todayTimeEl.textContent = formatDuration(todaySeconds);
    if (streakEl) streakEl.textContent = streak + (streak === 1 ? ' day' : ' days');
  }

  async function renderWeeklyChart() {
    const canvas = document.getElementById('weeklyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sessions = await Storage.get('chronicle', []);

    // Build last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }

    const dayLabels = days.map(function (d) {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    });

    const workHours = days.map(function (d) {
      const total = sessions
        .filter(function (s) { return s.date === d && s.type === 'working'; })
        .reduce(function (sum, s) { return sum + s.duration; }, 0);
      return total / 3600;
    });

    const studyHours = days.map(function (d) {
      const total = sessions
        .filter(function (s) { return s.date === d && s.type === 'studying'; })
        .reduce(function (sum, s) { return sum + s.duration; }, 0);
      return total / 3600;
    });

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 600;
    const H = canvas.clientHeight || 120;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    const padding = { top: 10, right: 20, bottom: 35, left: 40 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const maxHours = Math.max(1, Math.ceil(Math.max(...workHours, ...studyHours) + 0.5));

    // Grid lines
    ctx.strokeStyle = 'rgba(124,92,191,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = 'rgba(155,143,192,0.6)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(((i / 4) * maxHours).toFixed(1) + 'h', padding.left - 4, y + 3);
    }

    const groupWidth = chartW / days.length;
    const barWidth = Math.min(groupWidth * 0.35, 16);
    const gap = barWidth * 0.3;

    for (let i = 0; i < days.length; i++) {
      const x = padding.left + i * groupWidth + groupWidth / 2;

      // Work bar (purple)
      const wH = (workHours[i] / maxHours) * chartH;
      const wY = padding.top + chartH - wH;
      const wGrad = ctx.createLinearGradient(0, wY, 0, wY + wH);
      wGrad.addColorStop(0, '#9b7dd4');
      wGrad.addColorStop(1, '#5a3a8a');
      ctx.fillStyle = wGrad;
      if (wH > 0) ctx.fillRect(x - barWidth - gap / 2, wY, barWidth, wH);

      // Study bar (teal)
      const sH = (studyHours[i] / maxHours) * chartH;
      const sY = padding.top + chartH - sH;
      const sGrad = ctx.createLinearGradient(0, sY, 0, sY + sH);
      sGrad.addColorStop(0, '#4db89e');
      sGrad.addColorStop(1, '#1e6b5a');
      ctx.fillStyle = sGrad;
      if (sH > 0) ctx.fillRect(x + gap / 2, sY, barWidth, sH);

      // Day label
      ctx.fillStyle = 'rgba(155,143,192,0.8)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dayLabels[i], x, padding.top + chartH + 16);
    }

    // Legend
    ctx.fillStyle = '#9b7dd4';
    ctx.fillRect(padding.left, H - 12, 10, 8);
    ctx.fillStyle = 'rgba(155,143,192,0.8)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Work', padding.left + 14, H - 5);

    ctx.fillStyle = '#3d8b7a';
    ctx.fillRect(padding.left + 55, H - 12, 10, 8);
    ctx.fillText('Study', padding.left + 69, H - 5);
  }

  async function renderTable(filterType) {
    const tbody = document.getElementById('chronicleTableBody');
    if (!tbody) return;
    let sessions = await Storage.get('chronicle', []);
    sessions = sessions.slice().reverse();

    if (filterType && filterType !== 'all') {
      sessions = sessions.filter(function (s) { return s.type === filterType; });
    }

    tbody.innerHTML = '';
    if (sessions.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No sessions recorded yet. Start a timer!</td></tr>';
      return;
    }

    for (const session of sessions) {
      const tr = document.createElement('tr');
      const dateDisplay = session.date
        ? new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';
      const typeIcon = session.type === 'working' ? '⚔️' : session.type === 'studying' ? '📖' : '✨';
      tr.innerHTML = `
        <td>${dateDisplay}</td>
        <td><span class="type-badge type-${session.type}">${typeIcon} ${session.type}</span></td>
        <td class="duration-cell">${formatDurationShort(session.duration)}</td>
        <td>${session.label || session.type}</td>
        <td class="notes-cell" title="${escapeHtml(session.notes || '')}">${truncate(escapeHtml(session.notes || ''), 40)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
  }

  function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  async function exportCSV() {
    const sessions = await Storage.get('chronicle', []);
    const headers = ['Date', 'Type', 'Label', 'Duration (s)', 'Duration (hms)', 'Notes'];
    const rows = sessions.map(function (s) {
      return [
        s.date || '',
        s.type || '',
        s.label || '',
        s.duration || 0,
        formatDurationShort(s.duration || 0),
        (s.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aureole-chronicle-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast('Chronicle exported! 📊', 'success');
  }

  async function renderChronicle() {
    await renderStats();
    await renderWeeklyChart();
    const filterEl = document.getElementById('chronicleFilter');
    const currentFilter = filterEl ? filterEl.value : 'all';
    await renderTable(currentFilter);
  }

  function init() {
    const filterEl = document.getElementById('chronicleFilter');
    const exportBtn = document.getElementById('exportChronicle');

    if (filterEl) {
      filterEl.addEventListener('change', async function () {
        await renderTable(this.value);
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', exportCSV);
    }
  }

  return {
    init: init,
    renderChronicle: renderChronicle,
    renderStats: renderStats,
    renderWeeklyChart: renderWeeklyChart,
    calculateStreak: calculateStreak,
    exportCSV: exportCSV
  };
})();

window.Chronicle = Chronicle;
