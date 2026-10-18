// Dibulíos: servidor de salas.
// Todo vive en memoria: no hay base de datos ni ficheros. Cuando una partida
// termina se borran sus dibujos, y la sala entera desaparece cuando ya no
// queda nadie conectado.

const path = require("path");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const FRASES = require("./public/frases.js");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 12;
const MAX_TEXT = 120;
const MAX_IMAGE = 3_000_000; // caracteres del dataURL
const ROOM_IDLE_MS = 10 * 60 * 1000; // sala vacía: se borra a los 10 min
const ROOM_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const LOBBY_DROP_MS = 90 * 1000; // en la sala de espera, quien se va 90 s sale de la lista
const HOST_HANDOVER_MS = 25 * 1000;
const GRACE_MS = 4000; // margen tras agotarse el tiempo

const TIMES = {
  rapido: { write: 40, draw: 70, guess: 30 },
  normal: { write: 60, draw: 110, guess: 45 },
  relajado: { write: 90, draw: 180, guess: 70 },
  libre: null,
};

const app = express();
app.disable("x-powered-by");
// Cada arranque tiene su versión: así los móviles nunca mezclan archivos viejos y nuevos
const fs = require("fs");
const BOOT = Date.now().toString(36);
const INDEX = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8").replace(/__V__/g, BOOT);
app.get(["/", "/index.html"], (_req, res) => {
  res.set("Cache-Control", "no-cache");
  res.type("html").send(INDEX);
});
app.use(express.static(path.join(__dirname, "public"), { maxAge: "7d", index: false }));
app.get("/salud", (_req, res) => res.send("ok"));

const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 8e6, pingTimeout: 30000 });

/** @type {Map<string, any>} */
const rooms = new Map();

