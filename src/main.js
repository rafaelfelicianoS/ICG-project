/*
  ICG 2025/2026 - Mini-Jogo de Basquetebol 3D
  Ferramentas de IA integradas no desenvolvimento e apoio à implementação:
  - OpenAI ChatGPT
*/

import { BALL, COURT, GAME_MODES, PHYSICS, PLAYER, PLAYER_STATES, SHOT, SKILLS, THREE_POINT_CONTEST_STATIONS, getRimCenter } from "./core/constants.js";
import { THREE } from "./core/deps.js";
import { createFollowCamera } from "./core/camera.js";
import { InputController } from "./core/input.js";
import { createHUD } from "./core/ui.js";
import { createAudioSystem } from "./core/audio.js";
import { createCourt } from "./world/court.js";
import { createDayNightController } from "./world/dayNight.js";
import { createPlayer } from "./world/player.js";
import { createPark } from "./world/park.js";
import { createBasketballMesh, createDribbleState, updateDribble } from "./world/ball.js";
import { createPhysicsWorld, syncMeshWithBody } from "./physics/world.js";
import {
  computeShotVelocity,
  createShotChargeState,
  getShotTimingWindow,
  releaseShot,
  startShotCharge,
  updateShotCharge,
} from "./game/shot.js";
import { classifyShotValue, detectBasketScore } from "./game/scoring.js";
import { recordShot, renderDebugOverlay } from "./game/shotDebug.js";
import { createPassTargets } from "./world/passTargets.js";

const app = document.getElementById("app");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b2a);
// Fog: objectos a mais de 90m desaparecem gradualmente — esconde os limites do mundo
scene.fog = new THREE.Fog(0x101b2a, 28, 90);

const renderer = new THREE.WebGLRenderer({ antialias: true });
// PCFSoftShadowMap: sombras com bordas suaves (várias amostras em vez de uma)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Limitar pixel ratio a 2 — ecrãs de alta resolução não precisam de renderizar a 100%
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const followCamera = createFollowCamera(renderer.domElement);
const input = new InputController(renderer.domElement);
const audio = createAudioSystem();
const clock = new THREE.Clock();

const court = createCourt(scene);
const dayNight = createDayNightController(scene, court.lightPoleAnchors);
const park = createPark(scene);
const player = createPlayer(scene);
const passTargets = createPassTargets(scene);
const ballMesh = createBasketballMesh(scene);
const dribbleState = createDribbleState();
const physics = createPhysicsWorld(court);
const ui = createHUD({
  onJerseyColor: (hex) => player.setJerseyColor(hex),
  onShortsColor: (hex) => player.setShortsColor(hex),
  onBallColor: (hex) => ballMesh.setBaseColor(hex),
  onShoesColor: (hex) => player.setShoesColor(hex),
  onRimColor: (hex) => court.setRimColor(hex),
  onNumberChange: (number) => player.setJerseyNumber(number),
  onReset: () => resetGame(),
  onModeChange: (mode) => startGameMode(mode),
  onPlayAgain: () => startGameMode(currentGameMode),
  onSkillAssign: (slot, skillKey) => {
    activeSkills[slot] = skillKey;
  },
});

const playerPosition = new THREE.Vector3(0, 0, 0);
let playerYaw = 0;
let shotChargeYawTarget = null; // set when shot charging begins, null otherwise
let currentState = PLAYER_STATES.IDLE;

player.setPositionAndYaw(playerPosition, playerYaw);
if (player.setFirstPersonMode) {
  player.setFirstPersonMode(false);
}

const tempBallAnchor = new THREE.Vector3();
const tempReleaseAnchor = new THREE.Vector3();
const tempHeadPosition = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempNetImpact = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const tempVec2B = new THREE.Vector2();
const worldUp = new THREE.Vector3(0, 1, 0);

player.getBallAnchor(tempBallAnchor);
ballMesh.position.copy(tempBallAnchor);

const ballBody = physics.createBallBody(tempBallAnchor);
const shotCharge = createShotChargeState();
const SKILLS_SPIN_DUR = 0.65; // deve coincidir com SPIN_DUR em player.js

let hasBall = true;
let shootSequence = null;
let recoverySequence = null;
let activeShot = null;
let celebrationTimer = 0;
let antiDoubleTrigger = 0;
let rimSoundCooldown = 0;
let lastMovementState = false;
let lastCourtSide = playerPosition.z >= 0 ? 1 : -1;

// Cooldown dos moves especiais (para o HUD — dura 4s/3s)
let stepBackTimer = 0;
let ankleBreakerTimer = 0;

// Timers de animação curtos (bloqueiam movimento apenas durante a animação)
let stepBackAnimTimer = 0;   // dura ~0.9s (duração da skill)
let ankleAnimTimer = 0;      // dura ~0.7s

// Spin Move
let spinMoveTimer = 0;       // cooldown (3.5s)
let spinMoveAnimTimer = 0;   // anim lock (0.65s)

// Spin Move: afterimages e luz
const spinAfterimages = [];  // { mesh, life, maxLife, startOpacity }[]
let spinMoveLight = null;
let spinMoveLightTimer = 0;

// Spin Move: sequência de movimento físico
let spinSequenceActive = false;
let spinSequenceTimer = 0;
let spinSequenceStartX = 0;
let spinSequenceStartZ = 0;
let spinSequenceFwdX = 0;
let spinSequenceFwdZ = 0;
let spinSequence_spawnedAt20 = false;

// ─── Skills activas (persistidas em localStorage) ───────────────────────────
function loadActiveSkills() {
  const q = localStorage.getItem('icg_skill_q') || 'stepBack';
  const e = localStorage.getItem('icg_skill_e') || 'ankleBreaker';
  return { q, e };
}
const activeSkills = loadActiveSkills();

// Step Back visual effects
let stepBackLight = null;          // THREE.PointLight, temporária
let stepBackLightTimer = 0;        // countdown para remover a luz
const stepBackDustParticles = [];  // { mesh, velY, life, maxLife }[]

// Step Back: tiro pendente
let stepBackShotPending = false;
let stepBackShotTimer = 0;
let stepBackShotHoop = null;

// Tiro garantido pelo Step Back (bola entra sempre que cruze o plano do aro)
let guaranteedShot = false;

// Ankle Breaker afterimage e movimento físico
const ankleAfterimages = [];  // { mesh, life, maxLife, startOpacity }[]
let ankleSequenceTimer = 0;
let ankleSequenceActive = false;
let ankleSequenceStartX = 0;
let ankleSequenceStartZ = 0;

// Estado de passe
let passInFlight = false;       // bola está em trajeto de passe
let passTargetRef = null;       // alvo selecionado para o passe
const prevBallY = { value: 0 }; // y anterior da bola (para deteção de aterragem)

// Estatísticas de passe (reiniciadas com o modo)
const passStats = { attempts: 0, makes: 0 };
const previousBallPosition = new THREE.Vector3().copy(ballMesh.position);

