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

  class Pad {
    constructor(host, opts = {}) {
      this.host = host;
      this.onChange = opts.onChange || (() => {});
      this.onStroke = opts.onStroke || (() => {});
      this.onOrient = opts.onOrient || (() => {});
      this.blank = true; // lienzo sin tocar: su orientación sigue a la del móvil
      this.screenLandscape = false;
      this.forcePortrait = false; // p. ej. al dibujar la carita: siempre vertical
      this.fillClip = null; // {cx, cy, r}: el cubo no pasa de este círculo (carita)
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
    layout(keepCenter) {
      const before = keepCenter || this._center();
      const a = this.baseWidth() * this.zoom; // ancho del lienzo vertical
      const b = (a * H) / W; // alto del lienzo vertical
      for (const c of [this.canvas, this.over]) {
        c.style.position = "absolute";
        c.style.left = "0";
        c.style.top = "0";
        c.style.width = a + "px";
        c.style.height = b + "px";
        c.style.transformOrigin = "0 0";
        c.style.transform = this.rotated ? `translateY(${a}px) rotate(-90deg)` : "";
      }
      this.inner.style.width = (this.rotated ? b : a) + "px";
      this.inner.style.height = (this.rotated ? a : b) + "px";
      this._restoreCenter(before);
    }
    _center() {
      const s = this.stage;
      const cw = this.inner.offsetWidth || 1;
      const ch = this.inner.offsetHeight || 1;
      return {
        fx: (s.scrollLeft + s.clientWidth / 2 - this.inner.offsetLeft) / cw,
        fy: (s.scrollTop + s.clientHeight / 2 - this.inner.offsetTop) / ch,
        sx: s.clientWidth / 2,
        sy: s.clientHeight / 2,
      };
    }
    _restoreCenter(c) {
      if (!c) return;
      const s = this.stage;
      s.scrollLeft = this.inner.offsetLeft + c.fx * this.inner.offsetWidth - c.sx;
      s.scrollTop = this.inner.offsetTop + c.fy * this.inner.offsetHeight - c.sy;
    }
    setZoom(z, anchor) {
      z = Math.max(1, Math.min(5, z));
      if (Math.abs(z - this.zoom) < 0.001) return;
      let keep;
      if (anchor) {
        // Mantener fijo el punto bajo los dedos / el ratón
        const r = this.stage.getBoundingClientRect();
        const sx = anchor.x - r.left;
        const sy = anchor.y - r.top;
        keep = {
          fx: (this.stage.scrollLeft + sx - this.inner.offsetLeft) / this.inner.offsetWidth,
          fy: (this.stage.scrollTop + sy - this.inner.offsetTop) / this.inner.offsetHeight,
          sx,
          sy,
        };
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
    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.undoStack.pop(), 0, 0);
      this.dirty = true;
      this.blank = false;
      if (this.rule === "oneline") this.lineUsed = this.undoStack.length > 0;
      this.onChange();
    }
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.redoStack.pop(), 0, 0);
      this.dirty = true;
      this.blank = false;
      this.onChange();
    }
    clear(record = true) {
      if (record) this._snapshot();
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
      if (record && !this.forcePortrait && !!this.rotated !== want) {
        this._setRotated(want);
        this.onOrient(false);
      }
      this.onChange();
    }
    reset() {
      if (this.octx) this.octx.clearRect(0, 0, W, H);
      this.undoStack = [];
      this.redoStack = [];
      this.clear(false);
      this.dirty = false;
      this.blank = true;
      this.userOrient = null;
      this.rotated = this.forcePortrait ? false : this.screenLandscape;
      this.zoom = 1;
      this.tool = "pen";
      this.layout();
      this.stage.scrollLeft = 0;
      this.stage.scrollTop = 0;
      this.onChange();
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
      return this.undoStack.length > 0;
    }
    canRedo() {
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
    }
    _down(e) {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
      e.preventDefault();
      try {
        this.stage.setPointerCapture(e.pointerId);
      } catch (_) {}
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2) {
        this.pendingFill = null;
        // Dos dedos: cancelar el trazo y pasar a mover/ampliar
        if (this.shape) {
          this.octx.clearRect(0, 0, W, H);
          this.ctx.putImageData(this.undoStack.pop(), 0, 0);
          this.shape = null;
          this.onStroke("end");
        }
        if (this.stroke) {
          clearInterval(this.sprayTimer);
          this.octx.clearRect(0, 0, W, H);
          this.ctx.putImageData(this.undoStack.pop(), 0, 0);
          this.stroke = null;
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
      this.over.style.opacity = this.tool === "water" ? ".85" : "";
      this.stroke = { last: p, lastMid: p, t: performance.now(), pts: [p] };
      if (this.tool === "spray") {
        this._spray(p, 1);
        clearInterval(this.sprayTimer);
        this.sprayTimer = setInterval(() => this.stroke && this._spray(this.stroke.last, 0.35), 45);
      } else if (this.tool === "water") {
        this.stroke.wet = this._wetLayers();
        this._wetRender();
      } else this._dot(p);
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
        this.stage.scrollLeft -= mid.x - this.gesture.mid.x;
        this.stage.scrollTop -= mid.y - this.gesture.mid.y;
        this.gesture.mid = mid;
        return;
      }
      if (this.pendingFill && this.pendingFill.id === e.pointerId && Math.hypot(e.clientX - this.pendingFill.cx, e.clientY - this.pendingFill.cy) > 12) {
        this.pendingFill = null;
      }
      if (this.pan) {
        this.stage.scrollLeft -= e.clientX - this.pan.x;
        this.stage.scrollTop -= e.clientY - this.pan.y;
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
      this.pointers.delete(e.pointerId);
      const pf = this.pendingFill;
      if (pf && pf.id === e.pointerId) {
        this.pendingFill = null;
        if (!cancelled && this.pointers.size === 0 && !this.gesture) {
          this._snapshot();
          this.floodFill(Math.floor(pf.p.x), Math.floor(pf.p.y), this.color);
          this.dirty = true;
          this.onStroke("fill");
          this.onChange();
        }
      }
      if (this.shape) {
        this.octx.clearRect(0, 0, W, H);
        this._drawShape(this.ctx, this.shape.a, this.shape.b);
        this.shape = null;
        this.onStroke("end");
        this.onChange();
      }
      if (this.stroke && this.rule === "oneline") this.lineUsed = true;
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
    /** Subrayador y acuarela se pintan primero en la capa de encima y luego se funden, transparentes */
    _soft() {
      return this.tool === "marker" || this.tool === "water";
    }
    _width() {
      if (this.tool === "marker") return Math.max(6, this.size * 1.6);
      if (this.tool === "water") return Math.max(8, this.size * 1.5);
      return this.size;
    }
    _style(ctx = this.ctx) {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = this.tool === "eraser" ? "#ffffff" : this.color;
      ctx.lineWidth = this._width();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    _spray(p, amount) {
      const ctx = this.ctx;
      const r = Math.max(9, this.size * 1.2);
      const n = Math.round((5 + this.size * 0.9) * amount);
      const dot = Math.max(2, Math.round(this.size / 9));
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = this.color;
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
      const pts = st.pts;
      const w = this._width();
      const t = this._wetCanvas || (this._wetCanvas = document.createElement("canvas"));
      if (t.width !== W || t.height !== H) {
        t.width = W;
        t.height = H;
      }
      const tx = t.getContext("2d");
      // zona que ocupa el trazo (con margen para el temblor)
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
      if (bw <= 0 || bh <= 0) return;
      tx.save();
      tx.globalCompositeOperation = "source-over";
      tx.globalAlpha = 1;
      tx.clearRect(bx, by, bw, bh);
      tx.lineCap = tx.lineJoin = "round";
      tx.strokeStyle = this.color;
      st.wet.forEach((L, i) => {
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
        if (i === st.wet.length - 1) tx.globalCompositeOperation = "destination-out";
        tx.stroke();
      });
      // grano del papel y manchas de pigmento
      tx.globalCompositeOperation = "destination-out";
      tx.globalAlpha = 0.85;
      tx.fillStyle = tx.createPattern(paperGrain(), "repeat");
      tx.fillRect(bx, by, bw, bh);
      tx.restore();
      // a la capa de encima (se ve igual que quedará)
      this.octx.clearRect(bx, by, bw, bh);
      this.octx.drawImage(t, bx, by, bw, bh, bx, by, bw, bh);
      st.wetBox = [bx, by, bw, bh];
      // si el móvil va justo, se redibuja menos a menudo
      const took = performance.now() - t0;
      this._wetNext = performance.now() + Math.min(150, Math.max(33, took * 3));
    }
    _commitWater() {
      clearTimeout(this._wetRaf);
      this._wetRaf = null;
      if (this.stroke && this.stroke.wet) this._wetRender();
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.globalCompositeOperation = "multiply";
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
