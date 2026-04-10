/**
 * FrierenCharacter — fully 3D procedural anime character with skeletal animation
 * Built with Three.js. Bone hierarchy implemented as Group transforms.
 *
 * Visual design based on Frieren from "Frieren: Beyond Journey's End":
 *   - Silver twin-tail hair, pointed elf ears, teal eyes
 *   - White cape with gold trim, striped collar
 *   - Dark leggings, brown boots
 */

/* global THREE */

var FrierenCharacter = (function () {
  'use strict';

  // ── Palette ────────────────────────────────────────────────────────────────
  var C = {
    skin:       0xfce8d4,
    skinDark:   0xdfc0a0,
    hair:       0xd4d4ea,
    hairShad:   0xa8a8c8,
    hairTip:    0xc8c8e0,
    ribbon:     0xcc2020,
    cape:       0xf2f0ea,
    capeShad:   0xd8d6d0,
    capeTrim:   0xc8a84a,
    collarBlk:  0x1a1a1a,
    collarGry:  0x808080,
    legging:    0x354060,
    leggShad:   0x253050,
    boot:       0x7a5c36,
    bootDark:   0x5a3c18,
    eyeIris:    0x3a9e8c,
    eyeDark:    0x1a5040,
    eyeLight:   0x6aceba,
    eyeWhite:   0xffffff,
    black:      0x080808,
    gemRed:     0xcc1818,
    outline:    0x080808,
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeIn(t) { var c = clamp(t, 0, 1); return c * c * c; }

  // ── Constructor ────────────────────────────────────────────────────────────
  function FrierenCharacter(container, opts) {
    opts = opts || {};
    this.container = container;
    this.W = opts.width  || 200;
    this.H = opts.height || 340;
    this._T = null;              // THREE namespace

    // Peek state
    this._peekTarget   = 0;      // 0 = hidden, 1 = fully visible
    this._peekProgress = 0;
    this.HIDE_OFFSET   = 1.45;   // world-units to shift down when fully hidden

    // Animation
    this._animTime    = 0;
    this._bones       = {};
    this._eyeMeshes   = [];
    this._blinkTimer  = 0;
    this._blinkGap    = lerp(3, 6, Math.random());
    this._blinkPhase  = 0;       // 0=open  1=closing  2=opening

    // Action (one-shot override on top of idle)
    this._action      = null;
    this._actionTimer = 0;

    this._running     = false;
    this._raf         = null;
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype.init = function () {
    var T = (typeof THREE !== 'undefined') ? THREE : null;
    if (!T) { console.error('[Frieren3D] THREE.js not loaded'); return; }
    this._T = T;

    // Renderer
    var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(this.W, this.H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    this._renderer = renderer;
    this.container.appendChild(renderer.domElement);

    // Scene & camera
    this._scene  = new T.Scene();
    this._camera = new T.PerspectiveCamera(30, this.W / this.H, 0.1, 100);
    this._camera.position.set(0, 0.85, 5.0);
    this._camera.lookAt(0, 0.85, 0);

    this._buildLights();

    // Character root (peek offset applied here)
    this._root = new T.Group();
    this._scene.add(this._root);

    this._buildCharacter();
    this._applyPeek();  // start hidden

    // Render loop
    this._running = true;
    var self = this;
    var last = performance.now();
    function loop() {
      if (!self._running) return;
      self._raf = requestAnimationFrame(loop);
      var now = performance.now();
      var dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      self._update(dt);
      renderer.render(self._scene, self._camera);
    }
    loop();
  };

  // ── Lights ─────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildLights = function () {
    var T = this._T, scene = this._scene;
    scene.add(new T.AmbientLight(0xffffff, 0.65));
    var main = new T.DirectionalLight(0xfff8e0, 1.0);
    main.position.set(-1.5, 3, 4); scene.add(main);
    var fill = new T.DirectionalLight(0xd0e0ff, 0.35);
    fill.position.set(2, 0.5, 1); scene.add(fill);
    var rim = new T.DirectionalLight(0xffe8f0, 0.18);
    rim.position.set(0, 2, -3); scene.add(rim);
  };

  // ── Material helpers ────────────────────────────────────────────────────────
  FrierenCharacter.prototype._toon = function (color, opts) {
    var p = Object.assign({ color: color }, opts || {});
    return new this._T.MeshToonMaterial(p);
  };
  FrierenCharacter.prototype._basic = function (color, opts) {
    var p = Object.assign({ color: color }, opts || {});
    return new this._T.MeshBasicMaterial(p);
  };
  FrierenCharacter.prototype._addOutline = function (mesh, scale) {
    var T = this._T;
    var om = new T.MeshBasicMaterial({ color: C.outline, side: T.BackSide });
    var ov = new T.Mesh(mesh.geometry, om);
    ov.scale.setScalar(scale || 1.055);
    mesh.add(ov);
  };

  // ── Bone factory ──────────────────────────────────────────────────────────
  FrierenCharacter.prototype._bone = function (name) {
    var g = new this._T.Group();
    g.name = name;
    this._bones[name] = g;
    return g;
  };

  // ── Build character ────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildCharacter = function () {
    var B = this._bone.bind(this);

    // ── Skeleton hierarchy ──────────────────────────────────────────────────
    //
    //  root
    //  └─ hips
    //     ├─ spine
    //     │  └─ chest
    //     │     ├─ neck
    //     │     │  └─ head
    //     │     │     ├─ hairRoot
    //     │     │     │  ├─ lTail (left twin-tail)
    //     │     │     │  └─ rTail
    //     │     │     ├─ lEar
    //     │     │     └─ rEar
    //     │     ├─ lShoulder
    //     │     │  └─ lUArm → lFArm → lHand
    //     │     └─ rShoulder
    //     │        └─ rUArm → rFArm → rHand
    //     ├─ lHip → lThigh → lShin → lFoot
    //     └─ rHip → rThigh → rShin → rFoot

    var root    = B('root');
    var hips    = B('hips');
    var spine   = B('spine');
    var chest   = B('chest');
    var neck    = B('neck');
    var head    = B('head');
    var hairRoot= B('hairRoot');
    var lTail   = B('lTail');
    var rTail   = B('rTail');
    var lEarB   = B('lEarBone');
    var rEarB   = B('rEarBone');
    var lShldr  = B('lShldr');
    var rShldr  = B('rShldr');
    var lUArm   = B('lUArm');
    var rUArm   = B('rUArm');
    var lFArm   = B('lFArm');
    var rFArm   = B('rFArm');
    var lHand   = B('lHand');
    var rHand   = B('rHand');
    var lHip    = B('lHip');
    var rHip    = B('rHip');
    var lThigh  = B('lThigh');
    var rThigh  = B('rThigh');
    var lShin   = B('lShin');
    var rShin   = B('rShin');
    var lFoot   = B('lFoot');
    var rFoot   = B('rFoot');

    // Hierarchy wiring
    this._root.add(root);
    root.add(hips);
    hips.add(spine);
    spine.add(chest);
    chest.add(neck);
    neck.add(head);
    head.add(hairRoot);
    hairRoot.add(lTail);
    hairRoot.add(rTail);
    head.add(lEarB);
    head.add(rEarB);
    chest.add(lShldr);
    chest.add(rShldr);
    lShldr.add(lUArm); lUArm.add(lFArm); lFArm.add(lHand);
    rShldr.add(rUArm); rUArm.add(rFArm); rFArm.add(rHand);
    hips.add(lHip); hips.add(rHip);
    lHip.add(lThigh); lThigh.add(lShin); lShin.add(lFoot);
    rHip.add(rThigh); rThigh.add(rShin); rShin.add(rFoot);

    // Bone offsets (from parent)
    hips.position.set(0, 0.38, 0);
    spine.position.set(0, 0.08, 0);
    chest.position.set(0, 0.32, 0);
    neck.position.set(0, 0.34, 0);
    head.position.set(0, 0.20, 0);
    hairRoot.position.set(0, 0.15, 0);
    lTail.position.set(-0.19, 0.0, 0);
    rTail.position.set( 0.19, 0.0, 0);
    lEarB.position.set(-0.22, 0.04, 0);
    rEarB.position.set( 0.22, 0.04, 0);
    lShldr.position.set(-0.32, 0.05, 0);
    rShldr.position.set( 0.32, 0.05, 0);
    lUArm.position.set(0, -0.18, 0);
    rUArm.position.set(0, -0.18, 0);
    lFArm.position.set(0, -0.28, 0);
    rFArm.position.set(0, -0.28, 0);
    lHand.position.set(0, -0.26, 0);
    rHand.position.set(0, -0.26, 0);
    lHip.position.set(-0.10, 0, 0);
    rHip.position.set( 0.10, 0, 0);
    lThigh.position.set(0, -0.20, 0);
    rThigh.position.set(0, -0.20, 0);
    lShin.position.set(0, -0.38, 0);
    rShin.position.set(0, -0.38, 0);
    lFoot.position.set(0, -0.24, 0);
    rFoot.position.set(0, -0.24, 0);

    // Default shoulder rest pose (arms slightly out from cape bulk)
    lShldr.rotation.z =  0.18;
    rShldr.rotation.z = -0.18;

    // ── Build meshes ────────────────────────────────────────────────────────
    this._buildLegs(lThigh, rThigh, lShin, rShin, lFoot, rFoot);
    this._buildTorso(chest);
    this._buildArms(lUArm, rUArm, lFArm, rFArm, lHand, rHand);
    this._buildNeck(neck);
    this._buildHead(head);
    this._buildHair(hairRoot, lTail, rTail);
    this._buildEars(lEarB, rEarB);
  };

  // ── Legs & boots ───────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildLegs = function (lThigh, rThigh, lShin, rShin, lFoot, rFoot) {
    var T  = this._T;
    var me = this;
    var leggMat  = me._toon(C.legging);
    var bootMat  = me._toon(C.boot);
    var darkMat  = me._toon(C.bootDark);

    function addLeg(thigh, shin, foot) {
      // Thigh
      var tGeo = new T.CylinderGeometry(0.092, 0.082, 0.38, 10);
      var tM = new T.Mesh(tGeo, leggMat);
      tM.position.y = -0.19; me._addOutline(tM); thigh.add(tM);

      // Shin
      var sGeo = new T.CylinderGeometry(0.082, 0.070, 0.30, 10);
      var sM = new T.Mesh(sGeo, leggMat);
      sM.position.y = -0.15; me._addOutline(sM); shin.add(sM);

      // Boot shaft
      var bGeo = new T.CylinderGeometry(0.090, 0.086, 0.22, 10);
      var bM = new T.Mesh(bGeo, bootMat);
      bM.position.y = -0.11; me._addOutline(bM); foot.add(bM);

      // Boot top cuff (fold)
      var cGeo = new T.CylinderGeometry(0.105, 0.095, 0.055, 10);
      var cM = new T.Mesh(cGeo, bootMat);
      cM.position.y = -0.0; me._addOutline(cM); foot.add(cM);

      // Boot sole
      var soGeo = new T.CylinderGeometry(0.094, 0.090, 0.04, 10);
      var soM = new T.Mesh(soGeo, darkMat);
      soM.position.y = -0.22; foot.add(soM);

      // Boot toe (rounded front)
      var toeGeo = new T.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, Math.PI * 0.48, Math.PI * 0.52);
      var toeM = new T.Mesh(toeGeo, bootMat);
      toeM.position.set(0, -0.22, 0.03); foot.add(toeM);

      // Laces (small horizontal bars on boot)
      for (var i = 0; i < 3; i++) {
        var lGeo = new T.BoxGeometry(0.12, 0.01, 0.03);
        var lM = new T.Mesh(lGeo, me._basic(C.bootDark));
        lM.position.set(0, -0.05 + i * 0.065, 0.09);
        foot.add(lM);
      }
    }

    addLeg(lThigh, lShin, lFoot);
    addLeg(rThigh, rShin, rFoot);
  };

  // ── Torso / cape ───────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildTorso = function (chest) {
    var T  = this._T;
    var me = this;
    var capeMat  = me._toon(C.cape);
    var trimMat  = me._toon(C.capeTrim);

    // ── Main cape body (wide truncated cone) ────────────────────────────────
    var capeGeo = new T.CylinderGeometry(0.50, 0.48, 0.62, 18);
    var capeMesh = new T.Mesh(capeGeo, capeMat);
    capeMesh.position.y = -0.01; me._addOutline(capeMesh, 1.04); chest.add(capeMesh);

    // Cape bottom gold trim ring
    var bTrimGeo = new T.TorusGeometry(0.485, 0.022, 7, 28);
    var bTrimMesh = new T.Mesh(bTrimGeo, trimMat);
    bTrimMesh.position.y = -0.31; bTrimMesh.rotation.x = Math.PI / 2; chest.add(bTrimMesh);

    // ── Shoulder cape (shorter wider upper section) ─────────────────────────
    var sCapGeo = new T.CylinderGeometry(0.48, 0.50, 0.20, 18);
    var sCapMesh = new T.Mesh(sCapGeo, capeMat);
    sCapMesh.position.y = 0.31; me._addOutline(sCapMesh, 1.04); chest.add(sCapMesh);

    // Shoulder cape bottom trim
    var sTrimGeo = new T.TorusGeometry(0.50, 0.020, 7, 28);
    var sTrimMesh = new T.Mesh(sTrimGeo, trimMat);
    sTrimMesh.position.y = 0.21; sTrimMesh.rotation.x = Math.PI / 2; chest.add(sTrimMesh);

    // ── Cape front opening — vertical gold trim lines ───────────────────────
    var vGeo = new T.BoxGeometry(0.022, 0.62, 0.025);
    var lV = new T.Mesh(vGeo, trimMat); lV.position.set(-0.10, -0.01, 0.49); chest.add(lV);
    var rV = new T.Mesh(vGeo, trimMat); rV.position.set( 0.10, -0.01, 0.49); chest.add(rV);

    // Shoulder cape front trim
    var svGeo = new T.BoxGeometry(0.020, 0.20, 0.022);
    var lSV = new T.Mesh(svGeo, trimMat); lSV.position.set(-0.11, 0.31, 0.47); chest.add(lSV);
    var rSV = new T.Mesh(svGeo, trimMat); rSV.position.set( 0.11, 0.31, 0.47); chest.add(rSV);

    // ── Red gem buttons on shoulders ────────────────────────────────────────
    var gemGeo = new T.SphereGeometry(0.028, 8, 6);
    var gemMat = me._toon(C.gemRed);
    var lGem = new T.Mesh(gemGeo, gemMat); lGem.position.set(-0.46, 0.30, 0.10); chest.add(lGem);
    var rGem = new T.Mesh(gemGeo, gemMat); rGem.position.set( 0.46, 0.30, 0.10); chest.add(rGem);

    // ── Striped underblouse visible at chest opening ────────────────────────
    var stripeGeo = new T.CylinderGeometry(0.13, 0.13, 0.12, 10);
    for (var i = 0; i < 3; i++) {
      var sColor = i % 2 === 0 ? C.collarBlk : C.collarGry;
      var sMesh = new T.Mesh(stripeGeo, me._toon(sColor));
      sMesh.position.set(0, 0.25 - i * 0.042, 0.13);
      sMesh.rotation.x = -0.2; // slight tilt toward camera
      chest.add(sMesh);
    }
  };

  // ── Arms ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildArms = function (lUArm, rUArm, lFArm, rFArm, lHand, rHand) {
    var T  = this._T;
    var me = this;
    var capeMat = me._toon(C.cape);
    var trimMat = me._toon(C.capeTrim);
    var skinMat = me._toon(C.skin);

    function addArm(uArm, fArm, hand) {
      // Cape sleeve (upper arm hidden inside cape)
      var usGeo = new T.CylinderGeometry(0.095, 0.085, 0.28, 9);
      var usM = new T.Mesh(usGeo, capeMat);
      usM.position.y = -0.14; me._addOutline(usM, 1.05); uArm.add(usM);

      // Wrist trim (gold cuff)
      var wGeo = new T.TorusGeometry(0.072, 0.017, 7, 16);
      var wM = new T.Mesh(wGeo, trimMat);
      wM.position.y = -0.14; wM.rotation.x = Math.PI / 2; fArm.add(wM);

      // Forearm (skin, emerges from sleeve)
      var fGeo = new T.CylinderGeometry(0.060, 0.050, 0.20, 9);
      var fM = new T.Mesh(fGeo, skinMat);
      fM.position.y = -0.10; me._addOutline(fM, 1.06); fArm.add(fM);

      // Hand (rounded)
      var hGeo = new T.SphereGeometry(0.058, 10, 7);
      var hM = new T.Mesh(hGeo, skinMat);
      me._addOutline(hM, 1.07); hand.add(hM);

      // Thumb suggestion (small bump)
      var tGeo = new T.SphereGeometry(0.025, 6, 4);
      var tM = new T.Mesh(tGeo, skinMat);
      tM.position.set(0.05, 0.02, 0.03); hand.add(tM);
    }

    addArm(lUArm, lFArm, lHand);
    addArm(rUArm, rFArm, rHand);

    // Store for action animations
    this._lFArm = lFArm; this._rFArm = rFArm;
  };

  // ── Neck / collar ─────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildNeck = function (neck) {
    var T  = this._T;
    var me = this;

    // Neck skin
    var nGeo = new T.CylinderGeometry(0.095, 0.105, 0.17, 10);
    var nMesh = new T.Mesh(nGeo, me._toon(C.skin));
    nMesh.position.y = -0.05; me._addOutline(nMesh, 1.05); neck.add(nMesh);

    // Choker / collar (black base)
    var cGeo = new T.CylinderGeometry(0.115, 0.115, 0.095, 10);
    var cMesh = new T.Mesh(cGeo, me._toon(C.collarBlk));
    cMesh.position.y = 0.01; me._addOutline(cMesh, 1.06); neck.add(cMesh);

    // Gray stripes on collar
    var srGeo = new T.TorusGeometry(0.115, 0.010, 6, 18);
    for (var i = 0; i < 2; i++) {
      var sr = new T.Mesh(srGeo, me._toon(C.collarGry));
      sr.position.y = 0.025 - i * 0.045;
      sr.rotation.x = Math.PI / 2; neck.add(sr);
    }

    // Clasp button (brown)
    var btnGeo = new T.CylinderGeometry(0.022, 0.022, 0.014, 8);
    var btn = new T.Mesh(btnGeo, me._toon(C.boot));
    btn.position.set(0, 0.01, 0.115); btn.rotation.x = Math.PI / 2; neck.add(btn);
  };

  // ── Head ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildHead = function (head) {
    var T  = this._T;
    var me = this;

    // Head sphere (slightly widened for anime proportions)
    var hGeo = new T.SphereGeometry(0.24, 22, 16);
    var hMesh = new T.Mesh(hGeo, me._toon(C.skin));
    me._addOutline(hMesh, 1.07); head.add(hMesh);

    // Slight chin flatten — scale Y down a touch
    hMesh.scale.y = 0.94;

    this._buildEyes(head);
    this._buildNose(head);
    this._buildMouth(head);
  };

  // ── Eyes (anime-style flat planes with iris, pupil, highlight, lid) ───────
  FrierenCharacter.prototype._buildEyes = function (head) {
    var T  = this._T;
    var me = this;
    var EY = 0.035, EZ = 0.228;     // eye vertical position, depth on head

    function makeEye(side) {
      var x = side * 0.093;

      // White of eye (sclera) — slightly rounded plane
      var scGeo = new T.PlaneGeometry(0.105, 0.078);
      var scMesh = new T.Mesh(scGeo, me._basic(C.eyeWhite));
      scMesh.position.set(x, EY, EZ); head.add(scMesh);

      // Iris (teal)
      var irGeo = new T.PlaneGeometry(0.088, 0.075);
      var irMesh = new T.Mesh(irGeo, me._basic(C.eyeIris));
      irMesh.position.set(x, EY, EZ + 0.001); head.add(irMesh);

      // Inner iris shimmer (lighter ellipse)
      var irLGeo = new T.PlaneGeometry(0.048, 0.065);
      var irLMesh = new T.Mesh(irLGeo, me._basic(C.eyeLight));
      irLMesh.position.set(x + side * 0.01, EY, EZ + 0.002); head.add(irLMesh);

      // Pupil (dark circle)
      var puGeo = new T.PlaneGeometry(0.046, 0.060);
      var puMesh = new T.Mesh(puGeo, me._basic(C.eyeDark));
      puMesh.position.set(x, EY, EZ + 0.003); head.add(puMesh);

      // Specular highlight (two white dots)
      var hlGeo = new T.PlaneGeometry(0.022, 0.022);
      var hl1 = new T.Mesh(hlGeo, me._basic(C.eyeWhite));
      hl1.position.set(x + side * 0.02, EY + 0.022, EZ + 0.004); head.add(hl1);
      var hl2 = new T.Mesh(new T.PlaneGeometry(0.012, 0.012), me._basic(C.eyeWhite));
      hl2.position.set(x - side * 0.015, EY - 0.008, EZ + 0.004); head.add(hl2);

      // Upper eyelid line (dark arc — thick half-torus)
      var lidGeo = new T.TorusGeometry(0.046, 0.012, 5, 16, Math.PI);
      var lidMesh = new T.Mesh(lidGeo, me._basic(C.black));
      lidMesh.position.set(x, EY + 0.012, EZ + 0.005);
      lidMesh.rotation.z = Math.PI; head.add(lidMesh);

      // Lower lash line (thinner)
      var lLashGeo = new T.TorusGeometry(0.043, 0.006, 4, 14, Math.PI * 0.6);
      var lLashMesh = new T.Mesh(lLashGeo, me._basic(C.black));
      lLashMesh.position.set(x, EY - 0.005, EZ + 0.004);
      lLashMesh.rotation.z = Math.PI * 0.2; head.add(lLashMesh);

      // Corner lash (inner corner for Frieren's distinctive eye shape)
      var cLashGeo = new T.BoxGeometry(0.010, 0.024, 0.005);
      var cLash = new T.Mesh(cLashGeo, me._basic(C.black));
      cLash.position.set(x - side * 0.05, EY - 0.005, EZ + 0.004);
      cLash.rotation.z = side * 0.3; head.add(cLash);

      // Eyebrow (thin arch, slightly flat — Frieren's expressionless look)
      var browGeo = new T.TorusGeometry(0.052, 0.008, 4, 14, Math.PI * 0.55);
      var browMesh = new T.Mesh(browGeo, me._basic(0x9090a8));
      browMesh.position.set(x, EY + 0.074, EZ - 0.005);
      browMesh.rotation.z = Math.PI * 0.84 + side * 0.04; head.add(browMesh);

      // Store for blink animation
      me._eyeMeshes.push({
        sclera: scMesh,
        iris: irMesh, irisL: irLMesh,
        pupil: puMesh,
        hl1: hl1, hl2: hl2,
        lid: lidMesh, lLash: lLashMesh,
      });
    }

    makeEye(-1); makeEye(1);
  };

  // ── Nose & mouth ──────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildNose = function (head) {
    var T = this._T, me = this;
    // Small dot nose
    var nGeo = new T.SphereGeometry(0.018, 7, 5);
    var nMesh = new T.Mesh(nGeo, me._toon(C.skinDark));
    nMesh.position.set(0, -0.040, 0.233); head.add(nMesh);
  };
  FrierenCharacter.prototype._buildMouth = function (head) {
    var T = this._T, me = this;
    // Small neutral mouth (thin torus arc)
    var mGeo = new T.TorusGeometry(0.032, 0.007, 4, 12, Math.PI * 0.5);
    var mMesh = new T.Mesh(mGeo, me._basic(C.skinDark));
    mMesh.position.set(0, -0.098, 0.226);
    mMesh.rotation.z = Math.PI * 0.75; head.add(mMesh);
  };

  // ── Hair ─────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildHair = function (hairRoot, lTail, rTail) {
    var T  = this._T;
    var me = this;
    var hairMat = me._toon(C.hair);
    var shadMat = me._toon(C.hairShad);

    // ── Top cap (covers head) ───────────────────────────────────────────────
    var capGeo = new T.SphereGeometry(0.263, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
    var capMesh = new T.Mesh(capGeo, hairMat);
    capMesh.position.y = 0.04; me._addOutline(capMesh, 1.06); hairRoot.add(capMesh);

    // Back hair (flows down behind head)
    var backGeo = new T.CylinderGeometry(0.22, 0.16, 0.32, 12);
    var backMesh = new T.Mesh(backGeo, hairMat);
    backMesh.position.set(0, -0.14, -0.08); me._addOutline(backMesh, 1.05); hairRoot.add(backMesh);

    // ── Bangs ──────────────────────────────────────────────────────────────
    // Center bang
    var bcGeo = new T.BoxGeometry(0.075, 0.13, 0.04);
    var bc = new T.Mesh(bcGeo, hairMat);
    bc.position.set(0, -0.04, 0.24); me._addOutline(bc, 1.06); hairRoot.add(bc);

    // Left bang (slanted)
    var blGeo = new T.BoxGeometry(0.065, 0.15, 0.04);
    var bl = new T.Mesh(blGeo, hairMat);
    bl.position.set(-0.115, -0.05, 0.22); bl.rotation.z = 0.22;
    me._addOutline(bl, 1.06); hairRoot.add(bl);

    // Right bang
    var brGeo = new T.BoxGeometry(0.065, 0.15, 0.04);
    var br = new T.Mesh(brGeo, hairMat);
    br.position.set(0.115, -0.05, 0.22); br.rotation.z = -0.22;
    me._addOutline(br, 1.06); hairRoot.add(br);

    // Side hair panels (wide sections framing face)
    var spGeo = new T.BoxGeometry(0.055, 0.28, 0.05);
    var lSP = new T.Mesh(spGeo, hairMat);
    lSP.position.set(-0.225, -0.12, 0.12); me._addOutline(lSP, 1.05); hairRoot.add(lSP);
    var rSP = new T.Mesh(spGeo, hairMat);
    rSP.position.set( 0.225, -0.12, 0.12); me._addOutline(rSP, 1.05); hairRoot.add(rSP);

    // Hair shadow on top (dark stripe for volume)
    var shGeo = new T.SphereGeometry(0.25, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.3);
    var shMesh = new T.Mesh(shGeo, shadMat);
    shMesh.position.y = 0.08; shMesh.rotation.y = Math.PI; hairRoot.add(shMesh);

    // ── Twin tails ────────────────────────────────────────────────────────
    this._buildTwintail(lTail, -1);
    this._buildTwintail(rTail,  1);
  };

  FrierenCharacter.prototype._buildTwintail = function (tailBone, side) {
    var T  = this._T;
    var me = this;
    var hairMat = me._toon(C.hair);
    var tipMat  = me._toon(C.hairTip);

    // Red ribbon tie (where tail gathers)
    var ribGeo = new T.TorusGeometry(0.048, 0.016, 7, 18);
    var rib = new T.Mesh(ribGeo, me._toon(C.ribbon));
    rib.rotation.x = Math.PI / 2; tailBone.add(rib);

    // Bow shape (two flat lobes)
    for (var b = -1; b <= 1; b += 2) {
      var bowGeo = new T.SphereGeometry(0.035, 6, 4);
      var bowM = new T.Mesh(bowGeo, me._toon(C.ribbon));
      bowM.position.set(b * 0.055, 0.02, 0); bowM.scale.set(1, 0.6, 0.5); tailBone.add(bowM);
    }

    // Tail: 6 tapered segments as sub-bones for natural curve
    var segs = 6;
    var segH = 0.18;
    var parent = tailBone;
    for (var i = 0; i < segs; i++) {
      var topR = lerp(0.068, 0.020, i / segs);
      var botR = lerp(0.068, 0.020, (i + 1) / segs);
      var segGeo = new T.CylinderGeometry(topR, botR, segH, 9);
      var segM = new T.Mesh(segGeo, i < 2 ? hairMat : (i < 4 ? me._toon(C.hair) : tipMat));
      segM.position.y = -segH / 2;
      me._addOutline(segM, 1.06);
      parent.add(segM);

      if (i < segs - 1) {
        var sub = new this._T.Group();
        sub.position.y = -segH;
        // Slight natural curl outward then back inward
        sub.rotation.z = side * (0.04 + Math.sin(i * 0.9) * 0.06);
        sub.rotation.x = 0.04 + i * 0.015;
        parent.add(sub);
        parent = sub;
      }
    }

    // Tail tip (tapered cone)
    var tipGeo = new T.ConeGeometry(0.020, 0.075, 8);
    var tipM = new T.Mesh(tipGeo, tipMat);
    tipM.position.y = -0.038; parent.add(tipM);
  };

  // ── Ears ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._buildEars = function (lEarB, rEarB) {
    var T  = this._T;
    var me = this;

    function buildEar(bone, side) {
      // Ear base (flattened ellipsoid)
      var baseGeo = new T.SphereGeometry(0.065, 9, 7, 0, Math.PI * 2, 0, Math.PI * 0.72);
      var baseMesh = new T.Mesh(baseGeo, me._toon(C.skin));
      baseMesh.scale.set(0.5, 1, 0.45);
      me._addOutline(baseMesh, 1.07); bone.add(baseMesh);

      // Pointed ear tip (elongated cone)
      var tipGeo = new T.ConeGeometry(0.020, 0.145, 7);
      var tipMesh = new T.Mesh(tipGeo, me._toon(C.skin));
      tipMesh.position.y = 0.11;
      tipMesh.rotation.z = side * (-0.28); // angle away from head
      me._addOutline(tipMesh, 1.07); bone.add(tipMesh);

      // Inner ear (slightly darker)
      var inGeo = new T.SphereGeometry(0.040, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
      var inMesh = new T.Mesh(inGeo, me._toon(C.skinDark));
      inMesh.scale.set(0.4, 0.9, 0.35); bone.add(inMesh);

      // Red earring gem (small teardrop)
      var gemGeo = new T.SphereGeometry(0.014, 7, 5);
      var gemMesh = new T.Mesh(gemGeo, me._toon(C.gemRed));
      gemMesh.position.set(0, -0.02, 0.03); bone.add(gemMesh);

      // Ear positioning / rotation
      bone.rotation.z =  side * (-0.42);
      bone.rotation.y =  side * (-0.5);
      bone.rotation.x = -0.1;
    }

    buildEar(lEarB, -1);
    buildEar(rEarB,  1);
  };

  // ── Animation update loop ─────────────────────────────────────────────────
  FrierenCharacter.prototype._update = function (dt) {
    this._animTime += dt;
    this._updatePeek(dt);
    this._updateIdle();
    this._updateBlink(dt);
    this._updateAction(dt);
  };

  FrierenCharacter.prototype._updatePeek = function (dt) {
    var SPEED = 3.0;
    var diff = this._peekTarget - this._peekProgress;
    if (Math.abs(diff) > 0.001) {
      this._peekProgress += Math.sign(diff) * Math.min(Math.abs(diff), SPEED * dt);
      this._peekProgress = clamp(this._peekProgress, 0, 1);
      this._applyPeek();
    }
  };

  FrierenCharacter.prototype._applyPeek = function () {
    if (!this._root) return;
    var e = easeOut(this._peekProgress);
    this._root.position.y = -this.HIDE_OFFSET * (1 - e);
  };

  FrierenCharacter.prototype._updateIdle = function () {
    var t = this._animTime;
    var b = this._bones;

    // Gentle body sway (Z rotation on spine)
    var sway = Math.sin(t * 0.75) * 0.025;
    if (b.spine) b.spine.rotation.z = sway;
    if (b.chest) b.chest.rotation.z = sway * 0.5;

    // Breathing (chest Y oscillation)
    var breath = Math.sin(t * 1.15) * 0.010;
    if (b.chest) b.chest.position.y = 0.32 + breath;

    // Head slight nod / tilt
    if (b.head) {
      b.head.rotation.z = Math.sin(t * 0.50) * 0.022;
      b.head.rotation.x = Math.sin(t * 0.65) * 0.012;
    }
    // Neck follows head slightly
    if (b.neck) b.neck.rotation.z = Math.sin(t * 0.50) * 0.010;

    // Twin tails sway (slightly desync'd)
    if (b.lTail) {
      b.lTail.rotation.z = Math.sin(t * 1.05 + 0.3) * 0.055;
      b.lTail.rotation.x = Math.sin(t * 0.70) * 0.025;
    }
    if (b.rTail) {
      b.rTail.rotation.z = Math.sin(t * 0.95 - 0.4) * 0.055;
      b.rTail.rotation.x = Math.sin(t * 0.78 + 1.2) * 0.025;
    }

    // Subtle arm drift
    if (b.lShldr) b.lShldr.rotation.x = Math.sin(t * 0.55) * 0.018;
    if (b.rShldr) b.rShldr.rotation.x = Math.sin(t * 0.55 + 1.0) * 0.018;

    // Hips slight Y sway (weight shift)
    if (b.hips) b.hips.rotation.z = Math.sin(t * 0.75) * 0.010;
  };

  FrierenCharacter.prototype._updateBlink = function (dt) {
    this._blinkTimer += dt;

    if (this._blinkPhase === 0 && this._blinkTimer >= this._blinkGap) {
      this._blinkPhase = 1;
      this._blinkTimer = 0;
      this._blinkGap = lerp(3, 7, Math.random());
    }

    var sy;
    if (this._blinkPhase === 1) {
      sy = lerp(1, 0.04, Math.min(this._blinkTimer / 0.055, 1));
      if (this._blinkTimer >= 0.055) { this._blinkPhase = 2; this._blinkTimer = 0; }
    } else if (this._blinkPhase === 2) {
      sy = lerp(0.04, 1, Math.min(this._blinkTimer / 0.095, 1));
      if (this._blinkTimer >= 0.095) { this._blinkPhase = 0; sy = 1; }
    } else {
      sy = 1;
    }

    for (var i = 0; i < this._eyeMeshes.length; i++) {
      var e = this._eyeMeshes[i];
      e.iris.scale.y  = sy;
      e.irisL.scale.y = sy;
      e.pupil.scale.y = sy;
      e.lid.scale.y   = sy;
      e.lLash.scale.y = sy;
      e.hl1.scale.y   = sy;
      e.hl2.scale.y   = sy;
    }
  };

  FrierenCharacter.prototype._updateAction = function (dt) {
    if (!this._action) return;
    this._actionTimer += dt;
    var t = clamp(this._actionTimer / this._action.duration, 0, 1);
    this._action.update(t, dt);
    if (t >= 1) {
      this._action.onEnd && this._action.onEnd();
      this._action = null;
      this._actionTimer = 0;
    }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Show (peek=true) or hide (peek=false) the character */
  FrierenCharacter.prototype.peek = function (visible) {
    this._peekTarget = visible ? 1 : 0;
  };

  /** Frieren waves her right hand */
  FrierenCharacter.prototype.wave = function () {
    var self = this, b = this._bones;
    var rShldr = b.rShldr, rUArm = b.rUArm, rFArm = b.rFArm;
    var origZ  = rShldr ? rShldr.rotation.z : -0.18;
    this._action = {
      duration: 2.2,
      update: function (t) {
        var lift = easeOut(Math.min(t * 3, 1));
        if (rShldr) { rShldr.rotation.z = lerp(origZ, -0.65, lift); rShldr.rotation.x = -0.1 * lift; }
        var wave = Math.sin(t * Math.PI * 5) * 0.45 * lift;
        if (rUArm)  rUArm.rotation.z  = wave * 0.5;
        if (rFArm)  rFArm.rotation.z  = wave;
      },
      onEnd: function () {
        if (rShldr) { rShldr.rotation.z = origZ; rShldr.rotation.x = 0; }
        if (rUArm)  rUArm.rotation.z  = 0;
        if (rFArm)  rFArm.rotation.z  = 0;
      },
    };
    this._actionTimer = 0;
  };

  /** Frieren bounces excitedly (rare) */
  FrierenCharacter.prototype.excited = function () {
    var self = this, b = this._bones;
    var head = b.head;
    this._action = {
      duration: 0.85,
      update: function (t) {
        var bounce = Math.abs(Math.sin(t * Math.PI * 3.5)) * 0.14;
        self._root.position.y = -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) + bounce;
        if (head) head.rotation.z = Math.sin(t * Math.PI * 4) * 0.08;
      },
      onEnd: function () {
        self._applyPeek();
        if (head) head.rotation.z = 0;
      },
    };
    this._actionTimer = 0;
  };

  /** Clean up Three.js resources */
  FrierenCharacter.prototype.dispose = function () {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._renderer) {
      this._renderer.dispose();
      var el = this._renderer.domElement;
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  };

  return FrierenCharacter;
})();
