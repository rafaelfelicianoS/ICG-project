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

export function createFollowCamera() {
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
  const lookAtTarget = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();
  const rotatedOffset = new THREE.Vector3();
  const cameraToPlayer = new THREE.Vector3();
  const upAxis = new THREE.Vector3(0, 1, 0);
  let yaw = 0;
  let targetYaw = 0;
  let flipping = false;

  function update(position, offset, delta) {
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

  function requestHalfCourtFlip() {
    if (flipping) {
      return false;
    }
    targetYaw = wrapAngle(targetYaw + Math.PI);
    flipping = true;
    return true;
  }

  function getForwardXZ(playerPosition, out = new THREE.Vector3()) {
    cameraToPlayer.copy(playerPosition).sub(camera.position);
    cameraToPlayer.y = 0;
    if (cameraToPlayer.lengthSq() < 0.0001) {
      out.set(Math.sin(yaw), 0, Math.cos(yaw));
    } else {
      out.copy(cameraToPlayer).normalize();
    }
    return out;
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return { camera, update, requestHalfCourtFlip, getForwardXZ, resize };
}
