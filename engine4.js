/* Шахматы на четверых: крестообразная доска 14×14 (без угловых квадратов 3×3), четыре команды.
   Правила упрощены: шахов нет, король просто можно побить. Побитый король = игрок выбывает,
   его фигуры становятся серыми (мёртвыми) и остаются на доске как препятствия, которые можно бить.
   Игрок без единого хода тоже выбывает. Побеждает последний оставшийся. Рокировки и взятия на проходе нет. */
(function (root) {
  'use strict';

  const N = 14;
  const ORDER = ['r', 'b', 'y', 'g'];            // красные (снизу), синие (слева), жёлтые (сверху), зелёные (справа); ходят по часовой стрелке
  const FILES = 'abcdefghijklmn';
  const FWD = { r: [0, 1], b: [1, 0], y: [0, -1], g: [-1, 0] };
  const PROMO_DIST = 10;                         // пешка превращается на 11-й линии от своего края
  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const isPlay = (f, r) => f >= 0 && f < N && r >= 0 && r < N && !((f < 3 || f > 10) && (r < 3 || r > 10));
  const idx = (f, r) => r * N + f;
  const sq = i => FILES[i % N] + (Math.floor(i / N) + 1);
  const dist = (c, i) => {
    const f = i % N, r = Math.floor(i / N);
    return c === 'r' ? r : c === 'b' ? f : c === 'y' ? N - 1 - r : N - 1 - f;
  };
  const rot = (f, r, k) => { for (let q = 0; q < k; q++) { const nf = r, nr = N - 1 - f; f = nf; r = nr; } return [f, r]; };

  function initialState() {
    const board = new Array(N * N).fill(null);
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    ORDER.forEach((c, k) => {
      for (let j = 0; j < 8; j++) {
        let [f, r] = rot(3 + j, 0, k); board[idx(f, r)] = c + back[j];
        [f, r] = rot(3 + j, 1, k); board[idx(f, r)] = c + 'P';
      }
    });
    return { board, turn: 'r', alive: { r: true, b: true, y: true, g: true }, half: 0, ply: 0 };
  }

  const aliveCount = s => ORDER.filter(c => s.alive[c]).length;
  const lastAlive = s => ORDER.find(c => s.alive[c]) || null;
  function nextAlive(alive, from) {
    const i = ORDER.indexOf(from);
    for (let k = 1; k <= 4; k++) { const c = ORDER[(i + k) % 4]; if (alive[c]) return c; }
    return from;
  }

  function legalMoves(s) {
    const b = s.board, us = s.turn, out = [];
    for (let i = 0; i < N * N; i++) {
      const p = b[i];
      if (!p || p[0] !== us) continue;
      const t = p[1], f = i % N, r = Math.floor(i / N);
      const add = (to, cap) => out.push({ from: i, to, cap });
      if (t === 'P') {
        const [fx, fy] = FWD[us], nf = f + fx, nr = r + fy;
        const addP = (to, cap) => {
          if (dist(us, to) >= PROMO_DIST) for (const pr of ['q', 'r', 'b', 'n']) out.push({ from: i, to, cap, promo: pr });
          else add(to, cap);
        };
        if (isPlay(nf, nr) && !b[idx(nf, nr)]) {
          addP(idx(nf, nr), false);
          const f2 = f + 2 * fx, r2 = r + 2 * fy;
          if (dist(us, i) === 1 && isPlay(f2, r2) && !b[idx(f2, r2)]) add(idx(f2, r2), false);
        }
        const [px, py] = fx ? [0, 1] : [1, 0];
        for (const sg of [-1, 1]) {
          const cf = nf + px * sg, cr = nr + py * sg;
          if (!isPlay(cf, cr)) continue;
          const q = b[idx(cf, cr)];
          if (q && q[0] !== us) addP(idx(cf, cr), true);
        }
      } else if (t === 'N' || t === 'K') {
        for (const [df, dr] of (t === 'N' ? KN : KG)) {
          const tf = f + df, tr = r + dr;
          if (!isPlay(tf, tr)) continue;
          const q = b[idx(tf, tr)];
          if (!q) add(idx(tf, tr), false);
          else if (q[0] !== us) add(idx(tf, tr), true);
        }
      } else {
        const dirs = t === 'B' ? DIAG : t === 'R' ? ORTH : DIAG.concat(ORTH);
        for (const [df, dr] of dirs) {
          let tf = f + df, tr = r + dr;
          while (isPlay(tf, tr)) {
            const q = b[idx(tf, tr)];
            if (!q) add(idx(tf, tr), false);
            else { if (q[0] !== us) add(idx(tf, tr), true); break; }
            tf += df; tr += dr;
          }
        }
      }
    }
    return out;
  }

  function kill(board, alive, c) {
    alive[c] = false;
    for (let i = 0; i < board.length; i++) if (board[i] && board[i][0] === c) board[i] = 'x' + board[i][1];
  }

  // Передаём ход следующему живому игроку; тот, у кого нет ходов, выбывает.
  function settle(ns, from) {
    let cur = from;
    for (let guard = 0; guard < 6; guard++) {
      if (aliveCount(ns) <= 1) { ns.turn = lastAlive(ns) || from; return ns; }
      cur = nextAlive(ns.alive, cur);
      ns.turn = cur;
      if (legalMoves(ns).length) return ns;
      kill(ns.board, ns.alive, cur);
    }
    return ns;
  }

  function applyMove(s, m) {
    const b = s.board.slice(), us = s.turn, p = b[m.from], target = b[m.to];
    b[m.from] = null;
    b[m.to] = m.promo ? us + m.promo.toUpperCase() : p;
    const alive = Object.assign({}, s.alive);
    if (target && target[1] === 'K' && target[0] !== 'x') kill(b, alive, target[0]);
    return settle({ board: b, turn: us, alive, half: p[1] === 'P' || target ? 0 : s.half + 1, ply: s.ply + 1 }, us);
  }

  // Игрок сдался или вылетел по времени
  function eliminate(s, c) {
    if (!s.alive[c]) return Object.assign({}, s, { ply: s.ply + 1 });
    const b = s.board.slice(), alive = Object.assign({}, s.alive);
    kill(b, alive, c);
    const ns = { board: b, turn: s.turn, alive, half: s.half, ply: s.ply + 1 };
    return s.turn === c ? settle(ns, c) : (aliveCount(ns) <= 1 ? (ns.turn = lastAlive(ns), ns) : ns);
  }

  function status(s) {
    const n = aliveCount(s);
    if (n <= 1) return { winner: lastAlive(s), why: 'last' };
    if (s.half >= 50 * n) return { winner: 'd', why: 'fifty' };
    return null;
  }

  const toUci = m => sq(m.from) + sq(m.to) + (m.promo || '');
  function findMove(s, uci, legal) {
    const mt = /^([a-n])(\d{1,2})([a-n])(\d{1,2})([qrbn])?$/.exec(uci);
    if (!mt) return undefined;
    const from = idx(FILES.indexOf(mt[1]), +mt[2] - 1), to = idx(FILES.indexOf(mt[3]), +mt[4] - 1), promo = mt[5] || undefined;
    return (legal || legalMoves(s)).find(m => m.from === from && m.to === to && m.promo === promo);
  }
  function toSAN(s, m) {
    const p = s.board[m.from], t = p[1], tg = s.board[m.to];
    return (t === 'P' ? '' : t) + sq(m.from) + (m.cap ? 'x' : '-') + sq(m.to) +
      (m.promo ? '=' + m.promo.toUpperCase() : '') + (tg && tg[1] === 'K' && tg[0] !== 'x' ? '#' : '');
  }

  const Chess4 = { N, ORDER, initialState, isPlay, legalMoves, applyMove, eliminate, status, toUci, findMove, toSAN, aliveCount, sq, nextAlive };
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess4;
  else root.Chess4 = Chess4;
})(typeof window !== 'undefined' ? window : globalThis);
