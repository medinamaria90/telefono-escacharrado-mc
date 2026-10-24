// Kit de dibujo de los robots: ilustración "a rotulador" en SVG.
// Formas suaves con el pulso un poco tembloroso, contorno de tinta repasado, sombras y brillos
// recortados dentro de cada forma (así parecen ilustraciones, no figuras geométricas).
// Con `level` > 0 los dibujos salen peor: copias de memoria (temblor, desplazamiento, detalles olvidados).
const crypto = require("crypto");

const INK = "#1f1f24";
const PALETTE = {
  red: ["#e63946", "#d62839", "#ef4444"],
  orange: ["#ff7a1a", "#fb8c3c", "#f97316"],
  yellow: ["#ffd21f", "#facc15", "#ffcf33"],
  green: ["#2aa84a", "#38b25a", "#22a06b"],
  lime: ["#9be04a", "#a3e635", "#8fd14f"],
  teal: ["#2ec4b6", "#14b8a6", "#26b5a8"],
  sky: ["#9fdcf7", "#a5d8ff", "#93d5f5"],
  blue: ["#2563eb", "#3b82f6", "#2f6fe0"],
  navy: ["#1e2a5a", "#1f2d66", "#23305e"],
  purple: ["#9b5de5", "#8b5cf6", "#a06ae8"],
  pink: ["#ff8fb8", "#f9a8c9", "#ff9ec4"],
  brown: ["#8b5a2b", "#7c4a1e", "#956237"],
  tan: ["#d9a066", "#e0aa70", "#cf9658"],
  skin: ["#f1c9a5", "#e8b48a", "#c98e62", "#8d5a3b", "#f6d5b8"],
  gray: ["#9ca3af", "#a1a7b3", "#8f96a3"],
  white: ["#ffffff"],
  cream: ["#fff4dc", "#fdf0d5"],
  black: ["#1f1f24"],
};

function hexToRgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** Oscurece (amt < 0) o aclara (amt > 0) un color */
function tone(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return toHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return toHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Puntos -> camino suave (Catmull-Rom convertido a curvas de Bézier) */
function smoothPath(pts, closed) {
  const n = pts.length;
  if (n < 3) return "M" + pts.map((p) => p.join(" ")).join(" L") + (closed ? " Z" : "");
  const P = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + (closed ? " Z" : "");
}
const sharpPath = (pts, closed) => "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L") + (closed ? " Z" : "");

/**
 * Crea un lienzo de dibujo.
 * @param {object} o  { level: 0..3, w: 600, h: 900 }
 */
