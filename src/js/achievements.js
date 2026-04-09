// Aureole Timer — Achievement Engine

const ACHIEVEMENTS = [
  // Work time achievements (threshold in seconds)
  { id: 'work_1h',    category: 'work',     name: 'First Hour',       desc: 'Log 1 hour of work',         icon: '⚔️',       color: '#8b4513', threshold: 3600 },
  { id: 'work_5h',    category: 'work',     name: 'Dedicated Warrior', desc: 'Log 5 hours of work',        icon: '⚔️⚔️',    color: '#a0522d', threshold: 18000 },
  { id: 'work_10h',   category: 'work',     name: 'Iron Will',         desc: 'Log 10 hours of work',       icon: '🛡️',       color: '#708090', threshold: 36000 },
  { id: 'work_20h',   category: 'work',     name: 'Seasoned Veteran',  desc: 'Log 20 hours of work',       icon: '🗡️',       color: '#c0c0c0', threshold: 72000 },
  { id: 'work_50h',   category: 'work',     name: 'Master Craftsman',  desc: 'Log 50 hours of work',       icon: '🔱',       color: '#d4a843', threshold: 180000 },
  { id: 'work_100h',  category: 'work',     name: 'Arcane Knight',     desc: 'Log 100 hours of work',      icon: '👑',       color: '#7c5cbf', threshold: 360000 },

  // Study achievements (threshold in seconds)
  { id: 'study_1h',   category: 'study',    name: 'First Scroll',      desc: 'Study for 1 hour',           icon: '📖',       color: '#4682b4', threshold: 3600 },
  { id: 'study_5h',   category: 'study',    name: 'Avid Reader',       desc: 'Study for 5 hours',          icon: '📚',       color: '#6495ed', threshold: 18000 },
  { id: 'study_10h',  category: 'study',    name: 'Scholar',           desc: 'Study for 10 hours',         icon: '🎓',       color: '#4169e1', threshold: 36000 },
  { id: 'study_20h',  category: 'study',    name: 'Arcane Scholar',    desc: 'Study for 20 hours',         icon: '🌟',       color: '#9370db', threshold: 72000 },
  { id: 'study_50h',  category: 'study',    name: 'Sage',              desc: 'Study for 50 hours',         icon: '🔮',       color: '#8a2be2', threshold: 180000 },
  { id: 'study_100h', category: 'study',    name: 'Grand Magus',       desc: 'Study for 100 hours',        icon: '✨',       color: '#d4a843', threshold: 360000 },

  // Streak achievements (threshold in days)
  { id: 'streak_3',   category: 'streak',   name: 'Consistent',        desc: '3-day streak',               icon: '🔥',       color: '#ff6347', threshold: 3 },
  { id: 'streak_7',   category: 'streak',   name: 'Week Warrior',      desc: '7-day streak',               icon: '🔥🔥',     color: '#ff4500', threshold: 7 },
  { id: 'streak_14',  category: 'streak',   name: 'Fortnight',         desc: '14-day streak',              icon: '⚡',       color: '#ffd700', threshold: 14 },
  { id: 'streak_30',  category: 'streak',   name: 'Monthly Hero',      desc: '30-day streak',              icon: '🌙',       color: '#c0c0ff', threshold: 30 },
  { id: 'streak_100', category: 'streak',   name: 'Eternal Flame',     desc: '100-day streak',             icon: '💎',       color: '#7fffd4', threshold: 100 },

  // Session count achievements
  { id: 'sessions_10',  category: 'sessions', name: 'Regular',         desc: 'Complete 10 sessions',       icon: '📅',       color: '#3cb371', threshold: 10 },
  { id: 'sessions_50',  category: 'sessions', name: 'Diligent',        desc: 'Complete 50 sessions',       icon: '🌿',       color: '#228b22', threshold: 50 },
  { id: 'sessions_100', category: 'sessions', name: 'Centurion',       desc: 'Complete 100 sessions',      icon: '🏆',       color: '#d4a843', threshold: 100 },

  // Journal achievements
  { id: 'journal_1',  category: 'journal',  name: 'First Entry',       desc: 'Write your first journal entry', icon: '✍️',   color: '#db7093', threshold: 1 },
  { id: 'journal_10', category: 'journal',  name: 'Storyteller',       desc: 'Write 10 journal entries',   icon: '📝',       color: '#c71585', threshold: 10 },
  { id: 'journal_30', category: 'journal',  name: 'Chronicler',        desc: 'Write 30 journal entries',   icon: '📜',       color: '#800080', threshold: 30 },

  // Task achievements
  { id: 'tasks_done_10', category: 'tasks', name: 'Spell Caster',      desc: 'Complete 10 spells/tasks',   icon: '✅',       color: '#20b2aa', threshold: 10 },
  { id: 'tasks_done_50', category: 'tasks', name: 'Arcane Master',     desc: 'Complete 50 spells/tasks',   icon: '🌊',       color: '#008080', threshold: 50 },

  // Special achievements
  { id: 'first_pomodoro', category: 'special', name: 'Tomato Farmer',  desc: 'Complete your first Pomodoro', icon: '🍅',     color: '#ff6347', threshold: 1 },
  { id: 'night_owl',      category: 'special', name: 'Night Owl',      desc: 'Work after midnight',        icon: '🦉',       color: '#191970', threshold: 1 },
  { id: 'early_bird',     category: 'special', name: 'Dawn Mage',      desc: 'Work before 6am',            icon: '🌅',       color: '#ffa500', threshold: 1 },
  { id: 'full_day',       category: 'special', name: 'Devoted',        desc: 'Log 8+ hours in a single day', icon: '🌟',     color: '#d4a843', threshold: 1 }
];

