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
    if (id === "s-draw" && soloMode) key = faceMode ? "carita" : "solo";
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

  const params = new URLSearchParams(location.search);
  const inviteCode = (params.get("sala") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);

  // ---------- conexión ----------
  const socket = io({ transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    $("offline").hidden = true;
    const s = session.get();
    if (s && s.code && s.token && (!inviteCode || inviteCode === s.code)) {
      socket.emit("join", { code: s.code, token: s.token, rejoinOnly: true, name: me.name, emoji: me.emoji }, (res) => {
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
  const modeName = (m, kind) => (m === "duo" ? "duo" : m === "vote" ? (kind === "portrait" ? "retratos" : "votacion") : "telefono");
  function trackGame(prev, next) {
    if (!prev || prev.code !== next.code || next.hostId !== next.you) return;
    const n = next.players.filter((p) => !p.left).length;
    if (prev.phase === "lobby" && next.phase === "playing") {
      track("partida_empezada", { jugadores: n, modo: modeName(next.mode, next.kind || (next.settings.mode === "retratos" ? "portrait" : "")), tiempo: String(next.settings.time), pruebas: !!next.practice });
    }
    if (prev.phase !== "end" && next.phase === "end") {
      track("partida_terminada", { jugadores: n, modo: modeName(next.mode, next.kind) });
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

  function paintMute() {
    $("muteBtn").textContent = SFX.muted ? "🔇" : "🔊";
    $("muteBtn").setAttribute("aria-label", SFX.muted ? "Activar sonidos" : "Silenciar sonidos");
  }
  $("muteBtn").addEventListener("click", () => {
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
  let installed = false;
  let isIOS = false;
  try {
    installed = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  } catch (_) {}
  let installEvt = null;
  function showInstall(mode) {
    if (installed || store.get("tg-install-hidden", "") === "1") return;
    const card = $("installCard");
    if (mode === "prompt") {
      $("installHint").textContent = "Tenlo en tu pantalla de inicio, como una app.";
      $("installBtn").hidden = false;
    } else if (mode === "ios") {
      $("installHint").innerHTML = "";
      $("installHint").append("En Safari, toca Compartir ", el("strong", "", "⬆️"), " y luego «Añadir a pantalla de inicio».");
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
    toast("¡Dibulíos instalado! 🎉");
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
    store.set("tg-install-hidden", "1");
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
  const screens = ["s-home", "s-lobby", "s-text", "s-draw", "s-vote", "s-wait", "s-result", "s-reveal", "s-end", "s-book"];
  function show(id) {
    for (const s of screens) $(s).hidden = s !== id;
    if (id !== "s-result") $("zoomSheet").hidden = true;
    document.body.dataset.screen = id;
    trackScreen(id);
    if (id === "s-draw" && pad) requestAnimationFrame(() => pad.layout());
  }
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2800);
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
    const own = el("button", "emoji-btn draw-own", "✏️");
    own.type = "button";
    own.setAttribute("aria-label", "Dibujar mi carita");
    own.title = "Dibuja tu carita";
    own.addEventListener("click", () => openFace());
    g.appendChild(own);
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
        $("emojiSheet").hidden = true;
      });
      g.appendChild(b);
    }
    paintCurrentAvatar();
  }
  function paintCurrentAvatar() {
    const c = $("emojiCurrent");
    c.innerHTML = "";
    c.appendChild(AVATARS.avatarEl(me.emoji));
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
  $("emojiBtn").addEventListener("click", () => {
    SFX.play("click");
    $("emojiSheet").hidden = false;
  });
  $("emojiClose").addEventListener("click", () => ($("emojiSheet").hidden = true));

  // ---------- dibujar tu propia carita (en el lienzo grande, dentro de un círculo) ----------
  // El círculo ocupa el cuadrado central del lienzo (600x600 a partir de y=150)
  const FACE_BOX = { x: 0, y: 150, s: 600 };
  let faceMode = false;
  function openFace() {
    $("emojiSheet").hidden = true;
    SFX.play("pop");
    soloMode = true;
    faceMode = true;
    bookOpen = false;
    editingId = null;
    document.body.classList.add("solo", "face-mode");
    ensurePad();
    pad.forcePortrait = true;
    pad.reset();
    pad.fillClip = { cx: FACE_BOX.x + FACE_BOX.s / 2, cy: FACE_BOX.y + FACE_BOX.s / 2, r: FACE_BOX.s / 2 };
    closePops();
    let guide = $("faceGuide");
    if (!guide) {
      guide = el("div", "face-guide");
      guide.id = "faceGuide";
      pad.inner.appendChild(guide);
    }
    // Si ya tenías una carita, se parte de ella
    const saved = store.get("tg-face", "");
    $("faceDelBtn").hidden = !isFace(saved);
    $("faceDelBtn").textContent = "🗑️";
    if (isFace(saved)) {
      const im = new Image();
      im.onload = () => {
        pad.ctx.drawImage(im, FACE_BOX.x, FACE_BOX.y, FACE_BOX.s, FACE_BOX.s);
        pad.blank = false;
        updateToolbar();
      };
      im.src = saved;
    }
    updateToolbar();
    $("drawStep").textContent = "Tu carita";
    $("drawWhat").textContent = "Dibuja tu cara dentro del círculo";
    $("drawWhat").classList.remove("long");
    $("rerollBtn").hidden = true;
    $("soloBookBtn").hidden = true;
    $("soloExitBtn").hidden = false;
    $("drawTimer").hidden = true;
    $("drawDone").textContent = "Usar esta carita";
    $("pauseBar").hidden = true;
    show("s-draw");
  }
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
    toast("Carita borrada");
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
    let url = "";
    for (const q of [0.85, 0.72, 0.58, 0.45, 0.32]) {
      try {
        url = out.toDataURL("image/webp", q);
        if (url.indexOf("data:image/webp") !== 0) url = out.toDataURL("image/jpeg", q);
      } catch (_) {
        url = out.toDataURL("image/jpeg", q);
      }
      if (url.length < 13000) break;
    }
    store.set("tg-face", url);
    me.emoji = url;
    store.set("tg-emoji", url);
    track("carita_dibujada");
    buildEmojiGrid();
    SFX.play("point");
    toast("¡Ya tienes tu carita!");
    if (state && state.phase === "lobby") socket.emit("profile", { name: me.name, emoji: me.emoji });
    exitSolo(true);
  }
  $("howBtn").addEventListener("click", () => {
    SFX.play("pop");
    $("howSheet").hidden = false;
    track("como_se_juega");
  });
  $("howClose").addEventListener("click", () => ($("howSheet").hidden = true));
  $("howSheet").addEventListener("click", (e) => {
    if (e.target === $("howSheet")) $("howSheet").hidden = true;
  });
  $("emojiSheet").addEventListener("click", (e) => {
    if (e.target === $("emojiSheet")) $("emojiSheet").hidden = true;
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
  function needName() {
    syncName();
    if (!me.name.trim()) {
      $("homeError").textContent = "Escribe tu nombre para que los demás sepan quién eres.";
      $("nameInput").focus();
      return true;
    }
    $("homeError").textContent = "";
    return false;
  }
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
    try {
      history.replaceState(null, "", "/?sala=" + res.code);
    } catch (_) {}
    guardBack();
    SFX.play("pop");
    keepAwake();
  }
  $("createBtn").addEventListener("click", () => {
    if (needName()) return;
    socket.emit("create", { name: me.name, emoji: me.emoji }, (res) => {
      if (res && res.ok) track("sala_creada");
      entered(res);
    });
  });
  function joinCode(code) {
    if (needName()) return;
    if (!/^[A-Z]{5}$/.test(code)) {
      $("homeError").textContent = "El código tiene 5 letras.";
      return;
    }
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
  }

  // ---------- salir, logo y botón atrás ----------
  function askLeave(fromLogo) {
    SFX.play("click");
    $("leaveTitle").textContent = fromLogo ? "¿Volver al inicio?" : "¿Salir de la sala?";
    $("leaveText").textContent =
      state && state.phase !== "lobby" ? "Saldrás de la partida y tus turnos se saltarán." : "Saldrás de la sala. Puedes volver a entrar con el código.";
    $("leaveSheet").hidden = false;
  }
  $("leaveBtn").addEventListener("click", () => askLeave(false));
  $("brandBtn").addEventListener("click", () => {
    if (state) askLeave(true);
    else show("s-home");
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
  window.addEventListener("popstate", () => {
    backGuarded = false;
    if (state) {
      guardBack();
      askLeave(false);
    }
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

  function render() {
    if (outdated && state && (state.phase === "lobby" || state.phase === "end") && !soloMode && !bookOpen) {
      outdated = false;
      $("updateBar").hidden = false; // se ofrece, sin recargar por sorpresa
    }
    if (soloMode || bookOpen) {
      if (state && state.phase !== "lobby") {
        exitSolo(true);
      } else {
        renderChrome();
        return;
      }
    }
    renderChrome();
    renderPause();
    if (!state) return show("s-home");
    if (state.phase === "lobby") return renderLobby();
    if (state.phase === "playing") return renderPlaying();
    if (state.phase === "reveal") return renderReveal();
    if (state.phase === "end") return renderEnd();
  }

  function playerItem(p, opts = {}) {
    const li = el("li", "player chip" + (p.connected ? "" : " off") + (p.left ? " left" : ""));
    li.appendChild(AVATARS.avatarEl(p.emoji, "p-emoji"));
    li.appendChild(el("span", "p-name", p.name));
    const tags = el("span", "p-tags");
    if (p.id === state.you) tags.appendChild(el("span", "tag you", "tú"));
    if (p.id === state.hostId) tags.appendChild(el("span", "tag host", "anfitrión"));
    if (p.bot) tags.appendChild(el("span", "tag", "robot"));
    if (p.left) tags.appendChild(el("span", "tag", "se fue"));
    else if (!p.connected) tags.appendChild(el("span", "tag warn", "sin conexión"));
    if (opts.status) tags.appendChild(el("span", "p-status " + (p.done ? "ok" : "pending"), p.done ? "✔" : "…"));
    li.appendChild(tags);
    return li;
  }

  // ---------- sala de espera ----------
  function modeCopy(n) {
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
    const needed = 2 - n;
    $("playersNeed").hidden = needed <= 0;
    if (needed > 0) $("playersNeed").textContent = "Falta 1 jugador · comparte el enlace";
    const ul = $("lobbyPlayers");
    ul.innerHTML = "";
    state.players.forEach((p) => ul.appendChild(playerItem(p)));
    const [t, txt] = modeCopy(n);
    $("modeTitle").textContent = (state.practice ? "🧪 Pruebas · " : "") + t;
    $("modeText").textContent = state.practice ? "🤖 Los robots juegan solos. " + txt : txt;
    const host = isHost();
    if (!timeDragging) {
      const idx = Math.max(0, DRAW_TIMES.indexOf(Number(state.settings.time)));
      $("timeRange").value = idx;
      paintTime(idx);
    }
    $("timeRange").disabled = !host;
    for (const b of $("modeSeg").children) {
      b.setAttribute("aria-pressed", String(b.dataset.v === state.settings.mode));
      b.disabled = !host;
    }
    for (const b of $("roundsSeg").children) {
      b.setAttribute("aria-pressed", String(Number(b.dataset.v) === state.settings.duoRounds));
      b.disabled = !host;
    }
    const voteMode = state.settings.mode === "votacion" || state.settings.mode === "retratos";
    $("duoRoundsSetting").hidden = !(voteMode || n === 2);
    $("lobbySoloBtn").hidden = n !== 1;
    const hostP = state.players.find((p) => p.id === state.hostId);
    $("notHostHint").textContent = host ? "" : `${nameOf(hostP, "El anfitrión")} elige las opciones y empieza la partida.`;
    $("startBtn").hidden = !host;
    const need = 2;
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
  $("modeSeg").addEventListener("click", (e) => {
    const v = e.target.closest("button")?.dataset.v;
    if (v && isHost()) {
      SFX.play("click");
      socket.emit("settings", { mode: v });
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
      toast("Enlace copiado");
    } catch (_) {
      $("shareLink").hidden = false;
      $("shareLink").select();
      toast("Selecciona el enlace y cópialo");
    }
  });

  // ---------- turnos ----------
  function stepLabel(task) {
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
      $("drawWhat").textContent = task.secret != null ? task.secret : task.prompt ? (task.prompt.value || "(sin respuesta)") : "";
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
      pad.reset();
      closePops();
      updateToolbar();
      $("drawStep").textContent = stepLabel(task);
      if (state.mode === "vote" && task.kind === "portrait") {
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
      return;
    }
    $("textStep").textContent = stepLabel(task);
    $("textInput").value = "";
    $("textPromptFig").hidden = true;
    $("textPromptEmpty").hidden = true;
    $("textSpacer").hidden = false;
    if (task.type === "write") {
      $("textTitle").textContent = "Escribe una frase para que alguien la dibuje";
      $("textInput").placeholder = "Ej.: Un pulpo tocando la batería";
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

  function sendText() {
    const v = $("textInput").value.trim();
    if (!v) {
      toast(state.task.type === "write" ? "Escribe algo o pulsa «Dame una idea»." : "Escribe lo que crees que es.");
      return false;
    }
    socket.emit("submit", { stepKey: currentStepKey, content: v });
    SFX.play("send");
    return true;
  }
  $("textForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (sendText()) $("textInput").blur();
  });
  $("diceBtn").addEventListener("click", () => {
    $("textInput").value = FRASES[Math.floor(Math.random() * FRASES.length)];
  });

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
    if (soloMode) return saveToBook();
    if (!pad.dirty) {
      toast("Dibuja algo antes de terminar.");
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

  // ---------- lienzo y herramientas ----------
  const ICONS = {
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>',
    eraser: '<path d="M8 20h12"/><path d="M5 15l8-9 6 6-7 8H9z"/><path d="M9 11l5 5"/>',
    fill: '<path d="M3.5 10.5l6.5-6.5 7 7-6.5 6.5a1.5 1.5 0 01-2.1 0L3.5 12.6a1.5 1.5 0 010-2.1z" fill="var(--paint)" fill-opacity=".9"/><path d="M8 5.5L6 3.5"/><path d="M19 13.5s2.5 3 2.5 4.8a2.5 2.5 0 01-5 0c0-1.8 2.5-4.8 2.5-4.8z" fill="var(--paint)"/>',
    marker: '<path d="M14.5 4.5l5 5-8 8-5-5z" fill="var(--paint)" fill-opacity=".55"/><path d="M6.5 12.5l-2 6 1 1 6-2"/><path d="M4.5 18.5l-1.5 1.5"/>',
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
      onStroke: (kind, v) => {
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
        updateToolbar();
        closePops();
      });
      cs.appendChild(b);
    });
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
    const hslHex = (h, l) => {
      const a2 = Math.min(l, 100 - l) / 100;
      const f = (n) => {
        const k = (n + h / 30) % 12;
        const c = l / 100 - a2 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
        return Math.round(255 * c).toString(16).padStart(2, "0");
      };
      return "#" + f(0) + f(8) + f(4);
    };
    function applyFree() {
      pad.color = hslHex(hue, light);
      shadeBar.style.setProperty("--h", hue);
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
    $("pad").addEventListener("pointerdown", () => closePops(), true);
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
  const POPS = [["sizes", "sizeToggle"], ["colors", "colorToggle"]];
  function togglePop(popId, open) {
    for (const [pid, bid] of POPS) {
      const pop = $(pid);
      const next = pid === popId ? (open == null ? pop.hidden : open) : false;
      pop.hidden = !next;
      $(bid).setAttribute("aria-expanded", String(next));
      $(bid).classList.toggle("active", next);
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
    document.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("active", b.dataset.tool === pad.tool));
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
    const badge = $("zoomBadge");
    const label = Math.round(pad.zoom * 100) + "%";
    if (badge && badge.textContent !== label) {
      badge.textContent = label;
      badge.hidden = false;
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(() => (badge.hidden = pad.zoom === 1), 1200);
    }
  }
  document.querySelectorAll("[data-tool]").forEach((b) =>
    b.addEventListener("click", () => {
      SFX.play("click");
      pad.tool = b.dataset.tool;
      updateToolbar();
    })
  );
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
      toast("Lienzo borrado. Puedes deshacerlo.");
      return;
    }
    $("clearBtn").classList.add("armed");
    toast("Pulsa otra vez la papelera para borrarlo todo");
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
  const STAR_TEXT = ["Toca las estrellas para puntuar", "😬 Mejorable", "🙂 Regular", "😊 Bien", "😃 ¡Muy bien!", "🤩 ¡Obra maestra!"];
  const LIKE_TEXT = ["¿Cuánto se parece? Toca las estrellas", "😬 Ni de lejos", "🙂 Algo tiene", "😊 Se parece", "😃 ¡Muy parecido!", "🤩 ¡Clavado!"];
  function paintVote() {
    const task = state.task;
    const items = task.items || [];
    const portrait = task.kind === "portrait";
    $("voteStep").textContent = stepLabel(task) + (portrait ? " · ¿Cuánto se parece?" : " · Puntúa");
    if (!portrait) $("votePhrase").textContent = "«" + (task.phrase || "") + "»";
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
    vIdx = Math.min(vIdx, items.length - 1);
    const it = items[vIdx];
    if ($("voteImg").getAttribute("src") !== it.image) $("voteImg").src = it.image;
    if (portrait) setWho($("votePhrase"), "Retrato de", it.target);
    $("voteCount").textContent = portrait ? `Retrato ${vIdx + 1} de ${items.length} · ¿quién lo habrá dibujado?` : `Dibujo ${vIdx + 1} de ${items.length} · ¿de quién será?`;
    const mine = votes[it.k] || 0;
    for (const b of $("voteStars").children) {
      const n = Number(b.dataset.s);
      b.classList.toggle("on", n <= mine);
      b.setAttribute("aria-pressed", String(n === mine));
    }
    $("starsLabel").textContent = (portrait ? LIKE_TEXT : STAR_TEXT)[mine];
    const last = vIdx === items.length - 1;
    $("votePrev").disabled = vIdx === 0;
    $("voteNextBtn").textContent = last ? "Enviar puntos" : "Siguiente";
    $("voteNextBtn").disabled = !mine;
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
    paintVote();
    // Pasa solo al siguiente dibujo, con un momento para ver las estrellas
    const at = vIdx;
    if (at < items.length - 1)
      setTimeout(() => {
        if (vIdx === at && state.task && state.task.type === "vote") {
          vIdx++;
          paintVote();
        }
      }, 450);
  });
  $("votePrev").addEventListener("click", () => {
    if (vIdx > 0) {
      vIdx--;
      SFX.play("click");
      paintVote();
    }
  });
  $("voteNextBtn").addEventListener("click", () => {
    const items = (state.task && state.task.items) || [];
    if (vIdx < items.length - 1) {
      vIdx++;
      SFX.play("page");
      return paintVote();
    }
    const missing = items.findIndex((it) => !votes[it.k]);
    if (missing >= 0) {
      vIdx = missing;
      toast("Te falta puntuar este dibujo.");
      return paintVote();
    }
    socket.emit("submit", { stepKey: currentStepKey, content: votes });
    SFX.play("send");
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
    const ph = el("p", "secret vote-round-phrase", round.kind === "portrait" ? "🖼️ Retratos" : "«" + round.phrase + "»");
    box.appendChild(ph);
    let place = 0;
    round.items.forEach((it, i) => {
      if (i === 0 || it.points !== round.items[i - 1].points) place = i;
      const card = el("article", "duo-card vote-card");
      const head = el("div", "duo-card-head");
      head.appendChild(el("span", "vote-place", it.points > 0 && place < 3 ? MEDAL[place] : `${place + 1}.º`));
      head.appendChild(who(it.by));
      card.appendChild(head);
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
      card.appendChild(el("div", "pts vote-pts", `★ ${it.points}`));
      if (it.image) card.addEventListener("click", () => zoomDrawing(it, it.target ? "Retrato de " + it.target.name : round.phrase));
      box.appendChild(card);
    });
  }
  let zooming = null;
  function zoomDrawing(it, prompt) {
    SFX.play("page");
    zooming = { img: it.image, prompt, by: it.by };
    $("zoomImg").src = it.image;
    const w = $("zoomWho");
    w.innerHTML = "";
    w.appendChild(who(it.by, "dibujó"));
    $("zoomPts").hidden = it.points == null;
    $("zoomPts").textContent = `★ ${it.points}`;
    const saved = readBook().some((x) => x.img === it.image);
    $("zoomSave").disabled = saved;
    $("zoomSave").textContent = saved ? "✔ En tu cuaderno" : "📒 Guardar en mi cuaderno";
    $("zoomSheet").hidden = false;
  }
  $("zoomSave").addEventListener("click", () => zooming && saveSharedToBook(zooming.img, zooming.prompt, zooming.by, $("zoomSave")));
  $("zoomClose").addEventListener("click", () => ($("zoomSheet").hidden = true));
  $("zoomSheet").addEventListener("click", (e) => {
    if (e.target === $("zoomSheet") || e.target === $("zoomImg")) $("zoomSheet").hidden = true;
  });
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
      : r.round >= r.rounds ? "Ver el podio 🏆" : "Siguiente ronda";
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
  function paintStory(o) {
    show("s-reveal");
    $("revealCount").textContent = o.count;
    setWho($("revealTitle"), "La historia de", o.owner);
    const dots = $("revealDots");
    dots.innerHTML = "";
    for (let i = 0; i < o.total; i++) dots.appendChild(el("span", "dot" + (i < o.entries.length ? " on" : "") + (i === o.entries.length - 1 ? " now" : "")));
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
      const im = el("img", "stage-img");
      im.src = prev.content;
      im.alt = "Dibujo de " + (prev.by ? prev.by.name : "alguien");
      st.appendChild(im);
      st.appendChild(saveBtn(prev.content, textBefore(o.entries.length - 3), prev.by));
      const by = el("div", "stage-by");
      by.appendChild(who(cur.by, "dijo que es…"));
      st.appendChild(by);
      st.appendChild(el("p", "stage-bubble is-guess compact", cur.content));
    } else {
      const by = el("div", "stage-by");
      by.appendChild(who(cur.by, VERB[cur.type]));
      st.appendChild(by);
      if (cur.type === "draw") {
        if (cur.content) {
          const im = el("img", "stage-img");
          im.src = cur.content;
          im.alt = "Dibujo de " + (cur.by ? cur.by.name : "alguien");
          st.appendChild(im);
          st.appendChild(saveBtn(cur.content, textBefore(o.entries.length - 2), cur.by));
        } else st.appendChild(blankEl());
      } else {
        st.appendChild(el("p", "stage-bubble " + (cur.type === "write" ? "is-write" : "is-guess"), cur.content));
      }
    }
    if (o.animate) {
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
  function renderReveal() {
    currentStepKey = null;
    const r = state.reveal;
    const key = r.book + ":" + r.entry;
    const host = isHost();
    const atEnd = r.entry >= r.totalEntries - 1;
    const lastBook = r.book >= r.totalBooks - 1;
    const hostP = state.players.find((p) => p.id === state.hostId);
    paintStory({
      count: `Historia ${r.book + 1} de ${r.totalBooks}`,
      owner: r.owner,
      entries: r.entries,
      total: r.totalEntries,
      animate: key !== lastRevealKey,
      controls: host,
      prevDisabled: r.book === 0 && r.entry === 0,
      nextLabel: !atEnd ? "Siguiente" : lastBook ? "Terminar" : "Siguiente historia",
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
      count: `Historia ${viewer.book + 1} de ${gallery.books.length}`,
      owner: b.owner,
      entries: b.entries.slice(0, viewer.entry + 1),
      total: b.entries.length,
      animate: true,
      controls: true,
      prevDisabled: false,
      prevLabel: viewer.book === 0 && viewer.entry === 0 ? "Volver" : "Anterior",
      nextLabel: !atEnd ? "Siguiente" : lastBook ? "Volver" : "Siguiente historia",
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
  const BOOK_MAX = 40;
  function readBook() {
    try {
      return JSON.parse(localStorage.getItem(BOOK_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
  function writeBook(list) {
    if (!list.length) {
      try {
        localStorage.setItem(BOOK_KEY, "[]");
      } catch (_) {}
      return true;
    }
    while (list.length) {
      try {
        localStorage.setItem(BOOK_KEY, JSON.stringify(list));
        return true;
      } catch (_) {
        list.pop(); // sin espacio: se quita el más antiguo
      }
    }
    return false;
  }
  /** Guarda en el cuaderno un dibujo que se ha visto en la partida (tuyo o de otra persona) */
  function saveSharedToBook(img, prompt, by, btn) {
    if (!img) return;
    const list = readBook();
    if (list.some((x) => x.img === img)) {
      toast("Ese dibujo ya está en tu cuaderno 📒");
    } else {
      const author = by && by.name ? by.name : "";
      list.unshift({ id: Date.now(), prompt: prompt || "Dibujo de la partida", by: author, date: new Date().toISOString(), img });
      if (list.length > BOOK_MAX) list.length = BOOK_MAX;
      if (!writeBook(list)) return toast("No queda espacio en este móvil para guardar más dibujos.");
      SFX.play("point");
      track("dibujo_guardado_partida", { total: list.length });
      toast("Guardado en tu cuaderno 📒");
    }
    if (btn) {
      btn.textContent = "✔ En tu cuaderno";
      btn.disabled = true;
    }
  }
  function saveBtn(img, prompt, by) {
    const b = el("button", "btn-ghost small save-book", "📒 Guardar en mi cuaderno");
    b.type = "button";
    if (readBook().some((x) => x.img === img)) {
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
    $("drawWhat").textContent = FRASES[Math.floor(Math.random() * FRASES.length)];
    $("drawWhat").classList.toggle("long", $("drawWhat").textContent.length > 26);
  }
  function startSolo(edit) {
    SFX.play("pop");
    track(edit ? "dibujo_editar" : "dibujo_libre", { desde: state ? "sala" : "inicio" });
    soloMode = true;
    bookOpen = false;
    editingId = edit ? edit.id : null;
    document.body.classList.add("solo");
    ensurePad();
    pad.reset();
    closePops();
    updateToolbar();
    if (edit) {
      $("drawWhat").textContent = edit.prompt;
      $("drawStep").textContent = "Editando tu dibujo";
      pad.loadImage(edit.img, (ok) => {
        if (!ok) toast("No se pudo abrir ese dibujo.");
        updateToolbar();
      });
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
    if (state) render();
    else show("s-home");
  }
  function saveToBook() {
    if (editingId) {
      const list = readBook();
      const item = list.find((x) => x.id === editingId);
      if (item && pad.dirty) {
        item.img = pad.toDataURL("image/jpeg", 0.85);
        item.date = new Date().toISOString();
        if (!writeBook(list)) return toast("No queda espacio en este móvil para guardar los cambios.");
        SFX.play("point");
        track("dibujo_editado");
        toast("Cambios guardados 📒");
      }
      editingId = null;
      $("drawDone").textContent = "Guardar";
      $("rerollBtn").hidden = false;
      return openBook("solo");
    }
    if (!pad.dirty) return toast("Dibuja algo antes de guardarlo.");
    const list = readBook();
    list.unshift({ id: Date.now(), prompt: $("drawWhat").textContent, date: new Date().toISOString(), img: pad.toDataURL("image/jpeg", 0.85) });
    if (list.length > BOOK_MAX) list.length = BOOK_MAX;
    if (!writeBook(list)) return toast("No queda espacio en este móvil para guardar más dibujos.");
    SFX.play("point");
    track("dibujo_guardado", { total: list.length });
    toast("Guardado en tu cuaderno 📒");
    pad.reset();
    updateToolbar();
    newIdea();
  }
  function openBook(from) {
    SFX.play("click");
    bookOpen = true;
    bookReturn = from;
    renderBook();
    show("s-book");
  }
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
    list.forEach((d) => {
      const b = el("button", "book-item");
      b.type = "button";
      const im = el("img");
      im.src = d.img;
      im.alt = d.prompt;
      im.loading = "lazy";
      b.appendChild(im);
      b.appendChild(el("span", "book-cap", d.prompt));
      b.addEventListener("click", () => viewDrawing(d));
      grid.appendChild(b);
    });
  }
  let viewing = null;
  let delArmed = null;
  function viewDrawing(d) {
    SFX.play("page");
    viewing = d;
    $("bookImg").src = d.img;
    $("bookPrompt").textContent = d.prompt + (d.by ? " · de " + d.by : "") + " · " + new Date(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    $("bookDelText").textContent = "";
    $("bookDel").classList.remove("armed");
    $("bookView").hidden = false;
  }
  $("bookClose").addEventListener("click", () => ($("bookView").hidden = true));
  $("bookEdit").addEventListener("click", () => {
    $("bookView").hidden = true;
    if (viewing) startSolo(viewing);
  });
  $("bookView").addEventListener("click", (e) => {
    if (e.target === $("bookView")) $("bookView").hidden = true;
  });
  $("bookDel").addEventListener("click", () => {
    if (!delArmed) {
      SFX.play("click");
      $("bookDelText").textContent = "¿Borrar?";
      $("bookDel").classList.add("armed");
      delArmed = setTimeout(() => {
        delArmed = null;
        $("bookDelText").textContent = "";
        $("bookDel").classList.remove("armed");
      }, 3000);
      return;
    }
    clearTimeout(delArmed);
    delArmed = null;
    writeBook(readBook().filter((x) => x.id !== viewing.id));
    SFX.play("crumple");
    $("bookView").hidden = true;
    renderBook();
  });
  $("soloBtn").addEventListener("click", () => startSolo());
  $("lobbySoloBtn").addEventListener("click", () => startSolo());
  $("soloExitBtn").addEventListener("click", () => exitSolo());
  $("bookBtn").addEventListener("click", () => openBook("home"));
  $("soloBookBtn").addEventListener("click", () => openBook("solo"));
  $("bookDraw").addEventListener("click", () => startSolo());
  $("bookBack").addEventListener("click", () => {
    SFX.play("click");
    bookOpen = false;
    if (bookReturn === "solo" && soloMode) return show("s-draw");
    soloMode = false;
    document.body.classList.remove("solo");
    if (state) render();
    else show("s-home");
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
      $("endText").textContent = `${state.ranking[0].points} estrellas${state.kind === "portrait" ? " por el parecido" : ""}. ¿La revancha?`;
      $("reviewBtn").textContent = "Volver a ver las rondas";
      paintPodium(state.ranking);
    } else if (state.mode === "duo") {
      $("endTitle").textContent = `${state.teamScore ?? 0} de ${state.maxScore ?? 0} puntos`;
      $("endText").textContent = duoVerdict(state.teamScore || 0, state.maxScore || 1);
      $("reviewBtn").textContent = "Volver a ver las rondas";
    } else {
      $("endTitle").textContent = "¡Fin de la partida!";
      $("endText").textContent = "¿Otra? Las historias siguen aquí hasta que volváis a la sala.";
      $("reviewBtn").textContent = "Volver a ver las historias";
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
