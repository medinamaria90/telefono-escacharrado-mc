// Partes de criatura para el modo Tríptico (cadáver exquisito) de los robots.
// Cada parte se dibuja en un lienzo apaisado de 900 × 600 (makeKit({ w: 900, h: 600 })).
// Uniones FIJAS (así cualquier cabeza encaja con cualquier cuerpo y cualquier par de piernas):
//   · cabeza: el cuello (x 422–478) baja hasta el borde de abajo; en la franja y 510–600 solo hay cuello.
//   · cuerpo: no se pinta nada por encima de y = 90; el cuello sigue desde y = 90 (x 422–478),
//     el torso va más o menos de y 120 a 480 y dos arranques de pierna (x 368–412 y 488–532) llegan a y = 600.
//   · piernas: nada por encima de y = 90; las piernas nacen en y = 90 en x 368–412 y 488–532.
// Fondo blanco (sin color) para que las partes de distintos jugadores casen.
//
// Cada parte es (k, opts = {}) => void. opts.skin (hex) = color de piel/pelo/escamas de la criatura
// (si un jugador pintó una cabeza verde, el cuerpo del robot lleva cuello y manos verdes);
// opts.accent (hex) = color de la ropa. Sin opts, colores al azar.
// Cada función lleva además .key (nombre) y .humanoid (true si encaja con cabezas/cuerpos de persona).
"use strict";
const { tone, INK } = require("./kit");

const NL = 422, NR = 478; // cuello
const LX = [390, 510], LHW = 22; // piernas: centros y media anchura en la unión
const SKINS = ["#f1c9a5", "#e8b48a", "#c98e62", "#8d5a3b", "#f6d5b8"];

