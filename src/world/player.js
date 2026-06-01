import { THREE } from "../core/deps.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(current, target, alpha) {
  return THREE.MathUtils.lerp(current, target, alpha);
}

function normalizeColor(value, fallback = 0xffffff) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

function createJerseyNumberTexture(number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 512, 512);
  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 16;
  ctx.font = "bold 320px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), 256, 280);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

// ─── Shoe geometry (reused for both feet) ────────────────────────────────────

function createShoe(parent, lateralSign, mats) {
  // Anchor sits at the ankle (bottom of shin, world y≈0.01).
  // Upper spans from ankle down to ground (y=0 to y≈0.18 above ground).
  // Sole is a flat cap at the very bottom.
  // lateralSign separates left/right to avoid Z-fighting.
  const root = new THREE.Group();
  root.position.set(lateralSign * 0.015, 0, 0);

  // Upper: ankle block. Centre at y=+0.09 above anchor so it spans ankle to ground.
  // Height 0.18 → top at anchor+0.18, bottom at anchor+0.00 (ground level).
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.26), mats.shoeUpper);
  upper.position.set(0, 0.09, 0);
  upper.castShadow = true;
  root.add(upper);

  // Sole: thin flat strip at the very bottom (y=0 world), slightly wider/longer
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.30), mats.shoeSole);
  sole.position.set(0, 0.015, 0); // just above anchor (ground level)
  sole.castShadow = true;
  root.add(sole);

  parent.add(root);
  return root;
}

// ─── createPlayer ─────────────────────────────────────────────────────────────

