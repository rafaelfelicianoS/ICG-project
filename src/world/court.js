import { COURT, getBackboardZ, getRimCenter } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function createParquetTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const rows = 16;
  const cols = 18;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const shade = (row + col) % 2 === 0 ? 170 : 155;
      ctx.fillStyle = `rgb(${shade + 22}, ${shade + 8}, ${shade - 35})`;
      ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 6);
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

  ctx.strokeStyle = "#f5f8ff";
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
  const sideLineX = COURT.halfWidth - 0.9;

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

export function createCourt(scene) {
  const group = new THREE.Group();
  group.name = "court-root";

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width, COURT.length),
    new THREE.MeshStandardMaterial({
      map: createParquetTexture(),
      roughness: 0.44,
      metalness: 0.02,
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

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x4a5869, roughness: 0.9, metalness: 0.05 });
  const wallThickness = 0.32;
  const wallHeight = COURT.wallHeight;

  const eastWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, wallHeight, COURT.length + 2),
    wallMaterial
  );
  eastWall.position.set(COURT.halfWidth + wallThickness * 0.5, wallHeight * 0.5, 0);
  eastWall.receiveShadow = true;
  group.add(eastWall);

  const westWall = eastWall.clone();
  westWall.position.x *= -1;
  group.add(westWall);

  const northWall = new THREE.Mesh(
    new THREE.BoxGeometry(COURT.width + 2, wallHeight, wallThickness),
    wallMaterial
  );
  northWall.position.set(0, wallHeight * 0.5, COURT.halfLength + wallThickness * 0.5);
  northWall.receiveShadow = true;
  group.add(northWall);

  const southWall = northWall.clone();
  southWall.position.z *= -1;
  group.add(southWall);

  const roof = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width + 2.4, COURT.length + 2.4),
    new THREE.MeshStandardMaterial({ color: 0x202b35, side: THREE.DoubleSide, roughness: 0.95 })
  );
  roof.rotation.x = Math.PI / 2;
  roof.position.y = wallHeight;
  group.add(roof);

  const standsMaterial = new THREE.MeshStandardMaterial({ color: 0x313d49, roughness: 0.85 });
  const standA = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 8), standsMaterial);
  standA.position.set(COURT.halfWidth + 1.2, 0.6, -4.8);
  standA.castShadow = true;
  standA.receiveShadow = true;
  group.add(standA);

  const standB = standA.clone();
  standB.position.z = 4.8;
  group.add(standB);

  const standC = standA.clone();
  standC.position.x = -standA.position.x;
  group.add(standC);

  const standD = standB.clone();
  standD.position.x = -standA.position.x;
  group.add(standD);

  const hoopNorth = createHoopGroup(1);
  const hoopSouth = createHoopGroup(-1);
  group.add(hoopNorth.group);
  group.add(hoopSouth.group);

  scene.add(group);

  return {
    group,
    hoops: [hoopNorth, hoopSouth],
    bounds: {
      minX: -COURT.halfWidth + 0.55,
      maxX: COURT.halfWidth - 0.55,
      minZ: -COURT.halfLength + 0.75,
      maxZ: COURT.halfLength - 0.75,
    },
  };
}