// ---------- utilidades ----------
const rgb = (h) => { const n = parseInt(String(h).replace("#", "").slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const dist = (a, b) => { const p = rgb(a), q = rgb(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const lum = (h) => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
/** Piel: la que manden o una al azar de la lista */
const skinOf = (k, o, list = SKINS) => o.skin || k.pick(list);
/** Ropa: la de acento si la mandan; si no, una de la lista que no se confunda con la piel */
function clothOf(k, o, list, avoid) {
  if (o.accent) return o.accent;
  const s = avoid || o.skin;
  let l = s ? list.filter((c) => dist(c, s) > 120) : list;
  if (!l.length) l = list;
  return k.pick(l);
}
/** Mapea puntos con escala alrededor de un centro */
const F = (s, cx, cy, ox = 0, oy = 0) => (pts) => pts.map(([x, y]) => [cx + (x - ox) * s, cy + (y - oy) * s]);
const mir = (pts) => pts.map(([x, y]) => [900 - x, y]);

/** Recorta todo lo que se dibuje dentro para que quede por debajo de y (la franja de arriba es de otro) */
function clipBelow(k, y, fn) {
  const id = "below" + y;
  k.group(`translate(0 0)"><defs><clipPath id="${id}"><rect x="-100" y="${y}" width="1200" height="900"/></clipPath></defs></g><g clip-path="url(#${id})" transform="translate(0 0)`, fn);
}

// Las cabezas y los cuerpos se dibujan algo más grandes (ver registro abajo); las uniones (cuello y
// arranques de pierna) se dibujan siempre sin esa transformación para que caigan en su sitio exacto.
let INV = null;
const seam = (k, fn) => (INV ? k.group(INV, fn) : fn());

/** Cuello recto (x 422–478) de y0 a y1, con su sombra a la derecha y contorno solo en los lados */
function neck(k, fill, y0, y1 = 640) {
  seam(k, () => neckRaw(k, fill, y0, y1));
}
function neckRaw(k, fill, y0, y1) {
  k.path([[NL, y0], [NR, y0], [NR, y1], [NL, y1]], { fill, w: 0, smooth: false, raw: true });
  k.path([[NR - 15, y0], [NR, y0], [NR, y1], [NR - 15, y1]], { fill: tone(fill, -0.2), w: 0, smooth: false, raw: true });
  k.line([[NL, y0], [NL, y1]], 6, INK, { raw: true });
  k.line([[NR, y0], [NR, y1]], 6, INK, { raw: true });
}
/** Arranques de pierna del cuerpo: de y0 hasta el borde de abajo */
function stubs(k, fill, y0 = 430, fill2) {
  seam(k, () => LX.forEach((x, i) => {
    const f = i && fill2 ? fill2 : fill;
    k.path([[x - LHW, y0], [x + LHW, y0], [x + LHW, 640], [x - LHW, 640]], { fill: f, w: 0, smooth: false, raw: true });
    k.path([[x + LHW - 12, y0], [x + LHW, y0], [x + LHW, 640], [x + LHW - 12, 640]], { fill: tone(f, -0.2), w: 0, smooth: false, raw: true });
    k.line([[x - LHW, y0], [x - LHW, 640]], 6, INK, { raw: true });
    k.line([[x + LHW, y0], [x + LHW, 640]], 6, INK, { raw: true });
  }));
}
/** Torso estándar (hombros redondeados), y de 135 a ~475 */
function torso(k, fill, o = {}) {
  const b = o.bottom || 475, wd = o.wide || 0;
  const pts = [[330, 135], [570, 135], [612 + wd, 172], [622 + wd, 300], [606 + wd, b], [450, b + 6], [294 - wd, b], [278 - wd, 300], [288 - wd, 172]];
  k.path(pts, { fill, shade: "r", light: o.light !== false });
  return pts;
}
/** Mano: manopla con pulgar */
function hand(k, x, y, s, fill) {
  k.ellipse(x - s * 16, y - 10, 11, 16, { fill, w: 5, rot: s * 30 });
  k.circle(x, y, 27, { fill, shade: "rb" });
}
/** Brazos: tubos con mano. pose: down | up | out | wave. Devuelve las puntas */
function arms(k, sleeve, handCol, o = {}) {
  const pose = o.pose || k.pick(["down", "up", "out", "wave", "down"]);
  const w = o.w || 46;
  const ends = [];
  for (const s of [-1, 1]) {
    const p = pose === "wave" ? (s < 0 ? "up" : "down") : pose;
    const sx = 450 + s * 135, sy = 190;
    let pts;
    if (p === "down") pts = [[sx, sy], [450 + s * 210, 280], [450 + s * 240, 385]];
    else if (p === "up") pts = [[sx, sy], [450 + s * 235, 230], [450 + s * 280, 172]];
    else pts = [[sx, sy], [450 + s * 235, 220], [450 + s * 315, 260]];
    k.tube(pts, w, sleeve);
    const e = pts[2], d = pts[1];
    const len = Math.hypot(e[0] - d[0], e[1] - d[1]);
    const ux = (e[0] - d[0]) / len, uy = (e[1] - d[1]) / len;
    if (o.cuff) k.ellipse(e[0], e[1], w / 2 + 8, 14, { fill: o.cuff, w: 5, rot: (Math.atan2(uy, ux) * 180) / Math.PI + 90 });
    const hx = e[0] + ux * 22, hy = e[1] + uy * 22;
    if (o.hands !== false) hand(k, hx, hy, s, handCol);
    ends.push({ x: hx, y: hy, s, ux, uy, p });
  }
  return ends;
}

// ================= CABEZAS =================
// La cabeza va más o menos en y 40–480, centrada en x = 450. El cuello baja hasta y = 600.

function cat(k, o = {}) {
  const fur = o.skin || k.pick(["#ff9f45", "#9ca3af", "#4a4a52", "#f2e3c6", "#d9a066", "#f4f4f4"]);
  const dark = tone(fur, -0.3);
  neck(k, fur, 380);
  const f = F(1.45, 450, 262, 300, 300);
  k.path(f([[175, 300], [185, 175], [245, 235], [300, 222], [355, 235], [415, 175], [425, 300], [395, 380], [300, 410], [205, 380]]), { fill: fur, shade: "r", light: true });
  k.path(f([[198, 208], [210, 262], [242, 240]]), { fill: "#ff9eb5", w: 0 });
  k.path(f([[402, 208], [390, 262], [358, 240]]), { fill: "#ff9eb5", w: 0 });
  if (k.chance(0.6)) for (const [a, b] of [[[430, 132], [436, 172]], [[450, 128], [450, 170]], [[470, 132], [464, 172]]]) k.line([a, b], 7, dark);
  const iris = k.pick(["#2f7d32", "#d4a017", "#2563eb"]);
  k.eye(385, 262, 38, { look: [0.2, 0.1], iris });
  k.eye(515, 262, 38, { look: [0.2, 0.1], iris });
  k.path(f([[286, 334], [314, 334], [300, 352]]), { fill: "#ff7b8f", w: 5 });
  k.line(f([[300, 352], [300, 364]]), 5);
  k.arc(...f([[284, 364]])[0], 22, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  k.arc(...f([[316, 364]])[0], 22, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  for (const s of [-1, 1]) {
    k.line([[450 + s * 60, 335], [450 + s * 175, 315]], 4);
    k.line([[450 + s * 60, 350], [450 + s * 175, 358]], 4);
  }
  k.cheeks(345, 555, 335, 22);
  if (k.chance(0.4)) { // lazo
    const c = clothOf(k, o, ["#e63946", "#2563eb", "#ff8fb8", "#9b5de5"], fur);
    k.path([[560, 140], [610, 105], [615, 175]], { fill: c, w: 5 });
    k.path([[560, 140], [520, 95], [508, 165]], { fill: c, w: 5 });
    k.circle(560, 140, 14, { fill: tone(c, -0.15), w: 5 });
  }
}
cat.humanoid = false;

function dog(k, o = {}) {
  const fur = o.skin || k.pick(["#d9a066", "#f2e3c6", "#8b5a2b", "#ffffff", "#c98e62"]);
  const ear = tone(fur, -0.3);
  neck(k, fur, 380);
  k.path([[275, 250], [300, 140], [380, 85], [450, 75], [520, 85], [600, 140], [625, 250], [600, 370], [520, 440], [450, 450], [380, 440], [300, 370]], { fill: fur, shade: "r", light: true });
  if (k.chance(0.5)) k.path([[320, 180], [370, 150], [420, 190], [410, 260], [350, 270], [315, 235]], { fill: tone(fur, -0.18), w: 0 });
  // orejas caídas
  k.path([[310, 120], [235, 150], [205, 260], [225, 350], [270, 340], [300, 260], [335, 160]], { fill: ear, shade: "b" });
  k.path(mir([[310, 120], [235, 150], [205, 260], [225, 350], [270, 340], [300, 260], [335, 160]]), { fill: ear, shade: "b" });
  k.ellipse(450, 345, 100, 72, { fill: tone(fur, 0.5), shade: "b" });
  k.eye(380, 240, 32, { look: [0, 0.2], iris: "#5b3a1e" });
  k.eye(520, 240, 32, { look: [0, 0.2], iris: "#5b3a1e" });
  k.arc(380, 196, 26, 1.2 * Math.PI, 1.8 * Math.PI, 5);
  k.arc(520, 196, 26, 1.2 * Math.PI, 1.8 * Math.PI, 5);
  k.ellipse(450, 305, 34, 22, { fill: INK, w: 0, light: true });
  k.line([[450, 325], [450, 352]], 5);
  k.arc(428, 352, 22, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  k.arc(472, 352, 22, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  if (k.chance(0.7)) k.path([[438, 372], [462, 372], [468, 405], [450, 418], [432, 405]], { fill: "#ff7b8f", w: 5 });
  k.cheeks(340, 560, 320, 20);
}
dog.humanoid = false;

function frog(k, o = {}) {
  const sk = o.skin || k.pick(["#5bbf4a", "#7ccf5a", "#3fa66b", "#9be04a"]);
  neck(k, sk, 380);
  k.circle(345, 165, 70, { fill: sk, shade: "r" });
  k.circle(555, 165, 70, { fill: sk, shade: "r" });
  k.path([[250, 320], [262, 230], [340, 195], [450, 188], [560, 195], [638, 230], [650, 320], [600, 410], [450, 445], [300, 410]], { fill: sk, shade: "r", light: true });
  k.path([[300, 330], [450, 345], [600, 330], [570, 400], [450, 430], [330, 400]], { fill: tone(sk, 0.45), w: 0 });
  k.eye(345, 160, 44, { look: [0.1, 0.25], iris: k.pick([INK, "#7a4a00"]) });
  k.eye(555, 160, 44, { look: [-0.1, 0.25], iris: k.pick([INK, "#7a4a00"]) });
  k.dot(430, 255, 6); k.dot(470, 255, 6);
  k.arc(450, 205, 140, 0.25 * Math.PI, 0.75 * Math.PI, 7);
  k.cheeks(305, 595, 300, 24);
  if (k.chance(0.45)) { // corona de príncipe rana
    k.path([[405, 125], [410, 75], [430, 100], [450, 62], [470, 100], [490, 75], [495, 125]], { fill: "#ffd21f", smooth: false, w: 5, shade: "r" });
    k.dot(450, 108, 7, "#e63946");
  }
}
frog.humanoid = false;

function owl(k, o = {}) {
  const fur = o.skin || k.pick(["#a0703c", "#8b6b4a", "#b9a68f", "#7b6a8f", "#9ca3af"]);
  neck(k, fur, 380);
  k.path([[300, 160], [290, 70], [370, 125]], { fill: tone(fur, -0.15), w: 6 });
  k.path(mir([[300, 160], [290, 70], [370, 125]]), { fill: tone(fur, -0.15), w: 6 });
  k.path([[260, 270], [285, 160], [360, 108], [450, 95], [540, 108], [615, 160], [640, 270], [610, 380], [530, 440], [450, 452], [370, 440], [290, 380]], { fill: fur, shade: "r", light: true });
  const disc = tone(fur, 0.55);
  k.circle(370, 255, 88, { fill: disc, w: 5 });
  k.circle(530, 255, 88, { fill: disc, w: 5 });
  for (const x of [370, 530]) {
    k.circle(x, 255, 56, { fill: k.pick(["#ffc23d"]), w: 6 });
    k.dot(x + 4, 262, 30, INK);
    k.dot(x - 8, 248, 10, "#fff");
  }
  k.path([[428, 305], [472, 305], [450, 360]], { fill: "#ff9f1a", w: 5, shade: "r" });
  for (const [x, y] of [[400, 390], [450, 405], [500, 390]]) k.line([[x - 14, y - 8], [x, y + 4], [x + 14, y - 8]], 4, tone(fur, -0.35));
  for (const [x, y] of [[420, 150], [480, 150]]) k.line([[x - 12, y - 6], [x, y + 4], [x + 12, y - 6]], 4, tone(fur, -0.35));
  if (k.chance(0.35)) { // gafas de sabio
    k.circle(370, 255, 66, { fill: "none", w: 7 });
    k.circle(530, 255, 66, { fill: "none", w: 7 });
    k.line([[436, 250], [464, 250]], 7);
  }
}
owl.humanoid = false;

function lion(k, o = {}) {
  const fur = o.skin || k.pick(["#e8a33c", "#d9a066", "#f0b45a"]);
  const mane = clothOf(k, {}, ["#b5541c", "#8b4a1e", "#c2671d", "#7a3b12"]);
  neck(k, fur, 380);
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const t = (i / 26) * Math.PI * 2;
    const r = i % 2 ? 210 : 240;
    pts.push([450 + Math.cos(t) * r, 258 + Math.sin(t) * r * 0.88]);
  }
  k.path(pts, { fill: mane, shade: "rb" });
  k.circle(345, 150, 36, { fill: fur, w: 6 });
  k.circle(555, 150, 36, { fill: fur, w: 6 });
  k.circle(345, 150, 18, { fill: tone(fur, -0.25), w: 0 });
  k.circle(555, 150, 18, { fill: tone(fur, -0.25), w: 0 });
  k.ellipse(450, 268, 150, 148, { fill: fur, shade: "r", light: true });
  k.ellipse(420, 338, 46, 36, { fill: tone(fur, 0.6), w: 5 });
  k.ellipse(480, 338, 46, 36, { fill: tone(fur, 0.6), w: 5 });
  k.path([[425, 300], [475, 300], [450, 330]], { fill: "#7a3b2e", w: 5 });
  for (const [x, y] of [[410, 345], [400, 330], [490, 345], [500, 330]]) k.dot(x, y, 4);
  k.ellipse(450, 392, 26, 16, { fill: tone(fur, 0.6), w: 5 });
  k.eye(395, 245, 30, { look: [0, 0.1], iris: "#7a4a00" });
  k.eye(505, 245, 30, { look: [0, 0.1], iris: "#7a4a00" });
  k.line([[370, 205], [415, 212]], 6); k.line([[530, 212], [485, 205]], 6);
  k.cheeks(352, 548, 305, 18);
}
lion.humanoid = false;

function robotHead(k, o = {}) {
  const metal = o.skin || k.pick(["#9ca3af", "#7fb7c9", "#c2c7cf", "#e0b04a", "#8fb8a0"]);
  const glow = k.pick(["#7df9ff", "#a3ff7a", "#ffe66d", "#ff9ec4"]);
  neck(k, tone(metal, -0.1), 400);
  seam(k, () => { for (const y of [455, 485]) k.line([[NL, y], [NR, y]], 5); });
  k.line([[450, 120], [450, 55]], 7);
  k.circle(450, 45, 18, { fill: k.pick(["#e63946", "#ffd21f", "#2ec4b6"]), light: true, w: 5 });
  k.rect(255, 200, 40, 110, { r: 10, fill: tone(metal, -0.2), w: 6 });
  k.rect(605, 200, 40, 110, { r: 10, fill: tone(metal, -0.2), w: 6 });
  k.rect(285, 110, 330, 320, { r: 34, fill: metal, shade: "r", light: true });
  k.rect(318, 150, 264, 125, { r: 22, fill: "#1e2a4a", w: 6 });
  const square = k.chance(0.4);
  for (const x of [385, 515]) {
    if (square) k.rect(x - 30, 182, 60, 60, { r: 8, fill: glow, w: 0 });
    else k.circle(x, 212, 32, { fill: glow, w: 0 });
    k.dot(x - 10, 200, 8, "#fff");
  }
  k.rect(360, 320, 180, 64, { r: 14, fill: tone(metal, -0.3), w: 6 });
  for (let x = 390; x <= 510; x += 30) k.line([[x, 326], [x, 378]], 5);
  for (const [x, y] of [[308, 135], [592, 135], [308, 405], [592, 405]]) k.dot(x, y, 7, tone(metal, -0.45));
  if (k.chance(0.5)) k.cheeks(335, 565, 345, 16);
}
robotHead.humanoid = true;

function alien(k, o = {}) {
  const sk = o.skin || k.pick(["#8fd14f", "#7ad19a", "#a5d8ff", "#c4a3f0", "#9be0c8"]);
  neck(k, sk, 400);
  const three = k.chance(0.35);
  for (const s of [-1, 1]) {
    k.line([[450 + s * 70, 80], [450 + s * 120, 25]], 6);
    k.circle(450 + s * 124, 22, 16, { fill: k.pick(["#ffd21f", "#ff8fb8"]), w: 5, light: true });
  }
  k.path([[255, 220], [290, 105], [370, 60], [450, 50], [530, 60], [610, 105], [645, 220], [610, 330], [530, 410], [450, 440], [370, 410], [290, 330]], { fill: sk, shade: "r", light: true });
  if (three) {
    for (const [x, y, r] of [[360, 240, 40], [540, 240, 40], [450, 165, 34]]) k.eye(x, y, r, { look: [0, 0.2], iris: "#3b1f5e" });
  } else {
    for (const s of [-1, 1]) {
      k.ellipse(450 + s * 85, 245, 60, 36, { fill: INK, rot: s * -28, w: 0 });
      k.ellipse(450 + s * 85 - 16, 230, 14, 9, { fill: "#fff", w: 0, rot: -20 });
    }
  }
  k.mouth(450, 360, 70, k.pick(["smile", "o", "smile"]));
  k.cheeks(345, 555, 320, 20);
  for (const [x, y] of [[560, 130], [590, 175], [330, 140]]) k.dot(x, y, 7, tone(sk, -0.2));
}
alien.humanoid = true;

function knight(k, o = {}) {
  const steel = k.pick(["#b7bec9", "#a9b1bd", "#cfd4db"]);
  const plume = clothOf(k, o, ["#e63946", "#2563eb", "#9b5de5", "#ffd21f", "#2aa84a"]);
  neck(k, o.skin || tone(steel, -0.15), 400);
  if (!o.skin) for (let y = 455; y < 600; y += 22) k.line([[NL + 4, y], [NR - 4, y + 4]], 3, tone(steel, -0.45));
  for (let i = 3; i >= 0; i--) {
    const c = i % 2 ? tone(plume, 0.25) : plume;
    k.ellipse(500 + i * 32, 52 + i * 10, 70, 22, { fill: c, w: 5, rot: -12 + i * 14, shade: "b" });
  }
  k.rect(436, 58, 28, 30, { r: 6, fill: "#e0b04a", w: 5 });
  k.path([[290, 450], [282, 230], [310, 130], [380, 82], [450, 72], [520, 82], [590, 130], [618, 230], [610, 450], [450, 465]], { fill: steel, shade: "r", light: true });
  k.line([[450, 75], [450, 210]], 6, tone(steel, -0.35));
  k.path([[295, 215], [605, 215], [608, 300], [292, 300]], { fill: tone(steel, -0.12), w: 6, smooth: false });
  k.rect(320, 240, 115, 22, { r: 10, fill: INK, w: 0 });
  k.rect(465, 240, 115, 22, { r: 10, fill: INK, w: 0 });
  k.dot(375, 251, 7, "#fff6c2"); k.dot(522, 251, 7, "#fff6c2");
  k.line([[450, 300], [450, 455]], 6, tone(steel, -0.35));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) k.dot(500 + c * 26, 340 + r * 26, 6, INK);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) k.dot(348 + c * 26, 340 + r * 26, 6, INK);
  for (const [x, y] of [[300, 300], [600, 300], [310, 430], [590, 430]]) k.dot(x, y, 7, tone(steel, -0.5));
}
knight.humanoid = true;

function princess(k, o = {}) {
  const sk = skinOf(k, o);
  const hair = k.pick(["#f2c94c", "#5c3a1e", "#2b2b30", "#c2581d", "#8b5a2b"]);
  neck(k, sk, 380);
  k.path([[290, 250], [300, 130], [380, 75], [450, 68], [520, 75], [600, 130], [612, 250], [625, 380], [600, 455], [530, 440], [450, 420], [370, 440], [300, 455], [278, 380]], { fill: hair, shade: "r" });
  k.ellipse(450, 278, 135, 155, { fill: sk, shade: "r", light: true });
  k.path([[315, 230], [330, 150], [400, 110], [470, 108], [545, 135], [588, 215], [540, 175], [480, 160], [430, 185], [370, 175]], { fill: hair, w: 6 });
  // corona
  const gold = "#ffd21f";
  k.path([[360, 125], [355, 55], [395, 90], [430, 40], [450, 80], [470, 40], [505, 90], [545, 55], [540, 125]], { fill: gold, smooth: false, shade: "r", light: true });
  for (const [x, c] of [[400, "#e63946"], [450, "#2ec4b6"], [500, "#9b5de5"]]) k.circle(x, 108, 9, { fill: c, w: 3 });
  for (const s of [-1, 1]) {
    k.eye(450 + s * 52, 270, 24, { look: [0, 0.1], iris: k.pick(["#2563eb", "#2f7d32", "#5b3a1e"]) });
    for (const d of [-1, 0, 1]) k.line([[450 + s * (52 + d * 12), 248], [450 + s * (52 + d * 16), 236]], 4);
  }
  k.mouth(450, 350, 54, "smile");
  k.cheeks(372, 528, 322, 18);
  if (k.chance(0.5)) for (const s of [-1, 1]) k.circle(450 + s * 140, 330, 10, { fill: "#fff4dc", w: 4 });
}
princess.humanoid = true;

function pirate(k, o = {}) {
  const sk = skinOf(k, o);
  const beard = k.pick(["#5c3a1e", "#2b2b30", "#c2581d", "#9ca3af"]);
  neck(k, sk, 380);
  k.ellipse(450, 280, 150, 155, { fill: sk, shade: "r", light: true });
  k.ellipse(300, 285, 22, 30, { fill: sk, w: 6 });
  k.circle(300, 320, 14, { fill: "none", w: 5, stroke: "#e0a800" });
  // barba
  k.path([[310, 300], [340, 340], [400, 365], [450, 360], [500, 365], [560, 340], [590, 300], [600, 370], [560, 430], [500, 460], [450, 468], [400, 460], [340, 430], [300, 370]], { fill: beard, shade: "r" });
  k.path([[395, 350], [430, 335], [450, 345], [470, 335], [505, 350], [480, 362], [450, 355], [420, 362]], { fill: tone(beard, -0.1), w: 5 });
  k.ellipse(450, 392, 30, 18, { fill: "#7a1f2b", w: 5 });
  k.rect(440, 380, 12, 12, { r: 2, fill: "#fff", w: 3 });
  if (k.chance(0.55)) {
    // sombrero pirata
    k.path([[250, 190], [300, 90], [380, 55], [450, 48], [520, 55], [600, 90], [650, 190], [560, 165], [450, 160], [340, 165]], { fill: "#2b2b30", shade: "b", light: true });
    k.line([[275, 180], [340, 158], [450, 152], [560, 158], [625, 180]], 7, "#e0a800");
    k.circle(450, 105, 22, { fill: "#fff", w: 4 });
    k.dot(442, 102, 5); k.dot(458, 102, 5);
    k.line([[425, 132], [475, 140]], 5, "#fff"); k.line([[425, 140], [475, 132]], 5, "#fff");
  } else {
    const band = clothOf(k, o, ["#e63946", "#2563eb", "#9b5de5"]);
    k.path([[300, 200], [330, 140], [400, 115], [450, 112], [500, 115], [570, 140], [600, 200], [450, 175]], { fill: band, shade: "b" });
    for (const [x, y] of [[380, 150], [450, 140], [520, 150], [420, 170], [490, 165]]) k.dot(x, y, 7, "#fff");
    k.path([[598, 190], [650, 230], [640, 270], [610, 215]], { fill: band, w: 5 });
    k.path([[598, 190], [665, 200], [670, 240]], { fill: band, w: 5 });
  }
  k.eye(395, 255, 26, { look: [0.2, 0] });
  k.line([[320, 200], [500, 280], [600, 260]], 5);
  k.ellipse(505, 258, 36, 30, { fill: INK, w: 0 });
  k.ellipse(450, 300, 18, 24, { fill: tone(sk, -0.1), w: 5 });
  k.cheeks(365, 545, 318, 16);
}
pirate.humanoid = true;

function astronaut(k, o = {}) {
  const sk = skinOf(k, o);
  neck(k, "#f4f4f4", 400);
  seam(k, () => { for (const y of [470, 520]) k.line([[NL, y], [NR, y]], 4, "#9ca3af"); });
  k.rect(560, 85, 34, 42, { r: 8, fill: "#9ca3af", w: 5 });
  k.circle(577, 82, 12, { fill: "#ffd21f", w: 4 });
  k.circle(450, 255, 200, { fill: "#f4f4f4", shade: "r", light: false });
  k.ellipse(450, 432, 125, 26, { fill: "#c2c7cf", w: 6 });
  k.ellipse(450, 262, 150, 125, { fill: "#24335e", w: 7 });
  // cara dentro del casco
  k.ellipse(450, 280, 95, 100, { fill: sk, w: 5 });
  k.eye(415, 270, 18, { look: [0, 0] });
  k.eye(485, 270, 18, { look: [0, 0] });
  k.mouth(450, 325, 40, k.pick(["smile", "open"]));
  k.cheeks(400, 500, 300, 12);
  k.ellipse(450, 262, 150, 125, { fill: "#7fb7ff", w: 0, opacity: 0.25 });
  k.path([[340, 200], [380, 165], [430, 152], [420, 172], [372, 190], [350, 220]], { fill: "#ffffff", w: 0, opacity: 0.7 });
  k.dot(540, 340, 9, "#ffffff");
  const flag = clothOf(k, o, ["#e63946", "#2563eb", "#ffd21f"]);
  k.rect(300, 330, 40, 26, { r: 4, fill: flag, w: 4 });
}
astronaut.humanoid = true;

function octopus(k, o = {}) {
  const sk = o.skin || k.pick(["#b07ee8", "#ff8fb8", "#ff9f6b", "#e66f8f"]);
  neck(k, sk, 380);
  for (const s of [-1, 1]) {
    k.tube([[450 + s * 90, 390], [450 + s * 170, 432], [450 + s * 250, 425], [450 + s * 270, 380], [450 + s * 235, 365]], 34, sk);
    k.tube([[450 + s * 110, 360], [450 + s * 220, 360], [450 + s * 300, 310], [450 + s * 290, 260]], 32, sk);
  }
  k.path([[275, 270], [285, 140], [360, 70], [450, 55], [540, 70], [615, 140], [625, 270], [590, 380], [520, 430], [450, 440], [380, 430], [310, 380]], { fill: sk, shade: "r", light: true });
  for (const [x, y, r] of [[370, 130, 16], [520, 110, 22], [570, 190, 14], [330, 200, 11], [450, 95, 10]]) k.circle(x, y, r, { fill: tone(sk, -0.15), w: 0 });
  k.eye(385, 270, 40, { look: [0.15, 0.15] });
  k.eye(515, 270, 40, { look: [0.15, 0.15] });
  k.mouth(450, 355, 64, k.pick(["smile", "o"]));
  k.cheeks(335, 565, 330, 22);
  if (k.chance(0.4)) { // sombrerito
    k.ellipse(450, 70, 80, 16, { fill: "#2b2b30", w: 5 });
    k.rect(400, 10, 100, 62, { r: 8, fill: "#2b2b30", w: 5, light: true });
    k.rect(400, 50, 100, 14, { r: 2, fill: "#e63946", w: 0 });
  }
}
octopus.humanoid = false;

function fish(k, o = {}) {
  const sk = o.skin || k.pick(["#ff9f45", "#2ec4b6", "#ffd21f", "#ff8fb8", "#7fb7ff"]);
  const fin = tone(sk, -0.2);
  neck(k, sk, 380);
  k.path([[600, 260], [700, 160], [720, 260], [700, 370]], { fill: fin, shade: "r" });
  k.path([[380, 130], [450, 60], [560, 80], [580, 140]], { fill: fin, w: 6 });
  k.path([[220, 255], [260, 175], [360, 125], [470, 120], [570, 160], [625, 260], [570, 360], [470, 410], [360, 400], [260, 340]], { fill: sk, shade: "b", light: true });
  if (k.chance(0.6)) for (const x of [470, 540]) k.path([[x, 128], [x + 30, 260], [x, 395], [x - 25, 395], [x + 5, 260], [x - 25, 128]], { fill: "#ffffff", w: 0, opacity: 0.8 });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) k.arc(440 + c * 50, 210 + r * 50, 22, 0.1 * Math.PI, 0.9 * Math.PI, 4, tone(sk, -0.35));
  k.path([[390, 300], [450, 330], [430, 370]], { fill: fin, w: 5 });
  k.eye(330, 220, 40, { look: [-0.3, 0] });
  k.ellipse(232, 270, 26, 18, { fill: "#ff7b8f", w: 5 });
  k.line([[210, 270], [252, 270]], 4);
  k.cheeks(320, 320, 285, 18);
  if (!k.drop()) for (const [x, y, r] of [[170, 210, 16], [140, 150, 11], [175, 95, 8]]) k.circle(x, y, r, { fill: "#d6f0ff", w: 4 });
}
fish.humanoid = false;

function strawberry(k, o = {}) {
  const fruit = k.pick(["berry", "orange", "apple"]);
  const sk = o.skin || (fruit === "berry" ? "#e63946" : fruit === "orange" ? "#ff8a1f" : k.pick(["#e63946", "#8fd14f"]));
  neck(k, o.skin || "#5a9e3a", 380);
  if (fruit === "berry") {
    k.path([[262, 175], [350, 115], [450, 125], [550, 115], [638, 175], [632, 285], [575, 380], [450, 455], [325, 380], [268, 285]], { fill: sk, shade: "r", light: true });
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
      const x = 310 + c * 56 + (r % 2) * 28, y = 175 + r * 55;
      if (Math.abs(x - 450) > 170 - r * 22 || (y > 230 && y < 380 && Math.abs(x - 450) < 130)) continue;
      k.ellipse(x, y, 5, 8, { fill: "#ffe17a", w: 0 });
    }
  } else {
    k.circle(450, 275, 180, { fill: sk, shade: "r", light: true });
    if (fruit === "orange") for (const [x, y] of [[330, 190], [570, 210], [560, 370], [340, 380], [450, 140]]) k.dot(x, y, 4, tone(sk, -0.25));
  }
  // hojas
  const leaf = "#3fa64b";
  for (let i = 0; i < 5; i++) {
    const t = Math.PI + (i / 4) * Math.PI;
    k.path([[450, 120], [450 + Math.cos(t) * 50 - 18, 120 + Math.sin(t) * 30], [450 + Math.cos(t) * 100, 125 + Math.sin(t) * 40], [450 + Math.cos(t) * 50 + 18, 120 + Math.sin(t) * 30]], { fill: leaf, w: 5 });
  }
  k.tube([[450, 110], [455, 70], [475, 50]], 14, "#5a7a2a");
  k.eye(395, 260, 30, { look: [0, 0.1] });
  k.eye(505, 260, 30, { look: [0, 0.1] });
  k.mouth(450, 335, 80, k.pick(["smile", "open", "grin"]));
  k.cheeks(350, 550, 310, 20);
}
strawberry.humanoid = true;

function cake(k, o = {}) {
  const sponge = o.skin || k.pick(["#e0aa70", "#8b5a2b", "#f6d5b8"]);
  const icing = clothOf(k, o, ["#ff9ec4", "#ffffff", "#a5d8ff", "#c4a3f0", "#fff4dc"], sponge);
  neck(k, sponge, 400);
  // plato
  k.ellipse(450, 438, 230, 24, { fill: "#ffffff", w: 6, shade: "b" });
  k.rect(270, 265, 360, 170, { r: 20, fill: sponge, shade: "r" });
  k.path([[270, 290], [270, 265], [630, 265], [630, 300], [600, 300], [590, 340], [570, 300], [520, 300], [505, 350], [490, 300], [420, 300], [405, 330], [390, 300], [320, 300], [305, 345], [290, 300]], { fill: icing, w: 6 });
  k.rect(335, 150, 230, 125, { r: 18, fill: sponge, shade: "r" });
  k.path([[335, 170], [335, 145], [565, 145], [565, 180], [540, 180], [530, 215], [515, 180], [450, 180], [440, 205], [425, 180], [370, 180], [358, 210], [348, 180]], { fill: icing, w: 6 });
  for (const [x, y, c] of [[300, 400, "#2563eb"], [600, 395, "#ffd21f"], [330, 230, "#2aa84a"], [610, 340, "#e63946"], [470, 160, "#9b5de5"], [380, 160, "#e63946"]]) k.rect(x, y, 16, 6, { r: 3, fill: c, w: 0 });
  // vela o cereza
  if (k.chance(0.6)) {
    k.rect(438, 70, 24, 78, { r: 6, fill: "#a5d8ff", w: 5 });
    k.line([[438, 95], [462, 85]], 5, "#ffffff"); k.line([[438, 120], [462, 110]], 5, "#ffffff");
    k.path([[450, 30], [466, 52], [450, 66], [434, 52]], { fill: "#ffd21f", w: 4 });
  } else {
    k.circle(450, 122, 26, { fill: "#d62839", light: true });
    k.line([[452, 98], [470, 62]], 5);
  }
  k.eye(400, 375, 24, { look: [0, 0] });
  k.eye(500, 375, 24, { look: [0, 0] });
  k.mouth(450, 415, 56, "smile");
  k.cheeks(360, 540, 400, 15);
}
cake.humanoid = true;

function monsterHead(k, o = {}) {
  const fur = o.skin || k.pick(["#9b5de5", "#2ec4b6", "#7ad19a", "#ff8fb8", "#3b82f6", "#ff9f45"]);
  neck(k, fur, 380);
  const horn = "#fff4dc";
  for (const s of [-1, 1]) k.path([[450 + s * 105, 130], [450 + s * 165, 30], [450 + s * 160, 120]], { fill: horn, shade: "r", w: 6 });
  const pts = [];
  for (let i = 0; i < 30; i++) {
    const t = (i / 30) * Math.PI * 2;
    const r = i % 2 ? 1 : 1.08;
    pts.push([450 + Math.cos(t) * 190 * r, 268 + Math.sin(t) * 175 * r]);
  }
  k.path(pts, { fill: fur, shade: "r", light: true, smooth: false });
  const n = k.pick([1, 1, 2, 3]);
  if (n === 1) k.eye(450, 220, 66, { look: [0, 0.2], iris: "#2aa84a" });
  else if (n === 2) { k.eye(385, 225, 44, { look: [0.2, 0.1] }); k.eye(515, 225, 44, { look: [0.2, 0.1] }); }
  else for (const [x, y, r] of [[370, 230, 34], [450, 190, 40], [530, 230, 34]]) k.eye(x, y, r, { look: [0, 0.2] });
  k.path([[340, 320], [560, 320], [520, 400], [450, 415], [380, 400]], { fill: "#7a1f2b", w: 6 });
  k.ellipse(450, 390, 50, 16, { fill: "#ff7b8f", w: 0 });
  k.path([[370, 322], [400, 322], [385, 352]], { fill: "#fff", w: 4, smooth: false });
  k.path([[500, 322], [530, 322], [515, 352]], { fill: "#fff", w: 4, smooth: false });
  k.cheeks(320, 580, 320, 22);
}
monsterHead.humanoid = false;

function bear(k, o = {}) {
  const panda = !o.skin && k.chance(0.4);
  const fur = o.skin || (panda ? "#ffffff" : k.pick(["#8b5a2b", "#a0703c", "#d9a066", "#f2e3c6"]));
  const dark = panda ? "#2b2b30" : tone(fur, -0.3);
  neck(k, panda ? "#2b2b30" : fur, 380);
  k.circle(320, 120, 62, { fill: dark, shade: "r" });
  k.circle(580, 120, 62, { fill: dark, shade: "r" });
  if (!panda) { k.circle(320, 120, 30, { fill: tone(fur, 0.4), w: 0 }); k.circle(580, 120, 30, { fill: tone(fur, 0.4), w: 0 }); }
  k.ellipse(450, 270, 200, 180, { fill: fur, shade: "r", light: true });
  if (panda) { k.ellipse(385, 245, 46, 58, { fill: "#2b2b30", w: 0, rot: 30 }); k.ellipse(515, 245, 46, 58, { fill: "#2b2b30", w: 0, rot: -30 }); }
  k.eye(385, 245, 24, { look: [0.1, 0.1] });
  k.eye(515, 245, 24, { look: [-0.1, 0.1] });
  k.ellipse(450, 335, 78, 60, { fill: panda ? "#ffffff" : tone(fur, 0.5), w: 5 });
  k.ellipse(450, 310, 28, 18, { fill: INK, w: 0, light: true });
  k.line([[450, 325], [450, 345]], 5);
  k.arc(432, 345, 18, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  k.arc(468, 345, 18, 0.1 * Math.PI, 0.9 * Math.PI, 5);
  k.cheeks(345, 555, 315, 22);
}
bear.humanoid = false;

function clown(k, o = {}) {
  const sk = o.skin || "#fff4ec";
  const hair = k.pick(["#ff7a1a", "#2ec4b6", "#9b5de5", "#ff8fb8"]);
  neck(k, sk, 380);
  for (const s of [-1, 1]) for (const [dx, dy, r] of [[170, 170, 62], [200, 250, 66], [180, 330, 56]]) k.circle(450 + s * dx, dy, r, { fill: hair, w: 6 });
  k.ellipse(450, 270, 150, 160, { fill: sk, shade: "r", light: true });
  // gorrito
  const hat = clothOf(k, o, ["#2563eb", "#ffd21f", "#2aa84a", "#e63946"]);
  k.path([[380, 130], [450, 10], [520, 130]], { fill: hat, smooth: false, shade: "r" });
  for (const [x, y] of [[450, 60], [430, 105], [475, 100]]) k.dot(x, y, 8, "#fff");
  k.circle(450, 14, 16, { fill: "#fff", w: 5 });
  for (const s of [-1, 1]) {
    k.path([[450 + s * 55, 220], [450 + s * 72, 270], [450 + s * 55, 310], [450 + s * 38, 270]], { fill: "#a5d8ff", w: 0 });
    k.eye(450 + s * 55, 265, 22, { look: [0, 0.1] });
  }
  k.path([[360, 345], [450, 380], [540, 345], [520, 410], [450, 430], [380, 410]], { fill: "#e63946", w: 6 });
  k.mouth(450, 392, 70, "smile");
  k.circle(450, 315, 32, { fill: "#e63946", light: true });
  k.cheeks(360, 540, 330, 18);
}
clown.humanoid = true;

// ================= CUERPOS =================
// Nada por encima de y = 90. Cuello de y = 90; torso ~120–480; piernas (x 390 y 510) hasta y = 600.

function suit(k, o = {}) {
  const sk = skinOf(k, o);
  const jacket = clothOf(k, o, ["#2b3550", "#4b5563", "#5b3a29", "#3d4f7a", "#6b2737", "#2f5d50"]);
  const tie = k.pick(["#e63946", "#ffd21f", "#2ec4b6", "#ff8fb8", "#9b5de5"]);
  neck(k, sk, 60, 175);
  stubs(k, tone(jacket, -0.08), 430);
  arms(k, jacket, sk, { cuff: "#ffffff" });
  torso(k, jacket);
  k.path([[395, 136], [505, 136], [450, 300]], { fill: "#ffffff", w: 5 });
  k.path([[398, 134], [448, 150], [418, 185]], { fill: "#ffffff", w: 5 });
  k.path([[502, 134], [452, 150], [482, 185]], { fill: "#ffffff", w: 5 });
  if (k.chance(0.3)) {
    k.path([[450, 160], [405, 140], [405, 182]], { fill: tie, w: 5 });
    k.path([[450, 160], [495, 140], [495, 182]], { fill: tie, w: 5 });
    k.circle(450, 161, 12, { fill: tone(tie, -0.15), w: 5 });
  } else {
    k.path([[438, 150], [462, 150], [458, 175], [442, 175]], { fill: tone(tie, -0.15), w: 5, smooth: false });
    k.path([[442, 175], [458, 175], [474, 300], [450, 330], [426, 300]], { fill: tie, w: 5, shade: "r" });
  }
  k.line([[395, 140], [418, 250], [450, 320]], 6);
  k.line([[505, 140], [482, 250], [450, 320]], 6);
  for (const y of [360, 420]) k.circle(450, y, 9, { fill: tone(jacket, -0.3), w: 4 });
  k.line([[530, 270], [585, 265]], 5);
  k.path([[540, 268], [552, 245], [565, 260], [578, 248], [580, 266]], { fill: tie, w: 4 });
}
suit.humanoid = true;

function hero(k, o = {}) {
  const sk = skinOf(k, o);
  const suitC = clothOf(k, o, ["#2563eb", "#e63946", "#2aa84a", "#9b5de5", "#1f2937"]);
  const cape = k.pick(["#e63946", "#ffd21f", "#ff7a1a", "#9b5de5", "#2ec4b6"].filter((c) => dist(c, suitC) > 100));
  neck(k, sk, 60, 175);
  k.path([[310, 150], [590, 150], [690, 480], [600, 495], [450, 470], [300, 495], [210, 480]], { fill: cape, shade: "r" });
  stubs(k, suitC, 430);
  const gloves = "#ffd21f" !== cape ? "#ffd21f" : "#ffffff";
  arms(k, suitC, o.skin ? sk : gloves, { pose: k.pick(["up", "out", "wave"]), cuff: gloves });
  k.path([[330, 135], [570, 135], [622, 175], [612, 300], [570, 470], [450, 478], [330, 470], [288, 300], [278, 175]], { fill: suitC, shade: "r", light: true });
  k.path([[400, 140], [500, 140], [450, 175]], { fill: sk, w: 5 });
  k.circle(450, 265, 70, { fill: "#ffffff", w: 6 });
  const emb = k.pick(["star", "bolt", "heart"]);
  if (emb === "star") {
    const p = [];
    for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 22 : 50; p.push([450 + Math.cos(t) * r, 268 + Math.sin(t) * r]); }
    k.path(p, { fill: cape, smooth: false, w: 5 });
  } else if (emb === "bolt") k.path([[465, 210], [420, 275], [450, 275], [435, 322], [485, 252], [455, 252]], { fill: cape, smooth: false, w: 5 });
  else k.path([[450, 312], [400, 265], [410, 228], [450, 240], [490, 228], [500, 265]], { fill: cape, w: 5 });
  k.rect(310, 405, 280, 40, { r: 10, fill: "#ffd21f", w: 6 });
  k.rect(428, 400, 44, 50, { r: 8, fill: tone("#ffd21f", -0.2), w: 6 });
}
hero.humanoid = true;

function dress(k, o = {}) {
  const sk = skinOf(k, o);
  const c = clothOf(k, o, ["#ff8fb8", "#a5d8ff", "#c4a3f0", "#ffd21f", "#2ec4b6", "#e63946"]);
  neck(k, sk, 60, 175);
  stubs(k, sk, 400);
  arms(k, sk, sk, { w: 40, pose: k.pick(["down", "out", "wave"]) });
  for (const s of [-1, 1]) k.ellipse(450 + s * 150, 185, 52, 44, { fill: c, shade: "b" });
  k.path([[340, 140], [560, 140], [580, 210], [545, 300], [355, 300], [320, 210]], { fill: c, shade: "r", light: true });
  k.path([[400, 140], [500, 140], [450, 185]], { fill: sk, w: 5 });
  k.path([[355, 295], [545, 295], [610, 380], [660, 480], [570, 492], [450, 480], [330, 492], [240, 480], [290, 380]], { fill: c, shade: "r", light: true });
  const trim = tone(c, -0.25);
  k.line([[245, 470], [290, 488], [335, 470], [380, 488], [425, 470], [470, 488], [515, 470], [560, 488], [605, 470], [650, 485]], 5, trim);
  for (const x of [330, 390, 450, 510, 570]) k.line([[x + (x - 450) * 0.1, 315], [x + (x - 450) * 0.55, 470]], 4, trim);
  k.rect(345, 285, 210, 26, { r: 12, fill: "#ffffff", w: 5 });
  k.circle(450, 298, 16, { fill: k.pick(["#ffd21f", "#e63946"]), w: 4 });
}
dress.humanoid = true;

function armour(k, o = {}) {
  const steel = k.pick(["#b7bec9", "#cfd4db", "#a9b1bd"]);
  const tab = clothOf(k, o, ["#e63946", "#2563eb", "#2aa84a", "#9b5de5"]);
  neck(k, o.skin || tone(steel, -0.15), 60, 175);
  stubs(k, tone(steel, -0.05), 430);
  const ends = arms(k, steel, o.skin || tone(steel, -0.1), { pose: k.pick(["down", "out"]), hands: true });
  for (const e of ends) k.ellipse(e.x - e.ux * 40, e.y - e.uy * 40, 34, 22, { fill: tone(steel, -0.1), w: 5, rot: (Math.atan2(e.uy, e.ux) * 180) / Math.PI + 90 });
  k.path([[335, 135], [565, 135], [612, 180], [600, 330], [450, 360], [300, 330], [288, 180]], { fill: steel, shade: "r", light: true });
  k.path([[300, 330], [450, 360], [600, 330], [598, 380], [450, 410], [302, 380]], { fill: tone(steel, -0.08), w: 6 });
  k.path([[302, 380], [450, 410], [598, 380], [595, 470], [450, 485], [305, 470]], { fill: tone(steel, -0.08), w: 6 });
  k.path([[400, 140], [500, 140], [450, 170]], { fill: tone(steel, -0.3), w: 5 });
  k.path([[380, 200], [520, 200], [515, 270], [450, 310], [385, 270]], { fill: tab, shade: "r", w: 6 });
  k.line([[450, 210], [450, 290]], 7, "#ffd21f"); k.line([[410, 240], [490, 240]], 7, "#ffd21f");
  for (const s of [-1, 1]) {
    k.path([[450 + s * 105, 140], [450 + s * 185, 135], [450 + s * 215, 210], [450 + s * 160, 240], [450 + s * 120, 200]], { fill: steel, shade: "b", light: true });
    for (const [dx, dy] of [[160, 160], [185, 210]]) k.dot(450 + s * dx, dy, 6, tone(steel, -0.5));
  }
  for (const x of [330, 570]) k.dot(x, 350, 6, tone(steel, -0.5));
}
armour.humanoid = true;

function jumper(k, o = {}) {
  const sk = skinOf(k, o);
  const wool = clothOf(k, o, ["#e63946", "#2f5d50", "#3d4f7a", "#ffd21f", "#c4a3f0", "#ff9f45"]);
  const pat = lum(wool) > 0.6 ? "#3d4f7a" : "#ffffff";
  neck(k, sk, 60, 175);
  stubs(k, k.pick(["#3b6fb6", "#2b3550", "#5b3a29"]), 430);
  const ends = arms(k, wool, sk, { pose: k.pick(["down", "out", "wave"]) });
  for (const e of ends) k.ellipse(e.x - e.ux * 22, e.y - e.uy * 22, 30, 14, { fill: tone(wool, -0.15), w: 5, rot: (Math.atan2(e.uy, e.ux) * 180) / Math.PI + 90 });
  torso(k, wool, { bottom: 470 });
  k.path([[395, 132], [505, 132], [490, 165], [450, 175], [410, 165]], { fill: tone(wool, -0.15), w: 5 });
  // franja con zigzag y puntos
  k.line([[292, 250], [608, 250]], 5, tone(wool, -0.3));
  k.line([[290, 330], [612, 330]], 5, tone(wool, -0.3));
  const zz = [];
  for (let x = 300; x <= 600; x += 25) zz.push([x, (x / 25) % 2 ? 275 : 305]);
  k.line(zz, 6, pat, { smooth: false });
  for (let x = 320; x <= 590; x += 45) { k.dot(x, 210, 6, pat); k.dot(x + 20, 370, 6, pat); }
  if (k.chance(0.5)) k.path([[450, 440], [415, 405], [425, 385], [450, 395], [475, 385], [485, 405]], { fill: k.pick(["#ff8fb8", "#e63946", "#ffd21f"]), w: 4 });
  k.path([[296, 440], [604, 440], [606, 476], [294, 476]], { fill: tone(wool, -0.15), w: 5 });
  for (let x = 310; x < 600; x += 18) k.line([[x, 446], [x, 470]], 3, tone(wool, -0.35));
}
jumper.humanoid = true;

function robotBody(k, o = {}) {
  const metal = o.skin || k.pick(["#9ca3af", "#7fb7c9", "#c2c7cf", "#e0b04a"]);
  neck(k, tone(metal, -0.1), 60, 175);
  for (const y of [110, 140]) k.line([[NL, y], [NR, y]], 5);
  stubs(k, tone(metal, -0.15), 430);
  for (const s of [-1, 1]) {
    const up = k.chance(0.5);
    const pts = up ? [[450 + s * 150, 200], [450 + s * 240, 215], [450 + s * 270, 175]] : [[450 + s * 150, 200], [450 + s * 240, 260], [450 + s * 250, 360]];
    k.tube(pts, 30, tone(metal, -0.2));
    for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.2; const p = pts[1]; k.dot(pts[0][0] + (p[0] - pts[0][0]) * t * 1.2, pts[0][1] + (p[1] - pts[0][1]) * t * 1.2, 5, INK); }
    k.circle(pts[1][0], pts[1][1], 24, { fill: metal, w: 6 });
    const e = pts[2];
    // pinza
    k.path([[e[0] - 22, e[1]], [e[0] - 30, e[1] + (up ? -40 : 40)], [e[0] - 8, e[1] + (up ? -30 : 30)]], { fill: metal, w: 5 });
    k.path([[e[0] + 22, e[1]], [e[0] + 30, e[1] + (up ? -40 : 40)], [e[0] + 8, e[1] + (up ? -30 : 30)]], { fill: metal, w: 5 });
    k.circle(e[0], e[1], 22, { fill: tone(metal, -0.1), w: 6 });
  }
  k.rect(290, 135, 320, 340, { r: 30, fill: metal, shade: "r", light: true });
  k.rect(335, 180, 230, 150, { r: 16, fill: "#1e2a4a", w: 6 });
  const lights = ["#ff5d6c", "#ffd21f", "#7df9ff", "#a3ff7a"];
  for (let i = 0; i < 4; i++) k.circle(370 + i * 52, 215, 14, { fill: lights[i], w: 0 });
  k.line([[355, 280], [385, 260], [410, 295], [440, 255], [470, 290], [500, 265], [545, 280]], 5, "#a3ff7a");
  k.circle(380, 395, 30, { fill: "#ffffff", w: 6 });
  k.line([[380, 395], [398, 378]], 5, "#e63946");
  for (let i = 0; i < 3; i++) k.rect(450 + i * 40, 375, 28, 40, { r: 6, fill: k.pick(["#e63946", "#2563eb", "#2aa84a", "#ffd21f"]), w: 5 });
  for (const [x, y] of [[312, 158], [588, 158], [312, 452], [588, 452]]) k.dot(x, y, 7, tone(metal, -0.45));
}
robotBody.humanoid = true;

function fishBody(k, o = {}) {
  const sc = o.skin || k.pick(["#2ec4b6", "#ff9f45", "#7fb7ff", "#ff8fb8", "#8fd14f"]);
  const fin = clothOf(k, { accent: o.accent }, ["#ffd21f", "#ff7a1a", "#9b5de5", "#2563eb", "#e63946"], sc);
  neck(k, sc, 60, 175);
  stubs(k, sc, 420);
  for (const s of [-1, 1]) {
    k.path([[450 + s * 150, 200], [450 + s * 270, 150], [450 + s * 330, 190], [450 + s * 300, 250], [450 + s * 340, 300], [450 + s * 260, 300], [450 + s * 160, 270]], { fill: fin, shade: "b" });
    for (const d of [0, 1, 2]) k.line([[450 + s * 175, 230], [450 + s * (290 + d * 10), 175 + d * 55]], 4, tone(fin, -0.3));
  }
  k.path([[450, 130], [580, 150], [630, 260], [600, 400], [450, 480], [300, 400], [270, 260], [320, 150]], { fill: sc, shade: "r", light: true });
  k.path([[450, 230], [540, 250], [560, 360], [450, 440], [340, 360], [360, 250]], { fill: tone(sc, 0.5), w: 0 });
  for (let r = 0; r < 6; r++) for (let c = -3; c <= 3; c++) {
    const x = 450 + c * 50 + (r % 2) * 25, y = 175 + r * 48;
    if (Math.hypot((x - 450) / 160, (y - 290) / 170) > 1) continue;
    k.arc(x, y, 24, 0.1 * Math.PI, 0.9 * Math.PI, 4, tone(sc, -0.3));
  }
  k.path([[405, 135], [450, 128], [495, 135], [470, 160], [430, 160]], { fill: tone(sc, -0.15), w: 0 });
  for (const [x, y, r] of [[225, 175, 14], [690, 380, 12], [200, 400, 9]]) k.circle(x, y, r, { fill: "#d6f0ff", w: 4 });
}
fishBody.humanoid = false;

function octoBody(k, o = {}) {
  const sk = o.skin || k.pick(["#b07ee8", "#ff8fb8", "#ff9f6b", "#e66f8f"]);
  neck(k, sk, 60, 175);
  stubs(k, sk, 420);
  const tents = [
    [[340, 230], [230, 215], [165, 165], [188, 138], [220, 158]],
    [[330, 290], [200, 300], [130, 260], [120, 220]],
    [[340, 360], [220, 420], [150, 440], [130, 405]],
  ];
  const ends = [];
  for (const s of [-1, 1]) for (const t of tents) {
    const p = s < 0 ? t : mir(t);
    k.tube(p, 36, sk);
    ends.push(p);
  }
  k.path([[450, 125], [570, 145], [625, 250], [610, 380], [540, 470], [450, 485], [360, 470], [290, 380], [275, 250], [330, 145]], { fill: sk, shade: "r", light: true });
  for (const p of ends) for (let i = 1; i < p.length - 1; i++) k.circle(p[i][0], p[i][1] + 10, 7, { fill: tone(sk, 0.5), w: 3 });
  for (const [x, y, r] of [[390, 220, 18], [520, 260, 24], [430, 380, 14], [560, 400, 12], [350, 320, 10]]) k.circle(x, y, r, { fill: tone(sk, -0.15), w: 0 });
  if (k.chance(0.5)) {
    const c = clothOf(k, o, ["#2563eb", "#ffd21f", "#e63946"], sk);
    k.path([[450, 160], [405, 140], [405, 182]], { fill: c, w: 5 });
    k.path([[450, 160], [495, 140], [495, 182]], { fill: c, w: 5 });
    k.circle(450, 161, 12, { fill: tone(c, -0.15), w: 5 });
  }
}
octoBody.humanoid = false;

function tutu(k, o = {}) {
  const sk = skinOf(k, o);
  const c = clothOf(k, o, ["#ff9ec4", "#c4a3f0", "#a5d8ff", "#ffffff", "#ffd21f"]);
  neck(k, sk, 60, 175);
  stubs(k, tone(c, 0.35), 400);
  for (const s of [-1, 1]) {
    const up = k.chance(0.6);
    const pts = up ? [[450 + s * 120, 190], [450 + s * 235, 185], [450 + s * 215, 150]] : [[450 + s * 120, 190], [450 + s * 240, 220], [450 + s * 330, 190]];
    k.tube(pts, 36, sk);
    hand(k, pts[2][0] + (up ? -s * 5 : s * 18), pts[2][1] + (up ? 5 : -5), s, sk);
  }
  k.path([[345, 140], [555, 140], [575, 210], [555, 340], [345, 340], [325, 210]], { fill: c, shade: "r", light: true });
  k.path([[395, 140], [505, 140], [450, 175]], { fill: sk, w: 5 });
  const pts = [];
  for (let i = 0; i <= 14; i++) { const x = 220 + i * 33; pts.push([x, i % 2 ? 450 : 430]); }
  const frill = [[330, 330], [570, 330], [660, 380], ...pts.reverse(), [240, 380]];
  k.path(frill, { fill: tone(c, 0.2), w: 6, smooth: false });
  k.path([[330, 330], [570, 330], [640, 375], [450, 395], [260, 375]], { fill: c, w: 6, shade: "b" });
  for (const x of [300, 360, 420, 480, 540, 600]) k.line([[450 + (x - 450) * 0.5, 395], [x, 435]], 3, tone(c, -0.2));
  k.circle(450, 340, 16, { fill: k.pick(["#ffd21f", "#e63946", "#2563eb"]), w: 4 });
  for (const [x, y] of [[400, 230], [500, 270], [430, 300]]) k.dot(x, y, 5, "#fff");
}
tutu.humanoid = true;

function spacesuit(k, o = {}) {
  const sk = skinOf(k, o);
  const w = "#f4f4f4";
  const acc = clothOf(k, o, ["#ff7a1a", "#2563eb", "#e63946"]);
  neck(k, w, 60, 175);
  for (const y of [110, 140]) k.line([[NL, y], [NR, y]], 4, "#9ca3af");
  stubs(k, w, 430);
  seam(k, () => { for (const y of [520, 560]) for (const x of LX) k.line([[x - LHW + 3, y], [x + LHW - 3, y]], 4, "#c2c7cf"); });
  const ends = arms(k, w, "#ffffff", { w: 58, pose: k.pick(["down", "out", "wave", "up"]), hands: false });
  for (const e of ends) {
    k.ellipse(e.x - e.ux * 20, e.y - e.uy * 20, 38, 16, { fill: acc, w: 5, rot: (Math.atan2(e.uy, e.ux) * 180) / Math.PI + 90 });
    k.circle(e.x + e.ux * 8, e.y + e.uy * 8, 32, { fill: "#d9dde3", shade: "rb" });
  }
  k.ellipse(450, 158, 120, 34, { fill: "#c2c7cf", w: 6 });
  torso(k, w, { wide: 10 });
  k.rect(370, 220, 160, 120, { r: 14, fill: "#c2c7cf", w: 6 });
  for (let i = 0; i < 3; i++) k.circle(400 + i * 50, 255, 14, { fill: ["#e63946", "#2aa84a", "#ffd21f"][i], w: 4 });
  k.rect(395, 290, 110, 28, { r: 6, fill: "#1e2a4a", w: 4 });
  k.dot(420, 304, 5, "#7df9ff"); k.dot(450, 304, 5, "#7df9ff");
  k.rect(310, 200, 44, 30, { r: 4, fill: acc, w: 4 });
  k.tube([[530, 300], [590, 360], [560, 420]], 14, "#9ca3af");
  k.rect(300, 420, 300, 40, { r: 12, fill: "#c2c7cf", w: 6 });
  k.rect(430, 418, 40, 44, { r: 6, fill: acc, w: 5 });
  for (const s of [-1, 1]) k.line([[450 + s * 160, 330], [450 + s * 165, 400]], 4, "#c2c7cf");
}
spacesuit.humanoid = true;

function pirateCoat(k, o = {}) {
  const sk = skinOf(k, o);
  const coat = clothOf(k, o, ["#8b1e2d", "#1f2d66", "#2f5d50", "#5b3a29"]);
  neck(k, sk, 60, 175);
  stubs(k, "#2b2b30", 430);
  const ends = arms(k, coat, sk, { pose: k.pick(["down", "out", "wave"]), cuff: "#e0b04a", hands: false });
  ends.forEach((e, i) => {
    if (i === 1) { // garfio
      k.ellipse(e.x, e.y, 22, 16, { fill: "#5b3a29", w: 5 });
      k.path([[e.x + e.ux * 10, e.y + e.uy * 10], [e.x + e.ux * 45, e.y + e.uy * 45], [e.x + e.ux * 60 - 25, e.y + e.uy * 60 - 5], [e.x + e.ux * 40 - 20, e.y + e.uy * 40 + 10]], { fill: "none", closed: false, w: 9, stroke: "#9ca3af" });
    } else hand(k, e.x, e.y, e.s, sk);
  });
  k.path([[330, 135], [570, 135], [618, 180], [622, 300], [640, 485], [470, 490], [450, 300], [430, 490], [260, 485], [278, 300], [282, 180]], { fill: coat, shade: "r", light: true });
  k.path([[395, 135], [505, 135], [470, 300], [450, 330], [430, 300]], { fill: "#ffffff", w: 5 });
  for (const y of [170, 200, 230]) k.line([[430, y], [450, y + 12], [470, y]], 4, "#d0d4da");
  k.path([[395, 135], [350, 160], [410, 290], [450, 330], [430, 300]], { fill: tone(coat, -0.2), w: 5 });
  k.path(mir([[395, 135], [350, 160], [410, 290], [450, 330], [430, 300]]), { fill: tone(coat, -0.2), w: 5 });
  k.path([[282, 280], [618, 330], [620, 375], [280, 325]], { fill: "#5b3a29", w: 6 });
  k.rect(420, 300, 56, 44, { r: 6, fill: "#e0b04a", w: 5 });
  k.rect(436, 312, 24, 20, { r: 3, fill: "#5b3a29", w: 0 });
  for (const y of [390, 440]) { k.circle(395, y, 9, { fill: "#e0b04a", w: 4 }); k.circle(505, y, 9, { fill: "#e0b04a", w: 4 }); }
  if (k.chance(0.5)) {
    k.path([[560, 175], [600, 150], [620, 185], [600, 205]], { fill: "#2aa84a", w: 5 });
    k.path([[600, 150], [610, 125], [625, 150]], { fill: "#e63946", w: 4 });
    k.dot(598, 168, 4);
  }
}
pirateCoat.humanoid = true;

function hairy(k, o = {}) {
  const fur = o.skin || k.pick(["#9b5de5", "#2ec4b6", "#7ad19a", "#ff8fb8", "#3b82f6", "#ff9f45"]);
  neck(k, fur, 60, 175);
  stubs(k, fur, 420);
  const dark = tone(fur, -0.25);
  for (const s of [-1, 1]) {
    const up = k.chance(0.5);
    const pts = up ? [[450 + s * 140, 210], [450 + s * 240, 215], [450 + s * 290, 178]] : [[450 + s * 140, 210], [450 + s * 230, 290], [450 + s * 250, 390]];
    k.tube(pts, 54, fur);
    const e = pts[2];
    for (const d of [-1, 0, 1]) k.path([[e[0] + d * 16 - 6, e[1]], [e[0] + d * 22, e[1] + (up ? -40 : 40)], [e[0] + d * 16 + 6, e[1]]], { fill: "#fff4dc", w: 4, smooth: false });
    k.circle(e[0], e[1], 32, { fill: fur, shade: "rb" });
  }
  const pts = [];
  for (let i = 0; i < 34; i++) {
    const t = (i / 34) * Math.PI * 2;
    const r = i % 2 ? 1 : 1.07;
    pts.push([450 + Math.cos(t) * 180 * r, 308 + Math.sin(t) * 170 * r]);
  }
  k.path(pts, { fill: fur, shade: "r", light: true, smooth: false });
  k.ellipse(450, 320, 100, 110, { fill: tone(fur, 0.45), w: 0 });
  for (let i = 0; i < 9; i++) {
    const x = k.R(330, 570), y = k.R(170, 450);
    if (Math.hypot((x - 450) / 100, (y - 320) / 110) < 1.1) continue;
    k.line([[x - 8, y + 6], [x, y - 8], [x + 8, y + 6]], 4, dark);
  }
  k.circle(450, 340, 9, { fill: tone(fur, 0.2), w: 4 });
}
hairy.humanoid = false;

function dungarees(k, o = {}) {
  const sk = skinOf(k, o);
  const shirt = clothOf(k, o, ["#e63946", "#ffd21f", "#2aa84a", "#ff8fb8", "#ffffff"]);
  const denim = k.pick(["#3b6fb6", "#4f7cc4", "#2f5a9c"]);
  neck(k, sk, 60, 175);
  stubs(k, denim, 430);
  const ends = arms(k, sk, sk, { w: 40 });
  for (const e of ends) k.tube([[450 + e.s * 135, 190], [450 + e.s * 185, 230]], 52, shirt);
  torso(k, shirt);
  if (k.chance(0.6)) for (const y of [190, 240]) k.line([[292, y], [608, y]], 10, tone(shirt, lum(shirt) > 0.6 ? -0.3 : 0.5));
  k.path([[360, 260], [540, 260], [545, 330], [608, 330], [606, 475], [294, 475], [292, 330], [355, 330]], { fill: denim, shade: "r", smooth: false });
  for (const s of [-1, 1]) k.path([[450 + s * 80, 262], [450 + s * 100, 140], [450 + s * 130, 140], [450 + s * 108, 262]], { fill: denim, w: 6, smooth: false });
  k.circle(375, 268, 10, { fill: "#ffd21f", w: 4 }); k.circle(525, 268, 10, { fill: "#ffd21f", w: 4 });
  k.rect(400, 290, 100, 70, { r: 8, fill: tone(denim, -0.12), w: 5 });
  k.path([[400, 290], [500, 290]], { closed: false, w: 4, stroke: "#ffd21f", dash: "8 8" });
  k.line([[450, 380], [450, 475]], 4, tone(denim, -0.35));
}
dungarees.humanoid = true;

function bee(k, o = {}) {
  const yel = o.skin || "#ffd21f";
  neck(k, INK === yel ? "#2b2b30" : yel, 60, 175);
  stubs(k, "#2b2b30", 420);
  for (const s of [-1, 1]) {
    k.ellipse(450 + s * 190, 215, 115, 65, { fill: "#d6f0ff", w: 6, rot: s * -22, opacity: 0.9 });
    k.line([[450 + s * 120, 235], [450 + s * 230, 205]], 3, "#9fcbe8");
  }
  arms(k, "#2b2b30", yel, { w: 26, hands: true });
  k.ellipse(450, 310, 175, 175, { fill: yel, shade: "r", light: true });
  for (const [y, hw] of [[240, 150], [320, 172], [400, 140]]) k.path([[450 - hw, y - 18], [450 + hw, y - 18], [450 + hw, y + 18], [450 - hw, y + 18]], { fill: "#2b2b30", w: 0, smooth: false });
  k.ellipse(450, 310, 175, 175, { fill: "none", w: 6 });
  k.path([[432, 478], [468, 478], [450, 496]], { fill: "#2b2b30", w: 0 });
  k.path([[400, 140], [500, 140], [450, 170]], { fill: tone(yel, -0.2), w: 5 });
}
bee.humanoid = false;

function hawaiian(k, o = {}) {
  const sk = skinOf(k, o);
  const shirt = clothOf(k, o, ["#2ec4b6", "#ff7a1a", "#3b82f6", "#e63946", "#9be04a"]);
  neck(k, sk, 60, 175);
  stubs(k, k.pick(["#d9a066", "#ffffff", "#3b6fb6"]), 430);
  const ends = arms(k, sk, sk, { w: 40, pose: k.pick(["down", "out", "wave"]) });
  for (const e of ends) k.tube([[450 + e.s * 135, 190], [450 + e.s * 190, 235]], 56, shirt);
  torso(k, shirt);
  k.path([[395, 136], [505, 136], [450, 230]], { fill: sk, w: 5 });
  k.path([[395, 136], [440, 240], [370, 200]], { fill: tone(shirt, 0.2), w: 5 });
  k.path(mir([[395, 136], [440, 240], [370, 200]]), { fill: tone(shirt, 0.2), w: 5 });
  k.line([[450, 230], [450, 476]], 5);
  for (const y of [280, 340, 400]) k.dot(462, y, 6, "#fff");
  const petals = [k.pick(["#ffffff", "#ffd21f", "#ff8fb8"]), "#ffffff"];
  for (const [x, y, i] of [[340, 280, 0], [560, 260, 1], [380, 420, 1], [540, 400, 0], [600, 330, 0], [320, 360, 1]]) {
    for (let p = 0; p < 5; p++) { const t = (p / 5) * Math.PI * 2; k.circle(x + Math.cos(t) * 14, y + Math.sin(t) * 14, 11, { fill: petals[i], w: 3 }); }
    k.dot(x, y, 7, "#ffd21f");
  }
  for (const [x, y] of [[360, 330], [520, 330]]) k.path([[x, y], [x + 30, y - 25], [x + 50, y + 5], [x + 20, y + 20]], { fill: "#2aa84a", w: 3 });
  // collar de flores
  for (let i = 0; i < 9; i++) { const t = Math.PI * (0.12 + (i / 8) * 0.76); k.circle(450 + Math.cos(t) * 95, 120 + Math.sin(t) * 75, 15, { fill: ["#ff8fb8", "#ffd21f", "#e63946"][i % 3], w: 4 }); }
}
hawaiian.humanoid = true;

// ================= PIERNAS =================
// Nada por encima de y = 90. Las piernas nacen en y = 90 en x 368–412 y 488–532; pies hacia y 470–560.

/** Pernera recta/abocinada desde arriba (empieza por encima del corte para que no se vea su borde) */
function legTube(k, x, y1, fill, o = {}) {
  const f = o.flare || 0, hw = LHW;
  k.path([[x - hw, 40], [x + hw, 40], [x + hw + f, y1], [x - hw - f, y1]], { fill, shade: "r", smooth: false });
}
/** Zapatilla: dir -1 punta a la izquierda */
function sneaker(k, x, y, dir, col) {
  const m = (pts) => pts.map(([dx, dy]) => [x + dir * dx, y + dy]);
  k.path(m([[-40, -64], [22, -66], [42, -38], [88, -28], [100, -6], [-46, -6], [-48, -36]]), { fill: col, shade: "b", light: true });
  k.path(m([[-52, -10], [104, -10], [104, 10], [-52, 10]]), { fill: "#ffffff", w: 6, smooth: true });
  for (const d of [0, 18]) k.line(m([[18 + d, -50], [32 + d, -36]]), 4, "#ffffff");
  k.line(m([[-30, -36], [10, -24]]), 5, tone(col, -0.3));
}

function trousers(k, o = {}) {
  const t = clothOf(k, o, ["#3b6fb6", "#2b3550", "#5b3a29", "#4b5563", "#6b8e23", "#8b1e2d"]);
  const shoe = k.pick(["#e63946", "#2563eb", "#2aa84a", "#ffd21f", "#9b5de5", "#ff7a1a"]);
  for (const [i, x] of LX.entries()) {
    legTube(k, x, 480, t, { flare: 14 });
    if (t === "#3b6fb6" || k.chance(0.3)) k.line([[x - 12, 300], [x - 6, 340]], 4, tone(t, 0.3));
  }
  for (const [i, x] of LX.entries()) k.rect(x - 40, 455, 80, 30, { r: 6, fill: tone(t, -0.1), w: 6 });
  sneaker(k, 375, 545, -1, shoe);
  sneaker(k, 525, 545, 1, shoe);
}
trousers.humanoid = true;

function ballet(k, o = {}) {
  const tights = o.skin || k.pick(["#ffd0dc", "#ffe4ec", "#f6d5b8"]);
  const shoe = clothOf(k, { accent: o.accent }, ["#ff9ec4", "#f9a8c9", "#c4a3f0"], tights);
  for (const x of LX) k.path([[x - LHW, 40], [x + LHW, 40], [x + 22, 200], [x + 20, 300], [x + 15, 470], [x - 15, 470], [x - 20, 300], [x - 22, 200]], { fill: tights, shade: "r" });
  for (const x of LX) {
    k.path([[x - 22, 440], [x + 22, 440], [x + 22, 520], [x + 10, 560], [x - 10, 560], [x - 22, 520]], { fill: shoe, shade: "r", light: true });
    k.line([[x - 18, 445], [x + 15, 410], [x - 14, 375]], 5, shoe);
    k.line([[x + 18, 445], [x - 15, 410], [x + 14, 375]], 5, shoe);
    k.path([[x - 10, 432], [x + 10, 432], [x + 6, 444], [x - 6, 444]], { fill: tone(shoe, -0.2), w: 3 });
  }
  for (const x of LX) k.dot(x - 8, 220, 4, tone(tights, -0.15));
}
ballet.humanoid = true;

function chicken(k, o = {}) {
  const feath = o.skin || k.pick(["#ffffff", "#ffd21f", "#d9a066", "#fff4dc"]);
  const leg = "#ff9f1a";
  for (const s of [-1, 1]) {
    const x = s < 0 ? LX[0] : LX[1];
    k.tube([[x, 220], [x + s * 14, 330], [x + s * 2, 440], [x, 495]], 18, leg);
    for (const [dx, dy] of [[-58, 532], [0, 550], [58, 532]]) {
      k.tube([[x, 492], [x + dx, dy]], 13, leg);
      k.path([[x + dx * 1.05 - 7, dy], [x + dx * 1.25, dy + 14], [x + dx * 1.05 + 7, dy]], { fill: INK, w: 0 });
    }
    for (const dy of [300, 390]) k.line([[x + s * 2 - 9, dy], [x + s * 2 + 9, dy]], 3, tone(leg, -0.3));
  }
  for (const s of [-1, 1]) {
    const x = s < 0 ? LX[0] : LX[1];
    // calzón de plumas
    k.path([[x - LHW, 40], [x + LHW, 40], [x + 30, 100], [x + 70, 165], [x + 62, 212], [x + 38, 245], [x + 14, 225], [x - 10, 252], [x - 34, 226], [x - 60, 240], [x - 76, 190], [x - 32, 100]], { fill: feath, shade: "r", light: true });
    for (const [dx, dy] of [[-30, 175], [20, 190], [-2, 140], [40, 150], [-45, 215], [5, 225]]) k.line([[x + dx - 11, dy - 7], [x + dx, dy + 6], [x + dx + 11, dy - 7]], 4, tone(feath, -0.25));
  }
}
chicken.humanoid = false;

function robotLegs(k, o = {}) {
  const metal = o.skin || k.pick(["#9ca3af", "#7fb7c9", "#c2c7cf", "#e0b04a"]);
  const acc = clothOf(k, o, ["#e63946", "#2563eb", "#ffd21f", "#2aa84a"], metal);
  for (const x of LX) {
    k.rect(x - LHW, 40, 2 * LHW, 210, { r: 0, fill: metal, shade: "r" });
    for (const y of [130, 170, 210]) k.line([[x - LHW, y], [x + LHW, y]], 4, tone(metal, -0.35));
    k.circle(x, 265, 34, { fill: acc, w: 6, light: true });
    k.dot(x, 265, 9, INK);
    k.rect(x - 28, 290, 56, 130, { r: 12, fill: metal, shade: "r", light: true });
    k.rect(x - 34, 420, 68, 40, { r: 8, fill: tone(metal, -0.2), w: 6 });
  }
  const wheels = k.chance(0.6);
  for (const x of LX) {
    if (wheels) {
      k.circle(x, 505, 52, { fill: "#2b2b30", shade: "rb" });
      k.circle(x, 505, 24, { fill: acc, w: 5 });
      k.dot(x, 505, 7, INK);
      for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2; k.dot(x + Math.cos(t) * 40, 505 + Math.sin(t) * 40, 4, "#6b7280"); }
    } else {
      k.path([[x - 60, 460], [x + 60, 460], [x + 70, 530], [x - 70, 530]], { fill: tone(metal, -0.1), shade: "b", smooth: false });
      for (const d of [-40, 0, 40]) k.dot(x + d, 498, 6, tone(metal, -0.5));
    }
  }
}
robotLegs.humanoid = true;

function rollerSkates(k, o = {}) {
  const sk = skinOf(k, o);
  const sock = clothOf(k, o, ["#e63946", "#2563eb", "#2aa84a", "#9b5de5", "#ff7a1a"]);
  const shorts = k.pick(["#3b6fb6", "#ffd21f", "#ff8fb8", "#2b3550"].filter((c) => dist(c, sock) > 90));
  for (const x of LX) {
    k.path([[x - LHW, 40], [x + LHW, 40], [x + 18, 300], [x + 16, 400], [x - 16, 400], [x - 18, 300]], { fill: sk, shade: "r" });
    k.circle(x, 270, 14, { fill: tone(sk, -0.1), w: 0 });
    k.path([[x - 20, 330], [x + 20, 330], [x + 20, 420], [x - 20, 420]], { fill: "#ffffff", w: 5, smooth: false });
    for (const y of [345, 370]) k.line([[x - 20, y], [x + 20, y]], 8, sock);
  }
  for (const x of LX) k.path([[x - LHW - 4, 40], [x + LHW + 4, 40], [x + LHW + 12, 160], [x - LHW - 12, 160]], { fill: shorts, shade: "r", smooth: false });
  const boot = k.pick(["#ffffff", "#ff9ec4", "#ffd21f", "#a5d8ff"]);
  const wheel = k.pick(["#ff7a1a", "#2ec4b6", "#e63946", "#9b5de5"]);
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    const m = (pts) => pts.map(([dx, dy]) => [x + d * dx, dy]);
    k.path(m([[-26, 400], [24, 400], [28, 455], [80, 470], [86, 500], [-34, 500], [-34, 455]]), { fill: boot, shade: "b", light: true });
    for (const yy of [420, 440, 460]) k.line(m([[-6, yy], [18, yy]]), 4, tone(boot, -0.3));
    k.rect(Math.min(x + d * -40, x + d * 92), 498, 132, 14, { r: 6, fill: "#9ca3af", w: 5 });
    for (const dx of [-20, 60]) k.circle(x + d * dx, 530, 22, { fill: wheel, w: 6, light: true });
    k.circle(x + d * 88, 488, 9, { fill: "#e63946", w: 4 });
  }
}
rollerSkates.humanoid = true;

