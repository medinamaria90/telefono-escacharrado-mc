// Dibulíos: servidor de salas.
// Todo vive en memoria: no hay base de datos ni ficheros. Cuando una partida
// termina se borran sus dibujos, y la sala entera desaparece cuando ya no
// queda nadie conectado.

const path = require("path");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const compression = require("compression");
const { Server } = require("socket.io");
const FRASES = require("./public/frases.js");
const ART = require("./lib/botart.js");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 12;
const MAX_TEXT = 120;
const MAX_IMAGE = 3_000_000; // caracteres del dataURL
const ROOM_IDLE_MS = 10 * 60 * 1000; // sala vacía: se borra a los 10 min
const ROOM_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOBBY_DROP_MS = 90 * 1000; // en la sala de espera, quien se va 90 s sale de la lista
const HOST_HANDOVER_MS = 10 * 1000;
const GRACE_MS = 6000; // margen tras agotarse el tiempo (para conexiones lentas)
const LATE_DRAWING_MS = 45000; // un dibujo que llega tarde aún se coloca en su sitio

// Tiempo para dibujar, en segundos (0 = sin límite). Escribir, adivinar y votar llevan menos.
const DRAW_TIMES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 0];
const clampN = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
function timesFor(settings) {
  const d = Number(settings.time) || 0;
  if (!d) return null;
  return { draw: d, write: clampN(d * 0.6, 25, 90), guess: clampN(d * 0.5, 25, 75), vote: clampN(d * 0.7, 35, 100) };
}

const app = express();
app.disable("x-powered-by");
// Todo lo que se manda en texto (página, código, frases) va comprimido: pesa varias veces menos
app.use(compression());
// Cada arranque tiene su versión: así los móviles nunca mezclan archivos viejos y nuevos
const fs = require("fs");
const BOOT = Date.now().toString(36);
const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8").replace(/__V__/g, BOOT);
app.get(["/", "/index.html"], (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("html").send(INDEX);
});
// El trabajador de la app nunca se cachea, para que se actualice siempre
app.get("/sw.js", (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "public", "sw.js"));
});
app.use(express.static(path.join(__dirname, "public"), { maxAge: "7d", index: false }));
app.get("/salud", (_req, res) => res.send("ok"));
// Para Google: se puede indexar la portada (las salas no)
const SITE = process.env.SITE_URL || "https://dibulios.onrender.com";
app.get("/robots.txt", (_req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /img/\nSitemap: ${SITE}/sitemap.xml\n`));
// Guías (páginas de texto para buscadores; la app no las enlaza): /como-jugar, etc.
const GUIDES = ["como-jugar", "juego-de-dibujar-y-adivinar", "juegos-para-jugar-en-familia"];
for (const g of GUIDES) {
  app.get("/" + g, (_req, res) => {
    res.set("Cache-Control", "public, max-age=3600");
    res.sendFile(path.join(__dirname, "public", "guias", g + ".html"));
  });
}
const SITEMAP_DATE = new Date().toISOString().slice(0, 10);
app.get("/sitemap.xml", (_req, res) =>
  res
    .type("application/xml")
    .send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
        [["/", "1.0"], ...GUIDES.map((g) => ["/" + g, "0.7"])].map(([u, p]) => `<url><loc>${SITE}${u}</loc><lastmod>${SITEMAP_DATE}</lastmod><priority>${p}</priority></url>`).join("") +
        `</urlset>\n`
    )
);
// IndexNow (Bing, Yandex…): se les avisa de las páginas al arrancar en producción
const INDEXNOW_KEY = "d1bu710s5e0k3y2026a";
app.get(`/${INDEXNOW_KEY}.txt`, (_req, res) => res.type("text/plain").send(INDEXNOW_KEY));
if (process.env.RENDER) {
  setTimeout(() => {
    const host = new URL(SITE).host;
    const body = JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`, urlList: [SITE + "/", ...GUIDES.map((g) => `${SITE}/${g}`)] });
    fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body }).catch(() => {});
  }, 60000);
}
// Dibujos y caritas de una sala: cada móvil los descarga una sola vez (y se quedan en su caché)
app.get("/img/:code/:id", (req, res) => {
  const r = rooms.get(String(req.params.code).toUpperCase());
  const im = r && r.images && r.images.get(req.params.id);
  if (!im) return res.status(404).end();
  res.set("Cache-Control", "private, max-age=86400, immutable");
  res.set("X-Robots-Tag", "noindex");
  res.type(im.type).send(im.buf);
});

const server = http.createServer(app);
// Los mensajes grandes van comprimidos (los pequeños no: no merece la pena el trabajo)
const io = new Server(server, { maxHttpBufferSize: 8e6, pingTimeout: 30000, perMessageDeflate: { threshold: 1024 } });

/** @type {Map<string, any>} */
const rooms = new Map();

// ---------- utilidades ----------
// Solo letras (más cómodo de dictar y teclear). Sin I ni O para no confundir.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PRACTICE_CODE = "ZZZZZ"; // sala de pruebas con robots
function newCode() {
  let c;
  do {
    c = "";
    for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  } while (rooms.has(c) || c === PRACTICE_CODE);
  return c;
}
const newId = () => crypto.randomBytes(9).toString("base64url");
const pick = (arr) => arr[crypto.randomInt(arr.length)];
function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function cleanText(s, max = MAX_TEXT) {
  return String(s ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
function cleanName(s) {
  return cleanText(s, 16) || "Sin nombre";
}
const MAX_FACE = 40000; // carita dibujada: imagen pequeña (256 px)
function cleanEmoji(s) {
  const e = String(s ?? "").trim();
  if (/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(e) && e.length <= MAX_FACE) return e;
  // Un solo emoji (puede ocupar varios puntos de código). Límite de seguridad.
  if (!e || e.length > 16 || /[<>&"'\s]/.test(e)) return "🙂";
  return e;
}
/** Guarda un dibujo (o carita) de la sala y devuelve su dirección corta: así no viaja una y otra vez dentro del estado */
function storeImage(room, data, key) {
  if (typeof data !== "string" || data.indexOf("data:image/") !== 0) return data;
  if (!room.images) room.images = new Map();
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(data);
  if (!m) return data;
  const id = key || newId();
  if (!room.images.has(id)) room.images.set(id, { type: m[1], buf: m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]), "utf8") });
  return `/img/${room.code}/${id}`;
}
/** Carita dibujada: la misma imagen siempre tiene la misma dirección (y se cachea) */
function faceRef(room, emoji) {
  if (typeof emoji !== "string" || emoji.indexOf("data:image/") !== 0) return emoji;
  if (!room.faceIds) room.faceIds = new Map();
  let ref = room.faceIds.get(emoji);
  if (!ref) {
    ref = storeImage(room, emoji, "f" + crypto.createHash("sha1").update(emoji).digest("base64url").slice(0, 16));
    room.faceIds.set(emoji, ref);
  }
  return ref;
}
function isImage(s) {
  return typeof s === "string" && s.length <= MAX_IMAGE && /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s);
}

// Comparación de respuestas para el modo de 2 jugadores
const STOP = new Set("el la los las un una unos unas de del al y e en con a que por para su sus se lo le les mi tu es esta este muy".split(" "));
function words(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}
function scoreGuess(answer, guess) {
  const a = words(answer);
  const g = new Set(words(guess));
  if (!a.length || !g.size) return 0;
  const hit = a.filter((w) => g.has(w)).length;
  if (hit === a.length) return 3;
  if (hit / a.length >= 0.5) return 1;
  return 0;
}

// ---------- salas ----------
function getRoom(code) {
  return rooms.get(String(code || "").toUpperCase().trim());
}
function makePlayer(name, emoji) {
  return { id: newId(), token: newId(), name: cleanName(name), emoji: cleanEmoji(emoji), socketId: null, connected: false, left: false, droppedAt: 0 };
}
function connectedPlayers(room) {
  return [...room.players.values()].filter((p) => p.connected && !p.bot);
}
function touchRoom(room) {
  room.updatedAt = Date.now();
  clearTimeout(room.idleTimer);
  if (connectedPlayers(room).length === 0) {
    room.idleTimer = setTimeout(() => deleteRoom(room.code), ROOM_IDLE_MS);
  }
}
function deleteRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  clearTimeout(room.idleTimer);
  clearTimeout(room.stepTimer);
  for (const p of room.players.values()) clearTimeout(p.dropTimer);
  room.game = null;
  rooms.delete(code);
}
function ensureHost(room) {
  const host = room.players.get(room.hostId);
  if (host && host.connected && !host.left) return;
  const next = [...room.players.values()].find((p) => p.connected && !p.left && !p.bot);
  if (next) room.hostId = next.id;
}

