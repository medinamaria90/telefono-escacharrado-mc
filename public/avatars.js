// Caritas propias del juego. Cada una es un SVG de 100x100 dibujado a mano.
(function () {
  const O = "#1d2747"; // trazo
  const S = `stroke="${O}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
  const bg = (c) => `<circle cx="50" cy="50" r="50" fill="${c}"/>`;
  const head = (skin, ry = 31) => `<ellipse cx="50" cy="56" rx="29" ry="${ry}" fill="${skin}" ${S}/>`;
  const ears = (skin) => `<circle cx="21" cy="58" r="6" fill="${skin}" ${S}/><circle cx="79" cy="58" r="6" fill="${skin}" ${S}/>`;
  const eyes = {
    dots: `<circle cx="39" cy="55" r="3.6" fill="${O}"/><circle cx="61" cy="55" r="3.6" fill="${O}"/>`,
    happy: `<path d="M33 56 q6 -7 12 0 M55 56 q6 -7 12 0" fill="none" ${S}/>`,
    big: `<circle cx="39" cy="54" r="7" fill="#fff" ${S}/><circle cx="61" cy="54" r="7" fill="#fff" ${S}/><circle cx="40" cy="55" r="3.4" fill="${O}"/><circle cx="62" cy="55" r="3.4" fill="${O}"/>`,
    wink: `<circle cx="39" cy="55" r="3.6" fill="${O}"/><path d="M55 56 q6 -6 12 0" fill="none" ${S}/>`,
    lashes: `<circle cx="39" cy="55" r="3.8" fill="${O}"/><circle cx="61" cy="55" r="3.8" fill="${O}"/><path d="M34 50 l-3 -3 M37 49 l-1 -4 M66 50 l3 -3 M63 49 l1 -4" ${S}/>`,
    sleepy: `<path d="M33 56 q6 5 12 0 M55 56 q6 5 12 0" fill="none" ${S}/>`,
    cross: `<path d="M35 51 l8 8 M43 51 l-8 8" ${S}/><circle cx="61" cy="55" r="5" fill="#fff" ${S}/><circle cx="61" cy="55" r="2" fill="${O}"/>`,
  };
  const mouths = {
    smile: `<path d="M40 69 q10 9 20 0" fill="none" ${S}/>`,
    grin: `<path d="M37 67 q13 15 26 0 z" fill="#fff" ${S}/>`,
    o: `<ellipse cx="50" cy="71" rx="4.5" ry="5.5" fill="#7a2230" ${S}/>`,
    smirk: `<path d="M42 71 q9 5 17 -4" fill="none" ${S}/>`,
    lips: `<path d="M41 69 q4.5 -3 9 0 q4.5 -3 9 0 q-9 9 -18 0z" fill="#e5252a" ${S}/>`,
    tongue: `<path d="M38 67 q12 12 24 0 z" fill="#7a2230" ${S}/><path d="M46 72 q4 9 8 0" fill="#ff8fb8" ${S}/>`,
    tooth: `<path d="M39 69 q11 8 22 0" fill="none" ${S}/><rect x="47" y="70" width="6" height="7" rx="1" fill="#fff" ${S}/>`,
    braces: `<path d="M37 66 q13 14 26 0 z" fill="#fff" ${S}/><path d="M40 69 h20" stroke="#8a8e99" stroke-width="2.5"/><path d="M44 67 v4 M50 67 v5 M56 67 v4" stroke="#8a8e99" stroke-width="2"/>`,
    fangs: `<path d="M39 68 q11 7 22 0" fill="none" ${S}/><path d="M42 69 l2.5 6 l2.5 -5 M53 70 l2.5 5 l2.5 -6" fill="#fff" ${S}/>`,
    zig: `<path d="M38 70 l4 -3 l4 3 l4 -3 l4 3 l4 -3 l4 3" fill="none" ${S}/>`,
  };
  const blush = `<ellipse cx="31" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/><ellipse cx="69" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/>`;
  const glassesRound = `<circle cx="39" cy="55" r="9" fill="#ffffff55" ${S}/><circle cx="61" cy="55" r="9" fill="#ffffff55" ${S}/><path d="M48 55 h4 M30 54 l-8 -3 M70 54 l8 -3" ${S}/>`;
  const glassesNerd = `<rect x="28" y="47" width="19" height="15" rx="3" fill="#ffffff66" stroke="${O}" stroke-width="4"/><rect x="53" y="47" width="19" height="15" rx="3" fill="#ffffff66" stroke="${O}" stroke-width="4"/><path d="M47 54 h6" stroke="${O}" stroke-width="4"/><rect x="47" y="51" width="6" height="6" fill="#fff" ${S}/>`;

  const A = {
    hombre: {
      label: "Hombre",
      svg: bg("#9fdcf7") + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M22 50 q2 -27 28 -27 q26 0 28 27 q-6 -12 -14 -14 q-14 6 -28 0 q-10 4 -14 14z" fill="#5c3a1e" ${S}/>` +
        eyes.dots + `<path d="M38 64 q12 -6 24 0 q-4 6 -12 2 q-8 4 -12 -2z" fill="#5c3a1e" ${S}/>` + mouths.smile,
    },
    mujer: {
      label: "Mujer",
      svg: bg("#ffd6e7") + `<path d="M18 92 q-6 -40 6 -60 q26 -24 52 0 q12 20 6 60z" fill="#8b5a2b" ${S}/>` + head("#f1c9a5", 29) +
        `<path d="M22 50 q10 -24 28 -24 q18 0 28 24 q-14 -8 -28 -14 q-14 6 -28 14z" fill="#8b5a2b" ${S}/>` +
        eyes.lashes + blush + mouths.lips,
    },
    friki: {
      label: "Friki",
      svg: bg("#c9f2a0") + ears("#ffe0c2") + head("#ffe0c2") +
        `<path d="M24 44 l4 -14 l6 8 l5 -13 l6 10 l6 -12 l5 11 l7 -9 l3 13 l6 -4 l-2 12 q-26 -8 -46 -2z" fill="#3b3b44" ${S}/>` +
        glassesNerd + `<circle cx="38" cy="55" r="2.6" fill="${O}"/><circle cx="62" cy="55" r="2.6" fill="${O}"/>` + mouths.braces +
        `<circle cx="34" cy="66" r="1.2" fill="#c68b59"/><circle cx="66" cy="66" r="1.2" fill="#c68b59"/><circle cx="37" cy="68" r="1.2" fill="#c68b59"/>`,
    },
    guapa: {
      label: "Guapa",
      svg: bg("#ffe27a") + `<path d="M16 90 q-4 -44 10 -62 q24 -20 48 0 q14 18 10 62z" fill="#ffd21f" ${S}/>` + head("#f6d2b4", 29) +
        `<path d="M21 52 q4 -26 29 -26 q22 0 29 22 q-18 -2 -30 -14 q-6 12 -28 18z" fill="#ffd21f" ${S}/>` +
        eyes.lashes.replace('cx="61" cy="55" r="3.8"', 'cx="61" cy="55" r="0"') + `<path d="M55 56 q6 -6 12 0" fill="none" ${S}/>` +
        blush + mouths.lips + `<path d="M74 34 l3 -6 l3 6 l-3 6z" fill="#fff"/>`,
    },
    guapo: {
      label: "Guapo",
      svg: bg("#ffb067") + ears("#d9a27a") + head("#d9a27a") +
        `<path d="M22 50 q-2 -26 26 -30 q20 -4 34 8 q-12 -2 -18 2 q8 4 14 20 q-18 -10 -36 -8 q-12 2 -20 8z" fill="#1b1b1f" ${S}/>` +
        `<path d="M33 48 l11 -2 M56 46 l11 0" ${S}/>` + eyes.dots + mouths.grin + `<path d="M72 70 l4 -4 M74 74 l5 -1" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    },
    feo: {
      label: "Feo",
      svg: bg("#b8e0d2") + ears("#e8b98f") + head("#e8b98f") +
        `<path d="M30 30 q4 -6 8 0 M46 26 q4 -6 8 0 M62 30 q4 -6 8 0" fill="none" ${S}/>` +
        `<path d="M30 47 q20 -8 40 0" fill="none" stroke="${O}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="38" cy="55" r="3" fill="${O}"/><circle cx="62" cy="54" r="5" fill="#fff" ${S}/><circle cx="63" cy="54" r="2" fill="${O}"/>` +
        `<ellipse cx="50" cy="63" rx="7" ry="6" fill="#d98b6a" ${S}/>` + mouths.tooth + `<circle cx="70" cy="70" r="2.6" fill="#8b5a2b"/>`,
    },
    fea: {
      label: "Fea",
      svg: bg("#d8c4f7") + `<path d="M18 70 q-8 -30 6 -44 q26 -22 52 0 q14 14 6 44 q-6 -18 -10 -26 q-24 -8 -44 0 q-4 8 -10 26z" fill="#7a8a3a" ${S}/>` +
        head("#e9c8a2", 29) + `<path d="M26 44 q6 -14 12 -4 q6 -12 12 0 q6 -12 12 0 q6 -10 12 4" fill="#7a8a3a" ${S}/>` +
        `<circle cx="39" cy="55" r="3.6" fill="${O}"/><circle cx="61" cy="57" r="2.6" fill="${O}"/>` +
        `<path d="M47 60 q3 8 6 0" fill="none" ${S}/>` + mouths.zig + `<circle cx="33" cy="66" r="2.6" fill="#5c3a1e"/><path d="M33 64 l-2 -4" stroke="${O}" stroke-width="1.5"/>`,
    },
    estudiosa: {
      label: "Estudiosa",
      svg: bg("#cfe3ff") + `<circle cx="50" cy="20" r="11" fill="#5c3a1e" ${S}/>` + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M21 52 q2 -26 29 -26 q27 0 29 26 q-6 -14 -29 -16 q-23 2 -29 16z" fill="#5c3a1e" ${S}/>` +
        glassesRound + eyes.dots + mouths.smile + `<path d="M80 30 l8 -16 l4 2 l-8 16z" fill="#ffd21f" ${S}/><path d="M80 30 l-1 5 l4 -3" fill="#f1c9a5" ${S}/>`,
    },
    alien: {
      label: "Alien",
      svg: bg("#1e2f7a") + `<path d="M36 22 l-8 -12 M64 22 l8 -12" ${S}/><circle cx="28" cy="10" r="4" fill="#ffd21f" ${S}/><circle cx="72" cy="10" r="4" fill="#ffd21f" ${S}/>` +
        `<path d="M50 20 q32 0 32 30 q0 22 -32 42 q-32 -20 -32 -42 q0 -30 32 -30z" fill="#7ad19a" ${S}/>` +
        `<ellipse cx="38" cy="52" rx="9" ry="12" fill="${O}" transform="rotate(-25 38 52)"/><ellipse cx="62" cy="52" rx="9" ry="12" fill="${O}" transform="rotate(25 62 52)"/>` +
        `<circle cx="36" cy="48" r="2.4" fill="#fff"/><circle cx="60" cy="48" r="2.4" fill="#fff"/><path d="M45 74 q5 4 10 0" fill="none" ${S}/>`,
    },
    pina: {
      label: "Piña",
      svg: bg("#ffe9d6") + `<path d="M50 30 l-12 -22 l10 8 l2 -14 l4 14 l10 -8 l-12 22z" fill="#2aa84a" ${S}/>` +
        `<ellipse cx="50" cy="60" rx="28" ry="32" fill="#ffc93d" ${S}/>` +
        `<path d="M30 42 l40 40 M26 56 l30 30 M38 32 l36 36 M70 42 l-40 40 M74 56 l-30 30 M62 32 l-36 36" stroke="#c79a00" stroke-width="2" opacity=".7"/>` +
        eyes.big + `<path d="M40 72 q10 9 20 0" fill="#fff" ${S}/>`,
    },
    robot: {
      label: "Robot",
      svg: bg("#ffd21f") + `<path d="M50 24 v-12" ${S}/><circle cx="50" cy="10" r="5" fill="#e5252a" ${S}/>` +
        `<rect x="22" y="24" width="56" height="62" rx="10" fill="#c7cad1" ${S}/><rect x="15" y="46" width="7" height="16" rx="2" fill="#8a8e99" ${S}/><rect x="78" y="46" width="7" height="16" rx="2" fill="#8a8e99" ${S}/>` +
        `<rect x="31" y="42" width="15" height="12" rx="3" fill="#3fc8ef" ${S}/><rect x="54" y="42" width="15" height="12" rx="3" fill="#3fc8ef" ${S}/>` +
        `<rect x="34" y="64" width="32" height="12" rx="3" fill="#fff" ${S}/><path d="M42 64 v12 M50 64 v12 M58 64 v12" stroke="${O}" stroke-width="2"/>` +
        `<circle cx="30" cy="32" r="2" fill="${O}"/><circle cx="70" cy="32" r="2" fill="${O}"/>`,
    },
    abuela: {
      label: "Abuela",
      svg: bg("#ffd6c2") + `<circle cx="50" cy="20" r="12" fill="#e4e6ec" ${S}/>` + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M21 54 q0 -28 29 -28 q29 0 29 28 q-4 -12 -14 -14 q-15 -6 -30 0 q-10 2 -14 14z" fill="#e4e6ec" ${S}/>` +
        glassesRound + eyes.happy + mouths.smile + `<path d="M28 68 q3 2 5 0 M67 68 q3 2 5 0" fill="none" stroke="${O}" stroke-width="1.6"/>` + blush,
    },
    abuelo: {
      label: "Abuelo",
      svg: bg("#c9e8ff") + ears("#e8bf9a") + head("#e8bf9a") +
        `<path d="M21 56 q-2 -14 6 -18 q2 10 0 18z M79 56 q2 -14 -6 -18 q-2 10 0 18z" fill="#e4e6ec" ${S}/>` +
        `<path d="M40 36 q4 -3 8 0" fill="none" stroke="#c68b59" stroke-width="2"/>` +
        glassesRound + eyes.dots + `<path d="M30 68 q10 -10 20 -2 q10 -8 20 2 q-10 6 -20 0 q-10 6 -20 0z" fill="#e4e6ec" ${S}/>` + `<path d="M44 76 q6 3 12 0" fill="none" ${S}/>`,
    },
    bebe: {
      label: "Bebé",
      svg: bg("#bff0e6") + ears("#ffd9bd") + head("#ffd9bd") +
        `<path d="M50 26 q-6 -8 2 -12 q8 -2 6 6" fill="none" ${S}/>` + eyes.big + blush +
        `<circle cx="50" cy="72" r="7" fill="#3fc8ef" ${S}/><rect x="45" y="67" width="10" height="4" rx="2" fill="#ff8fb8" ${S}/>`,
    },
    vampiro: {
      label: "Vampiro",
      svg: bg("#7a1018") + `<path d="M14 90 l10 -40 l-6 -14 l18 12 h28 l18 -12 l-6 14 l10 40z" fill="#1b1b1f" ${S}/>` + head("#dfe4ee") +
        `<path d="M21 52 q2 -28 29 -28 q27 0 29 28 q-8 -12 -18 -14 l-11 12 l-11 -12 q-10 2 -18 14z" fill="#1b1b1f" ${S}/>` +
        `<path d="M32 49 l12 4 M68 49 l-12 4" ${S}/>` + `<circle cx="39" cy="57" r="3.4" fill="#e5252a"/><circle cx="61" cy="57" r="3.4" fill="#e5252a"/>` + mouths.fangs,
    },
    zombi: {
      label: "Zombi",
      svg: bg("#4a4d57") + ears("#9cc49a") + head("#9cc49a") +
        `<path d="M24 40 q8 -16 22 -14 l-4 6 l10 -7 q16 2 22 16" fill="#5c3a1e" ${S}/>` +
        `<path d="M58 30 l10 12 M60 36 l4 -3 M63 40 l4 -3" stroke="${O}" stroke-width="2"/>` + eyes.cross +
        `<path d="M38 70 h24" ${S}/><path d="M42 67 v6 M48 67 v6 M54 67 v6 M60 67 v6" stroke="${O}" stroke-width="2"/>`,
    },
    punki: {
      label: "Punki",
      svg: bg("#ffe27a") + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M44 26 l-4 -18 l8 8 l2 -12 l4 12 l8 -8 l-4 18z" fill="#d946ef" ${S}/>` +
        `<circle cx="80" cy="62" r="3" fill="none" stroke="#8a8e99" stroke-width="2.5"/>` +
        `<path d="M32 49 l12 2 M68 49 l-12 2" ${S}/>` + eyes.dots + mouths.tongue + `<circle cx="58" cy="66" r="2" fill="none" stroke="#8a8e99" stroke-width="2"/>`,
    },
    reina: {
      label: "Reina",
      svg: bg("#e7d2ff") + `<path d="M17 90 q-6 -40 8 -56 q25 -18 50 0 q14 16 8 56z" fill="#c81d25" ${S}/>` + head("#f1c9a5", 29) +
        `<path d="M30 30 l4 -16 l8 10 l8 -14 l8 14 l8 -10 l4 16z" fill="#ffd21f" ${S}/><circle cx="50" cy="20" r="2.5" fill="#2563eb"/>` +
        eyes.lashes + blush + mouths.smile,
    },
    gato: {
      label: "Gato",
      svg: bg("#ffd0a8") + `<path d="M24 40 l-2 -24 l18 12z M76 40 l2 -24 l-18 12z" fill="#ff8a3d" ${S}/>` + head("#ff8a3d") +
        `<path d="M44 30 l2 8 M50 28 v9 M56 30 l-2 8" stroke="#b34700" stroke-width="3" stroke-linecap="round"/>` +
        `<ellipse cx="39" cy="54" rx="4" ry="6" fill="${O}"/><ellipse cx="61" cy="54" rx="4" ry="6" fill="${O}"/>` +
        `<path d="M47 63 h6 l-3 4z" fill="#ff8fb8" ${S}/><path d="M42 70 q4 4 8 0 q4 4 8 0" fill="none" ${S}/>` +
        `<path d="M30 64 h-14 M30 69 l-13 4 M70 64 h14 M70 69 l13 4" stroke="${O}" stroke-width="2"/>`,
    },
    payaso: {
      label: "Payaso",
      svg: bg("#c9f2a0") + `<circle cx="20" cy="42" r="11" fill="#ff3b3b" ${S}/><circle cx="80" cy="42" r="11" fill="#ff3b3b" ${S}/>` + head("#ffffff") +
        `<path d="M50 26 l-8 -16 h16z" fill="#2563eb" ${S}/><circle cx="50" cy="9" r="4" fill="#ffd21f" ${S}/>` +
        `<path d="M34 46 l5 8 l5 -8 M56 46 l5 8 l5 -8" fill="#3fc8ef" ${S}/>` + eyes.dots +
        `<circle cx="50" cy="63" r="6" fill="#e5252a" ${S}/><path d="M34 70 q16 16 32 0 q-16 6 -32 0z" fill="#e5252a" ${S}/>`,
    },
    aguacate: {
      label: "Aguacate",
      svg: bg("#ffe9d6") + `<path d="M50 10 q20 0 26 30 q8 30 -4 44 q-10 10 -22 10 q-12 0 -22 -10 q-12 -14 -4 -44 q6 -30 26 -30z" fill="#3d6b1f" ${S}/>` +
        `<path d="M50 18 q15 0 20 26 q6 24 -3 35 q-7 8 -17 8 q-10 0 -17 -8 q-9 -11 -3 -35 q5 -26 20 -26z" fill="#c9e88a"/>` +
        `<circle cx="50" cy="70" r="11" fill="#8b5a2b" ${S}/>` + `<circle cx="41" cy="44" r="3.4" fill="${O}"/><circle cx="59" cy="44" r="3.4" fill="${O}"/>` +
        `<path d="M44 52 q6 6 12 0" fill="none" ${S}/>` + `<ellipse cx="35" cy="51" rx="4" ry="2.4" fill="#ff8fb8" opacity=".8"/><ellipse cx="65" cy="51" rx="4" ry="2.4" fill="#ff8fb8" opacity=".8"/>`,
    },
    pirata: {
      label: "Pirata",
      svg: bg("#9fdcf7") + ears("#d9a27a") + head("#d9a27a") +
        `<path d="M20 46 q0 -24 30 -24 q30 0 30 24 z" fill="#c81d25" ${S}/><circle cx="34" cy="34" r="2.5" fill="#fff"/><circle cx="50" cy="30" r="2.5" fill="#fff"/><circle cx="66" cy="34" r="2.5" fill="#fff"/>` +
        `<path d="M80 40 l8 6 l-8 4" fill="#c81d25" ${S}/>` +
        `<path d="M24 46 l52 14" stroke="${O}" stroke-width="2.5"/><ellipse cx="61" cy="55" rx="8" ry="7" fill="${O}"/>` +
        `<circle cx="39" cy="55" r="3.6" fill="${O}"/>` + `<path d="M36 66 q14 14 28 0 q-6 14 -14 14 q-8 0 -14 -14z" fill="#3b2410" ${S}/>` + `<path d="M43 70 q7 5 14 0" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    },
    rubio: {
      label: "Chico rubio rizado",
      svg: bg("#cfe3ff") + ears("#f6d2b4") + head("#f6d2b4") +
        [[26,44],[33,33],[43,27],[54,26],[64,30],[72,38],[77,48],[23,52]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#f5c542" ${S}/>`).join("") +
        `<path d="M30 46 q20 -10 40 0" fill="#f5c542"/>` + eyes.dots + mouths.smile +
        `<circle cx="33" cy="64" r="1.3" fill="#c68b59"/><circle cx="37" cy="66" r="1.3" fill="#c68b59"/><circle cx="63" cy="66" r="1.3" fill="#c68b59"/><circle cx="67" cy="64" r="1.3" fill="#c68b59"/>`,
    },
    rubia: {
      label: "Chica rubia rizada",
      svg: bg("#ffd6e7") +
        [[22,60],[20,74],[26,86],[78,60],[80,74],[74,86],[24,44],[76,44]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#f5c542" ${S}/>`).join("") +
        head("#f6d2b4", 29) +
        [[30,36],[40,28],[51,26],[62,28],[71,36]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#f5c542" ${S}/>`).join("") +
        `<path d="M32 44 q18 -9 36 0" fill="#f5c542"/>` + eyes.lashes + blush + mouths.lips,
    },
    pelirroja: {
      label: "Pelirroja con coletas",
      svg: bg("#c9f2a0") + `<ellipse cx="16" cy="66" rx="8" ry="15" fill="#e8641b" ${S}/><ellipse cx="84" cy="66" rx="8" ry="15" fill="#e8641b" ${S}/>` +
        `<circle cx="22" cy="50" r="4" fill="#2ec4b6" ${S}/><circle cx="78" cy="50" r="4" fill="#2ec4b6" ${S}/>` + head("#f6d2b4") +
        `<path d="M22 52 q0 -28 28 -28 q28 0 28 28 q-8 -4 -12 -12 q-6 6 -16 6 q-10 0 -16 -6 q-4 8 -12 12z" fill="#e8641b" ${S}/>` +
        eyes.happy + mouths.smile + `<path d="M31 63 h0.1 M35 65 h0.1 M65 65 h0.1 M69 63 h0.1" stroke="#c0611c" stroke-width="3" stroke-linecap="round"/>`,
    },
    barbudo: {
      label: "Barbudo",
      svg: bg("#ffe27a") + ears("#e8b98f") + head("#e8b98f") +
        `<path d="M22 48 q2 -24 28 -24 q26 0 28 24 q-10 -10 -28 -10 q-18 0 -28 10z" fill="#3b2410" ${S}/>` +
        `<path d="M22 56 q2 34 28 34 q26 0 28 -34 q-6 8 -14 8 q-14 -6 -28 0 q-8 0 -14 -8z" fill="#3b2410" ${S}/>` +
        `<path d="M32 48 l11 -1 M57 47 l11 1" ${S}/>` + eyes.dots + `<path d="M42 70 q8 6 16 0" fill="#fff" ${S}/>`,
    },
    gorra: {
      label: "Chico con gorra",
      svg: bg("#9fdcf7") + ears("#d9a27a") + head("#d9a27a") +
        `<path d="M21 48 q0 -28 29 -28 q29 0 29 28z" fill="#e5252a" ${S}/><path d="M50 48 h40 q-2 8 -14 8 h-26z" fill="#c81d25" ${S}/><circle cx="50" cy="22" r="3" fill="#fff" ${S}/>` +
        eyes.dots + mouths.grin,
    },
    afro: {
      label: "Chica afro",
      svg: bg("#ffb067") + `<circle cx="50" cy="44" r="38" fill="#2b1a10" ${S}/>` + head("#8b5a2b", 29) +
        `<circle cx="39" cy="55" r="3.6" fill="${O}"/><circle cx="61" cy="55" r="3.6" fill="${O}"/><path d="M34 50 l-3 -3 M66 50 l3 -3" ${S}/>` +
        `<path d="M40 68 q10 9 20 0" fill="none" ${S}/><circle cx="21" cy="66" r="4" fill="none" stroke="#ffd21f" stroke-width="3"/><circle cx="79" cy="66" r="4" fill="none" stroke="#ffd21f" stroke-width="3"/>` +
        `<ellipse cx="31" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".55"/><ellipse cx="69" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".55"/>`,
    },
    gafas: {
      label: "Con gafas de sol",
      svg: bg("#3fc8ef") + ears("#e8b98f") + head("#e8b98f") +
        `<path d="M22 50 q-2 -28 30 -28 q24 0 28 18 q-12 -6 -22 -2 q-14 -6 -26 6 q-6 2 -10 6z" fill="#5c3a1e" ${S}/>` +
        `<path d="M27 50 h19 q0 12 -9 12 q-10 0 -10 -12z M54 50 h19 q0 12 -10 12 q-9 0 -9 -12z" fill="#1b1b1f" ${S}/><path d="M46 52 h8" ${S}/><path d="M31 52 l5 0" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>` +
        mouths.smirk,
    },
    rulos: {
      label: "Señora con rulos",
      svg: bg("#f7d6ff") + head("#f1c9a5") +
        `<path d="M21 54 q0 -30 29 -30 q29 0 29 30 q-6 -8 -12 -10 q-17 -6 -34 0 q-6 2 -12 10z" fill="#a9adb8" ${S}/>` +
        [[30,30],[44,24],[58,24],[71,31]].map(([x,y]) => `<rect x="${x-6}" y="${y-5}" width="12" height="10" rx="4" fill="#ff8fb8" ${S}/>`).join("") +
        eyes.happy + blush + mouths.lips,
    },
    boina: {
      label: "Abuelo con boina",
      svg: bg("#d8f3dc") + ears("#e8bf9a") + head("#e8bf9a") +
        `<ellipse cx="48" cy="32" rx="32" ry="12" fill="#1e2f7a" ${S} transform="rotate(-8 48 32)"/><path d="M50 20 v-6" ${S}/>` +
        eyes.happy + `<path d="M32 68 q9 -9 18 -2 q9 -7 18 2 q-9 6 -18 0 q-9 6 -18 0z" fill="#e4e6ec" ${S}/>` + `<path d="M28 60 q3 2 5 0 M67 60 q3 2 5 0" fill="none" stroke="${O}" stroke-width="1.6"/>`,
    },
    coletas: {
      label: "Niña con coletas",
      svg: bg("#fff27a") + `<ellipse cx="18" cy="38" rx="9" ry="12" fill="#5c3a1e" ${S} transform="rotate(-25 18 38)"/><ellipse cx="82" cy="38" rx="9" ry="12" fill="#5c3a1e" ${S} transform="rotate(25 82 38)"/>` +
        ears("#ffd9bd") + head("#ffd9bd") + `<path d="M22 50 q2 -26 28 -26 q26 0 28 26 q-14 -10 -28 -10 q-14 0 -28 10z" fill="#5c3a1e" ${S}/>` +
        eyes.big + blush + mouths.smile,
    },
    mellado: {
      label: "Niño mellado",
      svg: bg("#bff0e6") + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M24 46 l4 -14 l6 8 l6 -12 l6 10 l6 -11 l6 10 l6 -8 l4 14 q-24 -6 -44 3z" fill="#8b5a2b" ${S}/>` + eyes.dots +
        `<path d="M37 66 q13 14 26 0 z" fill="#7a2230" ${S}/><rect x="42" y="66" width="6" height="5" fill="#fff"/><rect x="52" y="66" width="6" height="5" fill="#fff"/>` +
        `<circle cx="33" cy="64" r="1.3" fill="#c68b59"/><circle cx="67" cy="64" r="1.3" fill="#c68b59"/>`,
    },
    heroe: {
      label: "Superhéroe",
      svg: bg("#2563eb") + `<path d="M24 90 l-6 -22 l14 6z M76 90 l6 -22 l-14 6z" fill="#e5252a" ${S}/>` + ears("#f1c9a5") + head("#f1c9a5") +
        `<path d="M22 46 q2 -24 28 -24 q26 0 28 24 q-8 -8 -16 -8 l-4 -6 l-4 6 q-14 0 -32 8z" fill="#1b1b1f" ${S}/>` +
        `<path d="M24 50 q26 -6 52 0 v10 q-26 6 -52 0z" fill="#e5252a" ${S}/><ellipse cx="39" cy="55" rx="5" ry="4" fill="#fff"/><ellipse cx="61" cy="55" rx="5" ry="4" fill="#fff"/>` +
        `<circle cx="39" cy="55" r="2.2" fill="${O}"/><circle cx="61" cy="55" r="2.2" fill="${O}"/>` + mouths.grin,
    },
    astronauta: {
      label: "Astronauta",
      svg: bg("#1e2f7a") + `<circle cx="18" cy="20" r="1.8" fill="#fff"/><circle cx="84" cy="16" r="1.4" fill="#fff"/><circle cx="88" cy="40" r="1.8" fill="#fff"/><circle cx="12" cy="44" r="1.2" fill="#fff"/>` +
        `<circle cx="50" cy="54" r="34" fill="#f2f4f8" ${S}/><rect x="40" y="84" width="20" height="10" rx="3" fill="#c7cad1" ${S}/>` +
        `<ellipse cx="50" cy="54" rx="24" ry="21" fill="#f1c9a5" ${S}/><path d="M28 50 q22 -20 44 0" fill="#3b3b44"/>` + `<circle cx="42" cy="56" r="3" fill="${O}"/><circle cx="58" cy="56" r="3" fill="${O}"/><path d="M43 64 q7 6 14 0" fill="none" ${S}/>` +
        `<path d="M30 40 q8 -10 18 -12" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>`,
    },
    chef: {
      label: "Chef",
      svg: bg("#ffe9d6") + `<path d="M28 36 q-12 -4 -8 -16 q4 -10 16 -6 q4 -10 14 -10 q10 0 14 10 q12 -4 16 6 q4 12 -8 16z" fill="#fff" ${S}/><rect x="28" y="32" width="44" height="10" fill="#fff" ${S}/>` +
        ears("#f1c9a5") + `<ellipse cx="50" cy="62" rx="29" ry="26" fill="#f1c9a5" ${S}/>` + eyes.happy.replace(/56/g, "60") +
        `<path d="M34 70 q8 -8 16 -2 q8 -6 16 2 q-8 5 -16 0 q-8 5 -16 0z" fill="#3b2410" ${S}/><path d="M44 78 q6 4 12 0" fill="none" ${S}/>` + `<ellipse cx="31" cy="68" rx="4" ry="2.4" fill="#ff8fb8" opacity=".75"/><ellipse cx="69" cy="68" rx="4" ry="2.4" fill="#ff8fb8" opacity=".75"/>`,
    },
    bruja: {
      label: "Bruja",
      svg: bg("#7b3fe4") + `<path d="M20 92 q-6 -40 8 -50 h44 q14 10 8 50z" fill="#2aa84a" ${S}/>` + head("#c8e6a0", 29) +
        `<path d="M14 40 h72 q-6 6 -36 6 q-30 0 -36 -6z" fill="#1b1b1f" ${S}/><path d="M30 40 l14 -34 q4 -4 8 2 l18 32z" fill="#1b1b1f" ${S}/><path d="M33 34 h34" stroke="#ffd21f" stroke-width="5"/>` +
        eyes.dots + `<path d="M50 56 l6 10 h-8" fill="none" ${S}/>` + mouths.smirk + `<circle cx="64" cy="66" r="2.5" fill="#4d7a12"/>`,
    },
    perro: {
      label: "Perro",
      svg: bg("#ffd0a8") + `<path d="M24 34 q-14 4 -12 30 q2 10 12 6z M76 34 q14 4 12 30 q-2 10 -12 6z" fill="#8b5a2b" ${S}/>` +
        `<ellipse cx="50" cy="56" rx="28" ry="30" fill="#e8c9a0" ${S}/><ellipse cx="62" cy="44" rx="9" ry="8" fill="#c68b59"/>` +
        `<circle cx="40" cy="50" r="3.6" fill="${O}"/><circle cx="60" cy="50" r="3.6" fill="${O}"/>` +
        `<ellipse cx="50" cy="68" rx="13" ry="10" fill="#fff" ${S}/><ellipse cx="50" cy="63" rx="5" ry="3.6" fill="${O}"/><path d="M50 66 v4 M44 72 q6 4 12 0" fill="none" ${S}/><path d="M47 74 q3 8 6 0" fill="#ff8fb8" ${S}/>`,
    },
    panda: {
      label: "Panda",
      svg: bg("#c9f2a0") + `<circle cx="25" cy="30" r="10" fill="#1b1b1f" ${S}/><circle cx="75" cy="30" r="10" fill="#1b1b1f" ${S}/>` +
        `<ellipse cx="50" cy="56" rx="31" ry="29" fill="#fff" ${S}/>` +
        `<ellipse cx="38" cy="53" rx="8" ry="10" fill="#1b1b1f" transform="rotate(25 38 53)"/><ellipse cx="62" cy="53" rx="8" ry="10" fill="#1b1b1f" transform="rotate(-25 62 53)"/>` +
        `<circle cx="39" cy="52" r="2.6" fill="#fff"/><circle cx="61" cy="52" r="2.6" fill="#fff"/><ellipse cx="50" cy="66" rx="4.5" ry="3" fill="#1b1b1f"/><path d="M44 72 q6 5 12 0" fill="none" ${S}/>` + blush,
    },
    rana: {
      label: "Rana",
      svg: bg("#9fdcf7") + `<circle cx="33" cy="34" r="12" fill="#7ad19a" ${S}/><circle cx="67" cy="34" r="12" fill="#7ad19a" ${S}/>` +
        `<ellipse cx="50" cy="60" rx="34" ry="26" fill="#7ad19a" ${S}/>` +
        `<circle cx="33" cy="33" r="7" fill="#fff" ${S}/><circle cx="67" cy="33" r="7" fill="#fff" ${S}/><circle cx="34" cy="34" r="3.4" fill="${O}"/><circle cx="68" cy="34" r="3.4" fill="${O}"/>` +
        `<path d="M28 62 q22 18 44 0" fill="none" ${S}/><ellipse cx="26" cy="58" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/><ellipse cx="74" cy="58" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/>`,
    },
    unicornio: {
      label: "Unicornio",
      svg: bg("#ffd6e7") + `<path d="M24 60 q-6 -30 16 -38 q-14 16 -6 40z" fill="#9b5de5" ${S}/><path d="M26 46 q2 -20 20 -26 q-8 14 -10 30z" fill="#3fc8ef" ${S}/>` +
        `<path d="M44 26 l6 -22 l6 22z" fill="#ffd21f" ${S}/>` + `<ellipse cx="54" cy="58" rx="27" ry="29" fill="#fff" ${S}/>` +
        `<path d="M70 32 l6 -12 l2 14" fill="#fff" ${S}/>` + eyes.sleepy.replace(/33/g, "41").replace(/55 56/g, "61 56").replace("M55", "M61") +
        `<path d="M44 52 l-3 -3 M70 52 l3 -3" ${S}/>` + `<ellipse cx="42" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/><ellipse cx="70" cy="64" rx="5" ry="3" fill="#ff8fb8" opacity=".75"/>` + `<path d="M50 72 q6 5 12 0" fill="none" ${S}/>`,
    },
    fantasma: {
      label: "Fantasma",
      svg: bg("#1e2f7a") + `<path d="M22 90 v-40 q0 -30 28 -30 q28 0 28 30 v40 l-7 -6 l-7 6 l-7 -6 l-7 6 l-7 -6 l-7 6 l-7 -6z" fill="#fff" ${S}/>` +
        `<ellipse cx="40" cy="48" rx="5" ry="7" fill="${O}"/><ellipse cx="60" cy="48" rx="5" ry="7" fill="${O}"/><ellipse cx="50" cy="64" rx="5" ry="6" fill="${O}"/>` + `<ellipse cx="32" cy="58" rx="4" ry="2.4" fill="#ff8fb8" opacity=".75"/><ellipse cx="68" cy="58" rx="4" ry="2.4" fill="#ff8fb8" opacity=".75"/>`,
    },
    sandia: {
      label: "Sandía",
      svg: bg("#fff27a") + `<circle cx="50" cy="54" r="34" fill="#2aa84a" ${S}/><circle cx="50" cy="54" r="28" fill="#ff5a6e"/>` +
        [[36,36],[62,34],[30,62],[70,64],[50,82]].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="2" ry="3.2" fill="#1b1b1f"/>`).join("") +
        eyes.big + `<path d="M40 66 q10 10 20 0" fill="#fff" ${S}/>`,
    },
    dino: {
      label: "Dinosaurio",
      svg: bg("#ffe9d6") + [[30,30],[42,22],[56,20],[69,26]].map(([x,y]) => `<path d="M${x-7} ${y+8} l7 -14 l7 14z" fill="#ff8a3d" ${S}/>`).join("") +
        `<ellipse cx="50" cy="58" rx="32" ry="30" fill="#7ad19a" ${S}/>` + `<circle cx="38" cy="50" r="7" fill="#fff" ${S}/><circle cx="62" cy="50" r="7" fill="#fff" ${S}/><circle cx="39" cy="51" r="3.4" fill="${O}"/><circle cx="63" cy="51" r="3.4" fill="${O}"/>` +
        `<path d="M32 68 q18 12 36 0 z" fill="#fff" ${S}/><path d="M38 68 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4" fill="none" stroke="${O}" stroke-width="2"/>` + `<circle cx="44" cy="62" r="1.4" fill="${O}"/><circle cx="56" cy="62" r="1.4" fill="${O}"/>`,
    },
  };

  const IDS = Object.keys(A);
  function svgFor(id) {
    const a = A[id];
    if (!a) return null;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><clipPath id="c-${id}"><circle cx="50" cy="50" r="50"/></clipPath><g clip-path="url(#c-${id})">${a.svg}</g></svg>`;
  }
  /** Devuelve un <span> con la carita (o el texto si es un emoticono antiguo) */
  function avatarEl(id, cls = "") {
    const span = document.createElement("span");
    span.className = "avatar " + cls;
    const key = String(id || "").replace(/^av:/, "");
    const svg = svgFor(key);
    if (svg) {
      span.innerHTML = svg;
    } else span.textContent = id || "🙂";
    return span;
  }
  window.AVATARS = { ids: IDS.map((k) => "av:" + k), label: (id) => (A[String(id).replace(/^av:/, "")] || {}).label || "", svgFor, avatarEl };
})();