function mermaid(k, o = {}) {
  const sc = o.skin || k.pick(["#2ec4b6", "#7fb7ff", "#9b5de5", "#ff8fb8", "#2aa84a"]);
  const fin = clothOf(k, { accent: o.accent }, ["#c4a3f0", "#a5d8ff", "#ffd21f", "#ff9ec4"], sc);
  // las dos piernas se juntan en una cola
  k.path([[368, 40], [412, 40], [412, 110], [450, 150], [488, 110], [488, 40], [532, 40], [540, 180], [520, 300], [480, 400], [462, 450], [438, 450], [420, 400], [380, 300], [360, 180]], { fill: sc, shade: "r", light: true });
  k.path([[450, 435], [380, 480], [300, 470], [270, 530], [360, 545], [450, 495], [540, 545], [630, 530], [600, 470], [520, 480]], { fill: fin, shade: "b" });
  for (const d of [-1, 1]) for (const t of [0.35, 0.7]) k.line([[450 + d * 20, 470], [450 + d * (100 + t * 150), 470 + t * 60]], 4, tone(fin, -0.25));
  for (let r = 0; r < 7; r++) for (let c = -3; c <= 3; c++) {
    const y = 170 + r * 38, x = 450 + c * 34 + (r % 2) * 17;
    const half = 80 - Math.max(0, y - 220) * 0.3;
    if (Math.abs(x - 450) > half) continue;
    k.arc(x, y, 16, 0.1 * Math.PI, 0.9 * Math.PI, 4, tone(sc, -0.3));
  }
  k.ellipse(450, 445, 26, 14, { fill: fin, w: 5 });
  for (const [x, y, r] of [[600, 300, 14], [630, 240, 9], [290, 360, 11]]) k.circle(x, y, r, { fill: "#d6f0ff", w: 4 });
}
mermaid.humanoid = true;

