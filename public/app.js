// Dibulíos: lógica del navegador.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---------- estadísticas anónimas (Umami) ----------
  // Cada pantalla cuenta como una "página" y las acciones clave como eventos.
  const SCREEN_PATH = {
    "s-home": ["/inicio", "Inicio"],
    "s-lobby": ["/sala", "Sala de espera"],
    "s-text": ["/escribir-adivinar", "Escribir o adivinar"],
    "s-draw": ["/dibujar", "Dibujar"],
    "s-vote": ["/votar", "Votar"],
    "s-wait": ["/esperando", "Esperando"],
    "s-result": ["/resultado-duo", "Resultado dúo"],
    "s-reveal": ["/revelacion", "Revelación"],
    "s-end": ["/final", "Final"],
    "s-book": ["/cuaderno", "Mi cuaderno"],
  };
  const pending = [];
  function umamiCall(fn) {
    if (window.umami && typeof window.umami.track === "function") {
      try {
        fn(window.umami);
      } catch (_) {}
    } else if (pending.length < 30) pending.push(fn);
  }
  // El script carga en diferido: lo que pase antes se envía al llegar
  const flush = setInterval(() => {
    if (window.umami && typeof window.umami.track === "function") {
      clearInterval(flush);
      pending.splice(0).forEach(umamiCall);
    }
  }, 500);
  setTimeout(() => clearInterval(flush), 30000);
  function track(name, data) {
    umamiCall((u) => u.track(name, data));
  }
  let lastTracked = null;
  function trackScreen(id) {
    let key = id;
    if (id === "s-draw" && soloMode) key = faceDraft ? "carita" : "solo";
    if (key === lastTracked) return;
    lastTracked = key;
    const [url, title] = key === "solo" ? ["/dibujo-libre", "Dibujo libre"] : key === "carita" ? ["/carita", "Dibujar carita"] : SCREEN_PATH[id] || ["/" + id, id];
    umamiCall((u) => u.track((props) => ({ ...props, url, title: "Dibulíos · " + title })));
  }

  const EMOJIS = AVATARS.ids;
  const COLORS = [
    "#1b1b1f", "#4a4d57", "#8a8e99", "#c7cad1", "#ffffff",
    "#7a1018", "#c81d25", "#ff3b3b", "#ff8a80",
    "#b34700", "#ff7a1a", "#ffb067",
    "#c79a00", "#ffd21f", "#fff27a",
    "#4d7a12", "#9be04a", "#1f8a3a", "#7ad19a",
    "#0f6b63", "#2ec4b6",
    "#0b4fa8", "#2563eb", "#3fc8ef", "#9fdcf7", "#1e2f7a",
    "#5b21b6", "#9b5de5", "#d946ef", "#ff8fb8",
    "#5c3a1e", "#8b5a2b", "#c68b59", "#f1c9a5"
  ];
  const SIZES = [2, 5, 9, 15, 24, 36, 56];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : v;
      } catch (_) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch (_) {}
    },
  };
  const session = {
    get() {
      try {
        return JSON.parse(localStorage.getItem("tg-session") || "null");
      } catch (_) {
        return null;
      }
    },
    set(v) {
      try {
        if (v) localStorage.setItem("tg-session", JSON.stringify(v));
        else localStorage.removeItem("tg-session");
      } catch (_) {}
    },
  };

  // Idea al azar que no haya salido en este móvil hace poco
  // Cada sitio pide un tipo de idea: [lista, peso]
  function ideaPool(kind) {
    const r = Math.random();
    if (kind === "extreme") return FRASES.sencillas;
    if (kind === "classic") return r < 0.55 ? FRASES.cotidianas : r < 0.8 ? FRASES.bonitas : FRASES.graciosas;
    return r < 0.45 ? FRASES.bonitas : r < 0.83 ? FRASES.cotidianas : r < 0.93 ? FRASES.graciosas : FRASES.sencillas; // dibujo libre
  }
  function idea(kind) {
    const LIST = ideaPool(kind);
    let recent = [];
    try {
      recent = JSON.parse(localStorage.getItem("tg-recent-ideas") || "[]");
    } catch (_) {}
    const seen = new Set(recent);
    let f = LIST[Math.floor(Math.random() * LIST.length)];
    for (let i = 0; i < 30 && seen.has(f); i++) f = LIST[Math.floor(Math.random() * LIST.length)];
    recent.push(f);
    if (recent.length > 600) recent = recent.slice(-600);
    try {
      localStorage.setItem("tg-recent-ideas", JSON.stringify(recent));
    } catch (_) {}
    return f;
  }

  // ---------- estado local ----------
  let state = null;
  let clockOffset = 0;
  let me = { name: store.get("tg-name", ""), emoji: store.get("tg-emoji", "") };
  const isFace = (e) => String(e || "").indexOf("data:image/") === 0;
  if (!EMOJIS.includes(me.emoji) && !isFace(me.emoji)) me.emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  let currentStepKey = null;
  let autoSubmitted = null;
  let gallery = null;
  let pad = null;
  let wakeLock = null;
  let knock = null; // esperando a la puerta de una sala con la partida empezada: { code, approved, host }
  const showHome = () => show(knock ? "s-knock" : "s-home");

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get("sala") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);

  // ---------- conexión ----------
  const socket = io({ transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    $("offline").hidden = true;
    const s = session.get();
    if (s && s.code && s.token && (!inviteCode || inviteCode === s.code)) {
      socket.emit("join", { code: s.code, token: s.token, rejoinOnly: true, name: me.name, emoji: me.emoji }, (res) => {
        if (res.ok && res.waiting) {
          knock = { code: res.code, approved: res.approved, host: res.host };
          renderKnock();
          if (!soloMode && !bookOpen) show("s-knock");
          return;
        }
        if (res.ok) setTimeout(pairResync, 300);
        if (res.ok && pendingDrawing) {
          const pd = pendingDrawing;
          socket.emit("submit", { stepKey: pd.key, content: pd.content }, (r) => {
            if (pendingDrawing === pd) pendingDrawing = null;
            if (r && r.late && r.ok) toast("Tu dibujo ha llegado un pelín tarde, pero ya está en su sitio.");
          });
        }
        if (!res.ok) {
          const wasIn = !!state;
          session.set(null);
          state = null;
          clearInvite(); // la sala ya no existe: inicio normal
          if (wasIn) toast("Esa sala ya no existe (el juego se ha actualizado o se cerró). Crea una nueva.");
          show("s-home");
          renderChrome();
        }
      });
    }
  });
  let downSince = 0;
  socket.on("connect", () => (downSince = 0));
  socket.on("disconnect", () => {
    downSince = Date.now();
    setTimeout(() => {
      if (!socket.connected) $("offline").hidden = false;
    }, 1500);
  });
  socket.on("state", (s) => {
    clockOffset = s.now - Date.now();
    playCues(state, s);
    if (!state) guardBack();
    state = s;
    if (s.phase !== "end") {
      gallery = null;
      viewer = null;
    }
    render();
  });
  // Sonidos según lo que cambia entre un estado y el siguiente
  const modeName = (m, kind, variant) =>
    m === "duo" ? "duo" : m === "vote" ? (kind === "portrait" ? "retratos" : kind === "pairs" ? "parejas" : "votacion") : variant === "degrade" ? "degradado" : variant === "extreme" ? "extremo" : variant === "triptych" ? "triptico" : "telefono";
  function trackGame(prev, next) {
    if (!prev || prev.code !== next.code || next.hostId !== next.you) return;
    const n = next.players.filter((p) => !p.left).length;
    if (prev.phase === "lobby" && next.phase === "playing") {
      track("partida_empezada", { jugadores: n, modo: next.settings.mode, tiempo: String(next.settings.time), pruebas: !!next.practice });
    }
    if (prev.phase !== "end" && next.phase === "end") {
      track("partida_terminada", { jugadores: n, modo: modeName(next.mode, next.kind, next.variant) });
    }
  }
  function playCues(prev, next) {
    trackGame(prev, next);
    if (!prev || prev.code !== next.code) return;
    if (prev.phase !== next.phase) {
      if (next.phase === "playing" && prev.phase === "lobby") return SFX.play("start");
      if (next.phase === "end") return next.mode === "vote" ? null : SFX.play("end");
      if (next.phase === "reveal") return SFX.play("page");
    }
    if (next.phase === "lobby") {
      const a = prev.players.filter((p) => !p.left).length;
      const b = next.players.filter((p) => !p.left).length;
      if (b > a) {
        SFX.play("join");
        if (soloMode || bookOpen) toast(`${next.players[next.players.length - 1].name} ha entrado en la sala. Pulsa «Salir» para volver.`);
      }
      else if (b < a) SFX.play("leave");
      return;
    }
    if (next.phase === "reveal" && prev.reveal && next.reveal && (prev.reveal.book !== next.reveal.book || prev.reveal.entry !== next.reveal.entry)) {
      const last = next.reveal.entry === next.reveal.totalEntries - 1 && next.reveal.entry > prev.reveal.entry;
      return SFX.play(last ? "drum" : "page");
    }
    if (next.phase === "playing" && !!next.paused !== !!prev.paused) SFX.play(next.paused ? "leave" : "join");
    if (next.phase === "playing") {
      if (next.voteResult && !prev.voteResult) return SFX.play("point");
      if (next.result && !prev.result) return SFX.play(next.result.cards.some((c) => c.points > 0) ? "point" : "page");
      if (next.result && prev.result && next.result.teamScore > prev.result.teamScore) return SFX.play("point");
      if (next.task && prev.task && next.task.stepKey === prev.task.stepKey) {
        const a = prev.players.filter((p) => p.done).length;
        const b = next.players.filter((p) => p.done).length;
        if (b > a && next.task.submitted) SFX.play("blip");
      }
      if (next.task && prev.task && next.task.stepKey !== prev.task.stepKey) {
        SFX.play("turn");
        SFX.vibrate(60);
      } else if (next.task && !prev.task && prev.result) SFX.play("turn");
    }
  }
  // Tema claro u oscuro: claro por defecto, cada móvil recuerda su elección
  function applyTheme(t) {
    const dark = t === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.querySelectorAll(".theme-btn").forEach((b) => {
      b.textContent = dark ? "☀️" : "🌙";
      b.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#121829" : "#ff5a3c");
  }
  applyTheme(store.get("tg-theme", "light"));
  document.querySelectorAll(".theme-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      store.set("tg-theme", next);
      applyTheme(next);
      SFX.play("click");
    })
  );

  const muteBtns = () => [$("muteBtn"), ...document.querySelectorAll(".mute-btn")];
  function paintMute() {
    for (const b of muteBtns()) {
      b.textContent = SFX.muted ? "🔇" : "🔊";
      b.setAttribute("aria-label", SFX.muted ? "Activar sonidos" : "Silenciar sonidos");
    }
  }
  for (const b of muteBtns())
    b.addEventListener("click", () => {
      SFX.toggle();
      paintMute();
    });
  paintMute();

  socket.on("gallery", (g) => {
    gallery = g;
    if (state && state.phase === "end") renderEnd();
  });
  socket.on("toast", (t) => toast(t));

  // ---------- versión nueva ----------
  let outdated = false;
  socket.on("version", (v) => {
    try {
      const mine = window.APP_V;
      if (!mine || mine.indexOf("__") === 0 || typeof v !== "string" || v === mine) return;
      // Solo cuenta si el servidor es MÁS NUEVO (durante una publicación conviven dos versiones)
      if (!(parseInt(v, 36) > parseInt(mine, 36))) return;
      outdated = true;
      // Como mucho una recarga automática por versión: nunca en bucle
      let already = null;
      try {
        already = sessionStorage.getItem("tg-reloaded-for");
      } catch (_) {}
      if (!state && !soloMode && !bookOpen && already !== v) {
        try {
          sessionStorage.setItem("tg-reloaded-for", v);
        } catch (_) {}
        return location.reload();
      }
      $("updateBar").hidden = false;
    } catch (_) {}
  });
  $("updateBtn").addEventListener("click", () => location.reload());

  // Trabajador mínimo (sin caché) que algunos Chrome exigen para poder instalar
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  // ---------- invitación a instalar ----------
  const IOS_SHARE = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#2f7bf6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  let installed = false;
  let isIOS = false;
  try {
    installed = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  } catch (_) {}
  let installEvt = null;
  function showInstall(mode) {
    // si lo cerraron, vuelve a ofrecerse a la semana (en iPhone es la única forma de que no se borre el cuaderno)
    const hid = Number(store.get("tg-install-hidden", "0")) || 0;
    if (installed || (hid > 1 && Date.now() - hid < 7 * 864e5)) return;
    const card = $("installCard");
    if (mode === "prompt") {
      $("installHint").textContent = "Tenlo en tu pantalla de inicio, como una app.";
      $("installBtn").hidden = false;
    } else if (mode === "ios") {
      $("installHint").innerHTML = `Toca ${IOS_SHARE} <strong>Compartir</strong> en la barra del navegador y luego <strong>«Añadir a pantalla de inicio»</strong>. Así tu cuaderno no se borra.`;
      $("installBtn").hidden = true;
    } else {
      $("installHint").textContent = "Abre el menú ⋮ del navegador y elige «Añadir a pantalla de inicio» o «Instalar».";
      $("installBtn").hidden = true;
    }
    card.hidden = false;
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvt = e;
    showInstall("prompt");
  });
  window.addEventListener("appinstalled", () => {
    track("app_instalada");
    $("installCard").hidden = true;
  });
  $("installBtn").addEventListener("click", async () => {
    if (!installEvt) return;
    SFX.play("pop");
    installEvt.prompt();
    try {
      const r = await installEvt.userChoice;
      if (r.outcome === "accepted") $("installCard").hidden = true;
    } catch (_) {}
    installEvt = null;
  });
  $("installClose").addEventListener("click", () => {
    store.set("tg-install-hidden", String(Date.now()));
    $("installCard").hidden = true;
  });
  if (installed) setTimeout(() => track("abierta_como_app", { sistema: isIOS ? "ios" : "android" }), 0);
  if (!installed) {
    if (isIOS) showInstall("ios");
    // Navegadores sin botón de instalar: indicación manual tras unos segundos
    else setTimeout(() => { if (!installEvt && /android/i.test(navigator.userAgent)) showInstall("manual"); }, 4000);
  }
  socket.on("replaced", () => {
    toast("Has abierto el juego en otra pestaña.");
  });
  socket.on("closed", () => {
    session.set(null);
    state = null;
    clearInvite();
    toast("La sala se ha cerrado.");
    show("s-home");
    renderChrome();
  });

  // ---------- utilidades de interfaz ----------
  const screens = ["s-me", "s-knock", "s-home", "s-lobby", "s-text", "s-draw", "s-vote", "s-wait", "s-result", "s-reveal", "s-end", "s-book"];
  function show(id) {
    if (document.body.dataset.screen !== id) {
      $("zoomSheet").hidden = true;
      $("shareSheet").hidden = true;
    }
    for (const s of screens) $(s).hidden = s !== id;
    document.body.dataset.screen = id;
    if (id === "s-home") renderHomeBook();
    trackScreen(id);
    if (id === "s-draw" && pad) requestAnimationFrame(() => pad.layout());
  }
  let toastTimer;
  // iPhone: Safari ignora «no ampliar» y, con un doble toque o un pellizco fuera del lienzo,
  // amplía toda la página (y cuesta quitarlo). Se bloquea; el lienzo y el visor tienen su propio zoom.
  const OWN_ZOOM = ".pad-stage, .zoom-wrap, .hue-bar, .shade-bar";
  // Si la página ya está ampliada (p. ej. al escribir), se deja pellizcar para volver a su tamaño
  const pageZoomed = () => (window.visualViewport ? window.visualViewport.scale : 1) > 1.01;
  document.addEventListener("gesturestart", (e) => {
    if (!pageZoomed()) e.preventDefault();
  });
  // Al terminar de escribir, si Safari amplió la página, se devuelve a su tamaño
  document.addEventListener("focusout", (e) => {
    if (!typing(e.target) || !pageZoomed()) return;
    const vp = document.querySelector('meta[name="viewport"]');
    if (!vp) return;
    const orig = vp.getAttribute("content");
    // con un momento de margen: si se estaba tocando un botón (p. ej. «¡Listo!»), que el toque llegue antes
    setTimeout(() => {
      if (typing(document.activeElement)) return;
      vp.setAttribute("content", orig.replace(/maximum-scale=[^,]*/, "") + ", maximum-scale=1");
      setTimeout(() => vp.setAttribute("content", orig), 300);
    }, 500);
  });
  // Mantener pulsado: ni selección azul ni menú de «guardar imagen» (salvo al escribir)
  const typing = (t) => t && t.closest && t.closest("input, textarea, [contenteditable='true']");
  document.addEventListener("selectstart", (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
  document.addEventListener("contextmenu", (e) => {
    if (!typing(e.target)) e.preventDefault();
  });
  document.addEventListener("dblclick", (e) => {
    if (!e.target.closest(OWN_ZOOM)) e.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (e) => {
    const t = Date.now();
    // segundo toque rápido sobre algo que no es un botón ni un campo: no se deja ampliar
    if (t - lastTouchEnd < 350 && !pageZoomed() && !e.target.closest("button, input, textarea, select, a, label, " + OWN_ZOOM)) e.preventDefault();
    lastTouchEnd = t;
  }, { passive: false });
  /** Confirmación dentro del propio botón (en vez de un aviso que tape nada) */
  function flashBtn(btn, text, ms = 1600) {
    if (!btn) return;
    if (btn._flash) clearTimeout(btn._flash);
    else btn._orig = btn.textContent;
    btn.textContent = text;
    btn._flash = setTimeout(() => {
      if (btn.textContent === text) btn.textContent = btn._orig; // si nadie lo ha cambiado entretanto
      btn._flash = null;
    }, ms);
  }
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), msg.length > 70 ? 5000 : 2800);
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const isHost = () => state && state.hostId === state.you;
  const now = () => Date.now() + clockOffset;

  async function keepAwake() {
    try {
      if ("wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => (wakeLock = null));
      }
    } catch (_) {}
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && state) keepAwake();
  });

  // ---------- inicio ----------
  function buildEmojiGrid() {
    const g = $("emojiGrid");
    g.innerHTML = "";

    const saved = store.get("tg-face", "");
    const list = isFace(saved) ? [saved, ...EMOJIS] : EMOJIS;
    for (const e of list) {
      const b = el("button", "emoji-btn");
      b.type = "button";
      b.dataset.id = e;
      b.setAttribute("aria-label", "Carita " + AVATARS.label(e));
      b.appendChild(AVATARS.avatarEl(e));
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(e === me.emoji));
      b.addEventListener("click", () => {
        me.emoji = e;
        store.set("tg-emoji", e);
        for (const x of g.children) x.setAttribute("aria-checked", String(x.dataset.id === e));
        paintCurrentAvatar();
        SFX.play("pop");
        if (state && state.phase === "lobby") socket.emit("profile", { name: me.name, emoji: me.emoji });
      });
      g.appendChild(b);
    }
    paintCurrentAvatar();
  }
  function paintCurrentAvatar() {
    const c = $("emojiCurrent");
    c.innerHTML = "";
    c.appendChild(AVATARS.avatarEl(me.emoji));
    try {
      renderWho();
      if (meOpen) renderMe();
    } catch (_) {}
  }
  // Persona con su carita, para frases como "Abuela dibujó"
  function who(p, suffix) {
    const s = el("span", "who");
    if (p) {
      s.appendChild(AVATARS.avatarEl(p.emoji, "tiny"));
      s.appendChild(document.createTextNode(p.name + (suffix ? " " + suffix : "")));
    } else s.textContent = suffix || "";
    return s;
  }
  function setWho(node, prefix, p, suffix) {
    node.innerHTML = "";
    if (prefix) node.appendChild(document.createTextNode(prefix + " "));
    node.appendChild(who(p, suffix));
  }
  const nameOf = (p, fallback) => (p ? p.name : fallback);
  $("emojiBtn").addEventListener("click", () => openMe());
  $("emojiClose").addEventListener("click", () => closeMe());

  // ---------- dibujar tu propia carita (en el lienzo grande, dentro de un círculo) ----------
  // El círculo ocupa el cuadrado central del lienzo (600x600 a partir de y=150)
  const FACE_BOX = { x: 0, y: 150, s: 600 };
  let faceMode = false;
  // Dibujar la carita: en el lienzo normal (con todas las herramientas); al pulsar «Siguiente» se guarda
  // en el cuaderno y se pasa a encuadrarla. Así solo hay un sitio para dibujar y otro para elegir.
  let faceDraft = false;
  function openFace() {
    leaveMeFor();
    startSolo();
    faceDraft = true;
    $("drawStep").textContent = "Tu carita";
    $("drawWhat").textContent = "Dibuja tu cara: luego eliges el encuadre";
    $("drawWhat").classList.remove("long");
    $("rerollBtn").hidden = true;
    $("soloBookBtn").hidden = true;
    $("drawDone").textContent = "Siguiente";
  }
  function finishFaceDraft() {
    if (!pad.dirty) return toast("Dibuja tu carita primero 🙂");
    const m = addToBook({ prompt: "Mi carita" }, pad.toDataURL("image/jpeg", 0.9));
    faceDraft = false;
    exitSolo(true);
    if (m) openFaceCrop(m);
  }
  $("faceDrawBtn").addEventListener("click", () => openFace());
  $("faceBookBtn").addEventListener("click", () => openFacePick());
  // ---------- «Tú»: nombre, carita y ajustes, en un solo sitio ----------
  // La carita que sale de un dibujo del cuaderno recuerda de cuál y cómo se encuadró, para poder
  // retocar el dibujo o volver a encuadrarlo desde aquí mismo.
  function faceSource() {
    try {
      const src = JSON.parse(store.get("tg-face-src", "") || "null");
      if (!src || !isFace(me.emoji) || me.emoji !== store.get("tg-face", "")) return null;
      const m = bookCache.find((d) => d.id === src.id);
      return m ? { meta: m, crop: src } : null;
    } catch (_) {
      return null;
    }
  }
  function renderMe() {
    const f = $("meFace");
    f.innerHTML = "";
    f.appendChild(AVATARS.avatarEl(me.emoji));
    if (document.activeElement !== $("meName")) $("meName").value = me.name;
    const src = faceSource();
    $("faceRetouchBtn").hidden = !src;
    $("faceCropBtn").hidden = !src;
    $("faceBookTxt").textContent = "Cuaderno";
    $("faceDrawTxt").textContent = "Dibujar";
    $("faceActions").classList.toggle("two", !src);

  }
  // «Tú» es una pantalla (no una ventana): se entra desde la barra de abajo o tocando tu ficha en la sala,
  // y se sale yendo a otra pestaña o con «Volver» (en la sala).
  let meOpen = false;
  let backToMe = false; // al terminar de dibujar/encuadrar la carita, se vuelve aquí
  function openMe() {
    SFX.play("click");
    meOpen = true;
    backToMe = false;
    renderMe();
    $("emojiClose").hidden = false;
    show("s-me");
  }
  function leaveMeFor() {
    // se sale de «Tú» para dibujar o encuadrar la carita; luego se vuelve
    if (meOpen) {
      syncMeName();
      meOpen = false;
      backToMe = true;
    }
  }
  function closeMe(go) {
    syncMeName();
    meOpen = false;
    backToMe = false;
    if (welcomeBack) {
      welcomeBack = false;
      showHome();
      paintWelcomeFace();
      $("welcomeSheet").hidden = false;
      return;
    }
    if (go) return go();
    if (state) render();
    else showHome();
  }
  function maybeBackToMe() {
    if (backToMe) setTimeout(openMe, 50);
  }
  function syncMeName() {
    const v = $("meName").value.trim().slice(0, 16);
    if (!v || v === me.name) return;
    me.name = v;
    store.set("tg-name", v);
    $("nameInput").value = v;
    if (state && state.phase === "lobby") socket.emit("profile", { name: me.name, emoji: me.emoji });
    renderWho();
  }
  $("meName").addEventListener("change", syncMeName);
  $("meName").addEventListener("blur", syncMeName);
  $("faceRetouchBtn").addEventListener("click", () => {
    const src = faceSource();
    if (!src) return;
    leaveMeFor();
    faceRetouch = src;
    startSolo(src.meta);
    $("drawStep").textContent = "Retocando tu carita";
    $("drawDone").textContent = "Siguiente";
    $("soloBookBtn").hidden = true;
  });
  $("faceCropBtn").addEventListener("click", () => {
    const src = faceSource();
    if (src) {
      leaveMeFor();
      openFaceCrop(src.meta, src.crop);
    }
  });
  let faceRetouch = null;
  // Inicio: la primera vez se pide nombre y carita; luego, solo «Hola, …» (se cambia en «Tú»)
  function renderWho() {
    const known = !!me.name.trim() && store.get("tg-named", "") === "1";
    $("whoNew").hidden = true; // el nombre se pide al entrar (bienvenida) y se cambia en «Tú»
    $("whoHello").hidden = !known;
    $("helloName").textContent = "Hola, " + me.name;
    const hf = $("helloFace");
    hf.innerHTML = "";
    hf.appendChild(AVATARS.avatarEl(me.emoji));

  }
  $("whoHello").addEventListener("click", () => openMe());
  // Inicio: el cuaderno como tarjeta (tus últimos dibujos), en vez de un enlace perdido
  function renderHomeBook() {
    const n = bookCache.length;
    $("homeBookCount").textContent = n ? `${n} ${n === 1 ? "dibujo" : "dibujos"} · dibuja a tu aire` : "Dibuja a tu aire y guárdalo aquí";
  }
  $("homeBook").addEventListener("click", () => openBook("home"));
  if (me.name.trim()) store.set("tg-named", "1");
  renderWho();
  setTimeout(() => !state && renderChrome(), 0);
  // Borrar la carita dibujada (pide confirmación: hay que tocar dos veces)
  let faceDelArmed = null;
  $("faceDelBtn").addEventListener("click", () => {
    if (!faceDelArmed) {
      SFX.play("click");
      $("faceDelBtn").textContent = "🗑️ ¿Borrar?";
      faceDelArmed = setTimeout(() => {
        faceDelArmed = null;
        $("faceDelBtn").textContent = "🗑️";
      }, 3000);
      return;
    }
    clearTimeout(faceDelArmed);
    faceDelArmed = null;
    try {
      localStorage.removeItem("tg-face");
    } catch (_) {}
    if (isFace(me.emoji)) {
      me.emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      store.set("tg-emoji", me.emoji);
      if (state && state.phase === "lobby") socket.emit("profile", { name: me.name, emoji: me.emoji });
    }
    buildEmojiGrid();
    SFX.play("crumple");
    exitSolo(true);
  });
  function closeFace() {
    faceMode = false;
    $("faceDelBtn").hidden = true;
    document.body.classList.remove("face-mode");
    if (pad) {
      pad.forcePortrait = false;
      pad.fillClip = null;
      try {
        pad.setScreenLandscape(window.matchMedia(LANDSCAPE).matches);
      } catch (_) {}
    }
  }
  function saveFace() {
    // Pequeña (para que viaje rápido a los demás): el cuadrado del círculo, a 160 px
    const out = document.createElement("canvas");
    out.width = out.height = 160;
    const x = out.getContext("2d");
    x.fillStyle = "#ffffff";
    x.fillRect(0, 0, 160, 160);
    x.drawImage(pad.canvas, FACE_BOX.x, FACE_BOX.y, FACE_BOX.s, FACE_BOX.s, 0, 0, 160, 160);
    // y la carita, en grande, también al cuaderno (para no perderla y poder reutilizarla)
    if (pad.dirty) {
      const big = document.createElement("canvas");
      big.width = big.height = 600;
      const bx = big.getContext("2d");
      bx.fillStyle = "#ffffff";
      bx.fillRect(0, 0, 600, 600);
      bx.drawImage(pad.canvas, FACE_BOX.x, FACE_BOX.y, FACE_BOX.s, FACE_BOX.s, 0, 0, 600, 600);
      addToBook({ prompt: "Mi carita" }, big.toDataURL("image/jpeg", 0.88));
    }
    useFace(out, "carita_dibujada");
    exitSolo(true);
  }
  /** Pone como carita lo que hay en un lienzo de 160x160 */
  function useFace(out, ev) {
    let url = "";
    for (const q of [0.85, 0.72, 0.58, 0.45, 0.32]) {
      try {
        url = out.toDataURL("image/webp", q);
        if (url.indexOf("data:image/webp") !== 0) url = out.toDataURL("image/jpeg", q);
      } catch (_) {
        url = out.toDataURL("image/jpeg", q);
      }
      if (url.length < 36000) break;
    }
    store.set("tg-face", url);
    me.emoji = url;
    store.set("tg-emoji", url);
    track(ev);
    buildEmojiGrid();
    SFX.play("point");
    if (state && state.phase === "lobby") socket.emit("profile", { name: me.name, emoji: me.emoji });
  }

  // ---------- carita desde un dibujo del cuaderno: elegir y encuadrar (arrastrar y pellizcar) ----------
  function openFacePick() {
    SFX.play("click");
    const list = readBook();
    if (!list.length) return toast("Tu cuaderno está vacío: dibuja algo primero o dibuja tu carita con ✏️");
    const g = $("facePickGrid");
    g.innerHTML = "";
    list.forEach((d) => {
      const b = el("button", "face-pick-item");
      b.type = "button";
      b.setAttribute("aria-label", d.prompt || "Dibujo");
      const im = el("img");
      im.src = d.thumb;
      im.alt = "";
      im.loading = "lazy";
      b.appendChild(im);
      b.addEventListener("click", () => openFaceCrop(d));
      g.appendChild(b);
    });
    leaveMeFor();
    $("facePick").hidden = false;
  }
  $("facePickClose").addEventListener("click", () => {
    $("facePick").hidden = true;
    maybeBackToMe();
  });
  $("facePick").addEventListener("click", (e) => {
    if (e.target === $("facePick")) $("facePick").hidden = true;
  });
  const crop = { k: 1, tx: 0, ty: 0, S: 300, w: 1, h: 1, min: 0.2, bg: "#ffffff" };
  /** El color dominante del borde de una imagen (para rellenar sin franjas blancas) */
  function edgeColor(im) {
    try {
      const W = 90, H = Math.max(1, Math.round((im.naturalHeight * W) / im.naturalWidth));
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.fillStyle = "#fff";
      x.fillRect(0, 0, W, H);
      x.drawImage(im, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data;
      const count = new Map();
      const add = (px, py) => {
        const i = (py * W + px) * 4;
        const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
        const o = count.get(k) || { n: 0, r: 0, g: 0, b: 0 };
        o.n++;
        o.r += d[i];
        o.g += d[i + 1];
        o.b += d[i + 2];
        count.set(k, o);
      };
      for (let px = 0; px < W; px++) {
        add(px, 0);
        add(px, H - 1);
      }
      for (let py = 0; py < H; py++) {
        add(0, py);
        add(W - 1, py);
      }
      let best = null;
      for (const o of count.values()) if (!best || o.n > best.n) best = o;
      return best ? `rgb(${Math.round(best.r / best.n)},${Math.round(best.g / best.n)},${Math.round(best.b / best.n)})` : "#ffffff";
    } catch (_) {
      return "#ffffff";
    }
  }
  function paintCrop() {
    const im = $("cropImg");
    im.style.width = crop.w * crop.k + "px";
    im.style.height = crop.h * crop.k + "px";
    im.style.transform = `translate(${crop.tx}px, ${crop.ty}px)`;
  }
  let cropMeta = null;
  function openFaceCrop(d, saved) {
    cropMeta = d;
    SFX.play("page");
    $("facePick").hidden = true;
    $("faceCrop").hidden = false;
    const im = $("cropImg");
    im.removeAttribute("src");
    getBookImg(d.id)
      .then((src) => {
        im.onload = () => {
          const box = $("cropBox").getBoundingClientRect();
          crop.S = box.width;
          crop.w = im.naturalWidth;
          crop.h = im.naturalHeight;
          // si se aleja tanto que sobra círculo, se rellena con el color que más hay en el borde del dibujo
          crop.bg = edgeColor(im);
          $("cropBox").style.background = crop.bg;
          // al empezar, el dibujo cubre el círculo y se centra un poco arriba (donde suelen estar las caras)
          crop.k = Math.max(crop.S / crop.w, crop.S / crop.h);
          crop.min = crop.k * 0.35;
          crop.tx = (crop.S - crop.w * crop.k) / 2;
          crop.ty = Math.min(0, (crop.S - crop.h * crop.k) / 3);
          if (saved && saved.kw) {
            // el encuadre que ya tenía
            crop.k = (saved.kw * crop.S) / crop.w;
            crop.tx = saved.tx * crop.S;
            crop.ty = saved.ty * crop.S;
          }
          paintCrop();
        };
        im.src = src;
      })
      .catch(() => toast("No se pudo abrir ese dibujo."));
  }
  (() => {
    const stage = $("cropStage");
    const pts = new Map();
    let last = null;
    const zoomAt = (f, cx, cy) => {
      const k = Math.max(crop.min, Math.min(crop.k * f, 12));
      const r = k / crop.k;
      const b = $("cropBox").getBoundingClientRect();
      const px = cx - b.left, py = cy - b.top;
      crop.tx = px - (px - crop.tx) * r;
      crop.ty = py - (py - crop.ty) * r;
      crop.k = k;
      paintCrop();
    };
    const snap = () => {
      const a = [...pts.values()];
      if (a.length === 1) return { x: a[0].x, y: a[0].y, d: 0 };
      if (a.length >= 2) return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) };
      return null;
    };
    stage.addEventListener("pointerdown", (e) => {
      stage.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      last = snap();
    });
    stage.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const now = snap();
      if (!now || !last) return;
      crop.tx += now.x - last.x;
      crop.ty += now.y - last.y;
      if (now.d && last.d) zoomAt(now.d / last.d, now.x, now.y);
      else paintCrop();
      last = now;
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      last = snap();
    };
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY);
    }, { passive: false });
  })();
  $("faceCropClose").addEventListener("click", () => {
    $("faceCrop").hidden = true;
    maybeBackToMe();
  });
  $("faceCropUse").addEventListener("click", () => {
    const im = $("cropImg");
    if (!im.naturalWidth) return;
    const out = document.createElement("canvas");
    out.width = out.height = 256; // más grande: no se pixela al verla en grande
    const x = out.getContext("2d");
    const f = 256 / crop.S;
    x.fillStyle = crop.bg || "#ffffff";
    x.fillRect(0, 0, 256, 256);
    x.drawImage(im, crop.tx * f, crop.ty * f, crop.w * crop.k * f, crop.h * crop.k * f);
    useFace(out, "carita_del_cuaderno");
    if (cropMeta) store.set("tg-face-src", JSON.stringify({ id: cropMeta.id, tx: crop.tx / crop.S, ty: crop.ty / crop.S, kw: (crop.k * crop.w) / crop.S }));
    $("faceCrop").hidden = true;
    renderWho();
    maybeBackToMe();
    toast("¡Carita lista! 🎉");
  });
  $("howBtn").addEventListener("click", () => {
    SFX.play("pop");
    $("howSheet").hidden = false;
    track("como_se_juega");
  });
  $("howClose").addEventListener("click", () => ($("howSheet").hidden = true));
  $("howSheet").addEventListener("click", (e) => {
    if (e.target === $("howSheet")) $("howSheet").hidden = true;
  });

  $("nameInput").value = me.name;
  $("nameInput").addEventListener("input", (e) => {
    me.name = e.target.value;
    store.set("tg-name", me.name);
  });
  $("codeInput").addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase().replace(/[^A-ZÑ]/g, "").replace(/Ñ/g, "N");
  });

  // Guarda en el móvil el nombre tal y como esté en la casilla (también si lo autocompletó el teclado)
  function syncName() {
    me.name = $("nameInput").value.trim();
    store.set("tg-name", me.name);
  }
  ["change", "blur"].forEach((ev) => $("nameInput").addEventListener(ev, syncName));
  // Sin nombre no se juega: antes de crear o entrar en una sala sale la bienvenida («¿Cómo te llamas?»,
  // con tu carita ya puesta). Al continuar, se hace lo que habías pulsado.
  let welcomeThen = null;
  function needName(then) {
    syncName();
    $("homeError").textContent = "";
    if (me.name.trim() && store.get("tg-named", "") === "1") return false;
    welcomeThen = then || null;
    const inv = then && then.code ? then.code : "";
    $("welcomeInvite").hidden = !inv;
    $("welcomeInvite").textContent = inv ? `Te han invitado a la sala ${inv}` : "";
    $("welcomeName").value = me.name;
    $("welcomeError").textContent = "";
    paintWelcomeFace();
    $("welcomeSheet").hidden = false;
    setTimeout(() => $("welcomeName").focus(), 250);
    return true;
  }
  function paintWelcomeFace() {
    const f = $("welcomeFaceAv");
    f.innerHTML = "";
    f.appendChild(AVATARS.avatarEl(me.emoji));
  }
  $("welcomeFace").addEventListener("click", () => {
    $("welcomeSheet").hidden = true;
    welcomeBack = true;
    openMe();
  });
  let welcomeBack = false;
  function welcomeGo() {
    const v = $("welcomeName").value.trim().slice(0, 16);
    if (!v) {
      $("welcomeError").textContent = "Escribe tu nombre para que los demás sepan quién eres.";
      $("welcomeName").focus();
      return;
    }
    me.name = v;
    store.set("tg-name", v);
    store.set("tg-named", "1");
    $("nameInput").value = v;
    $("welcomeSheet").hidden = true;
    renderWho();
    const then = welcomeThen;
    welcomeThen = null;
    if (then) then.run();
  }
  $("welcomeGo").addEventListener("click", welcomeGo);
  $("welcomeName").addEventListener("keydown", (e) => e.key === "Enter" && welcomeGo());
  $("welcomeSheet").addEventListener("click", (e) => {
    if (e.target === $("welcomeSheet")) $("welcomeSheet").hidden = true;
  });
  function entered(res, code) {
    if (!res.ok) {
      // Si falla una invitación, vuelve el inicio normal para poder escribir otro código
      if (!$("joinInvite").hidden || $("homeActions").classList.contains("invited")) {
        clearInvite();
        if (code) $("codeInput").value = code;
      }
      $("homeError").textContent = res.error || "No se pudo entrar.";
      return;
    }
    session.set({ code: res.code, token: res.token });
    store.set("tg-named", "1");
    try {
      history.replaceState(null, "", "/?sala=" + res.code);
    } catch (_) {}
    if (res.waiting) {
      // la partida ya había empezado: se espera a la puerta
      knock = { code: res.code, approved: res.approved, host: res.host };
      renderKnock();
      show("s-knock");
      SFX.play("pop");
      return;
    }
    knock = null;
    guardBack();
    SFX.play("pop");
    keepAwake();
  }
  $("createBtn").addEventListener("click", function create() {
    if (needName({ run: create })) return;
    socket.emit("create", { name: me.name, emoji: me.emoji }, (res) => {
      if (res && res.ok) track("sala_creada");
      entered(res);
    });
  });
  function joinCode(code) {
    if (!/^[A-Z]{5}$/.test(code)) {
      $("homeError").textContent = "El código tiene 5 letras.";
      return;
    }
    if (needName({ run: () => joinCode(code), code: code === inviteCode ? code : "" })) return;
    const s = session.get();
    socket.emit("join", { code, name: me.name, emoji: me.emoji, token: s && s.code === code ? s.token : null }, (res) => {
      if (res && res.ok) track(code === "ZZZZZ" ? "sala_pruebas" : "sala_unido", { invitacion: code === inviteCode ? "enlace" : "codigo" });
      entered(res, code);
    });
  }
  // Al salir de una sala, el inicio vuelve a ser el normal (crear o unirse con código)
  function clearInvite() {
    $("joinInvite").hidden = true;
    $("homeActions").classList.remove("invited");
    $("createBtn").classList.remove("secondary");
    $("createBtn").classList.add("primary");
    $("createBtn").textContent = "Crear una sala";
    $("codeInput").value = "";
    try {
      if (location.search) history.replaceState(history.state, "", "/");
    } catch (_) {}
  }
  $("joinBtn").addEventListener("click", () => joinCode($("codeInput").value.trim()));
  $("otherCodeBtn").addEventListener("click", () => {
    SFX.play("click");
    clearInvite();
    $("homeError").textContent = "";
    $("codeInput").focus();
  });
  $("codeInput").addEventListener("keydown", (e) => e.key === "Enter" && joinCode($("codeInput").value.trim()));
  $("joinInviteBtn").addEventListener("click", () => joinCode(inviteCode));
  if (inviteCode) {
    $("joinInvite").hidden = false;
    $("inviteCode").textContent = inviteCode;
    $("codeInput").value = inviteCode;
    $("createBtn").classList.remove("primary");
    $("createBtn").classList.add("secondary");
    $("createBtn").textContent = "Crear otra sala";
    $("homeActions").classList.add("invited");
    // Si la sala del enlace ya no existe (p. ej. abres la pestaña horas después), inicio normal
    const checkInvite = () => {
      const s = session.get();
      if (s && s.code === inviteCode) return; // la vuelta a tu sala ya lo comprueba
      socket.emit("roomInfo", { code: inviteCode }, (r) => {
        if (r && r.exists === false && !state) {
          clearInvite();
          toast(`La partida de la sala ${inviteCode} ya terminó. Crea una nueva o únete con otro código.`);
        }
      });
    };
    if (socket.connected) checkInvite();
    else socket.once("connect", checkInvite);
  }

  // ---------- llamar a la puerta (partida empezada) ----------
  function renderKnock() {
    if (!knock) return;
    const who = knock.host ? knock.host : "el anfitrión";
    $("knockEmoji").textContent = knock.approved ? "🎉" : "🚪";
    $("knockTitle").textContent = knock.approved ? "¡Te han dejado entrar!" : "Pidiendo permiso para entrar…";
    $("knockText").textContent = knock.approved
      ? `La partida de la sala ${knock.code} ya estaba en marcha. Entrarás en cuanto acabe y empiece la siguiente. Mientras, puedes dibujar.`
      : `La partida de la sala ${knock.code} ya ha empezado. Le hemos preguntado a ${who} si puedes unirte: si dice que sí, entrarás en la siguiente partida.`;
  }
  socket.on("knock", (m) => {
    if (!knock) return;
    if (m.approved) {
      knock.approved = true;
      renderKnock();
      SFX.play("point");
      if (!$("s-knock").hidden) return;
      toast("¡Te han dejado entrar! Entrarás en la siguiente partida 🎉");
    } else if (m.denied) {
      knock = null;
      session.set(null);
      clearInvite();
      if (!soloMode && !bookOpen) show("s-home");
      toast("Ahora no se puede entrar en esa partida. Prueba cuando acabe 🙂");
    } else if (m.open) {
      // ha acabado la partida: se entra en la sala (con el mismo token)
      const s = session.get();
      const code = knock.code;
      socket.emit("join", { code, token: s && s.token, name: me.name, emoji: me.emoji }, (res) => {
        if (res && res.ok && !res.waiting) {
          knock = null;
          entered(res, code);
          toast("¡Ya estás dentro de la sala! 🎉");
        } else if (res && !res.ok) {
          knock = null;
          session.set(null);
          if (!soloMode && !bookOpen) show("s-home");
          toast(res.error || "No se pudo entrar en la sala.");
        }
      });
    }
  });
  $("knockDraw").addEventListener("click", () => startSolo());
  $("knockLeave").addEventListener("click", () => {
    SFX.play("leave");
    socket.emit("unknock");
    knock = null;
    session.set(null);
    clearInvite();
    show("s-home");
  });
  // Anfitrión: alguien quiere entrar con la partida empezada
  function renderRequests() {
    const reqs = state && isHost() && state.phase !== "lobby" ? state.requests || [] : [];
    $("reqBar").hidden = !reqs.length;
    if (!reqs.length) return;
    const r = reqs[0];
    const face = r.emoji && !isFace(r.emoji) && !String(r.emoji).startsWith("av:") ? r.emoji + " " : "🙋 ";
    $("reqText").textContent = `${face}${r.name} quiere entrar. ¿Le dejas? Entrará en la próxima partida${reqs.length > 1 ? ` (y ${reqs.length - 1} más esperando)` : ""}.`;
    $("reqBar").dataset.id = r.id;
  }
  $("reqYes").addEventListener("click", () => {
    SFX.play("click");
    socket.emit("admit", { id: $("reqBar").dataset.id, yes: true });
  });
  $("reqNo").addEventListener("click", () => {
    SFX.play("click");
    socket.emit("admit", { id: $("reqBar").dataset.id, yes: false });
  });

  // ---------- salir, logo y botón atrás ----------
  function askLeave(fromLogo) {
    SFX.play("click");
    $("leaveTitle").textContent = fromLogo ? "¿Volver al inicio?" : "¿Salir de la sala?";
    const hostInGame = !!(state && state.phase !== "lobby" && isHost());
    $("leaveText").textContent = hostInGame
      ? "¿Te has equivocado de modo? Vuelve con todos a la sala (con el mismo código) y elige otro. O sal tú solo."
      : state && state.phase !== "lobby"
        ? "Saldrás de la partida y tus turnos se saltarán."
        : "Saldrás de la sala. Puedes volver a entrar con el código.";
    $("leaveLobby").hidden = !hostInGame;
    $("leaveSheet").hidden = false;
  }
  $("leaveBtn").addEventListener("click", () => askLeave(false));
  $("brandBtn").addEventListener("click", () => {
    if (state) askLeave(true);
    else show("s-home");
  });
  $("leaveLobby").addEventListener("click", () => {
    $("leaveSheet").hidden = true;
    SFX.play("click");
    socket.emit("cancelGame");
  });
  $("leaveNo").addEventListener("click", () => {
    SFX.play("click");
    $("leaveSheet").hidden = true;
  });
  $("leaveYes").addEventListener("click", () => {
    $("leaveSheet").hidden = true;
    SFX.play("leave");
    socket.emit("leave");
    session.set(null);
    state = null;
    gallery = null;
    clearInvite();
    show("s-home");
    renderChrome();
  });
  // El botón «Atrás» del móvil no saca de la partida: pregunta antes
  let backGuarded = false;
  function guardBack() {
    if (backGuarded) return;
    try {
      history.pushState({ dibulios: 1 }, "");
      backGuarded = true;
    } catch (_) {}
  }
  // «Atrás» del móvil (Android, también con la app instalada): primero cierra lo que haya abierto
  // (visor, ventanas), luego sale del cuaderno o del dibujo libre; en partida, pregunta antes de salir.
  const OVERLAYS = ["welcomeSheet", "faceCrop", "facePick", "bookView", "zoomSheet", "shareSheet", "modeSheet", "howSheet", "endSheet", "leaveSheet"];
  const openOverlay = () => OVERLAYS.map((id) => $(id)).find((o) => o && !o.hidden);
  const needsGuard = () => !!state || bookOpen || soloMode || !!openOverlay();
  let consumingBack = false;
  function syncBack() {
    if (needsGuard()) guardBack();
    else if (backGuarded && !consumingBack) {
      // ya no hay nada que cerrar: se quita la entrada de más, para que «atrás» funcione normal
      consumingBack = true;
      backGuarded = false;
      try {
        history.back();
      } catch (_) {
        consumingBack = false;
      }
    }
  }
  new MutationObserver(() => setTimeout(syncBack, 0)).observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
  window.addEventListener("popstate", () => {
    backGuarded = false;
    if (consumingBack) {
      consumingBack = false;
      try {
        if (!state && location.search) history.replaceState(null, "", "/");
      } catch (_) {}
      return;
    }
    const ov = openOverlay();
    if (ov) {
      if (ov.id === "bookView") closeViewer();
      else if (ov.id === "leaveSheet") $("leaveNo").click();
      else ov.hidden = true;
    } else if (bookOpen) $("bookBack").click();
    else if (soloMode) {
      if (pad && pad.dirty) toast("Pulsa «Guardar» para guardar tu dibujo, o «Salir» si no lo quieres.");
      else exitSolo();
    } else if (state) askLeave(false);
    if (needsGuard()) guardBack();
  });

  // ---------- render principal ----------
  function renderChrome() {
    const inRoom = !!state;
    $("roomChip").hidden = !inRoom;
    $("leaveBtn").hidden = !inRoom;

    $("topbar").classList.toggle("in-room", inRoom);
    if (inRoom) $("roomChip").textContent = state.code;
  }

  function renderPause() {
    const p = state && state.phase === "playing" ? state.paused : null;
    $("pauseBar").hidden = !p;
    document.body.classList.toggle("is-paused", !!p);
    if (!p) return;
    const names = p.away.map((a) => a.name).join(", ");
    const left = p.away.length && p.away.every((a) => a.left);
    $("pauseText").textContent = names
      ? `Partida en pausa: ${names} ${p.away.length > 1 ? (left ? "se han ido" : "no están conectados") : left ? "se ha ido" : "se ha desconectado"}. Esperando a que vuelva…`
      : "Partida en pausa. Esperando a que vuelva alguien…";
    $("endGameBtn").hidden = !isHost();
  }
  $("endGameBtn").addEventListener("click", () => {
    SFX.play("click");
    $("endSheet").hidden = false;
  });
  $("endNo").addEventListener("click", () => ($("endSheet").hidden = true));
  $("endYes").addEventListener("click", () => {
    $("endSheet").hidden = true;
    socket.emit("endGame");
  });

  // Mientras dibujas: cuántos de los demás ya han entregado («✅ 1 de 3 ya han terminado»)
  function updateDoneCount() {
    const box = $("drawDoneCount");
    if (!box) return;
    const t = state && state.task;
    const others = state && state.phase === "playing" && t && t.type === "draw" ? state.players.filter((p) => p.id !== state.you && !p.left) : [];
    if (!others.length || soloMode) {
      box.hidden = true;
      return;
    }
    const n = others.filter((p) => p.done).length;
    box.textContent = n === 0 ? `Nadie ha terminado aún · ${others.length} más dibujando` : `✅ ${n} de ${others.length} ya ${n === 1 ? "ha" : "han"} terminado`;
    box.classList.toggle("all", n === others.length);
    box.hidden = false;
  }
  function render() {
    if (outdated && state && (state.phase === "lobby" || state.phase === "end") && !soloMode && !bookOpen) {
      outdated = false;
      $("updateBar").hidden = false; // se ofrece, sin recargar por sorpresa
    }
    if (meOpen && state && state.phase !== "lobby") {
      // empieza la partida: se sale de «Tú»
      syncMeName();
      meOpen = false;
      backToMe = false;
    }
    if (meOpen) {
      renderChrome();
      return;
    }
    if (soloMode || bookOpen) {
      if (state && state.phase !== "lobby") {
        // Empieza la partida mientras dibujabas: lo que llevabas se guarda solo en el cuaderno
        if (soloMode && !faceMode && pad && pad.dirty && !editingId) {
          if (addToBook({ prompt: $("drawWhat").textContent || "Dibujo libre" }, pad.toDataURL("image/jpeg", 0.85))) toast("Ha empezado la partida: tu dibujo se ha guardado en el cuaderno 📒");
        }
        exitSolo(true);
      } else {
        renderChrome();
        return;
      }
    }
    renderChrome();
    renderPause();
    renderRequests();
    if (!state) return showHome();
    if (state.phase === "lobby") return renderLobby();
    updateDoneCount();
    if (state.phase === "playing") return renderPlaying();
    if (state.phase === "reveal") return renderReveal();
    if (state.phase === "end") return renderEnd();
  }

  function playerItem(p, opts = {}) {
    const li = el("li", "player chip" + (p.connected ? "" : " off") + (p.left ? " left" : ""));
    li.appendChild(AVATARS.avatarEl(p.emoji, "p-emoji"));
    li.appendChild(el("span", "p-name", p.name));
    const tags = el("span", "p-tags");
    if (p.id === state.you) {
      tags.appendChild(el("span", "tag you", "tú"));
      if (state.phase === "lobby" && !opts.status) {
        // tu propia ficha: tocarla abre «Tú» (nombre y carita)
        li.classList.add("me-chip");
        li.setAttribute("role", "button");
        li.tabIndex = 0;
        li.title = "Cambiar tu nombre o tu carita";
        li.addEventListener("click", () => openMe());
        tags.appendChild(el("span", "me-edit", "Editar perfil"));
      }
    }
    if (p.id === state.hostId) tags.appendChild(el("span", "tag host", "anfitrión"));
    if (p.bot) tags.appendChild(el("span", "tag", "robot"));
    if (p.left) tags.appendChild(el("span", "tag", "se fue"));
    else if (!p.connected) tags.appendChild(el("span", "tag warn", "sin conexión"));
    if (opts.status) tags.appendChild(el("span", "p-status " + (p.done ? "ok" : "pending"), p.done ? "✔" : "…"));
    li.appendChild(tags);
    return li;
  }

  // ---------- sala de espera ----------
  // Modos de juego (el menú de la sala)
  const MODES = [
    { v: "telefono", emoji: "✏️", name: "Clásico", desc: "Frase, dibujo, adivina… ¡y mirad cómo cambia la historia!" },
    { v: "degradado", emoji: "🌀", name: "Degradado", desc: "Copiad un dibujo de memoria, cada vez con menos tiempo." },
    { v: "triptico", emoji: "🧩", name: "Tríptico", desc: "Cabeza, cuerpo y piernas, cada parte de alguien distinto." },
    { v: "votacion", emoji: "⭐", name: "Votación", desc: "Todos dibujáis la misma frase y os puntuáis del 1 al 5." },
    { v: "extremo", emoji: "🔥", name: "Dibujo extremo", desc: "Como el clásico, pero con limitaciones locas al dibujar." },
    { v: "parejas", emoji: "👯", name: "Por parejas", min: "desde 3", desc: "De dos en dos en el mismo lienzo, y luego todos puntúan." },
    { v: "retratos", emoji: "🖼️", name: "Retratos", desc: "Retratas en secreto a otro jugador; todos puntúan el parecido." },
  ];
  const modeInfo = (v) => MODES.find((m) => m.v === v) || MODES[0];
  function buildModeList() {
    const box = $("modeList");
    box.innerHTML = "";
    for (const m of MODES) {
      const b = el("button", "mode-item");
      b.type = "button";
      b.dataset.v = m.v;
      b.setAttribute("aria-pressed", String(state && state.settings.mode === m.v));
      b.appendChild(el("span", "mi-emoji", m.emoji));
      const t = el("span", "mi-text");
      const nm = el("strong", "", m.name);
      if (m.min) nm.appendChild(el("small", "mi-min", m.min));
      t.appendChild(nm);
      t.appendChild(el("span", "", m.desc));
      b.appendChild(t);
      b.addEventListener("click", () => {
        SFX.play("click");
        $("modeSheet").hidden = true;
        if (isHost()) socket.emit("settings", { mode: m.v });
        track("modo_elegido", { modo: m.v });
      });
      box.appendChild(b);
    }
  }
  $("modeBtn").addEventListener("click", () => {
    if (!isHost()) return;
    SFX.play("click");
    buildModeList();
    $("modeSheet").hidden = false;
  });
  $("modeClose").addEventListener("click", () => ($("modeSheet").hidden = true));
  $("modeSheet").addEventListener("click", (e) => {
    if (e.target === $("modeSheet")) $("modeSheet").hidden = true;
  });
  function modeCopy(n) {
    if (state.settings.mode === "degradado") {
      return ["Degradado", "El primero se inventa un dibujo en 3 min; los demás lo ven 10 s y lo copian de memoria cada vez más rápido."];
    }
    if (state.settings.mode === "extremo") {
      const steps = n === 2 ? 4 : n === 3 ? 5 : Math.max(n, 2);
      const rule = state.settings.rule || "mix";
      const txt = rule === "mix" ? "Como el clásico, pero cada vuelta de dibujo con una limitación distinta: ⭕ círculos, ⬛ cuadrados o 〰️ de un trazo." : rule === "circles" ? "Como el clásico, pero dibujando solo con círculos." : rule === "squares" ? "Como el clásico, pero dibujando solo con cuadrados." : "Como el clásico, pero cada dibujo de un solo trazo, sin levantar el lápiz.";
      return [`Dibujo extremo · ${steps} pasos por historia`, txt];
    }
    if (state.settings.mode === "triptico") {
      const two = state.players.filter((p) => !p.left).length === 2;
      return [
        "Tríptico · cabeza, cuerpo y piernas",
        two
          ? "Con dos, cada uno empieza una criatura y os vais turnando: tú una cabeza, el otro el cuerpo, tú las piernas… viendo solo la unión con la parte anterior."
          : "Cada criatura la dibujan tres personas: cabeza, cuerpo y piernas, viendo solo la unión con la parte anterior. Al final se descubren enteras.",
      ];
    }
    if (state.settings.mode === "parejas") {
      const three = state.players.filter((p) => !p.left).length === 3;
      return [
        `Por parejas · ${state.settings.duoRounds} rondas`,
        three
          ? "Con tres: una pareja dibuja a la vez en el mismo lienzo contra uno solo, y os puntuáis del 1 al 5. Cada ronda cambia quién va solo."
          : "Uno elige qué dibujar y cada pareja lo dibuja a la vez en un lienzo compartido. Todos puntuáis del 1 al 5; los puntos son de cada uno y las parejas cambian cada ronda.",
      ];
    }
    if (state.settings.mode === "retratos") {
      return [`Retratos · ${state.settings.duoRounds} rondas`, "Cada uno retrata en secreto a otro jugador y todos puntuáis el parecido del 1 al 5, sin saber quién dibujó."];
    }
    const vote = state.settings.mode === "votacion";
    if (vote) {
      return [`Votación · ${state.settings.duoRounds} rondas`, "Todos dibujáis la misma frase y puntuáis los dibujos de los demás del 1 al 5, sin saber de quién son. Gana quien más estrellas sume."];
    }
    if (n < 2) return ["Clásico", "Frase → dibujo → adivina… Los pasos se adaptan al número de jugadores; con 2 se juega en modo Dúo."];
    if (n === 2) return ["Modo Dúo", "Dibujáis a la vez una frase secreta y adivináis el dibujo del otro. Sumáis puntos en equipo."];
    const steps = n === 3 ? 5 : n;
    const seq = [];
    for (let k = 0; k < steps; k++) seq.push(k === 0 ? "frase" : k % 2 ? "dibujo" : "adivina");
    return [`Clásico · ${steps} pasos por historia`, seq.join(" → ") + (n === 3 ? " (con 3, la historia da vuelta y media)" : "")];
  }
  function renderLobby() {
    show("s-lobby");
    currentStepKey = null;
    const n = state.players.length;
    $("lobbyCode").textContent = state.code;
    $("shareLink").value = location.origin + "/?sala=" + state.code;
    $("playerCount").textContent = `${n} de ${state.maxPlayers}`;
    // Cuánta gente falta para empezar: en el cuadro de jugadores
    const minP = state.settings.mode === "parejas" ? 3 : 2;
    const needed = minP - n;
    $("playersNeed").hidden = needed <= 0;
    if (needed > 0) $("playersNeed").textContent = (needed === 1 ? "Falta 1 jugador" : `Faltan ${needed} jugadores`) + " · comparte el enlace";
    const ul = $("lobbyPlayers");
    ul.innerHTML = "";
    state.players.forEach((p) => ul.appendChild(playerItem(p)));
    const [t, txt] = modeCopy(n);
    $("modeTitle").textContent = (state.practice ? "🧪 Pruebas · " : "") + t;
    $("modeEmoji").textContent = modeInfo(state.settings.mode).emoji;
    $("modeText").textContent = txt;
    const host = isHost();
    if (!timeDragging) {
      const idx = Math.max(0, DRAW_TIMES.indexOf(Number(state.settings.time)));
      $("timeRange").value = idx;
      paintTime(idx);
    }
    $("timeRange").disabled = !host;
    $("modeBtn").disabled = !host;
    // Dibujo extremo: qué limitación
    $("ruleSetting").hidden = state.settings.mode !== "extremo";
    $("ruleValue").textContent = { mix: "Variada", circles: "Solo círculos", squares: "Solo cuadrados", oneline: "Sin levantar el lápiz" }[state.settings.rule || "mix"];
    for (const b of $("ruleSeg").children) {
      b.setAttribute("aria-pressed", String(b.dataset.v === (state.settings.rule || "mix")));
      b.disabled = !host;
    }
    // Degradado tiene sus propios tiempos
    $("timeSetting").hidden = state.settings.mode === "degradado";
    for (const b of $("roundsSeg").children) {
      b.setAttribute("aria-pressed", String(Number(b.dataset.v) === state.settings.duoRounds));
      b.disabled = !host;
    }
    const voteMode = ["votacion", "retratos", "parejas"].includes(state.settings.mode);
    $("duoRoundsSetting").hidden = !(voteMode || (n === 2 && state.settings.mode === "telefono"));
    const hostP = state.players.find((p) => p.id === state.hostId);
    $("notHostHint").textContent = host ? "" : `${nameOf(hostP, "El anfitrión")} elige las opciones y empieza la partida.`;
    $("startBtn").hidden = !host;
    const need = minP;
    $("startBtn").disabled = n < need;
    $("startBtn").textContent = n < need ? "Esperando jugadores…" : "Empezar partida";
  }
  // Tiempo para dibujar: barra de 30 s a 5 min, y al final «sin límite»
  const DRAW_TIMES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 0];
  let timeDragging = false;
  function timeLabel(sec) {
    if (!sec) return "Sin límite";
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    if (!m) return `${r} s`;
    return r ? `${m} min ${r} s` : `${m} min`;
  }
  function paintTime(idx) {
    const r = $("timeRange");
    $("timeValue").textContent = timeLabel(DRAW_TIMES[idx]);
    r.style.setProperty("--fill", (idx / (DRAW_TIMES.length - 1)) * 100 + "%");
  }
  $("timeRange").addEventListener("input", (e) => {
    timeDragging = true;
    paintTime(Number(e.target.value));
  });
  $("timeRange").addEventListener("change", (e) => {
    timeDragging = false;
    if (!isHost()) return;
    SFX.play("click");
    socket.emit("settings", { time: DRAW_TIMES[Number(e.target.value)] });
  });
  $("ruleSeg").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.v;
    if (v && isHost()) {
      SFX.play("click");
      socket.emit("settings", { rule: v });
    }
  });
  $("roundsSeg").addEventListener("click", (e) => {
    const v = e.target.dataset && e.target.dataset.v;
    if (v && isHost()) {
      SFX.play("click");
      socket.emit("settings", { duoRounds: Number(v) });
    }
  });
  $("startBtn").addEventListener("click", () => {
    keepAwake();
    socket.emit("start");
  });
  $("copyBtn").addEventListener("click", async () => {
    const v = $("shareLink").value;
    try {
      await navigator.clipboard.writeText(v);
      SFX.play("pop");
      flashBtn($("copyBtn"), "✔ Copiado");
    } catch (_) {
      $("shareLink").hidden = false;
      $("shareLink").select();
      toast("Selecciona el enlace y cópialo");
    }
  });

  // ---------- turnos ----------
  function stepLabel(task) {
    if (task.tiebreak) return "Ronda de desempate";
    if (state.mode === "duo" || state.mode === "vote") return `Ronda ${task.round} de ${task.rounds}`;
    return `Paso ${task.stepNumber} de ${task.totalSteps}`;
  }

  function renderPlaying() {
    if (state.voteResult) return renderVoteResult();
    if (state.result) return renderResult();
    const task = state.task;
    if (!task) return;
    const isNew = task.stepKey !== currentStepKey;
    if (isNew) {
      currentStepKey = task.stepKey;
      autoSubmitted = null;
      prepareTask(task);
    }
    if (task.submitted) return renderWait(task);
    // Un dibujo que llegó tarde: en vez del lienzo en blanco, se enseña
    if (!isNew && task.type === "guess" && task.prompt && task.prompt.kind === "image" && task.prompt.value && $("textPromptFig").hidden) {
      $("textPromptImg").src = task.prompt.value;
      $("textPromptFig").hidden = false;
      $("textPromptEmpty").hidden = true;
      $("textSpacer").hidden = true;
    }
    if (task.type === "draw") {
      show("s-draw");
      const copying = task.variant === "degrade" && task.prompt && task.prompt.kind === "image";
      $("drawWhat").textContent = task.variant === "triptych" ? TRIPTYCH_WHAT[task.part] || "" : copying ? "Cópialo de memoria" : task.variant === "degrade" ? "Invéntate un dibujo: lo que quieras" : task.secret != null ? task.secret : task.prompt ? (task.prompt.value || "(sin respuesta)") : "";
      $("drawWhat").classList.toggle("long", $("drawWhat").textContent.length > 26);
      $("rerollBtn").hidden = !(task.secret != null && task.rerolls > 0);
      $("rerollBtn").textContent = `🎲 ${task.rerolls}`;
    } else if (task.type === "vote") {
      show("s-vote");
      paintVote();
    } else show("s-text");
  }

  function prepareTask(task) {
    const prompt = task.prompt;
    sending = null;
    $("drawDone").disabled = false;
    if (!soloMode) $("drawDone").textContent = "¡Listo!";
    if (task.type === "draw") {
      ensurePad();
      // Por parejas: lienzo compartido, siempre vertical y sin deshacer (deshacer borraría lo del otro)
      const pairs = task.kind === "pairs";
      pad.shared = pairs;
      pad.selfId = state.you;
      pad.forcePortrait = pairs;
      // Tríptico: cada parte en una franja horizontal, como el papel doblado
      pad.forceLandscape = task.variant === "triptych";
      pad.remote = {};
      document.body.classList.toggle("pairs-draw", pairs);
      document.body.classList.toggle("triptych-draw", task.variant === "triptych");
      pad.reset();
      // Cada dibujo nuevo empieza con lápiz negro y tamaño estándar
      pad.tool = "pen";
      lastBrush = "pen";
      pad.color = COLORS[0];
      pad.size = SIZES[2];
      syncFree(COLORS[0]);
      closePops();
      updateToolbar();
      $("drawStep").textContent = stepLabel(task);
      pad.setRule(task.rule || null);
      applyRuleToolbar(task.rule || null);
      pad.setGuide(null);
      pad.setLock(null);
      setPrevColors(null);
      bandWarned = false;
      if (task.variant === "triptych") {
        // La franja de arriba es de la parte anterior: se ve, pero no se pinta en ella
        // (y el cubo de pintura se para ahí). La de abajo es tuya: se dibuja hasta el borde.
        const BAND = 90;
        pad.setLock(task.part !== "head" ? [pad.visualRect(0, 0, 900, BAND)] : []);
        const n = { head: 1, body: 2, legs: 3 }[task.part] || 1;
        $("drawStep").textContent = `Parte ${n} de 3 · ${TRIPTYCH_NAME[task.part]}`;
        const prevImg = task.prompt && task.prompt.kind === "image" ? task.prompt.value : null;
        setPrevColors(task.part !== "head" ? prevImg : null);
        pad.setGuide({
          top: task.part !== "head" ? prevImg || null : null,
          topLabel: "👆 Empieza desde aquí",
          bottom: task.part === "head" ? "👇 ¡Sigue el cuello hasta el borde!" : task.part === "body" ? "👇 ¡Sigue las piernas hasta el borde!" : null,
        });
      } else if (task.variant === "degrade") {
        const copying = task.prompt && task.prompt.kind === "image";
        $("drawStep").textContent = stepLabel(task) + (copying ? ` · De memoria en ${timeLabel(task.seconds)}` : ` · Dibujo libre, ${timeLabel(task.seconds)}`);
        if (copying && task.viewUntil) showMemorize(task);
      } else if (task.variant === "extreme") {
        $("drawStep").textContent = stepLabel(task) + " · " + RULE_LABEL[task.rule];
      } else if (state.mode === "vote" && task.kind === "extreme") {
        $("drawStep").textContent = stepLabel(task) + " · " + RULE_LABEL[task.rule];
      } else if (task.kind === "pairs") {
        $("drawStep").textContent = stepLabel(task) + (task.partners && task.partners.length ? " · Con " + task.partners.map((p) => p.name).join(" y ") : " · Tú solo contra la pareja 💪");
        pairReset();
        pairResync();
      } else if (state.mode === "vote" && task.kind === "portrait") {
        $("drawStep").textContent = stepLabel(task) + " · Retrato secreto 🤫";
      } else if (state.mode === "vote") {
        $("drawStep").textContent = stepLabel(task) + " · Todos dibujáis esto";
      } else if (task.secret != null) {
        $("drawStep").textContent = stepLabel(task) + " · Dibuja en secreto";
      } else {
        $("drawStep").textContent = stepLabel(task) + (prompt && prompt.by ? ` · Frase de ${prompt.by.name}` : " · Dibuja esto");
      }
      return;
    }
    if (task.type === "vote") {
      votes = {};
      vIdx = 0;
      vKey = null;
      delete $("voteGuess").dataset.k;
      $("voteGuess").value = "";
      return;
    }
    $("textStep").textContent = stepLabel(task);
    $("textInput").value = "";
    $("textPromptFig").hidden = true;
    $("textPromptEmpty").hidden = true;
    $("textSpacer").hidden = false;
    if (task.type === "write" && task.kind === "pairs") {
      $("textTitle").textContent = "Te toca elegir qué vais a dibujar todos";
      $("textInput").placeholder = "Ej.: Una nave espacial volando";
      $("textStep").textContent = stepLabel(task) + (task.partners && task.partners.length ? " · Esta ronda vas con " + task.partners.map((p) => p.name).join(" y ") : "");
      $("diceBtn").hidden = false;
    } else if (task.type === "write" && task.nextRule) {
      // Dibujo extremo: se avisa de la limitación con la que se dibujará
      $("textTitle").innerHTML = "";
      $("textTitle").appendChild(document.createTextNode("Se dibujará "));
      $("textTitle").appendChild(el("span", "rule-chip big", RULE_LABEL[task.nextRule]));
      $("textTitle").appendChild(document.createTextNode(" ¿Qué quieres que dibujen?"));
      $("textInput").placeholder = task.nextRule === "oneline" ? "Ej.: Un caracol" : task.nextRule === "circles" ? "Ej.: Un muñeco de nieve" : "Ej.: Un robot";
      $("diceBtn").hidden = false;
    } else if (task.type === "write") {
      $("textTitle").textContent = "Escribe una frase para que alguien la dibuje";
      $("textInput").placeholder = "Ej.: Un pulpo bailando";
      $("diceBtn").hidden = false;
    } else {
      $("textTitle").textContent = state.mode === "duo" ? "¿Qué ha dibujado tu pareja?" : "¿Qué crees que es este dibujo?";
      $("textInput").placeholder = "Escribe lo que ves";
      $("diceBtn").hidden = true;
      if (prompt && prompt.value) {
        $("textPromptImg").src = prompt.value;
        if (prompt.by) setWho($("textPromptBy"), "Dibujo de", prompt.by);
        else $("textPromptBy").textContent = "";
        $("textPromptFig").hidden = false;
        $("textSpacer").hidden = true;
      } else {
        $("textPromptEmpty").hidden = false;
        $("textSpacer").hidden = true;
      }
    }
    setTimeout(() => {
      if (!$("s-text").hidden && window.matchMedia("(pointer: fine)").matches) $("textInput").focus();
    }, 50);
  }

  /**
   * Envío seguro (texto y votos): con confirmación del servidor. Si no llega en unos segundos,
   * se reconecta y se reenvía solo al volver (igual que los dibujos).
   */
  function submitSafe(content, btn) {
    const key = currentStepKey;
    const pd = { key, content };
    pendingDrawing = pd; // se reenvía al reconectar si no llega la confirmación
    const label = btn ? btn.textContent : "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Enviando…";
    }
    const restore = () => {
      if (btn && btn.textContent === "Enviando…") {
        btn.disabled = false;
        btn.textContent = label;
      }
    };
    const slow = setTimeout(() => {
      if (pendingDrawing !== pd) return;
      restore();
      toast("La conexión va lenta. Lo reenviamos en cuanto vuelva; si no avanza, pulsa otra vez.");
      reconnect();
    }, 6000);
    socket.emit("submit", { stepKey: key, content }, () => {
      clearTimeout(slow);
      if (pendingDrawing === pd) pendingDrawing = null;
      restore();
    });
    SFX.play("send");
  }
  function sendText() {
    const v = $("textInput").value.trim();
    if (!v) {
      toast(state.task.type === "write" ? "Escribe algo o pulsa «Dame una idea»." : "Escribe lo que crees que es.");
      return false;
    }
    submitSafe(v, $("textForm").querySelector('button[type="submit"]'));
    return true;
  }
  $("textForm").addEventListener("submit", (e) => {
    e.preventDefault();
    // Apple Pencil (escritura a mano): primero se cierra el campo para que termine de convertir
    // lo escrito en texto; luego se lee y se envía
    const input = $("textInput");
    if (document.activeElement === input) input.blur();
    setTimeout(() => sendText(), 80);
  });
  $("diceBtn").addEventListener("click", () => {
    $("textInput").value = idea(state && state.variant === "extreme" ? "extreme" : "classic");
  });

  // ---------- dibujo extremo: limitaciones ----------
  const RULE_LABEL = { circles: "⭕ Solo círculos", squares: "⬛ Solo cuadrados", oneline: "〰️ Sin levantar el lápiz" };
  const RULE_TOOLS = { circles: ["pen", "fill"], squares: ["pen", "fill"], oneline: ["pen"] };
  function applyRuleToolbar(rule) {
    brushLocked = rule === "circles" || rule === "squares";
    document.querySelectorAll(".tool[data-tool]").forEach((b) => (b.hidden = !!rule && !RULE_TOOLS[rule].includes(b.dataset.tool)));
    const pen = document.querySelector("[data-tool=pen]");
    if (pen) pen.title = rule === "circles" ? "Círculo" : rule === "squares" ? "Cuadrado" : "Lápiz";
    updateToolbar();
  }

  // ---------- degradado: mirar el dibujo 10 segundos ----------
  let memoTimer = null;
  function showMemorize(task) {
    const left = () => Math.ceil((task.viewUntil - now()) / 1000);
    if (left() <= 0) return;
    $("memorizeImg").src = task.prompt.value;
    $("memorize").hidden = false;
    clearInterval(memoTimer);
    let lastL = null;
    const tick = () => {
      const l = left();
      if (l <= 0 || !state || !state.task || state.task.stepKey !== task.stepKey) {
        clearInterval(memoTimer);
        $("memorize").hidden = true;
        if (l <= 0) SFX.play("turn");
        return;
      }
      $("memorizeCount").textContent = l;
      if (l <= 3 && l !== lastL) SFX.play("tick");
      lastL = l;
    };
    tick();
    memoTimer = setInterval(tick, 250);
  }

  // Imagen ligera para que suba rápido aunque la conexión vaya justa (p. ej. con videollamada)
  function drawingData() {
    try {
      const webp = pad.toDataURL("image/webp", 0.85);
      if (webp.indexOf("data:image/webp") === 0) return webp;
    } catch (_) {}
    return pad.toDataURL("image/jpeg", 0.88);
  }
  let sending = null;
  let pendingDrawing = null; // dibujo enviado sin confirmar: se reenvía al reconectar
  function sendDrawing() {
    if (pad.orient === "h") track("dibujo_horizontal", { modo: modeName(state && state.mode) });
    const key = currentStepKey;
    const t0 = Date.now();
    sending = key;
    $("drawDone").disabled = true;
    $("drawDone").textContent = "Enviando…";
    const slow = setTimeout(() => {
      if (sending !== key) return;
      sending = null;
      // Se puede volver a pulsar «¡Listo!» cuando vuelva la conexión
      $("drawDone").disabled = false;
      $("drawDone").textContent = "¡Listo!";
      toast("La conexión va lenta. Si no avanza, pulsa otra vez «¡Listo!».");
      reconnect();
    }, 9000);
    const content = drawingData();
    pendingDrawing = { key, content };
    socket.emit("submit", { stepKey: key, content }, (res) => {
      clearTimeout(slow);
      if (pendingDrawing && pendingDrawing.key === key) pendingDrawing = null;
      if (sending === key) sending = null;
      $("drawDone").disabled = false;
      $("drawDone").textContent = soloMode ? "Guardar" : "¡Listo!";
      if (res && res.late) {
        if (res.ok) toast("Tu dibujo ha llegado un pelín tarde, pero ya está en su sitio.");
        else toast("El tiempo ya había terminado y tu dibujo no llegó a tiempo.");
      }
      if (Date.now() - t0 > 4000) track("envio_lento", { segundos: Math.round((Date.now() - t0) / 1000) });
    });
    SFX.play("send");
  }
  /** Lienzo en blanco: se manda «nada» (en la partida se ve como lienzo en blanco) */
  function sendBlank() {
    const key = currentStepKey;
    $("drawDone").disabled = true;
    socket.emit("submit", { stepKey: key, content: null }, () => {
      $("drawDone").disabled = false;
    });
    SFX.play("send");
  }
  // Latido: cada pocos segundos el móvil comprueba que el servidor le sigue teniendo dentro.
  // Si no contesta (conexión «zombi» tras bloquear la pantalla o cambiar de app), se reconecta.
  function checkAlive() {
    if (!state || !socket.connected) return;
    try {
      socket.timeout(5000).emit("alive", {}, (err, res) => {
        if (err || !res || !res.ok) {
          track("latido_fallido", { motivo: err ? "sin_respuesta" : "fuera" });
          reconnect();
        }
      });
    } catch (_) {}
  }
  setInterval(checkAlive, 8000);
  // Si un intento de reconexión se queda a medias, se vuelve a intentar
  setInterval(() => {
    if (socket.connected) return;
    if (!downSince) downSince = Date.now();
    if (Date.now() - downSince > 7000 && navigator.onLine !== false) {
      downSince = Date.now();
      try {
        socket.disconnect();
        socket.connect();
      } catch (_) {}
    }
  }, 2500);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkAlive();
  });
  window.addEventListener("online", () => state && reconnect());
  // El alojamiento gratuito se duerme si no recibe visitas: mientras hay partida, se le da un toque
  setInterval(() => {
    if (state) fetch("/salud", { cache: "no-store" }).catch(() => {});
  }, 4 * 60 * 1000);

  // Fuerza una conexión nueva: al volver, el servidor manda cómo va la partida
  let lastReconnect = 0;
  function reconnect() {
    if (Date.now() - lastReconnect < 8000) return;
    lastReconnect = Date.now();
    try {
      socket.disconnect();
      socket.connect();
    } catch (_) {}
  }
  $("drawDone").addEventListener("click", () => {
    if (faceMode) return saveFace();
    if (faceDraft) return finishFaceDraft();
    if (soloMode) return saveToBook();
    if (!pad.dirty) return sendBlank(); // sin dibujar: va el lienzo en blanco, sin avisos
    // Tríptico: si no has bajado hasta la franja de abajo, se avisa una vez
    const t = state.task;
    if (t && t.variant === "triptych" && t.part !== "legs" && !bandWarned && !pad.inkIn(0, 515, 900, 79)) {
      bandWarned = true;
      SFX.play("pop");
      toast(t.part === "head" ? "¡Ojo! El cuello no llega abajo y el siguiente no sabrá seguir. Pulsa ¡Listo! otra vez para enviarlo igual." : "¡Ojo! Las piernas no llegan abajo y el siguiente no sabrá seguir. Pulsa ¡Listo! otra vez para enviarlo igual.");
      return;
    }
    sendDrawing();
  });
  $("rerollBtn").addEventListener("click", () => {
    if (soloMode) {
      SFX.play("pop");
      return newIdea();
    }
    socket.emit("reroll");
  });

  function renderWait(task) {
    show("s-wait");
    const choosing = task.kind === "pairs" && task.type === "write" && !task.isChooser;
    $("waitTitle").textContent = choosing
      ? `${task.chooser ? task.chooser.name : "Alguien"} está eligiendo qué vais a dibujar…` + (task.partners && task.partners.length ? ` Esta ronda vas con ${task.partners.map((p) => p.name).join(" y ")}.` : "")
      : "¡Hecho! Esperando a los demás…";
    $("unsubmitBtn").hidden = choosing;
    $("waitBadge").textContent = choosing ? "⏳" : "✔";
    $("waitBadge").classList.toggle("thinking", choosing);
    const ul = $("waitPlayers");
    ul.innerHTML = "";
    state.players.forEach((p) => ul.appendChild(playerItem(p, { status: true })));
  }
  $("unsubmitBtn").addEventListener("click", () => socket.emit("unsubmit"));

  // Reloj: cuenta atrás y envío automático al acabarse el tiempo
  let lastSec = null;
  let watchdogKey = null;
  function fmt(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  setInterval(() => {
    const task = state && state.phase === "playing" && !state.result && !state.voteResult && !state.paused ? state.task : null;
    if (state && state.paused) {
      [$("textTimer"), $("drawTimer"), $("waitTimer"), $("voteTimer")].forEach((t) => {
        t.textContent = "⏸";
        t.classList.remove("urgent");
      });
      document.body.classList.remove("hurry");
      return;
    }
    const timers = [$("textTimer"), $("drawTimer"), $("waitTimer"), $("voteTimer")];
    if (!task || !task.deadline || task.submitted) document.body.classList.remove("hurry");
    if (!task || !task.deadline) {
      timers.forEach((t) => {
        t.textContent = task ? "∞" : "";
        t.classList.remove("urgent");
      });
      return;
    }
    const left = task.deadline - now();
    // Tiempo agotado hace rato y la partida no avanza en este móvil: conexión atascada
    if (left < -12000 && watchdogKey !== currentStepKey) {
      watchdogKey = currentStepKey;
      track("reconexion_atasco");
      reconnect();
    }
    timers.forEach((t) => {
      t.textContent = fmt(left);
      t.classList.toggle("urgent", left < 10000);
    });
    const hurry = left < 10000 && left > 0 && !task.submitted;
    document.body.classList.toggle("hurry", hurry);
    const sec = Math.ceil(left / 1000);
    if (!task.submitted && sec !== lastSec) {
      if (sec === 10) SFX.vibrate([120, 80, 120]);
      if (sec >= 1 && sec <= 5) SFX.play("tick");
      if (sec === 0) {
        SFX.play("timeup");
        SFX.vibrate(300);
      }
    }
    lastSec = sec;
    if (left < 700 && !task.submitted && autoSubmitted !== currentStepKey) {
      autoSubmitted = currentStepKey;
      if (task.type === "draw") {
        if (pad && pad.dirty) sendDrawing();
      } else if (task.type === "vote") {
        if (Object.keys(votes).length) socket.emit("submit", { stepKey: currentStepKey, content: votes });
      } else {
        const v = $("textInput").value.trim();
        if (v) socket.emit("submit", { stepKey: currentStepKey, content: v });
      }
    }
  }, 250);

  // ---------- por parejas: lienzo compartido ----------
  // Cada paquete propio lleva un número (bid) y se guarda hasta que el servidor lo confirma (nos vuelve
  // de rebote); si no, se reenvía. Lo del equipo llega numerado (i) y se pinta en orden: si falta un
  // trozo, se pide al servidor antes de seguir. Cada pocos segundos, además, se pregunta «¿me falta algo?».
  let opQueue = [];
  let opTimer = null;
  let pairSeen = -1; // último trozo del equipo ya pintado (en orden)
  const pairPending = new Map(); // trozos que llegaron antes de tiempo: i -> {from, ops, bid}
  const outbox = new Map(); // bid -> {ops, key, sentAt}: enviados sin confirmar
  const myBids = new Set(); // paquetes propios ya pintados en este lienzo
  const BID_PREFIX = Math.random().toString(36).slice(2, 8);
  let bidSeq = 0;
  let lastSyncAsk = 0;
  function pairReset() {
    opQueue = [];
    clearTimeout(opTimer);
    opTimer = null;
    pairSeen = -1;
    pairPending.clear();
    outbox.clear();
    myBids.clear();
  }
  function queueOp(op) {
    const last = opQueue[opQueue.length - 1];
    // los puntos seguidos van juntos en un mismo paquete
    if (op.t === "m" && last && last.t === "m" && last.p.length < 600) last.p.push(...op.p.map((v) => Math.round(v * 10) / 10));
    else opQueue.push(op.t === "m" ? { t: "m", p: op.p.map((v) => Math.round(v * 10) / 10) } : op);
    if (!opTimer) opTimer = setTimeout(flushOps, 50);
  }
  function flushOps() {
    opTimer = null;
    if (!opQueue.length) return;
    const ops = opQueue;
    opQueue = [];
    const bid = BID_PREFIX + "-" + ++bidSeq;
    myBids.add(bid);
    outbox.set(bid, { ops, key: currentStepKey, sentAt: Date.now() });
    socket.emit("pairOps", { key: currentStepKey, ops, bid });
  }
  const pairDrawing = () => state && state.phase === "playing" && state.task && state.task.kind === "pairs" && state.task.type === "draw" && pad;
  /** Un trozo del registro del equipo: se pinta solo cuando le toca (en orden) */
  function pairEntry(e) {
    if (typeof e.i !== "number" || e.i <= pairSeen) return;
    if (e.from === state.you && e.bid) outbox.delete(e.bid);
    if (e.i > pairSeen + 1) {
      pairPending.set(e.i, e);
      pairSync(); // falta algo por medio: se pide
      return;
    }
    // lo mío ya está pintado en este lienzo; solo se pinta si viene de antes (p. ej. tras recargar)
    if (e.from !== state.you || !myBids.has(e.bid)) pad.applyRemote(e.from, e.ops || []);
    pairSeen = e.i;
    const next = pairPending.get(pairSeen + 1);
    if (next) {
      pairPending.delete(pairSeen + 1);
      pairEntry(next);
    }
  }
  socket.on("pairOps", (d) => {
    if (!pairDrawing() || !d || d.key !== currentStepKey) return;
    pairEntry(d);
  });
  socket.on("pairAck", (d) => {
    if (d && d.bid) outbox.delete(d.bid);
  });
  /** «¿Me falta algo?»: el servidor manda lo que haya desde el último trozo pintado */
  function pairSync(force) {
    if (!pairDrawing() || !socket.connected) return;
    if (!force && Date.now() - lastSyncAsk < 1000) return;
    lastSyncAsk = Date.now();
    const key = currentStepKey;
    socket.emit("pairSync", { since: pairSeen }, (res) => {
      if (!res || !res.ok || res.key !== key || key !== currentStepKey || !pad) return;
      (res.entries || []).forEach((e) => pairEntry(e));
    });
  }
  const pairResync = () => pairSync(true);
  // Vigilancia: reenviar lo no confirmado y preguntar si falta algo
  setInterval(() => {
    if (!pairDrawing() || !socket.connected) return;
    const t = Date.now();
    for (const [bid, b] of outbox) {
      if (b.key !== currentStepKey) {
        outbox.delete(bid);
        continue;
      }
      if (t - b.sentAt > 2500) {
        b.sentAt = t;
        socket.emit("pairOps", { key: b.key, ops: b.ops, bid });
      }
    }
    if (t - lastSyncAsk > 3000) pairSync();
  }, 1000);

  // ---------- lienzo y herramientas ----------
  const ICONS = {
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>',
    eraser: '<path d="M8 20h12"/><path d="M5 15l8-9 6 6-7 8H9z"/><path d="M9 11l5 5"/>',
    fill: '<path d="M3.5 10.5l6.5-6.5 7 7-6.5 6.5a1.5 1.5 0 01-2.1 0L3.5 12.6a1.5 1.5 0 010-2.1z" fill="var(--paint)" fill-opacity=".9"/><path d="M8 5.5L6 3.5"/><path d="M19 13.5s2.5 3 2.5 4.8a2.5 2.5 0 01-5 0c0-1.8 2.5-4.8 2.5-4.8z" fill="var(--paint)"/>',
    marker: '<path d="M14.5 4.5l5 5-8 8-5-5z" fill="var(--paint)" fill-opacity=".55"/><path d="M6.5 12.5l-2 6 1 1 6-2"/><path d="M4.5 18.5l-1.5 1.5"/>',
    water: '<path d="M14 4l6 6-7 7-6-6z"/><path d="M7 11c-2 1-3 3-3 5 0 1.5-.8 2.5-2 3 3 1 7 .5 8.5-1.5" fill="var(--paint)" fill-opacity=".45"/>',
    line: '<path d="M5 19L19 5"/>',
    rect: '<rect x="4.5" y="6.5" width="15" height="11" rx="1"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
    tri: '<path d="M12 5l8 14H4z"/>',
    spray: '<rect x="4" y="9" width="8" height="12" rx="2" fill="var(--paint)" fill-opacity=".9"/><path d="M6 9V6h4v3"/><path d="M8 6V4h3"/><circle cx="16" cy="4" r=".9" fill="currentColor" stroke="none"/><circle cx="19" cy="6" r=".9" fill="currentColor" stroke="none"/><circle cx="16.5" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="20" cy="9.5" r=".9" fill="currentColor" stroke="none"/><circle cx="18" cy="11.5" r=".9" fill="currentColor" stroke="none"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
    clear: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  };
  const svg = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  document.querySelectorAll("[data-tool]").forEach((b) => (b.innerHTML = svg(ICONS[b.dataset.tool])));
  $("undoBtn").innerHTML = svg(ICONS.undo);
  $("redoBtn").innerHTML = svg(ICONS.redo);
  $("clearBtn").innerHTML = svg(ICONS.clear);

  const sizePx = (i) => Math.round(4 + (i * 22) / (SIZES.length - 1));
  function ensurePad() {
    if (pad) return;
    pad = new Pad($("pad"), {
      onChange: updateToolbar,
      onBlocked: () => toast("¡Sin levantar el lápiz! Si quieres empezar otra vez, pulsa deshacer ↩."),
      onOp: queueOp,
      onStroke: (kind, v) => {
        if ((kind === "start" || kind === "fill") && pad.tool !== "eraser") addRecent(pad.color);
        if (kind === "fill") return SFX.play("splash");
        if (kind === "start") SFX.strokeStart(v);
        else if (kind === "move") SFX.strokeMove(v);
        else SFX.strokeStop();
      },
      // El dibujo ya tiene orientación y el móvil está girado al revés: se avisa
      onOrient: (mismatch) => {
        if (mismatch && !$("s-draw").hidden) toast(pad.orient === "h" ? "Este dibujo es horizontal: gira el móvil para verlo en grande." : "Este dibujo es vertical: gira el móvil para verlo en grande.");
      },
    });
    const badge = el("span", "zoom-badge");
    badge.id = "zoomBadge";
    badge.hidden = true;
    badge.textContent = "100%";
    $("pad").appendChild(badge);
    // Lienzo ampliado: botón para verlo entero otra vez
    const fit = el("button", "fit-btn", "⤢ Ver entero");
    fit.id = "fitBtn";
    fit.type = "button";
    fit.hidden = true;
    fit.addEventListener("click", () => {
      SFX.play("click");
      pad.setZoom(1);
      pad.stage.scrollLeft = 0;
      pad.stage.scrollTop = 0;
      updateToolbar();
    });
    $("pad").appendChild(fit);
    // Botón para elegir lienzo vertical u horizontal
    const ob = el("button", "orient-btn");
    ob.id = "orientBtn";
    ob.type = "button";
    $("pad").appendChild(ob);
    let orientArmed = null;
    ob.addEventListener("click", () => {
      if (!pad.blank && !orientArmed) {
        SFX.play("click");
        toast("Se borrará lo que llevas. Toca otra vez para girar el lienzo.");
        ob.classList.add("armed");
        orientArmed = setTimeout(() => {
          orientArmed = null;
          ob.classList.remove("armed");
        }, 3000);
        return;
      }
      clearTimeout(orientArmed);
      orientArmed = null;
      ob.classList.remove("armed");
      SFX.play("page");
      pad.setOrient(pad.orient !== "h");
      track("lienzo_girado", { a: pad.orient === "h" ? "horizontal" : "vertical" });
    });
    // tamaños (desplegable)
    const sz = $("sizes");
    SIZES.forEach((s, i) => {
      const b = el("button", "size-btn");
      b.type = "button";
      b.dataset.size = s;
      b.setAttribute("aria-label", `Pincel tamaño ${i + 1}`);
      const dot = el("span", "size-dot");
      dot.style.width = dot.style.height = sizePx(i) + "px";
      b.appendChild(dot);
      b.addEventListener("click", () => {
        SFX.play("click");
        pad.size = s;
        if (pad.tool === "fill") pad.tool = "pen";
        updateToolbar();
        closePops();
      });
      sz.appendChild(b);
    });
    pad.size = SIZES[2];
    // colores (desplegable)
    const cs = $("colors");
    COLORS.forEach((c) => {
      const b = el("button", "color-btn");
      b.type = "button";
      b.style.setProperty("--c", c);
      b.dataset.color = c;
      b.setAttribute("aria-label", "Color " + c);
      b.addEventListener("click", () => {
        SFX.play("color");
        pad.color = c;
        if (pad.tool === "eraser") pad.tool = "pen";
        syncFree(c); // las barras se ponen en este color, para ajustarlo desde aquí
        updateToolbar();
        closePops();
      });
      cs.appendChild(b);
    });
    // Colores propios ya usados (fuera de la paleta): se añaden al final
    const recentBox = el("div", "recent-colors");
    cs.appendChild(recentBox);
    renderRecent = () => {
      recentBox.innerHTML = "";
      recentBox.hidden = !recentColors.length;
      recentColors.forEach((c) => {
        const b = el("button", "color-btn");
        b.type = "button";
        b.style.setProperty("--c", c);
        b.dataset.color = c;
        b.setAttribute("aria-label", "Color " + c);
        b.addEventListener("click", () => {
          SFX.play("color");
          pad.color = c;
          if (pad.tool === "eraser") pad.tool = "pen";
          syncFree(c);
          updateToolbar();
          closePops();
        });
        recentBox.appendChild(b);
      });
      updateToolbar();
    };
    renderRecent();
    // Tríptico: los colores que usó la parte anterior van DENTRO de la paleta, cada uno
    // en el sitio del color normal más parecido (así hay los mismos colores de siempre)
    const stdBtns = [...cs.querySelectorAll(":scope > .color-btn")];
    const hex2rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
    const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    let prevBtns = [];
    renderPrev = (list) => {
      prevBtns.forEach((b) => b.remove());
      prevBtns = [];
      stdBtns.forEach((b) => { b.hidden = false; b.classList.remove("from-prev"); });
      const used = new Set();
      list.slice(0, 8).forEach((c) => {
        const rgb = hex2rgb(c);
        let best = null, bd = 1e9;
        for (const b of stdBtns) {
          if (used.has(b)) continue;
          const d = dist(rgb, hex2rgb(b.dataset.color));
          if (d < bd) { bd = d; best = b; }
        }
        if (!best) return;
        used.add(best);
        if (bd < 36) { best.classList.add("from-prev"); return; } // ya está en la paleta: solo se marca
        const b = el("button", "color-btn from-prev");
        b.type = "button";
        b.style.setProperty("--c", c);
        b.dataset.color = c;
        b.setAttribute("aria-label", "Color de la parte anterior");
        b.title = "Color de la parte anterior";
        b.addEventListener("click", () => {
          SFX.play("color");
          pad.color = c;
          if (pad.tool === "eraser") pad.tool = "pen";
          syncFree(c);
          updateToolbar();
          closePops();
        });
        best.hidden = true;
        best.before(b);
        prevBtns.push(b);
      });
      updateToolbar();
    };
    // Color libre: barra de arcoíris (saturación al máximo) + barra de luz
    const free = el("div", "free-color");
    const hueBar = el("div", "hue-bar");
    hueBar.setAttribute("aria-label", "Elegir cualquier color");
    const hueKnob = el("span", "bar-knob");
    hueBar.appendChild(hueKnob);
    const shadeBar = el("div", "shade-bar");
    shadeBar.setAttribute("aria-label", "Más claro o más oscuro");
    const shadeKnob = el("span", "bar-knob");
    shadeBar.appendChild(shadeKnob);
    free.appendChild(el("span", "free-label", "Cualquier color"));
    free.appendChild(hueBar);
    free.appendChild(shadeBar);
    cs.appendChild(free);
    let hue = 0;
    let light = 50;
    let sat = 100;
    const hslHex = (h, l, sv = 100) => {
      const a2 = ((sv / 100) * Math.min(l, 100 - l)) / 100;
      const f = (n) => {
        const k = (n + h / 30) % 12;
        const c = l / 100 - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * c).toString(16).padStart(2, "0");
      };
      return "#" + f(0) + f(8) + f(4);
    };
    // Color de la paleta -> tono, saturación y luz (las barras se colocan ahí)
    function hexHsl(hex) {
      const n = parseInt(hex.slice(1), 16);
      const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const l = (mx + mn) / 2;
      let h = 0, sv = 0;
      if (mx !== mn) {
        const d = mx - mn;
        sv = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
        h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60;
      }
      return [Math.round(h), Math.round(sv * 100), Math.round(l * 100)];
    }
    syncFree = (hex) => {
      [hue, sat, light] = hexHsl(hex);
      shadeBar.style.setProperty("--h", hue);
      shadeBar.style.setProperty("--s", sat + "%");
      hueKnob.style.left = (hue / 360) * 100 + "%";
      shadeKnob.style.left = (1 - light / 100) * 100 + "%";
    };
    function applyFree() {
      pad.color = hslHex(hue, light, sat);
      shadeBar.style.setProperty("--h", hue);
      shadeBar.style.setProperty("--s", sat + "%");
      hueKnob.style.left = (hue / 360) * 100 + "%";
      shadeKnob.style.left = (1 - light / 100) * 100 + "%";
      if (pad.tool === "eraser") pad.tool = "pen";
      updateToolbar();
    }
    function dragBar(bar, onX) {
      const at = (e) => {
        const r = bar.getBoundingClientRect();
        onX(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      };
      bar.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        try {
          bar.setPointerCapture(e.pointerId);
        } catch (_) {}
        SFX.play("color");
        at(e);
        const move = (ev) => at(ev);
        const up = () => {
          bar.removeEventListener("pointermove", move);
          bar.removeEventListener("pointerup", up);
          bar.removeEventListener("pointercancel", up);
        };
        bar.addEventListener("pointermove", move);
        bar.addEventListener("pointerup", up);
        bar.addEventListener("pointercancel", up);
      });
    }
    dragBar(hueBar, (x) => {
      hue = Math.round(x * 359);
      light = 50; // al cambiar de tono, color puro
      sat = 100;
      applyFree();
    });
    dragBar(shadeBar, (x) => {
      light = Math.round((1 - x) * 100);
      applyFree();
    });
    shadeBar.style.setProperty("--h", hue);
    hueKnob.style.left = "0%";
    shadeKnob.style.left = "50%";
    // Tocar el lienzo cierra los desplegables; el cubo de pintura chapotea
    $("pad").addEventListener("pointerdown", () => {
      closePops();
      // si quedó algo seleccionado (mancha azul), se quita al tocar el lienzo
      try {
        const sel = window.getSelection && window.getSelection();
        if (sel && sel.rangeCount) sel.removeAllRanges();
      } catch (_) {}
    }, true);
    // Pantalla en horizontal: el lienzo en blanco pasa a ser horizontal
    try {
      const mq = window.matchMedia(LANDSCAPE);
      const apply = () => pad.setScreenLandscape(mq.matches);
      apply();
      if (mq.addEventListener) mq.addEventListener("change", apply);
      else if (mq.addListener) mq.addListener(apply);
    } catch (_) {}
  }
  const LANDSCAPE = "(orientation: landscape)";
  let syncFree = () => {};
  // Colores propios usados al dibujar (máx. 6, el más reciente primero)
  const RECENT_MAX = 6;
  let recentColors = [];
  let renderRecent = () => {};
  let renderPrev = () => {};
  let bandWarned = false;
  let prevColorsFor = null;
  // Saca los colores principales de un dibujo (sin el blanco del papel)
  function extractColors(url, done) {
    const im = new Image();
    im.onload = () => {
      try {
        const w = Math.min(im.naturalWidth, 600), h = Math.round((im.naturalHeight * w) / im.naturalWidth);
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d");
        x.imageSmoothingEnabled = false;
        x.fillStyle = "#fff"; x.fillRect(0, 0, w, h);
        x.drawImage(im, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h).data;
        const buckets = new Map();
        for (let i = 0; i < d.length; i += 8) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (r > 238 && g > 238 && b > 238) continue; // papel
          const k = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4);
          const o = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
          o.n++; o.r += r; o.g += g; o.b += b;
          buckets.set(k, o);
        }
        const total = [...buckets.values()].reduce((a, o) => a + o.n, 0);
        const cand = [...buckets.values()].sort((a, b) => b.n - a.n).map((o) => [o.r / o.n, o.g / o.n, o.b / o.n, o.n]);
        const picked = [];
        for (const [r, g, b, n] of cand) {
          if (n < Math.max(25, total * 0.004)) break;
          if (picked.some((p) => Math.abs(p[0] - r) + Math.abs(p[1] - g) + Math.abs(p[2] - b) < 70)) continue;
          picked.push([r, g, b]);
          if (picked.length >= 10) break;
        }
        done(picked.map((p) => "#" + p.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")));
      } catch (_) {
        done([]);
      }
    };
    im.onerror = () => done([]);
    im.src = url;
  }
  function setPrevColors(url) {
    prevColorsFor = url;
    renderPrev([]);
    if (!url) return;
    extractColors(url, (list) => {
      if (prevColorsFor === url) renderPrev(list);
    });
  }
  function addRecent(c) {
    if (!c || COLORS.includes(c) || recentColors[0] === c) return;
    recentColors = [c].concat(recentColors.filter((x) => x !== c)).slice(0, RECENT_MAX);
    renderRecent();
  }
  const POPS = [["brushes", "brushBtn"], ["shapes", "shapeBtn"], ["sizes", "sizeToggle"], ["colors", "colorToggle"]];
  function togglePop(popId, open) {
    for (const [pid, bid] of POPS) {
      const pop = $(pid);
      const next = pid === popId ? (open == null ? pop.hidden : open) : false;
      pop.hidden = !next;
      $(bid).setAttribute("aria-expanded", String(next));
      if (bid !== "brushBtn" && bid !== "shapeBtn") $(bid).classList.toggle("active", next);
    }
  }
  function closePops() {
    togglePop(null, false);
  }
  function toggleColors(open) {
    togglePop("colors", open);
  }
  $("colorToggle").addEventListener("click", () => {
    SFX.play("click");
    togglePop("colors");
  });
  $("sizeToggle").addEventListener("click", () => {
    SFX.play("click");
    togglePop("sizes");
  });
  let badgeTimer;
  function updateToolbar() {
    if (!pad) return;
    const ink = pad.tool === "eraser" ? "#ffffff" : pad.color;
    document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b.id === "brushBtn" ? isBrush(pad.tool) : b.id === "shapeBtn" ? isShape(pad.tool) : b.dataset.tool === pad.tool));
    if (isShape(pad.tool)) lastShape = pad.tool;
    const sb = $("shapeBtn");
    if (sb.dataset.shown !== lastShape) {
      sb.dataset.shown = lastShape;
      sb.innerHTML = svg(ICONS[lastShape]);
      const nm = SHAPE_KINDS.find((x) => x.k === lastShape).name;
      sb.title = nm;
      sb.setAttribute("aria-label", nm + " (toca otra vez para elegir otra forma)");
    }
    document.querySelectorAll(".shape-opt").forEach((b) => b.classList.toggle("active", b.dataset.shape === pad.tool));
    if (isBrush(pad.tool)) lastBrush = pad.tool;
    const bb = $("brushBtn");
    if (bb.dataset.shown !== lastBrush) {
      bb.dataset.shown = lastBrush;
      bb.innerHTML = svg(ICONS[lastBrush]);
      const nm = BRUSHES.find((x) => x.k === lastBrush).name;
      bb.title = nm;
      bb.setAttribute("aria-label", nm + " (toca otra vez para cambiar el trazo)");
    }
    bb.classList.toggle("no-menu", brushLocked);
    document.querySelectorAll(".brush-opt").forEach((b) => b.classList.toggle("active", b.dataset.brush === pad.tool));
    document.querySelectorAll(".size-btn").forEach((b) => b.classList.toggle("active", Number(b.dataset.size) === pad.size));
    document.querySelectorAll(".color-btn[data-color]").forEach((b) => b.classList.toggle("active", b.dataset.color === pad.color && pad.tool !== "eraser"));
    $("undoBtn").disabled = !pad.canUndo();
    $("redoBtn").disabled = !pad.canRedo();
    $("colorSwatch").style.background = pad.color;
    $("toolbar").style.setProperty("--paint", pad.color);
    const idx = Math.max(0, SIZES.indexOf(pad.size));
    const prev = $("sizePreview");
    prev.style.width = prev.style.height = Math.min(22, sizePx(idx)) + "px";
    prev.style.background = ink;
    document.querySelectorAll(".size-dot").forEach((d) => (d.style.background = ink));
    $("pad").dataset.tool = pad.tool;
    $("fitBtn").hidden = !(pad.zoom > 1.01);
    const ob = $("orientBtn");
    ob.hidden = !!pad.forcePortrait || !!pad.forceLandscape || !pad.blank; // solo antes de empezar a dibujar
    const toH = pad.orient !== "h";
    if (ob.dataset.to !== String(toH)) {
      ob.dataset.to = String(toH);
      ob.innerHTML = (toH
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="2"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="3" width="11" height="18" rx="2"/></svg>') + "<span>" + (toH ? "Horizontal" : "Vertical") + "</span>";
      ob.setAttribute("aria-label", toH ? "Cambiar a lienzo horizontal" : "Cambiar a lienzo vertical");
    }
    const badge = $("zoomBadge");
    const label = Math.round(pad.zoom * 100) + "%";
    if (badge && badge.textContent !== label) {
      badge.textContent = label;
      badge.hidden = false;
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => (badge.hidden = pad.zoom === 1), 1200);
    }
  }
  document.querySelectorAll("[data-tool]").forEach((b) => {
    if (b.id === "brushBtn" || b.id === "shapeBtn") return;
    b.addEventListener("click", () => {
      SFX.play("click");
      pad.tool = b.dataset.tool;
      updateToolbar();
    });
  });
  // Lápiz: tocarlo cuando ya está elegido abre los tipos de trazo
  const BRUSHES = [
    { k: "pen", name: "Lápiz", sample: '<path d="M4 16C12 4 22 22 36 8" stroke-width="3"/>' },
    { k: "marker", name: "Subrayador", sample: '<path d="M4 16C12 4 22 22 36 8" stroke-width="9" stroke-opacity=".5"/>' },
    { k: "water", name: "Acuarela", sample: '<path d="M4 16C12 4 22 22 36 8" stroke-width="8" stroke-opacity=".45" filter="url(#wblur)"/>' },
  ];
  const isBrush = (t) => BRUSHES.some((x) => x.k === t);
  let brushLocked = false; // en «solo círculos / cuadrados» el lápiz no cambia
  BRUSHES.forEach((br) => {
    const b = el("button", "brush-opt");
    b.type = "button";
    b.dataset.brush = br.k;
    b.innerHTML = `<svg viewBox="0 0 40 24" width="40" height="24" fill="none" stroke="var(--paint)" stroke-linecap="round" aria-hidden="true"><defs><filter id="wblur" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>${br.sample}</svg>`;
    b.appendChild(el("span", "", br.name));
    b.addEventListener("click", () => {
      SFX.play("click");
      pad.tool = br.k;
      closePops();
      updateToolbar();
    });
    $("brushes").appendChild(b);
  });
  $("brushBtn").addEventListener("click", () => {
    SFX.play("click");
    if (isBrush(pad.tool) && !brushLocked) togglePop("brushes");
    else {
      pad.tool = brushLocked ? "pen" : lastBrush;
      closePops();
    }
    updateToolbar();
  });
  let lastBrush = "pen";
  // Formas: línea recta y figuras (se arrastra de una esquina a la otra)
  const SHAPE_KINDS = [
    { k: "line", name: "Línea" },
    { k: "rect", name: "Rectángulo" },
    { k: "ellipse", name: "Círculo" },
    { k: "tri", name: "Triángulo" },
  ];
  const isShape = (t) => SHAPE_KINDS.some((x) => x.k === t);
  let lastShape = "line";
  SHAPE_KINDS.forEach((sh) => {
    const b = el("button", "brush-opt shape-opt");
    b.type = "button";
    b.dataset.shape = sh.k;
    b.innerHTML = svg(ICONS[sh.k]);
    b.appendChild(el("span", "", sh.name));
    b.addEventListener("click", () => {
      SFX.play("click");
      pad.tool = sh.k;
      closePops();
      updateToolbar();
    });
    $("shapes").appendChild(b);
  });
  $("shapeBtn").addEventListener("click", () => {
    SFX.play("click");
    if (isShape(pad.tool)) togglePop("shapes");
    else {
      pad.tool = lastShape;
      closePops();
    }
    updateToolbar();
  });
  $("undoBtn").addEventListener("click", () => {
    SFX.play("undo");
    pad.undo();
  });
  $("redoBtn").addEventListener("click", () => {
    SFX.play("undo");
    pad.redo();
  });

  let clearArmed = null;
  $("clearBtn").addEventListener("click", () => {
    if (clearArmed) {
      clearTimeout(clearArmed);
      clearArmed = null;
      $("clearBtn").classList.remove("armed");
      pad.clear();
      SFX.play("crumple");
      return;
    }
    $("clearBtn").classList.add("armed");
    clearArmed = setTimeout(() => {
      clearArmed = null;
      $("clearBtn").classList.remove("armed");
    }, 3000);
  });
  document.addEventListener("keydown", (e) => {
    if ($("s-draw").hidden || !pad) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? pad.redo() : pad.undo();
    }
  });

  // ---------- resultado de ronda (dúo) ----------
  let viewer = null; // repaso local al final: {kind: "chain"|"duo", book, entry}
  function pointsText(p) {
    return p === 3 ? "¡Acertado! +3" : p === 1 ? "Casi +1" : "Sin puntos";
  }
  function duoCardEl(c, allowApprove) {
    const card = el("article", "duo-card");
    const head = el("div", "duo-card-head");
    head.appendChild(who(c.drawer, "dibujó"));
    card.appendChild(head);
    card.appendChild(el("p", "secret", c.phrase));
    if (c.image) {
      const img = el("img", "duo-img");
      img.src = c.image;
      img.alt = "Dibujo de " + c.drawer.name;
      img.addEventListener("click", () => zoomDrawing({ image: c.image, by: c.drawer }, c.phrase));
      card.appendChild(img);
    } else card.appendChild(blankEl("grow-img"));
    const g = el("p", "guess-line");
    const gw = who(c.guesser, "dijo:");
    gw.classList.add("muted");
    g.appendChild(gw);
    g.appendChild(document.createTextNode(" "));
    g.appendChild(el("strong", "", c.guess || "(nada)"));
    card.appendChild(g);
    card.appendChild(el("div", "pts pts-" + c.points, pointsText(c.points) + (c.approved ? " ✓" : "")));
    if (allowApprove && c.drawerId === state.you && c.points < 3 && c.guess) {
      const b = el("button", "btn-ghost small", "¡Eso vale!");
      b.type = "button";
      b.addEventListener("click", () => socket.emit("duoApprove", c.drawerId));
      card.appendChild(b);
    }
    return card;
  }
  function paintDuo(title, score, cards, allowApprove) {
    show("s-result");
    $("resultTitle").textContent = title;
    $("resultScore").textContent = score;
    const box = $("resultCards");
    box.innerHTML = "";
    box.className = "duo-cards grow";
    $("duoNextBtn").disabled = false;
    cards.forEach((c) => box.appendChild(duoCardEl(c, allowApprove)));
  }
  function renderResult() {
    currentStepKey = "result";
    const r = state.result;
    paintDuo(`Ronda ${r.round} de ${r.rounds}`, `Equipo: ${r.teamScore} pts`, r.cards, true);
    $("duoPrevBtn").hidden = true;
    $("duoNextBtn").textContent = r.round >= r.rounds ? "Ver el resultado final" : "Siguiente ronda";
  }
  $("duoNextBtn").addEventListener("click", () => {
    if (viewer) {
      if (viewer.book < gallery.rounds.length - 1) viewer.book++;
      else viewer = null;
      return render();
    }
    if (state && state.voteResult) return socket.emit("voteNext");
    socket.emit("duoNext");
  });
  $("duoPrevBtn").addEventListener("click", () => {
    if (viewer && viewer.book > 0) {
      viewer.book--;
      render();
    }
  });

  // ---------- votación ----------
  let votes = {}; // dibujo -> estrellas
  let vIdx = 0;
  let vKey = null; // dibujo que se está puntuando (por su clave: si llega uno tarde, no se cambia)
  function goVote(i) {
    const items = (state.task && state.task.items) || [];
    vIdx = Math.max(0, Math.min(i, items.length - 1));
    vKey = items[vIdx] ? items[vIdx].k : null;
    paintVote();
  }
  const STAR_TEXT = ["Toca las estrellas para puntuar", "😬 Mejorable", "🙂 Regular", "😊 Bien", "😃 ¡Muy bien!", "🤩 ¡Obra maestra!"];
  const LIKE_TEXT = ["¿Cuánto se parece? Toca las estrellas", "😬 Ni de lejos", "🙂 Algo tiene", "😊 Se parece", "😃 ¡Muy parecido!", "🤩 ¡Clavado!"];
  function paintVote() {
    const task = state.task;
    const items = task.items || [];
    const portrait = task.kind === "portrait";
    $("voteStep").textContent = stepLabel(task) + (portrait ? " · ¿Cuánto se parece?" : " · Puntúa");
    if (!portrait && task.kind !== "extreme") $("votePhrase").textContent = "«" + (task.phrase || "") + "»";
    $("voteCount").textContent = "";
    $("voteGuess").hidden = true;
    const empty = !items.length;
    $("voteFig").hidden = empty;
    $("voteEmpty").hidden = !empty;
    $("voteStars").hidden = empty;
    $("starsLabel").hidden = empty;
    $("votePrev").hidden = empty;
    if (empty) {
      $("voteNextBtn").textContent = "Continuar";
      $("voteNextBtn").disabled = false;
      return;
    }
    if (vKey != null) {
      const j = items.findIndex((x) => x.k === vKey);
      if (j >= 0) vIdx = j;
    }
    vIdx = Math.min(vIdx, items.length - 1);
    const it = items[vIdx];
    vKey = it.k;
    if ($("voteImg").getAttribute("src") !== it.image) $("voteImg").src = it.image;
    if (portrait) setWho($("votePhrase"), "Retrato de", it.target);
    const guessing = task.kind === "extreme";
    if (guessing) {
      $("votePhrase").innerHTML = "";
      $("votePhrase").appendChild(document.createTextNode("¿Qué es? "));
      $("votePhrase").appendChild(el("span", "rule-chip", RULE_LABEL[it.rule] || ""));
      if ($("voteGuess").dataset.k !== String(it.k)) {
        $("voteGuess").dataset.k = it.k;
        $("voteGuess").value = votes[it.k] || "";
      }
    }
    $("voteStars").hidden = guessing;
    $("starsLabel").hidden = guessing;
    $("voteGuess").hidden = !guessing;
    $("voteCount").textContent = portrait ? `Retrato ${vIdx + 1} de ${items.length} · ¿quién lo habrá dibujado?` : `Dibujo ${vIdx + 1} de ${items.length} · ¿de quién será?`;
    if (guessing) $("voteStep").textContent = stepLabel(task) + " · Adivina";
    const mine = guessing ? 0 : votes[it.k] || 0;
    for (const b of $("voteStars").children) {
      const n = Number(b.dataset.s);
      b.classList.toggle("on", n <= mine);
      b.setAttribute("aria-pressed", String(n === mine));
    }
    $("starsLabel").textContent = (portrait ? LIKE_TEXT : STAR_TEXT)[mine];
    const last = vIdx === items.length - 1;
    $("votePrev").disabled = vIdx === 0;
    $("voteNextBtn").textContent = last ? (guessing ? "Enviar respuestas" : "Enviar puntos") : "Siguiente";
    $("voteNextBtn").disabled = guessing ? !String(votes[it.k] || "").trim() : !mine;
  }
  $("voteStars").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    const task = state && state.task;
    if (!b || !task || task.type !== "vote") return;
    const items = task.items || [];
    const it = items[vIdx];
    if (!it) return;
    votes[it.k] = Number(b.dataset.s);
    SFX.play("color");
    paintVote(); // se queda en este dibujo: se pasa al siguiente con «Siguiente»
  });
  $("voteGuess").addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (k != null) votes[k] = e.target.value;
    const items = (state.task && state.task.items) || [];
    $("voteNextBtn").disabled = !e.target.value.trim();
  });
  $("voteGuess").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !$("voteNextBtn").disabled) {
      e.preventDefault();
      $("voteNextBtn").click();
    }
  });
  $("votePrev").addEventListener("click", () => {
    if (vIdx > 0) {
      SFX.play("click");
      goVote(vIdx - 1);
    }
  });
  $("voteNextBtn").addEventListener("click", () => {
    const items = (state.task && state.task.items) || [];
    if (vIdx < items.length - 1) {
      SFX.play("page");
      return goVote(vIdx + 1);
    }
    const missing = items.findIndex((it) => !String(votes[it.k] || "").trim());
    if (missing >= 0) {
      toast(state.task.kind === "extreme" ? "Te falta adivinar este dibujo." : "Te falta puntuar este dibujo.");
      return goVote(missing);
    }
    submitSafe(votes, $("voteNextBtn"));
  });

  // Resultado de una ronda: dibujos de más a menos estrellas, ya con su autor
  const MEDAL = ["🥇", "🥈", "🥉"];
  function paintVoteRound(title, round) {
    show("s-result");
    $("resultTitle").textContent = title;
    $("resultScore").textContent = "Resultados";
    const box = $("resultCards");
    box.innerHTML = "";
    box.className = "duo-cards grow vote-cards n" + Math.min(round.items.length, 12);
    const ph = el("p", "secret vote-round-phrase", round.kind === "portrait" ? "🖼️ Retratos" : round.kind === "extreme" ? "🔥 Dibujo extremo" : "«" + round.phrase + "»");
    box.appendChild(ph);
    let place = 0;
    round.items.forEach((it, i) => {
      if (i === 0 || it.points !== round.items[i - 1].points) place = i;
      const card = el("article", "duo-card vote-card");
      const head = el("div", "duo-card-head");
      head.appendChild(el("span", "vote-place", it.points > 0 && place < 3 ? MEDAL[place] : `${place + 1}.º`));
      head.appendChild(who(it.by));
      card.appendChild(head);
      if (it.rule) {
        const t = el("div", "card-phrase", "«" + (it.phrase || "") + "» ");
        t.appendChild(el("span", "rule-chip", RULE_LABEL[it.rule] || ""));
        card.appendChild(t);
      }
      const guessList = it.guesses && it.guesses.length ? el("ul", "guess-list") : null;
      if (guessList)
        it.guesses.forEach((g) => {
          const li = el("li", g.pts === 3 ? "hit" : g.pts ? "near" : "");
          li.appendChild(who(g.by, ""));
          li.appendChild(el("span", "", (g.pts === 3 ? "✔ " : g.pts ? "≈ " : "✗ ") + g.text));
          guessList.appendChild(li);
        });
      if (it.target) {
        const t = el("div", "portrait-of");
        t.appendChild(who(it.target, ""));
        t.prepend(document.createTextNode("retrató a "));
        card.appendChild(t);
      }
      if (it.image) {
        const img = el("img", "duo-img");
        img.src = it.image;
        img.alt = "Dibujo de " + it.by.name;
        card.appendChild(img);
      } else card.appendChild(blankEl("grow-img"));
      if (guessList) card.appendChild(guessList);
      card.appendChild(el("div", "pts vote-pts", round.kind === "extreme" ? `${it.points} pts` : `★ ${it.points}`));
      if (it.image) card.addEventListener("click", () => zoomDrawing(it, it.target ? "Retrato de " + it.target.name : it.phrase || round.phrase));
      box.appendChild(card);
    });
  }
  /** Dibujo de la historia: el marco se ajusta a su forma (vertical u horizontal) y al tocarlo se amplía */
  function stageImg(src, by, prompt) {
    const fr = el("button", "stage-frame");
    fr.type = "button";
    fr.setAttribute("aria-label", "Ver en grande");
    const im = el("img", "stage-img");
    im.src = src;
    im.alt = "Dibujo de " + (by ? by.name : "alguien");
    fr.appendChild(im);
    const hint = el("span", "zoom-hint", "🔍");
    fr.appendChild(hint);
    // la lupa va en la esquina del propio dibujo (vertical u horizontal)
    const place = () => {
      if (!im.offsetWidth) return;
      hint.style.left = im.offsetLeft + im.offsetWidth - 42 + "px";
      hint.style.top = im.offsetTop + im.offsetHeight - 42 + "px";
    };
    im.addEventListener("load", place);
    try {
      new ResizeObserver(place).observe(fr);
    } catch (_) {}
    fr.addEventListener("click", () => zoomDrawing({ image: src, by }, prompt || "Dibujo"));
    return fr;
  }
  let zooming = null;
  function zoomDrawing(it, prompt) {
    resetZoomView();
    SFX.play("page");
    zooming = { img: it.image, prompt, by: it.by };
    $("zoomImg").src = it.image;
    const w = $("zoomWho");
    w.innerHTML = "";
    w.appendChild(who(it.by, "dibujó"));
    $("zoomPts").hidden = it.points == null;
    $("zoomPts").textContent = `★ ${it.points}`;
    const saved = inBook(it.image);
    $("zoomSave").disabled = saved;
    $("zoomSave").textContent = saved ? "✔ Guardado" : "📒 Guardar";
    $("zoomSheet").hidden = false;
  }
  $("zoomSave").addEventListener("click", () => zooming && saveSharedToBook(zooming.img, zooming.prompt, zooming.by, $("zoomSave"), "✔ Guardado"));
  $("zoomClose").addEventListener("click", () => ($("zoomSheet").hidden = true));
  $("zoomSheet").addEventListener("click", (e) => {
    if (e.target === $("zoomSheet")) $("zoomSheet").hidden = true;
  });
  // Dentro del visor: pellizcar o doble toque para ampliar, arrastrar para moverse
  let zv = { s: 1, x: 0, y: 0 };
  const zPts = new Map();
  let zGest = null;
  let zLastTap = 0;
  function applyZoomView() {
    const box = $("zoomWrap");
    const im = $("zoomImg");
    const maxX = (box.clientWidth * (zv.s - 1)) / 2;
    const maxY = (box.clientHeight * (zv.s - 1)) / 2;
    zv.x = Math.max(-maxX, Math.min(maxX, zv.x));
    zv.y = Math.max(-maxY, Math.min(maxY, zv.y));
    im.style.transform = `translate(${zv.x}px, ${zv.y}px) scale(${zv.s})`;
    box.classList.toggle("zoomed", zv.s > 1.01);
  }
  function resetZoomView() {
    zv = { s: 1, x: 0, y: 0 };
    zPts.clear();
    zGest = null;
    applyZoomView();
  }
  function zoomAt(ns, cx, cy) {
    const box = $("zoomWrap").getBoundingClientRect();
    const px = cx - (box.left + box.width / 2);
    const py = cy - (box.top + box.height / 2);
    ns = Math.max(1, Math.min(5, ns));
    // el punto bajo el dedo se queda en su sitio
    zv.x = px - ((px - zv.x) * ns) / zv.s;
    zv.y = py - ((py - zv.y) * ns) / zv.s;
    zv.s = ns;
    applyZoomView();
  }
  (() => {
    const box = $("zoomWrap");
    // iPad: mantener pulsado en el visor tampoco selecciona ni abre menús
    const stopTouch = (e) => {
      if (e.cancelable) e.preventDefault();
    };
    box.addEventListener("touchstart", stopTouch, { passive: false });
    box.addEventListener("touchmove", stopTouch, { passive: false });
    box.addEventListener("pointerdown", (e) => {
      box.setPointerCapture(e.pointerId);
      zPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (zPts.size === 2) {
        const [a, b] = [...zPts.values()];
        zGest = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, s: zv.s };
      } else if (zPts.size === 1) {
        const t = Date.now();
        if (t - zLastTap < 300) {
          zoomAt(zv.s > 1.01 ? 1 : 2.5, e.clientX, e.clientY);
          zLastTap = 0;
        } else zLastTap = t;
      }
    });
    box.addEventListener("pointermove", (e) => {
      const p = zPts.get(e.pointerId);
      if (!p) return;
      const nx = e.clientX, ny = e.clientY;
      if (zPts.size >= 2 && zGest) {
        zPts.set(e.pointerId, { x: nx, y: ny });
        const [a, b] = [...zPts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        zoomAt(zGest.s * (d / zGest.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (zv.s > 1.01) {
        zv.x += nx - p.x;
        zv.y += ny - p.y;
        applyZoomView();
      }
      zPts.set(e.pointerId, { x: nx, y: ny });
    });
    const up = (e) => {
      zPts.delete(e.pointerId);
      if (zPts.size < 2) zGest = null;
    };
    box.addEventListener("pointerup", up);
    box.addEventListener("pointercancel", up);
    box.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomAt(zv.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2), e.clientX, e.clientY);
    }, { passive: false });
  })();
  function renderVoteResult() {
    currentStepKey = "voteResult";
    const r = state.voteResult;
    paintVoteRound(`Ronda ${r.round} de ${r.rounds}`, r);
    $("duoPrevBtn").hidden = true;
    const host = isHost();
    const hostP = state.players.find((p) => p.id === state.hostId);
    $("duoNextBtn").disabled = !host;
    $("duoNextBtn").textContent = !host
      ? `${nameOf(hostP, "El anfitrión")} pasa a la siguiente…`
      : r.round >= r.rounds ? (r.ranking && r.ranking.length > 1 && r.ranking[0].points === r.ranking[1].points ? "¡Empate! Ronda de desempate" : "Ver el podio 🏆") : "Siguiente ronda";
  }

  // ---------- revelación: un paso por pantalla ----------
  const VERB = { write: "escribió", draw: "dibujó", guess: "dijo" };
  function blankEl(extra) {
    const d = el("div", "blank-canvas " + (extra || ""));
    d.appendChild(el("span", "blank-emoji", "🎨"));
    d.appendChild(el("strong", "", "Lienzo en blanco"));
    d.appendChild(el("span", "", "Arte minimalista"));
    return d;
  }
  // ---------- tríptico: una criatura en tres partes ----------
  const TRIPTYCH_NAME = { head: "La cabeza", body: "El cuerpo", legs: "Las piernas" };
  const TRIPTYCH_WHAT = { head: "Una cabeza… ¡y el cuello hasta abajo del todo!", body: "Un cuerpo con brazos… ¡y las piernas hasta abajo!", legs: "Sigue el cuerpo: piernas y pies" };
  const TRIPTYCH_PART = ["head", "body", "legs"];
  const composed = new Map();
  /** Junta las partes en una sola imagen vertical: cada parte monta su franja de arriba sobre la anterior */
  function composeTriptych(urls) {
    const key = urls.map((u) => u || "-").join("|");
    if (composed.has(key)) return composed.get(key);
    const VW = 900, VH = 600, STEP = 510; // 90 px de unión
    const pr = Promise.all(urls.map((u) => (u ? loadImg(u) : Promise.resolve(null)))).then((imgs) => {
      const c = document.createElement("canvas");
      c.width = VW;
      c.height = VH + STEP * (imgs.length - 1);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      imgs.forEach((im, i) => {
        const y = i * STEP;
        if (im && i === 0) ctx.drawImage(im, 0, 0, VW, VH);
        else if (im) {
          // de las demás partes, solo lo suyo: sin la franja de arriba (era de la parte anterior)
          const k = im.naturalHeight / VH, band = VH - STEP;
          ctx.drawImage(im, 0, band * k, im.naturalWidth, im.naturalHeight - band * k, 0, y + band, VW, VH - band);
        } else {
          ctx.fillStyle = "#8a8e99";
          ctx.font = '700 40px "Atkinson Hyperlegible", system-ui, sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("🎨 (esta parte se quedó en blanco)", VW / 2, y + VH / 2);
        }
      });
      return c.toDataURL("image/jpeg", 0.9);
    });
    composed.set(key, pr);
    return pr;
  }
  function paintTriptych(o) {
    const st = $("revealStage");
    st.innerHTML = "";
    $("revealPrev").hidden = true;
    const by = el("div", "stage-by triptych-by");
    o.entries.forEach((e, i) => {
      if (i) by.appendChild(document.createTextNode(" · "));
      by.appendChild(document.createTextNode(TRIPTYCH_NAME[TRIPTYCH_PART[i]] + ": "));
      by.appendChild(who(e.by, ""));
    });
    st.appendChild(by);
    const holder = el("div", "triptych-holder");
    st.appendChild(holder);
    const urls = o.entries.map((e) => e.content || null);
    const title = "Criatura de " + (o.owner && o.owner.name ? o.owner.name : "alguien");
    composeTriptych(urls).then((src) => {
      if (!holder.isConnected) return;
      holder.appendChild(stageImg(src, null, title));
      if (o.entries.length >= o.total) st.appendChild(saveBtn(src, title, null));
    });
  }
  function paintStoryStage(o) {
    const cur = o.entries[o.entries.length - 1];
    const prev = o.entries.length > 1 ? o.entries[o.entries.length - 2] : null;
    const guessOfDrawing = cur.type === "guess" && prev && prev.type === "draw" && prev.content;
    // paso anterior, en pequeño, para comparar (salvo cuando el dibujo va en grande)
    const pv = $("revealPrev");
    pv.innerHTML = "";
    pv.hidden = !prev || guessOfDrawing;
    if (prev && !guessOfDrawing) {
      pv.appendChild(el("span", "prev-label", "Antes:"));
      if (prev.type === "draw") {
        if (prev.content) {
          const im = el("img", "prev-img");
          im.src = prev.content;
          im.alt = "Dibujo anterior";
          pv.appendChild(im);
        } else pv.appendChild(el("span", "prev-text", "🎨 lienzo en blanco"));
      } else pv.appendChild(el("span", "prev-text", "«" + prev.content + "»"));
    }
    const st = $("revealStage");
    st.innerHTML = "";
    st.classList.toggle("is-guess-view", !!guessOfDrawing);
    const textBefore = (i) => {
      const e = o.entries[i];
      return e && e.type !== "draw" ? e.content : "";
    };
    if (guessOfDrawing) {
      st.appendChild(stageImg(prev.content, prev.by, textBefore(o.entries.length - 3)));
      st.appendChild(saveBtn(prev.content, textBefore(o.entries.length - 3), prev.by));
      const by = el("div", "stage-by");
      by.appendChild(who(cur.by, "dijo que es…"));
      st.appendChild(by);
      st.appendChild(el("p", "stage-bubble is-guess compact", cur.content));
    } else {
      const by = el("div", "stage-by");
      by.appendChild(who(cur.by, cur.type === "draw" && prev && prev.type === "draw" ? "lo copió de memoria" : VERB[cur.type]));
      if (cur.rule) {
        by.appendChild(document.createTextNode(" "));
        by.appendChild(el("span", "rule-chip", RULE_LABEL[cur.rule] || ""));
      }
      st.appendChild(by);
      if (cur.type === "draw") {
        if (cur.content) {
          st.appendChild(stageImg(cur.content, cur.by, textBefore(o.entries.length - 2)));
          st.appendChild(saveBtn(cur.content, textBefore(o.entries.length - 2), cur.by));
        } else st.appendChild(blankEl());
      } else {
        st.appendChild(el("p", "stage-bubble " + (cur.type === "write" ? "is-write" : "is-guess"), cur.content));
      }
    }
  }
  function paintStory(o) {
    show("s-reveal");
    // Historia completa a la vista: se puede compartir
    const full = SHARE_ENABLED && o.entries.length >= o.total;
    $("shareStoryBtn").hidden = !full;
    sharing = full ? { owner: o.owner, entries: o.entries.slice(), variant: o.variant } : null;
    $("revealCount").textContent = o.count;
    setWho($("revealTitle"), o.variant === "triptych" ? "La criatura de" : "La historia de", o.owner);
    const dots = $("revealDots");
    dots.innerHTML = "";
    for (let i = 0; i < o.total; i++) dots.appendChild(el("span", "dot" + (i < o.entries.length ? " on" : "") + (i === o.entries.length - 1 ? " now" : "")));
    if (o.variant === "triptych") paintTriptych(o);
    else paintStoryStage(o);
    const st = $("revealStage");
    if (o.animate) {
      $("zoomSheet").hidden = true; // pasa al siguiente: se cierra el visor
      st.classList.remove("pop-in");
      void st.offsetWidth;
      st.classList.add("pop-in");
    }
    $("revealControls").hidden = !o.controls;
    $("revPrev").disabled = !!o.prevDisabled;
    $("revNext").textContent = o.nextLabel;
    $("revPrev").textContent = o.prevLabel || "Anterior";
    $("revealHint").textContent = o.hint || "";
  }
  let lastRevealKey = null;

  // ---------- compartir una historia en redes ----------
  // Una imagen vertical (formato story, 1080x1920) por cada paso y una de cierre; luego el menú de compartir del móvil.
  let sharing = null;
  const SHARE_ENABLED = true;
  const SW = 1080, SH = 1920;
  function loadImg(src) {
    return new Promise((ok) => {
      const im = new Image();
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    });
  }
  function wrapLines(ctx, text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const SHARE_FONT = '"Bagel Fat One", "Atkinson Hyperlegible", system-ui, sans-serif';
  const SHARE_TEXT = '"Atkinson Hyperlegible", system-ui, sans-serif';
  /** Fondo común: cuadrícula de libreta, marca arriba y dirección abajo */
  function slideBase(ctx, top, sub) {
    ctx.fillStyle = "#eef3fb";
    ctx.fillRect(0, 0, SW, SH);
    ctx.strokeStyle = "#dfe7f5";
    ctx.lineWidth = 2;
    for (let x = 0; x <= SW; x += 54) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, SH);
      ctx.stroke();
    }
    for (let y = 0; y <= SH; y += 54) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SW, y);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#ff5a3c";
    ctx.font = `96px ${SHARE_FONT}`;
    ctx.fillText("Dibulíos", SW / 2, 210);
    ctx.fillStyle = "#1d2747";
    ctx.font = `700 46px ${SHARE_TEXT}`;
    if (top) ctx.fillText(top, SW / 2, 290);
    ctx.fillStyle = "#5b6687";
    ctx.font = `700 36px ${SHARE_TEXT}`;
    if (sub) ctx.fillText(sub, SW / 2, 350);
    ctx.font = `700 38px ${SHARE_TEXT}`;
    ctx.fillStyle = "#5b6687";
    ctx.fillText(location.host, SW / 2, SH - 110);
  }
  const VERB_SHARE = { write: "escribió", draw: "dibujó", guess: "dijo que era" };
  /** «Mary, Jaime y Ana»: quién ha participado, en orden y sin repetir */
  function artistNames(st) {
    const seen = [];
    for (const e of st.entries || []) {
      const nm = e.by && e.by.name;
      if (nm && !seen.includes(nm)) seen.push(nm);
    }
    if (!seen.length) return "";
    return seen.length === 1 ? seen[0] : seen.slice(0, -1).join(", ") + " y " + seen[seen.length - 1];
  }
  function fitText(ctx, text, x, y, maxW, size, weight) {
    let sz = size;
    do {
      ctx.font = `${weight || 700} ${sz}px ${SHARE_TEXT}`;
      sz -= 2;
    } while (ctx.measureText(text).width > maxW && sz > 22);
    ctx.fillText(text, x, y);
  }
  /** Cartel final del Tríptico: la criatura entera y quién dibujó cada parte */
  function drawCreaturePoster(ctx, st, im, a) {
    const owner = st.owner && st.owner.name ? st.owner.name : "alguien";
    slideBase(ctx, `La criatura de ${owner}`, "");
    const parts = ["Cabeza", "cuerpo", "piernas"];
    const credit = st.entries.map((e, k) => `${parts[k] || ""} de ${e.by && e.by.name ? e.by.name : "alguien"}`).join(" · ");
    ctx.fillStyle = "#5b6687";
    ctx.textAlign = "center";
    fitText(ctx, credit, SW / 2, 365, SW - 120, 40);
    ctx.globalAlpha = a == null ? 1 : a;
    drawCard(ctx, im, SW / 2, 420, 980, 1330);
    ctx.globalAlpha = 1;
  }
  async function storySlides(st) {
    try {
      await Promise.all([document.fonts.load(`96px "Bagel Fat One"`), document.fonts.load(`700 46px "Atkinson Hyperlegible"`)]);
    } catch (_) {}
    if (st.variant === "triptych") {
      // Tríptico: la criatura entera en una imagen
      const scenes = await videoScenes(st);
      const c = document.createElement("canvas");
      c.width = SW;
      c.height = SH;
      const ctx = c.getContext("2d");
      scenes[scenes.length - 2].draw(ctx, 1);
      return [await canvasFile(c, "dibulios.jpg")];
    }
    const files = [];
    const n = st.entries.length;
    const ownerName = st.owner && st.owner.name ? st.owner.name : "alguien";
    for (let i = 0; i < n; i++) {
      const e = st.entries[i];
      const c = document.createElement("canvas");
      c.width = SW;
      c.height = SH;
      const ctx = c.getContext("2d");
      slideBase(ctx, `La historia de ${ownerName}`, `${i + 1} de ${n}`);
      const by = e.by && e.by.name ? e.by.name : "Alguien";
      const prevDraw = i > 0 && st.entries[i - 1].type === "draw";
      const verb = e.type === "draw" && prevDraw ? "lo copió de memoria" : VERB_SHARE[e.type] || "";
      ctx.fillStyle = "#1d2747";
      ctx.font = `700 52px ${SHARE_TEXT}`;
      ctx.fillText(`${by} ${verb}${e.rule ? " · " + (RULE_LABEL[e.rule] || "") : ""}`, SW / 2, 470);
      if (e.type === "draw") {
        const im = e.content ? await loadImg(e.content) : null;
        const boxW = 940, boxH = 1180, bx = (SW - boxW) / 2, by0 = 540;
        let w = boxW, h = boxH;
        if (im) {
          const k = Math.min(boxW / im.naturalWidth, boxH / im.naturalHeight);
          w = im.naturalWidth * k;
          h = im.naturalHeight * k;
        }
        const x = bx + (boxW - w) / 2, y = by0 + (boxH - h) / 2;
        ctx.save();
        ctx.shadowColor = "rgba(29,39,71,.25)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        roundRect(ctx, x, y, w, h, 28);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRect(ctx, x, y, w, h, 28);
        ctx.clip();
        if (im) ctx.drawImage(im, x, y, w, h);
        else {
          ctx.fillStyle = "#5b6687";
          ctx.font = `700 54px ${SHARE_TEXT}`;
          ctx.fillText("🎨 Lienzo en blanco", SW / 2, y + h / 2);
        }
        ctx.restore();
        roundRect(ctx, x, y, w, h, 28);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#1d2747";
        ctx.stroke();
      } else {
        // texto en un bocadillo grande
        ctx.font = `92px ${SHARE_FONT}`;
        let lines = wrapLines(ctx, e.content || "…", 820);
        let size = 92;
        while (lines.length > 6 && size > 56) {
          size -= 8;
          ctx.font = `${size}px ${SHARE_FONT}`;
          lines = wrapLines(ctx, e.content || "…", 820);
        }
        const lh = size * 1.18;
        const bh = lines.length * lh + 120, bw = 940, bx = (SW - bw) / 2, byy = 1100 - bh / 2;
        ctx.save();
        ctx.shadowColor = "rgba(29,39,71,.25)";
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        roundRect(ctx, bx, byy, bw, bh, 60);
        ctx.fillStyle = e.type === "write" ? "#ffc53d" : "#ffffff";
        ctx.fill();
        ctx.restore();
        roundRect(ctx, bx, byy, bw, bh, 60);
        ctx.lineWidth = 7;
        ctx.strokeStyle = "#1d2747";
        ctx.stroke();
        ctx.fillStyle = "#1d2747";
        ctx.font = `${size}px ${SHARE_FONT}`;
        lines.forEach((l, j) => ctx.fillText(l, SW / 2, byy + 60 + lh * (j + 0.8)));
      }
      files.push(await canvasFile(c, `dibulios-${i + 1}.jpg`));
    }
    // cierre: invitación a jugar
    const c = document.createElement("canvas");
    c.width = SW;
    c.height = SH;
    const ctx = c.getContext("2d");
    slideBase(ctx, "", "");
    ctx.fillStyle = "#1d2747";
    ctx.font = `110px ${SHARE_FONT}`;
    ["¿Y vosotros,", "qué habríais", "dibujado?"].forEach((l, j) => ctx.fillText(l, SW / 2, 760 + j * 135));
    ctx.font = `700 54px ${SHARE_TEXT}`;
    ctx.fillStyle = "#5b6687";
    ["Dibuja, adivina y pásalo.", "Gratis, sin anuncios y sin registro."].forEach((l, j) => ctx.fillText(l, SW / 2, 1240 + j * 72));
    roundRect(ctx, 190, 1430, 700, 130, 65);
    ctx.fillStyle = "#ff5a3c";
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 54px ${SHARE_TEXT}`;
    ctx.fillText(location.host, SW / 2, 1513);
    files.push(await canvasFile(c, `dibulios-${n + 1}.jpg`));
    return files;
  }
  function canvasFile(c, name) {
    return new Promise((ok) => c.toBlob((b) => ok(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.9));
  }
  // ---------- escenas de la historia (para el GIF y el cartel del Tríptico) ----------
  // Vertical (formato story): presentación, cada paso entrando con una transición y cierre con la dirección.
  const ease = (p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  function drawCard(ctx, im, cx, top, maxW, maxH) {
    let w = maxW, h = maxH;
    if (im) {
      const k = Math.min(maxW / im.naturalWidth, maxH / im.naturalHeight);
      w = im.naturalWidth * k;
      h = im.naturalHeight * k;
    }
    const x = cx - w / 2, y = top + (maxH - h) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(29,39,71,.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, 28);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, w, h, 28);
    ctx.clip();
    if (im) ctx.drawImage(im, x, y, w, h);
    else {
      ctx.fillStyle = "#5b6687";
      ctx.font = `700 54px ${SHARE_TEXT}`;
      ctx.textAlign = "center";
      ctx.fillText("🎨 Lienzo en blanco", cx, y + h / 2);
    }
    ctx.restore();
    roundRect(ctx, x, y, w, h, 28);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1d2747";
    ctx.stroke();
  }
  function drawBubble(ctx, text, isWrite, cy) {
    ctx.font = `92px ${SHARE_FONT}`;
    let size = 92;
    let lines = wrapLines(ctx, text || "…", 820);
    while (lines.length > 6 && size > 56) {
      size -= 8;
      ctx.font = `${size}px ${SHARE_FONT}`;
      lines = wrapLines(ctx, text || "…", 820);
    }
    const lh = size * 1.18;
    const bh = lines.length * lh + 120, bw = 940, bx = (SW - bw) / 2, by = cy - bh / 2;
    ctx.save();
    ctx.shadowColor = "rgba(29,39,71,.25)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, bx, by, bw, bh, 60);
    ctx.fillStyle = isWrite ? "#ffc53d" : "#ffffff";
    ctx.fill();
    ctx.restore();
    roundRect(ctx, bx, by, bw, bh, 60);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#1d2747";
    ctx.stroke();
    ctx.fillStyle = "#1d2747";
    ctx.textAlign = "center";
    ctx.font = `${size}px ${SHARE_FONT}`;
    lines.forEach((l, j) => ctx.fillText(l, SW / 2, by + 60 + lh * (j + 0.8)));
  }
  /** Escenas del vídeo: cada una sabe pintarse en un momento p (0..1) de su duración */
  async function videoScenes(st) {
    const owner = st.owner && st.owner.name ? st.owner.name : "alguien";
    const triptych = st.variant === "triptych";
    const title = triptych ? `La criatura de ${owner}` : `La historia de ${owner}`;
    const n = st.entries.length;
    const scenes = [];
    scenes.push({
      dur: 1800,
      draw(ctx, p) {
        slideBase(ctx, "", "");
        const a = ease(p * 2.2);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#1d2747";
        ctx.textAlign = "center";
        ctx.font = `100px ${SHARE_FONT}`;
        ctx.fillText(triptych ? "¿Qué criatura" : "¿Cómo acabó", SW / 2, 860 + (1 - a) * 60);
        ctx.fillText(triptych ? "ha salido?" : "la historia?", SW / 2, 990 + (1 - a) * 60);
        ctx.font = `700 52px ${SHARE_TEXT}`;
        ctx.fillStyle = "#5b6687";
        ctx.fillText(title, SW / 2, 1130 + (1 - a) * 60);
        ctx.globalAlpha = 1;
      },
    });
    if (triptych) {
      const urls = st.entries.map((e) => e.content || null);
      const names = ["la cabeza", "el cuerpo", "las piernas"];
      for (let k = 1; k <= n; k++) {
        const im = await loadImg(await composeTriptych(urls.slice(0, k)));
        const prevIm = k > 1 ? await loadImg(await composeTriptych(urls.slice(0, k - 1))) : null;
        const e = st.entries[k - 1];
        scenes.push({
          dur: 2400,
          draw(ctx, p) {
            slideBase(ctx, title, `${k} de ${n}`);
            ctx.fillStyle = "#1d2747";
            ctx.textAlign = "center";
            ctx.font = `700 52px ${SHARE_TEXT}`;
            ctx.fillText(`${e.by && e.by.name ? e.by.name : "Alguien"} dibujó ${names[k - 1] || ""}`, SW / 2, 470);
            // la parte nueva aparece: se pasa de la criatura anterior a la nueva con un fundido
            const a = ease(p * 2);
            if (prevIm && a < 1) drawCard(ctx, prevIm, SW / 2, 540, 940, 1180);
            ctx.globalAlpha = prevIm ? a : 1;
            drawCard(ctx, im, SW / 2, 540 + (prevIm ? 0 : (1 - a) * 40), 940, 1180);
            ctx.globalAlpha = 1;
          },
        });
      }
      const full = await loadImg(await composeTriptych(urls));
      scenes.push({ dur: 3400, poster: true, draw: (ctx, p) => drawCreaturePoster(ctx, st, full, Math.min(1, 0.6 + p * 2)) });
    } else {
      for (let i = 0; i < n; i++) {
        const e = st.entries[i];
        const im = e.type === "draw" && e.content ? await loadImg(e.content) : null;
        const by = e.by && e.by.name ? e.by.name : "Alguien";
        const prevDraw = i > 0 && st.entries[i - 1].type === "draw";
        const verb = e.type === "draw" && prevDraw ? "lo copió de memoria" : VERB_SHARE[e.type] || "";
        scenes.push({
          dur: e.type === "draw" ? 2800 : 2300,
          draw(ctx, p) {
            slideBase(ctx, title, `${i + 1} de ${n}`);
            const a = ease(p * 2.4);
            ctx.globalAlpha = a;
            ctx.fillStyle = "#1d2747";
            ctx.textAlign = "center";
            ctx.font = `700 52px ${SHARE_TEXT}`;
            ctx.fillText(`${by} ${verb}${e.rule ? " · " + (RULE_LABEL[e.rule] || "") : ""}`, SW / 2, 470);
            ctx.save();
            ctx.translate((1 - a) * 220, 0); // entra desde la derecha
            if (e.type === "draw") drawCard(ctx, im, SW / 2, 540, 940, 1180);
            else drawBubble(ctx, e.content, e.type === "write", 1100);
            ctx.restore();
            ctx.globalAlpha = 1;
          },
        });
      }
    }
    scenes.push({
      dur: 2800,
      draw(ctx, p) {
        slideBase(ctx, "", "");
        const a = ease(p * 2);
        ctx.globalAlpha = a;
        ctx.fillStyle = "#1d2747";
        ctx.textAlign = "center";
        ctx.font = `110px ${SHARE_FONT}`;
        ["¿Y vosotros,", "qué habríais", "dibujado?"].forEach((l, j) => ctx.fillText(l, SW / 2, 760 + j * 135));
        ctx.font = `700 54px ${SHARE_TEXT}`;
        ctx.fillStyle = "#5b6687";
        ["Dibuja, adivina y pásalo.", "Gratis y sin registro."].forEach((l, j) => ctx.fillText(l, SW / 2, 1240 + j * 72));
        const pulse = 1 + 0.04 * Math.sin(p * Math.PI * 4);
        ctx.save();
        ctx.translate(SW / 2, 1495);
        ctx.scale(pulse, pulse);
        roundRect(ctx, -350, -65, 700, 130, 65);
        ctx.fillStyle = "#ff5a3c";
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `700 54px ${SHARE_TEXT}`;
        ctx.fillText(location.host, 0, 18);
        ctx.restore();
        ctx.globalAlpha = 1;
      },
    });
    return scenes;
  }
  function loadScript(src) {
    return new Promise((ok, ko) => {
      if (document.querySelector(`script[data-src="${src}"]`)) return ok();
      const el2 = document.createElement("script");
      el2.src = src;
      el2.dataset.src = src;
      el2.onload = () => ok();
      el2.onerror = ko;
      document.head.appendChild(el2);
    });
  }
  /**
   * GIF de la historia: un carrusel sin transiciones, cada paso ocupando casi toda la imagen.
   * Arriba, una franja fina con «Dibulíos» y el enlace; debajo, quién lo hizo.
   */
  async function storyGif(st) {
    try {
      await Promise.all([document.fonts.load(`44px "Bagel Fat One"`), document.fonts.load(`700 26px "Atkinson Hyperlegible"`)]);
    } catch (_) {}
    await loadScript("vendor/gifenc.js?v=1");
    const { GIFEncoder, quantize, applyPalette } = window.gifenc;
    const GW = 640, GH = 1000, HEAD = 72, CAP = 48, M = 14;
    const c = document.createElement("canvas");
    c.width = GW;
    c.height = GH;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const enc = GIFEncoder();
    const n = st.entries.length;
    const imgs = await Promise.all(st.entries.map((e) => (e.type === "draw" && e.content ? loadImg(e.content) : null)));
    for (let i = 0; i < n; i++) {
      const e = st.entries[i];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#eef3fb";
      ctx.fillRect(0, 0, GW, GH);
      // franja de arriba: marca y enlace
      ctx.fillStyle = "#ff5a3c";
      ctx.fillRect(0, 0, GW, HEAD);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      ctx.font = `40px ${SHARE_FONT}`;
      ctx.fillText("Dibulíos", 20, 50);
      ctx.textAlign = "right";
      ctx.font = `700 22px ${SHARE_TEXT}`;
      ctx.fillText(location.host, GW - 20, 45);
      // quién lo hizo
      const by = e.by && e.by.name ? e.by.name : "Alguien";
      const prevDraw = i > 0 && st.entries[i - 1].type === "draw";
      const verb = e.type === "draw" && prevDraw ? "lo copió" : VERB_SHARE[e.type] || "";
      ctx.fillStyle = "#1d2747";
      ctx.textAlign = "center";
      fitText(ctx, `${i + 1}/${n} · ${by} ${verb}`, GW / 2, HEAD + 34, GW - 40, 26);
      // el paso, ocupando casi todo
      const x = M, y = HEAD + CAP, w = GW - M * 2, h = GH - y - M;
      if (e.type === "draw") {
        const im = imgs[i];
        ctx.save();
        roundRect(ctx, x, y, w, h, 18);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.clip();
        if (im) {
          const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
          const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
          ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        }
        ctx.restore();
        ctx.save();
        roundRect(ctx, x, y, w, h, 18);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#1d2747";
        ctx.stroke();
        ctx.restore();
      } else textBox(ctx, e.content, x, y + h * 0.18, w, h * 0.64, e.type === "write");
      const { data } = ctx.getImageData(0, 0, GW, GH);
      const palette = quantize(data, 256);
      enc.writeFrame(applyPalette(data, palette), GW, GH, { palette, delay: i === n - 1 ? 2600 : 1300 });
      await new Promise((r) => setTimeout(r, 0));
    }
    enc.finish();
    return new File([enc.bytes()], "dibulios-historia.gif", { type: "image/gif" });
  }

  // ---------- imagen tipo cómic: toda la historia en una sola imagen vertical, al instante ----------
  function textBox(ctx, text, x, y, w, h, isWrite) {
    ctx.save();
    roundRect(ctx, x, y, w, h, 34);
    ctx.fillStyle = isWrite ? "#ffc53d" : "#ffffff";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1d2747";
    ctx.stroke();
    let size = 76, lines;
    do {
      ctx.font = `${size}px ${SHARE_FONT}`;
      lines = wrapLines(ctx, text || "…", w - 50);
      size -= 4;
    } while ((lines.length * size * 1.2 > h - 40 || lines.some((l) => ctx.measureText(l).width > w - 40)) && size > 26);
    const lh = (size + 4) * 1.15;
    ctx.fillStyle = "#1d2747";
    ctx.textAlign = "center";
    const y0 = y + h / 2 - (lines.length * lh) / 2 + lh * 0.78;
    lines.forEach((l, j) => ctx.fillText(l, x + w / 2, y0 + j * lh));
    ctx.restore();
  }
  async function storyComic(st) {
    try {
      await Promise.all([document.fonts.load(`96px "Bagel Fat One"`), document.fonts.load(`700 46px "Atkinson Hyperlegible"`)]);
    } catch (_) {}
    const c = document.createElement("canvas");
    c.width = SW;
    c.height = SH;
    const ctx = c.getContext("2d");
    const owner = st.owner && st.owner.name ? st.owner.name : "alguien";
    if (st.variant === "triptych") {
      const scenes = await videoScenes(st);
      scenes.find((x) => x.poster).draw(ctx, 1); // la criatura entera, con quién dibujó cada parte
    } else {
      slideBase(ctx, `La historia de ${owner}`, "");
      ctx.fillStyle = "#5b6687";
      ctx.textAlign = "center";
      const who = artistNames(st);
      if (who) fitText(ctx, `Entre ${who}`, SW / 2, 352, SW - 120, 36);
      const n = st.entries.length;
      const cols = n <= 3 ? 1 : 2, rows = Math.ceil(n / cols);
      const top = 400, bottom = SH - 170, gap = 26, mx = 40;
      const cw = (SW - mx * 2 - gap * (cols - 1)) / cols, ch = (bottom - top - gap * (rows - 1)) / rows;
      for (let i = 0; i < n; i++) {
        const e = st.entries[i];
        const col = i % cols, row = Math.floor(i / cols);
        const x = mx + col * (cw + gap), y = top + row * (ch + gap);
        // quién y qué hizo
        const by = e.by && e.by.name ? e.by.name : "Alguien";
        const prevDraw = i > 0 && st.entries[i - 1].type === "draw";
        const verb = e.type === "draw" && prevDraw ? "lo copió" : VERB_SHARE[e.type] || "";
        ctx.save();
        ctx.fillStyle = "#ff5a3c";
        ctx.beginPath();
        ctx.arc(x + 26, y + 24, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `700 30px ${SHARE_TEXT}`;
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), x + 26, y + 35);
        ctx.fillStyle = "#1d2747";
        ctx.textAlign = "left";
        ctx.font = `700 30px ${SHARE_TEXT}`;
        let label = `${by} ${verb}`;
        while (ctx.measureText(label).width > cw - 64 && label.length > 4) label = label.slice(0, -2);
        ctx.fillText(label, x + 60, y + 35);
        ctx.restore();
        const by0 = y + 58, bh = ch - 58;
        if (e.type === "draw") {
          const im = e.content ? await loadImg(e.content) : null;
          drawCard(ctx, im, x + cw / 2, by0, cw, bh);
        } else textBox(ctx, e.content, x, by0 + bh * 0.1, cw, bh * 0.8, e.type === "write");
      }
    }
    return { file: await canvasFile(c, "dibulios-historia.jpg"), url: c.toDataURL("image/jpeg", 0.85) };
  }

  // ---------- ventana de compartir ----------
  let shareImg = null; // imagen ya preparada (para compartir al tocar, sin esperas)
  let shareGif = null;
  async function shareFiles(files, kind) {
    const st = sharing || {};
    const text = (st.variant === "triptych" ? "Nuestra criatura en Dibulíos 🎨 " : "Nuestra historia en Dibulíos ✏️ ") + location.origin;
    if (navigator.canShare && navigator.canShare({ files })) {
      try {
        await navigator.share({ files, title: "Dibulíos", text });
        track("historia_compartida", { formato: kind });
      } catch (_) {} // cancelado
      return;
    }
    // ordenador (o sin «compartir»): se descarga
    for (const f of files) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(f);
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    track("historia_descargada", { formato: kind });
  }
  // Ventana de compartir: vista previa grande, «Imagen | GIF» y un solo botón. Las dos cosas se preparan
  // nada más abrirla, para que al pulsar «Compartir» salga el menú del móvil al instante.
  let shareKind = "img";
  let shareGifUrl = null;
  function paintShare() {
    const isGif = shareKind === "gif";
    $("shareTabImg").setAttribute("aria-selected", String(!isGif));
    $("shareTabGif").setAttribute("aria-selected", String(isGif));
    const ready = isGif ? shareGif : shareImg;
    const prev = $("sharePreview");
    if (ready) {
      prev.src = isGif ? shareGifUrl : shareImgUrl;
      prev.hidden = false;
      $("shareWait").hidden = true;
    } else {
      prev.hidden = true;
      $("shareWait").hidden = false;
      $("shareWait").textContent = isGif ? "Preparando el GIF…" : "Preparando…";
    }
    $("shareGo").disabled = !ready;
    $("shareSave").disabled = !ready;
  }
  let shareImgUrl = null;
  $("shareStoryBtn").addEventListener("click", async () => {
    if (!sharing) return;
    SFX.play("page");
    const st = sharing;
    shareImg = null;
    shareGif = null;
    if (shareGifUrl) URL.revokeObjectURL(shareGifUrl);
    shareGifUrl = null;
    shareKind = "img";
    const canGif = st.variant !== "triptych"; // las criaturas, solo en imagen
    $("shareTabs").hidden = !canGif;
    $("shareTitle").textContent = st.variant === "triptych" ? "La criatura" : "La historia";
    paintShare();
    $("shareSheet").hidden = false;
    try {
      const r = await storyComic(st);
      if (sharing !== st) return;
      shareImg = r.file;
      shareImgUrl = r.url;
      paintShare();
    } catch (_) {
      $("shareWait").textContent = "No se pudo preparar la imagen.";
    }
    if (!canGif) return;
    try {
      const g = await storyGif(st);
      if (sharing !== st) return;
      shareGif = g;
      shareGifUrl = URL.createObjectURL(g);
      paintShare();
    } catch (_) {
      if (shareKind === "gif") $("shareWait").textContent = "No se pudo preparar el GIF.";
    }
  });
  $("shareTabImg").addEventListener("click", () => {
    SFX.play("click");
    shareKind = "img";
    paintShare();
  });
  $("shareTabGif").addEventListener("click", () => {
    SFX.play("click");
    shareKind = "gif";
    paintShare();
  });
  // Guardar en el móvil: en iPhone/iPad sale el menú con «Guardar imagen» (va a Fotos); en Android y ordenador, se descarga
  async function saveFile(file) {
    if (isApple() && navigator.canShare && navigator.canShare({ files: [file] })) {
      if (!store.get("tg-tip-photos", "")) {
        store.set("tg-tip-photos", "1");
        toast("En el menú que sale, pulsa «Guardar imagen» y se guardará en Fotos.");
      }
      try {
        await navigator.share({ files: [file] });
      } catch (_) {}
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("✔ Guardado en el móvil");
  }
  $("shareSave").addEventListener("click", () => {
    const f = shareKind === "gif" ? shareGif : shareImg;
    if (!f) return;
    saveFile(f);
    track("historia_guardada", { formato: shareKind });
  });
  $("shareGo").addEventListener("click", () => {
    if (shareKind === "gif" && shareGif) shareFiles([shareGif], "gif");
    else if (shareImg) shareFiles([shareImg], "imagen");
  });
  $("shareClose").addEventListener("click", () => ($("shareSheet").hidden = true));
  $("shareSheet").addEventListener("click", (e) => {
    if (e.target === $("shareSheet")) $("shareSheet").hidden = true;
  });
  function renderReveal() {
    currentStepKey = null;
    const r = state.reveal;
    const key = r.book + ":" + r.entry;
    const host = isHost();
    const atEnd = r.entry >= r.totalEntries - 1;
    const lastBook = r.book >= r.totalBooks - 1;
    const hostP = state.players.find((p) => p.id === state.hostId);
    paintStory({
      variant: state.variant,
      count: `${state.variant === "triptych" ? "Criatura" : "Historia"} ${r.book + 1} de ${r.totalBooks}`,
      owner: r.owner,
      entries: r.entries,
      total: r.totalEntries,
      animate: key !== lastRevealKey,
      controls: host,
      prevDisabled: r.book === 0 && r.entry === 0,
      nextLabel: !atEnd ? "Siguiente" : lastBook ? "Terminar" : state.variant === "triptych" ? "Siguiente criatura" : "Siguiente historia",
      hint: host ? "" : `${nameOf(hostP, "El anfitrión")} va pasando las páginas.`,
    });
    lastRevealKey = key;
  }
  function renderViewer() {
    if (!gallery) return renderEndScreen();
    if (viewer.kind === "vote") {
      paintVoteRound(`Ronda ${viewer.book + 1} de ${gallery.rounds.length}`, gallery.rounds[viewer.book]);
      $("duoNextBtn").disabled = false;
      $("duoPrevBtn").hidden = false;
      $("duoPrevBtn").disabled = viewer.book === 0;
      $("duoNextBtn").textContent = viewer.book < gallery.rounds.length - 1 ? "Siguiente ronda" : "Volver";
      return;
    }
    if (viewer.kind === "duo") {
      const cards = gallery.rounds[viewer.book];
      paintDuo(`Ronda ${viewer.book + 1} de ${gallery.rounds.length}`, `Equipo: ${gallery.teamScore} pts`, cards, false);
      $("duoPrevBtn").hidden = false;
      $("duoPrevBtn").disabled = viewer.book === 0;
      $("duoNextBtn").textContent = viewer.book < gallery.rounds.length - 1 ? "Siguiente ronda" : "Volver";
      return;
    }
    const b = gallery.books[viewer.book];
    const atEnd = viewer.entry >= b.entries.length - 1;
    const lastBook = viewer.book >= gallery.books.length - 1;
    paintStory({
      variant: gallery.variant,
      count: `${gallery.variant === "triptych" ? "Criatura" : "Historia"} ${viewer.book + 1} de ${gallery.books.length}`,
      owner: b.owner,
      entries: b.entries.slice(0, viewer.entry + 1),
      total: b.entries.length,
      animate: true,
      controls: true,
      prevDisabled: false,
      prevLabel: viewer.book === 0 && viewer.entry === 0 ? "Volver" : "Anterior",
      nextLabel: !atEnd ? "Siguiente" : lastBook ? "Volver" : gallery.variant === "triptych" ? "Siguiente criatura" : "Siguiente historia",
      hint: "Mantén el dedo sobre un dibujo para guardarlo.",
    });
  }
  $("revNext").addEventListener("click", () => {
    if (!viewer) return socket.emit("reveal", 1);
    const b = gallery.books[viewer.book];
    if (viewer.entry < b.entries.length - 1) viewer.entry++;
    else if (viewer.book < gallery.books.length - 1) {
      viewer.book++;
      viewer.entry = 0;
    } else viewer = null;
    render();
  });
  $("revPrev").addEventListener("click", () => {
    if (!viewer) return socket.emit("reveal", -1);
    if (viewer.entry > 0) viewer.entry--;
    else if (viewer.book > 0) {
      viewer.book--;
      viewer.entry = gallery.books[viewer.book].entries.length - 1;
    } else viewer = null;
    render();
  });

  // ---------- modo una persona y cuaderno ----------
  let soloMode = false;
  let bookOpen = false;
  let bookReturn = null; // a dónde volver al salir del cuaderno
  let editingId = null; // dibujo del cuaderno que se está editando
  const BOOK_KEY = "tg-cuaderno";
  const BOOK_MAX = 1000;
  // El cuaderno vive en IndexedDB: cada dibujo por separado (la imagen entera en «imgs») y un índice
  // con miniaturas en «items». En memoria solo están las miniaturas; la imagen entera se pide al verla.
  // Se pide al navegador almacenamiento «persistente» para que no lo borre si le falta espacio.
  let bookCache = []; // [{ id, prompt, by, date, src, thumb }], el más nuevo primero
  const fullCache = new Map(); // id -> imagen entera (las últimas vistas)
  let bookDb = null;
  const idb = (() => {
    try {
      return window.indexedDB || null;
    } catch (_) {
      return null;
    }
  })();
  function openBookDb() {
    if (bookDb) return bookDb;
    bookDb = new Promise((ok, ko) => {
      if (!idb) return ko(new Error("sin IndexedDB"));
      const rq = idb.open("dibulios", 2);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", { keyPath: "id" });
        if (!db.objectStoreNames.contains("imgs")) db.createObjectStore("imgs");
      };
      rq.onsuccess = () => {
        const db = rq.result;
        db.onversionchange = () => {
          db.close();
          bookDb = null;
        };
        ok(db);
      };
      rq.onerror = () => ko(rq.error);
    });
    return bookDb;
  }
  /** Una transacción: fn(stores) puede devolver una petición; se resuelve con su resultado al terminar */
  function idbTx(names, mode, fn) {
    return openBookDb().then((db) => new Promise((ok, ko) => {
      const t = db.transaction(names, mode);
      const st = {};
      for (const n of [].concat(names)) st[n] = t.objectStore(n);
      const rq = fn(st);
      t.oncomplete = () => ok(rq && rq.result);
      t.onerror = () => ko(t.error);
      t.onabort = () => ko(t.error);
    }));
  }
  function persistStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then((p) => p || navigator.storage.persist()).catch(() => {});
      }
    } catch (_) {}
  }
  /** Miniatura para la cuadrícula (360 px de ancho, JPEG ligero) */
  function makeThumb(img) {
    return loadImg(img).then((im) => {
      if (!im) return img;
      const w = Math.min(360, im.naturalWidth), h = Math.round((im.naturalHeight * w) / im.naturalWidth);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      x.fillStyle = "#fff";
      x.fillRect(0, 0, w, h);
      x.drawImage(im, 0, 0, w, h);
      return c.toDataURL("image/jpeg", 0.8);
    });
  }
  const metaOf = (d) => ({ id: d.id, prompt: d.prompt || "", by: d.by || "", date: d.date, src: d.src || "", thumb: d.thumb });
  function storeItem(meta, img) {
    if (!idb) return saveBookLocal();
    return makeThumb(img)
      .then((th) => {
        meta.thumb = th;
        return idbTx(["items", "imgs"], "readwrite", (st) => {
          st.imgs.put(img, meta.id);
          st.items.put(metaOf(meta));
        });
      })
      .catch(() => {});
  }
  function dropItems(ids) {
    for (const id of ids) fullCache.delete(id);
    if (!idb) return saveBookLocal();
    idbTx(["items", "imgs"], "readwrite", (st) => {
      for (const id of ids) {
        st.items.delete(id);
        st.imgs.delete(id);
      }
    }).catch(() => {});
  }
  function trimBook() {
    if (bookCache.length <= BOOK_MAX) return;
    const gone = bookCache.splice(BOOK_MAX).map((d) => d.id);
    dropItems(gone);
  }
  function readBook() {
    return bookCache.slice();
  }
  /** Añade un dibujo al principio del cuaderno */
  function addToBook(meta, img) {
    let id = meta.id || Date.now();
    while (bookCache.some((d) => d.id === id)) id++;
    const m = { id, prompt: meta.prompt || "", by: meta.by || "", date: meta.date || new Date().toISOString(), src: meta.src || "", thumb: img };
    if (!idb) m.img = img;
    bookCache.unshift(m);
    bookCache.sort((a, b) => b.id - a.id);
    fullCache.set(id, img);
    trimBook();
    storeItem(m, img);
    persistStorage();
    return m;
  }
  function updateBookImg(id, img) {
    const m = bookCache.find((d) => d.id === id);
    if (!m) return false;
    m.date = new Date().toISOString();
    m.thumb = img;
    if (!idb) m.img = img;
    fullCache.set(id, img);
    storeItem(m, img);
    return true;
  }
  function removeFromBook(id) {
    bookCache = bookCache.filter((d) => d.id !== id);
    dropItems([id]);
  }
  /** La imagen entera de un dibujo del cuaderno */
  function getBookImg(id) {
    if (fullCache.has(id)) return Promise.resolve(fullCache.get(id));
    const m = bookCache.find((d) => d.id === id);
    if (m && m.img) return Promise.resolve(m.img);
    return idbTx("imgs", "readonly", (st) => st.imgs.get(id)).then((img) => {
      if (img) {
        fullCache.set(id, img);
        if (fullCache.size > 12) fullCache.delete(fullCache.keys().next().value);
      }
      return img || (m && m.thumb) || null;
    });
  }
  /** Sin IndexedDB (muy raro): localStorage, quitando los más antiguos si no cabe */
  function saveBookLocal() {
    const list = bookCache.map((d) => ({ id: d.id, prompt: d.prompt, by: d.by, date: d.date, src: d.src, img: d.img }));
    while (list.length) {
      try {
        localStorage.setItem(BOOK_KEY, JSON.stringify(list));
        return true;
      } catch (_) {
        list.pop();
        bookCache.length = list.length;
      }
    }
    try {
      localStorage.setItem(BOOK_KEY, "[]");
    } catch (_) {}
    return false;
  }
  // Al abrir: se carga el índice; y la primera vez se mudan los cuadernos antiguos (una lista en «kv» o en localStorage)
  (() => {
    let legacy = [];
    try {
      legacy = JSON.parse(localStorage.getItem(BOOK_KEY) || "[]") || [];
    } catch (_) {}
    if (!idb) {
      bookCache = legacy.map((d) => Object.assign({}, d, { thumb: d.img }));
      return;
    }
    bookCache = legacy.map((d) => ({ id: d.id, prompt: d.prompt, by: d.by, date: d.date, src: d.src, thumb: d.img })); // mientras carga
    legacy.forEach((d) => fullCache.set(d.id, d.img));
    idbTx(["items", "kv"], "readonly", (st) => {
      const out = {};
      st.items.getAll().onsuccess = (e) => (out.items = e.target.result);
      st.kv.get("book").onsuccess = (e) => (out.old = e.target.result);
      return { get result() { return out; } };
    })
      .then(async ({ items, old }) => {
        const have = new Map((items || []).map((m) => [m.id, m]));
        const toMove = [].concat(Array.isArray(old) ? old : [], legacy).filter((d) => d && d.img && !have.has(d.id));
        const added = bookCache.filter((m) => !have.has(m.id) && !legacy.some((d) => d.id === m.id)); // guardados mientras cargaba
        bookCache = [...have.values(), ...added];
        for (const d of toMove) {
          const m = { id: d.id, prompt: d.prompt, by: d.by, date: d.date, src: d.src, thumb: d.img };
          bookCache.push(m);
          have.set(d.id, m);
          await storeItem(m, d.img);
        }
        bookCache.sort((a, b) => b.id - a.id);
        trimBook();
        if (toMove.length || old) {
          await idbTx("kv", "readwrite", (st) => st.kv.delete("book")).catch(() => {});
          try {
            localStorage.removeItem(BOOK_KEY);
          } catch (_) {}
        }
        if (bookCache.length) persistStorage();
        if (bookOpen && !$("s-book").hidden) renderBook();
      })
      .catch(() => {});
  })();

  /** Guarda en el cuaderno un dibujo que se ha visto en la partida (tuyo o de otra persona) */
  /** Los dibujos de la partida llegan como dirección; el cuaderno guarda la imagen en sí (la sala desaparece) */
  function asDataUrl(src) {
    if (String(src).indexOf("data:") === 0) return Promise.resolve(src);
    return fetch(src)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("no"))))
      .then((b) => new Promise((ok, ko) => {
        const fr = new FileReader();
        fr.onload = () => ok(fr.result);
        fr.onerror = ko;
        fr.readAsDataURL(b);
      }));
  }
  const inBook = (src) => bookCache.some((x) => x.src === src);
  async function saveSharedToBook(src, prompt, by, btn, doneText) {
    if (!src) return;
    if (inBook(src)) {
    } else {
      let img;
      try {
        img = await asDataUrl(src);
      } catch (_) {
        return toast("No se pudo guardar: la partida ya no está en el servidor.");
      }
      const author = by && by.name ? by.name : "";
      addToBook({ prompt: prompt || "Dibujo de la partida", by: author, src: String(src).indexOf("data:") === 0 ? "" : src }, img);
      SFX.play("point");
      track("dibujo_guardado_partida", { total: bookCache.length });
    }
    if (btn) {
      btn.textContent = doneText || "✔ En tu cuaderno";
      btn.disabled = true;
    }
  }
  function saveBtn(img, prompt, by) {
    const b = el("button", "btn-ghost small save-book", "📒 Guardar en mi cuaderno");
    b.type = "button";
    if (inBook(img)) {
      b.textContent = "✔ En tu cuaderno";
      b.disabled = true;
    }
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      saveSharedToBook(img, prompt, by, b);
    });
    return b;
  }
  function newIdea() {
    $("drawWhat").textContent = idea("solo");
    $("drawWhat").classList.toggle("long", $("drawWhat").textContent.length > 26);
  }
  let soloFrom = null;
  function startSolo(edit) {
    SFX.play("pop");
    soloFrom = document.body.dataset.screen === "s-book" ? "book" : null;
    track(edit ? "dibujo_editar" : "dibujo_libre", { desde: state ? "sala" : "inicio" });
    soloMode = true;
    bookOpen = false;
    editingId = edit ? edit.id : null;
    document.body.classList.add("solo");
    document.body.classList.remove("pairs-draw", "triptych-draw");
    ensurePad();
    pad.shared = false;
    pad.forcePortrait = false;
    pad.forceLandscape = false;
    pad.setGuide(null);
    pad.setLock(null);
    pad.reset();
    pad.setRule(null);
    applyRuleToolbar(null);
    closePops();
    updateToolbar();
    if (edit) {
      $("drawWhat").textContent = edit.prompt;
      $("drawStep").textContent = "Editando tu dibujo";
      getBookImg(edit.id)
        .then((img) => pad.loadImage(img, (ok) => {
          if (!ok) toast("No se pudo abrir ese dibujo.");
          updateToolbar();
        }))
        .catch(() => toast("No se pudo abrir ese dibujo."));
    } else {
      newIdea();
      $("drawStep").textContent = "Dibujo libre · una idea:";
    }
    $("rerollBtn").hidden = !!edit;
    $("rerollBtn").textContent = "🎲 Idea";
    $("soloExitBtn").hidden = false;
    $("soloBookBtn").hidden = false;
    $("drawTimer").textContent = "";
    $("drawTimer").hidden = true;
    $("drawDone").textContent = edit ? "Guardar cambios" : "Guardar";
    $("pauseBar").hidden = true;
    show("s-draw");
  }
  function exitSolo(silent) {
    if (faceMode) closeFace();
    faceDraft = false;
    faceRetouch = null;
    soloMode = false;
    bookOpen = false;
    editingId = null;
    document.body.classList.remove("solo");
    $("soloExitBtn").hidden = true;
    $("soloBookBtn").hidden = true;
    $("drawTimer").hidden = false;
    $("drawDone").textContent = "¡Listo!";
    currentStepKey = null;
    if (!silent) SFX.play("click");
    if (backToMe && !silent) {
      backToMe = false;
      return openMe();
    }
    if (state) render();
    else if (soloFrom === "book" && !silent) openBook("home");
    else showHome();
  }
  function saveToBook() {
    if (editingId && faceRetouch) {
      // retocando la carita: se guarda el dibujo y se vuelve al encuadre de siempre
      const r = faceRetouch;
      if (pad.dirty) updateBookImg(editingId, pad.toDataURL("image/jpeg", 0.88));
      editingId = null;
      exitSolo(true);
      openFaceCrop(r.meta, r.crop);
      return;
    }
    if (editingId) {
      if (pad.dirty && updateBookImg(editingId, pad.toDataURL("image/jpeg", 0.85))) {
        SFX.play("point");
        track("dibujo_editado");
      }
      editingId = null;
      $("drawDone").textContent = "Guardar";
      $("rerollBtn").hidden = false;
      return openBook("solo");
    }
    if (!pad.dirty) return toast("Dibuja algo antes de guardarlo.");
    addToBook({ prompt: $("drawWhat").textContent }, pad.toDataURL("image/jpeg", 0.85));
    SFX.play("point");
    track("dibujo_guardado", { total: bookCache.length });
    flashBtn($("drawDone"), "✔ Guardado");
    pad.reset();
    updateToolbar();
    newIdea();
  }
  function openBook(from) {
    SFX.play("click");
    bookOpen = true;
    bookReturn = from;
    $("bookBack").hidden = false;
    setBookCols(bookCols());
    renderBook();
    show("s-book");
    if (bookCache.length > 6 && !store.get("tg-tip-zoom", "")) {
      store.set("tg-tip-zoom", "1");
      setTimeout(() => toast("Cambia el tamaño con ▦ arriba, o pellizcando con dos dedos"), 600);
    }
  }
  // Cuántos dibujos por fila: se cambia pellizcando (o Ctrl + rueda en el ordenador)
  const wideBook = () => window.innerWidth >= 700;
  function bookCols() {
    const v = Number(store.get(wideBook() ? "tg-book-cols-w" : "tg-book-cols", "")) || 0;
    return v || (wideBook() ? 5 : 2);
  }
  function setBookCols(n) {
    const max = wideBook() ? 9 : 5;
    n = Math.max(1, Math.min(max, n));
    $("bookGrid").style.setProperty("--book-cols", n);
    $("bookGrid").classList.toggle("dense", n >= 4);
    store.set(wideBook() ? "tg-book-cols-w" : "tg-book-cols", String(n));
    // el botón de tamaño marca el más cercano
    const p = zoomPresets();
    const near = p.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
    for (const b of $("bookZoom").children) b.setAttribute("aria-pressed", String(p[presetIdx(b)] === near));
    return n;
  }
  // tres tamaños a mano (grandes, medianos, pequeños); pellizcar ajusta entre medias
  const zoomPresets = () => (wideBook() ? [3, 5, 8] : [1, 2, 4]);
  const presetIdx = (b) => ({ "1": 0, "0": 1, "-1": 2 })[b.dataset.cols];
  for (const b of $("bookZoom").children) {
    b.addEventListener("click", () => {
      SFX.play("click");
      setBookCols(zoomPresets()[presetIdx(b)]);
    });
  }
  (() => {
    const grid = $("bookGrid");
    let d0 = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    grid.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) d0 = dist(e.touches);
    }, { passive: true });
    grid.addEventListener("touchmove", (e) => {
      if (e.touches.length !== 2 || !d0) return;
      e.preventDefault();
      const r = dist(e.touches) / d0;
      if (r > 1.3 || r < 0.77) {
        const cur = bookCols();
        const n = setBookCols(cur + (r > 1 ? -1 : 1));
        if (n !== cur) SFX.play("click");
        d0 = dist(e.touches);
      }
    }, { passive: false });
    grid.addEventListener("touchend", () => (d0 = 0));
    grid.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setBookCols(bookCols() + (e.deltaY > 0 ? 1 : -1));
    }, { passive: false });
  })();
  function renderBook() {
    const grid = $("bookGrid");
    grid.innerHTML = "";
    const list = readBook();
    if (!list.length) {
      const empty = el("div", "blank-canvas book-empty");
      empty.appendChild(el("span", "blank-emoji", "📒"));
      empty.appendChild(el("strong", "", "Tu cuaderno está vacío"));
      empty.appendChild(el("span", "", "Dibuja algo y pulsa «Guardar» para tenerlo aquí."));
      grid.appendChild(empty);
      return;
    }
    list.forEach((d, k) => {
      const b = el("button", "book-item");
      b.type = "button";
      b.setAttribute("aria-label", d.prompt || "Dibujo");
      const im = el("img");
      im.src = d.thumb;
      im.alt = "";
      im.loading = "lazy";
      b.appendChild(im);
      b.addEventListener("click", () => viewDrawing(k));
      grid.appendChild(b);
    });
    if (isIOS && !installed) {
      const tip = el("p", "book-tip");
      tip.innerHTML = `📲 <strong>Para que tu cuaderno no se borre</strong>, instala Dibulíos: toca ${IOS_SHARE} Compartir y luego «Añadir a pantalla de inicio».`;
      grid.prepend(tip);
    }
    grid.appendChild(el("p", "book-foot", `${list.length} ${list.length === 1 ? "dibujo" : "dibujos"} · se guardan solo en este móvil · máximo ${BOOK_MAX}`));
  }
  // ---------- visor del cuaderno: a pantalla completa, deslizando para pasar ----------
  let viewing = null;
  let viewIdx = 0;
  let viewList = [];
  let delArmed = null;
  function disarmDel() {
    clearTimeout(delArmed);
    delArmed = null;
    $("bookDelText").textContent = "Borrar";
    $("bookDel").classList.remove("armed");
  }
  // Carrusel nativo (desliza con el dedo como en la galería del móvil): una diapositiva por dibujo
  function hydrate(k) {
    const d = viewList[k];
    const slide = $("bookTrack").children[k];
    if (!d || !slide || slide.dataset.full) return;
    slide.dataset.full = "1";
    getBookImg(d.id)
      .then((img) => {
        const im = slide.firstChild;
        if (img && im && viewList[k] === d) im.src = img;
      })
      .catch(() => {});
  }
  let resetZoom = () => {};
  function viewMeta() {
    resetZoom();
    const d = viewList[viewIdx];
    viewing = d;
    if (!d) return;
    for (const k of [viewIdx, viewIdx + 1, viewIdx - 1]) hydrate(k);
    $("bookPrompt").textContent = d.prompt || "Dibujo";
    $("bookMeta").textContent = (d.by ? "de " + d.by + " · " : "") + new Date(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
    $("bookCount").textContent = `${viewIdx + 1} / ${viewList.length}`;
    $("bookPrev").hidden = viewIdx <= 0;
    $("bookNext").hidden = viewIdx >= viewList.length - 1;
    disarmDel();
  }
  function buildTrack() {
    const track = $("bookTrack");
    track.innerHTML = "";
    viewList.forEach((d, k) => {
      const slide = el("div", "viewer-slide");
      const im = el("img");
      im.alt = d.prompt || "Dibujo";
      im.draggable = false;
      im.decoding = "async";
      if (Math.abs(k - viewIdx) > 2) im.loading = "lazy";
      im.src = d.thumb; // la miniatura al instante; la imagen entera llega al acercarse (hydrate)
      slide.appendChild(im);
      track.appendChild(slide);
    });
  }
  function goSlide(k, smooth) {
    const track = $("bookTrack");
    track.scrollTo({ left: k * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }
  function viewDrawing(k) {
    SFX.play("page");
    viewList = readBook();
    viewIdx = Math.max(0, Math.min(k, viewList.length - 1));
    $("bookView").classList.remove("bare");
    $("bookView").hidden = false;
    buildTrack();
    requestAnimationFrame(() => goSlide(viewIdx, false));
    viewMeta();
  }
  function closeViewer() {
    resetZoom();
    $("bookView").hidden = true;
    disarmDel();
  }
  function stepView(dir) {
    const n = viewIdx + dir;
    if (n < 0 || n >= viewList.length) return;
    goSlide(n, true);
  }
  $("bookClose").addEventListener("click", closeViewer);
  $("bookPrev").addEventListener("click", (e) => {
    e.stopPropagation();
    stepView(-1);
  });
  $("bookNext").addEventListener("click", (e) => {
    e.stopPropagation();
    stepView(1);
  });
  (() => {
    const track = $("bookTrack");
    let raf = 0;
    track.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (k !== viewIdx && k >= 0 && k < viewList.length) {
          viewIdx = k;
          viewMeta();
        }
      });
    });
    // tocar el dibujo: se esconden/enseñan las barras (para verlo solo)
    track.addEventListener("click", () => {
      if (Date.now() - zoomTouchedAt < 400) return;
      $("bookView").classList.toggle("bare");
    });
    // ---- zoom: pellizcar (o doble toque) para ampliar; con zoom, un dedo mueve el dibujo ----
    const z = { s: 1, x: 0, y: 0, img: null };
    let g = null; // gesto en curso
    let lastTap = 0, lastTapX = 0, lastTapY = 0;
    const curImg = () => (track.children[viewIdx] ? track.children[viewIdx].firstChild : null);
    const applyZ = (anim) => {
      if (!z.img) return;
      z.img.style.transition = anim ? "transform .22s ease" : "none";
      z.img.style.transform = z.s > 1 ? `translate(${z.x}px, ${z.y}px) scale(${z.s})` : "";
      track.classList.toggle("zoomed", z.s > 1);
    };
    const clampPan = () => {
      if (!z.img) return;
      const w = z.img.offsetWidth, h = z.img.offsetHeight;
      const mx = Math.max(0, (w * z.s - track.clientWidth) / 2 + 20), my = Math.max(0, (h * z.s - track.clientHeight) / 2 + 20);
      z.x = Math.max(-mx, Math.min(mx, z.x));
      z.y = Math.max(-my, Math.min(my, z.y));
    };
    const zoomTo = (s2, px, py, anim) => {
      z.img = z.img || curImg();
      if (!z.img) return;
      const r = z.img.getBoundingClientRect();
      const cx = r.left + r.width / 2 - z.x, cy = r.top + r.height / 2 - z.y; // centro sin desplazar
      const ux = (px - cx - z.x) / z.s, uy = (py - cy - z.y) / z.s;
      z.s = Math.max(1, Math.min(5, s2));
      z.x = px - cx - z.s * ux;
      z.y = py - cy - z.s * uy;
      if (z.s <= 1.01) {
        z.s = 1;
        z.x = z.y = 0;
      }
      clampPan();
      applyZ(anim);
    };
    resetZoom = () => {
      if (z.img) {
        z.img.style.transition = "";
        z.img.style.transform = "";
      }
      z.s = 1;
      z.x = z.y = 0;
      z.img = null;
      track.classList.remove("zoomed");
    };
    let zoomTouchedAt = 0;
    const mid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2, d: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) });
    track.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        z.img = z.img || curImg();
        const m = mid(e.touches);
        g = { pinch: true, m, s: z.s };
        zoomTouchedAt = Date.now();
      } else if (e.touches.length === 1 && z.s > 1) {
        e.preventDefault();
        g = { pan: true, px: e.touches[0].clientX, py: e.touches[0].clientY, x: z.x, y: z.y, moved: false };
      } else g = { tap: true, px: e.touches[0].clientX, py: e.touches[0].clientY, moved: false };
    }, { passive: false });
    track.addEventListener("touchmove", (e) => {
      if (!g) return;
      if (g.pinch && e.touches.length === 2) {
        e.preventDefault();
        const m = mid(e.touches);
        // primero se mueve con los dedos, luego se escala alrededor de ellos
        z.x += m.x - g.m.x;
        z.y += m.y - g.m.y;
        zoomTo(g.s * (m.d / g.m.d), m.x, m.y, false);
        g.s = z.s;
        g.m = m;
      } else if (g.pan && e.touches.length === 1) {
        e.preventDefault();
        z.x = g.x + e.touches[0].clientX - g.px;
        z.y = g.y + e.touches[0].clientY - g.py;
        if (Math.abs(e.touches[0].clientX - g.px) + Math.abs(e.touches[0].clientY - g.py) > 8) g.moved = true;
        clampPan();
        applyZ(false);
      } else if (g.tap && e.touches[0] && Math.abs(e.touches[0].clientX - g.px) + Math.abs(e.touches[0].clientY - g.py) > 10) g.moved = true;
    }, { passive: false });
    track.addEventListener("touchend", (e) => {
      if (!g) return;
      if (g.pinch && e.touches.length < 2) {
        zoomTouchedAt = Date.now();
        if (z.s <= 1.05) {
          zoomTo(1, 0, 0, true);
          resetZoom();
        }
        g = e.touches.length === 1 && z.s > 1 ? { pan: true, px: e.touches[0].clientX, py: e.touches[0].clientY, x: z.x, y: z.y } : null;
        return;
      }
      if ((g.tap || (g.pan && !g.moved)) && e.changedTouches[0]) {
        // doble toque: amplía donde tocas (o vuelve a tamaño normal)
        const t = e.changedTouches[0], now = Date.now();
        if (now - lastTap < 320 && Math.abs(t.clientX - lastTapX) + Math.abs(t.clientY - lastTapY) < 30) {
          zoomTouchedAt = now;
          if (z.s > 1) {
            z.s = 1.0001;
            zoomTo(1, t.clientX, t.clientY, true);
          } else zoomTo(2.5, t.clientX, t.clientY, true);
          lastTap = 0;
          e.preventDefault();
        } else {
          lastTap = now;
          lastTapX = t.clientX;
          lastTapY = t.clientY;
        }
      }
      if (g.pan && g.moved) zoomTouchedAt = Date.now();
      g = null;
    });
    // ordenador: rueda para ampliar, doble clic, y arrastrar con el ratón cuando está ampliado
    track.addEventListener("wheel", (e) => {
      if (!e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      zoomTo(z.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY, false);
    }, { passive: false });
    track.addEventListener("dblclick", (e) => {
      zoomTouchedAt = Date.now();
      zoomTo(z.s > 1 ? 1 : 2.5, e.clientX, e.clientY, true);
    });
    let drag = null;
    track.addEventListener("mousedown", (e) => {
      if (z.s > 1) drag = { px: e.clientX, py: e.clientY, x: z.x, y: z.y };
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      z.x = drag.x + e.clientX - drag.px;
      z.y = drag.y + e.clientY - drag.py;
      clampPan();
      applyZ(false);
      zoomTouchedAt = Date.now();
    });
    window.addEventListener("mouseup", () => (drag = null));
    // al girar el móvil, que no se quede a medias entre dos dibujos
    window.addEventListener("resize", () => {
      if (!$("bookView").hidden) goSlide(viewIdx, false);
    });
    document.addEventListener("keydown", (e) => {
      if ($("bookView").hidden) return;
      if (e.key === "ArrowRight") stepView(1);
      else if (e.key === "ArrowLeft") stepView(-1);
      else if (e.key === "Escape") closeViewer();
    });
  })();
  // Guardar un dibujo en la galería del móvil.
  // iPhone/iPad: una descarga va a «Archivos», no a Fotos; el menú de compartir tiene «Guardar imagen».
  // Android y ordenador: descarga directa (en Android aparece en la galería, en «Descargas»).
  const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  async function toJpegFile(src, name) {
    const im = await loadImg(src);
    const c = document.createElement("canvas");
    c.width = im ? im.naturalWidth : 600;
    c.height = im ? im.naturalHeight : 900;
    const x = c.getContext("2d");
    x.fillStyle = "#fff";
    x.fillRect(0, 0, c.width, c.height);
    if (im) x.drawImage(im, 0, 0);
    return canvasFile(c, name);
  }
  function fileName(prompt) {
    const base = String(prompt || "dibujo").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    return "dibulios-" + (base || "dibujo") + ".jpg";
  }
  async function saveToGallery(src, prompt, btn) {
    try {
      const file = await toJpegFile(src, fileName(prompt));
      if (isApple() && navigator.canShare && navigator.canShare({ files: [file] })) {
        if (!store.get("tg-tip-photos", "")) {
          store.set("tg-tip-photos", "1");
          toast("En el menú que sale, pulsa «Guardar imagen» y se guardará en Fotos.");
          await new Promise((r) => setTimeout(r, 900));
        }
        try {
          await navigator.share({ files: [file] });
          track("dibujo_a_galeria", { via: "compartir" });
        } catch (_) {} // cancelado
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      if (btn) flashBtn(btn, "✔ Guardado en la galería", 2000);
      else toast("✔ Imagen guardada en el móvil");
      track("dibujo_a_galeria", { via: "descarga" });
    } catch (_) {
      toast("No se pudo guardar la imagen.");
    }
  }
  $("bookSave").addEventListener("click", async () => {
    if (!viewing) return;
    const img = await getBookImg(viewing.id).catch(() => null);
    if (img) saveToGallery(img, viewing.prompt, null);
  });
  $("bookShare").addEventListener("click", async () => {
    if (!viewing) return;
    try {
      const img = await getBookImg(viewing.id);
      const file = await toJpegFile(img, fileName(viewing.prompt));
      const text = "Dibujado en Dibulíos ✏️ " + location.origin;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Dibulíos", text });
          track("dibujo_compartido", {});
        } catch (_) {} // cancelado
        return;
      }
      saveToGallery(img, viewing.prompt, null);
    } catch (_) {
      toast("No se pudo compartir el dibujo.");
    }
  });
  $("bookEdit").addEventListener("click", () => {
    closeViewer();
    if (viewing) startSolo(viewing);
  });
  $("bookDel").addEventListener("click", () => {
    if (!delArmed) {
      SFX.play("click");
      $("bookDelText").textContent = "¿Seguro?";
      $("bookDel").classList.add("armed");
      delArmed = setTimeout(disarmDel, 3000);
      return;
    }
    disarmDel();
    removeFromBook(viewing.id);
    SFX.play("crumple");
    renderBook();
    // se queda en el visor, con el siguiente dibujo (o se cierra si ya no quedan)
    viewList = readBook();
    if (!viewList.length) return closeViewer();
    viewIdx = Math.min(viewIdx, viewList.length - 1);
    buildTrack();
    requestAnimationFrame(() => goSlide(viewIdx, false));
    viewMeta();
  });

  $("lobbyBookBtn").addEventListener("click", () => openBook("lobby"));
  $("soloExitBtn").addEventListener("click", () => exitSolo());

  $("soloBookBtn").addEventListener("click", () => openBook("solo"));
  $("bookDraw").addEventListener("click", () => startSolo());
  $("bookBack").addEventListener("click", () => {
    SFX.play("click");
    bookOpen = false;
    if (bookReturn === "solo" && soloMode) return show("s-draw");
    soloMode = false;
    document.body.classList.remove("solo");
    if (state) render();
    else showHome();
  });

  // ---------- final ----------
  function duoVerdict(score, max) {
    const r = score / max;
    if (r >= 0.85) return "¡Telepatía total! Os leéis la mente.";
    if (r >= 0.5) return "¡Muy buen equipo!";
    if (r > 0) return "Algo habéis pillado. ¡La revancha!";
    return "Cero patatero. Los dibujos eran arte abstracto.";
  }
  function renderEnd() {
    currentStepKey = null;
    if (viewer) return renderViewer();
    renderEndScreen();
  }
  let podiumShown = null;
  function paintPodium(ranking) {
    const pod = $("podium");
    const rest = $("rankRest");
    // El podio solo se anima la primera vez que se ve
    const key = state.code + ":" + ranking.map((r) => r.id + r.points).join(",");
    const animate = podiumShown !== key;
    podiumShown = key;
    pod.innerHTML = "";
    pod.classList.toggle("animate", animate);
    const top = ranking.filter((r) => r.place <= 3);
    const steps = [2, 1, 3]; // segundo, primero, tercero
    for (const place of steps) {
      const group = top.filter((r) => r.place === place);
      const col = el("div", "podium-col p" + place);
      if (!group.length) {
        col.classList.add("empty");
        pod.appendChild(col);
        continue;
      }
      const faces = el("div", "podium-faces");
      group.forEach((r) => faces.appendChild(AVATARS.avatarEl(r.emoji, "podium-avatar")));
      col.appendChild(faces);
      col.appendChild(el("span", "podium-name", group.map((r) => r.name).join(" y ")));
      col.appendChild(el("span", "podium-pts", `★ ${group[0].points}`));
      const block = el("div", "podium-block", MEDAL[place - 1]);
      col.appendChild(block);
      pod.appendChild(col);
    }
    rest.innerHTML = "";
    const others = ranking.filter((r) => r.place > 3);
    rest.hidden = !others.length;
    others.forEach((r) => {
      const li = el("li", "rank-row");
      li.appendChild(el("span", "rank-place", `${r.place}.º`));
      li.appendChild(who(r));
      li.appendChild(el("span", "rank-pts", `★ ${r.points}`));
      rest.appendChild(li);
    });
    if (animate) setTimeout(() => state && state.phase === "end" && !viewer && SFX.play("end"), 2300);
  }
  function renderEndScreen() {
    show("s-end");
    const isVote = state.mode === "vote" && state.ranking;
    $("podium").hidden = !isVote;
    $("rankRest").hidden = true;
    $("endBadge").hidden = !!isVote;
    document.body.classList.toggle("vote-end", !!isVote);
    if (isVote) {
      const winners = state.ranking.filter((r) => r.place === 1);
      $("endTitle").textContent = winners.length > 1 ? "¡Empate en lo más alto!" : `¡Gana ${winners[0].name}!`;
      $("endText").textContent = state.kind === "extreme" ? `${state.ranking[0].points} puntos entre aciertos y dibujos adivinados. ¿La revancha?` : state.kind === "pairs" ? `${state.ranking[0].points} estrellas sumadas, de media en cada ronda. ¿La revancha?` : `${state.ranking[0].points} estrellas${state.kind === "portrait" ? " por el parecido" : ""}. ¿La revancha?`;
      $("reviewBtn").textContent = "Volver a ver las rondas";
      paintPodium(state.ranking);
    } else if (state.mode === "duo") {
      $("endTitle").textContent = `${state.teamScore ?? 0} de ${state.maxScore ?? 0} puntos`;
      $("endText").textContent = duoVerdict(state.teamScore || 0, state.maxScore || 1);
      $("reviewBtn").textContent = "Volver a ver las rondas";
    } else {
      $("endTitle").textContent = "¡Fin de la partida!";
      $("endText").textContent = "¿Otra? Las historias siguen aquí hasta que volváis a la sala.";
      $("reviewBtn").textContent = state.variant === "triptych" ? "Ver y compartir las criaturas" : "Ver y compartir las historias";
    }
    $("reviewBtn").disabled = !gallery;
    $("againBtn").hidden = !isHost();
    const hostP = state.players.find((p) => p.id === state.hostId);
    $("againHint").textContent = isHost() ? "" : `${nameOf(hostP, "El anfitrión")} puede llevaros a la sala para otra partida.`;
  }
  $("reviewBtn").addEventListener("click", () => {
    if (!gallery) return;
    viewer = { kind: gallery.mode, book: 0, entry: 0 };
    render();
  });
  $("againBtn").addEventListener("click", () => socket.emit("lobby"));

  ["gesturestart", "gesturechange"].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  buildEmojiGrid();
  show("s-home");
  window.__appReady = true;
})();
