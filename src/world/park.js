import { COURT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

// Shared conifer cone materials — defined once, reused across all trees
const CONE_MATS = [
  new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.85, metalness: 0 }),
  new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85, metalness: 0 }),
  new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.85, metalness: 0 }),
  new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.85, metalness: 0 }),
];

function createBench() {
  const bench = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.85, metalness: 0 });
  const woodSupport = new THREE.MeshStandardMaterial({ color: 0x5d3a1a, roughness: 0.85, metalness: 0 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.3, metalness: 0.7 });

  for (const offset of [-0.16, 0, 0.16]) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.14), wood);
    slat.position.set(0, 0.44, offset);
    slat.castShadow = true;
    bench.add(slat);
  }

  for (const offset of [-0.1, 0, 0.1]) {
    const backSlat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.1), wood);
    backSlat.position.set(0, 0.68, offset - 0.18);
    backSlat.rotation.x = -0.26;
    backSlat.castShadow = true;
    bench.add(backSlat);
  }

  for (const side of [-1, 1]) {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.48), woodSupport);
    support.position.set(side * 0.86, 0.45, -0.04);
    support.castShadow = true;
    bench.add(support);
  }

  for (const [x, z] of [
    [-0.82, 0.1],
    [0.82, 0.1],
    [-0.82, -0.2],
    [0.82, -0.2],
  ]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.44, 8), metal);
    leg.position.set(x, 0.22, z);
    if (z < 0) {
      leg.rotation.x = 0.08;
    }
    leg.castShadow = true;
    bench.add(leg);
  }

  for (const side of [-1, 1]) {
    const floorBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.52, 8), metal);
    floorBar.position.set(side * 0.82, 0.08, -0.04);
    floorBar.rotation.x = Math.PI / 2;
    floorBar.castShadow = true;
    bench.add(floorBar);
  }

  return bench;
}

function createConiferTree(position, phase) {
  const tree = new THREE.Group();

  // Random height scale per tree for visual variety
  const heightScale = 0.75 + Math.random() * 0.55;
  tree.scale.y = heightScale;
  tree.rotation.y = Math.random() * Math.PI * 2;

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f0a, roughness: 0.9, metalness: 0 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 4, 7), trunkMat);
  trunk.position.y = 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // Cone layers bottom to top — darker at base, lighter at tip
  const layers = [
    { radius: 2.8, height: 2.2, y: 2.5 },
    { radius: 2.2, height: 2.0, y: 3.8 },
    { radius: 1.6, height: 1.8, y: 5.0 },
    { radius: 1.0, height: 1.6, y: 6.0 },
  ];

  const topGroup = new THREE.Group();
  tree.add(topGroup);

  for (let li = 0; li < layers.length; li += 1) {
    const layer = layers[li];
    const cone = new THREE.Mesh(new THREE.ConeGeometry(layer.radius, layer.height, 7), CONE_MATS[li]);
    cone.position.y = layer.y;
    cone.castShadow = true;
    cone.receiveShadow = true;
    topGroup.add(cone);
  }

  tree.position.copy(position);
  tree.userData.phase = phase;
  tree.userData.topGroup = topGroup;
  return tree;
}

function createBird() {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat);
  body.scale.set(1.4, 0.8, 1.8);
  group.add(body);

  const leftWingPivot = new THREE.Group();
  leftWingPivot.position.set(-0.07, 0, 0);
  const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), mat);
  leftWing.position.x = -0.3;
  leftWing.rotation.y = -0.18;
  leftWingPivot.add(leftWing);
  group.add(leftWingPivot);

  const rightWingPivot = new THREE.Group();
  rightWingPivot.position.set(0.07, 0, 0);
  const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.25), mat);
  rightWing.position.x = 0.3;
  rightWing.rotation.y = 0.18;
  rightWingPivot.add(rightWing);
  group.add(rightWingPivot);

  return {
    group,
    leftWingPivot,
    rightWingPivot,
    phase: Math.random() * Math.PI * 2,
  };
}

function createBirdFlock(parent) {
  const flockGroup = new THREE.Group();
  flockGroup.visible = false;
  parent.add(flockGroup);

  const birds = [];
  const count = 5 + Math.floor(Math.random() * 4); // 5–8 birds
  for (let i = 0; i < count; i += 1) {
    const bird = createBird();
    // V-formation: birds spread back and alternating sides
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    bird.group.position.set(
      row * -1.5,
      (Math.random() - 0.5) * 0.3,
      side * row * 0.7
    );
    flockGroup.add(bird.group);
    birds.push(bird);
  }

  return {
    flockGroup,
    birds,
    active: false,
    dir: 1,
    speed: 5,
    altitude: 15,
    zDrift: 0,
  };
}

