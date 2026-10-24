// Objetos, vehículos y comida (dibujos de los robots)
// Lienzo vertical 600 × 900. Ver lib/art/README.md para el kit y el estilo.

/** Puntos de un arco de elipse (ángulos en radianes) */
function arcPts(cx, cy, rx, ry, a0, a1, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return pts;
}

/** Destello de cuatro puntas */
function sparkle(k, x, y, s, c = "#fff3a8", w = 3) {
  const q = s * 0.28;
  k.path([[x, y - s], [x + q, y - q], [x + s, y], [x + q, y + q], [x, y + s], [x - q, y + q], [x - s, y], [x - q, y - q]], { fill: c, w, smooth: false });
}

/** Mesa / encimera que ocupa la parte de abajo */
function table(k, y, color) {
  k.path([[-30, y], [630, y], [630, 930], [-30, 930]], { fill: color, smooth: false, shade: "b", w: 5 });
  if (!k.drop()) k.line([[-30, y + 30], [630, y + 30]], 3, k.tone(color, -0.25));
}

/** Fondo de pared con un dibujito suave (lunares o rayas) */
function wall(k, color, pattern) {
  k.bg(color);
  const c = k.tone(color, -0.07);
  if (pattern === "dots") {
    for (let y = 40; y < 900; y += 90) for (let x = (y / 90) % 2 ? 80 : 35; x < 620; x += 90) k.dot(x, y, 9, c);
  } else if (pattern === "stripes") {
    for (let x = 30; x < 620; x += 80) k.path([[x, -20], [x + 34, -20], [x + 34, 920], [x, 920]], { fill: c, w: 0, smooth: false });
  }
}

/** Humo/vapor ondulado */
function steam(k, x, y, h, color = "#ffffff", w = 7) {
  const pts = [];
  for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i * 1.4) * 14, y - (h * i) / 6]);
  k.line(pts, w, color, { opacity: 0.85 });
}

/** Nota musical */
function note(k, x, y, s, c) {
  k.ellipse(x, y, 16 * s, 12 * s, { fill: c, w: 4, rot: -20 });
  k.line([[x + 14 * s, y - 4 * s], [x + 14 * s, y - 70 * s]], 6);
  k.line([[x + 14 * s, y - 70 * s], [x + 36 * s, y - 50 * s], [x + 34 * s, y - 34 * s]], 6);
}

/** Zeta de dormir */
function zeta(k, x, y, s, c = "#fff") {
  k.line([[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]], Math.max(4, s * 0.35), c, { smooth: false });
}

/** Cilindro visto un poco desde arriba (lado + tapa) */
function cylinder(k, cx, top, bottom, rx, ry, side, cap, opts = {}) {
  const pts = [[cx - rx, top], ...arcPts(cx, bottom, rx, ry, Math.PI, 0, 20), [cx + rx, top], ...arcPts(cx, top, rx, ry, 0, Math.PI, 20)];
  k.path(pts, { fill: side, smooth: false, shade: "r", w: opts.w ?? 6 });
  if (cap) k.ellipse(cx, top, rx, ry, { fill: cap, w: opts.w ?? 6, n: 28 });
}

