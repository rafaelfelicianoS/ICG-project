import { THREE } from "./deps.js";
import { COURT } from "./constants.js";

function wrapAngle(angle) {
  let a = angle;
  while (a > Math.PI) {
    a -= Math.PI * 2;
  }
  while (a < -Math.PI) {
    a += Math.PI * 2;
  }
  return a;
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
  const headOffset = new THREE.Vector3(0, 1.85, 0.05);

  let mode = "third_person";
  let yaw = 0;
  let targetYaw = 0;
  let flipping = false;
  let fpYaw = 0;
  let fpPitch = 0;
  let pointerLocked = false;

  const lockOn = {
    active: false,
    targetYaw: 0,
    duration: 0.35,
    elapsed: 0,
    postReleaseLock: 0,
  };

  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === domElement;
  }

  function onMouseMove(event) {
    if (mode !== "first_person") {
      return;
    }
    if (!pointerLocked) {
      return;
    }
    if (lockOn.active || lockOn.postReleaseLock > 0) {
      return;
    }

    fpYaw -= event.movementX * 0.002;
    fpPitch -= event.movementY * 0.002;
    fpPitch = THREE.MathUtils.clamp(fpPitch, -Math.PI / 3, Math.PI / 3);
  }

  document.addEventListener("pointerlockchange", onPointerLockChange);
  document.addEventListener("mousemove", onMouseMove);

  function updateFirstPerson(position, delta, playerYaw) {
    if (lockOn.active) {
      lockOn.elapsed += delta;
      const lockAlpha = 1 - Math.exp(-delta * 12);
      fpYaw = lerpAngle(fpYaw, lockOn.targetYaw, lockAlpha);
      fpPitch = THREE.MathUtils.lerp(fpPitch, 0, lockAlpha);
      const finished =
        lockOn.elapsed >= lockOn.duration && Math.abs(wrapAngle(lockOn.targetYaw - fpYaw)) < 0.01;
      if (finished) {
        lockOn.active = false;
      }
    }

    if (lockOn.postReleaseLock > 0) {
      lockOn.postReleaseLock = Math.max(0, lockOn.postReleaseLock - delta);
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
    desiredPosition.copy(rotatedOffset);
    desiredPosition.add(position);

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
    if (mode !== "third_person") {
      return false;
    }
    if (flipping) {
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
      lockOn.active = false;
      lockOn.postReleaseLock = 0;
      if (domElement && domElement.requestPointerLock) {
        domElement.requestPointerLock();
      }
      return mode;
    }

    mode = "third_person";
    lockOn.active = false;
    lockOn.postReleaseLock = 0;
    if (document.pointerLockElement === domElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
    return mode;
  }

  function isFirstPerson() {
    return mode === "first_person";
  }

  function startLockOn(target, duration = 0.35) {
    if (mode !== "first_person") {
      return false;
    }
    lockOn.active = true;
    lockOn.targetYaw = wrapAngle(target);
    lockOn.duration = Math.max(0.01, duration);
    lockOn.elapsed = 0;
    lockOn.postReleaseLock = 0;
    return true;
  }

  function notifyShotReleased() {
    if (mode !== "first_person") {
      return;
    }
    lockOn.active = false;
    lockOn.postReleaseLock = Math.max(lockOn.postReleaseLock, 0.6);
  }

  function getLockOnYaw() {
    if (mode !== "first_person") {
      return null;
    }
    if (!lockOn.active) {
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
    startLockOn,
    notifyShotReleased,
    getLockOnYaw,
    resize,
  };
}
