import { THREE } from "../core/deps.js";

function lerpValue(current, target, alpha) {
  return THREE.MathUtils.lerp(current, target, alpha);
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const skin = new THREE.MeshStandardMaterial({ color: 0xf3d4b8, roughness: 0.6 });
  const jersey = new THREE.MeshStandardMaterial({ color: 0x1f4b99, roughness: 0.4 });
  const shorts = new THREE.MeshStandardMaterial({ color: 0x0f2f6f, roughness: 0.45 });
  const socks = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.5 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), jersey);
  torso.position.y = 1.2;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyRoot.add(torso);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.42, 0.36), shorts);
  pelvis.position.y = 0.63;
  pelvis.castShadow = true;
  bodyRoot.add(pelvis);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 20), skin);
  head.position.y = 1.92;
  head.castShadow = true;
  bodyRoot.add(head);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.42, 1.54, 0);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), skin);
  leftArm.position.y = -0.28;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  bodyRoot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.42, 1.54, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), skin);
  rightArm.position.y = -0.28;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  bodyRoot.add(rightArmPivot);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, 0.42, 0);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.88, 14), socks);
  leftLeg.position.y = -0.44;
  leftLeg.castShadow = true;
  leftLegPivot.add(leftLeg);
  bodyRoot.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.16, 0.42, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.88, 14), socks);
  rightLeg.position.y = -0.44;
  rightLeg.castShadow = true;
  rightLegPivot.add(rightLeg);
  bodyRoot.add(rightLegPivot);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.35), shoes);
  leftShoe.position.set(-0.16, -0.04, 0.08);
  leftShoe.castShadow = true;
  bodyRoot.add(leftShoe);

  const rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.35), shoes);
  rightShoe.position.set(0.16, -0.04, 0.08);
  rightShoe.castShadow = true;
  bodyRoot.add(rightShoe);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;

  scene.add(group);
  scene.add(shadowBlob);

  let animTime = 0;
  let shootBlend = 0;
  let celebrateBlend = 0;
  let jumpOffsetY = 0;
  let firstPersonMode = false;

  const currentPose = {
    leftLegX: 0,
    rightLegX: 0,
    leftArmX: 0,
    rightArmX: 0,
    torsoX: 0,
    headX: 0,
  };

  const targetPose = {
    leftLegX: 0,
    rightLegX: 0,
    leftArmX: 0,
    rightArmX: 0,
    torsoX: 0,
    headX: 0,
  };

  function resetTargetPose() {
    targetPose.leftLegX = 0;
    targetPose.rightLegX = 0;
    targetPose.leftArmX = 0;
    targetPose.rightArmX = 0;
    targetPose.torsoX = 0;
    targetPose.headX = 0;
  }

  function applyShadowByJump() {
    shadowBlob.material.opacity = 0.3 - Math.min(0.18, jumpOffsetY * 0.8);
  }

  function setPositionAndYaw(position, yaw) {
    group.position.copy(position);
    group.position.y = Math.max(0, jumpOffsetY);
    group.rotation.y = yaw;
    shadowBlob.position.set(position.x, 0.01, position.z);
  }

  function setShootingPose(blend) {
    shootBlend = THREE.MathUtils.clamp(blend, 0, 1);
  }

  function setCelebratePose(blend) {
    celebrateBlend = THREE.MathUtils.clamp(blend, 0, 1);
  }

  function setJumpOffset(offsetY) {
    jumpOffsetY = Math.max(0, offsetY);
    group.position.y = jumpOffsetY;
    applyShadowByJump();
  }

  function resetJumpOffset() {
    jumpOffsetY = 0;
    group.position.y = 0;
    shadowBlob.material.opacity = 0.3;
  }

  function getBallAnchor(out) {
    out.set(0.12, -0.5, 0.16);
    return rightArmPivot.localToWorld(out);
  }

  function getReleaseAnchor(out) {
    out.set(0.04, -0.34, 0.5);
    return rightArmPivot.localToWorld(out);
  }

  function update(delta, animContext = {}) {
    animTime += delta;
    resetTargetPose();

    const isCelebrating = celebrateBlend > 0.001 || animContext.isCelebrating;
    const isShooting = shootBlend > 0.001 || animContext.isCharging || animContext.isShootingSequence;

    if (isCelebrating) {
      const blend = THREE.MathUtils.clamp(Math.max(celebrateBlend, animContext.isCelebrating ? 1 : 0), 0, 1);
      targetPose.leftArmX = -2.2 * blend;
      targetPose.rightArmX = -2.2 * blend;
      targetPose.torsoX = -0.26 * blend;
      targetPose.headX = Math.sin(animTime * 12) * 0.15 * blend;
      targetPose.leftLegX = Math.sin(animTime * 6) * 0.08 * blend;
      targetPose.rightLegX = -Math.sin(animTime * 6) * 0.08 * blend;
    } else if (isShooting) {
      const blend = THREE.MathUtils.clamp(Math.max(shootBlend, animContext.isCharging ? 0.35 : 0), 0, 1);
      targetPose.leftArmX = -1.9 * blend;
      targetPose.rightArmX = -1.9 * blend;
      targetPose.torsoX = 0.06 * blend;
      targetPose.leftLegX = -0.08 * blend;
      targetPose.rightLegX = -0.08 * blend;
    } else if (animContext.isMoving) {
      const swing = Math.sin(animTime * 10);
      targetPose.leftLegX = swing * 0.45;
      targetPose.rightLegX = -swing * 0.45;

      if (animContext.hasBall) {
        targetPose.leftArmX = -swing * 0.22;
        targetPose.rightArmX = Math.sin(animTime * 10) * 0.28 - 0.45;
        targetPose.torsoX = Math.sin(animTime * 5) * 0.035;
      } else {
        targetPose.leftArmX = -swing * 0.3;
        targetPose.rightArmX = swing * 0.3;
        targetPose.torsoX = 0;
      }
    } else if (animContext.hasBall) {
      targetPose.rightArmX = Math.sin(animTime * 8) * 0.4 - 0.3;
      targetPose.leftArmX = Math.sin(animTime * 6 + Math.PI * 0.25) * 0.08;
      targetPose.torsoX = Math.sin(animTime * 4) * 0.03;
    }

    const alpha = 1 - Math.exp(-delta * 8);
    currentPose.leftLegX = lerpValue(currentPose.leftLegX, targetPose.leftLegX, alpha);
    currentPose.rightLegX = lerpValue(currentPose.rightLegX, targetPose.rightLegX, alpha);
    currentPose.leftArmX = lerpValue(currentPose.leftArmX, targetPose.leftArmX, alpha);
    currentPose.rightArmX = lerpValue(currentPose.rightArmX, targetPose.rightArmX, alpha);
    currentPose.torsoX = lerpValue(currentPose.torsoX, targetPose.torsoX, alpha);
    currentPose.headX = lerpValue(currentPose.headX, targetPose.headX, alpha);

    leftLegPivot.rotation.x = currentPose.leftLegX;
    rightLegPivot.rotation.x = currentPose.rightLegX;
    leftArmPivot.rotation.x = currentPose.leftArmX;
    rightArmPivot.rotation.x = currentPose.rightArmX;
    torso.rotation.x = currentPose.torsoX;
    head.rotation.x = currentPose.headX;
    pelvis.rotation.x = currentPose.torsoX * 0.35;

    bodyRoot.visible = !firstPersonMode;
  }

  function triggerShoot() {
    shootBlend = Math.max(shootBlend, 0.6);
    return true;
  }

  function triggerCelebrate() {
    celebrateBlend = Math.max(celebrateBlend, 1);
    return true;
  }

  function isAnimatedReady() {
    return true;
  }

  function setFirstPersonMode(enabled) {
    firstPersonMode = !!enabled;
  }

  return {
    group,
    update,
    setPositionAndYaw,
    setShootingPose,
    setCelebratePose,
    setJumpOffset,
    resetJumpOffset,
    getBallAnchor,
    getReleaseAnchor,
    triggerShoot,
    triggerCelebrate,
    isAnimatedReady,
    setFirstPersonMode,
  };
}
