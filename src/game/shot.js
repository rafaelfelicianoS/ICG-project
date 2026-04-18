import { SHOT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
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

export function computeShotVelocity(origin, target, power, tuning = SHOT) {
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

  let speed = idealSpeed;
  let horizontalError = 0;
  const isPerfect = power >= tuning.perfectMin && power <= tuning.perfectMax;

  if (isPerfect) {
    speed = idealSpeed * (1 + randomBetween(-0.01, 0.01));
  } else {
    speed = idealSpeed * (0.85 + power * 0.3);
    const center = (tuning.perfectMin + tuning.perfectMax) * 0.5;
    const range = center <= 0 ? 1 : center;
    const missFactor = THREE.MathUtils.clamp(Math.abs(power - center) / range, 0, 1);
    horizontalError = THREE.MathUtils.degToRad(tuning.maxHorizontalErrorDeg) * missFactor;
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
  };
}
