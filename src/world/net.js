import { THREE } from "../core/deps.js";

function createPoint(position, pinned) {
  return {
    position: position.clone(),
    previous: position.clone(),
    rest: position.clone(),
    pinned,
  };
}

function satisfyDistance(pointA, pointB, targetDistance, stiffness = 1) {
  const delta = new THREE.Vector3().subVectors(pointB.position, pointA.position);
  const currentDistance = delta.length();
  if (currentDistance <= 0.00001) {
    return;
  }

  const correction = (1 - targetDistance / currentDistance) * stiffness;

  if (!pointA.pinned && !pointB.pinned) {
    delta.multiplyScalar(0.5 * correction);
    pointA.position.add(delta);
    pointB.position.sub(delta);
    return;
  }

  if (!pointA.pinned) {
    pointA.position.add(delta.multiplyScalar(correction));
    return;
  }

  if (!pointB.pinned) {
    pointB.position.sub(delta.multiplyScalar(correction));
  }
}

function fillStrandAttribute(attributeArray, points, strandIndex) {
  let pointer = 0;
  for (let ring = 0; ring < points.length; ring += 1) {
    const point = points[ring][strandIndex].position;
    attributeArray[pointer] = point.x;
    attributeArray[pointer + 1] = point.y;
    attributeArray[pointer + 2] = point.z;
    pointer += 3;
  }
}

function fillRingAttribute(attributeArray, ringPoints) {
  let pointer = 0;
  for (let i = 0; i <= ringPoints.length; i += 1) {
    const point = ringPoints[i % ringPoints.length].position;
    attributeArray[pointer] = point.x;
    attributeArray[pointer + 1] = point.y;
    attributeArray[pointer + 2] = point.z;
    pointer += 3;
  }
}

