// Dibujos de los robots: temas (lib/art/subjects/*.js) dibujados con el kit (lib/art/kit.js),
// partes de criaturas para el Tríptico y Criaturas (lib/art/parts.js) y dibujos con limitación (Dibujo extremo).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { makeKit } = require("./art/kit.js");
const PARTS = require("./art/parts.js");
const rnd = () => crypto.randomInt(1_000_000) / 1_000_000;
const pick = (a) => a[crypto.randomInt(a.length)];
const INK = "#1f1f24";
const toUrl = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const SUBJECTS = [];
const DIR = path.join(__dirname, "art", "subjects");
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort()) {
  try {
    for (const s of require(path.join(DIR, f))) if (s && s.key && typeof s.draw === "function" && !SUBJECTS.some((x) => x.key === s.key)) SUBJECTS.push(s);
  } catch (e) {
    console.error("[botart] no se pudo cargar", f, e.message);
  }
}
const byKey = (k) => SUBJECTS.find((s) => s.key === k);
// palabras → tema (sin tildes; gana la palabra más larga que aparezca como palabra entera o inicio de palabra)
const WORDS = [];
for (const s of SUBJECTS) for (const w of s.words || []) WORDS.push([norm(w), s]);
WORDS.sort((a, b) => b[0].length - a[0].length);
const PERSON_RE = /\b(nin|abuel|senor|chica|chico|bailarin|futbolista|cocinero|medic|pintor|profesor|mago|pirata|bombero|astronauta|payaso|persona|hombre|mujer|bebe|rey|reina|princes|alguien)/;
function subjectFor(text) {
  const t = " " + norm(text).replace(/[^a-z0-9ñ]+/g, " ") + " ";
  for (const [w, s] of WORDS) if (w && (t.includes(" " + w + " ") || t.includes(" " + w))) return s;
  return PERSON_RE.test(t) ? byKey("persona") || null : null;
}
/** meta de un dibujo de robot: "clave#semilla" (la semilla repite el mismo dibujo en las copias) */
function parseMeta(m) {
  const [key, seed] = String(m || "").split("#");
  return { key, seed: seed ? Number(seed) >>> 0 : undefined };
}
const subjectByMeta = (m) => byKey(parseMeta(m).key) || null;
/** Dibuja un tema (por su clave/meta o según una frase); level 0 = original, 1..3 = copias de memoria cada vez peores */
function draw({ text, key, level = 0 } = {}) {
  const m = parseMeta(key);
  const s = (m.key && byKey(m.key)) || subjectFor(text) || pick(SUBJECTS);
  const seed = m.key === s.key && m.seed != null ? m.seed : crypto.randomInt(2 ** 31);
  let k = makeKit({ level: Math.min(3, level), seed });
  try {
    s.draw(k);
  } catch (e) {
    console.error("[botart]", s.key, e.message);
    k = makeKit({ level: 0, seed });
    byKey("gato").draw(k);
  }
  return { key: s.key + "#" + seed, name: s.name, url: toUrl(k.svg()) };
}
/** Un original para Memoria: un tema que no haya salido hace poco */
function original(not = []) {
  const skip = new Set(not.map((x) => parseMeta(x).key));
  const pool = SUBJECTS.filter((s) => !skip.has(s.key));
  const s = pick(pool.length ? pool : SUBJECTS);
  const d = draw({ key: s.key });
  return { key: s.key, name: s.name, url: d.url };
}
/** Dibujo extremo: los robots también respetan su limitación */
function drawRule(rule) {
  const out = [];
  const j = (v, a = 6) => +(v + (rnd() - 0.5) * 2 * a).toFixed(1);
  const C = ["#ff3b3b", "#ffd21f", "#2563eb", "#1f8a3a", "#ff8fb8", "#ff7a1a", "#9b5de5", "#3fc8ef"];
  const circle = (x, y, r, fill) => out.push(`<circle cx="${j(x)}" cy="${j(y)}" r="${Math.max(4, j(r, 4))}" fill="${fill || "none"}" stroke="${INK}" stroke-width="7"/>`);
  const square = (x, y, s, fill) => out.push(`<rect x="${j(x)}" y="${j(y)}" width="${s}" height="${s}" fill="${fill || "none"}" stroke="${INK}" stroke-width="7"/>`);
  if (rule === "circles") {
    const kind = crypto.randomInt(3);
    if (kind === 0) { // muñeco de nieve
      circle(300, 660, 170, "#ffffff"); circle(300, 420, 120, "#ffffff"); circle(300, 230, 85, "#ffffff");
      circle(270, 215, 10, INK); circle(330, 215, 10, INK); circle(300, 245, 14, "#ff7a1a");
      for (const y of [380, 430, 480]) circle(300, y, 12, INK);
    } else if (kind === 1) { // flor
      for (let i = 0; i < 8; i++) { const t = (i / 8) * Math.PI * 2; circle(300 + Math.cos(t) * 110, 380 + Math.sin(t) * 110, 70, pick(C)); }
      circle(300, 380, 80, "#ffd21f");
      for (let y = 520; y < 860; y += 40) circle(300, y, 18, "#1f8a3a");
    } else { // oruga
      for (let i = 0; i < 6; i++) circle(110 + i * 75, 560 + Math.sin(i) * 40, 60, pick(C));
      circle(500, 470, 75, "#9be04a"); circle(480, 450, 12, INK); circle(525, 450, 12, INK);
      circle(300, 200, 90, "#ffd21f");
    }
  } else if (rule === "squares") {
    const kind = crypto.randomInt(2);
    if (kind === 0) { // robot
      square(220, 160, 160, "#c7cad1"); square(250, 200, 35, "#3fc8ef"); square(315, 200, 35, "#3fc8ef");
      square(190, 340, 220, "#2563eb"); square(260, 400, 80, "#ffd21f");
      square(110, 360, 70, "#c7cad1"); square(420, 360, 70, "#c7cad1");
      square(210, 570, 80, "#4a4d57"); square(310, 570, 80, "#4a4d57");
    } else { // pueblo de cajas
      for (let i = 0; i < 4; i++) { const sz = 100 + crypto.randomInt(60); square(40 + i * 135, 700 - sz, sz, pick(C)); square(60 + i * 135, 720 - sz, 30, "#9fdcf7"); }
      square(430, 120, 90, "#ffd21f");
      square(-20, 700, 640, "#7ad19a");
    }
  } else {
    // Sin levantar el lápiz: una sola línea que hace una cara y sigue dando vueltas
    let d = `M ${j(80)} ${j(820)}`;
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * 2 + Math.PI / 2; pts.push([300 + Math.cos(t) * 190, 420 + Math.sin(t) * 210]); }
    pts.push([240, 360], [215, 330], [240, 300], [265, 330], [240, 360], [300, 380], [360, 360], [335, 330], [360, 300], [385, 330], [360, 360], [300, 380], [300, 470], [230, 500], [300, 560], [370, 500], [300, 470], [300, 640], [200, 760], [420, 820], [520, 700]);
    for (const [x, y] of pts) d += ` L ${j(x, 5)} ${j(y, 5)}`;
    out.push(`<path d="${d}" fill="none" stroke="${pick(["#1f1f24", "#2563eb", "#c81d25"])}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#fff"/>${out.join("")}</svg>`;
  return { key: "regla-" + rule, url: "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64") };
}
/**
 * Tríptico y Criaturas: una parte de criatura en una franja de 900x600, con las uniones siempre en el
 * mismo sitio (cuello en el centro, piernas en x≈390 y x≈510) para que encajen partes de distintos dibujos.
 * opts.skin: color de piel (para que el cuerpo y las piernas sigan a la cabeza); opts.accent: ropa.
 */
function drawPart(part, opts = {}) {
  const list = PARTS[part] || PARTS.head;
  const fn = pick(list);
  const k = makeKit({ level: 0, w: 900, h: 600 });
  const o = {};
  if (opts.skin) o.skin = opts.skin;
  if (opts.accent) o.accent = opts.accent;
  fn(k, o);
  return toUrl(k.svg());
}

module.exports = { draw, original, drawRule, drawPart, subjectFor, subjectByMeta, SUBJECTS };