window.ACHIEVEMENTS = ACHIEVEMENTS;

const RIBBON_COLORS = {
  work:     ['#8b0000', '#cd5c5c'],
  study:    ['#00008b', '#4169e1'],
  streak:   ['#8b6914', '#d4a843'],
  sessions: ['#006400', '#32cd32'],
  journal:  ['#4b0082', '#9370db'],
  tasks:    ['#008080', '#20b2aa'],
  special:  ['#2f2f2f', '#c0c0c0']
};

window.RIBBON_COLORS = RIBBON_COLORS;

const Achievements = (function () {

  async function getUnlocked() {
    return await Storage.get('achievements', {});
  }

  async function setUnlocked(data) {
    await Storage.set('achievements', data);
  }

  async function checkAchievements(stats) {
    const unlocked = await getUnlocked();
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
      if (unlocked[ach.id]) continue;

      let met = false;
      switch (ach.category) {
        case 'work':
          met = (stats.totalWork || 0) >= ach.threshold;
          break;
        case 'study':
          met = (stats.totalStudy || 0) >= ach.threshold;
          break;
        case 'streak':
          met = (stats.streak || 0) >= ach.threshold;
          break;
        case 'sessions':
          met = (stats.totalSessions || 0) >= ach.threshold;
          break;
        case 'journal':
          met = (stats.journalEntries || 0) >= ach.threshold;
          break;
        case 'tasks':
          met = (stats.tasksDone || 0) >= ach.threshold;
          break;
        case 'special':
          met = !!(stats[ach.id]);
          break;
      }

      if (met) {
        unlocked[ach.id] = { unlockedAt: Date.now() };
        newlyUnlocked.push(ach);
      }
    }

    if (newlyUnlocked.length > 0) {
      await setUnlocked(unlocked);
      for (const ach of newlyUnlocked) {
        showAchievementToast(ach);
      }
      renderAchievementsGrid('achievementsGrid');
      renderRibbonRack('ribbonRack');
    }
  }

  function showAchievementToast(ach) {
    if (window.showToast) {
      window.showToast(`🏆 Achievement Unlocked: ${ach.icon} ${ach.name}`, 'achievement');
    }
  }

  async function renderAchievementsGrid(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const unlocked = await getUnlocked();
    container.innerHTML = '';

    for (const ach of ACHIEVEMENTS) {
      const isUnlocked = !!unlocked[ach.id];
      const card = document.createElement('div');
      card.className = 'achievement-card' + (isUnlocked ? ' unlocked' : ' locked');
      card.style.setProperty('--ach-color', ach.color);

      const unlockedDate = isUnlocked
        ? new Date(unlocked[ach.id].unlockedAt).toLocaleDateString()
        : '';

      card.innerHTML = `
        <div class="ach-icon">${isUnlocked ? ach.icon : '🔒'}</div>
        <div class="ach-name">${ach.name}</div>
        <div class="ach-desc">${ach.desc}</div>
        ${isUnlocked ? `<div class="ach-date">${unlockedDate}</div>` : ''}
      `;
      container.appendChild(card);
    }
  }

  async function renderRibbonRack(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const unlocked = await getUnlocked();
    container.innerHTML = '';

    const earned = ACHIEVEMENTS.filter(a => unlocked[a.id]);
    if (earned.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;padding:8px;">No ribbons earned yet. Complete sessions to earn ribbons!</p>';
      return;
    }

    for (const ach of earned) {
      const colors = RIBBON_COLORS[ach.category] || ['#555', '#888'];
      const ribbon = document.createElement('div');
      ribbon.className = 'ribbon-badge';
      ribbon.title = `${ach.name} — ${ach.desc}`;
      ribbon.style.background = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[0]} 100%)`;
      ribbon.innerHTML = `<span class="ribbon-icon">${ach.icon}</span>`;
      container.appendChild(ribbon);
    }
  }

  return {
    checkAchievements,
    renderAchievementsGrid,
    renderRibbonRack,
    getUnlocked
  };
})();

window.Achievements = Achievements;
