import { COURT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function lerpAngle(from, to, alpha) {
  const diff = wrapAngle(to - from);
  return wrapAngle(from + diff * alpha);
}

function createNPCFigure(options = {}) {
  const group = new THREE.Group();
  const scale = options.scale ?? 1;

  const skin = new THREE.MeshStandardMaterial({ color: options.skinColor ?? 0xf3d4b8, roughness: 0.62 });
  const shirt = new THREE.MeshStandardMaterial({ color: options.shirtColor ?? 0x4c6ef5, roughness: 0.5 });
  const pants = new THREE.MeshStandardMaterial({ color: options.pantsColor ?? 0x212529, roughness: 0.56 });
  const shoe = new THREE.MeshStandardMaterial({ color: options.shoeColor ?? 0x1f1f1f, roughness: 0.58 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.8, 0.34), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.3), pants);
  pelvis.position.y = 0.57;
  pelvis.castShadow = true;
  group.add(pelvis);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 14), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.33, 1.37, 0);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5, 10), skin);
  leftArm.position.y = -0.25;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.33, 1.37, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.5, 10), skin);
  rightArm.position.y = -0.25;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  group.add(rightArmPivot);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.13, 0.42, 0);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.8, 10), pants);
  leftLeg.position.y = -0.4;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), shoe);
  leftShoe.position.set(0, -0.83, 0.06);
  leftShoe.castShadow = true;
  leftLegPivot.add(leftShoe);
  group.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.13, 0.42, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.8, 10), pants);
  rightLeg.position.y = -0.4;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.3), shoe);
  rightShoe.position.set(0, -0.83, 0.06);
  rightShoe.castShadow = true;
  rightLegPivot.add(rightShoe);
  group.add(rightLegPivot);

  group.scale.setScalar(scale);

  return {
    group,
    torso,
    head,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}

function updateWalker(walker, delta) {
  const pathDelta = new THREE.Vector3().subVectors(walker.pathEnd, walker.pathStart);
  const pathLength = Math.max(0.001, pathDelta.length());

  walker.progress += (delta * walker.speed * walker.direction) / pathLength;
  if (walker.progress >= 1) {
    walker.progress = 1;
    walker.direction = -1;
  } else if (walker.progress <= 0) {
    walker.progress = 0;
    walker.direction = 1;
  }

  walker.figure.group.position.lerpVectors(walker.pathStart, walker.pathEnd, walker.progress);

  const dir = walker.direction > 0 ? 1 : -1;
  const targetYaw = Math.atan2(pathDelta.x * dir, pathDelta.z * dir);
  const yawAlpha = 1 - Math.exp(-delta * 5);
  walker.figure.group.rotation.y = lerpAngle(walker.figure.group.rotation.y, targetYaw, yawAlpha);

  walker.animTime += delta;
  const swing = Math.sin(walker.animTime * 5 + walker.phase) * 0.4;
  walker.figure.leftLegPivot.rotation.x = swing;
  walker.figure.rightLegPivot.rotation.x = -swing;
  walker.figure.leftArmPivot.rotation.x = -swing * 0.5;
  walker.figure.rightArmPivot.rotation.x = swing * 0.5;
}

export function createNPCs(parentGroup) {
  const root = new THREE.Group();
  root.name = "park-npcs";
  parentGroup.add(root);

  const child = createNPCFigure({
    scale: 0.55,
    shirtColor: 0x2f9e44,
    pantsColor: 0x2d3436,
    shoeColor: 0x111111,
  });
  root.add(child.group);

  const idle = createNPCFigure({
    scale: 1,
    shirtColor: 0x6c757d,
    pantsColor: 0x212529,
    shoeColor: 0x111111,
  });
  idle.group.position.set(COURT.halfWidth + 3, 0, 1.2);
  root.add(idle.group);

  const walkerA = {
    figure: createNPCFigure({
      scale: 1,
      shirtColor: 0x00a8e8,
      pantsColor: 0x283618,
      shoeColor: 0x111111,
    }),
    pathStart: new THREE.Vector3(-9, 0, COURT.halfLength + 7.8),
    pathEnd: new THREE.Vector3(9, 0, COURT.halfLength + 7.8),
    speed: 1,
    direction: 1,
    progress: 0.2,
    animTime: 0,
    phase: 0.2,
  };
  root.add(walkerA.figure.group);

  const walkerB = {
    figure: createNPCFigure({
      scale: 1.05,
      shirtColor: 0xf28482,
      pantsColor: 0x1d3557,
      shoeColor: 0x111111,
    }),
    pathStart: new THREE.Vector3(COURT.halfWidth + 7.2, 0, -COURT.halfLength - 6.4),
    pathEnd: new THREE.Vector3(-COURT.halfWidth - 7.2, 0, -COURT.halfLength - 10.4),
    speed: 0.8,
    direction: 1,
    progress: 0.65,
    animTime: 0,
    phase: 1.4,
  };
  root.add(walkerB.figure.group);

  const childScene = {
    center: new THREE.Vector3(-COURT.halfWidth - 5.1, 0, 0.8),
    radiusX: 2.1,
    radiusZ: 1.25,
    speed: 0.9,
    angle: 0.2,
    animTime: 0,
  };

  const idleScene = {
    animTime: 0,
  };

  function updateChild(delta) {
    const averageRadius = (childScene.radiusX + childScene.radiusZ) * 0.5;
    const angularSpeed = childScene.speed / Math.max(0.001, averageRadius);
    childScene.angle += delta * angularSpeed;
    childScene.animTime += delta * 1.3;

    const x = childScene.center.x + Math.cos(childScene.angle) * childScene.radiusX;
    const z = childScene.center.z + Math.sin(childScene.angle) * childScene.radiusZ;
    child.group.position.set(x, 0, z);

    const tangentX = -Math.sin(childScene.angle) * childScene.radiusX;
    const tangentZ = Math.cos(childScene.angle) * childScene.radiusZ;
    child.group.rotation.y = Math.atan2(tangentX, tangentZ);

    const swing = Math.sin(childScene.animTime * 5) * 0.4;
    child.leftLegPivot.rotation.x = swing;
    child.rightLegPivot.rotation.x = -swing;
    child.leftArmPivot.rotation.x = -swing * 0.45;
    child.rightArmPivot.rotation.x = -1 + Math.abs(Math.sin(childScene.animTime * 7.5)) * 1.1;
  }

  function updateIdle(delta) {
    idleScene.animTime += delta;
    const sway = Math.sin(idleScene.animTime * 0.6) * 0.02;
    idle.torso.rotation.z = sway;
    idle.head.rotation.x = Math.sin(idleScene.animTime * 0.6 + 0.8) * 0.03;
    idle.leftArmPivot.rotation.x = -0.12 + sway * 0.6;
    idle.rightArmPivot.rotation.x = -0.08 - sway * 0.6;
  }

  function update(delta) {
    updateChild(delta);
    updateIdle(delta);
    updateWalker(walkerA, delta);
    updateWalker(walkerB, delta);
  }

  return {
    root,
    update,
  };
}
