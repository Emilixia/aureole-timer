// Frieren Chronomark — Achievement Engine

const ACHIEVEMENTS = [
  // Work time achievements (threshold in seconds)
  { id: 'work_1h',    category: 'work',     name: 'First Hour',         desc: 'Log 1 hour of work',              icon: '⚔️',       color: '#8b4513', threshold: 3600 },
  { id: 'work_5h',    category: 'work',     name: 'Dedicated Warrior',  desc: 'Log 5 hours of work',             icon: '⚔️⚔️',    color: '#a0522d', threshold: 18000 },
  { id: 'work_10h',   category: 'work',     name: 'Iron Will',          desc: 'Log 10 hours of work',            icon: '🛡️',       color: '#708090', threshold: 36000 },
  { id: 'work_20h',   category: 'work',     name: 'Seasoned Veteran',   desc: 'Log 20 hours of work',            icon: '🗡️',       color: '#c0c0c0', threshold: 72000 },
  { id: 'work_50h',   category: 'work',     name: 'Master Craftsman',   desc: 'Log 50 hours of work',            icon: '🔱',       color: '#d4a843', threshold: 180000 },
  { id: 'work_100h',  category: 'work',     name: 'Arcane Knight',      desc: 'Log 100 hours of work',           icon: '👑',       color: '#7c5cbf', threshold: 360000 },
  { id: 'work_200h',  category: 'work',     name: 'Battle-Hardened',    desc: 'Log 200 hours of work',           icon: '⚜️',       color: '#9b7dd4', threshold: 720000 },
  { id: 'work_500h',  category: 'work',     name: 'Legendary Forge',    desc: 'Log 500 hours of work',           icon: '🌠',       color: '#f0c860', threshold: 1800000 },

  // Study achievements (threshold in seconds)
  { id: 'study_1h',   category: 'study',    name: 'First Scroll',       desc: 'Study for 1 hour',                icon: '📖',       color: '#4682b4', threshold: 3600 },
  { id: 'study_5h',   category: 'study',    name: 'Avid Reader',        desc: 'Study for 5 hours',               icon: '📚',       color: '#6495ed', threshold: 18000 },
  { id: 'study_10h',  category: 'study',    name: 'Scholar',            desc: 'Study for 10 hours',              icon: '🎓',       color: '#4169e1', threshold: 36000 },
  { id: 'study_20h',  category: 'study',    name: 'Arcane Scholar',     desc: 'Study for 20 hours',              icon: '🌟',       color: '#9370db', threshold: 72000 },
  { id: 'study_50h',  category: 'study',    name: 'Sage',               desc: 'Study for 50 hours',              icon: '🔮',       color: '#8a2be2', threshold: 180000 },
  { id: 'study_100h', category: 'study',    name: 'Grand Magus',        desc: 'Study for 100 hours',             icon: '✨',       color: '#d4a843', threshold: 360000 },
  { id: 'study_200h', category: 'study',    name: 'Archmage',           desc: 'Study for 200 hours',             icon: '🌌',       color: '#c084fc', threshold: 720000 },
  { id: 'study_500h', category: 'study',    name: 'Oracle of Chronomark',  desc: 'Study for 500 hours',             icon: '🔭',       color: '#f0c860', threshold: 1800000 },

  // Streak achievements (threshold in days)
  { id: 'streak_3',   category: 'streak',   name: 'Consistent',         desc: '3-day streak',                    icon: '🔥',       color: '#ff6347', threshold: 3 },
  { id: 'streak_7',   category: 'streak',   name: 'Week Warrior',       desc: '7-day streak',                    icon: '🔥🔥',     color: '#ff4500', threshold: 7 },
  { id: 'streak_14',  category: 'streak',   name: 'Fortnight',          desc: '14-day streak',                   icon: '⚡',       color: '#ffd700', threshold: 14 },
  { id: 'streak_30',  category: 'streak',   name: 'Monthly Hero',       desc: '30-day streak',                   icon: '🌙',       color: '#c0c0ff', threshold: 30 },
  { id: 'streak_60',  category: 'streak',   name: 'Two-Month Mage',     desc: '60-day streak',                   icon: '🌊',       color: '#7fffd4', threshold: 60 },
  { id: 'streak_100', category: 'streak',   name: 'Eternal Flame',      desc: '100-day streak',                  icon: '💎',       color: '#7fffd4', threshold: 100 },
  { id: 'streak_365', category: 'streak',   name: 'Year of Chronomark',    desc: '365-day streak',                  icon: '🌈',       color: '#f0c860', threshold: 365 },

  // Session count achievements
  { id: 'sessions_5',   category: 'sessions', name: 'Getting Started',  desc: 'Complete 5 sessions',             icon: '🌱',       color: '#90ee90', threshold: 5 },
  { id: 'sessions_10',  category: 'sessions', name: 'Regular',          desc: 'Complete 10 sessions',            icon: '📅',       color: '#3cb371', threshold: 10 },
  { id: 'sessions_25',  category: 'sessions', name: 'Adept',            desc: 'Complete 25 sessions',            icon: '🏅',       color: '#2e8b57', threshold: 25 },
  { id: 'sessions_50',  category: 'sessions', name: 'Diligent',         desc: 'Complete 50 sessions',            icon: '🌿',       color: '#228b22', threshold: 50 },
  { id: 'sessions_100', category: 'sessions', name: 'Centurion',        desc: 'Complete 100 sessions',           icon: '🏆',       color: '#d4a843', threshold: 100 },
  { id: 'sessions_250', category: 'sessions', name: 'Arcane Devotee',   desc: 'Complete 250 sessions',           icon: '💠',       color: '#9b7dd4', threshold: 250 },
  { id: 'sessions_500', category: 'sessions', name: 'Grand Centurion',  desc: 'Complete 500 sessions',           icon: '🔱',       color: '#f0c860', threshold: 500 },

  // Journal achievements
  { id: 'journal_1',  category: 'journal',  name: 'First Entry',        desc: 'Write your first journal entry',  icon: '✍️',       color: '#db7093', threshold: 1 },
  { id: 'journal_5',  category: 'journal',  name: 'Apprentice Scribe',  desc: 'Write 5 journal entries',         icon: '📓',       color: '#e87fa1', threshold: 5 },
  { id: 'journal_10', category: 'journal',  name: 'Storyteller',        desc: 'Write 10 journal entries',        icon: '📝',       color: '#c71585', threshold: 10 },
  { id: 'journal_30', category: 'journal',  name: 'Chronicler',         desc: 'Write 30 journal entries',        icon: '📜',       color: '#800080', threshold: 30 },
  { id: 'journal_100',category: 'journal',  name: 'Grand Scribe',       desc: 'Write 100 journal entries',       icon: '📔',       color: '#9b1faf', threshold: 100 },

  // Task achievements
  { id: 'tasks_done_5',  category: 'tasks', name: 'Spell Apprentice',   desc: 'Complete 5 spells/tasks',         icon: '🔮',       color: '#48d1cc', threshold: 5 },
  { id: 'tasks_done_10', category: 'tasks', name: 'Spell Caster',       desc: 'Complete 10 spells/tasks',        icon: '✅',       color: '#20b2aa', threshold: 10 },
  { id: 'tasks_done_25', category: 'tasks', name: 'Spell Weaver',       desc: 'Complete 25 spells/tasks',        icon: '🌊',       color: '#0e9690', threshold: 25 },
  { id: 'tasks_done_50', category: 'tasks', name: 'Arcane Master',      desc: 'Complete 50 spells/tasks',        icon: '🌊',       color: '#008080', threshold: 50 },
  { id: 'tasks_done_100',category: 'tasks', name: 'Grand Archmage',     desc: 'Complete 100 spells/tasks',       icon: '🏰',       color: '#d4a843', threshold: 100 },

  // Special achievements
  { id: 'first_pomodoro', category: 'special', name: 'Tomato Farmer',   desc: 'Complete your first Pomodoro',    icon: '🍅',       color: '#ff6347', threshold: 1 },
  { id: 'pomodoro_10',    category: 'special', name: 'Pomodoro Master', desc: 'Complete 10 Pomodoros',           icon: '🍅🍅',     color: '#e05535', threshold: 10 },
  { id: 'night_owl',      category: 'special', name: 'Night Owl',       desc: 'Work after midnight',             icon: '🦉',       color: '#191970', threshold: 1 },
  { id: 'early_bird',     category: 'special', name: 'Dawn Mage',       desc: 'Work before 6am',                 icon: '🌅',       color: '#ffa500', threshold: 1 },
  { id: 'full_day',       category: 'special', name: 'Devoted',         desc: 'Log 8+ hours in a single day',    icon: '🌟',       color: '#d4a843', threshold: 1 },
  { id: 'weekend_warrior',category: 'special', name: 'Weekend Warrior', desc: 'Work on a weekend',               icon: '⚔️',       color: '#8a6fd4', threshold: 1 },
  { id: 'habit_10_days',  category: 'special', name: 'Ritual Keeper',   desc: 'Keep a habit for 10 days',        icon: '🌱',       color: '#4a9a6f', threshold: 1 },
  { id: 'reminder_set',   category: 'special', name: 'Planner',         desc: 'Set your first reminder',         icon: '🔔',       color: '#d4a843', threshold: 1 }
];