// ---------- utilidades ----------
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode() {
  let c;
  do {
    c = "";
    for (let i = 0; i < 5; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  } while (rooms.has(c));
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
function cleanEmoji(s) {
  const e = String(s ?? "").trim();
  // Un solo emoji (puede ocupar varios puntos de código). Límite de seguridad.
  if (!e || e.length > 16 || /[<>&"'\s]/.test(e)) return "🙂";
  return e;
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
  return [...room.players.values()].filter((p) => p.connected);
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
  const next = [...room.players.values()].find((p) => p.connected && !p.left);
  if (next) room.hostId = next.id;
}

// ---------- partida ----------
function chainLength(n) {
  return n === 3 ? 5 : n;
}
function typeForChainStep(k) {
  if (k === 0) return "write";
  return k % 2 === 1 ? "draw" : "guess";
}

function startGame(room) {
  const order = shuffle([...room.players.values()].filter((p) => !p.left).map((p) => p.id));
  const n = order.length;
  const game = {
    mode: n === 2 ? "duo" : "chain",
    order,
    step: 0,
    stepType: null,
    deadline: null,
    submissions: new Map(), // playerId -> {content, done}
    phase: "playing",
  };
  if (game.mode === "chain") {
    game.steps = chainLength(n);
    game.books = order.map((id) => ({ owner: id, entries: [] }));
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

function freshPhrase(game) {
  const free = FRASES.filter((f) => !game.usedPhrases.has(f));
  const f = pick(free.length ? free : FRASES);
  game.usedPhrases.add(f);
  return f;
}

function currentStepType(game) {
  if (game.mode === "chain") return typeForChainStep(game.step);
  return game.duoStage;
}

function beginStep(room) {
  const game = room.game;
  clearTimeout(room.stepTimer);
  game.submissions = new Map();
  game.stepType = currentStepType(game);
  if (game.mode === "duo" && game.duoStage === "result") {
    game.deadline = null;
    return;
  }
  if (game.mode === "duo" && game.duoStage === "draw") {
    game.secrets = new Map();
    for (const id of game.order) game.secrets.set(id, { phrase: freshPhrase(game), rerolls: 2 });
  }
  const t = TIMES[room.settings.time];
  game.deadline = t ? Date.now() + t[game.stepType] * 1000 : null;
  game.stepStartedAt = Date.now();
  if (game.deadline) {
    armTimer(room);
  }
  for (const id of game.order) {
    const p = room.players.get(id);
    if (p && p.left) game.submissions.set(id, { content: null, done: true });
  }
  checkPause(room);
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
    stepKey: `${game.mode}-${game.mode === "chain" ? game.step : game.round + "-" + game.duoStage}`,
  };
  if (game.mode === "chain") {
    base.stepNumber = game.step + 1;
    base.totalSteps = game.steps;
    if (game.step > 0) {
      const book = game.books[chainBookIndex(game, idx)];
      const prev = book.entries[game.step - 1];
      // Sin autor: quién lo hizo se descubre al final
      base.prompt = { kind: prev.type === "draw" ? "image" : "text", value: prev.content, by: null };
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
  if (game.stepType === "draw") {
    value = isImage(content) ? content : null;
  } else {
    value = cleanText(content);
  }
  game.submissions.set(playerId, { content: value, done: true });
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

function finishStep(room) {
  const game = room.game;
  if (!game || room.phase !== "playing" || game.stepType === "result") return;
  clearTimeout(room.stepTimer);
  const contentOf = (id) => {
    const s = game.submissions.get(id);
    return s ? s.content : null;
  };

  if (game.mode === "chain") {
    game.order.forEach((id, idx) => {
      const book = game.books[chainBookIndex(game, idx)];
      let content = contentOf(id);
      if (game.stepType === "write" && !content) content = pick(FRASES);
      if (game.stepType === "guess" && !content) content = "🤐 Se quedó sin palabras";
      book.entries[game.step] = { type: game.stepType, content, by: id };
    });
    game.step++;
    if (game.step >= game.steps) return startReveal(room);
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
  return { type: e.type, content: e.content, by: by ? { name: by.name, emoji: by.emoji } : null };
}
function who(room, id) {
  const p = room.players.get(id);
  return p ? { name: p.name, emoji: p.emoji } : { name: "?", emoji: "❔" };
}

function galleryData(room) {
  const game = room.game;
  if (!game) return null;
  if (game.mode === "chain") {
    return {
      mode: "chain",
      books: game.books.map((b) => ({ owner: who(room, b.owner), entries: b.entries.map((e) => publicEntry(room, e)) })),
    };
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
  for (const [id, p] of room.players) {
    if (p.left || !p.connected) {
      clearTimeout(p.dropTimer);
      room.players.delete(id);
    }
  }
  ensureHost(room);
  broadcast(room);
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
    mode: game ? game.mode : players.length === 2 ? "duo" : "chain",
    chainSteps: chainLength(Math.max(players.length, 3)),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      connected: p.connected,
      left: p.left,
      done: !!(game && room.phase === "playing" && game.submissions.get(p.id)?.done),
    })),
    maxPlayers: MAX_PLAYERS,
  };
  if (!game) return st;
  st.mode = game.mode;
  if (room.phase === "playing") {
    st.task = taskFor(room, playerId);
    if (game.paused) {
      st.paused = {
        away: game.order
          .map((id) => room.players.get(id))
          .filter((p) => p && (!p.connected || p.left))
          .map((p) => ({ name: p.name, emoji: p.emoji, left: !!p.left })),
      };
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
  let room = null;
  let player = null;

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

  socket.on("create", (data, ack) => {
    if (typeof ack !== "function") return;
    const r = {
      code: newCode(),
      players: new Map(),
      hostId: null,
      phase: "lobby",
      settings: { time: "normal", duoRounds: 3 },
      game: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const p = makePlayer(data?.name, data?.emoji);
    r.players.set(p.id, p);
    r.hostId = p.id;
    rooms.set(r.code, r);
    attach(r, p);
    ack({ ok: true, code: r.code, playerId: p.id, token: p.token });
    broadcast(r);
  });

  socket.on("join", (data, ack) => {
    if (typeof ack !== "function") return;
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
    if (data?.rejoinOnly) return ack({ ok: false, error: "Ya no estás en esa sala." });
    // Desde otro móvil o pestaña: si hay una plaza libre con el mismo nombre, es esa persona
    const wanted = cleanName(data?.name).toLocaleLowerCase("es");
    const sameName = [...r.players.values()].find((p) => !p.connected && !p.left && p.name.toLocaleLowerCase("es") === wanted);
    if (sameName) {
      sameName.emoji = cleanEmoji(data?.emoji) || sameName.emoji;
      attach(r, sameName);
      ack({ ok: true, code: r.code, playerId: sameName.id, token: sameName.token });
      broadcast(r);
      if (r.phase === "end") sendGallery(r, socket);
      return;
    }
    if (r.phase !== "lobby") return ack({ ok: false, error: "La partida ya ha empezado. Si estabas jugando, escribe exactamente el mismo nombre que usaste. Si no, espera a que acabe." });
    const active = [...r.players.values()].filter((p) => !p.left);
    if (active.length >= MAX_PLAYERS) return ack({ ok: false, error: `La sala está llena (máximo ${MAX_PLAYERS}).` });
    const p = makePlayer(data?.name, data?.emoji);
    r.players.set(p.id, p);
    attach(r, p);
    ack({ ok: true, code: r.code, playerId: p.id, token: p.token });
    broadcast(r);
  });

  const isHost = () => room && player && room.hostId === player.id;

  socket.on("profile", (data) => {
    if (!room || !player || room.phase !== "lobby") return;
    player.name = cleanName(data?.name);
    player.emoji = cleanEmoji(data?.emoji);
    broadcast(room);
  });

  socket.on("settings", (data) => {
    if (!isHost() || room.phase !== "lobby") return;
    if (data && Object.hasOwn(TIMES, data.time)) room.settings.time = data.time;
    const dr = Number(data?.duoRounds);
    if ([2, 3, 4, 5, 6].includes(dr)) room.settings.duoRounds = dr;
    broadcast(room);
  });

  socket.on("start", () => {
    if (!isHost() || room.phase !== "lobby") return;
    const active = [...room.players.values()].filter((p) => !p.left && p.connected);
    // Antes de empezar, fuera quien no está conectado
    for (const [id, p] of room.players) if (!p.connected) room.players.delete(id);
    if (active.length < 2) return socket.emit("toast", "Hacen falta al menos 2 jugadores.");
    startGame(room);
    broadcast(room);
  });

  socket.on("submit", (data) => {
    if (!room || !player) return;
    if (data?.stepKey && room.game && data.stepKey !== taskFor(room, player.id)?.stepKey) return;
    submit(room, player.id, data?.content);
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

  socket.on("duoApprove", (drawerId) => {
    if (!room || !player) return;
    duoApprove(room, player.id, drawerId);
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
    if ([...r.players.values()].every((x) => x.left || !x.connected)) {
      if (r.players.size === 0 || [...r.players.values()].every((x) => x.left)) return deleteRoom(r.code);
    }
    if (r.game && r.phase === "playing") {
      checkPause(r);
      maybeFinish(r);
    }
    broadcast(r);
  });

  socket.on("disconnect", () => {
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

module.exports = { scoreGuess, chainLength };
