# ✨ Aureole Timer Companion ✨

> *"Magic is not found in the grand gesture, but in the steady flame that burns through every hour."*

A beautiful, fully-featured focus timer and productivity companion built with a dark fantasy / Frieren-inspired aesthetic. Designed with ADHD and autism accessibility at its core — no build tools required, opens directly in your browser.

---

## 🌟 Features

### ⏱️ Journey to Aureole (Timer)
- **Accurate countdown timer** with start/end time inputs or default duration
- **Progress bar** with shimmer overlay and walking character (customizable with your own image/GIF)
- **Multiple time displays**: digital countdown, "Time Left in Words" (e.g. "About 20 minutes left"), and percentage
- **Pomodoro mode** with configurable work/break intervals (default 25/5 min)
- **Session categories**: Working, Studying, and fully custom categories with icons
- **Energy level check-in** (1–5) before each session with ADHD-aware suggestions
- **Hyperfocus guard**: gentle notification after a configurable max session time
- **Break reminders** at configurable intervals
- **Session notes** captured per session
- **Daily Planner**: tasks with Low/Medium/High priority, checkbox completion, drag-order
- **Routine Builder**: pre-configured timer setups (name + category + duration) for repeatable workflows
- **Custom reminders** with time and message (browser Notification API)
- **YouTube Music player** embed (paste URL in Settings)
- Rotating **motivational quotes** from a 20+ quote fantasy pool
- **Body doubling simulation**: "You are not alone on this journey ✨" with pulsing indicator

### 📖 Journal
- **Daily entries** with date picker
- **Rich text formatting**: bold, italic, bullet lists, numbered lists, headings
- **Mood tracker**: 8 emoji moods (😄 😊 😐 😔 😠 😴 😰 🤩)
- **Gratitude section** per entry
- **Search** through all past entries
- Entries auto-saved on input (2-second debounce)
- Dark **parchment/scroll** visual styling

### 📚 Grimoire
- **Spell-book style** notes collection
- **Categories**: General, Ideas, Research, Goals (+ custom)
- Per note: title, content, tags, category, pin
- **Pin important notes** to top
- **Search and filter** by text and tags/category
- Rich dark parchment visual styling with fantasy book aesthetic

### 📜 Chronicle
- **Unified timeline** of all app activity: timer sessions, journal entries, grimoire notes, achievement unlocks
- **Filter** by date range and event type
- Visual timeline with **glowing connected dots**
- **Export** visible timeline to clipboard

### ⚔️ Profile
- **Custom name** and **profile image** (upload, stored as base64)
- **Rank/Title** based on total hours worked:
  - 0–1 hr: Apprentice → 1–10: Journeyman → 10–50: Mage → 50–100: Archmage → 100–500: Grand Sage → 500+: **Aureole**
- **Statistics**: total hours, day streak, sessions, journal entries, grimoire notes, daily focus score (0–100)
- **CSS-only weekly bar chart** showing last 7 days of activity
- **44 Achievements** in military ribbon-rack style:
  - Work milestones: 1h, 5h, 10h, 20h, 50h, 100h, 250h, 500h, 1000h
  - Study milestones: same
  - Streaks: 3, 7, 14, 30, 60, 100, 365 days
  - Journal: first entry, 10, 50, 100, 365 entries
  - Grimoire: first note, 25, 50, 100 notes
  - Sessions: first, 10, 50, 100, 500 sessions
  - Special: Night Owl, Early Bird, Marathon Runner, Zen Master, Century Scholar, Millennium Mage
- Locked achievements shown as **greyed silhouettes with "???"**
- Unlocked badges **glow with CSS shimmer animation**
- **Hover tooltips** with name, description, and unlock date
- **Achievement unlock celebration** with sparkle burst animation

### ⚙️ Settings (all fully functional)
- Background image upload for timer area
- Walking character GIF/image upload
- Accent color picker (updates CSS variables app-wide instantly)
- Font size slider (global, 12–24px)
- Animation intensity slider (0–200%)
- Border style selection (Ornate / Simple / Minimal)
- Default timer duration, Pomodoro work/break durations
- Break reminder interval, Hyperfocus guard max time
- Timer completion sound toggle (Web Audio API beep)
- Notification preferences
- Custom timer categories (add/remove with icon)
- YouTube URL + player size (small/medium/large)
- Accessibility: reduce animations, high contrast, auto-break enforcement, task chunking mode, low demand mode
- **Export all data** as JSON download
- **Import data** from JSON file
- **Reset all data** with confirmation dialog

---

## 🧠 ADHD & Autism-Friendly Features

