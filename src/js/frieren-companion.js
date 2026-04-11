// Frieren Companion — fixed 3D character (bottom-right) + help panel
(function () {
  'use strict';

  var SPEECHES = [
    'Hello, adventurer! Need help?',
    'Stay focused. You can do it!',
    'Time flies when you\'re working hard.',
    'Remember to take breaks!',
    'A thousand-year journey begins with one step.',
    'You\'re doing great, keep going!',
    'Tap me to open the guide ✨',
    'Set your start time and click Apply!',
    'Even a mage of a thousand years takes one step at a time.',
    'The Pomodoro technique is Frieren-approved! 🍅',
    'Don\'t forget — short breaks restore your mana.',
    'Focus mode engaged. Nothing can distract you now.',
  ];

  // Periodic idle animation sequence (cycles through these)
  var IDLE_ACTIONS = ['wave', 'think', 'stretch', 'ponder', 'shrug', 'nod', 'sneeze', 'bow', 'cheer', 'wave', 'think', 'ponder'];

  var speechTimer = null;
  var helpVisible = false;
  var idleActionIdx = 0;

  // ── AI Chat state ─────────────────────────────────────────
  var chatHistory = []; // { role: 'user'|'assistant', content: string }
  var homeChatHistory = []; // separate history for home screen chat
  var aiSettings = { provider: 'gemini', key: '' };
  var homeCharacter = null; // FrierenCharacter instance for home screen

  var FRIEREN_SYSTEM_PROMPT =
    'You are Frieren, an elven mage who has lived for over a thousand years. ' +
    'You are calm, slightly aloof, and deadpan — but genuinely kind and helpful underneath. ' +
    'You often reference spells, ancient journeys, and the passage of time as metaphors for productivity. ' +
    'You are the companion inside Aureole Timer, a focus and productivity app. ' +
    'Help the user with their work sessions, study habits, Pomodoro technique, and general productivity. ' +
    'Keep your replies concise (2–4 sentences unless more depth is clearly needed). ' +
    'Stay in character — speak as Frieren would. Do not break character.\n\n' +
    'IMPORTANT — When the user asks you to set, start, pause, stop, or reset a timer, ' +
    'you MUST include a command token at the END of your reply (after your in-character text). ' +
    'Use EXACTLY this format (on its own line, nothing else after it):\n' +
    '[CMD:timer:SET:minutes] — to set and start a countdown timer (replace "minutes" with the number)\n' +
    '[CMD:timer:POMODORO] — to start a Pomodoro session\n' +
    '[CMD:timer:PAUSE] — to pause the running timer\n' +
    '[CMD:timer:STOP] — to stop the timer\n' +
    '[CMD:timer:RESET] — to reset the timer\n' +
    'When the user asks to open a tab or switch to a section (journal, grimoire, chronicle, settings, profile, reader), ' +
    'include at the end: [CMD:tab:TABNAME] (e.g. [CMD:tab:journal]).\n' +
    'Only include one command token per reply. Do not mention the token in your in-character text.';

  function getTimerContext() {
    var lines = [];
    try {
      var ts = window.Timer && window.Timer.getState ? window.Timer.getState() : null;
      if (ts) {
        lines.push('Timer running: ' + (ts.isRunning ? 'yes' : 'no') + (ts.isPaused ? ' (paused)' : ''));
        if (ts.isRunning && ts.totalDuration > 0) {
          var pct = Math.round(100 * (1 - ts.elapsed / ts.totalDuration));
          lines.push('Session progress: ~' + Math.max(0, pct) + '% remaining');
          lines.push('Session type: ' + (ts.sessionLabel || ts.sessionType));
        }
      }
    } catch (e) { /* ignore */ }
    return lines.length ? '\n\n[Timer context: ' + lines.join('; ') + ']' : '';
  }

  // ── Timer / Tab command execution ─────────────────────────
  function parseAndExecuteCommand(reply) {
    // Extract last [CMD:...] token from reply
    var cmdMatch = reply.match(/\[CMD:([^\]]+)\]\s*$/m);
    if (!cmdMatch) return reply;

    var parts = cmdMatch[1].split(':');
    var category = parts[0]; // 'timer' or 'tab'

    if (category === 'timer') {
      var action = parts[1];
      if (action === 'SET' && parts[2]) {
        var mins = parseInt(parts[2], 10);
        if (mins > 0) executeSetTimer(mins);
      } else if (action === 'POMODORO') {
        executePomodoro();
      } else if (action === 'PAUSE') {
        if (window.Timer) window.Timer.pause();
      } else if (action === 'STOP') {
        if (window.Timer) window.Timer.stop();
      } else if (action === 'RESET') {
        if (window.Timer) window.Timer.reset();
      }
    } else if (category === 'tab') {
      var tabName = (parts[1] || '').toLowerCase();
      var validTabs = ['journey', 'journal', 'grimoire', 'chronicle', 'reader', 'settings', 'profile'];
      if (validTabs.indexOf(tabName) !== -1) {
        var btn = document.querySelector('.nav-tab[data-tab="' + tabName + '"]');
        if (btn) btn.click();
      }
    }

    // Strip command token from displayed reply
    return reply.replace(/\n?\[CMD:[^\]]+\]\s*$/, '').trim();
  }

  function executeSetTimer(minutes) {
    // 1. Switch to journey tab
    var journeyBtn = document.querySelector('.nav-tab[data-tab="journey"]');
    if (journeyBtn) journeyBtn.click();

    setTimeout(function () {
      // 2. If mode select is visible, dismiss it and show timer view
      var modeSelect = document.getElementById('journeyModeSelect');
      var timerView  = document.getElementById('journeyTimerView');
      var pomView    = document.getElementById('journeyPomodoroView');
      if (modeSelect && modeSelect.style.display !== 'none') {
        modeSelect.style.display = 'none';
        if (timerView)  timerView.style.display  = 'flex';
        if (pomView)    pomView.style.display     = 'none';
      }

      // 3. Set duration via inputs
      var hours   = Math.floor(minutes / 60);
      var mins    = minutes % 60;
      var hInput  = document.getElementById('durationHours');
      var mInput  = document.getElementById('durationMinutes');
      if (hInput) hInput.value = hours;
      if (mInput) mInput.value = mins;
      var setBtn = document.getElementById('setDurationBtn');
      if (setBtn) setBtn.click();

      // 4. Start timer
      setTimeout(function () {
        if (window.Timer) window.Timer.start();
      }, 120);
    }, 150);
  }

  function executePomodoro() {
    var journeyBtn = document.querySelector('.nav-tab[data-tab="journey"]');
    if (journeyBtn) journeyBtn.click();

    setTimeout(function () {
      var modeSelect  = document.getElementById('journeyModeSelect');
      var timerView   = document.getElementById('journeyTimerView');
      var pomView     = document.getElementById('journeyPomodoroView');
      if (modeSelect) modeSelect.style.display  = 'none';
      if (timerView)  timerView.style.display   = 'none';
      if (pomView)    pomView.style.display      = 'flex';
      if (window.Timer) window.Timer.resetPomodoro();
    }, 150);
  }

  function loadAiSettings() {
    try {
      var raw = localStorage.getItem('companionAiSettings');
      if (raw) { aiSettings = JSON.parse(raw); }
    } catch (e) { /* ignore */ }
  }

  function buildChatUI() {
    var noKey   = document.getElementById('frierenChatNoKey');
    var msgList = document.getElementById('frierenChatMessages');
    var inputRow = document.getElementById('frierenChatInputRow');
    var thinking  = document.getElementById('frierenChatThinking');

    var hasKey = aiSettings.key && aiSettings.key.trim().length > 0;
    if (noKey)    noKey.style.display    = hasKey ? 'none'  : 'block';
    if (msgList)  msgList.style.display  = hasKey ? ''      : 'none';
    if (inputRow) inputRow.style.display = hasKey ? ''      : 'none';
    if (thinking) thinking.style.display = 'none';

    // Also update home chat UI
    var homeNoKey   = document.getElementById('homeChatNoKey');
    var homeInput   = document.getElementById('homeChatInputRow');
    if (homeNoKey)  homeNoKey.style.display  = hasKey ? 'none'  : 'block';
    if (homeInput)  homeInput.style.display  = hasKey ? ''      : 'none';
  }

  function appendChatMessage(role, text, msgListId) {
    var msgList = document.getElementById(msgListId || 'frierenChatMessages');
    if (!msgList) return;

    var wrap = document.createElement('div');
    wrap.className = 'frieren-chat-msg ' + (role === 'user' ? 'user' : 'frieren');

    var sender = document.createElement('div');
    sender.className = 'frieren-chat-sender';
    sender.textContent = role === 'user' ? 'You' : 'Frieren';

    var bubble = document.createElement('div');
    bubble.className = 'frieren-chat-bubble';
    bubble.textContent = text;

    wrap.appendChild(sender);
    wrap.appendChild(bubble);
    msgList.appendChild(wrap);

    // Auto-scroll to bottom
    msgList.scrollTop = msgList.scrollHeight;
  }

  function setThinking(visible, thinkingId, msgListId) {
    var el = document.getElementById(thinkingId || 'frierenChatThinking');
    if (el) el.classList.toggle('visible', visible);
    var msgList = document.getElementById(msgListId || 'frierenChatMessages');
    if (msgList && visible) msgList.scrollTop = msgList.scrollHeight;
  }

  function setSendDisabled(disabled, sendBtnId, sendInputId) {
    var btn   = document.getElementById(sendBtnId   || 'frierenChatSend');
    var input = document.getElementById(sendInputId || 'frierenChatInput');
    if (btn)   btn.disabled   = disabled;
    if (input) input.disabled = disabled;
  }

  async function sendChatMessage(userText, showSpeech, hideSpeech, frieren3d, msgListId, historyArr) {
    userText = userText.trim();
    if (!userText) return;

    msgListId  = msgListId  || 'frierenChatMessages';
    historyArr = historyArr || chatHistory;

    var inputEl = document.getElementById(
      msgListId === 'homeChatMessages' ? 'homeChatInput' : 'frierenChatInput'
    );
    if (inputEl) inputEl.value = '';

    appendChatMessage('user', userText, msgListId);
    historyArr.push({ role: 'user', content: userText });

    var thinkingId = msgListId === 'homeChatMessages' ? 'homeChatThinking' : 'frierenChatThinking';
    var sendBtnId  = msgListId === 'homeChatMessages' ? 'homeChatSend'     : 'frierenChatSend';
    var sendInputId= msgListId === 'homeChatMessages' ? 'homeChatInput'    : 'frierenChatInput';

    setSendDisabled(true, sendBtnId, sendInputId);
    setThinking(true, thinkingId, msgListId);
    if (frieren3d && typeof frieren3d.think === 'function') frieren3d.think();

    try {
      var contextSuffix = getTimerContext();
      var reply = await callAiApi(historyArr, contextSuffix);

      // Parse + execute any embedded command token
      var cleanReply = parseAndExecuteCommand(reply);

      historyArr.push({ role: 'assistant', content: cleanReply });
      appendChatMessage('assistant', cleanReply, msgListId);
      setThinking(false, thinkingId, msgListId);
      setSendDisabled(false, sendBtnId, sendInputId);

      // Show first ~120 chars in speech bubble
      if (showSpeech) {
        var snippet = cleanReply.length > 120 ? cleanReply.slice(0, 117) + '…' : cleanReply;
        showSpeech(snippet);
        setTimeout(function () { if (hideSpeech) hideSpeech(); }, 5000);
      }
      if (frieren3d && typeof frieren3d.nod === 'function') frieren3d.nod();

    } catch (err) {
      setThinking(false, thinkingId, msgListId);
      setSendDisabled(false, sendBtnId, sendInputId);
      var errMsg = '…I couldn\'t reach the outside world. ' + (err.message || 'Unknown error.');
      historyArr.push({ role: 'assistant', content: errMsg });
      appendChatMessage('assistant', errMsg, msgListId);
    }
  }

  async function callAiApi(history, contextSuffix) {
    var key = aiSettings.key.trim();
    var provider = aiSettings.provider || 'gemini';

    if (!key) throw new Error('No API key configured.');

    // Build message list — inject context into the last user message
    var messages = history.map(function (m, i) {
      if (i === history.length - 1 && m.role === 'user' && contextSuffix) {
        return { role: m.role, content: m.content + contextSuffix };
      }
      return { role: m.role, content: m.content };
    });

    if (provider === 'openai') {
      return callOpenAI(key, messages);
    }
    if (provider === 'groq') {
      return callGroq(key, messages);
    }
    return callGemini(key, messages);
  }

  async function callOpenAI(key, messages) {    var payload = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: FRIEREN_SYSTEM_PROMPT }].concat(messages),
      max_tokens: 300,
      temperature: 0.85,
    };
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      var d = await res.json().catch(function () { return {}; });
      throw new Error(d.error && d.error.message ? d.error.message : 'OpenAI HTTP ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content.trim();
  }

  async function callGroq(key, messages) {
    var payload = {
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'system', content: FRIEREN_SYSTEM_PROMPT }].concat(messages),
      max_tokens: 300,
      temperature: 0.85,
    };
    var res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      var d = await res.json().catch(function () { return {}; });
      throw new Error(d.error && d.error.message ? d.error.message : 'Groq HTTP ' + res.status);
    }
    var data = await res.json();
    return data.choices[0].message.content.trim();
  }

  async function callGemini(key, messages) {
    // Gemini uses a different format; system instruction is separate
    var contents = messages.map(function (m) {
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] };
    });
    var payload = {
      system_instruction: { parts: [{ text: FRIEREN_SYSTEM_PROMPT }] },
      contents: contents,
      generationConfig: { maxOutputTokens: 300, temperature: 0.85 },
    };
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key);
    var res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      var d = await res.json().catch(function () { return {}; });
      throw new Error(d.error && d.error.message ? d.error.message : 'Gemini HTTP ' + res.status);
    }
    var data = await res.json();
    return data.candidates[0].content.parts[0].text.trim();
  }

  function init() {
    var companion  = document.getElementById('frierenCompanion');
    var mount      = document.getElementById('frieren3dMount');
    var helpPanel  = document.getElementById('frierenHelpPanel');
    var helpClose  = document.getElementById('frierenHelpClose');
    var speechEl   = document.getElementById('frierenSpeech');
    var speechText = document.getElementById('frierenSpeechText');

    if (!companion) return;

    // Load AI settings on startup
    loadAiSettings();

    // ── Init 3D character ─────────────────────────────────
    var frieren3d = null;
    if (mount && typeof FrierenCharacter !== 'undefined') {
      frieren3d = new FrierenCharacter(mount, { width: 340, height: 370 });
      frieren3d.init();
    }

    // ── Expose global API for settings panel ──────────────────────────────
    window.FrierenCompanion = {
      reconfigure: function (opts) {
        if (frieren3d) frieren3d.reconfigure(opts);
      },
      resize: function (w, h) {
        if (frieren3d) frieren3d.resize(w, h);
        // Also resize the mount element so the renderer fits
        if (mount) {
          mount.style.width  = w + 'px';
          mount.style.height = h + 'px';
        }
      },
      getCharacter: function () { return frieren3d; },
      reloadAiSettings: function () {
        loadAiSettings();
        buildChatUI();
      },
    };

    var minBtn     = document.getElementById('frierenMinBtn');
    var minimized  = localStorage.getItem('frierenMinimized') === '1';

    function applyMinimized(val) {
      minimized = val;
      localStorage.setItem('frierenMinimized', val ? '1' : '0');
      if (val) {
        companion.classList.add('frieren--minimized');
        if (minBtn) minBtn.textContent = '✦';
        if (minBtn) minBtn.title = 'Restore companion';
        hideSpeech();
        if (helpPanel) helpPanel.style.display = 'none';
        helpVisible = false;
      } else {
        companion.classList.remove('frieren--minimized');
        if (minBtn) minBtn.textContent = '−';
        if (minBtn) minBtn.title = 'Minimize companion';
      }
    }

    // Apply stored minimized state on load
    applyMinimized(minimized);

    if (minBtn) {
      minBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        applyMinimized(!minimized);
      });
    }

    // ── Click — toggle help ───────────────────────────────
    companion.addEventListener('click', function () {
      if (!minimized) toggleHelp();
    });

    // ── Hover — wave ──────────────────────────────────────
    companion.addEventListener('mouseenter', function () {
      if (minimized) return;
      if (frieren3d) frieren3d.wave();
      if (!helpVisible) showSpeech(pickSpeech());
    });
    companion.addEventListener('mouseleave', function () {
      if (!helpVisible) hideSpeech();
    });

    // ── Help panel toggle ─────────────────────────────────
    function toggleHelp() {
      helpVisible = !helpVisible;
      if (helpVisible) {
        hideSpeech();
        if (frieren3d) frieren3d.excited();
        if (helpPanel) {
          helpPanel.style.display = 'flex';
          positionHelpPanel();
          buildChatUI();
        }
      } else {
        if (helpPanel) helpPanel.style.display = 'none';
      }
    }

    if (helpClose) {
      helpClose.addEventListener('click', function (e) {
        e.stopPropagation();
        helpVisible = false;
        if (helpPanel) helpPanel.style.display = 'none';
      });
    }

    // ── Help panel tabs ───────────────────────────────────
    document.querySelectorAll('.frieren-help-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.dataset.ftab;
        document.querySelectorAll('.frieren-help-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.frieren-help-section').forEach(function (s) { s.classList.remove('active'); });
        this.classList.add('active');
        var sec = document.getElementById('ftab-' + target);
        if (sec) sec.classList.add('active');
        if (target === 'chat') {
          buildChatUI();
          setTimeout(function () {
            var input = document.getElementById('frierenChatInput');
            if (input && aiSettings.key) input.focus();
          }, 50);
        }
      });
    });

    // ── Position help panel near companion ───────────────
    function positionHelpPanel() {
      if (!helpPanel) return;
      var rect = companion.getBoundingClientRect();
      var panelW = 360;
      var left = rect.left - panelW - 8;
      if (left < 8) left = rect.right + 8;
      var top = Math.max(8, rect.bottom - helpPanel.offsetHeight);
      helpPanel.style.right  = 'auto';
      helpPanel.style.bottom = 'auto';
      helpPanel.style.left   = left + 'px';
      helpPanel.style.top    = top + 'px';
    }

    // ── Speech helpers ────────────────────────────────────
    function showSpeech(text) {
      clearTimeout(speechTimer);
      if (!speechEl || !speechText) return;
      speechText.textContent = text;
      speechEl.style.display = 'block';
      speechTimer = setTimeout(hideSpeech, 3800);
    }
    function hideSpeech() {
      if (speechEl) speechEl.style.display = 'none';
    }
    var speechIdx = 0;
    function pickSpeech() {
      var msg = SPEECHES[speechIdx % SPEECHES.length];
      speechIdx++;
      return msg;
    }

    // ── Chat input wiring (companion panel) ──────────────
    var chatSendBtn   = document.getElementById('frierenChatSend');
    var chatInputEl   = document.getElementById('frierenChatInput');

    function doSend() {
      if (!chatInputEl) return;
      sendChatMessage(chatInputEl.value, showSpeech, hideSpeech, frieren3d,
        'frierenChatMessages', chatHistory);
    }

    if (chatSendBtn) {
      chatSendBtn.addEventListener('click', doSend);
    }
    if (chatInputEl) {
      chatInputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doSend();
        }
      });
      // Auto-grow textarea
      chatInputEl.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      });
    }

    // ── Home screen chat wiring ───────────────────────────
    var homeSendBtn  = document.getElementById('homeChatSend');
    var homeInputEl  = document.getElementById('homeChatInput');

    function doHomeSend() {
      if (!homeInputEl) return;
      sendChatMessage(homeInputEl.value, null, null, homeCharacter,
        'homeChatMessages', homeChatHistory);
    }

    if (homeSendBtn) {
      homeSendBtn.addEventListener('click', doHomeSend);
    }
    if (homeInputEl) {
      homeInputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          doHomeSend();
        }
      });
      homeInputEl.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 80) + 'px';
      });
    }

    // Seed home chat with Frieren's greeting
    if (document.getElementById('homeChatMessages')) {
      appendChatMessage('assistant',
        'The journey of a thousand years begins here. What shall we accomplish today? ' +
        'I am here to help you focus, set timers, and guide your endeavours.',
        'homeChatMessages');
    }
    buildChatUI(); // set initial visibility for home chat too

    // ── Periodic idle animation every 90 s ───────────────
    var waveInterval = setInterval(function () {
      if (helpVisible) return;
      var action = IDLE_ACTIONS[idleActionIdx % IDLE_ACTIONS.length];
      idleActionIdx++;
      if (frieren3d && typeof frieren3d[action] === 'function') frieren3d[action]();
      showSpeech(pickSpeech());
      setTimeout(function () {
        if (!helpVisible) hideSpeech();
      }, 4200);
    }, 90000);

    // ── Timer event hooks ─────────────────────────────────
    document.addEventListener('frieren:timerStart', function () {
      if (frieren3d) frieren3d.nod();
    });
    document.addEventListener('frieren:timerComplete', function () {
      if (frieren3d) frieren3d.cheer();
      showSpeech('✨ Amazing work! Session complete!');
      setTimeout(function () { if (!helpVisible) hideSpeech(); }, 4500);
    });
    document.addEventListener('frieren:breakStart', function () {
      if (frieren3d) frieren3d.stretch();
      showSpeech('Time to recharge your mana! ☕');
      setTimeout(function () { if (!helpVisible) hideSpeech(); }, 4000);
    });

    // ── Home screen 3D Frieren ────────────────────────────
    var home3dMount = document.getElementById('home3dMount');
    if (home3dMount && typeof FrierenCharacter !== 'undefined') {
      homeCharacter = new FrierenCharacter(home3dMount, {
        width: 320, height: 360,
        waistFraction: 0.58,
        headFraction: 1.18,
        fov: 48
      });
      homeCharacter.init();
    }

    window.addEventListener('beforeunload', function () {
      clearInterval(waveInterval);
      if (frieren3d) frieren3d.dispose();
      if (homeCharacter) homeCharacter.dispose();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
