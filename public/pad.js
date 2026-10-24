// Lienzo de dibujo: pincel, goma, relleno, mover, zoom, deshacer/rehacer.
(function () {
  const W = 600;
  // Textura de papel para la acuarela (se crea una sola vez)
  let grain = null;
  function paperGrain() {
    if (grain) return grain;
    const n = 192;
    grain = document.createElement("canvas");
    grain.width = grain.height = n;
    const g = grain.getContext("2d");
    // manchas suaves: el pigmento no se reparte igual
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * n, y = Math.random() * n, r = 8 + Math.random() * 28;
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, "rgba(0,0,0," + (0.08 + Math.random() * 0.12) + ")");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = rg;
      for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) {
        g.save();
        g.translate(dx, dy);
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    // grano fino del papel
    const img = g.getImageData(0, 0, n, n);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.pow(Math.random(), 3) * 110;
      d[i + 3] = Math.min(255, d[i + 3] + v);
    }
    g.putImageData(img, 0, 0);
    return grain;
  }
  const H = 900;
  const MAX_UNDO = 20;
  const ZOOMS = [1, 1.5, 2, 3, 4];

  function hexToRgba(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  /** Grosor real de cada herramienta */
  function widthFor(tool, size) {
    if (tool === "marker") return Math.max(6, size * 1.6);
    if (tool === "water") return Math.max(8, size * 1.5);
    return size;
  }
  const isVeilColor = (c) => {
    const [r, g, b] = hexToRgba(c);
    return r >= 235 && g >= 235 && b >= 235;
  };
  /** Acuarela: bordes irregulares, cerco de pigmento y grano del papel, en la zona del trazo.
   *  Pinta en tx y devuelve esa zona [x, y, ancho, alto] (o null). */
  function paintWet(tx, pts, color, w, layers) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      if (p.x < x0) x0 = p.x;
      if (p.y < y0) y0 = p.y;
      if (p.x > x1) x1 = p.x;
      if (p.y > y1) y1 = p.y;
    }
    const m = w * 1.2 + 4;
    const bx = Math.max(0, Math.floor(x0 - m)), by = Math.max(0, Math.floor(y0 - m));
    const bw = Math.min(W, Math.ceil(x1 + m)) - bx, bh = Math.min(H, Math.ceil(y1 + m)) - by;
    if (!(bw > 0 && bh > 0)) return null;
    tx.save();
    tx.globalCompositeOperation = "source-over";
    tx.globalAlpha = 1;
    tx.clearRect(bx, by, bw, bh);
    tx.lineCap = tx.lineJoin = "round";
    tx.strokeStyle = color;
    layers.forEach((L, i) => {
      const amp = w * L.amp;
      let dist = 0;
      tx.beginPath();
      pts.forEach((p, j) => {
        if (j) dist += Math.hypot(p.x - pts[j - 1].x, p.y - pts[j - 1].y);
        const ox = amp * (Math.sin(dist / (w * 0.9) + L.p1) + 0.5 * Math.sin(dist / (w * 0.35) + L.p2));
        const oy = amp * (Math.cos(dist / (w * 0.8) + L.p3) + 0.5 * Math.sin(dist / (w * 0.4) + L.p1));
        if (j) tx.lineTo(p.x + ox, p.y + oy);
        else tx.moveTo(p.x + ox, p.y + oy);
      });
      if (pts.length === 1) tx.lineTo(pts[0].x + 0.1, pts[0].y);
      tx.lineWidth = w * L.k;
      tx.globalAlpha = L.a;
      // la última capa aclara el centro: queda más pigmento en el borde
      if (i === layers.length - 1) tx.globalCompositeOperation = "destination-out";
      tx.stroke();
    });
    // grano del papel y manchas de pigmento
    tx.globalCompositeOperation = "destination-out";
    tx.globalAlpha = 0.85;
    tx.fillStyle = tx.createPattern(paperGrain(), "repeat");
    tx.fillRect(bx, by, bw, bh);
    tx.restore();
    return [bx, by, bw, bh];
  }
  // Formas geométricas: se arrastra de una esquina a la contraria
  const SHAPES = ["line", "rect", "ellipse", "tri"];
  function drawGeom(ctx, kind, a, b, color, size, rotated) {
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    if (kind === "line") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    } else if (kind === "rect") ctx.rect(x, y, Math.max(w, 1), Math.max(h, 1));
    else if (kind === "ellipse") ctx.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
    else if (kind === "tri" && rotated) {
      // lienzo horizontal (girado por dentro): «arriba» en pantalla es el lado derecho del lienzo interno
      const tipX = b.x <= a.x ? x + w : x, baseX = b.x <= a.x ? x : x + w;
      ctx.moveTo(tipX, y + h / 2);
      ctx.lineTo(baseX, y + h);
      ctx.lineTo(baseX, y);
      ctx.closePath();
    } else if (kind === "tri") {
      // la punta hacia donde se empezó a arrastrar (arriba o abajo)
      const tipY = b.y >= a.y ? y : y + h, baseY = b.y >= a.y ? y + h : y;
      ctx.moveTo(x + w / 2, tipY);
      ctx.lineTo(x + w, baseY);
      ctx.lineTo(x, baseY);
      ctx.closePath();
    }
    ctx.stroke();
    ctx.restore();
  }
  function tempCanvas(owner, key) {
    const t = owner[key] || (owner[key] = document.createElement("canvas"));
    if (t.width !== W || t.height !== H) {
      t.width = W;
      t.height = H;
    }
    return t;
  }

  class Pad {
    constructor(host, opts = {}) {
      this.host = host;
      this.onChange = opts.onChange || (() => {});
      this.onStroke = opts.onStroke || (() => {});
      this.onOrient = opts.onOrient || (() => {});
      // Lienzo compartido (por parejas): cada trazo propio se manda como operaciones
      this.onOp = opts.onOp || (() => {});
      this.shared = false;
      this.remote = {}; // trazos a medias de los compañeros
      // Historial compartido (por parejas): cada trazo, de quien sea, en orden. Deshacer quita
      // solo los propios: se marcan como quitados (en los dos móviles) y se redibuja todo.
      this.selfId = null;
      this.hist = [];
      this._cur = null; // trazo propio en curso
      this._rcur = {}; // trazo en curso de cada compañero
      this._sredo = [];
      this._kpre = Math.random().toString(36).slice(2, 7);
      this._kn = 0;
      this.blank = true; // lienzo sin tocar: su orientación sigue a la del móvil
      this.screenLandscape = false;
      this.forcePortrait = false; // p. ej. al dibujar la carita: siempre vertical
      this.forceLandscape = false; // Tríptico: siempre una franja horizontal
      this.fillClip = null; // {cx, cy, r}: el cubo no pasa de este círculo (carita)
      this.lockRects = []; // zonas donde no se puede pintar (Tríptico: la franja de la parte anterior)
      this.fillWalls = []; // líneas que el cubo no cruza (Tríptico: la línea de unión)
      this.rule = null; // dibujo extremo: "circles" | "squares" | "oneline"
      this.lineUsed = false;
      this.onBlocked = opts.onBlocked || (() => {});
      this.stage = document.createElement("div");
      this.stage.className = "pad-stage";
      this.inner = document.createElement("div");
      this.inner.className = "pad-inner";
      this.canvas = document.createElement("canvas");
      this.canvas.width = W;
      this.canvas.height = H;
      this.canvas.className = "pad-canvas";
      this.inner.appendChild(this.canvas);
      // Guía (Tríptico): la unión con la parte anterior; se ve pero no forma parte del dibujo
      this.guide = document.createElement("canvas");
      this.guide.width = W;
      this.guide.height = H;
      this.guide.className = "pad-guide";
      this.guide.hidden = true;
      this.inner.appendChild(this.guide);
      // Capa del rotulador: el trazo se ve aquí y al soltar se funde con el dibujo
      this.over = document.createElement("canvas");
      this.over.width = W;
      this.over.height = H;
      this.over.className = "pad-over";
      this.inner.appendChild(this.over);
      this.octx = this.over.getContext("2d");
      this.stage.appendChild(this.inner);
      host.appendChild(this.stage);
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });

      this.tool = "pen";
      this.color = "#1b1b1f";
      this.size = 8;
      this.zoom = 1;
      this.undoStack = [];
      this.redoStack = [];
      this.pointers = new Map();
      this.stroke = null;
      this.gesture = null;
      this.pan = null;
      this.dirty = false;

      this.clear(false);
      this._bind();
      this._ro = new ResizeObserver(() => this.layout());
      this._ro.observe(this.stage);
    }

    // ---- orientación ----
    // Por dentro el lienzo siempre mide 600x900. Un dibujo horizontal se guarda girado
    // ahí dentro (rotated) y se enseña tumbado; al enviarlo se endereza (900x600).
    // Mientras el lienzo está en blanco sigue la orientación del móvil; desde el primer
    // trazo, el dibujo se queda con la suya aunque se gire el móvil.
    get orient() {
      return this.rotated ? "h" : "v";
    }
    setScreenLandscape(l) {
      this.screenLandscape = !!l;
      if (this.forcePortrait) return this._setRotated(false);
      if (this.forceLandscape) return this._setRotated(true);
      if (this.blank && this.userOrient == null) this._setRotated(this.screenLandscape);
      this.onOrient(this.rotated !== this.screenLandscape);
    }
    /** El jugador elige el lienzo (vertical u horizontal); si ya había dibujo, se empieza de cero */
    setOrient(h) {
      if (this.forcePortrait) return;
      this.userOrient = !!h;
      if (!this.blank) this.clear(true);
      this._setRotated(this.userOrient);
      this.dirty = false;
      this.onChange();
    }
    _setRotated(r) {
      r = !!r;
      if (r === !!this.rotated) return;
      this.rotated = r;
      // Lo deshecho se pintó en la otra orientación: ya no vale
      this.undoStack = [];
      this.redoStack = [];
      this.zoom = 1;
      this.layout();
      this.stage.scrollLeft = 0;
      this.stage.scrollTop = 0;
      this.onChange();
    }

    // ---- tamaño y zoom ----
    baseWidth() {
      const sw = this.stage.clientWidth - 2;
      const sh = this.stage.clientHeight - 2;
      // ancho del lienzo (en su orientación vertical) que cabe en pantalla
      if (this.rotated) return Math.max(80, Math.min(sh, (sw * W) / H));
      return Math.max(120, Math.min(sw, (sh * W) / H));
    }
    // El lienzo se coloca con una traslación propia (tx, ty) dentro de su zona: así el zoom y el
    // desplazamiento funcionan igual en todos los navegadores (Safari ignora el scroll durante un pellizco).
    layout(keepCenter) {
      const before = keepCenter || this._center();
      const a = this.baseWidth() * this.zoom; // ancho del lienzo vertical
      const b = (a * H) / W; // alto del lienzo vertical
      for (const c of [this.canvas, this.guide, this.over]) {
        c.style.position = "absolute";
        c.style.left = "0";
        c.style.top = "0";
        c.style.width = a + "px";
        c.style.height = b + "px";
        c.style.transformOrigin = "0 0";
        c.style.transform = this.rotated ? `translateY(${a}px) rotate(-90deg)` : "";
      }
      this.iw = this.rotated ? b : a;
      this.ih = this.rotated ? a : b;
      this.inner.style.width = this.iw + "px";
      this.inner.style.height = this.ih + "px";
      if (before && this.zoom > 1.001) {
        this.tx = before.sx - before.fx * this.iw;
        this.ty = before.sy - before.fy * this.ih;
      } else {
        // sin zoom: centrado
        this.tx = (this.stage.clientWidth - this.iw) / 2;
        this.ty = (this.stage.clientHeight - this.ih) / 2;
      }
      this._place();
    }
    /** Coloca el lienzo; no deja que se vaya del todo fuera de la vista */
    _place() {
      const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
      // se puede salir un poco por los lados (así el punto bajo los dedos no se mueve), pero nunca perderse
      const clamp = (v, size, room) => {
        const extra = size * 0.35;
        return Math.min(Math.max(v, Math.min(0, room - size) - extra), Math.max(0, room - size) + extra);
      };
      this.tx = clamp(this.tx || 0, this.iw || 0, sw);
      this.ty = clamp(this.ty || 0, this.ih || 0, sh);
      this.inner.style.transform = `translate(${this.tx}px, ${this.ty}px)`;
    }
    _panBy(dx, dy) {
      this.tx = (this.tx || 0) + dx;
      this.ty = (this.ty || 0) + dy;
      this._place();
    }
    _center() {
      if (!this.iw) return null;
      const sw = this.stage.clientWidth, sh = this.stage.clientHeight;
      return { fx: (sw / 2 - this.tx) / this.iw, fy: (sh / 2 - this.ty) / this.ih, sx: sw / 2, sy: sh / 2 };
    }
    setZoom(z, anchor) {
      z = Math.max(1, Math.min(5, z));
      if (Math.abs(z - this.zoom) < 0.001) return;
      let keep;
      if (anchor && this.iw) {
        // Mantener fijo el punto bajo los dedos / el ratón
        const r = this.stage.getBoundingClientRect();
        const sx = anchor.x - r.left;
        const sy = anchor.y - r.top;
        keep = { fx: (sx - this.tx) / this.iw, fy: (sy - this.ty) / this.ih, sx, sy };
      }
      this.zoom = z;
      this.layout(keep);
      this.onChange();
    }
    zoomIn() {
      this.setZoom(ZOOMS.find((z) => z > this.zoom + 0.01) ?? 5);
    }
    zoomOut() {
      this.setZoom([...ZOOMS].reverse().find((z) => z < this.zoom - 0.01) ?? 1);
    }

    // ---- historial ----
    _snapshot() {
      this.blank = false;
      this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
    }
    /** Por parejas: último trazo propio que se puede quitar */
    _lastOwn() {
      for (let i = this.hist.length - 1; i >= 0; i--) {
        const h = this.hist[i];
        if (h.from === this.selfId && !h.undone && h !== this._cur) return h;
      }
      return null;
    }
    undo() {
      if (this.shared) {
        const h = this._lastOwn();
        if (!h) return;
        h.undone = true;
        this._sredo.push(h.k);
        this.onOp({ t: "u", k: h.k });
        this._rerender();
        this.dirty = true;
        return this.onChange();
      }
      if (!this.undoStack.length) return;
      this.redoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.undoStack.pop(), 0, 0);
      this.dirty = true;
      this.blank = false;
      if (this.rule === "oneline") this.lineUsed = this.undoStack.length > 0;
      this.onChange();
    }
    redo() {
      if (this.shared) {
        const k = this._sredo.pop();
        const h = k && this.hist.find((x) => x.k === k);
        if (!h) return this.onChange();
        h.undone = false;
        this.onOp({ t: "r", k });
        this._rerender();
        this.dirty = true;
        return this.onChange();
      }
      if (!this.redoStack.length) return;
      this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.redoStack.pop(), 0, 0);
      this.dirty = true;
      this.blank = false;
      this.onChange();
    }
    clear(record = true) {
      if (record) this._snapshot();
      if (record && this.shared) this._out({ t: "c", k: this._key() });
      this.ctx.save();
      this.ctx.globalCompositeOperation = "source-over";
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(0, 0, W, H);
      this.ctx.restore();
      if (record) this.dirty = true;
      this.blank = true;
      this.lineUsed = false;
      // Lienzo vacío otra vez: vuelve a seguir la orientación del móvil
      const want = this.userOrient != null ? this.userOrient : this.screenLandscape;
      if (record && !this.forcePortrait && !this.forceLandscape && !!this.rotated !== want) {
        this._setRotated(want);
        this.onOrient(false);
      }
      this.onChange();
    }
    reset() {
      if (this.octx) this.octx.clearRect(0, 0, W, H);
      this.undoStack = [];
      this.redoStack = [];
      this.hist = [];
      this._cur = null;
      this._rcur = {};
      this._sredo = [];
      this.remote = {};
      this.clear(false);
      this.dirty = false;
      this.blank = true;
      this.userOrient = null;
      this.rotated = this.forcePortrait ? false : this.forceLandscape ? true : this.screenLandscape;
      this.zoom = 1;
      this.tool = "pen";
      this.layout();
      this.stage.scrollLeft = 0;
      this.stage.scrollTop = 0;
      this.onChange();
    }
    /**
     * Tríptico: guía de unión, dibujada en coordenadas de pantalla (franja de 900x600).
     * top = imagen de la parte anterior (se ve solo su franja de abajo, arriba del lienzo);
     * bottom = marcar abajo la zona que verá el siguiente.
     */
    setGuide(opts) {
      const g = this.guide.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      this.guide.hidden = !opts;
      if (!opts) return;
      const VW = H, VH = W, BAND = Math.round(VH * 0.15); // franja visible: 900x600, unión de 90 px
      const v = document.createElement("canvas");
      v.width = VW;
      v.height = VH;
      const x = v.getContext("2d");
      const paint = () => {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, W, H);
        if (this.rotated) {
          g.translate(W, 0);
          g.rotate(Math.PI / 2);
          g.drawImage(v, 0, 0, H, W);
          g.setTransform(1, 0, 0, 1, 0, 0);
        } else g.drawImage(v, 0, 0, W, H);
      };
      const FONT = '"Atkinson Hyperlegible", system-ui, sans-serif';
      if (opts.bottom) {
        // Franja de abajo: es TUYA y sigue hasta el borde (lo que verá el siguiente)
        const y0 = VH - BAND;
        const gr = x.createLinearGradient(0, y0, 0, VH);
        gr.addColorStop(0, "rgba(255,90,60,.04)");
        gr.addColorStop(1, "rgba(255,90,60,.18)");
        x.fillStyle = gr;
        x.fillRect(0, y0, VW, BAND);
        x.save();
        x.setLineDash([3, 9]);
        x.lineCap = "round";
        x.lineWidth = 2;
        x.strokeStyle = "rgba(255,90,60,.45)";
        x.beginPath();
        x.moveTo(0, y0);
        x.lineTo(VW, y0);
        x.stroke();
        x.restore();
        x.fillStyle = "#ff5a3c";
        x.fillRect(0, VH - 6, VW, 6); // la meta: el borde de abajo
        // flechitas hacia abajo
        x.save();
        x.strokeStyle = "rgba(255,90,60,.22)";
        x.lineWidth = 4;
        x.lineCap = "round";
        for (const cx of [75, 825]) {
          for (const dy of [0, 18]) {
            x.beginPath();
            x.moveTo(cx - 14, y0 + 30 + dy);
            x.lineTo(cx, y0 + 42 + dy);
            x.lineTo(cx + 14, y0 + 30 + dy);
            x.stroke();
          }
        }
        x.restore();
        x.textAlign = "center";
        x.fillStyle = "rgba(255,90,60,.95)";
        x.font = `700 30px ${FONT}`;
        x.fillText(opts.bottom, VW / 2, y0 + 44);
        x.font = `700 20px ${FONT}`;
        x.fillStyle = "rgba(255,90,60,.6)";
        x.fillText("👀 esto lo verá el siguiente", VW / 2, y0 + 72);
      }
      if (opts.top) {
        const im = new Image();
        im.onload = () => {
          // de la parte anterior, solo su franja de abajo (bloqueada: gris y rayada)
          const sh = im.naturalHeight * 0.15;
          x.globalAlpha = 0.55;
          x.drawImage(im, 0, im.naturalHeight - sh, im.naturalWidth, sh, 0, 0, VW, BAND);
          x.globalAlpha = 1;
          x.save();
          x.beginPath();
          x.rect(0, 0, VW, BAND);
          x.clip();
          x.strokeStyle = "rgba(40,50,70,.09)";
          x.lineWidth = 2;
          for (let k = -BAND; k < VW; k += 12) {
            x.beginPath();
            x.moveTo(k, BAND);
            x.lineTo(k + BAND, 0);
            x.stroke();
          }
          x.restore();
          x.strokeStyle = "rgba(40,50,70,.35)";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(0, BAND);
          x.lineTo(VW, BAND);
          x.stroke();
          x.font = `700 22px ${FONT}`;
          x.textAlign = "left";
          x.fillStyle = "rgba(40,50,70,.55)";
          x.fillText("🔒", 12, 30);
          x.textAlign = "center";
          x.font = `700 24px ${FONT}`;
          x.fillText(opts.topLabel || "", VW / 2, BAND + 32);
          paint();
        };
        im.src = opts.top;
      }
      paint();
    }
    /** ¿Hay algo dibujado en este rectángulo (coordenadas de pantalla)? */
    inkIn(vx, vy, vw, vh) {
      try {
        const r = this.visualRect(vx, vy, vw, vh);
        const d = this.ctx.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 40 && d[i] + d[i + 1] + d[i + 2] < 720) n++;
        return n > 6;
      } catch (_) {
        return true;
      }
    }
    /** Rectángulo en coordenadas de pantalla (franja visible) -> coordenadas internas del lienzo */
    visualRect(vx, vy, vw, vh) {
      if (this.rotated) return { x: W - (vy + vh), y: vx, w: vh, h: vw };
      return { x: vx, y: vy, w: vw, h: vh };
    }
    /**
     * Tríptico: zonas bloqueadas (no se pinta en ellas: se recorta todo lo que se dibuje) y paredes
     * para el cubo de pintura. Coordenadas internas.
     */
    setLock(locked, walls) {
      this.lockRects = locked || [];
      this.fillWalls = walls || [];
      for (const c of [this.ctx, this.octx]) {
        if (c._lockSaved) {
          c.restore();
          c._lockSaved = false;
        }
        if (this.lockRects.length) {
          c.save();
          c.beginPath();
          c.rect(0, 0, W, H);
          for (const r of this.lockRects) c.rect(r.x, r.y, r.w, r.h);
          c.clip("evenodd");
          c._lockSaved = true;
        }
      }
    }
    /** Carga una imagen guardada como punto de partida (para editar) */
    loadImage(src, done) {
      const img = new Image();
      img.onload = () => {
        this.reset();
        const landscape = img.naturalWidth > img.naturalHeight;
        this.rotated = landscape;
        this.layout();
        if (landscape) {
          // Dibujo horizontal: se guarda girado dentro del lienzo vertical
          this.ctx.save();
          this.ctx.translate(W, 0);
          this.ctx.rotate(Math.PI / 2);
          this.ctx.drawImage(img, 0, 0, H, W);
          this.ctx.restore();
        } else this.ctx.drawImage(img, 0, 0, W, H);
        this.dirty = false;
        this.blank = false;
        this.onOrient(this.rotated !== this.screenLandscape);
        this.onChange();
        done && done(true);
      };
      img.onerror = () => done && done(false);
      img.src = src;
    }
    /** Dibujo extremo: limita cómo se puede dibujar */
    setRule(rule) {
      this.rule = rule || null;
      this.lineUsed = false;
      if (this.rule && this.tool !== "fill") this.tool = "pen";
      if (this.rule === "oneline" && this.tool === "fill") this.tool = "pen";
      this.onChange();
    }
    _shapePath(ctx, a, b) {
      ctx.beginPath();
      if (this.rule === "circles") {
        const r = Math.max(2, Math.hypot(b.x - a.x, b.y - a.y));
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
      } else {
        const side = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 2);
        const x = b.x < a.x ? a.x - side : a.x;
        const y = b.y < a.y ? a.y - side : a.y;
        ctx.rect(x, y, side, side);
      }
    }
    _drawShape(ctx, a, b) {
      if (this.shape && this.shape.kind) return drawGeom(ctx, this.shape.kind, a, b, this.color, this.size, this.rotated);
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.size;
      ctx.lineJoin = "round";
      this._shapePath(ctx, a, b);
      ctx.stroke();
      ctx.restore();
    }
    canUndo() {
      if (this.shared) return !!this._lastOwn();
      return this.undoStack.length > 0;
    }
    canRedo() {
      if (this.shared) return this._sredo.length > 0;
      return this.redoStack.length > 0;
    }
    /** Imagen tal y como la ve quien dibuja: vertical (600x900) u horizontal (900x600) */
    toDataURL(type = "image/png", quality) {
      if (!this.rotated) return this.canvas.toDataURL(type, quality);
      const out = document.createElement("canvas");
      out.width = H;
      out.height = W;
      const c = out.getContext("2d");
      c.translate(0, W);
      c.rotate(-Math.PI / 2);
      c.drawImage(this.canvas, 0, 0);
      return out.toDataURL(type, quality);
    }

    // ---- entrada ----
    _pt(e) {
      const r = this.inner.getBoundingClientRect();
      const rx = e.clientX - r.left;
      const ry = e.clientY - r.top;
      if (this.rotated) return { x: ((r.height - ry) * W) / r.height, y: (rx * H) / r.width };
      return { x: (rx * W) / r.width, y: (ry * H) / r.height };
    }
    _bind() {
      const c = this.stage;
      c.addEventListener("pointerdown", (e) => this._down(e));
      c.addEventListener("pointermove", (e) => this._move(e));
      c.addEventListener("pointerup", (e) => this._up(e));
      c.addEventListener("pointercancel", (e) => this._up(e, true));
      c.addEventListener("lostpointercapture", (e) => this.pointers.has(e.pointerId) && this._up(e));
      c.addEventListener(
        "wheel",
        (e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.setZoom(this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX, y: e.clientY });
          }
        },
        { passive: false }
      );
      c.addEventListener("contextmenu", (e) => e.preventDefault());
      // iPad/iPhone: el toque sobre el lienzo es solo para dibujar. Sin esto, mantener el dedo
      // activa los gestos de Safari (selección azul, lupa, resaltar la imagen). Los eventos de
      // puntero, que son los que dibujan, siguen llegando igual.
      const stopTouch = (e) => {
        if (e.cancelable) e.preventDefault();
      };
      c.addEventListener("touchstart", stopTouch, { passive: false });
      c.addEventListener("touchmove", stopTouch, { passive: false });
    }
    _down(e) {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      // Apple Pencil: mientras el lápiz toca (y un momento después), la palma apoyada no cuenta
      if (e.pointerType === "pen") this.penDownAt = Date.now();
      if (this.penDown && !this.pointers.size) this.penDown = false; // por si se perdió el «soltar» del lápiz
      if (e.pointerType === "touch" && (this.penDown || Date.now() - (this.penUpAt || 0) < 600)) return;
      if (e.pointerType === "pen") this.penDown = true;
      try {
        this.stage.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2) {
        this.pendingFill = null;
        // Dos dedos: cancelar el trazo y pasar a mover/ampliar
        if (this.shape) {
          this.octx.clearRect(0, 0, W, H);
          const snap = this.undoStack.pop();
          this.shape = null;
          if (this.shared) this._rerender();
          else this.ctx.putImageData(snap, 0, 0);
          this.onStroke("end");
        }
        if (this.stroke) {
          clearInterval(this.sprayTimer);
          this.octx.clearRect(0, 0, W, H);
          const snap = this.undoStack.pop();
          const st = this.stroke;
          this.stroke = null;
          if (this.shared && this._cur) {
            const h = this._cur;
            this._cur = null;
            if (st.buf) this.hist.splice(this.hist.indexOf(h), 1); // aún no se había mandado: fuera sin más
            else {
              // ya lo estaba viendo el compañero: se cierra y se quita en los dos
              h.ops.push({ t: "e" });
              h.undone = true;
              this.onOp({ t: "e" });
              this.onOp({ t: "u", k: h.k });
            }
            this._rerender();
          } else this.ctx.putImageData(snap, 0, 0);
          this.onStroke("end");
          this.onChange();
        }
        this.pan = null;
        const [a, b] = [...this.pointers.values()];
        this.gesture = {
          dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          zoom: this.zoom,
          mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
        return;
      }
      if (this.pointers.size > 2) return;

      const middle = e.pointerType === "mouse" && e.button === 1;
      if (this.tool === "hand" || middle) {
        this.pan = { x: e.clientX, y: e.clientY };
        return;
      }
      const p = this._pt(e);
      if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) {
        if (this.tool !== "fill") {
          // Empezar fuera del lienzo también vale (se dibuja al entrar)
        } else return;
      }
      if (this.tool === "fill") {
        // El cubo pinta al soltar, y solo si ha sido un toque (no un pellizco)
        if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return;
        this.pendingFill = { id: e.pointerId, p, cx: e.clientX, cy: e.clientY };
        return;
      }
      if (this.rule === "oneline" && this.lineUsed) {
        this.onBlocked("oneline");
        return;
      }
      if (!this.rule && SHAPES.includes(this.tool)) {
        // Línea o figura: se arrastra; se ve tal cual quedará
        this._snapshot();
        this.over.style.opacity = "1";
        this.over.style.mixBlendMode = "normal";
        this.shape = { a: p, b: p, kind: this.tool };
        this.dirty = true;
        this.onStroke("start", "pen");
        return;
      }
      if (this.rule === "circles" || this.rule === "squares") {
        // Solo círculos / cuadrados: se arrastra para darle tamaño
        this._snapshot();
        this.shape = { a: p, b: p };
        this.dirty = true;
        this.onStroke("start", "pen");
        return;
      }
      this._snapshot();
      // acuarela: lo que se ve mientras pintas es ya el resultado final
      // el blanco no mezcla (multiplicar no aclara): hace de velo lechoso que aclara un poco
      const veil = this._isVeil();
      this.over.style.opacity = this.tool === "water" ? (veil ? ".5" : ".85") : "";
      this.over.style.mixBlendMode = veil ? "normal" : "";
      this.stroke = { last: p, lastMid: p, t: performance.now(), pts: [p] };
      if (this.tool === "spray") {
        this._spray(p, 1);
        clearInterval(this.sprayTimer);
        this.sprayTimer = setInterval(() => this.stroke && this._spray(this.stroke.last, 0.35), 45);
      } else if (this.tool === "water") {
        this.stroke.wet = this._wetLayers();
        this._wetRender();
      } else this._dot(p);
      if (this.shared) {
        // Se retiene un momento: si resulta ser un pellizco (dos dedos), no se manda
        const st = this.stroke;
        const op = { t: "s", tool: this.tool, c: this.color, z: this.size, x: p.x, y: p.y, w: st.wet, k: this._key() };
        this._rec(op);
        st.buf = [op];
        setTimeout(() => this.stroke === st && this._flushHeld(), 140);
      }
      this.onStroke("start", this.tool);
      this.dirty = true;
    }
    _move(e) {
      if (!this.pointers.has(e.pointerId)) return;
      e.preventDefault();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.gesture && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.setZoom(this.gesture.zoom * (dist / this.gesture.dist), mid);
        this._panBy(mid.x - this.gesture.mid.x, mid.y - this.gesture.mid.y);
        this.gesture.mid = mid;
        return;
      }
      if (this.pendingFill && this.pendingFill.id === e.pointerId && Math.hypot(e.clientX - this.pendingFill.cx, e.clientY - this.pendingFill.cy) > 12) {
        this.pendingFill = null;
      }
      if (this.pan) {
        this._panBy(e.clientX - this.pan.x, e.clientY - this.pan.y);
        this.pan = { x: e.clientX, y: e.clientY };
        return;
      }
      if (this.shape) {
        this.shape.b = this._pt(e);
        this.octx.clearRect(0, 0, W, H);
        this._drawShape(this.octx, this.shape.a, this.shape.b);
        this.onStroke("move", 0.6);
        return;
      }
      if (!this.stroke) return;
      const from = this.stroke.last;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = this._pt(ev);
        if (this.shared) {
          const op = { t: "m", p: [p.x, p.y] };
          this._rec(op);
          this._emit(op);
        }
        if (this.tool === "spray") {
          // rociar a lo largo del recorrido
          const d = Math.hypot(p.x - this.stroke.last.x, p.y - this.stroke.last.y);
          const step = Math.max(2, this.size * 0.25);
          for (let t = step; t <= d; t += step) {
            this._spray({ x: this.stroke.last.x + ((p.x - this.stroke.last.x) * t) / d, y: this.stroke.last.y + ((p.y - this.stroke.last.y) * t) / d }, 0.5);
          }
          this._spray(p, 0.5);
          this.stroke.last = p;
          this.stroke.lastMid = p;
          continue;
        }
        if (this.tool === "water") {
          this.stroke.pts.push(p);
          this.stroke.last = p;
          this._wetSchedule();
          continue;
        }
        const mid = { x: (this.stroke.last.x + p.x) / 2, y: (this.stroke.last.y + p.y) / 2 };
        const ctx = this._soft() ? this.octx : this.ctx;
        this._style(ctx);
        ctx.beginPath();
        ctx.moveTo(this.stroke.lastMid.x, this.stroke.lastMid.y);
        ctx.quadraticCurveTo(this.stroke.last.x, this.stroke.last.y, mid.x, mid.y);
        ctx.stroke();
        this.stroke.last = p;
        this.stroke.lastMid = mid;
      }
      const now = performance.now();
      const dist = Math.hypot(this.stroke.last.x - from.x, this.stroke.last.y - from.y);
      this.onStroke("move", dist / Math.max(4, now - this.stroke.t));
      this.stroke.t = now;
    }
    _up(e, cancelled) {
      if (!this.pointers.has(e.pointerId)) return; // un toque ignorado (la palma)
      if (e.pointerType === "pen") {
        this.penDown = false;
        this.penUpAt = Date.now();
      }
      this.pointers.delete(e.pointerId);
      const pf = this.pendingFill;
      if (pf && pf.id === e.pointerId) {
        this.pendingFill = null;
        if (!cancelled && this.pointers.size === 0 && !this.gesture) {
          this._snapshot();
          this.floodFill(Math.floor(pf.p.x), Math.floor(pf.p.y), this.color);
          if (this.shared) this._out({ t: "f", x: Math.floor(pf.p.x), y: Math.floor(pf.p.y), c: this.color, k: this._key() });
          this.dirty = true;
          this.onStroke("fill");
          this.onChange();
        }
      }
      if (this.shape) {
        this.octx.clearRect(0, 0, W, H);
        this._drawShape(this.ctx, this.shape.a, this.shape.b);
        const sh = this.shape;
        if (this.shared && sh.kind) this._out({ t: "g", kind: sh.kind, x1: sh.a.x, y1: sh.a.y, x2: sh.b.x, y2: sh.b.y, c: this.color, z: this.size, k: this._key() });
        this.shape = null;
        this.onStroke("end");
        this.onChange();
      }
      if (this.stroke && this.rule === "oneline") this.lineUsed = true;
      if (this.stroke && this.shared) {
        this._flushHeld();
        this._rec({ t: "e" });
        this.onOp({ t: "e" });
      }
      if (this.stroke && this.tool === "spray") {
        clearInterval(this.sprayTimer);
        this.stroke = null;
        this.onStroke("end");
        this.onChange();
      }
      if (this.stroke) {
        const s = this.stroke;
        if (this.tool !== "water") {
          const c = this._soft() ? this.octx : this.ctx;
          this._style(c);
          c.beginPath();
          c.moveTo(s.lastMid.x, s.lastMid.y);
          c.lineTo(s.last.x, s.last.y);
          c.stroke();
        }
        if (this._soft()) this._commitMarker();
        this.stroke = null;
        this.onStroke("end");
        this.onChange();
      }
      if (this.pointers.size < 2) this.gesture = null;
      if (this.pointers.size === 0) this.pan = null;
    }
    // ---- lienzo compartido ----
    _key() {
      return this._kpre + "-" + ++this._kn;
    }
    /** Anota un trozo propio en el historial compartido */
    _rec(op) {
      if (op.t === "s" || op.t === "f" || op.t === "c" || op.t === "g") {
        const h = { k: op.k, from: this.selfId, ops: [op], undone: false };
        this.hist.push(h);
        this._sredo = []; // algo nuevo: ya no se puede rehacer lo quitado
        if (op.t === "s") this._cur = h;
      } else if (this._cur) {
        this._cur.ops.push(op);
        if (op.t === "e") this._cur = null;
      }
    }
    /** Anota y manda (trazos de un solo golpe: relleno, borrar todo, figura) */
    _out(op) {
      this._rec(op);
      this.onOp(op);
    }
    _emit(op) {
      if (this.stroke && this.stroke.buf) this.stroke.buf.push(op);
      else this.onOp(op);
    }
    _flushHeld() {
      const st = this.stroke;
      if (!st || !st.buf) return;
      const buf = st.buf;
      st.buf = null;
      buf.forEach((op) => this.onOp(op));
    }
    /** Redibuja el lienzo desde el historial (sin lo quitado) */
    _rerender() {
      const ctx = this.ctx;
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.remote = {};
      for (const h of this.hist) if (!h.undone) this._drawOps(h.from, h.ops);
    }
    /** Pinta lo que mandan los compañeros (cada uno con su trazo a medias) y lo anota */
    applyRemote(from, ops) {
      let redraw = false;
      for (const op of ops) {
        if (op.t === "u" || op.t === "r") {
          const h = this.hist.find((x) => x.k === op.k);
          if (h) {
            h.undone = op.t === "u";
            redraw = true;
          }
          continue;
        }
        if (op.t === "s" || op.t === "f" || op.t === "c" || op.t === "g") {
          const h = { k: op.k || "x" + this._kn++, from, ops: [op], undone: false };
          this.hist.push(h);
          if (op.t === "s") this._rcur[from] = h;
        } else if (this._rcur[from]) {
          this._rcur[from].ops.push(op);
          if (op.t === "e") delete this._rcur[from];
        }
        if (!redraw) this._drawOps(from, [op]);
      }
      if (redraw) this._rerender();
      this.blank = false;
      this.dirty = true;
      this.onChange();
    }
    _drawOps(from, ops) {
      const ctx = this.ctx;
      for (const op of ops) {
        if (op.t === "s") {
          const r = { tool: op.tool, color: op.c, size: op.z, wet: op.w, pts: [{ x: op.x, y: op.y }], last: { x: op.x, y: op.y }, lastMid: { x: op.x, y: op.y } };
          this.remote[from] = r;
          if (r.tool === "pen" || r.tool === "eraser") {
            ctx.save();
            ctx.globalCompositeOperation = "source-over";
            ctx.fillStyle = r.tool === "eraser" ? "#ffffff" : r.color;
            ctx.beginPath();
            ctx.arc(op.x, op.y, widthFor(r.tool, r.size) / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else if (r.tool === "spray") this._spray(r.last, 1, r.color, r.size);
        } else if (op.t === "m") {
          const r = this.remote[from];
          if (!r) continue;
          for (let i = 0; i + 1 < op.p.length; i += 2) {
            const p = { x: op.p[i], y: op.p[i + 1] };
            if (r.tool === "pen" || r.tool === "eraser") {
              const mid = { x: (r.last.x + p.x) / 2, y: (r.last.y + p.y) / 2 };
              ctx.save();
              ctx.globalCompositeOperation = "source-over";
              ctx.strokeStyle = r.tool === "eraser" ? "#ffffff" : r.color;
              ctx.lineWidth = widthFor(r.tool, r.size);
              ctx.lineCap = ctx.lineJoin = "round";
              ctx.beginPath();
              ctx.moveTo(r.lastMid.x, r.lastMid.y);
              ctx.quadraticCurveTo(r.last.x, r.last.y, mid.x, mid.y);
              ctx.stroke();
              ctx.restore();
              r.lastMid = mid;
            } else if (r.tool === "spray") {
              const d = Math.hypot(p.x - r.last.x, p.y - r.last.y);
              const step = Math.max(2, r.size * 0.25);
              for (let t = step; t <= d; t += step) this._spray({ x: r.last.x + ((p.x - r.last.x) * t) / d, y: r.last.y + ((p.y - r.last.y) * t) / d }, 0.5, r.color, r.size);
              this._spray(p, 0.5, r.color, r.size);
            } else r.pts.push(p);
            r.last = p;
          }
        } else if (op.t === "e") {
          const r = this.remote[from];
          if (!r) continue;
          delete this.remote[from];
          if (r.tool === "pen" || r.tool === "eraser") {
            ctx.save();
            ctx.strokeStyle = r.tool === "eraser" ? "#ffffff" : r.color;
            ctx.lineWidth = widthFor(r.tool, r.size);
            ctx.lineCap = ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(r.lastMid.x, r.lastMid.y);
            ctx.lineTo(r.last.x, r.last.y);
            ctx.stroke();
            ctx.restore();
          } else if (r.tool === "marker" || r.tool === "water") {
            // subrayador y acuarela del compañero: aparecen al soltar, con el mismo aspecto
            const t = tempCanvas(this, "_remoteCanvas");
            const tx = t.getContext("2d");
            let box;
            const w = widthFor(r.tool, r.size);
            if (r.tool === "water") box = paintWet(tx, r.pts, r.color, w, r.wet || this._wetLayers());
            else {
              tx.clearRect(0, 0, W, H);
              tx.save();
              tx.strokeStyle = tx.fillStyle = r.color;
              tx.lineWidth = w;
              tx.lineCap = tx.lineJoin = "round";
              tx.beginPath();
              r.pts.forEach((p, j) => (j ? tx.lineTo(p.x, p.y) : tx.moveTo(p.x, p.y)));
              if (r.pts.length === 1) tx.lineTo(r.pts[0].x + 0.1, r.pts[0].y);
              tx.stroke();
              tx.restore();
              box = [0, 0, W, H];
            }
            if (box) {
              const veil = r.tool === "water" && isVeilColor(r.color);
              ctx.save();
              ctx.globalAlpha = r.tool === "marker" ? 0.5 : veil ? 0.5 : 0.85;
              ctx.globalCompositeOperation = veil ? "source-over" : "multiply";
              ctx.drawImage(t, box[0], box[1], box[2], box[3], box[0], box[1], box[2], box[3]);
              ctx.restore();
            }
          }
        } else if (op.t === "g") {
          drawGeom(ctx, op.kind, { x: op.x1, y: op.y1 }, { x: op.x2, y: op.y2 }, op.c, op.z);
        } else if (op.t === "f") {
          this.floodFill(Math.floor(op.x), Math.floor(op.y), op.c);
        } else if (op.t === "c") {
          ctx.save();
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
          this.remote = {};
        }
      }
    }

    /** Subrayador y acuarela se pintan primero en la capa de encima y luego se funden, transparentes */
    _soft() {
      return this.tool === "marker" || this.tool === "water";
    }
    _width() {
      return widthFor(this.tool, this.size);
    }
    _style(ctx = this.ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = this.tool === "eraser" ? "#ffffff" : this.color;
      ctx.lineWidth = this._width();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    _spray(p, amount, color = this.color, size = this.size) {
      const ctx = this.ctx;
      const r = Math.max(9, size * 1.2);
      const n = Math.round((5 + size * 0.9) * amount);
      const dot = Math.max(2, Math.round(size / 9));
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = color;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        // más denso en el centro, como un aerosol de verdad
        const rr = r * Math.pow(Math.random(), 0.8);
        ctx.fillRect(Math.round(p.x + Math.cos(a) * rr), Math.round(p.y + Math.sin(a) * rr), dot, dot);
      }
    }
    _dot(p) {
      const ctx = this._soft() ? this.octx : this.ctx;
      this._style(ctx);
      ctx.fillStyle = this.tool === "eraser" ? "#ffffff" : this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this._width() / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    _commitMarker() {
      if (this.tool === "water") return this._commitWater();
      // Semitransparente y en modo "multiplicar": deja ver las líneas de debajo
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(this.over, 0, 0);
      ctx.restore();
      this.octx.clearRect(0, 0, W, H);
    }
    /** Acuarela: cada trazo tiene su propio temblor (fijo, para que no parpadee al pintar) */
    _wetLayers() {
      const r = () => Math.random() * 6.3;
      // [temblor, grosor, opacidad] de cada capa; la última aclara el centro
      return [[0.16, 1.0, 0.5], [0.2, 0.85, 0.45], [0.12, 1.12, 0.3], [0.08, 0.6, 0.35], [0.1, 0.5, 0.22]].map(([amp, k, a]) => ({ amp, k, a, p1: r(), p2: r(), p3: r() }));
    }
    /** Redibuja la acuarela mientras se pinta, sin pasarse: como mucho unas 30 veces por segundo */
    _wetSchedule() {
      if (this._wetRaf) return;
      const wait = Math.max(0, (this._wetNext || 0) - performance.now());
      this._wetRaf = setTimeout(() => {
        requestAnimationFrame(() => {
          this._wetRaf = null;
          if (this.stroke && this.tool === "water") this._wetRender();
        });
      }, wait);
    }
    /** Bordes irregulares, cerco de pigmento y grano del papel; solo en la zona del trazo */
    _wetRender() {
      const t0 = performance.now();
      const st = this.stroke;
      const t = tempCanvas(this, "_wetCanvas");
      const box = paintWet(t.getContext("2d"), st.pts, this.color, this._width(), st.wet);
      if (!box) return;
      const [bx, by, bw, bh] = box;
      // a la capa de encima (se ve igual que quedará)
      this.octx.clearRect(bx, by, bw, bh);
      this.octx.drawImage(t, bx, by, bw, bh, bx, by, bw, bh);
      // si el móvil va justo, se redibuja menos a menudo
      const took = performance.now() - t0;
      this._wetNext = performance.now() + Math.min(150, Math.max(33, took * 3));
    }
    /** Acuarela blanca (o casi): aclara en vez de mezclar */
    _isVeil() {
      return this.tool === "water" && isVeilColor(this.color);
    }
    _commitWater() {
      clearTimeout(this._wetRaf);
      this._wetRaf = null;
      if (this.stroke && this.stroke.wet) this._wetRender();
      const veil = this._isVeil();
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = veil ? 0.5 : 0.85;
      ctx.globalCompositeOperation = veil ? "source-over" : "multiply";
      ctx.drawImage(this.over, 0, 0);
      ctx.restore();
      this.octx.clearRect(0, 0, W, H);
    }

    // ---- relleno por zonas (cubo de pintura) ----
    floodFill(x0, y0, hex) {
      const img = this.ctx.getImageData(0, 0, W, H);
      const d = img.data;
      const [fr, fg, fb] = hexToRgba(hex);
      const i0 = (y0 * W + x0) * 4;
      const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
      if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 6) return;
      const TOL = 70; // suma de diferencias por canal
      const diff = (i) => Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb);
      const mask = new Uint8Array(W * H);
      // Zonas bloqueadas y líneas de unión (Tríptico): cuentan como borde
      for (const r of [...this.lockRects, ...this.fillWalls]) {
        const xa = Math.max(0, Math.floor(r.x)), xb = Math.min(W, Math.ceil(r.x + r.w));
        const ya = Math.max(0, Math.floor(r.y)), yb = Math.min(H, Math.ceil(r.y + r.h));
        for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) mask[y * W + x] = 2;
      }
      if (mask[y0 * W + x0]) return;
      // Fuera del círculo de la carita cuenta como borde: el relleno no lo cruza
      const clip = this.fillClip;
      if (clip) {
        if ((x0 - clip.cx) ** 2 + (y0 - clip.cy) ** 2 > clip.r * clip.r) return;
        const r2 = clip.r * clip.r;
        for (let y = 0; y < H; y++) {
          const dy = (y - clip.cy) ** 2;
          for (let x = 0; x < W; x++) if ((x - clip.cx) ** 2 + dy > r2) mask[y * W + x] = 2;
        }
      }
      const stack = [x0, y0];
      while (stack.length) {
        const y = stack.pop();
        let x = stack.pop();
        let p = y * W + x;
        while (x >= 0 && !mask[p] && diff(p * 4) <= TOL) {
          x--;
          p--;
        }
        x++;
        p++;
        let up = false;
        let down = false;
        while (x < W && !mask[p] && diff(p * 4) <= TOL) {
          mask[p] = 1;
          if (y > 0) {
            const q = p - W;
            const ok = !mask[q] && diff(q * 4) <= TOL;
            if (ok && !up) {
              stack.push(x, y - 1);
              up = true;
            } else if (!ok) up = false;
          }
          if (y < H - 1) {
            const q = p + W;
            const ok = !mask[q] && diff(q * 4) <= TOL;
            if (ok && !down) {
              stack.push(x, y + 1);
              down = true;
            } else if (!ok) down = false;
          }
          x++;
          p++;
        }
      }
      // Ampliar 1 px sobre los bordes suavizados para que no quede halo
      const paint = new Uint8Array(W * H);
      for (let p = 0; p < W * H; p++) paint[p] = mask[p] === 1 ? 1 : 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (mask[p]) continue;
          if ((x > 0 && mask[p - 1] === 1) || (x < W - 1 && mask[p + 1] === 1) || (y > 0 && mask[p - W] === 1) || (y < H - 1 && mask[p + W] === 1)) {
            if (diff(p * 4) < 420) paint[p] = 1;
          }
        }
      }
      for (let p = 0; p < W * H; p++) {
        if (!paint[p]) continue;
        const i = p * 4;
        d[i] = fr;
        d[i + 1] = fg;
        d[i + 2] = fb;
        d[i + 3] = 255;
      }
      this.ctx.putImageData(img, 0, 0);
    }
  }

  window.Pad = Pad;
})();
