/*
  ICG 2025/2026 - Mini-Jogo de Basquetebol 3D
  Fontes externas referenciadas:
  - Mixamo (Adobe) para personagem/animacoes FBX: https://www.mixamo.com
  - OpenAI ChatGPT para apoio ao desenvolvimento.
*/

import { PLAYER_ANIMATION } from "../core/constants.js";
import { THREE } from "../core/deps.js";

const CLIP_NAMES = ["idle", "walk", "dribble", "shoot", "celebrate"];
const FBX_LOADER_MODULE_URL = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/jsm/loaders/FBXLoader.js";
const tempAnchorOffset = new THREE.Vector3();
const tempHandQuat = new THREE.Quaternion();

function createFallbackPlayer() {
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

  return {
    group,
    setShootingPose(blend) {
      const clamped = THREE.MathUtils.clamp(blend, 0, 1);
      const lift = -1.9 * clamped;
      leftArmPivot.rotation.x = lift;
      rightArmPivot.rotation.x = lift;
    },
    setCelebratePose(blend) {
      const clamped = THREE.MathUtils.clamp(blend, 0, 1);
      leftArmPivot.rotation.x = -2.2 * clamped;
      rightArmPivot.rotation.x = -2.2 * clamped;
    },
    getBallAnchor(out) {
      out.set(0.48, 1.12, 0.6);
      return group.localToWorld(out);
    },
    getReleaseAnchor(out) {
      out.set(0.18, 1.95, 0.74);
      return group.localToWorld(out);
    },
  };
}

