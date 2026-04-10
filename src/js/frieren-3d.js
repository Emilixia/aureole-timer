/**
 * FrierenCharacter — loads vrchat_frieren.glb or vrchat_frieren_2.glb via GLTFLoader.
 * Drives the armature bones procedurally: idle sway, hair physics, blink, peek, wave,
 * excited, nod, think, stretch, clap, and more.
 *
 * Supports two models:
 *   Model 1 (vrchat_frieren.glb)  — UE4-style bones: pelvis_02, spine_01_03, head_045 …
 *   Model 2 (vrchat_frieren_2.glb)— MMD/VRM bones:  Hips_02, Spine_03, Head_06 …
 *
 * Camera framing and widget size are fully reconfigurable at runtime via reconfigure().
 */

/* global THREE, GLTFLoader */

var FrierenCharacter = (function () {
  'use strict';

  // Default GLB path
  var DEFAULT_GLB = '../assets/vrchat_frieren.glb';

  // ── Math helpers ──────────────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
  function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

  // ── Constructor ───────────────────────────────────────────────────────────
  function FrierenCharacter(container, opts) {
    opts = opts || {};
    this.container  = container;
    this.W          = opts.width  || 340;
    this.H          = opts.height || 370;

    // Model path
    this._glbPath = opts.glbPath || DEFAULT_GLB;

    // Camera framing parameters (reconfigurable)
    this._waistFraction  = opts.waistFraction  != null ? opts.waistFraction  : 0.68;
    this._headFraction   = opts.headFraction   != null ? opts.headFraction   : 1.12;
    this._fov            = opts.fov            != null ? opts.fov            : 52;
    this._cameraXOffset  = opts.cameraXOffset  != null ? opts.cameraXOffset  : 0;
    this._cameraYOffset  = opts.cameraYOffset  != null ? opts.cameraYOffset  : 0.08;
    this._zoomFactor     = opts.zoomFactor     != null ? opts.zoomFactor     : 1.0;
    this._TARGET_HEIGHT  = 1.5;

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
    this._blinkScale = 1.0;     // current blink layer (multiplied with face layer)
    this._eyeBones   = [];      // eye scale targets

    // Face / expression overlay (eye openness, idle expressions)
    this._faceEyeOpen = 1.0;   // target eye openness (1=normal, 0=closed, 1.2=wide)
    this._faceEyeCurr = 1.0;   // smoothed current value
    this._exprTimer   = 0;
    this._exprGap     = lerp(7, 14, Math.random());
    this._exprPhase   = 0;     // 0=waiting, 1=running
    this._exprTime    = 0;
    this._exprType    = 'none';

    // Action override
    this._action      = null;
    this._actionTimer = 0;

    // Smooth return-to-idle blend after action ends
    this._returnBlend = null;

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

    // Camera framed on bust-up (breast level → top of head).
    // Provisional position overridden after model loads in _onModelLoaded.
    var camera = new T.PerspectiveCamera(52, this.W / this.H, 0.01, 50);
    camera.position.set(0, 1.35, 0.95);
    camera.lookAt(0, 1.35, 0);
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
      this._glbPath,
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

    // ── Scale & position using known body bones from both supported models ──
    // Combining bone name lists from model 1 (UE4) and model 2 (MMD/VRM) so
    // the same code path works for both without branching.
    var BODY_BONE_NAMES = [
      // Model 1 (UE4-style)
      '_rootJoint', 'Root_01', 'pelvis_02',
      'spine_01_03', 'spine_02_04', 'spine_03_05',
      'neck_01_044', 'head_045',
      'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027',
      'clavicle_l_06',  'upperarm_l_07',  'lowerarm_l_08',
      'thigh_r_00', 'calf_r_050', 'foot_r_051',
      'thigh_l_046', 'calf_l_047', 'foot_l_048',
      // Model 2 (MMD/VRM-style)
      'Hips_02', 'Spine_03', 'Chest_04', 'Neck_05', 'Head_06',
      'Right shoulder_026', 'Right arm_027', 'Right elbow_028',
      'Left shoulder_045',  'Left arm_046',  'Left elbow_047',
      'Right leg_066', 'Right knee_067', 'Right ankle_068',
      'Left leg_069',  'Left knee_070',  'Left ankle_071',
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

    // Target skeleton height in world-units.
    var TARGET_HEIGHT  = this._TARGET_HEIGHT;
    var scale          = 1.0;
    var floorOffset    = 0;

    var skelH = 1.0; // reference skeleton height used for geometry correction below
    if (bodyBonesFound >= 6) {
      var bsz = new T.Vector3(); bodyBox.getSize(bsz);
      // Some GLB exports (e.g. VRChat model 2) store the skeleton in a Z-up
      // coordinate system due to an accumulated 90° rotation on the root hip
      // bone.  In that case bsz.y ≈ 0 and bsz.z holds the true height.  Use
      // the largest axis to obtain a meaningful skeleton height regardless of
      // which axis is actually "up" in the skeleton's local space.
      skelH       = Math.max(bsz.x, bsz.y, bsz.z);
      scale       = TARGET_HEIGHT / Math.max(skelH * 1.12, 0.01);
      floorOffset = bodyBox.min.y * scale;
    } else {
      // Fallback: full-object bbox (non-rigged or unknown skeleton)
      var fb  = new T.Box3().setFromObject(model);
      var fsz = new T.Vector3(); fb.getSize(fsz);
      skelH       = Math.max(fsz.x, fsz.y, fsz.z);
      scale       = TARGET_HEIGHT / Math.max(fsz.y, 0.01);
      floorOffset = fb.min.y * scale;
    }

    // Hard-clamp to catch degenerate exports
    scale = Math.max(0.1, Math.min(scale, 10.0));

    model.scale.setScalar(scale);
    // Translate so the ankle/floor sits at y = 0
    model.position.set(0, -floorOffset, 0);

    // ── Correct geometry-oversized SkinnedMesh nodes ──────────────────────
    // Some VRChat GLB exports contain SkinnedMesh nodes whose vertex positions
    // are authored at a much larger coordinate scale than the body skeleton
    // (e.g. boot or costume meshes at ~10× body size).  Because all nodes in
    // these files have unit scale transforms, the earlier bone-scale pass
    // cannot detect or fix this; the error is baked into the geometry itself.
    // We detect it by comparing each SkinnedMesh's geometry bounding-box maxY
    // against the skeleton reference height, then apply a per-node scale
    // correction so the rendered mesh matches body proportions.
    //
    // Two-tier correction based on degree of oversize:
    //   ratio > 4  (e.g. a costume at 7× body height):
    //       corrFactor = 0.78 × skelH / maxDim  → top aligns ≈ 78 % body height
    //   ratio > 1.3  (e.g. a boot at 2× body height):
    //       corrFactor = 0.20 × skelH / maxDim  → top aligns ≈ 20 % body height
    // Both formulas evaluate to ≈ 0.1 for the offending meshes in model 2.
    //
    // NOTE: Some GLB exports (e.g. VRChat model 2) store geometry in Z-up space,
    // meaning bb.max.y ≈ 0 while bb.max.z holds the true height extent.  To
    // handle both Y-up and Z-up authored geometry we use the largest absolute
    // value across all six bbox faces as the representative dimension.
    var _skelH = skelH; // capture for closure
    model.traverse(function (node) {
      if (!node.isSkinnedMesh) return;
      var geom = node.geometry;
      if (!geom) return;
      geom.computeBoundingBox();
      var bb = geom.boundingBox;
      if (!bb) return;
      var maxDim = Math.max(
        Math.abs(bb.max.x), Math.abs(bb.max.y), Math.abs(bb.max.z),
        Math.abs(bb.min.x), Math.abs(bb.min.y), Math.abs(bb.min.z)
      );
      var ratio = maxDim / _skelH;
      var corrFactor;
      if (ratio > 4) {
        corrFactor = 0.78 * _skelH / maxDim;
      } else if (ratio > 1.3) {
        corrFactor = 0.20 * _skelH / maxDim;
      } else {
        return; // geometry is within expected body bounds — no correction needed
      }
      node.scale.setScalar(corrFactor);
      node.updateMatrixWorld(true);
    });

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

    // Cache baseline rotations for ALL collected nodes (works with any model)
    var self2 = this;
    Object.keys(this._bones).forEach(function (n) {
      var b = self2._bones[n];
      if (b) {
        self2._baseRot[n] = { x: b.rotation.x, y: b.rotation.y, z: b.rotation.z };
      }
    });

    // Build cross-model bone aliases so animation code works with both models
    this._buildBoneAliases();

    // Frame the camera
    this._reframeCamera();

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

  // ── Cross-model bone alias builder ────────────────────────────────────────
  // Creates backwards-compatible aliases so all animation code works with
  // both model 1 (UE4 names) and model 2 (MMD/VRM names).
  FrierenCharacter.prototype._buildBoneAliases = function () {
    var b  = this._bones;
    var br = this._baseRot;

    // [model-1-name, model-2-name] pairs — whichever exists is aliased to the other
    var bodyPairs = [
      ['pelvis_02',      'Hips_02'],
      ['spine_01_03',    'Spine_03'],
      ['spine_02_04',    'Chest_04'],
      ['spine_03_05',    'Chest_04'],   // model 2 has no separate spine_03
      ['neck_01_044',    'Neck_05'],
      ['head_045',       'Head_06'],
      ['clavicle_r_025', 'Right shoulder_026'],
      ['clavicle_l_06',  'Left shoulder_045'],
      ['upperarm_r_026', 'Right arm_027'],
      ['upperarm_l_07',  'Left arm_046'],
      ['lowerarm_r_027', 'Right elbow_028'],
      ['lowerarm_l_08',  'Left elbow_047'],
      ['hand_r_028',     'Right wrist_029'],
      ['hand_l_09',      'Left wrist_048'],
      ['thigh_r_00',     'Right leg_066'],
      ['thigh_l_046',    'Left leg_069'],
      ['calf_r_050',     'Right knee_067'],
      ['calf_l_047',     'Left knee_070'],
      ['foot_r_051',     'Right ankle_068'],
      ['foot_l_048',     'Left ankle_071'],
    ];

    bodyPairs.forEach(function (pair) {
      var m1 = pair[0], m2 = pair[1];
      if (!b[m1] && b[m2])  { b[m1]  = b[m2];  }
      if (!b[m2] && b[m1])  { b[m2]  = b[m1];  }
      if (!br[m1] && br[m2]) { br[m1] = br[m2]; }
      if (!br[m2] && br[m1]) { br[m2] = br[m1]; }
    });

    // Finger cross-aliases: model-1 UE4 ↔ model-2 MMD
    var fingerPairs = [
      // Right hand
      ['index_01_r_029',  'IndexFinger1_R_042'],
      ['index_02_r_030',  'IndexFinger2_R_043'],
      ['index_03_r_031',  'IndexFinger3_R_044'],
      ['middle_01_r_032', 'MiddleFinger1_R_039'],
      ['middle_02_r_033', 'MiddleFinger2_R_040'],
      ['middle_03_r_034', 'MiddleFinger3_R_041'],
      ['ring_01_r_038',   'RingFinger1_R_036'],
      ['ring_02_r_039',   'RingFinger2_R_037'],
      ['ring_03_r_040',   'RingFinger3_R_038'],
      ['pinky_01_r_035',  'LittleFinger1_R_033'],
      ['pinky_02_r_036',  'LittleFinger2_R_034'],
      ['pinky_03_r_037',  'LittleFinger3_R_035'],
      ['thumb_01_r_041',  'Thumb0_R_030'],
      ['thumb_02_r_042',  'Thumb1_R_031'],
      ['thumb_03_r_043',  'Thumb2_R_032'],
      // Left hand
      ['index_01_l_010',  'IndexFinger1_L_061'],
      ['index_02_l_011',  'IndexFinger2_L_062'],
      ['index_03_l_012',  'IndexFinger3_L_063'],
      ['middle_01_l_013', 'MiddleFinger1_L_058'],
      ['middle_02_l_014', 'MiddleFinger2_L_059'],
      ['middle_03_l_015', 'MiddleFinger3_L_060'],
      ['ring_01_l_019',   'RingFinger1_L_055'],
      ['ring_02_l_020',   'RingFinger2_L_056'],
      ['ring_03_l_021',   'RingFinger3_L_057'],
      ['pinky_01_l_016',  'LittleFinger1_L_052'],
      ['pinky_02_l_017',  'LittleFinger2_L_053'],
      ['pinky_03_l_018',  'LittleFinger3_L_054'],
      ['thumb_01_l_022',  'Thumb0_L_049'],
      ['thumb_02_l_023',  'Thumb1_L_050'],
      ['thumb_03_l_024',  'Thumb2_L_051'],
    ];

    fingerPairs.forEach(function (pair) {
      var m1 = pair[0], m2 = pair[1];
      if (!b[m1] && b[m2])   { b[m1]  = b[m2];  }
      if (!b[m2] && b[m1])   { b[m2]  = b[m1];  }
      if (!br[m1] && br[m2]) { br[m1] = br[m2]; }
      if (!br[m2] && br[m1]) { br[m2] = br[m1]; }
    });
  };

  // ── Camera reframing ─────────────────────────────────────────────────────
  // Re-positions the camera according to the current framing parameters.
  // Called after model load and whenever reconfigure() changes camera opts.
  FrierenCharacter.prototype._reframeCamera = function () {
    if (!this._camera) return;
    var targetH  = this._TARGET_HEIGHT;
    var headTop  = targetH * this._headFraction;
    var waistY   = targetH * this._waistFraction;
    var lookAtY  = (headTop + waistY) / 2;
    var viewHalf = (headTop - waistY) / 2 * (1.22 / this._zoomFactor);
    var fovHalf  = this._fov / 2 * Math.PI / 180;
    var camZ     = viewHalf / Math.tan(fovHalf);
    this._camera.fov = this._fov;
    this._camera.aspect = this.W / this.H;
    this._camera.updateProjectionMatrix();
    this._camera.position.set(this._cameraXOffset, lookAtY + this._cameraYOffset, camZ);
    this._camera.lookAt(this._cameraXOffset, lookAtY, 0);
  };

  // ── Public: reconfigure camera / model ───────────────────────────────────
  // opts: { glbPath, waistFraction, headFraction, fov, cameraXOffset, cameraYOffset, zoomFactor }
  FrierenCharacter.prototype.reconfigure = function (opts) {
    opts = opts || {};
    var newPath = opts.glbPath;

    // Update framing params first (switchModel will use them after load)
    if (opts.waistFraction  != null) this._waistFraction  = +opts.waistFraction;
    if (opts.headFraction   != null) this._headFraction   = +opts.headFraction;
    if (opts.fov            != null) this._fov            = +opts.fov;
    if (opts.cameraXOffset  != null) this._cameraXOffset  = +opts.cameraXOffset;
    if (opts.cameraYOffset  != null) this._cameraYOffset  = +opts.cameraYOffset;
    if (opts.zoomFactor     != null) this._zoomFactor     = +opts.zoomFactor;

    if (newPath && newPath !== this._glbPath) {
      this.switchModel(newPath);
    } else if (this._model) {
      this._reframeCamera();
    }
  };

  // ── Public: switch to a different GLB ────────────────────────────────────
  FrierenCharacter.prototype.switchModel = function (path) {
    var self = this;
    if (typeof GLTFLoader === 'undefined') return;

    // Dispose and remove old model
    if (this._model) {
      this._modelRoot.remove(this._model);
      this._model.traverse(function (node) {
        if (node.isMesh) {
          if (node.geometry) node.geometry.dispose();
          if (node.material) {
            var mats = Array.isArray(node.material) ? node.material : [node.material];
            mats.forEach(function (m) { m.dispose(); });
          }
        }
      });
      this._model = null;
    }

    // Reset bone / animation state
    this._bones       = {};
    this._hairBones   = [];
    this._skirtBones  = [];
    this._eyeBones    = [];
    this._baseRot     = {};
    this._action      = null;
    this._returnBlend = null;

    this._glbPath = path;
    var loader = new GLTFLoader();
    loader.load(
      path,
      function (gltf) { self._onLoad(gltf); },
      undefined,
      function (err) { console.error('[Frieren3D] switchModel load error:', err); }
    );
  };

  // ── Public: resize the renderer canvas ───────────────────────────────────
  FrierenCharacter.prototype.resize = function (w, h) {
    this.W = w;
    this.H = h;
    if (this._renderer) {
      this._renderer.setSize(w, h);
    }
    if (this._camera) {
      this._camera.aspect = w / h;
      this._camera.updateProjectionMatrix();
    }
    this._reframeCamera();
  };


  FrierenCharacter.prototype._update = function (dt) {
    this._animTime += dt;
    this._updatePeek(dt);
    this._updateIdle();
    this._updateIdleFingers();
    this._updateHairPhysics();
    this._updateSkirt();
    this._updateBlink(dt);
    this._updateFace(dt);
    this._updateAction(dt);
    this._updateReturnBlend(dt);
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

    // Multi-frequency sway for organic feel
    var sway   = Math.sin(t * 0.68) * 0.022 + Math.sin(t * 1.35) * 0.006;
    // Two-frequency breathing
    var breath = Math.sin(t * 1.12) * 0.010 + Math.sin(t * 2.18) * 0.002;
    var micro  = Math.sin(t * 2.40) * 0.003;

    rot('pelvis_02',   breath * 0.25 + micro, 0, sway * 0.35);
    rot('spine_01_03', breath * 0.55,         0, sway * 0.65 + micro);
    rot('spine_02_04', breath + micro,        0, sway * 0.50);
    rot('spine_03_05', breath * 0.70,         0, sway * 0.35);
    rot('neck_01_044', 0,                     0, sway * 0.25);

    // Head gentle nod/tilt (multi-frequency, more alive)
    var headZ = Math.sin(t * 0.48) * 0.020 + Math.sin(t * 1.02) * 0.006;
    var headX = Math.sin(t * 0.62) * 0.012 + Math.sin(t * 1.55) * 0.004;

    // Periodic glance — looks left/right every ~16 s
    var glanceCycle = 16.0;
    var glanceT     = (t % glanceCycle) / glanceCycle;
    var glanceY     = 0;
    if (glanceT < 0.10) {
      glanceY = easeOut(glanceT / 0.10) * 0.20;
    } else if (glanceT < 0.22) {
      glanceY = 0.20;
    } else if (glanceT < 0.32) {
      glanceY = lerp(0.20, 0, (glanceT - 0.22) / 0.10);
    } else if (glanceT < 0.42) {
      glanceY = -easeOut((glanceT - 0.32) / 0.10) * 0.20;
    } else if (glanceT < 0.54) {
      glanceY = -0.20;
    } else if (glanceT < 0.64) {
      glanceY = lerp(-0.20, 0, (glanceT - 0.54) / 0.10);
    }
    var headBone = b['head_045'];
    if (headBone && br['head_045']) {
      headBone.rotation.x = br['head_045'].x + headX;
      headBone.rotation.y = br['head_045'].y + glanceY;
      headBone.rotation.z = br['head_045'].z + headZ;
    }

    // Shoulder micro-movement (counterpoint to spine)
    rot('clavicle_r_025', Math.sin(t * 0.52) * 0.014, 0, 0);
    rot('clavicle_l_06',  Math.sin(t * 0.52 + 1.1) * 0.014, 0, 0);

    // Arm drift (two frequencies)
    rot('upperarm_r_026', 0, 0, Math.sin(t * 0.45) * 0.018 + Math.sin(t * 1.00) * 0.005);
    rot('upperarm_l_07',  0, 0, Math.sin(t * 0.50 + 0.8) * 0.018 + Math.sin(t * 0.90) * 0.005);

    // Subtle weight shift (very slow — like real weight transfer)
    var weightShift = Math.sin(t * 0.28) * 0.012;
    rot('thigh_r_00',  0, 0, Math.sin(t * 0.68) * 0.010 + weightShift);
    rot('thigh_l_046', 0, 0, Math.sin(t * 0.68 + Math.PI) * 0.010 - weightShift);
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

  FrierenCharacter.prototype._updateIdleFingers = function () {
    // Skip during active action or return blend so finger poses are uninterrupted
    if (this._action || this._returnBlend) return;
    var t  = this._animTime;
    var b  = this._bones;
    var br = this._baseRot;

    // Very subtle independent PIP-joint oscillation — breathing-style
    var fingerData = [
      // [boneName, phaseOffset, amplitude]
      ['index_02_r_030',  0.00, 0.012], ['index_02_l_011',  0.35, 0.012],
      ['middle_02_r_033', 0.70, 0.010], ['middle_02_l_014', 1.10, 0.010],
      ['ring_02_r_039',   1.50, 0.009], ['ring_02_l_020',   1.85, 0.009],
      ['pinky_02_r_036',  2.20, 0.014], ['pinky_02_l_017',  2.60, 0.014],
      ['thumb_02_r_042',  0.90, 0.008], ['thumb_02_l_023',  1.30, 0.008],
    ];
    fingerData.forEach(function (fd) {
      var bone = b[fd[0]]; var base = br[fd[0]];
      if (bone && base) bone.rotation.x = base.x + Math.sin(t * 0.55 + fd[1]) * fd[2];
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
    // Store blink scale — _updateFace multiplies this with the face expression layer
    this._blinkScale = sy;
  };

  // ── Face expression system ────────────────────────────────────────────────
  FrierenCharacter.prototype._updateFace = function (dt) {
    // Smooth eye openness toward target
    this._faceEyeCurr = lerp(this._faceEyeCurr, this._faceEyeOpen, Math.min(dt * 5.5, 1));

    // Apply combined scale: expression layer × blink layer
    var finalEye = clamp(this._faceEyeCurr * this._blinkScale, 0.02, 1.25);
    this._eyeBones.forEach(function (bone) { bone.scale.y = finalEye; });

    // Periodic idle micro-expressions — skip when an action is running
    if (this._action) return;

    this._exprTimer += dt;
    if (this._exprPhase === 0 && this._exprTimer >= this._exprGap) {
      var exprs = ['squint', 'halfLid', 'wideEyes', 'slowBlink', 'lookSideL', 'lookSideR'];
      this._exprType  = exprs[Math.floor(Math.random() * exprs.length)];
      this._exprPhase = 1;
      this._exprTime  = 0;
      this._exprTimer = 0;
      this._exprGap   = lerp(6, 13, Math.random());
    }

    if (this._exprPhase === 1) {
      this._exprTime += dt;
      var done = this._stepExpr(this._exprType, this._exprTime);
      if (done) {
        this._exprPhase = 0;
        this._faceEyeOpen = 1.0;
      }
    }
  };

  FrierenCharacter.prototype._stepExpr = function (type, t) {
    var b  = this._bones;
    var br = this._baseRot;
    var head = b['head_045'];

    if (type === 'squint') {
      // Happy squint: eyes narrow, hold, open
      if (t < 0.30) { this._faceEyeOpen = lerp(1.0, 0.52, t / 0.30); return false; }
      if (t < 1.40) { this._faceEyeOpen = 0.52; return false; }
      if (t < 2.00) { this._faceEyeOpen = lerp(0.52, 1.0, (t - 1.40) / 0.60); return false; }
      return true;
    }

    if (type === 'halfLid') {
      // Dreamy heavy-lid
      if (t < 0.50) { this._faceEyeOpen = lerp(1.0, 0.60, t / 0.50); return false; }
      if (t < 2.60) { this._faceEyeOpen = 0.60; return false; }
      if (t < 3.10) { this._faceEyeOpen = lerp(0.60, 1.0, (t - 2.60) / 0.50); return false; }
      return true;
    }

    if (type === 'wideEyes') {
      // Momentary wide eyes (surprised/curious)
      if (t < 0.15) { this._faceEyeOpen = lerp(1.0, 1.22, t / 0.15); return false; }
      if (t < 0.85) { this._faceEyeOpen = 1.22; return false; }
      if (t < 1.50) { this._faceEyeOpen = lerp(1.22, 1.0, (t - 0.85) / 0.65); return false; }
      return true;
    }

    if (type === 'slowBlink') {
      // Slow peaceful close + pause + open
      if (t < 0.55) { this._faceEyeOpen = lerp(1.0, 0.04, t / 0.55); return false; }
      if (t < 1.10) { this._faceEyeOpen = 0.04; return false; }
      if (t < 1.90) { this._faceEyeOpen = lerp(0.04, 1.0, (t - 1.10) / 0.80); return false; }
      return true;
    }

    if (type === 'lookSideL' || type === 'lookSideR') {
      var dir = (type === 'lookSideR') ? 1 : -1;
      var dur = 2.6;
      if (head && br['head_045']) {
        var env;
        if      (t < 0.35) env = easeOut(t / 0.35);
        else if (t < 1.90) env = 1;
        else if (t < dur)  env = easeOut(1 - (t - 1.90) / 0.70);
        else               env = 0;
        head.rotation.y = br['head_045'].y + 0.24 * env * dir;
      }
      return (t >= dur);
    }

    return true; // unknown type, finish immediately
  };

  FrierenCharacter.prototype._updateAction = function (dt) {
    if (!this._action) return;
    this._actionTimer += dt;
    var t = clamp(this._actionTimer / this._action.duration, 0, 1);
    this._action.update(t);
    if (t >= 1) {
      var returnBones = this._action.returnBones;
      this._action.onEnd && this._action.onEnd();
      this._action = null;
      this._actionTimer = 0;
      if (returnBones && returnBones.length) this._startReturnBlend(returnBones);
    }
  };

  // ── Return blend — smooth transition back to idle baseline ────────────────
  FrierenCharacter.prototype._startReturnBlend = function (boneNames) {
    var bones = this._bones;
    var br    = this._baseRot;
    var captured = [];
    boneNames.forEach(function (name) {
      var bone = bones[name];
      if (bone && br[name]) {
        captured.push({
          name: name,
          bone: bone,
          sx: bone.rotation.x,
          sy: bone.rotation.y,
          sz: bone.rotation.z,
        });
      }
    });
    this._returnBlend = { timer: 0, duration: 0.50, bones: captured };
    // Always reset eye expression state when an action ends
    this._faceEyeOpen = 1.0;
  };

  FrierenCharacter.prototype._updateReturnBlend = function (dt) {
    if (!this._returnBlend || this._action) return;
    this._returnBlend.timer += dt;
    var t  = clamp(this._returnBlend.timer / this._returnBlend.duration, 0, 1);
    var e  = easeInOut(t);
    var br = this._baseRot;
    this._returnBlend.bones.forEach(function (entry) {
      var br0 = br[entry.name];
      if (!br0) return;
      entry.bone.rotation.x = lerp(entry.sx, br0.x, e);
      entry.bone.rotation.y = lerp(entry.sy, br0.y, e);
      entry.bone.rotation.z = lerp(entry.sz, br0.z, e);
    });
    if (t >= 1) this._returnBlend = null;
  };

  // ── Public API ─────────────────────────────────────────────────────────────

  FrierenCharacter.prototype.peek = function (visible) {
    this._peekTarget = visible ? 1 : 0.18;
  };

  FrierenCharacter.prototype.wave = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.8,
      returnBones: [
        'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027', 'hand_r_028',
        'index_01_r_029', 'index_02_r_030', 'index_03_r_031',
        'middle_01_r_032', 'middle_02_r_033', 'middle_03_r_034',
        'ring_01_r_038',   'ring_02_r_039',   'ring_03_r_040',
        'pinky_01_r_035',  'pinky_02_r_036',  'pinky_03_r_037',
        'thumb_01_r_041',  'thumb_02_r_042',
      ],
      update: function (t) {
        // Arm goes up and slightly forward; lower it gently in the last 25%
        var lift  = easeOut(Math.min(t * 4.0, 1));
        var lower = easeOut(Math.max(0, (t - 0.75) / 0.25));
        var env   = lift * (1 - lower * 0.85);

        var rShldr = b['clavicle_r_025'];
        var rArm   = b['upperarm_r_026'];
        var rElbow = b['lowerarm_r_027'];
        var rWrist = b['hand_r_028'];

        // Clavicle raised mostly up (x), minimal sideways (z) to stay in viewport
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.72 * env;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.06 * env;
        }
        // Upper arm adds slight forward lean
        if (rArm && br['upperarm_r_026']) {
          rArm.rotation.x = br['upperarm_r_026'].x - 0.18 * env;
          rArm.rotation.z = br['upperarm_r_026'].z + 0.08 * env;
        }
        // Forearm/wrist waggle on z axis (wrist pivots side-to-side)
        var waggle = Math.sin(t * Math.PI * 5.0) * 0.30 * env;
        if (rElbow && br['lowerarm_r_027']) {
          rElbow.rotation.z = br['lowerarm_r_027'].z + waggle * 0.55;
          rElbow.rotation.x = br['lowerarm_r_027'].x - 0.10 * env;
        }
        if (rWrist && br['hand_r_028']) {
          rWrist.rotation.z = br['hand_r_028'].z + waggle;
        }

        // Fingers: gently spread and oscillate with the wave
        var fingerNames = [
          'index_01_r_029', 'middle_01_r_032', 'ring_01_r_038', 'pinky_01_r_035',
        ];
        var finger2Names = [
          'index_02_r_030', 'middle_02_r_033', 'ring_02_r_039', 'pinky_02_r_036',
        ];
        fingerNames.forEach(function (name, i) {
          var bone = b[name]; var base = br[name];
          if (bone && base) {
            bone.rotation.x = base.x + Math.sin(t * Math.PI * 4.5 + i * 0.35) * 0.04 * env;
            bone.rotation.z = base.z + (i - 1.5) * 0.05 * env;
          }
        });
        finger2Names.forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) bone.rotation.x = base.x + Math.sin(t * Math.PI * 4.5 + 0.2) * 0.05 * env;
        });
        var thmb = b['thumb_01_r_041']; var thmbBase = br['thumb_01_r_041'];
        if (thmb && thmbBase) thmb.rotation.z = thmbBase.z + 0.10 * env;
        var thmb2 = b['thumb_02_r_042']; var thmb2Base = br['thumb_02_r_042'];
        if (thmb2 && thmb2Base) thmb2.rotation.x = thmb2Base.x - 0.06 * env;
      },
      onEnd: function () {},
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.excited = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 1.2,
      returnBones: ['head_045', 'neck_01_044'],
      update: function (t) {
        var env    = 1 - easeOut(Math.max(0, (t - 0.75) / 0.25));
        var bounce = Math.abs(Math.sin(t * Math.PI * 4.0)) * 0.14 * env;
        self._modelRoot.position.y =
          -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) + bounce;
        var head = b['head_045'];
        var neck = b['neck_01_044'];
        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + Math.sin(t * Math.PI * 5.0) * 0.10 * env;
          head.rotation.x = br['head_045'].x - 0.06 * env;
        }
        if (neck && br['neck_01_044']) {
          neck.rotation.z = br['neck_01_044'].z + Math.sin(t * Math.PI * 5.0) * 0.05 * env;
        }
        // Wide eyes during excitement
        self._faceEyeOpen = lerp(1.0, 1.20, env);
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
        self._applyPeek();
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.nod = function () {
    var b  = this._bones;
    var br = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 1.6,
      returnBones: ['head_045', 'neck_01_044'],
      update: function (t) {
        var nodX = Math.sin(t * Math.PI * 2.5) * 0.18 * Math.pow(1 - t, 0.7);
        var head = b['head_045'];
        var neck = b['neck_01_044'];
        if (head && br['head_045'])    head.rotation.x = br['head_045'].x    + nodX;
        if (neck && br['neck_01_044']) neck.rotation.x = br['neck_01_044'].x + nodX * 0.4;
      },
      onEnd: function () {},
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.think = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 3.5,
      returnBones: [
        'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027', 'hand_r_028', 'head_045',
        'index_01_r_029', 'index_02_r_030', 'index_03_r_031',
        'middle_01_r_032', 'middle_02_r_033', 'middle_03_r_034',
        'ring_01_r_038',   'ring_02_r_039',   'ring_03_r_040',
        'pinky_01_r_035',  'pinky_02_r_036',  'pinky_03_r_037',
        'thumb_01_r_041',  'thumb_02_r_042',  'thumb_03_r_043',
      ],
      update: function (t) {
        var raise = easeOut(Math.min(t / 0.18, 1));
        var lower = easeOut(Math.max(0, (t - 0.82) / 0.18));
        var lift  = raise - lower;

        var rShldr = b['clavicle_r_025'];
        var rArm   = b['upperarm_r_026'];
        var rElbow = b['lowerarm_r_027'];
        var rWrist = b['hand_r_028'];
        var head   = b['head_045'];

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

        // Index/middle slightly extended; ring/pinky gently curled — chin-touch pose
        var indexExt  = -0.10 * lift;
        var ringCurl  =  0.18 * lift;
        var pinkyCurl =  0.22 * lift;
        var fn = [
          ['index_01_r_029', 0.05], ['index_02_r_030', 0.00], ['index_03_r_031', 0.00],
        ];
        fn.forEach(function (f) {
          var bn = b[f[0]]; var bb = br[f[0]];
          if (bn && bb) bn.rotation.x = bb.x + (f[1] + indexExt) * lift;
        });
        [
          ['ring_01_r_038', ringCurl], ['ring_02_r_039', ringCurl * 0.8], ['ring_03_r_040', ringCurl * 0.6],
          ['pinky_01_r_035', pinkyCurl], ['pinky_02_r_036', pinkyCurl * 0.9], ['pinky_03_r_037', pinkyCurl * 0.7],
          ['middle_02_r_033', 0.06 * lift], ['middle_03_r_034', 0.04 * lift],
        ].forEach(function (e2) {
          var bn = b[e2[0]]; var bb = br[e2[0]];
          if (bn && bb) bn.rotation.x = bb.x + e2[1];
        });
        // Thumb slightly out
        var thmb = b['thumb_01_r_041']; var thmbBase = br['thumb_01_r_041'];
        if (thmb && thmbBase) thmb.rotation.z = thmbBase.z + 0.12 * lift;

        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + 0.10 * lift;
          head.rotation.x = br['head_045'].x + Math.sin(t * Math.PI * 1.5) * 0.04 * lift;
        }

        // Eyes: half-lid during contemplation
        self._faceEyeOpen = lerp(1.0, 0.58, lift);
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.stretch = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.8,
      returnBones: [
        'clavicle_r_025', 'clavicle_l_06',
        'upperarm_r_026', 'upperarm_l_07',
        'lowerarm_r_027', 'lowerarm_l_08',
        'spine_01_03', 'spine_02_04', 'head_045',
        // Right fingers splayed
        'index_01_r_029', 'middle_01_r_032', 'ring_01_r_038', 'pinky_01_r_035',
        'thumb_01_r_041', 'thumb_02_r_042',
        // Left fingers splayed
        'index_01_l_010', 'middle_01_l_013', 'ring_01_l_019', 'pinky_01_l_016',
        'thumb_01_l_022', 'thumb_02_l_023',
      ],
      update: function (t) {
        var phase;
        if      (t < 0.35) phase = easeOut(t / 0.35);
        else if (t < 0.65) phase = 1;
        else               phase = easeOut(1 - (t - 0.65) / 0.35);

        var rShldr = b['clavicle_r_025']; var lShldr = b['clavicle_l_06'];
        var rArm   = b['upperarm_r_026']; var lArm   = b['upperarm_l_07'];
        var rElbow = b['lowerarm_r_027']; var lElbow = b['lowerarm_l_08'];
        var spine  = b['spine_01_03'];    var chest  = b['spine_02_04'];
        var head   = b['head_045'];

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

        // Eyes close during yawn phase (0.35–0.65), open back with arms
        if (t > 0.32 && t < 0.68) {
          var yawnEye = Math.sin((t - 0.32) / 0.36 * Math.PI);
          self._faceEyeOpen = lerp(1.0, 0.04, yawnEye);
        } else {
          self._faceEyeOpen = 1.0;
        }

        // Fingers spread wide (splay) on both hands
        var spreadR = [
          ['index_01_r_029', -0.12], ['middle_01_r_032', -0.04],
          ['ring_01_r_038',   0.04], ['pinky_01_r_035',   0.12],
        ];
        var spreadL = [
          ['index_01_l_010', -0.12], ['middle_01_l_013', -0.04],
          ['ring_01_l_019',   0.04], ['pinky_01_l_016',   0.12],
        ];
        spreadR.concat(spreadL).forEach(function (fd) {
          var bone = b[fd[0]]; var base = br[fd[0]];
          if (bone && base) bone.rotation.z = base.z + fd[1] * phase;
        });
        // Thumbs out
        ['thumb_01_r_041', 'thumb_01_l_022'].forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) bone.rotation.z = base.z + 0.18 * phase;
        });
        ['thumb_02_r_042', 'thumb_02_l_023'].forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) bone.rotation.x = base.x - 0.10 * phase;
        });
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.clap = function () {
    var self   = this;
    var b      = this._bones;
    var br     = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.2,
      returnBones: [
        'clavicle_r_025', 'clavicle_l_06',
        'upperarm_r_026', 'upperarm_l_07',
        'lowerarm_r_027', 'lowerarm_l_08',
        'hand_r_028',     'hand_l_09',
        'head_045',
        // Right fingers (straight together)
        'index_01_r_029', 'index_02_r_030', 'index_03_r_031',
        'middle_01_r_032', 'middle_02_r_033', 'middle_03_r_034',
        'ring_01_r_038',   'ring_02_r_039',   'ring_03_r_040',
        'pinky_01_r_035',  'pinky_02_r_036',  'pinky_03_r_037',
        'thumb_01_r_041',
        // Left fingers
        'index_01_l_010', 'index_02_l_011', 'index_03_l_012',
        'middle_01_l_013', 'middle_02_l_014', 'middle_03_l_015',
        'ring_01_l_019',   'ring_02_l_020',   'ring_03_l_021',
        'pinky_01_l_016',  'pinky_02_l_017',  'pinky_03_l_018',
        'thumb_01_l_022',
      ],
      update: function (t) {
        var envRise = easeOut(Math.min(t / 0.20, 1));
        var envFall = 1 - easeOut(Math.max(0, (t - 0.80) / 0.20));
        var env     = envRise * envFall;

        var clap = Math.pow(Math.max(0, Math.sin(t * Math.PI * 5.5)), 2) * 0.20;

        var rShldr = b['clavicle_r_025']; var lShldr = b['clavicle_l_06'];
        var rArm   = b['upperarm_r_026']; var lArm   = b['upperarm_l_07'];
        var rElbow = b['lowerarm_r_027']; var lElbow = b['lowerarm_l_08'];
        var rWrist = b['hand_r_028'];     var lWrist = b['hand_l_09'];
        var head   = b['head_045'];

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
          head.rotation.x = br['head_045'].x - 0.04 * env;
        }

        // Happy squint eyes during clap
        self._faceEyeOpen = lerp(1.0, 0.50, env);

        // Fingers: straight and close together on both hands
        var straightR = [
          'index_01_r_029', 'index_02_r_030', 'index_03_r_031',
          'middle_01_r_032', 'middle_02_r_033', 'middle_03_r_034',
          'ring_01_r_038',   'ring_02_r_039',   'ring_03_r_040',
          'pinky_01_r_035',  'pinky_02_r_036',  'pinky_03_r_037',
        ];
        var straightL = [
          'index_01_l_010', 'index_02_l_011', 'index_03_l_012',
          'middle_01_l_013', 'middle_02_l_014', 'middle_03_l_015',
          'ring_01_l_019',   'ring_02_l_020',   'ring_03_l_021',
          'pinky_01_l_016',  'pinky_02_l_017',  'pinky_03_l_018',
        ];
        straightR.concat(straightL).forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) {
            bone.rotation.x = base.x;  // fully extended, no curl
            bone.rotation.z = base.z;  // no splay
          }
        });
        // Thumbs tucked slightly in
        ['thumb_01_r_041', 'thumb_01_l_022'].forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) bone.rotation.z = base.z - 0.08 * env;
        });

        self._modelRoot.position.y =
          -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) +
          Math.abs(Math.sin(t * Math.PI * 5.5)) * 0.04 * env;
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
        self._applyPeek();
      },
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.shrug = function () {
    var b  = this._bones;
    var br = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.0,
      returnBones: [
        'clavicle_r_025', 'clavicle_l_06',
        'upperarm_r_026', 'upperarm_l_07',
        'lowerarm_r_027', 'lowerarm_l_08',
        'hand_r_028', 'hand_l_09',
        'head_045', 'neck_01_044',
        // Fingers: loosely curled / palms-up look
        'index_01_r_029', 'middle_01_r_032', 'ring_01_r_038', 'pinky_01_r_035',
        'index_01_l_010', 'middle_01_l_013', 'ring_01_l_019', 'pinky_01_l_016',
      ],
      update: function (t) {
        // Ease in and hold, then ease out
        var env;
        if      (t < 0.25) env = easeOut(t / 0.25);
        else if (t < 0.70) env = 1;
        else               env = easeOut(1 - (t - 0.70) / 0.30);

        var rShldr = b['clavicle_r_025']; var lShldr = b['clavicle_l_06'];
        var rArm   = b['upperarm_r_026']; var lArm   = b['upperarm_l_07'];
        var rElbow = b['lowerarm_r_027']; var lElbow = b['lowerarm_l_08'];
        var rWrist = b['hand_r_028'];     var lWrist = b['hand_l_09'];
        var head   = b['head_045'];       var neck   = b['neck_01_044'];

        // Shoulders raised, arms out slightly
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.30 * env;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.14 * env;
        }
        if (lShldr && br['clavicle_l_06']) {
          lShldr.rotation.x = br['clavicle_l_06'].x - 0.30 * env;
          lShldr.rotation.z = br['clavicle_l_06'].z - 0.14 * env;
        }
        // Upper arms drift outward
        if (rArm && br['upperarm_r_026']) rArm.rotation.z = br['upperarm_r_026'].z + 0.28 * env;
        if (lArm && br['upperarm_l_07'])  lArm.rotation.z = br['upperarm_l_07'].z  - 0.28 * env;
        // Forearms up (palms-up lean)
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.x = br['lowerarm_r_027'].x - 0.35 * env;
        if (lElbow && br['lowerarm_l_08'])  lElbow.rotation.x = br['lowerarm_l_08'].x  - 0.35 * env;
        // Wrists rotate so palms face up
        if (rWrist && br['hand_r_028']) rWrist.rotation.y = br['hand_r_028'].y + 0.30 * env;
        if (lWrist && br['hand_l_09'])  lWrist.rotation.y = br['hand_l_09'].y  - 0.30 * env;

        // Fingers loosely spread / half-open
        ['index_01_r_029','middle_01_r_032','ring_01_r_038','pinky_01_r_035'].forEach(function (n, i) {
          var bone = b[n]; var base = br[n];
          if (bone && base) bone.rotation.z = base.z + (i - 1.5) * 0.06 * env;
        });
        ['index_01_l_010','middle_01_l_013','ring_01_l_019','pinky_01_l_016'].forEach(function (n, i) {
          var bone = b[n]; var base = br[n];
          if (bone && base) bone.rotation.z = base.z + (i - 1.5) * 0.06 * env;
        });

        // Head tilts to one side quizzically
        if (head && br['head_045']) head.rotation.z = br['head_045'].z + 0.12 * env;
        if (neck && br['neck_01_044']) neck.rotation.z = br['neck_01_044'].z + 0.06 * env;
      },
      onEnd: function () {},
    };
    this._actionTimer = 0;
  };

  FrierenCharacter.prototype.bow = function () {
    var b  = this._bones;
    var br = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.4,
      returnBones: [
        'pelvis_02', 'spine_01_03', 'spine_02_04', 'spine_03_05',
        'neck_01_044', 'head_045',
        'clavicle_r_025', 'clavicle_l_06',
        'upperarm_r_026', 'upperarm_l_07',
      ],
      update: function (t) {
        // Bow in, hold, bow out
        var env;
        if      (t < 0.30) env = easeOut(t / 0.30);
        else if (t < 0.65) env = 1;
        else               env = easeOut(1 - (t - 0.65) / 0.35);

        var pelvis = b['pelvis_02'];
        var spine  = b['spine_01_03']; var chest = b['spine_02_04'];
        var upper  = b['spine_03_05']; var neck  = b['neck_01_044'];
        var head   = b['head_045'];
        var rShldr = b['clavicle_r_025']; var lShldr = b['clavicle_l_06'];
        var rArm   = b['upperarm_r_026']; var lArm   = b['upperarm_l_07'];

        // Forward lean — spine chain bows forward
        if (pelvis && br['pelvis_02'])   pelvis.rotation.x = br['pelvis_02'].x   + 0.12 * env;
        if (spine  && br['spine_01_03']) spine.rotation.x  = br['spine_01_03'].x + 0.20 * env;
        if (chest  && br['spine_02_04']) chest.rotation.x  = br['spine_02_04'].x + 0.22 * env;
        if (upper  && br['spine_03_05']) upper.rotation.x  = br['spine_03_05'].x + 0.18 * env;
        // Neck compensates to keep head somewhat level
        if (neck   && br['neck_01_044']) neck.rotation.x   = br['neck_01_044'].x - 0.15 * env;
        if (head   && br['head_045'])    head.rotation.x   = br['head_045'].x    - 0.10 * env;

        // Arms drop slightly forward during bow
        if (rShldr && br['clavicle_r_025']) rShldr.rotation.z = br['clavicle_r_025'].z + 0.08 * env;
        if (lShldr && br['clavicle_l_06'])  lShldr.rotation.z = br['clavicle_l_06'].z  - 0.08 * env;
        if (rArm && br['upperarm_r_026'])   rArm.rotation.z   = br['upperarm_r_026'].z + 0.12 * env;
        if (lArm && br['upperarm_l_07'])    lArm.rotation.z   = br['upperarm_l_07'].z  - 0.12 * env;
      },
      onEnd: function () {},
    };
    this._actionTimer = 0;
  };

  // ── sneeze ─────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype.sneeze = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.0,
      returnBones: [
        'head_045', 'neck_01_044', 'spine_01_03', 'spine_02_04', 'spine_03_05',
      ],
      update: function (t) {
        var head  = b['head_045'];
        var neck  = b['neck_01_044'];
        var spine = b['spine_01_03'];
        var chest = b['spine_02_04'];

        if (t < 0.35) {
          // Windup: head tilts back, eyes squeeze closed
          var w = easeInOut(t / 0.35);
          self._faceEyeOpen = lerp(1.0, 0.04, w);
          if (head  && br['head_045'])    head.rotation.x  = br['head_045'].x    - 0.22 * w;
          if (neck  && br['neck_01_044']) neck.rotation.x  = br['neck_01_044'].x - 0.12 * w;
          if (spine && br['spine_01_03']) spine.rotation.x = br['spine_01_03'].x - 0.06 * w;
        } else if (t < 0.52) {
          // ACHOO: snap forward violently
          var s = easeOut((t - 0.35) / 0.17);
          self._faceEyeOpen = 0.04;
          if (head  && br['head_045'])    head.rotation.x  = br['head_045'].x    + 0.40 * s;
          if (neck  && br['neck_01_044']) neck.rotation.x  = br['neck_01_044'].x + 0.28 * s;
          if (spine && br['spine_01_03']) spine.rotation.x = br['spine_01_03'].x + 0.20 * s;
          if (chest && br['spine_02_04']) chest.rotation.x = br['spine_02_04'].x + 0.14 * s;
        } else if (t < 0.80) {
          // Recoil: spring back, wide eyes
          var r = easeInOut((t - 0.52) / 0.28);
          self._faceEyeOpen = lerp(0.04, 1.22, r);
          if (head  && br['head_045'])    head.rotation.x  = lerp(br['head_045'].x  + 0.40, br['head_045'].x  - 0.06, r);
          if (neck  && br['neck_01_044']) neck.rotation.x  = lerp(br['neck_01_044'].x + 0.28, br['neck_01_044'].x, r);
          if (spine && br['spine_01_03']) spine.rotation.x = lerp(br['spine_01_03'].x + 0.20, br['spine_01_03'].x, r);
        } else {
          // Settle: wide eyes ease back to normal
          var settle = easeOut((t - 0.80) / 0.20);
          self._faceEyeOpen = lerp(1.22, 1.0, settle);
          if (head && br['head_045']) head.rotation.x = lerp(br['head_045'].x - 0.06, br['head_045'].x, settle);
        }
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
      },
    };
    this._actionTimer = 0;
  };

  // ── cheer ──────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype.cheer = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 2.6,
      returnBones: [
        'clavicle_r_025', 'clavicle_l_06',
        'upperarm_r_026', 'upperarm_l_07',
        'lowerarm_r_027', 'lowerarm_l_08',
        'hand_r_028', 'hand_l_09',
        'head_045', 'neck_01_044',
        'spine_01_03', 'spine_02_04',
        'index_01_r_029', 'middle_01_r_032', 'ring_01_r_038', 'pinky_01_r_035',
        'index_01_l_010', 'middle_01_l_013', 'ring_01_l_019', 'pinky_01_l_016',
        'thumb_01_r_041', 'thumb_01_l_022',
      ],
      update: function (t) {
        var rise = easeOut(Math.min(t / 0.28, 1));
        var fall = easeOut(Math.max(0, (t - 0.80) / 0.20));
        var env  = rise * (1 - fall);

        var bounce = Math.abs(Math.sin(t * Math.PI * 3.5)) * 0.10 * env;
        self._modelRoot.position.y =
          -self.HIDE_OFFSET * (1 - easeOut(self._peekProgress)) + bounce;

        self._faceEyeOpen = lerp(1.0, 1.20, env);

        var rShldr = b['clavicle_r_025']; var lShldr = b['clavicle_l_06'];
        var rArm   = b['upperarm_r_026']; var lArm   = b['upperarm_l_07'];
        var rElbow = b['lowerarm_r_027']; var lElbow = b['lowerarm_l_08'];
        var rWrist = b['hand_r_028'];     var lWrist = b['hand_l_09'];
        var head   = b['head_045'];       var neck   = b['neck_01_044'];
        var spine  = b['spine_01_03'];    var chest  = b['spine_02_04'];

        // Both arms raised in V
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 1.10 * env;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.10 * env;
        }
        if (lShldr && br['clavicle_l_06']) {
          lShldr.rotation.x = br['clavicle_l_06'].x - 1.10 * env;
          lShldr.rotation.z = br['clavicle_l_06'].z - 0.10 * env;
        }
        if (rArm && br['upperarm_r_026']) rArm.rotation.z = br['upperarm_r_026'].z + 0.42 * env;
        if (lArm && br['upperarm_l_07'])  lArm.rotation.z = br['upperarm_l_07'].z  - 0.42 * env;
        if (rElbow && br['lowerarm_r_027']) rElbow.rotation.z = br['lowerarm_r_027'].z - 0.10 * env;
        if (lElbow && br['lowerarm_l_08'])  lElbow.rotation.z = br['lowerarm_l_08'].z  + 0.10 * env;
        if (rWrist && br['hand_r_028']) rWrist.rotation.x = br['hand_r_028'].x - 0.12 * env;
        if (lWrist && br['hand_l_09'])  lWrist.rotation.x = br['hand_l_09'].x  - 0.12 * env;

        if (spine && br['spine_01_03']) spine.rotation.x = br['spine_01_03'].x - 0.08 * env;
        if (chest && br['spine_02_04']) chest.rotation.x = br['spine_02_04'].x - 0.10 * env;

        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + Math.sin(t * Math.PI * 3.0) * 0.10 * env;
          head.rotation.x = br['head_045'].x - 0.05 * env;
        }
        if (neck && br['neck_01_044']) {
          neck.rotation.z = br['neck_01_044'].z + Math.sin(t * Math.PI * 3.0) * 0.05 * env;
        }

        // Fingers spread (open palms)
        var spreadAll = [
          ['index_01_r_029', -0.10], ['middle_01_r_032', -0.03],
          ['ring_01_r_038',   0.03], ['pinky_01_r_035',   0.10],
          ['index_01_l_010', -0.10], ['middle_01_l_013', -0.03],
          ['ring_01_l_019',   0.03], ['pinky_01_l_016',   0.10],
        ];
        spreadAll.forEach(function (fd) {
          var bone = b[fd[0]]; var base = br[fd[0]];
          if (bone && base) bone.rotation.z = base.z + fd[1] * env;
        });
        ['thumb_01_r_041', 'thumb_01_l_022'].forEach(function (name) {
          var bone = b[name]; var base = br[name];
          if (bone && base) bone.rotation.z = base.z + 0.15 * env;
        });
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
        self._applyPeek();
      },
    };
    this._actionTimer = 0;
  };

  // ── ponder ─────────────────────────────────────────────────────────────────
  FrierenCharacter.prototype.ponder = function () {
    var self = this;
    var b    = this._bones;
    var br   = this._baseRot;
    this._returnBlend = null;

    this._action = {
      duration: 4.0,
      returnBones: [
        'head_045', 'neck_01_044', 'spine_01_03',
        'clavicle_r_025', 'upperarm_r_026', 'lowerarm_r_027', 'hand_r_028',
        'index_01_r_029', 'middle_01_r_032', 'ring_01_r_038', 'pinky_01_r_035',
        'ring_02_r_039', 'pinky_02_r_036', 'thumb_01_r_041',
      ],
      update: function (t) {
        var raise = easeOut(Math.min(t / 0.22, 1));
        var lower = easeOut(Math.max(0, (t - 0.82) / 0.18));
        var env   = raise * (1 - lower);

        self._faceEyeOpen = lerp(1.0, 0.58, env);

        var rShldr = b['clavicle_r_025'];
        var rArm   = b['upperarm_r_026'];
        var rElbow = b['lowerarm_r_027'];
        var rWrist = b['hand_r_028'];
        var head   = b['head_045'];
        var neck   = b['neck_01_044'];
        var spine  = b['spine_01_03'];

        // Arm raised to chin-touch pose
        if (rShldr && br['clavicle_r_025']) {
          rShldr.rotation.x = br['clavicle_r_025'].x - 0.44 * env;
          rShldr.rotation.z = br['clavicle_r_025'].z + 0.10 * env;
        }
        if (rArm && br['upperarm_r_026']) {
          rArm.rotation.x = br['upperarm_r_026'].x + 0.32 * env;
          rArm.rotation.z = br['upperarm_r_026'].z + 0.14 * env;
        }
        if (rElbow && br['lowerarm_r_027']) {
          rElbow.rotation.z = br['lowerarm_r_027'].z - 0.58 * env;
        }
        if (rWrist && br['hand_r_028']) {
          rWrist.rotation.x = br['hand_r_028'].x + 0.18 * env;
        }

        // Index + middle lightly extended, ring + pinky gently curled
        ['index_01_r_029', 'middle_01_r_032'].forEach(function (n) {
          var bone = b[n]; var base = br[n];
          if (bone && base) bone.rotation.x = base.x - 0.05 * env;
        });
        ['ring_01_r_038', 'ring_02_r_039', 'pinky_01_r_035', 'pinky_02_r_036'].forEach(function (n) {
          var bone = b[n]; var base = br[n];
          if (bone && base) bone.rotation.x = base.x + 0.25 * env;
        });
        if (b['thumb_01_r_041'] && br['thumb_01_r_041']) {
          b['thumb_01_r_041'].rotation.z = br['thumb_01_r_041'].z + 0.14 * env;
        }

        // Head: slight upward look + slow contemplative sway
        var ponderSway = Math.sin(t * Math.PI * 1.1) * 0.06;
        if (head && br['head_045']) {
          head.rotation.z = br['head_045'].z + (0.12 + ponderSway) * env;
          head.rotation.x = br['head_045'].x - 0.08 * env;
        }
        if (neck && br['neck_01_044']) {
          neck.rotation.z = br['neck_01_044'].z + 0.06 * env;
        }
        if (spine && br['spine_01_03']) {
          spine.rotation.z = br['spine_01_03'].z + 0.04 * env;
        }
      },
      onEnd: function () {
        self._faceEyeOpen = 1.0;
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