// Modo debug de lançamento (ativar/desativar com F3)
let debugMode = false;
const debugOverlay = document.getElementById("debug-overlay");

const stats = {
  score: 0,
  twoPointMakes: 0,
  threePointMakes: 0,
  makes: 0,
  attempts: 0,
};

// ─── Estado do modo de jogo ──────────────────────────────────────────────
let currentGameMode = GAME_MODES.FREE_PLAY;

// Lances Livres: 10 tentativas, jogador fixo na linha
const FREE_THROW_TOTAL = 10;
const freethrowState = { active: false, attempts: 0, makes: 0 };


// Concurso de 3 Pontos: 5 estações × 5 bolas, bola de dinheiro na 5ª
const contestState = {
  active: false,
  stationIndex: 0,  // 0-4
  ballIndex: 0,     // 0-4 dentro da estação
  score: 0,
  waitingForBall: false,  // true após lançar, aguarda resultado (cesto ou timeout)
  ballTimer: 0,           // tempo decorrido desde o lançamento (para timeout)
  needsAdvance: false,    // true quando a bola foi resolvida e é preciso avançar para a próxima
};

// Posição de lance livre calculada a partir do aro sul.
// Distância oficial NBA: 5.79m do centro do aro.
// freeThrowDistanceFromBaseline (4.6m) mede da baseline, não do aro — não usamos diretamente.
const FREE_THROW_DISTANCE_FROM_RIM = 5.79;
const _rimSouth = getRimCenter(-1);
const FREE_THROW_POSITION = new THREE.Vector3(
  0,
  0,
  _rimSouth.z + FREE_THROW_DISTANCE_FROM_RIM  // ex: -12.38 + 5.79 = -6.59
);

ui.updateStats(stats);
ui.setTimingLabel("PRECISAO");
ui.setDayNightBadge(dayNight.getMode(), dayNight.getState().transitioning);

// Linha verde que mostra a trajectória prevista do lançamento enquanto se carrega
const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x49d17c, transparent: true, opacity: 0.9 });
const trajectoryGeometry = new THREE.BufferGeometry();
const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
trajectoryLine.visible = false;
scene.add(trajectoryLine);

// Quando a bola colide com o aro (Cannon.js detecta), toca som e perturba a rede visualmente
ballBody.addEventListener("collide", (event) => {
  if (event.body && event.body.kind === "rim") {
    if (rimSoundCooldown <= 0) {
      audio.playRim();
      rimSoundCooldown = 0.05;
    }
    tempNetImpact.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
    court.disturbNet(event.body.hoopId, tempNetImpact, 0.11);
  }
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  followCamera.resize(window.innerWidth, window.innerHeight);
});

animate();

// Game loop: chama-se a si próprio 60x por segundo via requestAnimationFrame
// delta = tempo desde o último frame em segundos — mantém velocidade igual independente do FPS
function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 1 / 30); // limitar a 30ms evita saltos se o jogo pausar
  update(delta);
  renderer.render(scene, followCamera.camera);
  input.endFrame();
}

