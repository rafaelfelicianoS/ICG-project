import { COURT, getBackboardZ, getRimCenter } from "../core/constants.js";
import { THREE } from "../core/deps.js";

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
      const i = (py * size + px) * 4;
      data[i] = Math.max(0, Math.min(255, base.r + noise));
      data[i + 1] = Math.max(0, Math.min(255, base.g + noise));
      data[i + 2] = Math.max(0, Math.min(255, base.b + noise));
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function createLinesTexture() {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const mapX = (x) => ((x + COURT.halfWidth) / COURT.width) * size;
  const mapY = (z) => ((COURT.halfLength - z) / COURT.length) * size;
  const radiusToPx = (r) => (r / COURT.width) * size;
  const linePx = Math.max(2, (COURT.lineWidth / COURT.width) * size);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = linePx;
  ctx.lineCap = "round";

  ctx.strokeRect(0, 0, size, size);

  ctx.beginPath();
  ctx.moveTo(0, mapY(0));
  ctx.lineTo(size, mapY(0));
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
    const arcDelta = Math.sqrt(Math.max(0.001, COURT.threePointRadius ** 2 - sideLineX ** 2));
    const arcTouchZ = rim.z - sign * arcDelta;

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

    ctx.beginPath();
    ctx.moveTo(mapX(-sideLineX), mapY(baselineZ));
    ctx.lineTo(mapX(-sideLineX), mapY(arcTouchZ));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mapX(sideLineX), mapY(baselineZ));
    ctx.lineTo(mapX(sideLineX), mapY(arcTouchZ));
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function createBench() {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x70523a, roughness: 0.85, metalness: 0.05 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x4f5965, roughness: 0.62, metalness: 0.25 });

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), wood);
  seat.position.y = 0.55;
  seat.castShadow = true;
  bench.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.4), wood);
  back.position.set(0, 0.95, -0.18);
  back.rotation.x = -0.35;
  back.castShadow = true;
  bench.add(back);

  for (const x of [-0.7, 0.7]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), metal);
    leg.position.set(x, 0.25, 0);
    leg.castShadow = true;
    bench.add(leg);
  }

  return bench;
}

function createParkProps(group) {
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.95, metalness: 0 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.035;
  grass.receiveShadow = true;
  group.add(grass);

  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7b4f2c, roughness: 0.9, metalness: 0 });
  const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.8, metalness: 0 });
  const treeCount = 12;

  for (let i = 0; i < treeCount; i += 1) {
    const angle = (i / treeCount) * Math.PI * 2;
    const radius = 23 + (i % 3) * 1.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3, 10), trunkMaterial);
    trunk.position.set(x, 1.5, z);
    trunk.castShadow = true;
    group.add(trunk);

    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), leavesMaterial);
    crown.position.set(x, 3.7, z);
    crown.castShadow = true;
    group.add(crown);
  }

  const benches = [
    { x: COURT.halfWidth + 2.6, z: -6.5, yaw: Math.PI / 2 },
    { x: COURT.halfWidth + 2.6, z: 6.5, yaw: Math.PI / 2 },
    { x: -COURT.halfWidth - 2.6, z: -6.5, yaw: -Math.PI / 2 },
    { x: -COURT.halfWidth - 2.6, z: 6.5, yaw: -Math.PI / 2 },
  ];

  benches.forEach((cfg) => {
    const bench = createBench();
    bench.position.set(cfg.x, 0, cfg.z);
    bench.rotation.y = cfg.yaw;
    group.add(bench);
  });
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

  const net = new THREE.Mesh(
    new THREE.ConeGeometry(COURT.rimRadius * 0.85, 0.62, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf1f5f8, wireframe: true, opacity: 0.7, transparent: true })
  );
  net.position.set(rimCenter.x, rimCenter.y - 0.32, rimCenter.z);
  net.rotation.x = Math.PI;
  net.rotation.y = Math.PI / 16;
  hoop.add(net);

  return {
    group: hoop,
    id: sign > 0 ? "north-hoop" : "south-hoop",
    side: sign > 0 ? "north" : "south",
    rimCenter: new THREE.Vector3(rimCenter.x, rimCenter.y, rimCenter.z),
    backboardCenter: new THREE.Vector3(0, COURT.backboardCenterHeight, backboardZ),
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

  createParkProps(group);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshStandardMaterial({
      map: createParkSurfaceTexture(),
      roughness: 0.88,
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

  return {
    group,
    hoops: [hoopNorth, hoopSouth],
    lightPoleAnchors,
    bounds: {
      minX: -COURT.halfWidth + 0.55,
      maxX: COURT.halfWidth - 0.55,
      minZ: -COURT.halfLength + 0.75,
      maxZ: COURT.halfLength - 0.75,
    },
  };
}
