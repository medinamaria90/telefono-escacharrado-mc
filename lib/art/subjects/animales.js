// Animales ilustrados para los robots de Dibulíos (lienzo 600 × 900).
// Estilo pegatina de libro infantil: siluetas suaves, tinta, sombra y brillo, colores armoniosos.
const TAU = Math.PI * 2;
const INK = "#1f1f24";

// ---------- utilidades de forma ----------
/** Estrella / borde festoneado (melenas, flores, soles) */
function star(cx, cy, ro, ri, n, rot = 0) {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const t = rot + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    p.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return p;
}
/** Simétrico horizontal respecto a x = ax */
const mir = (pts, ax = 300) => pts.map(([x, y]) => [2 * ax - x, y]);
/** Escala un trozo alrededor de (cx, cy) */
function scaleAt(k, cx, cy, s, fn) {
  k.group(`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`, fn);
}
/** Dibuja en espejo (mirando al otro lado) */
function flipX(k, on, fn) {
  if (on) k.group("translate(600 0) scale(-1 1)", fn);
  else fn();
}
/** Banda vertical recortada a una elipse (rayas de abeja, pez payaso…) */
function band(cx, cy, rx, ry, x0, x1, inset = 0.95) {
  const top = [], bot = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps;
    const u = Math.max(0, 1 - ((x - cx) / rx) ** 2);
    const h = ry * Math.sqrt(u) * inset;
    top.push([x, cy - h]);
    bot.unshift([x, cy + h]);
  }
  return top.concat(bot);
}
const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => [cx + Math.cos((i * TAU) / 6) * r, cy + Math.sin((i * TAU) / 6) * r]);

// ---------- escenarios ----------
function flower(k, x, y, s = 1, c) {
  if (k.drop()) return;
  c = c || k.pick(["#ff8fb8", "#ffffff", "#ffd166", "#c3a6f0", "#ff9f6b"]);
  k.line([[x, y + 8 * s], [x + 3, y + 46 * s]], 4, "#3f9d55");
  for (let i = 0; i < 5; i++) {
    const t = (i * TAU) / 5 - Math.PI / 2;
    k.circle(x + Math.cos(t) * 13 * s, y + Math.sin(t) * 13 * s, 11 * s, { fill: c, w: 3 });
  }
  k.circle(x, y, 9 * s, { fill: "#ffcf33", w: 3 });
}
function sunCloud(k, o = {}) {
  const sx = k.pick([95, 505]);
  if (o.sun !== false) {
    if (!k.drop()) for (let i = 0; i < 8; i++) {
      const t = (i * TAU) / 8;
      k.line([[sx + Math.cos(t) * 66, 115 + Math.sin(t) * 66], [sx + Math.cos(t) * 84, 115 + Math.sin(t) * 84]], 6, "#f6b93b");
    }
    k.circle(sx, 115, 50, { fill: "#ffe066", w: 5, light: true });
  }
  if (o.cloud !== false) k.cloud(sx < 300 ? 430 : 170, o.cloudY || 165, 0.72);
}
function meadow(k, gy = 700, o = {}) {
  k.bg(o.sky || k.pick(["#cfeeff", "#d9f1ff", "#e2f3ff", "#fff1d6"]));
  sunCloud(k, o);
  if (o.hills !== false && !k.drop()) {
    k.path([[-40, gy + 10], [80, gy - 70], [220, gy - 40], [330, gy - 85], [470, gy - 50], [640, gy - 90], [640, gy + 20]], { fill: "#bfe5b0", w: 4 });
  }
  k.ground(gy, o.grass || k.pick(["#94d89a", "#9fdc8c", "#8ed3a0"]), { wave: 10 });
  if (!k.drop()) k.grass(gy + 40, 5, "#3f9d55");
  if (o.flowers !== false) {
    const n = k.I(2, 4);
    for (let i = 0; i < n; i++) flower(k, i % 2 ? k.R(470, 560) : k.R(40, 130), gy + k.R(70, 160), k.R(0.8, 1.1));
  }
}
function bubbles(k, n, area = [40, 60, 560, 700]) {
  for (let i = 0; i < n; i++) {
    if (k.drop()) continue;
    const x = k.R(area[0], area[2]), y = k.R(area[1], area[3]), r = k.R(7, 18);
    k.circle(x, y, r, { fill: "#e3f6ff", w: 3, opacity: 0.75 });
    k.dot(x - r * 0.35, y - r * 0.35, r * 0.25, "#ffffff");
  }
}
function underwater(k, o = {}) {
  k.bg(o.water || k.pick(["#5ab4e0", "#62bde6", "#4fa9d9", "#6ac5d8"]));
  if (!k.drop()) for (const x of [110, 330, 540]) k.path([[x - 35, -20], [x + 35, -20], [x + 110, 620], [x - 10, 620]], { fill: "#ffffff", w: 0, opacity: 0.13, smooth: false });
  k.ground(o.sand || 805, "#f3d9a4", { wave: 12 });
  const weed = k.pick(["#3fae6a", "#2f9e7a", "#58b85c"]);
  k.tube([[60, 860], [38, 760], [78, 670], [48, 580], [70, 520]], 20, weed);
  if (!k.drop()) k.tube([[105, 860], [120, 780], [95, 720]], 16, k.tone(weed, 0.2));
  k.tube([[545, 870], [568, 770], [528, 690], [556, 610]], 20, weed);
  if (!k.drop()) {
    // concha y estrella de mar
    k.path(star(470, 845, 30, 13, 5, -Math.PI / 2), { fill: "#ff9f6b", w: 4, shade: "b" });
    k.path([[170, 860], [150, 830], [175, 812], [200, 830], [190, 860]], { fill: "#ffd6e0", w: 4 });
  }
  bubbles(k, o.bubbles ?? 6);
}
function farm(k, gy = 720) {
  k.bg(k.pick(["#cfeeff", "#dcf1ff", "#fff1d6"]));
  sunCloud(k);
  k.ground(gy - 40, "#a8dc94", { wave: 8, w: 4 });
  if (!k.drop()) {
    // granero al fondo
    const bx = k.pick([30, 400]);
    k.path([[bx, gy - 40], [bx, gy - 170], [bx + 85, gy - 240], [bx + 170, gy - 170], [bx + 170, gy - 40]], { fill: "#d9534f", smooth: false, shade: "r", w: 5 });
    k.path([[bx + 55, gy - 40], [bx + 55, gy - 120], [bx + 115, gy - 120], [bx + 115, gy - 40]], { fill: "#fff4dc", smooth: false, w: 5 });
    k.line([[bx + 55, gy - 120], [bx + 115, gy - 40]], 5);
    k.line([[bx + 115, gy - 120], [bx + 55, gy - 40]], 5);
  }
  // valla
  if (!k.drop()) {
    const fy = gy - 40;
    k.rect(-20, fy - 70, 640, 16, { r: 4, fill: "#f1e3c6", w: 4 });
    k.rect(-20, fy - 35, 640, 16, { r: 4, fill: "#f1e3c6", w: 4 });
    for (let x = 20; x < 600; x += 95) k.rect(x, fy - 95, 26, 100, { r: 6, fill: "#fbf1dc", w: 4 });
  }
  k.ground(gy, k.pick(["#94d89a", "#8ed3a0"]), { wave: 10 });
  if (!k.drop()) k.grass(gy + 50, 5, "#3f9d55");
}
function softBg(k) {
  k.bg(k.pick(["#fff1d6", "#e8f4ff", "#fde7ef", "#e9f7e4", "#efe8ff"]));
}

// ---------- accesorios ----------
function bow(k, x, y, s, c) {
  k.path([[x, y], [x - 40 * s, y - 30 * s], [x - 50 * s, y + 2 * s], [x - 40 * s, y + 30 * s]], { fill: c, shade: "b", w: 5 });
  k.path([[x, y], [x + 40 * s, y - 30 * s], [x + 50 * s, y + 2 * s], [x + 40 * s, y + 30 * s]], { fill: c, shade: "b", w: 5 });
  k.ellipse(x, y, 12 * s, 14 * s, { fill: k.tone(c, -0.12), w: 5 });
}
function partyHat(k, x, y, s, c, rot = 0) {
  k.group(`rotate(${rot} ${x} ${y})`, () => {
    k.path([[x - 44 * s, y], [x, y - 105 * s], [x + 44 * s, y]], { fill: c, smooth: false, shade: "r" });
    if (!k.drop()) for (const [dx, dy] of [[-16, -18], [12, -42], [-4, -66], [20, -14]]) k.dot(x + dx * s, y + dy * s, 6 * s, "#ffffff");
    k.circle(x, y - 108 * s, 15 * s, { fill: "#ffd21f", w: 5 });
  });
}
function beanie(k, x, y, s, c) {
  k.path([[x - 92 * s, y], [x - 86 * s, y - 62 * s], [x - 46 * s, y - 100 * s], [x, y - 110 * s], [x + 46 * s, y - 100 * s], [x + 86 * s, y - 62 * s], [x + 92 * s, y]], { fill: c, shade: "r", light: true });
  k.rect(x - 100 * s, y - 18 * s, 200 * s, 38 * s, { r: 16 * s, fill: k.tone(c, -0.15) });
  if (!k.drop()) for (let i = -3; i <= 3; i++) k.line([[x + i * 26 * s, y - 12 * s], [x + i * 26 * s, y + 14 * s]], 3, k.tone(c, -0.35));
  k.circle(x, y - 120 * s, 26 * s, { fill: "#ffffff", shade: "b" });
}
function topHat(k, x, y, s, c = "#2b2b30", bandC = "#e63946") {
  k.rect(x - 46 * s, y - 105 * s, 92 * s, 105 * s, { r: 8, fill: c, shade: "r" });
  k.rect(x - 46 * s, y - 34 * s, 92 * s, 22 * s, { r: 4, fill: bandC, w: 5 });
  k.ellipse(x, y, 76 * s, 15 * s, { fill: c });
}
function crown(k, x, y, s) {
  k.path([[x - 52 * s, y], [x - 60 * s, y - 62 * s], [x - 28 * s, y - 32 * s], [x, y - 74 * s], [x + 28 * s, y - 32 * s], [x + 60 * s, y - 62 * s], [x + 52 * s, y]], { fill: "#ffd21f", smooth: false, shade: "r", light: true });
  if (!k.drop()) {
    k.dot(x, y - 18 * s, 8 * s, "#e63946");
    k.dot(x - 30 * s, y - 14 * s, 6 * s, "#2ec4b6");
    k.dot(x + 30 * s, y - 14 * s, 6 * s, "#2ec4b6");
  }
}
function scarf(k, pts, c, tail) {
  k.tube(pts, 30, c);
  if (tail) {
    const [x, y] = tail;
    k.path([[x - 20, y], [x + 22, y], [x + 30, y + 105], [x - 12, y + 108]], { fill: c, shade: "r", w: 5 });
    if (!k.drop()) for (const d of [36, 72]) k.line([[x - 18 + d * 0.1, y + d], [x + 24 + d * 0.08, y + d]], 6, "#ffffff");
    k.line([[x - 12, y + 108], [x - 14, y + 124]], 4);
    k.line([[x + 8, y + 108], [x + 8, y + 124]], 4);
    k.line([[x + 26, y + 106], [x + 30, y + 122]], 4);
  }
}

// ---------- piezas de animales reutilizables ----------
function fish(k, cx, cy, s, body, fin, kind = "liso") {
  scaleAt(k, cx, cy, s, () => {
    k.path([[cx + 150, cy], [cx + 245, cy - 92], [cx + 262, cy - 30], [cx + 236, cy], [cx + 262, cy + 30], [cx + 245, cy + 92]], { fill: fin, shade: "r" });
    k.path([[cx - 70, cy - 98], [cx - 20, cy - 168], [cx + 70, cy - 152], [cx + 115, cy - 75]], { fill: fin, shade: "t" });
    k.path([[cx - 5, cy + 95], [cx + 25, cy + 150], [cx + 85, cy + 132], [cx + 90, cy + 82]], { fill: fin });
    k.path([[cx - 192, cy + 8], [cx - 160, cy - 72], [cx - 60, cy - 118], [cx + 60, cy - 110], [cx + 150, cy - 52], [cx + 176, cy], [cx + 150, cy + 52], [cx + 60, cy + 108], [cx - 60, cy + 114], [cx - 160, cy + 72]], { fill: body, shade: "b", light: true });
    if (kind === "payaso") {
      for (const [a, b] of [[-95, -55], [20, 58]]) k.path(band(cx - 8, cy, 184, 116, cx + a, cx + b, 0.93), { fill: "#ffffff", w: 5 });
    } else if (kind === "rayas") {
      for (const [a, b] of [[-60, -38], [0, 22], [60, 82]]) k.path(band(cx - 8, cy, 184, 116, cx + a, cx + b, 0.93), { fill: k.tone(body, -0.25), w: 0 });
    } else if (!k.drop()) {
      for (const [dx, dy] of [[-20, -40], [30, -50], [10, 0], [60, -5], [-10, 45], [45, 45], [95, 20]]) k.arc(cx + dx, cy + dy, 18, 0.15 * Math.PI, 0.85 * Math.PI, 4, k.tone(body, -0.22));
    }
    k.arc(cx - 160, cy, 72, -0.38 * Math.PI, 0.38 * Math.PI, 5, k.tone(body, -0.35));
    k.path([[cx - 30, cy + 25], [cx + 40, cy + 8], [cx + 32, cy + 58]], { fill: fin, w: 5 });
    k.eye(cx - 125, cy - 28, 30, { look: [-0.4, 0] });
    k.arc(cx - 168, cy + 18, 16, 0.2 * Math.PI, 0.85 * Math.PI, 5);
  });
}

