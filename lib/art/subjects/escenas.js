// Lugares, naturaleza y personas (ilustraciones de los robots)
// Lienzo vertical 600 × 900. Orden: fondo → atrás → cuerpo → detalles → cara.

// ───────────────────────── utilidades ─────────────────────────
const hx = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => {
  const A = hx(a), B = hx(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("");
};
const PI = Math.PI;

/** Cielo degradado en bandas (de y0 a y1) */
function sky(k, top, bottom, y1 = 900, n = 7) {
  k.bg(top);
  const h = y1 / n;
  for (let i = 1; i < n; i++) k.rect(-20, i * h, k.W + 40, h + 3, { r: 0, fill: mix(top, bottom, i / (n - 1)), w: 0, raw: true });
}
/** Puntos de una estrella */
function starPts(cx, cy, ro, ri, n = 5, rot = -90) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * PI) / 180, r = i % 2 ? ri : ro;
    p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return p;
}
function star(k, cx, cy, r, fill = "#ffd21f", o = {}) {
  return k.path(starPts(cx, cy, r, r * 0.48, 5, o.rot ?? -90), Object.assign({ fill, smooth: false, w: o.w ?? 4, light: o.light }, o));
}
/** Elipse con bultos (copas de árbol, humo, arbustos) */
function bumpy(cx, cy, rx, ry, nb = 8, amp = 0.12, ph = 0) {
  const p = [];
  const N = nb * 4;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * PI * 2 + ph;
    const b = 1 + amp * Math.abs(Math.sin((t - ph) * nb / 2));
    p.push([cx + Math.cos(t) * rx * b, cy + Math.sin(t) * ry * b]);
  }
  return p;
}
/** Media luna: círculo (cx,cy,r) menos otro círculo desplazado */
function crescentPts(cx, cy, r, dx, dy, r2) {
  const ic = [cx + dx, cy + dy], phi = Math.atan2(dy, dx), N = 48;
  const outer = [], inner = [];
  for (let i = 0; i <= N; i++) {
    const a = phi + (i / N) * PI * 2;
    const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    if (Math.hypot(p[0] - ic[0], p[1] - ic[1]) > r2) outer.push(p);
    const q = [ic[0] + Math.cos(a) * r2, ic[1] + Math.sin(a) * r2];
    if (Math.hypot(q[0] - cx, q[1] - cy) < r) inner.push(q);
  }
  return outer.concat(inner.reverse());
}
/** Pino (con nieve opcional) */
function pine(k, x, base, h, col = "#2f8f5b", snow = false) {
  k.rect(x - h * 0.05, base - h * 0.2, h * 0.1, h * 0.22, { r: 3, fill: "#7c4a1e", w: 4 });
  const L = [[0.12, 0.36, 0.58], [0.36, 0.29, 0.8], [0.58, 0.21, 1]];
  for (const [yb, wd, tp] of L) {
    k.path([[x - h * wd, base - h * yb], [x, base - h * tp], [x + h * wd, base - h * yb]], { fill: col, smooth: false, w: 5, shade: "r", shadeK: 0.2 });
    if (snow) k.path([[x - h * wd * 0.42, base - h * (tp - (tp - yb) * 0.4)], [x, base - h * tp], [x + h * wd * 0.42, base - h * (tp - (tp - yb) * 0.4)], [x + h * wd * 0.15, base - h * (tp - (tp - yb) * 0.32)], [x - h * wd * 0.1, base - h * (tp - (tp - yb) * 0.45)]], { fill: "#ffffff", smooth: false, w: 3 });
  }
}
/** Árbol redondo */
function roundTree(k, x, base, h, col = "#3aa55b") {
  k.path([[x - h * 0.07, base], [x - h * 0.05, base - h * 0.5], [x + h * 0.05, base - h * 0.5], [x + h * 0.07, base]], { fill: "#8b5a2b", w: 5, shade: "r" });
  k.path(bumpy(x, base - h * 0.62, h * 0.32, h * 0.3, 7, 0.1), { fill: col, shade: "rb", light: true, w: 5 });
}
/** Arbusto */
function bush(k, x, y, s, col = "#3aa55b") {
  k.path(bumpy(x, y, 70 * s, 40 * s, 6, 0.14), { fill: col, shade: "b", w: 5 });
}
/** Llama */
function flame(k, x, base, s = 1, outer = "#ff7a1a", inner = "#ffd21f") {
  k.path([[x - 42 * s, base], [x - 52 * s, base - 50 * s], [x - 28 * s, base - 108 * s], [x - 14 * s, base - 72 * s], [x, base - 150 * s], [x + 20 * s, base - 88 * s], [x + 36 * s, base - 122 * s], [x + 54 * s, base - 52 * s], [x + 42 * s, base]], { fill: outer, w: 5 });
  k.path([[x - 24 * s, base], [x - 28 * s, base - 40 * s], [x - 8 * s, base - 82 * s], [x + 4 * s, base - 54 * s], [x + 16 * s, base - 78 * s], [x + 30 * s, base - 38 * s], [x + 24 * s, base]], { fill: inner, w: 0 });
}
/** Flor pequeña de adorno */
function miniFlower(k, x, y, s = 1, col) {
  col = col || k.pick(["#ff8fb8", "#ffd21f", "#ffffff", "#9b5de5", "#ff7a1a"]);
  k.line([[x, y], [x, y + 30 * s]], 4, "#2a8a4a");
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    k.circle(x + Math.cos(a) * 9 * s, y + Math.sin(a) * 9 * s, 8 * s, { fill: col, w: 3 });
  }
  k.dot(x, y, 6 * s, "#ffb300");
}
/** Murciélago */
function bat(k, x, y, s = 1, col = "#2a2140") {
  const p = [[-60, 0], [-46, -16], [-30, -10], [-16, -20], [-8, -8], [-6, -18], [0, -11], [6, -18], [8, -8], [16, -20], [30, -10], [46, -16], [60, 0], [46, -2], [38, 10], [28, 2], [18, 14], [8, 6], [0, 12], [-8, 6], [-18, 14], [-28, 2], [-38, 10], [-46, -2]];
  k.path(p.map(([a, b]) => [x + a * s, y + b * s]), { fill: col, smooth: false, w: 3 });
  if (s > 0.6) { k.dot(x - 4 * s, y - 6 * s, 2.5 * s, "#ffe066"); k.dot(x + 4 * s, y - 6 * s, 2.5 * s, "#ffe066"); }
}
/** Gaviota (uve curva) */
function gull(k, x, y, s = 1) {
  k.line([[x - 22 * s, y - 4 * s], [x - 10 * s, y - 10 * s], [x, y]], 4);
  k.line([[x, y], [x + 10 * s, y - 10 * s], [x + 22 * s, y - 4 * s]], 4);
}
/** Calabaza de Halloween */
function pumpkin(k, x, y, s = 1, lit = true) {
  k.path([[x - 6 * s, y - 50 * s], [x - 2 * s, y - 72 * s], [x + 12 * s, y - 76 * s], [x + 8 * s, y - 48 * s]], { fill: "#3f7a2b", w: 4 });
  k.ellipse(x - 30 * s, y, 34 * s, 50 * s, { fill: "#f57c1f", w: 5, shade: "l" });
  k.ellipse(x + 30 * s, y, 34 * s, 50 * s, { fill: "#f57c1f", w: 5, shade: "r" });
  k.ellipse(x, y, 34 * s, 54 * s, { fill: "#ff8f2e", w: 5, light: true });
  if (lit) {
    const f = "#ffd54a";
    k.path([[x - 32 * s, y - 8 * s], [x - 20 * s, y - 28 * s], [x - 8 * s, y - 8 * s]], { fill: f, smooth: false, w: 3 });
    k.path([[x + 8 * s, y - 8 * s], [x + 20 * s, y - 28 * s], [x + 32 * s, y - 8 * s]], { fill: f, smooth: false, w: 3 });
    k.path([[x - 36 * s, y + 10 * s], [x - 20 * s, y + 18 * s], [x - 10 * s, y + 12 * s], [x, y + 22 * s], [x + 10 * s, y + 12 * s], [x + 20 * s, y + 18 * s], [x + 36 * s, y + 10 * s], [x + 20 * s, y + 34 * s], [x - 20 * s, y + 34 * s]], { fill: f, smooth: false, w: 3 });
  }
}
/** Coche visto de lado */
function car(k, x, y, s = 1, col = "#e63946") {
  k.path([[x - 70 * s, y], [x - 72 * s, y - 30 * s], [x - 40 * s, y - 36 * s], [x - 24 * s, y - 64 * s], [x + 30 * s, y - 64 * s], [x + 48 * s, y - 36 * s], [x + 74 * s, y - 30 * s], [x + 74 * s, y]], { fill: col, w: 5, shade: "b", light: true });
  k.path([[x - 18 * s, y - 38 * s], [x - 12 * s, y - 56 * s], [x + 4 * s, y - 56 * s], [x + 4 * s, y - 38 * s]], { fill: "#cfeeff", smooth: false, w: 3 });
  k.path([[x + 12 * s, y - 38 * s], [x + 12 * s, y - 56 * s], [x + 26 * s, y - 56 * s], [x + 38 * s, y - 38 * s]], { fill: "#cfeeff", smooth: false, w: 3 });
  for (const wx of [-40, 44]) { k.circle(x + wx * s, y, 17 * s, { fill: "#2b2b30", w: 4 }); k.dot(x + wx * s, y, 7 * s, "#c9ccd3"); }
  k.dot(x + 70 * s, y - 22 * s, 5 * s, "#ffe066");
}

// ───────────────────────── personas ─────────────────────────
const HAIRS = ["#2b1d16", "#4a2e1f", "#6b3f22", "#b5652b", "#e3b55f", "#1f1f24", "#8a4b2a"];
const FEM = ["long", "bob", "ponytail", "buns", "braids", "curly", "long"];
const MASC = ["short", "side", "spiky", "curly", "afro", "short"];

/**
 * Persona simpática (cabeza grande, cuerpo sencillo). Cabeza centrada en (x, y), escala s.
 * o: { skin, hair, style, fem, top, sleeve, bottom, shoe, skirt, dress, shorts, legCol,
 *      handL, handR, footL, footR, mouth, look, lashes, glasses, beard, moustache, patch,
 *      back(H), outfit(H), hat(H), prop(H), front(H), gloves, noEars }
 */
function person(k, o = {}) {
  const s = o.s || 1, X = o.x ?? 300, Y = o.y ?? 250;
  const P = (dx, dy) => [X + dx * s, Y + dy * s];
  const PS = (arr) => arr.map(([a, b]) => P(a, b));
  const fem = o.fem ?? k.chance(0.5);
  const skin = o.skin || k.col("skin");
  const hair = o.hair || k.pick(HAIRS);
  const style = o.style || k.pick(fem ? FEM : MASC);
  const top = o.top || k.pick(["#3b82f6", "#e63946", "#2ec4b6", "#ffcf33", "#9b5de5", "#ff8fb8", "#38b25a", "#ff7a1a"]);
  const sleeve = o.sleeve || top;
  const bottom = o.bottom || k.pick(["#1f2d66", "#3a4b8c", "#5a3a2a", "#4b5563"]);
  const shoe = o.shoe || k.pick(["#3a2a20", "#1f1f24", "#e63946", "#ffffff"]);
  const H = { k, s, X, Y, P, PS, skin, hair, top, bottom, fem, style };
  const handL = P(...(o.handL || [-128, 300])), handR = P(...(o.handR || [128, 300]));
  const footL = P(...(o.footL || [-48, 468])), footR = P(...(o.footR || [48, 468]));
  H.handL = handL; H.handR = handR;

  if (o.back) o.back(H);
  // pelo de detrás
  if (style === "long") k.path(PS([[-96, -70], [-122, 30], [-134, 170], [-100, 205], [100, 205], [134, 170], [122, 30], [96, -70], [0, -112]]), { fill: hair, shade: "r" });
  if (style === "bob") k.path(PS([[-104, -60], [-126, 30], [-124, 100], [-90, 112], [90, 112], [124, 100], [126, 30], [104, -60], [0, -114]]), { fill: hair, shade: "r" });
  if (style === "afro") k.path(bumpy(X, Y - 30 * s, 150 * s, 136 * s, 10, 0.07), { fill: hair, shade: "r", light: true });
  if (style === "ponytail") k.tube(PS([[70, -80], [140, -60], [160, 20], [140, 110]]), 46 * s, hair);
  if (style === "buns") for (const sx of [-1, 1]) k.circle(...P(sx * 82, -86), 40 * s, { fill: hair, shade: "r" });
  if (style === "braids") for (const sx of [-1, 1]) {
    k.tube(PS([[sx * 92, 0], [sx * 112, 90], [sx * 108, 170]]), 30 * s, hair);
    k.circle(...P(sx * 108, 178), 12 * s, { fill: o.tie || "#ff8fb8", w: 4 });
  }

  // piernas
  const legCol = o.legCol || (o.skirt || o.dress || o.shorts ? skin : bottom);
  const hipL = P(-44, 330), hipR = P(44, 330);
  for (const [hp, ft] of [[hipL, footL], [hipR, footR]]) k.tube([hp, [(hp[0] * 0.5 + ft[0] * 0.5), (hp[1] + ft[1]) / 2], ft], 50 * s, legCol);
  if (o.socks) for (const ft of [footL, footR]) k.rect(ft[0] - 27 * s, ft[1] - 60 * s, 54 * s, 58 * s, { r: 6, fill: o.socks, w: 5 });
  if (!o.noShoes) for (const [ft, sx] of [[footL, -1], [footR, 1]]) k.ellipse(ft[0] + sx * 10 * s, ft[1] + 14 * s, 40 * s, 20 * s, { fill: shoe, shade: "b", light: true, w: 5 });
  // caderas / pantalón / falda
  if (!o.skirt && !o.dress) k.rect(...P(-92, 296), 184 * s, (o.shorts ? 100 : 66) * s, { r: 14 * s, fill: bottom, w: 6, shade: "b" });
  // cuello
  k.rect(...P(-26, 60), 52 * s, 56 * s, { r: 8, fill: skin, w: 5 });
  // torso
  if (o.dress) k.path(PS([[-58, 92], [-96, 122], [-104, 220], [-140, 420], [0, 432], [140, 420], [104, 220], [96, 122], [58, 92]]), { fill: top, shade: "r", light: true });
  else k.path(PS([[-58, 92], [-96, 122], [-104, 220], [-96, 334], [0, 340], [96, 334], [104, 220], [96, 122], [58, 92]]), { fill: top, shade: "r", light: true });
  if (o.skirt) k.path(PS([[-96, 300], [96, 300], [134, 410], [0, 420], [-134, 410]]), { fill: o.skirt, shade: "r" });
  if (o.outfit) o.outfit(H);
  // orejas y cabeza
  if (!o.noEars) for (const sx of [-1, 1]) k.ellipse(...P(sx * 98, 14), 18 * s, 24 * s, { fill: skin, w: 5 });
  k.ellipse(...P(0, 0), 100 * s, 96 * s, { fill: skin, shade: "r", shadeK: 0.07, w: 6 });
  // cara
  const look = o.look || [0, 0.1];
  const eyeY = 8;
  if (o.patch) {
    k.eye(...P(-36, eyeY), 15 * s, { look });
    k.line(PS([[-100, -40], [36, eyeY], [96, -10]]), 5);
    k.ellipse(...P(36, eyeY + 2), 26 * s, 22 * s, { fill: "#1f1f24", w: 4 });
  } else if (o.closedEyes) for (const sx of [-1, 1]) k.eye(...P(sx * 36, eyeY), 15 * s, { closed: true });
  else for (const sx of [-1, 1]) k.eye(...P(sx * 36, eyeY), 15 * s, { look });
  if (o.lashes ?? fem) for (const sx of [-1, 1]) k.line(PS([[sx * 48, eyeY - 10], [sx * 58, eyeY - 18]]), 4);
  if (!k.drop()) for (const sx of [-1, 1]) k.arc(...P(sx * 36, eyeY - 4), 24 * s, 1.25 * PI, 1.75 * PI, 5, o.brow || k.tone(hair, -0.2));
  k.arc(...P(0, 22), 8 * s, 0.1 * PI, 0.9 * PI, 4);
  if (o.glasses) {
    for (const sx of [-1, 1]) k.circle(...P(sx * 38, eyeY + 2), 27 * s, { fill: "none", w: 5 });
    k.line(PS([[-12, eyeY], [12, eyeY]]), 5);
  }
  k.cheeks(P(-60, 34)[0], P(60, 34)[0], P(0, 34)[1], 14 * s);
  if (o.beard) k.path(PS([[-90, 20], [-80, 80], [-40, 118], [0, 128], [40, 118], [80, 80], [90, 20], [60, 56], [20, 52], [0, 60], [-20, 52], [-60, 56]]), { fill: o.beard, shade: "b", w: 5 });
  if (o.moustache) for (const sx of [-1, 1]) k.ellipse(...P(sx * 18, 38), 22 * s, 11 * s, { fill: o.moustache, w: 4, rot: sx * 12 });
  if (!o.beard) k.mouth(...P(0, 52), 46 * s, o.mouth || "smile");
  else k.mouth(...P(0, 70), 40 * s, o.mouth || "smile");

  // pelo de delante
  const cap = {
    short: [[-104, 10], [-112, -40], [-84, -92], [-25, -118], [35, -116], [88, -90], [112, -40], [104, 10], [96, -26], [70, -48], [30, -56], [-10, -50], [-50, -58], [-86, -34]],
    side: [[-104, 26], [-112, -40], [-84, -94], [-25, -120], [35, -118], [90, -90], [112, -40], [104, 6], [94, -40], [56, -64], [0, -56], [-50, -34], [-92, 4]],
    spiky: [[-104, 6], [-118, -58], [-96, -86], [-96, -128], [-56, -112], [-30, -150], [4, -118], [40, -148], [56, -110], [100, -122], [96, -82], [118, -58], [104, 6], [94, -32], [56, -50], [16, -42], [-24, -54], [-62, -42], [-92, -26]],
    long: [[-104, 30], [-112, -40], [-84, -94], [-25, -120], [35, -118], [90, -92], [112, -40], [104, 30], [92, -18], [60, -50], [10, -54], [-24, -38], [-50, -56], [-88, -22]],
  };
  const st = style;
  if (st === "curly" || st === "afro") k.path(bumpy(X, Y - 66 * s, 116 * s, 62 * s, 9, 0.12), { fill: hair, shade: "r", light: true, w: 6 });
  else if (st === "bald") { for (const sx of [-1, 1]) k.ellipse(...P(sx * 96, -12), 18 * s, 34 * s, { fill: hair, w: 5 }); }
  else if (st === "bun") {
    k.circle(...P(0, -112), 46 * s, { fill: hair, shade: "r", light: true });
    k.path(PS(cap.long), { fill: hair, shade: "r", light: true });
  } else k.path(PS(cap[st] || cap[st === "short" || st === "side" || st === "spiky" ? st : "long"]), { fill: hair, shade: "r", light: true, smooth: st !== "spiky" });
  if (st === "ponytail" && !k.drop()) k.ellipse(...P(84, -78), 14 * s, 18 * s, { fill: o.tie || "#ff8fb8", w: 4 });
  if (o.hat) o.hat(H);

  // brazos
  for (const [sh, hd, sx, el] of [[P(-86, 130), handL, -1, o.elbowL], [P(86, 130), handR, 1, o.elbowR]]) {
    const e = el ? P(...el) : [(sh[0] + hd[0]) / 2 + sx * 24 * s, (sh[1] + hd[1]) / 2];
    k.tube([sh, e, hd], 38 * s, sleeve);
  }
  if (o.prop) o.prop(H);
  for (const hd of [handL, handR]) k.circle(hd[0], hd[1], 24 * s, { fill: o.gloves || skin, w: 5 });
  if (o.front) o.front(H);
  return H;
}
/** Persona aleatoria con datos de peinado/sexo coherentes */
function randomLook(k, extra = {}) {
  const fem = extra.fem ?? k.chance(0.5);
  return Object.assign({ fem, skin: k.col("skin"), hair: k.pick(HAIRS), style: k.pick(fem ? FEM : MASC) }, extra);
}

