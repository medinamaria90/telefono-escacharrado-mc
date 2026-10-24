/* Dibulíos · ¿Cuánto se parece tu dibujo al original?
 *
 * Se compara en el propio móvil, con varios criterios (de 0 a 1) que luego se combinan:
 *  - forma:       distancia media entre los trazos de uno y otro, tras encuadrar cada dibujo
 *                 (no importa si lo hiciste un poco más grande o movido)
 *  - coincidencia: cuánto de lo tuyo cae cerca de lo original y cuánto del original has cubierto
 *  - composición: dónde está cada cosa en la hoja (rejilla de densidad), sin encuadrar
 *  - situación:   posición y tamaño del dibujo en la hoja
 *  - colores:     reparto de colores (fondo incluido)
 *  - cantidad:    si has dibujado «lo mismo de mucho» (ni un garabato ni pintarlo todo)
 * «Tinta» es todo lo que se separa del color de fondo de cada dibujo (el del borde), así da igual
 * que el original tenga fondo de color y tú no lo pintes: eso solo cuenta en «colores».
 */
(function () {
  const GW = 120, GH = 180; // resolución de análisis (2:3 como el lienzo)
  const N = 96; // lado de la rejilla encuadrada para la forma

  function rasterize(src) {
    const c = document.createElement("canvas");
    c.width = GW;
    c.height = GH;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#fff";
    x.fillRect(0, 0, GW, GH);
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    // encaja sin deformar (si viniera con otra proporción)
    const k = Math.min(GW / w, GH / h);
    x.imageSmoothingQuality = "high";
    x.drawImage(src, (GW - w * k) / 2, (GH - h * k) / 2, w * k, h * k);
    return x.getImageData(0, 0, GW, GH).data;
  }
  function bgColor(d) {
    const count = new Map();
    const add = (i) => {
      const key = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const o = count.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      o.n++; o.r += d[i]; o.g += d[i + 1]; o.b += d[i + 2];
      count.set(key, o);
    };
    for (let x = 0; x < GW; x++) { add(x * 4); add(((GH - 1) * GW + x) * 4); }
    for (let y = 0; y < GH; y++) { add(y * GW * 4); add((y * GW + GW - 1) * 4); }
    let best = null;
    for (const o of count.values()) if (!best || o.n > best.n) best = o;
    return [best.r / best.n, best.g / best.n, best.b / best.n];
  }
  function inkMask(d, bg) {
    const m = new Uint8Array(GW * GH);
    let n = 0;
    for (let p = 0, i = 0; p < GW * GH; p++, i += 4) {
      const dist = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
      if (dist > 70) { m[p] = 1; n++; }
    }
    return { m, n };
  }
  /** Bordes: donde el color cambia de golpe (contornos y límites entre colores). Es la «estructura» del dibujo */
  function edgeMask(d) {
    const m = new Uint8Array(GW * GH);
    const diff = (i, j) => Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
    for (let y = 0; y < GH - 1; y++) for (let x = 0; x < GW - 1; x++) {
      const i = (y * GW + x) * 4;
      if (Math.max(diff(i, i + 4), diff(i, i + GW * 4), diff(i, i + GW * 4 + 4)) > 110) m[y * GW + x] = 1;
    }
    return m;
  }
  function bbox(m, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  /** La tinta, recortada a su caja y llevada a una rejilla N×N (sin deformar) */
  function normalize(m, bb) {
    const out = new Uint8Array(N * N);
    const s = Math.max(bb.w, bb.h) / (N - 8);
    const ox = (N - bb.w / s) / 2, oy = (N - bb.h / s) / 2;
    for (let y = bb.y0; y <= bb.y1; y++) for (let x = bb.x0; x <= bb.x1; x++) if (m[y * GW + x]) {
      const nx = Math.floor((x - bb.x0) / s + ox), ny = Math.floor((y - bb.y0) / s + oy);
      if (nx >= 0 && ny >= 0 && nx < N && ny < N) out[ny * N + nx] = 1;
    }
    return out;
  }
  /** Distancia (en casillas) de cada casilla a la tinta más cercana: transformada de distancia 3-4 */
  function distField(m, w, h) {
    const INF = 1e9, D = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) D[i] = m[i] ? 0 : INF;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + 3);
      if (y > 0) { v = Math.min(v, D[i - w] + 3); if (x > 0) v = Math.min(v, D[i - w - 1] + 4); if (x < w - 1) v = Math.min(v, D[i - w + 1] + 4); }
      D[i] = v;
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x; let v = D[i];
      if (x < w - 1) v = Math.min(v, D[i + 1] + 3);
      if (y < h - 1) { v = Math.min(v, D[i + w] + 3); if (x < w - 1) v = Math.min(v, D[i + w + 1] + 4); if (x > 0) v = Math.min(v, D[i + w - 1] + 4); }
      D[i] = v;
    }
    for (let i = 0; i < w * h; i++) D[i] /= 3;
    return D;
  }
  /** Media de la distancia de la tinta de A a la tinta de B (recortada para que un borrón no lo domine) */
  function meanDist(mA, DB, cap) {
    let s = 0, n = 0;
    for (let i = 0; i < mA.length; i++) if (mA[i]) { s += Math.min(cap, DB[i]); n++; }
    return n ? s / n : cap;
  }
  /** Parte de A que cae a menos de r de B */
  function within(mA, DB, r) {
    let a = 0, n = 0;
    for (let i = 0; i < mA.length; i++) if (mA[i]) { n++; if (DB[i] <= r) a++; }
    return n ? a / n : 0;
  }
  function densityGrid(m, gx, gy) {
    const g = new Float32Array(gx * gy);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (m[y * GW + x]) g[Math.floor((y * gy) / GH) * gx + Math.floor((x * gx) / GW)]++;
    return g;
  }
  function cosine(a, b) {
    let ab = 0, aa = 0, bb = 0;
    for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
    return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
  }
  /** Histograma de color: 12 tonos × 2 luces + blanco, gris y negro */
  function colorHist(d) {
    const h = new Float32Array(27);
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, c = mx - mn;
      if (c < 0.12) { h[l > 0.85 ? 24 : l < 0.25 ? 26 : 25]++; continue; }
      let hue = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
      hue = (hue * 60 + 360) % 360;
      h[Math.floor(hue / 30) * 2 + (l > 0.6 ? 1 : 0)]++;
    }
    const tot = d.length / 4;
    for (let i = 0; i < h.length; i++) h[i] /= tot;
    return h;
  }
  /** Parecido entre histogramas, dejando que un tono se confunda con su vecino (rojo/naranja…) */
  function colorSim(a, b) {
    const blur = (h) => {
      const o = new Float32Array(h.length);
      for (let t = 0; t < 12; t++) for (let l = 0; l < 2; l++) {
        const v = h[t * 2 + l];
        o[t * 2 + l] += v * 0.6;
        o[((t + 1) % 12) * 2 + l] += v * 0.2;
        o[((t + 11) % 12) * 2 + l] += v * 0.2;
      }
      for (let i = 24; i < 27; i++) o[i] = h[i];
      return o;
    };
    const A = blur(a), B = blur(b);
    let s = 0;
    for (let i = 0; i < A.length; i++) s += Math.min(A[i], B[i]);
    return s;
  }
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  /**
   * Compara el dibujo del jugador con el original. Devuelve { score: 0..100, parts: {forma, composicion, colores, detalle} }.
   * `opts.weights` permite ajustar el peso de cada criterio.
   */
  function compare(original, copy, opts = {}) {
    const dA = rasterize(original), dB = rasterize(copy);
    const bgA = bgColor(dA), bgB = bgColor(dB);
    const A = inkMask(dA, bgA), B = inkMask(dB, bgB);
    const total = GW * GH;
    const empty = { score: 0, parts: { forma: 0, composicion: 0, colores: 0, detalle: 0 }, raw: {} };
    if (B.n < total * 0.002 || A.n < total * 0.002) return empty; // en blanco
    const bbA = bbox(A.m, GW, GH), bbB = bbox(B.m, GW, GH);
    // --- forma (encuadrada): se comparan los BORDES (contornos), no las manchas de color ---
    const eA = edgeMask(dA), eB = edgeMask(dB);
    const nA = normalize(eA, bbA), nB = normalize(eB, bbB);
    const DnA = distField(nA, N, N), DnB = distField(nB, N, N);
    const dAB = meanDist(nA, DnB, 24), dBA = meanDist(nB, DnA, 24);
    const shape = Math.exp(-(0.6 * Math.max(dAB, dBA) + 0.4 * Math.min(dAB, dBA)) / 3.6);
    // --- coincidencia con tolerancia (encuadrada) ---
    const prec = within(nB, DnA, 2.5), rec = within(nA, DnB, 2.5);
    const overlap = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
    // --- composición: densidad en rejilla 6×9, sin encuadrar ---
    const layout = clamp01(cosine(densityGrid(A.m, 6, 9), densityGrid(B.m, 6, 9)));
    // --- situación: centro y tamaño de la caja ---
    const cA = [(bbA.x0 + bbA.x1) / 2 / GW, (bbA.y0 + bbA.y1) / 2 / GH], cB = [(bbB.x0 + bbB.x1) / 2 / GW, (bbB.y0 + bbB.y1) / 2 / GH];
    const dc = Math.hypot(cA[0] - cB[0], cA[1] - cB[1]);
    const sA = Math.sqrt((bbA.w * bbA.h) / total), sB = Math.sqrt((bbB.w * bbB.h) / total);
    const place = Math.exp(-dc / 0.22) * (Math.min(sA, sB) / Math.max(sA, sB)) ** 0.7;
    // --- colores ---
    const color = clamp01(colorSim(colorHist(dA), colorHist(dB)));
    // --- cantidad de tinta ---
    const amount = Math.min(A.n, B.n) / Math.max(A.n, B.n);

    const w = Object.assign({ shape: 0.3, overlap: 0.2, layout: 0.15, color: 0.17, place: 0.1, amount: 0.08 }, opts.weights || {});
    const raw = shape * w.shape + overlap * w.overlap + layout * w.layout + color * w.color + place * w.place + amount * w.amount;
    const wsum = w.shape + w.overlap + w.layout + w.color + w.place + w.amount;
    // Curva: por debajo de lo que saca un garabato cualquiera es 0; un dibujo idéntico, 100
    const floor = opts.floor ?? 0.36, gamma = opts.gamma ?? 0.85;
    const score = Math.round(100 * clamp01((raw / wsum - floor) / (1 - floor)) ** gamma);
    const pct = (v) => Math.round(100 * clamp01(v));
    return {
      score,
      parts: {
        forma: pct((shape * w.shape + overlap * w.overlap) / (w.shape + w.overlap)),
        composicion: pct((layout * w.layout + place * w.place) / (w.layout + w.place)),
        colores: pct(color),
        detalle: pct(amount),
      },
      raw: { shape, overlap, layout, place, color, amount, total: raw / wsum },
    };
  }

  window.Similarity = { compare };
})();