// ---------- robots de la sala de pruebas ----------
const BOTS = [
  { name: "Robotito", emoji: "av:robot" },
  { name: "Alien Bip", emoji: "av:alien" },
  { name: "Dino Rex", emoji: "av:dino" },
  { name: "Gata Lola", emoji: "av:gato" },
];
function addBots(room) {
  for (const b of BOTS) {
    const p = makePlayer(b.name, b.emoji);
    p.bot = true;
    p.connected = true;
    room.players.set(p.id, p);
  }
}
/** Lo que contesta un robot. Devuelve {content, meta} (meta = tema del dibujo, para copiarlo o adivinarlo) */
function botContent(room, botId) {
  const game = room.game;
  const idx = game.order.indexOf(botId);
  if (game.mode === "chain" && game.variant === "triptych" && game.stepType === "draw") return { content: ART.drawPart(TRIPTYCH_PARTS[game.step]) };
  if (game.mode === "chain" && game.step > 0) {
    const book = game.books[chainBookIndex(game, idx)];
    const prev = book.entries[game.step - 1];
    if (game.stepType === "draw" && game.variant === "triptych") {
      return { content: ART.drawPart(TRIPTYCH_PARTS[game.step]) };
    }
    if (game.stepType === "draw") {
      if (prev.type === "draw") {
        // Degradado: copia de memoria, cada vez peor
        const first = book.entries[0];
        const d = ART.draw({ key: prev.botKey, text: first.type === "draw" ? "" : first.content, level: Math.max(1, game.step - (first.type === "draw" ? 0 : 1)) });
        return { content: d.url, meta: d.key };
      }
      if (game.variant === "extreme") {
        const d = ART.drawRule(game.stepRules[game.step]);
        return { content: d.url, meta: d.key };
      }
      const d = ART.draw({ text: prev.content });
      return { content: d.url, meta: d.key };
    }
    if (game.stepType === "guess") {
      const subj = prev.botKey ? ART.SUBJECTS.find((x) => x.key === prev.botKey) : null;
      return { content: subj && crypto.randomInt(10) < 7 ? subj.name : pick(FRASES) };
    }
  }
  if (game.stepType === "draw") {
    let text = "";
    if (game.mode === "vote" && game.kind === "pairs") {
      // En un equipo con personas, el robot no manda dibujo propio (se queda el de las personas)
      const team = game.teams[game.round][teamIndexOf(game, botId)] || [];
      if (team.some((id) => !room.players.get(id)?.bot)) return { content: null };
      const d = ART.draw({ text: game.phrases[game.round] });
      return { content: d.url, meta: d.key };
    }
    if (game.mode === "vote") text = game.kind === "stars" ? game.phrases[game.round] : game.kind === "extreme" ? game.extras[game.round][botId].phrase : "una persona";
    else if (game.mode === "duo") text = game.secrets.get(botId)?.phrase;
    const d = game.kind === "extreme" ? ART.drawRule(game.extras[game.round][botId].rule) : ART.draw({ text, key: game.kind === "portrait" ? "persona" : undefined });
    return { content: d.url, meta: d.key };
  }
  if (game.stepType === "vote") {
    const v = {};
    const list = game.drawings[game.round] || [];
    for (const k of votableFor(game, botId)) v[k] = game.kind === "extreme" ? (crypto.randomInt(10) < 4 ? list[k].phrase : pick(FRASES)) : 1 + crypto.randomInt(5);
    return { content: v };
  }
  return { content: game.stepType === "write" ? pick(poolFor(game)) : pick(FRASES) }; // escribir o adivinar
}
/** Cada robot contesta al cabo de unos segundos, como si pensara */
function scheduleBots(room) {
  const game = room.game;
  if (!game || !room.practice || game.stepType === "result") return;
  const seq = game.seq;
  for (const id of game.order) {
    const p = room.players.get(id);
    if (!p || !p.bot || game.submissions.get(id)?.done) continue;
    setTimeout(() => {
      if (room.game !== game || game.seq !== seq || room.phase !== "playing" || game.submissions.get(id)?.done) return;
      const r = botContent(room, id);
      game.submissions.set(id, { content: storeImage(room, r.content), meta: r.meta, done: true, at: Date.now() - 600000 });
      maybeFinish(room);
    }, 2500 + crypto.randomInt(5000));
  }
}

