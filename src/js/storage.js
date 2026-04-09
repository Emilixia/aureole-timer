// Frieren Chronomark — Data persistence layer
// Uses Electron IPC bridge (window.aureole) with localStorage fallback

const DEFAULT_WALKER_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 52" width="32" height="52"><circle cx="16" cy="6" r="5" fill="#9b7dd4"/><path d="M11 4 Q13 0 16 1 Q19 0 21 4" fill="#7c5cbf" stroke="none"/><rect x="13" y="11" width="6" height="14" rx="3" fill="#9b7dd4"/><path d="M10 14 L8 30 Q16 28 24 30 L22 14 Z" fill="#7c5cbf" opacity="0.8"/><line x1="13" y1="14" x2="7" y2="22" stroke="#9b7dd4" stroke-width="3" stroke-linecap="round"/><circle cx="7" cy="22" r="2" fill="#9b7dd4"/><line x1="19" y1="14" x2="25" y2="19" stroke="#9b7dd4" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="19" r="2" fill="#9b7dd4"/><line x1="14" y1="25" x2="11" y2="36" stroke="#7c5cbf" stroke-width="3" stroke-linecap="round"/><line x1="11" y1="36" x2="7" y2="40" stroke="#7c5cbf" stroke-width="3" stroke-linecap="round"/><line x1="18" y1="25" x2="21" y2="34" stroke="#7c5cbf" stroke-width="3" stroke-linecap="round"/><line x1="21" y1="34" x2="26" y2="36" stroke="#7c5cbf" stroke-width="3" stroke-linecap="round"/><circle cx="5" cy="18" r="1" fill="#d4a843" opacity="0.8"/><circle cx="28" cy="25" r="1" fill="#3d8b7a" opacity="0.7"/></svg>`);

window.DEFAULT_WALKER_SVG = DEFAULT_WALKER_SVG;

const Storage = {
  async get(key, defaultValue) {
    if (defaultValue === undefined) defaultValue = null;
    try {
      if (window.aureole) {
        const raw = await window.aureole.storeRead(key);
        if (raw !== null && raw !== undefined) {
          const parsed = JSON.parse(raw);
          if (parsed === null) return defaultValue;
          return parsed;
        }
        return defaultValue;
      }
    } catch (e) {
      // fall through to localStorage
    }
    try {
      const item = localStorage.getItem('aureole_' + key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },

  async set(key, value) {
    try {
      if (window.aureole) {
        await window.aureole.storeWrite(key, JSON.stringify(value));
        return;
      }
    } catch (e) {
      // fall through to localStorage
    }
    try {
      localStorage.setItem('aureole_' + key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage.set failed:', e);
    }
  },

  async update(key, updater, defaultValue) {
    if (defaultValue === undefined) defaultValue = {};
    const current = await this.get(key, defaultValue);
    const updated = updater(current);
    await this.set(key, updated);
    return updated;
  },

  async remove(key) {
    try {
      if (window.aureole) {
        await window.aureole.storeRemove(key);
        return;
      }
    } catch (e) {}
    try {
      localStorage.removeItem('aureole_' + key);
    } catch (e) {}
  }
};

window.Storage = Storage;
