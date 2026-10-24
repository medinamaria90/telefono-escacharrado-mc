# Dibujos de los robots (Dibulíos)

Cada archivo de `lib/art/subjects/` exporta una lista de temas:

```js
module.exports = [
  { key: "gato", words: ["gato", "gatito"], name: "Un gato", draw(k) { /* … */ } },
];
```

- `key`: único, en minúsculas sin tildes.
- `words`: palabras (en español, minúsculas, con tildes) que, si aparecen en una frase, hacen que el robot dibuje este tema.
- `name`: cómo lo «adivina» un robot (frase corta: «Un gato», «Una pizza»).
- `draw(k)`: dibuja en un lienzo vertical de **600 × 900**. `k` es el kit de `lib/art/kit.js`.

## El kit (`k`)

- Azar: `k.R(a,b)` (decimal), `k.I(a,b)` (entero), `k.pick(lista)`, `k.chance(p)`.
- Colores: `k.col("red"|"orange"|"yellow"|"green"|"lime"|"teal"|"sky"|"blue"|"navy"|"purple"|"pink"|"brown"|"tan"|"skin"|"gray"|"cream"|…)` o cualquier `#rrggbb`. `k.tone(hex, -0.3)` oscurece, `k.tone(hex, 0.3)` aclara.
- `k.bg(color)`: fondo entero.
- `k.path(puntos, { fill, shade, light, w, smooth, closed, opacity, stroke })`: forma cerrada suave por los puntos (o abierta con `closed:false`).
  - `shade: "r"|"l"|"b"|"t"|"rb"` pone una media luna de sombra en ese lado; `light: true`, un brillo arriba a la izquierda. Úsalos en las formas grandes: es lo que da aspecto de ilustración.
  - `smooth: false` para esquinas rectas (edificios, cajas).
  - `w`: grosor del contorno (6 por defecto; 0 = sin contorno).
- `k.ellipse(cx,cy,rx,ry,{…,rot})`, `k.circle(cx,cy,r,{…})`, `k.rect(x,y,w,h,{r,…})`.
- `k.line(puntos, grosor, color)`, `k.arc(cx,cy,r,a0,a1,grosor,color)`, `k.dot(x,y,r,color)`.
- `k.tube(puntos, grosor, color)`: tubo con contorno (colas, brazos, tallos, cuerdas, mangas).
- Caras: `k.eye(x,y,r,{look:[dx,dy], iris, closed})`, `k.mouth(x,y,ancho,"smile"|"open"|"o"|"flat"|"grin"|"sad")`, `k.cheeks(x1,x2,y,r)`.
- Escenario: `k.ground(y, color, {wave})`, `k.cloud(x,y,escala)`, `k.stars(n)`, `k.grass(y, n, color)`.
- `k.group("rotate(10 300 450)", () => { … })` para rotar/escalar un trozo.
- `k.drop()` devuelve `true` a veces solo en las **copias de memoria**: úsalo en detalles secundarios (`if (!k.drop()) …`), nunca en la forma principal.

## Estilo (lo que se pide)

- Ilustración a rotulador, simpática y limpia, como un buen libro infantil o unas pegatinas: formas suaves, contorno de tinta, sombra y brillo en las piezas grandes, colores armoniosos (no chillones), fondo de color suave o un escenario sencillo.
- Que se reconozca de un vistazo (la silueta lo dice todo) y que llene bien el lienzo (sin quedar pequeño en una esquina).
- 2–4 variaciones con azar en cada tema (colores, accesorios, postura, fondo), sin perder la idea.
- Orden: fondo → objetos de atrás → cuerpo → detalles → cara.
- Mira `subjects/ejemplo.js` (gato y faro): ese es el nivel mínimo.

## Comprobar

```
node lib/art/preview.js lib/art/subjects/MI_ARCHIVO.js > /tmp/hoja.html
node lib/art/shot.js /tmp/hoja.html /tmp/hoja.png
```

Y mira la imagen (cada tema sale dos veces y una tercera como «copia» de memoria). Corrige lo que no se entienda o quede feo.
