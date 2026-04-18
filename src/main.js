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
import { createPlayer } from "./world/player.js";
import { createBasketballMesh, createDribbleState, updateDribble } from "./world/ball.js";
import { createPhysicsWorld, syncMeshWithBody } from "./physics/world.js";
import {
  computeShotVelocity,
  createShotChargeState,
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

const followCamera = createFollowCamera();
const input = new InputController(renderer.domElement);
const ui = createHUD();
const audio = createAudioSystem();
const clock = new THREE.Clock();

addArenaLights(scene);

const court = createCourt(scene);
const player = createPlayer(scene);
const ballMesh = createBasketballMesh(scene);
const dribbleState = createDribbleState();
const physics = createPhysicsWorld(court);

const playerPosition = new THREE.Vector3(0, 0, 0);
let playerYaw = 0;
let currentState = PLAYER_STATES.IDLE;

player.setPositionAndYaw(playerPosition, playerYaw);

const tempBallAnchor = new THREE.Vector3();
const tempReleaseAnchor = new THREE.Vector3();
const tempVector = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();
const tempVec2B = new THREE.Vector2();

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
let timeSinceRelease = 0;
let rimSoundCooldown = 0;
let lastMovementState = false;
const previousBallPosition = new THREE.Vector3().copy(ballMesh.position);

const stats = {
  score: 0,
  twoPointMakes: 0,
  threePointMakes: 0,
  makes: 0,
  attempts: 0,
};
ui.updateStats(stats);

const trajectoryMaterial = new THREE.LineBasicMaterial({ color: 0x49d17c, transparent: true, opacity: 0.9 });
const trajectoryGeometry = new THREE.BufferGeometry();
const trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
trajectoryLine.visible = false;
scene.add(trajectoryLine);

ballBody.addEventListener("collide", (event) => {
  if (rimSoundCooldown > 0) {
    return;
  }
  if (event.body && event.body.kind === "rim") {
    audio.playRim();
    rimSoundCooldown = 0.05;
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

  if (input.wasKeyPressed("KeyR")) {
    recoverBallToHands("manual");
  }

  if (antiDoubleTrigger > 0) {
    antiDoubleTrigger = Math.max(0, antiDoubleTrigger - delta);
  }
  if (rimSoundCooldown > 0) {
    rimSoundCooldown = Math.max(0, rimSoundCooldown - delta);
  }

  const canMove = !shootSequence && !shotCharge.isCharging && !recoverySequence && celebrationTimer <= 0;
  const isMoving = updatePlayerMovement(delta, canMove);
  lastMovementState = isMoving;

  player.setPositionAndYaw(playerPosition, playerYaw);
  updatePlayerPose(delta);

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

  previousBallPosition.copy(ballMesh.position);

  if (!hasBall && !recoverySequence && (!shootSequence || shootSequence.released)) {
    timeSinceRelease += delta;
    const speed = ballBody.velocity.length();
    const shouldAutoRecover =
      timeSinceRelease >= BALL.autoRecoverTimeout ||
      (timeSinceRelease > 0.8 && speed < BALL.recoverSpeedThreshold);
    if (shouldAutoRecover) {
      recoverBallToHands("auto");
    }
  }

  updateStateMachine();
  followCamera.update(playerPosition, playerYaw, PLAYER.followOffset, delta);
}

function updatePlayerMovement(delta, canMove) {
  if (!canMove) {
    return false;
  }

  const rotationInput = (input.isDown("KeyE") ? 1 : 0) - (input.isDown("KeyQ") ? 1 : 0);
  playerYaw += rotationInput * PLAYER.rotationSpeed * delta;

  const moveX = (input.isDown("KeyD") ? 1 : 0) - (input.isDown("KeyA") ? 1 : 0);
  const moveZ = (input.isDown("KeyW") ? 1 : 0) - (input.isDown("KeyS") ? 1 : 0);
  const isMoving = moveX !== 0 || moveZ !== 0;
  if (!isMoving) {
    return false;
  }

  tempVector.set(Math.sin(playerYaw), 0, Math.cos(playerYaw));
  tempVectorB.set(Math.cos(playerYaw), 0, -Math.sin(playerYaw));
  tempVector.multiplyScalar(moveZ);
  tempVectorB.multiplyScalar(moveX);
  tempVector.add(tempVectorB).normalize().multiplyScalar(PLAYER.moveSpeed * delta);
  playerPosition.add(tempVector);

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
  }

  if (shotCharge.isCharging && !shootSequence) {
    const power = updateShotCharge(shotCharge, delta);
    ui.setPower(power, true);
    const perfectNow = power >= SHOT.perfectMin && power <= SHOT.perfectMax;
    ui.setPerfectActive(perfectNow);
    updateTrajectoryPreview(power, nearestHoop);

    if (input.wasPointerReleased()) {
      const releasedPower = releaseShot(shotCharge);
      beginShot(releasedPower, nearestHoop);
    }
  } else if (!shootSequence) {
    ui.setPower(0, false);
    ui.setPerfectActive(false);
    trajectoryLine.visible = false;
  }

}

function beginShot(power, hoop) {
  stats.attempts += 1;
  ui.updateStats(stats);

  player.getReleaseAnchor(tempReleaseAnchor);
  const velocity = computeShotVelocity(tempReleaseAnchor, hoop.rimCenter, power, SHOT);

  shootSequence = {
    power,
    targetHoopId: hoop.id,
    velocity,
    timer: 0,
    releaseTime: 0.2,
    duration: 0.64,
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
    player.setShootingPose(prep);
    player.getBallAnchor(tempBallAnchor);
    player.getReleaseAnchor(tempReleaseAnchor);
    tempVector.copy(tempBallAnchor).lerp(tempReleaseAnchor, prep);
    ballMesh.position.copy(tempVector);
    physics.setBallBodyKinematic(ballBody, tempVector);

    if (shootSequence.timer >= shootSequence.releaseTime) {
      shootSequence.released = true;
      hasBall = false;
      timeSinceRelease = 0;
      player.getReleaseAnchor(tempReleaseAnchor);
      physics.activateBallBody(ballBody, shootSequence.velocity, tempReleaseAnchor);
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
  player.setShootingPose(1 - coolDown);

  if (shootSequence.timer >= shootSequence.duration) {
    shootSequence = null;
    player.setShootingPose(0);
  }
}

function updateTrajectoryPreview(power, hoop) {
  player.getReleaseAnchor(tempReleaseAnchor);
  const velocity = computeShotVelocity(tempReleaseAnchor, hoop.rimCenter, power, SHOT);
  const points = [];
  const maxSamples = 50;

  for (let i = 0; i < maxSamples; i += 1) {
    const t = i * 0.045;
    const x = tempReleaseAnchor.x + velocity.x * t;
    const y = tempReleaseAnchor.y + velocity.y * t - 0.5 * 9.82 * t * t;
    const z = tempReleaseAnchor.z + velocity.z * t;
    if (y < 0 && i > 5) {
      break;
    }
    points.push(new THREE.Vector3(x, y, z));
  }

  trajectoryGeometry.setFromPoints(points);

  if (power >= SHOT.perfectMin && power <= SHOT.perfectMax) {
    trajectoryMaterial.color.set(0x49d17c);
  } else if (power < SHOT.perfectMin) {
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
    timeSinceRelease = 0;
    player.setShootingPose(0);
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
  ui.flashSuccess();
  audio.playBasket();
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

function addArenaLights(targetScene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  targetScene.add(ambient);

  const hemisphere = new THREE.HemisphereLight(0xcce4ff, 0x283a46, 0.28);
  targetScene.add(hemisphere);

  const positions = [
    [COURT.halfWidth + 4, 11.5, COURT.halfLength + 4],
    [-COURT.halfWidth - 4, 11.5, COURT.halfLength + 4],
    [COURT.halfWidth + 4, 11.5, -COURT.halfLength - 4],
    [-COURT.halfWidth - 4, 11.5, -COURT.halfLength - 4],
  ];

  positions.forEach((pos) => {
    const dir = new THREE.DirectionalLight(0xffffff, 0.64);
    dir.position.set(pos[0], pos[1], pos[2]);
    dir.target.position.set(0, 0, 0);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -16;
    dir.shadow.camera.right = 16;
    dir.shadow.camera.top = 16;
    dir.shadow.camera.bottom = -16;
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 40;
    targetScene.add(dir);
    targetScene.add(dir.target);
  });
}
