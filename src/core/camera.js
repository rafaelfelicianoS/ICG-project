import { THREE } from "./deps.js";

export function createFollowCamera() {
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  const lookAtTarget = new THREE.Vector3();
  const desiredPosition = new THREE.Vector3();

  function update(position, yaw, offset, delta) {
    desiredPosition.set(offset.x, offset.y, offset.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    desiredPosition.add(position);

    const followAlpha = 1 - Math.exp(-delta * 8);
    camera.position.lerp(desiredPosition, followAlpha);
    camera.position.y = Math.max(1.2, camera.position.y);

    lookAtTarget.copy(position);
    lookAtTarget.y += 1.2;
    camera.lookAt(lookAtTarget);
  }

  function resize(width, height) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  return { camera, update, resize };
}
