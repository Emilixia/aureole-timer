// Frieren Chronomark — Profile Module

const Profile = (function () {

  // ── Military rank table (18 grades, Private → General) ────────────────────
  // Each entry: { grade, name, minLevel, insignia: HTML string }
  const RANKS = [
    { grade: 'E-1',  name: 'Private',            minLevel:  1, insignia: '' },
    { grade: 'E-2',  name: 'Private First Class', minLevel:  3, insignia: '<i class="ins-chevron">∧</i>' },
    { grade: 'E-3',  name: 'Lance Corporal',      minLevel:  5, insignia: '<i class="ins-chevron">∧</i><i class="ins-chevron">∧</i>' },
    { grade: 'E-4',  name: 'Corporal',            minLevel:  8, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span>' },
    { grade: 'E-5',  name: 'Sergeant',            minLevel: 12, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span>' },
    { grade: 'E-6',  name: 'Staff Sergeant',      minLevel: 17, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span><span class="ins-rocker">⌣</span>' },
    { grade: 'E-7',  name: 'Sergeant First Class',minLevel: 23, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span><span class="ins-rocker">⌣⌣</span>' },
    { grade: 'E-8',  name: 'Master Sergeant',     minLevel: 30, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span><span class="ins-rocker">⌣⌣⌣</span>' },
    { grade: 'E-9',  name: 'Sergeant Major',      minLevel: 38, insignia: '<span class="ins-row"><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i><i class="ins-chevron">∧</i></span><span class="ins-rocker ins-star">⌣★⌣</span>' },
    { grade: 'W-1',  name: 'Warrant Officer',     minLevel: 47, insignia: '<span class="ins-bar ins-bar-split"></span>' },
    { grade: 'O-1',  name: '2nd Lieutenant',      minLevel: 57, insignia: '<span class="ins-bar ins-bar-gold"></span>' },
    { grade: 'O-2',  name: '1st Lieutenant',      minLevel: 68, insignia: '<span class="ins-bar ins-bar-silver"></span>' },
    { grade: 'O-3',  name: 'Captain',             minLevel: 80, insignia: '<span class="ins-bar ins-bar-gold"></span><span class="ins-bar ins-bar-gold" style="margin-left:3px"></span>' },
    { grade: 'O-4',  name: 'Major',               minLevel: 93, insignia: '<span class="ins-leaf ins-leaf-gold">❧</span>' },
    { grade: 'O-5',  name: 'Lt. Colonel',         minLevel:107, insignia: '<span class="ins-leaf ins-leaf-silver">❧</span>' },
    { grade: 'O-6',  name: 'Colonel',             minLevel:122, insignia: '<span class="ins-eagle">🦅</span>' },
    { grade: 'O-7',  name: 'Brigadier General',   minLevel:138, insignia: '<span class="ins-star-row">★</span>' },
    { grade: 'O-8',  name: 'Major General',       minLevel:155, insignia: '<span class="ins-star-row">★★</span>' },
    { grade: 'O-9',  name: 'Lt. General',         minLevel:173, insignia: '<span class="ins-star-row">★★★</span>' },
    { grade: 'O-10', name: 'General',             minLevel:192, insignia: '<span class="ins-star-row">★★★★</span>' },
  ];

  function getRankForLevel(level) {
    let rank = RANKS[0];
    for (let i = 0; i < RANKS.length; i++) {
      if (level >= RANKS[i].minLevel) rank = RANKS[i];
    }
    return rank;
  }

  function getTitleForHours(hours) {
    if (hours >= 500) return 'Legendary Mage';
    if (hours >= 100) return 'Arcane Master';
    if (hours >= 50)  return 'Senior Mage';
    if (hours >= 20)  return 'Adept Mage';
    if (hours >= 5)   return 'Journeyman Mage';
    return 'Apprentice Mage';
  }

  function formatHours(seconds) {
    return (seconds / 3600).toFixed(1) + 'h';
  }

  // XP system: level n requires n*60 minutes (cumulative)
  function getXpInfo(totalMinutes) {
    let level = 1;
    let xpUsed = 0;
    while (totalMinutes >= xpUsed + level * 60) {
      xpUsed += level * 60;
      level++;
    }
    const xpInLevel = totalMinutes - xpUsed;
    const xpForNext = level * 60;
    const pct = Math.min(100, Math.floor((xpInLevel / xpForNext) * 100));
    return { level, xpInLevel, xpForNext, pct };
  }

  async function loadProfile() {
    return await Storage.get('profile', {
      name: 'Adventurer',
      title: 'Apprentice Mage',
      bio: '',
      avatarDataUrl: ''
    });
  }

  async function saveProfileData(data) {
    await Storage.set('profile', data);
  }

  async function renderProfile() {
    const profile = await loadProfile();

    const nameEl = document.getElementById('profileName');
    const titleEl = document.getElementById('profileTitle');
    const bioEl = document.getElementById('profileBio');
    const avatarEl = document.getElementById('profileAvatar');
    const editNameEl = document.getElementById('editName');
    const editTitleEl = document.getElementById('editTitle');
    const editBioEl = document.getElementById('editBio');

    if (nameEl) nameEl.textContent = profile.name || 'Adventurer';
    if (titleEl) titleEl.textContent = profile.title || 'Apprentice Mage';
    if (bioEl) bioEl.textContent = profile.bio || '';

    if (avatarEl) {
      if (profile.avatarDataUrl) {
        avatarEl.src = profile.avatarDataUrl;
      } else {
        avatarEl.src = '../assets/frieren-default.gif';
      }
    }

    if (editNameEl) editNameEl.value = profile.name || '';
    if (editTitleEl) editTitleEl.value = profile.title || '';
    if (editBioEl) editBioEl.value = profile.bio || '';

    await updateProfileStats();
  }

  function generateInitialAvatar(initial) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#7c5cbf"/>
          <stop offset="100%" style="stop-color:#3d8b7a"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="url(#grad)"/>
      <text x="60" y="75" font-family="system-ui,sans-serif" font-size="52" font-weight="bold"
            fill="#e2d9f3" text-anchor="middle">${initial}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  async function updateProfileStats() {
    const sessions = await Storage.get('chronicle', []);

    const totalWork = sessions
      .filter(function (s) { return s.type === 'working'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);

    const totalStudy = sessions
      .filter(function (s) { return s.type === 'studying'; })
      .reduce(function (sum, s) { return sum + s.duration; }, 0);

    const totalHours = (totalWork + totalStudy) / 3600;
    const totalMins = Math.floor((totalWork + totalStudy) / 60);
    const streak = window.Chronicle ? window.Chronicle.calculateStreak(sessions) : 0;
    const xpInfo = getXpInfo(totalMins);
    const masteryScore = Math.floor(totalHours * 10);

    // Update profile stats display
    const workEl = document.getElementById('profileTotalWork');
    const studyEl = document.getElementById('profileTotalStudy');
    const sessionsEl = document.getElementById('profileSessions');
    const streakEl = document.getElementById('profileStreak');
    const masteryEl = document.getElementById('profileMasteryScore');

    if (workEl) workEl.textContent = formatHours(totalWork);
    if (studyEl) studyEl.textContent = formatHours(totalStudy);
    if (sessionsEl) sessionsEl.textContent = sessions.length;
    if (streakEl) streakEl.textContent = streak;
    if (masteryEl) masteryEl.textContent = masteryScore;

    // XP bar
    const xpFillEl = document.getElementById('prfXpFill');
    const xpLevelEl = document.getElementById('prfXpLevel');
    const xpCurrentEl = document.getElementById('prfXpCurrent');
    const xpNextEl = document.getElementById('prfXpNext');
    const levelBadgeEl = document.getElementById('prfLevelNum');

    if (xpFillEl) xpFillEl.style.width = xpInfo.pct + '%';
    if (xpLevelEl) xpLevelEl.textContent = xpInfo.level;
    if (xpCurrentEl) xpCurrentEl.textContent = xpInfo.xpInLevel;
    if (xpNextEl) xpNextEl.textContent = xpInfo.xpForNext;
    if (levelBadgeEl) levelBadgeEl.textContent = xpInfo.level;

    // Military rank
    const rank = getRankForLevel(xpInfo.level);
    const rankInsigniaEl = document.getElementById('prfRankInsignia');
    const rankGradeEl    = document.getElementById('prfRankGrade');
    const rankNameEl     = document.getElementById('prfRankName');
    const profileRankName = document.getElementById('profileRankName');
    const profileRankIcon = document.getElementById('profileRankIcon');
    if (rankInsigniaEl) rankInsigniaEl.innerHTML = rank.insignia || '<span class="ins-none">–</span>';
    if (rankGradeEl)    rankGradeEl.textContent  = rank.grade;
    if (rankNameEl)     rankNameEl.textContent    = rank.name;
    if (profileRankName) profileRankName.textContent = rank.name;
    if (profileRankIcon) profileRankIcon.innerHTML = rank.insignia || '🪖';

    // Auto-update title based on total hours
    const newTitle = getTitleForHours(totalHours);
    const profile = await loadProfile();
    if (profile.title !== newTitle && !profile.customTitle) {
      profile.title = newTitle;
      await saveProfileData(profile);
      const titleEl = document.getElementById('profileTitle');
      if (titleEl) titleEl.textContent = newTitle;
    }

    // Update achievements displays
    if (window.Achievements) {
      await window.Achievements.renderAchievementsGrid('achievementsGrid');
      await window.Achievements.renderRibbonRack('ribbonRack');
      await window.Achievements.renderMedalRack('medalRack');
      await renderSidebarMedals();
    }

    // Keep the nav-bar level badge in sync
    if (window.refreshNavProfile) window.refreshNavProfile();
  }

  async function renderSidebarMedals() {
    const row = document.getElementById('prfMedalsRow');
    if (!row) return;
    const earned = await window.Achievements ? window.Achievements.getEarnedMedalIds() : [];
    if (!earned || earned.length === 0) {
      row.innerHTML = '<span class="prf-medals-empty">No medals yet</span>';
      return;
    }
    // Show up to 3 most recently-earned medals
    const allMedals = window.MEDALS || [];
    const display = earned.slice(-3).reverse().map(function (id) {
      return allMedals.find(function (m) { return m.id === id; });
    }).filter(Boolean);
    row.innerHTML = display.map(function (m) {
      return '<div class="prf-medal-badge" style="border-color:' + m.color + ';box-shadow:0 0 8px ' + (m.glow || 'transparent') + ';" title="' + m.name + ': ' + m.desc + '">' + m.icon + '</div>';
    }).join('');
  }

  async function handleAvatarUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (ev) {
      const dataUrl = ev.target.result;
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) avatarEl.src = dataUrl;

      const profile = await loadProfile();
      profile.avatarDataUrl = dataUrl;
      await saveProfileData(profile);
      if (window.showToast) window.showToast('Avatar updated! 📷', 'success');
      if (window.refreshNavProfile) window.refreshNavProfile();
    };
    reader.readAsDataURL(file);
  }

  function showEditForm() {
    const displayInfo = document.getElementById('profileDisplayInfo');
    const editForm = document.getElementById('profileEditForm');
    if (displayInfo) displayInfo.style.display = 'none';
    if (editForm) editForm.style.display = 'block';
  }

  function hideEditForm() {
    const displayInfo = document.getElementById('profileDisplayInfo');
    const editForm = document.getElementById('profileEditForm');
    if (displayInfo) displayInfo.style.display = 'block';
    if (editForm) editForm.style.display = 'none';
  }

  async function saveProfile() {
    const nameInput = document.getElementById('editName');
    const titleInput = document.getElementById('editTitle');
    const bioInput = document.getElementById('editBio');

    const name = (nameInput && nameInput.value.trim()) || 'Adventurer';
    const title = (titleInput && titleInput.value.trim()) || '';
    const bio = (bioInput && bioInput.value.trim()) || '';

    const profile = await loadProfile();
    profile.name = name;
    profile.bio = bio;
    if (title) {
      profile.title = title;
      profile.customTitle = true;
    } else {
      profile.customTitle = false;
    }
    await saveProfileData(profile);
    hideEditForm();
    await renderProfile();
    if (window.showToast) window.showToast('Profile saved! ✨', 'success');
    if (window.refreshNavProfile) window.refreshNavProfile();
  }

  function init() {
    const editBtn = document.getElementById('editProfileBtn');
    const saveBtn = document.getElementById('saveProfile');
    const cancelBtn = document.getElementById('cancelProfile');
    const avatarUpload = document.getElementById('profileAvatarUpload');

    if (editBtn) editBtn.addEventListener('click', showEditForm);
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);
    if (cancelBtn) cancelBtn.addEventListener('click', hideEditForm);

    if (avatarUpload) {
      avatarUpload.addEventListener('change', function (e) {
        handleAvatarUpload(e.target.files[0]);
      });
    }

    renderProfile();
  }

  return {
    init: init,
    renderProfile: renderProfile,
    updateProfileStats: updateProfileStats
  };
})();

window.Profile = Profile;