function frogLegs(k, o = {}) {
  const sk = o.skin || k.pick(["#5bbf4a", "#7ccf5a", "#3fa66b", "#9be04a"]);
  const belly = tone(sk, 0.35);
  for (const s of [-1, 1]) {
    const x = s < 0 ? LX[0] : LX[1];
    const m = (pts) => pts.map(([dx, dy]) => [x + s * dx, dy]); // dx > 0: hacia fuera
    // pie palmeado
    k.path(m([[30, 455], [80, 455], [190, 520], [185, 548], [150, 540], [128, 562], [95, 548], [60, 565], [28, 545], [20, 500]]), { fill: belly, shade: "b" });
    for (const [dx, dy] of [[185, 535], [130, 556], [62, 560]]) k.circle(x + s * dx, dy, 12, { fill: sk, w: 5 });
    // espinilla: de la rodilla (fuera) al tobillo (dentro)
    k.tube(m([[155, 300], [120, 390], [60, 470]]), 50, sk);
    // muslo
    k.path(m([[-22, 40], [22, 40], [55, 140], [140, 230], [192, 290], [178, 345], [125, 345], [70, 270], [-5, 175], [-24, 110]]), { fill: sk, shade: "b", light: true });
    for (const [dx, dy, r] of [[70, 200, 13], [130, 270, 9], [20, 140, 10], [150, 320, 7]]) k.circle(x + s * dx, dy, r, { fill: tone(sk, -0.15), w: 0 });
  }
}
frogLegs.humanoid = false;

