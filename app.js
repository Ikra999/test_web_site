/* ChessHub: лобби, вызовы, партия, часы, оформление, режим «Хаос». Онлайн через Firebase Realtime Database. */
(() => {
  'use strict';
  const C = window.Chess, C4 = window.Chess4, Art = window.Art, Snd = window.Snd;
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
    chaos: { name: 'Хаос', icon: '🎲', desc: 'Рулетка случайных правил: ' + C.MOD_IDS.length + ' модификаторов, шахов нет' },
    four: { name: '4 игрока', icon: '👥', desc: 'Четыре команды на крестообразной доске. Только онлайн, последний король побеждает' },
  };
  const CN = { r: 'Красные', b: 'Синие', y: 'Жёлтые', g: 'Зелёные' };          // кто победил / кто выбыл
  const CNI = { r: 'красными', b: 'синими', y: 'жёлтыми', g: 'зелёными' };     // «вы играете …»
  const CNG = { r: 'красных', b: 'синих', y: 'жёлтых', g: 'зелёных' };         // «ход …»
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
    heavy: { name: 'Армия ферзей', desc: 'Кони, слоны и ладьи ходят как ферзи' },
    frozenknight: { name: 'Кони в оковах', desc: 'Кони не могут ходить' },
    kamikaze: { name: 'Камикадзе', desc: 'Бьющая фигура гибнет вместе с побитой (король тоже!)' },
    retreat: { name: 'Отступление', desc: 'Вперёд ходить нельзя, только назад или вбок' },
    kbswap: { name: 'Кони ↔ слоны', desc: 'Кони ходят как слоны, а слоны как кони' },
    queenking: { name: 'Ферзь-малютка', desc: 'Ферзь ходит как король' },
    pawnrook: { name: 'Пешки-ладьи', desc: 'Пешки ходят и бьют как ладьи' },
  };
  const boomMod = m => m === 'atomic' || m === 'kamikaze';
  const PIECE_SETS = [['classic', 'Классика'], ['neon', 'Неон'], ['gold', 'Золото и обсидиан']];
  const BOARDS = [['wood', 'Дерево'], ['emerald', 'Изумруд'], ['night', 'Ночь']];
  const PRESETS = [[1, 0], [2, 1], [3, 0], [3, 2], [5, 0], [5, 3], [10, 0], [15, 10], [30, 0]];
  const WHY = {
    checkmate: 'мат', stalemate: 'пат', resign: 'сдача', time: 'время вышло', agreed: 'ничья по соглашению',
    exploded: 'король взорван', kingdown: 'король уничтожен', nopieces: 'потеряны все фигуры',
    nomoves: 'нет ходов (пат — победа)', insufficient: 'недостаточно материала', fifty: 'правило 50 ходов',
    repetition: 'троекратное повторение', aborted: 'партия отменена', last: 'остальные выбыли',
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
  let vSel = 'standard', tcSel = { t: 5, inc: 0 }, cSel = 'random';
  let rooms = {}, roomId = null, starting = null;   // комнаты на 4 игрока
  let viewPly = null;                                // null = текущая позиция, иначе номер хода, который смотрим
  let finishing4 = -1, rematchBusy = false;
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
    $('#room').hidden = v !== 'room';
    window.scrollTo(0, 0);
  }
  const plural = n => (n === 1 ? 'ход' : 'хода');

  // ---------- Лобби ----------
  const clampInt = (v, lo, hi, d) => { v = parseInt(v, 10); return isNaN(v) ? d : Math.min(hi, Math.max(lo, v)); };

  function syncTC(writeInputs) {
    document.querySelectorAll('#presets .chip').forEach(b =>
      b.classList.toggle('on', +b.dataset.t === tcSel.t && +b.dataset.inc === tcSel.inc));
    if (writeInputs) { $('#tcMin').value = tcSel.t; $('#tcInc').value = tcSel.inc; }
  }

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
    PRESETS.forEach(([t, inc]) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${t}+${inc}`;
      b.dataset.t = t; b.dataset.inc = inc;
      b.onclick = () => { tcSel = { t, inc }; syncTC(true); };
      pr.appendChild(b);
    });
    syncTC(true);
    document.querySelectorAll('#colorSel button').forEach(b => {
      b.classList.toggle('on', b.dataset.c === cSel);
      b.onclick = () => { cSel = b.dataset.c; buildLobbyControls(); };
    });
    const four = vSel === 'four';
    $('#colorWrap').hidden = four;
    $('#localBtn').hidden = four;
    $('#createBtn').textContent = four ? 'Создать комнату' : 'Создать вызов';
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
    $('#resumeBar').hidden = !(online && !G && !roomId && store.get('chess_game'));

    const fresh = c => !c || now() - c < 30 * 60 * 1000;
    const list = [];
    for (const [id, s] of Object.entries(seeks)) if (s && !s.game && fresh(s.created)) list.push({ kind: 'seek', id, s, created: s.created || 0 });
    for (const [id, r] of Object.entries(rooms)) {
      const n = roomPlayers(r).length;
      if (r && !r.game && n > 0 && n < 4 && fresh(r.created)) list.push({ kind: 'room', id, r, n, created: r.created || 0 });
    }
    list.sort((a, b) => b.created - a.created);

    const tb = $('#seekTable tbody');
    tb.innerHTML = '';
    for (const it of list) {
      const tr = document.createElement('tr');
      const btn = document.createElement('button');
      if (it.kind === 'seek') {
        const { s, id } = it, isMine = s.uid === me.uid;
        const dot = s.color === 'w' ? 'w' : s.color === 'b' ? 'b' : 'r';
        if (isMine) tr.className = 'mine';
        tr.innerHTML = `<td>${esc(s.name)}</td><td>${esc(VARIANTS[s.variant] ? VARIANTS[s.variant].name : s.variant)}</td>` +
          `<td>${s.t}+${s.inc}</td><td><span class="dot ${dot}"></span></td><td></td>`;
        if (isMine) { btn.textContent = 'Ваш вызов'; btn.disabled = true; }
        else { btn.textContent = 'Играть'; btn.className = 'primary'; btn.onclick = () => acceptSeek(id); }
      } else {
        const host = roomPlayers(it.r)[0][1].name;
        tr.innerHTML = `<td>${esc(host)}</td><td>👥 4 игрока</td><td>${tcLabel(it.r.tc)}</td><td>${it.n}/4</td><td></td>`;
        btn.textContent = 'Войти'; btn.className = 'primary';
        btn.onclick = () => joinRoom(it.id).catch(e => { console.error(e); toast('Не удалось войти в комнату'); });
      }
      tr.lastChild.appendChild(btn);
      tb.appendChild(tr);
    }
    $('#noSeeks').hidden = list.length > 0;
    $('#seekTable').hidden = list.length === 0;
  }

  // ---------- Комнаты на 4 игрока ----------
  const roomPlayers = r => Object.entries((r && r.players) || {}).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));

  async function createRoom() {
    if (!online || roomId) return;
    const { t, inc } = tcSel;
    const id = fb.push(R('rooms4')).key;
    roomId = id;
    showView('room');
    await fb.set(R('rooms4/' + id), { tc: { t, inc }, created: fb.serverTimestamp(), players: { [me.uid]: { name: me.name, t: Date.now() } } });
    fb.onDisconnect(R('rooms4/' + id + '/players/' + me.uid)).remove();
    renderRoom();
  }

  async function joinRoom(id) {
    if (!online || roomId) return;
    const res = await fb.runTransaction(R('rooms4/' + id), cur => {
      if (!cur || cur.game) return undefined;
      const ps = cur.players || {};
      if (!ps[me.uid] && Object.keys(ps).length >= 4) return undefined;
      ps[me.uid] = { name: me.name, t: Date.now() };
      cur.players = ps;
      return cur;
    });
    if (!res.committed) { toast('Комната уже заполнена или закрыта'); return; }
    roomId = id;
    fb.onDisconnect(R('rooms4/' + id + '/players/' + me.uid)).remove();
    showView('room');
    renderRoom();
  }

  async function leaveRoom() {
    const id = roomId;
    if (!id) return;
    roomId = null; starting = null;
    showView('lobby'); renderLobby();
    try {
      fb.onDisconnect(R('rooms4/' + id + '/players/' + me.uid)).cancel();
      await fb.runTransaction(R('rooms4/' + id), cur => {
        if (!cur || cur.game) return undefined;
        const ps = cur.players || {};
        delete ps[me.uid];
        if (!Object.keys(ps).length) return null;        // ушёл последний: комната удаляется
        cur.players = ps;
        return cur;
      });
    } catch (e) { console.error(e); }
  }

  function renderRoom() {
    const r = rooms[roomId];
    if (!r) return;
    const ps = roomPlayers(r), n = ps.length;
    $('#roomMsg').textContent = n >= 4 ? 'Все в сборе! Начинаем партию…' : `Ждём игроков… ${n}/4`;
    $('#roomTC').textContent = 'Время: ' + tcLabel(r.tc);
    $('#roomLeave').disabled = n >= 4;
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += ps[i]
        ? `<div class="slot on">👤 ${esc(ps[i][1].name)}${ps[i][0] === me.uid ? ' (вы)' : ''}</div>`
        : '<div class="slot"><span class="spin"></span> Свободно</div>';
    }
    $('#roomSlots').innerHTML = html;
  }

  function onRooms() {
    if (roomId) {
      const r = rooms[roomId];
      if (r && r.game) {
        const gid = r.game, rid0 = roomId;
        fb.onDisconnect(R('rooms4/' + rid0 + '/players/' + me.uid)).cancel();
        roomId = null; starting = null;
        openGame(gid);
        return;
      }
      if (!r || !(r.players && r.players[me.uid])) {
        roomId = null; starting = null;
        showView('lobby'); toast('Комната закрыта');
      } else {
        renderRoom();
        if (roomPlayers(r).length >= 4) startRoom(roomId, r).catch(e => { console.error(e); starting = null; });
      }
    }
    if (!G && !roomId) renderLobby();
  }

  // Когда в комнате четверо, один из клиентов (его выбирает транзакция) создаёт партию.
  async function startRoom(id, r) {
    if (starting === id) return;
    starting = id;
    const gid = fb.push(R('games')).key;
    const res = await fb.runTransaction(R('rooms4/' + id + '/game'), cur => (cur === null ? gid : undefined));
    if (!res.committed) return;
    const ps = roomPlayers(r).slice(0, 4).map(([uid, p]) => ({ uid, name: p.name }));
    for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
    const players = {};
    C4.ORDER.forEach((c, i) => { players[c] = ps[i]; });
    await fb.set(R('games/' + gid), { variant: 'four', tc: r.tc, players, startT: fb.serverTimestamp() });
    setTimeout(() => fb.remove(R('rooms4/' + id)).catch(() => {}), 20000);
  }

  async function createSeek() {
    if (!online) return;
    const { t, inc } = tcSel;
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
    finishing = false; finishing4 = -1; rematchBusy = false;
    snd = { n: null, ended: false };
    rl.spunFor = -1;
    flipManual = false; sel = null; targets = new Map(); cache = null; viewPly = null;
  }

  function startLocal(variant) {
    const v = typeof variant === 'string' ? variant : vSel;
    leaveGame(true);
    resetGameRuntime();
    G = {
      local: true, id: 'local-' + rid(), variant: v, tc: null,
      seed: Math.floor(Math.random() * 2147483647),
      white: { name: 'Белые' }, black: { name: 'Чёрные' },
      moves: [], result: null, drawOffer: null,
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
    const g = {
      id, variant: v.variant, tc: v.tc, startT: v.startT, seed: v.seed | 0,
      moves: mv, result: v.result || null, drawOffer: v.drawOffer || null,
      rematch: v.rematch || {}, rematchGame: v.rematchGame || null,
    };
    if (v.variant === 'four') {
      g.four = true;
      g.players = v.players || {};
      g.my = C4.ORDER.find(c => g.players[c] && g.players[c].uid === me.uid) || null;
    } else {
      g.white = v.white; g.black = v.black;
      g.my = v.white.uid === me.uid ? 'w' : v.black.uid === me.uid ? 'b' : null;
    }
    return g;
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

  // keep = true: выходим в лобби, но онлайн-партию помним (кнопка «Вернуться в партию»)
  function leaveGame(silent, keep) {
    if (unsubGame) { unsubGame(); unsubGame = null; }
    if (G && !G.local && !(keep && !G.loading && !result())) store.del('chess_game');
    cancelRoulette();
    G = null; cache = null; sel = null; targets = new Map(); viewPly = null;
    $('#game').classList.remove('chaos', 'four');
    if (!silent) { showView('lobby'); renderLobby(); }
  }

  function goHome() {
    if (roomId) { leaveRoom(); return; }
    if (!G) { showView('lobby'); renderLobby(); return; }
    const running = !G.loading && !result() && (G.local || G.my);
    if (running && !confirm(G.local
      ? 'Выйти в лобби? Текущая партия будет потеряна.'
      : 'Выйти в лобби? Партия не закончится, вернуться в неё можно кнопкой «Вернуться в партию».')) return;
    leaveGame(false, !G.local);
  }

  function derive() {
    if (G.four) return derive4();
    if (!cache || cache.id !== G.id || cache.four || G.moves.length < cache.moves.length) {
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

  // Партия на четверых: записи в moves — это ходы {m} или выбывания {e:'out', c, why}.
  function derive4() {
    if (!cache || cache.id !== G.id || !cache.four || G.moves.length < cache.moves.length) {
      const s0 = C4.initialState();
      cache = { id: G.id, four: true, states: [s0], keys: [], sans: [], moves: [], times: [], movers: [],
        starts: [G.startT > 0 ? G.startT : now()], evalN: -1, legal: [], pos: null };
    }
    while (cache.moves.length < G.moves.length) {
      const k = cache.moves.length, s = cache.states[k], e = G.moves[k];
      let n, mv, san;
      if (e.e === 'out') {
        n = C4.eliminate(s, e.c);
        mv = { ev: true, c: e.c };
        san = s.alive[e.c] ? `${CN[e.c]} ${e.why === 'time' ? 'вылетели по времени' : 'сдались'}` : '';
      } else {
        const legal = C4.legalMoves(s);
        const m = C4.findMove(s, e.m || '', legal);
        if (!m) break;
        san = C4.toSAN(s, m); n = C4.applyMove(s, m); mv = m;
      }
      const t = e.t > 0 ? e.t : cache.starts[k];
      cache.sans.push(san); cache.states.push(n); cache.moves.push(mv);
      cache.times.push(t); cache.movers.push(s.turn);
      cache.starts.push(n.turn !== s.turn ? t : cache.starts[k]);   // с какого момента думает тот, чей сейчас ход
    }
    if (cache.evalN !== cache.states.length) {
      const cur = cache.states[cache.states.length - 1];
      cache.legal = C4.legalMoves(cur);
      cache.pos = C4.status(cur);
      cache.evalN = cache.states.length;
    }
  }

  const curState = () => cache.states[cache.states.length - 1];
  const result = () => (G.result || (cache && cache.pos) || null);
  const isFlipped = () => (G.my === 'b') !== flipManual;
  const shownN = () => (viewPly === null ? cache.moves.length : Math.min(viewPly, cache.moves.length));
  const viewing = () => !!cache && viewPly !== null && viewPly < cache.moves.length;
  const ownerOf = p => (G && G.four ? p[0] : C.colorOf(p));
  const view4Rot = () => ((G.my ? C4.ORDER.indexOf(G.my) : 0) + (flipManual ? 2 : 0)) % 4;
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

  // Время игроков в партии на четверых: у каждого свой запас, прибавка после своего хода.
  function remaining4(color, t) {
    if (!G.tc || !G.tc.t) return Infinity;
    let rem = G.tc.t * 60000;
    const ms = cache.moves;
    for (let k = 0; k < ms.length; k++) {
      if (ms[k].ev || cache.movers[k] !== color) continue;
      rem += G.tc.inc * 1000 - Math.max(0, cache.times[k] - cache.starts[k]);
    }
    const cur = curState();
    if (!result() && cur.alive[color] && cur.turn === color) rem -= Math.max(0, t - cache.starts[cache.starts.length - 1]);
    return rem;
  }

  // Запись хода/выбывания на четверых. Транзакция по индексу не даёт двум записям затереть друг друга.
  async function pushEntry(entry, retries, stillNeeded) {
    const gid = G.id;
    for (let a = 0; a <= (retries || 0); a++) {
      const n = G.moves.length;
      const res = await fb.runTransaction(R('games/' + gid + '/moves/' + n), cur => (cur === null ? entry : undefined));
      if (res.committed) return true;
      await new Promise(r => setTimeout(r, 350));
      if (!G || G.id !== gid || (stillNeeded && !stillNeeded())) return false;
    }
    return false;
  }
  const out4 = (c, why, retries, needed) => pushEntry({ e: 'out', c, why, t: now() }, retries, needed);

  async function submitMove(m) {
    if (G.local) { G.moves.push({ m: C.toUci(m), t: Date.now() }); refresh(); return; }
    if (G.four) { await pushEntry({ m: C4.toUci(m), t: now() }, 0); return; }
    const uci = C.toUci(m);
    const n = G.moves.length;
    await fb.update(R('games/' + G.id), { ['moves/' + n]: { m: uci, t: fb.serverTimestamp() }, drawOffer: null });
  }

  // ---------- Реванш ----------
  const rematchNeed = () => (G.four ? C4.ORDER.map(c => G.players[c] && G.players[c].uid) : [G.white.uid, G.black.uid]);

  function rematchButton() {
    if (G.local) return '<button id="bRematch" class="primary">🔁 Сыграть снова</button>';
    if (!G.my) return '';
    const need = rematchNeed(), got = need.filter(u => G.rematch && G.rematch[u]).length;
    if (G.rematch && G.rematch[me.uid]) {
      return `<button disabled>⏳ Ждём ${G.four ? `остальных (${got}/${need.length})` : 'соперника'}…</button>`;
    }
    if (got > 0) return `<button id="bRematch" class="primary">🔁 Принять реванш${G.four ? ` (${got}/${need.length})` : ''}</button>`;
    return '<button id="bRematch" class="primary">🔁 Сыграть снова</button>';
  }

  function doRematch() {
    if (G.local) { startLocal(G.variant); return; }
    fb.set(R('games/' + G.id + '/rematch/' + me.uid), true).catch(() => toast('Не удалось отправить предложение'));
  }

  // Все участники согласны: один из клиентов (выбирает транзакция) создаёт новую партию с переставленными цветами.
  function maybeRematch() {
    if (G.local || !G.my || !result() || G.rematchGame || rematchBusy) return;
    if (!rematchNeed().every(u => u && G.rematch[u])) return;
    rematchBusy = true;
    const g = G;
    createRematch(g).catch(e => { console.error(e); rematchBusy = false; });
  }

  async function createRematch(g) {
    const gid = fb.push(R('games')).key;
    const res = await fb.runTransaction(R('games/' + g.id + '/rematchGame'), cur => (cur === null ? gid : undefined));
    if (!res.committed) return;
    let rec;
    if (g.four) {
      const players = {};
      C4.ORDER.forEach((c, i) => { players[C4.ORDER[(i + 1) % 4]] = g.players[c]; });   // каждый играет следующим цветом
      rec = { variant: 'four', tc: g.tc, players, startT: fb.serverTimestamp() };
    } else {
      rec = { variant: g.variant, tc: g.tc, white: g.black, black: g.white, seed: Math.floor(Math.random() * 2147483647), startT: fb.serverTimestamp() };
    }
    await fb.set(R('games/' + gid), rec);
  }

  // ---------- Звуки партии ----------
  function soundNewMoves() {
    const n = cache.moves.length, res = result();
    if (snd.n === null) { snd.n = n; snd.ended = !!res; return; }
    if (n > snd.n) {
      const m = cache.moves[n - 1];
      if (G.four) {
        if (m && !m.ev) { if (m.cap) Snd.capture(); else Snd.move(); } else Snd.tick();
      } else {
        const prevS = cache.states[n - 1], cur = curState();
        const boom = m.cap && (G.variant === 'atomic' || boomMod(C.activeMod(prevS)));
        if (boom) Snd.boom(); else if (m.cap) Snd.capture(); else Snd.move();
        const chk = G.variant === 'chaos' ? C.kingAttacked(cur) : (G.variant !== 'antichess' && C.inCheck(cur.board, cur.turn, G.variant));
        if (chk && !res) setTimeout(() => Snd.check(), 150);
      }
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
    const n = shownN(), live = n === cache.moves.length, phase = n % C.CYCLE;
    if (result() && live) { bar.className = 'modbar off'; bar.innerHTML = '<span class="mi">🎲</span><div class="mt"><b>Хаос</b><small>Партия окончена</small></div>'; return; }
    if (rl.active && live && phase === 0) {
      bar.className = 'modbar rolling';
      bar.innerHTML = '<span class="mi">🎲</span><div class="mt"><b>Рулетка…</b><small>Выбираем модификатор</small></div>';
      return;
    }
    const mod = C.activeMod(cache.states[n]);
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

  const sqEls4 = [];
  const boardEl4 = $('#board4');
  for (let i = 0; i < 196; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    boardEl4.appendChild(d);
    sqEls4.push(d);
  }
  const drawBoard = () => (G.four ? renderBoard4() : renderBoard());

  // Просмотр истории: n = 0 (начальная позиция) … число ходов (текущая позиция)
  function viewAt(n) {
    if (!cache) return;
    const tot = cache.moves.length;
    viewPly = n >= tot ? null : Math.max(0, n);
    sel = null; targets = new Map();
    refresh();
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
    if (!G.local && G.my && G.rematchGame && G.rematchGame !== G.id) { openGame(G.rematchGame); return; }
    derive();
    if (viewPly !== null && viewPly >= cache.moves.length) viewPly = null;
    $('#game').classList.toggle('chaos', G.variant === 'chaos');
    $('#game').classList.toggle('four', !!G.four);
    $('#board').hidden = !!G.four; $('#board4').hidden = !G.four; $('#players4').hidden = !G.four;
    $('#topPlayer').hidden = !!G.four; $('#bottomPlayer').hidden = !!G.four;
    if (result() && rl.active) cancelRoulette();
    soundNewMoves();
    maybeSpin();
    if (sel !== null && (!canMove() || !cache.legal.some(m => m.from === sel))) { sel = null; targets = new Map(); }
    drawBoard();
    if (G.four) renderPlayers4(); else renderPlayers();
    renderSide();
    renderModbar();
    maybeRematch();
    tick();
  }

  function renderBoard() {
    const n = shownN(), cur = cache.states[n], flip = isFlipped();
    const lm = cache.moves[n - 1];
    const prev = cache.states[n - 1];
    const v = G.variant;
    let checkSq = -1;
    if (v === 'chaos') { if (C.kingAttacked(cur)) checkSq = C.findKing(cur.board, cur.turn); }
    else if (v !== 'antichess' && C.inCheck(cur.board, cur.turn, v)) checkSq = C.findKing(cur.board, cur.turn);
    const boom = new Set();
    if (lm && lm.cap && prev && (v === 'atomic' || boomMod(C.activeMod(prev)))) {
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

  // Крестообразная доска 14×14: вид повёрнут так, чтобы ваши фигуры были внизу
  function renderBoard4() {
    const n = shownN(), cur = cache.states[n], k = view4Rot();
    const lm = cache.moves[n - 1] && !cache.moves[n - 1].ev ? cache.moves[n - 1] : null;
    for (let dy = 0; dy < 14; dy++) {
      for (let dx = 0; dx < 14; dx++) {
        let x = dx, y = dy;
        for (let q = 0; q < k; q++) { const nx = 13 - y; y = x; x = nx; }
        const f = x, r = 13 - y, el = sqEls4[dy * 14 + dx];
        if (!C4.isPlay(f, r)) { el.className = 'sq void'; el.innerHTML = ''; delete el.dataset.i; continue; }
        const i = r * 14 + f;
        el.dataset.i = i;
        let cls = 'sq ' + ((r + f) % 2 === 0 ? 'dark' : 'light');
        if (lm && (i === lm.from || i === lm.to)) cls += ' last';
        if (i === sel) cls += ' sel';
        el.className = cls;
        const p = cur.board[i];
        let html = '';
        if (targets.has(i)) html += `<i class="hint${p ? ' cap' : ''}"></i>`;
        if (p) html += Art.pieceSVG(p[1].toLowerCase(), 'p4' + p[0]);
        el.innerHTML = html;
      }
    }
  }

  function renderPlayers4() {
    const cur = curState(), res = result();
    $('#players4').innerHTML = C4.ORDER.map(c => {
      const p = G.players[c] || { name: '?' };
      const cls = 'p4' + (!cur.alive[c] ? ' out' : '') + (!res && cur.turn === c ? ' turn' : '');
      return `<div class="${cls}"><div class="row"><span class="pdot c${c}"></span><span class="pname">${esc(p.name)}${G.my === c ? ' (вы)' : ''}</span></div><span class="clock" data-c="${c}">—</span></div>`;
    }).join('');
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
    if (G.four) {
      const cur = curState();
      if (res) {
        let head;
        if (res.winner === 'd') head = 'Ничья';
        else if (G.my) head = res.winner === G.my ? 'Вы победили!' : `Победили ${CN[res.winner].toLowerCase()}`;
        else head = `Победили ${CN[res.winner].toLowerCase()}`;
        return `${head} — ${WHY[res.why] || res.why}`;
      }
      if (viewing()) return `📖 Просмотр: ход ${shownN()} из ${cache.moves.length}. Игра продолжается`;
      if (G.my && !cur.alive[G.my]) return 'Вы выбыли. Можно наблюдать за партией';
      if (G.my === cur.turn) return 'Ваш ход';
      const p = G.players[cur.turn];
      return `Ход ${CNG[cur.turn]}${p ? ' (' + p.name + ')' : ''}`;
    }
    if (res) {
      let head;
      if (res.winner === 'd') head = 'Ничья';
      else if (res.winner === 'x') head = 'Партия отменена';
      else if (G.my) head = res.winner === G.my ? 'Вы победили!' : 'Вы проиграли';
      else head = (res.winner === 'w' ? 'Белые' : 'Чёрные') + ' победили';
      return `${head} — ${WHY[res.why] || res.why}`;
    }
    if (viewing()) return `📖 Просмотр: ход ${shownN()} из ${cache.moves.length}. Партия продолжается`;
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
    const res = result(), n = shownN(), live = !viewing(), tot = cache.moves.length;
    if (G.four) {
      const mine = G.my ? (curState().alive[G.my] ? 'Вы играете ' + CNI[G.my] : 'Вы выбыли') : 'Вы наблюдаете';
      $('#gameInfo').innerHTML = `👥 4 игрока • ${tcLabel(G.tc)}<small>${mine}</small>`;
    } else {
      const v = VARIANTS[G.variant];
      $('#gameInfo').innerHTML = `${v.icon} ${v.name} • ${tcLabel(G.tc)}<small>${G.local ? 'Локальная партия' : G.my ? '' : 'Вы наблюдаете'}</small>`;
    }
    const st = $('#status');
    st.textContent = statusLine();
    st.className = 'status' + (res ? ' over' : '');

    // список ходов: на любой можно нажать и посмотреть позицию после него
    const mv = $('#moves');
    const cls = j => (j + 1 === n ? (live ? ' cur' : ' cur view') : '');
    let html = '';
    if (G.four) {
      mv.className = 'moves four';
      html = cache.sans.map((t, i) => !t ? '' :
        `<span class="mv${cls(i)}${cache.moves[i].ev ? ' out' : ''}" data-ply="${i + 1}"><i class="pdot c${cache.movers[i]}"></i>${esc(t)}</span>`).join('');
    } else {
      mv.className = 'moves';
      for (let i = 0; i < cache.sans.length; i += 2) {
        html += `<span class="n">${i / 2 + 1}.</span><span class="mv${cls(i)}" data-ply="${i + 1}">${esc(cache.sans[i])}</span>` +
          (cache.sans[i + 1] ? `<span class="mv${cls(i + 1)}" data-ply="${i + 2}">${esc(cache.sans[i + 1])}</span>` : '<span class="mv"></span>');
      }
    }
    mv.innerHTML = html;
    const curEl = mv.querySelector('.cur');
    if (live || !curEl) mv.scrollTop = mv.scrollHeight;
    else mv.scrollTop += curEl.getBoundingClientRect().top - mv.getBoundingClientRect().top - mv.clientHeight / 2;

    const hn = $('#histnav');
    hn.hidden = tot === 0;
    hn.innerHTML =
      `<button data-nav="first" title="К началу партии"${n <= 0 ? ' disabled' : ''}>⏮</button>` +
      `<button data-nav="prev" title="Ход назад (←)"${n <= 0 ? ' disabled' : ''}>◀</button>` +
      `<button data-nav="next" title="Ход вперёд (→)"${live ? ' disabled' : ''}>▶</button>` +
      (live ? '<button data-nav="live" class="live" disabled>Текущая позиция</button>'
            : '<button data-nav="live" class="live primary">↩ Вернуться к игре</button>');

    const ctrl = $('#controls');
    let b;
    if (G.four) {
      const alive = !!(G.my && curState().alive[G.my]);
      b = '<button id="bFlip">⟳ Повернуть</button>';
      if (!res && alive) b += '<button id="bResign4" class="danger">Сдаться</button>';
      if (res && G.my) b += rematchButton();
      if (res || !alive) b += '<button id="bLobby" class="primary">В лобби</button>';
    } else {
      const player = G.local || G.my;
      b = '<button id="bFlip">⇅ Перевернуть</button>';
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
      if (res && player) b += rematchButton();
      if (res || !player || G.local) b += '<button id="bLobby" class="primary">В лобби</button>';
    }
    ctrl.innerHTML = b;
    const on = (id, fn) => { const e = $('#' + id); if (e) e.onclick = fn; };
    on('bFlip', () => { flipManual = !flipManual; refresh(); });
    on('bLobby', () => leaveGame());
    on('bRematch', doRematch);
    on('bResign', () => { if (confirm('Сдаться?')) finish({ winner: C.opp(G.my), why: 'resign' }); });
    on('bResign4', () => {
      if (!confirm('Сдаться? Ваши фигуры станут серыми, а вы выбываете из партии.')) return;
      const me4 = G.my;
      out4(me4, 'resign', 4, () => curState().alive[me4]).catch(() => toast('Не удалось сдаться, попробуйте ещё раз'));
    });
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
    const hasClock = G.tc && G.tc.t;
    if (G.four) {
      const cur = curState();
      for (const el of document.querySelectorAll('.clock')) {
        const c = el.dataset.c;
        if (!hasClock) { el.textContent = '—'; continue; }
        if (!cur.alive[c]) { el.textContent = '✕'; el.classList.remove('active', 'low'); continue; }
        const rem = remaining4(c, t);
        el.textContent = fmtClock(Math.max(0, rem));
        el.classList.toggle('active', !res && cur.turn === c);
        el.classList.toggle('low', rem < 20000 && !res);
      }
      if (hasClock && !res && G.my && cur.alive[G.my]) {
        const n = cache.moves.length;
        if (finishing4 !== n && remaining4(cur.turn, t) <= 0) {   // время текущего игрока вышло: он выбывает
          finishing4 = n;
          const back = () => setTimeout(() => { finishing4 = -1; }, 2000);
          out4(cur.turn, 'time', 0).then(ok => { if (!ok) back(); }).catch(back);
        }
      }
      return;
    }
    const turn = G.moves.length % 2 === 0 ? 'w' : 'b';
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
    if (!G || G.loading || !cache || result() || locked() || viewing()) return false;
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
    drawBoard();
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
      b.innerHTML = Art.pieceSVG(m.promo, G.four ? 'p4' + color : color);
      b.onclick = () => { $('#promo').hidden = true; doMove(m); };
      box.appendChild(b);
    }
    $('#promo').hidden = false;
  }
  $('#promo').addEventListener('pointerdown', e => {
    if (e.target.id === 'promo') { $('#promo').hidden = true; select(null); }
  });

  function onBoardDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.target.closest('.sq');
    if (!el || el.classList.contains('void') || !G || !canMove()) return;
    const i = +el.dataset.i;
    if (sel !== null && targets.has(i)) { tryMove(sel, i); return; }
    const p = curState().board[i];
    if (p && ownerOf(p) === curState().turn) {
      select(i);
      const pe = sel === null ? null : el.querySelector('svg.piece');
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
  }
  boardEl.addEventListener('pointerdown', onBoardDown);
  boardEl4.addEventListener('pointerdown', onBoardDown);
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
    const to = sqEl && sqEl.closest('.board') && sqEl.dataset.i !== undefined ? +sqEl.dataset.i : null;
    if (to !== null && to !== d.from && d.moved) tryMove(d.from, to);
    else drawBoard();
  });
  window.addEventListener('pointercancel', () => {
    if (!drag) return;
    drag.ghost.remove(); drag = null; if (G) drawBoard();
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
    $('#createBtn').onclick = () => (vSel === 'four' ? createRoom() : createSeek()).catch(e => { console.error(e); toast('Не удалось создать ' + (vSel === 'four' ? 'комнату' : 'вызов')); });
    $('#cancelBtn').onclick = () => cancelSeek();
    $('#localBtn').onclick = () => startLocal();
    $('#homeLink').onclick = e => { e.preventDefault(); goHome(); };
    $('#resumeBtn').onclick = () => { const id = store.get('chess_game'); if (id) openGame(id, true); };
    $('#roomLeave').onclick = leaveRoom;
    $('#modCount').textContent = C.MOD_IDS.length;

    // своё время партии
    const onTC = () => {
      tcSel = { t: clampInt($('#tcMin').value, 1, 180, tcSel.t), inc: clampInt($('#tcInc').value, 0, 120, tcSel.inc) };
      syncTC(false);
    };
    $('#tcMin').oninput = $('#tcInc').oninput = onTC;
    $('#tcMin').onchange = $('#tcInc').onchange = () => { onTC(); syncTC(true); };

    // просмотр истории: клик по ходу, кнопки и стрелки на клавиатуре
    $('#moves').addEventListener('click', e => {
      const el = e.target.closest('[data-ply]');
      if (el && cache) viewAt(+el.dataset.ply);
    });
    $('#histnav').addEventListener('click', e => {
      const b = e.target.closest('button[data-nav]');
      if (!b || !cache) return;
      const k = b.dataset.nav, n = shownN(), tot = cache.moves.length;
      viewAt(k === 'first' ? 0 : k === 'prev' ? n - 1 : k === 'next' ? n + 1 : tot);
    });
    window.addEventListener('keydown', e => {
      if (!G || G.loading || !cache || $('#game').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName)) return;
      const n = shownN(), tot = cache.moves.length;
      if (e.key === 'ArrowLeft') viewAt(n - 1);
      else if (e.key === 'ArrowRight') viewAt(n + 1);
      else if (e.key === 'Home') viewAt(0);
      else if (e.key === 'End') viewAt(tot);
      else return;
      e.preventDefault();
    });
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

    // комнаты на 4 игрока
    fb.onValue(R('rooms4'), s => { rooms = s.val() || {}; onRooms(); });

    // продолжить незавершённую партию
    const saved = store.get('chess_game');
    if (saved) openGame(saved, true);
  }

  init();
})();
