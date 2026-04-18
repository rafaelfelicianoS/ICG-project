export function createHUD() {
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