function boots(k, o = {}) {
  const jeans = clothOf(k, o, ["#3b6fb6", "#2b3550", "#5b3a29", "#6b8e23"]);
  const kind = k.pick(["welly", "cowboy"]);
  const boot = kind === "welly" ? k.pick(["#ffd21f", "#e63946", "#2aa84a", "#ff8fb8"]) : k.pick(["#8b5a2b", "#a0703c", "#5b3a29"]);
  for (const x of LX) legTube(k, x, 300, jeans, { flare: 6 });
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    const m = (pts) => pts.map(([dx, dy]) => [x + d * dx, dy]);
    if (kind === "welly") {
      k.path(m([[-40, 270], [40, 270], [38, 470], [95, 480], [100, 530], [-48, 530], [-46, 470]]), { fill: boot, shade: "r", light: true });
      k.path(m([[-40, 270], [40, 270], [42, 298], [-42, 298]]), { fill: tone(boot, -0.15), w: 6, smooth: false });
      k.path(m([[-52, 520], [104, 520], [104, 545], [-52, 545]]), { fill: "#2b2b30", w: 6, smooth: false });
    } else {
      k.path(m([[-40, 260], [-10, 280], [40, 260], [36, 450], [100, 485], [112, 525], [-12, 525], [-20, 545], [-46, 545], [-44, 450]]), { fill: boot, shade: "r", light: true });
      k.line(m([[-20, 320], [0, 360], [20, 320]]), 5, "#e0b04a");
      k.line(m([[-20, 380], [0, 410], [20, 380]]), 5, "#e0b04a");
      k.path(m([[-46, 522], [-14, 522], [-16, 545], [-44, 545]]), { fill: tone(boot, -0.45), w: 5, smooth: false });
    }
  }
}
boots.humanoid = true;

