// Captura una hoja de contacto: node lib/art/shot.js hoja.html salida.png
const { chromium } = require("/opt/npm-tools/node_modules/playwright");
(async () => {
  const [, , inp, outp] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  await p.goto("file://" + require("path").resolve(inp));
  await p.waitForTimeout(300);
  await p.screenshot({ path: outp, fullPage: true });
  await b.close();
})();
