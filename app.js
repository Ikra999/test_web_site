/* ChessHub: лобби, вызовы, партия, часы. Онлайн через Firebase Realtime Database. */
(() => {
  'use strict';
  const C = window.Chess;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} },
  };

  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const VARIANTS = {
    standard: { name: 'Обычные', icon: '♞', desc: 'Классические шахматы' },
    atomic: { name: 'Atomic', icon: '💥', desc: 'Взятие взрывает фигуры вокруг. Взорви короля!' },
    antichess: { name: 'Antichess', icon: '🎯', desc: 'Бить обязательно. Потеряй все фигуры, чтобы победить' },
  };
  const PRESETS = [[1, 0], [2, 1], [3, 0], [3, 2], [5, 0], [5, 3], [10, 0], [15, 10], [30, 0]];
  const WHY = {
    checkmate: 'мат', stalemate: 'пат', resign: 'сдача', time: 'время вышло', agreed: 'ничья по соглашению',
    exploded: 'король взорван', nopieces: 'потеряны все фигуры', nomoves: 'нет ходов (пат — победа)',
    insufficient: 'недостаточно материала', fifty: 'правило 50 ходов', repetition: 'троекратное повторение',
    aborted: 'партия отменена',
  };

  const me = {
    uid: store.get('chess_uid') || (() => { const u = rid(); store.set('chess_uid', u); return u; })(),
    name: store.get('chess_name') || ('Гость' + Math.floor(Math.random() * 9000 + 1000)),
  };

  // ---------- Firebase ----------
  let fb = null, db = null, offset = 0;
  const R = p => fb.ref(db, p);

  async function initFirebase() {
    const cfg = window.FIREBASE_CONFIG;
    if (!cfg || !cfg.databaseURL || !cfg.apiKey) return false;
    try {
      const appMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
      fb = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js');
      db = fb.getDatabase(appMod.initializeApp(cfg));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }
  const now = () => Date.now() + offset;

  // ---------- Состояние ----------
  let online = false;
  let vSel = 'standard', pSel = 4, cSel = 'random';
  let seeks = {};
  let G = null;                // текущая партия
  let unsubGame = null;
  let sel = null, targets = new Map();
  let flipManual = false;
  let cache = null;
  let drag = null;
  let resumeCheck = false;

  // ---------- Вспомогательное ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }
  const tcLabel = tc => (tc && tc.t ? `${tc.t}+${tc.inc}` : 'без часов');
  function fmtClock(ms) {
    if (!isFinite(ms)) return '∞';
    if (ms <= 0) return '0:00';
    if (ms < 10000) return (ms / 1000).toFixed(1);
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function showView(v) {
    $('#lobby').hidden = v !== 'lobby';
    $('#game').hidden = v !== 'game';
  }

  // ---------- Лобби ----------
  function buildLobbyControls() {
    const vc = $('#variantCards');
    vc.innerHTML = '';
    for (const [k, v] of Object.entries(VARIANTS)) {
      const b = document.createElement('button');
      b.className = 'vcard' + (k === vSel ? ' on' : '');
      b.dataset.v = k;
      b.innerHTML = `<span class="ic">${v.icon}</span><b>${v.name}</b><small>${v.desc}</small>`;
      b.onclick = () => { vSel = k; buildLobbyControls(); };
      vc.appendChild(b);
    }
    const pr = $('#presets');
    pr.innerHTML = '';
    PRESETS.forEach(([t, inc], i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === pSel ? ' on' : '');
      b.textContent = `${t}+${inc}`;
      b.onclick = () => { pSel = i; buildLobbyControls(); };
      pr.appendChild(b);
    });
    document.querySelectorAll('#colorSel button').forEach(b => {
      b.classList.toggle('on', b.dataset.c === cSel);
      b.onclick = () => { cSel = b.dataset.c; buildLobbyControls(); };
    });
  }

  function renderLobby() {
    const mine = seeks[me.uid];
    const waiting = !!(mine && !mine.game);
    $('#waiting').hidden = !waiting;
    $('#cancelBtn').hidden = !waiting;
    $('#createBtn').hidden = waiting;
    $('#createBtn').disabled = !online;

    const tb = $('#seekTable tbody');
    tb.innerHTML = '';
    const list = Object.entries(seeks)
      .filter(([, s]) => s && !s.game && (!s.created || now() - s.created < 30 * 60 * 1000))
      .sort((a, b) => (b[1].created || 0) - (a[1].created || 0));
    for (const [id, s] of list) {
      const isMine = s.uid === me.uid;
      const dot = s.color === 'w' ? 'w' : s.color === 'b' ? 'b' : 'r';
      const tr = document.createElement('tr');
      if (isMine) tr.className = 'mine';
      tr.innerHTML = `<td>${esc(s.name)}</td><td>${esc(VARIANTS[s.variant] ? VARIANTS[s.variant].name : s.variant)}</td>` +
        `<td>${s.t}+${s.inc}</td><td><span class="dot ${dot}"></span></td><td></td>`;
      const btn = document.createElement('button');
      if (isMine) { btn.textContent = 'Ваш вызов'; btn.disabled = true; }
      else { btn.textContent = 'Играть'; btn.className = 'primary'; btn.onclick = () => acceptSeek(id); }
      tr.lastChild.appendChild(btn);
      tb.appendChild(tr);
    }
    $('#noSeeks').hidden = list.length > 0;
    $('#seekTable').hidden = list.length === 0;
  }

  async function createSeek() {
    if (!online) return;
    const [t, inc] = PRESETS[pSel];
    const r = R('seeks/' + me.uid);
    await fb.set(r, { uid: me.uid, name: me.name, variant: vSel, t, inc, color: cSel, created: fb.serverTimestamp() });
    fb.onDisconnect(r).remove();
  }

  async function cancelSeek() {
    const r = R('seeks/' + me.uid);
    fb.onDisconnect(r).cancel();
    await fb.remove(r);
  }

  async function acceptSeek(sid) {
    const sk = seeks[sid];
    if (!sk || sk.uid === me.uid || sk.game) return;
    const gid = fb.push(R('games')).key;
    const res = await fb.runTransaction(R('seeks/' + sid), cur => {
      if (!cur || cur.game) return undefined;
      cur.game = gid;
      return cur;
    });
    if (!res.committed) { toast('Этот вызов уже принят или отменён'); return; }
    const seekerWhite = sk.color === 'w' ? true : sk.color === 'b' ? false : Math.random() < 0.5;
    const seeker = { uid: sk.uid, name: sk.name };
    const meP = { uid: me.uid, name: me.name };
    await fb.set(R('games/' + gid), {
      variant: sk.variant,
      tc: { t: sk.t, inc: sk.inc },
      white: seekerWhite ? seeker : meP,
      black: seekerWhite ? meP : seeker,
      startT: fb.serverTimestamp(),
    });
    openGame(gid);
  }

  function startLocal() {
    const [t] = PRESETS[pSel];
    leaveGame(true);
    G = {
      local: true, id: 'local-' + rid(), variant: vSel, tc: null,
      white: { name: 'Белые' }, black: { name: 'Чёрные' },
      moves: [], result: null, my: null, drawOffer: null,
    };
    flipManual = false; sel = null; targets = new Map(); cache = null;
    showView('game');
    refresh();
  }

  // ---------- Партия ----------
  function normalize(v, id) {
    let mv = [];
    if (v.moves) {
      mv = Array.isArray(v.moves) ? v.moves : Object.keys(v.moves).sort((a, b) => a - b).map(k => v.moves[k]);
      mv = mv.filter(Boolean);
    }
    return {
      id, variant: v.variant, tc: v.tc, white: v.white, black: v.black, startT: v.startT,
      moves: mv, result: v.result || null, drawOffer: v.drawOffer || null,
      my: v.white.uid === me.uid ? 'w' : v.black.uid === me.uid ? 'b' : null,
    };
  }

  function openGame(id, resume) {
    leaveGame(true);
    resumeCheck = !!resume;
    store.set('chess_game', id);
    flipManual = false; sel = null; targets = new Map(); cache = null;
    G = { id, loading: true, moves: [] };
    showView('game');
    refresh();
    unsubGame = fb.onValue(R('games/' + id), snap => {
      const v = snap.val();
      if (!v) {
        if (resumeCheck) { leaveGame(); return; }
        refresh();
        return;
      }
      if (resumeCheck) {
        resumeCheck = false;
        if (v.result) { leaveGame(); return; }
      }
      G = normalize(v, id);
      refresh();
    });
  }

  function leaveGame(silent) {
    if (unsubGame) { unsubGame(); unsubGame = null; }
    if (G && !G.local) store.del('chess_game');
    G = null; cache = null; sel = null; targets = new Map();
    if (!silent) { showView('lobby'); renderLobby(); }
  }

  function derive() {
    if (!cache || cache.id !== G.id || G.moves.length < cache.moves.length) {
      const s0 = C.initialState(G.variant);
      cache = { id: G.id, states: [s0], keys: [C.key(s0)], sans: [], moves: [], evalN: -1, legal: [], pos: null };
    }
    while (cache.moves.length < G.moves.length) {
      const s = cache.states[cache.states.length - 1];
      const legal = C.legalMoves(s);
      const m = C.findMove(s, G.moves[cache.moves.length].m, legal);
      if (!m) break; // недопустимый ход игнорируем
      cache.sans.push(C.toSAN(s, m, legal));
      const n = C.applyMove(s, m);
      cache.states.push(n); cache.keys.push(C.key(n)); cache.moves.push(m);
    }
    if (cache.evalN !== cache.states.length) {
      const cur = cache.states[cache.states.length - 1];
      cache.legal = C.legalMoves(cur);
      cache.pos = C.status(cur, cache.keys);
      cache.evalN = cache.states.length;
    }
  }

  const curState = () => cache.states[cache.states.length - 1];
  const result = () => (G.result || (cache && cache.pos) || null);
  const isFlipped = () => (G.my === 'b') !== flipManual;

  function remaining(color, t) {
    if (!G.tc || !G.tc.t) return Infinity;
    const ms = G.moves;
    let rem = G.tc.t * 60000;
    for (let i = 2; i < ms.length; i++) {
      if ((i % 2 === 0) === (color === 'w')) rem += G.tc.inc * 1000 - (ms[i].t - ms[i - 1].t);
    }
    const turn = ms.length % 2 === 0 ? 'w' : 'b';
    if (!result() && ms.length >= 2 && turn === color) rem -= t - ms[ms.length - 1].t;
    return rem;
  }

  async function finish(res) {
    if (G.local) { G.result = res; refresh(); return; }
    await fb.runTransaction(R('games/' + G.id + '/result'), cur => (cur === null ? res : undefined));
  }

  async function submitMove(m) {
    const uci = C.toUci(m);
    if (G.local) { G.moves.push({ m: uci, t: Date.now() }); refresh(); return; }
    const n = G.moves.length;
    await fb.update(R('games/' + G.id), { ['moves/' + n]: { m: uci, t: fb.serverTimestamp() }, drawOffer: null });
  }

  // ---------- Отрисовка партии ----------
  const sqEls = [];
  const boardEl = $('#board');
  for (let i = 0; i < 64; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    boardEl.appendChild(d);
    sqEls.push(d);
  }

  function refresh() {
    if (!G) return;
    if (G.loading) {
      $('#status').textContent = 'Загрузка партии…';
      $('#status').className = 'status';
      $('#controls').innerHTML = '<button id="bLobby">В лобби</button>';
      $('#bLobby').onclick = () => leaveGame();
      return;
    }
    derive();
    if (sel !== null && (!canMove() || !cache.legal.some(m => m.from === sel))) { sel = null; targets = new Map(); }
    renderBoard();
    renderPlayers();
    renderSide();
    tick();
  }

  function renderBoard() {
    const cur = curState(), flip = isFlipped();
    const res = result();
    const lm = cache.moves[cache.moves.length - 1];
    const prev = cache.states[cache.states.length - 2];
    const v = G.variant;
    const checkSq = (!res || res.why !== 'checkmate' || true) && v !== 'antichess' && C.inCheck(cur.board, cur.turn, v) ? C.findKing(cur.board, cur.turn) : -1;
    const boom = new Set();
    if (v === 'atomic' && lm && lm.cap && prev) {
      boom.add(lm.to);
      for (let i = 0; i < 64; i++) if (prev.board[i] && !cur.board[i] && i !== lm.from) boom.add(i);
    }
    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const r = flip ? vr : 7 - vr, f = flip ? 7 - vc : vc, i = r * 8 + f;
        const el = sqEls[vr * 8 + vc];
        el.dataset.i = i;
        let cls = 'sq ' + ((r + f) % 2 === 0 ? 'dark' : 'light');
        if (lm && (i === lm.from || i === lm.to)) cls += ' last';
        if (i === sel) cls += ' sel';
        if (i === checkSq) cls += ' check';
        if (boom.has(i)) cls += ' boom';
        el.className = cls;
        let html = '';
        if (vc === 0) html += `<span class="co r">${r + 1}</span>`;
        if (vr === 7) html += `<span class="co f">${'abcdefgh'[f]}</span>`;
        const p = cur.board[i];
        if (targets.has(i)) html += `<i class="hint${p || targets.get(i)[0].ep ? ' cap' : ''}"></i>`;
        if (p) html += `<span class="piece ${C.colorOf(p)}">${GLYPH[p.toLowerCase()]}︎</span>`;
        el.innerHTML = html;
      }
    }
  }

  function renderPlayers() {
    const bottom = isFlipped() ? 'b' : 'w', top = C.opp(bottom);
    const mk = (el, color) => {
      const p = color === 'w' ? G.white : G.black;
      const you = G.my === color ? ' (вы)' : '';
      el.innerHTML = `<span class="pdot ${color}"></span><span class="pname">${esc(p.name)}${you}</span><span class="clock" data-c="${color}">—</span>`;
    };
    mk($('#topPlayer'), top);
    mk($('#bottomPlayer'), bottom);
  }

  function statusLine() {
    const res = result();
    if (res) {
      let head;
      if (res.winner === 'd') head = 'Ничья';
      else if (res.winner === 'x') head = 'Партия отменена';
      else if (G.my) head = res.winner === G.my ? 'Вы победили!' : 'Вы проиграли';
      else head = (res.winner === 'w' ? 'Белые' : 'Чёрные') + ' победили';
      return `${head} — ${WHY[res.why] || res.why}`;
    }
    const cur = curState();
    const side = cur.turn === 'w' ? 'белых' : 'чёрных';
    let txt = G.my ? (G.my === cur.turn ? 'Ваш ход' : 'Ход соперника') : `Ход ${side}`;
    if (G.variant !== 'antichess' && C.inCheck(cur.board, cur.turn, G.variant)) txt += ' — шах!';
    if (G.variant === 'antichess' && cache.legal.length && cache.legal[0].cap) txt += ' — нужно бить';
    return txt;
  }

  function renderSide() {
    const v = VARIANTS[G.variant];
    $('#gameInfo').innerHTML = `${v.icon} ${v.name} • ${tcLabel(G.tc)}<small>${G.local ? 'Локальная партия' : G.my ? '' : 'Вы наблюдаете'}</small>`;
    const res = result();
    const st = $('#status');
    st.textContent = statusLine();
    st.className = 'status' + (res ? ' over' : '');

    // ходы
    const mv = $('#moves');
    let html = '';
    for (let i = 0; i < cache.sans.length; i += 2) {
      const last = cache.sans.length - 1;
      html += `<span class="n">${i / 2 + 1}.</span><span class="mv${i === last ? ' cur' : ''}">${esc(cache.sans[i])}</span>` +
        `<span class="mv${i + 1 === last ? ' cur' : ''}">${cache.sans[i + 1] ? esc(cache.sans[i + 1]) : ''}</span>`;
    }
    mv.innerHTML = html;
    mv.scrollTop = mv.scrollHeight;

    // кнопки
    const ctrl = $('#controls');
    const player = G.local || G.my;
    let b = '<button id="bFlip">⇅ Перевернуть</button>';
    if (!res && G.my && !G.local) {
      if (G.drawOffer && G.drawOffer !== G.my) {
        b += '<button id="bAcceptDraw" class="primary">Принять ничью</button><button id="bDeclineDraw">Отклонить</button>';
      } else if (G.drawOffer === G.my) {
        b += '<button disabled>Ничья предложена</button>';
      } else if (G.moves.length >= 2) {
        b += '<button id="bDraw">½ Предложить ничью</button>';
      }
      b += G.moves.length < 2 ? '<button id="bAbort" class="danger">Отменить партию</button>' : '<button id="bResign" class="danger">Сдаться</button>';
    }
    if (!res && G.local) b += '<button id="bResignW" class="danger">Белые сдаются</button><button id="bResignB" class="danger">Чёрные сдаются</button>';
    if (res || !player || G.local) b += '<button id="bLobby" class="primary">В лобби</button>';
    ctrl.innerHTML = b;
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('bFlip', () => { flipManual = !flipManual; refresh(); });
    on('bLobby', () => leaveGame());
    on('bResign', () => { if (confirm('Сдаться?')) finish({ winner: C.opp(G.my), why: 'resign' }); });
    on('bResignW', () => finish({ winner: 'b', why: 'resign' }));
    on('bResignB', () => finish({ winner: 'w', why: 'resign' }));
    on('bAbort', () => finish({ winner: 'x', why: 'aborted' }));
    on('bDraw', () => fb.set(R('games/' + G.id + '/drawOffer'), G.my));
    on('bDeclineDraw', () => fb.set(R('games/' + G.id + '/drawOffer'), null));
    on('bAcceptDraw', () => finish({ winner: 'd', why: 'agreed' }));
  }

  function tick() {
    if (!G || G.loading || !cache) return;
    const t = now();
    const res = result();
    const turn = G.moves.length % 2 === 0 ? 'w' : 'b';
    const hasClock = G.tc && G.tc.t;
    for (const el of document.querySelectorAll('.clock')) {
      const c = el.dataset.c;
      if (!hasClock) { el.textContent = '—'; continue; }
      const rem = remaining(c, t);
      el.textContent = fmtClock(rem);
      el.classList.toggle('active', !res && G.moves.length >= 2 && turn === c);
      el.classList.toggle('low', rem < 20000 && rem > -1 && !res);
    }
    if (hasClock && !res && !G.local && G.my && G.moves.length >= 2 && !G._finishing) {
      if (remaining(turn, t) <= 0) {
        G._finishing = true;
        finish({ winner: C.opp(turn), why: 'time' }).catch(() => { G._finishing = false; });
      }
    }
  }
  setInterval(tick, 200);

  // ---------- Взаимодействие с доской ----------
  function canMove() {
    if (!G || G.loading || !cache || result()) return false;
    return G.local || G.my === curState().turn;
  }

  function select(i) {
    sel = i; targets = new Map();
    if (i !== null) {
      for (const m of cache.legal) {
        if (m.from !== i) continue;
        if (!targets.has(m.to)) targets.set(m.to, []);
        targets.get(m.to).push(m);
      }
      if (!targets.size) sel = null;
    }
    renderBoard();
  }

  function tryMove(from, to) {
    const arr = (sel === from && targets.get(to)) || cache.legal.filter(m => m.from === from && m.to === to);
    if (!arr || !arr.length) { select(null); return; }
    if (arr[0].promo) showPromo(arr);
    else doMove(arr[0]);
  }

  function doMove(m) {
    sel = null; targets = new Map();
    submitMove(m);
  }

  function showPromo(arr) {
    const color = curState().turn;
    const box = $('#promoChoices');
    box.innerHTML = '';
    for (const m of arr) {
      const b = document.createElement('button');
      b.className = color;
      b.textContent = GLYPH[m.promo] + '︎';
      b.onclick = () => { $('#promo').hidden = true; doMove(m); };
      box.appendChild(b);
    }
    $('#promo').hidden = false;
  }
  $('#promo').addEventListener('pointerdown', e => {
    if (e.target.id === 'promo') { $('#promo').hidden = true; select(null); }
  });

  boardEl.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.target.closest('.sq');
    if (!el || !G || !canMove()) return;
    const i = +el.dataset.i;
    if (sel !== null && targets.has(i)) { tryMove(sel, i); return; }
    const p = curState().board[i];
    if (p && C.colorOf(p) === curState().turn) {
      select(i);
      const pe = sqEls.find(s => +s.dataset.i === i).querySelector('.piece');
      if (!pe || sel === null) return;
      const ghost = pe.cloneNode(true);
      ghost.classList.add('ghost');
      const size = el.getBoundingClientRect().width;
      ghost.style.width = ghost.style.height = size + 'px';
      document.body.appendChild(ghost);
      drag = { from: i, ghost, moved: false, sx: e.clientX, sy: e.clientY };
      el.classList.add('dragging');
      moveGhost(e);
      e.preventDefault();
    } else select(null);
  });
  function moveGhost(e) {
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
  }
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    moveGhost(e);
  });
  window.addEventListener('pointerup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    d.ghost.remove();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const sqEl = under && under.closest && under.closest('.sq');
    const to = sqEl && boardEl.contains(sqEl) ? +sqEl.dataset.i : null;
    if (to !== null && to !== d.from && d.moved) tryMove(d.from, to);
    else renderBoard();
  });
  window.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag.ghost.remove(); drag = null; renderBoard();
  });

  // ---------- Инициализация ----------
  function setName() {
    $('#nameBtn').textContent = '👤 ' + me.name;
  }

  async function init() {
    setName();
    $('#theme').value = store.get('chess_theme') || 'brown';
    document.body.className = 'theme-' + $('#theme').value;
    $('#theme').onchange = e => {
      document.body.className = 'theme-' + e.target.value;
      store.set('chess_theme', e.target.value);
    };
    $('#nameBtn').onclick = async () => {
      const n = (prompt('Ваш ник (до 16 символов):', me.name) || '').trim().slice(0, 16);
      if (!n) return;
      me.name = n; store.set('chess_name', n); setName();
    };
    $('#createBtn').onclick = () => createSeek().catch(e => { console.error(e); toast('Не удалось создать вызов'); });
    $('#cancelBtn').onclick = () => cancelSeek();
    $('#localBtn').onclick = startLocal;
    buildLobbyControls();
    showView('lobby');

    online = await initFirebase();
    $('#setupBanner').hidden = online;
    $('#online').hidden = !online;
    renderLobby();
    if (!online) return;

    fb.onValue(R('.info/serverTimeOffset'), s => { offset = s.val() || 0; });

    // присутствие
    const pr = R('online/' + me.uid);
    fb.onValue(R('.info/connected'), s => {
      if (s.val()) { fb.onDisconnect(pr).remove(); fb.set(pr, true); }
    });
    fb.onValue(R('online'), s => {
      const n = Object.keys(s.val() || {}).length;
      $('#online').textContent = n + ' онлайн';
    });

    // вызовы
    fb.onValue(R('seeks'), s => {
      seeks = s.val() || {};
      const mine = seeks[me.uid];
      if (mine && mine.game && !(G && G.id === mine.game)) {
        const r = R('seeks/' + me.uid);
        fb.onDisconnect(r).cancel();
        fb.remove(r);
        openGame(mine.game);
      }
      if (!G) renderLobby();
    });

    // продолжить незавершённую партию
    const saved = store.get('chess_game');
    if (saved) openGame(saved, true);
  }

  init();
})();
