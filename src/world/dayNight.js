import { THREE } from "../core/deps.js";
import { createSky } from "./sky.js";

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function smoothRange(t, start, end) {
  if (end <= start) {
    return 0;
  }
  return THREE.MathUtils.smoothstep(t, start, end);
}

export function createDayNightController(scene, lightPoleAnchors) {
  const state = {
    t: 0,
    transitioning: false,
    direction: 1,
    speed: 1 / 8,
  };

  const sky = createSky(scene);
  const dayFog = new THREE.Color("#87CEEB");
  const nightFog = new THREE.Color("#0A0A1A");
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
    const sunFade = 1 - smoothRange(dayToNight, 0.3, 0.62);
    const moonFade = smoothRange(dayToNight, 0.45, 0.72);
    const spotFade = smoothRange(dayToNight, 0.7, 1.0);

    sky.setDayNightBlend(dayToNight);

    if (scene.fog) {
      scene.fog.color.copy(dayFog).lerp(nightFog, dayToNight);
    } else {
      scene.fog = new THREE.Fog(dayFog.clone().lerp(nightFog, dayToNight), 22, 62);
    }

    ambientLight.color.copy(dayAmbientColor).lerp(nightAmbientColor, dayToNight);
    ambientLight.intensity = THREE.MathUtils.lerp(0.5, 0.15, dayToNight);

    sunLight.position.copy(sky.sun.position);
    sunLight.intensity = 0.9 * sunFade;

    moonLight.position.copy(sky.moon.position);
    moonLight.intensity = 0.2 * moonFade;

    for (const { light, anchor } of spotLights) {
      light.intensity = 1.8 * spotFade;
      anchor.head.material.emissiveIntensity = 0.35 + spotFade * 1.45;
    }
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

    sky.update(delta);
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
    sky,
  };
}
