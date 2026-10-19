// Dibujos de los robots de la sala de pruebas: hechos con trazos "a mano" (SVG),
// relacionados con la frase cuando se puede. Con `level` > 0 salen peor (copias de memoria).
const crypto = require("crypto");
const rnd = () => crypto.randomInt(1_000_000) / 1_000_000;
const pick = (a) => a[crypto.randomInt(a.length)];

const INK = "#1f1f24";
function makeCtx(level) {
  const a = 3 + level * 9; // temblor del pulso
  const j = (v, k = 1) => +(v + (rnd() - 0.5) * 2 * a * k).toFixed(1);
  const drop = () => level > 0 && rnd() < level * 0.18; // detalles que se olvidan al copiar
  const shift = { x: (rnd() - 0.5) * level * 40, y: (rnd() - 0.5) * level * 40, s: 1 + (rnd() - 0.5) * level * 0.18 };
  const T = (x, y) => [300 + (x - 300) * shift.s + shift.x, 450 + (y - 450) * shift.s + shift.y];
  const out = [];
  const pathOf = (pts, closed) => {
    let d = "";
    pts.forEach(([x, y], i) => {
      const [tx, ty] = T(x, y);
      d += (i ? " L" : "M") + j(tx) + " " + j(ty);
    });
    return d + (closed ? " Z" : "");
  };
  const stroke = (w) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const ctx = {
    level,
    drop,
    // Forma cerrada (relleno + contorno repasado dos veces, como a rotulador)
    shape(pts, fill, w = 7) {
      out.push(`<path d="${pathOf(pts, true)}" fill="${fill}" ${stroke(w)}/>`);
      out.push(`<path d="${pathOf(pts, true)}" fill="none" ${stroke(w * 0.45)} opacity=".55"/>`);
    },
    line(pts, w = 7, color = INK) {
      out.push(`<path d="${pathOf(pts, false)}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
    },
    blob(cx, cy, rx, ry, fill, w = 7, n = 22) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const k = 1 + (rnd() - 0.5) * 0.06;
        pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]);
      }
      ctx.shape(pts, fill, w);
    },
    dot(cx, cy, r, fill = INK) {
      const [x, y] = T(cx, cy);
      out.push(`<circle cx="${j(x, 0.5)}" cy="${j(y, 0.5)}" r="${r}" fill="${fill}"/>`);
    },
    arc(cx, cy, r, a0, a1, w = 7) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = a0 + ((a1 - a0) * i) / 12;
        pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
      }
      ctx.line(pts, w);
    },
    ground(y, color = "#7ad19a") {
      ctx.shape([[-20, y], [620, y + 10], [620, 920], [-20, 920]], color, 6);
    },
    svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="600" height="900" fill="#fff"/>${out.join("")}</svg>`;
    },
  };
  return ctx;
}
const smile = (c, x, y, r) => c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI, 6);

