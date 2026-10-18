// Sonidos del juego, generados con Web Audio (sin ficheros de audio).
(function () {
  let ctx = null;
  let muted = false;
  try {
    muted = localStorage.getItem("tg-muted") === "1";
  } catch (_) {}

  function ac() {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  // Los navegadores solo dejan sonar tras un toque: se desbloquea con el primero
  const unlock = () => ac();
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  function tone(freq, start, dur, opts = {}) {
    const a = ac();
    if (!a || muted) return;
    const t0 = a.currentTime + start;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = opts.type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t0 + dur);
    const vol = opts.vol ?? 0.18;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // Ruido filtrado: para chapoteos, papel arrugado y redobles
  function noise(dur, vol, freq, start = 0) {
    const a = ac();
    if (!a || muted) return;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = a.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination);
    src.start(a.currentTime + start);
  }

  const SOUNDS = {
    join: () => { tone(520, 0, 0.09, { type: "triangle" }); tone(780, 0.07, 0.12, { type: "triangle" }); },
    leave: () => { tone(500, 0, 0.1, { type: "triangle" }); tone(340, 0.08, 0.14, { type: "triangle" }); },
    start: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, { type: "square", vol: 0.08 })),
    turn: () => { tone(880, 0, 0.12, { type: "sine", vol: 0.2 }); tone(1320, 0.1, 0.22, { type: "sine", vol: 0.16 }); },
    send: () => tone(600, 0, 0.12, { type: "sine", to: 1200, vol: 0.14 }),
    tick: () => tone(1000, 0, 0.05, { type: "square", vol: 0.06 }),
    timeup: () => { tone(220, 0, 0.25, { type: "sawtooth", vol: 0.09 }); tone(180, 0.22, 0.35, { type: "sawtooth", vol: 0.09 }); },
    page: () => tone(300, 0, 0.16, { type: "triangle", to: 900, vol: 0.12 }),
    point: () => [784, 988, 1175].forEach((f, i) => tone(f, i * 0.07, 0.14, { type: "triangle", vol: 0.14 })),
    click: () => tone(1400, 0, 0.035, { type: "triangle", vol: 0.08 }),
    pop: () => tone(420, 0, 0.09, { type: "sine", to: 900, vol: 0.16 }),
    color: () => tone(700 + Math.random() * 500, 0, 0.07, { type: "sine", vol: 0.12 }),
    splash: () => {
      noise(0.22, 0.12, 1800);
      tone(300, 0, 0.18, { type: "sine", to: 120, vol: 0.12 });
    },
    undo: () => tone(900, 0, 0.12, { type: "triangle", to: 450, vol: 0.1 }),
    crumple: () => { noise(0.35, 0.16, 3000); },
    blip: () => tone(1180, 0, 0.07, { type: "sine", vol: 0.1 }),
    drum: () => {
      for (let i = 0; i < 14; i++) noise(0.05, 0.05 + i * 0.006, 900, i * 0.055);
      tone(160, 0.8, 0.35, { type: "sine", vol: 0.25 });
      noise(0.5, 0.14, 6000, 0.8);
    },
    end: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.2, { type: "triangle", vol: 0.15 })),
  };

  window.SFX = {
    play(name) {
      try {
        SOUNDS[name] && SOUNDS[name]();
      } catch (_) {}
    },
    vibrate(pattern) {
      try {
        if (!muted && navigator.vibrate) navigator.vibrate(pattern);
      } catch (_) {}
    },
    get muted() {
      return muted;
    },
    toggle() {
      muted = !muted;
      try {
        localStorage.setItem("tg-muted", muted ? "1" : "0");
      } catch (_) {}
      if (!muted) SOUNDS.join();
      return muted;
    },
  };
})();