window.ACHIEVEMENTS = ACHIEVEMENTS;

// ── Medals (milestone awards with a distinct visual style) ─────
const MEDALS = [
  { id: 'medal_work_100h',    name: '100h Worker',          desc: 'Logged 100 hours of work',              icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.6)',  category: 'work',     threshold: 360000 },
  { id: 'medal_work_500h',    name: '500h Ironclad',        desc: 'Logged 500 hours of work',              icon: '🥈', color: '#c0c0c0', glow: 'rgba(192,192,192,0.6)', category: 'work',     threshold: 1800000 },
  { id: 'medal_work_1000h',   name: 'Archmage of Labor',    desc: 'Logged 1,000 hours of work',            icon: '⚗️', color: '#a78bfa', glow: 'rgba(167,139,250,0.9)', category: 'work',     threshold: 3600000 },
  { id: 'medal_study_100h',   name: '100h Scholar',         desc: 'Studied for 100 hours',                 icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.6)',  category: 'study',    threshold: 360000 },
  { id: 'medal_study_500h',   name: '500h Grand Sage',      desc: 'Studied for 500 hours',                 icon: '🥈', color: '#c0c0c0', glow: 'rgba(192,192,192,0.6)', category: 'study',    threshold: 1800000 },
  { id: 'medal_study_1000h',  name: 'Thousand-Year Mage',   desc: 'Studied for 1,000 hours — like Frieren',icon: '🌟', color: '#e0c87a', glow: 'rgba(224,200,122,1.0)', category: 'study',    threshold: 3600000 },
  { id: 'medal_streak_7',     name: 'First Flame',          desc: 'Kept the flame alive for 7 days',       icon: '🕯️', color: '#f97316', glow: 'rgba(249,115,22,0.6)',  category: 'streak',   threshold: 7 },
  { id: 'medal_streak_30',    name: '30-Day Oath',          desc: '30-day streak maintained',              icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.6)',  category: 'streak',   threshold: 30 },
  { id: 'medal_streak_100',   name: '100-Day Legend',       desc: '100-day streak maintained',             icon: '🥇', color: '#d4a843', glow: 'rgba(212,168,67,0.8)',  category: 'streak',   threshold: 100 },
  { id: 'medal_streak_365',   name: 'Year of Glory',        desc: '365-day streak — legendary!',           icon: '🌠', color: '#a78bfa', glow: 'rgba(167,139,250,0.8)', category: 'streak',   threshold: 365 },
  { id: 'medal_sessions_10',  name: 'Apprentice',           desc: 'Completed 10 sessions',                 icon: '🪄', color: '#7c5cbf', glow: 'rgba(124,92,191,0.6)',  category: 'sessions', threshold: 10 },
  { id: 'medal_sessions_50',  name: 'Journeyman',           desc: 'Completed 50 sessions',                 icon: '⚔️', color: '#3d8b7a', glow: 'rgba(61,139,122,0.6)',  category: 'sessions', threshold: 50 },
  { id: 'medal_sessions_100', name: 'Century Session',      desc: 'Completed 100 sessions',                icon: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.6)',  category: 'sessions', threshold: 100 },
  { id: 'medal_sessions_500', name: 'Session Titan',        desc: 'Completed 500 sessions',                icon: '🥇', color: '#d4a843', glow: 'rgba(212,168,67,0.8)',  category: 'sessions', threshold: 500 },
  { id: 'medal_sessions_1000',name: 'Eternal Wanderer',     desc: 'Completed 1,000 sessions — a true adventurer', icon: '🌌', color: '#818cf8', glow: 'rgba(129,140,248,0.9)', category: 'sessions', threshold: 1000 },
  { id: 'medal_tasks_10',     name: 'Grimoire Initiate',    desc: 'Completed 10 spells/tasks',             icon: '📜', color: '#84cc16', glow: 'rgba(132,204,22,0.5)',  category: 'tasks',    threshold: 10 },
  { id: 'medal_tasks_50',     name: 'Rune Weaver',          desc: 'Completed 50 spells/tasks',             icon: '🔮', color: '#8b5cf6', glow: 'rgba(139,92,246,0.6)',  category: 'tasks',    threshold: 50 },
  { id: 'medal_tasks_100',    name: 'Spell Master',         desc: 'Completed 100 spells/tasks',            icon: '🥇', color: '#d4a843', glow: 'rgba(212,168,67,0.8)',  category: 'tasks',    threshold: 100 },
  { id: 'medal_tasks_500',    name: 'Grand Grimoire',       desc: 'Completed 500 spells/tasks',            icon: '📖', color: '#a78bfa', glow: 'rgba(167,139,250,0.9)', category: 'tasks',    threshold: 500 },
  { id: 'medal_journal_10',   name: 'First Ink',            desc: 'Wrote 10 journal entries',              icon: '🖊️', color: '#38bdf8', glow: 'rgba(56,189,248,0.5)',  category: 'journal',  threshold: 10 },
  { id: 'medal_journal_50',   name: 'Story Keeper',         desc: 'Wrote 50 journal entries',              icon: '📒', color: '#0ea5e9', glow: 'rgba(14,165,233,0.6)',  category: 'journal',  threshold: 50 },
  { id: 'medal_journal_100',  name: 'Chronicle Master',     desc: 'Wrote 100 journal entries',             icon: '🥇', color: '#d4a843', glow: 'rgba(212,168,67,0.8)',  category: 'journal',  threshold: 100 },
  { id: 'medal_journal_365',  name: 'Tome of a Lifetime',   desc: 'Wrote 365 journal entries — one per day', icon: '🗺️', color: '#f59e0b', glow: 'rgba(245,158,11,0.8)', category: 'journal',  threshold: 365 },
  { id: 'medal_early_bird',   name: 'Dawn Sentinel',        desc: 'Complete 5 sessions before 7 AM',       icon: '🌅', color: '#fb923c', glow: 'rgba(251,146,60,0.7)',  category: 'special',  threshold: 0 },
  { id: 'medal_night_owl',    name: 'Moonwatch Mage',       desc: 'Complete 5 sessions after 10 PM',       icon: '🦉', color: '#6366f1', glow: 'rgba(99,102,241,0.7)',  category: 'special',  threshold: 0 },
  { id: 'medal_pomodoro_25',  name: 'Tomato Sorcerer',      desc: 'Complete 25 Pomodoro cycles',           icon: '🍅', color: '#ef4444', glow: 'rgba(239,68,68,0.6)',   category: 'special',  threshold: 0 },

  // Reader medals
  { id: 'medal_reader_1doc',  name: 'First Page Turner',    desc: 'Read your first document in-app',       icon: '📄', color: '#60a5fa', glow: 'rgba(96,165,250,0.5)',  category: 'reader',   threshold: 1 },
  { id: 'medal_reader_5docs', name: 'Eager Learner',        desc: 'Open 5 documents in the reader',        icon: '📚', color: '#3b82f6', glow: 'rgba(59,130,246,0.6)',  category: 'reader',   threshold: 5 },
  { id: 'medal_reader_20docs',name: 'Bibliophile',          desc: 'Open 20 documents in the reader',       icon: '🗂️', color: '#2563eb', glow: 'rgba(37,99,235,0.7)',   category: 'reader',   threshold: 20 },
  { id: 'medal_reader_50p',   name: 'Page Pilgrim',         desc: 'Read 50 pages total in the reader',     icon: '📖', color: '#818cf8', glow: 'rgba(129,140,248,0.6)', category: 'reader',   threshold: 50 },
  { id: 'medal_reader_500p',  name: 'Scroll Sage',          desc: 'Read 500 pages total in the reader',    icon: '📜', color: '#a78bfa', glow: 'rgba(167,139,250,0.8)', category: 'reader',   threshold: 500 },
  { id: 'medal_reader_2000p', name: 'Tome Master',          desc: 'Read 2,000 pages — a true scholar',     icon: '🌟', color: '#e0c87a', glow: 'rgba(224,200,122,1.0)', category: 'reader',   threshold: 2000 },
];