// Cada tema: palabras que lo activan, cómo lo "adivina" un robot y cómo se dibuja
const SUBJECTS = [
  { key: "sol", words: ["sol", "verano", "calor", "amanecer"], name: "Un sol sonriente", draw(c) {
    for (let i = 0; i < 12; i++) { if (c.drop()) continue; const t = (i / 12) * Math.PI * 2; c.line([[300 + Math.cos(t) * 150, 380 + Math.sin(t) * 150], [300 + Math.cos(t) * 215, 380 + Math.sin(t) * 215]], 9, "#f5a400"); }
    c.blob(300, 380, 120, 120, "#ffd21f");
    if (!c.drop()) { c.dot(260, 360, 10); c.dot(340, 360, 10); }
    smile(c, 300, 390, 55);
    c.ground(720, "#9fdcf7");
  } },
  { key: "casa", words: ["casa", "pueblo", "cabaña", "hogar", "jardín"], name: "Una casa", draw(c) {
    c.ground(700);
    c.shape([[150, 420], [450, 420], [450, 700], [150, 700]], "#ffb067");
    c.shape([[120, 430], [300, 250], [480, 430]], "#c81d25");
    if (!c.drop()) c.shape([[260, 560], [340, 560], [340, 700], [260, 700]], "#8b5a2b");
    if (!c.drop()) { c.shape([[180, 470], [240, 470], [240, 530], [180, 530]], "#9fdcf7", 6); c.line([[210, 470], [210, 530]], 4); }
    if (!c.drop()) { c.shape([[360, 470], [420, 470], [420, 530], [360, 530]], "#9fdcf7", 6); c.line([[390, 470], [390, 530]], 4); }
    if (!c.drop()) { c.shape([[380, 300], [420, 300], [420, 380], [380, 340]], "#8a8e99", 6); }
    if (!c.drop()) c.blob(470, 160, 55, 55, "#ffd21f", 6);
  } },
  { key: "arbol", words: ["árbol", "bosque", "otoño", "selva", "parque"], name: "Un árbol", draw(c) {
    c.ground(720);
    c.shape([[270, 720], [330, 720], [320, 470], [280, 470]], "#8b5a2b");
    c.blob(300, 380, 150, 130, c.level > 1 ? "#9be04a" : "#1f8a3a");
    if (!c.drop()) c.blob(230, 330, 70, 60, "#4d7a12", 5);
    for (let i = 0; i < 4; i++) if (!c.drop()) c.dot(220 + i * 50, 380 + (i % 2) * 50, 14, "#ff3b3b");
  } },
  { key: "gato", words: ["gato", "gatito", "felino"], name: "Un gato", draw(c) {
    c.blob(300, 600, 130, 150, "#ff9f43");
    c.blob(300, 380, 115, 100, "#ff9f43");
    c.shape([[205, 330], [215, 220], [275, 300]], "#ff9f43");
    c.shape([[325, 300], [385, 220], [395, 330]], "#ff9f43");
    c.dot(260, 370, 12); c.dot(340, 370, 12);
    if (!c.drop()) c.shape([[290, 405], [310, 405], [300, 418]], "#ff8fb8", 4);
    if (!c.drop()) { c.line([[230, 410], [160, 395]], 4); c.line([[230, 425], [160, 430]], 4); c.line([[370, 410], [440, 395]], 4); c.line([[370, 425], [440, 430]], 4); }
    if (!c.drop()) c.line([[420, 680], [510, 620], [500, 520]], 14, "#ff9f43");
  } },
  { key: "perro", words: ["perro", "perrito", "cachorro"], name: "Un perro", draw(c) {
    c.blob(320, 620, 170, 110, "#c68b59");
    c.blob(220, 450, 105, 95, "#c68b59");
    c.shape([[140, 400], [110, 520], [165, 500]], "#8b5a2b");
    if (!c.drop()) c.shape([[290, 390], [330, 500], [270, 480]], "#8b5a2b");
    c.dot(195, 440, 11); c.dot(250, 440, 11);
    c.blob(225, 490, 22, 15, INK, 3);
    for (const x of [210, 270, 380, 440]) if (!c.drop()) c.shape([[x, 700], [x + 30, 700], [x + 30, 790], [x, 790]], "#c68b59", 6);
    if (!c.drop()) c.line([[480, 580], [550, 520]], 14, "#c68b59");
  } },
  { key: "pez", words: ["pez", "mar", "acuario", "tiburón", "ballena", "delfín", "pecera", "océano"], name: "Un pez en el mar", draw(c) {
    c.shape([[-20, 250], [620, 240], [620, 920], [-20, 920]], "#9fdcf7", 5);
    c.blob(290, 480, 150, 90, "#ff7a1a");
    c.shape([[430, 480], [530, 400], [520, 560]], "#ff7a1a");
    c.dot(210, 460, 13);
    if (!c.drop()) c.arc(330, 480, 50, -0.4 * Math.PI, 0.4 * Math.PI, 5);
    for (let i = 0; i < 3; i++) if (!c.drop()) c.blob(150 - i * 25, 380 - i * 60, 14 + i * 4, 14 + i * 4, "#ffffff", 4, 12);
    if (!c.drop()) c.line([[100, 860], [110, 760], [90, 680]], 10, "#1f8a3a");
  } },
  { key: "flor", words: ["flor", "margarita", "girasol", "rosa", "primavera"], name: "Una flor", draw(c) {
    c.ground(760);
    c.line([[300, 760], [310, 600], [300, 470]], 12, "#1f8a3a");
    if (!c.drop()) c.blob(360, 620, 60, 25, "#4d7a12", 5);
    for (let i = 0; i < 7; i++) { if (c.drop()) continue; const t = (i / 7) * Math.PI * 2; c.blob(300 + Math.cos(t) * 85, 380 + Math.sin(t) * 85, 55, 55, "#ff8fb8", 6, 14); }
    c.blob(300, 380, 55, 55, "#ffd21f");
  } },
  { key: "coche", words: ["coche", "carrera", "atasco", "taxi", "descapotable"], name: "Un coche", draw(c) {
    c.shape([[-20, 640], [620, 640], [620, 920], [-20, 920]], "#8a8e99", 5);
    c.shape([[90, 560], [510, 560], [520, 470], [420, 460], [370, 390], [210, 390], [160, 460], [90, 470]], "#2563eb");
    if (!c.drop()) c.shape([[220, 410], [290, 410], [290, 460], [190, 460]], "#9fdcf7", 5);
    if (!c.drop()) c.shape([[310, 410], [360, 410], [395, 460], [310, 460]], "#9fdcf7", 5);
    c.blob(190, 580, 48, 48, INK, 5, 16); c.blob(410, 580, 48, 48, INK, 5, 16);
    if (!c.drop()) { c.dot(190, 580, 16, "#c7cad1"); c.dot(410, 580, 16, "#c7cad1"); }
  } },
  { key: "barco", words: ["barco", "velero", "pirata", "pescador", "barca", "puerto"], name: "Un barco de vela", draw(c) {
    c.shape([[-20, 620], [620, 610], [620, 920], [-20, 920]], "#3fc8ef", 5);
    c.shape([[130, 560], [470, 560], [420, 650], [180, 650]], "#8b5a2b");
    c.line([[300, 560], [300, 250]], 8);
    c.shape([[310, 260], [310, 530], [450, 530]], "#ffffff");
    if (!c.drop()) c.shape([[290, 300], [290, 530], [180, 530]], "#ff3b3b");
    if (!c.drop()) c.line([[60, 700], [110, 680], [160, 700]], 5, "#ffffff");
  } },
  { key: "cohete", words: ["cohete", "espacio", "astronauta", "nave", "luna", "planeta"], name: "Un cohete", draw(c) {
    c.shape([[-20, -20], [620, -20], [620, 920], [-20, 920]], "#1e2f7a", 4);
    for (let i = 0; i < 9; i++) if (!c.drop()) c.dot(40 + crypto.randomInt(520), 40 + crypto.randomInt(820), 5, "#fff27a");
    c.shape([[240, 620], [240, 360], [300, 230], [360, 360], [360, 620]], "#c7cad1");
    c.blob(300, 420, 40, 40, "#3fc8ef", 6);
    if (!c.drop()) c.shape([[240, 540], [180, 650], [240, 620]], "#ff3b3b");
    if (!c.drop()) c.shape([[360, 540], [420, 650], [360, 620]], "#ff3b3b");
    c.shape([[260, 630], [300, 760], [340, 630]], "#ffb000");
  } },
  { key: "montana", words: ["montaña", "volcán", "nieve", "esquí", "esquiador", "cima"], name: "Unas montañas nevadas", draw(c) {
    c.ground(720);
    c.shape([[40, 720], [230, 330], [420, 720]], "#8a8e99");
    c.shape([[230, 720], [420, 260], [600, 720]], "#4a4d57");
    if (!c.drop()) c.shape([[190, 410], [230, 330], [270, 410], [250, 430], [230, 410], [210, 430]], "#ffffff", 5);
    if (!c.drop()) c.shape([[375, 370], [420, 260], [465, 370], [440, 390], [420, 370], [400, 390]], "#ffffff", 5);
    if (!c.drop()) c.blob(120, 170, 50, 50, "#ffd21f", 6);
  } },
  { key: "tarta", words: ["tarta", "cumpleaños", "pastel", "fiesta"], name: "Una tarta de cumpleaños", draw(c) {
    c.blob(300, 690, 230, 45, "#c7cad1", 6);
    c.shape([[110, 520], [490, 520], [490, 680], [110, 680]], "#ff8fb8");
    c.shape([[110, 520], [490, 520], [490, 560], [430, 590], [370, 560], [300, 595], [230, 560], [170, 590], [110, 560]], "#ffffff", 6);
    for (const x of [200, 300, 400]) {
      if (c.drop()) continue;
      c.shape([[x - 12, 400], [x + 12, 400], [x + 12, 520], [x - 12, 520]], "#9fdcf7", 5);
      c.blob(x, 370, 16, 26, "#ffb000", 4, 12);
    }
  } },
  { key: "helado", words: ["helado", "cucurucho"], name: "Un helado", draw(c) {
    c.shape([[220, 470], [380, 470], [300, 780]], "#e0a458");
    if (!c.drop()) { c.line([[240, 520], [330, 690]], 4); c.line([[360, 520], [270, 690]], 4); }
    c.blob(300, 430, 95, 75, "#ff8fb8");
    if (!c.drop()) c.blob(300, 330, 80, 65, "#f1c9a5");
    if (!c.drop()) c.blob(300, 250, 60, 50, "#7a4a2b");
    if (!c.drop()) c.dot(300, 190, 16, "#ff3b3b");
  } },
  { key: "pajaro", words: ["pájaro", "búho", "loro", "pingüino", "pato", "paloma", "pollito", "gallina", "nido"], name: "Un pájaro", draw(c) {
    c.line([[60, 640], [540, 620]], 14, "#8b5a2b");
    c.blob(300, 500, 120, 100, "#3fc8ef");
    c.blob(380, 400, 70, 65, "#3fc8ef");
    c.dot(395, 390, 11);
    c.shape([[440, 400], [500, 415], [440, 430]], "#ffb000", 5);
    if (!c.drop()) c.blob(270, 500, 70, 40, "#2563eb", 6);
    if (!c.drop()) c.shape([[180, 480], [100, 440], [120, 520]], "#2563eb");
    if (!c.drop()) { c.line([[280, 595], [270, 630]], 6, "#ffb000"); c.line([[330, 595], [340, 630]], 6, "#ffb000"); }
  } },
  { key: "noche", words: ["noche", "estrella", "estrellas", "luna llena", "murciélago"], name: "Una noche de luna", draw(c) {
    c.shape([[-20, -20], [620, -20], [620, 920], [-20, 920]], "#1e2f7a", 4);
    c.blob(380, 260, 110, 110, "#fff27a");
    if (!c.drop()) c.blob(420, 230, 90, 90, "#1e2f7a", 1, 20);
    for (let i = 0; i < 10; i++) if (!c.drop()) c.dot(40 + crypto.randomInt(520), 60 + crypto.randomInt(600), 6, "#ffffff");
    c.shape([[-20, 720], [200, 650], [400, 700], [620, 640], [620, 920], [-20, 920]], "#0b4fa8", 5);
  } },
];
const PERSON = { key: "persona", words: [], name: "Una persona saludando", draw(c) {
  c.ground(760);
  c.blob(300, 300, 80, 85, "#f1c9a5");
  if (!c.drop()) c.shape([[220, 280], [235, 210], [300, 190], [365, 210], [380, 280], [340, 240], [260, 240]], "#5c3a1e", 6);
  c.dot(270, 295, 9); c.dot(330, 295, 9);
  smile(c, 300, 310, 38);
  c.shape([[230, 400], [370, 400], [390, 620], [210, 620]], pick(["#ff3b3b", "#2563eb", "#9b5de5", "#1f8a3a"]));
  c.line([[230, 420], [150, 330], [130, 260]], 12);
  if (!c.drop()) c.line([[370, 420], [440, 520]], 12);
  c.line([[260, 620], [250, 760]], 12); c.line([[340, 620], [350, 760]], 12);
} };

function subjectFor(text) {
  const t = String(text || "").toLowerCase();
  for (const s of SUBJECTS) if (s.words.some((w) => t.includes(w))) return s;
  return /\b(un|una|el|la|alguien)\b.*\b(niñ|abuel|señor|chica|chico|bailarina|futbolista|cocinero|médic|pintor|profesor|mago|pirata|bombero|astronauta|payaso)/.test(t) ? PERSON : null;
}
/** Dibuja un tema (por su clave o según una frase); level 0 = original, 1..3 = copias cada vez peores */
function draw({ text, key, level = 0 } = {}) {
  const s = (key && [...SUBJECTS, PERSON].find((x) => x.key === key)) || subjectFor(text) || pick(SUBJECTS);
  const c = makeCtx(Math.min(3, level));
  s.draw(c);
  return { key: s.key, name: s.name, url: "data:image/svg+xml;base64," + Buffer.from(c.svg()).toString("base64") };
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
module.exports = { draw, drawRule, subjectFor, SUBJECTS };
