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
  rimRadius: 0.4,
  rimTubeRadius: 0.035,
  backboardWidth: 1.83,
  backboardHeight: 1.07,
  backboardDepth: 0.05,
  backboardOffsetFromBaseline: 1.22,
  backboardCenterHeight: 3.43,
  hoopOffsetFromBackboard: 0.4,
  wallHeight: 8,
};

export const PLAYER = {
  moveSpeed: 5,
  rotationSpeed: 2,
  radius: 0.45,
  followOffset: { x: 0, y: 3.2, z: -5.5 },
};

export const CAM = {
  offsetX: 0,
  offsetY: 3.2,
  offsetZ: 5.5,
  orbitSensitivity: 0.003,
  lerpSpeed: 8,
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
  autoRecoverTimeout: 3,
};

export const PHYSICS = {
  gravity: -9.82,
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
  rimSegments: 12,
  rimSegmentRadius: 0.035,
};

export const SHOT = {
  chargeDuration: 1.2,
  perfectMin: 0.75,
  perfectMax: 0.88,
  idealAngleDeg: 50,
  nearIdealAngleDeg: 60,
  farIdealAngleDeg: 47,
  minLaunchAngleDeg: 38,
  maxLaunchAngleDeg: 74,
  closeAimDistance: 3.2,
  closeAimBackOffset: 0.28,
  closeAimYOffset: 0.12,
  maxHorizontalErrorDeg: 1.5,
  nearDistance: 3,
  farDistance: 8.5,
  perfectWindowNear: 0.22,
  perfectWindowFar: 0.10,
  maxHorizontalErrorNearDeg: 2.2,
  maxHorizontalErrorFarDeg: 6.2,
  shootReleaseNormalized: 0.35,
  faceHoopSpeed: 12, // rad/s — how fast player rotates to face hoop on shot charge
};

export const PLAYER_STATES = Object.freeze({
  IDLE: "IDLE",
  MOVING: "MOVING",
  DRIBBLING: "DRIBBLING",
  SHOOTING: "SHOOTING",
  CELEBRATING: "CELEBRATING",
  STEP_BACK: "STEP_BACK",
  ANKLE_BREAKER: "ANKLE_BREAKER",
});

// Modos de jogo disponíveis
export const GAME_MODES = Object.freeze({
  FREE_PLAY: "FREE_PLAY",       // Jogo livre sem limite
  FREE_THROW: "FREE_THROW",     // 10 lances livres, jogador fixo na linha
  THREE_POINT_CONTEST: "THREE_POINT_CONTEST", // Concurso de 3 Pontos: 5 estações × 5 bolas
});

// Posições das 5 estações do Concurso de 3 Pontos (raio 7m do aro sul, x=0 z=-12.38)
export const THREE_POINT_CONTEST_STATIONS = [
  { name: "Canto Esquerdo", x: -6.76, z: -10.57, yaw: 1.833 },
  { name: "Ala Esquerda",   x: -4.95, z: -7.43,  yaw: 2.356 },
  { name: "Topo",           x:  0,    z: -5.38,  yaw: Math.PI },
  { name: "Ala Direita",    x:  4.95, z: -7.43,  yaw: -2.356 },
  { name: "Canto Direito",  x:  6.76, z: -10.57, yaw: -1.833 },
];

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

// ─── Skill constants ──────────────────────────────────────────────────────────
export const SKILLS = {
  stepBackCooldown: 4.0,   // seconds cooldown after Step Back
  stepBackTpDist:   2.5,   // metres player teleports backward
  ankleCooldown:    3.0,   // seconds cooldown after Ankle Breaker
  ankleFakeDist:    0.8,   // metres left (fake phase)
  ankleCrossDist:   1.2,   // metres right (crossover phase)
  spinMoveCooldown:    3.5,   // seconds cooldown after Spin Move
  spinMoveDist:        1.8,   // metres forward
  spinMoveLightColor:  0x9933ff, // purple point light colour
};
