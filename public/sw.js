// Dibulíos: trabajador mínimo para que Chrome permita instalar la app.
// No guarda nada en caché: todo se pide siempre a internet, así nunca hay versiones viejas.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return; // el resto, como siempre
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dibulíos</title><body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;background:#eef3fb;color:#1d2747;text-align:center"><div><p style="font-size:3rem;margin:0">✏️</p><h1>Sin conexión</h1><p>Dibulíos necesita internet para jugar.<br>Comprueba la conexión y vuelve a intentarlo.</p><button onclick="location.reload()" style="font:inherit;font-weight:700;padding:12px 20px;border-radius:12px;border:2px solid #1d2747;background:#ff5a3c;color:#fff">Reintentar</button></div>',
          { headers: { "Content-Type": "text/html; charset=utf-8" } }
        )
    )
  );
});
