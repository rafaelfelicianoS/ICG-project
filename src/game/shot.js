import { SHOT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function getDistanceDifficulty(distance, tuning = SHOT) {
  const range = Math.max(0.001, tuning.farDistance - tuning.nearDistance);
  return THREE.MathUtils.clamp((distance - tuning.nearDistance) / range, 0, 1);
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
  const horizontal = new THREE.Vector3(target.x - origin.x, 0, target.z - origin.z);
  const distance = horizontal.length();
  if (distance < 0.001) {
    return { x: 0, y: 7.8, z: 0, isPerfect: false, speed: 7.8, idealSpeed: 7.8 };
  }

  horizontal.normalize();
  const deltaY = target.y - origin.y;
  const g = 9.82;
  const angleRad = THREE.MathUtils.degToRad(tuning.idealAngleDeg);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const tan = Math.tan(angleRad);
  const denominator = 2 * cos * cos * (distance * tan - deltaY);
  const safeDenominator = Math.max(0.001, denominator);
  const idealSpeed = Math.sqrt((g * distance * distance) / safeDenominator);
  const timingWindow = timingWindowOverride ?? getShotTimingWindow(distance, tuning);
  const speed = idealSpeed;
  let horizontalError = 0;
  const isPerfect = power >= timingWindow.min && power <= timingWindow.max;
  const range = Math.max(0.001, Math.max(timingWindow.center, 1 - timingWindow.center));
  const maxErrorDeg = THREE.MathUtils.lerp(
    tuning.maxHorizontalErrorNearDeg,
    tuning.maxHorizontalErrorFarDeg,
    timingWindow.difficulty
  );

  if (isPerfect) {
    horizontalError = 0;
  } else {
    const missFactor = THREE.MathUtils.clamp(Math.abs(power - timingWindow.center) / range, 0, 1);
    horizontalError = THREE.MathUtils.degToRad(maxErrorDeg) * missFactor;
    horizontalError *= Math.random() < 0.5 ? -1 : 1;
  }

  horizontal.applyAxisAngle(new THREE.Vector3(0, 1, 0), horizontalError);

  return {
    x: horizontal.x * cos * speed,
    y: sin * speed,
    z: horizontal.z * cos * speed,
    isPerfect,
    speed,
    idealSpeed,
    timingWindow,
  };
}