function flippers(k, o = {}) {
  const wet = clothOf(k, o, ["#2b2b30", "#1f2d66", "#2f5d50"]);
  const fl = k.pick(["#ffd21f", "#ff7a1a", "#2ec4b6", "#e63946", "#9be04a"]);
  for (const x of LX) {
    legTube(k, x, 460, wet, { flare: 4 });
    k.line([[x + 12, 120], [x + 14, 440]], 5, fl);
  }
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    const m = (pts) => pts.map(([dx, dy]) => [x + d * dx, dy]);
    k.path(m([[-28, 430], [28, 430], [70, 470], [170, 500], [175, 540], [60, 560], [-20, 545], [-34, 480]]), { fill: fl, shade: "b", light: true });
    for (const dy of [0, 22]) k.line(m([[50, 480 + dy], [160, 505 + dy]]), 4, tone(fl, -0.25));
    k.path(m([[-30, 430], [30, 430], [34, 465], [-34, 465]]), { fill: tone(fl, -0.15), w: 5, smooth: false });
  }
  for (const [x, y, r] of [[250, 300, 14], [660, 260, 11], [230, 220, 8]]) k.circle(x, y, r, { fill: "#d6f0ff", w: 4 });
}
flippers.humanoid = true;

function skeleton(k, o = {}) {
  const bone = o.skin && lum(o.skin) > 0.75 ? o.skin : "#fbf7ec";
  const bn = (a, b, w) => {
    k.tube([a, b], w, bone);
    for (const p of [a, b]) for (const d of [-1, 1]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      k.circle(p[0] + (-dy / L) * d * w * 0.55, p[1] + (dx / L) * d * w * 0.55, w * 0.55, { fill: bone, w: 5 });
    }
    k.tube([a, b], w - 4, bone, { outline: 0 });
  };
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    k.tube([[x, 40], [x, 110]], 32, bone);
    bn([x, 120], [x + d * 10, 290], 26);
    k.circle(x + d * 10, 305, 20, { fill: bone, w: 5, shade: "rb" });
    bn([x + d * 10, 325], [x + d * 5, 465], 22);
    for (const t of [0, 1, 2]) k.circle(x + d * 52, 484 + t * 13, 9, { fill: bone, w: 4 });
    // pie
    k.path([[x + d * -20, 470], [x + d * 25, 470], [x + d * 50, 490], [x + d * 50, 515], [x + d * -25, 510]], { fill: bone, shade: "b" });
  }
  if (k.chance(0.5)) for (const x of LX) k.path([[x - LHW - 2, 40], [x + LHW + 2, 40], [x + 38, 170], [x + 15, 160], [x, 180], [x - 15, 160], [x - 38, 170]], { fill: clothOf(k, o, ["#e63946", "#2563eb", "#9b5de5"]), shade: "r", smooth: false });
}
skeleton.humanoid = false;

