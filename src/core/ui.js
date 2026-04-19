function createPalette(container, colors, onPick) {
  if (!container) {
    return;
  }

  colors.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.dataset.color = color;
    swatch.style.background = color;
    if (index === 0) {
      swatch.classList.add("active");
    }

    swatch.addEventListener("click", () => {
      container.querySelectorAll(".color-swatch").forEach((node) => node.classList.remove("active"));
      swatch.classList.add("active");
      onPick(color);
    });

    container.appendChild(swatch);
  });
}

export function createHUD(options = {}) {
  const scoreValue = document.getElementById("score-value");
  const shotsMadeValue = document.getElementById("shots-made-value");
  const fgValue = document.getElementById("fg-value");
  const twoPointValue = document.getElementById("two-point-value");
  const threePointValue = document.getElementById("three-point-value");
  const zoneIndicator = document.getElementById("zone-indicator");
  const powerWrapper = document.getElementById("power-wrapper");
  const timingLabel = document.getElementById("timing-label");
  const perfectZone = document.getElementById("perfect-zone");
  const powerFill = document.getElementById("power-fill");
  const perfectText = document.getElementById("perfect-text");
  const feedbackLayer = document.getElementById("feedback-layer");
  const flashOverlay = document.getElementById("flash-overlay");
  const controlsPanel = document.getElementById("controls-panel");
  const dayNightBadge = document.getElementById("day-night-badge");

  const customizeButton = document.getElementById("customize-btn");
  const customizePanel = document.getElementById("customize-panel");
  const jerseyColorsRoot = document.getElementById("jersey-colors");
  const shortsColorsRoot = document.getElementById("shorts-colors");
  const ballColorsRoot = document.getElementById("ball-colors");
  const numDownButton = document.getElementById("num-down");
  const numUpButton = document.getElementById("num-up");
  const numDisplay = document.getElementById("num-display");

  const onJerseyColor = options.onJerseyColor ?? (() => {});
  const onShortsColor = options.onShortsColor ?? (() => {});
  const onBallColor = options.onBallColor ?? (() => {});
  const onNumberChange = options.onNumberChange ?? (() => {});

  const jerseyPalette = ["#1B5E20", "#2E7D32", "#14532d", "#004d40", "#0B7285", "#5f3dc4", "#8d1f1f", "#111111"];
  const shortsPalette = ["#111111", "#1f2937", "#374151", "#0f172a", "#3a0ca3", "#7f1d1d", "#14532d", "#1B5E20"];
  const ballPalette = ["#DD7D2A", "#111111", "#F5F5F5", "#C1121F", "#1D4ED8", "#6D28D9"];

  let currentNumber = 23;
  if (numDisplay) {
    numDisplay.textContent = String(currentNumber);
  }

  if (customizeButton && customizePanel) {
    customizeButton.addEventListener("click", () => {
      customizePanel.classList.toggle("hidden");
    });
  }

  createPalette(jerseyColorsRoot, jerseyPalette, onJerseyColor);
  createPalette(shortsColorsRoot, shortsPalette, onShortsColor);
  createPalette(ballColorsRoot, ballPalette, onBallColor);

  if (numDownButton) {
    numDownButton.addEventListener("click", () => {
      currentNumber = Math.max(1, currentNumber - 1);
      if (numDisplay) {
        numDisplay.textContent = String(currentNumber);
      }
      onNumberChange(currentNumber);
    });
  }

  if (numUpButton) {
    numUpButton.addEventListener("click", () => {
      currentNumber = Math.min(99, currentNumber + 1);
      if (numDisplay) {
        numDisplay.textContent = String(currentNumber);
      }
      onNumberChange(currentNumber);
    });
  }

  function powerColor(power) {
    if (power < 0.5) {
      return "#e63946";
    }
    if (power < 0.75) {
      return "#f5b700";
    }
    if (power <= 0.9) {
      return "#49d17c";
    }
    return "#e63946";
  }

  function setPower(value, visible) {
    powerWrapper.classList.toggle("hidden", !visible);
    if (!visible) {
      powerFill.style.width = "0%";
      perfectText.classList.remove("active");
      return;
    }
    const pct = Math.max(0, Math.min(1, value));
    powerFill.style.width = `${pct * 100}%`;
    powerFill.style.background = powerColor(pct);
  }

  function setPerfectActive(active) {
    perfectText.classList.toggle("active", active);
  }

  function setTimingLabel(text = "PRECISAO") {
    if (timingLabel) {
      timingLabel.textContent = text;
    }
  }

  function setTimingWindow(min, max) {
    if (!perfectZone) {
      return;
    }
    const clampedMin = Math.max(0, Math.min(1, min));
    const clampedMax = Math.max(clampedMin, Math.min(1, max));
    perfectZone.style.left = `${clampedMin * 100}%`;
    perfectZone.style.width = `${(clampedMax - clampedMin) * 100}%`;
  }

  function updateStats(stats) {
    scoreValue.textContent = String(stats.score);
    shotsMadeValue.textContent = `Cestos: ${stats.makes}/${stats.attempts}`;
    const fg = stats.attempts > 0 ? (stats.makes / stats.attempts) * 100 : 0;
    fgValue.textContent = `FG: ${fg.toFixed(1)}%`;
    twoPointValue.textContent = `2PT: ${stats.twoPointMakes}`;
    threePointValue.textContent = `3PT: ${stats.threePointMakes}`;
  }

  function setZoneIndicator(isThreePoint) {
    zoneIndicator.textContent = isThreePoint ? "ZONA DE 3 PONTOS" : "ZONA DE 2 PONTOS";
  }

  function showScoreFeedback(text, worldPosition, camera) {
    const projected = worldPosition.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

    const label = document.createElement("div");
    label.className = "score-feedback";
    label.textContent = text;
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
    feedbackLayer.appendChild(label);
    window.setTimeout(() => {
      label.remove();
    }, 900);
  }

  function flashSuccess() {
    flashOverlay.classList.remove("flash");
    void flashOverlay.offsetWidth;
    flashOverlay.classList.add("flash");
  }

  function toggleControlsPanel() {
    controlsPanel.classList.toggle("hidden");
  }

  function setDayNightBadge(mode, transitioning) {
    if (!dayNightBadge) {
      return;
    }

    dayNightBadge.textContent = transitioning ? "TRANSICAO" : mode;
    if (transitioning) {
      dayNightBadge.style.background = "rgba(82, 49, 106, 0.72)";
      return;
    }
    if (mode === "NOITE") {
      dayNightBadge.style.background = "rgba(10, 10, 26, 0.82)";
    } else {
      dayNightBadge.style.background = "rgba(26, 68, 124, 0.72)";
    }
  }

  return {
    setPower,
    setPerfectActive,
    setTimingLabel,
    setTimingWindow,
    updateStats,
    setZoneIndicator,
    showScoreFeedback,
    flashSuccess,
    toggleControlsPanel,
    setDayNightBadge,
  };
}
