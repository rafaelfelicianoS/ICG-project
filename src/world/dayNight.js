import { THREE } from "../core/deps.js";

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothRange(t, start, end) {
  if (end <= start) {
    return 0;
  }
  return THREE.MathUtils.smoothstep(t, start, end);
}

function createSkyColor(t) {
  const day = new THREE.Color("#87CEEB");
  const sunset = new THREE.Color("#D17856");
  const dusk = new THREE.Color("#4B3B75");
  const night = new THREE.Color("#0A0A1A");

  const color = new THREE.Color();
  if (t <= 0.3) {
    color.copy(day).lerp(sunset, t / 0.3);
  } else if (t <= 0.55) {
    color.copy(sunset).lerp(dusk, (t - 0.3) / 0.25);
  } else {
    color.copy(dusk).lerp(night, (t - 0.55) / 0.45);
  }
  return color;
}

function createCloud() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });
  const chunkCount = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < chunkCount; i += 1) {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 12, 10), material);
    sphere.position.set(i * 1.15 - 1.2, Math.random() * 0.45, (Math.random() - 0.5) * 0.7);
    group.add(sphere);
  }
  group.userData.material = material;
  group.userData.speed = 0.2 + Math.random() * 0.18;
  return group;
}

function createStars(count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    const radius = 90 + Math.random() * 18;
    const x = Math.cos(theta) * Math.sin(phi) * radius;
    const y = Math.cos(phi) * radius + 10;
    const z = Math.sin(theta) * Math.sin(phi) * radius;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function createDayNightController(scene, lightPoleAnchors) {
  const state = {
    t: 0,
    transitioning: false,
    direction: 1,
    speed: 1 / 8,
  };
  const dayAmbientColor = new THREE.Color("#d4e9ff");
  const nightAmbientColor = new THREE.Color("#1A1A3E");

  const ambientLight = new THREE.AmbientLight(0xd4e9ff, 0.5);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5de, 0.9);
  sunLight.position.set(18, 40, -50);
  sunLight.target.position.set(0, 0, 0);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -24;
  sunLight.shadow.camera.right = 24;
  sunLight.shadow.camera.top = 24;
  sunLight.shadow.camera.bottom = -24;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 120;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const moonLight = new THREE.DirectionalLight(0xaab8d4, 0);
  moonLight.position.set(-20, -10, -45);
  moonLight.target.position.set(0, 0, 0);
  scene.add(moonLight);
  scene.add(moonLight.target);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 22, 20),
    new THREE.MeshBasicMaterial({ color: 0xffa13d, transparent: true, opacity: 1 })
  );
  scene.add(sun);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(2.1, 20, 18),
    new THREE.MeshBasicMaterial({ color: 0xdce2f2, transparent: true, opacity: 0 })
  );
  scene.add(moon);

  const starsMaterial = new THREE.PointsMaterial({
    color: 0xf1f6ff,
    size: 0.38,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(createStars(800), starsMaterial);
  scene.add(stars);

  const clouds = [];
  for (let i = 0; i < 8; i += 1) {
    const cloud = createCloud();
    cloud.position.set(-28 + i * 7.2, 18 + (i % 3) * 2.4, -12 + (i % 4) * 7);
    clouds.push(cloud);
    scene.add(cloud);
  }

  const spotLights = lightPoleAnchors.map((anchor) => {
    const spot = new THREE.SpotLight(0xfff3de, 0, 52, 0.55, 0.38, 1.2);
    spot.position.copy(anchor.position);
    spot.target.position.copy(anchor.target);
    spot.castShadow = true;
    spot.shadow.mapSize.set(512, 512);
    scene.add(spot);
    scene.add(spot.target);
    return { light: spot, anchor };
  });

  function applyState(t) {
    const dayToNight = clamp01(t);
    const cloudFadeOut = smoothRange(dayToNight, 0.3, 0.6);
    const starsFadeIn = smoothRange(dayToNight, 0.5, 0.75);
    const moonFadeIn = smoothRange(dayToNight, 0.45, 0.72);
    const spotFadeIn = smoothRange(dayToNight, 0.7, 1.0);
    const sunFadeOut = 1 - smoothRange(dayToNight, 0.3, 0.62);

    const sky = createSkyColor(dayToNight);
    scene.background = sky;
    if (scene.fog) {
      scene.fog.color.copy(sky);
    }

    ambientLight.color.copy(dayAmbientColor).lerp(nightAmbientColor, dayToNight);
    ambientLight.intensity = THREE.MathUtils.lerp(0.5, 0.15, dayToNight);

    sun.position.set(
      THREE.MathUtils.lerp(18, 8, dayToNight),
      THREE.MathUtils.lerp(40, -10, dayToNight),
      THREE.MathUtils.lerp(-50, -25, dayToNight)
    );
    sun.material.opacity = sunFadeOut;
    sun.visible = sunFadeOut > 0.01;
    sunLight.intensity = 0.9 * sunFadeOut;

    moon.position.set(
      THREE.MathUtils.lerp(-20, -12, dayToNight),
      THREE.MathUtils.lerp(-10, 35, dayToNight),
      THREE.MathUtils.lerp(-45, -45, dayToNight)
    );
    moon.material.opacity = moonFadeIn;
    moon.visible = moonFadeIn > 0.01;
    moonLight.intensity = 0.2 * moonFadeIn;

    starsMaterial.opacity = 0.9 * starsFadeIn;
    stars.visible = starsMaterial.opacity > 0.01;

    clouds.forEach((cloud) => {
      cloud.userData.material.opacity = 0.85 * (1 - cloudFadeOut);
      cloud.visible = cloud.userData.material.opacity > 0.02;
    });

    spotLights.forEach(({ light, anchor }) => {
      light.intensity = 1.8 * spotFadeIn;
      anchor.head.material.emissiveIntensity = 0.35 + spotFadeIn * 1.45;
    });
  }

  function toggle() {
    if (state.transitioning) {
      state.direction *= -1;
      return;
    }
    state.direction = state.t >= 0.5 ? -1 : 1;
    state.transitioning = true;
  }

  function update(delta) {
    if (state.transitioning) {
      state.t = clamp01(state.t + state.direction * state.speed * delta);
      if (state.t === 0 || state.t === 1) {
        state.transitioning = false;
      }
    }

    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * delta;
      if (cloud.position.x > 34) {
        cloud.position.x = -34;
      }
    }

    applyState(state.t);
  }

  function getMode() {
    if (state.transitioning) {
      return "TRANSICAO";
    }
    return state.t >= 0.5 ? "NOITE" : "DIA";
  }

  applyState(0);

  return {
    toggle,
    update,
    getMode,
    getState: () => ({ ...state }),
  };
}
