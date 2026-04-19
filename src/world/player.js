import { THREE } from "../core/deps.js";

function lerpValue(current, target, alpha) {
  return THREE.MathUtils.lerp(current, target, alpha);
}

function normalizeColorValue(colorValue, fallback = 0xffffff) {
  if (typeof colorValue === "number") {
    return colorValue;
  }
  if (typeof colorValue === "string" && colorValue.trim().length > 0) {
    return colorValue;
  }
  return fallback;
}

function createJerseyNumberTexture(number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#FFFFFF";
  ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
  ctx.shadowBlur = 16;
  ctx.font = "bold 320px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), canvas.width * 0.5, canvas.height * 0.55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

function createShoe(parent, directionSign, materials) {
  const shoeRoot = new THREE.Group();
  shoeRoot.position.set(0, 0, directionSign * 0.01);

  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.38), materials.shoeUpper);
  upper.position.set(0, -0.85, 0.08);
  upper.castShadow = true;
  shoeRoot.add(upper);

  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.4), materials.shoeSole);
  sole.position.set(0, -0.95, 0.08);
  sole.castShadow = true;
  shoeRoot.add(sole);

  const detail = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.06, 0.39), materials.shoeDetail);
  detail.position.set(0, -0.9, 0.08);
  detail.castShadow = true;
  shoeRoot.add(detail);

  parent.add(shoeRoot);
  return shoeRoot;
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xf3d4b8, roughness: 0.6 }),
    jersey: new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.42, metalness: 0.05 }),
    jerseyStripe: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0.06 }),
    shorts: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.46, metalness: 0.04 }),
    sockTop: new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.52 }),
    sockBottom: new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.52 }),
    shoeUpper: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.48 }),
    shoeSole: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }),
    shoeDetail: new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.5 }),
  };

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.42), materials.jersey);
  torso.position.y = 1.2;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyRoot.add(torso);

  const leftStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.44), materials.jerseyStripe);
  leftStripe.position.set(-0.335, 1.2, 0);
  leftStripe.castShadow = true;
  bodyRoot.add(leftStripe);

  const rightStripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.44), materials.jerseyStripe);
  rightStripe.position.set(0.335, 1.2, 0);
  rightStripe.castShadow = true;
  bodyRoot.add(rightStripe);

  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.36), materials.shorts);
  pelvis.position.y = 0.63;
  pelvis.castShadow = true;
  bodyRoot.add(pelvis);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 22, 20), materials.skin);
  head.position.y = 1.92;
  head.castShadow = true;
  bodyRoot.add(head);

  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.42, 1.54, 0);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), materials.skin);
  leftArm.position.y = -0.28;
  leftArm.castShadow = true;
  leftArmPivot.add(leftArm);
  bodyRoot.add(leftArmPivot);

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.42, 1.54, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.56, 12), materials.skin);
  rightArm.position.y = -0.28;
  rightArm.castShadow = true;
  rightArmPivot.add(rightArm);
  bodyRoot.add(rightArmPivot);

  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.16, 0.42, 0);
  const leftSockTop = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.096, 0.42, 12), materials.sockTop);
  leftSockTop.position.y = -0.23;
  leftSockTop.castShadow = true;
  leftLegPivot.add(leftSockTop);
  const leftSockBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.094, 0.086, 0.42, 12),
    materials.sockBottom
  );
  leftSockBottom.position.y = -0.65;
  leftSockBottom.castShadow = true;
  leftLegPivot.add(leftSockBottom);
  createShoe(leftLegPivot, -1, materials);
  bodyRoot.add(leftLegPivot);

  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.16, 0.42, 0);
  const rightSockTop = new THREE.Mesh(new THREE.CylinderGeometry(0.102, 0.096, 0.42, 12), materials.sockTop);
  rightSockTop.position.y = -0.23;
  rightSockTop.castShadow = true;
  rightLegPivot.add(rightSockTop);
  const rightSockBottom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.094, 0.086, 0.42, 12),
    materials.sockBottom
  );
  rightSockBottom.position.y = -0.65;
  rightSockBottom.castShadow = true;
  rightLegPivot.add(rightSockBottom);
  createShoe(rightLegPivot, 1, materials);
  bodyRoot.add(rightLegPivot);

  let jerseyNumber = 23;
  let numberTexture = createJerseyNumberTexture(jerseyNumber);
  const numberMaterial = new THREE.MeshStandardMaterial({
    map: numberTexture,
    transparent: true,
    roughness: 0.45,
    metalness: 0.02,
  });

  const numberFront = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.045), numberMaterial);
  numberFront.position.set(0, 1.18, 0.23);
  numberFront.castShadow = true;
  bodyRoot.add(numberFront);

  const numberBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.045), numberMaterial);
  numberBack.position.set(0, 1.18, -0.23);
  numberBack.castShadow = true;
  bodyRoot.add(numberBack);

  scene.add(group);

  let animTime = 0;
  let shootBlend = 0;
  let celebrateBlend = 0;
  let jumpOffsetY = 0;
  let firstPersonMode = false;
  let shootActionTimer = 0;
  let celebrateActionTimer = 0;

  const currentPose = {
    leftLegX: 0,
    rightLegX: 0,
    leftArmX: 0,
    rightArmX: 0,
    torsoX: 0,
    torsoY: 0,
    headX: 0,
  };

  const targetPose = {
    leftLegX: 0,
    rightLegX: 0,
    leftArmX: 0,
    rightArmX: 0,
    torsoX: 0,
    torsoY: 0,
    headX: 0,
  };

  function resetTargetPose() {
    targetPose.leftLegX = 0;
    targetPose.rightLegX = 0;
    targetPose.leftArmX = 0;
    targetPose.rightArmX = 0;
    targetPose.torsoX = 0;
    targetPose.torsoY = 0;
    targetPose.headX = 0;
  }

  function setPositionAndYaw(position, yaw) {
    group.position.copy(position);
    group.position.y = Math.max(0, jumpOffsetY);
    group.rotation.y = yaw;
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
  }

  function resetJumpOffset() {
    jumpOffsetY = 0;
    group.position.y = 0;
  }

  function getBallAnchor(out) {
    out.set(0.12, -0.5, 0.16);
    return rightArmPivot.localToWorld(out);
  }

  function getReleaseAnchor(out) {
    out.set(0.04, -0.34, 0.5);
    return rightArmPivot.localToWorld(out);
  }

  function getHeadAnchor(out) {
    out.set(0, 0, 0);
    return head.localToWorld(out);
  }

  function update(delta, animContext = {}) {
    animTime += delta;
    shootActionTimer = Math.max(0, shootActionTimer - delta);
    celebrateActionTimer = Math.max(0, celebrateActionTimer - delta);
    resetTargetPose();

    const isCelebrating = celebrateBlend > 0.001 || animContext.isCelebrating || celebrateActionTimer > 0;
    const isShooting =
      shootBlend > 0.001 || animContext.isCharging || animContext.isShootingSequence || shootActionTimer > 0;

    if (isCelebrating) {
      const blend = THREE.MathUtils.clamp(
        Math.max(celebrateBlend, animContext.isCelebrating ? 1 : 0, celebrateActionTimer > 0 ? 0.9 : 0),
        0,
        1
      );
      targetPose.leftArmX = -2.2 * blend;
      targetPose.rightArmX = -2.2 * blend;
      targetPose.torsoX = -0.28 * blend;
      targetPose.headX = Math.sin(animTime * 12) * 0.16 * blend;
      targetPose.leftLegX = Math.sin(animTime * 6) * 0.1 * blend;
      targetPose.rightLegX = -Math.sin(animTime * 6) * 0.1 * blend;
      targetPose.torsoY = Math.sin(animTime * 8) * 0.08 * blend;
    } else if (isShooting) {
      const blend = THREE.MathUtils.clamp(
        Math.max(shootBlend, animContext.isCharging ? 0.4 : 0, animContext.isShootingSequence ? 1 : 0),
        0,
        1
      );
      targetPose.leftArmX = -1.85 * blend;
      targetPose.rightArmX = -1.95 * blend;
      targetPose.torsoX = 0.06 * blend;
      targetPose.leftLegX = -0.1 * blend;
      targetPose.rightLegX = -0.1 * blend;
    } else if (animContext.isMoving && animContext.hasBall) {
      const swing = Math.sin(animTime * 10);
      targetPose.leftLegX = swing * 0.45;
      targetPose.rightLegX = -swing * 0.45;
      targetPose.leftArmX = -swing * 0.2;
      targetPose.rightArmX = Math.sin(animTime * 10) * 0.3 - 0.5;
      targetPose.torsoX = Math.sin(animTime * 5) * 0.04;
    } else if (animContext.isMoving) {
      const swing = Math.sin(animTime * 9);
      targetPose.leftLegX = swing * 0.42;
      targetPose.rightLegX = -swing * 0.42;
      targetPose.leftArmX = -swing * 0.28;
      targetPose.rightArmX = swing * 0.28;
    } else if (animContext.hasBall) {
      targetPose.rightArmX = Math.sin(animTime * 8) * 0.42 - 0.32;
      targetPose.leftArmX = Math.sin(animTime * 6 + Math.PI * 0.25) * 0.08;
      targetPose.torsoX = Math.sin(animTime * 4) * 0.03;
    }

    const alpha = 1 - Math.exp(-delta * 8);
    currentPose.leftLegX = lerpValue(currentPose.leftLegX, targetPose.leftLegX, alpha);
    currentPose.rightLegX = lerpValue(currentPose.rightLegX, targetPose.rightLegX, alpha);
    currentPose.leftArmX = lerpValue(currentPose.leftArmX, targetPose.leftArmX, alpha);
    currentPose.rightArmX = lerpValue(currentPose.rightArmX, targetPose.rightArmX, alpha);
    currentPose.torsoX = lerpValue(currentPose.torsoX, targetPose.torsoX, alpha);
    currentPose.torsoY = lerpValue(currentPose.torsoY, targetPose.torsoY, alpha);
    currentPose.headX = lerpValue(currentPose.headX, targetPose.headX, alpha);

    leftLegPivot.rotation.x = currentPose.leftLegX;
    rightLegPivot.rotation.x = currentPose.rightLegX;
    leftArmPivot.rotation.x = currentPose.leftArmX;
    rightArmPivot.rotation.x = currentPose.rightArmX;
    torso.rotation.x = currentPose.torsoX;
    torso.rotation.y = currentPose.torsoY;
    head.rotation.x = currentPose.headX;
    pelvis.rotation.x = currentPose.torsoX * 0.35;
    pelvis.rotation.y = currentPose.torsoY * 0.6;

    bodyRoot.visible = !firstPersonMode;
  }

  function triggerShoot() {
    shootActionTimer = 0.45;
    shootBlend = Math.max(shootBlend, 0.6);
    return true;
  }

  function triggerCelebrate() {
    celebrateActionTimer = 0.9;
    celebrateBlend = Math.max(celebrateBlend, 1);
    return true;
  }

  function isAnimatedReady() {
    return true;
  }

  function setFirstPersonMode(enabled) {
    firstPersonMode = !!enabled;
  }

  function setJerseyColor(colorValue) {
    materials.jersey.color.set(normalizeColorValue(colorValue, 0x1b5e20));
  }

  function setShortsColor(colorValue) {
    materials.shorts.color.set(normalizeColorValue(colorValue, 0x111111));
  }

  function setJerseyNumber(number) {
    const parsed = Number.parseInt(number, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = THREE.MathUtils.clamp(parsed, 1, 99);
    jerseyNumber = clamped;

    const nextTexture = createJerseyNumberTexture(jerseyNumber);
    numberTexture.dispose();
    numberTexture = nextTexture;
    numberMaterial.map = numberTexture;
    numberMaterial.needsUpdate = true;
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
    getHeadAnchor,
    triggerShoot,
    triggerCelebrate,
    isAnimatedReady,
    setFirstPersonMode,
    setJerseyColor,
    setShortsColor,
    setJerseyNumber,
  };
}
