import { BALL, COURT } from "../core/constants.js";

/**
 * Deteta se a bola cruzou o plano do aro de cima para baixo.
 *
 * Em vez de usar a posição do frame atual (que pode já estar abaixo do aro),
 * interpola linearmente o ponto exato onde a bola cruzou o plano y = rimCenter.y
 * e testa a distância XZ a partir desse ponto.
 * Isto evita falsos negativos em bolas rápidas ou rebates de tabuleiro.
 *
 * isPerfect: quando true, aplica um bónus de 15% no raio efetivo —
 * tiros com timing perfeito têm mais margem para entrar.
 *
 * Devolve { scored, crossPoint }.
 * crossPoint é um objeto {x, y, z} se houve cruzamento, null caso contrário.
 */
export function detectBasketScore(prevBallPos, currBallPos, rimCenter, rimRadius, ballRadius = BALL.radius, isPerfect = false, guaranteedShot = false) {
  // Detecta se a bola cruzou o plano horizontal do aro de cima para baixo neste frame
  const crossedDownward = prevBallPos.y > rimCenter.y && currBallPos.y <= rimCenter.y;

  // Step Back skill: tiro garantido — entra sempre que cruze o plano do aro
  if (guaranteedShot && crossedDownward) {
    const dy = currBallPos.y - prevBallPos.y;
    const t = Math.abs(dy) > 0.0001 ? (rimCenter.y - prevBallPos.y) / dy : 0;
    const crossX = prevBallPos.x + (currBallPos.x - prevBallPos.x) * t;
    const crossZ = prevBallPos.z + (currBallPos.z - prevBallPos.z) * t;
    return { scored: true, crossPoint: { x: crossX, y: rimCenter.y, z: crossZ }, distXZ: 0, effectiveRadius: rimRadius };
  }

  if (!crossedDownward) {
    return { scored: false, crossPoint: null };
  }

  // Interpolar o ponto exacto do cruzamento entre frames — evita falhar bolas rápidas
  // t: fracção do frame em que a bola estava exactamente à altura do aro
  const dy = currBallPos.y - prevBallPos.y;
  const t = Math.abs(dy) > 0.0001 ? (rimCenter.y - prevBallPos.y) / dy : 0;

  // Posição XZ exacta quando a bola passou pelo plano do aro
  const crossX = prevBallPos.x + (currBallPos.x - prevBallPos.x) * t;
  const crossZ = prevBallPos.z + (currBallPos.z - prevBallPos.z) * t;
  const crossPoint = { x: crossX, y: rimCenter.y, z: crossZ };

  // Distância do ponto de cruzamento ao centro do aro — determina se entrou
  const dx = crossX - rimCenter.x;
  const dz = crossZ - rimCenter.z;
  const distXZ = Math.sqrt(dx * dx + dz * dz);

  // Tiros perfeitos têm bónus de 15% no raio efetivo (mais perdoador)
  const perfectBonus = isPerfect ? 1.15 : 1.0;
  const effectiveRadius = (rimRadius - ballRadius * 0.35) * perfectBonus;

  return { scored: distXZ <= effectiveRadius, crossPoint, distXZ, effectiveRadius };
}

export function classifyShotValue(shotXZ, hoopXZ) {
  const dx = shotXZ.x - hoopXZ.x;
  const dz = shotXZ.y - hoopXZ.y;
  const distance = Math.sqrt(dx * dx + dz * dz);
  return distance > COURT.threePointRadius ? 3 : 2;
}
