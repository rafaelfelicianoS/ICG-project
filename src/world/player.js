import { THREE } from "../core/deps.js";

export function createPlayer(scene) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xf3d4b8, roughness: 0.6 });
  const jersey = new THREE.MeshStandardMaterial({ color: 0x1f4b99, roughness: 0.4 });
  const shorts = new THREE.MeshStandardMaterial({ color: 0x0f2f6f, roughness: 0.45 });
  const socks = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), jersey);
  torso.position.y = 1.2;
  torso.castShadow = true;
  torso.receiveShadow = true;
  group.add(torso);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.36), shorts);
  pelvis.position.y = 0.63;
  pelvis.castShadow = true;
  group.add(pelvis);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 20), skin);
  head.position.y = 1.92;
  head.castShadow = true;
  group.add(head);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.42, 1.54, 0);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), skin);
  leftArm.position.y = -0.28;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  group.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.42, 1.54, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), skin);
  rightArm.position.y = -0.28;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  group.add(rightArmPivot);

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.88, 14), socks);
  leftLeg.position.set(-0.16, 0.2, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.88, 14), socks);
  rightLeg.position.set(0.16, 0.2, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;

  scene.add(group);
  scene.add(shadowBlob);

  function setPositionAndYaw(position, yaw) {
    group.position.copy(position);
    group.rotation.y = yaw;
    shadowBlob.position.set(position.x, 0.01, position.z);
  }

  function setShootingPose(blend) {
    const clamped = THREE.MathUtils.clamp(blend, 0, 1);
    const lift = -1.9 * clamped;
    leftArmPivot.rotation.x = lift;
    rightArmPivot.rotation.x = lift;
  }

  function setCelebratePose(blend) {
    const clamped = THREE.MathUtils.clamp(blend, 0, 1);
    leftArmPivot.rotation.x = -2.2 * clamped;
    rightArmPivot.rotation.x = -2.2 * clamped;
  }

  function setJumpOffset(offsetY) {
    group.position.y = Math.max(0, offsetY);
    shadowBlob.material.opacity = 0.3 - Math.min(0.18, offsetY * 0.8);
  }

  function resetJumpOffset() {
    group.position.y = 0;
    shadowBlob.material.opacity = 0.3;
  }

  function getBallAnchor(out) {
    out.set(0.48, 1.12, 0.6);
    out.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
    out.add(group.position);
    return out;
  }

  function getReleaseAnchor(out) {
    out.set(0.18, 1.95, 0.74);
    out.applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
    out.add(group.position);
    return out;
  }

  return {
    group,
    setPositionAndYaw,
    setShootingPose,
    setCelebratePose,
    setJumpOffset,
    resetJumpOffset,
    getBallAnchor,
    getReleaseAnchor,
  };
}