// ---------- por parejas: lienzo compartido ----------
const TOOLS = ["pen", "marker", "water", "spray", "eraser"];
const GEOMS = ["line", "rect", "ellipse", "tri"];
const okKey = (k) => typeof k === "string" && /^[\w-]{1,24}$/.test(k);
const num = (v, lo, hi) => (typeof v === "number" && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v * 10) / 10)) : null);
/** Trazos que manda un móvil: solo se dejan pasar campos conocidos y números en rango */
function cleanOps(ops) {
  if (!Array.isArray(ops)) return [];
  const out = [];
  for (const o of ops.slice(0, 400)) {
    if (!o || typeof o !== "object") continue;
    if (o.t === "s") {
      const x = num(o.x, 0, 900), y = num(o.y, 0, 900), z = num(o.z, 1, 80);
      if (x == null || y == null || z == null || !TOOLS.includes(o.tool) || !/^#[0-9a-f]{6}$/i.test(o.c || "")) continue;
      const op = { t: "s", tool: o.tool, c: o.c, z, x, y };
      if (okKey(o.k)) op.k = o.k;
      if (Array.isArray(o.w)) op.w = o.w.slice(0, 6).map((L) => ({ amp: num(L?.amp, 0, 1) || 0, k: num(L?.k, 0, 2) || 1, a: num(L?.a, 0, 1) || 0.3, p1: num(L?.p1, 0, 7) || 0, p2: num(L?.p2, 0, 7) || 0, p3: num(L?.p3, 0, 7) || 0 }));
      out.push(op);
    } else if (o.t === "m" && Array.isArray(o.p)) {
      const p = [];
      for (const v of o.p.slice(0, 800)) {
        const n = num(v, 0, 900);
        if (n == null) break;
        p.push(n);
      }
      if (p.length >= 2) out.push({ t: "m", p: p.length % 2 ? p.slice(0, -1) : p });
    } else if (o.t === "e") out.push({ t: "e" });
    else if (o.t === "c") out.push(okKey(o.k) ? { t: "c", k: o.k } : { t: "c" });
    else if ((o.t === "u" || o.t === "r") && okKey(o.k)) out.push({ t: o.t, k: o.k }); // deshacer / rehacer lo propio
    else if (o.t === "f") {
      const x = num(o.x, 0, 900), y = num(o.y, 0, 900);
      if (x != null && y != null && /^#[0-9a-f]{6}$/i.test(o.c || "")) out.push(okKey(o.k) ? { t: "f", x, y, c: o.c, k: o.k } : { t: "f", x, y, c: o.c });
    } else if (o.t === "g" && GEOMS.includes(o.kind)) {
      // línea o figura
      const x1 = num(o.x1, -300, 1200), y1 = num(o.y1, -300, 1200), x2 = num(o.x2, -300, 1200), y2 = num(o.y2, -300, 1200), z = num(o.z, 1, 80);
      if ([x1, y1, x2, y2, z].every((v) => v != null) && /^#[0-9a-f]{6}$/i.test(o.c || "")) out.push({ t: "g", kind: o.kind, x1, y1, x2, y2, c: o.c, z, ...(okKey(o.k) ? { k: o.k } : {}) });
    }
  }
  return out;
}
/** Guarda los trazos de un equipo y se los pasa a sus compañeros */
// Cada paquete de trazos lleva un número (bid) de quien lo manda: si llega repetido (reenvío), no se duplica.
// Todo lo que entra al registro del equipo se numera (i) y se manda a TODO el equipo, también a quien lo envió
// (le sirve de confirmación). Así cada móvil sabe si le falta algún trozo y lo pide.
function relayOps(room, fromId, ops, bid) {
  const game = room.game;
  const ti = teamIndexOf(game, fromId);
  if (ti < 0) return;
  const log = game.logs[ti] || (game.logs[ti] = []);
  if (!game.logSeen) game.logSeen = [];
  const seen = game.logSeen[ti] || (game.logSeen[ti] = new Map());
  const key = stepKeyOf(game);
  const tag = fromId + ":" + bid;
  if (bid != null && seen.has(tag)) {
    // ya estaba: solo se confirma a quien lo reenvió
    const p = room.players.get(fromId);
    if (p && p.connected && p.socketId) io.to(p.socketId).emit("pairAck", { key, bid, i: seen.get(tag) });
    return;
  }
  if (!ops.length) return;
  if (log.reduce((n, e) => n + e.ops.length, 0) > 60000) return; // tope de seguridad
  const i = log.length;
  log.push({ from: fromId, ops, bid, i });
  if (bid != null) seen.set(tag, i);
  for (const id of game.teams[game.round][ti]) {
    const p = room.players.get(id);
    if (p && p.connected && p.socketId) io.to(p.socketId).emit("pairOps", { key, from: fromId, ops, i, bid });
  }
}
/** Sala de pruebas: el robot compañero también pinta (y estorba un poco) */
function scheduleBotScribbles(room) {
  const game = room.game;
  if (!room.practice) return;
  const seq = game.seq;
  const COLS = ["#c81d25", "#2563eb", "#1f8a3a", "#ff7a1a", "#9b5de5", "#ffd21f"];
  for (const team of game.teams[game.round]) {
    const bots = team.filter((id) => room.players.get(id)?.bot);
    if (!bots.length || bots.length === team.length) continue;
    const tick = () => {
      if (room.game !== game || game.seq !== seq || room.phase !== "playing") return;
      const id = pick(bots);
      let x = 80 + crypto.randomInt(440), y = 120 + crypto.randomInt(660);
      const p = [];
      for (let i = 0; i < 14; i++) {
        x = Math.max(10, Math.min(590, x + crypto.randomInt(61) - 30));
        y = Math.max(10, Math.min(890, y + crypto.randomInt(61) - 30));
        p.push(x, y);
      }
      relayOps(room, id, [{ t: "s", tool: crypto.randomInt(4) ? "pen" : "marker", c: pick(COLS), z: 9, x: p[0], y: p[1] }, { t: "m", p }, { t: "e" }]);
      setTimeout(tick, 4000 + crypto.randomInt(5000));
    };
    setTimeout(tick, 2500 + crypto.randomInt(3000));
  }
}

// ---------- partida ----------
function chainLength(n) {
  return n === 3 ? 5 : n;
}
function typeForChainStep(k, variant) {
  if (variant === "degrade" || variant === "triptych") return "draw"; // Degradado y Tríptico: todo son dibujos
  if (k === 0) return "write";
  return k % 2 === 1 ? "draw" : "guess";
}
// Degradado: el primero se inventa un dibujo en 3 min; luego se ve 10 s y se copia de memoria en 1 min, 30 s y 15 s
// Con más jugadores, más pasos; el tiempo baja poco a poco y el último siempre es de 15 s
const DEGRADE_SCHEDULES = {
  4: [180, 90, 45, 15],
  5: [180, 90, 60, 30, 15],
  6: [180, 120, 90, 60, 30, 15],
  7: [180, 120, 90, 60, 45, 30, 15],
  8: [180, 150, 120, 90, 60, 45, 30, 15],
};
const DEGRADE_VIEW_MS = 10000;
const degradeSteps = (n) => Math.min(8, Math.max(4, n));
// Dibujo extremo: limitaciones al azar
const RULES = ["circles", "squares", "oneline"];
// Modos que se juegan por rondas con votación de estrellas
const VOTE_MODES = ["votacion", "retratos", "parejas"];
const CHAIN_MODES = ["degradado", "extremo", "triptico"]; // siempre en cadena, aunque sean 2
const MODES = ["telefono", ...VOTE_MODES, ...CHAIN_MODES];
const minPlayersFor = (mode) => (mode === "parejas" ? 3 : 2); // Tríptico con 2: os turnáis (A-B-A y B-A-B)
// Tríptico: cada criatura se dibuja en 3 partes, cada una de alguien distinto
const TRIPTYCH_PARTS = ["head", "body", "legs"];

function startGame(room) {
  const order = shuffle([...room.players.values()].filter((p) => !p.left).map((p) => p.id));
  const n = order.length;
  const game = {
    mode: VOTE_MODES.includes(room.settings.mode) ? "vote" : CHAIN_MODES.includes(room.settings.mode) || n > 2 ? "chain" : "duo",
    order,
    step: 0,
    stepType: null,
    deadline: null,
    submissions: new Map(), // playerId -> {content, done}
    phase: "playing",
  };
  if (game.mode === "chain") {
    // Dibujo extremo: como el clásico, pero en cada vuelta de dibujo todos tienen la misma limitación
    game.variant = room.settings.mode === "degradado" ? "degrade" : room.settings.mode === "extremo" ? "extreme" : room.settings.mode === "triptico" ? "triptych" : "classic";
    game.steps = game.variant === "degrade" ? degradeSteps(n) : game.variant === "triptych" ? 3 : n === 2 ? 4 : chainLength(n);
    game.stepRules = [];
    if (game.variant === "extreme") {
      // Las limitaciones se deciden al empezar, así quien escribe la frase ya sabe cómo se dibujará.
      // Una fija para toda la partida, o «variada»: las tres repartidas sin repetir hasta usarlas todas.
      const fixed = RULES.includes(room.settings.rule) ? room.settings.rule : null;
      let bag = [];
      let prevRule = null;
      for (let k = 1; k < game.steps; k++) {
        if (typeForChainStep(k, game.variant) !== "draw") continue;
        if (fixed) {
          game.stepRules[k] = fixed;
          continue;
        }
        if (!bag.length) {
          bag = shuffle(RULES);
          if (bag[0] === prevRule) bag.push(bag.shift());
        }
        prevRule = game.stepRules[k] = bag.shift();
      }
    }
    game.books = order.map((id) => ({ owner: id, entries: [] }));
  } else if (game.mode === "vote") {
    // Votación: todos dibujan la misma frase, se puntúa del 1 al 5 sin saber de quién es cada dibujo.
    // Retratos: a cada uno le toca retratar en secreto a otro jugador, y todos puntúan el
    // parecido de cada retrato del 1 al 5 (se sabe a quién retrata, no quién lo dibujó).
    game.kind = room.settings.mode === "retratos" ? "portrait" : room.settings.mode === "parejas" ? "pairs" : room.settings.mode === "extremo" ? "extreme" : "stars";
    game.extras = []; // dibujo extremo: por ronda, {jugador: {phrase, rule}}
    game.targets = []; // retratos: por ronda, {dibujante: retratado}
    game.rounds = room.settings.duoRounds;
    game.round = 0;
    game.stage = "draw"; // draw -> vote -> result
    game.phrases = [];
    game.drawings = []; // por ronda: [{by, image, votes: {votante: estrellas}, points}]
    game.voteOrder = []; // por ronda: orden (barajado) en que se enseñan los dibujos
    game.totals = new Map(order.map((id) => [id, 0]));
    game.usedPhrases = new Set();
    if (game.kind === "pairs") {
      // Por parejas: en cada ronda a uno le toca elegir la frase; las parejas cambian cada ronda
      // y dibujan a la vez en un lienzo compartido. Se puntúa con estrellas y los puntos son de cada persona.
      game.stage = "write";
      game.teams = []; // por ronda: [[id, id], [id, id, id]...]
      game.choosers = []; // por ronda: quién elige la frase
      game.partnerCount = new Map(); // "a|b" -> veces que han ido juntos
      game.logs = []; // ronda actual: trazos de cada equipo, para quien se reconecta
      game.tiebreaks = 0;
    }
  } else {
    game.rounds = room.settings.duoRounds;
    game.round = 0;
    game.duoStage = "draw"; // draw -> guess -> result
    game.cards = []; // por ronda: [{drawer, phrase, image, guesser, guess, points}]
    game.teamScore = 0;
    game.usedPhrases = new Set();
    game.secrets = new Map(); // playerId -> {phrase, rerolls}
  }
  room.game = game;
  room.phase = "playing";
  beginStep(room);
}

// Frases salidas hace poco (en todas las salas): no se repiten hasta que han pasado muchas
const RECENT_MAX = 700;
const recentPhrases = [];
const recentSet = new Set();
// Qué tipo de frase pide cada modo
function poolFor(game) {
  const r = crypto.randomInt(100);
  // Sobre todo escenas normales (lo gracioso es cómo se dibujan); alguna loca de vez en cuando
  if (game.mode === "vote") return r < 45 ? FRASES.bonitas : r < 82 ? FRASES.cotidianas : FRASES.graciosas; // votación: que luzca
  if (game.mode === "duo") return r < 45 ? FRASES.sencillas : r < 87 ? FRASES.cotidianas : FRASES.graciosas; // dúo: que se pueda acertar
  if (game.variant === "extreme") return FRASES.sencillas; // con limitaciones: cosas simples
  return r < 55 ? FRASES.cotidianas : r < 80 ? FRASES.bonitas : FRASES.graciosas; // clásico
}
function freshPhrase(game) {
  let f = null;
  for (let i = 0; i < 40 && !f; i++) {
    const c = pick(poolFor(game));
    if (!game.usedPhrases.has(c) && !recentSet.has(c)) f = c;
  }
  if (!f) f = pick(poolFor(game));
  game.usedPhrases.add(f);
  recentPhrases.push(f);
  recentSet.add(f);
  if (recentPhrases.length > RECENT_MAX) recentSet.delete(recentPhrases.shift());
  return f;
}

function currentStepType(game) {
  if (game.mode === "chain") return typeForChainStep(game.step, game.variant);
  if (game.mode === "vote") return game.stage;
  return game.duoStage;
}
/** Dibujos que puede puntuar un jugador: los de los demás que no están en blanco */
function votableFor(game, playerId) {
  const list = game.drawings[game.round] || [];
  return (game.voteOrder[game.round] || []).filter((k) => list[k] && list[k].image && !inDrawing(list[k], playerId));
}
/** ¿Participó este jugador en ese dibujo? (por parejas, todo el equipo) */
function inDrawing(d, playerId) {
  return d.team ? d.team.includes(playerId) : d.by === playerId;
}
/** Parejas de la ronda: se busca el reparto que menos repite compañeros (si son impares, un trío) */
function makeTeams(game) {
  const ids = game.order.slice();
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const split = (list) => {
    if (list.length === 3) return [[list[0], list[1]], [list[2]]]; // con tres: una pareja contra uno solo
    const teams = [];
    for (let i = 0; i + 1 < list.length; i += 2) teams.push([list[i], list[i + 1]]);
    if (list.length % 2) teams[teams.length - 1].push(list[list.length - 1]);
    return teams;
  };
  let best = null;
  let bestCost = Infinity;
  for (let t = 0; t < 80; t++) {
    const teams = split(shuffle(ids));
    let cost = 0;
    for (const team of teams) for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) cost += (game.partnerCount.get(key(team[i], team[j])) || 0) ** 2;
    if (cost < bestCost) {
      best = teams;
      bestCost = cost;
    }
  }
  for (const team of best) for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
    const k = key(team[i], team[j]);
    game.partnerCount.set(k, (game.partnerCount.get(k) || 0) + 1);
  }
  game.teams[game.round] = best;
}
function teamIndexOf(game, playerId) {
  const teams = game.teams && game.teams[game.round];
  return teams ? teams.findIndex((t) => t.includes(playerId)) : -1;
}
/** Reparto de retratos: una vuelta al azar, así nadie se dibuja a sí mismo y a todos les retratan */
function assignTargets(game) {
  const ring = shuffle(game.order);
  const t = {};
  ring.forEach((id, i) => (t[id] = ring[(i + 1) % ring.length]));
  game.targets[game.round] = t;
}

function beginStep(room) {
  const game = room.game;
  clearTimeout(room.stepTimer);
  game.submissions = new Map();
  game.stepType = currentStepType(game);
  game.seq = (game.seq || 0) + 1;
  if ((game.mode === "duo" && game.duoStage === "result") || (game.mode === "vote" && game.stage === "result")) {
    game.deadline = null;
    return;
  }
  if (game.mode === "vote" && game.kind === "pairs" && game.stage === "write") {
    makeTeams(game);
    const alive = game.order.filter((id) => !room.players.get(id)?.left);
    const pool = alive.length ? alive : game.order;
    game.choosers[game.round] = pool[game.round % pool.length];
    game.phrases[game.round] = null;
  }
  if (game.mode === "vote" && game.kind === "pairs" && game.stage === "draw") {
    game.logs = game.teams[game.round].map(() => []);
    game.logSeen = [];
  }
  if (game.mode === "vote" && game.stage === "draw" && game.kind !== "pairs") {
    if (game.kind === "stars") game.phrases[game.round] = freshPhrase(game);
    else if (game.kind === "extreme") {
      game.phrases[game.round] = "Dibujo extremo";
      const ex = {};
      for (const id of game.order) ex[id] = { phrase: freshPhrase(game), rule: pick(RULES) };
      game.extras[game.round] = ex;
    } else {
      game.phrases[game.round] = "Retratos";
      assignTargets(game);
    }
  }
  if (game.mode === "duo" && game.duoStage === "draw") {
    game.secrets = new Map();
    for (const id of game.order) game.secrets.set(id, { phrase: freshPhrase(game), rerolls: 2 });
  }
  const t = timesFor(room.settings);
  game.viewUntil = null;
  if (game.mode === "chain" && game.variant === "extreme" && game.stepType === "draw" && !game.stepRules[game.step]) {
    // Una limitación al azar para esta vuelta (si se puede, distinta de la anterior)
    const prevRule = game.stepRules[game.step - 2];
    const opts = RULES.filter((r) => r !== prevRule);
    game.stepRules[game.step] = pick(opts.length ? opts : RULES);
  }
  if (game.mode === "chain" && game.variant === "degrade" && game.stepType === "draw") {
    // Tiempos fijos (son la gracia del modo); desde el segundo dibujo, primero 10 s para mirar
    const sched = DEGRADE_SCHEDULES[game.steps] || DEGRADE_SCHEDULES[4];
    const secs = sched[Math.min(game.step, sched.length - 1)];
    const view = game.step >= 1 ? DEGRADE_VIEW_MS : 0;
    if (view) game.viewUntil = Date.now() + view;
    game.copySeconds = secs;
    game.deadline = Date.now() + view + secs * 1000;
  } else game.deadline = t ? Date.now() + t[game.stepType] * 1000 : null;
  game.stepStartedAt = Date.now();
  if (game.deadline) {
    armTimer(room);
  }
  for (const id of game.order) {
    const p = room.players.get(id);
    if (p && p.left) game.submissions.set(id, { content: null, done: true });
    // Sin dibujos que puntuar (todos los demás en blanco): no hay nada que hacer
    else if (game.mode === "vote" && game.stage === "vote" && !votableFor(game, id).length) game.submissions.set(id, { content: {}, done: true });
    // Por parejas: mientras uno elige la frase, los demás esperan
    else if (game.mode === "vote" && game.stage === "write" && id !== game.choosers[game.round]) game.submissions.set(id, { content: null, done: true });
  }
  if (game.mode === "vote" && game.kind === "pairs" && game.stage === "draw") scheduleBotScribbles(room);
  checkPause(room);
  scheduleBots(room);
  maybeFinish(room);
}

function armTimer(room) {
  const game = room.game;
  clearTimeout(room.stepTimer);
  if (!game || !game.deadline || game.paused) return;
  room.stepTimer = setTimeout(() => {
    if (room.game === game && !game.paused) finishStep(room);
  }, Math.max(0, game.deadline - Date.now()) + GRACE_MS);
}

/** Jugadores que siguen en la partida y conectados */
function activeCount(room) {
  const g = room.game;
  return g ? g.order.filter((id) => {
    const p = room.players.get(id);
    return p && p.connected && !p.left;
  }).length : 0;
}

/** Con menos de 2 personas presentes no tiene sentido seguir: pausa */
function checkPause(room) {
  const g = room.game;
  if (!g || room.phase !== "playing") return;
  const shouldPause = activeCount(room) < 2;
  if (shouldPause && !g.paused) {
    g.paused = true;
    g.remaining = g.deadline ? Math.max(0, g.deadline - Date.now()) : null;
    clearTimeout(room.stepTimer);
  } else if (!shouldPause && g.paused) {
    g.paused = false;
    if (g.remaining != null) g.deadline = Date.now() + Math.max(g.remaining, 20000);
    armTimer(room);
  }
}

/** Libro (historia) en el que trabaja el jugador en el paso actual del modo cadena */
function chainBookIndex(game, playerIdx) {
  const n = game.order.length;
  return (((playerIdx - game.step) % n) + n) % n;
}

function taskFor(room, playerId) {
  const game = room.game;
  if (!game || room.phase !== "playing") return null;
  const idx = game.order.indexOf(playerId);
  if (idx < 0) return null;
  const sub = game.submissions.get(playerId);
  const base = {
    type: game.stepType,
    deadline: game.deadline,
    submitted: !!(sub && sub.done),
    stepKey: stepKeyOf(game),
  };
  if (game.mode === "chain") {
    base.stepNumber = game.step + 1;
    base.totalSteps = game.steps;
    base.variant = game.variant;
    if (game.variant === "degrade") base.seconds = game.copySeconds;
    if (game.variant === "triptych") base.part = TRIPTYCH_PARTS[game.step];
    if (game.variant === "extreme" && game.stepType === "draw") base.rule = game.stepRules[game.step];
    // Al escribir la frase: con qué limitación se va a dibujar
    if (game.variant === "extreme" && game.stepType === "write") base.nextRule = game.stepRules[game.step + 1];
    if (game.step > 0) {
      const book = game.books[chainBookIndex(game, idx)];
      const prev = book.entries[game.step - 1];
      // Sin autor: quién lo hizo se descubre al final
      base.prompt = { kind: prev.type === "draw" ? "image" : "text", value: prev.content, by: null };
      if (game.variant === "degrade" && game.viewUntil) base.viewUntil = game.viewUntil;
    }
    return base;
  }
  if (game.mode === "vote") {
    base.round = game.round + 1;
    base.rounds = game.rounds;
    base.phrase = game.phrases[game.round];
    base.kind = game.kind;
    if (game.kind === "pairs") {
      base.tiebreak = game.round >= game.rounds - game.tiebreaks && game.tiebreaks > 0;
      const ti = teamIndexOf(game, playerId);
      const team = ti >= 0 ? game.teams[game.round][ti] : [];
      base.partners = team.filter((id) => id !== playerId).map((id) => who(room, id));
      if (game.stage === "write") {
        const ch = game.choosers[game.round];
        base.chooser = who(room, ch);
        base.isChooser = ch === playerId;
      }
    }
    if (game.stage === "draw") {
      if (game.kind === "stars" || game.kind === "pairs") base.secret = base.phrase;
      else if (game.kind === "extreme") {
        const ex = game.extras[game.round][playerId];
        base.secret = ex.phrase;
        base.rule = ex.rule;
      } else {
        const target = who(room, game.targets[game.round][playerId]);
        base.portraitOf = target;
        base.secret = "Retrata a " + target.name;
      }
      base.rerolls = 0;
    } else if (game.stage === "vote") {
      const list = game.drawings[game.round];
      // Sin autor: se descubre en el resultado de la ronda
      // Retratos: se dice a quién retrata (no quién lo dibujó). Extremo: la limitación, pero no la frase (hay que adivinarla)
      base.items = votableFor(game, playerId).map((k) => ({ k, image: list[k].image, target: list[k].target ? who(room, list[k].target) : null, rule: list[k].rule }));
    }
    return base;
  }
  // dúo
  base.round = game.round + 1;
  base.rounds = game.rounds;
  if (game.duoStage === "draw") {
    const s = game.secrets.get(playerId);
    base.secret = s.phrase;
    base.rerolls = s.rerolls;
  } else if (game.duoStage === "guess") {
    const other = game.order[1 - idx];
    const card = game.cards[game.round].find((c) => c.drawer === other);
    base.prompt = { kind: "image", value: card.image, by: null };
  }
  return base;
}

function submit(room, playerId, content) {
  const game = room.game;
  if (!game || room.phase !== "playing" || !game.order.includes(playerId)) return;
  if (game.stepType === "result") return;
  let value = null;
  if (game.stepType === "vote") {
    const allowed = new Set(votableFor(game, playerId));
    value = {};
    if (content && typeof content === "object") {
      for (const [k, v] of Object.entries(content)) {
        const key = Number(k);
        if (!allowed.has(key)) continue;
        if (game.kind === "extreme") {
          const t = cleanText(v, 60);
          if (t) value[key] = t;
          continue;
        }
        const stars = Number(v);
        if (Number.isInteger(stars) && stars >= 1 && stars <= 5) value[key] = stars;
      }
    }
  } else if (game.stepType === "draw") {
    value = isImage(content) ? storeImage(room, content) : null;
  } else {
    value = cleanText(content);
  }
  game.submissions.set(playerId, { content: value, done: true, at: Date.now() });
  maybeFinish(room);
}

function maybeFinish(room) {
  const game = room.game;
  if (!game || game.stepType === "result") return;
  const allDone = game.order.every((id) => {
    const s = game.submissions.get(id);
    return s && s.done;
  });
  if (allDone) finishStep(room);
  else broadcast(room);
}

/** Clave del paso actual (la misma que recibe cada móvil) */
function stepKeyOf(game) {
  return `${game.mode}-${game.mode === "chain" ? game.step : game.round + "-" + (game.mode === "vote" ? game.stage : game.duoStage)}`;
}
/** Un dibujo que llega tarde (conexión lenta): si en su sitio quedó un lienzo en blanco, se pone */
function lateDrawing(room, playerId, stepKey, content) {
  const game = room.game;
  const last = game && game.lastDraw;
  if (!last || last.key !== stepKey || Date.now() - last.at > LATE_DRAWING_MS || !isImage(content)) return false;
  content = storeImage(room, content);
  let spot = null;
  if (game.mode === "chain") {
    const book = game.books.find((b) => b.entries[last.step] && b.entries[last.step].by === playerId);
    spot = book && book.entries[last.step];
    if (spot && !spot.content) spot.content = content;
    else spot = null;
  } else if (game.mode === "vote") {
    spot = (game.drawings[last.round] || []).find((d) => inDrawing(d, playerId) && !d.image);
    if (spot) spot.image = content;
  } else if (game.mode === "duo") {
    spot = (game.cards[last.round] || []).find((c) => c.drawer === playerId && !c.image);
    if (spot) spot.image = content;
  }
  if (!spot) return false;
  broadcast(room);
  return true;
}

function finishStep(room) {
  const game = room.game;
  if (!game || room.phase !== "playing" || game.stepType === "result") return;
  clearTimeout(room.stepTimer);
  if (game.stepType === "draw") game.lastDraw = { key: stepKeyOf(game), at: Date.now(), step: game.step, round: game.round };
  const contentOf = (id) => {
    const s = game.submissions.get(id);
    return s ? s.content : null;
  };

  if (game.mode === "chain") {
    game.order.forEach((id, idx) => {
      const book = game.books[chainBookIndex(game, idx)];
      let content = contentOf(id);
      if (game.stepType === "write" && !content) content = pick(poolFor(game));
      if (game.stepType === "guess" && !content) content = "🤐 Se quedó sin palabras";
      const meta = game.submissions.get(id)?.meta;
      book.entries[game.step] = { type: game.stepType, content, by: id };
      if (game.stepType === "draw" && game.stepRules && game.stepRules[game.step]) book.entries[game.step].rule = game.stepRules[game.step];
      if (meta) book.entries[game.step].botKey = meta;
    });
    game.step++;
    if (game.step >= game.steps) return startReveal(room);
    beginStep(room);
    return broadcast(room);
  }

  if (game.mode === "vote") {
    if (game.stage === "write") {
      // Por parejas: la frase que eligió quien le tocaba (o una al azar si no escribió nada)
      const ch = game.choosers[game.round];
      const f = contentOf(ch);
      game.phrases[game.round] = f || freshPhrase(game);
      game.stage = "draw";
    } else if (game.stage === "draw" && game.kind === "pairs") {
      // Un dibujo por equipo: el último que se envió (el más completo)
      game.drawings[game.round] = game.teams[game.round].map((team) => {
        let image = null;
        let at = -1;
        for (const id of team) {
          const s = game.submissions.get(id);
          if (s && s.content && (s.at || 0) > at) {
            image = s.content;
            at = s.at || 0;
          }
        }
        return { by: team[0], team: team.slice(), image, votes: {}, points: 0 };
      });
      game.voteOrder[game.round] = shuffle(game.drawings[game.round].map((_, k) => k));
      game.logs = [];
      game.stage = "vote";
    } else if (game.stage === "draw") {
      const targets = game.targets[game.round] || {};
      const ex = (game.extras && game.extras[game.round]) || {};
      game.drawings[game.round] = game.order.map((id) => ({ by: id, target: targets[id] || null, phrase: ex[id] ? ex[id].phrase : null, rule: ex[id] ? ex[id].rule : null, image: contentOf(id), votes: {}, points: 0 }));
      game.voteOrder[game.round] = shuffle(game.order.map((_, k) => k));
      game.stage = "vote";
    } else if (game.stage === "vote") {
      const list = game.drawings[game.round];
      for (const voter of game.order) {
        const v = contentOf(voter) || {};
        for (const [k, val] of Object.entries(v)) {
          const d = list[Number(k)];
          if (!d || inDrawing(d, voter)) continue;
          d.votes[voter] = val;
          if (game.kind === "extreme") {
            // Acertar qué es: puntos para quien adivina y para quien lo dibujó (3 acierto, 1 casi)
            const pts = scoreGuess(d.phrase, val);
            d.guesses = d.guesses || [];
            d.guesses.push({ by: voter, text: val, pts });
            d.points += pts;
            game.totals.set(d.by, (game.totals.get(d.by) || 0) + pts);
            game.totals.set(voter, (game.totals.get(voter) || 0) + pts);
            continue;
          }
          if (game.kind === "pairs") continue; // se reparte abajo, con la media
          d.points += val;
          game.totals.set(d.by, (game.totals.get(d.by) || 0) + val);
        }
      }
      if (game.kind === "pairs") {
        // Media de estrellas (así un trío y una pareja compiten igual); cada miembro se la suma
        for (const d of list) {
          const vals = Object.values(d.votes);
          d.points = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
          for (const id of d.team) game.totals.set(id, Math.round(((game.totals.get(id) || 0) + d.points) * 10) / 10);
        }
      }
      game.stage = "result";
    }
    beginStep(room);
    return broadcast(room);
  }

  // dúo
  if (game.duoStage === "draw") {
    game.cards[game.round] = game.order.map((id) => ({
      drawer: id,
      phrase: game.secrets.get(id).phrase,
      image: contentOf(id),
      guesser: game.order.find((o) => o !== id),
      guess: "",
      points: 0,
      approved: false,
    }));
    game.duoStage = "guess";
  } else if (game.duoStage === "guess") {
    for (const card of game.cards[game.round]) {
      card.guess = contentOf(card.guesser) || "";
      card.points = card.image ? scoreGuess(card.phrase, card.guess) : 0;
      game.teamScore += card.points;
    }
    game.duoStage = "result";
  }
  beginStep(room);
  broadcast(room);
}

function duoNext(room) {
  const game = room.game;
  if (!game || game.mode !== "duo" || game.duoStage !== "result") return;
  game.round++;
  if (game.round >= game.rounds) {
    room.phase = "end";
    game.phase = "end";
    broadcast(room);
    sendGallery(room);
    return;
  }
  game.duoStage = "draw";
  beginStep(room);
  broadcast(room);
}

function duoApprove(room, playerId, drawerId) {
  // El que dibujó puede dar por buena una respuesta que la máquina no reconoció
  const game = room.game;
  if (!game || game.mode !== "duo" || game.duoStage !== "result") return;
  if (playerId !== drawerId) return;
  const card = game.cards[game.round].find((c) => c.drawer === drawerId);
  if (!card || card.points === 3 || !card.guess) return;
  game.teamScore += 3 - card.points;
  card.points = 3;
  card.approved = true;
  broadcast(room);
}

function voteNext(room) {
  const game = room.game;
  if (!game || game.mode !== "vote" || game.stage !== "result" || room.phase !== "playing") return;
  game.round++;
  if (game.round >= game.rounds && game.kind === "pairs" && game.tiebreaks < 2) {
    // Empate arriba: una ronda más de desempate (como mucho dos)
    const rk = voteRanking(room);
    if (rk.length > 1 && rk[0].points === rk[1].points) {
      game.tiebreaks++;
      game.rounds++;
    }
  }
  if (game.round >= game.rounds) {
    room.phase = "end";
    game.phase = "end";
    broadcast(room);
    sendGallery(room);
    return;
  }
  game.stage = game.kind === "pairs" ? "write" : "draw";
  beginStep(room);
  broadcast(room);
}

/** Resultado de una ronda de votación, de más a menos estrellas, ya con autores */
function voteRound(room, r) {
  const game = room.game;
  const list = game.drawings[r] || [];
  return {
    phrase: game.phrases[r],
    kind: game.kind,
    items: list
      .map((d) => ({
        by: d.team ? teamWho(room, d.team) : who(room, d.by),
        target: d.target ? who(room, d.target) : null,
        phrase: d.phrase,
        rule: d.rule,
        image: d.image,
        points: d.points,
        votes: Object.keys(d.votes).length,
        guesses: (d.guesses || []).map((g) => ({ by: who(room, g.by), text: g.text, pts: g.pts })),
      }))
      .sort((a, b) => b.points - a.points),
  };
}
/** Clasificación general; los empates comparten puesto */
function voteRanking(room) {
  const game = room.game;
  const rows = game.order.map((id) => ({ ...who(room, id), id, points: game.totals.get(id) || 0 })).sort((a, b) => b.points - a.points);
  rows.forEach((row, i) => (row.place = i > 0 && rows[i - 1].points === row.points ? rows[i - 1].place : i + 1));
  return rows;
}

function startReveal(room) {
  const game = room.game;
  room.phase = "reveal";
  game.phase = "reveal";
  game.reveal = { book: 0, entry: 0 };
  clearTimeout(room.stepTimer);
  broadcast(room);
}

function revealStep(room, dir) {
  const game = room.game;
  if (!game || room.phase !== "reveal") return;
  const r = game.reveal;
  const last = game.steps - 1;
  if (dir > 0) {
    if (r.entry < last) r.entry++;
    else if (r.book < game.books.length - 1) {
      r.book++;
      r.entry = 0;
    } else {
      room.phase = "end";
      game.phase = "end";
      broadcast(room);
      sendGallery(room);
      return;
    }
  } else if (dir < 0) {
    if (r.entry > 0) r.entry--;
    else if (r.book > 0) {
      r.book--;
      r.entry = last;
    }
  }
  broadcast(room);
}

function publicEntry(room, e) {
  const by = room.players.get(e.by);
  return { type: e.type, content: e.content, rule: e.rule || null, by: by ? { name: by.name, emoji: faceRef(room, by.emoji) } : null };
}
/** Un equipo como si fuera una persona: «Ana y Luis» (con la carita del primero) */
function teamWho(room, ids) {
  const names = ids.map((id) => who(room, id).name);
  const name = names.length > 1 ? names.slice(0, -1).join(", ") + " y " + names[names.length - 1] : names[0] || "?";
  return { name, emoji: who(room, ids[0]).emoji };
}
function who(room, id) {
  const p = room.players.get(id);
  return p ? { name: p.name, emoji: faceRef(room, p.emoji) } : { name: "?", emoji: "❔" };
}

function galleryData(room) {
  const game = room.game;
  if (!game) return null;
  if (game.mode === "chain") {
    return {
      mode: "chain",
      variant: game.variant,
      books: game.books.map((b) => ({ owner: who(room, b.owner), entries: b.entries.map((e) => publicEntry(room, e)) })),
    };
  }
  if (game.mode === "vote") {
    return { mode: "vote", kind: game.kind, rounds: game.drawings.map((_, r) => voteRound(room, r)), ranking: voteRanking(room) };
  }
  return {
    mode: "duo",
    teamScore: game.teamScore,
    maxScore: game.rounds * 6,
    rounds: game.cards.map((cards) => cards.map((c) => duoCard(room, c))),
  };
}
function duoCard(room, c) {
  return { drawer: who(room, c.drawer), drawerId: c.drawer, phrase: c.phrase, image: c.image, guesser: who(room, c.guesser), guess: c.guess, points: c.points, approved: c.approved };
}
function sendGallery(room, onlySocket) {
  const data = galleryData(room);
  if (onlySocket) onlySocket.emit("gallery", data);
  else io.to(room.code).emit("gallery", data);
}

/** Termina antes de tiempo: se enseña lo que esté completo */
function endGameEarly(room) {
  const game = room.game;
  clearTimeout(room.stepTimer);
  if (game.mode === "chain") {
    const done = game.step; // pasos completos
    if (done < 2) return backToLobby(room);
    game.steps = done;
    for (const b of game.books) b.entries = b.entries.slice(0, done);
    return startReveal(room);
  }
  if (game.mode === "vote") {
    const done = game.stage === "result" ? game.round + 1 : game.round;
    if (done < 1) return backToLobby(room);
    game.rounds = done;
    game.drawings = game.drawings.slice(0, done);
    game.tiebreaks = 0;
    room.phase = "end";
    game.phase = "end";
    broadcast(room);
    return sendGallery(room);
  }
  const done = game.duoStage === "result" ? game.round + 1 : game.round;
  if (done < 1) return backToLobby(room);
  game.rounds = done;
  game.cards = game.cards.slice(0, done);
  room.phase = "end";
  game.phase = "end";
  broadcast(room);
  sendGallery(room);
}

function backToLobby(room) {
  clearTimeout(room.stepTimer);
  // Se borran todos los dibujos y frases de la partida
  room.game = null;
  room.phase = "lobby";
  room.images = new Map(); // los dibujos de la partida ya no hacen falta
  room.faceIds = new Map();
  for (const [id, p] of room.players) {
    if (p.left || !p.connected) {
      clearTimeout(p.dropTimer);
      room.players.delete(id);
    }
  }
  ensureHost(room);
  broadcast(room);
  // Se abre la puerta: quien esperaba entra ahora (su móvil vuelve a llamar con su token)
  for (const w of room.waiting.values()) {
    if (w.socketId) io.to(w.socketId).emit("knock", { open: true });
    else room.waiting.delete(w.id);
  }
}
function hostName(room) {
  const h = room.players.get(room.hostId);
  return h ? h.name : "";
}

// ---------- estado que ve cada jugador ----------
function stateFor(room, playerId) {
  const game = room.game;
  const players = (game ? game.order.map((id) => room.players.get(id)) : [...room.players.values()].filter((p) => !p.left)).filter(Boolean);
  const st = {
    now: Date.now(),
    code: room.code,
    you: playerId,
    hostId: room.hostId,
    phase: room.phase,
    settings: room.settings,
    // quién llama a la puerta (solo lo ve el anfitrión) y cuántos entrarán en la próxima partida
    requests: playerId === room.hostId ? [...room.waiting.values()].filter((w) => !w.approved).map((w) => ({ id: w.id, name: w.name, emoji: w.emoji })) : [],
    incoming: [...room.waiting.values()].filter((w) => w.approved).map((w) => w.name),
    mode: game ? game.mode : VOTE_MODES.includes(room.settings.mode) ? "vote" : CHAIN_MODES.includes(room.settings.mode) || players.length !== 2 ? "chain" : "duo",
    chainSteps: chainLength(Math.max(players.length, 3)),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: faceRef(room, p.emoji),
      connected: p.connected,
      left: p.left,
      bot: !!p.bot,
      done: !!(game && room.phase === "playing" && game.submissions.get(p.id)?.done),
    })),
    maxPlayers: MAX_PLAYERS,
    practice: !!room.practice,
  };
  if (!game) return st;
  st.mode = game.mode;
  if (game.mode === "chain") st.variant = game.variant;
  if (room.phase === "playing") {
    st.task = taskFor(room, playerId);
    if (game.paused) {
      st.paused = {
        away: game.order
          .map((id) => room.players.get(id))
          .filter((p) => p && (!p.connected || p.left))
          .map((p) => ({ name: p.name, emoji: faceRef(room, p.emoji), left: !!p.left })),
      };
    }
    if (game.mode === "vote" && game.stage === "result") {
      st.voteResult = { round: game.round + 1, rounds: game.rounds, ...voteRound(room, game.round) };
      if (game.kind === "pairs") st.voteResult.ranking = voteRanking(room);
    }
    if (game.mode === "duo" && game.duoStage === "result") {
      st.result = {
        round: game.round + 1,
        rounds: game.rounds,
        teamScore: game.teamScore,
        cards: game.cards[game.round].map((c) => duoCard(room, c)),
      };
    }
  }
  if (room.phase === "reveal") {
    const r = game.reveal;
    const book = game.books[r.book];
    st.reveal = {
      book: r.book,
      totalBooks: game.books.length,
      entry: r.entry,
      totalEntries: game.steps,
      owner: who(room, book.owner),
      entries: book.entries.slice(0, r.entry + 1).map((e) => publicEntry(room, e)),
    };
  }
  if (room.phase === "end" && game.mode === "vote") st.ranking = voteRanking(room);
  if (game.mode === "vote") st.kind = game.kind;
  if (room.phase === "end" && game.mode === "duo") {
    st.teamScore = game.teamScore;
    st.maxScore = game.rounds * 6;
  }
  return st;
}

