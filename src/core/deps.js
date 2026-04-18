import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js";

const CANNON = window.CANNON;

if (!CANNON) {
  throw new Error("Cannon.js 0.6.2 não foi carregado antes do main.js.");
}

export { THREE, CANNON };
