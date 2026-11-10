/* ChessHub: лобби, вызовы, партия, часы, оформление, режим «Хаос». Онлайн через Firebase Realtime Database. */
(() => {
  'use strict';
  const C = window.Chess, Art = window.Art, Snd = window.Snd;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} },
  };

  const VARIANTS = {
    standard: { name: 'Обычные', icon: '♞', desc: 'Классические шахматы' },
    atomic: { name: 'Atomic', icon: '💥', desc: 'Взятие взрывает фигуры вокруг. Взорви короля!' },
    antichess: { name: 'Antichess', icon: '🎯', desc: 'Бить обязательно. Потеряй все фигуры, чтобы победить' },
    chaos: { name: 'Хаос', icon: '🎲', desc: 'Рулетка случайных правил: 10 модификаторов, шахов нет' },
  };
  const MODS = {
    atomic: { name: 'Атомный взрыв', desc: 'Каждое взятие взрывает соседние фигуры (пешки выживают)' },
    antichess: { name: 'Принудиловка', desc: 'Если можно бить, бить обязательно' },
    knights: { name: 'Конная атака', desc: 'Все фигуры, кроме короля, ходят как кони' },
    pawnking: { name: 'Пешки-короли', desc: 'Пешки ходят и бьют на 1 клетку в любую сторону' },
    frozen: { name: 'Ферзи во льду', desc: 'Ферзи не могут ходить' },
    forward: { name: 'Только вперёд', desc: 'Назад ходить нельзя' },
    swap: { name: 'Обмен ролями', desc: 'Слоны ходят как ладьи, а ладьи как слоны' },
    peace: { name: 'Мирное время', desc: 'Бить нельзя, пока есть другие ходы' },
    sprint: { name: 'Спринт пешек', desc: 'Пешки могут шагнуть на 2 клетки с любого места' },
    kingqueen: { name: 'Король-ферзь', desc: 'Король ходит как ферзь' },
  };
  const PIECE_SETS = [['classic', 'Классика'], ['neon', 'Неон'], ['gold', 'Золото и обсидиан']];
  const BOARDS = [['wood', 'Дерево'], ['emerald', 'Изумруд'], ['night', 'Ночь']];
  const PRESETS = [[1, 0], [2, 1], [3, 0], [3, 2], [5, 0], [5, 3], [10, 0], [15, 10], [30, 0]];
  const WHY = {
    checkmate: 'мат', stalemate: 'пат', resign: 'сдача', time: 'время вышло', agreed: 'ничья по соглашению',
    exploded: 'король взорван', kingdown: 'король уничтожен', nopieces: 'потеряны все фигуры',
    nomoves: 'нет ходов (пат — победа)', insufficient: 'недостаточно материала', fifty: 'правило 50 ходов',
    repetition: 'троекратное повторение', aborted: 'партия отменена',
  };
  const SPIN_MS = 2600, HOLD_MS = 1300, FLY_MS = 650;

  const me = {
    uid: store.get('chess_uid') || (() => { const u = rid(); store.set('chess_uid', u); return u; })(),
    name: store.get('chess_name') || ('Гость' + Math.floor(Math.random() * 9000 + 1000)),
  };

  // ---------- Оформление ----------
  const prefs = {
    piece: PIECE_SETS.some(x => x[0] === store.get('chess_piece')) ? store.get('chess_piece') : 'classic',
    board: BOARDS.some(x => x[0] === store.get('chess_board')) ? store.get('chess_board') : 'wood',
  };
  function applyPrefs() {
    document.body.className = 'ps-' + prefs.piece + ' bd-' + prefs.board;
  }

  function buildSettings() {
    const po = $('#pieceOpts'), bo = $('#boardOpts');
    po.innerHTML = ''; bo.innerHTML = '';
    for (const [id, name] of PIECE_SETS) {
      const b = document.createElement('button');
      b.className = 'opt' + (prefs.piece === id ? ' on' : '');
      b.innerHTML = `<div class="prev ps-${id}"><div class="pv light">${Art.pieceSVG('k', 'w')}</div><div class="pv dark">${Art.pieceSVG('q', 'b')}</div></div><span>${name}</span>`;
      b.onclick = () => { prefs.piece = id; store.set('chess_piece', id); applyPrefs(); buildSettings(); };
      po.appendChild(b);
    }
    for (const [id, name] of BOARDS) {
      const b = document.createElement('button');
      b.className = 'opt' + (prefs.board === id ? ' on' : '');
      b.innerHTML = `<div class="prev bprev bd-${id}"><div class="pv light"></div><div class="pv dark">${Art.pieceSVG('n', 'w')}</div>` +
        `<div class="pv light">${Art.pieceSVG('p', 'b')}</div><div class="pv dark"></div></div><span>${name}</span>`;
      b.onclick = () => { prefs.board = id; store.set('chess_board', id); applyPrefs(); buildSettings(); };
      bo.appendChild(b);
    }
    $('#soundOn').checked = Snd.isEnabled();
  }

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
  let finishing = false;
  let snd = { n: null, ended: false };
  const rl = { active: false, lockUntil: 0, spunFor: -1, runId: 0, timers: [] };

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
  const plural = n => (n === 1 ? 'ход' : 'хода');

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

  function buildModList() {
    $('#modList').innerHTML = C.MOD_IDS.map(id =>
      `<div class="modli">${Art.modIcon(id)}<div><b>${esc(MODS[id].name)}</b><small>${esc(MODS[id].desc)}</small></div></div>`).join('');
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
      seed: Math.floor(Math.random() * 2147483647), // по нему у обоих игроков выпадают одинаковые модификаторы Хаоса
      startT: fb.serverTimestamp(),
    });
    openGame(gid);
  }

  function resetGameRuntime() {
    cancelRoulette();
    finishing = false;
    snd = { n: null, ended: false };
    rl.spunFor = -1;
    flipManual = false; sel = null; targets = new Map(); cache = null;
  }

  function startLocal() {
    leaveGame(true);
    resetGameRuntime();
    G = {
      local: true, id: 'local-' + rid(), variant: vSel, tc: null,
      seed: Math.floor(Math.random() * 2147483647),
      white: { name: 'Белые' }, black: { name: 'Чёрные' },
      moves: [], result: null, my: null, drawOffer: null,
    };
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
      id, variant: v.variant, tc: v.tc, white: v.white, black: v.black, startT: v.startT, seed: v.seed | 0,
      moves: mv, result: v.result || null, drawOffer: v.drawOffer || null,
      my: v.white.uid === me.uid ? 'w' : v.black.uid === me.uid ? 'b' : null,
    };
  }

  function openGame(id, resume) {
    leaveGame(true);
    resetGameRuntime();
    resumeCheck = !!resume;
    store.set('chess_game', id);
    G = { id, loading: true, moves: [] };
    showView('game');
    refresh();
    let first = true;
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
      if (first) { // загрузка посреди партии: рулетку для уже сыгранного не крутим
        first = false;
        rl.spunFor = G.moves.length > 0 ? G.moves.length : -1;
      }
      refresh();
    });
  }

  function leaveGame(silent) {
    if (unsubGame) { unsubGame(); unsubGame = null; }
    if (G && !G.local) store.del('chess_game');
    cancelRoulette();
    G = null; cache = null; sel = null; targets = new Map();
    $('#game').classList.remove('chaos');
    if (!silent) { showView('lobby'); renderLobby(); }
  }

  function derive() {
    if (!cache || cache.id !== G.id || G.moves.length < cache.moves.length) {
      const s0 = C.initialState(G.variant, G.seed);
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
  const locked = () => Date.now() < rl.lockUntil;

  // Время хода в Хаосе не включает рулетку: на ходу, с которого начинается цикл, возвращаем SPIN_MS.
  function remaining(color, t) {
    if (!G.tc || !G.tc.t) return Infinity;
    const ms = G.moves, chaos = G.variant === 'chaos';
    const bonus = i => (chaos && i % C.CYCLE === 0 ? SPIN_MS : 0);
    let rem = G.tc.t * 60000;
    for (let i = 2; i < ms.length; i++) {
      if ((i % 2 === 0) === (color === 'w')) rem += G.tc.inc * 1000 - Math.max(0, ms[i].t - ms[i - 1].t - bonus(i));
    }
    const turn = ms.length % 2 === 0 ? 'w' : 'b';
    if (!result() && ms.length >= 2 && turn === color) rem -= Math.max(0, t - ms[ms.length - 1].t - bonus(ms.length));
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

  // ---------- Звуки партии ----------
  function soundNewMoves() {
    const n = cache.moves.length, res = result();
    if (snd.n === null) { snd.n = n; snd.ended = !!res; return; }
    if (n > snd.n) {
      const m = cache.moves[n - 1], prevS = cache.states[n - 1], cur = curState();
      const boom = m.cap && (G.variant === 'atomic' || C.activeMod(prevS) === 'atomic');
      if (boom) Snd.boom(); else if (m.cap) Snd.capture(); else Snd.move();
      const chk = G.variant === 'chaos' ? C.kingAttacked(cur) : (G.variant !== 'antichess' && C.inCheck(cur.board, cur.turn, G.variant));
      if (chk && !res) setTimeout(() => Snd.check(), 150);
    }
    snd.n = n;
    if (res && !snd.ended) {
      snd.ended = true;
      const win = G.local || !G.my || res.winner === 'd' || res.winner === G.my;
      setTimeout(() => Snd.end(win), 350);
    }
  }

  // ---------- Рулетка модификаторов ----------
  function modCard(id) {
    return `<div class="mcard" data-id="${id}">${Art.modIcon(id)}<div class="nm">${esc(MODS[id].name)}</div></div>`;
  }

  function cancelRoulette() {
    rl.runId++;
    rl.timers.forEach(clearTimeout);
    rl.timers = [];
    rl.active = false;
    rl.lockUntil = 0;
    document.querySelectorAll('.mcard.flying').forEach(e => e.remove());
    const strip = $('#rlStrip');
    if (strip) strip.getAnimations().forEach(a => a.cancel());
    const el = $('#roulette');
    if (el) { el.hidden = true; el.className = 'roulette'; }
  }

  function startRoulette(target) {
    cancelRoulette();
    const runId = ++rl.runId;
    rl.active = true;
    rl.lockUntil = Date.now() + SPIN_MS + 80;
    rl.timers.push(setTimeout(() => { if (runId === rl.runId && G) refresh(); }, SPIN_MS + 120));

    const el = $('#roulette'), strip = $('#rlStrip'), view = $('#rlView'), res = $('#rlResult');
    const ids = C.MOD_IDS, T = 32, N = 40;
    const pick = () => ids[Math.floor(Math.random() * ids.length)];
    const seq = [];
    let prev = null;
    for (let i = 0; i < N; i++) {
      let id;
      if (i === T) id = target;
      else do { id = pick(); } while (id === prev || ((i === T - 1 || i === T + 1) && id === target));
      seq.push(id); prev = id;
    }
    strip.innerHTML = seq.map(modCard).join('');
    strip.className = 'rl-strip';
    res.className = 'rl-result'; res.innerHTML = '';
    el.className = 'roulette'; el.hidden = false;

    const cw = strip.firstElementChild.getBoundingClientRect().width;
    const vw = view.clientWidth;
    const dist = T * cw + cw / 2 + (Math.random() - 0.5) * cw * 0.5 - vw / 2;
    const anim = strip.animate(
      [{ transform: 'translateX(0px)' }, { transform: `translateX(${-dist}px)` }],
      { duration: SPIN_MS, easing: 'cubic-bezier(.12,.8,.14,1)', fill: 'forwards' });

    let lastIdx = -1;
    const loop = () => {
      if (runId !== rl.runId) return;
      const m = new DOMMatrix(getComputedStyle(strip).transform);
      const idx = Math.floor((-m.m41 + vw / 2) / cw);
      if (idx !== lastIdx) { if (lastIdx !== -1) Snd.tick(); lastIdx = idx; }
      if (anim.playState === 'running') requestAnimationFrame(loop);
    };
    Snd.spin();
    requestAnimationFrame(loop);
    anim.finished.then(() => revealRoulette(runId, target, T)).catch(() => {});
  }

  function revealRoulette(runId, target, T) {
    if (runId !== rl.runId) return;
    const el = $('#roulette'), strip = $('#rlStrip'), res = $('#rlResult');
    el.classList.add('reveal');
    strip.classList.add('done');
    const card = strip.children[T];
    card.classList.add('win');
    res.innerHTML = `<b>${esc(MODS[target].name)}</b><span>${esc(MODS[target].desc)}</span>`;
    res.classList.add('show');
    Snd.win();
    rl.timers.push(setTimeout(() => flyRoulette(runId, card), HOLD_MS));
  }

  function flyRoulette(runId, card) {
    if (runId !== rl.runId) return;
    const el = $('#roulette');
    const from = card.getBoundingClientRect();
    const bar = $('#modbar').getBoundingClientRect();
    const clone = card.cloneNode(true);
    clone.classList.remove('win');
    clone.classList.add('flying');
    Object.assign(clone.style, {
      position: 'fixed', left: from.left + 'px', top: from.top + 'px', width: from.width + 'px',
      height: from.height + 'px', margin: '0', transformOrigin: 'top left',
    });
    document.body.appendChild(clone);
    el.classList.add('out');
    Snd.whoosh();
    const s = Math.max(0.2, (bar.height - 8) / from.height);
    const dx = bar.left + 6 - from.left, dy = bar.top + 4 - from.top;
    const a = clone.animate(
      [{ transform: 'translate(0,0) scale(1.14)', opacity: 1 }, { transform: `translate(${dx}px,${dy}px) scale(${s})`, opacity: 0.15 }],
      { duration: FLY_MS, easing: 'cubic-bezier(.55,0,.2,1)', fill: 'forwards' });
    a.finished.then(() => {
      clone.remove();
      if (runId !== rl.runId) return;
      rl.active = false;
      el.hidden = true; el.className = 'roulette';
      if (G && !G.loading) {
        renderModbar();
        const bar2 = $('#modbar');
        bar2.classList.add('pulse');
        rl.timers.push(setTimeout(() => bar2.classList.remove('pulse'), 1000));
      }
    }).catch(() => {});
  }

  function maybeSpin() {
    if (G.variant !== 'chaos' || result()) return;
    const ply = cache.moves.length;
    if (ply % C.CYCLE !== 0 || rl.spunFor === ply) return;
    rl.spunFor = ply;
    startRoulette(C.activeMod(curState()));
  }

  function renderModbar() {
    const bar = $('#modbar');
    if (!G || G.loading || G.variant !== 'chaos' || !cache) { bar.hidden = true; return; }
    bar.hidden = false;
    const ply = cache.moves.length, phase = ply % C.CYCLE;
    if (result()) { bar.className = 'modbar off'; bar.innerHTML = '<span class="mi">🎲</span><div class="mt"><b>Хаос</b><small>Партия окончена</small></div>'; return; }
    if (rl.active && phase === 0) {
      bar.className = 'modbar spin';
      bar.innerHTML = '<span class="mi">🎲</span><div class="mt"><b>Рулетка…</b><small>Выбираем модификатор</small></div>';
      return;
    }
    const mod = C.activeMod(curState());
    if (mod) {
      const left = C.MOD_PLIES - phase;
      bar.className = 'modbar on';
      bar.innerHTML = `${Art.modIcon(mod)}<div class="mt"><b>${esc(MODS[mod].name)}</b><small>${esc(MODS[mod].desc)}</small></div>` +
        `<span class="cnt">ещё ${left} ${plural(left)}</span>`;
    } else {
      bar.className = 'modbar cool';
      bar.innerHTML = '<span class="mi">🛡</span><div class="mt"><b>Обычный ход</b><small>Кулдаун: после него снова рулетка</small></div>';
    }
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
    $('#game').classList.toggle('chaos', G.variant === 'chaos');
    if (result() && rl.active) cancelRoulette();
    soundNewMoves();
    maybeSpin();
    if (sel !== null && (!canMove() || !cache.legal.some(m => m.from === sel))) { sel = null; targets = new Map(); }
    renderBoard();
    renderPlayers();
    renderSide();
    renderModbar();
    tick();
  }

  function renderBoard() {
    const cur = curState(), flip = isFlipped();
    const lm = cache.moves[cache.moves.length - 1];
    const prev = cache.states[cache.states.length - 2];
    const v = G.variant;
    let checkSq = -1;
    if (v === 'chaos') { if (C.kingAttacked(cur)) checkSq = C.findKing(cur.board, cur.turn); }
    else if (v !== 'antichess' && C.inCheck(cur.board, cur.turn, v)) checkSq = C.findKing(cur.board, cur.turn);
    const boom = new Set();
    if (lm && lm.cap && prev && (v === 'atomic' || C.activeMod(prev) === 'atomic')) {
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
        if (p) html += Art.pieceSVG(p.toLowerCase(), C.colorOf(p));
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
    if (locked()) return '🎲 Крутится рулетка…';
    const cur = curState();
    const side = cur.turn === 'w' ? 'белых' : 'чёрных';
    let txt = G.my ? (G.my === cur.turn ? 'Ваш ход' : 'Ход соперника') : `Ход ${side}`;
    if (G.variant === 'chaos') {
      if (C.kingAttacked(cur)) txt += ' — королю угрожают!';
    } else if (G.variant !== 'antichess' && C.inCheck(cur.board, cur.turn, G.variant)) txt += ' — шах!';
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

    const mv = $('#moves');
    let html = '';
    for (let i = 0; i < cache.sans.length; i += 2) {
      const last = cache.sans.length - 1;
      html += `<span class="n">${i / 2 + 1}.</span><span class="mv${i === last ? ' cur' : ''}">${esc(cache.sans[i])}</span>` +
        `<span class="mv${i + 1 === last ? ' cur' : ''}">${cache.sans[i + 1] ? esc(cache.sans[i + 1]) : ''}</span>`;
    }
    mv.innerHTML = html;
    mv.scrollTop = mv.scrollHeight;

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
    if (hasClock && !res && !G.local && G.my && G.moves.length >= 2 && !finishing) {
      if (remaining(turn, t) <= 0) {
        finishing = true;
        finish({ winner: C.opp(turn), why: 'time' }).catch(() => { finishing = false; });
      }
    }
  }
  setInterval(tick, 200);

  // ---------- Взаимодействие с доской ----------
  function canMove() {
    if (!G || G.loading || !cache || result() || locked()) return false;
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
      b.innerHTML = Art.pieceSVG(m.promo, color);
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
      const pe = sel === null ? null : sqEls.find(s => +s.dataset.i === i).querySelector('svg.piece');
      if (!pe) return;
      const ghost = pe.cloneNode(true);
      ghost.classList.add('ghost');
      const size = el.getBoundingClientRect().width * 0.95;
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
    applyPrefs();
    // браузеры разрешают звук только после первого касания страницы
    window.addEventListener('pointerdown', () => Snd.unlock(), { once: true, passive: true });
    window.addEventListener('keydown', () => Snd.unlock(), { once: true, passive: true });

    $('#setBtn').onclick = () => { buildSettings(); $('#settings').hidden = false; };
    $('#setClose').onclick = () => { $('#settings').hidden = true; };
    $('#settings').addEventListener('pointerdown', e => { if (e.target.id === 'settings') $('#settings').hidden = true; });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') $('#settings').hidden = true; });
    $('#soundOn').onchange = e => Snd.setEnabled(e.target.checked);

    $('#nameBtn').onclick = async () => {
      const n = (prompt('Ваш ник (до 16 символов):', me.name) || '').trim().slice(0, 16);
      if (!n) return;
      me.name = n; store.set('chess_name', n); setName();
    };
    $('#createBtn').onclick = () => createSeek().catch(e => { console.error(e); toast('Не удалось создать вызов'); });
    $('#cancelBtn').onclick = () => cancelSeek();
    $('#localBtn').onclick = startLocal;
    buildLobbyControls();
    buildModList();
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