function update(delta) {
  if (input.wasKeyPressed("KeyH")) {
    ui.toggleControlsPanel();
  }

  if (input.wasKeyPressed("KeyT")) {
    dayNight.toggle();
  }

  if (input.wasKeyPressed("KeyR")) {
    recoverBallToHands("manual");
  }

  if (input.wasKeyPressed("KeyN")) {
    resetGame();
  }

  if (input.wasKeyPressed("KeyG")) {
    debugMode = !debugMode;
    if (debugOverlay) debugOverlay.classList.toggle("hidden", !debugMode);
  }

  if (input.wasKeyPressed("KeyP")) {
    const mode = followCamera.togglePerspective(playerYaw);
    if (player.setFirstPersonMode) {
      player.setFirstPersonMode(mode === "first_person");
    }
  }

  if (input.wasKeyPressed("KeyC")) {
    followCamera.resetOrbitBehindPlayer(playerYaw);
  }

  if (input.wasKeyPressed("KeyS") && !input.isDown("KeyW") && !input.isDown("KeyA") && !input.isDown("KeyD")) {
    if (ui.toggleSkillsPanel) ui.toggleSkillsPanel();
  }

  // Skills (Q / E): despachadas com base em activeSkills
  function canTriggerSkill() {
    return hasBall && !shootSequence && !shotCharge.isCharging
      && celebrationTimer <= 0
      && stepBackTimer <= 0 && ankleBreakerTimer <= 0 && spinMoveTimer <= 0
      && currentGameMode === GAME_MODES.FREE_PLAY;
  }

  function triggerSkill(slot) {
    if (!canTriggerSkill()) return;
    const skill = activeSkills[slot];

    if (skill === 'stepBack') {
      const oldX = playerPosition.x;
      const oldZ = playerPosition.z;
      const backDirX = -Math.sin(playerYaw);
      const backDirZ = -Math.cos(playerYaw);
      // Teleporte imediato para trás — posição muda instantaneamente
      playerPosition.x = THREE.MathUtils.clamp(
        playerPosition.x + backDirX * SKILLS.stepBackTpDist,
        -COURT.halfWidth + 0.55, COURT.halfWidth - 0.55
      );
      playerPosition.z = THREE.MathUtils.clamp(
        playerPosition.z + backDirZ * SKILLS.stepBackTpDist,
        -COURT.halfLength + 0.75, COURT.halfLength - 0.75
      );
      // Flash de luz azul no ponto de origem — dura 0.15s e desce de intensidade
      if (stepBackLight) { scene.remove(stepBackLight); }
      stepBackLight = new THREE.PointLight(0x88aaff, 3, 4);
      stepBackLight.position.set(oldX, 1.2, oldZ);
      scene.add(stepBackLight);
      stepBackLightTimer = 0.15;
      // 5 partículas de poeira: caixinhas que sobem e ficam transparentes ao longo de 0.3s
      for (let i = 0; i < 5; i++) {
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const mat = new THREE.MeshBasicMaterial({ color: 0xaabbff, transparent: true, opacity: 0.7 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          oldX + (Math.random() - 0.5) * 0.4,
          0.3 + Math.random() * 0.5,
          oldZ + (Math.random() - 0.5) * 0.4
        );
        scene.add(mesh);
        stepBackDustParticles.push({ mesh, velY: 0.8 + Math.random() * 1.2, life: 0, maxLife: 0.3 });
      }
      const duration = player.triggerStepBackLand();
      stepBackTimer = SKILLS.stepBackCooldown;
      stepBackAnimTimer = 0.9;
      // Dispara lançamento garantido automaticamente após a animação de aterragem
      stepBackShotPending = true;
      stepBackShotTimer = duration * 0.55;
      stepBackShotHoop = findNearestHoop(playerPosition);

    } else if (skill === 'ankleBreaker') {
      player.triggerAnkleBreaker();
      ankleBreakerTimer = SKILLS.ankleCooldown;
      ankleAnimTimer = 0.7;
      ankleSequenceActive = true;
      ankleSequenceTimer = 0;
      ankleSequenceStartX = playerPosition.x;
      ankleSequenceStartZ = playerPosition.z;

    } else if (skill === 'spinMove') {
      player.triggerSpinMove(playerYaw);
      spinMoveTimer = SKILLS.spinMoveCooldown;
      spinMoveAnimTimer = SKILLS_SPIN_DUR;
      // Flash roxo mais curto (0.12s) e mais agressivo que o do Step Back
      if (spinMoveLight) { scene.remove(spinMoveLight); }
      spinMoveLight = new THREE.PointLight(SKILLS.spinMoveLightColor, 2.5, 5);
      spinMoveLight.position.set(playerPosition.x, 1.2, playerPosition.z);
      scene.add(spinMoveLight);
      spinMoveLightTimer = 0.12;
      spinSequenceActive = true;
      spinSequenceTimer = 0;
      spinSequenceStartX = playerPosition.x;
      spinSequenceStartZ = playerPosition.z;
      spinSequenceFwdX = Math.sin(playerYaw);
      spinSequenceFwdZ = Math.cos(playerYaw);
      spinSequence_spawnedAt20 = false;
    }
  }

  if (input.wasKeyPressed("KeyQ")) triggerSkill('q');
  if (input.wasKeyPressed("KeyE")) triggerSkill('e');

  // Passe (F): lança a bola em parábola baixa para o alvo mais próximo à frente
  if (input.wasKeyPressed("KeyF") && hasBall && !shootSequence && !shotCharge.isCharging
      && celebrationTimer <= 0 && !passInFlight) {
    const target = passTargets.findBestTarget(playerPosition, playerYaw);
    if (target) {
      beginPass(target);
    }
  }

  // Decrementar timers dos moves especiais
  if (stepBackTimer > 0) stepBackTimer = Math.max(0, stepBackTimer - delta);
  if (ankleBreakerTimer > 0) ankleBreakerTimer = Math.max(0, ankleBreakerTimer - delta);
  if (stepBackAnimTimer > 0) stepBackAnimTimer = Math.max(0, stepBackAnimTimer - delta);
  if (ankleAnimTimer > 0) ankleAnimTimer = Math.max(0, ankleAnimTimer - delta);
  if (spinMoveTimer > 0)     spinMoveTimer     = Math.max(0, spinMoveTimer - delta);
  if (spinMoveAnimTimer > 0) spinMoveAnimTimer = Math.max(0, spinMoveAnimTimer - delta);

  updateStepBackEffects(delta);
  updateAnkleBreakerSequence(delta);
  updateSpinMoveSequence(delta);
  updateSpinMoveEffects(delta);

  dayNight.update(delta);
  park.update(delta);
  court.update(delta);
  updateGameMode(delta);
  const dayNightState = dayNight.getState();
  ui.setDayNightBadge(dayNight.getMode(), dayNightState.transitioning);

  if (antiDoubleTrigger > 0) {
    antiDoubleTrigger = Math.max(0, antiDoubleTrigger - delta);
  }
  if (rimSoundCooldown > 0) {
    rimSoundCooldown = Math.max(0, rimSoundCooldown - delta);
  }

  // No modo Lances Livres o jogador fica fixo na linha; moves especiais também bloqueiam
  const isFreethrowLocked = currentGameMode === GAME_MODES.FREE_THROW
    || currentGameMode === GAME_MODES.THREE_POINT_CONTEST;
  const isSpecialMove = stepBackAnimTimer > 0 || ankleAnimTimer > 0 || spinMoveAnimTimer > 0;
  const canMove = !shootSequence && !shotCharge.isCharging && !recoverySequence && celebrationTimer <= 0 && !isFreethrowLocked && !isSpecialMove;
  const isMoving = updatePlayerMovement(delta, canMove);
  lastMovementState = isMoving;

  const newCourtSide = playerPosition.z === 0 ? lastCourtSide : Math.sign(playerPosition.z);
  if (!followCamera.isFirstPerson() && newCourtSide !== lastCourtSide) {
    followCamera.requestHalfCourtFlip();
    lastCourtSide = newCourtSide;
  }

  if (followCamera.isFirstPerson()) {
    const lockYaw = followCamera.getLockOnYaw();
    if (lockYaw !== null) {
      playerYaw = lockYaw;
    }
  }

  // Smoothly rotate player to face the hoop when charging a shot
  if (shotChargeYawTarget !== null && !followCamera.isFirstPerson()) {
    let diff = shotChargeYawTarget - playerYaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // wrap to [-π, π], consistent with updatePlayerMovement
    const step = SHOT.faceHoopSpeed * delta;
    if (Math.abs(diff) <= step) {
      playerYaw = shotChargeYawTarget;
    } else {
      playerYaw += Math.sign(diff) * step;
    }
  }

  player.setPositionAndYaw(playerPosition, playerYaw);
  updatePlayerPose(delta);
  player.update(delta, {
    isMoving,
    hasBall,
    isCharging: shotCharge.isCharging,
    isShootingSequence: !!shootSequence,
    isCelebrating: celebrationTimer > 0,
  });

  const nearestHoop = findNearestHoop(playerPosition);
  tempVec2.set(playerPosition.x, playerPosition.z);
  tempVec2B.set(nearestHoop.rimCenter.x, nearestHoop.rimCenter.z);
  const zoneValue = classifyShotValue(tempVec2, tempVec2B);
  ui.setZoneIndicator(zoneValue === 3);

  handleShootingInput(delta, nearestHoop);
  updateRecoverSequence(delta);
  updateBallOwnership(delta, isMoving);

  physics.world.step(PHYSICS.fixedTimeStep, delta, PHYSICS.maxSubSteps);
  if (!hasBall && !recoverySequence) {
    court.interactBallWithNets(ballBody, BALL.radius, delta);
  }

  if (!hasBall && !recoverySequence) {
    syncMeshWithBody(ballMesh, ballBody);
  }

  // Deteção de passe bem-sucedido
  if (passInFlight && !hasBall) {
    const hitTarget = passTargets.checkPassLanding(ballMesh.position, prevBallY.value);
    if (hitTarget) {
      passInFlight = false;
      passStats.makes += 1;
      passTargets.flashTarget(hitTarget);
      ui.showScoreFeedback("PASSE!", ballMesh.position, followCamera.camera);
    }
    // Se a bola está muito baixa ou parada, o passe terminou (erro)
    if (ballMesh.position.y < 0.25 && Math.abs(ballBody.velocity.y) < 0.5) {
      passInFlight = false;
    }
  }
  prevBallY.value = ballMesh.position.y;

  if (!hasBall && activeShot && !activeShot.scored && antiDoubleTrigger <= 0) {
    const targetHoop = findHoopById(activeShot.targetHoopId);
    if (targetHoop) {
      const shotIsPerfect = activeShot.shotVelocityData?.isPerfect ?? false;
      const scoreResult = detectBasketScore(
        previousBallPosition, ballMesh.position, targetHoop.rimCenter, COURT.rimRadius, BALL.radius, shotIsPerfect, guaranteedShot
      );
      if (scoreResult.scored) {
        registerScore(activeShot, targetHoop);
        activeShot.scored = true;
        antiDoubleTrigger = 0.5;
        if (guaranteedShot) guaranteedShot = false; // reset após cesto garantido registado
      }
      // Registar no debug quando a bola cruzou o plano do aro (scored ou não)
      if (scoreResult.crossPoint !== null && activeShot.shotVelocityData && !activeShot.debugLogged) {
        activeShot.debugLogged = true;
        const vd = activeShot.shotVelocityData;
        const debugData = {
          distancia: activeShot.distanciaAoAro ?? 0,
          power: activeShot.power,
          janelaMin: activeShot.timingWindow.min,
          janelaMax: activeShot.timingWindow.max,
          isPerfect: vd.isPerfect,
          angulo: vd.angleDeg ?? 0,
          velocidade: vd.speed ?? 0,
          crossPoint: scoreResult.crossPoint,
          desvioXZ: scoreResult.distXZ ?? null,
          raioEfetivo: scoreResult.effectiveRadius ?? (COURT.rimRadius - BALL.radius * 0.35),
          entrou: scoreResult.scored,
        };
        recordShot(debugData);
        if (debugMode) {
          renderDebugOverlay(debugOverlay);
          console.table([debugData]);
        }
      }
    }
  }

  updateShotLockLifecycle();
  previousBallPosition.copy(ballMesh.position);

  updateStateMachine();

  // Atualizar HUD das skills a cada frame
  ui.updateSkillsHUD(activeSkills, {
    stepBack:     { cooldownRatio: SKILLS.stepBackCooldown   > 0 ? stepBackTimer      / SKILLS.stepBackCooldown   : 0, hasBall },
    ankleBreaker: { cooldownRatio: SKILLS.ankleCooldown      > 0 ? ankleBreakerTimer  / SKILLS.ankleCooldown      : 0, hasBall },
    spinMove:     { cooldownRatio: SKILLS.spinMoveCooldown   > 0 ? spinMoveTimer       / SKILLS.spinMoveCooldown   : 0, hasBall },
  });

  followCamera.update(playerPosition, undefined, delta, playerYaw);

  // Atualizar overlay de debug a cada frame quando activo
  if (debugMode && debugOverlay) {
    renderDebugOverlay(debugOverlay);
  }
}

function updatePlayerMovement(delta, canMove) {
  if (!canMove) {
    return false;
  }

  const moveX = (input.isDown("KeyD") ? 1 : 0) - (input.isDown("KeyA") ? 1 : 0);
  const moveZ = (input.isDown("KeyW") ? 1 : 0) - (input.isDown("KeyS") ? 1 : 0);
  const isMoving = moveX !== 0 || moveZ !== 0;
  if (!isMoving) {
    return false;
  }

  followCamera.camera.getWorldDirection(tempVector);
  tempVector.y = 0;
  if (tempVector.lengthSq() < 0.0001) {
    const cameraYaw = followCamera.getOrbitYaw();
    tempVector.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
  } else {
    tempVector.normalize();
  }
  tempVectorB.copy(tempVector).cross(worldUp).normalize();

  tempVectorC.copy(tempVector).multiplyScalar(moveZ);
  tempVectorC.addScaledVector(tempVectorB, moveX);
  tempVectorC.normalize();

  const targetYaw = Math.atan2(tempVectorC.x, tempVectorC.z);
  const angleDelta = Math.atan2(Math.sin(targetYaw - playerYaw), Math.cos(targetYaw - playerYaw));
  const turnAlpha = 1 - Math.exp(-delta * 12);
  playerYaw += angleDelta * turnAlpha;

  playerPosition.addScaledVector(tempVectorC, PLAYER.moveSpeed * delta);

  playerPosition.x = THREE.MathUtils.clamp(playerPosition.x, court.bounds.minX, court.bounds.maxX);
  playerPosition.z = THREE.MathUtils.clamp(playerPosition.z, court.bounds.minZ, court.bounds.maxZ);
  return true;
}

function updateStepBackEffects(delta) {
  // Luz: intensidade proporcional ao tempo restante → fade natural até desaparecer
  if (stepBackLight) {
    stepBackLightTimer = Math.max(0, stepBackLightTimer - delta);
    stepBackLight.intensity = (stepBackLightTimer / 0.15) * 3;
    if (stepBackLightTimer <= 0) {
      scene.remove(stepBackLight);
      stepBackLight = null;
    }
  }

  // Partículas: cada uma sobe (velY) e fica transparente (1-t) até desaparecer
  for (let i = stepBackDustParticles.length - 1; i >= 0; i--) {
    const p = stepBackDustParticles[i];
    p.life += delta;
    const t = p.life / p.maxLife; // t: 0 (nasceu) → 1 (morreu)
    p.mesh.position.y += p.velY * delta;
    p.mesh.material.opacity = 0.7 * (1 - t); // desaparece gradualmente
    if (p.life >= p.maxLife) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose(); // libertar memória GPU
      p.mesh.material.dispose();
      stepBackDustParticles.splice(i, 1);
    }
  }

  // Tiro garantido pendente — disparar quando o timer chegar a zero
  if (stepBackShotPending) {
    stepBackShotTimer = Math.max(0, stepBackShotTimer - delta);
    if (stepBackShotTimer <= 0 && stepBackShotHoop) {
      stepBackShotPending = false;
      // guaranteedShot=true faz detectBasketScore ignorar o raio — bola entra sempre
      guaranteedShot = true;
      // Janela perfeita total — qualquer power passa como isPerfect=true em computeShotVelocity,
      // garantindo horizontalError=0 e speed=idealSpeed → bola entra sempre no cesto
      const perfectWindow = { min: 0, max: 1, center: 0.5, difficulty: 0 };
      beginShot(0.81, stepBackShotHoop, perfectWindow);
    }
  }
}