function makeKit(o = {}) {
  const level = Math.max(0, Math.min(3, o.level || 0));
  const W = o.w || 600, H = o.h || 900;
  // Dos azares: el del pulso (siempre distinto) y el de las decisiones del dibujo (colores, variantes…),
  // que se puede fijar con `seed` para repetir el mismo dibujo (p. ej. original y su copia de memoria)
  const rnd = () => crypto.randomInt(1_000_000) / 1_000_000;
  let sd = o.seed != null ? o.seed >>> 0 : null;
  const crnd = sd == null ? rnd : () => {
    sd = (sd + 0x6d2b79f5) >>> 0;
    let t = sd;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const R = (a, b) => a + (b - a) * crnd();
  const I = (a, b) => a + Math.floor(crnd() * (b - a + 1));
  const pick = (a) => a[Math.floor(crnd() * a.length)];
  const chance = (p) => crnd() < p;
  // Pulso: algo de temblor siempre (es a mano); mucho más en las copias de memoria
  const shake = 1.6 + level * 5;
  const shift = { x: (rnd() - 0.5) * level * 40, y: (rnd() - 0.5) * level * 40, s: 1 + (rnd() - 0.5) * level * 0.16, r: (rnd() - 0.5) * level * 0.06 };
  const cx0 = W / 2, cy0 = H / 2;
  const T = ([x, y]) => {
    const dx = (x - cx0) * shift.s, dy = (y - cy0) * shift.s;
    const cs = Math.cos(shift.r), sn = Math.sin(shift.r);
    return [cx0 + dx * cs - dy * sn + shift.x, cy0 + dx * sn + dy * cs + shift.y];
  };
  const J = (p, k = 1) => {
    const [x, y] = T(p);
    return [x + (rnd() - 0.5) * 2 * shake * k, y + (rnd() - 0.5) * 2 * shake * k];
  };
  // al copiar de memoria, a veces se olvidan detalles (más cuanto peor la copia)
  const drop = () => level > 0 && rnd() < level * 0.17;
  // colores: al copiar de memoria, a veces se cambian por otros parecidos
  const recolor = (c) => (level > 0 && c && c !== "none" && c[0] === "#" && rnd() < level * 0.15 ? tone(c, (rnd() - 0.5) * 0.5) : c);

  const defs = [];
  const out = [];
  let uid = 0;
  const id = (p) => `${p}${++uid}`;

  /** Densifica un polígono para que el temblor quede natural en tramos largos */
  function densify(pts, closed, step = 46) {
    const res = [];
    const n = pts.length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      res.push(a);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.floor(len / step);
      for (let t = 1; t < k; t++) res.push([a[0] + ((b[0] - a[0]) * t) / k, a[1] + ((b[1] - a[1]) * t) / k]);
    }
    if (!closed) res.push(pts[n - 1]);
    return res;
  }

  const kit = {
    W, H, level, INK, PALETTE, tone, R, I, pick, chance, drop,
    /** Un color de la paleta (con pequeñas variaciones) o el que se pase tal cual */
    col(name) {
      return PALETTE[name] ? pick(PALETTE[name]) : name;
    },
    /** Fondo entero */
    bg(color) {
      out.push(`<rect x="-20" y="-20" width="${W + 40}" height="${H + 40}" fill="${recolor(color)}"/>`);
    },
    /**
     * Forma o trazo.
     * opts: { closed=true, smooth=true, fill, stroke=INK, w=6, shade: 'r'|'l'|'b'|'t'|null, light: bool,
     *         opacity, dense=true, raw=false (sin temblor) }
     */
    path(pts, opts = {}) {
      const closed = opts.closed !== false;
      const smooth = opts.smooth !== false;
      let p = opts.dense === false ? pts : densify(pts, closed, smooth ? 60 : 40);
      p = opts.raw ? p.map(T) : p.map((q) => J(q, opts.k ?? 1));
      const d = smooth ? smoothPath(p, closed) : sharpPath(p, closed);
      const fill = closed ? recolor(opts.fill || "none") : "none";
      const w = opts.w ?? 6;
      const op = opts.opacity != null ? ` opacity="${opts.opacity}"` : "";
      if (closed && fill !== "none" && (opts.shade || opts.light)) {
        // sombra y brillo recortados dentro de la forma
        const cid = id("c");
        defs.push(`<clipPath id="${cid}"><path d="${d}"/></clipPath>`);
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
        if (opts.shade) {
          // media luna de sombra: la forma en oscuro y encima la misma forma, desplazada hacia la luz
          const k = opts.shadeK ?? 0.13;
          const off = { r: [-k * bw, 0], l: [k * bw, 0], b: [0, -k * bh], t: [0, k * bh], rb: [-k * bw * 0.8, -k * bh * 0.8] }[opts.shade] || [-k * bw, -k * bh * 0.6];
          out.push(`<path d="${d}" fill="${tone(fill, -0.2)}"${op}/>`);
          out.push(`<g clip-path="url(#${cid})"><path d="${d}" transform="translate(${off[0].toFixed(1)} ${off[1].toFixed(1)})" fill="${fill}"/></g>`);
        } else out.push(`<path d="${d}" fill="${fill}"${op}/>`);
        if (opts.light) {
          const lx = Math.min(...xs) + bw * 0.3, ly = Math.min(...ys) + bh * 0.24;
          out.push(`<g clip-path="url(#${cid})"><ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="${(bw * 0.16).toFixed(1)}" ry="${(bh * 0.09).toFixed(1)}" transform="rotate(-25 ${lx.toFixed(1)} ${ly.toFixed(1)})" fill="#fff" opacity=".45"/></g>`);
        }
        if (w > 0) {
          out.push(`<path d="${d}" fill="none" stroke="${opts.stroke || INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
          out.push(`<path d="${d}" fill="none" stroke="${opts.stroke || INK}" stroke-width="${(w * 0.4).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".5" transform="translate(1.5 -1)"/>`);
        }
        return kit;
      }
      const stroke = opts.stroke || INK;
      out.push(`<path d="${d}" fill="${fill}" stroke="${w > 0 ? recolor(stroke) : "none"}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op}${opts.dash ? ` stroke-dasharray="${opts.dash}"` : ""}/>`);
      return kit;
    },
    /** Línea (abierta) */
    line(pts, w = 6, color = INK, opts = {}) {
      return kit.path(pts, Object.assign({ closed: false, w, stroke: color }, opts));
    },
    /** Tubo con contorno (colas, brazos, tallos, cuerdas): trazo de tinta y encima el color */
    tube(pts, w, color, opts = {}) {
      const P = densify(pts, false, 50).map((q) => J(q, opts.k ?? 1));
      const d = smoothPath(P, false);
      const ow = opts.outline ?? 6;
      out.push(`<path d="${d}" fill="none" stroke="${opts.stroke || INK}" stroke-width="${w + ow * 2}" stroke-linecap="round" stroke-linejoin="round"/>`);
      out.push(`<path d="${d}" fill="none" stroke="${recolor(color)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`);
      return kit;
    },
    /** Elipse (rot en grados) */
    ellipse(cx, cy, rx, ry, opts = {}) {
      const n = opts.n || Math.max(10, Math.min(28, Math.round((rx + ry) / 9)));
      const rot = ((opts.rot || 0) * Math.PI) / 180;
      const pts = [];
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = Math.cos(t) * rx, y = Math.sin(t) * ry;
        pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
      }
      return kit.path(pts, Object.assign({ dense: false }, opts));
    },
    circle(cx, cy, r, opts = {}) {
      return kit.ellipse(cx, cy, r, r, opts);
    },
    /** Rectángulo con esquinas redondeadas */
    rect(x, y, w, h, opts = {}) {
      const r = Math.min(opts.r ?? 14, w / 2, h / 2);
      if (r < 2) return kit.path([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], Object.assign({ smooth: false }, opts));
      const pts = [];
      const corner = (cx, cy, a0) => {
        for (let i = 0; i <= 3; i++) {
          const t = a0 + (i / 3) * (Math.PI / 2);
          pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
        }
      };
      corner(x + w - r, y + r, -Math.PI / 2);
      corner(x + w - r, y + h - r, 0);
      corner(x + r, y + h - r, Math.PI / 2);
      corner(x + r, y + r, Math.PI);
      return kit.path(pts, Object.assign({ smooth: true }, opts));
    },
    /** Arco de circunferencia (abierto) */
    arc(cx, cy, r, a0, a1, w = 6, color = INK) {
      const pts = [];
      const n = Math.max(6, Math.round(Math.abs(a1 - a0) * 5));
      for (let i = 0; i <= n; i++) {
        const t = a0 + ((a1 - a0) * i) / n;
        pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
      }
      return kit.line(pts, w, color);
    },
    /** Punto relleno (sin contorno) */
    dot(cx, cy, r, color = INK) {
      const [x, y] = J([cx, cy], 0.3);
      out.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * (level ? shift.s : 1)).toFixed(1)}" fill="${recolor(color)}"/>`);
      return kit;
    },
    /** Ojo: blanco, pupila y brillo. look = [-1..1, -1..1] */
    eye(cx, cy, r, opts = {}) {
      if (opts.closed) return kit.arc(cx, cy - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI, Math.max(4, r * 0.28));
      const look = opts.look || [0, 0];
      kit.circle(cx, cy, r, { fill: "#fff", w: Math.max(3, r * 0.22) });
      const px = cx + look[0] * r * 0.35, py = cy + look[1] * r * 0.35;
      kit.dot(px, py, r * 0.52, opts.iris || INK);
      if (!drop()) kit.dot(px - r * 0.18, py - r * 0.2, r * 0.17, "#fff");
      return kit;
    },
    /** Boca: smile | open | o | flat | grin | sad */
    mouth(cx, cy, w, type = "smile") {
      if (type === "smile") return kit.arc(cx, cy - w * 0.45, w * 0.6, 0.18 * Math.PI, 0.82 * Math.PI, Math.max(4, w * 0.09));
      if (type === "sad") return kit.arc(cx, cy + w * 0.5, w * 0.6, 1.2 * Math.PI, 1.8 * Math.PI, Math.max(4, w * 0.09));
      if (type === "flat") return kit.line([[cx - w * 0.4, cy], [cx + w * 0.4, cy + 2]], Math.max(4, w * 0.09));
      if (type === "o") return kit.ellipse(cx, cy, w * 0.18, w * 0.24, { fill: "#7a1f2b", w: Math.max(3, w * 0.07) });
      if (type === "grin") {
        kit.path([[cx - w * 0.5, cy - w * 0.08], [cx + w * 0.5, cy - w * 0.08], [cx + w * 0.3, cy + w * 0.32], [cx - w * 0.3, cy + w * 0.32]], { fill: "#fff", w: Math.max(4, w * 0.08) });
        return kit.line([[cx - w * 0.45, cy + w * 0.08], [cx + w * 0.45, cy + w * 0.08]], Math.max(3, w * 0.05));
      }
      // open: boca abierta con lengua
      kit.path([[cx - w * 0.45, cy - w * 0.1], [cx + w * 0.45, cy - w * 0.1], [cx + w * 0.2, cy + w * 0.38], [cx - w * 0.2, cy + w * 0.38]], { fill: "#7a1f2b", w: Math.max(4, w * 0.08) });
      return kit.ellipse(cx, cy + w * 0.22, w * 0.2, w * 0.1, { fill: "#ff7b8f", w: 0 });
    },
    /** Coloretes */
    cheeks(x1, x2, y, r) {
      if (drop()) return kit;
      kit.ellipse(x1, y, r, r * 0.6, { fill: "#ff8fb8", w: 0, opacity: 0.6 });
      return kit.ellipse(x2, y, r, r * 0.6, { fill: "#ff8fb8", w: 0, opacity: 0.6 });
    },
    /** Suelo ondulado de lado a lado */
    ground(y, color = "#7ad19a", opts = {}) {
      const wave = opts.wave ?? 14;
      const pts = [[-30, y]];
      for (let x = 0; x <= W + 30; x += 75) pts.push([x, y + Math.sin(x / 90 + (opts.phase || 0)) * wave]);
      pts.push([W + 30, H + 30], [-30, H + 30]);
      return kit.path(pts, { fill: color, w: opts.w ?? 5, shade: opts.shade === false ? null : "b" });
    },
    /** Nube */
    cloud(x, y, s = 1) {
      if (drop()) return kit;
      const pts = [];
      const bumps = [[-60, 0, 38], [-25, -26, 42], [22, -30, 46], [62, -4, 36], [40, 22, 30], [-20, 24, 32]];
      for (const [bx, by, br] of bumps) for (let i = 0; i < 5; i++) { const t = (i / 5) * Math.PI * 2; pts.push([x + (bx + Math.cos(t) * br) * s, y + (by + Math.sin(t) * br) * s]); }
      // contorno convexo aproximado: elipse con bultos
      const outline = [];
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        const bump = 1 + 0.18 * Math.abs(Math.sin(t * 3));
        outline.push([x + Math.cos(t) * 95 * s * bump, y + Math.sin(t) * 48 * s * bump]);
      }
      return kit.path(outline, { fill: "#ffffff", w: 5, shade: "b" });
    },
    /** Estrellitas (para cielos de noche) */
    stars(n, area = [0, 0, W, H * 0.6], color = "#fff6c2") {
      for (let i = 0; i < n; i++) {
        const x = R(area[0], area[2]), y = R(area[1], area[3]), s = R(4, 9);
        kit.line([[x - s, y], [x + s, y]], 3, color, { raw: true });
        kit.line([[x, y - s], [x, y + s]], 3, color, { raw: true });
      }
      return kit;
    },
    /** Hierba en matas sobre una línea */
    grass(y, n = 8, color = "#2aa84a") {
      for (let i = 0; i < n; i++) {
        if (drop()) continue;
        const x = R(20, W - 20);
        kit.line([[x - 10, y - 18], [x, y + 4], [x + 3, y - 26], [x + 6, y + 4], [x + 16, y - 16]], 4, color, { smooth: false });
      }
      return kit;
    },
    /** Agrupa lo que se dibuje dentro con una transformación (rotar/escalar) */
    group(transform, fn) {
      out.push(`<g transform="${transform}">`);
      fn();
      out.push(`</g>`);
      return kit;
    },
    /** SVG listo */
    svg() {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs><rect width="${W}" height="${H}" fill="#fff"/>${out.join("")}</svg>`;
    },
  };
  return kit;
}

module.exports = { makeKit, tone, PALETTE, INK, smoothPath };
