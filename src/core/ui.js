// ─── Dados das skills ────────────────────────────────────────────────────────
const SKILL_DATA = {
  stepBack:     { icon: '↩', name: 'Step Back',     desc: 'Recua explosivamente' },
  ankleBreaker: { icon: '↔', name: 'Ankle Breaker', desc: 'Crossover explosivo'  },
  spinMove:     { icon: '🌀', name: 'Spin Move',     desc: 'Giro 360° para a frente' },
};

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

// ─── Skills HUD ──────────────────────────────────────────────────────────────

function createSkillsHUD(defaultActiveSkills) {
  const container = document.createElement("div");
  container.id = "skills-hud";
  container.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    z-index: 20;
    pointer-events: none;
  `;

  // Slot definitions — use slotKey ('q'/'e') as identifier
  const slotDefs = [
    { slotKey: "q", label: "Q", id: "skill-q" },
    { slotKey: "e", label: "E", id: "skill-e" },
  ];

  const slots = {};

  slotDefs.forEach(({ slotKey, label, id }) => {
    const skillKey = defaultActiveSkills[slotKey];
    const skillInfo = SKILL_DATA[skillKey] || { icon: "?", name: "—" };

    const slot = document.createElement("div");
    slot.style.cssText = `
      position: relative;
      width: 72px;
      height: 72px;
      background: rgba(0,0,0,0.65);
      border: 2px solid rgba(255,255,255,0.25);
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      transition: opacity 0.2s;
    `;

    const keyBadge = document.createElement("div");
    keyBadge.textContent = label;
    keyBadge.style.cssText = `
      position: absolute;
      top: 4px;
      left: 4px;
      width: 16px;
      height: 16px;
      background: rgba(255,255,255,0.18);
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: monospace;
    `;

    const iconEl = document.createElement("div");
    iconEl.textContent = skillInfo.icon;
    iconEl.style.cssText = `
      font-size: 22px;
      line-height: 1;
      color: #fff;
      margin-bottom: 2px;
    `;

    const nameEl = document.createElement("div");
    nameEl.textContent = skillInfo.name;
    nameEl.style.cssText = `
      font-size: 8px;
      color: rgba(255,255,255,0.75);
      text-align: center;
      font-family: sans-serif;
      letter-spacing: 0.3px;
      line-height: 1.1;
    `;

    // Cooldown overlay — covers slot from bottom, shrinks upward as cooldown expires
    const cooldownOverlay = document.createElement("div");
    cooldownOverlay.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 0%;
      background: rgba(0,0,0,0.60);
      transition: height 0.05s linear;
    `;

    slot.appendChild(keyBadge);
    slot.appendChild(iconEl);
    slot.appendChild(nameEl);
    slot.appendChild(cooldownOverlay);
    container.appendChild(slot);

    slots[id] = { slot, cooldownOverlay, iconEl, nameEl, slotKey };
  });

  document.body.appendChild(container);
  return slots;
}

function updateSkillsHUD(slots, activeSkills, skillStates) {
  // activeSkills = { q: 'stepBack', e: 'ankleBreaker' }
  // skillStates  = { stepBack: { cooldownRatio, hasBall }, ankleBreaker: { ... }, spinMove: { ... } }
  for (const slotKey of ['q', 'e']) {
    const id = 'skill-' + slotKey;
    const el = slots[id];
    if (!el) continue;

    const skillKey = activeSkills[slotKey];
    const skillInfo = SKILL_DATA[skillKey] || { icon: '?', name: '—' };

    // Update icon and name dynamically when skill assignment changes
    el.iconEl.textContent = skillInfo.icon;
    el.nameEl.textContent = skillInfo.name;

    const state = skillStates[skillKey] || { cooldownRatio: 0, hasBall: false };
    // Dim when no ball
    el.slot.style.opacity = state.hasBall ? "1" : "0.35";
    // cooldownRatio 0 = ready (overlay hidden), 1 = just used (overlay full)
    el.cooldownOverlay.style.height = (state.cooldownRatio * 100).toFixed(1) + "%";
  }
}

// ─── Skills Panel ─────────────────────────────────────────────────────────────

