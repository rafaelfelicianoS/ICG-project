/**
 * passTargets.js — Alvos de passe no cenário
 *
 * Cria 4 discos coloridos no chão em posições fixas do court.
 * O jogador pode passar a bola (tecla F) para o alvo mais próximo
 * à sua frente. Deteção: a bola aterra a menos de PASS_TARGET_RADIUS
 * do centro do alvo.
 *
 * Totalmente procedural — sem assets externos.
 */

import { THREE } from "../core/deps.js";

export const PASS_TARGET_RADIUS = 1.0; // metros — raio de deteção de passe bem-sucedido

// Posições dos 4 alvos (XZ no chão, y=0.02 para ficarem sobre o pavimento)
const TARGET_POSITIONS = [
  new THREE.Vector3( 4, 0.02,  5),
  new THREE.Vector3(-4, 0.02,  5),
  new THREE.Vector3( 4, 0.02, -5),
  new THREE.Vector3(-4, 0.02, -5),
];

const TARGET_COLOR   = 0x49d17c; // verde brilhante
const TARGET_RADIUS  = 0.6;      // raio visual do disco
const TARGET_OPACITY = 0.72;

export function createPassTargets(scene) {
  const targets = [];

  TARGET_POSITIONS.forEach((pos) => {
    // Disco no chão
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(TARGET_RADIUS, 32),
      new THREE.MeshStandardMaterial({
        color: TARGET_COLOR,
        transparent: true,
        opacity: TARGET_OPACITY,
        roughness: 0.6,
        depthWrite: false,
      })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.copy(pos);
    disc.receiveShadow = true;
    scene.add(disc);

    // Anel exterior para destacar o alvo
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(TARGET_RADIUS, TARGET_RADIUS + 0.07, 32),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos);
    ring.position.y += 0.01;
    scene.add(ring);

    targets.push({ disc, ring, position: pos.clone() });
  });

  /**
   * Encontra o alvo mais próximo que esteja "à frente" do jogador.
   * playerPos: THREE.Vector3, playerYaw: número em radianos.
   * Devolve o alvo ou null se nenhum estiver na frente (produto escalar > 0).
   */
  function findBestTarget(playerPos, playerYaw) {
    const forwardX = -Math.sin(playerYaw);
    const forwardZ = -Math.cos(playerYaw);

    let best = null;
    let bestDist = Infinity;

    for (const t of targets) {
      const dx = t.position.x - playerPos.x;
      const dz = t.position.z - playerPos.z;
      const dot = dx * forwardX + dz * forwardZ;
      if (dot <= 0) continue; // atrás do jogador — ignorar

      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    return best;
  }

  /**
   * Pisca o alvo quando a bola aterra nele.
   */
  function flashTarget(target) {
    if (!target) return;
    target.disc.material.opacity = 1.0;
    window.setTimeout(() => {
      target.disc.material.opacity = TARGET_OPACITY;
    }, 300);
  }

  /**
   * Verifica se a bola acertou num alvo (chamado no loop principal).
   * Devolve o alvo atingido ou null.
   * prevBallY: y anterior, currBallY: y atual (deteção de aterragem).
   */
  function checkPassLanding(ballPosition, prevBallY) {
    // A bola só conta quando desce e cruza o plano y ~ 0.18 (raio da bola)
    if (prevBallY < 0.3 || ballPosition.y > 0.3) return null;

    for (const t of targets) {
      const dx = ballPosition.x - t.position.x;
      const dz = ballPosition.z - t.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist <= PASS_TARGET_RADIUS) {
        return t;
      }
    }
    return null;
  }

  return { targets, findBestTarget, flashTarget, checkPassLanding };
}