function updateAnkleBreakerSequence(delta) {
  if (!ankleSequenceActive) return;

  ankleSequenceTimer += delta;
  const totalDur = 0.7;    // coincide com ANKLE_DUR em player.js
  const phase1End = 0.25;
  const phase2End = 0.55;

  // Vetores perpendiculares ao yaw do jogador (esquerda/direita no referencial do corpo)
  const leftX  = -Math.cos(playerYaw);
  const leftZ  =  Math.sin(playerYaw);
  const rightX =  Math.cos(playerYaw);
  const rightZ = -Math.sin(playerYaw);

  if (ankleSequenceTimer < phase1End) {
    // Fase 1: finta esquerda — p vai 0→1, smooth é a curva de aceleração (ease-in)
    const p = ankleSequenceTimer / phase1End;
    const smooth = Math.sin(p * Math.PI * 0.5); // começa devagar, acelera
    playerPosition.x = THREE.MathUtils.clamp(
      ankleSequenceStartX + leftX * SKILLS.ankleFakeDist * smooth,
      -COURT.halfWidth + 0.55, COURT.halfWidth - 0.55
    );
    playerPosition.z = THREE.MathUtils.clamp(
      ankleSequenceStartZ + leftZ * SKILLS.ankleFakeDist * smooth,
      -COURT.halfLength + 0.75, COURT.halfLength - 0.75
    );

  } else if (ankleSequenceTimer < phase2End) {
    // Fase 2: explosão direita — cria afterimages na 1ª vez que entra nesta fase
    if (ankleAfterimages.length === 0) {
      spawnAnkleAfterimages();
    }
    const p = (ankleSequenceTimer - phase1End) / (phase2End - phase1End);
    const smooth = 1 - Math.pow(1 - p, 2); // ease-out: começa rápido, desacelera
    playerPosition.x = THREE.MathUtils.clamp(
      ankleSequenceStartX + rightX * SKILLS.ankleCrossDist * smooth,
      -COURT.halfWidth + 0.55, COURT.halfWidth - 0.55
    );
    playerPosition.z = THREE.MathUtils.clamp(
      ankleSequenceStartZ + rightZ * SKILLS.ankleCrossDist * smooth,
      -COURT.halfLength + 0.75, COURT.halfLength - 0.75
    );

  } else if (ankleSequenceTimer >= totalDur) {
    ankleSequenceActive = false;
  }

  // Esbater afterimages
  for (let i = ankleAfterimages.length - 1; i >= 0; i--) {
    const a = ankleAfterimages[i];
    a.life += delta;
    const t = a.life / a.maxLife;
    a.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.opacity = a.startOpacity * (1 - t);
      }
    });
    if (a.life >= a.maxLife) {
      scene.remove(a.mesh);
      ankleAfterimages.splice(i, 1);
    }
  }
}