function findBone(root, name) {
  let exactMatch = null;
  let partialMatch = null;
  root.traverse((node) => {
    if (exactMatch || !node.isBone) {
      return;
    }
    if (node.name === name) {
      exactMatch = node;
      return;
    }
    if (!partialMatch && node.name.toLowerCase().includes(name.toLowerCase())) {
      partialMatch = node;
    }
  });
  return exactMatch || partialMatch;
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const fallback = createFallbackPlayer();
  group.add(fallback.group);

  const animatedContainer = new THREE.Group();
  animatedContainer.rotation.y = PLAYER_ANIMATION.modelYawOffset;
  animatedContainer.visible = false;
  group.add(animatedContainer);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.45, 28),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.01;

  scene.add(group);
  scene.add(shadowBlob);

  let mixer = null;
  let currentActionName = null;
  let currentAction = null;
  let activeOneShot = null;
  let desiredLocomotion = "idle";
  let animatedReady = false;
  let rightHandBone = null;

  const actions = new Map();
  let loader = null;
  const handBallOffset = new THREE.Vector3(0.03, -0.06, 0.12);
  const handReleaseOffset = new THREE.Vector3(0.01, 0.08, 0.26);

  function getAssetPath(name) {
    return PLAYER_ANIMATION.assetPaths[name];
  }

  function loadFBX(path) {
    if (!loader) {
      return Promise.reject(new Error("FBXLoader nao inicializado."));
    }
    return new Promise((resolve, reject) => {
      loader.load(path, resolve, undefined, reject);
    });
  }

  function prepareCharacter(character) {
    character.scale.setScalar(PLAYER_ANIMATION.scale);
    character.position.set(0, 0, 0);
    character.traverse((node) => {
      if (!node.isMesh) {
        return;
      }
      node.castShadow = true;
      node.receiveShadow = true;
    });
    rightHandBone = findBone(character, "mixamorigRightHand") || findBone(character, "RightHand");
    animatedContainer.add(character);
  }

  function configureActions(clipMap) {
    mixer = new THREE.AnimationMixer(animatedContainer);
    mixer.addEventListener("finished", (event) => {
      if (!activeOneShot) {
        return;
      }
      const oneShotAction = actions.get(activeOneShot.name);
      if (event.action !== oneShotAction) {
        return;
      }
      const blendOutSec = activeOneShot.blendOutSec;
      activeOneShot = null;
      playAction(desiredLocomotion, blendOutSec, false);
    });

    for (const clipName of CLIP_NAMES) {
      const clip = clipMap[clipName];
      if (!clip) {
        continue;
      }
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setLoop(
        clipName === "shoot" || clipName === "celebrate" ? THREE.LoopOnce : THREE.LoopRepeat,
        clipName === "shoot" || clipName === "celebrate" ? 1 : Infinity
      );
      action.clampWhenFinished = clipName === "shoot" || clipName === "celebrate";
      actions.set(clipName, action);
    }
  }

  function playAction(name, fadeSec, forceReset) {
    const nextAction = actions.get(name);
    if (!nextAction) {
      return false;
    }

    if (!forceReset && currentActionName === name && currentAction === nextAction) {
      return true;
    }

    if (currentAction && currentAction !== nextAction) {
      nextAction.reset();
      nextAction.play();
      nextAction.crossFadeFrom(currentAction, fadeSec, false);
    } else {
      if (forceReset) {
        nextAction.reset();
      }
      nextAction.play();
    }

    currentActionName = name;
    currentAction = nextAction;
    return true;
  }

  function pickLocomotion(animContext) {
    if (animContext.hasBall && animContext.isMoving) {
      return "dribble";
    }
    if (animContext.isMoving) {
      return "walk";
    }
    return "idle";
  }

  function triggerOneShot(name, blendInSec) {
    if (!animatedReady || !actions.has(name)) {
      return false;
    }
    activeOneShot = {
      name,
      blendOutSec: PLAYER_ANIMATION.oneShotBlendOutSec,
    };
    return playAction(name, blendInSec, true);
  }

  async function initAnimatedPlayer() {
    if (!PLAYER_ANIMATION.enabled) {
      return;
    }

    try {
      const loaderModule = await import(FBX_LOADER_MODULE_URL);
      if (!loaderModule || !loaderModule.FBXLoader) {
        throw new Error("Modulo FBXLoader indisponivel.");
      }
      loader = new loaderModule.FBXLoader();

      const character = await loadFBX(getAssetPath("character"));
      prepareCharacter(character);

      const clipMap = {};
      for (const clipName of CLIP_NAMES) {
        const clipAsset = await loadFBX(getAssetPath(clipName));
        if (clipAsset.animations && clipAsset.animations.length > 0) {
          const clip = clipAsset.animations[0].clone();
          clip.name = clipName;
          clipMap[clipName] = clip;
        }
      }

      if (!clipMap.idle || !clipMap.walk || !clipMap.dribble) {
        throw new Error("Conjunto de clips Mixamo incompleto (idle/walk/dribble sao obrigatorios).");
      }

      configureActions(clipMap);
      playAction("idle", 0.01, true);
      animatedReady = true;
      fallback.group.visible = false;
      animatedContainer.visible = true;
      console.info("[player] Mixamo rig ativo.");
    } catch (error) {
      animatedReady = false;
      fallback.group.visible = true;
      animatedContainer.visible = false;
      console.warn("[player] Nao foi possivel carregar o rig Mixamo. Mantido fallback procedural.", error);
    }
  }

  function setPositionAndYaw(position, yaw) {
    group.position.copy(position);
    group.rotation.y = yaw;
    shadowBlob.position.set(position.x, 0.01, position.z);
  }

  function setShootingPose(blend) {
    if (animatedReady) {
      return;
    }
    fallback.setShootingPose(blend);
  }

  function setCelebratePose(blend) {
    if (animatedReady) {
      return;
    }
    fallback.setCelebratePose(blend);
  }

  function setJumpOffset(offsetY) {
    if (animatedReady) {
      return;
    }
    group.position.y = Math.max(0, offsetY);
    shadowBlob.material.opacity = 0.3 - Math.min(0.18, offsetY * 0.8);
  }

  function resetJumpOffset() {
    if (animatedReady) {
      shadowBlob.material.opacity = 0.3;
      return;
    }
    group.position.y = 0;
    shadowBlob.material.opacity = 0.3;
  }

  function getHandAnchoredPoint(out, localOffset, fallbackAnchorFn) {
    if (!rightHandBone) {
      return fallbackAnchorFn(out);
    }
    rightHandBone.getWorldPosition(out);
    rightHandBone.getWorldQuaternion(tempHandQuat);
    tempAnchorOffset.copy(localOffset).applyQuaternion(tempHandQuat);
    out.add(tempAnchorOffset);
    return out;
  }

  function getBallAnchor(out) {
    if (!animatedReady) {
      return fallback.getBallAnchor(out);
    }
    return getHandAnchoredPoint(out, handBallOffset, fallback.getBallAnchor);
  }

  function getReleaseAnchor(out) {
    if (!animatedReady) {
      return fallback.getReleaseAnchor(out);
    }
    return getHandAnchoredPoint(out, handReleaseOffset, fallback.getReleaseAnchor);
  }

  function update(delta, animContext) {
    if (!animatedReady || !mixer) {
      return;
    }

    desiredLocomotion = pickLocomotion(animContext);
    if (!activeOneShot) {
      playAction(desiredLocomotion, PLAYER_ANIMATION.crossFadeSec, false);
    }
    mixer.update(delta);
  }

  function triggerShoot() {
    return triggerOneShot("shoot", PLAYER_ANIMATION.shootBlendInSec);
  }

  function triggerCelebrate() {
    return triggerOneShot("celebrate", PLAYER_ANIMATION.celebrateBlendInSec);
  }

  function isAnimatedReady() {
    return animatedReady;
  }

  initAnimatedPlayer();

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
  };
}
