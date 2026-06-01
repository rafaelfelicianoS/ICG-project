import { SHOT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function getDistanceDifficulty(distance, tuning = SHOT) {
  const range = Math.max(0.001, tuning.farDistance - tuning.nearDistance);
  return THREE.MathUtils.clamp((distance - tuning.nearDistance) / range, 0, 1);
}

function computeAimTarget(origin, target, tuning = SHOT) {
  const aimedTarget = new THREE.Vector3(target.x, target.y, target.z);
  const toTarget = new THREE.Vector3(target.x - origin.x, 0, target.z - origin.z);
  const distance = toTarget.length();
  if (distance < 0.001) {
    return { aimedTarget, distance };
  }

  const closeAimDistance = Math.max(0.001, tuning.closeAimDistance ?? 0.001);
  const closeFactor = THREE.MathUtils.clamp(1 - distance / closeAimDistance, 0, 1);
  if (closeFactor > 0) {
    toTarget.normalize();
    aimedTarget.addScaledVector(toTarget, (tuning.closeAimBackOffset ?? 0) * closeFactor);
    aimedTarget.y += (tuning.closeAimYOffset ?? 0) * closeFactor;
  }

  const adjustedHorizontal = new THREE.Vector3(aimedTarget.x - origin.x, 0, aimedTarget.z - origin.z);
  return { aimedTarget, distance: adjustedHorizontal.length() };
}

function computeLaunchAngleRad(distance, deltaY, tuning = SHOT) {
  const difficulty = getDistanceDifficulty(distance, tuning);
  const nearAngle = tuning.nearIdealAngleDeg ?? tuning.idealAngleDeg;
  const farAngle = tuning.farIdealAngleDeg ?? tuning.idealAngleDeg;
  const minAngle = tuning.minLaunchAngleDeg ?? 35;
  const maxAngle = tuning.maxLaunchAngleDeg ?? 75;

  let angleDeg = THREE.MathUtils.clamp(THREE.MathUtils.lerp(nearAngle, farAngle, difficulty), minAngle, maxAngle);
  let angleRad = THREE.MathUtils.degToRad(angleDeg);
  let cos = Math.cos(angleRad);
  let tan = Math.tan(angleRad);
  let denominator = 2 * cos * cos * (distance * tan - deltaY);

  if (denominator <= 0.001) {
    for (let i = 1; i <= 12; i += 1) {
      const tryDeg = THREE.MathUtils.lerp(angleDeg, maxAngle, i / 12);
      const tryRad = THREE.MathUtils.degToRad(tryDeg);
      const tryCos = Math.cos(tryRad);
      const tryTan = Math.tan(tryRad);
      const tryDenominator = 2 * tryCos * tryCos * (distance * tryTan - deltaY);
      if (tryDenominator > 0.001) {
        angleDeg = tryDeg;
        angleRad = tryRad;
        break;
      }
    }
  }

  return { angleRad, angleDeg };
}

export function getShotTimingWindow(distance, tuning = SHOT) {
  const difficulty = getDistanceDifficulty(distance, tuning);
  const center = (tuning.perfectMin + tuning.perfectMax) * 0.5;
  const windowSize = THREE.MathUtils.lerp(tuning.perfectWindowNear, tuning.perfectWindowFar, difficulty);
  const half = windowSize * 0.5;
  const min = THREE.MathUtils.clamp(center - half, 0, 1);
  const max = THREE.MathUtils.clamp(center + half, 0, 1);
  return { min, max, center, difficulty };
}

export function createShotChargeState() {
  return {
    isCharging: false,
    elapsed: 0,
    power: 0,
  };
}

export function startShotCharge(state) {
  state.isCharging = true;
  state.elapsed = 0;
  state.power = 0;
}

export function updateShotCharge(state, dt) {
  if (!state.isCharging) {
    return state.power;
  }
  state.elapsed += dt;
  state.power = THREE.MathUtils.clamp(state.elapsed / SHOT.chargeDuration, 0, 1);
  return state.power;
}

export function releaseShot(state) {
  const releasedPower = state.power;
  state.isCharging = false;
  state.elapsed = 0;
  state.power = 0;
  return releasedPower;
}

export function computeShotVelocity(origin, target, power, tuning = SHOT, timingWindowOverride = null) {
  const { aimedTarget } = computeAimTarget(origin, target, tuning);
  const horizontal = new THREE.Vector3(aimedTarget.x - origin.x, 0, aimedTarget.z - origin.z);
  const distance = horizontal.length();
  if (distance < 0.001) {
    return { x: 0, y: 7.8, z: 0, isPerfect: false, speed: 7.8, idealSpeed: 7.8 };
  }

  horizontal.normalize();
  const deltaY = aimedTarget.y - origin.y;
  const g = 9.82;
  const { angleRad, angleDeg } = computeLaunchAngleRad(distance, deltaY, tuning);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const tan = Math.tan(angleRad);
  // Equação da física de projéctil resolvida para a velocidade ideal que acerta no aro
  const denominator = 2 * cos * cos * (distance * tan - deltaY);
  const safeDenominator = Math.max(0.001, denominator);
  const idealSpeed = Math.sqrt((g * distance * distance) / safeDenominator);
  const timingWindow = timingWindowOverride ?? getShotTimingWindow(distance, tuning);
  let speed = idealSpeed;
  let horizontalError = 0;
  const isPerfect = power >= timingWindow.min && power <= timingWindow.max;

  if (isPerfect) {
    horizontalError = 0; // tiro perfeito: sem desvio horizontal
  } else {
    // Quanto mais longe da janela perfeita, maior o desvio (até maxHorizontalErrorDeg)
    const center = Math.max(0.001, timingWindow.center);
    const missFactor = THREE.MathUtils.clamp(Math.abs(power - center) / center, 0, 1);
    horizontalError = THREE.MathUtils.degToRad(tuning.maxHorizontalErrorDeg) * missFactor;
    horizontalError *= Math.random() < 0.5 ? -1 : 1; // desvio aleatório para esquerda ou direita
    // Variação de velocidade para não-perfeitos: ±4% consoante o miss.
    // Power abaixo da janela → bola cai curta; acima → bola passa por cima.
    const signedMiss = power < timingWindow.center ? -1 : 1;
    speed = idealSpeed * (1 + signedMiss * missFactor * 0.04);
  }

  // Rodar o vector horizontal pelo erro — aplica o desvio lateral
  horizontal.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalError);

  return {
    x: horizontal.x * cos * speed,
    y: sin * speed,
    z: horizontal.z * cos * speed,
    isPerfect,
    speed,
    idealSpeed,
    angleDeg,
    timingWindow,
  };
}