function spawnAnkleAfterimages() {
  const leftX  = -Math.cos(playerYaw);
  const leftZ  =  Math.sin(playerYaw);
  const rightX =  Math.cos(playerYaw);
  const rightZ = -Math.sin(playerYaw);

  // 3 cópias fantasma: uma no pico da finta esquerda, duas ao longo do crossover direita
  const positions = [
    { x: ankleSequenceStartX + leftX  * SKILLS.ankleFakeDist,              z: ankleSequenceStartZ + leftZ  * SKILLS.ankleFakeDist },
    { x: ankleSequenceStartX + rightX * (SKILLS.ankleCrossDist * 0.33),    z: ankleSequenceStartZ + rightZ * (SKILLS.ankleCrossDist * 0.33) },
    { x: ankleSequenceStartX + rightX * (SKILLS.ankleCrossDist * 0.66),    z: ankleSequenceStartZ + rightZ * (SKILLS.ankleCrossDist * 0.66) },
  ];
  const opacities = [0.35, 0.25, 0.18]; // mais transparente à medida que avança
  const lifetimes = [0.20, 0.25, 0.30]; // as últimas duram um pouco mais

  positions.forEach((pos, i) => {
    // clone() copia toda a hierarquia visual do jogador (corpo, braços, pernas...)
    const ghost = player.group.clone();
    ghost.position.set(pos.x, 0, pos.z);
    ghost.rotation.y = playerYaw;
    // Clonar materiais individualmente para poder mudar opacidade sem afectar o original
    ghost.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = opacities[i];
        child.material.depthWrite = false; // não bloqueia objectos atrás
      }
    });
    scene.add(ghost);
    ankleAfterimages.push({ mesh: ghost, life: 0, maxLife: lifetimes[i], startOpacity: opacities[i] });
  });
}

function updateSpinMoveEffects(delta) {
  if (spinMoveLight) {
    spinMoveLightTimer -= delta;
    if (spinMoveLightTimer <= 0) {
      scene.remove(spinMoveLight);
      spinMoveLight = null;
    } else {
      spinMoveLight.intensity = (spinMoveLightTimer / 0.12) * 2.5;
    }
  }
  for (let i = spinAfterimages.length - 1; i >= 0; i--) {
    const a = spinAfterimages[i];
    a.life += delta;
    const t = a.life / a.maxLife;
    a.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.opacity = a.startOpacity * (1 - t);
      }
    });
    if (a.life >= a.maxLife) {
      scene.remove(a.mesh);
      spinAfterimages.splice(i, 1);
    }
  }
}

function spawnSpinAfterimages() {
  const opacities = [0.35, 0.25, 0.18];
  const lifetimes  = [0.20, 0.25, 0.30];
  const fractions  = [0.20, 0.50, 0.80]; // 20%, 50%, 80% do trajecto total

  fractions.forEach((frac, i) => {
    const ghost = player.group.clone();
    // Posição ao longo do trajecto de avanço
    ghost.position.set(
      spinSequenceStartX + spinSequenceFwdX * SKILLS.spinMoveDist * frac,
      0,
      spinSequenceStartZ + spinSequenceFwdZ * SKILLS.spinMoveDist * frac
    );
    // Rotação correcta para esse momento da volta (frac=0.5 → 180°, frac=1.0 → 360°)
    ghost.rotation.y = playerYaw + frac * Math.PI * 2;
    ghost.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = opacities[i];
        child.material.depthWrite = false;
      }
    });
    scene.add(ghost);
    spinAfterimages.push({ mesh: ghost, life: 0, maxLife: lifetimes[i], startOpacity: opacities[i] });
  });
}

function updateSpinMoveSequence(delta) {
  if (!spinSequenceActive) return;
  spinSequenceTimer += delta;
  const dur = SKILLS_SPIN_DUR;
  const prevT = Math.min((spinSequenceTimer - delta) / dur, 1);
  const curT  = Math.min(spinSequenceTimer / dur, 1);
  // Curva coseno: 0.5 - 0.5*cos(t*π) — começa devagar, acelera, desacelera (ease in-out)
  const prevP = 0.5 - 0.5 * Math.cos(prevT * Math.PI);
  const curP  = 0.5 - 0.5 * Math.cos(curT  * Math.PI);
  const dp    = curP - prevP; // incremento de posição neste frame

  playerPosition.x = THREE.MathUtils.clamp(
    playerPosition.x + spinSequenceFwdX * SKILLS.spinMoveDist * dp,
    -COURT.halfWidth + 0.55, COURT.halfWidth - 0.55
  );
  playerPosition.z = THREE.MathUtils.clamp(
    playerPosition.z + spinSequenceFwdZ * SKILLS.spinMoveDist * dp,
    -COURT.halfLength + 0.75, COURT.halfLength - 0.75
  );

  if (!spinSequence_spawnedAt20 && curP >= 0.20) {
    spinSequence_spawnedAt20 = true;
    spawnSpinAfterimages();
  }

  if (spinSequenceTimer >= dur) {
    spinSequenceActive = false;
    spinSequence_spawnedAt20 = false;
  }
}

