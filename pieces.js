/* Фигуры (SVG) и иконки модификаторов «Хаоса».
   Фигуры рисуются двумя слоями (обводка + заливка), поэтому контур получается цельным.
   Внешний вид задаётся CSS-переменными набора (ps-classic / ps-neon / ps-gold), см. style.css. */
(function (root) {
  'use strict';

  const BASE = '<rect x="27" y="72" width="46" height="9" rx="3"/><rect x="21" y="80" width="58" height="9" rx="3"/>';

  const SH = {
    p: {
      s: '<circle cx="50" cy="29" r="12.5"/><rect x="35" y="41" width="30" height="8" rx="4"/>' +
         '<path d="M40 47 H60 C60 58 64 66 68 73 H32 C36 66 40 58 40 47 Z"/>' + BASE,
      d: ['M36 73 H64'],
    },
    r: {
      s: '<path d="M26 12 H39 V21 H44.5 V12 H55.5 V21 H61 V12 H74 V37 H26 Z"/>' +
         '<path d="M32 36 H68 L65 73 H35 Z"/>' + BASE,
      d: ['M27 37.5 H73', 'M35 72.5 H65'],
    },
    b: {
      s: '<path d="M50 11 C65 21 69 33 64 43 C62 47 38 47 36 43 C31 33 35 21 50 11 Z"/><circle cx="50" cy="10" r="4.5"/>' +
         '<rect x="35" y="45" width="30" height="7" rx="3.5"/>' +
         '<path d="M41 51 H59 C59 62 63 66 68 73 H32 C37 66 41 62 41 51 Z"/>' + BASE,
      d: ['M46 27 L56 37', 'M36 73 H64'],
    },
    n: {
      s: '<path d="M26 88 C26 76 32 66 41 58 C45 54 46 50 44 47 C40 48 35 52 30 52 C25 52 19 48 22 43 ' +
         'C25 39 31 33 36 27 C38 25 39 21 38 14 L45 19 C47 14 52 11 58 12 C72 17 79 36 77 52 C76 64 75 76 77 88 Z"/>',
      d: ['M60 22 C67 32 69 46 67 60', 'M53 24 C59 34 61 47 59 61', 'M27 45 L30 46'],
      extra: '<circle cx="46" cy="30" r="2.6" class="e"/>',
    },
    q: {
      s: '<path d="M30 72 L24 30 L31 48 L37 22 L44 46 L50 18 L56 46 L63 22 L69 48 L76 30 L70 72 Z"/>' +
         '<circle cx="24" cy="27" r="4.5"/><circle cx="37" cy="19.5" r="4.5"/><circle cx="50" cy="15" r="4.5"/>' +
         '<circle cx="63" cy="19.5" r="4.5"/><circle cx="76" cy="27" r="4.5"/>' + BASE,
      d: ['M32 63 H68', 'M36 73 H64'],
    },
    k: {
      s: '<rect x="46" y="6" width="8" height="26" rx="2.5"/><rect x="38" y="14" width="24" height="8" rx="2.5"/>' +
         '<path d="M50 32 C34 32 22 42 27 56 C29 62 32 68 30 73 H70 C68 68 71 62 73 56 C78 42 66 32 50 32 Z"/>' + BASE,
      d: ['M34 61 H66', 'M36 73 H64'],
    },
  };

  const cache = {};
  function pieceSVG(t, c) {
    const k = t + c;
    if (cache[k]) return cache[k];
    const s = SH[t];
    const details = s.d.map(d => `<path d="${d}"/>`).join('');
    return (cache[k] =
      `<svg class="piece ${c}" viewBox="0 0 100 100" aria-hidden="true">` +
      `<g class="o">${s.s}</g><g class="f">${s.s}</g><g class="d">${details}</g>${s.extra || ''}</svg>`);
  }

  // ---------------- Иконки модификаторов (схематичные картинки) ----------------
  function star(cx, cy, ro, ri, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, r = i % 2 ? ri : ro;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return pts.join(' ');
  }
  const arrow = (a, col) =>
    `<g transform="rotate(${a} 32 32)"><path d="M32 22 V9" stroke="${col}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<path d="M26.5 14.5 L32 7.5 L37.5 14.5" fill="none" stroke="${col}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;

  const ICONS = {
    atomic: () =>
      `<polygon points="${star(32, 32, 28, 15, 11)}" fill="#ff7a1a"/>` +
      `<polygon points="${star(32, 32, 19, 9, 9)}" fill="#ffd24a"/><circle cx="32" cy="32" r="5.5" fill="#fff"/>`,
    antichess: () =>
      '<circle cx="17" cy="47" r="8" fill="#f1f1f1" stroke="#111" stroke-width="2"/>' +
      '<circle cx="47" cy="17" r="8" fill="#2b2b2b" stroke="#eee" stroke-width="2"/>' +
      '<path d="M24 40 L38 26" stroke="#ff5a5a" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M30 26 H40 V36" fill="none" stroke="#ff5a5a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="50" y="58" font-size="20" font-weight="800" fill="#ff5a5a" font-family="system-ui,sans-serif">!</text>',
    knights: () =>
      '<circle cx="18" cy="50" r="6" fill="#5fb3ff"/>' +
      '<path d="M18 44 V22 H40" fill="none" stroke="#5fb3ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1 0"/>' +
      '<path d="M40 14 L54 22 L40 30 Z" fill="#5fb3ff"/>',
    pawnking: () =>
      [0, 45, 90, 135, 180, 225, 270, 315].map(a => arrow(a, '#7bd96a')).join('') +
      '<circle cx="32" cy="32" r="8" fill="#fff" stroke="#2c5a22" stroke-width="2"/>',
    frozen: () => {
      let g = '';
      for (const a of [0, 60, 120]) {
        g += `<g transform="rotate(${a} 32 32)"><path d="M32 6 V58" stroke="#8fe3ff" stroke-width="4" stroke-linecap="round"/>` +
          '<path d="M25 14 L32 20 L39 14 M25 50 L32 44 L39 50" fill="none" stroke="#8fe3ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>';
      }
      return g + '<circle cx="32" cy="32" r="4" fill="#fff"/>';
    },
    forward: () =>
      '<path d="M26 56 V30 H14 L32 6 L50 30 H38 V56 Z" fill="#ffd24a"/>' +
      '<circle cx="48" cy="48" r="11" fill="#1d1b24" stroke="#ff5a5a" stroke-width="4"/>' +
      '<path d="M40 56 L56 40" stroke="#ff5a5a" stroke-width="4"/>',
    swap: () =>
      '<path d="M8 22 H50 M42 13 L53 22 L42 31" fill="none" stroke="#c58bff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M56 44 H14 M22 35 L11 44 L22 53" fill="none" stroke="#e3c8ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    peace: () =>
      '<circle cx="32" cy="32" r="22" fill="none" stroke="#7be0a0" stroke-width="5"/>' +
      '<path d="M32 10 V54 M32 32 L17 47 M32 32 L47 47" fill="none" stroke="#7be0a0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    sprint: () =>
      '<circle cx="32" cy="48" r="9" fill="#fff" stroke="#8a5200" stroke-width="2"/>' +
      '<path d="M16 32 L32 18 L48 32" fill="none" stroke="#ffb14d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M16 18 L32 4 L48 18" fill="none" stroke="#ffd9a0" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    heavy: () =>
      [0, 45, 90, 135, 180, 225, 270, 315].map(a => arrow(a, '#ffb14d')).join('') +
      '<path d="M24 40 L22 26 L28 32 L32 22 L36 32 L42 26 L40 40 Z" fill="#ffd24a" stroke="#8a6200" stroke-width="1.5" stroke-linejoin="round"/>',
    frozenknight: () => {
      let g = '';
      for (const a of [0, 60, 120]) {
        g += `<g transform="rotate(${a} 32 32)"><path d="M32 6 V58" stroke="#a8c8ff" stroke-width="4" stroke-linecap="round"/>` +
          '<path d="M25 14 L32 20 L39 14 M25 50 L32 44 L39 50" fill="none" stroke="#a8c8ff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g>';
      }
      return g + '<circle cx="32" cy="32" r="12" fill="#1d1b24"/>' +
        '<path d="M28 41 V27 H36 M33 23 L38 27 L33 31" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    },
    kamikaze: () =>
      '<circle cx="29" cy="39" r="19" fill="#2b2b33" stroke="#9a9aa8" stroke-width="2.5"/>' +
      '<path d="M20 31 Q23 26 29 25" fill="none" stroke="#6a6a78" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M40 24 Q48 14 54 16" fill="none" stroke="#d2a86a" stroke-width="3.5" stroke-linecap="round"/>' +
      `<polygon points="${star(55, 13, 8, 3.5, 6)}" fill="#ffd24a"/><circle cx="55" cy="13" r="2.5" fill="#fff"/>`,
    retreat: () =>
      '<path d="M26 8 V34 H13 L32 58 L51 34 H38 V8 Z" fill="#ff8a8a" stroke="#8a2a2a" stroke-width="2" stroke-linejoin="round"/>',
    kbswap: () =>
      '<path d="M8 34 H50 M42 25 L53 34 L42 43" fill="none" stroke="#ff9ec7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M56 54 H14 M22 45 L11 54 L22 63" fill="none" stroke="#ffd0e6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 -4)"/>' +
      '<text x="8" y="24" font-size="22" fill="#fff" font-family="system-ui,sans-serif">♞</text>' +
      '<text x="36" y="24" font-size="22" fill="#fff" font-family="system-ui,sans-serif">♝</text>',
    queenking: () =>
      '<path d="M18 44 L15 24 L26 33 L32 18 L38 33 L49 24 L46 44 Z" fill="#9fd0ff" stroke="#2c5a8a" stroke-width="2" stroke-linejoin="round"/>' +
      '<rect x="18" y="46" width="28" height="6" rx="2.5" fill="#9fd0ff" stroke="#2c5a8a" stroke-width="2"/>' +
      '<path d="M6 6 L14 14 M58 6 L50 14 M6 58 L14 50 M58 58 L50 50" stroke="#ff9a9a" stroke-width="4" stroke-linecap="round"/>',
    pawnrook: () =>
      [0, 90, 180, 270].map(a => arrow(a, '#e0a060')).join('') +
      '<circle cx="32" cy="32" r="9" fill="#fff" stroke="#6a4a22" stroke-width="2"/>' +
      '<rect x="27" y="37" width="10" height="4" rx="2" fill="#6a4a22"/>',
    kingqueen: () =>
      '<path d="M10 46 L6 20 L21 32 L32 10 L43 32 L58 20 L54 46 Z" fill="#ffd24a" stroke="#8a6200" stroke-width="2.5" stroke-linejoin="round"/>' +
      '<rect x="10" y="48" width="44" height="8" rx="3" fill="#ffd24a" stroke="#8a6200" stroke-width="2.5"/>' +
      '<circle cx="6" cy="18" r="3.5" fill="#fff"/><circle cx="32" cy="8" r="3.5" fill="#fff"/><circle cx="58" cy="18" r="3.5" fill="#fff"/>',
  };

  function modIcon(id) {
    const f = ICONS[id];
    return `<svg class="modicon" viewBox="0 0 64 64" aria-hidden="true">${f ? f() : ''}</svg>`;
  }

  root.Art = { pieceSVG, modIcon };
})(window);