window.MEDALS = MEDALS;

const RIBBON_COLORS = {
  work:     ['#8b0000', '#cd5c5c'],
  study:    ['#00008b', '#4169e1'],
  streak:   ['#8b6914', '#d4a843'],
  sessions: ['#006400', '#32cd32'],
  journal:  ['#4b0082', '#9370db'],
  tasks:    ['#008080', '#20b2aa'],
  special:  ['#2f2f2f', '#c0c0c0'],
  reader:   ['#1e3a8a', '#60a5fa']
};

window.RIBBON_COLORS = RIBBON_COLORS;

const Achievements = (function () {

  async function getUnlocked() {
    return await Storage.get('achievements', {});
  }

  async function setUnlocked(data) {
    await Storage.set('achievements', data);
  }

  async function getUnlockedMedals() {
    return await Storage.get('medals', {});
  }

  async function setUnlockedMedals(data) {
    await Storage.set('medals', data);
  }

  async function checkAchievements(stats) {
    const unlocked = await getUnlocked();
    const unlockedMedals = await getUnlockedMedals();
    const newlyUnlocked = [];
    const newlyUnlockedMedals = [];

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

    // Check medals
    for (const medal of MEDALS) {
      if (unlockedMedals[medal.id]) continue;

      let met = false;
      switch (medal.category) {
        case 'work':     met = (stats.totalWork || 0) >= medal.threshold; break;
        case 'study':    met = (stats.totalStudy || 0) >= medal.threshold; break;
        case 'streak':   met = (stats.streak || 0) >= medal.threshold; break;
        case 'sessions': met = (stats.totalSessions || 0) >= medal.threshold; break;
        case 'tasks':    met = (stats.tasksDone || 0) >= medal.threshold; break;
        case 'journal':  met = (stats.journalEntries || 0) >= medal.threshold; break;
        case 'reader':
          if (medal.id.includes('doc'))  met = (stats.readerDocs  || 0) >= medal.threshold;
          else                           met = (stats.readerPages || 0) >= medal.threshold;
          break;
        case 'special':  met = !!(stats[medal.id]); break;
      }

      if (met) {
        unlockedMedals[medal.id] = { unlockedAt: Date.now() };
        newlyUnlockedMedals.push(medal);
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

    if (newlyUnlockedMedals.length > 0) {
      await setUnlockedMedals(unlockedMedals);
      for (const medal of newlyUnlockedMedals) {
        showMedalToast(medal);
      }
      renderMedalRack('medalRack');
    }
  }

  function showAchievementToast(ach) {
    if (window.showToast) {
      window.showToast(`🏆 Achievement Unlocked: ${ach.icon} ${ach.name}`, 'achievement');
    }
  }

  function showMedalToast(medal) {
    if (window.showToast) {
      window.showToast(`🏅 Medal Earned: ${medal.icon} ${medal.name}`, 'achievement');
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

  async function renderMedalRack(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const unlockedMedals = await getUnlockedMedals();
    container.innerHTML = '';

    const earned = MEDALS.filter(m => unlockedMedals[m.id]);
    if (earned.length === 0) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;padding:8px;">No medals yet. Reach major milestones to earn medals!</p>';
      return;
    }

    for (const medal of earned) {
      const badge = document.createElement('div');
      badge.className = 'medal-badge';
      badge.title = `${medal.name} — ${medal.desc}`;
      badge.style.setProperty('--medal-color', medal.color);
      badge.style.setProperty('--medal-glow', medal.glow);
      badge.innerHTML = `
        <div class="medal-icon">${medal.icon}</div>
        <div class="medal-name">${medal.name}</div>
      `;
      container.appendChild(badge);
    }
  }

  async function getEarnedMedalIds() {
    const medals = await getUnlockedMedals();
    return Object.keys(medals);
  }

  return {
    ACHIEVEMENTS,
    checkAchievements,
    renderAchievementsGrid,
    renderRibbonRack,
    renderMedalRack,
    getUnlocked,
    getEarnedMedalIds
  };
})();

window.Achievements = Achievements;