function handleShootingInput(delta, nearestHoop) {
  if (shootSequence) {
    updateShootSequence(delta);
  }

  // Bloquear novos lançamentos se o concurso está à espera do resultado
  const modeEnded = (currentGameMode === GAME_MODES.THREE_POINT_CONTEST && contestState.waitingForBall);

  if (!hasBall || recoverySequence || celebrationTimer > 0 || modeEnded) {
    ui.setPower(0, false);
    ui.setPerfectActive(false);
    trajectoryLine.visible = false;
    return;
  }

  if (!shootSequence && input.wasPointerPressed()) {
    audio.ensureContext();
    startShotCharge(shotCharge);
    // Snap yaw target to face the nearest hoop when charging begins
    const dx = nearestHoop.rimCenter.x - playerPosition.x;
    const dz = nearestHoop.rimCenter.z - playerPosition.z;
    shotChargeYawTarget = Math.atan2(dx, dz);
    if (followCamera.isFirstPerson()) {
      player.getHeadAnchor(tempHeadPosition);
      followCamera.startShotLockOn(nearestHoop.lockOnTarget ?? nearestHoop.rimCenter, tempHeadPosition);
    }
  }

  if (shotCharge.isCharging && !shootSequence) {
    const power = updateShotCharge(shotCharge, delta);
    const distanceToHoop = ballMesh.position.distanceTo(nearestHoop.rimCenter);
    const timingWindow = getShotTimingWindow(distanceToHoop, SHOT);

    ui.setTimingWindow(timingWindow.min, timingWindow.max);
    ui.setPower(power, true);
    const perfectNow = power >= timingWindow.min && power <= timingWindow.max;
    ui.setPerfectActive(perfectNow);
    updateTrajectoryPreview(power, nearestHoop, timingWindow);

    if (input.wasPointerReleased()) {
      const releasedPower = releaseShot(shotCharge);
      beginShot(releasedPower, nearestHoop, timingWindow);
    }
  } else if (!shootSequence) {
    ui.setPower(0, false);
    ui.setPerfectActive(false);
    trajectoryLine.visible = false;
  }

}

function beginShot(power, hoop, timingWindow) {
  stats.attempts += 1;
  ui.updateStats(stats);
  onAttemptForMode();
  player.triggerShoot();

  const shotDuration = 0.64;
  const releaseNormalized = THREE.MathUtils.clamp(SHOT.shootReleaseNormalized, 0.2, 0.8);

  shootSequence = {
    power,
    targetHoopId: hoop.id,
    timingWindow,
    timer: 0,
    releaseTime: shotDuration * releaseNormalized,
    duration: shotDuration,
    released: false,
  };

  activeShot = {
    targetHoopId: hoop.id,
    originXZ: new THREE.Vector2(playerPosition.x, playerPosition.z),
    scored: false,
    power,
    timingWindow,
    distanciaAoAro: ballMesh.position.distanceTo(hoop.rimCenter),
    shotVelocityData: null, // preenchido no momento do release
    debugLogged: false,
  };

  ui.setPower(0, false);
  ui.setPerfectActive(false);
  trajectoryLine.visible = false;
}

function updateShootSequence(delta) {
  shootSequence.timer += delta;
  const prep = THREE.MathUtils.clamp(shootSequence.timer / shootSequence.releaseTime, 0, 1);

  if (!shootSequence.released) {
    player.setJumpOffset(prep * 0.35);
    player.setShootingPose(prep);
    player.getBallAnchor(tempBallAnchor);
    player.getReleaseAnchor(tempReleaseAnchor);
    tempVector.copy(tempBallAnchor).lerp(tempReleaseAnchor, prep);
    ballMesh.position.copy(tempVector);
    physics.setBallBodyKinematic(ballBody, tempVector);

    if (shootSequence.timer >= shootSequence.releaseTime) {
      shootSequence.released = true;
      hasBall = false;
      const targetHoop = findHoopById(shootSequence.targetHoopId);
      const origin = ballMesh.position;
      const velocity = computeShotVelocity(origin, targetHoop.rimCenter, shootSequence.power, SHOT, shootSequence.timingWindow);
      if (activeShot) {
        activeShot.shotVelocityData = velocity;
      }
      physics.activateBallBody(ballBody, velocity, origin);
      syncMeshWithBody(ballMesh, ballBody);
      previousBallPosition.copy(ballMesh.position);
    }
    return;
  }

  const coolDown = THREE.MathUtils.clamp(
    (shootSequence.timer - shootSequence.releaseTime) / (shootSequence.duration - shootSequence.releaseTime),
    0,
    1
  );
  player.setJumpOffset((1 - coolDown) * 0.35);
  player.setShootingPose(1 - coolDown);

  if (shootSequence.timer >= shootSequence.duration) {
    shootSequence = null;
    shotChargeYawTarget = null; // allow normal movement to control yaw again
    guaranteedShot = false; // clear on shot end (covers miss)
    player.setShootingPose(0);
    player.resetJumpOffset();
  }
}

function updateTrajectoryPreview(power, hoop, timingWindow) {
  const origin = ballMesh.position;
  const velocity = computeShotVelocity(origin, hoop.rimCenter, power, SHOT, timingWindow);
  const points = [];
  const maxSamples = 50;

  // Simular 50 pontos da trajectória usando equação cinemática: y = y0 + vy*t - 0.5*g*t²
  for (let i = 0; i < maxSamples; i += 1) {
    const t = i * 0.045;
    const x = origin.x + velocity.x * t;
    const y = origin.y + velocity.y * t - 0.5 * 9.82 * t * t;
    const z = origin.z + velocity.z * t;
    if (y < 0 && i > 5) {
      break;
    }
    points.push(new THREE.Vector3(x, y, z));
  }

  trajectoryGeometry.setFromPoints(points);

  // Cor da linha: verde = perfeito, amarelo = fraco, vermelho = forte demais
  if (power >= timingWindow.min && power <= timingWindow.max) {
    trajectoryMaterial.color.set(0x49d17c); // verde — dentro da janela perfeita
  } else if (power < timingWindow.min) {
    trajectoryMaterial.color.set(0xf5b700); // amarelo — power insuficiente
  } else {
    trajectoryMaterial.color.set(0xe63946); // vermelho — power excessivo
  }

  trajectoryLine.visible = points.length > 1;
}

function updateBallOwnership(delta, isMoving) {
  if (recoverySequence) {
    return;
  }

  if (hasBall && !shootSequence && !shotCharge.isCharging && celebrationTimer <= 0) {
    const dribble = updateDribble(
      delta,
      { position: playerPosition, yaw: playerYaw, isMoving },
      ballMesh,
      dribbleState
    );
    physics.setBallBodyKinematic(ballBody, ballMesh.position);
    if (dribble.hitGround) {
      audio.playDribble();
    }
  } else if (hasBall && !shootSequence) {
    player.getBallAnchor(tempBallAnchor);
    ballMesh.position.copy(tempBallAnchor);
    physics.setBallBodyKinematic(ballBody, ballMesh.position);
  }
}

function recoverBallToHands(reason) {
  if (hasBall || recoverySequence) {
    return;
  }
  followCamera.endShotLockOn();
  recoverySequence = {
    reason,
    timer: 0,
    duration: 0.55,
    start: ballMesh.position.clone(),
  };
  physics.setBallBodyKinematic(ballBody, ballMesh.position);
}

