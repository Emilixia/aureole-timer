// Aureole Timer — Profile Module

const Profile = (function () {

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
        // Default avatar: initials in SVG
        const initial = (profile.name || 'A')[0].toUpperCase();
        avatarEl.src = generateInitialAvatar(initial);
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
    const streak = window.Chronicle ? window.Chronicle.calculateStreak(sessions) : 0;

    // Update profile stats display
    const workEl = document.getElementById('profileTotalWork');
    const studyEl = document.getElementById('profileTotalStudy');
    const sessionsEl = document.getElementById('profileSessions');
    const streakEl = document.getElementById('profileStreak');

    if (workEl) workEl.textContent = formatHours(totalWork);
    if (studyEl) studyEl.textContent = formatHours(totalStudy);
    if (sessionsEl) sessionsEl.textContent = sessions.length;
    if (streakEl) streakEl.textContent = streak;

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
    }
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