function resetFlockState(flock, side) {
  flock.active = true;
  flock.dir = side === "left" ? 1 : -1;
  flock.speed = 4 + Math.random() * 4;
  flock.altitude = 14 + Math.random() * 10;
  flock.zDrift = (Math.random() - 0.5) * 10;
  flock.flockGroup.visible = true;
  // Rotate flock group to face direction of travel
  flock.flockGroup.rotation.y = flock.dir > 0 ? 0 : Math.PI;
  flock.flockGroup.position.set(
    side === "left" ? -55 : 55,
    flock.altitude,
    flock.zDrift
  );
}

export function createPark(group) {
  const parkRoot = new THREE.Group();
  parkRoot.name = "park-environment";
  group.add(parkRoot);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.95, metalness: 0 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.035;
  grass.receiveShadow = true;
  parkRoot.add(grass);

  const benches = [
    { x: COURT.halfWidth + 2.6, z: -6.5, yaw: Math.PI / 2 },
    { x: COURT.halfWidth + 2.6, z: 6.5, yaw: Math.PI / 2 },
    { x: -COURT.halfWidth - 2.6, z: -6.5, yaw: -Math.PI / 2 },
    { x: -COURT.halfWidth - 2.6, z: 6.5, yaw: -Math.PI / 2 },
  ];

  for (const cfg of benches) {
    const bench = createBench();
    bench.position.set(cfg.x, 0, cfg.z);
    bench.rotation.y = cfg.yaw;
    parkRoot.add(bench);
  }

  const trees = [];

  // Inner ring — 36 trees, dense, radius 22–30
  const innerCount = 36;
  for (let i = 0; i < innerCount; i += 1) {
    const baseAngle = (i / innerCount) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * (Math.PI * 2 / innerCount) * 0.8;
    const angle = baseAngle + jitter;
    const radius = 22 + Math.random() * 8;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const tree = createConiferTree(new THREE.Vector3(x, 0, z), Math.random() * Math.PI * 2);
    parkRoot.add(tree);
    trees.push(tree);
  }

  // Outer ring — 16 trees, sparse, radius 32–38 for depth layering
  const outerCount = 16;
  for (let i = 0; i < outerCount; i += 1) {
    const baseAngle = (i / outerCount) * Math.PI * 2;
    const jitter = (Math.random() - 0.5) * (Math.PI * 2 / outerCount) * 0.6;
    const angle = baseAngle + jitter;
    const radius = 32 + Math.random() * 6;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const tree = createConiferTree(new THREE.Vector3(x, 0, z), Math.random() * Math.PI * 2);
    parkRoot.add(tree);
    trees.push(tree);
  }

  const flocks = [createBirdFlock(parkRoot), createBirdFlock(parkRoot), createBirdFlock(parkRoot)];
  let birdSpawnTimer = 5 + Math.random() * 5;
  let time = 0;

  function update(delta) {
    time += delta;

    // Vento: cada árvore tem uma phase diferente para não balançarem todas em sincronismo
    // sin(tempo + phase) garante que umas vão para a frente enquanto outras vão para trás
    for (const tree of trees) {
      const sway = Math.sin(time * 0.8 + tree.userData.phase) * 0.03;
      tree.userData.topGroup.rotation.x = sway;
      tree.userData.topGroup.rotation.z = sway * 0.6;
    }

    // Bandos de pássaros: spawn aleatório a cada 5-10s, voam de um lado ao outro
    birdSpawnTimer -= delta;
    if (birdSpawnTimer <= 0) {
      const inactive = flocks.find((f) => !f.active);
      if (inactive) {
        resetFlockState(inactive, Math.random() < 0.5 ? "left" : "right");
      }
      birdSpawnTimer = 5 + Math.random() * 5;
    }

    for (const flock of flocks) {
      if (!flock.active) {
        continue;
      }

      flock.flockGroup.position.x += flock.dir * flock.speed * delta;
      flock.flockGroup.position.z += Math.sin(time * 0.35) * 0.2 * delta; // deriva suave em Z

      // Asas: sin(tempo + phase) — cada pássaro tem phase diferente para não baterem ao mesmo tempo
      for (const bird of flock.birds) {
        const wingAngle = Math.sin(time * 6 + bird.phase) * 0.5;
        bird.leftWingPivot.rotation.z = wingAngle;
        bird.rightWingPivot.rotation.z = -wingAngle;
      }

      if ((flock.dir > 0 && flock.flockGroup.position.x > 55) || (flock.dir < 0 && flock.flockGroup.position.x < -55)) {
        flock.active = false;
        flock.flockGroup.visible = false;
      }
    }
  }

  return {
    root: parkRoot,
    update,
  };
}