function updateRecoverSequence(delta) {
  if (!recoverySequence) {
    return;
  }

  recoverySequence.timer += delta;
  const t = THREE.MathUtils.clamp(recoverySequence.timer / recoverySequence.duration, 0, 1);
  player.getBallAnchor(tempBallAnchor);

  tempVector.copy(recoverySequence.start).lerp(tempBallAnchor, t);
  tempVector.y += Math.sin(Math.PI * t) * 0.6;

  ballMesh.position.copy(tempVector);
  physics.setBallBodyKinematic(ballBody, tempVector);

  if (t >= 1) {
    hasBall = true;
    recoverySequence = null;
    shootSequence = null;
    shotChargeYawTarget = null; // allow normal movement to control yaw again
    activeShot = null;
    guaranteedShot = false; // clear on ball recovery
    player.setShootingPose(0);
  }
}

function updateShotLockLifecycle() {
  if (!followCamera.isShotLockOnActive()) {
    return;
  }
  if (hasBall || recoverySequence || !activeShot) {
    return;
  }

  const velocitySq =
    ballBody.velocity.x * ballBody.velocity.x +
    ballBody.velocity.y * ballBody.velocity.y +
    ballBody.velocity.z * ballBody.velocity.z;
  const onGround = ballBody.position.y <= BALL.radius + 0.04 && Math.abs(ballBody.velocity.y) < 1.2;
  const nearlyStopped = velocitySq < 0.09 && ballBody.position.y <= BALL.radius + 0.12;

  if (onGround || nearlyStopped) {
    followCamera.endShotLockOn();
  }
}

function updatePlayerPose(delta) {
  if (celebrationTimer > 0) {
    celebrationTimer = Math.max(0, celebrationTimer - delta);
    const progress = 1 - celebrationTimer / 0.75;
    player.setCelebratePose(1);
    // Duplo salto: sin(2π*progress) cria dois picos durante a celebração
    player.setJumpOffset(Math.max(0, Math.sin(progress * Math.PI * 2)) * 0.28);
    return;
  }

  player.setCelebratePose(0);
  player.resetJumpOffset();
}

function updateStateMachine() {
  if (celebrationTimer > 0) {
    currentState = PLAYER_STATES.CELEBRATING;
    return;
  }
  if (shotCharge.isCharging || shootSequence) {
    currentState = PLAYER_STATES.SHOOTING;
    return;
  }
  if (!hasBall) {
    currentState = lastMovementState ? PLAYER_STATES.MOVING : PLAYER_STATES.IDLE;
    return;
  }
  currentState = lastMovementState ? PLAYER_STATES.DRIBBLING : PLAYER_STATES.IDLE;
}

function registerScore(shotRecord, hoop) {
  followCamera.endShotLockOn();
  tempVec2B.set(hoop.rimCenter.x, hoop.rimCenter.z);
  const shotValue = classifyShotValue(shotRecord.originXZ, tempVec2B);
  stats.score += shotValue;
  stats.makes += 1;
  if (shotValue === 3) {
    stats.threePointMakes += 1;
  } else {
    stats.twoPointMakes += 1;
  }
  ui.updateStats(stats);
  onScoreForMode(shotValue);

  tempVector.copy(hoop.rimCenter);
  tempVector.y += 0.35;
  ui.showScoreFeedback(`+${shotValue}`, tempVector, followCamera.camera);
  tempNetImpact.copy(hoop.rimCenter);
  tempNetImpact.y -= 0.2;
  court.disturbNet(hoop.id, tempNetImpact, 0.2);
  ui.flashSuccess();
  audio.playBasket();
  player.triggerCelebrate();
  celebrationTimer = 0.75;
}

function findNearestHoop(position) {
  let best = court.hoops[0];
  let bestDistanceSq = Infinity;
  for (const hoop of court.hoops) {
    const dx = position.x - hoop.rimCenter.x;
    const dz = position.z - hoop.rimCenter.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistanceSq) {
      bestDistanceSq = distSq;
      best = hoop;
    }
  }
  return best;
}

function findHoopById(hoopId) {
  return court.hoops.find((hoop) => hoop.id === hoopId);
}

// ─── Mecânica de Passe ───────────────────────────────────────────────────

function beginPass(target) {
  passStats.attempts += 1;
  passInFlight = true;
  passTargetRef = target;
  hasBall = false;

  // Calcular velocidade de passe: parábola baixa (arcHeight 1.5m) para o alvo
  const origin = ballMesh.position.clone();
  const dest = target.position.clone();
  dest.y = BALL.radius; // alvo no chão ao nível da bola

  const horizontal = new THREE.Vector3(dest.x - origin.x, 0, dest.z - origin.z);
  const distance = horizontal.length();
  if (distance < 0.01) {
    hasBall = true;
    passInFlight = false;
    return;
  }

  // Velocidade para parábola: v = d / t, t = sqrt(2*arcH/g) * 2 ~approx
  const arcHeight = 1.5;
  const g = 9.82;
  // Tempo de voo: raiz quadrada de 2*arcHeight/g (sobe) × 2 (sobe e desce)
  const halfTime = Math.sqrt((2 * arcHeight) / g);
  const totalTime = halfTime * 2;
  const horizSpeed = distance / totalTime;
  const vertSpeed = g * halfTime;

  horizontal.normalize();
  const velocity = {
    x: horizontal.x * horizSpeed,
    y: vertSpeed,
    z: horizontal.z * horizSpeed,
  };

  physics.activateBallBody(ballBody, velocity, origin);
  syncMeshWithBody(ballMesh, ballBody);
  previousBallPosition.copy(ballMesh.position);
}

// ─── Gestão de modos de jogo ─────────────────────────────────────────────

function startGameMode(mode) {
  currentGameMode = mode;

  // Limpar estado de modos anteriores
  freethrowState.active = false;
  contestState.active = false;
  ballMesh.setBaseColor("#DD7D2A"); // restaurar cor normal da bola
  ui.hideResult();
  ui.setModeHud(null, "");

  resetGame();

  if (mode === GAME_MODES.FREE_THROW) {
    freethrowState.active = true;
    freethrowState.attempts = 0;
    freethrowState.makes = 0;
    // Teleportar jogador para a linha de lance livre
    playerPosition.copy(FREE_THROW_POSITION);
    playerYaw = Math.PI; // yaw=π aponta para -Z (cesto sul, rimZ ≈ -12.38)
    player.setPositionAndYaw(playerPosition, playerYaw);
    ui.setModeHud("LANCE", `0 / ${FREE_THROW_TOTAL}`);
  } else if (mode === GAME_MODES.THREE_POINT_CONTEST) {
    startThreePointContest();
  }
}

function updateGameMode(delta) {
  if (currentGameMode === GAME_MODES.THREE_POINT_CONTEST) {
    updateThreePointContest(delta);
  }
}