function createSkillsPanel(onAssign) {
  // ── Button ──
  const btn = document.createElement("button");
  btn.id = "skills-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir painel de skills");
  btn.textContent = "⚡";
  btn.style.cssText = `
    position: absolute;
    top: 9.5rem;
    right: 1rem;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.28);
    background: rgba(13,27,42,0.74);
    color: #ffffff;
    font-size: 1rem;
    cursor: pointer;
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 30;
  `;

  // ── Panel ──
  const panel = document.createElement("div");
  panel.id = "skills-panel";
  panel.style.cssText = `
    position: absolute;
    top: 12.7rem;
    right: 1rem;
    width: min(290px, 92vw);
    border-radius: 12px;
    padding: 0.9rem;
    background: rgba(13,27,42,0.9);
    border: 1px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(4px);
    pointer-events: auto;
    z-index: 30;
    display: none;
  `;

  // Title
  const title = document.createElement("h2");
  title.textContent = "⚡ SKILLS";
  title.style.cssText = `
    margin: 0 0 0.6rem;
    font-size: 0.84rem;
    text-transform: uppercase;
    letter-spacing: 0.08rem;
    color: #d7dfeb;
  `;
  panel.appendChild(title);

  // Slot row: shows current Q and E assignments
  const slotRow = document.createElement("div");
  slotRow.style.cssText = `
    display: flex;
    gap: 10px;
    margin-bottom: 0.75rem;
  `;

  const slotEls = {};
  for (const [slotKey, label, color] of [['q', 'Q', '#3b82f6'], ['e', 'E', '#a855f7']]) {
    const slotBox = document.createElement("div");
    slotBox.style.cssText = `
      flex: 1;
      border: 2px dashed ${color};
      border-radius: 8px;
      padding: 6px 8px;
      text-align: center;
      font-size: 0.75rem;
      color: #d7dfeb;
      min-height: 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
    `;

    const slotLabel = document.createElement("div");
    slotLabel.style.cssText = `
      font-size: 0.65rem;
      color: ${color};
      font-weight: bold;
      font-family: monospace;
      margin-bottom: 2px;
    `;
    slotLabel.textContent = label;

    const slotName = document.createElement("div");
    slotName.style.cssText = `font-size: 0.75rem; color: #d7dfeb;`;

    slotBox.appendChild(slotLabel);
    slotBox.appendChild(slotName);
    slotRow.appendChild(slotBox);
    slotEls[slotKey] = slotName;
  }
  panel.appendChild(slotRow);

  // Divider
  const hr = document.createElement("hr");
  hr.style.cssText = `border: none; border-top: 1px solid rgba(255,255,255,0.12); margin: 0.5rem 0;`;
  panel.appendChild(hr);

  // Section label
  const sectionLabel = document.createElement("div");
  sectionLabel.textContent = "Todas as Skills";
  sectionLabel.style.cssText = `
    font-size: 0.72rem;
    color: #8899aa;
    text-transform: uppercase;
    letter-spacing: 0.05rem;
    margin-bottom: 0.5rem;
  `;
  panel.appendChild(sectionLabel);

  // Track current assignments (starts from localStorage)
  const currentAssignments = {
    q: localStorage.getItem('icg_skill_q') || 'stepBack',
    e: localStorage.getItem('icg_skill_e') || 'ankleBreaker',
  };

  // Update slot display text
  function refreshSlotRow() {
    for (const slotKey of ['q', 'e']) {
      const skillKey = currentAssignments[slotKey];
      const info = SKILL_DATA[skillKey] || { icon: '?', name: '—' };
      slotEls[slotKey].textContent = info.icon + ' ' + info.name;
    }
  }
  refreshSlotRow();

  // Popup reference (only one open at a time)
  let activePopup = null;

  // Build a card for each skill
  const cardEls = {};  // skillKey → { tagQ, tagE }

  Object.entries(SKILL_DATA).forEach(([skillKey, info]) => {
    const card = document.createElement("div");
    card.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 8px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 4px;
      transition: background 0.15s;
      position: relative;
    `;
    card.addEventListener("mouseenter", () => {
      card.style.background = "rgba(255,255,255,0.07)";
    });
    card.addEventListener("mouseleave", () => {
      card.style.background = "";
    });

    // Icon
    const iconDiv = document.createElement("div");
    iconDiv.textContent = info.icon;
    iconDiv.style.cssText = `font-size: 1.3rem; min-width: 28px; text-align: center;`;

    // Text column
    const textCol = document.createElement("div");
    textCol.style.cssText = `flex: 1;`;
    const nameDiv = document.createElement("div");
    nameDiv.textContent = info.name;
    nameDiv.style.cssText = `font-size: 0.8rem; color: #d7dfeb; font-weight: 600;`;
    const descDiv = document.createElement("div");
    descDiv.textContent = info.desc;
    descDiv.style.cssText = `font-size: 0.7rem; color: #7a8fa0; margin-top: 1px;`;
    textCol.appendChild(nameDiv);
    textCol.appendChild(descDiv);

    // Active tags row
    const tagsRow = document.createElement("div");
    tagsRow.style.cssText = `display: flex; gap: 4px; align-items: center;`;

    const tagQ = document.createElement("span");
    tagQ.textContent = "Q";
    tagQ.style.cssText = `
      font-size: 0.65rem; font-weight: bold; padding: 1px 5px;
      border-radius: 4px; background: #3b82f6; color: #fff;
      display: none; font-family: monospace;
    `;
    const tagE = document.createElement("span");
    tagE.textContent = "E";
    tagE.style.cssText = `
      font-size: 0.65rem; font-weight: bold; padding: 1px 5px;
      border-radius: 4px; background: #a855f7; color: #fff;
      display: none; font-family: monospace;
    `;
    tagsRow.appendChild(tagQ);
    tagsRow.appendChild(tagE);
    cardEls[skillKey] = { tagQ, tagE };

    card.appendChild(iconDiv);
    card.appendChild(textCol);
    card.appendChild(tagsRow);
    panel.appendChild(card);

    // Click → inline mini-popup
    card.addEventListener("click", (e) => {
      e.stopPropagation();
      // Close any existing popup
      if (activePopup) { activePopup.remove(); activePopup = null; }

      const popup = document.createElement("div");
      popup.style.cssText = `
        position: absolute;
        right: 0;
        top: 100%;
        background: rgba(13,27,42,0.97);
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 8px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 5px;
        z-index: 50;
        min-width: 130px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      `;

      for (const [slotKey, label, color] of [['q', 'Atribuir a Q', '#3b82f6'], ['e', 'Atribuir a E', '#a855f7']]) {
        const assignBtn = document.createElement("button");
        assignBtn.textContent = label;
        assignBtn.type = "button";
        assignBtn.style.cssText = `
          font-size: 0.75rem;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid ${color};
          background: transparent;
          color: ${color};
          cursor: pointer;
          text-align: left;
        `;
        assignBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();

          // If another skill was in this slot, clear its tag
          const prevSkillKey = currentAssignments[slotKey];
          if (prevSkillKey && cardEls[prevSkillKey]) {
            if (slotKey === 'q') cardEls[prevSkillKey].tagQ.style.display = 'none';
            else                 cardEls[prevSkillKey].tagE.style.display = 'none';
          }
          // If this skill is already in the other slot, swap: move current slot's old skill there
          const otherSlot = slotKey === 'q' ? 'e' : 'q';
          if (currentAssignments[otherSlot] === skillKey) {
            // Swap: put the skill that was in this slot into the other slot
            currentAssignments[otherSlot] = prevSkillKey;
            localStorage.setItem('icg_skill_' + otherSlot, prevSkillKey || '');
            if (onAssign) onAssign(otherSlot, prevSkillKey);
          }

          // Assign
          currentAssignments[slotKey] = skillKey;
          localStorage.setItem('icg_skill_' + slotKey, skillKey);

          // Update card tags
          refreshCardTags();
          refreshSlotRow();

          // Notify main.js
          if (onAssign) onAssign(slotKey, skillKey);

          popup.remove();
          activePopup = null;
        });
        popup.appendChild(assignBtn);
      }

      card.appendChild(popup);
      activePopup = popup;
    });
  });

  // Refresh which tags are visible on all cards
  function refreshCardTags() {
    for (const skillKey of Object.keys(SKILL_DATA)) {
      const { tagQ, tagE } = cardEls[skillKey] || {};
      if (!tagQ) continue;
      tagQ.style.display = currentAssignments.q === skillKey ? 'inline' : 'none';
      tagE.style.display = currentAssignments.e === skillKey ? 'inline' : 'none';
    }
  }
  refreshCardTags();

  // Close popup when clicking outside panel
  document.addEventListener("click", () => {
    if (activePopup) { activePopup.remove(); activePopup = null; }
  });

  // Append to game UI overlay (same parent as customize-btn)
  const uiOverlay = document.querySelector("#ui-overlay") || document.body;
  uiOverlay.appendChild(btn);
  uiOverlay.appendChild(panel);

  let visible = false;
  function toggle() {
    visible = !visible;
    panel.style.display = visible ? "block" : "none";
    // Close customize-panel if open
    const customizePanel = document.getElementById("customize-panel");
    if (visible && customizePanel && !customizePanel.classList.contains("hidden")) {
      customizePanel.classList.add("hidden");
    }
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  return { toggle, hide: () => { visible = false; panel.style.display = "none"; } };
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
  // Read current skill assignments from localStorage so HUD shows correct icons on load
  const defaultActiveSkills = {
    q: localStorage.getItem('icg_skill_q') || 'stepBack',
    e: localStorage.getItem('icg_skill_e') || 'ankleBreaker',
  };
  const skillSlots = createSkillsHUD(defaultActiveSkills);
  const skillsPanel = createSkillsPanel((slot, skillKey) => {
    if (options.onSkillAssign) options.onSkillAssign(slot, skillKey);
  });

  const customizeButton = document.getElementById("customize-btn");
  const customizePanel = document.getElementById("customize-panel");
  const jerseyColorsRoot = document.getElementById("jersey-colors");
  const shortsColorsRoot = document.getElementById("shorts-colors");
  const ballColorsRoot = document.getElementById("ball-colors");
  const shoesColorsRoot = document.getElementById("shoes-colors");
  const rimColorsRoot = document.getElementById("rim-colors");
  const numDownButton = document.getElementById("num-down");
  const numUpButton = document.getElementById("num-up");
  const numDisplay = document.getElementById("num-display");

  const onJerseyColor = options.onJerseyColor ?? (() => {});
  const onShortsColor = options.onShortsColor ?? (() => {});
  const onBallColor = options.onBallColor ?? (() => {});
  const onShoesColor = options.onShoesColor ?? (() => {});
  const onRimColor = options.onRimColor ?? (() => {});
  const onNumberChange = options.onNumberChange ?? (() => {});
  const onReset = options.onReset ?? (() => {});

  const resetButton = document.getElementById("reset-btn");
  if (resetButton) {
    resetButton.addEventListener("click", onReset);
  }

  const jerseyPalette = ["#1B5E20", "#2E7D32", "#14532d", "#004d40", "#0B7285", "#5f3dc4", "#8d1f1f", "#111111"];
  const shortsPalette = ["#111111", "#1f2937", "#374151", "#0f172a", "#3a0ca3", "#7f1d1d", "#14532d", "#1B5E20"];
  const ballPalette = ["#DD7D2A", "#111111", "#F5F5F5", "#C1121F", "#1D4ED8", "#6D28D9"];
  const shoesPalette = ["#111111", "#F5F5F5", "#C1121F", "#1D4ED8", "#1B5E20", "#DD7D2A"];
  const rimPalette = ["#df4d2a", "#F5F5F5", "#111111", "#1D4ED8", "#1B5E20", "#f5b700"];

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
  createPalette(shoesColorsRoot, shoesPalette, onShoesColor);
  createPalette(rimColorsRoot, rimPalette, onRimColor);

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
    // Destaca a zona perfeita da barra com brilho quando o timing está certo
    if (perfectZone) {
      perfectZone.classList.toggle("perfect-active", active);
    }
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

  // ─── Elementos de modo de jogo ───────────────────────────────────────
  const modeButton = document.getElementById("mode-btn");
  const modePanel = document.getElementById("mode-panel");
  const modeOptions = modePanel ? modePanel.querySelectorAll(".mode-option") : [];
  const resultPanel = document.getElementById("result-panel");
  const resultTitle = document.getElementById("result-title");
  const resultBody = document.getElementById("result-body");
  const resultPlayAgain = document.getElementById("result-play-again");
  const modeHud = document.getElementById("mode-hud");
  const modeHudLabel = document.getElementById("mode-hud-label");
  const modeHudValue = document.getElementById("mode-hud-value");

  const onModeChange = options.onModeChange ?? (() => {});
  const onPlayAgain = options.onPlayAgain ?? (() => {});

  if (modeButton && modePanel) {
    modeButton.addEventListener("click", () => {
      modePanel.classList.toggle("hidden");
    });
  }

  modeOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeOptions.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (modePanel) modePanel.classList.add("hidden");
      onModeChange(btn.dataset.mode);
    });
  });

  if (resultPlayAgain) {
    resultPlayAgain.addEventListener("click", () => {
      if (resultPanel) resultPanel.classList.add("hidden");
      onPlayAgain();
    });
  }

  function showResult(title, bodyText) {
    if (!resultPanel) return;
    resultTitle.textContent = title;
    resultBody.innerHTML = bodyText;
    resultPanel.classList.remove("hidden");
  }

  function hideResult() {
    if (resultPanel) resultPanel.classList.add("hidden");
  }

  function setModeHud(label, value) {
    if (!modeHud) return;
    if (label === null) {
      modeHud.classList.add("hidden");
      return;
    }
    modeHud.classList.remove("hidden");
    modeHudLabel.textContent = label;
    modeHudValue.textContent = String(value);
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
    showResult,
    hideResult,
    setModeHud,
    updateSkillsHUD: (activeSkills, skillStates) => updateSkillsHUD(skillSlots, activeSkills, skillStates),
    toggleSkillsPanel: () => skillsPanel.toggle(),
  };
}