module.exports = [
  // ───────────────────────────── COCHE ─────────────────────────────
  {
    key: "coche",
    words: ["coche", "coches", "taxi", "carrera", "atasco", "conducir", "carretera", "automóvil"],
    name: "Un coche",
    draw(k) {
      const type = k.pick(["normal", "normal", "taxi", "carrera"]);
      const body = type === "taxi" ? "#ffcf33" : type === "carrera" ? k.pick(["#e63946", "#2563eb", "#22a06b"]) : k.pick(["#e63946", "#3b82f6", "#2ec4b6", "#ff7a1a", "#9b5de5", "#ff8fb8", "#8fd14f"]);
      k.bg(k.pick(["#bfe6ff", "#cdeefd", "#ffe9c7"]));
      if (k.chance(0.6)) k.circle(470, 140, 55, { fill: "#ffe066", w: 5, light: true });
      k.cloud(140, 150, 0.8);
      k.cloud(420, 300, 0.6);
      // colinas y árboles lejanos
      k.ground(520, k.pick(["#9fd8a0", "#b5e3a1"]), { wave: 24 });
      if (!k.drop()) for (const x of [90, 520]) {
        k.line([[x, 560], [x, 500]], 10, "#8b5a2b");
        k.circle(x, 470, 42, { fill: "#4fb86a", shade: "r", w: 5 });
      }
      // carretera
      k.path([[-30, 600], [630, 600], [630, 930], [-30, 930]], { fill: "#7b818c", smooth: false, w: 5 });
      k.path([[-30, 600], [630, 600], [630, 620], [-30, 620]], { fill: "#c9ccd2", smooth: false, w: 4 });
      if (!k.drop()) for (let x = 10; x < 600; x += 150) k.rect(x, 812, 90, 18, { r: 6, fill: "#ffffff", w: 0 });
      // sombra
      k.ellipse(305, 728, 255, 20, { fill: "#2b2f38", w: 0, opacity: 0.35 });
      if (type === "carrera" && !k.drop()) for (const y of [470, 540, 610]) k.line([[-10, y], [40, y]], 7, "#ffffff");
      // alerón de carreras
      if (type === "carrera") {
        k.line([[100, 545], [92, 500]], 9);
        k.rect(48, 484, 92, 22, { r: 6, fill: k.tone(body, -0.2) });
      }
      // carrocería
      k.path([[60, 668], [55, 595], [82, 550], [150, 530], [205, 445], [255, 410], [392, 410], [442, 445], [492, 525], [548, 545], [563, 600], [558, 668]], { fill: body, shade: "b", light: true });
      // ventanas
      const glass = "#d4f1ff";
      k.path([[258, 428], [372, 428], [372, 518], [206, 518]], { fill: glass, smooth: false, w: 5, light: true });
      k.path([[395, 428], [432, 448], [472, 518], [395, 518]], { fill: glass, smooth: false, w: 5 });
      // puerta y manilla
      k.line([[383, 430], [383, 650]], 4, k.tone(body, -0.45));
      if (!k.drop()) k.rect(400, 548, 34, 10, { r: 5, fill: k.tone(body, -0.4), w: 3 });
      // faros y parachoques
      k.ellipse(550, 578, 14, 20, { fill: "#fff3a8", w: 4 });
      k.rect(52, 565, 20, 34, { r: 6, fill: "#e63946", w: 4 });
      k.rect(520, 640, 52, 22, { r: 10, fill: "#c9ccd2", w: 4 });
      k.rect(46, 640, 52, 22, { r: 10, fill: "#c9ccd2", w: 4 });
      if (type === "taxi") {
        k.rect(285, 380, 80, 32, { r: 8, fill: "#ffffff", w: 5 });
        if (!k.drop()) for (let x = 70; x < 545; x += 24) k.rect(x, 584, 12, 12, { r: 0, fill: (x / 24) % 2 < 1 ? "#1f1f24" : "#ffffff", w: 0 });
      }
      if (type === "carrera") {
        k.rect(70, 575, 475, 14, { r: 0, fill: "#ffffff", w: 0 });
        k.circle(300, 575, 34, { fill: "#ffffff", w: 5 });
        if (!k.drop()) k.line([[300, 557], [300, 593]], 7);
      }
      // ruedas con paso de rueda
      for (const x of [165, 450]) {
        k.path(arcPts(x, 668, 74, 74, Math.PI, 2 * Math.PI, 14), { fill: "#2b2b30", w: 5, smooth: false });
        k.circle(x, 668, 60, { fill: "#2b2b30", w: 6 });
        k.circle(x, 668, 30, { fill: "#d6d9de", w: 5, light: true });
        k.dot(x, 668, 7, "#7b818c");
      }
    },
  },

  // ─────────────────────────── BICICLETA ───────────────────────────
  {
    key: "bicicleta",
    words: ["bicicleta", "bici", "bicicletas", "pedalear", "ciclista"],
    name: "Una bicicleta",
    draw(k) {
      const frame = k.pick(["#e63946", "#2ec4b6", "#3b82f6", "#ff8fb8", "#ffcf33", "#9b5de5"]);
      const basket = k.chance(0.5);
      k.bg(k.pick(["#d9f1ff", "#fff1d6", "#e9f7df"]));
      k.cloud(130, 150, 0.7);
      if (k.chance(0.5)) k.circle(480, 130, 50, { fill: "#ffe066", w: 5, light: true });
      k.ground(740, k.pick(["#86cf7a", "#9bd77f"]), { wave: 10 });
      k.grass(760, 6, "#3d9b4c");
      const RW = 118, YW = 620, XR = 150, XF = 452;
      const BB = [295, 630], SEAT = [250, 430], HT = [420, 425], HB = [432, 490];
      // ruedas
      for (const x of [XR, XF]) {
        k.circle(x, YW, RW, { fill: "none", w: 16 });
        k.circle(x, YW, RW - 12, { fill: "none", w: 3, stroke: "#9ca3af" });
        if (!k.drop()) for (let a = 0; a < 6; a++) {
          const t = (a * Math.PI) / 6;
          k.line([[x - Math.cos(t) * 100, YW - Math.sin(t) * 100], [x + Math.cos(t) * 100, YW + Math.sin(t) * 100]], 2.5, "#8f96a3");
        }
        k.circle(x, YW, 14, { fill: "#d6d9de", w: 4 });
      }
      // cuadro
      const T = 16;
      k.tube([[XR, YW], BB], T, frame);
      k.tube([[XR, YW], SEAT], T, frame);
      k.tube([HB, BB], T + 2, frame);
      k.tube([[SEAT[0] + 4, SEAT[1] + 10], HT], T, frame);
      k.tube([[SEAT[0], SEAT[1] - 10], BB], T + 2, frame);
      k.tube([[HT[0] - 6, HT[1] - 20], HB, [XF, YW]], 14, frame);
      // plato y pedal
      k.circle(BB[0], BB[1], 30, { fill: "#d6d9de", w: 5 });
      k.dot(BB[0], BB[1], 8, "#7b818c");
      if (!k.drop()) k.line([[BB[0] - 30, BB[1] + 2], [XR, YW + 2]], 4, "#5b616b");
      k.line([BB, [BB[0] + 26, BB[1] + 38]], 8);
      k.rect(BB[0] + 8, BB[1] + 36, 40, 12, { r: 4, fill: "#2b2b30", w: 3 });
      // sillín
      k.path([[205, 410], [250, 398], [295, 405], [290, 422], [215, 428]], { fill: "#2b2b30", w: 5 });
      // manillar
      k.tube([[HT[0] - 6, HT[1] - 22], [HT[0] - 2, HT[1] - 48], [HT[0] - 40, HT[1] - 62]], 10, "#c9ccd2");
      k.tube([[HT[0] - 40, HT[1] - 62], [HT[0] - 70, HT[1] - 62]], 14, "#2b2b30");
      if (!k.drop()) k.circle(HT[0] - 12, HT[1] - 58, 9, { fill: "#ffd21f", w: 3 });
      if (basket) {
        k.path([[440, 380], [540, 380], [530, 460], [450, 460]], { fill: "#d9a066", smooth: false, shade: "r", w: 5 });
        if (!k.drop()) {
          for (const y of [405, 432]) k.line([[445, y], [535, y]], 3, "#8b5a2b");
          for (const [x, c] of [[465, "#ff8fb8"], [495, "#ffd21f"], [522, "#e63946"]]) {
            k.line([[x, 382], [x - 2, 350]], 4, "#2aa84a");
            k.circle(x - 2, 345, 14, { fill: c, w: 4 });
            k.dot(x - 2, 345, 5, "#ff9f1c");
          }
        }
      } else if (!k.drop()) {
        // banderita
        k.line([[150, 500], [120, 270]], 4);
        k.path([[121, 275], [185, 295], [125, 320]], { fill: k.pick(["#ffd21f", "#ff7a1a", "#2ec4b6"]), w: 4 });
      }
    },
  },

  // ───────────────────────────── AVIÓN ─────────────────────────────
  {
    key: "avion",
    words: ["avión", "avion", "aviones", "aeropuerto", "volar", "vuelo", "piloto", "viaje"],
    name: "Un avión",
    draw(k) {
      const sunset = k.chance(0.3);
      k.bg(sunset ? "#ffd8b5" : k.pick(["#a5d8ff", "#bfe6ff"]));
      if (sunset) k.circle(140, 700, 90, { fill: "#ffb36b", w: 0, opacity: 0.8 });
      k.cloud(120, 200, 0.9);
      k.cloud(470, 730, 1.1);
      if (!k.drop()) k.cloud(160, 780, 0.6);
      const livery = k.pick(["#e63946", "#2563eb", "#2ec4b6", "#ff7a1a", "#9b5de5"]);
      const white = "#fbfbfd";
      k.group("rotate(-16 300 450)", () => {
        // estela
        if (!k.drop()) for (const y of [440, 470]) k.line([[-200, y], [40, y]], 10, "#ffffff", { opacity: 0.8 });
        // ala trasera (lejana)
        k.path([[300, 405], [345, 405], [270, 300], [240, 300]], { fill: k.tone(white, -0.12), smooth: false, w: 5 });
        // estabilizador lejano
        k.path([[80, 420], [110, 420], [70, 375], [55, 375]], { fill: k.tone(white, -0.12), smooth: false, w: 5 });
        // deriva (cola)
        k.path([[60, 420], [150, 420], [95, 300], [45, 300]], { fill: livery, smooth: false, shade: "r", w: 6 });
        // fuselaje
        k.path([[40, 440], [120, 400], [480, 398], [540, 410], [575, 440], [555, 478], [500, 495], [130, 495], [60, 470]], { fill: white, shade: "b", light: true });
        // franja
        k.path([[90, 462], [560, 462], [552, 474], [96, 474]], { fill: livery, w: 0, smooth: false });
        // cabina
        k.path([[508, 420], [545, 418], [560, 436], [516, 438]], { fill: "#2b3a67", w: 4, smooth: false });
        // ventanillas
        if (!k.drop()) for (let x = 170; x <= 470; x += 30) k.circle(x, 435, 8, { fill: "#9fdcf7", w: 3 });
        // puerta
        k.rect(470, 418, 22, 40, { r: 8, fill: "none", w: 3 });
        // ala delantera
        k.path([[260, 470], [330, 470], [250, 640], [215, 640]], { fill: k.tone(white, -0.05), smooth: false, shade: "l", w: 6 });
        // motor
        k.rect(235, 520, 70, 38, { r: 18, fill: "#c9ccd2", w: 5, shade: "b" });
        k.ellipse(305, 539, 8, 17, { fill: "#2b2b30", w: 4 });
        // estabilizador cercano
        k.path([[70, 465], [120, 465], [85, 535], [60, 535]], { fill: k.tone(white, -0.05), smooth: false, w: 5 });
      });
      if (!k.drop()) for (const [x, y] of [[480, 160], [540, 250]]) sparkle(k, x, y, 14, "#ffffff");
    },
  },

  // ───────────────────────────── BARCO ─────────────────────────────
  {
    key: "barco",
    words: ["barco", "barca", "velero", "pirata", "piratas", "puerto", "navegar", "marinero", "vela"],
    name: "Un barco",
    draw(k) {
      const pirate = k.chance(0.35);
      k.bg(pirate ? "#ffe2b8" : k.pick(["#bfe6ff", "#cfeeff"]));
      k.circle(480, 140, 58, { fill: pirate ? "#ffb36b" : "#ffe066", w: 5, light: true });
      k.cloud(130, 140, 0.75);
      // gaviotas
      if (!k.drop()) for (const [x, y] of [[220, 260], [270, 225], [520, 300]]) k.line([[x - 18, y], [x - 8, y - 8], [x, y], [x + 8, y - 8], [x + 18, y]], 4);
      const hull = pirate ? "#7c4a1e" : k.pick(["#e63946", "#2563eb", "#ffffff", "#2ec4b6"]);
      const sail = pirate ? "#2b2b30" : k.pick(["#ffffff", "#fff4dc"]);
      const stripe = k.pick(["#e63946", "#3b82f6", "#ffd21f", "#ff7a1a"]);
      // mástil
      k.rect(290, 140, 18, 470, { r: 6, fill: "#8b5a2b", w: 5 });
      // bandera
      k.path([[305, 145], [370, 160], [305, 182]], { fill: pirate ? "#2b2b30" : stripe, w: 4 });
      // vela mayor
      k.path([[318, 190], [370, 300], [430, 430], [470, 560], [318, 560]], { fill: sail, shade: "r", light: !pirate });
      // foque
      k.path([[282, 210], [282, 560], [120, 560], [190, 420]], { fill: sail, shade: "l", w: 6 });
      if (pirate) {
        // calavera
        k.circle(385, 410, 38, { fill: "#ffffff", w: 4 });
        k.rect(368, 440, 34, 22, { r: 6, fill: "#ffffff", w: 4 });
        k.dot(372, 408, 9, "#2b2b30");
        k.dot(398, 408, 9, "#2b2b30");
        if (!k.drop()) {
          k.line([[340, 470], [430, 500]], 8, "#ffffff");
          k.line([[430, 470], [340, 500]], 8, "#ffffff");
        }
      } else if (!k.drop()) {
        k.path([[324, 470], [438, 470], [450, 510], [324, 510]], { fill: stripe, w: 0, smooth: false });
      }
      // casco
      k.path([[70, 570], [530, 570], [490, 680], [140, 680]], { fill: hull, shade: "b", light: true, smooth: false });
      k.line([[85, 600], [520, 600]], 5, pirate ? "#d9a066" : k.tone(hull === "#ffffff" ? stripe : hull, hull === "#ffffff" ? 0 : 0.45));
      if (!k.drop()) for (const x of [190, 270, 350, 430]) k.circle(x, 635, 14, { fill: pirate ? "#2b2b30" : "#d4f1ff", w: 4 });
      // mar
      k.ground(665, "#3b82f6", { wave: 14 });
      k.path([[-30, 760], [100, 745], [220, 765], [340, 745], [460, 765], [630, 745], [630, 930], [-30, 930]], { fill: "#2f6fe0", w: 0 });
      if (!k.drop()) for (const [x, y] of [[80, 720], [450, 730], [250, 830], [520, 850]]) k.line([[x - 30, y], [x, y - 12], [x + 30, y]], 5, "#dbeafe");
    },
  },

  // ───────────────────────────── COHETE ─────────────────────────────
  {
    key: "cohete",
    words: ["cohete", "nave", "espacio", "astronauta", "despegar", "luna", "planeta", "galaxia"],
    name: "Un cohete",
    draw(k) {
      k.bg(k.pick(["#1e2a5a", "#23305e", "#2a2357"]));
      k.stars(16, [0, 0, 600, 900]);
      const body = k.pick(["#fbfbfd", "#fbfbfd", "#ffd21f", "#9fdcf7"]);
      const accent = k.pick(["#e63946", "#ff7a1a", "#9b5de5", "#2ec4b6"]);
      // planeta
      if (!k.drop()) {
        const pc = k.pick(["#ff8fb8", "#9be04a", "#ffb36b"]);
        k.circle(100, 170, 62, { fill: pc, shade: "r", light: true, w: 5 });
        k.ellipse(100, 170, 100, 20, { fill: "none", w: 6, stroke: "#fff3a8", rot: -18 });
      }
      if (!k.drop()) for (const [x, y, s] of [[500, 160, 18], [80, 520, 14], [520, 470, 12]]) sparkle(k, x, y, s);
      k.group(`rotate(${k.pick([0, 12, -10])} 300 450)`, () => {
        // llama
        k.path([[245, 675], [355, 675], [345, 760], [300, 870], [255, 760]], { fill: "#ff7a1a", w: 5 });
        k.path([[268, 675], [332, 675], [325, 740], [300, 805], [275, 740]], { fill: "#ffd21f", w: 0 });
        // aletas
        k.path([[205, 470], [120, 590], [125, 690], [210, 640]], { fill: accent, shade: "b", w: 6 });
        k.path([[395, 470], [480, 590], [475, 690], [390, 640]], { fill: accent, shade: "b", w: 6 });
        // tobera
        k.path([[240, 640], [360, 640], [370, 690], [230, 690]], { fill: "#8f96a3", smooth: false, w: 5 });
        // cuerpo
        k.path([[300, 90], [355, 160], [395, 280], [405, 420], [395, 560], [370, 655], [230, 655], [205, 560], [195, 420], [205, 280], [245, 160]], { fill: body, shade: "r", light: true });
        // punta de color
        k.path([[300, 90], [355, 160], [372, 205], [228, 205], [245, 160]], { fill: accent, w: 5 });
        // aleta central
        k.path([[291, 575], [309, 575], [312, 692], [288, 692]], { fill: k.tone(accent, -0.15), w: 5 });
        // ventana
        k.circle(300, 340, 64, { fill: "#c9ccd2", w: 6 });
        k.circle(300, 340, 46, { fill: "#7fcff5", w: 5, light: true });
        if (k.chance(0.4) && !k.drop()) {
          // astronauta asomado
          k.circle(300, 350, 28, { fill: "#f1c9a5", w: 4 });
          k.eye(290, 345, 6);
          k.eye(310, 345, 6);
          k.mouth(300, 362, 16, "smile");
        }
        if (!k.drop()) for (const y of [470, 510]) k.circle(300, y, 9, { fill: accent, w: 3 });
      });
      // humo
      if (!k.drop()) for (const [x, y, r] of [[200, 860, 50], [300, 880, 60], [410, 860, 52]]) k.circle(x, y, r, { fill: "#e6e8ee", w: 5, shade: "b" });
    },
  },

  // ───────────────────────────── TREN ─────────────────────────────
  {
    key: "tren",
    words: ["tren", "trenes", "estación", "estacion", "vía", "vias", "locomotora", "vagón"],
    name: "Un tren",
    draw(k) {
      k.bg(k.pick(["#bfe6ff", "#d9f1ff", "#ffe9c7"]));
      k.cloud(470, 130, 0.7);
      k.ground(560, k.pick(["#9fd8a0", "#b5e3a1"]), { wave: 22 });
      k.path([[-30, 690], [630, 690], [630, 930], [-30, 930]], { fill: "#d9c3a0", smooth: false, w: 5 });
      // vía
      if (!k.drop()) for (let x = 0; x < 620; x += 55) k.rect(x, 700, 32, 26, { r: 4, fill: "#8b5a2b", w: 4 });
      k.rect(-20, 694, 640, 12, { r: 4, fill: "#8f96a3", w: 4 });
      const main = k.pick(["#e63946", "#2563eb", "#22a06b", "#9b5de5"]);
      const trim = k.pick(["#ffd21f", "#ffcf33"]);
      // humo
      if (!k.drop()) for (const [x, y, r] of [[430, 300, 34], [370, 230, 46], [280, 160, 56]]) k.circle(x, y, r, { fill: "#f3f4f7", w: 5, shade: "b" });
      // chimenea
      k.path([[425, 330], [490, 330], [475, 370], [470, 450], [445, 450], [440, 370]], { fill: "#2b2b30", smooth: false, w: 5 });
      // cabina
      k.rect(80, 330, 190, 300, { r: 10, fill: main, shade: "r", light: true });
      k.rect(60, 305, 230, 40, { r: 14, fill: k.tone(main, -0.3) });
      k.rect(115, 375, 115, 100, { r: 14, fill: "#d4f1ff", w: 5 });
      // caldera
      k.rect(265, 440, 270, 190, { r: 40, fill: main, shade: "b", light: true });
      if (!k.drop()) for (const x of [330, 420]) k.line([[x, 446], [x, 624]], 6, trim);
      k.rect(345, 400, 52, 50, { r: 20, fill: trim, w: 5 });
      // farol
      k.rect(520, 470, 46, 46, { r: 10, fill: "#fff3a8", w: 5, light: true });
      // quitapiedras
      k.path([[520, 600], [580, 670], [470, 670]], { fill: "#c9ccd2", smooth: false, w: 5 });
      // base
      k.rect(70, 620, 480, 30, { r: 8, fill: "#2b2b30", w: 5 });
      // ruedas
      for (const [x, r] of [[170, 64], [370, 46], [470, 46]]) {
        k.circle(x, 696 - r + 4, r, { fill: trim, w: 6, shade: "b" });
        k.circle(x, 696 - r + 4, r * 0.4, { fill: "#2b2b30", w: 4 });
      }
      if (!k.drop()) k.line([[170, 640], [470, 654]], 7, "#c9ccd2");
    },
  },

  // ───────────────────────── GLOBO AEROSTÁTICO ─────────────────────────
  {
    key: "globo",
    words: ["globo", "globos", "aerostático", "aerostatico", "cesta"],
    name: "Un globo aerostático",
    draw(k) {
      const warm = k.chance(0.35);
      k.bg(warm ? "#ffe2c4" : k.pick(["#bfe6ff", "#cdeefd"]));
      k.cloud(110, 650, 0.8);
      k.cloud(500, 520, 0.6);
      // globito lejano
      if (!k.drop()) {
        k.ellipse(500, 170, 40, 48, { fill: k.pick(["#ff8fb8", "#9be04a", "#ffd21f"]), w: 4, shade: "r" });
        k.line([[485, 215], [490, 240]], 3);
        k.line([[515, 215], [510, 240]], 3);
        k.rect(486, 238, 28, 18, { r: 3, fill: "#d9a066", w: 3 });
      }
      k.ground(820, "#8fd18a", { wave: 18 });
      const sets = [["#e63946", "#ffd21f"], ["#2563eb", "#ffffff"], ["#ff7a1a", "#2ec4b6"], ["#9b5de5", "#ff8fb8"], ["#e63946", "#ffffff"]];
      const [c1, c2] = k.pick(sets);
      const cx = 300, top = 70, mid = 290, R = 215, bot = 590;
      const hw = (y) => (y <= mid ? Math.sqrt(Math.max(0, R * R - (y - mid) * (y - mid))) : 62 + (R - 62) * Math.pow(Math.cos(((y - mid) / (bot - mid)) * Math.PI / 2), 1.1));
      const fs = [-1, -0.81, -0.31, 0.31, 0.81, 1];
      const ys = [];
      for (let y = top + 1; y <= bot; y += 14) ys.push(y);
      ys.push(bot);
      for (let g = 0; g < 5; g++) {
        const L = ys.map((y) => [cx + hw(y) * fs[g], y]);
        const Rr = ys.map((y) => [cx + hw(y) * fs[g + 1], y]).reverse();
        let fill = g % 2 ? c2 : c1;
        if (g === 4) fill = k.tone(fill, -0.18);
        k.path([[cx, top - 4], ...L, ...Rr], { fill, smooth: false, w: 5, dense: false });
      }
      // brillo
      if (!k.drop()) k.ellipse(205, 210, 34, 70, { fill: "#ffffff", w: 0, opacity: 0.35, rot: 25 });
      // falda
      k.path([[238, 588], [362, 588], [345, 630], [255, 630]], { fill: k.tone(c1, -0.2), smooth: false, w: 5 });
      // cuerdas
      k.line([[258, 628], [265, 705]], 4);
      k.line([[342, 628], [335, 705]], 4);
      if (!k.drop()) k.line([[300, 630], [300, 705]], 3);
      // cesta
      k.rect(250, 700, 100, 82, { r: 10, fill: "#d9a066", shade: "r" });
      k.rect(242, 694, 116, 20, { r: 8, fill: "#a8743f", w: 5 });
      if (!k.drop()) for (const y of [735, 760]) k.line([[256, y], [344, y]], 3, "#8b5a2b");
    },
  },

  // ───────────────────────────── PARAGUAS ─────────────────────────────
  {
    key: "paraguas",
    words: ["paraguas", "lluvia", "llover", "llueve", "lloviendo", "tormenta", "charco"],
    name: "Un paraguas",
    draw(k) {
      k.bg(k.pick(["#cfd8e6", "#d6e2ef", "#dfe7f1"]));
      // nubes de lluvia
      for (const [x, y, s] of [[130, 110, 0.9], [440, 90, 1]]) {
        const pts = [];
        for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; const b = 1 + 0.18 * Math.abs(Math.sin(t * 3)); pts.push([x + Math.cos(t) * 95 * s * b, y + Math.sin(t) * 48 * s * b]); }
        k.path(pts, { fill: "#a7b2c4", w: 5, shade: "b" });
      }
      const drop = (x, y) => k.path([[x, y - 20], [x + 9, y], [x + 7, y + 8], [x, y + 11], [x - 7, y + 8], [x - 9, y]], { fill: "#5aa9ef", w: 3 });
      for (let i = 0; i < 14; i++) {
        const x = k.R(30, 570), y = k.R(170, 860);
        // que no caigan dentro del paraguas
        if (y > 180 && y < 720 && x > 40 && x < 560 && (y < 440 || Math.abs(x - 300) < 60)) continue;
        if (!k.drop()) drop(x, y);
      }
      // charco
      k.ellipse(300, 820, 200, 34, { fill: "#8fbfee", w: 5 });
      if (!k.drop()) k.ellipse(300, 820, 100, 14, { fill: "none", w: 3, stroke: "#dbeafe" });
      const style = k.pick(["two", "two", "rainbow", "plain"]);
      const [ca, cb] = k.pick([["#e63946", "#ffffff"], ["#ffd21f", "#ff7a1a"], ["#2ec4b6", "#fff4dc"], ["#9b5de5", "#ff8fb8"], ["#2563eb", "#9fdcf7"]]);
      const rainbow = ["#e63946", "#ff7a1a", "#ffd21f", "#2aa84a", "#3b82f6", "#9b5de5"];
      const plain = k.pick(["#e63946", "#2563eb", "#22a06b", "#ff8fb8"]);
      const cx = 300, base = 440, H = 250;
      const tips = [50, 133, 217, 300, 383, 467, 550];
      const rib = (x) => arcPts(cx, base, Math.abs(x - cx), H, x < cx ? -Math.PI / 2 : -Math.PI / 2, x < cx ? -Math.PI : 0, 14);
      // varilla (detrás)
      k.tube([[300, 300], [300, 700]], 10, "#5b616b");
      for (let i = 0; i < 6; i++) {
        const a = tips[i], b = tips[i + 1];
        const left = a < cx ? rib(a) : arcPts(cx, base, a - cx, H, -Math.PI / 2, 0, 14); // de arriba a la punta a
        const right = b <= cx ? rib(b) : arcPts(cx, base, b - cx, H, -Math.PI / 2, 0, 14);
        const scal = arcPts((a + b) / 2, base, (b - a) / 2, 26, Math.PI, 2 * Math.PI, 10);
        const pts = [...left, ...scal.slice(1, -1), ...right.slice().reverse()];
        const fill = style === "rainbow" ? rainbow[i] : style === "plain" ? plain : i % 2 ? cb : ca;
        k.path(pts, { fill, smooth: false, w: 6, dense: false, shade: i === 5 ? "r" : null, light: i === 0 });
      }
      // punta y puño
      k.tube([[300, 192], [300, 160]], 8, "#5b616b");
      k.circle(300, 155, 9, { fill: "#5b616b", w: 4 });
      k.tube([[300, 690], [300, 740], [320, 770], [345, 760], [350, 735]], 18, k.pick(["#8b5a2b", "#2b2b30", "#e63946"]));
    },
  },

  // ───────────────────────────── RELOJ ─────────────────────────────
  {
    key: "reloj",
    words: ["reloj", "relojes", "despertador", "hora", "horas", "tarde", "madrugar", "tiempo"],
    name: "Un reloj despertador",
    draw(k) {
      const body = k.pick(["#e63946", "#2ec4b6", "#3b82f6", "#ff8fb8", "#ffcf33", "#9b5de5"]);
      const ringing = k.chance(0.6);
      wall(k, k.pick(["#fff4dc", "#e8f4ff", "#fde7ef", "#eaf6e4"]), k.pick(["dots", "stripes", "none"]));
      table(k, 730, k.pick(["#d9a066", "#c98e62", "#b98654"]));
      k.ellipse(300, 735, 210, 22, { fill: "#000000", w: 0, opacity: 0.15 });
      // patas
      k.tube([[190, 640], [150, 735]], 16, k.tone(body, -0.3));
      k.tube([[410, 640], [450, 735]], 16, k.tone(body, -0.3));
      // campanas y martillo
      k.tube([[300, 270], [300, 225]], 10, "#c9ccd2");
      k.circle(300, 222, 13, { fill: "#c9ccd2", w: 4 });
      for (const s of [-1, 1]) {
        k.group(`rotate(${s * 35} ${300 + s * 125} 255)`, () => {
          k.path([...arcPts(300 + s * 125, 280, 78, 78, Math.PI, 2 * Math.PI, 14), [300 + s * 125 + 82, 286], [300 + s * 125 - 82, 286]], { fill: body, shade: "r", light: true, smooth: false });
          k.circle(300 + s * 125, 196, 11, { fill: k.tone(body, -0.2), w: 4 });
        });
      }
      // cuerpo
      k.circle(300, 470, 205, { fill: body, shade: "rb", light: true, n: 30 });
      k.circle(300, 470, 160, { fill: "#fffaf0", w: 6, n: 28 });
      // marcas
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const big = i % 3 === 0;
        if (!big && k.drop()) continue;
        const r0 = big ? 118 : 128;
        k.line([[300 + Math.cos(a) * r0, 470 + Math.sin(a) * r0], [300 + Math.cos(a) * 142, 470 + Math.sin(a) * 142]], big ? 9 : 5);
      }
      // agujas
      const hA = k.R(0, Math.PI * 2), mA = k.R(0, Math.PI * 2);
      k.tube([[300, 470], [300 + Math.cos(hA) * 72, 470 + Math.sin(hA) * 72]], 10, "#2b2b30", { outline: 2 });
      k.tube([[300, 470], [300 + Math.cos(mA) * 112, 470 + Math.sin(mA) * 112]], 7, "#2b2b30", { outline: 2 });
      if (!k.drop()) k.line([[300, 470], [300 + Math.cos(mA + 2) * 120, 470 + Math.sin(mA + 2) * 120]], 3, "#e63946");
      k.circle(300, 470, 14, { fill: body, w: 4 });
      if (ringing && !k.drop()) {
        for (const s of [-1, 1]) {
          k.arc(300 + s * 150, 200, 110, s < 0 ? 1.05 * Math.PI : 1.65 * Math.PI, s < 0 ? 1.35 * Math.PI : 1.95 * Math.PI, 6);
          k.arc(300 + s * 150, 200, 140, s < 0 ? 1.08 * Math.PI : 1.62 * Math.PI, s < 0 ? 1.32 * Math.PI : 1.92 * Math.PI, 6);
        }
      }
    },
  },

  // ───────────────────────────── GUITARRA ─────────────────────────────
  {
    key: "guitarra",
    words: ["guitarra", "guitarras", "concierto", "música", "musica", "cantante", "cantar", "canción", "rock"],
    name: "Una guitarra",
    draw(k) {
      const bgc = k.pick(["#ffe9c7", "#e8e1ff", "#d9f1ff", "#ffe1ea"]);
      k.bg(bgc);
      // foco de escenario
      if (!k.drop()) k.path([[230, -20], [370, -20], [560, 920], [40, 920]], { fill: "#ffffff", w: 0, opacity: 0.35, smooth: false });
      const wood = k.pick(["#e0aa70", "#d9a066", "#e63946", "#2563eb", "#2b2b30"]);
      const dark = wood === "#2b2b30" ? "#5b616b" : k.tone(wood, -0.35);
      const neckC = "#7c4a1e";
      const noteC = k.pick(["#9b5de5", "#e63946", "#2563eb", "#22a06b"]);
      if (!k.drop()) note(k, 90, 220, 1, noteC);
      if (!k.drop()) note(k, 500, 330, 0.8, noteC);
      if (!k.drop()) note(k, 110, 610, 0.7, noteC);
      k.group(`rotate(${k.pick([16, 20, -16])} 300 450)`, () => {
        // mástil
        k.rect(275, 100, 50, 240, { r: 6, fill: neckC, w: 5 });
        if (!k.drop()) for (let y = 140; y < 330; y += 36) k.line([[278, y], [322, y]], 3, "#d6d9de");
        // pala
        k.path([[265, 30], [335, 30], [330, 110], [270, 110]], { fill: k.tone(neckC, -0.15), smooth: false, w: 5 });
        for (const y of [50, 75, 98]) {
          k.circle(252, y, 10, { fill: "#d6d9de", w: 4 });
          k.circle(348, y, 10, { fill: "#d6d9de", w: 4 });
        }
        // caja
        k.path([[300, 300], [375, 308], [415, 365], [408, 440], [385, 492], [430, 540], [460, 625], [446, 720], [385, 790], [300, 808], [215, 790], [154, 720], [140, 625], [170, 540], [215, 492], [192, 440], [185, 365], [225, 308]], { fill: wood, shade: "r", light: true });
        if (!k.drop()) k.path([[300, 320], [365, 330], [395, 375], [388, 440], [365, 495], [410, 545], [440, 625], [425, 710], [375, 770], [300, 788], [225, 770], [175, 710], [160, 625], [190, 545], [235, 495], [212, 440], [205, 375], [235, 330]], { fill: "none", w: 3, stroke: k.tone(dark, -0.2) });
        // boca
        k.circle(300, 505, 62, { fill: k.tone(wood, 0.5), w: 0 });
        k.circle(300, 505, 50, { fill: "#2b1d12", w: 5 });
        // puente
        k.rect(245, 670, 110, 26, { r: 8, fill: neckC, w: 5 });
        // cuerdas
        for (let i = 0; i < 6; i++) {
          const x = 283 + i * 7;
          k.line([[x, 105], [x, 680]], 1.6, "#f3f4f7", { raw: true });
        }
      });
    },
  },

  // ───────────────────────────── TARTA ─────────────────────────────
  {
    key: "tarta",
    words: ["tarta", "tartas", "cumpleaños", "pastel", "fiesta", "vela", "velas", "celebración", "aniversario"],
    name: "Una tarta de cumpleaños",
    draw(k) {
      const bgc = k.pick(["#fde7ef", "#e8f4ff", "#fff4dc", "#ede4ff"]);
      wall(k, bgc, k.pick(["dots", "none"]));
      // banderines
      const flags = ["#e63946", "#ffd21f", "#2ec4b6", "#9b5de5", "#ff7a1a", "#3b82f6"];
      const yAt = (x) => 60 + 70 * Math.sin((x / 600) * Math.PI);
      k.line([[-20, 50], [150, yAt(150)], [300, yAt(300)], [450, yAt(450)], [620, 50]], 4);
      for (let i = 0; i < 7; i++) {
        if (k.drop()) continue;
        const x = 30 + i * 90, y = yAt(x);
        k.path([[x - 30, y - 2], [x + 30, y + 2], [x + 2, y + 62]], { fill: flags[i % flags.length], w: 4, smooth: false });
      }
      // confeti
      if (!k.drop()) for (let i = 0; i < 12; i++) k.rect(k.R(20, 570), k.R(180, 420), 12, 6, { r: 2, fill: k.pick(flags), w: 0 });
      table(k, 760, k.pick(["#d9a066", "#9fdcf7", "#ff8fb8"]));
      // plato
      k.ellipse(300, 770, 260, 50, { fill: "#ffffff", w: 6, shade: "b" });
      const flavours = [["#7c4a1e", "#5a3415"], ["#ff9ec4", "#ffffff"], ["#fff1c9", "#ff8fb8"], ["#f6d5b8", "#8b5a2b"], ["#c8b6ff", "#ffffff"]];
      const [sponge, icing] = k.pick(flavours);
      const tiers = k.chance(0.5) ? 2 : 1;
      const drips = (cx, top, rx, ry, len) => {
        const pts = [...arcPts(cx, top, rx, ry, Math.PI, 2 * Math.PI, 18)];
        const dx = [];
        for (let i = 0; i < 6; i++) dx.push([cx - rx + 25 + i * ((rx * 2 - 50) / 5) + k.R(-8, 8), k.R(len * 0.5, len)]);
        for (let x = cx + rx; x >= cx - rx; x -= 6) {
          const u = (x - cx) / rx;
          let y = top + ry * Math.sqrt(Math.max(0, 1 - u * u)) + 14;
          for (const [xc, L] of dx) { const v = (x - xc) / 18; if (Math.abs(v) < 1) y += L * Math.sqrt(1 - v * v); }
          pts.push([x, y]);
        }
        pts.push([cx - rx, top + 10]);
        k.path(pts, { fill: icing, smooth: false, w: 6, dense: false, light: true });
      };
      const layer = (top, bottom, rx) => {
        cylinder(k, 300, top, bottom, rx, rx * 0.24, sponge, null);
        drips(300, top, rx + 4, rx * 0.24, 46);
        if (!k.drop()) for (let i = 0; i < 9; i++) {
          const x = 300 - rx + 20 + i * ((rx * 2 - 40) / 8);
          k.circle(x, bottom + rx * 0.24 * Math.sqrt(Math.max(0, 1 - ((x - 300) / rx) ** 2)) - 8, 11, { fill: icing, w: 3 });
        }
      };
      let top;
      if (tiers === 2) {
        layer(560, 740, 200);
        layer(400, 560, 140);
        top = 400;
      } else {
        layer(470, 740, 220);
        top = 470;
      }
      const rx = tiers === 2 ? 140 : 220, ry = rx * 0.24;
      // decoración de arriba
      const deco = k.pick(["fresas", "virutas", "nada"]);
      if (deco === "fresas" && !k.drop()) for (const u of [-0.7, 0.7, -0.3, 0.3]) {
        const x = 300 + u * rx * 0.85, y = top + (Math.abs(u) > 0.5 ? 6 : 22);
        k.path([[x - 18, y - 12], [x + 18, y - 12], [x + 12, y + 8], [x, y + 20], [x - 12, y + 8]], { fill: "#e63946", w: 4 });
        k.path([[x - 12, y - 14], [x, y - 22], [x + 12, y - 14], [x, y - 8]], { fill: "#2aa84a", w: 3 });
      }
      if (deco === "virutas" && !k.drop()) for (let i = 0; i < 14; i++) {
        const a = k.R(0, Math.PI * 2), r = k.R(0.15, 0.85);
        const x = 300 + Math.cos(a) * rx * r, y = top + Math.sin(a) * ry * r;
        k.line([[x - 6, y - 3], [x + 6, y + 3]], 6, k.pick(flags));
      }
      // velas
      const n = k.I(tiers === 2 ? 1 : 3, tiers === 2 ? 3 : 5);
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? 300 : 300 - rx * 0.6 + (i * rx * 1.2) / (n - 1);
        const y = top + (i % 2 ? -6 : 10);
        const c = flags[(i + 2) % flags.length];
        k.rect(x - 10, y - 90, 20, 90, { r: 5, fill: c, w: 4 });
        if (!k.drop()) for (const yy of [y - 70, y - 40]) k.line([[x - 8, yy + 8], [x + 8, yy - 4]], 4, "#ffffff");
        k.line([[x, y - 90], [x, y - 102]], 3);
        k.circle(x, y - 124, 22, { fill: "#fff3a8", w: 0, opacity: 0.5 });
        k.path([[x, y - 148], [x + 11, y - 118], [x, y - 102], [x - 11, y - 118]], { fill: "#ffb020", w: 4 });
        k.path([[x, y - 132], [x + 5, y - 116], [x, y - 108], [x - 5, y - 116]], { fill: "#fff3a8", w: 0 });
      }
    },
  },

  // ───────────────────────────── HELADO ─────────────────────────────
  {
    key: "helado",
    words: ["helado", "helados", "cucurucho", "heladería", "polo", "verano"],
    name: "Un helado",
    draw(k) {
      wall(k, k.pick(["#d9f1ff", "#fde7ef", "#fff4dc", "#e6f7ef"]), k.pick(["dots", "none"]));
      if (!k.drop()) for (const [x, y] of [[90, 150], [510, 210], [520, 700]]) sparkle(k, x, y, 18);
      const flav = ["#ff9ec4", "#a8e6cf", "#7c4a1e", "#fff1c9", "#ffe066", "#c8b6ff", "#ffb36b"];
      const n = k.pick([1, 2, 2, 3]);
      const coneTop = 500;
      // cucurucho
      const cone = "#e0aa70";
      k.path([[180, coneTop], [420, coneTop], [300, 860]], { fill: cone, shade: "r", smooth: false });
      if (!k.drop()) {
        const L = [180, coneTop], Rr = [420, coneTop], B = [300, 860];
        for (const d of [50, 100, 150, 200]) {
          // paralelas al lado izquierdo
          let u = (240 - d) / 240;
          k.line([[L[0] + d, coneTop], [L[0] + d + (B[0] - L[0]) * u, coneTop + (B[1] - coneTop) * u]], 4, "#b07a3f");
          k.line([[Rr[0] - d, coneTop], [Rr[0] - d + (B[0] - Rr[0]) * u, coneTop + (B[1] - coneTop) * u]], 4, "#b07a3f");
        }
      }
      // bolas
      const scoop = (cx, cy, r, c, bottomDrips) => {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const t = Math.PI + (i / 24) * Math.PI; // parte de arriba
          pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.95]);
        }
        // borde de abajo ondulado
        for (let i = 0; i <= 10; i++) {
          const x = cx + r - (i / 10) * 2 * r;
          const y = cy + r * 0.32 + (i % 2 ? 18 : 0) + (bottomDrips && i === 3 ? 34 : 0);
          pts.push([x, y]);
        }
        k.path(pts, { fill: c, shade: "r", light: true });
      };
      const sizes = n === 1 ? [175] : n === 2 ? [150, 135] : [140, 125, 110];
      let cy = coneTop - 25;
      const used = [];
      for (let i = 0; i < n; i++) {
        let c = k.pick(flav);
        while (used.includes(c)) c = k.pick(flav);
        used.push(c);
        const r = sizes[i];
        scoop(300 + (i === 1 ? -8 : i === 2 ? 6 : 0), cy, r, c, i === 0);
        if (c === "#7c4a1e" || c === "#fff1c9") {
          if (!k.drop()) for (let j = 0; j < 5; j++) k.dot(300 + k.R(-r * 0.6, r * 0.6), cy - k.R(10, r * 0.6), 5, c === "#7c4a1e" ? "#3e2410" : "#7c4a1e");
        }
        cy -= r * 1.05;
      }
      const topY = cy + sizes[n - 1] * 1.05 - sizes[n - 1] * 0.95;
      // virutas
      if (k.chance(0.5) && !k.drop()) for (let j = 0; j < 12; j++) {
        const x = 300 + k.R(-110, 110), y = topY + k.R(30, 110);
        const a = k.R(0, Math.PI);
        k.line([[x, y], [x + Math.cos(a) * 14, y + Math.sin(a) * 14]], 6, k.pick(["#e63946", "#ffd21f", "#3b82f6", "#2aa84a", "#ffffff"]));
      }
      // cereza
      if (k.chance(0.7)) {
        k.line([[302, topY - 12], [318, topY - 70], [345, topY - 90]], 5, "#2b2b30");
        k.circle(300, topY + 4, 30, { fill: "#d62839", light: true, shade: "r" });
      } else if (!k.drop()) {
        // galleta
        k.group(`rotate(20 330 ${topY})`, () => k.rect(320, topY - 70, 34, 110, { r: 6, fill: "#d9a066", w: 5, shade: "r" }));
      }
    },
  },

  // ───────────────────────────── PIZZA ─────────────────────────────
  {
    key: "pizza",
    words: ["pizza", "pizzas", "pizzería", "pizzeria", "italia", "italiano"],
    name: "Una pizza",
    draw(k) {
      const cloth = k.pick(["red", "blue", "wood"]);
      if (cloth === "wood") {
        k.bg("#c98e62");
        for (let y = 80; y < 900; y += 150) k.line([[-20, y], [620, y + 6]], 4, "#a8743f");
      } else {
        k.bg("#fff8ee");
        const c = cloth === "red" ? "#f7b7b3" : "#b9d4f5";
        for (let y = 0; y < 900; y += 75) for (let x = ((y / 75) % 2) * 75; x < 600; x += 150) k.path([[x, y], [x + 75, y], [x + 75, y + 75], [x, y + 75]], { fill: c, w: 0, smooth: false, raw: true });
      }
      // tabla
      if (!k.drop()) k.rect(270, 740, 60, 130, { r: 18, fill: "#e0aa70", w: 6, shade: "r" });
      k.circle(300, 480, 275, { fill: "#e0aa70", w: 6 });
      const cx = 300, cy = 470, R = 245;
      const N = 8;
      const lift = k.chance(0.5) ? k.I(0, N - 1) : -1;
      // ingredientes
      const kind = k.pick(["pepperoni", "pepperoni", "veggie", "margarita"]);
      const tops = [];
      for (let i = 0; i < 34; i++) {
        const a = k.R(0, Math.PI * 2), r = Math.sqrt(k.R(0.03, 1)) * (R - 70);
        tops.push([a, r, k.pick(kind === "veggie" ? ["olive", "pepper", "mush"] : kind === "margarita" ? ["basil", "moz"] : ["pep", "pep", "olive"])]);
      }
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        const off = i === lift ? 36 : 0;
        const ox = cx + Math.cos(am) * off, oy = cy + Math.sin(am) * off;
        k.path([[ox, oy], ...arcPts(ox, oy, R, R, a0, a1, 8)], { fill: "#e9b46a", smooth: false, w: 6, dense: false, shade: null });
        k.path([[ox + Math.cos(am) * 4, oy + Math.sin(am) * 4], ...arcPts(ox, oy, R - 30, R - 30, a0 + 0.04, a1 - 0.04, 8)], { fill: "#e35d3b", smooth: false, w: 0, dense: false });
        k.path([[ox + Math.cos(am) * 8, oy + Math.sin(am) * 8], ...arcPts(ox, oy, R - 40, R - 40, a0 + 0.07, a1 - 0.07, 8).map(([x, y], j) => [x + Math.cos(am) * (j % 2 ? 6 : -2), y + Math.sin(am) * (j % 2 ? 6 : -2)])], { fill: "#ffd76a", smooth: false, w: 0, dense: false });
        for (const [a, r, t] of tops) {
          if (a < a0 + 0.12 || a > a1 - 0.12) continue;
          if (k.drop()) continue;
          const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
          if (t === "pep") { k.circle(x, y, 24, { fill: "#c8302c", w: 4 }); k.dot(x - 6, y - 5, 4, "#e66a5a"); }
          else if (t === "olive") { k.circle(x, y, 13, { fill: "#2b2b30", w: 3 }); k.dot(x, y, 5, "#ffd76a"); }
          else if (t === "pepper") k.arc(x, y, 18, 0, Math.PI * 1.2, 8, "#2aa84a");
          else if (t === "mush") { k.path([...arcPts(x, y, 20, 16, Math.PI, 2 * Math.PI, 8), [x + 6, y], [x + 6, y + 14], [x - 6, y + 14], [x - 6, y]], { fill: "#f2e3c6", w: 3 }); }
          else if (t === "basil") k.ellipse(x, y, 20, 11, { fill: "#2aa84a", w: 3, rot: k.R(0, 180) });
          else if (t === "moz") k.circle(x, y, 22, { fill: "#fffaf0", w: 3 });
        }
      }
      if (lift >= 0 && !k.drop()) {
        // hilos de queso
        const am = ((lift + 0.5) / N) * Math.PI * 2;
        for (const d of [-0.18, 0.18]) {
          const x0 = cx + Math.cos(am + d) * 120, y0 = cy + Math.sin(am + d) * 120;
          k.line([[x0, y0], [x0 + Math.cos(am) * 36, y0 + Math.sin(am) * 36]], 6, "#ffd76a");
        }
      }
      if (!k.drop()) for (let i = 0; i < 6; i++) { const a = k.R(0, 6.28), r = k.R(40, 190); k.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, "#2a7a3a"); }
    },
  },

  // ─────────────────────────── HAMBURGUESA ───────────────────────────
  {
    key: "hamburguesa",
    words: ["hamburguesa", "hamburguesas", "bocadillo", "sándwich", "sandwich", "comida", "merienda", "cena"],
    name: "Una hamburguesa",
    draw(k) {
      wall(k, k.pick(["#fff4dc", "#e8f4ff", "#ffe1ea", "#eaf6e4"]), k.pick(["dots", "stripes"]));
      table(k, 720, k.pick(["#e63946", "#3b82f6", "#d9a066"]));
      k.ellipse(300, 735, 250, 46, { fill: "#ffffff", w: 6, shade: "b" });
      const bun = "#e9a24f";
      const double = k.chance(0.35), cheese = k.chance(0.75), tomato = k.chance(0.7), bacon = k.chance(0.3);
      let y = 700;
      // pan de abajo
      k.path([[85, y - 60], [515, y - 60], [505, y - 15], [470, y], [130, y], [95, y - 15]], { fill: bun, shade: "b", light: false });
      y -= 60;
      const patty = (yy) => {
        k.path([[70, yy - 10], [140, yy - 55], [460, yy - 55], [530, yy - 10], [470, yy + 18], [130, yy + 18]], { fill: "#6b3e1f", shade: "b" });
        if (!k.drop()) for (let x = 140; x < 470; x += 55) k.line([[x, yy - 30], [x + 18, yy - 26]], 4, "#8b5a2b");
        return yy - 55;
      };
      const lettuce = (yy) => {
        const pts = [[70, yy - 18]];
        for (let i = 0; i <= 12; i++) pts.push([70 + i * 38.5, yy + (i % 2 ? 22 : 4)]);
        pts.push([540, yy - 18], [460, yy - 38], [140, yy - 38]);
        k.path(pts, { fill: "#7ccf4a", w: 6 });
        return yy - 30;
      };
      const cheeseL = (yy) => {
        k.path([[75, yy - 18], [525, yy - 18], [530, yy - 4], [440, yy - 4], [415, yy + 40], [395, yy - 4], [200, yy - 4], [180, yy + 30], [160, yy - 4], [72, yy - 4]], { fill: "#ffcf33", smooth: false, w: 6 });
        return yy - 14;
      };
      y = patty(y + 8);
      if (cheese) y = cheeseL(y + 8);
      if (double) { y = patty(y + 12); if (cheese) y = cheeseL(y + 8); }
      if (bacon && !k.drop()) {
        const pts = [];
        for (let i = 0; i <= 10; i++) pts.push([90 + i * 42, y + (i % 2 ? -14 : 4)]);
        for (let i = 10; i >= 0; i--) pts.push([90 + i * 42, y + 18 + (i % 2 ? -14 : 4)]);
        k.path(pts, { fill: "#c8463a", w: 5 });
        y -= 16;
      }
      if (tomato) {
        for (const x of [190, 300, 410]) k.path([[x - 62, y - 4], [x + 62, y - 4], [x + 58, y + 16], [x - 58, y + 16]], { fill: "#e63946", w: 5, smooth: true });
        y -= 14;
      }
      y = lettuce(y + 6);
      // pan de arriba
      const top = y - 230;
      k.path([[70, y + 12], [72, y - 50], [120, top + 70], [210, top + 10], [300, top], [390, top + 10], [480, top + 70], [528, y - 50], [530, y + 12]], { fill: bun, shade: "rb", light: true });
      if (!k.drop()) for (const [dx, dy, a] of [[-120, 90, 20], [-60, 45, -15], [0, 80, 10], [60, 30, 30], [110, 85, -25], [-150, 160, 5], [30, 140, -10], [150, 150, 15], [-60, 140, 40]]) {
        k.ellipse(300 + dx, top + dy, 11, 6, { fill: "#fff4dc", w: 3, rot: a });
      }
      // palillo con banderita
      if (k.chance(0.5) && !k.drop()) {
        k.line([[300, top + 40], [300, top - 90]], 6, "#d9a066");
        k.path([[302, top - 90], [370, top - 70], [302, top - 50]], { fill: k.pick(["#e63946", "#2ec4b6", "#ffd21f"]), w: 4 });
      }
    },
  },

  // ───────────────────────────── CAFÉ ─────────────────────────────
  {
    key: "cafe",
    words: ["café", "cafe", "taza", "tazas", "desayuno", "desayunar", "té", "infusión", "chocolate"],
    name: "Una taza de café",
    draw(k) {
      wall(k, k.pick(["#fff4dc", "#e6f2fb", "#fde7ef", "#efe8dc"]), k.pick(["dots", "stripes", "none"]));
      table(k, 690, k.pick(["#c98e62", "#d9a066", "#9fbfa8"]));
      const tea = k.chance(0.3);
      const cup = k.pick(["#ffffff", "#2ec4b6", "#ff8fb8", "#ffcf33", "#3b82f6", "#e63946"]);
      // cruasán al lado
      if (k.chance(0.35) && !k.drop()) {
        k.path([[430, 820], [470, 770], [530, 760], [585, 790], [575, 840], [520, 860], [460, 855]], { fill: "#e9a24f", shade: "b", light: true });
        for (const x of [480, 515, 548]) k.line([[x, 772], [x - 6, 852]], 4, "#b07a3f");
      }
      // platillo
      k.ellipse(300, 710, 250, 62, { fill: cup === "#ffffff" ? "#f3f4f7" : "#ffffff", w: 6, shade: "b" });
      k.ellipse(300, 700, 150, 30, { fill: "none", w: 3, stroke: "#c9ccd2" });
      // asa
      k.tube([[440, 470], [530, 470], [545, 560], [430, 610]], 26, cup);
      // taza
      const rimY = 420, rx = 170, ry = 44;
      k.path([[300 - rx, rimY], [300 - rx + 6, 520], [300 - 130, 650], [210, 700], [390, 700], [430, 650], [300 + rx - 6, 520], [300 + rx, rimY], ...arcPts(300, rimY, rx, ry, 0, Math.PI, 20)], { fill: cup, shade: "r", light: true });
      if (cup === "#ffffff" && !k.drop()) {
        const c = k.pick(["#e63946", "#3b82f6", "#2aa84a"]);
        k.path([[195, 560], [210, 545], [225, 560], [210, 578]], { fill: c, w: 3 });
        k.circle(300, 560, 22, { fill: c, w: 3 });
        k.path([[375, 560], [390, 545], [405, 560], [390, 578]], { fill: c, w: 3 });
      }
      k.ellipse(300, rimY, rx, ry, { fill: k.tone(cup, -0.08), w: 6, n: 28 });
      const drink = tea ? "#c8782a" : "#6b3e1f";
      k.ellipse(300, rimY + 6, rx - 18, ry - 12, { fill: drink, w: 0, n: 28 });
      if (!tea && k.chance(0.6) && !k.drop()) {
        // corazón de espuma
        k.path([[300, rimY + 24], [258, rimY + 2], [270, rimY - 14], [300, rimY - 6], [330, rimY - 14], [342, rimY + 2]], { fill: "#f2e3c6", w: 0 });
      }
      if (tea && !k.drop()) {
        k.line([[400, rimY - 10], [430, 440], [440, 530]], 3, "#8f96a3");
        k.rect(422, 520, 40, 44, { r: 4, fill: k.pick(["#ffd21f", "#2aa84a", "#e63946"]), w: 4 });
      }
      // vapor
      if (!k.drop()) for (const x of [240, 300, 360]) steam(k, x, rimY - 40, k.R(120, 190), "#ffffff", 9);
    },
  },

  // ─────────────────────────── LÁMPARA / BOMBILLA ───────────────────────────
  {
    key: "lampara",
    words: ["lámpara", "lampara", "bombilla", "bombillas", "idea", "ideas", "luz", "inventor"],
    name: "Una bombilla",
    draw(k) {
      const bulb = k.chance(0.6);
      if (bulb) {
        k.bg(k.pick(["#23305e", "#2a2357", "#1f3b4d"]));
        const glow = k.pick(["#fff3a8", "#ffe066", "#ffd27a"]);
        // halo
        k.circle(300, 360, 260, { fill: glow, w: 0, opacity: 0.12 });
        k.circle(300, 360, 215, { fill: glow, w: 0, opacity: 0.18 });
        // rayos
        if (!k.drop()) for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.9 + (i / 8) * 1.2);
          k.line([[300 + Math.cos(a) * 225, 360 + Math.sin(a) * 225], [300 + Math.cos(a) * 280, 360 + Math.sin(a) * 280]], 12, glow);
        }
        // cristal
        k.path([[300, 170], [410, 210], [470, 330], [450, 440], [390, 520], [375, 590], [225, 590], [210, 520], [150, 440], [130, 330], [190, 210]], { fill: glow, light: true, shade: "r", shadeK: 0.08 });
        // filamento
        k.line([[255, 590], [255, 480], [275, 440]], 5, "#c8782a");
        k.line([[345, 590], [345, 480], [325, 440]], 5, "#c8782a");
        k.line([[275, 440], [285, 420], [295, 440], [305, 420], [315, 440], [325, 420], [325, 440]], 5, "#ff7a1a", { smooth: false });
        // rosca
        for (let i = 0; i < 4; i++) k.rect(220, 585 + i * 32, 160, 36, { r: 16, fill: i % 2 ? "#a1a7b3" : "#c9ccd2", w: 6, shade: i === 0 ? "b" : null });
        k.path([[255, 715], [345, 715], [320, 760], [280, 760]], { fill: "#2b2b30", w: 6 });
        if (!k.drop()) for (const [x, y, s] of [[110, 140, 20], [500, 160, 16], [520, 560, 22], [80, 600, 14]]) sparkle(k, x, y, s, glow);
      } else {
        const night = k.chance(0.5);
        wall(k, night ? "#3b3f6e" : k.pick(["#fff4dc", "#e8f4ff", "#eaf6e4"]), night ? "none" : k.pick(["dots", "stripes"]));
        const shadeC = k.pick(["#ff8fb8", "#2ec4b6", "#ffd21f", "#ff7a1a", "#9b5de5", "#a8e6cf"]);
        // mesilla
        k.rect(110, 700, 380, 40, { r: 10, fill: "#b98654", shade: "b" });
        k.rect(140, 735, 320, 190, { r: 6, fill: "#c98e62", shade: "r" });
        if (!k.drop()) { k.line([[150, 815], [450, 815]], 4, "#8b5a2b"); k.circle(300, 780, 10, { fill: "#ffd21f", w: 3 }); }
        // luz
        k.path([[180, 430], [420, 430], [540, 705], [60, 705]], { fill: "#ffe98a", w: 0, opacity: night ? 0.8 : 0.4, smooth: false });
        // base y pie
        k.ellipse(300, 690, 110, 26, { fill: k.tone(shadeC, -0.25), w: 6, shade: "b" });
        k.path([[255, 690], [270, 600], [330, 600], [345, 690]], { fill: k.tone(shadeC, -0.25), w: 6, shade: "r" });
        k.tube([[300, 600], [300, 430]], 16, "#c9ccd2");
        // pantalla
        k.circle(300, 425, 34, { fill: "#fff3a8", w: 5 });
        k.path([[185, 200], [415, 200], [480, 435], [120, 435]], { fill: shadeC, shade: "r", light: true, smooth: false });
        if (!k.drop()) k.line([[128, 410], [472, 410]], 5, k.tone(shadeC, -0.3));
        if (night && !k.drop()) k.stars(6, [20, 20, 580, 180]);
      }
    },
  },

  // ───────────────────────────── LIBRO ─────────────────────────────
  {
    key: "libro",
    words: ["libro", "libros", "leer", "lectura", "biblioteca", "cuento", "cuentos", "historia", "estudiar"],
    name: "Un libro",
    draw(k) {
      const open = k.chance(0.6);
      const covers = ["#e63946", "#2563eb", "#22a06b", "#9b5de5", "#ff7a1a", "#2ec4b6"];
      if (open) {
        k.bg(k.pick(["#e8e1ff", "#d9f1ff", "#fde7ef", "#fff4dc"]));
        const cover = k.pick(covers);
        // magia que sale
        if (!k.drop()) {
          for (let i = 0; i < 7; i++) {
            const a = Math.PI * (1.15 + (i / 6) * 0.7), b = a + 0.09;
            k.path([[300, 520], [300 + Math.cos(a) * 520, 520 + Math.sin(a) * 520], [300 + Math.cos(b) * 520, 520 + Math.sin(b) * 520]], { fill: "#ffffff", w: 0, opacity: 0.55, smooth: false });
          }
          for (const [x, y, s, c] of [[180, 200, 26, "#ffd21f"], [400, 150, 20, "#ff8fb8"], [300, 300, 16, "#a5d8ff"], [470, 300, 14, "#ffd21f"], [120, 330, 12, "#ffffff"]]) sparkle(k, x, y, s, c);
        }
        if (!k.drop()) {
          // mariposa / estrella
          k.path([[300, 200], [312, 230], [345, 232], [320, 252], [330, 285], [300, 266], [270, 285], [280, 252], [255, 232], [288, 230]], { fill: "#ffd21f", w: 5, smooth: false });
        }
        // tapas
        k.path([[300, 520], [180, 480], [40, 495], [30, 760], [170, 750], [300, 790], [430, 750], [570, 760], [560, 495], [420, 480]], { fill: cover, shade: "b", w: 6 });
        // hojas
        for (const s of [-1, 1]) {
          for (let j = 2; j >= 0; j--) {
            const o = j * 8;
            k.path([[300, 515 + o * 0.4], [300 + s * 130, 470 + o], [300 + s * 245, 485 + o], [300 + s * 245, 735 + o * 0.5], [300 + s * 130, 722 + o * 0.5], [300, 765]], { fill: j ? "#ece3cf" : "#fffaf0", smooth: true, w: 5, shade: j === 0 && s > 0 ? "r" : null, shadeK: 0.06 });
          }
          // líneas de texto
          if (!k.drop()) for (let i = 0; i < 7; i++) {
            const y = 525 + i * 28;
            const x1 = 300 + s * 35, x2 = 300 + s * (i === 6 ? 140 : 215);
            k.line([[x1, y + 4], [(x1 + x2) / 2, y - 8], [x2, y - 2]], 4, "#b8bcc6");
          }
        }
        if (!k.drop()) k.path([[300, 760], [290, 860], [300, 845], [310, 860]], { fill: "#e63946", w: 4, smooth: false });
      } else {
        // pila de libros
        wall(k, k.pick(["#fff4dc", "#e8f4ff", "#fde7ef"]), k.pick(["dots", "stripes"]));
        table(k, 760, k.pick(["#d9a066", "#c98e62"]));
        const cs = covers.slice().sort(() => k.R(-1, 1));
        const books = [[90, 640, 420, 120, -1], [120, 530, 380, 110, 2], [70, 420, 440, 110, -2]];
        books.forEach(([x, y, w, h, rot], i) => {
          k.group(`rotate(${rot} 300 ${y + h / 2})`, () => {
            k.rect(x + 18, y + 14, w - 24, h - 28, { r: 6, fill: "#fffaf0", w: 5 });
            if (!k.drop()) for (let j = 1; j < 4; j++) k.line([[x + w - 8, y + 14 + j * (h - 28) / 4], [x + w - 4, y + 14 + j * (h - 28) / 4]], 3, "#c9ccd2");
            k.rect(x, y, w - 20, h, { r: 12, fill: cs[i], shade: "b", light: true });
            if (!k.drop()) {
              k.line([[x + 40, y + 10], [x + 40, y + h - 10]], 5, k.tone(cs[i], -0.3));
              k.rect(x + 110, y + h / 2 - 16, w - 230, 32, { r: 8, fill: "#fff4dc", w: 4 });
            }
          });
        });
        // manzana encima
        if (k.chance(0.6)) {
          k.path([[300, 345], [340, 320], [380, 340], [385, 390], [350, 425], [300, 425], [262, 395], [260, 345]], { fill: "#e63946", shade: "r", light: true });
          k.line([[318, 340], [325, 300]], 6, "#7c4a1e");
          k.ellipse(352, 302, 24, 11, { fill: "#2aa84a", w: 4, rot: -25 });
        } else if (!k.drop()) {
          k.group("rotate(-6 300 380)", () => k.rect(150, 345, 300, 75, { r: 12, fill: cs[3], shade: "b", light: true }));
        }
      }
    },
  },

  // ───────────────────────────── SOMBRERO ─────────────────────────────
  {
    key: "sombrero",
    words: ["sombrero", "sombreros", "gorro", "gorra", "chistera", "mago", "magia", "bruja", "conejo"],
    name: "Un sombrero",
    draw(k) {
      const type = k.pick(["chistera", "chistera", "mago", "lana"]);
      if (type === "chistera") {
        k.bg(k.pick(["#e8e1ff", "#2a2357", "#ffe1ea"]));
        const rabbit = k.chance(0.6);
        const band = k.pick(["#e63946", "#9b5de5", "#ffd21f"]);
        // boca del sombrero (detrás)
        k.ellipse(300, 330, 140, 34, { fill: "#1a1a1f", w: 6 });
        // conejo asomando
        if (rabbit) {
          for (const s of [-1, 1]) {
            k.path([[300 + s * 30, 300], [300 + s * 55, 150], [300 + s * 85, 115], [300 + s * 98, 150], [300 + s * 75, 300]], { fill: "#ffffff", w: 6, shade: s > 0 ? "r" : null });
            if (!k.drop()) k.path([[300 + s * 48, 280], [300 + s * 63, 170], [300 + s * 80, 150], [300 + s * 72, 280]], { fill: "#ffb7cf", w: 0 });
          }
          k.ellipse(300, 315, 100, 80, { fill: "#ffffff", shade: "r", w: 6 });
          k.eye(265, 300, 15);
          k.eye(335, 300, 15);
          k.ellipse(300, 326, 10, 7, { fill: "#ff7b8f", w: 3 });
          k.mouth(300, 340, 26, "smile");
          k.cheeks(245, 355, 330, 14);
          // patitas en el borde
          for (const x of [235, 365]) k.ellipse(x, 345, 24, 15, { fill: "#ffffff", w: 5 });
        }
        // copa (por delante): el borde delantero tapa al conejo
        k.path([...arcPts(300, 330, 140, 34, Math.PI, 0, 20), [430, 650], [170, 650]], { fill: "#2b2b30", smooth: false, shade: "r", shadeK: 0.1, w: 6, dense: false });
        // cinta
        k.path([[168, 560], [432, 560], [430, 640], [170, 640]], { fill: band, smooth: false, w: 5 });
        if (!k.drop()) k.path([[200, 400], [215, 395], [215, 540], [200, 545]], { fill: "#ffffff", w: 0, opacity: 0.25, smooth: false });
        // ala
        k.path([[60, 650], [120, 630], [480, 630], [540, 650], [520, 700], [300, 715], [80, 700]], { fill: "#3a3a42", shade: "b" });
        // varita
        k.group("rotate(-35 470 700)", () => {
          k.rect(450, 520, 24, 260, { r: 6, fill: "#2b2b30", w: 5 });
          k.rect(450, 520, 24, 46, { r: 6, fill: "#ffffff", w: 5 });
        });
        if (!k.drop()) for (const [x, y, s] of [[110, 210, 22], [500, 170, 26], [530, 360, 16], [80, 450, 14], [450, 520, 18]]) sparkle(k, x, y, s, "#ffd21f");
      } else if (type === "mago") {
        k.bg(k.pick(["#23305e", "#2a2357"]));
        k.stars(10, [0, 0, 600, 400]);
        const c = k.pick(["#9b5de5", "#2563eb", "#22a06b"]);
        k.path([[110, 650], [250, 330], [330, 180], [440, 110], [420, 170], [390, 300], [490, 650]], { fill: c, shade: "r", light: true });
        if (!k.drop()) {
          sparkle(k, 300, 470, 30, "#ffd21f");
          sparkle(k, 370, 330, 20, "#ffd21f");
          sparkle(k, 220, 580, 18, "#ffd21f");
          k.path([[400, 520], [430, 495], [445, 540], [420, 575], [395, 560], [418, 540]], { fill: "#fff3a8", w: 4 });
        }
        k.path([[110, 600], [490, 600], [495, 650], [105, 650]], { fill: "#ffd21f", smooth: false, w: 5 });
        k.path([[30, 660], [120, 630], [480, 630], [570, 660], [520, 715], [300, 735], [80, 715]], { fill: c, shade: "b" });
        k.circle(443, 113, 20, { fill: "#ffd21f", w: 5 });
      } else {
        // gorro de lana
        k.bg(k.pick(["#d9f1ff", "#e8f4ff"]));
        if (!k.drop()) for (let i = 0; i < 14; i++) k.circle(k.R(20, 580), k.R(20, 880), k.R(5, 10), { fill: "#ffffff", w: 0 });
        const [c1, c2] = k.pick([["#e63946", "#ffffff"], ["#2ec4b6", "#ffd21f"], ["#9b5de5", "#ff8fb8"], ["#3b82f6", "#ffffff"]]);
        k.path([[110, 620], [115, 470], [170, 340], [300, 290], [430, 340], [485, 470], [490, 620]], { fill: c1, shade: "r", light: true });
        if (!k.drop()) for (const y of [420, 500]) k.path([[118 + (y === 420 ? 18 : 2), y], [482 - (y === 420 ? 18 : 2), y], [486, y + 34], [114, y + 34]], { fill: c2, w: 5, smooth: false });
        // vuelta
        k.rect(90, 590, 420, 120, { r: 30, fill: k.tone(c1, -0.1), shade: "b" });
        if (!k.drop()) for (let x = 125; x < 500; x += 30) k.line([[x, 605], [x, 695]], 4, k.tone(c1, -0.3));
        // pompón
        const pts = [];
        for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const r = i % 2 ? 78 : 64; pts.push([300 + Math.cos(a) * r, 230 + Math.sin(a) * r]); }
        k.path(pts, { fill: c2, shade: "rb", smooth: false });
      }
    },
  },

  // ───────────────────────────── REGALO ─────────────────────────────
  {
    key: "regalo",
    words: ["regalo", "regalos", "sorpresa", "navidad", "reyes", "paquete", "caja"],
    name: "Un regalo",
    draw(k) {
      const xmas = k.chance(0.3);
      k.bg(xmas ? "#1f3b4d" : k.pick(["#fde7ef", "#e8f4ff", "#fff4dc", "#e9f7df"]));
      if (xmas) { if (!k.drop()) for (let i = 0; i < 18; i++) k.circle(k.R(20, 580), k.R(20, 880), k.R(4, 9), { fill: "#ffffff", w: 0 }); }
      else if (!k.drop()) for (let i = 0; i < 14; i++) k.rect(k.R(20, 570), k.R(20, 880), 14, 7, { r: 2, fill: k.pick(["#e63946", "#ffd21f", "#2ec4b6", "#9b5de5", "#3b82f6"]), w: 0 });
      const [box, ribbon] = xmas ? k.pick([["#e63946", "#2aa84a"], ["#2aa84a", "#ffd21f"], ["#e63946", "#ffd21f"]]) : k.pick([["#ff8fb8", "#9b5de5"], ["#2ec4b6", "#ff7a1a"], ["#ffd21f", "#e63946"], ["#3b82f6", "#ffd21f"], ["#9b5de5", "#ffd21f"]]);
      const pattern = k.pick(["dots", "stripes", "none"]);
      k.ellipse(300, 790, 240, 26, { fill: "#000000", w: 0, opacity: 0.12 });
      // caja
      k.path([[110, 470], [490, 470], [490, 790], [110, 790]], { fill: box, smooth: false, shade: "r", light: true });
      if (!k.drop()) {
        if (pattern === "dots") for (let y = 520; y < 770; y += 70) for (let x = (y / 70) % 2 < 1 ? 150 : 185; x < 470; x += 70) if (Math.abs(x - 300) > 50) k.circle(x, y, 13, { fill: k.tone(box, 0.45), w: 0 });
        if (pattern === "stripes") for (let x = 145; x < 470; x += 60) if (Math.abs(x + 15 - 300) > 55) k.path([[x, 476], [x + 22, 476], [x + 22, 784], [x, 784]], { fill: k.tone(box, 0.35), w: 0, smooth: false });
      }
      // tapa
      k.path([[85, 400], [515, 400], [515, 480], [85, 480]], { fill: k.tone(box, -0.05), smooth: false, shade: "b", light: true });
      // cinta
      k.path([[270, 400], [330, 400], [330, 790], [270, 790]], { fill: ribbon, smooth: false, shade: "r", w: 5 });
      if (!k.drop()) k.path([[85, 425], [515, 425], [515, 455], [85, 455]], { fill: ribbon, smooth: false, w: 5 });
      // lazo
      for (const s of [-1, 1]) {
        k.path([[300, 390], [300 + s * 70, 290], [300 + s * 150, 270], [300 + s * 165, 330], [300 + s * 120, 385]], { fill: ribbon, shade: "b", light: s < 0 });
        if (!k.drop()) k.path([[300 + s * 20, 380], [300 + s * 80, 310], [300 + s * 130, 300]], { closed: false, w: 4, stroke: k.tone(ribbon, -0.35) });
      }
      k.path([[300, 398], [270, 440], [250, 520], [282, 500], [300, 420], [318, 500], [350, 520], [330, 440]], { fill: k.tone(ribbon, -0.1), w: 5 });
      k.ellipse(300, 385, 38, 30, { fill: ribbon, shade: "b", w: 6 });
      // etiqueta
      if (!k.drop()) {
        k.line([[345, 470], [420, 540]], 3);
        k.group("rotate(15 440 560)", () => k.rect(410, 535, 70, 50, { r: 8, fill: "#fff4dc", w: 4 }));
      }
      if (!k.drop()) for (const [x, y, s] of [[90, 210, 22], [510, 190, 26], [520, 360, 14]]) sparkle(k, x, y, s, xmas ? "#ffd21f" : "#ffffff");
    },
  },

  // ───────────────────────────── TELÉFONO ─────────────────────────────
  {
    key: "telefono",
    words: ["teléfono", "telefono", "móvil", "movil", "llamada", "llamar", "mensaje", "smartphone", "celular"],
    name: "Un teléfono",
    draw(k) {
      const mobile = k.chance(0.6);
      if (mobile) {
        k.bg(k.pick(["#e8e1ff", "#d9f1ff", "#ffe1ea", "#e6f7ef"]));
        // ondas de llamada
        if (!k.drop()) for (const r of [60, 95]) {
          k.arc(470, 170, r, -0.25 * Math.PI, 0.25 * Math.PI, 6);
          k.arc(130, 170, r, 0.75 * Math.PI, 1.25 * Math.PI, 6);
        }
        const caseC = k.pick(["#2b2b30", "#e63946", "#2ec4b6", "#9b5de5", "#ff8fb8"]);
        k.rect(145, 110, 310, 690, { r: 54, fill: caseC, shade: "r", light: true });
        const scr = k.pick(["#9fdcf7", "#ffd8b5", "#c8b6ff", "#a8e6cf"]);
        k.rect(170, 140, 260, 630, { r: 34, fill: scr, w: 5 });
        k.rect(255, 156, 90, 22, { r: 11, fill: "#1f1f24", w: 0 });
        // barra de hora
        if (!k.drop()) k.rect(200, 205, 110, 18, { r: 9, fill: "#ffffff", w: 0, opacity: 0.8 });
        const icons = ["#e63946", "#ffd21f", "#2aa84a", "#3b82f6", "#ff7a1a", "#9b5de5", "#2ec4b6", "#ff8fb8", "#ffffff"];
        let n = 0;
        for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
          if (k.drop()) continue;
          k.rect(200 + c * 72, 250 + r * 80, 54, 54, { r: 15, fill: icons[(n++ + r) % icons.length], w: 4 });
        }
        // dock
        k.rect(190, 640, 220, 84, { r: 24, fill: "#ffffff", w: 0, opacity: 0.55 });
        for (let c = 0; c < 3; c++) k.rect(205 + c * 70, 654, 54, 54, { r: 15, fill: ["#2aa84a", "#3b82f6", "#e63946"][c], w: 4 });
        k.rect(250, 745, 100, 9, { r: 4, fill: "#1f1f24", w: 0 });
        // notificación
        if (k.chance(0.6)) {
          k.circle(430, 140, 34, { fill: "#e63946", w: 5 });
          k.line([[430, 122], [430, 146]], 7, "#ffffff");
          k.dot(430, 160, 5, "#ffffff");
        }
      } else {
        // teléfono clásico de disco
        wall(k, k.pick(["#fff4dc", "#e8f4ff", "#eaf6e4"]), k.pick(["dots", "stripes"]));
        table(k, 720, k.pick(["#c98e62", "#d9a066"]));
        const c = k.pick(["#e63946", "#2ec4b6", "#ffcf33", "#2b2b30", "#ff8fb8"]);
        // cable rizado
        if (!k.drop()) {
          const pts = [];
          for (let i = 0; i <= 60; i++) { const t = i / 60; pts.push([110 - t * 60 + Math.cos(i * 1.1) * 14, 600 + t * 260 + Math.sin(i * 1.1) * 10]); }
          k.line(pts, 5, k.tone(c, -0.3));
        }
        k.ellipse(300, 730, 230, 26, { fill: "#000000", w: 0, opacity: 0.15 });
        k.path([[90, 730], [130, 520], [200, 455], [400, 455], [470, 520], [510, 730]], { fill: c, shade: "r", light: true });
        // disco
        k.circle(300, 600, 98, { fill: "#fffaf0", w: 6 });
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI * 0.35 + (i / 10) * Math.PI * 1.65;
          k.circle(300 + Math.cos(a) * 68, 600 + Math.sin(a) * 68, 15, { fill: k.tone(c, 0.3), w: 3 });
        }
        k.circle(300, 600, 30, { fill: c, w: 4 });
        // horquilla y auricular
        for (const x of [150, 450]) k.rect(x - 22, 420, 44, 50, { r: 10, fill: k.tone(c, -0.15), w: 5 });
        k.tube([[150, 410], [210, 360], [300, 350], [390, 360], [450, 410]], 52, c);
        for (const s of [-1, 1]) k.ellipse(300 + s * 160, 420, 66, 36, { fill: c, shade: "b", w: 6, rot: s * 20 });
      }
    },
  },

  // ─────────────────────────── TELEVISIÓN ───────────────────────────
  {
    key: "television",
    words: ["televisión", "television", "tele", "televisor", "película", "pelicula", "cine", "dibujos", "serie"],
    name: "Una televisión",
    draw(k) {
      wall(k, k.pick(["#ffe9c7", "#e8f4ff", "#e8e1ff", "#eaf6e4"]), k.pick(["stripes", "dots", "none"]));
      k.path([[-30, 760], [630, 760], [630, 930], [-30, 930]], { fill: k.pick(["#c98e62", "#b98654"]), smooth: false, w: 5 });
      if (!k.drop()) k.ellipse(300, 830, 250, 50, { fill: k.pick(["#e63946", "#2ec4b6", "#9b5de5"]), w: 5, opacity: 0.85 });
      const body = k.pick(["#d9a066", "#e63946", "#2ec4b6", "#ffcf33", "#9b5de5"]);
      // antenas
      k.line([[300, 300], [200, 120]], 6);
      k.line([[300, 300], [420, 110]], 6);
      k.circle(200, 118, 12, { fill: "#e63946", w: 4 });
      k.circle(420, 108, 12, { fill: "#e63946", w: 4 });
      k.ellipse(300, 300, 50, 24, { fill: "#5b616b", w: 5 });
      // patas
      k.tube([[170, 680], [140, 780]], 16, "#5b616b");
      k.tube([[430, 680], [460, 780]], 16, "#5b616b");
      // caja
      k.rect(70, 300, 460, 400, { r: 40, fill: body, shade: "rb", light: true });
      // pantalla
      const sx = 105, sy = 340, sw = 320, sh = 320;
      const show = k.pick(["paisaje", "barras", "pez", "cara"]);
      const scrBg = show === "pez" ? "#4aa3df" : show === "barras" ? "#ffffff" : show === "cara" ? "#ffe066" : "#9fdcf7";
      k.rect(sx, sy, sw, sh, { r: 46, fill: "#2b2b30", w: 6 });
      k.rect(sx + 14, sy + 14, sw - 28, sh - 28, { r: 36, fill: scrBg, w: 0 });
      const X0 = sx + 30, X1 = sx + sw - 30, Y0 = sy + 30, Y1 = sy + sh - 30;
      if (show === "barras") {
        const cols = ["#ffffff", "#ffd21f", "#2ec4b6", "#2aa84a", "#ff8fb8", "#e63946", "#3b82f6"];
        const bw = (X1 - X0) / 7;
        cols.forEach((c, i) => k.path([[X0 + i * bw, Y0], [X0 + (i + 1) * bw, Y0], [X0 + (i + 1) * bw, Y1], [X0 + i * bw, Y1]], { fill: c, w: 0, smooth: false, raw: true }));
      } else if (show === "paisaje") {
        k.circle(X1 - 50, Y0 + 50, 30, { fill: "#ffd21f", w: 4 });
        k.path([[X0, Y1 - 70], [X0 + 90, Y1 - 120], [X0 + 170, Y1 - 80], [X1, Y1 - 120], [X1, Y1], [X0, Y1]], { fill: "#7ccf4a", w: 4 });
      } else if (show === "pez") {
        k.path([[X0 + 40, Y0 + 130], [X0 + 110, Y0 + 80], [X0 + 190, Y0 + 130], [X0 + 110, Y0 + 180]], { fill: "#ff7a1a", w: 5 });
        k.path([[X0 + 180, Y0 + 130], [X0 + 235, Y0 + 90], [X0 + 235, Y0 + 170]], { fill: "#ff7a1a", w: 5 });
        k.eye(X0 + 85, Y0 + 120, 12);
        if (!k.drop()) for (const [x, y, r] of [[X0 + 30, Y0 + 60, 10], [X0 + 50, Y0 + 25, 7], [X1 - 20, Y1 - 30, 9]]) k.circle(x, y, r, { fill: "none", w: 3, stroke: "#ffffff" });
      } else {
        k.eye(X0 + 85, Y0 + 100, 22);
        k.eye(X1 - 85, Y0 + 100, 22);
        k.mouth((X0 + X1) / 2, Y0 + 175, 110, "open");
      }
      // brillo del cristal
      if (!k.drop()) k.path([[sx + 40, sy + 60], [sx + 70, sy + 30], [sx + 120, sy + 26]], { closed: false, w: 7, stroke: "#ffffff", opacity: 0.7 });
      // botones
      k.circle(478, 395, 26, { fill: "#fff4dc", w: 5 });
      k.line([[478, 395], [490, 377]], 5);
      k.circle(478, 470, 26, { fill: "#fff4dc", w: 5 });
      k.line([[478, 470], [462, 455]], 5);
      if (!k.drop()) for (let y = 530; y < 650; y += 20) k.line([[458, y], [498, y]], 4, k.tone(body, -0.35));
      // palomitas
      if (k.chance(0.4) && !k.drop()) {
        for (const [x, y] of [[470, 770], [500, 760], [530, 772], [485, 750], [515, 745]]) k.circle(x, y, 18, { fill: "#fff8e1", w: 4 });
        k.path([[450, 780], [550, 780], [535, 880], [465, 880]], { fill: "#ffffff", smooth: false, w: 5 });
        for (const x of [475, 500, 525]) k.line([[x, 785], [x - 2 + (x - 500) * 0.1, 875]], 10, "#e63946");
      }
    },
  },

  // ───────────────────────────── CAMA ─────────────────────────────
  {
    key: "cama",
    words: ["cama", "camas", "dormir", "dormido", "sueño", "sueno", "almohada", "noche", "siesta", "dormitorio"],
    name: "Una cama",
    draw(k) {
      const wallC = k.pick(["#c8d6f0", "#e8e1ff", "#d7ecf5", "#f2e2ef"]);
      wall(k, wallC, k.pick(["dots", "none"]));
      // ventana de noche
      k.rect(330, 90, 200, 220, { r: 14, fill: "#23305e", w: 6 });
      k.circle(470, 150, 30, { fill: "#fff3a8", w: 4 });
      k.circle(482, 140, 26, { fill: "#23305e", w: 0 });
      if (!k.drop()) k.stars(4, [350, 110, 450, 290]);
      k.line([[430, 92], [430, 308]], 6);
      k.line([[332, 200], [528, 200]], 6);
      // suelo
      k.path([[-30, 760], [630, 760], [630, 930], [-30, 930]], { fill: "#b98654", smooth: false, w: 5 });
      const wood = k.pick(["#d9a066", "#8b5a2b", "#9fdcf7", "#ff8fb8"]);
      const quilt = k.pick(["#ff8fb8", "#2ec4b6", "#ffcf33", "#9b5de5", "#3b82f6", "#ff7a1a"]);
      if (!k.drop()) k.ellipse(320, 830, 260, 40, { fill: k.pick(["#e63946", "#2ec4b6", "#9b5de5"]), w: 5, opacity: 0.8 });
      // cabecero
      k.path([[20, 810], [20, 420], [40, 370], [95, 350], [130, 370], [140, 420], [140, 810]], { fill: wood, shade: "r", light: true });
      // patas
      for (const x of [150, 520]) k.rect(x, 760, 26, 50, { r: 6, fill: k.tone(wood, -0.3), w: 5 });
      // base y colchón
      k.rect(120, 640, 440, 130, { r: 12, fill: k.tone(wood, -0.08), shade: "b" });
      k.rect(120, 575, 440, 80, { r: 22, fill: "#ffffff", w: 6, shade: "b" });
      // almohada
      k.path([[140, 580], [130, 530], [160, 495], [260, 492], [300, 520], [295, 580]], { fill: "#fffaf0", shade: "b", light: true });
      const sleeper = k.chance(0.6);
      if (sleeper) {
        const skin = k.col("skin");
        k.circle(215, 530, 52, { fill: skin, shade: "r" });
        k.path([[165, 520], [172, 482], [215, 462], [262, 480], [270, 510], [240, 498], [205, 495], [180, 515]], { fill: k.pick(["#3e2410", "#8b5a2b", "#ffd27a", "#1f1f24", "#c8463a"]), w: 5 });
        k.eye(198, 535, 12, { closed: true });
        k.eye(236, 535, 12, { closed: true });
        k.cheeks(185, 250, 556, 10);
        if (!k.drop()) k.mouth(218, 558, 18, "o");
      }
      // edredón
      const qb = [];
      for (let i = 0; i <= 8; i++) qb.push([550 - i * 33, 740 + (i % 2 ? 10 : 0)]);
      k.path([[262, 562], [540, 555], [565, 590], [562, 700], ...qb, [262, 735], [250, 640]], { fill: quilt, shade: "b", light: true });
      if (!k.drop()) {
        k.path([[262, 562], [540, 555], [552, 576], [258, 590]], { fill: "#ffffff", w: 5 });
        for (const [x, y] of [[330, 640], [420, 625], [500, 680], [380, 700], [300, 690], [480, 610]]) k.circle(x, y, 13, { fill: k.tone(quilt, 0.45), w: 0 });
      }
      // pie de cama
      k.path([[530, 810], [530, 600], [560, 560], [590, 600], [590, 810]], { fill: wood, smooth: false, shade: "r" });
      // zetas
      if (!k.drop()) {
        zeta(k, 290, 440, 18, "#3b3f6e");
        zeta(k, 340, 385, 26, "#3b3f6e");
      }
    },
  },
];
