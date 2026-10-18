# Dibulíos

Teléfono escacharrado con dibujos para jugar en familia, cada uno desde su móvil.
Sin cuentas, sin anuncios y sin guardar nada: todo vive en la memoria del servidor
y se borra al acabar.

## Cómo se juega

- Uno crea la sala y comparte el enlace (o el código de 5 letras) por WhatsApp.
- Cada persona escribe su nombre y elige una de las 22 caritas del juego.
- **2 jugadores (modo Dúo):** en cada ronda los dos dibujáis a la vez una frase
  secreta y después adivináis el dibujo del otro. Puntuáis en equipo (3 por
  acierto, 1 por casi). Quien dibujó puede dar por buena una respuesta.
- **3 jugadores:** cada historia tiene 5 pasos (frase → dibujo → adivinanza →
  dibujo → adivinanza) para que dé tiempo a que se líe.
- **4 o más (hasta 12):** cada historia pasa una vez por cada jugador.
- Al final el anfitrión va enseñando las historias paso a paso en todos los móviles.

Herramientas de dibujo: 7 tamaños de pincel y 34 colores más un selector libre (en botones desplegables para dejar más sitio al lienzo),
goma, cubo de relleno, mover, acercar/alejar (botones o pellizcando con dos
dedos), deshacer, rehacer y borrar todo.

## Qué se borra y cuándo

- Al volver a la sala tras una partida, se borran sus frases y dibujos.
- Si una sala se queda sin nadie conectado, desaparece a los 10 minutos.
- Ninguna sala dura más de 8 horas.
- No hay base de datos ni ficheros: si el servidor se reinicia o se duerme, no queda nada.

## Subirlo gratis a Render (recomendado)

Render tiene un plan gratuito para servidores Node con conexiones en tiempo real.
Se duerme tras 15 minutos sin uso; la primera persona que entre esperará cerca de
un minuto a que despierte. Durante la partida se mantiene despierto.

1. Crea una cuenta gratuita en GitHub y sube esta carpeta como repositorio
   (en github.com: «New repository» → «uploading an existing file» y arrastra
   todos los ficheros, menos la carpeta `node_modules` si existe).
2. Crea una cuenta gratuita en https://render.com (puedes entrar con GitHub).
3. En Render: **New → Web Service** → elige el repositorio.
4. Rellena:
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
5. Pulsa **Create Web Service**. En un par de minutos tendrás una dirección tipo
   `https://dibulios.onrender.com`. Esa es la web que compartes.

Truco: abre la web unos minutos antes de jugar para que esté despierta.

### Si prefieres que nunca se duerma (de pago)

En el mismo servicio de Render, cambia el *Instance Type* de **Free** a **Starter**
(7 $ al mes, unos 6,5 €). Ya no se duerme y la web abre al instante. Se puede
volver a Free cuando quieras. Para jugar en familia, el plan gratuito suele bastar.

## Probarlo en tu ordenador

Necesitas Node 18 o superior.

```
npm install
npm start
```

Abre http://localhost:3000. Para jugar desde móviles en la misma wifi, usa la IP
del ordenador, por ejemplo http://192.168.1.20:3000.
