import { COURT, getBackboardZ, getRimCenter } from "../core/constants.js";
import { THREE } from "../core/deps.js";
import { createHoopNet } from "./net.js";
import { createNPCs } from "./npcs.js";
import { createPark } from "./park.js";

const sideLineX = COURT.halfWidth - 0.9;

function toRgbHex(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

function isInsideThreePointArea(x, z, rimCenter) {
  const dx = x - rimCenter.x;
  const dz = z - rimCenter.z;
  const radiusSq = COURT.threePointRadius * COURT.threePointRadius;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq <= radiusSq) {
    return true;
  }

  const arcDelta = Math.sqrt(Math.max(0.001, radiusSq - sideLineX * sideLineX));
  const sign = Math.sign(rimCenter.z);
  const arcTouchZ = rimCenter.z - sign * arcDelta;

  if (Math.abs(x) <= sideLineX) {
    if (sign > 0) {
      return z >= arcTouchZ;
    }
    return z <= arcTouchZ;
  }

  return false;
}

function createParkSurfaceTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  const data = image.data;

  const redZone = toRgbHex(0xc0392b);
  const greenZone = toRgbHex(0x1e8449);
  const hoops = [getRimCenter(1), getRimCenter(-1)];

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const u = px / (size - 1);
      const v = py / (size - 1);
      const worldX = (u - 0.5) * COURT.width;
      const worldZ = (0.5 - v) * COURT.length;

      let inside = false;
      for (const hoop of hoops) {
        if (isInsideThreePointArea(worldX, worldZ, hoop)) {
          inside = true;
          break;
        }
      }

      const base = inside ? redZone : greenZone;
      const noise = (((px * 13 + py * 7) % 17) - 8) * 1.4;
      const index = (py * size + px) * 4;
      data[index] = Math.max(0, Math.min(255, base.r + noise));
      data[index + 1] = Math.max(0, Math.min(255, base.g + noise));
      data[index + 2] = Math.max(0, Math.min(255, base.b + noise));
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function createLinesTexture() {
  const sizeX = 2048;
  const sizeY = Math.round(sizeX * (COURT.length / COURT.width));
  const canvas = document.createElement("canvas");
  canvas.width = sizeX;
  canvas.height = sizeY;
  const ctx = canvas.getContext("2d");

  const mapX = (x) => ((x + COURT.halfWidth) / COURT.width) * sizeX;
  const mapY = (z) => ((COURT.halfLength - z) / COURT.length) * sizeY;
  const radiusToPx = (radius) => (radius / COURT.width) * sizeX;
  const linePx = Math.max(2, (COURT.lineWidth / COURT.width) * sizeX);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = linePx;
  ctx.lineCap = "round";

  ctx.strokeRect(0, 0, sizeX, sizeY);

  ctx.beginPath();
  ctx.moveTo(0, mapY(0));
  ctx.lineTo(sizeX, mapY(0));
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mapX(0), mapY(0), radiusToPx(COURT.centerCircleRadius), 0, Math.PI * 2);
  ctx.stroke();

  const paintHalfWidth = COURT.paintWidth * 0.5;

  [1, -1].forEach((sign) => {
    const baselineZ = sign * COURT.halfLength;
    const freeThrowZ = sign * (COURT.halfLength - COURT.freeThrowDistanceFromBaseline);
    const paintEndZ = sign * (COURT.halfLength - COURT.paintDepth);
    const rim = getRimCenter(sign);
    const rimZ = rim.z;
    const arcTouchZ =
      rimZ - sign * Math.sqrt(Math.max(0, COURT.threePointRadius ** 2 - sideLineX ** 2));

    ctx.strokeRect(
      mapX(-paintHalfWidth),
      Math.min(mapY(baselineZ), mapY(paintEndZ)),
      mapX(paintHalfWidth) - mapX(-paintHalfWidth),
      Math.abs(mapY(baselineZ) - mapY(paintEndZ))
    );

    ctx.beginPath();
    ctx.moveTo(mapX(-paintHalfWidth), mapY(freeThrowZ));
    ctx.lineTo(mapX(paintHalfWidth), mapY(freeThrowZ));
    ctx.stroke();

    ctx.beginPath();
    if (sign > 0) {
      ctx.arc(mapX(rim.x), mapY(rim.z), radiusToPx(COURT.threePointRadius), Math.PI, Math.PI * 2);
    } else {
      ctx.arc(mapX(rim.x), mapY(rim.z), radiusToPx(COURT.threePointRadius), 0, Math.PI);
    }
    ctx.stroke();

    const lineStart = mapY(sign * COURT.halfLength);
    const lineEnd = mapY(arcTouchZ);

    ctx.beginPath();
    ctx.moveTo(mapX(-sideLineX), Math.min(lineStart, lineEnd));
    ctx.lineTo(mapX(-sideLineX), Math.max(lineStart, lineEnd));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mapX(sideLineX), Math.min(lineStart, lineEnd));
    ctx.lineTo(mapX(sideLineX), Math.max(lineStart, lineEnd));
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function createHoopGroup(sign) {
  const hoop = new THREE.Group();
  const rimCenter = getRimCenter(sign);
  const backboardZ = getBackboardZ(sign);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(COURT.backboardWidth, COURT.backboardHeight, COURT.backboardDepth),
    new THREE.MeshStandardMaterial({
      color: 0xf2f4f8,
      metalness: 0.15,
      roughness: 0.52,
      transparent: true,
      opacity: 0.93,
    })
  );
  board.position.set(0, COURT.backboardCenterHeight, backboardZ);
  board.castShadow = true;
  board.receiveShadow = true;
  hoop.add(board);

  const boardMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.45, COURT.backboardDepth + 0.002),
    new THREE.MeshStandardMaterial({ color: 0x4d5d6f })
  );
  boardMark.position.set(0, COURT.hoopHeight + 0.2, backboardZ - sign * 0.005);
  hoop.add(boardMark);

  const postZ = backboardZ + sign * 1.05;
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 3.4, 18),
    new THREE.MeshStandardMaterial({ color: 0x8e9aaf, metalness: 0.4, roughness: 0.42 })
  );
  post.position.set(0, 1.7, postZ);
  post.castShadow = true;
  post.receiveShadow = true;
  hoop.add(post);

  const armLength = Math.abs(postZ - backboardZ) - COURT.backboardDepth * 0.5;
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.16, armLength),
    new THREE.MeshStandardMaterial({ color: 0x96a3b7, metalness: 0.4, roughness: 0.42 })
  );
  arm.position.set(0, 3.25, (postZ + backboardZ) * 0.5);
  arm.castShadow = true;
  arm.receiveShadow = true;
  hoop.add(arm);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(COURT.rimRadius, COURT.rimTubeRadius, 18, 48),
    new THREE.MeshStandardMaterial({ color: 0xdf4d2a, metalness: 0.25, roughness: 0.45 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.set(rimCenter.x, rimCenter.y, rimCenter.z);
  rim.castShadow = true;
  hoop.add(rim);

  const net = createHoopNet(rimCenter, COURT.rimRadius);
  hoop.add(net.group);

  return {
    group: hoop,
    id: sign > 0 ? "north-hoop" : "south-hoop",
    side: sign > 0 ? "north" : "south",
    rimCenter: new THREE.Vector3(rimCenter.x, rimCenter.y, rimCenter.z),
    backboardCenter: new THREE.Vector3(0, COURT.backboardCenterHeight, backboardZ),
    lockOnTarget: new THREE.Vector3(
      0,
      COURT.hoopHeight + 0.2,
      backboardZ - sign * (COURT.backboardDepth * 0.5 + 0.01)
    ),
    net,
  };
}

function createLightPoles(group) {
  const poles = [];
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x606976, roughness: 0.55, metalness: 0.35 });
  const headMaterial = new THREE.MeshStandardMaterial({
    color: 0xced6e0,
    roughness: 0.42,
    metalness: 0.38,
    emissive: 0x1a1f25,
    emissiveIntensity: 0.4,
  });

  const corners = [
    new THREE.Vector3(COURT.halfWidth + 2.6, 0, COURT.halfLength + 2.6),
    new THREE.Vector3(-COURT.halfWidth - 2.6, 0, COURT.halfLength + 2.6),
    new THREE.Vector3(COURT.halfWidth + 2.6, 0, -COURT.halfLength - 2.6),
    new THREE.Vector3(-COURT.halfWidth - 2.6, 0, -COURT.halfLength - 2.6),
  ];

  corners.forEach((corner) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8, 12), poleMaterial);
    pole.position.set(corner.x, 4, corner.z);
    pole.castShadow = true;
    group.add(pole);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.36), headMaterial);
    head.position.set(corner.x, 8.1, corner.z);
    head.lookAt(0, 1.5, 0);
    head.rotation.x += 0.2;
    group.add(head);

    poles.push({
      position: new THREE.Vector3(corner.x, 8.1, corner.z),
      target: new THREE.Vector3(corner.x * 0.2, 0.2, corner.z * 0.2),
      head,
    });
  });

  return poles;
}

