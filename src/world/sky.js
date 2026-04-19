import { THREE } from "../core/deps.js";

function createCloudCluster() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
  });
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i += 1) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 0.7, 12, 10), material);
    bubble.position.set(i * 1.1 - 1.1, Math.random() * 0.45, (Math.random() - 0.5) * 0.8);
    group.add(bubble);
  }
  group.userData.material = material;
  group.userData.speed = 0.16 + Math.random() * 0.14;
  return group;
}

function createStarsPoints(count = 800) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = 150;
    positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[i * 3 + 1] = Math.cos(phi) * radius;
    positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function createSky(scene) {
  const uniforms = {
    uDayNight: { value: 0 },
    uDayZenith: { value: new THREE.Color("#1565C0") },
    uDayHorizon: { value: new THREE.Color("#87CEEB") },
    uNightZenith: { value: new THREE.Color("#020210") },
    uNightHorizon: { value: new THREE.Color("#0A0A2A") },
  };

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform float uDayNight;
        uniform vec3 uDayZenith;
        uniform vec3 uDayHorizon;
        uniform vec3 uNightZenith;
        uniform vec3 uNightHorizon;
        void main() {
          float h = normalize(vWorldPos).y * 0.5 + 0.5;
          float blendH = smoothstep(0.0, 1.0, h);
          vec3 dayCol = mix(uDayHorizon, uDayZenith, blendH);
          vec3 nightCol = mix(uNightHorizon, uNightZenith, blendH);
          vec3 sky = mix(dayCol, nightCol, uDayNight);
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    })
  );
  scene.add(dome);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 20, 18),
    new THREE.MeshBasicMaterial({ color: 0xffc247, transparent: true, opacity: 1 })
  );
  scene.add(sun);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 20, 18),
    new THREE.MeshBasicMaterial({ color: 0xdde3f3, transparent: true, opacity: 0 })
  );
  scene.add(moon);

  const starsMaterial = new THREE.PointsMaterial({
    color: 0xf2f7ff,
    size: 0.3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(createStarsPoints(800), starsMaterial);
  scene.add(stars);

  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    const cloud = createCloudCluster();
    cloud.position.set(-28 + i * 7.2, 18 + (i % 3) * 2.3, -14 + (i % 4) * 7.5);
    clouds.push(cloud);
    scene.add(cloud);
  }

  function setDayNightBlend(t) {
    const blend = THREE.MathUtils.clamp(t, 0, 1);
    uniforms.uDayNight.value = blend;

    const sunFade = 1 - THREE.MathUtils.smoothstep(blend, 0.28, 0.62);
    const moonFade = THREE.MathUtils.smoothstep(blend, 0.48, 0.72);
    const starsFade = THREE.MathUtils.smoothstep(blend, 0.5, 0.75);
    const cloudFade = 1 - THREE.MathUtils.smoothstep(blend, 0.32, 0.6);

    sun.position.set(
      THREE.MathUtils.lerp(18, 7, blend),
      THREE.MathUtils.lerp(40, -10, blend),
      THREE.MathUtils.lerp(-50, -25, blend)
    );
    sun.material.opacity = sunFade;
    sun.visible = sunFade > 0.01;

    moon.position.set(
      THREE.MathUtils.lerp(-20, -12, blend),
      THREE.MathUtils.lerp(-10, 35, blend),
      THREE.MathUtils.lerp(-70, -45, blend)
    );
    moon.material.opacity = moonFade;
    moon.visible = moonFade > 0.01;

    starsMaterial.opacity = 0.9 * starsFade;
    stars.visible = starsMaterial.opacity > 0.01;

    for (const cloud of clouds) {
      cloud.userData.material.opacity = 0.85 * cloudFade;
      cloud.visible = cloud.userData.material.opacity > 0.02;
    }
  }

  function update(delta) {
    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 34) {
        cloud.position.x = -34;
      }
    }
  }

  setDayNightBlend(0);

  return {
    dome,
    sun,
    moon,
    stars,
    clouds,
    update,
    setDayNightBlend,
  };
}
