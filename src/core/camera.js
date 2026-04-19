import { COURT } from "./constants.js";
import { THREE } from "./deps.js";

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

export function createFollowCamera(domElement) {
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  const lookAtTarget = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const rotatedOffset = new THREE.Vector3();
  const rotatedHeadOffset = new THREE.Vector3();
  const cameraToPlayer = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  const toHoop = new THREE.Vector3();
  const headOffset = new THREE.Vector3(0, 1.85, 0.05);

  let mode = "third_person";
  let yaw = 0;
  let targetYaw = 0;
  let flipping = false;

  let fpYaw = 0;
  let fpPitch = 0;
  let pointerLocked = false;

  const shotLockOn = {
    active: false,
    transitioning: false,
    targetYaw: 0,
    targetPitch: 0,
    duration: 0.35,
    elapsed: 0,
  };

  function requestPointerLock() {
    if (domElement && domElement.requestPointerLock) {
      domElement.requestPointerLock();
    }
  }

  function releasePointerLock() {
    if (document.pointerLockElement === domElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === domElement;
  }

  function onMouseMove(event) {
    if (mode !== "first_person" || !pointerLocked || shotLockOn.active) {
      return;
    }

    fpYaw -= event.movementX * 0.002;
    fpPitch -= event.movementY * 0.002;
    fpPitch = THREE.MathUtils.clamp(fpPitch, -Math.PI / 3, Math.PI / 3);
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);

  function updateFirstPerson(position, delta, playerYaw) {
    if (shotLockOn.active) {
      const lockAlpha = 1 - Math.exp(-delta * 12);
      fpYaw = lerpAngle(fpYaw, shotLockOn.targetYaw, lockAlpha);
      fpPitch = THREE.MathUtils.lerp(fpPitch, shotLockOn.targetPitch, lockAlpha);

      if (shotLockOn.transitioning) {
        shotLockOn.elapsed += delta;
        const yawRemaining = Math.abs(wrapAngle(shotLockOn.targetYaw - fpYaw));
        const pitchRemaining = Math.abs(shotLockOn.targetPitch - fpPitch);
        if (shotLockOn.elapsed >= shotLockOn.duration && yawRemaining < 0.01 && pitchRemaining < 0.01) {
          shotLockOn.transitioning = false;
        }
      } else {
        fpYaw = shotLockOn.targetYaw;
        fpPitch = shotLockOn.targetPitch;
      }
    }

    rotatedHeadOffset.copy(headOffset).applyAxisAngle(upAxis, playerYaw);
    camera.position.copy(position).add(rotatedHeadOffset);
    camera.rotation.set(fpPitch, fpYaw, 0, "YXZ");
  }

  function updateThirdPerson(position, offset, delta) {
    if (flipping) {
      const yawAlpha = 1 - Math.exp(-delta * 3);
      yaw = lerpAngle(yaw, targetYaw, yawAlpha);
      const remaining = Math.abs(wrapAngle(targetYaw - yaw));
      if (remaining < 0.01) {
        yaw = wrapAngle(targetYaw);
        flipping = false;
      }
    }

    rotatedOffset.set(offset.x, offset.y, offset.z).applyAxisAngle(upAxis, yaw);
    desiredPosition.copy(rotatedOffset).add(position);

    const followAlpha = 1 - Math.exp(-delta * 8);
    camera.position.lerp(desiredPosition, followAlpha);
    camera.position.y = Math.max(1.2, camera.position.y);
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -COURT.halfWidth - 1, COURT.halfWidth + 1);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -COURT.halfLength - 1, COURT.halfLength + 1);

    lookAtTarget.copy(position);
    lookAtTarget.y += 1.2;
    camera.lookAt(lookAtTarget);
  }

  function update(position, offset, delta, playerYaw = 0) {
    if (mode === "first_person") {
      updateFirstPerson(position, delta, playerYaw);
      return;
    }
    updateThirdPerson(position, offset, delta);
  }

  function requestHalfCourtFlip() {
    if (mode !== "third_person" || flipping) {
      return false;
    }
    targetYaw = wrapAngle(targetYaw + Math.PI);
    flipping = true;
    return true;
  }

  function getForwardXZ(playerPosition, out = new THREE.Vector3()) {
    if (mode === "first_person") {
      out.set(Math.sin(fpYaw), 0, Math.cos(fpYaw));
      return out.normalize();
    }

    cameraToPlayer.copy(playerPosition).sub(camera.position);
    cameraToPlayer.y = 0;
    if (cameraToPlayer.lengthSq() < 0.0001) {
      out.set(Math.sin(yaw), 0, Math.cos(yaw));
    } else {
      out.copy(cameraToPlayer).normalize();
    }
    return out;
  }

  function togglePerspective(playerYaw = 0) {
    if (mode === "third_person") {
      mode = "first_person";
      fpYaw = playerYaw;
      fpPitch = 0;
      shotLockOn.active = false;
      shotLockOn.transitioning = false;
      requestPointerLock();
      return mode;
    }

    mode = "third_person";
    shotLockOn.active = false;
    shotLockOn.transitioning = false;
    releasePointerLock();
    return mode;
  }

  function isFirstPerson() {
    return mode === "first_person";
  }

  function startShotLockOn(hoopCenter, headPosition) {
    if (mode !== "first_person" || !hoopCenter || !headPosition) {
      return false;
    }

    toHoop.set(hoopCenter.x - headPosition.x, hoopCenter.y - headPosition.y, hoopCenter.z - headPosition.z);
    const horizontalLen = Math.max(0.0001, Math.hypot(toHoop.x, toHoop.z));

    shotLockOn.targetYaw = Math.atan2(toHoop.x, toHoop.z);
    shotLockOn.targetPitch = -Math.atan2(toHoop.y, horizontalLen);
    shotLockOn.duration = 0.35;
    shotLockOn.elapsed = 0;
    shotLockOn.active = true;
    shotLockOn.transitioning = true;

    requestPointerLock();
    return true;
  }

  function endShotLockOn() {
    if (!shotLockOn.active) {
      return;
    }
    shotLockOn.active = false;
    shotLockOn.transitioning = false;
  }

  function isShotLockOnActive() {
    return shotLockOn.active;
  }

  function getLockOnYaw() {
    if (mode !== "first_person" || !shotLockOn.active) {
      return null;
    }
    return fpYaw;
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return {
    camera,
    update,
    requestHalfCourtFlip,
    getForwardXZ,
    togglePerspective,
    isFirstPerson,
    startShotLockOn,
    endShotLockOn,
    isShotLockOnActive,
    getLockOnYaw,
    resize,
  };
}
