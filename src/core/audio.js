function randomPitch(baseHz) {
  const variance = 1 + (Math.random() * 0.1 - 0.05);
  return baseHz * variance;
}

export function createAudioSystem() {
  let context = null;
  let unlocked = false;

  function ensureContext() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (context.state === "suspended") {
      context.resume();
    }
    unlocked = true;
  }

  function hit(freq, duration, type, volume) {
    if (!unlocked) {
      return;
    }
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(randomPitch(freq), context.currentTime);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  function playBasket() {
    hit(720, 0.08, "triangle", 0.09);
    window.setTimeout(() => hit(460, 0.09, "sine", 0.07), 45);
  }

  function playRim() {
    hit(980, 0.05, "square", 0.05);
    window.setTimeout(() => hit(620, 0.06, "square", 0.03), 24);
  }

  function playDribble() {
    hit(140, 0.07, "triangle", 0.06);
  }

  window.addEventListener(
    "pointerdown",
    () => {
      ensureContext();
    },
    { once: true }
  );

  return {
    ensureContext,
    playBasket,
    playRim,
    playDribble,
  };
}
