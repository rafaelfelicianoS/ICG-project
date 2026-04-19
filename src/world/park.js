import { COURT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

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

function createRealisticTree(position, phase) {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f0a, roughness: 0.9, metalness: 0 });
  const leafDark = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.82, metalness: 0 });
  const leafMid = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8, metalness: 0 });
  const leafLight = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.78, metalness: 0 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 3.5, 8), trunkMat);
  trunk.position.y = 1.75;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  for (const branchCfg of [
    { x: 0.16, y: 2.2, z: 0, rx: -0.75, rz: 0.4 },
    { x: -0.14, y: 2.1, z: 0.1, rx: -0.68, rz: -0.45 },
    { x: 0.05, y: 2.35, z: -0.1, rx: -0.6, rz: 0.18 },
  ]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 1.2, 6), trunkMat);
    branch.position.set(branchCfg.x, branchCfg.y, branchCfg.z);
    branch.rotation.x = branchCfg.rx;
    branch.rotation.z = branchCfg.rz;
    branch.castShadow = true;
    tree.add(branch);
  }

  const topGroup = new THREE.Group();
  topGroup.position.y = 0;
  tree.add(topGroup);

  const crownPrimary = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 10), leafDark);
  crownPrimary.position.y = 3.8;
  crownPrimary.castShadow = true;
  topGroup.add(crownPrimary);

  const crownSecondary = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), leafMid);
  crownSecondary.position.set(0.35, 4.8, -0.25);
  crownSecondary.castShadow = true;
  topGroup.add(crownSecondary);

  const crownTertiary = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 8), leafLight);
  crownTertiary.position.set(-0.4, 5.6, 0.18);
  crownTertiary.castShadow = true;
  topGroup.add(crownTertiary);

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
  const count = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i += 1) {
    const bird = createBird();
    bird.group.position.set(i * 1.25, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.8);
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
  flock.speed = 4 + Math.random() * 3;
  flock.altitude = 12 + Math.random() * 10;
  flock.zDrift = (Math.random() - 0.5) * 8;
  flock.flockGroup.visible = true;
  flock.flockGroup.position.set(side === "left" ? -50 : 50, flock.altitude, flock.zDrift);
}

export function createPark(group) {
  const parkRoot = new THREE.Group();
  parkRoot.name = "park-environment";
  group.add(parkRoot);

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
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
  const treeCount = 12;
  for (let i = 0; i < treeCount; i += 1) {
    const angle = (i / treeCount) * Math.PI * 2;
    const radius = 23 + (i % 3) * 1.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const tree = createRealisticTree(new THREE.Vector3(x, 0, z), Math.random() * Math.PI * 2);
    parkRoot.add(tree);
    trees.push(tree);
  }

  const flocks = [createBirdFlock(parkRoot), createBirdFlock(parkRoot)];
  let birdSpawnTimer = 8 + Math.random() * 7;
  let time = 0;

  function update(delta) {
    time += delta;

    for (const tree of trees) {
      const sway = Math.sin(time * 0.8 + tree.userData.phase) * 0.03;
      tree.userData.topGroup.rotation.x = sway;
      tree.userData.topGroup.rotation.z = sway * 0.6;
    }

    birdSpawnTimer -= delta;
    if (birdSpawnTimer <= 0) {
      const inactive = flocks.find((f) => !f.active);
      if (inactive) {
        resetFlockState(inactive, Math.random() < 0.5 ? "left" : "right");
      }
      birdSpawnTimer = 8 + Math.random() * 7;
    }

    for (const flock of flocks) {
      if (!flock.active) {
        continue;
      }

      flock.flockGroup.position.x += flock.dir * flock.speed * delta;
      flock.flockGroup.position.z += Math.sin(time * 0.35) * 0.2 * delta;

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
