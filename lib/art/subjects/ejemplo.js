// Ejemplos de referencia del estilo (calidad mínima para cualquier dibujo nuevo)
module.exports = [
  {
    key: "gato",
    words: ["gato", "gatito", "felino", "minino"],
    name: "Un gato",
    draw(k) {
      const fur = k.pick(["#ff9f45", "#9ca3af", "#2b2b30", "#f2e3c6", "#d9a066"]);
      const dark = k.tone(fur, -0.35);
      k.bg(k.pick(["#fff4dc", "#e8f4ff", "#fde7ef"]));
      // cojín
      k.ellipse(300, 760, 230, 70, { fill: k.col("purple"), shade: "b", w: 6 });
      // cola
      k.tube([[420, 700], [500, 640], [520, 540], [480, 470]], 30, fur);
      // cuerpo
      k.path([[200, 720], [190, 560], [230, 450], [300, 420], [370, 450], [410, 560], [400, 720], [300, 740]], { fill: fur, shade: "r", light: true });
      // patas delanteras
      k.ellipse(255, 725, 42, 26, { fill: fur, shade: "b" });
      k.ellipse(345, 725, 42, 26, { fill: fur, shade: "b" });
      // cabeza con orejas
      k.path([[175, 300], [185, 175], [245, 235], [300, 222], [355, 235], [415, 175], [425, 300], [395, 380], [300, 410], [205, 380]], { fill: fur, shade: "r", light: true });
      if (!k.drop()) {
        k.path([[200, 210], [212, 260], [242, 240]], { fill: "#ff9eb5", w: 0 });
        k.path([[400, 210], [388, 260], [358, 240]], { fill: "#ff9eb5", w: 0 });
      }
      // rayas
      if (fur !== "#2b2b30" && !k.drop()) for (const y of [470, 520, 570]) k.line([[205, y], [245, y + 8]], 7, dark);
      k.eye(255, 300, 26, { look: [0.2, 0.1], iris: "#2f7d32" });
      k.eye(345, 300, 26, { look: [0.2, 0.1], iris: "#2f7d32" });
      k.path([[288, 335], [312, 335], [300, 350]], { fill: "#ff7b8f", w: 4 });
      k.line([[300, 350], [300, 362]], 4);
      k.arc(285, 362, 15, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      k.arc(315, 362, 15, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      if (!k.drop()) {
        for (const s of [-1, 1]) {
          k.line([[300 + s * 40, 350], [300 + s * 120, 335]], 3);
          k.line([[300 + s * 40, 360], [300 + s * 120, 365]], 3);
        }
      }
      k.cheeks(225, 375, 345, 16);
    },
  },
  {
    key: "faro",
    words: ["faro", "costa", "acantilado", "mar"],
    name: "Un faro junto al mar",
    draw(k) {
      k.bg("#bfe6ff");
      k.circle(470, 150, 60, { fill: "#ffe066", w: 5, light: true });
      k.cloud(150, 170, 0.9);
      // mar
      k.ground(620, "#3b82f6", { wave: 16 });
      if (!k.drop()) for (const y of [700, 780]) k.line([[60, y], [120, y - 12], [180, y]], 5, "#dbeafe");
      // roca
      k.path([[150, 640], [180, 560], [260, 520], [380, 525], [450, 580], [470, 650], [300, 670]], { fill: "#8b8f99", shade: "rb" });
      // torre a rayas
      const tower = [[250, 540], [270, 260], [350, 260], [370, 540]];
      k.path(tower, { fill: "#ffffff", shade: "r", smooth: false });
      if (!k.drop()) for (const [a, b] of [[300, 340], [400, 440]]) k.path([[262 - (a - 300) * 0.02, a], [358 + (a - 300) * 0.02, a], [362 + (b - 300) * 0.02, b], [258 - (b - 300) * 0.02, b]], { fill: "#e63946", smooth: false, w: 5 });
      // linterna
      k.rect(262, 205, 96, 60, { r: 6, fill: "#ffd21f", light: true });
      k.path([[250, 210], [310, 160], [370, 210]], { fill: "#e63946", smooth: false });
      // haz de luz
      if (!k.drop()) k.path([[358, 225], [600, 160], [600, 300]], { fill: "#fff7b0", w: 0, opacity: 0.7, smooth: false });
      k.rect(290, 470, 40, 70, { r: 18, fill: "#8b5a2b" });
    },
  },
];
