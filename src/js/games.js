// Frieren Chronomark — Games: Gacha, Battle Pass, Fidget Zone

var Games = (function () {

  // ── Currency ──────────────────────────────────────────────────────────────
  var _currency = 0;

  async function loadCurrency() {
    _currency = await Storage.get('gamesCurrency', 0);
    renderCurrency();
  }
  async function saveCurrency() {
    await Storage.set('gamesCurrency', _currency);
  }
  function renderCurrency() {
    var el = document.getElementById('gamesCurrencyVal');
    if (el) el.textContent = _currency;
  }
  function addCurrency(amount) {
    _currency = Math.max(0, _currency + amount);
    saveCurrency();
    renderCurrency();
  }

  // Called by timer.js after a session is saved — awards 1 shard per focus minute
  function awardSessionShards(durationSeconds) {
    var mins = Math.floor(durationSeconds / 60);
    if (mins > 0) {
      addCurrency(mins);
      if (window.showToast) window.showToast('💎 +" + mins + " Arcane Shards earned!', 'success');
    }
    // Award Battle Pass XP (1 per 10 seconds of focus)
    addBattlePassXP(Math.floor(durationSeconds / 10));
  }

  // ── Gacha Items ──────────────────────────────────────────────────────────
  var RARITIES = {
    common:    { label: 'Common',    color: '#aaaaaa', weight: 50, minVal: 1,   maxVal: 10  },
    uncommon:  { label: 'Uncommon',  color: '#4fc47a', weight: 25, minVal: 10,  maxVal: 30  },
    rare:      { label: 'Rare',      color: '#4a9eff', weight: 15, minVal: 30,  maxVal: 80  },
    epic:      { label: 'Epic',      color: '#b44fff', weight: 8,  minVal: 80,  maxVal: 200 },
    legendary: { label: 'Legendary', color: '#ffc540', weight: 2,  minVal: 200, maxVal: 500 }
  };

  var CASES = {
    arcane: {
      name: 'Arcane Case', cost: 50, emoji: '🔮',
      items: [
        { id:'a1', name:'Whisper Wand',        emoji:'🪄', rarity:'common'    },
        { id:'a2', name:'Minor Mana Crystal',  emoji:'💠', rarity:'common'    },
        { id:'a3', name:'Dust Vial',           emoji:'⚗️', rarity:'common'    },
        { id:'a4', name:'Silver Rune',         emoji:'🔷', rarity:'uncommon'  },
        { id:'a5', name:'Arcane Compass',      emoji:'🧭', rarity:'uncommon'  },
        { id:'a6', name:'Spectral Lens',       emoji:'🔭', rarity:'rare'      },
        { id:'a7', name:'Enchanted Grimoire',  emoji:'📗', rarity:'rare'      },
        { id:'a8', name:'Aether Orb',          emoji:'🔮', rarity:'epic'      },
        { id:'a9', name:"Frieren's Staff",     emoji:'⚡', rarity:'legendary' }
      ]
    },
    celestial: {
      name: 'Celestial Case', cost: 120, emoji: '🌟',
      items: [
        { id:'c1', name:'Starlight Shard',     emoji:'✨', rarity:'common'    },
        { id:'c2', name:'Moon Petal',          emoji:'🌸', rarity:'common'    },
        { id:'c3', name:'Comet Fragment',      emoji:'☄️', rarity:'uncommon'  },
        { id:'c4', name:'Celestial Map',       emoji:'🗺️', rarity:'uncommon'  },
        { id:'c5', name:'Aurora Crystal',      emoji:'🌈', rarity:'rare'      },
        { id:'c6', name:'Nebula Cloak',        emoji:'🌌', rarity:'rare'      },
        { id:'c7', name:'Stardust Crown',      emoji:'👑', rarity:'epic'      },
        { id:'c8', name:'Constellation Key',   emoji:'🗝️', rarity:'epic'      },
        { id:'c9', name:'Eternal Star',        emoji:'⭐', rarity:'legendary' }
      ]
    },
    void: {
      name: 'Void Case', cost: 200, emoji: '🌑',
      items: [
        { id:'v1', name:'Dark Shard',          emoji:'🖤', rarity:'common'    },
        { id:'v2', name:'Shadow Wisp',         emoji:'👻', rarity:'common'    },
        { id:'v3', name:'Void Splinter',       emoji:'🌑', rarity:'uncommon'  },
        { id:'v4', name:'Abyssal Rune',        emoji:'🌀', rarity:'uncommon'  },
        { id:'v5', name:'Soul Lantern',        emoji:'🏮', rarity:'rare'      },
        { id:'v6', name:'Nightmare Sigil',     emoji:'💀', rarity:'rare'      },
        { id:'v7', name:'Void Mantle',         emoji:'🧥', rarity:'epic'      },
        { id:'v8', name:'Dark Matter Core',    emoji:'⚫', rarity:'epic'      },
        { id:'v9', name:'The Void Tome',       emoji:'📕', rarity:'legendary' }
      ]
    }
  };

  var _selectedCase = 'arcane';
  var _inventory = [];
  var _opening = false;

  async function loadInventory() {
    _inventory = await Storage.get('gachaInventory', []);
    renderInventory();
  }
  async function saveInventory() {
    await Storage.set('gachaInventory', _inventory);
  }

  function randomRarity() {
    var totalWeight = Object.values(RARITIES).reduce(function (s, r) { return s + r.weight; }, 0);
    var roll = Math.random() * totalWeight;
    var cumulative = 0;
    for (var key in RARITIES) {
      cumulative += RARITIES[key].weight;
      if (roll < cumulative) return key;
    }
    return 'common';
  }

  function rollItem(caseId) {
    var caseDef = CASES[caseId];
    var rarity = randomRarity();
    // find matching items of that rarity from this case, fallback to any
    var pool = caseDef.items.filter(function (i) { return i.rarity === rarity; });
    if (!pool.length) pool = caseDef.items;
    var item = pool[Math.floor(Math.random() * pool.length)];
    var rarDef = RARITIES[item.rarity];
    var value = rarDef.minVal + Math.floor(Math.random() * (rarDef.maxVal - rarDef.minVal + 1));
    return Object.assign({}, item, { value: value, obtainedAt: Date.now() });
  }

  function buildReelItems(winItem, caseId) {
    // 28 random + win at position 22
    var items = [];
    for (var i = 0; i < 28; i++) {
      items.push(rollItem(caseId));
    }
    items[22] = winItem;
    return items;
  }

  function openCase() {
    if (_opening) return;
    var caseDef = CASES[_selectedCase];
    if (_currency < caseDef.cost) {
      if (window.showToast) window.showToast('Not enough 💎 Arcane Shards!', 'error');
      return;
    }
    _opening = true;
    addCurrency(-caseDef.cost);

    var winItem = rollItem(_selectedCase);
    var reelItems = buildReelItems(winItem, _selectedCase);
    var reelEl = document.getElementById('gachaReel');
    var resultEl = document.getElementById('gachaResult');
    var openBtn = document.getElementById('gachaOpenBtn');
    if (!reelEl) { _opening = false; return; }

    // Build reel DOM
    reelEl.innerHTML = '';
    var ITEM_W = 90;
    reelItems.forEach(function (item) {
      var rarDef = RARITIES[item.rarity];
      var div = document.createElement('div');
      div.className = 'gacha-reel-item';
      div.style.borderColor = rarDef.color;
      div.innerHTML = '<div class="gri-emoji">' + item.emoji + '</div>' +
        '<div class="gri-name">' + item.name + '</div>' +
        '<div class="gri-rarity" style="color:' + rarDef.color + '">' + rarDef.label + '</div>';
      reelEl.appendChild(div);
    });

    if (openBtn) openBtn.disabled = true;
    if (resultEl) resultEl.style.display = 'none';

    // Animate reel to land on item[22]
    var targetOffset = 22 * ITEM_W - (document.getElementById('gachaReelWrap').offsetWidth / 2 - ITEM_W / 2);
    reelEl.style.transition = 'none';
    reelEl.style.transform = 'translateX(0px)';
    // Force reflow
    reelEl.getBoundingClientRect();
    reelEl.style.transition = 'transform 4s cubic-bezier(0.05, 0.85, 0.18, 1.0)';
    reelEl.style.transform = 'translateX(-' + targetOffset + 'px)';

    setTimeout(function () {
      _opening = false;
      if (openBtn) openBtn.disabled = false;
      // Show result
      var rarDef = RARITIES[winItem.rarity];
      if (resultEl) {
        resultEl.style.display = 'flex';
        resultEl.innerHTML = '<div class="gacha-result-inner" style="border-color:' + rarDef.color + ';box-shadow:0 0 30px ' + rarDef.color + '55;">' +
          '<div class="gr-emoji">' + winItem.emoji + '</div>' +
          '<div class="gr-name">' + winItem.name + '</div>' +
          '<div class="gr-rarity" style="color:' + rarDef.color + '">' + rarDef.label + '</div>' +
          '<div class="gr-value">💎 ' + winItem.value + ' value</div>' +
          '</div>';
      }
      // Add to inventory
      _inventory.unshift(winItem);
      saveInventory();
      renderInventory();
      // Gain shards equal to 20% of item value
      var bonus = Math.floor(winItem.value * 0.2);
      if (bonus > 0) {
        addCurrency(bonus);
        if (window.showToast) window.showToast(winItem.emoji + ' Got ' + winItem.name + '! +' + bonus + ' 💎 bonus', 'success');
      }
    }, 4200);
  }

  function renderInventory() {
    var grid = document.getElementById('gachaInvGrid');
    var count = document.getElementById('gachaInvCount');
    if (!grid) return;
    if (count) count.textContent = _inventory.length + ' items';
    grid.innerHTML = '';
    _inventory.slice(0, 48).forEach(function (item) {
      var rarDef = RARITIES[item.rarity] || RARITIES.common;
      var div = document.createElement('div');
      div.className = 'gacha-inv-item';
      div.title = item.name + ' (' + rarDef.label + ') — 💎' + item.value;
      div.style.borderColor = rarDef.color;
      div.innerHTML = '<span class="gii-emoji">' + item.emoji + '</span>';
      grid.appendChild(div);
    });
  }

  // ── Battle Pass ─────────────────────────────────────────────────────────
  var BP_TIERS = 50;
  var BP_XP_PER_TIER = 500;

  var _bpXP   = 0;
  var _bpTier = 1;

  var BP_REWARDS = (function () {
    var rewards = {};
    for (var i = 1; i <= BP_TIERS; i++) {
      if (i % 10 === 0) {
        rewards[i] = { emoji: '🌟', label: (i === 50 ? 'Legendary Frame' : 'Epic Reward'), shards: i * 10 };
      } else if (i % 5 === 0) {
        rewards[i] = { emoji: '💠', label: 'Rare Reward', shards: i * 5 };
      } else {
        rewards[i] = { emoji: '💎', label: 'Arcane Shards', shards: i * 2 };
      }
    }
    return rewards;
  })();

  async function loadBattlePass() {
    var saved = await Storage.get('battlePass', { xp: 0, tier: 1, claimed: [] });
    _bpXP   = saved.xp   || 0;
    _bpTier = saved.tier || 1;
    _bpClaimed = saved.claimed || [];
    renderBattlePass();
  }
  var _bpClaimed = [];
  async function saveBattlePass() {
    await Storage.set('battlePass', { xp: _bpXP, tier: _bpTier, claimed: _bpClaimed });
  }

  function addBattlePassXP(amount) {
    if (!amount) return;
    _bpXP += amount;
    // Level up
    while (_bpXP >= BP_XP_PER_TIER && _bpTier < BP_TIERS) {
      _bpXP -= BP_XP_PER_TIER;
      _bpTier++;
      if (window.showToast) window.showToast('🏆 Battle Pass Tier ' + _bpTier + ' reached!', 'success');
    }
    if (_bpTier >= BP_TIERS) _bpXP = Math.min(_bpXP, BP_XP_PER_TIER);
    saveBattlePass();
    renderBattlePass();
  }

  function renderBattlePass() {
    var xpEl   = document.getElementById('bpXpVal');
    var nextEl = document.getElementById('bpXpNext');
    var fillEl = document.getElementById('bpXpFill');
    var tierEl = document.getElementById('bpTierVal');
    var trackEl = document.getElementById('bpTrack');
    if (xpEl)   xpEl.textContent  = _bpXP;
    if (nextEl) nextEl.textContent = BP_XP_PER_TIER;
    if (fillEl) fillEl.style.width = Math.min(100, (_bpXP / BP_XP_PER_TIER) * 100) + '%';
    if (tierEl) tierEl.textContent = _bpTier;
    if (!trackEl) return;
    trackEl.innerHTML = '';
    for (var i = 1; i <= BP_TIERS; i++) {
      var reward = BP_REWARDS[i];
      var unlocked = i <= _bpTier;
      var claimed  = _bpClaimed.indexOf(i) !== -1;
      var div = document.createElement('div');
      div.className = 'bp-tier' + (unlocked ? ' unlocked' : '') + (claimed ? ' claimed' : '') + (i === _bpTier ? ' current' : '');
      div.innerHTML =
        '<div class="bp-tier-num">T' + i + '</div>' +
        '<div class="bp-tier-reward">' + reward.emoji + '</div>' +
        '<div class="bp-tier-label">' + (reward.shards ? '+' + reward.shards + '💎' : reward.label) + '</div>' +
        (unlocked && !claimed ? '<button class="bp-claim-btn" data-tier="' + i + '">Claim</button>' : '');
      trackEl.appendChild(div);
    }
    // Wire claim buttons
    trackEl.querySelectorAll('.bp-claim-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tier = parseInt(this.dataset.tier, 10);
        claimBPReward(tier);
      });
    });
  }

  function claimBPReward(tier) {
    if (_bpClaimed.indexOf(tier) !== -1) return;
    _bpClaimed.push(tier);
    var reward = BP_REWARDS[tier];
    addCurrency(reward.shards || 0);
    saveBattlePass();
    renderBattlePass();
    if (window.showToast) window.showToast('🎁 Claimed T' + tier + ': +' + (reward.shards || 0) + ' 💎', 'success');
  }

  // ── Fidget Spinner ───────────────────────────────────────────────────────
  var _spinVelocity = 0;
  var _spinAngle = 0;
  var _spinAnimId = null;
  var _spinMouseDown = false;
  var _spinLastTime = 0;

  function initSpinner() {
    var spinner = document.getElementById('fidgetSpinner');
    var speedEl = document.getElementById('fidgetSpinnerSpeed');
    if (!spinner) return;

    function applyAngle() {
      spinner.style.transform = 'rotate(' + _spinAngle + 'deg)';
      if (speedEl) {
        var rpm = Math.round(Math.abs(_spinVelocity) * 10);
        speedEl.textContent = 'RPM: ' + rpm;
      }
    }

    function tick(ts) {
      if (!_spinLastTime) _spinLastTime = ts;
      var dt = Math.min((ts - _spinLastTime) / 1000, 0.05);
      _spinLastTime = ts;
      _spinAngle += _spinVelocity * dt * 60;
      if (!_spinMouseDown) {
        _spinVelocity *= Math.pow(0.992, dt * 60);
        if (Math.abs(_spinVelocity) < 0.01) _spinVelocity = 0;
      }
      applyAngle();
      _spinAnimId = requestAnimationFrame(tick);
    }
    if (_spinAnimId) cancelAnimationFrame(_spinAnimId);
    _spinAnimId = requestAnimationFrame(tick);

    spinner.addEventListener('mousedown', function (e) {
      _spinMouseDown = true;
      _spinVelocity += 12 + Math.random() * 8;
      e.preventDefault();
    });
    spinner.addEventListener('mouseup', function () { _spinMouseDown = false; });
    spinner.addEventListener('mouseleave', function () { _spinMouseDown = false; });
    spinner.addEventListener('touchstart', function (e) {
      _spinMouseDown = true;
      _spinVelocity += 12 + Math.random() * 8;
      e.preventDefault();
    }, { passive: false });
    spinner.addEventListener('touchend', function () { _spinMouseDown = false; });
  }

  // ── 3D Stress Cube ───────────────────────────────────────────────────────
  var _cubeRotX = -20, _cubeRotY = 30;
  var _cubeDragging = false;
  var _cubeLastX = 0, _cubeLastY = 0;
  var _cubeVelX = 0, _cubeVelY = 0;
  var _cubeAnimId = null;

  function initCube() {
    var cube = document.getElementById('fidgetCube');
    if (!cube) return;

    function applyCube() {
      cube.style.transform = 'rotateX(' + _cubeRotX + 'deg) rotateY(' + _cubeRotY + 'deg)';
    }

    function tickCube() {
      if (!_cubeDragging) {
        _cubeVelX *= 0.95;
        _cubeVelY *= 0.95;
        _cubeRotX += _cubeVelX;
        _cubeRotY += _cubeVelY;
      }
      applyCube();
      _cubeAnimId = requestAnimationFrame(tickCube);
    }
    if (_cubeAnimId) cancelAnimationFrame(_cubeAnimId);
    _cubeAnimId = requestAnimationFrame(tickCube);

    cube.addEventListener('mousedown', function (e) {
      _cubeDragging = true;
      _cubeLastX = e.clientX;
      _cubeLastY = e.clientY;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!_cubeDragging) return;
      var dx = e.clientX - _cubeLastX;
      var dy = e.clientY - _cubeLastY;
      _cubeVelY = dx * 0.5;
      _cubeVelX = -dy * 0.5;
      _cubeRotY += dx * 0.5;
      _cubeRotX -= dy * 0.5;
      _cubeLastX = e.clientX;
      _cubeLastY = e.clientY;
      applyCube();
    });
    document.addEventListener('mouseup', function () { _cubeDragging = false; });
  }

  // ── Bubble Wrap ──────────────────────────────────────────────────────────
  var BUBBLE_COUNT = 80;

  function initBubbles() {
    var grid = document.getElementById('fidgetBubbleGrid');
    var resetBtn = document.getElementById('fidgetBubbleReset');
    if (!grid) return;
    buildBubbles(grid);
    if (resetBtn) resetBtn.addEventListener('click', function () { buildBubbles(grid); });
  }

  function buildBubbles(grid) {
    grid.innerHTML = '';
    for (var i = 0; i < BUBBLE_COUNT; i++) {
      var b = document.createElement('div');
      b.className = 'fidget-bubble';
      b.addEventListener('click', function () {
        if (this.classList.contains('popped')) return;
        this.classList.add('popped');
        // soft pop sound via Web Audio
        try {
          var ctx = new (window.AudioContext || window.webkitAudioContext)();
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(320, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.start();
          osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
      });
      grid.appendChild(b);
    }
  }

  // ── Sub-tab switching ────────────────────────────────────────────────────
  function initSubTabs() {
    document.querySelectorAll('.games-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.games-tab').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('.games-section').forEach(function (s) { s.classList.remove('active'); });
        btn.classList.add('active');
        var sec = document.getElementById('gsec-' + btn.dataset.gtab);
        if (sec) sec.classList.add('active');
      });
    });
  }

  // ── Case selection ───────────────────────────────────────────────────────
  function initCaseSelection() {
    document.querySelectorAll('.gacha-case-card').forEach(function (card) {
      card.addEventListener('click', function () {
        document.querySelectorAll('.gacha-case-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        _selectedCase = card.dataset.case;
      });
    });
    var openBtn = document.getElementById('gachaOpenBtn');
    if (openBtn) openBtn.addEventListener('click', openCase);
  }

  // ── Public init ──────────────────────────────────────────────────────────
  async function init() {
    await loadCurrency();
    await loadInventory();
    await loadBattlePass();
    initSubTabs();
    initCaseSelection();
    initSpinner();
    initCube();
    initBubbles();
  }

  return {
    init: init,
    awardSessionShards: awardSessionShards,
    addCurrency: addCurrency
  };
})();

window.Games = Games;