// Chamado em registerScore — verifica lógica específica de cada modo
function onScoreForMode(shotValue) {
  if (currentGameMode === GAME_MODES.FREE_THROW && freethrowState.active) {
    freethrowState.makes += 1;
  }
  if (currentGameMode === GAME_MODES.THREE_POINT_CONTEST && contestState.active) {
    // Pontua apenas se ainda estávamos à espera desta bola
    if (contestState.waitingForBall) {
      const isMoney = contestState.ballIndex === 4;
      contestState.score += isMoney ? 2 : 1;
      contestState.waitingForBall = false; // bola resolvida
      contestState.needsAdvance = true;   // sinaliza que é preciso avançar para a próxima
      updateContestHud();
      if (isMoney) {
        // Feedback visual especial para a bola de dinheiro
        const nearestHoop = findNearestHoop(playerPosition);
        tempVector.copy(nearestHoop.rimCenter);
        tempVector.y += 0.8;
        ui.showScoreFeedback("💰 +2", tempVector, followCamera.camera);
      }
    }
  }
}

// Chamado em cada tentativa de lançamento (ao libertar o botão)
function onAttemptForMode() {
  if (currentGameMode === GAME_MODES.FREE_THROW && freethrowState.active) {
    freethrowState.attempts += 1;
    ui.setModeHud("LANCE", `${freethrowState.attempts} / ${FREE_THROW_TOTAL}`);

    if (freethrowState.attempts >= FREE_THROW_TOTAL) {
      // Aguarda que a bola termine o trajeto antes de mostrar o resultado
      // (handler em updateBallOwnership vai chamar endFreethrowMode)
      freethrowState.active = false;
      // Mostra resultado com pequeno delay para a animação de cesto terminar
      window.setTimeout(() => {
        const fg = ((freethrowState.makes / FREE_THROW_TOTAL) * 100).toFixed(1);
        ui.showResult(
          "Lances Livres",
          `Cestos: <strong>${freethrowState.makes}</strong> / ${FREE_THROW_TOTAL}<br>FG: ${fg}%`
        );
      }, 1800);
    }
  }
  if (currentGameMode === GAME_MODES.THREE_POINT_CONTEST && contestState.active) {
    // Marca que estamos à espera do resultado desta bola
    contestState.waitingForBall = true;
    contestState.ballTimer = 0;
  }
}

function resetGame() {
  // Repõe pontuação e estatísticas
  stats.score = 0;
  stats.makes = 0;
  stats.attempts = 0;
  stats.twoPointMakes = 0;
  stats.threePointMakes = 0;
  ui.updateStats(stats);

  // Cancela sequências em curso
  shootSequence = null;
  shotChargeYawTarget = null; // allow normal movement to control yaw again
  activeShot = null;
  celebrationTimer = 0;
  antiDoubleTrigger = 0;
  guaranteedShot = false;
  stepBackShotPending = false;

  // Devolve a bola ao jogador
  hasBall = true;
  recoverySequence = null;
  player.setShootingPose(0);
  player.resetJumpOffset();
  followCamera.endShotLockOn();

  player.getBallAnchor(tempBallAnchor);
  ballMesh.position.copy(tempBallAnchor);
  physics.setBallBodyKinematic(ballBody, tempBallAnchor);
  previousBallPosition.copy(tempBallAnchor);
}

// ─── Concurso de 3 Pontos ────────────────────────────────────────────────

function startThreePointContest() {
  contestState.active = true;
  contestState.stationIndex = 0;
  contestState.ballIndex = 0;
  contestState.score = 0;
  contestState.waitingForBall = false;
  contestState.ballTimer = 0;
  contestState.needsAdvance = false;
  teleportToContestStation(0);
}

function restoreBallToPlayer() {
  // Devolve a bola ao jogador e limpa sequências em curso
  hasBall = true;
  shootSequence = null;
  shotChargeYawTarget = null; // allow normal movement to control yaw again
  activeShot = null;
  recoverySequence = null;
  celebrationTimer = 0;
  antiDoubleTrigger = 0;
  player.getBallAnchor(tempBallAnchor);
  ballMesh.position.copy(tempBallAnchor);
  physics.setBallBodyKinematic(ballBody, tempBallAnchor);
  previousBallPosition.copy(tempBallAnchor);
}

function teleportToContestStation(index) {
  const station = THREE_POINT_CONTEST_STATIONS[index];
  playerPosition.set(station.x, 0, station.z);
  playerYaw = station.yaw;
  player.setPositionAndYaw(playerPosition, playerYaw);

  restoreBallToPlayer();
  contestState.waitingForBall = false;
  contestState.ballTimer = 0;

  // Bola de dinheiro (5ª bola, índice 4) é dourada
  const isMoney = contestState.ballIndex === 4;
  ballMesh.setBaseColor(isMoney ? "#f5b700" : "#DD7D2A");

  updateContestHud();
}

function updateContestHud() {
  const stationNum = contestState.stationIndex + 1;
  const ballNum = contestState.ballIndex + 1;
  const isMoney = contestState.ballIndex === 4;
  const ballLabel = isMoney ? "💰" : `Bola ${ballNum}/5`;
  ui.setModeHud(`Estação ${stationNum}/5 · ${ballLabel}`, `${contestState.score} pts`);
}

function updateThreePointContest(delta) {
  if (!contestState.active) return;

  if (contestState.waitingForBall) {
    contestState.ballTimer += delta;
    // Timeout: bola não entrou em 4 segundos → miss, recuperar bola
    if (contestState.ballTimer >= 4) {
      contestState.waitingForBall = false;
      contestState.needsAdvance = true; // bola perdida — avançar após recuperação
      recoverBallToHands("contest-timeout");
    }
    return;
  }

  // Só avança quando uma bola foi resolvida e o jogador já tem a bola de volta
  if (!contestState.needsAdvance) return;
  if (!hasBall || shootSequence || recoverySequence || celebrationTimer > 0) return;

  contestState.needsAdvance = false;
  advanceContestBall();
}

function advanceContestBall() {
  contestState.ballIndex += 1;

  if (contestState.ballIndex >= 5) {
    // Estação terminada
    contestState.ballIndex = 0;
    contestState.stationIndex += 1;

    if (contestState.stationIndex >= 5) {
      // Todas as estações terminadas — fim do concurso
      contestState.active = false;
      const maxScore = 30; // 5 estações × (4×1pt + 1×2pt) = 30
      ui.setModeHud(null, "");
      ballMesh.setBaseColor("#DD7D2A");
      window.setTimeout(() => {
        ui.showResult(
          "Concurso de 3 Pontos",
          `Pontuação: <strong>${contestState.score}</strong> / ${maxScore}`
        );
      }, 1200);
      return;
    }

    // Teleportar para a próxima estação
    teleportToContestStation(contestState.stationIndex);
  } else {
    // Próxima bola na mesma estação — atualizar cor e HUD
    const isMoney = contestState.ballIndex === 4;
    ballMesh.setBaseColor(isMoney ? "#f5b700" : "#DD7D2A");
    updateContestHud();

    // Devolver bola ao jogador
    restoreBallToPlayer();
  }
}
