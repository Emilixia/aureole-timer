/**
 * FrierenCharacter — loads vrchat_frieren.glb via GLTFLoader.
 * Applies MeshToonMaterial (cel/anime shading) to all meshes and drives the real
 * armature bones procedurally: idle sway, hair physics, blink, peek, wave, excited,
 * nod, think, stretch, clap.
 *
 * Bone map (from the embedded skeleton — 91 nodes, UE4-style naming):
 *   _rootJoint, Root_01
 *   pelvis_02
 *   spine_01_03, spine_02_04, spine_03_05
 *   neck_01_044, head_045
 *   clavicle_r_025 / clavicle_l_06
 *   upperarm_r_026 / upperarm_l_07
 *   lowerarm_r_027 / lowerarm_l_08
 *   hand_r_028     / hand_l_09
 *   thigh_r_00,  calf_r_050,  foot_r_051
 *   thigh_l_046, calf_l_047,  foot_l_048
 */

/* global THREE, GLTFLoader */

var FrierenCharacter = (function () {
  'use strict';

  // Path to the GLB, relative to src/index.html (which is in src/)
  var GLB_PATH = '../assets/vrchat_frieren.glb';

  // ── Math helpers ──────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }

  // ── Constructor ───────────────────────────────────────────────────────────
  function FrierenCharacter(container, opts) {
    opts = opts || {};
    this.container  = container;
    this.W          = opts.width  || 200;
    this.H          = opts.height || 340;

    // Peek state — always fully visible (fixed bottom-right, no hiding)
    this._peekTarget   = 1;
    this._peekProgress = 1;
    this.HIDE_OFFSET   = 2.8;

    // Animation
    this._animTime  = 0;
    this._bones     = {};       // name → THREE.Bone (or Object3D)
    this._hairBones = [];       // hair spring bones
    this._skirtBones= [];       // skirt panel bones

    // Blink
    this._blinkTimer = 0;
    this._blinkGap   = lerp(3, 6, Math.random());
    this._blinkPhase = 0;       // 0=open 1=closing 2=opening
    this._eyeBones   = [];      // eye scale targets

    // Action override
    this._action      = null;
    this._actionTimer = 0;

    // Baseline rotation cache (filled after model loads)
    this._baseRot = {};

    this._running = false;
    this._raf     = null;
    this._model   = null;       // gltf.scene root
    this._modelRoot = null;     // Group added to scene (for peek Y)
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype.init = function () {
    if (typeof THREE === 'undefined') {
      console.error('[Frieren3D] THREE not loaded');
      return;
    }
    if (typeof GLTFLoader === 'undefined') {
      console.error('[Frieren3D] GLTFLoader not loaded');
      return;
    }

    var T = THREE;
    var self = this;

    // ── Renderer ─────────────────────────────────────────────────────────
    var renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(this.W, this.H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;
    this._renderer = renderer;
    this.container.appendChild(renderer.domElement);

    // ── Scene & camera ───────────────────────────────────────────────────
    var scene  = new T.Scene();
    this._scene = scene;

    // Camera framed on upper torso + head; FOV=38° gives tight portrait crop.
    // Pre-load values match what _onLoad computes for TARGET_HEIGHT=1.5.
    var camera = new T.PerspectiveCamera(38, this.W / this.H, 0.01, 50);
    camera.position.set(0, 1.32, 1.5);
    camera.lookAt(0, 1.22, 0);
    this._camera = camera;

    // ── Lights ───────────────────────────────────────────────────────────
    scene.add(new T.AmbientLight(0xffffff, 0.75));
    var main = new T.DirectionalLight(0xfff8e0, 1.1);
    main.position.set(-1, 3, 4); scene.add(main);
    var fill = new T.DirectionalLight(0xd0e0ff, 0.4);
    fill.position.set(2, 1, 1); scene.add(fill);
    var rim  = new T.DirectionalLight(0xffe8f0, 0.2);
    rim.position.set(0, 2, -3); scene.add(rim);

    // ── Model root (Y offset controlled for peek) ──────────────────────
    var modelRoot = new T.Group();
    this._modelRoot = modelRoot;
    scene.add(modelRoot);
    this._applyPeek();

    // ── Load GLB ─────────────────────────────────────────────────────────
    var loader = new GLTFLoader();
    loader.load(
      GLB_PATH,
      function (gltf) { self._onLoad(gltf); },
      undefined,
      function (err) { console.error('[Frieren3D] GLB load error:', err); }
    );

    // ── Render loop ───────────────────────────────────────────────────────
    this._running = true;
    var last = performance.now();
    function loop() {
      if (!self._running) return;
      self._raf = requestAnimationFrame(loop);
      var now = performance.now();
      var dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (self._model) self._update(dt);
      renderer.render(scene, camera);
    }
    loop();
  };

  // ── GLB loaded ────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._onLoad = function (gltf) {
    var T    = THREE;
    var self = this;
    var model = gltf.scene;
    this._model = model;
    this._modelRoot.add(model);

    // Ensure all world matrices are up-to-date before any measurement
    model.updateWorldMatrix(true, true);

    // ── Scale & position using the 18 main body bones ────────────────────
    // We sample the bounding box of only the known humanoid body skeleton
    // (spine chain + arms + legs/ankles), deliberately excluding hair, skirt,
    // and other accessory bones whose outlier positions corrupt a full-bone
    // bbox.  Ankle bones give a reliable floor; the head bone gives the top.
    //
    // We intentionally do NOT use just two anchor bones (root→head) because
    // their Y distance is model-dependent and may be nearly zero if the root
    // sits close to the head joint in this specific export.
    var BODY_BONE_NAMES = [
      '_rootJoint', 'Root_01', 'pelvis_02',
      'spine_01_03', 'spine_02_04', 'spine_03_05',
      'neck_01_044', 'head_045',
      'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027',
      'clavicle_l_06',  'upperarm_l_07',  'lowerarm_l_08',
      'thigh_r_00', 'calf_r_050', 'foot_r_051',
      'thigh_l_046', 'calf_l_047', 'foot_l_048'
    ];

    var bodyBox = new T.Box3();
    var bodyBonesFound = 0;
    model.traverse(function (node) {
      if (BODY_BONE_NAMES.indexOf(node.name) !== -1) {
        var wp = new T.Vector3();
        node.getWorldPosition(wp);
        bodyBox.expandByPoint(wp);
        bodyBonesFound++;
      }
    });

    // Target skeleton height in world-units.  The head bone sits at the
    // base of the skull; add 12 % headroom so the actual head mesh isn't
    // clipped.  Final rendered height ≈ TARGET_HEIGHT * 1.12 ≈ 1.68 units.
    var TARGET_HEIGHT  = 1.5;
    var scale          = 1.0;
    var floorOffset    = 0;

    if (bodyBonesFound >= 6) {
      var bsz = new T.Vector3(); bodyBox.getSize(bsz);
      var skelH = bsz.y;
      scale       = TARGET_HEIGHT / Math.max(skelH * 1.12, 0.01);
      floorOffset = bodyBox.min.y * scale;
    } else {
      // Fallback: full-object bbox (non-rigged or unknown skeleton)
      var fb  = new T.Box3().setFromObject(model);
      var fsz = new T.Vector3(); fb.getSize(fsz);
      scale       = TARGET_HEIGHT / Math.max(fsz.y, 0.01);
      floorOffset = fb.min.y * scale;
    }

    // Hard-clamp to catch degenerate exports
    scale = Math.max(0.1, Math.min(scale, 10.0));

    model.scale.setScalar(scale);
    // Translate so the ankle/floor sits at y = 0
    model.position.set(0, -floorOffset, 0);

    // Keep original GLB materials so all textures (face, outfit) are preserved.
    // Only disable shadows which we don't need.
    model.traverse(function (node) {
      if (!node.isMesh) return;
      node.castShadow    = false;
      node.receiveShadow = false;
    });

    // ── Collect bones ─────────────────────────────────────────────────────
    var hairPrefixes = ['FrontHair', 'Hair', 'TailHair', 'BackHair', 'SideHair'];
    var skirtPrefixes = ['skirt.'];
    model.traverse(function (node) {
      if (node.isBone || node.type === 'Bone' || (node.name && node.name.length > 0)) {
        self._bones[node.name] = node;

        // Hair bones — anything whose name starts with a hair prefix
        var isHair = hairPrefixes.some(function (p) {
          return node.name.indexOf(p) === 0;
        });
        if (isHair && node.name.indexOf('_end_') === -1) {
          self._hairBones.push(node);
        }

        // Skirt bones
        var isSkirt = skirtPrefixes.some(function (p) {
          return node.name.indexOf(p) === 0;
        });
        if (isSkirt && node.name.indexOf('_end_') === -1) {
          self._skirtBones.push(node);
        }

        // Eye bones (for blink scale hack)
        if (node.name === 'Eye_L_012' || node.name === 'Eye_R_013') {
          self._eyeBones.push(node);
        }
      }
    });

    // Cache baseline rotations for all animated bones
    var animBoneNames = [
      '_rootJoint', 'Root_01', 'pelvis_02',
      'spine_01_03', 'spine_02_04', 'spine_03_05',
      'neck_01_044', 'head_045',
      'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027', 'hand_r_028',
      'clavicle_l_06',  'upperarm_l_07',  'lowerarm_l_08',  'hand_l_09',
      'thigh_r_00', 'calf_r_050', 'foot_r_051',
      'thigh_l_046', 'calf_l_047', 'foot_l_048',
    ];
    var self2 = this;
    animBoneNames.forEach(function (n) {
      var b = self2._bones[n];
      if (b) {
        self2._baseRot[n] = { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z };
      }
    });
    this._hairBones.forEach(function (b) {
      self2._baseRot[b.name] = { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z };
    });
    this._skirtBones.forEach(function (b) {
      self2._baseRot[b.name] = { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z };
    });

    // Re-frame camera for upper-body-only portrait.
    // Feet at y=0, head mesh top at ~TARGET_HEIGHT*1.12.
    // We want to show from waist (~50 % of height) to just above head.
    var headTop  = TARGET_HEIGHT * 1.12;           // ≈ 1.68
    var waistY   = TARGET_HEIGHT * 0.50;           // ≈ 0.75
    var lookAtY  = (headTop + waistY) / 2;         // ≈ 1.215  (chest/shoulder area)
    var viewHalf = (headTop - waistY) / 2 * 1.15;  // half-extent + 15 % margin
    // FOV=38°  →  half-angle 19°  →  tan(19°)≈0.3443
    var camZ = viewHalf / Math.tan(19 * Math.PI / 180);
    this._camera.fov = 38;
    this._camera.updateProjectionMatrix();
    this._camera.position.set(0, lookAtY + 0.08, camZ);
    this._camera.lookAt(0, lookAtY, 0);

    console.log('[Frieren3D] Model loaded. Bones found:', Object.keys(this._bones).length,
                'Hair bones:', this._hairBones.length,
                'Skirt bones:', this._skirtBones.length);
  };

  // ── Peek ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype._applyPeek = function () {
    if (!this._modelRoot) return;
    var e = easeOut(this._peekProgress);
    this._modelRoot.position.y = -this.HIDE_OFFSET * (1 - e);
  };

  // ── Animation update ──────────────────────────────────────────────────────
  FrierenCharacter.prototype._update = function (dt) {
    this._animTime += dt;
    this._updatePeek(dt);
    this._updateIdle();
    this._updateHairPhysics();
    this._updateSkirt();
    this._updateBlink(dt);
    this._updateAction(dt);
  };

  FrierenCharacter.prototype._updatePeek = function (dt) {
    var SPEED = 3.0;
    var diff  = this._peekTarget - this._peekProgress;
    if (Math.abs(diff) > 0.001) {
      this._peekProgress += Math.sign(diff) * Math.min(Math.abs(diff), SPEED * dt);
      this._peekProgress  = clamp(this._peekProgress, 0, 1);
      this._applyPeek();
    }
  };

  FrierenCharacter.prototype._updateIdle = function () {
    var t = this._animTime;
    var b = this._bones;
    var br = this._baseRot;

    function rot(name, dx, dy, dz) {
      var bone = b[name];
      if (!bone || !br[name]) return;
      bone.rotation.x = br[name].x + dx;
      bone.rotation.y = br[name].y + dy;
      bone.rotation.z = br[name].z + dz;
    }

    // Body sway (Z)
    var sway   = Math.sin(t * 0.75) * 0.022;
    // Breathing (Y scale / X rotation on spine)
    var breath = Math.sin(t * 1.15) * 0.008;

    rot('pelvis_02',   breath * 0.3, 0, sway * 0.4);
    rot('spine_01_03', breath * 0.5, 0, sway * 0.6);
    rot('spine_02_04', breath,       0, sway * 0.5);
    rot('spine_03_05', breath * 0.6, 0, sway * 0.4);
    rot('neck_01_044', 0, 0, sway * 0.3);

    // Head gentle nod/tilt
    var headZ = Math.sin(t * 0.50) * 0.018;
    var headX = Math.sin(t * 0.65) * 0.010;
    rot('head_045', headX, 0, headZ);

    // Shoulder micro-movement
    rot('clavicle_r_025', Math.sin(t * 0.55) * 0.012, 0, 0);
    rot('clavicle_l_06',  Math.sin(t * 0.55 + 1.0) * 0.012, 0, 0);

    // Slight arm drift
    rot('upperarm_r_026', 0, 0, Math.sin(t * 0.48) * 0.015);
    rot('upperarm_l_07',  0, 0, Math.sin(t * 0.52 + 0.8) * 0.015);

    // Subtle weight shift on hips
    rot('thigh_r_00',  0, 0, Math.sin(t * 0.75) * 0.008);
    rot('thigh_l_046', 0, 0, Math.sin(t * 0.75 + Math.PI) * 0.008);

    // Occasional slow head glance — looks left/right every ~18 s
    var glanceCycle = 18.0;
    var glanceT     = (t % glanceCycle) / glanceCycle;  // 0→1 over 18 s
    var glanceY     = 0;
    if (glanceT < 0.12) {
      glanceY = easeOut(glanceT / 0.12) * 0.18;
    } else if (glanceT < 0.22) {
      glanceY = 0.18;
    } else if (glanceT < 0.34) {
      glanceY = lerp(0.18, 0, (glanceT - 0.22) / 0.12);
    } else if (glanceT < 0.46) {
      glanceY = -easeOut((glanceT - 0.34) / 0.12) * 0.18;
    } else if (glanceT < 0.56) {
      glanceY = -0.18;
    } else if (glanceT < 0.68) {
      glanceY = lerp(-0.18, 0, (glanceT - 0.56) / 0.12);
    }
    var headBone = b['head_045'];
    if (headBone && br['head_045']) {
      headBone.rotation.y = br['head_045'].y + glanceY;
    }
  };

  FrierenCharacter.prototype._updateHairPhysics = function () {
    var t = this._animTime;
    var br = this._baseRot;
    var self = this;

    this._hairBones.forEach(function (bone, idx) {
      var base = br[bone.name];
      if (!base) return;
      var phase  = idx * 0.4;
      var speed  = 0.90 + (idx % 3) * 0.08;
      var amp    = 0.028 + (idx % 4) * 0.006;
      bone.rotation.z = base.z + Math.sin(t * speed + phase) * amp;
      bone.rotation.x = base.x + Math.sin(t * speed * 0.7 + phase) * (amp * 0.4);
    });
  };

  FrierenCharacter.prototype._updateSkirt = function () {
    var t = this._animTime;
    var br = this._baseRot;

    this._skirtBones.forEach(function (bone, idx) {
      var base = br[bone.name];
      if (!base) return;
      var phase = idx * 0.35;
      var amp   = 0.018 + (idx % 3) * 0.005;
      bone.rotation.z = base.z + Math.sin(t * 0.80 + phase) * amp;
      bone.rotation.x = base.x + Math.sin(t * 0.65 + phase) * (amp * 0.5);
    });
  };

  FrierenCharacter.prototype._updateBlink = function (dt) {
    this._blinkTimer += dt;
    if (this._blinkPhase === 0 && this._blinkTimer >= this._blinkGap) {
      this._blinkPhase = 1;
      this._blinkTimer = 0;
      this._blinkGap   = lerp(3, 7, Math.random());
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
    this._eyeBones.forEach(function (bone) {
      bone.scale.y = sy;
    });
  };

  FrierenCharacter.prototype._updateAction = function (dt) {
    if (!this._action) return;
    this._actionTimer += dt;
    var t = clamp(this._actionTimer / this._action.duration, 0, 1);
    this._action.update(t);
    if (t >= 1) {
      this._action.onEnd && this._action.onEnd();
      this._action = null;
      this._actionTimer = 0;
    }
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  FrierenCharacter.prototype.peek = function (visible) {
    this._peekTarget = visible ? 1 : 0.18;
  };

  FrierenCharacter.prototype.wave = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;

    var rShldr = b['clavicle_r_025'];
    var rArm   = b['upperarm_r_026'];
    var rElbow = b['lowerarm_r_027'];

    this._action = {
      duration: 2.4,
      update: function (t) {
        var lift = easeOut(Math.min(t * 3, 1));
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.85 * lift;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.15 * lift;
        }
        var wave = Math.sin(t * Math.PI * 5) * 0.5 * lift;
        if (rArm   && br['upperarm_r_026']) rArm.rotation.z   = br['upperarm_r_026'].z + wave * 0.4;
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z + wave;
      },
      onEnd: function () {
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x;
          rShldr.rotation.z = br['clavicle_r_025'].z;
        }
        if (rArm   && br['upperarm_r_026']) rArm.rotation.z   = br['upperarm_r_026'].z;
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z;
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.excited = function () {
    var self = this;
    var head = this._bones['head_045'];
    var br   = this._baseRot;
    this._action = {
      duration: 0.9,
      update: function (t) {
        var bounce = Math.abs(Math.sin(t * Math.PI * 3.5)) * 0.14;
        self._modelRoot.position.y =
          -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) + bounce;
        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + Math.sin(t * Math.PI * 4) * 0.10;
        }
      },
      onEnd: function () {
        self._applyPeek();
        if (head && br['head_045']) head.rotation.z = br['head_045'].z;
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.nod = function () {
    var head = this._bones['head_045'];
    var neck = this._bones['neck_01_044'];
    var br   = this._baseRot;
    this._action = {
      duration: 1.6,
      update: function (t) {
        var nodX = Math.sin(t * Math.PI * 2.5) * 0.18 * Math.pow(1 - t, 0.7);
        if (head && br['head_045'])    head.rotation.x = br['head_045'].x    + nodX;
        if (neck && br['neck_01_044']) neck.rotation.x = br['neck_01_044'].x + nodX * 0.4;
      },
      onEnd: function () {
        if (head && br['head_045'])    head.rotation.x = br['head_045'].x;
        if (neck && br['neck_01_044']) neck.rotation.x = br['neck_01_044'].x;
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.think = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    var rShldr = b['clavicle_r_025'];
    var rArm   = b['upperarm_r_026'];
    var rElbow = b['lowerarm_r_027'];
    var rWrist = b['hand_r_028'];
    var head   = b['head_045'];
    this._action = {
      duration: 3.5,
      update: function (t) {
        var raise = easeOut(Math.min(t / 0.18, 1));
        var lower = easeOut(Math.max(0, (t - 0.82) / 0.18));
        var lift  = raise - lower;

        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.48 * lift;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.08 * lift;
        }
        if (rArm && br['upperarm_r_026']) {
          rArm.rotation.x = br['upperarm_r_026'].x + 0.35 * lift;
          rArm.rotation.z = br['upperarm_r_026'].z + 0.12 * lift;
        }
        if (rElbow && br['lowerarm_r_027']) {
          rElbow.rotation.z = br['lowerarm_r_027'].z - 0.60 * lift;
        }
        if (rWrist && br['hand_r_028']) {
          rWrist.rotation.x = br['hand_r_028'].x + 0.15 * lift;
        }
        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + 0.10 * lift;
          head.rotation.x = br['head_045'].x + Math.sin(t * Math.PI * 1.5) * 0.04 * lift;
        }
      },
      onEnd: function () {
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x;
          rShldr.rotation.z = br['clavicle_r_025'].z;
        }
        if (rArm && br['upperarm_r_026']) {
          rArm.rotation.x = br['upperarm_r_026'].x;
          rArm.rotation.z = br['upperarm_r_026'].z;
        }
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z;
        if (rWrist && br['hand_r_028'])     rWrist.rotation.x = br['hand_r_028'].x;
        if (head   && br['head_045']) {
          head.rotation.x = br['head_045'].x;
          head.rotation.z = br['head_045'].z;
        }
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.stretch = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    var rShldr = b['clavicle_r_025'];
    var lShldr = b['clavicle_l_06'];
    var rArm   = b['upperarm_r_026'];
    var lArm   = b['upperarm_l_07'];
    var rElbow = b['lowerarm_r_027'];
    var lElbow = b['lowerarm_l_08'];
    var spine  = b['spine_01_03'];
    var chest  = b['spine_02_04'];
    var head   = b['head_045'];
    this._action = {
      duration: 2.8,
      update: function (t) {
        var phase;
        if      (t < 0.35) phase = easeOut(t / 0.35);
        else if (t < 0.65) phase = 1;
        else               phase = easeOut(1 - (t - 0.65) / 0.35);

        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 1.30 * phase;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.10 * phase;
        }
        if (lShldr && br['clavicle_l_06']) {
          lShldr.rotation.x = br['clavicle_l_06'].x - 1.30 * phase;
          lShldr.rotation.z = br['clavicle_l_06'].z - 0.10 * phase;
        }
        if (rArm && br['upperarm_r_026']) rArm.rotation.z = br['upperarm_r_026'].z + 0.20 * phase;
        if (lArm && br['upperarm_l_07'])  lArm.rotation.z = br['upperarm_l_07'].z  - 0.20 * phase;
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z - 0.15 * phase;
        if (lElbow && br['lowerarm_l_08'])  lElbow.rotation.z = br['lowerarm_l_08'].z  + 0.15 * phase;

        if (spine && br['spine_01_03']) spine.rotation.x = br['spine_01_03'].x - 0.06 * phase;
        if (chest && br['spine_02_04']) chest.rotation.x = br['spine_02_04'].x - 0.10 * phase;

        var yawn = (t > 0.38 && t < 0.62) ? Math.sin((t - 0.38) / 0.24 * Math.PI) * 0.18 : 0;
        if (head && br['head_045']) head.rotation.x = br['head_045'].x - 0.08 * phase + yawn;
      },
      onEnd: function () {
        [
          [rShldr, 'clavicle_r_025', ['x','z']],
          [lShldr, 'clavicle_l_06',  ['x','z']],
          [rArm,   'upperarm_r_026', ['z']],
          [lArm,   'upperarm_l_07',  ['z']],
          [rElbow, 'lowerarm_r_027', ['z']],
          [lElbow, 'lowerarm_l_08',  ['z']],
          [spine,  'spine_01_03',    ['x']],
          [chest,  'spine_02_04',    ['x']],
          [head,   'head_045',       ['x']],
        ].forEach(function (entry) {
          var bone = entry[0], name = entry[1], axes = entry[2];
          if (bone && br[name]) axes.forEach(function (ax) { bone.rotation[ax] = br[name][ax]; });
        });
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.clap = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    var rShldr = b['clavicle_r_025'];
    var lShldr = b['clavicle_l_06'];
    var rArm   = b['upperarm_r_026'];
    var lArm   = b['upperarm_l_07'];
    var rElbow = b['lowerarm_r_027'];
    var lElbow = b['lowerarm_l_08'];
    var rWrist = b['hand_r_028'];
    var lWrist = b['hand_l_09'];
    var head   = b['head_045'];
    this._action = {
      duration: 2.2,
      update: function (t) {
        var envRise = easeOut(Math.min(t / 0.20, 1));
        var envFall = 1 - easeOut(Math.max(0, (t - 0.80) / 0.20));
        var env     = envRise * envFall;

        var clap = Math.pow(Math.max(0, Math.sin(t * Math.PI * 5.5)), 2) * 0.20;

        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.60 * env;
          rShldr.rotation.z = br['clavicle_r_025'].z - 0.10 * env;
        }
        if (lShldr && br['clavicle_l_06']) {
          lShldr.rotation.x = br['clavicle_l_06'].x - 0.60 * env;
          lShldr.rotation.z = br['clavicle_l_06'].z + 0.10 * env;
        }
        if (rArm && br['upperarm_r_026']) rArm.rotation.z = br['upperarm_r_026'].z - (0.35 + clap) * env;
        if (lArm && br['upperarm_l_07'])  lArm.rotation.z = br['upperarm_l_07'].z  + (0.35 + clap) * env;
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z - 0.45 * env;
        if (lElbow && br['lowerarm_l_08'])  lElbow.rotation.z = br['lowerarm_l_08'].z  + 0.45 * env;
        if (rWrist && br['hand_r_028']) rWrist.rotation.y = br['hand_r_028'].y - 0.20 * env;
        if (lWrist && br['hand_l_09'])  lWrist.rotation.y = br['hand_l_09'].y  + 0.20 * env;

        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + Math.sin(t * Math.PI * 5.5) * 0.06 * env;
        }
        self._modelRoot.position.y =
          -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) +
          Math.abs(Math.sin(t * Math.PI * 5.5)) * 0.04 * env;
      },
      onEnd: function () {
        self._applyPeek();
        [
          [rShldr, 'clavicle_r_025', ['x','z']],
          [lShldr, 'clavicle_l_06',  ['x','z']],
          [rArm,   'upperarm_r_026', ['z']],
          [lArm,   'upperarm_l_07',  ['z']],
          [rElbow, 'lowerarm_r_027', ['z']],
          [lElbow, 'lowerarm_l_08',  ['z']],
          [rWrist, 'hand_r_028',     ['y']],
          [lWrist, 'hand_l_09',      ['y']],
          [head,   'head_045',       ['z']],
        ].forEach(function (entry) {
          var bone = entry[0], name = entry[1], axes = entry[2];
          if (bone && br[name]) axes.forEach(function (ax) { bone.rotation[ax] = br[name][ax]; });
        });
      },
    };
    this._actionTimer = 0;
  };

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