| Feature | Description |
|---------|-------------|
| **Visual progress everywhere** | Timer bar + percentage + countdown + words simultaneously |
| **Energy check-in** | 5-level check before starting — app adjusts suggestions |
| **Body doubling** | Persistent "You are not alone" with pulsing animation |
| **Breathing exercise** | Guided box breathing (4-4-4-4) with animated expanding/contracting circle — always accessible |
| **Quick capture FAB** | ⚡ floating button to instantly save a thought to Grimoire before it's lost |
| **Hyperfocus guard** | Gentle warning after configurable max session time |
| **Break reminders** | Configurable interval notifications during sessions |
| **Positive reinforcement** | 15+ uplifting messages shown after every completed session |
| **Achievement celebrations** | Sparkle/particle burst on each unlock |
| **Predictable layout** | Sidebar always visible, consistent structure, no surprise changes |
| **Smooth transitions** | 0.3s ease animations on all tab/UI changes |
| **Reduce Animations** | Toggle to remove all motion for sensory sensitivity |
| **High Contrast** | Toggle for visual accessibility |
| **Low Demand Mode** | Simplifies interface to reduce cognitive load |
| **Daily Planner** | Task list with priorities and checkboxes |
| **Routine Builder** | Repeatable session templates to reduce decision fatigue |
| **Weekly review prompt** | Prompted once per week to reflect on progress |
| **Time blindness aids** | Four simultaneous time representations |

---

## 🚀 Getting Started

1. **Clone or download** the repository
2. Open `index.html` in your browser — **no server, no build tools, no installs needed**
3. Set an end time (or use default 25 minutes) and select your energy level
4. Press **Start** to begin your journey!

All your data is automatically saved to your browser's `localStorage` under the key `aureole_state`.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause timer (when not typing in a field) |
| `B` | Open / Close breathing exercise |
| `Q` | Open quick capture |
| `F` | Toggle focus mode (hides sidebar) |
| `Escape` | Close any open modal / exit focus mode |

---

## 🎨 Customization Guide

### Accent Color
Go to **Settings → Appearance → Accent Color**. The picker updates the `--accent-primary` CSS variable instantly, cascading to all UI elements.

### Background Image
**Settings → Appearance → Background Image** — upload any image; it's stored as base64 in localStorage and applied to the app background.

### Walking Character
**Settings → Appearance → Walking Character** — upload a PNG, GIF, or any image to replace the default 🧙 wizard. The character moves along the progress bar.

### Timer Categories
**Settings → Timer Categories** — add categories with custom names and emoji icons. These appear in the category dropdown on the Journey tab.

### YouTube Music
**Settings → Music Player** — paste any YouTube URL (video or playlist). The player size can be set to small/medium/large.

### Font Size
**Settings → Appearance → Font Size** — slider from 12–24px, applies globally via CSS variable.

---

## 🛠️ Technical Details

| Item | Detail |
|------|--------|
| **Files** | `index.html`, `styles.css`, `app.js`, `README.md` |
| **Dependencies** | Google Fonts CDN (Cinzel + Inter), YouTube iframe API |
| **Storage** | `localStorage` key: `aureole_state` |
| **Timer accuracy** | Uses `Date.now()` timestamps (not interval counting) — drift-free |
| **Audio** | Web Audio API for completion beep — no external files |
| **Uploads** | FileReader API → base64 data URLs stored in localStorage |
| **Notifications** | Browser Notification API (requires permission) |
| **CSS theming** | Custom properties (`--accent-primary`, `--font-size-base`, etc.) |
| **Optimized for** | 1920×1080 desktop |
| **Browser support** | Modern browsers (Chrome, Firefox, Edge, Safari) |

### Code Structure (`app.js`)
```
// ===== STATE & STORAGE =====      Lines 1–126
// ===== TIMER SECTION =====        Lines 127–441
// ===== PROGRESS BAR =====         Lines 442–455
// ===== JOURNAL SECTION =====      Lines 456–623
// ===== GRIMOIRE SECTION =====     Lines 624–847
// ===== CHRONICLE SECTION =====    Lines 848–973
// ===== PROFILE SECTION =====      Lines 974–1143
// ===== ACHIEVEMENTS SECTION ===== Lines 1144–1299
// ===== SETTINGS SECTION =====     Lines 1300–1588
// ===== BREATHING EXERCISE =====   Lines 1589–1721
// ===== QUICK CAPTURE =====        Lines 1722–1801
// ===== PARTICLES =====            Lines 1802–1839
// ===== NOTIFICATIONS & REMINDERS= Lines 1840–2063
// ===== ADHD FEATURES =====        Lines 2064–2285
// ===== KEYBOARD SHORTCUTS =====   Lines 2286–2334
// ===== INIT =====                 Lines 2335–end
```

---

## ✨ Credits

- **Design inspiration**: *Frieren: Beyond Journey's End* — the quiet magic of perseverance
- **Fonts**: [Cinzel](https://fonts.google.com/specimen/Cinzel) & [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts
- **Built with**: Vanilla HTML, CSS, and JavaScript — no frameworks, no dependencies

---

*May your focus be unwavering and your journey lead to Aureole. ✨*