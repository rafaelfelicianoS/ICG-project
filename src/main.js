/*
  ICG 2025/2026 - Mini-Jogo de Basquetebol 3D
  Ferramentas de IA integradas no desenvolvimento e apoio à implementação:
  - OpenAI ChatGPT
*/

import { BALL, COURT, PHYSICS, PLAYER, PLAYER_STATES, SHOT } from "./core/constants.js";
import { THREE } from "./core/deps.js";
import { createFollowCamera } from "./core/camera.js";
import { InputController } from "./core/input.js";
import { createHUD } from "./core/ui.js";
import { createAudioSystem } from "./core/audio.js";
import { createCourt } from "./world/court.js";
import { createDayNightController } from "./world/dayNight.js";
import { createPlayer } from "./world/player.js";
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

const app = document.getElementById("app");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b2a);
scene.fog = new THREE.Fog(0x101b2a, 22, 62);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const followCamera = createFollowCamera(renderer.domElement);
const input = new InputController(renderer.domElement);
const audio = createAudioSystem();
const clock = new THREE.Clock();

const court = createCourt(scene);
const dayNight = createDayNightController(scene, court.lightPoleAnchors);
const player = createPlayer(scene);
const ballMesh = createBasketballMesh(scene);
const dribbleState = createDribbleState();
const physics = createPhysicsWorld(court);
const ui = createHUD({
  onJerseyColor: (hex) => player.setJerseyColor(hex),
  onShortsColor: (hex) => player.setShortsColor(hex),
  onBallColor: (hex) => ballMesh.setBaseColor(hex),
  onNumberChange: (number) => player.setJerseyNumber(number),
});

const playerPosition = new THREE.Vector3(0, 0, 0);
let playerYaw = 0;
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

let hasBall = true;
let shootSequence = null;
let recoverySequence = null;
let activeShot = null;
let celebrationTimer = 0;
let antiDoubleTrigger = 0;
let rimSoundCooldown = 0;
let lastMovementState = false;
let lastCourtSide = playerPosition.z >= 0 ? 1 : -1;
const previousBallPosition = new THREE.Vector3().copy(ballMesh.position);

const stats = {
  score: 0,
  twoPointMakes: 0,
  threePointMakes: 0,
  makes: 0,
  attempts: 0,
};
ui.updateStats(stats);
ui.setTimingLabel("PRECISAO");
ui.setDayNightBadge(dayNight.getMode(), dayNight.getState().transitioning);

const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x49d17c, transparent: true, opacity: 0.9 });
const trajectoryGeometry = new THREE.BufferGeometry();
const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
trajectoryLine.visible = false;
scene.add(trajectoryLine);

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

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 1 / 30);
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

  if (input.wasKeyPressed("KeyP")) {
    const mode = followCamera.togglePerspective(playerYaw);
    if (player.setFirstPersonMode) {
      player.setFirstPersonMode(mode === "first_person");
    }
  }

  if (input.wasKeyPressed("KeyC")) {
    followCamera.resetOrbitBehindPlayer(playerYaw);
  }

  dayNight.update(delta);
  court.update(delta);
  const dayNightState = dayNight.getState();
  ui.setDayNightBadge(dayNight.getMode(), dayNightState.transitioning);

  if (antiDoubleTrigger > 0) {
    antiDoubleTrigger = Math.max(0, antiDoubleTrigger - delta);
  }
  if (rimSoundCooldown > 0) {
    rimSoundCooldown = Math.max(0, rimSoundCooldown - delta);
  }

  const canMove = !shootSequence && !shotCharge.isCharging && !recoverySequence && celebrationTimer <= 0;
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

  if (!hasBall && activeShot && !activeShot.scored && antiDoubleTrigger <= 0) {
    const targetHoop = findHoopById(activeShot.targetHoopId);
    if (
      targetHoop &&
      detectBasketScore(previousBallPosition, ballMesh.position, targetHoop.rimCenter, COURT.rimRadius, BALL.radius)
    ) {
      registerScore(activeShot, targetHoop);
      activeShot.scored = true;
      antiDoubleTrigger = 0.5;
    }
  }

  updateShotLockLifecycle();
  previousBallPosition.copy(ballMesh.position);

  updateStateMachine();
  followCamera.update(playerPosition, undefined, delta, playerYaw);
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

  if (followCamera.isFirstPerson()) {
    followCamera.getForwardXZ(playerPosition, tempVector);
    tempVectorB.copy(worldUp).cross(tempVector).normalize();
  } else {
    const cameraYaw = followCamera.getOrbitYaw();
    tempVector.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw));
    tempVectorB.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));
  }

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

function handleShootingInput(delta, nearestHoop) {
  if (shootSequence) {
    updateShootSequence(delta);
  }

  if (!hasBall || recoverySequence || celebrationTimer > 0) {
    ui.setPower(0, false);
    ui.setPerfectActive(false);
    trajectoryLine.visible = false;
    return;
  }

  if (!shootSequence && input.wasPointerPressed()) {
    audio.ensureContext();
    startShotCharge(shotCharge);
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
    player.setShootingPose(0);
    player.resetJumpOffset();
  }
}

function updateTrajectoryPreview(power, hoop, timingWindow) {
  const origin = ballMesh.position;
  const velocity = computeShotVelocity(origin, hoop.rimCenter, power, SHOT, timingWindow);
  const points = [];
  const maxSamples = 50;

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

  if (power >= timingWindow.min && power <= timingWindow.max) {
    trajectoryMaterial.color.set(0x49d17c);
  } else if (power < timingWindow.min) {
    trajectoryMaterial.color.set(0xf5b700);
  } else {
    trajectoryMaterial.color.set(0xe63946);
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
    activeShot = null;
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
    player.setJumpOffset(Math.sin(progress * Math.PI) * 0.2);
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