function broadcast(room) {
  touchRoom(room);
  for (const p of room.players.values()) {
    if (p.connected && p.socketId) io.to(p.socketId).emit("state", stateFor(room, p.id));
  }
}

// ---------- conexiones ----------
io.on("connection", (socket) => {
  socket.emit("version", BOOT);
  let room = null;
  let player = null;
  let knock = null; // si este móvil está esperando a la puerta de una sala

  function attach(r, p) {
    room = r;
    player = p;
    clearTimeout(p.dropTimer);
    if (p.socketId && p.socketId !== socket.id) {
      const old = io.sockets.sockets.get(p.socketId);
      if (old) old.emit("replaced");
    }
    p.socketId = socket.id;
    p.connected = true;
    p.droppedAt = 0;
    socket.join(r.code);
    ensureHost(r);
    checkPause(r);
  }

  function newRoom() {
    const r = {
      code: newCode(),
      players: new Map(),
      hostId: null,
      phase: "lobby",
      settings: { time: 60, duoRounds: 3, mode: "telefono", rule: "mix" },
      game: null,
      waiting: new Map(), // quienes llaman a la puerta con la partida empezada (entran en la siguiente)
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rooms.set(r.code, r);
    return r;
  }

  socket.on("create", (data, ack) => {
    if (typeof ack !== "function") return;
    const r = newRoom();
    const p = makePlayer(data?.name, data?.emoji);
    r.players.set(p.id, p);
    r.hostId = p.id;
    attach(r, p);
    ack({ ok: true, code: r.code, playerId: p.id, token: p.token });
    broadcast(r);
  });

  socket.on("join", (data, ack) => {
    if (typeof ack !== "function") return;
    // Sala de pruebas: cada vez se crea una sala nueva con 3 robots que juegan solos
    if (String(data?.code || "").toUpperCase().trim() === PRACTICE_CODE && !data?.rejoinOnly) {
      const r = newRoom();
      r.practice = true;
      const p = makePlayer(data?.name, data?.emoji);
      r.players.set(p.id, p);
      r.hostId = p.id;
      addBots(r);
      attach(r, p);
      ack({ ok: true, code: r.code, playerId: p.id, token: p.token });
      return broadcast(r);
    }
    const r = getRoom(data?.code);
    if (!r) return ack({ ok: false, error: "No existe ninguna sala con ese código. Revisa las letras." });
    // ¿Vuelve alguien que ya estaba?
    const token = String(data?.token || "");
    const back = token && [...r.players.values()].find((p) => p.token === token && !p.left);
    if (back) {
      attach(r, back);
      ack({ ok: true, code: r.code, playerId: back.id, token: back.token });
      broadcast(r);
      if (r.phase === "end") sendGallery(r, socket);
      return;
    }
    // Vuelve alguien con el mismo nombre (otro móvil, o se salió sin querer): recupera su sitio
    const wanted = cleanName(data?.name).toLocaleLowerCase("es");
    const sameName = data?.name && [...r.players.values()].find((p) => !p.bot && (!p.connected || p.left) && p.name.toLocaleLowerCase("es") === wanted);
    if (sameName) {
      if (data?.emoji) sameName.emoji = cleanEmoji(data.emoji);
      sameName.left = false;
      attach(r, sameName);
      ack({ ok: true, code: r.code, playerId: sameName.id, token: sameName.token });
      broadcast(r);
      if (r.phase === "end") sendGallery(r, socket);
      return;
    }
    // ¿Es alguien que estaba esperando a la puerta?
    const knocking = token && [...r.waiting.values()].find((w) => w.token === token);
    if (knocking && r.phase !== "lobby") {
      knocking.socketId = socket.id;
      clearTimeout(knocking.dropTimer);
      knock = { r, w: knocking };
      ack({ ok: true, waiting: true, approved: knocking.approved, code: r.code, token: knocking.token, host: hostName(r) });
      return;
    }
    if (r.phase !== "lobby") {
      if (data?.rejoinOnly) return ack({ ok: false, error: "Ya no estás en esa sala." });
      // Partida empezada: se pide permiso al anfitrión y, si dice que sí, se entra en la siguiente
      if (r.practice) return ack({ ok: false, error: "Esa partida ya ha empezado." });
      if (r.waiting.size >= 8) return ack({ ok: false, error: "La partida ya ha empezado y hay mucha gente esperando. Prueba cuando acabe." });
      const w = { id: newId(), token: newId(), name: cleanName(data?.name), emoji: cleanEmoji(data?.emoji), socketId: socket.id, approved: false };
      r.waiting.set(w.id, w);
      knock = { r, w };
      ack({ ok: true, waiting: true, approved: false, code: r.code, token: w.token, host: hostName(r) });
      return broadcast(r);
    }
    if (knocking) {
      r.waiting.delete(knocking.id);
      knock = null;
    }
    const active = [...r.players.values()].filter((p) => !p.left);
    if (active.length >= MAX_PLAYERS) return ack({ ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS}).` });
    const p = makePlayer(data?.name, data?.emoji);
    if (knocking) p.token = knocking.token; // sigue siendo la misma persona que esperaba
    r.players.set(p.id, p);
    attach(r, p);
    ack({ ok: true, code: r.code, playerId: p.id, token: p.token });
    broadcast(r);
  });

  socket.on("unknock", () => {
    if (!knock) return;
    const { r, w } = knock;
    knock = null;
    if (r.waiting.get(w.id) === w) {
      r.waiting.delete(w.id);
      broadcast(r);
    }
  });
  // El anfitrión deja entrar (en la próxima partida) o no a quien llama a la puerta
  socket.on("admit", (data) => {
    if (!isHost()) return;
    const w = room.waiting.get(String(data?.id || ""));
    if (!w) return;
    if (data?.yes) {
      w.approved = true;
      if (w.socketId) io.to(w.socketId).emit("knock", { approved: true });
    } else {
      room.waiting.delete(w.id);
      if (w.socketId) io.to(w.socketId).emit("knock", { denied: true });
    }
    broadcast(room);
  });

  const isHost = () => room && player && room.hostId === player.id;

  // Latido: el móvil pregunta «¿sigo dentro?». Si el servidor le había dado por perdido, vuelve a entrar.
  // ¿Sigue existiendo esta sala? (para no enseñar invitaciones a salas que ya cerraron)
  socket.on("roomInfo", (data, ack) => {
    if (typeof ack !== "function") return;
    const code = String(data?.code || "").toUpperCase().trim();
    ack({ exists: code === PRACTICE_CODE || rooms.has(code) });
  });
  socket.on("alive", (data, ack) => {
    if (typeof ack !== "function") return;
    if (!room || !player || !rooms.has(room.code)) return ack({ ok: false });
    if (player.socketId !== socket.id || !player.connected) {
      attach(room, player);
      broadcast(room);
    }
    ack({ ok: true, phase: room.phase });
  });

  socket.on("profile", (data) => {
    if (!room || !player || room.phase !== "lobby") return;
    player.name = cleanName(data?.name);
    player.emoji = cleanEmoji(data?.emoji);
    broadcast(room);
  });

  socket.on("settings", (data) => {
    if (!isHost() || room.phase !== "lobby") return;
    if (data && DRAW_TIMES.includes(Number(data.time)) && data.time !== undefined && data.time !== null) room.settings.time = Number(data.time);
    if (data && MODES.includes(data.mode)) room.settings.mode = data.mode;
    if (data && ["mix", ...RULES].includes(data.rule)) room.settings.rule = data.rule;
    const dr = Number(data?.duoRounds);
    if ([2, 3, 4, 5, 6].includes(dr)) room.settings.duoRounds = dr;
    broadcast(room);
  });

  socket.on("start", () => {
    if (!isHost() || room.phase !== "lobby") return;
    const active = [...room.players.values()].filter((p) => !p.left && p.connected);
    // Antes de empezar, fuera quien no está conectado
    for (const [id, p] of room.players) if (!p.connected) room.players.delete(id);
    const need = minPlayersFor(room.settings.mode);
    if (active.length < need) return socket.emit("toast", `Hacen falta al menos ${need} jugadores.`);
    startGame(room);
    broadcast(room);
  });

  socket.on("submit", (data, ack) => {
    const reply = typeof ack === "function" ? ack : () => {};
    if (!room || !player) return reply({ ok: false });
    if (data?.stepKey && room.game && data.stepKey !== taskFor(room, player.id)?.stepKey) {
      // Llegó tarde: si era un dibujo, se aprovecha
      return reply({ ok: lateDrawing(room, player.id, data.stepKey, data?.content), late: true });
    }
    submit(room, player.id, data?.content);
    reply({ ok: true });
  });

  // Por parejas: trazos en directo y, al volver, todo lo que lleva pintado el equipo
  socket.on("pairOps", (data) => {
    const game = room?.game;
    if (!game || room.phase !== "playing" || game.kind !== "pairs" || game.stage !== "draw") return;
    if (data?.key !== stepKeyOf(game)) return;
    const bid = typeof data.bid === "string" && data.bid.length <= 40 ? data.bid : null;
    relayOps(room, player.id, cleanOps(data.ops), bid);
  });
  socket.on("pairSync", (data, ack) => {
    if (typeof ack !== "function") return;
    const game = room?.game;
    if (!game || room.phase !== "playing" || game.kind !== "pairs" || game.stage !== "draw") return ack({ ok: false });
    const ti = teamIndexOf(game, player.id);
    // Solo lo que le falta: desde el número que pide
    const since = Number.isInteger(data?.since) ? data.since : -1;
    const log = ti >= 0 ? game.logs[ti] || [] : [];
    ack({ ok: true, key: stepKeyOf(game), entries: log.slice(Math.max(0, since + 1)) });
  });

  socket.on("unsubmit", () => {
    if (!room || !player || !room.game || room.phase !== "playing") return;
    const s = room.game.submissions.get(player.id);
    if (s && s.done) {
      s.done = false;
      broadcast(room);
    }
  });

  socket.on("reroll", () => {
    const game = room?.game;
    if (!game || game.mode !== "duo" || game.duoStage !== "draw" || room.phase !== "playing") return;
    const s = game.secrets.get(player.id);
    if (!s || s.rerolls <= 0 || game.submissions.get(player.id)?.done) return;
    s.rerolls--;
    s.phrase = freshPhrase(game);
    broadcast(room);
  });

  socket.on("endGame", () => {
    if (!isHost() || room.phase !== "playing") return;
    endGameEarly(room);
  });

  socket.on("reveal", (dir) => {
    if (!isHost()) return;
    revealStep(room, dir === -1 ? -1 : 1);
  });

  socket.on("duoNext", () => {
    if (!room || !player) return;
    duoNext(room);
  });

  socket.on("voteNext", () => {
    if (!isHost()) return;
    voteNext(room);
  });

  socket.on("duoApprove", (drawerId) => {
    if (!room || !player) return;
    duoApprove(room, player.id, drawerId);
  });

  // El anfitrión cancela la partida en marcha y todos vuelven a la sala (mismo código)
  socket.on("cancelGame", () => {
    if (!isHost() || room.phase === "lobby") return;
    backToLobby(room);
  });
  socket.on("lobby", () => {
    if (!isHost() || (room.phase !== "end" && room.phase !== "reveal")) return;
    backToLobby(room);
  });

  socket.on("leave", () => {
    if (!room || !player) return;
    const r = room;
    const p = player;
    socket.leave(r.code);
    p.connected = false;
    p.socketId = null;
    if (r.phase === "lobby") r.players.delete(p.id);
    else {
      p.left = true;
      if (r.game && r.phase === "playing" && r.game.stepType !== "result" && !r.game.submissions.get(p.id)?.done) {
        r.game.submissions.set(p.id, { content: null, done: true });
      }

    }
    room = null;
    player = null;
    ensureHost(r);
    const humans = [...r.players.values()].filter((x) => !x.bot);
    if (humans.every((x) => x.left || !x.connected)) {
      if (humans.length === 0 || humans.every((x) => x.left)) return deleteRoom(r.code);
    }
    if (r.game && r.phase === "playing") {
      checkPause(r);
      maybeFinish(r);
    }
    broadcast(r);
  });

  socket.on("disconnect", () => {
    if (knock && knock.w.socketId === socket.id) {
      const { r, w } = knock;
      w.socketId = null;
      w.dropTimer = setTimeout(() => {
        if (!w.socketId && r.waiting.get(w.id) === w) {
          r.waiting.delete(w.id);
          broadcast(r);
        }
      }, 120000);
    }
    if (!room || !player || player.socketId !== socket.id) return;
    const r = room;
    const p = player;
    p.connected = false;
    p.socketId = null;
    p.droppedAt = Date.now();
    checkPause(r);
    if (r.phase === "lobby") {
      p.dropTimer = setTimeout(() => {
        if (!p.connected && r.phase === "lobby" && rooms.get(r.code) === r) {
          r.players.delete(p.id);
          ensureHost(r);
          broadcast(r);
        }
      }, LOBBY_DROP_MS);
    }
    if (r.hostId === p.id) {
      setTimeout(() => {
        if (!p.connected && rooms.get(r.code) === r) {
          ensureHost(r);
          broadcast(r);
        }
      }, HOST_HANDOVER_MS);
    }
    broadcast(r);
  });
});

// Con 3 o más, quien lleva más de un minuto desconectado no frena a los demás
const AUTO_SKIP_MS = 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    const g = r.game;
    if (!g || r.phase !== "playing" || g.stepType === "result" || g.paused) continue;
    let changed = false;
    for (const id of g.order) {
      const p = r.players.get(id);
      if (!p || p.connected || g.submissions.get(id)?.done) continue;
      if (now - Math.max(p.droppedAt || 0, g.stepStartedAt || 0) > AUTO_SKIP_MS) {
        g.submissions.set(id, { content: null, done: true });
        changed = true;
      }
    }
    if (changed) maybeFinish(r);
  }
}, 5000).unref();

// Barrido de seguridad: ninguna sala vive más de 8 horas
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (now - r.createdAt > ROOM_MAX_AGE_MS) {
      io.to(r.code).emit("closed");
      deleteRoom(r.code);
    }
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => console.log(`Dibulíos escuchando en el puerto ${PORT}`));

// Mantener despierto (Render gratis se duerme tras 15 min sin visitas): solo si KEEP_AWAKE=1.
// Se visita a sí mismo por su dirección pública cada 10 minutos; cuenta como una visita normal.
if (process.env.KEEP_AWAKE === "1" && process.env.RENDER_EXTERNAL_URL) {
  setInterval(() => {
    fetch(process.env.RENDER_EXTERNAL_URL + "/salud", { cache: "no-store" }).catch(() => {});
  }, 10 * 60 * 1000).unref();
}

module.exports = { scoreGuess, chainLength };
