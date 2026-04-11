// Frieren Chronomark — Profile Module

const Profile = (function () {

  // ── Military rank insignia SVG generator ──────────────────────────────────
  function buildInsigniaSVG(grade) {
    var BG = '#2a3d2a', GOLD = '#c9a227', SILVER = '#a8b8c4', DARK = '#111';

    // 5-pointed star polygon centered at (cx, cy) with outer radius r
    function star(cx, cy, r, fill) {
      var pts = [];
      for (var i = 0; i < 10; i++) {
        var angle = (i * 36 - 90) * Math.PI / 180;
        var rad = (i % 2 === 0) ? r : r * 0.42;
        pts.push((cx + rad * Math.cos(angle)).toFixed(1) + ',' + (cy + rad * Math.sin(angle)).toFixed(1));
      }
      return '<polygon points="' + pts.join(' ') + '" fill="' + fill + '"/>';
    }

    // Enlisted chevron badge — 56×72 viewBox, gold V-stripes + optional rockers
    function chevBadge(nChev, nRock, decal) {
      var t = 4, sg = 2; // stripe half-height and gap
      var stripeH = t * 2 + sg; // 10px per stripe
      var totalH  = (nChev + nRock) * stripeH;
      var topPad  = Math.round((72 - totalH) / 2);
      var content = '';

      // Chevrons (V pointing up)
      for (var c = 0; c < nChev; c++) {
        var y0 = topPad + c * stripeH;
        content +=
          '<polygon points="' +
          '3,' + (y0 + t) + ' ' +
          '28,' + y0 + ' ' +
          '53,' + (y0 + t) + ' ' +
          '53,' + (y0 + t * 2) + ' ' +
          '28,' + (y0 + t) + ' ' +
          '3,' + (y0 + t * 2) +
          '" fill="' + GOLD + '"/>';
      }

      // Rockers (concave arcs below chevrons)
      for (var r = 0; r < nRock; r++) {
        var ry = topPad + nChev * stripeH + r * stripeH;
        content +=
          '<path d="M3,' + ry + ' Q28,' + (ry + t * 2.2) + ' 53,' + ry +
          ' L53,' + (ry + t) + ' Q28,' + (ry + t * 2.2 + t) + ' 3,' + (ry + t) + ' Z"' +
          ' fill="' + GOLD + '"/>';
      }

      // Decal above chevrons (E-9 star)
      if (decal === 'star' && topPad > 8) {
        content += star(28, topPad - 9, 6, GOLD);
      }

      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 72" width="56" height="72">' +
             '<rect width="56" height="72" fill="' + BG + '" rx="4"/>' +
             content + '</svg>';
    }

    // Officer epaulet board — 48×64 viewBox
    function epaulet(inner) {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64" width="48" height="64">' +
             '<path d="M6,14 L42,14 L44,56 Q24,62 4,56 Z" fill="' + BG + '"/>' +
             '<circle cx="24" cy="14" r="5" fill="' + GOLD + '" stroke="' + DARK + '" stroke-width="0.5"/>' +
             inner + '</svg>';
    }

    // Simplified oak-leaf silhouette (4-lobe symmetric)
    function oakLeaf(fill) {
      return '<path d="M24,27 C22,22 15,22 15,28 C15,33 20,33 20,37 C17,37 13,39 13,43 C13,47 18,47 21,47' +
             ' L24,52 L27,47 C30,47 35,47 35,43 C35,39 31,37 28,37 C28,33 33,33 33,28 C33,22 26,22 24,27 Z"' +
             ' fill="' + fill + '"/>';
    }

    // Simplified eagle silhouette (spread wings, for Colonel)
    function eagle() {
      return '<path d="M24,26 C21,23 10,28 6,34 C11,31 17,33 21,32 C21,37 23,42 24,44' +
             ' C25,42 27,37 27,32 C31,33 37,31 42,34 C38,28 27,23 24,26 Z' +
             ' M22,44 L20,54 L24,50 L28,54 L26,44 Z" fill="' + GOLD + '"/>';
    }

    switch (grade) {
      case 'E-1': return chevBadge(1, 0, null);
      case 'E-2': return chevBadge(1, 0, null);
      case 'E-3': return chevBadge(2, 0, null);
      case 'E-4': return chevBadge(2, 0, null);
      case 'E-5': return chevBadge(3, 0, null);
      case 'E-6': return chevBadge(3, 1, null);
      case 'E-7': return chevBadge(3, 2, null);
      case 'E-8': return chevBadge(3, 3, null);
      case 'E-9': return chevBadge(3, 3, 'star');
      case 'W-1': return epaulet(
        '<rect x="9" y="37" width="30" height="7" rx="1" fill="' + GOLD + '" opacity="0.45"/>' +
        '<rect x="9" y="37" width="14" height="7" rx="1" fill="' + GOLD + '"/>'
      );
      case 'O-1': return epaulet('<rect x="9" y="40" width="30" height="9" rx="1" fill="' + GOLD + '"/>');
      case 'O-2': return epaulet('<rect x="9" y="40" width="30" height="9" rx="1" fill="' + SILVER + '"/>');
      case 'O-3': return epaulet(
        '<rect x="9" y="33" width="30" height="8" rx="1" fill="' + SILVER + '"/>' +
        '<rect x="9" y="44" width="30" height="8" rx="1" fill="' + SILVER + '"/>'
      );
      case 'O-4': return epaulet(oakLeaf(GOLD));
      case 'O-5': return epaulet(oakLeaf(SILVER));
      case 'O-6': return epaulet(eagle());
      case 'O-7': return epaulet(star(24, 41, 10, SILVER));
      case 'O-8': return epaulet(star(15, 43, 9, SILVER) + star(33, 43, 9, SILVER));
      case 'O-9': return epaulet(
        star(24, 32, 9, SILVER) + star(13, 47, 9, SILVER) + star(35, 47, 9, SILVER)
      );
      case 'O-10': return epaulet(
        star(24, 27, 8, SILVER) + star(12, 40, 8, SILVER) +
        star(36, 40, 8, SILVER) + star(24, 53, 8, SILVER)
      );
      default: return '';
    }
  }

  // ── Military rank table (E-1 Private → O-10 General) ──────────────────────
  const RANKS = [
    { grade: 'E-1',  name: 'Private',             minLevel:   1 },
    { grade: 'E-2',  name: 'Private First Class',  minLevel:   3 },
    { grade: 'E-3',  name: 'Lance Corporal',        minLevel:   5 },
    { grade: 'E-4',  name: 'Corporal',              minLevel:   8 },
    { grade: 'E-5',  name: 'Sergeant',              minLevel:  12 },
    { grade: 'E-6',  name: 'Staff Sergeant',        minLevel:  17 },
    { grade: 'E-7',  name: 'Sergeant First Class',  minLevel:  23 },
    { grade: 'E-8',  name: 'Master Sergeant',       minLevel:  30 },
    { grade: 'E-9',  name: 'Sergeant Major',        minLevel:  38 },
    { grade: 'W-1',  name: 'Warrant Officer',       minLevel:  47 },
    { grade: 'O-1',  name: '2nd Lieutenant',        minLevel:  57 },
    { grade: 'O-2',  name: '1st Lieutenant',        minLevel:  68 },
    { grade: 'O-3',  name: 'Captain',               minLevel:  80 },
    { grade: 'O-4',  name: 'Major',                 minLevel:  93 },
    { grade: 'O-5',  name: 'Lt. Colonel',           minLevel: 107 },
    { grade: 'O-6',  name: 'Colonel',               minLevel: 122 },
    { grade: 'O-7',  name: 'Brigadier General',     minLevel: 138 },
    { grade: 'O-8',  name: 'Major General',         minLevel: 155 },
    { grade: 'O-9',  name: 'Lt. General',           minLevel: 173 },
    { grade: 'O-10', name: 'General',               minLevel: 192 },
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

    // Keep the nav-bar level badge in sync directly
    const navLevelEl = document.getElementById('navPfLevel');
    if (navLevelEl) navLevelEl.textContent = xpInfo.level;

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