function stilts(k, o = {}) {
  const pants = clothOf(k, o, ["#e63946", "#2563eb", "#9b5de5", "#2aa84a"]);
  const stripe = "#ffffff";
  for (const x of LX) {
    k.rect(x - 12, 380, 24, 175, { r: 4, fill: "#c98e4b", shade: "r", w: 6 });
    k.rect(x - 30, 540, 60, 20, { r: 6, fill: "#8b5a2b", w: 6 });
  }
  for (const x of LX) {
    k.path([[x - LHW, 40], [x + LHW, 40], [x + 38, 420], [x - 38, 420]], { fill: pants, shade: "r", smooth: false });
    for (let y = 80; y < 410; y += 50) k.path([[x - LHW - (y - 40) * 0.042, y], [x + LHW + (y - 40) * 0.042, y], [x + LHW + (y - 18) * 0.042, y + 22], [x - LHW - (y - 18) * 0.042, y + 22]], { fill: stripe, w: 0, smooth: false, opacity: 0.85 });
    k.path([[x - 38, 400], [x + 38, 400], [x + 40, 428], [x - 40, 428]], { fill: tone(pants, -0.2), w: 6, smooth: false });
  }
  for (const [x, y] of [[300, 300], [600, 250]]) k.circle(x, y, 9, { fill: "#ffd21f", w: 3 });
}
stilts.humanoid = true;

