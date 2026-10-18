// Lienzo de dibujo: pincel, goma, relleno, mover, zoom, deshacer/rehacer.
(function () {
  const W = 600;
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
      this.stage = document.createElement("div");
      this.stage.className = "pad-stage";
      this.inner = document.createElement("div");
      this.inner.className = "pad-inner";
      this.canvas = document.createElement("canvas");
      this.canvas.width = W;
      this.canvas.height = H;
      this.canvas.className = "pad-canvas";
      this.inner.appendChild(this.canvas);
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

    // ---- tamaño y zoom ----
    baseWidth() {
      const sw = this.stage.clientWidth - 2;
      const sh = this.stage.clientHeight - 2;
      return Math.max(120, Math.min(sw, (sh * W) / H));
    }
    layout(keepCenter) {
      const before = keepCenter || this._center();
      const bw = this.baseWidth();
      this.canvas.style.width = bw * this.zoom + "px";
      this.canvas.style.height = (bw * this.zoom * H) / W + "px";
      this._restoreCenter(before);
    }
    _center() {
      const s = this.stage;
      const cw = this.canvas.offsetWidth || 1;
      const ch = this.canvas.offsetHeight || 1;
      return {
        fx: (s.scrollLeft + s.clientWidth / 2 - this.canvas.offsetLeft) / cw,
        fy: (s.scrollTop + s.clientHeight / 2 - this.canvas.offsetTop) / ch,
        sx: s.clientWidth / 2,
        sy: s.clientHeight / 2,
      };
    }
    _restoreCenter(c) {
      if (!c) return;
      const s = this.stage;
      s.scrollLeft = this.canvas.offsetLeft + c.fx * this.canvas.offsetWidth - c.sx;
      s.scrollTop = this.canvas.offsetTop + c.fy * this.canvas.offsetHeight - c.sy;
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
          fx: (this.stage.scrollLeft + sx - this.canvas.offsetLeft) / this.canvas.offsetWidth,
          fy: (this.stage.scrollTop + sy - this.canvas.offsetTop) / this.canvas.offsetHeight,
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
      this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
      this.redoStack = [];
    }
    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.undoStack.pop(), 0, 0);
      this.dirty = true;
      this.onChange();
    }
    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this.ctx.getImageData(0, 0, W, H));
      this.ctx.putImageData(this.redoStack.pop(), 0, 0);
      this.dirty = true;
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
      this.onChange();
    }
    reset() {
      this.undoStack = [];
      this.redoStack = [];
      this.clear(false);
      this.dirty = false;
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
        this.ctx.drawImage(img, 0, 0, W, H);
        this.dirty = false;
        this.onChange();
        done && done(true);
      };
      img.onerror = () => done && done(false);
      img.src = src;
    }
    canUndo() {
      return this.undoStack.length > 0;
    }
    canRedo() {
      return this.redoStack.length > 0;
    }
    toDataURL() {
      return this.canvas.toDataURL("image/png");
    }

    // ---- entrada ----
    _pt(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
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
        // Dos dedos: cancelar el trazo y pasar a mover/ampliar
        if (this.stroke) {
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
        if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return;
        this._snapshot();
        this.floodFill(Math.floor(p.x), Math.floor(p.y), this.color);
        this.dirty = true;
        this.onChange();
        return;
      }
      this._snapshot();
      this.stroke = { last: p, lastMid: p, t: performance.now() };
      this._dot(p);
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
      if (this.pan) {
        this.stage.scrollLeft -= e.clientX - this.pan.x;
        this.stage.scrollTop -= e.clientY - this.pan.y;
        this.pan = { x: e.clientX, y: e.clientY };
        return;
      }
      if (!this.stroke) return;
      const from = this.stroke.last;
      const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of events.length ? events : [e]) {
        const p = this._pt(ev);
        const mid = { x: (this.stroke.last.x + p.x) / 2, y: (this.stroke.last.y + p.y) / 2 };
        const ctx = this.ctx;
        this._style();
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
    _up(e) {
      this.pointers.delete(e.pointerId);
      if (this.stroke) {
        const s = this.stroke;
        this._style();
        this.ctx.beginPath();
        this.ctx.moveTo(s.lastMid.x, s.lastMid.y);
        this.ctx.lineTo(s.last.x, s.last.y);
        this.ctx.stroke();
        this.stroke = null;
        this.onStroke("end");
        this.onChange();
      }
      if (this.pointers.size < 2) this.gesture = null;
      if (this.pointers.size === 0) this.pan = null;
    }
    _style() {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = this.tool === "eraser" ? "#ffffff" : this.color;
      ctx.lineWidth = this.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    _dot(p) {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = this.tool === "eraser" ? "#ffffff" : this.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
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
      const paint = new Uint8Array(mask);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const p = y * W + x;
          if (mask[p]) continue;
          if ((x > 0 && mask[p - 1]) || (x < W - 1 && mask[p + 1]) || (y > 0 && mask[p - W]) || (y < H - 1 && mask[p + W])) {
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