// ───────────────────────── temas ─────────────────────────
const SUBJECTS = [
  // ── CASA ──
  {
    key: "casa",
    words: ["casa", "pueblo", "cabaña", "hogar", "casita", "chimenea", "vivienda"],
    name: "Una casa",
    draw(k) {
      const t = k.pick(["dia", "dia", "tarde", "noche"]);
      const cabin = k.chance(0.35);
      const night = t === "noche";
      if (t === "dia") sky(k, "#8fd0f5", "#e2f4ff", 640);
      else if (t === "tarde") sky(k, "#ff9e7a", "#ffe1a8", 640);
      else sky(k, "#1b2350", "#3d4a8a", 640);
      if (night) { k.stars(14, [0, 0, 600, 360]); k.path(crescentPts(110, 120, 52, 24, -12, 46), { fill: "#fff3b0", w: 5 }); }
      else { k.circle(100, 120, 56, { fill: t === "tarde" ? "#ffb347" : "#ffd84a", w: 5, light: true }); k.cloud(520, 250, 0.55); }
      // colinas
      const hill = night ? "#2f5a4a" : t === "tarde" ? "#9cc56a" : "#8fd47a";
      k.ellipse(90, 660, 280, 150, { fill: k.tone(hill, -0.08), w: 5 });
      k.ellipse(560, 670, 260, 130, { fill: k.tone(hill, -0.08), w: 5 });
      k.ground(650, night ? "#3e6e57" : "#6cc46a", { wave: 8 });
      if (!k.drop()) roundTree(k, 520, 660, 300, night ? "#2f6b4a" : "#3aa55b");
      // casa
      const wall = cabin ? "#b07842" : k.pick(["#fff1d6", "#ffd6a5", "#cfe8ff", "#ffe0ea", "#fff8b8"]);
      const roof = cabin ? k.pick(["#6b3f22", "#3f6b4a"]) : k.pick(["#e63946", "#d9573b", "#3b6fd8", "#7a4bc2"]);
      k.rect(375, 250, 48, 110, { r: 4, fill: cabin ? "#8b8f99" : "#c0624a", w: 5, shade: "r" });
      if (!k.drop()) for (let i = 0; i < 3; i++) k.circle(408 + i * 22, 220 - i * 46, 18 + i * 7, { fill: night ? "#9aa3c7" : "#eef2f7", w: 4, opacity: 0.95 });
      k.rect(140, 410, 320, 250, { r: 0, fill: wall, shade: "r", w: 6 });
      if (cabin) for (let y = 440; y < 660; y += 34) k.line([[146, y], [454, y]], 4, k.tone(wall, -0.35));
      else if (!k.drop()) for (let i = 0; i < 6; i++) { const bx = k.R(160, 430), by = k.R(430, 640); k.line([[bx, by], [bx + 22, by]], 4, k.tone(wall, -0.15)); }
      k.path([[110, 420], [300, 220], [490, 420]], { fill: roof, shade: "r", smooth: false, w: 6 });
      if (!k.drop()) for (const f of [0.35, 0.65]) k.line([[300 - 190 * f + 10, 220 + 200 * f], [300 + 190 * f - 10, 220 + 200 * f]], 4, k.tone(roof, -0.3));
      // ventana del desván
      const glass = night ? "#ffd96a" : "#bfe6ff";
      k.circle(300, 345, 30, { fill: glass, w: 5, light: !night });
      k.line([[270, 345], [330, 345]], 4); k.line([[300, 315], [300, 375]], 4);
      // puerta
      const door = k.pick(["#3b82f6", "#2aa84a", "#8b5a2b", "#e63946"]);
      k.rect(262, 520, 76, 140, { r: 36, fill: door, w: 6, shade: "r" });
      k.dot(322, 595, 6, "#ffd21f");
      k.rect(250, 652, 100, 14, { r: 5, fill: "#b9b1a6", w: 4 });
      // ventanas
      for (const wx of [165, 365]) {
        k.rect(wx, 465, 74, 74, { r: 6, fill: glass, w: 6, light: !night });
        k.line([[wx + 37, 465], [wx + 37, 539]], 5); k.line([[wx, 502], [wx + 74, 502]], 5);
        if (!cabin && !k.drop()) {
          k.rect(wx - 6, 539, 86, 18, { r: 4, fill: "#8b5a2b", w: 4 });
          for (let i = 0; i < 4; i++) k.circle(wx + 6 + i * 21, 534, 9, { fill: k.pick(["#ff8fb8", "#e63946", "#ffd21f"]), w: 3 });
        }
        if (night && !k.drop()) k.ellipse(wx + 37, 502, 70, 60, { fill: "#ffe680", w: 0, opacity: 0.18 });
      }
      // camino y valla
      k.path([[262, 666], [338, 666], [400, 905], [200, 905]], { fill: night ? "#a89a83" : "#ecd7ad", w: 5 });
      if (!k.drop()) for (const [a, b] of [[10, 220], [380, 590]]) {
        k.line([[a - 10, 735], [b + 10, 735]], 5, "#5a3a2a"); k.rect(a - 10, 728, b - a + 20, 12, { r: 3, fill: "#fff", w: 4 });
        for (let x = a; x <= b; x += 38) k.path([[x - 12, 820], [x - 12, 715], [x, 700], [x + 12, 715], [x + 12, 820]], { fill: "#ffffff", smooth: false, w: 4 });
        k.rect(a - 10, 770, b - a + 20, 12, { r: 3, fill: "#fff", w: 4 });
      }
      if (!k.drop()) for (let i = 0; i < 6; i++) miniFlower(k, k.pick([k.R(30, 190), k.R(420, 570)]), k.R(830, 860), 0.9);
    },
  },
  // ── CASTILLO ──
  {
    key: "castillo",
    words: ["castillo", "princesa", "príncipe", "rey", "reina", "dragón", "torre", "reino", "caballero", "fortaleza"],
    name: "Un castillo",
    draw(k) {
      const pink = k.chance(0.4);
      const sunset = k.chance(0.35);
      if (sunset) sky(k, "#b07cd6", "#ffc7a0", 700); else sky(k, "#8fd0f5", "#e6f6ff", 700);
      if (!sunset) { k.circle(66, 86, 40, { fill: "#ffd84a", w: 5, light: true }); k.cloud(560, 290, 0.5); k.cloud(40, 300, 0.45); }
      else k.stars(6, [0, 0, 600, 220]);
      k.ellipse(120, 720, 300, 170, { fill: sunset ? "#7fae6a" : "#86cf74", w: 5 });
      k.ellipse(520, 720, 260, 150, { fill: sunset ? "#7fae6a" : "#86cf74", w: 5 });
      const stone = pink ? k.pick(["#f6c9d6", "#f3d1e6"]) : k.pick(["#cfc8c0", "#e6d3a8", "#c9ced8"]);
      const roof = pink ? k.pick(["#9b5de5", "#ff6f9f", "#5b8def"]) : k.pick(["#e63946", "#2f6fe0", "#7a4bc2"]);
      const dark = k.tone(stone, -0.35);
      const flagC = k.pick(["#ffd21f", "#e63946", "#2ec4b6", "#ff8fb8"]);
      const flag = (x, y) => { k.line([[x, y], [x, y - 70]], 5); k.path([[x, y - 70], [x + 48, y - 58], [x, y - 44]], { fill: flagC, w: 4 }); };
      const merlons = (x0, x1, y) => { for (let x = x0; x <= x1 - 24; x += 40) k.rect(x, y - 26, 26, 30, { r: 3, fill: stone, w: 5 }); };
      // torre del homenaje
      merlons(220, 385, 330);
      k.rect(215, 320, 170, 200, { r: 0, fill: stone, w: 6, shade: "r" });
      k.path([[200, 325], [300, 140], [400, 325]], { fill: roof, w: 6, smooth: false, shade: "r" });
      if (!k.drop()) flag(300, 145);
      k.rect(282, 380, 36, 60, { r: 18, fill: "#3a2a4a", w: 5 });
      // muralla
      merlons(140, 470, 480);
      k.rect(130, 470, 340, 250, { r: 0, fill: stone, w: 6, shade: "r" });
      // torres laterales
      for (const tx of [80, 410]) {
        k.rect(tx, 380, 110, 340, { r: 0, fill: stone, w: 6, shade: "r" });
        k.path([[tx - 18, 388], [tx + 55, 190], [tx + 128, 388]], { fill: roof, w: 6, smooth: false, shade: "r" });
        if (!k.drop()) flag(tx + 55, 196);
        k.rect(tx + 40, 450, 30, 54, { r: 15, fill: "#3a2a4a", w: 5 });
        if (!k.drop()) k.rect(tx + 40, 580, 30, 46, { r: 15, fill: "#3a2a4a", w: 5 });
      }
      // ladrillos
      if (!k.drop()) for (let i = 0; i < 14; i++) { const bx = k.pick([k.R(95, 160), k.R(200, 400), k.R(425, 495)]), by = k.R(400, 700); k.rect(bx, by, 30, 14, { r: 3, fill: "none", w: 3, stroke: dark }); }
      // puerta
      k.rect(245, 575, 110, 145, { r: 55, fill: "#6b3f22", w: 6 });
      if (!k.drop()) { for (const x of [270, 300, 330]) k.line([[x, 585], [x, 718]], 4); for (const y of [615, 655, 695]) k.line([[250, y], [350, y]], 4); }
      // foso y puente
      k.path([[-30, 735], [620, 735], [620, 800], [-30, 800]], { fill: "#5aa9e6", w: 5, smooth: false });
      if (!k.drop()) for (const x of [60, 470]) k.line([[x, 768], [x + 30, 760], [x + 60, 768]], 4, "#d6efff");
      k.path([[245, 720], [355, 720], [375, 810], [225, 810]], { fill: "#a06a3a", w: 5, smooth: false });
      for (const y of [745, 775]) k.line([[238, y], [364, y]], 4, "#6b3f22");
      k.ground(800, "#6cc46a", { wave: 6 });
      if (!k.drop()) for (let i = 0; i < 5; i++) miniFlower(k, k.R(30, 570), k.R(830, 860), 0.8);
      // dragón simpático (a veces)
      if (k.chance(0.4)) {
        const dx = 500, dy = 130, g = "#5cc46a";
        k.path([[dx - 10, dy], [dx - 50, dy - 50], [dx - 20, dy - 20], [dx - 40, dy - 70], [dx + 10, dy - 10]], { fill: "#9be04a", w: 4 });
        k.tube([[dx + 30, dy + 10], [dx + 70, dy + 30], [dx + 90, dy + 10]], 14, g);
        k.ellipse(dx + 15, dy + 10, 38, 26, { fill: g, w: 5, shade: "b" });
        k.circle(dx - 25, dy - 12, 24, { fill: g, w: 5 });
        k.eye(dx - 28, dy - 18, 7);
        k.dot(dx - 44, dy - 6, 3);
        if (!k.drop()) { k.path([[dx - 50, dy - 4], [dx - 90, dy - 16], [dx - 80, dy + 2], [dx - 96, dy + 12], [dx - 50, dy + 6]], { fill: "#ff9f45", w: 3 }); }
      }
    },
  },
  // ── ÁRBOL ──
  {
    key: "arbol",
    words: ["árbol", "arbol", "bosque", "otoño", "parque", "hojas", "manzano", "columpio"],
    name: "Un árbol",
    draw(k) {
      const season = k.pick(["verano", "otono", "primavera"]);
      const leaf = { verano: k.pick(["#3aa55b", "#45b05f"]), otono: k.pick(["#f08a24", "#e8692c", "#f2a93b"]), primavera: "#7fcf6a" }[season];
      if (season === "otono") sky(k, "#ffd9a8", "#fff3dc", 720); else sky(k, "#9ad6f5", "#e8f7ff", 720);
      k.cloud(110, 110, 0.7); k.cloud(500, 160, 0.55);
      if (!k.drop()) { bush(k, 70, 720, 1.2, k.tone(leaf, -0.15)); bush(k, 540, 715, 1.1, k.tone(leaf, -0.15)); }
      k.ground(720, season === "otono" ? "#b6c85a" : "#6cc46a", { wave: 10 });
      // tronco con ramas
      const bark = "#8b5a2b";
      k.path([[240, 770], [262, 740], [270, 590], [240, 470], [180, 400], [200, 385], [266, 440], [282, 360], [318, 360], [326, 440], [392, 380], [414, 396], [344, 480], [332, 590], [340, 740], [362, 770]], { fill: bark, shade: "r", w: 6 });
      if (!k.drop()) { k.arc(300, 640, 22, 0.2 * PI, 0.8 * PI, 4, "#5a3a1a"); k.line([[285, 520], [292, 560]], 4, "#5a3a1a"); }
      // copa
      const cx = 300, cy = 300;
      k.path(bumpy(cx, cy, 245, 205, 9, 0.12, 0.2), { fill: leaf, shade: "rb", light: true, w: 6 });
      if (!k.drop()) for (const [a, b, r] of [[200, 230, 55], [380, 220, 50], [250, 380, 45], [400, 350, 40], [300, 170, 45]]) k.path(bumpy(a, b, r, r * 0.8, 5, 0.18), { fill: k.tone(leaf, 0.14), w: 0 });
      if (season === "verano") {
        if (!k.drop()) for (const [a, b] of [[190, 300], [270, 230], [360, 300], [420, 240], [230, 400], [330, 410], [440, 380], [160, 220]]) { k.circle(a, b, 17, { fill: "#e63946", w: 4, light: true }); k.line([[a, b - 16], [a + 4, b - 26]], 4); }
      } else if (season === "primavera") {
        if (!k.drop()) for (let i = 0; i < 16; i++) { const a = k.R(0, PI * 2), r = k.R(0, 0.85); miniFlower(k, cx + Math.cos(a) * 210 * r, cy + Math.sin(a) * 170 * r, 0.95, k.pick(["#ffc2da", "#ffffff"])); }
      } else {
        for (let i = 0; i < 9; i++) {
          if (k.drop()) continue;
          const x = k.R(40, 560), y = k.R(560, 860), c = k.pick(["#e8692c", "#f2a93b", "#d64545", "#ffcf33"]);
          k.ellipse(x, y, 16, 9, { fill: c, w: 3, rot: k.R(-60, 60) });
        }
      }
      // extras de parque
      const extra = k.pick(["columpio", "banco", "pajaro", "nada"]);
      if (extra === "columpio") {
        k.line([[400, 470], [400, 660]], 4); k.line([[470, 455], [470, 660]], 4);
        k.rect(385, 655, 100, 18, { r: 5, fill: "#e63946", w: 4 });
      } else if (extra === "banco") {
        k.rect(40, 690, 150, 18, { r: 5, fill: "#a06a3a", w: 4 }); k.rect(40, 660, 150, 18, { r: 5, fill: "#a06a3a", w: 4 });
        k.line([[55, 708], [55, 750]], 6); k.line([[175, 708], [175, 750]], 6);
      } else if (extra === "pajaro") {
        k.ellipse(420, 520, 26, 20, { fill: "#3b82f6", w: 4, shade: "b" }); k.circle(440, 506, 13, { fill: "#3b82f6", w: 4 });
        k.path([[452, 504], [464, 508], [452, 512]], { fill: "#ffb300", w: 3, smooth: false }); k.dot(442, 503, 3);
      }
      if (!k.drop()) k.grass(780, 6, "#2a8a4a");
    },
  },
  // ── FLOR ──
  {
    key: "flor",
    words: ["flor", "flores", "margarita", "girasol", "rosa", "tulipán", "primavera", "jardín", "ramo", "maceta"],
    name: "Una flor",
    draw(k) {
      const type = k.pick(["margarita", "girasol", "tulipan", "rosa"]);
      const pot = k.chance(0.45);
      sky(k, k.pick(["#bfe6ff", "#fde7ef", "#e9f6dc"]), "#fffaf0", 900);
      if (!k.drop()) k.circle(500, 110, 48, { fill: "#ffe680", w: 5, light: true });
      if (!pot) { k.ground(760, "#7ad19a", { wave: 10 }); }
      else { k.rect(-20, 790, 640, 130, { r: 0, fill: "#d9b48a", w: 5 }); }
      // tallo y hojas
      const stem = "#3e9a4a";
      const topY = type === "rosa" || type === "tulipan" ? 330 : 300;
      k.tube([[300, 820], [285, 620], [305, topY]], 22, stem);
      k.path([[292, 640], [190, 560], [160, 600], [230, 650]], { fill: "#4cb35a", shade: "b", w: 5 });
      k.path([[296, 560], [400, 480], [430, 520], [350, 570]], { fill: "#4cb35a", shade: "b", w: 5 });
      if (!k.drop()) { k.line([[290, 638], [190, 575]], 3, "#2a6b33"); k.line([[298, 556], [415, 495]], 3, "#2a6b33"); }
      const cx = 305, cy = topY;
      if (type === "margarita" || type === "girasol") {
        const sun = type === "girasol";
        const pc = sun ? "#ffcf2f" : "#ffffff";
        const n = sun ? 16 : 14;
        if (sun) for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + 0.2; k.ellipse(cx + Math.cos(a) * 145, cy + Math.sin(a) * 145, 54, 22, { fill: "#f5a623", w: 5, rot: (a * 180) / PI }); }
        for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; k.ellipse(cx + Math.cos(a) * 120, cy + Math.sin(a) * 120, 62, 26, { fill: pc, w: 5, rot: (a * 180) / PI, shade: "b", shadeK: 0.2 }); }
        const cc = sun ? "#7c4a1e" : "#ffcf33";
        k.circle(cx, cy, sun ? 92 : 70, { fill: cc, shade: "rb", light: true, w: 6 });
        if (sun && !k.drop()) for (let i = 0; i < 26; i++) { const a = i * 2.4, r = 10 * Math.sqrt(i) * 1.5; k.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4, "#4a2a10"); }
        if (k.chance(0.5)) {
          k.eye(cx - 26, cy - 8, 13); k.eye(cx + 26, cy - 8, 13);
          k.mouth(cx, cy + 26, 38, "smile"); k.cheeks(cx - 46, cx + 46, cy + 16, 10);
        }
      } else if (type === "tulipan") {
        const c = k.pick(["#e63946", "#ff8fb8", "#ffcf33", "#9b5de5", "#ff7a1a"]);
        k.path([[cx - 110, cy - 110], [cx - 70, cy - 60], [cx - 30, cy - 130], [cx, cy - 60], [cx + 30, cy - 130], [cx + 70, cy - 60], [cx + 110, cy - 110], [cx + 100, cy + 10], [cx + 50, cy + 70], [cx - 50, cy + 70], [cx - 100, cy + 10]], { fill: c, shade: "r", light: true, w: 6 });
        if (!k.drop()) { k.line([[cx - 30, cy - 120], [cx - 40, cy + 40]], 4, k.tone(c, -0.3)); k.line([[cx + 30, cy - 120], [cx + 40, cy + 40]], 4, k.tone(c, -0.3)); }
      } else {
        const c = k.pick(["#e63946", "#ff6f9f", "#d6336c"]);
        const d = k.tone(c, -0.3);
        k.path([[cx - 70, cy + 40], [cx - 115, cy - 10], [cx - 40, cy + 0], [cx - 70, cy + 70]], { fill: "#3e9a4a", w: 4 });
        k.path([[cx + 70, cy + 40], [cx + 115, cy - 10], [cx + 40, cy + 0], [cx + 70, cy + 70]], { fill: "#3e9a4a", w: 4 });
        k.path(bumpy(cx, cy - 30, 115, 100, 5, 0.1), { fill: c, shade: "rb", light: true, w: 6 });
        k.arc(cx, cy - 30, 70, 0.9 * PI, 2.1 * PI, 5, d);
        k.arc(cx + 5, cy - 34, 45, 0.1 * PI, 1.2 * PI, 5, d);
        k.arc(cx - 3, cy - 38, 22, 1.1 * PI, 2.4 * PI, 5, d);
        k.arc(cx, cy - 30, 90, 0.15 * PI, 0.85 * PI, 5, d);
      }
      // maceta o jardín
      if (pot) {
        const pc = k.pick(["#d9643a", "#c75b39", "#5b8def", "#ffcf33"]);
        k.path([[180, 720], [420, 720], [395, 880], [205, 880]], { fill: pc, shade: "r", smooth: false, w: 6 });
        k.rect(165, 690, 270, 50, { r: 10, fill: k.tone(pc, 0.12), w: 6, light: true });
        if (!k.drop()) for (let i = 0; i < 3; i++) k.dot(250 + i * 50, 800, 10, k.tone(pc, 0.35));
      } else if (!k.drop()) {
        for (let i = 0; i < 7; i++) miniFlower(k, k.pick([k.R(30, 220), k.R(380, 570)]), k.R(790, 850), 1.1);
        k.grass(790, 6, "#2a8a4a");
      }
      // bicho
      if (!k.drop()) {
        if (k.chance(0.5)) {
          const bx = 110, by = 200;
          k.ellipse(bx - 18, by - 16, 22, 14, { fill: "#ffffff", w: 3, opacity: 0.8, rot: -30 });
          k.ellipse(bx + 18, by - 16, 22, 14, { fill: "#ffffff", w: 3, opacity: 0.8, rot: 30 });
          k.ellipse(bx, by, 28, 20, { fill: "#ffcf33", w: 4 });
          k.line([[bx - 6, by - 18], [bx - 6, by + 18]], 6); k.line([[bx + 8, by - 18], [bx + 8, by + 18]], 6);
          k.eye(bx - 18, by - 3, 6);
        } else {
          const bx = 480, by = 260, c = k.pick(["#9b5de5", "#2ec4b6", "#ff7a1a"]);
          k.ellipse(bx - 26, by - 18, 28, 22, { fill: c, w: 4, rot: -20 }); k.ellipse(bx + 26, by - 18, 28, 22, { fill: c, w: 4, rot: 20 });
          k.ellipse(bx - 20, by + 16, 18, 14, { fill: k.tone(c, 0.3), w: 4 }); k.ellipse(bx + 20, by + 16, 18, 14, { fill: k.tone(c, 0.3), w: 4 });
          k.ellipse(bx, by, 8, 30, { fill: "#2b2b30", w: 3 });
          k.line([[bx - 2, by - 28], [bx - 12, by - 46]], 3); k.line([[bx + 2, by - 28], [bx + 12, by - 46]], 3);
        }
      }
    },
  },
  // ── MONTAÑA ──
  {
    key: "montana",
    words: ["montaña", "montañas", "nieve", "esquí", "esquiar", "cima", "pico", "sierra", "escalar"],
    name: "Una montaña",
    draw(k) {
      const winter = k.chance(0.5), sunset = k.chance(0.35);
      if (sunset) sky(k, "#ff9e7a", "#ffe1b0", 700); else sky(k, "#8ccaf2", "#e6f6ff", 700);
      k.circle(470, 150, 50, { fill: sunset ? "#ffb347" : "#ffe066", w: 5, light: true });
      k.cloud(120, 160, 0.7);
      // cordillera de atrás
      const far = sunset ? "#9b8fc4" : "#9fb6d9";
      k.path([[-30, 640], [70, 380], [150, 470], [230, 400], [600, 640]], { fill: far, w: 5, smooth: false });
      k.path([[300, 640], [470, 330], [540, 420], [640, 360], [640, 640]], { fill: far, w: 5, smooth: false });
      k.path([[38, 460], [70, 380], [104, 440], [86, 432], [70, 452], [54, 436]], { fill: "#fff", w: 4, smooth: false });
      k.path([[432, 400], [470, 330], [506, 390], [486, 384], [470, 404], [452, 388]], { fill: "#fff", w: 4, smooth: false });
      // montaña principal
      const rock = sunset ? "#7d6f9e" : "#6f86b0";
      k.path([[-40, 760], [130, 470], [210, 380], [300, 220], [380, 360], [450, 430], [640, 760]], { fill: rock, shade: "r", shadeK: 0.2, w: 6, smooth: false });
      k.path([[236, 334], [300, 220], [362, 328], [336, 314], [316, 346], [292, 316], [266, 352], [250, 328]], { fill: "#ffffff", w: 5, shade: "r", smooth: false });
      if (!k.drop()) { k.line([[300, 360], [270, 450], [290, 520]], 4, k.tone(rock, -0.25)); k.line([[380, 420], [360, 500]], 4, k.tone(rock, -0.25)); }
      if (!k.drop()) { k.line([[300, 224], [300, 160]], 4); k.path([[300, 160], [345, 172], [300, 186]], { fill: "#e63946", w: 4 }); }
      // primer plano
      if (winter) {
        k.ground(700, "#f2f7ff", { wave: 18 });
        if (!k.drop()) { k.line([[140, 900], [230, 780], [330, 720]], 4, "#b8cbe6"); k.line([[170, 900], [250, 785], [340, 726]], 4, "#b8cbe6"); }
        pine(k, 70, 800, 260, "#2f7d5b", true); pine(k, 520, 830, 300, "#2f7d5b", true);
        if (!k.drop()) pine(k, 160, 760, 170, "#36906a", true);
        // muñequito esquiando
        if (!k.drop()) {
          const sx = 360, sy = 790;
          k.line([[sx - 60, sy + 30], [sx + 60, sy + 4]], 6, "#e63946");
          k.tube([[sx - 10, sy + 20], [sx - 4, sy - 20]], 16, "#1f2d66"); k.tube([[sx + 14, sy + 14], [sx + 8, sy - 20]], 16, "#1f2d66");
          k.ellipse(sx + 2, sy - 44, 24, 30, { fill: "#ff7a1a", w: 4 });
          k.circle(sx + 2, sy - 90, 20, { fill: "#f1c9a5", w: 4 });
          k.path([[sx - 18, sy - 96], [sx + 2, sy - 124], [sx + 22, sy - 96]], { fill: "#3b82f6", w: 4 });
          k.line([[sx - 18, sy - 50], [sx - 40, sy + 20]], 3); k.line([[sx + 22, sy - 50], [sx + 46, sy + 10]], 3);
          k.dot(sx - 4, sy - 90, 3); k.dot(sx + 8, sy - 90, 3);
        }
      } else {
        k.ground(690, "#6cc46a", { wave: 14 });
        k.ellipse(300, 800, 200, 46, { fill: "#5aa9e6", w: 5, light: true });
        if (!k.drop()) k.line([[220, 800], [260, 796]], 4, "#d6efff");
        pine(k, 70, 820, 280, "#2f8f5b"); pine(k, 530, 840, 300, "#2f8f5b");
        if (!k.drop()) for (let i = 0; i < 5; i++) miniFlower(k, k.R(160, 440), k.R(705, 740), 0.8);
      }
      if (!k.drop()) for (let i = 0; i < (winter ? 20 : 0); i++) k.dot(k.R(0, 600), k.R(0, 700), k.R(3, 6), "#ffffff");
    },
  },
  // ── PLAYA ──
  {
    key: "playa",
    words: ["playa", "verano", "arena", "sombrilla", "vacaciones", "bañador", "castillo de arena", "toalla"],
    name: "Una playa",
    draw(k) {
      sky(k, "#7fc8f2", "#dff3ff", 470);
      k.circle(470, 130, 62, { fill: "#ffd84a", w: 5, light: true });
      k.cloud(130, 140, 0.75);
      if (!k.drop()) { gull(k, 280, 180); gull(k, 330, 210, 0.8); }
      // mar
      k.path([[-30, 450], [630, 450], [630, 680], [-30, 680]], { fill: "#2f9be0", w: 5, smooth: false });
      k.path([[-30, 450], [630, 450], [630, 520], [-30, 520]], { fill: "#2a7fc9", w: 0, smooth: false });
      if (!k.drop()) for (const [x, y] of [[90, 500], [400, 530], [250, 580], [500, 600]]) k.line([[x, y], [x + 25, y - 8], [x + 50, y]], 4, "#cdeeff");
      if (!k.drop()) {
        k.path([[120, 470], [200, 470], [190, 490], [130, 490]], { fill: "#ffffff", w: 4, smooth: false });
        k.line([[160, 470], [160, 400]], 4); k.path([[163, 402], [200, 462], [163, 462]], { fill: "#ffffff", w: 4, smooth: false });
      }
      // arena con espuma
      const sand = k.pick(["#f6d89a", "#f3d08c"]);
      k.ground(640, "#ffffff", { wave: 12, shade: false });
      k.ground(660, sand, { wave: 12 });
      // sombrilla
      const cols = k.pick([["#e63946", "#ffffff"], ["#2ec4b6", "#ffd21f"], ["#ff8fb8", "#ffffff"], ["#3b82f6", "#ffd21f"]]);
      k.group("rotate(8 360 470)", () => {
        k.line([[360, 470], [360, 820]], 10, "#ffffff"); k.line([[360, 470], [360, 820]], 4, "#8b5a2b");
        const cx = 360, cy = 480, rx = 200, ry = 130, n = 6;
        // festón inferior
        for (let i = 0; i < n; i++) { const x0 = cx - rx + (i * 2 * rx) / n, x1 = x0 + (2 * rx) / n; k.path([[x0, cy], [(x0 + x1) / 2, cy + 22], [x1, cy]], { fill: cols[i % 2], w: 5 }); }
        // cúpula
        const dome = [];
        for (let j = 0; j <= 20; j++) { const a = PI + (j / 20) * PI; dome.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
        k.path(dome, { fill: cols[0], w: 0, dense: false, shade: "r" });
        for (let i = 1; i < n; i += 2) {
          const x0 = cx - rx + (i * 2 * rx) / n, x1 = x0 + (2 * rx) / n;
          k.path([[cx, cy - ry], [x0, cy], [x1, cy]], { fill: cols[1], w: 0, smooth: false });
        }
        for (let i = 1; i < n; i++) k.line([[cx, cy - ry], [cx - rx + (i * 2 * rx) / n, cy]], 4);
        k.path(dome, { fill: "none", w: 6, dense: false, closed: true });
        k.circle(cx, cy - ry - 6, 9, { fill: cols[0], w: 4 });
      });
      // toalla
      const tw = k.pick(["#9b5de5", "#3b82f6", "#ff7a1a"]);
      k.path([[30, 770], [250, 750], [272, 850], [50, 880]], { fill: tw, w: 5, shade: "b" });
      if (!k.drop()) for (const f of [0.3, 0.6]) k.line([[30 + 220 * f, 770 - 20 * f], [50 + 222 * f, 880 - 30 * f]], 10, "#ffffff");
      // cubo, pala, pelota, castillo
      const extra = k.pick(["cubo", "castillo", "pelota"]);
      if (extra === "cubo" || !k.drop()) {
        k.path([[440, 760], [520, 760], [508, 840], [452, 840]], { fill: "#ffd21f", w: 5, shade: "r", smooth: false });
        k.arc(480, 765, 38, PI, 2 * PI, 4);
        k.line([[540, 850], [565, 760]], 6, "#e63946"); k.ellipse(568, 748, 14, 20, { fill: "#e63946", w: 4, rot: 15 });
      }
      if (extra === "castillo") {
        k.rect(150, 650, 90, 70, { r: 4, fill: "#e8c27a", w: 5, shade: "r" });
        for (const x of [150, 185, 220]) k.rect(x, 635, 20, 20, { r: 3, fill: "#e8c27a", w: 4 });
        k.line([[195, 635], [195, 600]], 3); k.path([[195, 600], [220, 608], [195, 616]], { fill: "#e63946", w: 3 });
      }
      if (extra === "pelota") {
        k.circle(170, 690, 42, { fill: "#ffffff", w: 5, light: true });
        k.path([[170, 648], [140, 690], [170, 732], [158, 690]], { fill: "#e63946", w: 0 });
        k.path([[170, 648], [200, 690], [170, 732], [182, 690]], { fill: "#3b82f6", w: 0 });
        k.circle(170, 690, 42, { fill: "none", w: 5 });
      }
      if (!k.drop()) { star(k, 360, 870, 22, "#ff8f6b"); k.path([[540, 880], [520, 860], [540, 840], [560, 860]], { fill: "#ffd6e0", w: 3 }); }
    },
  },
  // ── ISLA ──
  {
    key: "isla",
    words: ["isla", "náufrago", "palmera", "tesoro", "cocos", "coco", "desierta", "mapa del tesoro"],
    name: "Una isla desierta",
    draw(k) {
      const sunset = k.chance(0.3);
      if (sunset) sky(k, "#ff9e7a", "#ffe1b0", 400); else sky(k, "#7fc8f2", "#dff3ff", 400);
      k.circle(110, 140, 56, { fill: sunset ? "#ffb347" : "#ffd84a", w: 5, light: true });
      k.cloud(450, 130, 0.7);
      if (!k.drop()) gull(k, 300, 120);
      k.path([[-30, 390], [630, 390], [630, 930], [-30, 930]], { fill: "#2a9de0", w: 5, smooth: false });
      k.path([[-30, 600], [630, 600], [630, 930], [-30, 930]], { fill: "#2389d1", w: 0, smooth: false });
      if (!k.drop()) for (const [x, y] of [[60, 450], [500, 470], [80, 820], [470, 830], [300, 870]]) k.line([[x, y], [x + 25, y - 8], [x + 50, y]], 4, "#cdeeff");
      // isla
      k.ellipse(300, 680, 285, 110, { fill: "#d7f2ff", w: 0, opacity: 0.8 });
      k.ellipse(300, 670, 255, 95, { fill: "#f6d89a", w: 6, shade: "b", light: true });
      // palmera
      const trunk = "#c79a5b";
      k.tube([[230, 650], [250, 520], [300, 400], [370, 320]], 38, trunk);
      if (!k.drop()) for (const [x, y] of [[238, 600], [248, 540], [268, 480], [292, 430], [330, 370]]) k.line([[x - 18, y - 4], [x + 18, y + 4]], 4, "#7c5a2b");
      const lc = "#3aa55b";
      const crown = [372, 318];
      const leafs = [[-150, -20], [-110, -110], [0, -150], [130, -100], [170, 10], [80, 90], [-70, 80]];
      for (const [dx, dy] of leafs) {
        const [x, y] = crown, ex = x + dx, ey = y + dy, mx = x + dx * 0.5, my = y + dy * 0.5 - 40;
        const nx = -(ey - y), ny = ex - x, L = Math.hypot(nx, ny);
        const w = 28;
        k.path([[x, y], [mx + (nx / L) * w, my + (ny / L) * w], [ex, ey + 20], [mx - (nx / L) * w * 0.6, my - (ny / L) * w * 0.6]], { fill: lc, w: 5, shade: "b" });
        if (!k.drop()) k.line([[x, y], [mx, my], [ex, ey + 20]], 3, "#2a7a3a");
      }
      for (const [dx, dy] of [[-18, 10], [10, 16], [-4, 32]]) k.circle(crown[0] + dx, crown[1] + dy, 17, { fill: "#7c4a1e", w: 4, light: true });
      // tesoro / náufrago extra
      const extra = k.pick(["cofre", "cofre", "botella", "tiburon"]);
      if (extra === "cofre") {
        const bx = 340, by = 620;
        // tapa abierta (detrás), monedas y caja
        k.path([[bx + 4, by], [bx - 6, by - 80], [bx + 126, by - 80], [bx + 116, by]], { fill: "#8a4f22", w: 5, smooth: false, shade: "r" });
        k.rect(bx + 50, by - 78, 20, 78, { r: 2, fill: "#ffd21f", w: 4 });
        k.path(bumpy(bx + 60, by - 4, 58, 22, 6, 0.25), { fill: "#ffd21f", w: 4, light: true });
        for (const [dx, dy] of [[24, -14], [56, -24], [90, -12]]) k.circle(bx + dx, by + dy, 11, { fill: "#ffe680", w: 3 });
        k.path(starPts(bx + 70, by - 34, 15, 8, 4), { fill: "#e63946", w: 3, smooth: false });
        k.rect(bx, by, 120, 70, { r: 6, fill: "#a8652e", w: 5, shade: "r" });
        k.rect(bx + 50, by, 20, 70, { r: 2, fill: "#ffd21f", w: 4 });
        k.rect(bx, by + 4, 120, 14, { r: 2, fill: "#ffd21f", w: 4 });
        k.rect(bx + 52, by + 26, 16, 18, { r: 3, fill: "#5a3a1a", w: 3 });
        if (!k.drop()) star(k, bx + 104, by - 46, 12, "#ffffff", { w: 0 });
        if (!k.drop()) { k.line([[150, 690], [190, 720]], 7, "#e63946"); k.line([[190, 690], [150, 720]], 7, "#e63946"); }
      } else if (extra === "botella") {
        k.group("rotate(-20 470 760)", () => { k.rect(430, 740, 80, 40, { r: 18, fill: "#9be04a", w: 5, opacity: 0.85, light: true }); k.rect(508, 750, 26, 20, { r: 4, fill: "#8b5a2b", w: 4 }); k.rect(450, 750, 40, 20, { r: 3, fill: "#fff4dc", w: 3 }); });
      } else {
        k.path([[430, 820], [470, 740], [500, 820]], { fill: "#7a8899", w: 5, shade: "r" });
        k.line([[400, 825], [530, 825]], 4, "#cdeeff");
      }
    },
  },
  // ── SOL ──
  {
    key: "sol",
    words: ["sol", "calor", "amanecer", "soleado", "atardecer", "puesta de sol", "caluroso"],
    name: "El sol",
    draw(k) {
      const rise = k.chance(0.35);
      if (rise) {
        sky(k, "#ff8a6b", "#ffe0a0", 620);
        const cx = 300, cy = 600;
        for (let i = 0; i < 14; i++) { const a = PI + (i / 13) * PI; k.path([[cx + Math.cos(a - 0.08) * 200, cy + Math.sin(a - 0.08) * 200], [cx + Math.cos(a) * 300, cy + Math.sin(a) * 300], [cx + Math.cos(a + 0.08) * 200, cy + Math.sin(a + 0.08) * 200]], { fill: "#ffd84a", w: 5, smooth: false }); }
        k.circle(cx, cy, 175, { fill: "#ffc83d", shade: "rb", light: true, w: 6 });
        k.eye(cx - 55, cy - 80, 18, { closed: k.chance(0.5) }); k.eye(cx + 55, cy - 80, 18, { closed: k.chance(0.5) });
        k.cheeks(cx - 95, cx + 95, cy - 45, 18);
        k.mouth(cx, cy - 30, 60, "smile");
        k.path([[-30, 590], [630, 590], [630, 930], [-30, 930]], { fill: "#3c8fd6", w: 5, smooth: false });
        if (!k.drop()) for (const [x, y, w] of [[300, 630, 200], [300, 680, 150], [300, 730, 100], [300, 780, 60]]) k.line([[x - w / 2, y], [x + w / 2, y]], 8, "#ffd84a");
        if (!k.drop()) { gull(k, 110, 200); gull(k, 160, 240, 0.8); }
        k.cloud(500, 160, 0.6);
        return;
      }
      sky(k, "#6ec0f0", "#d9f1ff", 900);
      k.ground(740, "#8fd47a", { wave: 20 });
      if (!k.drop()) { k.ground(800, "#6cc46a", { wave: 14, phase: 2 }); for (let i = 0; i < 6; i++) miniFlower(k, k.R(30, 570), k.R(820, 860), 0.9); }
      const cx = 300, cy = 370;
      const wavy = k.chance(0.5);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * PI * 2 + 0.13;
        const L = i % 2 ? 250 : 285;
        if (wavy) k.tube([[cx + Math.cos(a) * 200, cy + Math.sin(a) * 200], [cx + Math.cos(a + 0.08) * (L - 40), cy + Math.sin(a + 0.08) * (L - 40)], [cx + Math.cos(a) * L, cy + Math.sin(a) * L]], 20, "#ffb703");
        else k.path([[cx + Math.cos(a - 0.12) * 190, cy + Math.sin(a - 0.12) * 190], [cx + Math.cos(a) * L, cy + Math.sin(a) * L], [cx + Math.cos(a + 0.12) * 190, cy + Math.sin(a + 0.12) * 190]], { fill: "#ffb703", w: 5, smooth: false });
      }
      k.circle(cx, cy, 200, { fill: "#ffd23f", shade: "rb", light: true, w: 6 });
      const shades = k.chance(0.45);
      if (shades) {
        k.path([[cx - 130, cy - 40], [cx - 10, cy - 40], [cx - 20, cy + 10], [cx - 60, cy + 25], [cx - 110, cy + 10]], { fill: "#1f1f24", w: 5 });
        k.path([[cx + 130, cy - 40], [cx + 10, cy - 40], [cx + 20, cy + 10], [cx + 60, cy + 25], [cx + 110, cy + 10]], { fill: "#1f1f24", w: 5 });
        k.line([[cx - 12, cy - 30], [cx + 12, cy - 30]], 6);
        k.ellipse(cx - 90, cy - 20, 18, 7, { fill: "#ffffff", w: 0, opacity: 0.6, rot: -20 });
        k.mouth(cx, cy + 70, 90, "grin");
      } else {
        k.eye(cx - 65, cy - 20, 26, { look: [0, 0.2] }); k.eye(cx + 65, cy - 20, 26, { look: [0, 0.2] });
        k.mouth(cx, cy + 70, 90, "open");
      }
      k.cheeks(cx - 120, cx + 120, cy + 45, 24);
      if (!k.drop()) { k.cloud(110, 680, 0.6); }
    },
  },
  // ── NOCHE ──
  {
    key: "noche",
    words: ["noche", "luna", "estrellas", "estrella", "murciélago", "dormir", "búho", "oscuridad"],
    name: "Una noche de luna",
    draw(k) {
      sky(k, "#141a3d", "#3f3a7a", 900);
      k.stars(22, [0, 0, 600, 600]);
      if (!k.drop()) for (let i = 0; i < 5; i++) star(k, k.R(30, 570), k.R(40, 480), k.R(10, 16), "#fff3b0", { w: 3 });
      const v = k.pick(["creciente", "llena", "buho"]);
      const moon = "#fff1a8";
      if (v === "llena") {
        k.ellipse(300, 290, 230, 230, { fill: "#fff8d0", w: 0, opacity: 0.12 });
        k.circle(300, 290, 170, { fill: moon, shade: "rb", light: true, w: 6 });
        if (!k.drop()) for (const [x, y, r] of [[240, 220, 28], [360, 260, 20], [280, 360, 34], [380, 360, 16]]) k.circle(x, y, r, { fill: k.tone(moon, -0.1), w: 4 });
        for (const [bx, by, bs] of [[110, 130, 1.3], [500, 500, 1.6], [150, 540, 1.0]]) if (!k.drop()) bat(k, bx, by, bs);
      } else {
        k.path(crescentPts(320, 280, 180, 90, -40, 160), { fill: moon, shade: "l", light: true, w: 6 });
        // cara dormida
        k.arc(196, 270, 18, 0.15 * PI, 0.85 * PI, 5);
        k.arc(186, 330, 16, 0.1 * PI, 0.8 * PI, 5);
        k.ellipse(176, 300, 14, 8, { fill: "#ff9eb5", w: 0, opacity: 0.6 });
        if (!k.drop()) { k.path([[380, 180], [410, 180], [380, 210], [410, 210]], { fill: "none", w: 5, closed: false, smooth: false }); k.path([[430, 120], [450, 120], [430, 140], [450, 140]], { fill: "none", w: 4, closed: false, smooth: false }); }
        // gorro de dormir
      }
      // paisaje
      k.ground(700, "#24305e", { wave: 22 });
      k.ground(790, "#1c2650", { wave: 14, phase: 2 });
      if (v === "buho") {
        k.tube([[-20, 600], [200, 590], [380, 610]], 30, "#5a3a2a");
        const bx = 250, by = 520;
        k.ellipse(bx, by, 70, 80, { fill: "#a0703e", shade: "r", light: true, w: 6 });
        k.path([[bx - 60, by - 60], [bx - 50, by - 100], [bx - 25, by - 70]], { fill: "#a0703e", w: 5 });
        k.path([[bx + 60, by - 60], [bx + 50, by - 100], [bx + 25, by - 70]], { fill: "#a0703e", w: 5 });
        k.ellipse(bx, by + 30, 40, 40, { fill: "#e6c9a0", w: 0 });
        k.eye(bx - 28, by - 30, 24, { iris: "#1f1f24" }); k.eye(bx + 28, by - 30, 24, { iris: "#1f1f24" });
        k.path([[bx - 8, by - 10], [bx + 8, by - 10], [bx, by + 6]], { fill: "#ffb300", w: 4 });
        for (const x of [bx - 20, bx + 20]) k.line([[x - 8, by + 82], [x, by + 74], [x + 8, by + 82]], 5, "#ffb300");
      }
      // casitas con luz
      for (const [x, y, w, h] of [[60, 690, 90, 80], [420, 700, 110, 90]]) {
        k.rect(x, y, w, h, { r: 0, fill: "#2b2b4f", w: 5 });
        k.path([[x - 12, y + 4], [x + w / 2, y - 50], [x + w + 12, y + 4]], { fill: "#3a2f5f", w: 5, smooth: false });
        k.rect(x + w / 2 - 15, y + 20, 30, 30, { r: 3, fill: "#ffd96a", w: 4 });
      }
    },
  },
  // ── ARCOÍRIS ──
  {
    key: "arcoiris",
    words: ["arcoíris", "arcoiris", "arco iris", "lluvia", "colores"],
    name: "Un arcoíris",
    draw(k) {
      sky(k, "#8fd0f5", "#eaf8ff", 900);
      const rainy = k.chance(0.35);
      if (!rainy) k.circle(500, 110, 56, { fill: "#ffd84a", w: 5, light: true });
      k.ground(660, "#86cf74", { wave: 16 });
      k.ground(760, "#6cc46a", { wave: 12, phase: 1.5 });
      const cx = 300, cy = 640;
      const cols = ["#e63946", "#ff8c2a", "#ffd21f", "#4cc35a", "#3b82f6", "#9b5de5"];
      const bw = 34, r0 = 270;
      cols.forEach((c, i) => {
        const ro = r0 + bw / 2 - i * bw, ri = ro - bw, pts = [];
        for (let j = 0; j <= 24; j++) { const a = PI + (j / 24) * PI; pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro]); }
        for (let j = 24; j >= 0; j--) { const a = PI + (j / 24) * PI; pts.push([cx + Math.cos(a) * ri, cy + Math.sin(a) * ri]); }
        k.path(pts, { fill: c, w: 5, dense: false, light: i === 0 });
      });
      // nubes en los pies
      for (const x of [cx - 200, cx + 200]) {
        k.path(bumpy(x, cy - 10, 110, 60, 6, 0.16), { fill: "#ffffff", w: 6, shade: "b", light: true });
        if (k.chance(0.6)) { k.eye(x - 26, cy - 16, 10); k.eye(x + 26, cy - 16, 10); k.mouth(x, cy + 10, 26, "smile"); k.cheeks(x - 46, x + 46, cy + 4, 9); }
      }
      if (rainy) {
        k.path(bumpy(150, 140, 120, 60, 6, 0.15), { fill: "#c9d3e0", w: 5, shade: "b" });
        for (let i = 0; i < 12; i++) { const x = k.R(60, 260), y = k.R(220, 330); k.path([[x, y - 14], [x + 7, y + 4], [x, y + 10], [x - 7, y + 4]], { fill: "#5aa9e6", w: 3 }); }
      } else k.cloud(140, 150, 0.7);
      if (!k.drop()) for (let i = 0; i < 7; i++) miniFlower(k, k.R(30, 570), k.R(790, 860), 1);
    },
  },
  // ── VOLCÁN ──
  {
    key: "volcan",
    words: ["volcán", "volcan", "lava", "erupción", "magma"],
    name: "Un volcán",
    draw(k) {
      const night = k.chance(0.45);
      if (night) sky(k, "#2a1a3d", "#9a3b3b", 800); else sky(k, "#ffb38a", "#ffe8c4", 800);
      // humo
      const smoke = night ? "#5a4a5e" : "#8a8a96";
      k.path(bumpy(300, 150, 230, 110, 8, 0.14), { fill: smoke, shade: "b", w: 6 });
      k.path(bumpy(230, 250, 120, 70, 6, 0.15), { fill: k.tone(smoke, 0.15), w: 5 });
      k.path(bumpy(380, 255, 110, 65, 6, 0.15), { fill: k.tone(smoke, 0.15), w: 5 });
      // erupción
      flame(k, 300, 400, 1.6, "#ff5a1f", "#ffcf33");
      for (const [x, y, r] of [[160, 300, 16], [450, 280, 20], [200, 210, 12], [420, 380, 12]]) if (!k.drop()) { k.circle(x, y, r, { fill: "#4a3030", w: 4 }); k.circle(x + r * 0.3, y + r * 0.4, r * 0.5, { fill: "#ff7a1a", w: 0 }); }
      // cono
      const rock = night ? "#5a3a3a" : "#8b5a3c";
      k.path([[-40, 860], [140, 560], [230, 410], [260, 385], [340, 385], [370, 410], [460, 560], [640, 860]], { fill: rock, shade: "r", shadeK: 0.18, w: 6 });
      k.ellipse(300, 390, 44, 12, { fill: "#ff5a1f", w: 5 });
      // ríos de lava
      k.path([[268, 392], [250, 450], [220, 520], [240, 600], [200, 700], [214, 720], [258, 610], [250, 530], [290, 450], [300, 396]], { fill: "#ff7a1a", w: 5 });
      k.path([[316, 396], [350, 460], [380, 560], [360, 650], [384, 660], [404, 560], [372, 450], [334, 392]], { fill: "#ffb020", w: 5 });
      if (!k.drop()) { k.line([[250, 480], [238, 540]], 4, "#ffe066"); k.line([[372, 520], [384, 580]], 4, "#ffe066"); }
      if (!k.drop()) for (let i = 0; i < 6; i++) k.ellipse(k.R(80, 520), k.R(620, 800), 22, 10, { fill: k.tone(rock, -0.2), w: 0 });
      // primer plano
      k.ground(820, night ? "#3a2a2a" : "#6b8f3a", { wave: 12 });
      if (!k.drop()) for (const [x, s] of [[70, 1], [530, 0.85]]) {
        k.tube([[x, 860], [x + 10 * s, 760], [x + 30 * s, 680]], 18 * s, "#7c5a2b");
        for (const a of [-2.6, -2, -1.2, -0.5]) k.path([[x + 30 * s, 680], [x + 30 * s + Math.cos(a) * 80 * s, 680 + Math.sin(a) * 50 * s - 10], [x + 30 * s + Math.cos(a) * 100 * s, 690 + Math.sin(a) * 40 * s + 20]], { fill: night ? "#2f5a3a" : "#3aa55b", w: 4 });
      }
    },
  },
  // ── CIUDAD ──
  {
    key: "ciudad",
    words: ["ciudad", "rascacielos", "edificio", "edificios", "calle", "tráfico", "metrópolis"],
    name: "Una ciudad",
    draw(k) {
      const t = k.pick(["dia", "noche", "tarde"]);
      const night = t === "noche";
      if (t === "dia") sky(k, "#8fd0f5", "#e6f6ff", 760);
      else if (t === "tarde") sky(k, "#ff9e7a", "#ffe1b0", 760);
      else sky(k, "#141a3d", "#3f3a7a", 760);
      if (night) { k.stars(14, [0, 0, 600, 300]); k.circle(480, 110, 44, { fill: "#fff1a8", w: 5, light: true }); }
      else { k.circle(470, 130, 50, { fill: t === "tarde" ? "#ffb347" : "#ffd84a", w: 5, light: true }); k.cloud(130, 140, 0.6); }
      // silueta lejana
      const far = night ? "#2b2f5a" : t === "tarde" ? "#c98a9a" : "#a9c7e6";
      let x = -20;
      while (x < 620) { const w = k.R(50, 90), h = k.R(200, 380); k.rect(x, 760 - h, w, h + 10, { r: 0, fill: far, w: 4 }); x += w - 4; }
      // edificios delanteros
      const palette = night ? ["#3a3f74", "#4b4f86", "#2f3566", "#55447a"] : ["#ff8f6b", "#5b8def", "#ffcf5c", "#2ec4b6", "#9b8fd9", "#f28fb0", "#e8e2d6"];
      const win = night ? "#ffd96a" : "#d9f1ff";
      const blds = [[-10, 120, 330], [100, 110, 250], [200, 150, 560], [340, 120, 380], [450, 160, 290]];
      for (const [bx, bw, bh] of blds) {
        const c = k.pick(palette), top = 780 - bh;
        if (bh > 500) { k.line([[bx + bw / 2, top - 20], [bx + bw / 2, top - 110]], 6); k.dot(bx + bw / 2, top - 112, 8, "#e63946"); k.path([[bx + 20, top + 2], [bx + bw / 2, top - 30], [bx + bw - 20, top + 2]], { fill: k.tone(c, -0.15), w: 5, smooth: false }); }
        else if (k.chance(0.4) && !k.drop()) { k.rect(bx + bw * 0.55, top - 40, 34, 42, { r: 8, fill: "#a0703e", w: 4 }); }
        k.rect(bx, top, bw, bh + 20, { r: 0, fill: c, w: 6, shade: "r", shadeK: 0.1 });
        const cols = Math.max(2, Math.floor((bw - 20) / 40)), gx = (bw - cols * 24) / (cols + 1);
        for (let yy = top + 30; yy < 730; yy += 54) for (let i = 0; i < cols; i++) {
          if (night && k.chance(0.35)) continue;
          k.rect(bx + gx + i * (24 + gx), yy, 24, 30, { r: 3, fill: night && k.chance(0.2) ? "#2b2b4f" : win, w: 3 });
        }
      }
      // acera y carretera
      k.rect(-20, 770, 640, 40, { r: 0, fill: "#c9ccd3", w: 5 });
      k.rect(-20, 810, 640, 110, { r: 0, fill: "#4b5060", w: 5 });
      if (!k.drop()) for (let xx = 20; xx < 600; xx += 110) k.rect(xx, 856, 60, 10, { r: 3, fill: "#ffffff", w: 0 });
      for (const lx of [60, 520]) { k.line([[lx, 800], [lx, 660], [lx + 30, 650]], 6, "#3a3f4a"); k.ellipse(lx + 34, 656, 14, 8, { fill: night ? "#ffe680" : "#e8e8e8", w: 4 }); }
      car(k, k.R(160, 260), 860, 1.05, k.pick(["#e63946", "#ffd21f", "#2ec4b6"]));
      if (!k.drop()) car(k, k.R(420, 500), 892, 0.85, k.pick(["#3b82f6", "#9b5de5", "#ff7a1a"]));
    },
  },
  // ── TIENDA DE CAMPAÑA ──
  {
    key: "tienda",
    words: ["acampada", "acampar", "tienda de campaña", "camping", "hoguera", "campamento", "fogata", "excursión"],
    name: "Una acampada",
    draw(k) {
      const night = k.chance(0.6);
      if (night) { sky(k, "#141a3d", "#3a3f7a", 620); k.stars(18, [0, 0, 600, 420]); k.path(crescentPts(480, 120, 46, 20, -10, 40), { fill: "#fff1a8", w: 5 }); }
      else { sky(k, "#8fd0f5", "#e6f6ff", 620); k.circle(480, 120, 50, { fill: "#ffd84a", w: 5, light: true }); k.cloud(140, 130, 0.7); }
      const pineC = night ? "#24504a" : "#2f8f5b";
      k.ground(600, night ? "#2b4a4a" : "#7fc77a", { wave: 10 });
      for (const [x, h] of [[30, 300], [110, 240], [520, 320], [590, 230]]) pine(k, x, 620, h, pineC);
      k.ground(650, night ? "#365e4a" : "#6cc46a", { wave: 8, phase: 1 });
      // tienda
      const tc = k.pick(["#ff7a1a", "#2ec4b6", "#e63946", "#ffcf33", "#5b8def"]);
      if (!k.drop()) { k.line([[250, 360], [40, 720]], 3); k.line([[250, 360], [470, 720]], 3); }
      k.path([[60, 740], [250, 360], [440, 740]], { fill: tc, shade: "r", shadeK: 0.2, w: 6, smooth: false });
      k.path([[190, 740], [250, 530], [310, 740]], { fill: night ? "#ffcf5c" : "#3a2a3a", w: 5, smooth: false });
      k.path([[250, 400], [190, 740], [150, 740], [236, 500]], { fill: k.tone(tc, 0.25), w: 5, smooth: false });
      k.path([[250, 400], [310, 740], [350, 740], [264, 500]], { fill: k.tone(tc, -0.12), w: 5, smooth: false });
      k.line([[250, 350], [250, 380]], 6);
      if (!k.drop()) { k.line([[60, 740], [20, 760]], 4); k.line([[440, 740], [480, 760]], 4); }
      if (!k.drop()) k.path([[236, 345], [250, 320], [264, 345]], { fill: "#ffd21f", w: 3, smooth: false });
      // hoguera
      const fx = 470, fy = 820;
      if (night) k.ellipse(fx, fy - 30, 150, 110, { fill: "#ffcf5c", w: 0, opacity: 0.18 });
      for (let i = 0; i < 7; i++) { const a = PI * (i / 6); k.ellipse(fx + Math.cos(a) * 80, fy + 14 + Math.sin(a) * 10, 22, 16, { fill: "#9ca3af", w: 4 }); }
      k.tube([[fx - 70, fy + 10], [fx + 60, fy - 20]], 20, "#8b5a2b");
      k.tube([[fx - 60, fy - 20], [fx + 70, fy + 10]], 20, "#7c4a1e");
      flame(k, fx, fy - 10, 1, "#ff6a1f", "#ffd21f");
      if (!k.drop()) for (let i = 0; i < 5; i++) k.dot(fx + k.R(-50, 50), fy - k.R(170, 260), 4, "#ffcf33");
      // nube de malvavisco o farol
      if (!k.drop()) {
        if (k.chance(0.5)) { k.line([[300, 860], [420, 720]], 5, "#7c4a1e"); k.rect(410, 700, 22, 28, { r: 8, fill: "#ffffff", w: 4 }); }
        else { k.rect(120, 780, 50, 64, { r: 10, fill: "#ffcf5c", w: 5, light: true }); k.rect(115, 770, 60, 14, { r: 4, fill: "#2f8f5b", w: 4 }); k.arc(145, 770, 18, PI, 2 * PI, 4); }
      }
    },
  },
  // ── MUÑECO DE NIEVE ──
  {
    key: "munyeco",
    words: ["muñeco de nieve", "invierno", "nieve", "nevar", "copos", "frío", "nevada"],
    name: "Un muñeco de nieve",
    draw(k) {
      const night = k.chance(0.3);
      if (night) sky(k, "#2b3466", "#6a74b0", 700); else sky(k, "#a9d8f5", "#eef8ff", 700);
      for (const [x, h] of [[60, 300], [540, 340], [150, 200]]) if (!k.drop()) pine(k, x, 650, h, "#2f7d5b", true);
      k.ground(640, "#ffffff", { wave: 16 });
      const snow = "#fbfdff";
      // brazos de rama
      k.line([[200, 470], [100, 400], [70, 370]], 8, "#7c4a1e"); k.line([[100, 400], [80, 420]], 6, "#7c4a1e"); k.line([[94, 396], [86, 360]], 6, "#7c4a1e");
      k.line([[400, 470], [500, 420], [540, 360]], 8, "#7c4a1e"); k.line([[500, 420], [530, 430]], 6, "#7c4a1e");
      // bolas
      k.circle(300, 710, 160, { fill: snow, shade: "rb", light: true, w: 6 });
      k.circle(300, 480, 118, { fill: snow, shade: "rb", light: true, w: 6 });
      k.circle(300, 290, 92, { fill: snow, shade: "rb", light: true, w: 6 });
      for (const y of [430, 490, 550, 660, 740]) if (y < 600 || !k.drop()) k.circle(300, y, 12, { fill: "#2b2b30", w: 0 });
      // bufanda
      const sc = k.pick(["#e63946", "#3b82f6", "#ffcf33", "#9b5de5", "#2ec4b6"]);
      k.path([[205, 360], [300, 382], [395, 360], [395, 400], [300, 420], [205, 400]], { fill: sc, w: 5, shade: "b" });
      k.path([[330, 400], [370, 400], [390, 510], [350, 515]], { fill: sc, w: 5, shade: "r" });
      if (!k.drop()) { for (const y of [430, 470]) k.line([[358, y], [382, y - 2]], 6, "#ffffff"); }
      // cara
      k.dot(268, 268, 12); k.dot(332, 268, 12);
      k.dot(264, 264, 4, "#fff"); k.dot(328, 264, 4, "#fff");
      k.path([[300, 290], [390, 310], [300, 315]], { fill: "#ff7a1a", w: 5, shade: "b" });
      for (let i = 0; i < 5; i++) { const a = 0.2 * PI + (i / 4) * 0.6 * PI; k.dot(300 + Math.cos(a) * 46, 300 + Math.sin(a) * 30, 6); }
      k.cheeks(244, 356, 305, 13);
      // sombrero
      if (k.chance(0.5)) {
        k.rect(212, 195, 176, 26, { r: 10, fill: "#2b2b30", w: 5 });
        k.rect(240, 95, 120, 110, { r: 8, fill: "#2b2b30", w: 5, light: true });
        k.rect(240, 170, 120, 20, { r: 2, fill: sc, w: 4 });
      } else {
        const hc = k.pick(["#e63946", "#3b82f6", "#9b5de5"]);
        k.path([[216, 236], [222, 170], [270, 140], [330, 140], [378, 170], [384, 236]], { fill: hc, w: 5, shade: "r" });
        k.rect(208, 214, 184, 36, { r: 14, fill: "#ffffff", w: 5 });
        k.circle(300, 128, 26, { fill: "#ffffff", w: 5 });
      }
      // copos
      if (!k.drop()) for (let i = 0; i < 26; i++) { const x = k.R(0, 600), y = k.R(0, 640), r = k.R(4, 8); k.dot(x, y, r, "#ffffff"); }
    },
  },
  // ── FANTASMA ──
  {
    key: "fantasma",
    words: ["fantasma", "halloween", "miedo", "susto", "calabaza", "embrujada", "monstruo"],
    name: "Un fantasma",
    draw(k) {
      sky(k, "#241a44", "#6a3f86", 900);
      k.stars(10, [0, 0, 600, 300]);
      k.circle(470, 150, 80, { fill: "#fff1a8", w: 5, light: true });
      if (!k.drop()) { bat(k, 140, 130, 1.5); bat(k, 330, 90, 1.0); }
      // colina con casa encantada
      k.ellipse(470, 640, 300, 160, { fill: "#2b2147", w: 5 });
      if (!k.drop()) {
        k.rect(430, 410, 110, 110, { r: 0, fill: "#3a2f5f", w: 5 });
        k.path([[415, 415], [485, 340], [555, 415]], { fill: "#2b2147", w: 5, smooth: false });
        k.rect(455, 440, 22, 26, { r: 2, fill: "#ffd96a", w: 3 }); k.rect(495, 440, 22, 26, { r: 2, fill: "#ffd96a", w: 3 });
      }
      k.ground(720, "#2f2a55", { wave: 14 });
      // tumbas
      for (const [x, y, h] of [[90, 760, 90], [520, 780, 70]]) {
        k.rect(x - 40, y - h, 80, h + 30, { r: 38, fill: "#9aa0b4", shade: "r", w: 5 });
        k.line([[x, y - h + 22], [x, y - h + 60]], 5, "#5a6078"); k.line([[x - 14, y - h + 36], [x + 14, y - h + 36]], 5, "#5a6078");
      }
      // fantasma
      const rot = k.R(-8, 8);
      k.group(`rotate(${rot.toFixed(1)} 300 450)`, () => {
        k.ellipse(300, 780, 110, 20, { fill: "#140f2a", w: 0, opacity: 0.4 });
        k.path([[170, 640], [168, 420], [200, 290], [300, 225], [400, 290], [432, 420], [440, 640], [410, 690], [380, 640], [348, 700], [312, 640], [276, 700], [240, 640], [205, 690]], { fill: "#fbfbff", shade: "r", light: true, w: 6 });
        k.path([[170, 450], [110, 420], [100, 455], [168, 500]], { fill: "#fbfbff", w: 6 });
        k.path([[430, 450], [500, 400], [512, 436], [436, 500]], { fill: "#fbfbff", w: 6 });
        const scary = k.chance(0.4);
        k.ellipse(258, 380, 22, 32, { fill: "#1f1f24", w: 0 }); k.ellipse(342, 380, 22, 32, { fill: "#1f1f24", w: 0 });
        k.dot(252, 368, 7, "#fff"); k.dot(336, 368, 7, "#fff");
        if (scary) k.ellipse(300, 470, 34, 44, { fill: "#2b1f35", w: 5 });
        else k.mouth(300, 440, 60, "smile");
        k.cheeks(222, 378, 425, 16);
      });
      pumpkin(k, k.pick([180, 420]), 820, 1.1);
      if (!k.drop()) pumpkin(k, k.pick([60, 540]), 850, 0.7);
    },
  },
  // ── ROBOT ──
  {
    key: "robot",
    words: ["robot", "máquina", "androide", "maquina", "cyborg", "tecnología"],
    name: "Un robot",
    draw(k) {
      k.bg(k.pick(["#e8f4ff", "#fff4dc", "#eaf7ee", "#f4ecff"]));
      // engranajes de fondo
      if (!k.drop()) for (const [x, y, r] of [[90, 140, 60], [520, 220, 46], [500, 680, 70]]) {
        const pts = [];
        for (let i = 0; i < 24; i++) { const a = (i / 24) * PI * 2, rr = i % 3 === 0 || i % 3 === 1 ? r : r * 0.8; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
        k.path(pts, { fill: "#d5dbe6", w: 4, smooth: false }); k.circle(x, y, r * 0.35, { fill: "#f6f8fb", w: 4 });
      }
      k.rect(-20, 780, 640, 140, { r: 0, fill: "#c9ced8", w: 5 });
      const body = k.pick(["#9fb6cc", "#ff9f45", "#5b8def", "#2ec4b6", "#e8e2d6", "#f28fb0"]);
      const dark = k.tone(body, -0.3);
      const wheels = k.chance(0.3);
      // piernas
      if (wheels) {
        k.rect(220, 640, 160, 50, { r: 10, fill: dark, w: 5 });
        k.rect(190, 690, 220, 90, { r: 45, fill: "#3a3f4a", w: 6 });
        for (const x of [235, 300, 365]) { k.circle(x, 735, 28, { fill: "#6b7280", w: 4 }); k.dot(x, 735, 8, "#c9ccd3"); }
      } else {
        for (const x of [245, 355]) { k.rect(x - 22, 640, 44, 110, { r: 8, fill: "#9ca3af", w: 5 }); for (const y of [670, 705]) k.line([[x - 22, y], [x + 22, y]], 4); }
        for (const x of [245, 355]) k.rect(x - 50, 740, 100, 44, { r: 16, fill: dark, w: 5, light: true });
      }
      // brazos
      const wave = k.chance(0.6);
      k.tube([[195, 470], [130, 520], [120, 600]], 28, "#9ca3af");
      if (wave) k.tube([[405, 470], [470, 420], [490, 330]], 28, "#9ca3af"); else k.tube([[405, 470], [470, 520], [480, 600]], 28, "#9ca3af");
      for (const [x, y, up] of [[120, 610, false], wave ? [490, 318, true] : [480, 610, false]]) {
        const d = up ? -1 : 1;
        k.circle(x, y, 22, { fill: dark, w: 5 });
        k.line([[x - 14, y + d * 10], [x - 22, y + d * 36], [x - 8, y + d * 46]], 9, "#1f1f24"); k.line([[x - 14, y + d * 10], [x - 22, y + d * 36], [x - 8, y + d * 46]], 4, "#c9ccd3");
        k.line([[x + 14, y + d * 10], [x + 22, y + d * 36], [x + 8, y + d * 46]], 9, "#1f1f24"); k.line([[x + 14, y + d * 10], [x + 22, y + d * 36], [x + 8, y + d * 46]], 4, "#c9ccd3");
      }
      // cuerpo
      k.rect(185, 410, 230, 240, { r: 28, fill: body, shade: "r", light: true, w: 6 });
      k.rect(225, 450, 150, 110, { r: 14, fill: "#2b3040", w: 5 });
      if (k.chance(0.5)) k.path([[300, 535], [262, 498], [270, 478], [300, 490], [330, 478], [338, 498]], { fill: "#ff5a7a", w: 3 });
      else { for (let i = 0; i < 3; i++) k.rect(240 + i * 44, 470, 30, 18, { r: 4, fill: ["#2ec4b6", "#ffd21f", "#ff5a7a"][i], w: 3 }); k.line([[240, 530], [265, 510], [285, 535], [310, 505], [335, 530], [360, 515]], 4, "#9be04a"); }
      if (!k.drop()) for (const [x, c] of [[240, "#e63946"], [280, "#ffd21f"], [320, "#2ec4b6"], [360, "#9b5de5"]]) k.circle(x, 600, 13, { fill: c, w: 4, light: true });
      // cuello y cabeza
      k.rect(270, 380, 60, 36, { r: 4, fill: "#9ca3af", w: 5 });
      for (const x of [178, 422]) k.rect(x - 16, 270, 32, 70, { r: 10, fill: dark, w: 5 });
      k.rect(180, 200, 240, 190, { r: 36, fill: body, shade: "r", light: true, w: 6 });
      // antena
      const two = k.chance(0.4);
      for (const ax of two ? [240, 360] : [300]) { k.line([[ax, 205], [ax + (ax - 300) * 0.3, 130]], 6); k.circle(ax + (ax - 300) * 0.3, 122, 16, { fill: "#e63946", w: 5, light: true }); }
      // cara pantalla
      k.rect(210, 235, 180, 120, { r: 24, fill: "#24304a", w: 5 });
      const eyeC = k.pick(["#5ff3e8", "#9be04a", "#ffd21f"]);
      if (k.chance(0.5)) { k.circle(260, 285, 22, { fill: eyeC, w: 0 }); k.circle(340, 285, 22, { fill: eyeC, w: 0 }); k.dot(266, 279, 7, "#ffffff"); k.dot(346, 279, 7, "#ffffff"); }
      else { k.arc(260, 295, 20, 1.1 * PI, 1.9 * PI, 9, eyeC); k.arc(340, 295, 20, 1.1 * PI, 1.9 * PI, 9, eyeC); }
      k.arc(300, 300, 30, 0.2 * PI, 0.8 * PI, 7, eyeC);
      k.ellipse(225, 330, 14, 8, { fill: "#ff8fb8", w: 0, opacity: 0.7 }); k.ellipse(375, 330, 14, 8, { fill: "#ff8fb8", w: 0, opacity: 0.7 });
      if (!k.drop()) for (const [x, y] of [[198, 222], [402, 222], [198, 368], [402, 368]]) k.dot(x, y, 5, dark);
    },
  },
];

