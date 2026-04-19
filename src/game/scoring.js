import { BALL, COURT } from "../core/constants.js";

export function detectBasketScore(prevBallPos, currBallPos, rimCenter, rimRadius, ballRadius = BALL.radius) {
  const crossedDownward = prevBallPos.y > rimCenter.y && currBallPos.y <= rimCenter.y;
  if (!crossedDownward) {
    return false;
  }
  const dx = currBallPos.x - rimCenter.x;
  const dz = currBallPos.z - rimCenter.z;
  const distanceXZ = Math.sqrt(dx * dx + dz * dz);
  const effectiveRadius = rimRadius - ballRadius * 0.35;
  return distanceXZ <= effectiveRadius;
}

export function classifyShotValue(shotXZ, hoopXZ) {
  const dx = shotXZ.x - hoopXZ.x;
  const dz = shotXZ.y - hoopXZ.y;
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance > COURT.threePointRadius ? 3 : 2;
}
