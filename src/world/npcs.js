import { COURT } from "../core/constants.js";
import { THREE } from "../core/deps.js";

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
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
  };
}

function updateWalkPose(figure, animTime, stride = 0.4) {
  const swing = Math.sin(animTime * 8);
  figure.leftLegPivot.rotation.x = swing * stride;
  figure.rightLegPivot.rotation.x = -swing * stride;
  figure.leftArmPivot.rotation.x = -swing * stride * 0.65;
  figure.rightArmPivot.rotation.x = swing * stride * 0.65;
}

function positionOnPath(path, t, outPosition, outForward) {
  const pointCount = path.length;
  if (pointCount < 2) {
    outPosition.copy(path[0] ?? new THREE.Vector3());
    outForward.set(0, 0, 1);
    return;
  }

  const wrapped = ((t % 1) + 1) % 1;
  const scaled = wrapped * pointCount;
  const indexA = Math.floor(scaled) % pointCount;
  const indexB = (indexA + 1) % pointCount;
  const localT = scaled - Math.floor(scaled);

  outPosition.copy(path[indexA]).lerp(path[indexB], localT);
  outForward.copy(path[indexB]).sub(path[indexA]);
  if (outForward.lengthSq() < 0.0001) {
    outForward.set(0, 0, 1);
  } else {
    outForward.normalize();
  }
}

export function createNPCs(parentGroup) {
  const root = new THREE.Group();
  root.name = "park-npcs";
  parentGroup.add(root);

  const tempPos = new THREE.Vector3();
  const tempForward = new THREE.Vector3();
  const tempLateral = new THREE.Vector3();

  const familyRoot = new THREE.Group();
  root.add(familyRoot);
  const familyAdultA = createNPCFigure({ shirtColor: 0x5e60ce, pantsColor: 0x1f2933, shoeColor: 0x111111 });
  const familyAdultB = createNPCFigure({ shirtColor: 0xff922b, pantsColor: 0x343a40, shoeColor: 0x111111 });
  const familyChild = createNPCFigure({
    scale: 0.6,
    shirtColor: 0x2f9e44,
    pantsColor: 0x343a40,
    shoeColor: 0x111111,
  });
  familyRoot.add(familyAdultA.group);
  familyRoot.add(familyAdultB.group);
  familyRoot.add(familyChild.group);

  const familyPath = [];
  const familyCenter = new THREE.Vector3(-COURT.halfWidth - 6, 0, 0);
  for (let i = 0; i < 20; i += 1) {
    const a = (i / 20) * Math.PI * 2;
    familyPath.push(
      new THREE.Vector3(
        familyCenter.x + Math.cos(a) * 2.8,
        0,
        familyCenter.z + Math.sin(a) * 5.2
      )
    );
  }

  const reader = createNPCFigure({ shirtColor: 0xe53935, pantsColor: 0x2f3e46, shoeColor: 0x111111 });
  reader.group.position.set(COURT.halfWidth + 8, 0, 3.5);
  reader.torso.rotation.x = -THREE.MathUtils.degToRad(20);
  reader.leftLegPivot.rotation.x = -Math.PI / 2;
  reader.rightLegPivot.rotation.x = -Math.PI / 2;
  reader.leftLegPivot.position.y = 0.33;
  reader.rightLegPivot.position.y = 0.33;
  reader.leftArmPivot.rotation.x = -1.35;
  reader.rightArmPivot.rotation.x = -1.35;
  const book = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.03, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.66 })
  );
  book.position.set(0, 1.02, 0.26);
  book.rotation.x = -0.6;
  book.castShadow = true;
  reader.group.add(book);
  root.add(reader.group);

  const coupleRoot = new THREE.Group();
  root.add(coupleRoot);
  const coupleA = createNPCFigure({ shirtColor: 0x00a8e8, pantsColor: 0x283618 });
  const coupleB = createNPCFigure({ shirtColor: 0xf28482, pantsColor: 0x1d3557 });
  coupleRoot.add(coupleA.group);
  coupleRoot.add(coupleB.group);

  const idlePerson = createNPCFigure({ shirtColor: 0x6c757d, pantsColor: 0x212529 });
  idlePerson.group.position.set(COURT.halfWidth + 2.8, 0, -1.2);
  root.add(idlePerson.group);

  const familyScene = {
    type: "family",
    members: [familyAdultA, familyAdultB, familyChild],
    path: familyPath,
    speed: 1.2,
    progress: 0,
    animTime: 0,
  };

  const coupleScene = {
    type: "couple",
    members: [coupleA, coupleB],
    path: [new THREE.Vector3(-8, 0, COURT.halfLength + 8), new THREE.Vector3(8, 0, COURT.halfLength + 8)],
    speed: 0.55,
    direction: 1,
    progress: 0,
    animTime: 0,
  };

  const idleScene = {
    type: "idle",
    member: idlePerson,
    animTime: 0,
  };

  function updateFamily(delta) {
    familyScene.progress += (delta * familyScene.speed) / 28;
    familyScene.animTime += delta;

    const offsets = [0.96, 0.04, 0.5];
    for (let i = 0; i < familyScene.members.length; i += 1) {
      const member = familyScene.members[i];
      const progress = familyScene.progress + offsets[i];
      positionOnPath(familyScene.path, progress, tempPos, tempForward);

      member.group.position.copy(tempPos);
      member.group.rotation.y = Math.atan2(tempForward.x, tempForward.z);
      updateWalkPose(member, familyScene.animTime + i * 0.7, 0.34);
    }
  }

  function updateCouple(delta) {
    coupleScene.animTime += delta;
    coupleScene.progress += delta * coupleScene.speed * coupleScene.direction;

    if (coupleScene.progress > 1) {
      coupleScene.progress = 1;
      coupleScene.direction = -1;
    } else if (coupleScene.progress < 0) {
      coupleScene.progress = 0;
      coupleScene.direction = 1;
    }

    const start = coupleScene.path[0];
    const end = coupleScene.path[1];
    tempPos.copy(start).lerp(end, coupleScene.progress);
    tempForward.copy(end).sub(start).normalize();
    if (coupleScene.direction < 0) {
      tempForward.multiplyScalar(-1);
    }

    const spacing = 0.85;
    tempLateral.set(tempForward.z, 0, -tempForward.x).normalize();
    coupleScene.members[0].group.position.copy(tempPos).addScaledVector(tempLateral, spacing * 0.5);
    coupleScene.members[1].group.position.copy(tempPos).addScaledVector(tempLateral, -spacing * 0.5);

    for (let i = 0; i < coupleScene.members.length; i += 1) {
      const member = coupleScene.members[i];
      member.group.rotation.y = Math.atan2(tempForward.x, tempForward.z);
      updateWalkPose(member, coupleScene.animTime + i * 0.9, 0.28);
    }
  }

  function updateIdle(delta) {
    idleScene.animTime += delta;
    const sway = Math.sin(idleScene.animTime * 1.3) * 0.04;
    idleScene.member.torso.rotation.z = sway;
    idleScene.member.leftArmPivot.rotation.x = -0.12 + sway * 0.5;
    idleScene.member.rightArmPivot.rotation.x = -0.08 - sway * 0.45;
  }

  function update(delta) {
    updateFamily(delta);
    updateCouple(delta);
    updateIdle(delta);
  }

  return {
    root,
    update,
  };
}
