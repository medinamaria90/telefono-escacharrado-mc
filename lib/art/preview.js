// Hoja de contacto: node lib/art/preview.js [archivo.js ...] > hoja.html  (originales y copias de memoria)
const path = require("path");
const fs = require("fs");
const { makeKit } = require("./kit");
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(__dirname, "subjects")).map((f) => path.join(__dirname, "subjects", f));
let cells = "";
for (const f of files) {
  const list = require(path.resolve(f));
  for (const s of Array.isArray(list) ? list : list.SUBJECTS || []) {
    for (const lv of [0, 0, 2]) {
      const k = makeKit({ level: lv, w: s.w || 600, h: s.h || 900 });
      try { s.draw(k); } catch (e) { cells += `<div class="c err">${s.key}: ${e.message}</div>`; continue; }
      cells += `<div class="c"><img src="data:image/svg+xml;base64,${Buffer.from(k.svg()).toString("base64")}"><span>${s.key}${lv ? " · copia" : ""}</span></div>`;
    }
  }
}
process.stdout.write(`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#ddd;font:12px sans-serif}.g{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px}.c{background:#fff;padding:4px}.c img{width:100%;display:block}.err{color:red}</style><div class="g">${cells}</div>`);