function football(k, o = {}) {
  const sk = skinOf(k, o);
  const kit = clothOf(k, o, ["#e63946", "#2563eb", "#ffffff", "#2aa84a", "#ffd21f"]);
  const sock = kit === "#ffffff" ? "#2563eb" : kit;
  for (const x of LX) {
    k.path([[x - LHW, 40], [x + LHW, 40], [x + 18, 300], [x + 18, 470], [x - 18, 470], [x - 18, 300]], { fill: sk, shade: "r" });
    k.circle(x, 250, 14, { fill: tone(sk, -0.12), w: 0 });
    k.path([[x - 22, 320], [x + 22, 320], [x + 20, 480], [x - 20, 480]], { fill: sock, shade: "r", smooth: false });
    k.line([[x - 21, 345], [x + 21, 345]], 9, "#ffffff");
  }
  for (const x of LX) k.path([[x - LHW - 4, 40], [x + LHW + 4, 40], [x + LHW + 26, 180], [x - LHW - 14, 180]], { fill: kit === "#ffffff" ? "#2b2b30" : "#ffffff", shade: "r", smooth: false });
  const boot = k.pick(["#2b2b30", "#ff7a1a", "#9be04a", "#2ec4b6"]);
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    const m = (pts) => pts.map(([dx, dy]) => [x + d * dx, dy]);
    k.path(m([[-26, 470], [24, 470], [40, 492], [92, 500], [96, 528], [-32, 528], [-32, 490]]), { fill: boot, shade: "b", light: true });
    for (const dx of [-20, 10, 40, 70]) k.rect(x + d * dx - 6, 528, 12, 14, { r: 3, fill: "#9ca3af", w: 3 });
    k.line(m([[0, 490], [30, 506]]), 4, "#ffffff");
  }
  if (k.chance(0.6)) {
    k.circle(700, 500, 50, { fill: "#ffffff", shade: "rb" });
    k.path([[700, 480], [719, 494], [712, 516], [688, 516], [681, 494]], { fill: INK, w: 0 });
  }
}
football.humanoid = true;

function dino(k, o = {}) {
  const sk = o.skin || k.pick(["#7ad19a", "#2ec4b6", "#9be04a", "#c4a3f0", "#ff9f45"]);
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    k.path([[x - LHW, 40], [x + LHW, 40], [x + LHW + 6, 110], [x + 75, 270], [x + 70, 440], [x + 60, 520], [x - 60, 520], [x - 70, 440], [x - 75, 270], [x - LHW - 6, 110]], { fill: sk, shade: d < 0 ? "l" : "r", light: true });
    for (const dx of [-40, 0, 40]) k.path([[x + dx - 16, 520], [x + dx, 488], [x + dx + 16, 520], [x + dx + 6, 540], [x + dx - 6, 540]], { fill: "#fff4dc", w: 5 });
    for (const [dx, dy, r] of [[-30, 250, 14], [25, 310, 18], [-15, 390, 11], [35, 200, 9]]) k.circle(x + dx, dy, r, { fill: tone(sk, -0.15), w: 0 });
  }
}
dino.humanoid = false;

function clownLegs(k, o = {}) {
  const pants = clothOf(k, o, ["#ffd21f", "#2ec4b6", "#9b5de5", "#ff8fb8"]);
  const sockA = "#ffffff", sockB = k.pick(["#e63946", "#2563eb", "#2aa84a"]);
  for (const x of LX) {
    k.path([[x - 16, 300], [x + 16, 300], [x + 16, 470], [x - 16, 470]], { fill: sockA, w: 6, smooth: false });
    for (let y = 320; y < 470; y += 36) k.path([[x - 16, y], [x + 16, y], [x + 16, y + 18], [x - 16, y + 18]], { fill: sockB, w: 0, smooth: false });
    k.line([[x - 16, 300], [x - 16, 470]], 6); k.line([[x + 16, 300], [x + 16, 470]], 6);
  }
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    k.path([[x - LHW, 40], [x + LHW, 40], [x + LHW + 10, 110], [x + 75, 300], [x + 40, 325], [x, 305], [x - 40, 325], [x - 75, 300], [x - LHW - 10, 110]], { fill: pants, shade: "r", light: true });
    for (const [dx, dy] of [[-30, 220], [25, 180], [10, 270], [-8, 140], [45, 280]]) k.circle(x + dx, dy, 10, { fill: k.pick(["#e63946", "#2563eb", "#ffffff"]), w: 0 });
  }
  const shoe = k.pick(["#e63946", "#2563eb", "#2aa84a"]);
  for (const [i, x] of LX.entries()) {
    const d = i ? 1 : -1;
    k.ellipse(x + d * 60, 505, 110, 48, { fill: shoe, shade: "b", light: true });
    k.ellipse(x + d * 110, 495, 26, 16, { fill: "#ffffff", w: 0, opacity: 0.5 });
    k.path([[x - 24, 470], [x + 24, 470], [x + 20, 492], [x - 20, 492]], { fill: tone(shoe, -0.2), w: 5 });
  }
}
clownLegs.humanoid = true;

// ---------- registro ----------
/** Cuerpos y piernas: todo recortado por debajo de y = 90 (la franja de arriba es de la parte anterior) */
const big = (k, t, inv, fn) => { INV = inv; try { k.group(t, fn); } finally { INV = null; } };
const BODY_T = ["translate(450 110) scale(1.08) translate(-450 -135)", "translate(450 135) scale(0.9259259) translate(-450 -110)"];
const HEAD_T = ["translate(450 30) scale(1.08) translate(-450 -30)", "translate(450 30) scale(0.9259259) translate(-450 -30)"];
const below90 = (fn, T) => {
  const g = (k, opts = {}) => clipBelow(k, 90, () => (T ? big(k, T[0], T[1], () => fn(k, opts || {})) : fn(k, opts || {})));
  g.key = fn.name;
  g.humanoid = fn.humanoid;
  return g;
};
const asHead = (fn) => {
  const g = (k, opts = {}) => big(k, HEAD_T[0], HEAD_T[1], () => fn(k, opts || {}));
  g.key = fn.name;
  g.humanoid = fn.humanoid;
  return g;
};

module.exports = {
  head: [cat, dog, frog, owl, lion, robotHead, alien, knight, princess, pirate, astronaut, octopus, fish, strawberry, cake, monsterHead, bear, clown].map(asHead),
  body: [suit, hero, dress, armour, jumper, robotBody, fishBody, octoBody, tutu, spacesuit, pirateCoat, hairy, dungarees, bee, hawaiian].map((f) => below90(f, BODY_T)),
  legs: [trousers, ballet, chicken, robotLegs, rollerSkates, mermaid, frogLegs, boots, flippers, skeleton, stilts, football, dino, clownLegs].map((f) => below90(f)),
};