export function createCourt(scene) {
  const group = new THREE.Group();
  group.name = "court-root";

  const park = createPark(group);
  const npcs = createNPCs(group);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshStandardMaterial({
      map: createParkSurfaceTexture(),
      roughness: 0.82,
      metalness: 0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const lineOverlay = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshBasicMaterial({ map: createLinesTexture(), transparent: true, depthWrite: false })
  );
  lineOverlay.rotation.x = -Math.PI / 2;
  lineOverlay.position.y = 0.003;
  group.add(lineOverlay);

  const hoopNorth = createHoopGroup(1);
  const hoopSouth = createHoopGroup(-1);
  group.add(hoopNorth.group);
  group.add(hoopSouth.group);

  const lightPoleAnchors = createLightPoles(group);

  scene.add(group);

  const hoopById = new Map([
    [hoopNorth.id, hoopNorth],
    [hoopSouth.id, hoopSouth],
  ]);
  const tempBallPosition = new THREE.Vector3();
  const tempBallVelocity = new THREE.Vector3();

  function update(delta) {
    park.update(delta);
    npcs.update(delta);
    for (const hoop of hoopById.values()) {
      hoop.net.update(delta);
    }
  }

  function disturbNet(hoopId, worldPosition, strength = 0.1) {
    const hoop = hoopById.get(hoopId);
    if (!hoop || !worldPosition) {
      return;
    }
    hoop.net.disturb(worldPosition, strength);
  }

  function interactBallWithNets(ballBody, ballRadius, delta) {
    if (!ballBody || ballBody.mass <= 0) {
      return false;
    }

    tempBallPosition.set(ballBody.position.x, ballBody.position.y, ballBody.position.z);
    tempBallVelocity.set(ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z);

    let touched = false;
    for (const hoop of hoopById.values()) {
      const yMin = hoop.rimCenter.y - 1.25;
      const yMax = hoop.rimCenter.y + 0.25;
      if (tempBallPosition.y < yMin || tempBallPosition.y > yMax) {
        continue;
      }

      if (hoop.net.collideBall(tempBallPosition, ballRadius, tempBallVelocity, delta)) {
        touched = true;
      }
    }

    if (touched) {
      ballBody.position.set(tempBallPosition.x, tempBallPosition.y, tempBallPosition.z);
      ballBody.velocity.set(tempBallVelocity.x, tempBallVelocity.y, tempBallVelocity.z);
    }

    return touched;
  }

  return {
    group,
    hoops: [hoopNorth, hoopSouth],
    lightPoleAnchors,
    update,
    disturbNet,
    interactBallWithNets,
    bounds: {
      minX: -COURT.halfWidth + 0.55,
      maxX: COURT.halfWidth - 0.55,
      minZ: -COURT.halfLength + 0.75,
      maxZ: COURT.halfLength - 0.75,
    },
  };
}
