export const COURT = {
  length: 28,
  width: 15,
  halfLength: 14,
  halfWidth: 7.5,
  lineWidth: 0.05,
  centerCircleRadius: 1.8,
  paintWidth: 4.9,
  paintDepth: 5.8,
  freeThrowDistanceFromBaseline: 4.6,
  threePointRadius: 6.75,
  hoopHeight: 3.05,
  rimRadius: 0.34,
  rimTubeRadius: 0.03,
  backboardWidth: 1.83,
  backboardHeight: 1.07,
  backboardDepth: 0.05,
  backboardOffsetFromBaseline: 1.22,
  backboardCenterHeight: 3.43,
  hoopOffsetFromBackboard: 0.15,
  wallHeight: 8,
};

export const PLAYER = {
  moveSpeed: 5,
  rotationSpeed: 2,
  radius: 0.45,
  followOffset: { x: 0, y: 3.2, z: -5.5 },
};

export const BALL = {
  radius: 0.18,
  mass: 0.6,
  linearDamping: 0.02,
  angularDamping: 0.3,
  dribbleMinY: 0.18,
  dribbleMaxY: 0.9,
  dribbleBaseFrequency: 1.5,
  dribbleMoveFrequency: 2,
  recoverSpeedThreshold: 0.5,
  autoRecoverTimeout: 8,
};

export const PHYSICS = {
  gravity: -9.82,
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
  rimSegments: 12,
  rimSegmentRadius: 0.03,
};

export const SHOT = {
  chargeDuration: 1.2,
  perfectMin: 0.75,
  perfectMax: 0.88,
  idealAngleDeg: 50,
  maxHorizontalErrorDeg: 3,
  nearDistance: 3,
  farDistance: 8.5,
  perfectWindowNear: 0.17,
  perfectWindowFar: 0.06,
  maxHorizontalErrorNearDeg: 2.2,
  maxHorizontalErrorFarDeg: 6.2,
  idealSpeedBoostNear: 1.03,
  idealSpeedBoostFar: 1.0,
};

export const PLAYER_STATES = Object.freeze({
  IDLE: "IDLE",
  MOVING: "MOVING",
  DRIBBLING: "DRIBBLING",
  SHOOTING: "SHOOTING",
  CELEBRATING: "CELEBRATING",
});

export function getBackboardZ(sign) {
  return sign * (COURT.halfLength - COURT.backboardOffsetFromBaseline);
}

export function getRimCenter(sign) {
  return {
    x: 0,
    y: COURT.hoopHeight,
    z: getBackboardZ(sign) - sign * COURT.hoopOffsetFromBackboard,
  };
}