// Rede simulada com Verlet Integration — sistema de pontos ligados por restrições de distância
// Não usa o Cannon.js: é uma simulação de tecido feita de raiz
export function createHoopNet(rimCenter, rimRadius) {
  const netGroup = new THREE.Group();
  const strandCount = 18; // fios verticais à volta do aro
  const ringCount = 10;   // anéis horizontais do topo até à base
  const netHeight = 0.72;
  const topYOffset = -0.02;
  const topRadius = rimRadius * 0.84;
  const bottomRadius = rimRadius * 0.62;
  const ringSpacing = netHeight / (ringCount - 1);
  const ropeRadius = 0.028;
  const tempSegment = new THREE.Vector3();
  const tempToBall = new THREE.Vector3();
  const tempClosest = new THREE.Vector3();
  const center = new THREE.Vector3(rimCenter.x, rimCenter.y - netHeight * 0.5, rimCenter.z);

  const points = [];
  for (let ring = 0; ring < ringCount; ring += 1) {
    const ringPoints = [];
    const ringAlpha = ring / (ringCount - 1);
    const radius = THREE.MathUtils.lerp(topRadius, bottomRadius, ringAlpha);
    for (let strand = 0; strand < strandCount; strand += 1) {
      const theta = (strand / strandCount) * Math.PI * 2 + ringAlpha * 0.08;
      const position = new THREE.Vector3(
        rimCenter.x + Math.cos(theta) * radius,
        rimCenter.y + topYOffset - ring * ringSpacing,
        rimCenter.z + Math.sin(theta) * radius
      );
      ringPoints.push(createPoint(position, ring === 0));
    }
    points.push(ringPoints);
  }

  const strandMaterial = new THREE.LineBasicMaterial({
    color: 0xf8fbff,
    transparent: true,
    opacity: 0.92,
  });
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0xe8f1ff,
    transparent: true,
    opacity: 0.65,
  });

  const strandLines = [];
  for (let strand = 0; strand < strandCount; strand += 1) {
    const strandPositions = new Float32Array(ringCount * 3);
    fillStrandAttribute(strandPositions, points, strand);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(strandPositions, 3));
    const line = new THREE.Line(geometry, strandMaterial);
    netGroup.add(line);
    strandLines.push(line);
  }

  const ringLines = [];
  for (let ring = 1; ring < ringCount; ring += 2) {
    const ringPositions = new Float32Array((strandCount + 1) * 3);
    fillRingAttribute(ringPositions, points[ring]);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(ringPositions, 3));
    const line = new THREE.Line(geometry, ringMaterial);
    netGroup.add(line);
    ringLines.push({ ring, line });
  }

  const constraintIterations = 4;
  const gravity = 7.4;
  const drag = 0.992;
  const simulateStep = 1 / 90;
  const verticalStiffness = 0.58;
  const ringStiffness = 0.36;
  const diagonalStiffness = 0.26;
  const restPull = 0.002;

  function pinTopRing() {
    for (let strand = 0; strand < strandCount; strand += 1) {
      const point = points[0][strand];
      point.position.copy(point.rest);
      point.previous.copy(point.rest);
    }
  }

  function solveConstraints() {
    for (let ring = 0; ring < ringCount; ring += 1) {
      for (let strand = 0; strand < strandCount; strand += 1) {
        if (ring + 1 < ringCount) {
          const pointA = points[ring][strand];
          const pointB = points[ring + 1][strand];
          const distance = pointA.rest.distanceTo(pointB.rest);
          satisfyDistance(pointA, pointB, distance, verticalStiffness);
        }

        const nextStrand = (strand + 1) % strandCount;
        const ringPointA = points[ring][strand];
        const ringPointB = points[ring][nextStrand];
        const ringDistance = ringPointA.rest.distanceTo(ringPointB.rest);
        satisfyDistance(ringPointA, ringPointB, ringDistance, ringStiffness);

        if (ring + 1 < ringCount) {
          const diagA = points[ring][strand];
          const diagB = points[ring + 1][nextStrand];
          const diagDistanceA = diagA.rest.distanceTo(diagB.rest);
          satisfyDistance(diagA, diagB, diagDistanceA, diagonalStiffness);

          const prevStrand = (strand - 1 + strandCount) % strandCount;
          const diagC = points[ring][strand];
          const diagD = points[ring + 1][prevStrand];
          const diagDistanceB = diagC.rest.distanceTo(diagD.rest);
          satisfyDistance(diagC, diagD, diagDistanceB, diagonalStiffness);
        }
      }
    }
  }

  function integrate(stepDelta) {
    const stepSq = stepDelta * stepDelta;
    for (let ring = 1; ring < ringCount; ring += 1) { // anel 0 está pregado, começa no 1
      for (let strand = 0; strand < strandCount; strand += 1) {
        const point = points[ring][strand];
        if (point.pinned) {
          continue;
        }

        // Velocidade implícita do Verlet: diferença entre posição actual e anterior
        const vx = (point.position.x - point.previous.x) * drag;
        const vy = (point.position.y - point.previous.y) * drag;
        const vz = (point.position.z - point.previous.z) * drag;

        point.previous.copy(point.position);
        // Nova posição = actual + velocidade - gravidade (integração de Verlet)
        point.position.x += vx;
        point.position.y += vy - gravity * stepSq;
        point.position.z += vz;

        // restPull: atrai levemente o ponto à posição de repouso → rede amorte naturalmente
        point.position.lerp(point.rest, restPull);
      }
    }
  }

  function syncLines() {
    for (let strand = 0; strand < strandCount; strand += 1) {
      const attribute = strandLines[strand].geometry.attributes.position;
      fillStrandAttribute(attribute.array, points, strand);
      attribute.needsUpdate = true;
    }

    for (const ringEntry of ringLines) {
      const attribute = ringEntry.line.geometry.attributes.position;
      fillRingAttribute(attribute.array, points[ringEntry.ring]);
      attribute.needsUpdate = true;
    }
  }

  function update(delta) {
    const total = Math.min(delta, 1 / 18);
    let accumulator = total;
    while (accumulator > 0) {
      const stepDelta = Math.min(accumulator, simulateStep);
      integrate(stepDelta);
      for (let i = 0; i < constraintIterations; i += 1) {
        pinTopRing();
        solveConstraints();
      }
      accumulator -= stepDelta;
    }
    syncLines();
  }

  // Perturbar a rede externamente (ex: bola bate no aro → rede ondula)
  // Aplica impulso radial+descendente a pontos dentro do raio de influência
  function disturb(worldPosition, strength = 0.1) {
    const radius = rimRadius * 1.8;
    const radial = new THREE.Vector3();
    const impulse = new THREE.Vector3();
    const rimCenterVec = new THREE.Vector3(rimCenter.x, rimCenter.y, rimCenter.z);

    for (let ring = 1; ring < ringCount; ring += 1) {
      for (let strand = 0; strand < strandCount; strand += 1) {
        const point = points[ring][strand];
        const distance = point.position.distanceTo(worldPosition);
        if (distance > radius) {
          continue;
        }

        // Falloff: pontos mais longe recebem impulso menor
        const falloff = 1 - distance / radius;
        radial.copy(point.position).sub(rimCenterVec);
        radial.y = 0;
        if (radial.lengthSq() < 0.0001) {
          radial.set(Math.cos(strand), 0, Math.sin(strand));
        } else {
          radial.normalize();
        }

        // Impulso para fora + para baixo — empurra a rede radialmente e faz cair
        impulse.copy(radial).multiplyScalar(strength * (0.3 + falloff * 0.8));
        impulse.y -= strength * (0.35 + falloff * 1.1);
        // Modificar previous em vez de position → o Verlet vai calcular a velocidade correcta
        point.previous.sub(impulse);
      }
    }
  }

  function collideSegment(pointA, pointB, ballPosition, collisionRadius, velocity, delta) {
    tempSegment.subVectors(pointB.position, pointA.position);
    const segmentLengthSq = tempSegment.lengthSq();
    if (segmentLengthSq < 0.000001) {
      return 0;
    }

    tempToBall.subVectors(ballPosition, pointA.position);
    const t = THREE.MathUtils.clamp(tempToBall.dot(tempSegment) / segmentLengthSq, 0, 1);
    tempClosest.copy(pointA.position).addScaledVector(tempSegment, t);

    tempToBall.subVectors(ballPosition, tempClosest);
    let dist = tempToBall.length();
    if (dist < 0.0001) {
      tempToBall.subVectors(ballPosition, center);
      tempToBall.y = 0;
      if (tempToBall.lengthSq() < 0.0001) {
        tempToBall.set(1, 0, 0);
      } else {
        tempToBall.normalize();
      }
      dist = 0.0001;
    }

    if (dist >= collisionRadius) {
      return 0;
    }

    const penetration = collisionRadius - dist;
    tempToBall.normalize();
    ballPosition.addScaledVector(tempToBall, penetration * 0.86);

    const vn = velocity.dot(tempToBall);
    if (vn < 0) {
      velocity.addScaledVector(tempToBall, -vn * (0.38 + delta * 6));
    }

    const ropeImpulse = penetration * (0.24 + Math.min(0.22, Math.abs(vn) * 0.12));
    pointA.previous.addScaledVector(tempToBall, -ropeImpulse);
    pointB.previous.addScaledVector(tempToBall, -ropeImpulse);
    return penetration;
  }

  function collideBall(ballPosition, ballRadius, velocity, delta) {
    const collisionRadius = ballRadius + ropeRadius;
    let totalPenetration = 0;
    let hits = 0;

    for (let ring = 0; ring < ringCount - 1; ring += 1) {
      for (let strand = 0; strand < strandCount; strand += 1) {
        const next = (strand + 1) % strandCount;

        const verticalHit = collideSegment(
          points[ring][strand],
          points[ring + 1][strand],
          ballPosition,
          collisionRadius,
          velocity,
          delta
        );
        if (verticalHit > 0) {
          totalPenetration += verticalHit;
          hits += 1;
        }

        const ringHit = collideSegment(
          points[ring][strand],
          points[ring][next],
          ballPosition,
          collisionRadius,
          velocity,
          delta
        );
        if (ringHit > 0) {
          totalPenetration += ringHit;
          hits += 1;
        }
      }
    }

    if (hits > 0) {
      const strength = THREE.MathUtils.clamp(totalPenetration * 0.45, 0.03, 0.22);
      disturb(ballPosition, strength);
      return true;
    }
    return false;
  }

  return {
    group: netGroup,
    update,
    disturb,
    collideBall,
  };
}
