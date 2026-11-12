/* Звуки на Web Audio API: ничего не скачивается, всё синтезируется. */
(function (root) {
  'use strict';
  let ctx = null, master = null, enabled = true;
  try { enabled = localStorage.getItem('chess_sound') !== '0'; } catch (e) {}

  function ensure() {
    if (!enabled) return null;
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    } catch (e) { return null; }
  }

  function tone(o) {
    const c = ensure(); if (!c) return;
    const t0 = c.currentTime + (o.t || 0), d = o.d || 0.15, v = o.v == null ? 0.3 : o.v;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f || 440, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(v, t0 + (o.a || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + d + 0.05);
  }

  let nbuf = null;
  function noise(o) {
    const c = ensure(); if (!c) return;
    if (!nbuf) {
      nbuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const a = nbuf.getChannelData(0);
      for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + (o.t || 0), d = o.d || 0.2;
    const src = c.createBufferSource(); src.buffer = nbuf; src.loop = true;
    const fl = c.createBiquadFilter(); fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(o.f || 1200, t0);
    if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t0 + d);
    fl.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.v == null ? 0.3 : o.v, t0 + (o.a || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(fl); fl.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + d + 0.05);
  }

  const Snd = {
    unlock() { ensure(); },
    isEnabled() { return enabled; },
    setEnabled(on) {
      enabled = !!on;
      try { localStorage.setItem('chess_sound', on ? '1' : '0'); } catch (e) {}
      if (on) Snd.tick();
    },
    move() { noise({ d: 0.06, v: 0.35, type: 'bandpass', f: 1100, q: 1.2 }); tone({ f: 190, f2: 120, d: 0.09, v: 0.3 }); },
    capture() { noise({ d: 0.12, v: 0.5, type: 'lowpass', f: 1800, f2: 400 }); tone({ f: 150, f2: 60, d: 0.16, type: 'triangle', v: 0.45 }); },
    boom() {
      noise({ d: 0.8, v: 0.8, type: 'lowpass', f: 2200, f2: 90 });
      tone({ f: 95, f2: 30, d: 0.7, v: 0.7 });
      noise({ d: 0.25, v: 0.4, type: 'highpass', f: 2500, t: 0.02 });
    },
    check() { tone({ f: 880, d: 0.09, type: 'square', v: 0.15 }); tone({ f: 1175, d: 0.12, type: 'square', v: 0.15, t: 0.1 }); },
    tick() { tone({ f: 650 + Math.random() * 250, d: 0.04, type: 'square', v: 0.11 }); },
    spin() { noise({ d: 0.35, v: 0.2, type: 'bandpass', f: 400, f2: 2000, q: 3 }); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ f, d: 0.28, type: 'triangle', v: 0.28, t: i * 0.09 }));
      tone({ f: 2093, d: 0.5, v: 0.1, t: 0.38 });
      noise({ d: 0.4, v: 0.15, type: 'highpass', f: 5000, t: 0.3 });
    },
    whoosh() { noise({ d: 0.55, v: 0.35, type: 'bandpass', f: 250, f2: 3200, q: 2 }); },
    end(win) {
      const n = win ? [523, 659, 784, 1047] : [392, 330, 262];
      n.forEach((f, i) => tone({ f, d: 0.35, type: 'triangle', v: 0.3, t: i * 0.16 }));
    },
  };
  root.Snd = Snd;
})(window);