// ───────────────────────── personas: temas ─────────────────────────
/** Habitación sencilla: pared, rodapié y suelo */
function room(k, wall, floor, y = 700) {
  k.bg(wall);
  k.rect(-20, y, 640, 240, { r: 0, fill: floor, w: 5, raw: true });
  k.rect(-20, y - 16, 640, 20, { r: 0, fill: k.tone(wall, -0.18), w: 4, raw: true });
}

SUBJECTS.push(
  // ── PERSONA GENÉRICA (retratos) ──
  {
    key: "persona",
    words: ["persona"],
    name: "Una persona",
    draw(k) {
      const bgc = k.pick(["#fde7ef", "#e8f4ff", "#fff4dc", "#eaf7ee", "#f1ecff"]);
      k.bg(bgc);
      if (!k.drop()) for (let i = 0; i < 9; i++) {
        const x = k.R(20, 580), y = k.R(20, 420);
        if (Math.abs(x - 300) < 170 && y > 100) continue;
        k.circle(x, y, k.R(8, 16), { fill: k.tone(k.pick(["#ff8fb8", "#ffd21f", "#2ec4b6", "#9b5de5"]), 0.3), w: 0 });
      }
      k.ellipse(300, 840, 220, 40, { fill: k.tone(bgc, -0.12), w: 0 });
      const L = randomLook(k);
      const pose = k.pick(["saludo", "quieto", "brazos"]);
      const extra = {};
      if (pose === "saludo") { extra.handR = [170, -20]; extra.elbowR = [170, 120]; extra.mouth = "open"; }
      if (pose === "brazos") { extra.handL = [-170, 90]; extra.handR = [170, 90]; extra.elbowL = [-140, 200]; extra.elbowR = [140, 200]; extra.mouth = "grin"; }
      const skirt = L.fem && k.chance(0.45);
      person(k, Object.assign(L, extra, {
        y: 285, s: 1.12, glasses: k.chance(0.2),
        skirt: skirt ? k.pick(["#ff8fb8", "#3b82f6", "#ffcf33", "#9b5de5"]) : null,
        outfit(H) { if (!k.drop() && k.chance(0.5)) { const c = k.tone(H.top, 0.45); for (const dy of [180, 230]) k.line(H.PS([[-100, dy], [100, dy]]), 10, c); } },
      }));
    },
  },
  // ── COCINERO ──
  {
    key: "cocinero",
    words: ["cocinero", "cocinera", "chef", "cocina", "cocinar", "restaurante", "receta"],
    name: "Un cocinero",
    draw(k) {
      const L = randomLook(k);
      room(k, k.pick(["#dff3f0", "#fdf0d5", "#e8f0ff"]), "#c9a27a");
      // azulejos
      for (let y = 0; y < 560; y += 56) k.line([[-10, y], [610, y]], 2, "#b8d6d0");
      for (let x = 0; x < 600; x += 56) k.line([[x, 0], [x, 560]], 2, "#b8d6d0");
      // utensilios colgados
      if (!k.drop()) {
        k.line([[30, 80], [570, 80]], 6, "#8b8f99");
        k.line([[60, 80], [60, 170]], 5); k.circle(60, 190, 24, { fill: "#9ca3af", w: 5 });
        k.line([[540, 80], [540, 160]], 5); k.ellipse(540, 185, 20, 30, { fill: "#c9a27a", w: 5 });
      }
      const pan = k.chance(0.5);
      person(k, Object.assign(L, {
        y: 290, top: "#ffffff", sleeve: "#ffffff", bottom: "#2b2b30",
        handL: [-150, 260], handR: pan ? [150, 120] : [150, 150], elbowR: [175, 250],
        outfit(H) {
          for (const dx of [-30, 30]) for (const dy of [160, 210, 260]) k.circle(...H.P(dx, dy), 8, { fill: "#d6d9df", w: 3 });
          k.path(H.PS([[-60, 95], [60, 95], [0, 150]]), { fill: k.pick(["#e63946", "#3b82f6", "#ffcf33"]), w: 5, smooth: false });
          k.line(H.PS([[0, 100], [0, 330]]), 3, "#c9ccd3");
        },
        hat(H) {
          k.path(H.PS([[-90, -70], [-130, -150], [-110, -230], [-50, -260], [0, -240], [50, -265], [110, -230], [130, -150], [90, -70]]), { fill: "#ffffff", shade: "r", light: true, w: 6 });
          k.rect(...H.P(-96, -96), 192, 50, { r: 12, fill: "#f4f4f6", w: 6 });
          if (!k.drop()) { k.line(H.PS([[-40, -100], [-50, -170]]), 3, "#d6d9df"); k.line(H.PS([[40, -100], [50, -170]]), 3, "#d6d9df"); }
        },
        prop(H) {
          const [x, y] = H.handR;
          if (pan) {
            k.line([[x, y], [x + 30, y + 60]], 14, "#2b2b30");
            k.ellipse(x - 10, y - 40, 80, 24, { fill: "#3a3f4a", w: 6 });
            k.ellipse(x - 10, y - 46, 30, 10, { fill: "#ffffff", w: 4 });
            k.circle(x - 10, y - 48, 9, { fill: "#ffcf33", w: 0 });
            if (!k.drop()) for (const dx of [-40, 0, 30]) k.line([[x + dx - 10, y - 80], [x + dx - 2, y - 100], [x + dx - 10, y - 120]], 4, "#9aa3b2");
          } else {
            k.line([[x - 10, y + 40], [x + 20, y - 110]], 10, "#c58a4a");
            k.ellipse(x + 26, y - 130, 18, 28, { fill: "#d9a066", w: 5, rot: 12 });
          }
        },
      }));
      // encimera con olla y verduras
      k.rect(-20, 600, 640, 40, { r: 6, fill: "#e8e2d6", w: 6, light: true });
      k.rect(-20, 636, 640, 300, { r: 0, fill: "#b07842", w: 6, shade: "b" });
      for (const x of [140, 460]) { k.rect(x - 110, 670, 220, 180, { r: 10, fill: "#c08a52", w: 5 }); k.rect(x - 30, 690, 60, 12, { r: 5, fill: "#8b8f99", w: 3 }); }
      // olla
      k.rect(30, 500, 150, 110, { r: 18, fill: k.pick(["#e63946", "#3b82f6", "#2ec4b6"]), w: 6, shade: "r", light: true });
      k.rect(20, 490, 170, 24, { r: 10, fill: "#9ca3af", w: 5 });
      for (const x of [16, 194]) k.rect(x - 14, 530, 28, 16, { r: 6, fill: "#3a3f4a", w: 4 });
      if (!k.drop()) for (const dx of [70, 105, 140]) k.line([[dx, 470], [dx + 10, 440], [dx, 410], [dx + 10, 380]], 5, "#c9d0dc");
      // verduras / tarta
      if (k.chance(0.5)) {
        k.circle(470, 570, 34, { fill: "#e63946", w: 5, light: true }); k.path([[460, 538], [470, 528], [482, 538], [470, 544]], { fill: "#2aa84a", w: 3 });
        k.path([[510, 595], [580, 520], [592, 532], [524, 604]], { fill: "#ff7a1a", w: 5 }); k.line([[586, 524], [600, 504]], 5, "#2aa84a");
      } else {
        k.rect(430, 540, 140, 62, { r: 10, fill: "#ffd6e0", w: 5, light: true });
        k.rect(430, 540, 140, 18, { r: 8, fill: "#ffffff", w: 4 });
        k.circle(500, 528, 13, { fill: "#e63946", w: 4, light: true });
      }
    },
  },
  // ── ASTRONAUTA ──
  {
    key: "astronauta",
    words: ["astronauta", "espacio", "cohete", "planeta", "nave espacial", "galaxia"],
    name: "Una astronauta",
    draw(k) {
      const L = randomLook(k);
      L.style = k.pick(L.fem ? ["bob", "buns", "curly", "short"] : ["short", "side", "curly"]);
      sky(k, "#0f1433", "#2b2a66", 900);
      k.stars(30, [0, 0, 600, 900]);
      // planeta con anillo
      const pc = k.pick(["#ff8f6b", "#9b5de5", "#2ec4b6"]);
      if (!k.drop()) {
        k.ellipse(120, 140, 110, 26, { fill: "none", w: 8, stroke: "#ffd21f", rot: -15 });
        k.circle(120, 140, 70, { fill: pc, shade: "rb", light: true, w: 6 });
        k.path([[20, 160], [80, 128], [160, 112], [220, 112]].map(([x, y]) => [x, y + 2]), { closed: false, w: 8, stroke: "#ffd21f", fill: "none" });
      }
      if (!k.drop()) { k.circle(510, 110, 26, { fill: "#ffe066", w: 4 }); }
      // suelo lunar
      k.ground(790, "#c9ccd6", { wave: 18 });
      for (const [x, y, r] of [[100, 840, 30], [460, 860, 24], [300, 880, 16]]) k.ellipse(x, y, r * 1.6, r * 0.5, { fill: "#a9adba", w: 4 });
      const suit = "#f4f4f6";
      const accent = k.pick(["#ff7a1a", "#3b82f6", "#e63946"]);
      const floating = k.chance(0.5);
      k.group(floating ? `rotate(-10 300 450) translate(0 -40)` : "rotate(0)", () => {
        person(k, Object.assign(L, {
          y: 270, top: suit, sleeve: suit, bottom: suit, shoe: "#9ca3af", gloves: "#d6d9df", noEars: false,
          handL: floating ? [-160, 120] : [-140, 290], handR: [160, 40], elbowR: [175, 160], elbowL: floating ? [-170, 230] : null,
          footL: floating ? [-80, 450] : [-48, 468],
          back(H) {
            k.rect(...H.P(-140, 110), 280, 230, { r: 26, fill: "#c9ccd6", w: 6, shade: "r" });
            k.circle(...H.P(0, -4), 150, { fill: "#e6e8ee", w: 6, shade: "r" });
          },
          outfit(H) {
            k.rect(...H.P(-56, 170), 112, 80, { r: 10, fill: "#d6d9df", w: 5 });
            for (const [i, c] of [[0, "#e63946"], [1, "#ffd21f"], [2, "#2ec4b6"]]) k.circle(...H.P(-30 + i * 30, 196), 9, { fill: c, w: 3 });
            k.rect(...H.P(-36, 220), 72, 14, { r: 4, fill: accent, w: 3 });
            k.rect(...H.P(-96, 296), 192, 18, { r: 4, fill: accent, w: 4 });
            k.rect(...H.P(-74, 100), 148, 30, { r: 14, fill: "#d6d9df", w: 5 });
          },
          hat(H) {
            // cristal del casco
            k.circle(...H.P(0, -4), 134, { fill: "#bfe6ff", w: 0, opacity: 0.22 });
            const [cx, cy] = H.P(-60, -70);
            k.ellipse(cx, cy, 34, 16, { fill: "#ffffff", w: 0, opacity: 0.7, rot: -40 });
            k.circle(...H.P(0, -4), 134, { fill: "none", w: 8 });
            k.circle(...H.P(0, -4), 146, { fill: "none", w: 8, stroke: "#9ca3af" });
          },
        }));
      });
      // bandera o cohete
      if (k.chance(0.5)) {
        k.line([[500, 820], [500, 560]], 6);
        k.path([[500, 560], [590, 570], [590, 640], [500, 630]], { fill: accent, w: 5, smooth: false });
        star(k, 545, 600, 18, "#ffffff", { w: 3 });
      } else if (!k.drop()) {
        k.group("rotate(25 510 420)", () => {
          k.path([[480, 470], [455, 520], [485, 505]], { fill: "#e63946", w: 4 }); k.path([[540, 470], [565, 520], [535, 505]], { fill: "#e63946", w: 4 });
          k.path([[480, 500], [478, 380], [510, 330], [542, 380], [540, 500]], { fill: "#ffffff", w: 5, shade: "r" });
          k.circle(510, 410, 14, { fill: "#5aa9e6", w: 4 });
          flame(k, 510, 500, -0.4);
        });
      }
    },
  },
  // ── PIRATA ──
  {
    key: "pirata",
    words: ["pirata", "piratas", "barco pirata", "loro", "parche", "capitán", "corsario", "espada"],
    name: "Un pirata",
    draw(k) {
      const L = randomLook(k);
      sky(k, "#8fd0f5", "#e6f6ff", 520);
      k.cloud(110, 120, 0.6);
      k.path([[-30, 500], [630, 500], [630, 700], [-30, 700]], { fill: "#2f9be0", w: 5, smooth: false });
      // barquito lejano
      if (!k.drop()) {
        k.path([[430, 500], [540, 500], [525, 525], [445, 525]], { fill: "#6b3f22", w: 4, smooth: false });
        k.line([[485, 500], [485, 420]], 4); k.path([[488, 425], [525, 495], [488, 495]], { fill: "#2b2b30", w: 4, smooth: false });
      }
      // cubierta
      k.rect(-20, 690, 640, 240, { r: 0, fill: "#a8703e", w: 6, raw: true });
      for (const y of [740, 800, 860]) k.line([[-10, y], [610, y]], 4, "#7c4a1e");
      k.rect(-20, 640, 640, 30, { r: 6, fill: "#7c4a1e", w: 5 });
      for (const x of [20, 120, 480, 580]) k.rect(x - 10, 650, 20, 50, { r: 4, fill: "#8b5a2b", w: 4 });
      const beard = !L.fem && k.chance(0.6) ? k.tone(L.hair, 0.05) : null;
      const stripe = k.pick(["#e63946", "#1f2d66"]);
      const parrot = k.chance(0.5);
      person(k, Object.assign(L, {
        y: 270, top: "#ffffff", bottom: "#2b2b30", shoe: "#1f1f24", patch: true, beard, mouth: "grin",
        handL: [-150, 290], handR: [160, 100], elbowR: [180, 230],
        socks: null,
        outfit(H) {
          for (const dy of [140, 185, 230, 275]) k.line(H.PS([[-98, dy], [98, dy]]), 14, stripe);
          k.rect(...H.P(-100, 290), 200, 40, { r: 10, fill: "#e63946", w: 5 });
          k.path(H.PS([[60, 300], [90, 380], [60, 390], [44, 320]]), { fill: "#e63946", w: 4 });
          k.rect(...H.P(-22, 296), 44, 30, { r: 4, fill: "#ffd21f", w: 4 });
        },
        hat(H) {
          k.path(H.PS([[-150, -40], [-110, -110], [-60, -160], [0, -170], [60, -160], [110, -110], [150, -40], [80, -70], [0, -60], [-80, -70]]), { fill: "#2b2b30", light: true, w: 6 });
          k.circle(...H.P(0, -112), 22, { fill: "#ffffff", w: 4 });
          k.dot(...H.P(-8, -114), 5); k.dot(...H.P(8, -114), 5);
          k.line(H.PS([[-26, -80], [26, -76]]), 6, "#ffffff"); k.line(H.PS([[-26, -76], [26, -80]]), 6, "#ffffff");
          if (!k.drop()) k.line(H.PS([[-140, -46], [-80, -74], [0, -64], [80, -74], [140, -46]]), 5, "#ffd21f");
        },
        prop(H) {
          const [x, y] = H.handR;
          k.path([[x - 12, y], [x - 30, y - 180], [x - 10, y - 220], [x + 8, y - 170], [x + 10, y]], { fill: "#e0e4ea", w: 5, light: true });
          k.path([[x - 40, y + 4], [x + 30, y - 10], [x + 32, y + 6], [x - 38, y + 20]], { fill: "#ffd21f", w: 4 });
        },
        front(H) {
          if (parrot && !k.drop()) {
            const [px, py] = H.P(-100, 70);
            k.path([[px - 10, py + 50], [px - 30, py + 140], [px + 10, py + 130]], { fill: "#3b82f6", w: 4 });
            k.ellipse(px, py + 40, 34, 50, { fill: "#2aa84a", shade: "r", w: 5 });
            k.circle(px, py - 20, 30, { fill: "#e63946", w: 5, light: true });
            k.path([[px - 26, py - 22], [px - 54, py - 12], [px - 28, py - 2]], { fill: "#ffd21f", w: 4 });
            k.eye(px - 6, py - 26, 8);
          }
        },
      }));
      if (k.chance(0.5) && !k.drop()) {
        const bx = 440, by = 780;
        k.rect(bx, by, 130, 80, { r: 8, fill: "#a8652e", w: 5, shade: "r" });
        k.path([[bx, by + 4], [bx + 6, by - 40], [bx + 124, by - 40], [bx + 130, by + 4]], { fill: "#9c5a28", w: 5 });
        k.rect(bx + 55, by - 30, 20, 110, { r: 3, fill: "#ffd21f", w: 4 });
      }
    },
  },
  // ── MAGO / BRUJA ──
  {
    key: "mago",
    words: ["mago", "maga", "bruja", "brujo", "magia", "hechizo", "varita", "hechicero"],
    name: "Un mago",
    draw(k) {
      const witch = k.chance(0.5);
      const L = randomLook(k, { fem: witch ? true : k.chance(0.3) });
      sky(k, "#2a1f5a", "#6a4a9a", 900);
      k.stars(16, [0, 0, 600, 500]);
      k.path(crescentPts(500, 120, 50, 22, -12, 44), { fill: "#fff1a8", w: 5 });
      k.ground(760, "#3a2f6a", { wave: 14 });
      const robe = witch ? k.pick(["#2b2b40", "#5a2a7a"]) : k.pick(["#4b3bb0", "#2f6fe0", "#7a3bc2"]);
      const trim = "#ffd21f";
      const old = !witch && k.chance(0.5);
      person(k, Object.assign(L, {
        y: 330, s: 0.96, top: robe, bottom: robe, dress: true, legCol: "#2b2b30", shoe: witch ? "#1f1f24" : "#5a3a8a",
        beard: old ? "#f4f4f6" : null, hair: old ? "#e6e6ee" : L.hair, style: old ? "long" : L.style,
        handL: [-140, 290], handR: [165, 110], elbowR: [185, 240], mouth: "open",
        outfit(H) {
          if (!k.drop()) for (const [dx, dy] of [[-60, 200], [40, 260], [-30, 340], [70, 370], [10, 180]]) star(k, ...H.P(dx, dy), 14, trim, { w: 3 });
          k.line(H.PS([[-134, 412], [0, 424], [134, 412]]), 8, trim);
        },
        hat(H) {
          const hc = witch ? "#2b2b40" : robe;
          k.ellipse(...H.P(0, -70), 175, 34, { fill: hc, w: 6, shade: "b" });
          k.path(H.PS([[-100, -80], [-62, -180], [-14, -250], [40, -300], [62, -276], [44, -236], [72, -160], [100, -80]]), { fill: hc, shade: "r", light: true, w: 6 });
          if (witch) k.rect(...H.P(-96, -118), 192, 34, { r: 4, fill: k.pick(["#9be04a", "#ff7a1a", "#9b5de5"]), w: 5 });
          else if (!k.drop()) { star(k, ...H.P(16, -170), 20, trim, { w: 4 }); k.path(crescentPts(...H.P(-34, -118), 16, 8, -4, 14), { fill: trim, w: 3 }); }
        },
        prop(H) {
          const [x, y] = H.handR;
          k.line([[x - 30, y + 30], [x + 40, y - 120]], 14, "#1f1f24"); k.line([[x - 30, y + 30], [x + 40, y - 120]], 7, "#7c4a1e");
          k.line([[x + 34, y - 106], [x + 40, y - 120]], 7, "#ffffff");
          star(k, x + 48, y - 140, 26, "#ffe066", { w: 4 });
          if (!k.drop()) for (let i = 0; i < 6; i++) { const a = k.R(0, PI * 2), r = k.R(40, 90); star(k, x + 48 + Math.cos(a) * r, y - 140 + Math.sin(a) * r, k.R(6, 10), k.pick(["#ffffff", "#ffe066", "#ff8fb8", "#5ff3e8"]), { w: 0 }); }
        },
      }));
      if (witch) {
        if (!k.drop()) {
          // caldero
          const cx = 470, cy = 800;
          k.path(bumpy(cx, cy - 70, 60, 26, 5, 0.3), { fill: "#9be04a", w: 4 });
          k.ellipse(cx, cy, 90, 70, { fill: "#2b2b30", w: 6, light: true });
          k.ellipse(cx, cy - 56, 80, 18, { fill: "#7ed957", w: 5 });
          for (const [dx, r] of [[-30, 10], [10, 14], [40, 8]]) k.circle(cx + dx, cy - 90 - r, r, { fill: "#b8f08a", w: 3 });
        }
        if (k.chance(0.5) && !k.drop()) {
          // gato negro
          const gx = 110, gy = 800;
          k.ellipse(gx, gy, 40, 46, { fill: "#2b2b30", w: 5 });
          k.path([[gx - 30, gy - 50], [gx - 34, gy - 100], [gx - 10, gy - 76], [gx + 10, gy - 76], [gx + 34, gy - 100], [gx + 30, gy - 50], [gx, gy - 36]], { fill: "#2b2b30", w: 5 });
          k.dot(gx - 12, gy - 60, 6, "#ffe066"); k.dot(gx + 12, gy - 60, 6, "#ffe066");
          k.tube([[gx + 36, gy + 30], [gx + 80, gy + 10], [gx + 80, gy - 40]], 12, "#2b2b30");
        }
      } else if (!k.drop()) {
        // libro de hechizos
        k.rect(80, 780, 130, 34, { r: 4, fill: "#ffffff", w: 5 });
        k.rect(70, 760, 150, 30, { r: 6, fill: "#e63946", w: 5, light: true });
        star(k, 145, 775, 10, trim, { w: 2 });
      }
    },
  },
  // ── BOMBERO ──
  {
    key: "bombero",
    words: ["bombero", "bombera", "bomberos", "fuego", "incendio", "manguera", "camión de bomberos"],
    name: "Un bombero",
    draw(k) {
      const L = randomLook(k);
      sky(k, "#ffb38a", "#ffe6c4", 700);
      // edificio en llamas
      k.rect(360, 250, 240, 460, { r: 0, fill: "#c98a6a", w: 6, shade: "r" });
      for (const [x, y] of [[390, 300], [500, 300], [390, 420], [500, 420], [390, 540], [500, 540]]) k.rect(x, y, 70, 80, { r: 4, fill: "#ffd96a", w: 5 });
      flame(k, 425, 380, 0.75); flame(k, 535, 500, 0.9);
      if (!k.drop()) flame(k, 430, 610, 0.6);
      k.path(bumpy(480, 170, 150, 70, 6, 0.15), { fill: "#9a9aa6", w: 5, shade: "b" });
      k.ground(700, "#9aa0ad", { wave: 0, shade: false });
      // agua
      const water = "#5ab8f0";
      const sp = k.chance(0.5);
      const suit = k.pick(["#ffcf33", "#2b3a66", "#c9a050"]);
      const ref = suit === "#2b3a66" ? "#ffcf33" : "#d6d9df";
      person(k, Object.assign(L, {
        x: 230, y: 280, top: suit, sleeve: suit, bottom: suit, shoe: "#1f1f24", gloves: "#3a3f4a",
        handL: [80, 230], handR: [180, 190], elbowL: [-60, 290], elbowR: [150, 280], mouth: "open",
        outfit(H) {
          for (const dy of [230, 270]) k.line(H.PS([[-102, dy], [102, dy]]), 12, ref);
          k.line(H.PS([[-50, 100], [-50, 330]]), 4, k.tone(suit, -0.3));
          k.line(H.PS([[50, 100], [50, 330]]), 4, k.tone(suit, -0.3));
        },
        hat(H) {
          k.path(H.PS([[-150, -30], [-120, -60], [-100, -120], [-50, -160], [50, -160], [100, -120], [120, -60], [150, -30], [130, -10], [-130, -10]]), { fill: "#e63946", shade: "r", light: true, w: 6 });
          k.line(H.PS([[0, -160], [0, -40]]), 5, "#b8232f");
          k.path(H.PS([[-36, -110], [36, -110], [30, -50], [0, -36], [-30, -50]]), { fill: "#ffd21f", w: 5, light: true });
          k.path(starPts(...H.P(0, -80), 18, 9), { fill: "#e63946", w: 3, smooth: false });
        },
        prop(H) {
          const [x, y] = H.handR;
          k.tube([[x - 130, y + 80], [x - 40, y + 20], [x + 20, y - 20]], 26, "#d6d9df");
          k.tube([[x - 130, y + 80], [-30, 840], [-60, 900]], 26, "#d6d9df");
          k.rect(x + 10, y - 50, 60, 36, { r: 8, fill: "#9ca3af", w: 5 });
          const tip = sp ? [x + 120, y - 230] : [x + 150, y - 150];
          k.path([[x + 70, y - 46], [x + 150, y - (sp ? 150 : 110)], tip, [tip[0] + 30, tip[1] + 40], [x + 160, y - (sp ? 90 : 50)], [x + 70, y - 20]], { fill: water, w: 5, light: true });
          k.line([[x + 90, y - 34], [x + 160, y - (sp ? 110 : 80)]], 5, "#d6f0ff");
          if (!k.drop()) for (let i = 0; i < 7; i++) k.circle(tip[0] + k.R(-30, 60), tip[1] + k.R(-40, 80), k.R(7, 13), { fill: water, w: 3 });
        },
      }));
      if (!k.drop()) {
        // boca de riego
        k.rect(490, 760, 60, 90, { r: 10, fill: "#e63946", w: 5, shade: "r" });
        k.rect(480, 740, 80, 26, { r: 10, fill: "#e63946", w: 5 });
        k.circle(520, 800, 14, { fill: "#ffd21f", w: 4 });
      }
    },
  },
  // ── ABUELA / ABUELO ──
  {
    key: "abuela",
    words: ["abuela", "abuelo", "abuelos", "anciano", "anciana", "jubilado", "yaya", "abuelita"],
    name: "Una abuela",
    draw(k) {
      const fem = k.chance(0.55);
      const L = randomLook(k, { fem, hair: k.pick(["#e6e6ee", "#d6d6de", "#f2f2f6"]), style: fem ? k.pick(["bun", "curly", "bob"]) : k.pick(["bald", "bald", "short"]) });
      room(k, k.pick(["#fbe3d4", "#e6f0d8", "#f3e6f5"]), "#b07842");
      // papel pintado
      if (!k.drop()) for (let y = 40; y < 680; y += 70) for (let x = (y / 70) % 2 ? 40 : 75; x < 600; x += 70) k.dot(x, y, 6, "#ffffff");
      // cuadro y lámpara
      k.rect(60, 120, 120, 100, { r: 4, fill: "#d9a066", w: 6 });
      k.rect(74, 134, 92, 72, { r: 2, fill: "#bfe6ff", w: 4 });
      k.path([[80, 200], [110, 160], [130, 185], [145, 170], [160, 200]], { fill: "#6cc46a", w: 3 });
      k.line([[500, 690], [500, 300]], 6);
      k.path([[440, 300], [460, 220], [540, 220], [560, 300]], { fill: "#ffcf5c", w: 6, light: true });
      k.ellipse(500, 690, 50, 12, { fill: "#3a3f4a", w: 4 });
      // alfombra
      k.ellipse(300, 820, 260, 60, { fill: "#e63946", w: 5 }); k.ellipse(300, 820, 220, 44, { fill: "none", w: 5, stroke: "#ffcf33" });
      const knit = fem && k.chance(0.7);
      const cardigan = k.pick(["#c96b8a", "#7a8fd0", "#8fbf7a", "#d9a066"]);
      person(k, Object.assign(L, {
        y: 270, top: cardigan, bottom: fem ? "#5a5a7a" : "#5a4a3a", skirt: fem ? k.pick(["#5a5a7a", "#7a4a5a"]) : null,
        glasses: true, moustache: !fem && k.chance(0.7) ? "#e6e6ee" : null, legCol: fem ? "#d9b8a0" : null, shoe: "#5a3a2a",
        handL: knit ? [-60, 240] : [-140, 290], handR: knit ? [60, 240] : [140, 300], elbowL: knit ? [-130, 260] : null, elbowR: knit ? [130, 260] : null,
        outfit(H) {
          k.path(H.PS([[-30, 96], [30, 96], [0, 200]]), { fill: "#ffffff", w: 4, smooth: false });
          for (const dy of [180, 230, 280]) k.circle(...H.P(0, dy), 8, { fill: "#ffffff", w: 3 });
          k.line(H.PS([[0, 150], [0, 335]]), 4, k.tone(cardigan, -0.3));
          if (!k.drop()) for (const dx of [-70, 70]) k.rect(...H.P(dx - 20, 250), 40, 34, { r: 6, fill: k.tone(cardigan, -0.1), w: 4 });
        },
        hat(H) { if (!fem && k.chance(0.4)) { k.path(H.PS([[-104, -40], [-90, -100], [0, -126], [90, -100], [104, -40], [150, -30], [150, -14], [-104, -24]]), { fill: "#8b7a6a", w: 6, light: true }); } },
        prop(H) {
          if (knit) {
            const [ax, ay] = H.handL, [bx, by] = H.handR;
            k.line([[ax - 20, ay + 20], [ax + 60, ay - 70]], 6, "#9ca3af"); k.line([[bx + 20, by + 20], [bx - 60, by - 70]], 6, "#9ca3af");
            k.path([[ax + 10, ay - 20], [bx - 10, by - 20], [bx - 20, by + 50], [ax + 20, by + 50]], { fill: "#e63946", w: 5 });
            if (!k.drop()) for (const dy of [0, 22]) k.line([[ax + 18, ay - 4 + dy], [bx - 18, by - 4 + dy]], 3, "#b8232f");
          } else {
            const [x, y] = H.handR;
            k.line([[x, y - 20], [x + 20, 760]], 12, "#1f1f24"); k.line([[x, y - 20], [x + 20, 760]], 6, "#8b5a2b");
            k.arc(x - 18, y - 24, 22, PI, 2.1 * PI, 12, "#1f1f24"); k.arc(x - 18, y - 24, 22, PI, 2.1 * PI, 6, "#8b5a2b");
          }
        },
      }));
      if (knit && !k.drop()) {
        k.circle(170, 780, 40, { fill: "#e63946", w: 5, light: true });
        k.arc(170, 780, 26, 0.2, 2.6, 3, "#b8232f"); k.arc(170, 780, 14, 3, 5.5, 3, "#b8232f");
        k.line([[200, 760], [240, 650], [250, 580]], 3, "#e63946");
      }
    },
  },
  // ── BAILARINA ──
  {
    key: "bailarina",
    words: ["bailarina", "bailarín", "ballet", "bailar", "baile", "danza", "tutú", "bailando"],
    name: "Una bailarina",
    draw(k) {
      const L = randomLook(k, { fem: k.chance(0.85) });
      const stage = k.pick(["#3a2350", "#23304a"]);
      k.bg(stage);
      // foco
      k.path([[240, -10], [360, -10], [560, 860], [40, 860]], { fill: "#fff5c4", w: 0, opacity: 0.22, smooth: false });
      // suelo escenario
      k.rect(-20, 720, 640, 220, { r: 0, fill: "#b07842", w: 6, raw: true });
      for (const x of [60, 180, 300, 420, 540]) k.line([[x, 722], [x + (x - 300) * 0.4, 920]], 3, "#8b5a2b");
      k.ellipse(300, 790, 210, 50, { fill: "#fff5c4", w: 0, opacity: 0.35 });
      // telones
      const cur = k.pick(["#c62839", "#7a2a8a", "#1e5a9a"]);
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -30 : 630, x1 = s < 0 ? 120 : 480;
        k.path([[x0, -20], [x1, -20], [x1 - s * 10, 300], [x1 - s * 50, 520], [x0, 560]], { fill: cur, shade: s < 0 ? "r" : "l", w: 6 });
        if (!k.drop()) for (const f of [0.35, 0.7]) k.line([[x0 + (x1 - x0) * f, -10], [x0 + (x1 - x0) * f * 0.8, 520]], 4, k.tone(cur, -0.25));
        k.circle(x1 - s * 40, 520, 14, { fill: "#ffd21f", w: 4 });
      }
      k.path([[-20, -20], [620, -20], [620, 50], [520, 80], [400, 50], [300, 80], [200, 50], [80, 80], [-20, 50]], { fill: cur, w: 6, shade: "b" });
      const tutu = k.pick(["#ff8fb8", "#a5d8ff", "#c7a6ff", "#ffffff"]);
      const up = k.chance(0.6);
      const leotard = tutu === "#ffffff" ? "#ffb3cc" : k.tone(tutu, -0.15);
      person(k, Object.assign(L, {
        y: 230, s: 0.95, top: leotard, style: L.fem ? "bun" : L.style, legCol: "#ffd6e0", shoe: "#ff8fb8",
        bottom: leotard, skirt: null, shorts: true, mouth: "smile", closedEyes: k.chance(0.4),
        handL: up ? [-62, -185] : [-210, 120], handR: up ? [62, -185] : [210, 120],
        elbowL: up ? [-175, -40] : [-160, 160], elbowR: up ? [175, -40] : [160, 160],
        footL: [-20, 480], footR: [20, 480],
        outfit(H) {
          for (let i = 0; i < 2; i++) k.path(bumpy(...H.P(0, 330 - i * 8), (190 - i * 30) * H.s, (44 - i * 6) * H.s, 10, 0.18), { fill: i ? k.tone(tutu, 0.3) : tutu, w: 5, shade: i ? null : "b" });
          if (!k.drop()) k.circle(...H.P(0, 110), 10, { fill: "#ffffff", w: 3 });
        },
        hat(H) { if (H.fem && !k.drop()) for (const dx of [-24, 0, 24]) k.circle(...H.P(dx, -150), 9, { fill: k.pick(["#ffffff", "#ffd21f", "#ff8fb8"]), w: 3 }); },
      }));
      if (!k.drop()) for (let i = 0; i < 6; i++) star(k, k.pick([k.R(140, 190), k.R(410, 460)]), k.R(140, 640), k.R(9, 14), "#fff5c4", { w: 0 });
    },
  },
  // ── FUTBOLISTA ──
  {
    key: "futbolista",
    words: ["futbolista", "fútbol", "futbol", "balón", "pelota", "gol", "portería", "estadio", "partido"],
    name: "Un futbolista",
    draw(k) {
      const L = randomLook(k);
      sky(k, "#8fd0f5", "#e6f6ff", 560);
      // grada
      k.rect(-20, 260, 640, 220, { r: 0, fill: "#5a6a8a", w: 5 });
      if (!k.drop()) for (let y = 280; y < 470; y += 34) for (let x = 10 + (y % 68 ? 17 : 0); x < 600; x += 34) k.circle(x, y, 10, { fill: k.pick(["#e63946", "#ffd21f", "#ffffff", "#3b82f6", "#ff8fb8"]), w: 0 });
      // campo
      k.rect(-20, 470, 640, 460, { r: 0, fill: "#4cb35a", w: 5 });
      for (let y = 520; y < 900; y += 100) k.rect(-20, y, 640, 50, { r: 0, fill: "#58c066", w: 0, raw: true });
      // portería
      k.rect(60, 380, 480, 12, { r: 4, fill: "#ffffff", w: 5 });
      for (const x of [60, 528]) k.rect(x, 380, 12, 230, { r: 4, fill: "#ffffff", w: 5 });
      if (!k.drop()) { for (let x = 100; x < 530; x += 40) k.line([[x, 392], [x - 10, 600]], 2, "#e6efe6"); for (let y = 420; y < 600; y += 36) k.line([[72, y], [528, y]], 2, "#e6efe6"); }
      k.line([[-20, 640], [620, 640]], 6, "#ffffff");
      const jersey = k.pick(["#e63946", "#3b82f6", "#ffd21f", "#2aa84a", "#ffffff", "#9b5de5"]);
      const short = k.pick(["#ffffff", "#1f2d66", "#1f1f24"]);
      const num = k.I(2, 11);
      const kick = k.chance(0.55);
      const ballAt = kick ? [175, 760] : null;
      person(k, Object.assign(L, {
        y: 250, top: jersey, bottom: short, shorts: true, socks: jersey === "#ffffff" ? "#e63946" : jersey, shoe: "#1f1f24",
        footR: kick ? [140, 440] : [48, 468], mouth: kick ? "open" : "grin",
        handL: kick ? [-170, 210] : [-90, -90], handR: kick ? [150, 250] : [90, -90],
        elbowL: kick ? null : [-160, 40], elbowR: kick ? null : [160, 40],
        outfit(H) {
          const ink = jersey === "#ffffff" || jersey === "#ffd21f" ? "#1f2d66" : "#ffffff";
          // número dibujado con trazos
          const segs = { 0: "abcdef", 1: "bc", 2: "abged", 3: "abgcd", 4: "fgbc", 5: "afgcd", 6: "afgedc", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
          const digit = (d, ox) => {
            const S = { a: [[0, 0], [1, 0]], b: [[1, 0], [1, 1]], c: [[1, 1], [1, 2]], d: [[0, 2], [1, 2]], e: [[0, 1], [0, 2]], f: [[0, 0], [0, 1]], g: [[0, 1], [1, 1]] };
            for (const ch of segs[d]) k.line(S[ch].map(([a, b]) => H.P(ox + a * 30, 160 + b * 45)), 12, ink);
          };
          const ds = String(num).split("");
          ds.forEach((d, i) => digit(+d, ds.length === 1 ? -15 : -40 + i * 50));
          k.path(H.PS([[-40, 96], [40, 96], [0, 130]]), { fill: k.tone(jersey, -0.25), w: 4, smooth: false });
        },
        prop(H) {
          if (!kick) {
            const [x, y] = H.P(0, -150);
            k.circle(x, y, 56, { fill: "#ffffff", w: 6, light: true });
            k.path(starPts(x, y, 20, 18, 5).map(([a, b]) => [a, b]), { fill: "#1f1f24", w: 0 });
            for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i / 5) * PI * 2; k.line([[x + Math.cos(a) * 20, y + Math.sin(a) * 20], [x + Math.cos(a) * 50, y + Math.sin(a) * 50]], 4); }
          }
        },
      }));
      if (kick) {
        const [x, y] = ballAt.map((v, i) => (i ? v + 250 : v + 300));
        const bx = 300 + 175 + 40, by = 250 + 440 - 10;
        k.circle(bx, by, 48, { fill: "#ffffff", w: 6, light: true });
        k.path(starPts(bx, by, 17, 15, 5), { fill: "#1f1f24", w: 0 });
        for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i / 5) * PI * 2; k.line([[bx + Math.cos(a) * 17, by + Math.sin(a) * 17], [bx + Math.cos(a) * 44, by + Math.sin(a) * 44]], 4); }
        if (!k.drop()) for (const dy of [-20, 0, 20]) k.line([[bx + 70, by + dy], [bx + 100, by + dy]], 5, "#ffffff");
        void x; void y;
      }
    },
  },
  // ── MÉDICO ──
  {
    key: "medico",
    words: ["médico", "médica", "medico", "doctor", "doctora", "hospital", "enfermera", "enfermero", "enfermo", "ambulancia"],
    name: "Una médica",
    draw(k) {
      const L = randomLook(k);
      const nurse = k.chance(0.4);
      room(k, k.pick(["#e3f4ef", "#e8f0ff"]), "#c9d3dc");
      // ventana y cruz
      k.rect(50, 110, 150, 150, { r: 8, fill: "#bfe6ff", w: 6, light: true });
      k.line([[125, 110], [125, 260]], 5); k.line([[50, 185], [200, 185]], 5);
      k.rect(410, 100, 140, 140, { r: 20, fill: "#ffffff", w: 6 });
      k.path([[460, 120], [500, 120], [500, 150], [530, 150], [530, 190], [500, 190], [500, 220], [460, 220], [460, 190], [430, 190], [430, 150], [460, 150]], { fill: "#e63946", w: 5, smooth: false });
      // camilla
      if (!k.drop()) { k.rect(400, 560, 220, 40, { r: 10, fill: "#ffffff", w: 5 }); k.rect(390, 600, 240, 20, { r: 4, fill: "#9ca3af", w: 4 }); k.line([[420, 620], [420, 720]], 6); k.line([[590, 620], [590, 720]], 6); }
      const scrubs = k.pick(["#2ec4b6", "#5b8def", "#7fd1b9"]);
      person(k, Object.assign(L, {
        y: 270, top: nurse ? scrubs : "#ffffff", sleeve: nurse ? scrubs : "#ffffff", bottom: nurse ? scrubs : "#3a4b8c",
        handL: [-118, 250], handR: [140, 300], elbowL: [-150, 220], shoe: "#ffffff",
        outfit(H) {
          if (!nurse) {
            k.path(H.PS([[-40, 96], [40, 96], [24, 250], [-24, 250]]), { fill: scrubs, w: 4 });
            k.line(H.PS([[-40, 98], [-6, 250], [-6, 336]]), 5); k.line(H.PS([[40, 98], [6, 250], [6, 336]]), 5);
            k.rect(...H.P(46, 170), 40, 40, { r: 4, fill: "#ffffff", w: 4 });
            k.line(H.PS([[56, 168], [56, 140]]), 6, "#3b82f6");
          } else {
            k.path(H.PS([[-36, 96], [36, 96], [0, 140]]), { fill: k.tone(scrubs, -0.2), w: 4, smooth: false });
            k.rect(...H.P(30, 170), 44, 36, { r: 4, fill: k.tone(scrubs, -0.1), w: 4 });
          }
          // fonendo
          k.line(H.PS([[-50, 96], [-60, 170], [-30, 230]]), 6, "#3a3f4a"); k.line(H.PS([[50, 96], [40, 170], [-10, 230]]), 6, "#3a3f4a");
          k.circle(...H.P(-20, 250), 16, { fill: "#c9ccd3", w: 5, light: true });
        },
        hat(H) {
          if (nurse && !k.drop()) {
            k.path(H.PS([[-70, -90], [-60, -140], [60, -140], [70, -90], [0, -80]]), { fill: "#ffffff", w: 5, shade: "b" });
            k.rect(...H.P(-8, -132), 16, 40, { r: 2, fill: "#e63946", w: 0 }); k.rect(...H.P(-20, -120), 40, 16, { r: 2, fill: "#e63946", w: 0 });
          }
        },
        prop(H) {
          const [x, y] = H.handL;
          k.rect(x - 50, y - 70, 100, 130, { r: 8, fill: "#c58a4a", w: 5 });
          k.rect(x - 40, y - 54, 80, 106, { r: 4, fill: "#ffffff", w: 3 });
          k.rect(x - 16, y - 78, 32, 16, { r: 4, fill: "#9ca3af", w: 3 });
          for (const dy of [-30, -10, 10, 30]) k.line([[x - 28, y + dy], [x + 28, y + dy]], 3, "#9aa3b2");
          k.path([[x - 30, y - 42], [x - 22, y - 34], [x - 10, y - 50]], { closed: false, w: 4, stroke: "#2aa84a", smooth: false });
        },
      }));
      if (!k.drop()) {
        // osito con tirita
        const bx = 520, by = 520;
        k.circle(bx - 24, by - 40, 14, { fill: "#d9a066", w: 4 }); k.circle(bx + 24, by - 40, 14, { fill: "#d9a066", w: 4 });
        k.ellipse(bx, by + 20, 34, 30, { fill: "#d9a066", w: 4 });
        k.circle(bx, by - 18, 30, { fill: "#d9a066", w: 4, light: true });
        k.dot(bx - 10, by - 22, 4); k.dot(bx + 10, by - 22, 4); k.dot(bx, by - 10, 5);
        k.rect(bx + 4, by - 40, 24, 10, { r: 3, fill: "#ffd6b0", w: 3 });
      }
    },
  },
);

module.exports = SUBJECTS;