// ===================================================================
module.exports = [
  // ------------------------------------------------------------ PERRO
  {
    key: "perro",
    words: ["perro", "perrito", "perra", "perrita", "cachorro", "chucho", "can", "mascota", "hueso"],
    name: "Un perro",
    draw(k) {
      const breed = k.pick(["golden", "marron", "blanco", "dalmata", "negro"]);
      const fur = { golden: "#e8b25e", marron: "#b5753f", blanco: "#f6f1e7", dalmata: "#fbfaf6", negro: "#45454f" }[breed];
      const earC = breed === "blanco" ? "#c98e5a" : breed === "dalmata" ? "#2f2f36" : k.tone(fur, -0.28);
      const muz = breed === "negro" ? "#d2ad84" : breed === "blanco" || breed === "dalmata" ? "#ffffff" : k.tone(fur, 0.5);
      const scene = k.pick(["prado", "prado", "alfombra"]);
      if (scene === "prado") meadow(k, 680, { flowers: true });
      else {
        softBg(k);
        k.ellipse(300, 775, 260, 78, { fill: k.pick(["#7fb3e6", "#e98a8a", "#b39ddb", "#7cc7a8"]), shade: "b" });
        if (!k.drop()) k.ellipse(300, 775, 200, 52, { fill: "none", w: 4, stroke: "#ffffff", opacity: 0.6 });
      }
      // cola moviéndose
      k.tube([[385, 705], [455, 668], [488, 600], [478, 545]], 26, fur);
      if (!k.drop()) { k.arc(478, 545, 50, -0.9 * Math.PI, -0.6 * Math.PI, 4); k.arc(478, 545, 50, -0.35 * Math.PI, -0.1 * Math.PI, 4); }
      // cuerpo
      k.path([[205, 765], [196, 640], [222, 545], [300, 505], [378, 545], [404, 640], [395, 765], [300, 780]], { fill: fur, shade: "r", light: true });
      if (!k.drop()) k.ellipse(300, 655, 50, 82, { fill: muz, w: 0 });
      if (breed === "dalmata" && !k.drop()) for (const [x, y, r] of [[240, 600, 13], [362, 628, 11], [236, 690, 10], [365, 712, 12], [318, 575, 8]]) k.dot(x, y, r, "#2f2f36");
      // muslos y patas
      k.ellipse(212, 728, 46, 54, { fill: fur, shade: "b" });
      k.ellipse(388, 728, 46, 54, { fill: fur, shade: "b" });
      for (const x of [263, 337]) {
        k.path([[x - 25, 600], [x + 25, 600], [x + 27, 762], [x - 27, 762]], { fill: fur, shade: "r" });
        k.ellipse(x, 768, 36, 22, { fill: fur, shade: "b" });
        if (!k.drop()) { k.line([[x - 9, 756], [x - 9, 776]], 3); k.line([[x + 9, 756], [x + 9, 776]], 3); }
      }
      // collar o pañuelo
      const cc = k.pick(["#e63946", "#3b82f6", "#2aa84a", "#9b5de5", "#ff7a1a"]);
      if (k.chance(0.35)) {
        k.path([[222, 508], [378, 508], [300, 600]], { fill: cc, shade: "r" });
        if (!k.drop()) for (const [x, y] of [[270, 528], [330, 528], [300, 560]]) k.dot(x, y, 6, "#ffffff");
      } else {
        k.tube([[230, 512], [300, 532], [370, 512]], 18, cc);
        k.circle(300, 556, 16, { fill: "#ffd21f", light: true, w: 4 });
      }
      // orejas y cabeza
      const head = [[180, 330], [190, 258], [240, 214], [300, 204], [360, 214], [410, 258], [420, 330], [400, 400], [350, 440], [300, 448], [250, 440], [200, 400]];
      k.path(head, { fill: fur, shade: "r", light: true });
      if ((breed === "blanco" || breed === "marron") && k.chance(0.6) && !k.drop()) k.ellipse(348, 300, 42, 38, { fill: earC, w: 0 });
      const ear = [[222, 236], [178, 246], [140, 306], [134, 392], [156, 432], [192, 420], [208, 352], [236, 270]];
      k.path(ear, { fill: earC, shade: "b" });
      k.path(mir(ear), { fill: earC, shade: "b" });
      k.ellipse(300, 382, 74, 54, { fill: muz, w: 5 });
      k.eye(252, 300, 22, { look: [0.1, 0.15] });
      k.eye(348, 300, 22, { look: [0.1, 0.15] });
      if (!k.drop()) { k.arc(252, 280, 26, 1.2 * Math.PI, 1.7 * Math.PI, 4); k.arc(348, 280, 26, 1.3 * Math.PI, 1.8 * Math.PI, 4); }
      k.ellipse(300, 352, 28, 19, { fill: INK, light: true, w: 4 });
      k.line([[300, 370], [300, 392]], 5);
      const tongue = k.chance(0.6);
      if (tongue) k.path([[287, 398], [313, 398], [316, 432], [300, 444], [284, 432]], { fill: "#ff7b8f", w: 5 });
      if (tongue && !k.drop()) k.line([[300, 404], [300, 428]], 3, "#c94f63");
      k.arc(282, 390, 18, 0.05 * Math.PI, 0.9 * Math.PI, 5);
      k.arc(318, 390, 18, 0.1 * Math.PI, 0.95 * Math.PI, 5);
      k.cheeks(222, 378, 372, 16);
      // juguete
      if (!k.drop()) {
        if (k.chance(0.5)) {
          k.circle(490, 790, 34, { fill: "#c8e65a", shade: "rb", light: true });
          k.arc(458, 790, 36, -0.45 * Math.PI, 0.45 * Math.PI, 4, "#ffffff");
        } else {
          k.path([[440, 805], [535, 790], [548, 772], [562, 790], [552, 806], [560, 825], [540, 822], [445, 830], [432, 845], [418, 828], [425, 812], [418, 795], [432, 790]], { fill: "#fff4dc", shade: "b" });
        }
      }
    },
  },

  // ------------------------------------------------------------ PÁJARO
  {
    key: "pajaro",
    words: ["pájaro", "pajarito", "pájaros", "ave", "búho", "lechuza", "loro", "paloma", "gorrión", "periquito", "canario", "nido", "pío"],
    name: "Un pájaro",
    draw(k) {
      const kind = k.pick(["redondo", "redondo", "buho", "loro"]);
      const branchY = 640;
      if (kind === "buho") {
        k.bg(k.pick(["#24305e", "#2c2f5a", "#1f3a5f"]));
        k.stars(12, [0, 0, 600, 520]);
        k.circle(470, 140, 60, { fill: "#fff3b0", light: true, w: 5 });
        if (!k.drop()) k.circle(495, 125, 50, { fill: k.pick(["#24305e"]), w: 0, opacity: 0 });
      } else if (kind === "loro") {
        k.bg("#d9f2d0");
        if (!k.drop()) for (const [x, y, r] of [[60, 120, 20], [540, 220, -25], [70, 420, 30]]) {
          k.group(`rotate(${r} ${x} ${y})`, () => {
            k.path([[x - 90, y], [x - 30, y - 50], [x + 70, y - 40], [x + 110, y], [x + 60, y + 40], [x - 30, y + 40]], { fill: "#5cb85c", shade: "b" });
            k.line([[x - 85, y], [x + 105, y]], 4, "#2f7d32");
          });
        }
      } else {
        k.bg(k.pick(["#d9f1ff", "#fff1d6", "#fde7ef", "#e9f7e4"]));
        sunCloud(k, { cloudY: 150 });
      }
      // rama
      k.tube([[-30, branchY + 20], [200, branchY + 5], [420, branchY - 8], [630, branchY - 25]], 34, "#8b5a2b");
      if (!k.drop()) k.tube([[470, branchY - 12], [520, branchY - 60], [560, branchY - 70]], 14, "#8b5a2b");
      if (!k.drop()) for (const [x, y, r] of [[90, branchY - 20, -30], [520, branchY - 85, 20], [150, branchY + 40, 30]]) {
        k.group(`rotate(${r} ${x} ${y})`, () => k.path([[x - 32, y], [x, y - 18], [x + 32, y], [x, y + 18]], { fill: kind === "buho" ? "#3f8f5a" : "#6cc04a", w: 4 }));
      }

      if (kind === "redondo") {
        const c = k.pick(["#5aa9e6", "#e8645a", "#f6c945", "#4fbfa8", "#a77ee8"]);
        const belly = k.pick(["#fff4dc", "#ffe1c4", "#ffffff"]);
        // cola
        k.path([[390, 560], [500, 520], [540, 540], [470, 600], [420, 610]], { fill: k.tone(c, -0.15), shade: "b" });
        // patitas
        for (const x of [260, 340]) {
          k.line([[x, 600], [x, branchY - 10]], 7, "#f59e0b");
          k.line([[x - 14, branchY - 6], [x, branchY - 12], [x + 14, branchY - 6]], 6, "#f59e0b");
        }
        // cuerpo-cabeza en una pieza
        k.path([[300, 300], [395, 340], [450, 440], [440, 540], [380, 610], [300, 625], [220, 610], [160, 540], [150, 440], [205, 340]], { fill: c, shade: "r", light: true });
        k.path([[300, 470], [370, 495], [395, 555], [360, 605], [300, 618], [240, 605], [205, 555], [230, 495]], { fill: belly, w: 0 });
        // alas
        k.path([[160, 470], [110, 520], [118, 585], [190, 560]], { fill: k.tone(c, -0.12), shade: "b" });
        k.path([[440, 470], [490, 520], [482, 585], [410, 560]], { fill: k.tone(c, -0.12), shade: "b" });
        // copete
        k.path([[285, 310], [270, 245], [300, 280], [318, 232], [318, 305]], { fill: c, w: 5 });
        k.eye(255, 420, 24, { look: [0, 0.1] });
        k.eye(345, 420, 24, { look: [0, 0.1] });
        k.path([[275, 455], [325, 455], [300, 490]], { fill: "#f59e0b", w: 5 });
        k.line([[278, 458], [322, 458]], 3);
        k.cheeks(222, 378, 465, 15);
        if (!k.drop()) {
          if (k.chance(0.4)) partyHat(k, 300, 312, 0.7, k.pick(["#ff8fb8", "#2ec4b6", "#9b5de5"]), 10);
          else for (const [x, y] of [[450, 290], [500, 230]]) {
            k.dot(x, y, 11); k.line([[x + 9, y], [x + 9, y - 48], [x + 28, y - 38]], 5);
          }
        }
      } else if (kind === "buho") {
        const c = k.pick(["#a8774c", "#8f6a4f", "#b98b5e", "#9d8bb5"]);
        const face = k.tone(c, 0.55);
        for (const x of [262, 338]) k.line([[x, 640], [x, branchY - 10]], 8, "#f59e0b");
        k.path([[300, 250], [375, 260], [410, 215], [430, 300], [450, 430], [430, 560], [370, 630], [300, 645], [230, 630], [170, 560], [150, 430], [170, 300], [190, 215], [225, 260]], { fill: c, shade: "r", light: true });
        k.path([[300, 470], [370, 500], [395, 570], [350, 625], [300, 635], [250, 625], [205, 570], [230, 500]], { fill: face, w: 0 });
        if (!k.drop()) for (const [x, y] of [[270, 520], [330, 520], [300, 560], [255, 580], [345, 580], [300, 605]]) k.arc(x, y - 14, 15, 0.2 * Math.PI, 0.8 * Math.PI, 4, k.tone(c, -0.2));
        k.path([[165, 440], [125, 520], [150, 600], [200, 560]], { fill: k.tone(c, -0.18), shade: "b" });
        k.path([[435, 440], [475, 520], [450, 600], [400, 560]], { fill: k.tone(c, -0.18), shade: "b" });
        k.circle(250, 380, 64, { fill: face, w: 5 });
        k.circle(350, 380, 64, { fill: face, w: 5 });
        const sleepy = k.chance(0.25);
        k.eye(250, 380, 40, { iris: "#f59e0b", look: [0.15, 0], closed: sleepy });
        k.eye(350, 380, 40, { iris: "#f59e0b", look: [0.15, 0], closed: sleepy && k.chance(0.5) });
        k.path([[285, 425], [315, 425], [300, 462]], { fill: "#f59e0b", w: 5 });
        if (!k.drop() && k.chance(0.4)) {
          // gorro de dormir
          k.path([[215, 300], [300, 250], [385, 300], [440, 210], [470, 150]], { fill: "#e63946", shade: "r" });
          k.circle(472, 150, 22, { fill: "#ffffff" });
        }
      } else {
        // loro
        const body = k.pick(["#e63946", "#2aa84a", "#3b82f6"]);
        const wing = body === "#3b82f6" ? "#ffd21f" : k.pick(["#3b82f6", "#ffd21f"]);
        // cola larga colgando
        k.path([[275, 600], [250, 880], [290, 900], [330, 600]], { fill: body, shade: "r" });
        k.path([[300, 600], [300, 860], [345, 880], [350, 600]], { fill: wing, shade: "r" });
        for (const x of [270, 330]) {
          k.line([[x, 610], [x, branchY - 10]], 8, "#9ca3af");
          k.line([[x - 15, branchY - 4], [x, branchY - 12], [x + 15, branchY - 4]], 7, "#9ca3af");
        }
        k.path([[230, 380], [300, 330], [370, 380], [395, 480], [380, 580], [330, 630], [270, 630], [220, 580], [210, 480]], { fill: body, shade: "r", light: true });
        // ala
        k.path([[330, 420], [400, 450], [420, 560], [380, 640], [340, 600], [320, 500]], { fill: wing, shade: "b" });
        if (!k.drop()) for (const y of [520, 570]) k.arc(372, y, 26, 0.1 * Math.PI, 0.9 * Math.PI, 4, k.tone(wing, -0.3));
        // cabeza
        k.path([[200, 260], [240, 190], [300, 170], [360, 195], [390, 260], [380, 330], [330, 380], [250, 380], [210, 330]], { fill: body, shade: "r", light: true });
        k.ellipse(260, 270, 52, 46, { fill: "#ffffff", w: 4 });
        k.eye(265, 268, 22, { look: [-0.3, 0] });
        // pico ganchudo
        k.path([[215, 285], [180, 280], [150, 300], [145, 340], [165, 330], [190, 320], [215, 330]], { fill: "#fff4dc", shade: "b" });
        k.path([[205, 330], [175, 335], [178, 355], [210, 352]], { fill: "#3a3a42", w: 4 });
        if (!k.drop()) k.path([[300, 170], [290, 120], [320, 150], [335, 112], [340, 180]], { fill: body, w: 5 });
      }
    },
  },

  // ------------------------------------------------------------ PEZ
  {
    key: "pez",
    words: ["pez", "peces", "pececito", "pecera", "acuario", "pescado", "nadando", "pez payaso"],
    name: "Un pez",
    draw(k) {
      const kind = k.pick(["pecera", "mar", "mar"]);
      if (kind === "pecera") {
        k.bg(k.pick(["#fff1d6", "#fde7ef", "#efe8ff", "#e9f7e4"]));
        if (!k.drop()) for (let x = 40; x < 600; x += 80) k.line([[x, 0], [x, 700]], 10, "#ffffff", { opacity: 0.45 });
        // mesa
        k.rect(-20, 730, 640, 220, { r: 0, fill: "#c99566", shade: "b" });
        if (!k.drop()) for (const y of [800, 860]) k.line([[0, y], [600, y + 4]], 4, "#a8794d");
        // pecera
        const cx = 300, cy = 520, r = 240;
        const arcPts = (y0, rr = r) => {
          const a0 = Math.atan2(y0 - cy, Math.sqrt(rr * rr - (y0 - cy) ** 2));
          const p = [];
          for (let i = 0; i <= 16; i++) { const t = a0 + ((Math.PI - 2 * a0) * i) / 16; p.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); }
          return p;
        };
        k.path(arcPts(330), { fill: "#e7f6ff", w: 6 });
        k.path(arcPts(385, r - 4), { fill: k.pick(["#8fd3f0", "#86cde8", "#9edcf0"]), w: 0 });
        k.path(arcPts(690, r - 6), { fill: "#e9c98f", w: 0 });
        if (!k.drop()) for (let i = 0; i < 12; i++) k.dot(k.R(170, 430), k.R(705, 745), k.R(6, 10), k.pick(["#ff8fb8", "#ffffff", "#9fdcf7", "#ffd166"]));
        k.tube([[150, 720], [140, 640], [170, 580], [150, 520]], 16, "#3fae6a");
        if (!k.drop()) k.tube([[440, 725], [455, 650], [430, 600]], 16, "#58b85c");
        k.line([[106, 385], [170, 375], [240, 390], [300, 380], [360, 390], [430, 378], [494, 385]], 4, "#5aa9d6");
        const c = k.pick(["#ff8c2e", "#ff9f45", "#f97316"]);
        fish(k, 280, 545, 0.72, c, k.tone(c, 0.25), "liso");
        bubbles(k, 4, [180, 400, 260, 480]);
        // brillo del cristal y borde
        k.path([[120, 420], [110, 500], [125, 590]], { closed: false, w: 14, stroke: "#ffffff", opacity: 0.7 });
        k.ellipse(300, 330, 146, 26, { fill: "#d2eefc", w: 6 });
        k.ellipse(300, 330, 120, 15, { fill: "#bfe5f7", w: 0 });
      } else {
        underwater(k, { bubbles: 7 });
        const sp = k.pick(["payaso", "azul", "amarillo", "morado"]);
        const body = { payaso: "#ff8a2a", azul: "#3f7fe0", amarillo: "#ffcf33", morado: "#a77ee8" }[sp];
        const finC = { payaso: "#ff8a2a", azul: "#ffd21f", amarillo: "#ff9f45", morado: "#ff8fb8" }[sp];
        flipX(k, k.chance(0.5), () => fish(k, 290, 430, 1.05, body, finC, sp === "payaso" ? "payaso" : sp === "azul" ? "liso" : k.pick(["rayas", "liso"])));
        if (!k.drop()) fish(k, 470, 690, 0.32, k.pick(["#ff8fb8", "#ffd21f", "#2ec4b6"]), "#ffffff", "liso");
      }
    },
  },

  // ------------------------------------------------------------ CONEJO
  {
    key: "conejo",
    words: ["conejo", "conejito", "coneja", "liebre", "zanahoria", "orejas", "pascua"],
    name: "Un conejo",
    draw(k) {
      const fur = k.pick(["#f7f3ee", "#c6cad3", "#c89a6b", "#e8d5bd"]);
      const inner = "#ffb3c7";
      meadow(k, 690);
      // cola
      k.circle(410, 735, 34, { fill: "#ffffff", shade: "b" });
      // cuerpo
      k.path([[195, 780], [190, 640], [220, 540], [300, 500], [380, 540], [410, 640], [405, 780], [300, 792]], { fill: fur, shade: "r", light: true });
      if (!k.drop()) k.ellipse(300, 670, 62, 90, { fill: k.tone(fur, 0.55), w: 0 });
      // pies
      for (const x of [232, 368]) {
        k.ellipse(x, 790, 58, 28, { fill: fur, shade: "b" });
        if (!k.drop()) { k.ellipse(x, 790, 20, 13, { fill: inner, w: 0 }); for (const d of [-26, 26]) k.dot(x + d, 782, 6, inner); }
      }
      // zanahoria o flor entre las patas
      const holds = k.pick(["zanahoria", "zanahoria", "nada"]);
      if (holds === "zanahoria") {
        for (const [a, b] of [[[248, 585], [205, 525]], [[256, 580], [240, 515]], [[244, 590], [190, 560]]]) k.tube([a, b], 12, "#3fae6a");
        k.path([[232, 598], [270, 565], [385, 690], [370, 700]], { fill: "#ff8a2a", shade: "b", light: true });
        if (!k.drop()) for (const [x, y] of [[280, 610], [310, 640], [340, 668]]) k.line([[x - 10, y + 8], [x + 6, y - 8]], 4, "#d9661a");
      }
      for (const x of [262, 338]) k.ellipse(x, holds === "zanahoria" ? 612 : 640, 30, 26, { fill: fur, shade: "b" });
      // orejas
      const earL = (c, s) => k.ellipse(252, 225, 40 * s, 122 * s, { fill: c, rot: -10, w: s === 1 ? 6 : 0, shade: s === 1 ? "r" : null });
      earL(fur, 1);
      earL(inner, 0.55);
      if (k.chance(0.45)) {
        k.path([[322, 320], [340, 180], [390, 122], [470, 140], [500, 185], [470, 192], [420, 170], [385, 215], [372, 320]], { fill: fur, shade: "b" });
        if (!k.drop()) k.line([[352, 290], [362, 200], [398, 155], [460, 162]], 18, inner);
      } else {
        k.ellipse(348, 225, 40, 122, { fill: fur, rot: 10, shade: "r" });
        k.ellipse(348, 225, 22, 67, { fill: inner, rot: 10, w: 0 });
      }
      // cabeza
      k.path([[190, 400], [205, 335], [255, 300], [300, 296], [345, 300], [395, 335], [410, 400], [385, 465], [300, 495], [215, 465]], { fill: fur, shade: "r", light: true });
      k.eye(258, 392, 20, { look: [0, 0.1] });
      k.eye(342, 392, 20, { look: [0, 0.1] });
      k.path([[288, 425], [312, 425], [300, 440]], { fill: "#ff7b8f", w: 4 });
      k.line([[300, 440], [300, 452]], 4);
      k.arc(287, 452, 13, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      k.arc(313, 452, 13, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      if (!k.drop()) k.rect(291, 462, 18, 18, { r: 3, fill: "#ffffff", w: 3 });
      if (!k.drop()) for (const s of [-1, 1]) { k.line([[300 + s * 30, 440], [300 + s * 100, 425]], 3); k.line([[300 + s * 30, 450], [300 + s * 100, 456]], 3); }
      k.cheeks(225, 375, 440, 16);
      if (!k.drop() && k.chance(0.35)) bow(k, 252, 312, 0.7, k.pick(["#ff8fb8", "#9b5de5", "#3b82f6"]));
    },
  },

  // ------------------------------------------------------------ OSO
  {
    key: "oso",
    words: ["oso", "osito", "osa", "osezno", "peluche", "panda", "miel", "teddy"],
    name: "Un oso",
    draw(k) {
      const kind = k.pick(["peluche", "pardo", "panda"]);
      const fur = kind === "panda" ? "#fbfaf6" : kind === "pardo" ? k.pick(["#9a6338", "#8b5a2b"]) : k.pick(["#d9a066", "#c98e5a", "#e0b07a", "#b98b5e"]);
      const dark = kind === "panda" ? "#2f2f36" : fur;
      const light = kind === "panda" ? "#ffffff" : k.tone(fur, 0.45);
      if (kind === "panda") {
        k.bg(k.pick(["#e9f7e4", "#dff3e6"]));
        k.ground(720, "#9bd48c", { wave: 8 });
        if (!k.drop()) for (const x of [60, 110, 500, 550]) {
          k.tube([[x, 900], [x + 5, 300]], 22, "#7cc46a");
          for (const y of [420, 560, 700]) k.line([[x - 12, y], [x + 16, y]], 5, "#3f8f4a");
        }
      } else if (kind === "pardo") {
        meadow(k, 700);
        if (!k.drop()) {
          k.tube([[470, 760], [480, 300]], 50, "#8b5a2b");
          k.circle(470, 260, 100, { fill: "#5cb85c", shade: "rb" });
        }
      } else {
        softBg(k);
        k.rect(-20, 700, 640, 240, { r: 0, fill: k.pick(["#c99566", "#e2b4c8", "#a8c8e8"]), shade: "b" });
      }
      // cuerpo
      k.path([[200, 740], [192, 600], [225, 495], [300, 470], [375, 495], [408, 600], [400, 740], [300, 760]], { fill: fur, shade: "r", light: true });
      k.ellipse(300, 640, 70, 85, { fill: kind === "panda" ? "#ffffff" : light, w: kind === "peluche" ? 4 : 0 });
      // brazos
      k.ellipse(196, 585, 44, 78, { fill: dark, rot: 25, shade: "b" });
      k.ellipse(404, 585, 44, 78, { fill: dark, rot: -25, shade: "b" });
      // piernas con planta del pie
      for (const s of [-1, 1]) {
        k.ellipse(300 + s * 105, 762, 72, 58, { fill: dark, shade: "b" });
        k.ellipse(300 + s * 112, 770, 38, 34, { fill: kind === "panda" ? "#5a5a64" : light, w: 4 });
        if (!k.drop()) for (const d of [-22, 0, 22]) k.dot(300 + s * 112 + d, 728, 9, kind === "panda" ? "#5a5a64" : light);
      }
      if (kind === "peluche" && !k.drop()) {
        k.line([[300, 480], [300, 760]], 3, k.tone(fur, -0.3), { dash: "8 10" });
        k.rect(160, 735, 44, 40, { r: 4, fill: k.pick(["#9fdcf7", "#ff8fb8"]), w: 4 });
      }
      // honey / bambú
      if (kind === "pardo" && !k.drop()) {
        k.path([[245, 590], [240, 650], [260, 700], [340, 700], [360, 650], [355, 590]], { fill: "#e9a13b", shade: "r", light: true });
        k.rect(238, 575, 124, 26, { r: 10, fill: "#c27a1a" });
        k.path([[260, 585], [340, 585], [330, 625], [310, 610], [300, 640], [285, 612], [262, 620]], { fill: "#ffcf33", w: 4 });
      }
      if (kind === "panda" && !k.drop()) {
        k.tube([[420, 520], [330, 640]], 22, "#7cc46a");
        k.path([[420, 515], [470, 470], [450, 520]], { fill: "#5cb85c", w: 4 });
      }
      // orejas
      for (const s of [-1, 1]) {
        k.circle(300 + s * 100, 220, 46, { fill: dark, shade: "b" });
        if (kind !== "panda") k.circle(300 + s * 100, 225, 24, { fill: light, w: 0 });
      }
      // cabeza
      k.path([[170, 330], [185, 255], [240, 210], [300, 202], [360, 210], [415, 255], [430, 330], [405, 405], [300, 440], [195, 405]], { fill: fur, shade: "r", light: true });
      if (kind === "panda") {
        k.ellipse(250, 320, 36, 48, { fill: "#2f2f36", rot: 30, w: 0 });
        k.ellipse(350, 320, 36, 48, { fill: "#2f2f36", rot: -30, w: 0 });
      }
      k.ellipse(300, 375, 64, 46, { fill: kind === "panda" ? "#ffffff" : light, w: 5 });
      const eyeR = kind === "peluche" ? 15 : 17;
      k.eye(252, 318, eyeR, { look: [0, 0.1] });
      k.eye(348, 318, eyeR, { look: [0, 0.1] });
      k.ellipse(300, 354, 24, 16, { fill: INK, light: true, w: 4 });
      k.line([[300, 368], [300, 385]], 4);
      k.mouth(300, 392, 46, k.pick(["smile", "smile", "open"]));
      k.cheeks(220, 380, 375, 17);
      if (kind === "peluche" && !k.drop()) bow(k, 300, 478, 1, k.pick(["#e63946", "#3b82f6", "#ff8fb8", "#2ec4b6"]));
      if (kind === "pardo" && k.chance(0.3) && !k.drop()) partyHat(k, 300, 215, 0.8, "#9b5de5", -8);
    },
  },

  // ------------------------------------------------------------ ELEFANTE
  {
    key: "elefante",
    words: ["elefante", "elefanta", "elefantito", "trompa", "colmillos", "circo"],
    name: "Un elefante",
    draw(k) {
      const skin = k.pick(["#a9b6c8", "#b8bec9", "#9fb0c4", "#f2b8c6"]);
      const ear = k.tone(skin, -0.08);
      const scene = k.pick(["sabana", "circo"]);
      if (scene === "sabana") {
        k.bg(k.pick(["#fdebc8", "#ffe7c2"]));
        k.circle(470, 170, 80, { fill: "#ffb347", w: 5, light: true });
        k.ground(720, "#e9c779", { wave: 8 });
        if (!k.drop()) k.grass(760, 6, "#b08d3c");
      } else {
        k.bg("#fde7ef");
        if (!k.drop()) for (let x = -20; x < 640; x += 100) k.path([[x, 0], [x + 50, 0], [x + 25, 420]], { fill: "#e63946", w: 0, opacity: 0.25, smooth: false });
        k.ellipse(300, 790, 260, 90, { fill: "#e63946", shade: "b" });
        k.ellipse(300, 770, 240, 70, { fill: "#ffd21f", shade: "b" });
      }
      // cola
      if (!k.drop()) k.line([[400, 620], [440, 650], [445, 700]], 6);
      // cuerpo
      k.path([[190, 760], [180, 600], [215, 470], [300, 440], [385, 470], [420, 600], [410, 760], [300, 772]], { fill: skin, shade: "r", light: true });
      // patas delanteras
      for (const x of [245, 355]) {
        k.path([[x - 42, 600], [x + 42, 600], [x + 46, 790], [x - 46, 790]], { fill: skin, shade: "r" });
        if (!k.drop()) for (const d of [-22, 0, 22]) k.arc(x + d, 795, 11, 1.05 * Math.PI, 1.95 * Math.PI, 4, "#ffffff");
      }
      // orejas
      const earPts = [[220, 300], [160, 230], [85, 250], [55, 360], [80, 470], [150, 510], [220, 450]];
      k.path(earPts, { fill: ear, shade: "l" });
      k.path(mir(earPts), { fill: ear, shade: "r" });
      if (!k.drop()) {
        const inEar = [[210, 320], [160, 270], [110, 285], [92, 365], [110, 440], [160, 470], [205, 430]];
        k.path(inEar, { fill: "#f6c6cf", w: 0, opacity: 0.8 });
        k.path(mir(inEar), { fill: "#f6c6cf", w: 0, opacity: 0.8 });
      }
      // cabeza
      k.path([[212, 300], [235, 232], [300, 208], [365, 232], [388, 300], [380, 385], [340, 435], [260, 435], [220, 385]], { fill: skin, shade: "r", light: true });
      // colmillos
      k.path([[262, 425], [240, 470], [252, 478], [282, 432]], { fill: "#fffaf0", w: 4 });
      k.path([[338, 425], [360, 470], [348, 478], [318, 432]], { fill: "#fffaf0", w: 4 });
      // trompa
      const up = k.chance(0.5);
      const trunk = up ? [[300, 395], [300, 470], [325, 525], [395, 520], [440, 460], [452, 380]] : [[300, 395], [300, 480], [292, 560], [320, 610], [362, 600], [370, 565]];
      k.tube(trunk, 46, skin);
      if (!k.drop()) {
        const n = trunk.length;
        for (let i = 1; i < n - 1; i++) {
          const [x, y] = trunk[i], [x2, y2] = trunk[i + 1];
          const dx = x2 - x, dy = y2 - y, L = Math.hypot(dx, dy) || 1;
          const nx = -dy / L, ny = dx / L;
          k.line([[x + nx * 14, y + ny * 14], [x - nx * 14, y - ny * 14]], 3, k.tone(skin, -0.35));
        }
      }
      if (up && !k.drop()) for (const [x, y, r] of [[470, 330, 13], [430, 300, 10], [500, 290, 9], [455, 255, 8], [520, 340, 8]]) k.ellipse(x, y, r * 0.8, r, { fill: "#9fdcf7", w: 3 });
      k.eye(258, 330, 18, { look: [0, 0.1] });
      k.eye(342, 330, 18, { look: [0, 0.1] });
      if (!k.drop()) { k.arc(258, 312, 22, 1.25 * Math.PI, 1.75 * Math.PI, 4); k.arc(342, 312, 22, 1.25 * Math.PI, 1.75 * Math.PI, 4); }
      k.cheeks(238, 362, 372, 15);
      if (!k.drop()) {
        if (scene === "circo") partyHat(k, 300, 222, 0.85, "#2563eb", 0);
        else if (k.chance(0.4)) flower(k, 360, 225, 1.2, "#ff8fb8");
      }
    },
  },

  // ------------------------------------------------------------ JIRAFA
  {
    key: "jirafa",
    words: ["jirafa", "jirafita", "cuello", "sabana", "manchas"],
    name: "Una jirafa",
    draw(k) {
      const skin = k.pick(["#f6c95a", "#f4c066", "#f7d070"]);
      const spot = k.pick(["#c47a2c", "#b8732f", "#a9652a"]);
      k.bg(k.pick(["#fdebc8", "#d9f1ff", "#ffe9d6"]));
      k.circle(500, 130, 55, { fill: "#ffe066", w: 5, light: true });
      k.ground(820, "#e9c779", { wave: 8 });
      flipX(k, k.chance(0.5), () => {
        // acacia
        if (!k.drop()) {
          k.tube([[490, 830], [480, 560], [450, 470]], 24, "#8b5a2b");
          k.tube([[482, 600], [530, 520]], 16, "#8b5a2b");
          k.path([[360, 470], [400, 420], [500, 400], [600, 420], [640, 470], [560, 500], [430, 500]], { fill: "#79b85a", shade: "b" });
        }
        // patas de atrás (más oscuras)
        for (const x of [295, 445]) {
          k.path([[x - 18, 640], [x + 18, 640], [x + 15, 845], [x - 15, 845]], { fill: k.tone(skin, -0.15), smooth: false });
          k.rect(x - 18, 835, 36, 22, { r: 6, fill: "#5a3d2b" });
        }
        // cola
        k.line([[490, 590], [520, 640], [525, 700]], 6);
        k.path([[515, 695], [535, 695], [540, 735], [512, 735]], { fill: "#5a3d2b", w: 4 });
        // cuerpo
        k.path([[230, 560], [300, 525], [430, 520], [500, 560], [505, 625], [460, 660], [300, 668], [235, 640]], { fill: skin, shade: "b", light: true });
        // patas delanteras
        for (const x of [255, 405]) {
          k.path([[x - 20, 640], [x + 20, 640], [x + 17, 850], [x - 17, 850]], { fill: skin, smooth: false, shade: "r" });
          k.rect(x - 20, 840, 40, 24, { r: 6, fill: "#5a3d2b" });
        }
        // cuello
        k.path([[232, 600], [190, 250], [250, 232], [318, 560]], { fill: skin, shade: "r" });
        // crin
        k.path([[255, 238], [270, 300], [282, 400], [300, 520], [318, 528], [300, 400], [285, 290], [262, 232]], { fill: "#a9652a", w: 4 });
        // manchas
        if (!k.drop()) for (const [x, y, r] of [[300, 580], [370, 560], [440, 575], [330, 630], [410, 625], [470, 615], [235, 470], [258, 540], [220, 390], [242, 320], [212, 300], [258, 410]].map((p) => [...p, 0])) {
          const s = k.R(14, 20);
          k.path([[x - s, y - s * 0.6], [x + s * 0.2, y - s], [x + s, y - s * 0.3], [x + s * 0.8, y + s * 0.7], [x - s * 0.3, y + s], [x - s, y + s * 0.4]], { fill: spot, w: 0 });
        }
        // cabeza
        for (const x of [190, 225]) {
          k.line([[x, 175], [x - 4, 118]], 9, k.tone(skin, -0.2));
          k.circle(x - 4, 112, 12, { fill: "#a9652a", w: 4 });
        }
        k.ellipse(258, 168, 30, 14, { fill: skin, rot: -25, w: 5 });
        k.path([[110, 230], [125, 180], [175, 160], [235, 175], [255, 215], [235, 262], [170, 280], [120, 268]], { fill: skin, shade: "b", light: true });
        k.ellipse(130, 245, 40, 32, { fill: k.tone(skin, -0.12), w: 0 });
        k.dot(115, 240, 5); k.dot(138, 236, 5);
        k.eye(195, 205, 18, { look: [-0.3, 0] });
        if (!k.drop()) for (const d of [-14, 0, 14]) k.line([[195 + d, 185], [195 + d * 1.3, 176]], 3);
        k.arc(150, 248, 26, 0.15 * Math.PI, 0.7 * Math.PI, 4);
        k.cheeks(200, 200, 240, 13);
        // hojita o bufanda
        if (k.chance(0.45) && !k.drop()) {
          k.tube([[203, 320], [245, 340], [292, 328]], 26, "#e63946");
          k.path([[255, 340], [290, 338], [300, 440], [265, 442]], { fill: "#e63946", shade: "r", w: 5 });
          if (!k.drop()) for (const y of [370, 405]) k.line([[262, y], [296, y]], 6, "#ffffff");
        } else if (!k.drop()) {
          k.line([[110, 262], [80, 290]], 4, "#3f8f4a");
          k.path([[80, 290], [60, 280], [55, 305], [78, 312]], { fill: "#79b85a", w: 4 });
        }
      });
    },
  },

  // ------------------------------------------------------------ LEÓN
  {
    key: "leon",
    words: ["león", "leona", "leoncito", "selva", "melena", "rey", "felino"],
    name: "Un león",
    draw(k) {
      const fur = k.pick(["#f2b84b", "#f0b356", "#f5c15e"]);
      const mane = k.pick(["#d9822b", "#c96a28", "#b85c2a", "#e0913b"]);
      const scene = k.pick(["sabana", "selva"]);
      if (scene === "selva") {
        k.bg("#cdeccf");
        if (!k.drop()) for (const [x, y, r, c] of [[40, 160, 30, "#4caf6a"], [560, 120, -30, "#3f9d5a"], [60, 520, 15, "#58b85c"], [550, 480, -15, "#4caf6a"]]) {
          k.group(`rotate(${r} ${x} ${y})`, () => k.path([[x - 110, y], [x - 40, y - 55], [x + 90, y - 30], [x + 120, y], [x + 60, y + 40], [x - 50, y + 45]], { fill: c, shade: "b" }));
        }
        k.ground(740, "#7cc46a", { wave: 10 });
      } else {
        k.bg(k.pick(["#fdebc8", "#ffe7c2"]));
        sunCloud(k, { cloud: false });
        k.ground(740, "#e9c779", { wave: 8 });
        if (!k.drop()) k.grass(780, 5, "#b08d3c");
      }
      // cola
      k.tube([[390, 720], [470, 720], [510, 650], [500, 590]], 20, fur);
      k.path(star(500, 575, 30, 20, 6), { fill: mane, shade: "b" });
      // cuerpo
      k.path([[205, 770], [198, 640], [225, 540], [300, 510], [375, 540], [402, 640], [395, 770], [300, 785]], { fill: fur, shade: "r", light: true });
      if (!k.drop()) k.ellipse(300, 670, 54, 80, { fill: k.tone(fur, 0.45), w: 0 });
      k.ellipse(212, 735, 46, 52, { fill: fur, shade: "b" });
      k.ellipse(388, 735, 46, 52, { fill: fur, shade: "b" });
      for (const x of [263, 337]) {
        k.path([[x - 25, 600], [x + 25, 600], [x + 27, 768], [x - 27, 768]], { fill: fur, shade: "r" });
        k.ellipse(x, 772, 36, 22, { fill: fur, shade: "b" });
        if (!k.drop()) { k.line([[x - 9, 760], [x - 9, 780]], 3); k.line([[x + 9, 760], [x + 9, 780]], 3); }
      }
      // melena
      k.path(star(300, 335, 185, 150, 13, k.R(0, 0.4)), { fill: mane, shade: "rb", light: true });
      if (!k.drop()) k.path(star(300, 340, 150, 128, 13, 0.25), { fill: k.tone(mane, 0.18), w: 0 });
      // orejas
      for (const s of [-1, 1]) {
        k.circle(300 + s * 85, 245, 34, { fill: fur, shade: "b" });
        k.circle(300 + s * 85, 250, 17, { fill: k.tone(fur, -0.2), w: 0 });
      }
      // cara
      k.path([[190, 340], [205, 275], [255, 238], [300, 232], [345, 238], [395, 275], [410, 340], [385, 410], [300, 445], [215, 410]], { fill: fur, shade: "r", light: true });
      k.ellipse(278, 395, 34, 28, { fill: "#fff4dc", w: 0 });
      k.ellipse(322, 395, 34, 28, { fill: "#fff4dc", w: 0 });
      k.eye(255, 325, 21, { look: [0, 0.1], iris: "#5a3d2b" });
      k.eye(345, 325, 21, { look: [0, 0.1], iris: "#5a3d2b" });
      k.path([[280, 365], [320, 365], [300, 388]], { fill: "#8b4a3a", w: 5 });
      k.line([[300, 388], [300, 400]], 4);
      k.arc(286, 400, 15, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      k.arc(314, 400, 15, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      if (!k.drop()) for (const [x, y] of [[268, 392], [262, 405], [332, 392], [338, 405]]) k.dot(x, y, 3.5);
      k.cheeks(225, 375, 380, 15);
      if (!k.drop() && k.chance(0.35)) crown(k, 300, 195, 1);
    },
  },

  // ------------------------------------------------------------ TORTUGA
  {
    key: "tortuga",
    words: ["tortuga", "tortuguita", "caparazón", "lenta", "lento", "galápago"],
    name: "Una tortuga",
    draw(k) {
      const kind = k.pick(["tierra", "tierra", "mar"]);
      const shell = k.pick(["#5fae5a", "#4f9e6a", "#8c6b3f", "#3f9d8a"]);
      const skin = k.pick(["#9ccf6a", "#a8d47a", "#b5d88a"]);
      if (kind === "mar") {
        underwater(k, { bubbles: 6 });
        k.group(`rotate(${k.R(-15, 15)} 300 450)`, () => {
          // aletas
          const fl = [[210, 330], [110, 250], [80, 290], [120, 360], [205, 390]];
          k.path(fl, { fill: skin, shade: "b" }); k.path(mir(fl), { fill: skin, shade: "b" });
          const bl = [[220, 560], [150, 620], [165, 655], [235, 610]];
          k.path(bl, { fill: skin, shade: "b" }); k.path(mir(bl), { fill: skin, shade: "b" });
          k.path([[285, 620], [300, 670], [315, 620]], { fill: skin });
          // cabeza
          k.ellipse(300, 215, 62, 70, { fill: skin, shade: "r", light: true });
          k.eye(272, 205, 16, { look: [0, -0.3] });
          k.eye(328, 205, 16, { look: [0, -0.3] });
          k.mouth(300, 245, 40, "smile");
          // caparazón visto desde arriba
          k.ellipse(300, 450, 160, 195, { fill: shell, shade: "r", light: true });
          k.path(hex(300, 450, 60), { fill: k.tone(shell, 0.2), w: 5, smooth: false });
          if (!k.drop()) for (const a of [0, 1, 2, 3, 4, 5]) {
            const t = (a * TAU) / 6 + Math.PI / 6;
            k.path(hex(300 + Math.cos(t) * 110, 450 + Math.sin(t) * 130, 42), { fill: k.tone(shell, 0.12), w: 4, smooth: false });
          }
        });
        return;
      }
      meadow(k, 690);
      flipX(k, k.chance(0.5), () => {
        // patas de atrás
        k.ellipse(205, 690, 38, 48, { fill: k.tone(skin, -0.15), shade: "b" });
        k.ellipse(420, 690, 38, 48, { fill: k.tone(skin, -0.15), shade: "b" });
        // cola
        k.path([[490, 620], [545, 650], [490, 655]], { fill: skin });
        // cuello y cabeza
        k.tube([[175, 600], [130, 540]], 64, skin);
        k.path([[40, 500], [70, 440], [140, 420], [195, 455], [200, 520], [150, 560], [70, 555]], { fill: skin, shade: "b", light: true });
        k.eye(120, 478, 24, { look: [-0.4, 0] });
        k.arc(80, 500, 34, 0.25 * Math.PI, 0.75 * Math.PI, 5);
        k.cheeks(150, 150, 520, 14);
        // patas delanteras
        k.ellipse(240, 705, 40, 50, { fill: skin, shade: "b" });
        k.ellipse(385, 705, 40, 50, { fill: skin, shade: "b" });
        if (!k.drop()) for (const x of [240, 385]) for (const d of [-16, 0, 16]) k.arc(x + d, 755, 7, 1.1 * Math.PI, 1.9 * Math.PI, 3);
        // caparazón
        k.path([[140, 640], [155, 500], [220, 400], [320, 360], [420, 395], [490, 490], [505, 640]], { fill: shell, shade: "r", light: true });
        k.path([[125, 630], [520, 630], [505, 668], [140, 668]], { fill: k.tone(shell, 0.35), shade: "b" });
        if (!k.drop()) {
          const dk = k.tone(shell, -0.25);
          k.path(hex(320, 505, 58), { fill: k.tone(shell, 0.15), w: 5, smooth: false, stroke: dk });
          for (const [x, y, r] of [[215, 545, 46], [425, 545, 46], [250, 430, 36], [395, 430, 36]]) k.path(hex(x, y, r), { fill: k.tone(shell, 0.1), w: 5, smooth: false, stroke: dk });
        }
        // amigo encima
        if (!k.drop()) {
          const extra = k.pick(["mariquita", "flor", "gorro", "nada"]);
          if (extra === "mariquita") {
            k.circle(330, 360, 26, { fill: "#e63946", light: true });
            k.line([[330, 335], [330, 385]], 3);
            k.circle(330, 330, 13, { fill: INK, w: 3 });
            for (const [x, y] of [[318, 352], [342, 352], [320, 372], [340, 372]]) k.dot(x, y, 4);
          } else if (extra === "flor") flower(k, 108, 545, 1.1);
          else if (extra === "gorro") topHat(k, 128, 432, 0.6, "#2b2b30", k.pick(["#e63946", "#9b5de5"]));
        }
      });
    },
  },

  // ------------------------------------------------------------ CARACOL
  {
    key: "caracol",
    words: ["caracol", "caracolito", "babosa", "concha", "lluvia"],
    name: "Un caracol",
    draw(k) {
      const shell = k.pick(["#e0913b", "#c56fa8", "#e7b65a", "#7f9de0", "#d9785a"]);
      const body = k.pick(["#b9d98a", "#e8d2a6", "#a8d4b8"]);
      const rainy = k.chance(0.35);
      k.bg(rainy ? "#d4dde8" : k.pick(["#e9f7e4", "#fff1d6", "#e2f3ff"]));
      if (rainy) {
        k.cloud(150, 130, 0.9); k.cloud(450, 100, 0.8);
        if (!k.drop()) for (let i = 0; i < 14; i++) { const x = k.R(30, 570), y = k.R(220, 560); k.path([[x, y - 14], [x + 8, y + 4], [x, y + 12], [x - 8, y + 4]], { fill: "#7fb3e6", w: 3 }); }
      } else sunCloud(k);
      k.ground(720, "#94d89a", { wave: 10 });
      // hoja grande al fondo
      if (!k.drop()) {
        k.path([[420, 720], [480, 560], [560, 480], [610, 520], [590, 650], [520, 720]], { fill: "#5cb85c", shade: "r" });
        k.line([[440, 715], [585, 520]], 4, "#3f8f4a");
      }
      if (!k.drop()) k.grass(760, 5, "#3f9d55");
      flipX(k, k.chance(0.5), () => {
        // rastro
        if (!k.drop()) k.path([[480, 742], [560, 745], [620, 742]], { closed: false, w: 10, stroke: "#ffffff", opacity: 0.7 });
        // antenas
        k.line([[140, 520], [110, 400]], 8, k.tone(body, -0.2));
        k.line([[175, 520], [195, 405]], 8, k.tone(body, -0.2));
        k.circle(108, 392, 26, { fill: body, w: 5 });
        k.circle(197, 397, 26, { fill: body, w: 5 });
        k.dot(112, 396, 12); k.dot(201, 401, 12);
        k.dot(108, 391, 4, "#ffffff"); k.dot(197, 396, 4, "#ffffff");
        // cuerpo
        k.path([[85, 735], [90, 620], [120, 535], [170, 515], [215, 560], [225, 650], [470, 660], [530, 700], [520, 745], [300, 752]], { fill: body, shade: "b", light: true });
        k.eye(150, 590, 0.1);
        k.mouth(150, 625, 50, "smile");
        k.cheeks(118, 190, 610, 12);
        // concha con espiral
        const cx = 345, cy = 510, R = 160;
        k.circle(cx, cy, R, { fill: shell, shade: "rb", light: true });
        const sp = [];
        const turns = 2.3, a0 = Math.PI * 0.75;
        for (let i = 0; i <= 50; i++) {
          const t = (i / 50) * turns * TAU;
          const r = 14 + (R - 32) * (i / 50);
          sp.push([cx + Math.cos(a0 - t) * r * -1, cy + Math.sin(a0 - t) * r * -1]);
        }
        k.path(sp.reverse(), { closed: false, w: 9, stroke: k.tone(shell, -0.35) });
        if (!k.drop() && k.chance(0.5)) k.path([[cx - 40, cy - R + 8], [cx - 30, cy - R - 40], [cx - 5, cy - R + 5]], { fill: "#5cb85c", w: 4 });
      });
    },
  },

  // ------------------------------------------------------------ MARIPOSA
  {
    key: "mariposa",
    words: ["mariposa", "mariposas", "polilla", "oruga", "alas", "volando", "primavera"],
    name: "Una mariposa",
    draw(k) {
      const sets = [["#ff9f45", "#ffd166"], ["#5aa9e6", "#c3e3ff"], ["#f78fb3", "#ffe1ec"], ["#a77ee8", "#ffd166"], ["#2ec4b6", "#ffe066"]];
      const [c1, c2] = k.pick(sets);
      const c3 = k.tone(c1, -0.25);
      meadow(k, 740, { sky: k.pick(["#dff3ff", "#fff1d6", "#f3e9ff"]), hills: false, flowers: true });
      if (!k.drop()) for (const x of [180, 420]) flower(k, x, 790, 1.6);
      k.group(`rotate(${k.R(-10, 10)} 300 460)`, () => {
        const up = [[290, 420], [240, 260], [150, 175], [70, 190], [45, 300], [80, 400], [170, 460], [280, 470]];
        const lo = [[290, 480], [210, 495], [130, 560], [120, 660], [190, 700], [260, 650], [292, 560]];
        for (const pts of [up, lo]) {
          k.path(pts, { fill: c1, shade: "l", light: true });
          k.path(mir(pts), { fill: c1, shade: "r", light: true });
        }
        // dibujos de las alas
        for (const s of [-1, 1]) {
          const X = (x) => 300 + s * (300 - x);
          k.ellipse(X(165), 310, 62, 72, { fill: c2, w: 5, rot: s * 25 });
          k.circle(X(165), 310, 26, { fill: c3, w: 4 });
          k.ellipse(X(195), 600, 40, 50, { fill: c2, w: 5 });
          if (!k.drop()) for (const [x, y] of [[90, 230], [62, 300], [85, 380], [150, 650], [210, 680]]) k.dot(X(x), y, 10, "#ffffff");
        }
        // cuerpo
        k.ellipse(300, 490, 24, 150, { fill: "#3a3a42", light: true });
        if (!k.drop()) for (const y of [440, 480, 520, 560]) k.line([[284, y], [316, y]], 3, "#6b6b76");
        // antenas
        k.line([[288, 340], [255, 250], [225, 225]], 5);
        k.line([[312, 340], [345, 250], [375, 225]], 5);
        k.circle(222, 222, 11, { fill: "#3a3a42", w: 3 });
        k.circle(378, 222, 11, { fill: "#3a3a42", w: 3 });
        // cabeza
        k.circle(300, 335, 44, { fill: "#4a4a55", shade: "r", light: true });
        k.eye(284, 330, 13, { look: [0, 0.2] });
        k.eye(316, 330, 13, { look: [0, 0.2] });
        k.mouth(300, 356, 26, "smile");
        k.cheeks(272, 328, 350, 8);
      });
    },
  },

  // ------------------------------------------------------------ PULPO
  {
    key: "pulpo",
    words: ["pulpo", "pulpito", "tentáculos", "calamar", "mar", "fondo del mar"],
    name: "Un pulpo",
    draw(k) {
      const c = k.pick(["#f08aa8", "#b07ce6", "#ff8a5c", "#f2727f", "#e98fd0"]);
      const lt = k.tone(c, 0.35);
      underwater(k, { bubbles: 8 });
      const tents = [
        [[215, 480], [150, 560], [100, 650], [120, 730], [175, 725], [175, 690]],
        [[240, 500], [215, 610], [195, 720], [215, 800], [270, 790]],
        [[280, 510], [280, 630], [265, 740], [250, 820]],
        [[320, 510], [325, 630], [345, 740], [365, 815]],
        [[360, 500], [390, 610], [410, 720], [390, 800], [340, 790]],
        [[385, 480], [450, 560], [500, 650], [480, 730], [425, 725], [425, 690]],
      ];
      for (const t of tents) k.tube(t, 44, c);
      if (!k.drop()) for (const t of [tents[1], tents[4]]) for (let i = 1; i < t.length - 1; i++) k.circle(t[i][0] + (t === tents[1] ? 10 : -10), t[i][1] + 15, 8, { fill: lt, w: 3 });
      // cabeza
      k.path([[170, 430], [175, 300], [225, 195], [300, 168], [375, 195], [425, 300], [430, 430], [390, 510], [210, 510]], { fill: c, shade: "r", light: true });
      if (!k.drop()) for (const [x, y, r] of [[245, 245, 16], [355, 260, 12], [330, 215, 9], [380, 330, 10]]) k.circle(x, y, r, { fill: lt, w: 0 });
      k.eye(250, 390, 32, { look: [0, 0.1] });
      k.eye(350, 390, 32, { look: [0, 0.1] });
      k.mouth(300, 452, 60, k.pick(["smile", "open", "o"]));
      k.cheeks(205, 395, 440, 20);
      if (!k.drop()) {
        const acc = k.pick(["sombrero", "gorro", "nada"]);
        if (acc === "sombrero") topHat(k, 300, 190, 0.9, "#2b2b30", "#ffd21f");
        else if (acc === "gorro") k.group("rotate(-12 300 190)", () => beanie(k, 300, 210, 0.8, "#2ec4b6"));
      }
    },
  },

  // ------------------------------------------------------------ VACA
  {
    key: "vaca",
    words: ["vaca", "vaquita", "toro", "ternero", "ternera", "granja", "leche", "mu"],
    name: "Una vaca",
    draw(k) {
      const brown = k.chance(0.3);
      const base = brown ? "#c48a55" : "#fbfaf6";
      const patch = brown ? "#fbfaf6" : "#2f2f36";
      const night = k.chance(0.3);
      if (night) {
        k.bg("#24305e");
        k.stars(16, [0, 0, 600, 600]);
        k.circle(480, 140, 70, { fill: "#fff3b0", light: true, w: 5 });
        k.ground(720, "#4f8a5e", { wave: 10 });
      } else farm(k, 730);
      // cola
      k.tube([[400, 640], [450, 600], [470, 540]], 10, base);
      k.path(star(472, 525, 18, 12, 5), { fill: patch, w: 4 });
      // cuerpo
      k.path([[175, 780], [170, 600], [205, 500], [300, 475], [395, 500], [430, 600], [425, 780], [300, 792]], { fill: base, shade: "r", light: true });
      if (!k.drop()) {
        k.path([[180, 560], [225, 520], [262, 560], [240, 620], [190, 630]], { fill: patch, w: 0 });
        k.path([[350, 640], [400, 610], [420, 660], [405, 720], [355, 705]], { fill: patch, w: 0 });
      }
      // ubre
      k.ellipse(300, 760, 52, 30, { fill: "#ffb3c7", shade: "b", w: 5 });
      // patas
      for (const x of [228, 372]) {
        k.path([[x - 30, 680], [x + 30, 680], [x + 30, 820], [x - 30, 820]], { fill: base, shade: "r", smooth: false });
        k.rect(x - 32, 805, 64, 32, { r: 8, fill: "#4a4a55" });
      }
      // campana
      k.tube([[220, 495], [300, 515], [380, 495]], 14, k.pick(["#e63946", "#3b82f6", "#8b5a2b"]));
      k.path([[278, 520], [322, 520], [335, 575], [265, 575]], { fill: "#ffd21f", shade: "r", light: true });
      k.dot(300, 580, 8);
      // cuernos y orejas
      k.tube([[245, 225], [225, 180], [232, 150]], 18, "#fff4dc");
      k.tube([[355, 225], [375, 180], [368, 150]], 18, "#fff4dc");
      const ear = [[215, 265], [140, 250], [120, 285], [175, 305], [220, 300]];
      k.path(ear, { fill: base, shade: "b" });
      k.path(mir(ear), { fill: base, shade: "b" });
      if (!k.drop()) { k.ellipse(165, 282, 26, 10, { fill: "#ffb3c7", w: 0, rot: 10 }); k.ellipse(435, 282, 26, 10, { fill: "#ffb3c7", w: 0, rot: -10 }); }
      // cabeza
      k.path([[205, 280], [225, 215], [300, 196], [375, 215], [395, 280], [385, 360], [215, 360]], { fill: base, shade: "r", light: true });
      if (!k.drop()) k.path([[318, 205], [372, 222], [390, 280], [360, 320], [330, 290]], { fill: patch, w: 0 });
      if (!k.drop()) k.path([[280, 200], [290, 180], [302, 198], [315, 182], [320, 205]], { fill: base, w: 4 });
      k.eye(258, 290, 18, { look: [0, 0.1] });
      k.eye(342, 290, 18, { look: [0, 0.1] });
      // morro
      k.ellipse(300, 395, 102, 62, { fill: "#ffb3c7", shade: "b", light: true });
      k.ellipse(265, 385, 13, 18, { fill: "#c9637a", w: 0 });
      k.ellipse(335, 385, 13, 18, { fill: "#c9637a", w: 0 });
      k.arc(300, 405, 30, 0.2 * Math.PI, 0.8 * Math.PI, 4);
      k.cheeks(220, 380, 335, 14);
      if (!k.drop() && !night && k.chance(0.35)) flower(k, 375, 225, 1, "#ffd166");
    },
  },

  // ------------------------------------------------------------ CERDO
  {
    key: "cerdo",
    words: ["cerdo", "cerdito", "cerda", "cochinito", "chancho", "puerco", "barro"],
    name: "Un cerdo",
    draw(k) {
      const pink = k.pick(["#f7a8b8", "#f5b3c2", "#f29fb4"]);
      const dk = k.tone(pink, -0.18);
      if (k.chance(0.5)) farm(k, 730); else { softBg(k); k.ground(720, "#a8dc94", { wave: 8 }); }
      // charco
      k.ellipse(300, 800, 250, 62, { fill: "#9a6a43", shade: "b" });
      if (!k.drop()) k.ellipse(220, 790, 50, 12, { fill: "#b88458", w: 0 });
      // colita rizada
      if (!k.drop()) {
        const sp = [];
        for (let i = 0; i <= 18; i++) { const t = (i / 18) * TAU * 1.4; sp.push([470 + Math.cos(t) * (8 + i * 1.2), 560 + Math.sin(t) * (8 + i * 1.2)]); }
        k.path(sp, { closed: false, w: 8, stroke: dk });
      }
      // cuerpo redondo
      k.path([[140, 620], [160, 500], [230, 440], [300, 430], [370, 440], [440, 500], [460, 620], [430, 730], [300, 770], [170, 730]], { fill: pink, shade: "r", light: true });
      // barro
      if (!k.drop()) for (const [x, y, r] of [[200, 640, 22], [380, 690, 28], [230, 720, 16]]) k.path(star(x, y, r, r * 0.7, 6, k.R(0, 1)), { fill: "#9a6a43", w: 0 });
      // patitas
      for (const x of [235, 365]) {
        k.path([[x - 32, 700], [x + 32, 700], [x + 30, 790], [x - 30, 790]], { fill: pink, shade: "r" });
        k.rect(x - 30, 778, 60, 22, { r: 8, fill: "#8b5a5a" });
        k.line([[x, 780], [x, 798]], 4);
      }
      // orejas
      const ear = [[215, 255], [170, 185], [250, 215]];
      k.path([[205, 270], [175, 180], [265, 225]], { fill: pink, shade: "b" });
      k.path(mir([[205, 270], [175, 180], [265, 225]]), { fill: pink, shade: "b" });
      if (!k.drop()) { k.path([[205, 250], [190, 205], [240, 230]], { fill: dk, w: 0 }); k.path(mir([[205, 250], [190, 205], [240, 230]]), { fill: dk, w: 0 }); }
      // cabeza
      k.path([[170, 360], [185, 280], [240, 230], [300, 220], [360, 230], [415, 280], [430, 360], [400, 440], [300, 470], [200, 440]], { fill: pink, shade: "r", light: true });
      k.eye(250, 320, 18, { look: [0, 0.1] });
      k.eye(350, 320, 18, { look: [0, 0.1] });
      k.ellipse(300, 385, 58, 40, { fill: k.tone(pink, -0.08), shade: "b", light: true });
      k.ellipse(282, 385, 9, 15, { fill: "#8b4a5a", w: 0 });
      k.ellipse(318, 385, 9, 15, { fill: "#8b4a5a", w: 0 });
      k.mouth(300, 437, 50, k.pick(["smile", "smile", "open"]));
      k.cheeks(215, 385, 395, 17);
      if (!k.drop()) {
        const acc = k.pick(["flor", "lazo", "nada"]);
        if (acc === "flor") flower(k, 380, 230, 1.1, "#ffd166");
        else if (acc === "lazo") bow(k, 300, 238, 0.7, "#3b82f6");
      }
    },
  },

  // ------------------------------------------------------------ PATO
  {
    key: "pato",
    words: ["pato", "patito", "pata", "patos", "estanque", "lago", "cuac", "bañera", "patito de goma"],
    name: "Un pato",
    draw(k) {
      const kind = k.pick(["estanque", "estanque", "goma"]);
      const body = kind === "goma" ? "#ffd21f" : k.pick(["#fbfaf6", "#ffd84a", "#f2e6c9"]);
      if (kind === "goma") {
        k.bg(k.pick(["#d6f0f5", "#e3ecff"]));
        if (!k.drop()) for (let x = 0; x <= 600; x += 75) k.line([[x, 0], [x, 560]], 3, "#ffffff");
        if (!k.drop()) for (let y = 0; y <= 560; y += 75) k.line([[0, y], [600, y]], 3, "#ffffff");
      } else {
        k.bg(k.pick(["#d9f1ff", "#e2f3ff", "#fff1d6"]));
        sunCloud(k);
        // juncos
        if (!k.drop()) for (const x of [50, 85, 520, 555]) {
          k.line([[x, 640], [x + 8, 380]], 7, "#3f8f4a");
          k.rect(x - 2, 380, 20, 70, { r: 10, fill: "#8b5a2b", w: 4 });
        }
      }
      // agua de atrás
      k.ground(580, kind === "goma" ? "#a5e0f0" : "#7cc3e8", { wave: 12, shade: false });
      flipX(k, k.chance(0.5), () => {
        // cuerpo con cola levantada
        k.path([[130, 580], [160, 480], [250, 445], [360, 450], [440, 410], [500, 350], [505, 440], [480, 540], [400, 630], [250, 650], [160, 625]], { fill: body, shade: "rb", light: true });
        // ala
        k.path([[280, 500], [370, 480], [440, 470], [430, 540], [370, 580], [300, 560]], { fill: k.tone(body, -0.1), shade: "b" });
        if (!k.drop()) for (const x of [350, 395]) k.arc(x, 520, 30, 0.2 * Math.PI, 0.7 * Math.PI, 4, k.tone(body, -0.35));
        // cabeza
        k.circle(225, 340, 100, { fill: body, shade: "r", light: true });
        if (kind === "estanque" && body === "#fbfaf6" && !k.drop()) k.path([[215, 245], [225, 210], [240, 245]], { fill: body, w: 4 });
        // pico
        k.path([[148, 340], [80, 345], [60, 368], [90, 385], [150, 378]], { fill: "#ff8a2a", shade: "b" });
        k.line([[150, 362], [72, 366]], 4);
        k.eye(215, 315, 22, { look: [-0.4, 0] });
        k.cheeks(255, 255, 365, 15);
        if (!k.drop() && k.chance(0.35)) partyHat(k, 235, 250, 0.7, k.pick(["#2563eb", "#e63946", "#9b5de5"]), -15);
      });
      // agua delante
      k.ground(620, kind === "goma" ? "#bfe9f5" : "#8fd0ef", { wave: 14, phase: 1.5 });
      if (!k.drop()) for (const [x, y] of [[120, 700], [420, 760], [250, 830]]) k.line([[x - 40, y], [x, y - 10], [x + 40, y]], 5, "#ffffff");
      if (kind === "goma") bubbles(k, 10, [40, 560, 560, 680]);
      else if (!k.drop()) for (const x of [470, 110]) { k.ellipse(x, 760, 60, 20, { fill: "#5cb85c", shade: "b", w: 4 }); }
    },
  },

  // ------------------------------------------------------------ PINGÜINO
  {
    key: "pinguino",
    words: ["pingüino", "pingüinos", "pinguino", "polo", "polo norte", "polo sur", "hielo", "nieve", "antártida", "patinando"],
    name: "Un pingüino",
    draw(k) {
      const dark = k.pick(["#2b2f45", "#2a3550", "#33334a"]);
      k.bg(k.pick(["#d8efff", "#cfe8fb", "#e3f1ff"]));
      if (!k.drop()) {
        k.path([[-40, 640], [90, 380], [200, 640]], { fill: "#eef7ff", shade: "r", smooth: false, w: 5 });
        k.path([[380, 640], [520, 340], [660, 640]], { fill: "#e3f1ff", shade: "r", smooth: false, w: 5 });
      }
      k.ground(640, "#f4faff", { wave: 6 });
      if (!k.drop()) for (let i = 0; i < 18; i++) k.dot(k.R(10, 590), k.R(10, 620), k.R(4, 7), "#ffffff");
      // charco helado
      if (!k.drop()) k.ellipse(300, 790, 200, 40, { fill: "#bfe3f7", w: 4 });
      const tilt = k.R(-8, 8);
      k.group(`rotate(${tilt} 300 760)`, () => {
        // pies
        k.ellipse(250, 772, 48, 20, { fill: "#ff9f1c", shade: "b" });
        k.ellipse(350, 772, 48, 20, { fill: "#ff9f1c", shade: "b" });
        // aletas
        k.path([[180, 430], [110, 520], [100, 615], [125, 625], [185, 560]], { fill: dark, shade: "b" });
        k.path(mir([[180, 430], [110, 520], [100, 615], [125, 625], [185, 560]]), { fill: dark, shade: "b" });
        // cuerpo
        k.path([[300, 245], [385, 285], [440, 420], [452, 600], [412, 740], [300, 775], [188, 740], [148, 600], [160, 420], [215, 285]], { fill: dark, shade: "r", light: true });
        k.path([[300, 345], [330, 305], [378, 318], [398, 380], [398, 520], [382, 650], [340, 728], [300, 738], [260, 728], [218, 650], [202, 520], [202, 380], [222, 318], [270, 305]], { fill: "#ffffff", w: 0 });
        k.eye(262, 365, 18, { look: [0, 0.1] });
        k.eye(338, 365, 18, { look: [0, 0.1] });
        k.path([[272, 395], [328, 395], [300, 428]], { fill: "#ff9f1c", w: 5 });
        k.cheeks(240, 360, 405, 15);
        const acc = k.pick(["bufanda", "bufanda", "gorro", "pez"]);
        const ac = k.pick(["#e63946", "#2ec4b6", "#ff8fb8", "#ffd21f"]);
        if (acc === "bufanda" || acc === "gorro") {
          scarf(k, [[178, 450], [300, 478], [422, 450]], ac, [365, 470]);
          if (acc === "gorro" || k.chance(0.5)) beanie(k, 300, 292, 0.88, ac);
        } else if (!k.drop()) {
          k.path([[380, 600], [450, 560], [500, 580], [530, 550], [530, 620], [500, 595], [450, 620]], { fill: "#9fb7d8", shade: "b" });
          k.dot(462, 580, 5);
        }
      });
    },
  },

  // ------------------------------------------------------------ CABALLO
  {
    key: "caballo",
    words: ["caballo", "caballito", "yegua", "poni", "pony", "potro", "galope", "vaquero"],
    name: "Un caballo",
    draw(k) {
      const pony = k.chance(0.3);
      const coat = pony ? k.pick(["#f6d7e6", "#e7ddff", "#fbfaf6"]) : k.pick(["#a0623a", "#c27a43", "#f2eee8", "#5a4a42", "#d9b48a"]);
      const maneC = pony ? null : coat === "#f2eee8" || coat === "#d9b48a" ? "#8b6a4a" : k.tone(coat, -0.45);
      const rainbow = ["#ff8fb8", "#ffd166", "#7fd1ae", "#7fb3e6", "#b39ddb"];
      meadow(k, 790, { flowers: false });
      flipX(k, k.chance(0.5), () => {
        // patas de atrás (lejanas)
        for (const x of [235, 445]) {
          k.path([[x - 18, 610], [x + 18, 610], [x + 16, 815], [x - 16, 815]], { fill: k.tone(coat, -0.15), smooth: false });
          k.rect(x - 19, 805, 38, 26, { r: 6, fill: "#4a3b33" });
        }
        // cola
        if (pony) for (let i = 0; i < 4; i++) k.tube([[470 - i * 4, 520], [520 + i * 8, 560], [530 + i * 10, 640], [510 + i * 12, 720]], 18, rainbow[i]);
        else k.path([[470, 510], [530, 540], [555, 640], [540, 730], [505, 720], [505, 620], [470, 560]], { fill: maneC, shade: "r" });
        // cuerpo
        k.path([[180, 500], [250, 465], [400, 462], [480, 500], [500, 570], [470, 630], [330, 645], [200, 630], [165, 570]], { fill: coat, shade: "b", light: true });
        if (coat === "#f2eee8" && !k.drop()) for (const [x, y] of [[420, 520], [450, 560], [400, 580], [430, 600]]) k.circle(x, y, 12, { fill: "#d6d0c6", w: 0 });
        // patas delanteras
        for (const x of [205, 410]) {
          k.path([[x - 20, 600], [x + 20, 600], [x + 18, 820], [x - 18, 820]], { fill: coat, smooth: false, shade: "r" });
          k.rect(x - 21, 808, 42, 28, { r: 6, fill: "#4a3b33" });
        }
        // silla de montar
        if (!pony && !k.drop() && k.chance(0.45)) {
          k.path([[290, 470], [380, 470], [390, 560], [280, 560]], { fill: "#3b82f6", w: 5 });
          k.path([[300, 462], [370, 462], [365, 490], [305, 490]], { fill: "#7c4a1e", shade: "b" });
        }
        // cuello
        k.path([[175, 545], [150, 420], [160, 320], [210, 285], [265, 340], [280, 480]], { fill: coat, shade: "r" });
        // cabeza
        k.path([[165, 290], [210, 262], [245, 300], [225, 360], [155, 440], [100, 470], [60, 455], [55, 410], [95, 350]], { fill: coat, shade: "b", light: true });
        k.ellipse(82, 440, 40, 30, { fill: k.tone(coat, -0.12), w: 0, rot: -35 });
        k.dot(70, 432, 6);
        k.arc(95, 455, 22, 0.3 * Math.PI, 0.8 * Math.PI, 4);
        // orejas
        k.path([[180, 280], [190, 225], [215, 275]], { fill: coat, w: 5 });
        // crin
        if (pony) {
          for (let i = 0; i < 5; i++) k.tube([[215 + i * 5, 270 + i * 50], [245 + i * 6, 290 + i * 50], [255 + i * 6, 325 + i * 50]], 26, rainbow[i]);
          k.tube([[195, 285], [160, 300], [140, 330]], 22, rainbow[0]);
        } else {
          k.path([[205, 270], [245, 300], [270, 360], [285, 430], [280, 480], [255, 440], [240, 380], [215, 330], [190, 300]], { fill: maneC, shade: "r" });
          k.path([[195, 278], [160, 300], [150, 330], [180, 320], [205, 300]], { fill: maneC, w: 5 });
        }
        k.eye(175, 335, 18, { look: [-0.4, 0] });
        if (!k.drop()) for (const d of [-12, 2]) k.line([[175 + d, 316], [170 + d * 1.4, 306]], 3);
        k.cheeks(160, 160, 385, 13);
        if (pony && !k.drop()) flower(k, 210, 270, 0.9, "#ff8fb8");
      });
    },
  },

  // ------------------------------------------------------------ RANA
  {
    key: "rana",
    words: ["rana", "ranita", "sapo", "renacuajo", "charca", "nenúfar", "príncipe"],
    name: "Una rana",
    draw(k) {
      const g = k.pick(["#6cc04a", "#5cb85c", "#8fd14f", "#4fbf8a"]);
      const belly = k.tone(g, 0.55);
      k.bg(k.pick(["#d9f1ff", "#e2f3ff", "#fff1d6"]));
      sunCloud(k, { cloudY: 140 });
      // estanque
      k.ground(560, "#7cc3e8", { wave: 8 });
      if (!k.drop()) for (const [x, y] of [[90, 640], [500, 620], [130, 850], [480, 860]]) k.line([[x - 35, y], [x, y - 8], [x + 35, y]], 5, "#ffffff");
      if (!k.drop()) for (const x of [40, 75, 540]) { k.line([[x, 600], [x + 6, 400]], 7, "#3f8f4a"); k.rect(x - 4, 400, 22, 70, { r: 11, fill: "#8b5a2b", w: 4 }); }
      // nenúfar
      k.path([[80, 760], [120, 700], [230, 675], [300, 690], [370, 675], [480, 700], [520, 760], [460, 815], [300, 835], [140, 815]], { fill: "#5cae5a", shade: "b" });
      k.path([[300, 760], [270, 835], [330, 835]], { fill: "#7cc3e8", w: 0 });
      if (!k.drop()) k.circle(470, 700, 26, { fill: "#ff9ec4", w: 4, light: true });
      // patas traseras
      for (const s of [-1, 1]) {
        k.ellipse(300 + s * 125, 690, 72, 52, { fill: g, shade: "b", rot: s * 15 });
        k.path([[300 + s * 150, 735], [300 + s * 205, 745], [300 + s * 210, 770], [300 + s * 175, 765], [300 + s * 160, 780], [300 + s * 135, 760]], { fill: g, w: 5 });
      }
      // cuerpo
      k.path([[175, 720], [180, 590], [230, 505], [300, 490], [370, 505], [420, 590], [425, 720], [300, 745]], { fill: g, shade: "r", light: true });
      k.ellipse(300, 640, 82, 88, { fill: belly, w: 0 });
      // brazos
      for (const s of [-1, 1]) {
        k.tube([[300 + s * 60, 600], [300 + s * 70, 680], [300 + s * 65, 735]], 26, g);
        for (const d of [-16, 0, 16]) k.circle(300 + s * 65 + d, 748, 10, { fill: g, w: 4 });
      }
      // ojos saltones
      k.circle(222, 315, 58, { fill: g, shade: "r" });
      k.circle(378, 315, 58, { fill: g, shade: "r" });
      // cabeza
      k.path([[148, 420], [170, 345], [230, 318], [370, 318], [430, 345], [452, 420], [415, 480], [300, 505], [185, 480]], { fill: g, shade: "r", light: true });
      k.eye(222, 308, 36, { look: [0.1, 0.1] });
      k.eye(378, 308, 36, { look: [0.1, 0.1] });
      const m = k.pick(["smile", "lengua"]);
      if (m === "smile") k.arc(300, 340, 110, 0.18 * Math.PI, 0.82 * Math.PI, 6);
      else {
        k.arc(300, 360, 90, 0.2 * Math.PI, 0.8 * Math.PI, 6);
        k.tube([[300, 448], [380, 420], [470, 380]], 12, "#ff7b8f");
        k.circle(490, 370, 14, { fill: "#3a3a42", w: 3 });
        k.ellipse(480, 352, 14, 9, { fill: "#e3f6ff", w: 3, opacity: 0.85 });
        k.ellipse(500, 352, 14, 9, { fill: "#e3f6ff", w: 3, opacity: 0.85 });
      }
      k.dot(285, 395, 4); k.dot(315, 395, 4);
      k.cheeks(190, 410, 425, 20);
      if (!k.drop() && k.chance(0.4)) crown(k, 300, 325, 0.85);
    },
  },

  // ------------------------------------------------------------ DINOSAURIO
  {
    key: "dinosaurio",
    words: ["dinosaurio", "dinosaurios", "dino", "tiranosaurio", "rex", "diplodocus", "jurásico", "prehistoria"],
    name: "Un dinosaurio",
    draw(k) {
      const c = k.pick(["#7cc46a", "#5cbfae", "#a98be0", "#f4a259", "#8fcf5a"]);
      const belly = k.tone(c, 0.5);
      const plate = k.pick(["#ffd166", "#ff8f6b", "#ff8fb8", "#5aa9e6"]);
      k.bg(k.pick(["#ffe9cf", "#fdf0d5", "#dff3ff"]));
      // volcán y palmera
      if (!k.drop()) {
        k.path([[380, 700], [470, 360], [540, 360], [660, 700]], { fill: "#a8846a", shade: "r", w: 5 });
        k.path([[470, 360], [540, 360], [530, 400], [510, 385], [495, 410], [478, 390]], { fill: "#ff7a1a", w: 4 });
        k.cloud(505, 270, 0.55);
      }
      k.ground(760, "#b9d98a", { wave: 10 });
      if (!k.drop()) {
        k.tube([[60, 790], [70, 560], [95, 420]], 22, "#8b5a2b");
        for (const r of [-60, -20, 20, 60, 160]) k.group(`rotate(${r} 95 420)`, () => k.path([[95, 420], [140, 395], [200, 410], [150, 430]], { fill: "#4caf6a", w: 4 }));
      }
      const kind = k.pick(["rex", "rex", "cuello"]);
      flipX(k, k.chance(0.4), () => {
        if (kind === "rex") {
          // placas de la espalda
          for (const [x, y, r] of [[330, 195, -20], [372, 260, 20], [405, 345, 40], [430, 440, 60], [455, 545, 70], [500, 620, 60], [550, 680, 50]]) {
            k.group(`rotate(${r} ${x} ${y})`, () => k.path([[x - 24, y + 10], [x, y - 32], [x + 24, y + 10]], { fill: plate, w: 5 }));
          }
          // cola
          k.path([[380, 580], [470, 610], [560, 690], [600, 745], [560, 750], [440, 710], [360, 700]], { fill: c, shade: "b" });
          // pata lejana
          k.path([[355, 640], [420, 640], [415, 770], [350, 775]], { fill: k.tone(c, -0.15) });
          k.ellipse(395, 778, 48, 20, { fill: k.tone(c, -0.15) });
          // cuerpo
          k.path([[210, 440], [290, 390], [380, 420], [430, 520], [420, 640], [360, 705], [260, 710], [200, 640], [185, 540]], { fill: c, shade: "r", light: true });
          k.path([[210, 470], [255, 450], [285, 520], [278, 640], [240, 692], [205, 630], [196, 540]], { fill: belly, w: 0 });
          if (!k.drop()) for (const y of [510, 560, 610, 655]) k.line([[205, y], [278, y + 4]], 3, k.tone(belly, -0.2));
          // pata cercana
          k.ellipse(300, 640, 70, 80, { fill: c, shade: "rb" });
          k.path([[255, 680], [330, 680], [325, 770], [262, 772]], { fill: c, shade: "r" });
          k.ellipse(285, 778, 54, 22, { fill: c, shade: "b" });
          for (const d of [-36, -12, 12]) k.path([[285 + d - 8, 790], [285 + d, 806], [285 + d + 8, 790]], { fill: "#ffffff", w: 3 });
          // bracitos
          k.tube([[230, 480], [185, 505], [175, 490]], 18, c);
          k.tube([[250, 495], [215, 530], [200, 520]], 18, c);
          // cabeza
          k.path([[95, 290], [115, 220], [180, 180], [270, 172], [345, 200], [365, 265], [345, 330], [285, 368], [175, 372], [110, 350]], { fill: c, shade: "rb", light: true });
          k.path([[112, 318], [190, 330], [290, 318]], { closed: false, w: 6 });
          if (!k.drop()) for (const x of [135, 165, 195, 225, 255]) k.path([[x - 9, 322 + (x - 135) * 0.0], [x + 9, 324], [x, 342]], { fill: "#ffffff", w: 3, smooth: false });
          k.dot(130, 252, 6); k.dot(152, 247, 6);
          k.eye(262, 245, 24, { look: [-0.3, 0] });
          k.arc(262, 222, 28, 1.15 * Math.PI, 1.75 * Math.PI, 5);
          k.cheeks(215, 215, 300, 15);
        } else {
          // cuello largo
          for (const [x, y] of [[420, 520], [480, 530], [540, 560]]) k.path([[x - 20, y + 10], [x, y - 26], [x + 20, y + 10]], { fill: plate, w: 4 });
          k.path([[440, 600], [540, 620], [610, 690], [600, 710], [520, 690], [430, 680]], { fill: c, shade: "b" });
          for (const x of [255, 445]) k.path([[x - 32, 640], [x + 32, 640], [x + 30, 780], [x - 30, 780]], { fill: k.tone(c, -0.15) });
          k.path([[200, 610], [240, 530], [350, 500], [470, 520], [520, 600], [480, 690], [330, 710], [220, 690]], { fill: c, shade: "rb", light: true });
          k.path([[240, 640], [340, 690], [460, 680], [420, 700], [300, 702], [230, 680]], { fill: belly, w: 0 });
          for (const x of [300, 400]) {
            k.path([[x - 34, 650], [x + 34, 650], [x + 32, 790], [x - 32, 790]], { fill: c, shade: "r" });
            for (const d of [-16, 0, 16]) k.dot(x + d, 786, 6, "#ffffff");
          }
          k.tube([[260, 560], [210, 450], [180, 330], [190, 240]], 70, c);
          if (!k.drop()) for (const [x, y] of [[220, 470], [195, 380], [192, 300]]) k.circle(x + 18, y, 10, { fill: belly, w: 0 });
          k.path([[120, 220], [150, 170], [230, 165], [270, 205], [255, 250], [180, 262], [125, 255]], { fill: c, shade: "b", light: true });
          k.eye(205, 205, 20, { look: [-0.3, 0] });
          k.arc(160, 225, 26, 0.2 * Math.PI, 0.75 * Math.PI, 5);
          k.dot(138, 205, 5);
          k.cheeks(220, 220, 240, 12);
        }
      });
    },
  },

  // ------------------------------------------------------------ BALLENA
  {
    key: "ballena",
    words: ["ballena", "ballenas", "delfín", "delfines", "tiburón", "orca", "océano", "cachalote"],
    name: "Una ballena",
    draw(k) {
      const kind = k.pick(["ballena", "ballena", "delfin"]);
      k.bg(k.pick(["#d9f1ff", "#ffe9d6", "#e2f3ff"]));
      sunCloud(k, { cloudY: 150 });
      const seaY = 560;
      k.ground(seaY, "#3f8fd6", { wave: 14, shade: false });
      if (kind === "ballena") {
        const c = k.pick(["#5b8fd9", "#6a7fd0", "#4f8fb8", "#7aa0e0"]);
        flipX(k, k.chance(0.5), () => {
          // chorro
          if (!k.drop()) {
            k.path([[228, 400], [215, 300], [240, 300], [252, 400]], { fill: "#bfe9ff", w: 4 });
            for (const [x, y, r] of [[200, 280, 26], [265, 280, 26], [232, 255, 30], [175, 310, 16], [290, 310, 16]]) k.circle(x, y, r, { fill: "#bfe9ff", w: 4 });
          }
          // cola
          k.path([[440, 560], [500, 470], [520, 400], [545, 420], [530, 500], [480, 600]], { fill: c, shade: "r" });
          k.path([[520, 410], [470, 345], [500, 330], [535, 380], [570, 330], [600, 345], [555, 410]], { fill: c, shade: "b" });
          // cuerpo
          k.path([[70, 570], [100, 470], [200, 405], [340, 405], [450, 470], [500, 560], [470, 640], [320, 690], [150, 670]], { fill: c, shade: "b", light: true });
          k.path([[85, 600], [180, 640], [330, 650], [480, 600], [460, 640], [320, 690], [150, 670], [95, 630]], { fill: "#e8f1ff", w: 0 });
          if (!k.drop()) for (const x of [180, 240, 300, 360]) k.line([[x, 645], [x + 6, 675]], 3, "#9fb7d8");
          k.path([[250, 600], [310, 640], [270, 660]], { fill: k.tone(c, -0.1), w: 5 });
          k.eye(160, 525, 20, { look: [-0.2, 0.1] });
          k.path([[85, 590], [140, 600], [200, 590]], { closed: false, w: 5 });
          k.cheeks(195, 195, 560, 15);
          if (!k.drop() && k.chance(0.35)) topHat(k, 230, 415, 0.75, "#2b2b30", "#e63946");
        });
        k.ground(640, "#4f9ee0", { wave: 16, phase: 2 });
      } else {
        const c = k.pick(["#8fa9c9", "#9bb3d0", "#7f9fc4"]);
        flipX(k, k.chance(0.5), () => {
          // salto en arco
          k.path([[225, 330], [270, 270], [295, 275], [280, 340]], { fill: c, shade: "r" });
          k.path([[120, 610], [130, 520], [200, 400], [300, 335], [410, 360], [480, 440], [520, 500], [500, 520], [430, 480], [350, 440], [270, 450], [200, 520], [175, 620]], { fill: c, shade: "b", light: true });
          k.path([[200, 520], [270, 450], [350, 440], [430, 480], [500, 520], [440, 500], [350, 480], [270, 490], [210, 545]], { fill: "#eef4ff", w: 0 });
          k.path([[100, 640], [80, 600], [145, 600], [210, 600], [190, 650]], { fill: c, shade: "b" });
          k.path([[330, 450], [350, 500], [380, 455]], { fill: c, w: 5 });
          k.eye(430, 425, 16, { look: [0.3, 0.2] });
          k.arc(470, 470, 30, 0.05 * Math.PI, 0.5 * Math.PI, 4);
          k.cheeks(440, 440, 455, 11);
          if (!k.drop()) for (const [x, y, r] of [[90, 560, 12], [60, 590, 9], [230, 590, 10], [255, 560, 7]]) k.ellipse(x, y, r * 0.8, r, { fill: "#bfe9ff", w: 3 });
        });
        k.ground(620, "#4f9ee0", { wave: 16, phase: 2 });
      }
      if (!k.drop()) for (const [x, y] of [[120, 730], [430, 700], [300, 820], [520, 820]]) k.line([[x - 40, y], [x, y - 12], [x + 40, y]], 5, "#d6ecff");
    },
  },

  // ------------------------------------------------------------ GALLINA
  {
    key: "gallina",
    words: ["gallina", "gallinas", "pollito", "pollitos", "pollo", "gallo", "huevo", "huevos", "nido", "pío"],
    name: "Una gallina",
    draw(k) {
      const kind = k.pick(["gallina", "gallina", "pollito"]);
      if (kind === "pollito") {
        meadow(k, 700);
        // huevo roto
        k.path([[150, 640], [165, 560], [190, 540], [215, 570], [245, 535], [275, 572], [300, 540], [330, 572], [360, 535], [385, 570], [410, 540], [435, 560], [450, 640], [420, 760], [300, 800], [180, 760]], { fill: "#fffaf0", shade: "rb" });
        // pollito asomando
        k.circle(300, 440, 140, { fill: "#ffd84a", shade: "r", light: true });
        k.path([[285, 305], [278, 270], [300, 292], [315, 262], [318, 304]], { fill: "#ffd84a", w: 5 });
        k.path([[150, 450], [100, 420], [110, 480], [160, 500]], { fill: "#ffd84a", shade: "b" });
        k.path(mir([[150, 450], [100, 420], [110, 480], [160, 500]]), { fill: "#ffd84a", shade: "b" });
        // frente del huevo encima
        k.path([[150, 640], [180, 570], [215, 600], [245, 565], [275, 600], [300, 570], [330, 600], [360, 565], [385, 600], [420, 570], [450, 640], [420, 760], [300, 800], [180, 760]], { fill: "#fffaf0", shade: "rb", light: true });
        if (!k.drop()) for (const [x, y] of [[230, 690], [370, 720], [300, 650]]) k.dot(x, y, 8, "#f1e3c6");
        k.eye(255, 420, 22, { look: [0, 0.1] });
        k.eye(345, 420, 22, { look: [0, 0.1] });
        k.path([[275, 455], [325, 455], [300, 485]], { fill: "#ff8a2a", w: 5 });
        k.line([[278, 459], [322, 459]], 3);
        k.cheeks(220, 380, 465, 16);
        if (!k.drop()) k.path([[255, 300], [345, 300], [330, 325], [270, 325]], { fill: "#fffaf0", w: 5 });
        return;
      }
      const c = k.pick(["#fbf8f1", "#c47a3c", "#e0a052", "#8b5a2b"]);
      const wingC = k.tone(c, -0.15);
      k.bg(k.pick(["#fff1d6", "#fdebc8", "#e9f7e4"]));
      // pared de granero
      if (!k.drop()) {
        k.rect(-20, -20, 640, 520, { r: 0, fill: "#e98a6a", w: 0 });
        for (let x = 0; x < 600; x += 100) k.line([[x, 0], [x, 500]], 4, "#c9654a");
        k.rect(380, 90, 150, 150, { r: 6, fill: "#cfeeff", w: 6 });
        k.line([[455, 90], [455, 240]], 6); k.line([[380, 165], [530, 165]], 6);
      }
      k.ground(560, "#f2d38b", { wave: 6 });
      if (!k.drop()) for (let i = 0; i < 16; i++) { const x = k.R(10, 590), y = k.R(600, 880); k.line([[x, y], [x + k.R(-20, 20), y + 10]], 4, "#d9b05c"); }
      // nido detrás
      k.ellipse(300, 690, 220, 80, { fill: "#c99566", shade: "b" });
      // huevos
      if (!k.drop()) for (const x of [205, 395]) k.ellipse(x, 630, 30, 38, { fill: "#fffaf0", shade: "r" });
      // cola
      k.path([[420, 520], [470, 400], [510, 360], [530, 410], [555, 400], [545, 470], [500, 560]], { fill: wingC, shade: "r" });
      // cuerpo
      k.path([[150, 600], [165, 480], [230, 420], [330, 420], [430, 450], [480, 520], [470, 610], [300, 650]], { fill: c, shade: "rb", light: true });
      // ala
      k.path([[280, 500], [380, 480], [440, 520], [420, 590], [340, 610], [290, 560]], { fill: wingC, shade: "b" });
      if (!k.drop()) for (const [x, y] of [[340, 560], [385, 555], [410, 525]]) k.arc(x, y, 22, 0.15 * Math.PI, 0.85 * Math.PI, 4, k.tone(c, -0.35));
      // nido delante
      k.path([[80, 660], [140, 640], [300, 660], [460, 640], [520, 660], [500, 740], [300, 770], [100, 740]], { fill: "#d9a066", shade: "b" });
      if (!k.drop()) for (let i = 0; i < 9; i++) { const x = 110 + i * 45; k.line([[x - 25, 690 + (i % 2) * 20], [x + 25, 700 + (i % 3) * 12]], 4, "#a8794d"); }
      // cabeza
      k.path([[210, 260], [245, 215], [270, 240], [290, 205], [312, 245], [330, 235], [320, 280]], { fill: "#e63946", w: 5 });
      k.circle(260, 335, 95, { fill: c, shade: "r", light: true });
      k.path([[175, 320], [120, 340], [175, 360]], { fill: "#ff9f1c", w: 5 });
      k.path([[180, 365], [165, 400], [180, 425], [198, 400], [195, 368]], { fill: "#e63946", w: 4 });
      k.eye(230, 315, 22, { look: [-0.3, 0] });
      k.eye(298, 315, 20, { look: [-0.3, 0] });
      k.cheeks(215, 320, 365, 14);
      // pollitos
      if (!k.drop()) for (const x of k.chance(0.5) ? [110, 500] : [500]) {
        k.circle(x, 800, 42, { fill: "#ffd84a", shade: "r", light: true });
        k.circle(x - 10, 755, 28, { fill: "#ffd84a", shade: "r" });
        k.eye(x - 18, 750, 7);
        k.path([[x - 38, 755], [x - 52, 760], [x - 38, 765]], { fill: "#ff9f1c", w: 3 });
        for (const d of [-14, 14]) k.line([[x + d, 840], [x + d, 860]], 5, "#ff9f1c");
      }
    },
  },

  // ------------------------------------------------------------ ABEJA
  {
    key: "abeja",
    words: ["abeja", "abejita", "abejas", "abejorro", "miel", "colmena", "panal", "zumbido"],
    name: "Una abeja",
    draw(k) {
      const yel = k.pick(["#ffcf33", "#ffd21f", "#f9c440"]);
      const stripe = "#3a3a42";
      const bgKind = k.pick(["flores", "panal"]);
      if (bgKind === "panal") {
        k.bg("#fff1c2");
        if (!k.drop()) for (let r = 0; r < 12; r++) for (let q = 0; q < 8; q++) {
          const x = q * 90 + (r % 2) * 45 - 20, y = r * 78 - 20;
          k.path(hex(x, y, 44).map(([a, b]) => [a, b]), { fill: "none", w: 4, stroke: "#f5c76a", smooth: false, raw: true, dense: false });
        }
        k.path([[-20, -20], [620, -20], [620, 40], [520, 40], [500, 110], [480, 40], [300, 40], [280, 160], [258, 40], [80, 40], [62, 90], [45, 40], [-20, 40]], { fill: "#f6a81d", w: 5, shade: "b" });
        k.path([[400, 900], [400, 760], [430, 720], [540, 720], [560, 760], [560, 900]], { fill: "#e9a13b", shade: "r", light: true });
        k.rect(390, 700, 180, 40, { r: 12, fill: "#c27a1a" });
        if (!k.drop()) k.ellipse(480, 700, 60, 12, { fill: "#ffcf33", w: 0 });
      } else {
        meadow(k, 720, { flowers: false });
        for (const [x, y, s] of [[90, 760, 2], [300, 800, 1.6], [500, 760, 2.1]]) flower(k, x, y, s);
      }
      // estela
      if (!k.drop()) k.path([[540, 620], [500, 700], [420, 690], [440, 630], [500, 650], [560, 760], [620, 780]], { closed: false, w: 4, dash: "12 14", stroke: "#6b6b76" });
      k.group(`rotate(${k.R(-14, 4)} 320 470)`, () => {
        // alas
        k.ellipse(290, 320, 64, 100, { fill: "#eaf7ff", rot: -22, w: 5, opacity: 0.92, light: true });
        k.ellipse(370, 335, 56, 88, { fill: "#eaf7ff", rot: 22, w: 5, opacity: 0.92, light: true });
        // aguijón
        k.path([[460, 455], [520, 480], [460, 505]], { fill: stripe, smooth: false, w: 4 });
        // cuerpo
        k.ellipse(330, 480, 150, 112, { fill: yel, shade: "b", light: true });
        for (const [a, b] of [[275, 310], [345, 380], [410, 440]]) k.path(band(330, 480, 150, 112, a, b), { fill: stripe, w: 0 });
        // patitas
        if (!k.drop()) for (const x of [270, 330, 390]) k.line([[x, 585], [x - 10, 625], [x - 2, 640]], 6);
        // cabeza
        k.circle(185, 440, 92, { fill: yel, shade: "rb", light: true });
        k.line([[165, 360], [140, 280], [110, 260]], 5);
        k.line([[210, 355], [225, 275], [255, 255]], 5);
        k.circle(106, 256, 13, { fill: stripe, w: 3 });
        k.circle(259, 251, 13, { fill: stripe, w: 3 });
        k.eye(155, 430, 22, { look: [-0.2, 0.1] });
        k.eye(222, 430, 22, { look: [-0.2, 0.1] });
        k.mouth(188, 478, 48, k.pick(["smile", "open"]));
        k.cheeks(132, 245, 470, 15);
      });
      if (bgKind === "flores" && !k.drop()) {
        // tarrito de miel en el suelo
        k.path([[430, 860], [425, 800], [445, 770], [525, 770], [545, 800], [540, 860]], { fill: "#e9a13b", shade: "r", light: true });
        k.rect(430, 755, 110, 28, { r: 10, fill: "#c27a1a" });
      }
    },
  },
];
