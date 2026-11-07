/* Шахматный движок: обычные шахматы, Atomic, Antichess */
(function (root) {
  'use strict';

  const FILES = 'abcdefgh';
  const opp = c => (c === 'w' ? 'b' : 'w');
  const sqName = i => FILES[i & 7] + ((i >> 3) + 1);
  const parseSq = s => FILES.indexOf(s[0]) + 8 * (s.charCodeAt(1) - 49);
  const colorOf = p => (p === p.toUpperCase() ? 'w' : 'b');
  const onb = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

  const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
  const KG = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  function fromFEN(fen, variant) {
    const [pos, turn, cast, ep, hm, fm] = fen.split(' ');
    const board = new Array(64).fill(null);
    const rows = pos.split('/');
    for (let i = 0; i < 8; i++) {
      let f = 0;
      const r = 7 - i;
      for (const ch of rows[i]) {
        if (/\d/.test(ch)) f += +ch;
        else board[r * 8 + f++] = ch;
      }
    }
    return {
      board,
      turn,
      castling: variant === 'antichess' || cast === '-' ? '' : cast,
      ep: ep === '-' || ep === undefined ? -1 : parseSq(ep),
      half: +hm || 0,
      full: +fm || 1,
      variant: variant || 'standard',
    };
  }

  function initialState(variant) {
    return fromFEN(START_FEN, variant);
  }

  function findKing(b, color) {
    const k = color === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (b[i] === k) return i;
    return -1;
  }

  // Атакует ли сторона `by` клетку sq. В atomic король не атакует (он не может брать).
  function isAttacked(b, sq, by, atomic) {
    const f = sq & 7, r = sq >> 3, W = by === 'w';
    const pr = W ? r - 1 : r + 1;
    if (pr >= 0 && pr < 8) {
      const pc = W ? 'P' : 'p';
      if (f > 0 && b[pr * 8 + f - 1] === pc) return true;
      if (f < 7 && b[pr * 8 + f + 1] === pc) return true;
    }
    const kn = W ? 'N' : 'n';
    for (const [df, dr] of KN) {
      const nf = f + df, nr = r + dr;
      if (onb(nf, nr) && b[nr * 8 + nf] === kn) return true;
    }
    if (!atomic) {
      const k = W ? 'K' : 'k';
      for (const [df, dr] of KG) {
        const nf = f + df, nr = r + dr;
        if (onb(nf, nr) && b[nr * 8 + nf] === k) return true;
      }
    }
    const bq = W ? ['B', 'Q'] : ['b', 'q'];
    const rq = W ? ['R', 'Q'] : ['r', 'q'];
    for (const [df, dr] of DIAG) {
      let nf = f + df, nr = r + dr;
      while (onb(nf, nr)) {
        const p = b[nr * 8 + nf];
        if (p) { if (p === bq[0] || p === bq[1]) return true; break; }
        nf += df; nr += dr;
      }
    }
    for (const [df, dr] of ORTH) {
      let nf = f + df, nr = r + dr;
      while (onb(nf, nr)) {
        const p = b[nr * 8 + nf];
        if (p) { if (p === rq[0] || p === rq[1]) return true; break; }
        nf += df; nr += dr;
      }
    }
    return false;
  }

  function inCheck(b, color, variant) {
    if (variant === 'antichess') return false;
    const ks = findKing(b, color);
    if (ks < 0) return false;
    const them = opp(color);
    if (variant === 'atomic') {
      const ek = findKing(b, them);
      // когда короли рядом, шахов нет
      if (ek >= 0 && Math.abs((ks & 7) - (ek & 7)) <= 1 && Math.abs((ks >> 3) - (ek >> 3)) <= 1) return false;
      return isAttacked(b, ks, them, true);
    }
    return isAttacked(b, ks, them, false);
  }

  function pseudoMoves(s) {
    const b = s.board, us = s.turn, them = opp(us), v = s.variant;
    const anti = v === 'antichess', atomic = v === 'atomic';
    const out = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== us) continue;
      const t = p.toLowerCase(), f = i & 7, r = i >> 3;
      if (t === 'p') {
        const dir = us === 'w' ? 1 : -1, start = us === 'w' ? 1 : 6, last = us === 'w' ? 7 : 0, r1 = r + dir;
        if (r1 < 0 || r1 > 7) continue;
        const push = (to, cap, ep) => {
          if (r1 === last) {
            for (const pr of (anti ? ['q', 'r', 'b', 'n', 'k'] : ['q', 'r', 'b', 'n'])) out.push({ from: i, to, promo: pr, cap });
          } else out.push({ from: i, to, cap, ep });
        };
        if (!b[r1 * 8 + f]) {
          push(r1 * 8 + f, false, false);
          if (r === start && !b[(r + 2 * dir) * 8 + f]) out.push({ from: i, to: (r + 2 * dir) * 8 + f, cap: false, dbl: true });
        }
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (nf < 0 || nf > 7) continue;
          const to = r1 * 8 + nf;
          if (b[to] && colorOf(b[to]) === them) push(to, true, false);
          else if (!b[to] && to === s.ep) push(to, true, true);
        }
      } else if (t === 'n' || t === 'k') {
        for (const [df, dr] of (t === 'n' ? KN : KG)) {
          const nf = f + df, nr = r + dr;
          if (!onb(nf, nr)) continue;
          const to = nr * 8 + nf, q = b[to];
          if (!q) out.push({ from: i, to, cap: false });
          else if (colorOf(q) === them) out.push({ from: i, to, cap: true });
        }
      } else {
        const dirs = t === 'b' ? DIAG : t === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [df, dr] of dirs) {
          let nf = f + df, nr = r + dr;
          while (onb(nf, nr)) {
            const to = nr * 8 + nf, q = b[to];
            if (!q) out.push({ from: i, to, cap: false });
            else { if (colorOf(q) === them) out.push({ from: i, to, cap: true }); break; }
            nf += df; nr += dr;
          }
        }
      }
    }
    // рокировка
    if (!anti && s.castling) {
      const rank = us === 'w' ? 0 : 7, ks = rank * 8 + 4;
      const K = us === 'w' ? 'K' : 'k', R = us === 'w' ? 'R' : 'r';
      if (b[ks] === K) {
        const att = sq => isAttacked(b, sq, them, atomic);
        if (s.castling.includes(us === 'w' ? 'K' : 'k') && b[ks + 3] === R && !b[ks + 1] && !b[ks + 2] &&
            !att(ks) && !att(ks + 1) && !att(ks + 2)) {
          out.push({ from: ks, to: ks + 2, cap: false, castle: 'K' });
        }
        if (s.castling.includes(us === 'w' ? 'Q' : 'q') && b[ks - 4] === R && !b[ks - 1] && !b[ks - 2] && !b[ks - 3] &&
            !att(ks) && !att(ks - 1) && !att(ks - 2)) {
          out.push({ from: ks, to: ks - 2, cap: false, castle: 'Q' });
        }
      }
    }
    return out;
  }

  function applyMove(s, m) {
    const b = s.board.slice(), us = s.turn;
    const p = b[m.from];
    if (m.ep) b[m.to + (us === 'w' ? -8 : 8)] = null;
    b[m.from] = null;
    b[m.to] = m.promo ? (us === 'w' ? m.promo.toUpperCase() : m.promo) : p;
    if (m.castle === 'K') { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = null; }
    else if (m.castle === 'Q') { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = null; }
    if (s.variant === 'atomic' && m.cap) {
      b[m.to] = null; // бьющая фигура взрывается
      const f = m.to & 7, r = m.to >> 3;
      for (let dr = -1; dr <= 1; dr++) {
        for (let df = -1; df <= 1; df++) {
          const nf = f + df, nr = r + dr;
          if (!onb(nf, nr)) continue;
          const idx = nr * 8 + nf, q = b[idx];
          if (q && q.toLowerCase() !== 'p') b[idx] = null; // пешки взрыв переживают
        }
      }
    }
    let c = s.castling;
    const map = { 0: 'Q', 4: 'KQ', 7: 'K', 56: 'q', 60: 'kq', 63: 'k' };
    for (const sq of [m.from, m.to]) if (map[sq]) for (const ch of map[sq]) c = c.replace(ch, '');
    return {
      board: b,
      turn: opp(us),
      castling: c,
      ep: m.dbl ? (m.from + m.to) / 2 : -1,
      half: p.toLowerCase() === 'p' || m.cap ? 0 : s.half + 1,
      full: s.full + (us === 'b' ? 1 : 0),
      variant: s.variant,
    };
  }

  function legalMoves(s) {
    const v = s.variant, us = s.turn, them = opp(us);
    const ms = pseudoMoves(s);
    if (v === 'antichess') {
      const caps = ms.filter(m => m.cap);
      return caps.length ? caps : ms;
    }
    const out = [];
    for (const m of ms) {
      const b = applyMove(s, m).board;
      if (v === 'atomic') {
        if (findKing(b, us) < 0) continue;         // нельзя взрывать своего короля
        if (findKing(b, them) < 0) { out.push(m); continue; } // взрыв короля соперника — победа
      }
      if (inCheck(b, us, v)) continue;
      out.push(m);
    }
    return out;
  }

  function key(s) {
    return s.board.map(x => x || '.').join('') + s.turn + s.castling + s.ep;
  }

  function status(s, keys) {
    const v = s.variant, us = s.turn, them = opp(us), b = s.board;
    if (v === 'atomic') {
      if (findKing(b, 'w') < 0) return { winner: 'b', why: 'exploded' };
      if (findKing(b, 'b') < 0) return { winner: 'w', why: 'exploded' };
    }
    const moves = legalMoves(s);
    if (!moves.length) {
      if (v === 'antichess') {
        const has = b.some(p => p && colorOf(p) === us);
        return { winner: us, why: has ? 'nomoves' : 'nopieces' };
      }
      if (inCheck(b, us, v)) return { winner: them, why: 'checkmate' };
      return { winner: 'd', why: 'stalemate' };
    }
    if (v !== 'antichess') {
      const rest = b.filter(p => p && p.toLowerCase() !== 'k');
      if (!rest.length) return { winner: 'd', why: 'insufficient' };
      if (v === 'standard' && rest.length === 1 && 'nb'.includes(rest[0].toLowerCase())) return { winner: 'd', why: 'insufficient' };
    }
    if (s.half >= 100) return { winner: 'd', why: 'fifty' };
    if (keys) {
      const k = key(s);
      let n = 0;
      for (const x of keys) if (x === k) n++;
      if (n >= 3) return { winner: 'd', why: 'repetition' };
    }
    return null;
  }

  const toUci = m => sqName(m.from) + sqName(m.to) + (m.promo || '');

  function findMove(s, uci, legal) {
    const from = parseSq(uci.slice(0, 2)), to = parseSq(uci.slice(2, 4)), promo = uci[4] || undefined;
    return (legal || legalMoves(s)).find(m => m.from === from && m.to === to && m.promo === promo);
  }

  function toSAN(s, m, legal) {
    const p = s.board[m.from], t = p.toUpperCase();
    let san;
    if (m.castle) san = m.castle === 'K' ? 'O-O' : 'O-O-O';
    else if (t === 'P') {
      san = (m.cap ? FILES[m.from & 7] + 'x' : '') + sqName(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
    } else {
      let dis = '';
      const others = (legal || legalMoves(s)).filter(o => o !== m && s.board[o.from] === p && o.to === m.to);
      if (others.length) {
        const sameF = others.some(o => (o.from & 7) === (m.from & 7));
        const sameR = others.some(o => (o.from >> 3) === (m.from >> 3));
        if (!sameF) dis = FILES[m.from & 7];
        else if (!sameR) dis = String((m.from >> 3) + 1);
        else dis = sqName(m.from);
      }
      san = t + dis + (m.cap ? 'x' : '') + sqName(m.to);
    }
    const n = applyMove(s, m);
    if (n.variant !== 'antichess') {
      const st = status(n);
      if (st && st.why === 'checkmate') san += '#';
      else if (inCheck(n.board, n.turn, n.variant)) san += '+';
    }
    return san;
  }

  function perft(s, d) {
    if (d === 0) return 1;
    const ms = legalMoves(s);
    if (d === 1) return ms.length;
    let n = 0;
    for (const m of ms) n += perft(applyMove(s, m), d - 1);
    return n;
  }

  const Chess = {
    initialState, fromFEN, legalMoves, applyMove, status, toSAN, toUci, findMove,
    inCheck, findKing, sqName, parseSq, colorOf, perft, key, opp,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Chess;
  else root.Chess = Chess;
})(typeof window !== 'undefined' ? window : globalThis);
