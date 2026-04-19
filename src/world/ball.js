import { BALL } from "../core/constants.js";
import { THREE } from "../core/deps.js";

function normalizeColorValue(colorValue, fallback = "#dd7d2a") {
  if (typeof colorValue === "string" && colorValue.trim().length > 0) {
    return colorValue;
  }
  if (typeof colorValue === "number") {
    return `#${colorValue.toString(16).padStart(6, "0")}`;
  }
  return fallback;
}

function createBasketballTextureData(baseColor = "#dd7d2a") {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;

  function draw(color) {
    const normalizedColor = normalizeColorValue(color);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = normalizedColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#1b1b1b";
    ctx.lineWidth = 28;

    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.5);
    ctx.lineTo(canvas.width, canvas.height * 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.5, 0);
    ctx.lineTo(canvas.width * 0.5, canvas.height);
    ctx.stroke();

    function drawArc(cx, cy, radius, start, end) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, end);
      ctx.stroke();
    }

    drawArc(canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.85, Math.PI * 0.78, Math.PI * 1.22);
    drawArc(canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.85, -Math.PI * 0.22, Math.PI * 0.22);
    drawArc(canvas.width * 0.1, canvas.height * 0.5, canvas.width * 0.6, -Math.PI * 0.22, Math.PI * 0.22);
    drawArc(canvas.width * 0.9, canvas.height * 0.5, canvas.width * 0.6, Math.PI * 0.78, Math.PI * 1.22);

    texture.needsUpdate = true;
  }

  draw(baseColor);

  return {
    texture,
    draw,
  };
}

export function createBasketballMesh(scene) {
  const textureData = createBasketballTextureData("#dd7d2a");
  const ballMaterial = new THREE.MeshStandardMaterial({
    map: textureData.texture,
    roughness: 0.55,
    metalness: 0.04,
  });

  const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL.radius, 32, 24), ballMaterial);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  ballMesh.setBaseColor = (colorValue) => {
    textureData.draw(colorValue);
  };

  scene.add(ballMesh);
  return ballMesh;
}

export function createDribbleState() {
  return {
    time: 0,
    delayedX: 0,
    delayedZ: 0,
    wasNearFloor: false,
  };
}

export function updateDribble(dt, playerPose, ballMesh, dribbleState) {
  const targetFrequency = playerPose.isMoving ? BALL.dribbleMoveFrequency : BALL.dribbleBaseFrequency;
  dribbleState.time += dt * targetFrequency * Math.PI * 2;

  const wave = Math.abs(Math.sin(dribbleState.time));
  const y = THREE.MathUtils.lerp(BALL.dribbleMinY, BALL.dribbleMaxY, wave);

  const offset = new THREE.Vector3(0.5, y, 0.66);
  offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerPose.yaw);

  const targetX = playerPose.position.x + offset.x;
  const targetZ = playerPose.position.z + offset.z;

  if (dribbleState.time < 0.03) {
    dribbleState.delayedX = targetX;
    dribbleState.delayedZ = targetZ;
  }

  const positionAlpha = 1 - Math.exp(-dt * 12);
  dribbleState.delayedX = THREE.MathUtils.lerp(dribbleState.delayedX, targetX, positionAlpha);
  dribbleState.delayedZ = THREE.MathUtils.lerp(dribbleState.delayedZ, targetZ, positionAlpha);

  ballMesh.position.set(dribbleState.delayedX, y, dribbleState.delayedZ);
  ballMesh.rotation.x += dt * 8;

  const nearFloor = y <= BALL.dribbleMinY + 0.02;
  const hitGround = nearFloor && !dribbleState.wasNearFloor;
  dribbleState.wasNearFloor = nearFloor;
  return { hitGround };
}