export function createPlayer(scene) {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  // Materials — same colours as original to preserve customisation
  const mats = {
    skin:       new THREE.MeshStandardMaterial({ color: 0xf3d4b8, roughness: 0.6 }),
    jersey:     new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.42, metalness: 0.05 }),
    stripe:     new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0.06 }),
    shorts:     new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.46, metalness: 0.04 }),
    sockTop:    new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.52 }),
    sockBottom: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.52 }),
    shoeUpper:  new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.48 }),
    shoeSole:   new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }),
    shoeDetail: new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.5 }),
  };

  // ── HIERARCHY ───────────────────────────────────────────────────────────────
  //
  // The torso pivot (hipsGroup) is at the WAIST (y=0.75).
  // When it rotates on X, the top tilts but the base stays — no "breaking".
  // Shoulders, head and neck are CHILDREN of hipsGroup → move with torso.
  //
  //  bodyRoot
  //  ├── hipsGroup (pivot y=0.75)
  //  │   ├── torsoMesh
  //  │   ├── stripes + numbers
  //  │   ├── leftShoulderPivot → leftUpperArm → leftElbowPivot → leftForearm
  //  │   ├── rightShoulderPivot → rightUpperArm → rightElbowPivot → rightForearm
  //  │   └── neckGroup → head
  //  ├── pelvisMesh (shorts — follows hips at 40%)
  //  ├── leftLegPivot  (y=0.75) → thigh → shin → shoe
  //  └── rightLegPivot (y=0.75) → thigh → shin → shoe

  // ── Torso (pivot at waist) ───────────────────────────────────────────────
  // hipsGroup pivot is at the waist (y=0.75). The torso mesh sits ABOVE this
  // point, so rotating hipsGroup tilts the upper body without breaking the model.
  const hipsGroup = new THREE.Group();
  hipsGroup.position.set(0, 0.75, 0);
  bodyRoot.add(hipsGroup);

  // Torso: height 0.72, centred at y=0.36 above waist → spans waist to ~shoulder (y=0.72)
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.72, 0.36), mats.jersey);
  torsoMesh.position.set(0, 0.36, 0);
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  hipsGroup.add(torsoMesh);

  const leftStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.38), mats.stripe);
  leftStripe.position.set(-0.30, 0.36, 0);
  leftStripe.castShadow = true;
  hipsGroup.add(leftStripe);

  const rightStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, 0.38), mats.stripe);
  rightStripe.position.set(0.30, 0.36, 0);
  rightStripe.castShadow = true;
  hipsGroup.add(rightStripe);

  // ── Left arm (shoulder → elbow → forearm) ───────────────────────────────
  // Shoulder pivots sit at the top of the torso (y=0.72)
  const leftShoulderPivot = new THREE.Group();
  leftShoulderPivot.position.set(-0.39, 0.72, 0);
  hipsGroup.add(leftShoulderPivot);

  const leftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.30, 10), mats.skin);
  leftUpperArm.position.set(0, -0.15, 0);
  leftUpperArm.castShadow = true;
  leftShoulderPivot.add(leftUpperArm);

  const leftElbowPivot = new THREE.Group();
  leftElbowPivot.position.set(0, -0.30, 0);
  leftShoulderPivot.add(leftElbowPivot);

  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.28, 10), mats.skin);
  leftForearm.position.set(0, -0.14, 0);
  leftForearm.castShadow = true;
  leftElbowPivot.add(leftForearm);

  // ── Right arm ────────────────────────────────────────────────────────────
  const rightShoulderPivot = new THREE.Group();
  rightShoulderPivot.position.set(0.39, 0.72, 0);
  hipsGroup.add(rightShoulderPivot);

  const rightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.30, 10), mats.skin);
  rightUpperArm.position.set(0, -0.15, 0);
  rightUpperArm.castShadow = true;
  rightShoulderPivot.add(rightUpperArm);

  const rightElbowPivot = new THREE.Group();
  rightElbowPivot.position.set(0, -0.30, 0);
  rightShoulderPivot.add(rightElbowPivot);

  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.058, 0.28, 10), mats.skin);
  rightForearm.position.set(0, -0.14, 0);
  rightForearm.castShadow = true;
  rightElbowPivot.add(rightForearm);

  // ── Head + neck ──────────────────────────────────────────────────────────
  // neckGroup at top of torso (y=0.72), head sits 0.24 above that
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0, 0.72, 0);
  hipsGroup.add(neckGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 22, 20), mats.skin);
  head.position.set(0, 0.24, 0);
  head.castShadow = true;
  neckGroup.add(head);

  // ── Jersey number ────────────────────────────────────────────────────────
  let jerseyNumber = 23;
  let numberTexture = createJerseyNumberTexture(jerseyNumber);
  const numberMat = new THREE.MeshStandardMaterial({
    map: numberTexture, transparent: true, roughness: 0.45, metalness: 0.02,
  });
  // Number sits at the chest area — y=0.32 is mid-torso relative to hipsGroup
  const numberFront = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.04), numberMat);
  numberFront.position.set(0, 0.32, 0.20);
  numberFront.castShadow = true;
  hipsGroup.add(numberFront);

  const numberBack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.30, 0.04), numberMat);
  numberBack.position.set(0, 0.32, -0.20);
  numberBack.castShadow = true;
  hipsGroup.add(numberBack);

  // ── Pelvis / shorts ──────────────────────────────────────────────────────
  // Shorts span from waist (0.75) down to mid-thigh (~0.42).
  // Centre at y=0.585, height=0.33 → spans y=0.42 to y=0.75
  const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.33, 0.36), mats.shorts);
  pelvisMesh.position.set(0, 0.585, 0);
  pelvisMesh.castShadow = true;
  bodyRoot.add(pelvisMesh);

  // ── Left leg (pivot at waist) ────────────────────────────────────────────
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.15, 0.75, 0);
  bodyRoot.add(leftLegPivot);

  // Thigh uses shorts material (black), shin uses sock colours
  const leftThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.095, 0.38, 12), mats.shorts);
  leftThigh.position.set(0, -0.19, 0);
  leftThigh.castShadow = true;
  leftLegPivot.add(leftThigh);

  // Shin: centre at y=-0.56, height=0.36 → bottom edge at y=-0.74
  const leftShin = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.082, 0.36, 12), mats.sockBottom);
  leftShin.position.set(0, -0.56, 0);
  leftShin.castShadow = true;
  leftLegPivot.add(leftShin);

  // Shoe anchor at bottom of shin (y=-0.74 from leg pivot = world y=0.01)
  const leftShoeAnchor = new THREE.Group();
  leftShoeAnchor.position.set(0, -0.74, 0);
  leftLegPivot.add(leftShoeAnchor);
  createShoe(leftShoeAnchor, -1, mats);

  // ── Right leg ────────────────────────────────────────────────────────────
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.15, 0.75, 0);
  bodyRoot.add(rightLegPivot);

  const rightThigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.095, 0.38, 12), mats.shorts);
  rightThigh.position.set(0, -0.19, 0);
  rightThigh.castShadow = true;
  rightLegPivot.add(rightThigh);

  const rightShin = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.082, 0.36, 12), mats.sockBottom);
  rightShin.position.set(0, -0.56, 0);
  rightShin.castShadow = true;
  rightLegPivot.add(rightShin);

  const rightShoeAnchor = new THREE.Group();
  rightShoeAnchor.position.set(0, -0.74, 0);
  rightLegPivot.add(rightShoeAnchor);
  createShoe(rightShoeAnchor, 1, mats);

  scene.add(group);

  // ── Internal state ───────────────────────────────────────────────────────
  let animTime = 0;
  let jumpOffsetY = 0;
  let firstPersonMode = false;
  let shootBlend = 0;
  let celebrateBlend = 0;

  // Discrete animation timers
  let shootAnimTimer = 0, shootAnimActive = false;
  const SHOOT_DUR = 0.7;

  let celebAnimTimer = 0, celebAnimActive = false;
  const CELEB_DUR = 1.2;

  let stepBackTimer = 0, stepBackActive = false;
  const STEPBACK_DUR = 0.5;

  let stepBackLandTimer = 0, stepBackLandActive = false;
  const STEPBACK_LAND_DUR = 0.4;

  let ankleTimer = 0, ankleActive = false;
  const ANKLE_DUR    = 0.7;    // duração total (era 0.4)
  const ANKLE_PHASE1 = 0.25;   // finta esquerda: 0→0.25
  const ANKLE_PHASE2 = 0.55;   // crossover direita: 0.25→0.55
  // fase 3 (estabilizar): 0.55→0.70

  let spinTimer = 0, spinActive = false;
  let spinYawRef = 0; // yaw do jogador no momento de activar o spin
  const SPIN_DUR    = 0.65;
  const SPIN_PHASE1 = 0.30;  // rotação 0→180°: 0→0.30s
  const SPIN_PHASE2 = 0.60;  // rotação 180→360°: 0.30→0.60s
  // fase 3 (blend): 0.60→0.65s

  // Sistema de animação por blend:
  // tgt = onde a articulação QUER estar (alvo), cur = onde está AGORA
  // A cada frame cur aproxima-se de tgt com suavização exponencial
  const cur = {
    leftLegX: 0, rightLegX: 0,
    leftArmX: 0, rightArmX: 0,
    leftArmZ: 0, rightArmZ: 0,
    leftElbowX: 0, rightElbowX: 0,
    torsoX: 0, torsoY: 0, torsoZ: 0,
    headX: 0, headY: 0,
  };
  const tgt = { ...cur };

  function resetTarget() {
    for (const k in tgt) tgt[k] = 0;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  function setPositionAndYaw(position, yaw) {
    group.position.copy(position);
    group.position.y = Math.max(0, jumpOffsetY);
    group.rotation.y = yaw;
  }

  function setShootingPose(blend) {
    shootBlend = THREE.MathUtils.clamp(blend, 0, 1);
  }

  function setCelebratePose(blend) {
    celebrateBlend = THREE.MathUtils.clamp(blend, 0, 1);
  }

  function setJumpOffset(offsetY) {
    jumpOffsetY = Math.max(0, offsetY);
    group.position.y = jumpOffsetY;
  }

  function resetJumpOffset() {
    jumpOffsetY = 0;
    group.position.y = 0;
  }

  // Ball anchor: tip of right forearm
  function getBallAnchor(out) {
    out.set(0.06, -0.26, 0.14);
    return rightElbowPivot.localToWorld(out);
  }

  // Release anchor: right hand exit point
  function getReleaseAnchor(out) {
    out.set(0.04, -0.28, 0.44);
    return rightElbowPivot.localToWorld(out);
  }

  function getHeadAnchor(out) {
    out.set(0, 0, 0);
    return head.localToWorld(out);
  }

  function triggerShoot() {
    shootAnimTimer = 0;
    shootAnimActive = true;
    shootBlend = Math.max(shootBlend, 0.6);
    return true;
  }

  function triggerCelebrate() {
    celebAnimTimer = 0;
    celebAnimActive = true;
    celebrateBlend = Math.max(celebrateBlend, 1);
    return true;
  }

  function triggerStepBack() {
    stepBackTimer = 0;
    stepBackActive = true;
    return STEPBACK_DUR;
  }

  function triggerStepBackLand() {
    stepBackLandTimer = 0;
    stepBackLandActive = true;
    return STEPBACK_LAND_DUR;
  }

  function triggerAnkleBreaker() {
    ankleTimer = 0;
    ankleActive = true;
    return ANKLE_DUR;
  }

  function triggerSpinMove(yaw) {
    if (spinActive) return 0;
    spinTimer = 0;
    spinActive = true;
    spinYawRef = yaw;
    return SPIN_DUR;
  }

  function isSpinMoveActive() { return spinActive; }

  function isStepBackActive()     { return stepBackActive; }
  function isAnkleBreakerActive() { return ankleActive; }
  function isAnimatedReady()      { return true; }

  function setFirstPersonMode(enabled) { firstPersonMode = !!enabled; }

  function setJerseyColor(v)  { mats.jersey.color.set(normalizeColor(v, 0x1b5e20)); }
  function setShortsColor(v)  { mats.shorts.color.set(normalizeColor(v, 0x111111)); }
  function setShoesColor(v) {
    const c = normalizeColor(v, 0x111111);
    mats.shoeUpper.color.set(c);
    mats.shoeDetail.color.set(c);
  }

  function setJerseyNumber(number) {
    const n = THREE.MathUtils.clamp(parseInt(number, 10), 1, 99);
    if (!isFinite(n)) return;
    jerseyNumber = n;
    const next = createJerseyNumberTexture(jerseyNumber);
    numberTexture.dispose();
    numberTexture = next;
    numberMat.map = numberTexture;
    numberMat.needsUpdate = true;
  }

  // ── update (called every frame) ──────────────────────────────────────────
  function update(delta, ctx = {}) {
    animTime += delta;
    resetTarget();

    // ── 1. DISCRETE ANIMATIONS (highest priority) ────────────────────────

    if (celebAnimActive) {
      celebAnimTimer = Math.min(celebAnimTimer + delta, CELEB_DUR);
      const phase = celebAnimTimer / CELEB_DUR;
      const up = Math.min(1, phase * 3.5);
      const wave = Math.sin(animTime * 12) * 0.12;

      // Arms raise naturally, elbows extend upward
      tgt.leftArmX    = -(2.2 + wave) * up;
      tgt.rightArmX   = -(2.2 - wave) * up;
      tgt.leftElbowX  = -0.4 * up;
      tgt.rightElbowX = -0.4 * up;

      // Torso leans back + rhythmic lateral sway
      tgt.torsoX = -0.35 * up;
      tgt.torsoZ = Math.sin(animTime * 7) * 0.10 * up;
      tgt.torsoY = Math.sin(animTime * 5) * 0.08 * up;

      // Legs with rhythmic opening
      tgt.leftLegX  =  Math.sin(animTime * 7) * 0.14 * up;
      tgt.rightLegX = -Math.sin(animTime * 7) * 0.14 * up;

      // Head oscillates and looks slightly up
      tgt.headX = -0.20 * up;
      tgt.headY = Math.sin(animTime * 8) * 0.15 * up;

      if (celebAnimTimer >= CELEB_DUR) {
        celebAnimActive = false;
        celebrateBlend = 0;
      }

    } else if (shootAnimActive) {
      shootAnimTimer = Math.min(shootAnimTimer + delta, SHOOT_DUR);
      const phase = shootAnimTimer / SHOOT_DUR;

      // Sub-phases: gather (0→0.25) → release (0.25→0.55) → follow-through (0.55→1)
      // Note: `gather` runs 1→0 (loading fades out); release/followThru run 0→1 (raising).
      const gather     = Math.max(0, 1 - phase / 0.25);
      const release    = Math.max(0, Math.min(1, (phase - 0.25) / 0.30));
      const followThru = Math.max(0, (phase - 0.55) / 0.45);

      // Gather: torso leans back + slight tilt toward shooting side
      tgt.torsoX  =  gather * 0.20 - release * 0.18;
      tgt.torsoZ  = -gather * 0.08;

      // Right arm: elbow bends to load, then extends on release
      tgt.rightArmX   =  gather * 0.25 - release * 1.8  - followThru * 0.10;
      tgt.rightElbowX =  gather * 0.6  - release * 0.6;

      // Left arm (guide): rises more moderately
      tgt.leftArmX   = gather * 0.20 - release * 1.4 - followThru * 0.15;
      tgt.leftElbowX = gather * 0.3  - release * 0.3;

      // Legs: slight squat on gather
      tgt.leftLegX  = gather * 0.12;
      tgt.rightLegX = gather * 0.12;

      // Head follows the shot upward on release
      tgt.headX = -release * 0.25;

      if (shootAnimTimer >= SHOOT_DUR) shootAnimActive = false;

    } else if (stepBackActive) {
      stepBackTimer = Math.min(stepBackTimer + delta, STEPBACK_DUR);
      const phase = stepBackTimer / STEPBACK_DUR;
      const spread = Math.sin(phase * Math.PI);

      tgt.leftArmX  = -spread * 1.1;
      tgt.rightArmX = -spread * 1.1;
      tgt.torsoX = spread * 0.18;
      const legBounce = Math.sin(phase * Math.PI * 2) * 0.16;
      tgt.leftLegX  = legBounce;
      tgt.rightLegX = legBounce;

      if (stepBackTimer >= STEPBACK_DUR) stepBackActive = false;

    } else if (stepBackLandActive) {
      stepBackLandTimer = Math.min(stepBackLandTimer + delta, STEPBACK_LAND_DUR);
      const phase = stepBackLandTimer / STEPBACK_LAND_DUR;
      // Arco suave: sobe e desce para blending natural com a pose de idle
      const arc = Math.sin(phase * Math.PI);

      tgt.leftLegX  = arc * 0.35;   // joelhos dobram (agachamento)
      tgt.rightLegX = arc * 0.35;
      tgt.torsoX    = -arc * 0.30;  // torso inclina para trás
      tgt.rightArmX   = -arc * 1.4; // braço direito levanta para lançar
      tgt.rightElbowX =  arc * 0.5;
      tgt.leftArmX  = -arc * 0.6;   // braço esquerdo abre para equilíbrio
      tgt.headX     = -arc * 0.20;  // cabeça inclina com torso

      if (stepBackLandTimer >= STEPBACK_LAND_DUR) stepBackLandActive = false;

    } else if (ankleActive) {
      ankleTimer = Math.min(ankleTimer + delta, ANKLE_DUR);
      const t = ankleTimer;

      if (t < ANKLE_PHASE1) {
        // Fase 1: finta esquerda — torso inclina esquerda, braço direito empurra bola
        const p = t / ANKLE_PHASE1;
        const arc = Math.sin(p * Math.PI);
        tgt.torsoZ    =  arc * 0.35;  // inclinar esquerda
        tgt.torsoY    = -arc * 0.15;  // rotação ligeira esquerda
        tgt.rightArmX =  arc * 0.40;  // braço direito empurra bola para baixo-esquerda
        tgt.leftArmX  = -arc * 0.55;  // braço esquerdo desce para receber
        tgt.leftLegX  =  arc * 0.12;
        tgt.rightLegX = -arc * 0.08;

      } else if (t < ANKLE_PHASE2) {
        // Fase 2: crossover — explosão para a direita, bola atravessa
        const p = (t - ANKLE_PHASE1) / (ANKLE_PHASE2 - ANKLE_PHASE1);
        const arc = Math.sin(p * Math.PI);
        tgt.torsoZ    = -arc * 0.25;  // virar para a direita
        tgt.torsoY    =  arc * 0.20;  // rotação direita
        tgt.rightArmX = -arc * 0.20;  // braço direito apanha bola baixo
        tgt.leftArmX  = -arc * 0.30;  // braço esquerdo empurra
        tgt.leftLegX  = -arc * 0.14;
        tgt.rightLegX =  arc * 0.14;

      }
      // Fase 3 (estabilizar): resetTarget() já zerifica tgt — blend trata do retorno suave

      if (ankleTimer >= ANKLE_DUR) ankleActive = false;

    } else if (spinActive) {
      // Spin Move: o ângulo de rotação é escrito directamente no grupo — não usa o sistema tgt/cur
      // main.js não deve sobrescrever rotation.y enquanto spinActive=true
      spinTimer = Math.min(spinTimer + delta, SPIN_DUR);
      const t = spinTimer;

      if (t < SPIN_PHASE1) {
        // Primeira metade: 0°→180°, ease-in (começa devagar)
        const p = t / SPIN_PHASE1;
        const arc = Math.sin(p * Math.PI * 0.5);
        tgt.torsoX    =  arc * 0.25;
        tgt.rightArmZ = -arc * 0.60;
        tgt.leftArmX  =  arc * 0.30;
        tgt.leftLegX  =  arc * 0.10;
        tgt.rightLegX = -arc * 0.10;
        group.rotation.y = spinYawRef + arc * Math.PI;

      } else if (t < SPIN_PHASE2) {
        // Segunda metade: 180°→360°, ease-out (desacelera)
        const p = (t - SPIN_PHASE1) / (SPIN_PHASE2 - SPIN_PHASE1);
        const arc = 1 - Math.pow(1 - p, 2);
        tgt.torsoX    =  (1 - arc) * 0.25;
        tgt.rightArmZ = -(1 - arc) * 0.60;
        tgt.leftArmX  =  (1 - arc) * 0.30;
        group.rotation.y = spinYawRef + Math.PI + arc * Math.PI;

      } else {
        group.rotation.y = spinYawRef + Math.PI * 2;
      }

      if (spinTimer >= SPIN_DUR) {
        spinActive = false;
        group.rotation.y = spinYawRef;
      }

    // ── 2. CONTINUOUS ANIMATIONS (movement / idle) ───────────────────────
    } else {
      const celebrating = celebrateBlend > 0.001 || ctx.isCelebrating;
      const shooting = shootBlend > 0.001 || ctx.isCharging || ctx.isShootingSequence;

      if (celebrating) {
        const b = Math.max(celebrateBlend, ctx.isCelebrating ? 1 : 0);
        tgt.leftArmX    = -2.0 * b;
        tgt.rightArmX   = -2.0 * b;
        tgt.leftElbowX  = -0.35 * b;
        tgt.rightElbowX = -0.35 * b;
        tgt.torsoX = -0.30 * b;
        tgt.torsoZ = Math.sin(animTime * 7) * 0.08 * b;
        tgt.headX  = -0.18 * b;
        tgt.headY  = Math.sin(animTime * 6) * 0.12 * b;
        tgt.leftLegX  =  Math.sin(animTime * 7) * 0.10 * b;
        tgt.rightLegX = -Math.sin(animTime * 7) * 0.10 * b;

      } else if (shooting) {
        const b = Math.max(shootBlend, ctx.isCharging ? 0.4 : 0, ctx.isShootingSequence ? 1 : 0);
        tgt.leftArmX    = -1.6 * b;
        tgt.rightArmX   = -1.8 * b;
        tgt.rightElbowX =  0.5 * b;
        tgt.torsoX = 0.05 * b;
        tgt.leftLegX  = -0.08 * b;
        tgt.rightLegX = -0.08 * b;

      } else if (ctx.isMoving && ctx.hasBall) {
        // Correr com bola: pernas oscilam com sin(tempo) — uma avança enquanto a outra recua
        const swing = Math.sin(animTime * 10);
        tgt.leftLegX  =  swing * 0.46;
        tgt.rightLegX = -swing * 0.46;
        tgt.leftArmX  = -swing * 0.18;
        tgt.rightArmX =  swing * 0.22 - 0.42; // braço da bola fica mais baixo
        tgt.torsoX    =  0.12;                 // inclinação para a frente ao correr
        tgt.torsoZ    =  swing * 0.07;         // balancio lateral — dá vida à corrida
        tgt.headX     = -0.08;                 // compensa a inclinação do tronco

      } else if (ctx.isMoving) {
        // Correr sem bola: braços oscilam simétricamente
        const swing = Math.sin(animTime * 9);
        tgt.leftLegX  =  swing * 0.44;
        tgt.rightLegX = -swing * 0.44;
        tgt.leftArmX  = -swing * 0.26;
        tgt.rightArmX =  swing * 0.26;
        tgt.torsoX    =  0.12;
        tgt.torsoZ    =  swing * 0.07;
        tgt.headX     = -0.08;

      } else if (ctx.hasBall) {
        // Dribble parado: braço direito oscila com sin — acompanha o bounce da bola
        // O alvo muda a cada frame porque é sin(tempo), nunca é uma posição fixa
        const dribble = Math.sin(animTime * 1.5 * Math.PI * 2);
        tgt.rightArmX =  dribble * 0.60 - 0.20;
        tgt.leftArmX  =  Math.sin(animTime * 4 + 1.0) * 0.10;
        tgt.torsoX    =  0.10;   // ligeira inclinação para a frente
        tgt.torsoZ    =  dribble * 0.04;
        tgt.leftLegX  =  0.08;   // joelhos ligeiramente dobrados (stance de basquete)
        tgt.rightLegX =  0.08;
      }
      // Idle sem bola: tudo zero (pose de repouso)
    }

    // ── 3. BLEND ─────────────────────────────────────────────────────────
    // Animações discretas (skills, lançamento) usam blend mais rápido (22) para serem snappy
    // Animações contínuas (correr, idle) usam blend lento (8) para transições suaves
    const fast = shootAnimActive || celebAnimActive || stepBackActive || ankleActive || spinActive;
    const alpha = fast ? 1 - Math.exp(-delta * 22) : 1 - Math.exp(-delta * 8);

    for (const k in cur) cur[k] = lerp(cur[k], tgt[k], alpha);

    // ── 4. APPLY ROTATIONS ───────────────────────────────────────────────
    leftLegPivot.rotation.x  = cur.leftLegX;
    rightLegPivot.rotation.x = cur.rightLegX;

    hipsGroup.rotation.x = cur.torsoX;
    hipsGroup.rotation.y = cur.torsoY;
    hipsGroup.rotation.z = cur.torsoZ;

    // Arms: shoulder + elbow
    leftShoulderPivot.rotation.x  = cur.leftArmX;
    leftShoulderPivot.rotation.z  = cur.leftArmZ;
    leftElbowPivot.rotation.x     = cur.leftElbowX;
    rightShoulderPivot.rotation.x = cur.rightArmX;
    rightShoulderPivot.rotation.z = cur.rightArmZ;
    rightElbowPivot.rotation.x    = cur.rightElbowX;

    // Head: pitch + yaw
    neckGroup.rotation.x = cur.headX;
    neckGroup.rotation.y = cur.headY;

    // Pelvis follows hips at 40% (avoids visual disconnection)
    pelvisMesh.rotation.x = cur.torsoX * 0.4;
    pelvisMesh.rotation.y = cur.torsoY * 0.5;

    bodyRoot.visible = !firstPersonMode;
  }

  return {
    group,
    update,
    setPositionAndYaw,
    setShootingPose,
    setCelebratePose,
    setJumpOffset,
    resetJumpOffset,
    getBallAnchor,
    getReleaseAnchor,
    getHeadAnchor,
    triggerShoot,
    triggerCelebrate,
    isAnimatedReady,
    setFirstPersonMode,
    setJerseyColor,
    setShortsColor,
    setShoesColor,
    setJerseyNumber,
    triggerStepBack,
    triggerStepBackLand,
    triggerAnkleBreaker,
    isStepBackActive,
    isAnkleBreakerActive,
    triggerSpinMove,
    isSpinMoveActive,
  };
}
