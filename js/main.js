/* =============================================================================
   MJ's Story · main.js  (compartido por las 6 páginas)
   Requiere: Bootstrap 5, GSAP 3 + ScrollTrigger, js/data.js (window.MJ_ALBUMS)
   -----------------------------------------------------------------------------
    1. Utilidades y almacenamiento
    2. SFX: sonidos elegantes sintetizados con Web Audio (sin archivos)
    3. Cortina de página + transiciones entre subpáginas
    4. Intro (primera visita) y entrada de cada página
    5. Cursor personalizado + estela de destellos
    6. Parallax (scroll + cursor)
    7. Hero 3D, partículas, marquee, scroll horizontal
    8. Efectos de scroll: contadores, línea de tiempo, galería, tilt de álbumes
    9. Reproductor flotante estilo Spotify (persiste entre páginas)
   10. Carrito + modal de éxito + toast
   11. Tienda: filtros, búsqueda, orden, favoritos, vista rápida
   12. Discografía: coverflow 3D + panel de detalle
   13. Michael: frases · Contacto/Newsletter: formularios
   14. Navbar, volver arriba, sonidos de sección
============================================================================= */
(() => {
  'use strict';
  window.__mjReady = true;

  /* ------------------------------------------------------------ 1. UTILIDADES */
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const money = (n) => '$' + n.toLocaleString('es-ES');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  const mk = (store) => ({
    get(k, d) { try { const v = store.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { store.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
  });
  let local, sess;
  try { local = mk(localStorage); sess = mk(sessionStorage); } catch { local = sess = { get: (k, d) => d, set() {} }; }

  const G = window.gsap;
  const ST = window.ScrollTrigger;
  if (!G) document.documentElement.classList.add('no-gsap');
  else if (ST) G.registerPlugin(ST);
  const motion = !!G && !reduceMotion;               // efectos pesados solo si hay GSAP y el usuario los admite
  const ALBUMS = window.MJ_ALBUMS || [];
  const body = document.body;


  /* ------------------------------------------------------------ 2. SFX (Web Audio) */
  const SFX = (() => {
    let ctx, dry, rev, enabled = local.get('mj-sound', true), lastHover = 0, hoverStep = 2, preloaded = false;
    const PENTA = [659.25, 783.99, 880, 987.77, 1174.66, 1318.51];

    const impulse = (c, sec = 2.4, decay = 3) => {
      const n = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, n, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
      return b;
    };
    const unlock = () => {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const master = ctx.createGain(); master.gain.value = 0.55;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp); comp.connect(ctx.destination);
        dry = ctx.createGain(); dry.connect(master);
        rev = ctx.createConvolver(); rev.buffer = impulse(ctx);
        const wet = ctx.createGain(); wet.gain.value = 0.55; rev.connect(wet); wet.connect(master);
      }
      if (ctx.state === 'suspended') ctx.resume();
      if (!preloaded) { preloaded = true; preload(); }
    };
    const ok = () => enabled && ctx && ctx.state === 'running';

    const tone = ({ f, dur = 0.6, type = 'sine', vol = 0.08, at = 0, to, send = 0.5, attack = 0.008 }) => {
      if (!ok()) return;
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain(), s = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.gain.value = send;
      o.connect(g); g.connect(dry); g.connect(s); s.connect(rev);
      o.start(t); o.stop(t + dur + 0.05);
    };
    // Campana: fundamental + parcial inarmónico = timbre metálico suave
    const bell = (f, vol = 0.05, dur = 0.9, at = 0) => {
      tone({ f, vol, dur, at });
      tone({ f: f * 2.76, vol: vol * 0.35, dur: dur * 0.5, at });
      tone({ f: f * 5.4, vol: vol * 0.12, dur: dur * 0.3, at });
    };
    const noise = ({ dur = 0.7, f0 = 300, f1 = 2600, vol = 0.07 }) => {
      if (!ok()) return;
      const t = ctx.currentTime, n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = b;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(dry); g.connect(rev);
      src.start(t);
    };

    // --- Muestras reales de Michael Jackson (assets/sfx), con respaldo de campanas sintetizadas ---
    const SAMPLES = window.MJ_SFX || {};
    const bufs = {}, failed = new Set(); let lastSample = 0;
    const loadSample = (p) => fetch(p).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((buf) => { bufs[p] = buf; }).catch(() => failed.add(p));
    const preload = () => { if (ctx) Object.values(SAMPLES).flat().forEach(loadSample); };
    const sample = (kind, { vol = 0.95, rate = 1, gap = 90 } = {}) => {
      const list = SAMPLES[kind];
      if (!ok() || !list || !list.length) return false;
      const t = performance.now(); if (t - lastSample < gap) return true; lastSample = t;
      const p = list[Math.floor(Math.random() * list.length)], buf = bufs[p];
      if (buf) {
        const src = ctx.createBufferSource(), g = ctx.createGain(), w = ctx.createGain();
        src.buffer = buf; src.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
        g.gain.value = vol; w.gain.value = 0.18;
        src.connect(g); g.connect(dry); g.connect(w); w.connect(rev); src.start();
      } else {                                   // sin fetch (file://) o aún cargando: elemento <audio>
        const a = new Audio(p); a.volume = Math.min(1, vol * 0.8); a.play().catch(() => {});
        if (!failed.has(p)) loadSample(p);
      }
      return true;
    };

    return {
      unlock,
      heehee() { if (!sample('heehee', { vol: 1, gap: 400 })) { bell(1046.5, 0.05, 0.5); bell(1318.51, 0.05, 0.6, 0.1); } },
      grunt(kind) { const k = kind || (Math.random() < 0.78 ? 'short' : 'mid'); if (!sample(k, { vol: 0.9 })) this.click(); },
      shout() { if (!sample('long', { vol: 0.9, gap: 400 })) this.success(); },
      get on() { return enabled; },
      setEnabled(v) { enabled = v; local.set('mj-sound', v); },
      hover() {                                    // nota pentatónica suave: el recorrido se vuelve melodía
        const now = performance.now(); if (now - lastHover < 70) return; lastHover = now;
        hoverStep = Math.max(0, Math.min(PENTA.length - 1, hoverStep + (Math.random() < 0.5 ? -1 : 1) * (1 + (Math.random() < 0.3))));
        bell(PENTA[hoverStep], 0.022, 0.5);
      },
      click() { bell(659.25, 0.05, 0.7); bell(987.77, 0.035, 0.7, 0.07); },
      add()   { bell(880, 0.04, 0.6); bell(1318.51, 0.04, 0.8, 0.09); sample('heehee', { vol: 0.95, gap: 300 }); },
      whoosh() { noise({ dur: 0.75, f0: 250, f1: 3000, vol: 0.075 }); tone({ f: 170, to: 55, dur: 0.7, vol: 0.06, send: 0.3 }); },
      success() { [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, i) => bell(f, 0.05, 1.1, i * 0.09)); },
      shimmer() { [1568, 1318.51, 1046.5].forEach((f, i) => bell(f, 0.014, 0.9, i * 0.06)); },
      swell() {                                    // acorde de entrada (La menor add9) con ataque lento
        [220, 261.63, 329.63, 493.88, 659.25].forEach((f, i) => tone({ f, dur: 3.6, vol: 0.035, attack: 1.2, send: 0.9, type: i % 2 ? 'triangle' : 'sine' }));
        [1318.51, 1567.98, 1975.53].forEach((f, i) => bell(f, 0.02, 1.6, 0.9 + i * 0.18));
      },
      flip() { bell(1046.5, 0.025, 0.5); },
    };
  })();

  // Desbloquea el audio con la primera interacción del usuario
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, SFX.unlock, { once: true, passive: true }));

  // Botón de sonido del navbar
  const soundBtn = $('#soundBtn');
  const paintSound = () => {
    if (!soundBtn) return;
    soundBtn.innerHTML = `<i class="bi ${SFX.on ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}" aria-hidden="true"></i>`;
    soundBtn.setAttribute('aria-pressed', String(SFX.on));
    soundBtn.setAttribute('aria-label', SFX.on ? 'Silenciar efectos de sonido' : 'Activar efectos de sonido');
  };
  paintSound();
  soundBtn?.addEventListener('click', () => { SFX.unlock(); SFX.setEnabled(!SFX.on); paintSound(); if (SFX.on) SFX.click(); });

  // Sonidos al pasar y al pulsar sobre elementos interactivos
  const HOVER_SEL = 'a.nav-link, .btn-liquid, .btn-ghost, .btn-add, .chip-btn, .track, .album-card, .portal, .product-card, .icon-btn, .cf-item, .ctrl, .social a, .social-big a, .btn-size, .wish, .quick, .brand';
  let lastHoverEl = null;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest(HOVER_SEL);
    if (el && el !== lastHoverEl) SFX.hover();
    lastHoverEl = el;
  });
  const HEE_SEL = '.btn-liquid, .btn-add, .album-play, .vsound, .tmute';
  const GRUNT_SEL = 'a.nav-link, .brand, .chip-btn, .wish, .quick, .btn-size, .cf-item, .portal, .album-sleeve-link, .album-link, .icon-btn, .track, .ctrl, .tbtn, .vbtn, .btn-ghost, .btn-ghost-sm, .back-to-top, .accordion-button, .dots button, .theater-list button, .np-tabs [role="tab"], .np-ico, .np-play, .q-play, .pl-name, .track-more, .tg-play, .hee-pill, .theater-big, .btn-close';
  document.addEventListener('click', (e) => {
    if (e.target.closest('#soundBtn, [data-sfx="none"]')) return;
    if (e.target.closest(HEE_SEL)) { SFX.heehee(); return; }
    if (e.target.closest(GRUNT_SEL)) SFX.grunt();
    else if (e.target.closest('button, a[href]')) SFX.click();
  });


  /* ------------------------------------------------------------ 3. CORTINA + TRANSICIONES */
  const curtain = $('#curtain');
  const cSpans = $$('#curtain span');
  const cLogo = $('#curtainLogo img');

  const curtainOpen = () => new Promise((res) => {
    if (!motion || !curtain) { curtain?.remove(); res(); return; }
    G.set(cSpans, { yPercent: 0 });
    G.timeline({ onComplete: () => { curtain.style.display = 'none'; res(); } })
      .to(cLogo, { opacity: 1, scale: 1, duration: 0.35, ease: 'power2.out' }, 0)
      .to(cLogo, { opacity: 0, duration: 0.3 }, 0.5)
      .to(cSpans, { yPercent: -101, duration: 0.95, stagger: 0.07, ease: 'expo.inOut' }, 0.45);
  });
  const curtainClose = (href) => {
    if (!motion || !curtain) { location.href = href; return; }
    curtain.style.display = 'flex';
    G.timeline({ onComplete: () => { location.href = href; } })
      .fromTo(cSpans, { yPercent: 101 }, { yPercent: 0, duration: 0.7, stagger: 0.06, ease: 'expo.inOut' }, 0)
      .to(cLogo, { opacity: 1, scale: 1, duration: 0.4 }, 0.35);
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.dataset.bsToggle) return;
    let url; try { url = new URL(a.href, location.href); } catch { return; }
    if (url.protocol !== location.protocol || url.host !== location.host) return;
    if (url.pathname === location.pathname) return;            // ancla en la misma página: scroll nativo suave
    e.preventDefault();
    SFX.whoosh();
    curtainClose(url.href);
  });
  addEventListener('pageshow', (e) => { if (e.persisted && curtain) { curtain.style.display = 'none'; } });


  /* ------------------------------------------------------------ 4. INTRO + ENTRADA DE PÁGINA */
  const splitText = (el) => {
    const txt = el.textContent.trim();
    el.setAttribute('aria-label', txt);
    el.textContent = '';
    const letters = [];
    txt.split(' ').forEach((w, wi, arr) => {
      const word = document.createElement('span');
      word.className = 'word'; word.setAttribute('aria-hidden', 'true');
      [...w].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; word.appendChild(s); letters.push(s); });
      el.appendChild(word);
      if (wi < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return letters;
  };
  const splitEls = $$('.split');
  const letterGroups = splitEls.map((el) => splitText(el));

  const intro = $('#intro');
  const runIntro = () => new Promise((res) => {
    if (!intro) { res(); return; }
    if (!motion || sess.get('mj-intro', false)) { intro.remove(); res(); return; }
    body.style.overflow = 'hidden';
    const count = $('#introCount'), line = $('#introLine i'), actions = $('#introActions'), logo = $('#introLogo');
    const o = { v: 0 };
    G.timeline()
      .from(logo, { scale: 0.55, opacity: 0, rotationY: -90, duration: 1.4, ease: 'expo.out' }, 0)
      .to(line, { scaleX: 1, duration: 2.2, ease: 'power2.inOut' }, 0.2)
      .to(o, { v: 100, duration: 2.2, ease: 'power2.inOut', onUpdate: () => { count.textContent = String(Math.round(o.v)).padStart(3, '0'); } }, 0.2)
      .to(actions, { opacity: 1, duration: 0.7 }, '>-0.2')
      .add(() => $('#introSound')?.focus());
    const enter = (withSound) => {
      sess.set('mj-intro', true);
      SFX.unlock();
      SFX.setEnabled(withSound); paintSound();
      if (withSound) { SFX.swell(); SFX.heehee(); }
      G.timeline({ onComplete: () => { intro.remove(); body.style.overflow = ''; res(); } })
        .to(actions, { opacity: 0, y: 20, duration: 0.3 })
        .to(logo, { scale: 1.6, opacity: 0, duration: 0.8, ease: 'power3.in' }, 0)
        .to(intro, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, 0.3);
    };
    $('#introSound').addEventListener('click', () => enter(true));
    $('#introSilent').addEventListener('click', () => enter(false));
  });

  const enterPage = () => {
    if (!motion) return;
    const tl = G.timeline({ defaults: { ease: 'expo.out' } });
    letterGroups.forEach((letters) => {
      tl.from(letters, { yPercent: 120, rotationX: -90, opacity: 0, duration: 1.4, stagger: 0.045, transformOrigin: '50% 100%' }, 0.05);
    });
    const enters = $$('[data-enter]');
    if (enters.length) tl.from(enters, { y: 50, opacity: 0, duration: 1.1, stagger: 0.12 }, 0.5);
    G.from('.navbar-glass', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.2 });

    // Hero de inicio: la tarjeta de cristal entra en 3D y luego flota
    const tc = $('#tiltCard');
    if (tc) {
      G.from(tc, { y: 140, opacity: 0, rotationY: -40, rotationX: 14, scale: 0.88, duration: 1.9, ease: 'expo.out', delay: 0.25, onComplete: () => tc._idle && tc._idle() });
      G.from('.tilt-vinyl', { xPercent: -45, opacity: 0, duration: 1.8, ease: 'expo.out', delay: 1 });
      G.from('.tilt-chip', { scale: 0, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'back.out(2)', delay: 1.4 });
      G.from('.tilt-glass > *', { y: 20, opacity: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out', delay: 1.1 });
    }
    const wl = $('.welcome-line .wl-a');
    if (wl) G.fromTo(wl, { backgroundPosition: '200% 50%' }, { backgroundPosition: '-100% 50%', duration: 7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    $$('[data-stage]').forEach((s) => s._enter && s._enter());
    // Heros de subpáginas: barras de cine que se abren, numeral gigante y línea de autoría
    $$('.phero').forEach((h) => {
      G.from($$('.phero-bars i', h), { height: '46vh', duration: 1.7, ease: 'expo.inOut', delay: 0.1 });
      G.from($('.phero-num', h), { opacity: 0, xPercent: -14, duration: 2.2, ease: 'expo.out', delay: 0.4 });
      G.from($('.pc-line', h), { scaleX: 0, transformOrigin: 'left center', duration: 1.4, ease: 'expo.out', delay: 1.2 });
      G.from($('.phero-index', h), { opacity: 0, x: 30, duration: 1.2, ease: 'expo.out', delay: 1 });
    });
  };

  // La entrada se lanza al abrirse la cortina; con intro (1.ª visita), cuando esta termina.
  (async () => {
    if (intro && motion && !sess.get('mj-intro', false)) {
      if (curtain) curtain.style.display = 'none';        // el intro ya cubre la pantalla
      await runIntro();
    } else {
      intro?.remove();
      await curtainOpen();
    }
    enterPage();
  })();


  /* ------------------------------------------------------------ 5. CURSOR + ESTELA DORADA + DESTELLOS */
  // Destello dorado reutilizable (también lo usa el botón Hee-Hee)
  const sparkBurst = (x, y, n = 10) => {
    if (!G || reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i'); s.className = 'spark';
      s.style.left = x + 'px'; s.style.top = y + 'px';
      if (i % 3 === 0) s.classList.add('spark-star');
      document.body.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = 36 + Math.random() * 70;
      G.fromTo(s, { scale: 0.4 + Math.random() }, { x: Math.cos(a) * d, y: Math.sin(a) * d + 10, scale: 0, opacity: 0, rotate: Math.random() * 180, duration: 0.8 + Math.random() * 0.5, ease: 'power3.out', onComplete: () => s.remove() });
    }
  };

  if (finePointer && !reduceMotion) {
    const dot = $('#cursorDot'), glow = $('#cursorGlow');
    let mx = innerWidth / 2, my = innerHeight / 2, gx = mx, gy = my;
    body.classList.add('has-cursor');

    // Estela: cometa dorado dibujado en un canvas a pantalla completa
    const tc = document.createElement('canvas'); tc.id = 'trail'; tc.setAttribute('aria-hidden', 'true'); document.body.appendChild(tc);
    const t2 = tc.getContext('2d'); let TW = 0, TH = 0;
    const tsize = () => { const d = Math.min(devicePixelRatio || 1, 2); TW = tc.width = innerWidth * d; TH = tc.height = innerHeight * d; t2.setTransform(d, 0, 0, d, 0, 0); };
    tsize(); addEventListener('resize', tsize);
    const pts = []; let idle = 0;

    document.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY; idle = 0;
      dot.style.transform = `translate(${mx}px, ${my}px)`;
      pts.push({ x: mx, y: my, a: 1 });
      if (pts.length > 26) pts.shift();
    });
    const frame = () => {
      gx += (mx - gx) * 0.16; gy += (my - gy) * 0.16;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      idle++;
      t2.clearRect(0, 0, innerWidth, innerHeight);
      if (pts.length) {
        t2.globalCompositeOperation = 'lighter';
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i]; p.a *= 0.9;
          const r = 1 + (i / pts.length) * 7;
          const g = t2.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.4);
          g.addColorStop(0, `rgba(255,236,190,${0.55 * p.a})`); g.addColorStop(0.4, `rgba(244,213,141,${0.28 * p.a})`); g.addColorStop(1, 'rgba(212,175,55,0)');
          t2.fillStyle = g; t2.beginPath(); t2.arc(p.x, p.y, r * 2.4, 0, 7); t2.fill();
        }
        while (pts.length && pts[0].a < 0.03) pts.shift();
      }
      requestAnimationFrame(frame);
    };
    frame();

    document.addEventListener('pointerdown', (e) => sparkBurst(e.clientX, e.clientY, 10));
    document.addEventListener('pointerover', (e) => body.classList.toggle('cursor-hover', !!e.target.closest('a, button, label, .track, .product-card, .cf-item, .album-card, [role="button"]')));
    document.documentElement.addEventListener('pointerleave', () => body.classList.remove('has-cursor'));
    document.documentElement.addEventListener('pointerenter', () => body.classList.add('has-cursor'));

    // Destellos sutiles al pasar por elementos clave
    const SPARK_SEL = '.btn-liquid, .btn-ghost, .album-card, .portal, .brand, .heehee-btn, .hee-pill, .tg-play, .cf-item, .album-play, .product-card';
    let lastSpark = null;
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest(SPARK_SEL);
      if (el && el !== lastSpark) sparkBurst(e.clientX, e.clientY, 5);
      lastSpark = el;
    });
  }

  // Campo de partículas doradas flotantes (todo el sitio)
  if (!reduceMotion) {
    const fc = document.createElement('canvas'); fc.id = 'goldfield'; fc.setAttribute('aria-hidden', 'true'); document.body.appendChild(fc);
    const f2 = fc.getContext('2d'); let FW = 1, FH = 1;
    const fsize = () => { const d = Math.min(devicePixelRatio || 1, 1.5); FW = fc.width = innerWidth * d; FH = fc.height = innerHeight * d; f2.setTransform(d, 0, 0, d, 0, 0); };
    fsize(); addEventListener('resize', fsize);
    const spr = document.createElement('canvas'); spr.width = spr.height = 24;
    const sc = spr.getContext('2d'), gr = sc.createRadialGradient(12, 12, 0, 12, 12, 12);
    gr.addColorStop(0, 'rgba(255,244,214,1)'); gr.addColorStop(0.35, 'rgba(244,213,141,.6)'); gr.addColorStop(1, 'rgba(212,175,55,0)');
    sc.fillStyle = gr; sc.fillRect(0, 0, 24, 24);
    const N = innerWidth < 768 ? 16 : 34;
    const fp = Array.from({ length: N }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: 2 + Math.random() * 5, vy: 0.12 + Math.random() * 0.35, sw: Math.random() * 6, a: Math.random(), ph: Math.random() * 6 }));
    let ft = 0;
    const fdraw = () => {
      if (document.hidden) { requestAnimationFrame(fdraw); return; }
      ft += 0.016; f2.clearRect(0, 0, innerWidth, innerHeight);
      fp.forEach((p) => {
        p.y -= p.vy; p.x += Math.sin(ft + p.ph) * 0.25;
        if (p.y < -10) { p.y = innerHeight + 10; p.x = Math.random() * innerWidth; }
        f2.globalAlpha = (0.25 + 0.55 * Math.abs(Math.sin(ft * 0.8 + p.ph))) * 0.55;
        f2.drawImage(spr, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      });
      requestAnimationFrame(fdraw);
    };
    fdraw();
  }


  /* ------------------------------------------------------------ 6. PARALLAX */
  const layers = $$('[data-parallax]');
  const bar = $('#scrollProgress');
  let px = 0, py = 0, ticking = false;
  const applyScroll = () => {
    ticking = false;
    if (bar) bar.style.transform = `scaleX(${Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight))})`;
    if (reduceMotion) return;
    layers.forEach((el) => {
      const sp = parseFloat(el.dataset.parallax), par = el.parentElement, r = par.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const center = r.top + r.height / 2 - innerHeight / 2;
      const lim = r.height * 0.2;
      const y = Math.max(-lim, Math.min(lim, -center * sp + py * sp * 40));
      el.style.translate = `${px * sp * 60}px ${y}px`;
    });
  };
  const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } };
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  addEventListener('pointermove', (e) => { px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5; if (layers.length) req(); });
  req();


  /* ------------------------------------------------------------ 7. HERO 3D, PARTÍCULAS, MARQUEE, HSCROLL */
  const hero = $('.hero');
  if (hero) {
    if (!reduceMotion) {
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
        hero.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
    // Tarjeta de cristal con 3D Tilt avanzado: inclinación, profundidad por capas, reflejo de luz y sombra dinámica
    const tcard = $('#tiltCard');
    if (tcard && motion) {
      const rx = G.quickTo(tcard, 'rotationX', { duration: 0.7, ease: 'power3.out' });
      const ry = G.quickTo(tcard, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      const frame = $('.tilt-frame', tcard);
      let inside = false;
      const set = (n, v) => tcard.style.setProperty(n, v);
      hero.addEventListener('pointermove', (e) => {
        const r = tcard.getBoundingClientRect();
        const lx = (e.clientX - r.left) / r.width, ly = (e.clientY - r.top) / r.height;      // 0..1 dentro de la tarjeta
        inside = lx >= 0 && lx <= 1 && ly >= 0 && ly <= 1;
        const k = inside ? 1 : 0.35;                                                          // más sutil lejos de la tarjeta
        const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2 * (inside ? 0.45 : 1))));
        const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2 * (inside ? 0.6 : 1))));
        ry(nx * 16 * k); rx(-ny * 12 * k);
        set('--lx', `${(lx * 100).toFixed(1)}%`); set('--ly', `${(ly * 100).toFixed(1)}%`);   // posición del reflejo
        set('--sx', `${(-nx * 26).toFixed(1)}px`); set('--sy', `${(18 - ny * 16).toFixed(1)}px`); // la sombra se opone a la inclinación
        tcard.classList.toggle('is-hot', inside);
      });
      hero.addEventListener('pointerleave', () => { rx(0); ry(0); tcard.classList.remove('is-hot'); set('--lx', '50%'); set('--ly', '30%'); set('--sx', '0px'); set('--sy', '22px'); });
      // Flotación suave y brillo que barre el cristal (arranca tras la entrada, ver enterPage)
      tcard._idle = () => {
        G.to(tcard, { y: -12, duration: 3.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        G.to('.tilt-chip', { y: 'random(-10,10)', x: 'random(-6,6)', duration: 'random(2.4,3.8)', yoyo: true, repeat: -1, ease: 'sine.inOut', stagger: 0.3 });
        G.fromTo('.tilt-shine', { xPercent: -130 }, { xPercent: 130, duration: 2.6, repeat: -1, repeatDelay: 3.4, ease: 'power2.inOut' });
        if (frame) G.fromTo(frame.querySelector('img'), { scale: 1.12 }, { scale: 1.04, duration: 14, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      };
      // Móvil: el giroscopio inclina la tarjeta
      if (!finePointer && window.DeviceOrientationEvent) {
        addEventListener('deviceorientation', (e) => { if (e.gamma == null) return; ry(Math.max(-14, Math.min(14, e.gamma / 3))); rx(Math.max(-10, Math.min(10, -(e.beta - 45) / 4))); }, { passive: true });
      }
      if (ST) G.to('.tilt-wrap', { yPercent: -10, scale: 0.92, opacity: 0.4, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }
  }

  /* ------------------------------------------------------------ 7c. HEROS ANIMADOS (banners) */
  const initDust = (cv, host) => {
    const c = cv.getContext('2d');
    let W = 1, H = 1, run = true; const mouse = { x: -999, y: -999 };
    const spr = document.createElement('canvas'); spr.width = spr.height = 32;       // destello prerenderizado (barato)
    const sc = spr.getContext('2d'), gr = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.3, 'rgba(244,213,141,.7)'); gr.addColorStop(1, 'rgba(212,175,55,0)');
    sc.fillStyle = gr; sc.fillRect(0, 0, 32, 32);
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); W = cv.width = Math.max(1, host.clientWidth * d); H = cv.height = Math.max(1, host.clientHeight * d); };
    size(); addEventListener('resize', size);
    const pts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 7 + 3, v: Math.random() * 0.0004 + 0.0001, a: Math.random() * 0.6 + 0.2, ox: 0, oy: 0 }));
    host.addEventListener('pointermove', (e) => { const r = host.getBoundingClientRect(), d = W / host.clientWidth; mouse.x = (e.clientX - r.left) * d; mouse.y = (e.clientY - r.top) * d; });
    const draw = () => {
      if (!run) return;
      c.clearRect(0, 0, W, H);
      const k = W / host.clientWidth;
      pts.forEach((p) => {
        p.y -= p.v; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
        const x = p.x * W + p.ox, y = p.y * H + p.oy, dx = x - mouse.x, dy = y - mouse.y, d = Math.hypot(dx, dy) || 1;
        if (d < 160) { p.ox += (dx / d) * (160 - d) * 0.05; p.oy += (dy / d) * (160 - d) * 0.05; }
        p.ox *= 0.94; p.oy *= 0.94;
        const r = p.r * k; c.globalAlpha = p.a; c.drawImage(spr, x - r, y - r, r * 2, r * 2);
      });
      requestAnimationFrame(draw);
    };
    new IntersectionObserver(([e]) => { const was = run; run = e.isIntersecting; if (run && !was) draw(); }).observe(host);
    draw();
  };

  $$('.hbanner').forEach((hb) => {
    const host = hb.parentElement;
    const img = $('.hbanner-img', hb), light = $('.hbanner-light', hb), cv = $('canvas.dust', hb);
    if (cv && !reduceMotion) initDust(cv, host);
    if (!motion) return;
    // Cámara: entra con zoom y luego "respira" lentamente
    G.fromTo(img, { scale: 1.24 }, { scale: 1.08, duration: 3.4, ease: 'expo.out' });
    G.to(img, { scale: 1.17, duration: 24, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 3.4 });
    // Parallax con el cursor
    const qx = G.quickTo(img, 'x', { duration: 1.3, ease: 'power3.out' }), qy = G.quickTo(img, 'y', { duration: 1.3, ease: 'power3.out' });
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      qx(-((e.clientX - r.left) / r.width - 0.5) * 38); qy(-((e.clientY - r.top) / r.height - 0.5) * 24);
    });
    host.addEventListener('pointerleave', () => { qx(0); qy(0); });
    // Barrido de luz y orbes flotantes
    if (light) G.fromTo(light, { xPercent: -70, opacity: 0 }, { xPercent: 70, opacity: 1, duration: 6.5, repeat: -1, repeatDelay: 2, ease: 'sine.inOut' });
    for (let i = 0; i < 3; i++) {
      const o = document.createElement('span'); o.className = 'orb'; o.setAttribute('aria-hidden', 'true');
      o.style.cssText = `left:${15 + i * 32}%;top:${25 + (i % 2) * 35}%;width:${180 + i * 70}px;height:${180 + i * 70}px`;
      hb.appendChild(o);
      G.to(o, { x: 'random(-140,140)', y: 'random(-90,90)', scale: 'random(.8,1.3)', duration: 'random(7,11)', repeat: -1, repeatRefresh: true, yoyo: true, ease: 'sine.inOut' });
    }
    if (ST) G.to(hb, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: host, start: 'top top', end: 'bottom top', scrub: true } });
  });

  $$('.phero').forEach((h) => {
    const num = $('.phero-num', h);
    if (motion && ST && num) G.to(num, { yPercent: -38, xPercent: 8, ease: 'none', scrollTrigger: { trigger: h, start: 'top top', end: 'bottom top', scrub: true } });
  });

  /* ------------------------------------------------------------ 7d. HEROS ESCÉNICOS 3D (data-stage) */
  // Un solo bucle por hero compone cámara 3D (cursor / giroscopio / deriva automática), luz dinámica,
  // letras magnéticas y la inclinación "hacia el escenario" al hacer scroll. Se detiene fuera de pantalla.
  const clamp1 = (v) => Math.max(-1, Math.min(1, v));
  $$('[data-stage]').forEach((sh) => {
    const rig = $('.sh-rig', sh), photo = $('.sh-photo', sh), img = $('.sh-img', sh), back = $('.sh-back', sh),
      fx = $('.sh-fx', sh), beam = $('.sh-beam', sh), sheen = $('.sh-sheen', sh), copy = $('.sh-copy', sh), cv = $('canvas.dust', sh);
    if (cv && !reduceMotion) initDust(cv, sh);
    if (!motion) return;

    const st = { tx: 0, ty: 0, cx: 0, cy: 0, px: -1e4, last: -1e4, scroll: 0, vis: true, ready: false };
    const letters = $$('.sh-title .ch', sh).map((el) => ({ el, c: 0, cx: 0, y: G.quickSetter(el, 'y', 'px'), z: G.quickSetter(el, 'z', 'px'), r: G.quickSetter(el, 'rotationY', 'deg') }));
    const measure = () => letters.forEach((l) => { const r = l.el.getBoundingClientRect(); l.cx = r.left + r.width / 2; });
    addEventListener('resize', measure);

    sh.addEventListener('pointerenter', measure);
    sh.addEventListener('pointermove', (e) => {
      const r = sh.getBoundingClientRect();
      st.tx = clamp1(((e.clientX - r.left) / r.width) * 2 - 1);
      st.ty = clamp1(((e.clientY - r.top) / r.height) * 2 - 1);
      st.px = e.clientX; st.last = performance.now();
    });
    sh.addEventListener('pointerleave', () => { st.last = -1e4; st.px = -1e4; });
    if (!finePointer && window.DeviceOrientationEvent) {
      addEventListener('deviceorientation', (e) => {
        if (e.gamma == null || !st.vis) return;
        st.tx = clamp1(e.gamma / 22); st.ty = clamp1((e.beta - 45) / 26); st.last = performance.now();
      }, { passive: true });
    }

    const tick = () => {
      const t = G.ticker.time, idle = performance.now() - st.last > 2200;
      // Sin interacción la cámara orbita sola en una curva de Lissajous: el 3D se ve también en táctil
      const gx = idle ? Math.sin(t * 0.32) * 0.6 : st.tx, gy = idle ? Math.sin(t * 0.47 + 1.3) * 0.4 : st.ty;
      const dr = G.ticker.deltaRatio(), ease = (f) => 1 - Math.pow(1 - f, dr);   // suavizado independiente de los fps
      st.cx += (gx - st.cx) * ease(0.055); st.cy += (gy - st.cy) * ease(0.055);
      const s = st.scroll, cx = st.cx, cy = st.cy;
      G.set(rig, { rotationY: cx * 6, rotationX: -cy * 4 + s * 18, z: -s * 280, y: s * 60, transformOrigin: '50% 100%' });
      G.set(back, { x: cx * 40, y: cy * 26 });
      G.set(fx, { x: cx * 34, y: cy * 20 });
      if (beam) G.set(beam, { rotation: 14 + cx * 9 });
      G.set(copy, { x: -cx * 16, y: -cy * 8 - s * 140, rotationY: cx * 5, rotationX: -cy * 3, opacity: 1 - s * 1.4 });
      sh.style.setProperty('--lx', `${(50 + cx * 38).toFixed(1)}%`);
      sh.style.setProperty('--ly', `${(38 + cy * 28).toFixed(1)}%`);
      sh.style.setProperty('--dim', (s * 0.75).toFixed(3));
      // Letras magnéticas: se elevan en Z y giran hacia el cursor
      if (st.ready) letters.forEach((l) => {
        const d = st.px - l.cx, k = Math.max(0, 1 - Math.abs(d) / 220);
        l.c += (k - l.c) * ease(0.12);
        l.y(-l.c * 18); l.z(l.c * 70); l.r(clamp1(d / 220) * -l.c * 28);
      });
    };
    const on = () => { G.ticker.remove(tick); G.ticker.add(tick); }, off = () => G.ticker.remove(tick);
    new IntersectionObserver(([e]) => { st.vis = e.isIntersecting; st.vis ? on() : off(); }).observe(sh);
    if (ST) ST.create({ trigger: sh, start: 'top top', end: 'bottom top', onUpdate: (self) => { st.scroll = self.progress; } });

    // Entrada: la foto se abre como un telón en profundidad y la cámara aterriza
    sh._enter = () => {
      G.fromTo(photo, { clipPath: 'inset(22% 16% 22% 16% round 30px)', z: -620, rotationX: 22, rotationY: -12 },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', z: 0, rotationX: 0, rotationY: 0, duration: 2.3, ease: 'expo.inOut', clearProps: 'clipPath' });
      G.fromTo(img, { scale: 1.38 }, { scale: 1.04, duration: 3.2, ease: 'expo.out', delay: 0.3,
        onComplete: () => G.to(img, { scale: 1.1, xPercent: -1.2, duration: 18, yoyo: true, repeat: -1, ease: 'sine.inOut' }) });
      G.from(back, { opacity: 0, duration: 2, delay: 0.6 });
      if (beam) G.from(beam, { opacity: 0, scaleY: 0.3, duration: 2.4, ease: 'expo.out', delay: 1.1 });
      G.from($$('.sh-frame i', sh), { scale: 0, opacity: 0, duration: 1.3, stagger: 0.08, ease: 'expo.out', delay: 1.4 });
      G.from($$('.sh-index, .sh-cue', sh), { opacity: 0, y: 24, duration: 1.2, ease: 'expo.out', delay: 1.6 });
      const cue = $('.sh-cue i', sh);
      if (cue) G.fromTo(cue, { scaleY: 0, transformOrigin: '50% 0%' }, { scaleY: 1, duration: 1.4, repeat: -1, ease: 'expo.inOut', yoyo: true, delay: 2 });
      if (sheen) G.fromTo(sheen, { xPercent: -80, opacity: 0 }, { xPercent: 80, opacity: 1, duration: 3.2, repeat: -1, repeatDelay: 4, ease: 'sine.inOut', delay: 2.4 });
      G.delayedCall(2.2, () => { measure(); st.ready = true; });
    };
  });

  // Ambiente difuminado: la imagen nítida respira dentro de su propio resplandor
  $$('.ambient').forEach((sec) => {
    const fig = $('.ambient-fig img', sec), bg = $('.ambient-bg', sec);
    if (!motion || !ST) return;
    if (fig) G.fromTo(fig, { scale: 1.12, yPercent: 6 }, { scale: 1, yPercent: -6, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 } });
    if (bg) G.fromTo(bg, { scale: 1.2 }, { scale: 1.05, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
  });


  // Marquee que se acelera con la velocidad del scroll
  $$('.marquee').forEach((m) => {
    const track = $('.marquee-track', m);
    if (!track || reduceMotion) return;
    $$('.marquee-item', track).forEach((n) => track.appendChild(Object.assign(n.cloneNode(true), { ariaHidden: 'true' })));
    const dir = m.dataset.dir === 'right' ? -1 : 1;
    let x = 0, last = scrollY, vel = 0;
    const tick = () => {
      vel += (scrollY - last - vel) * 0.1; last = scrollY;
      const half = track.scrollWidth / 2;
      x -= dir * (0.7 + Math.abs(vel) * 0.18);
      if (dir > 0 && -x >= half) x += half;
      if (dir < 0 && x >= 0) x -= half;
      track.style.transform = `translateX(${x}px)`;
      requestAnimationFrame(tick);
    };
    tick();
  });

  // Scroll horizontal con pin (solo escritorio)
  const hs = $('.hscroll');
  if (hs && motion && ST && G.matchMedia) {
    G.matchMedia().add('(min-width: 992px)', () => {
      const track = $('.hscroll-track', hs);
      const dist = () => track.scrollWidth - innerWidth + innerWidth * 0.08;
      const tw = G.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: hs, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.7, invalidateOnRefresh: true } });
      $$('.album-card', track).forEach((c) => G.from(c, { rotationY: 35, opacity: 0.25, scale: 0.88, ease: 'none', scrollTrigger: { trigger: c, containerAnimation: tw, start: 'left 95%', end: 'left 60%', scrub: true } }));
    });
  }


  // Tarjetas de época: inclinación 3D con el cursor y paralaje de la foto
  if (motion && finePointer) {
    $$('.ecard').forEach((c) => {
      const im = $('img', c), rx = G.quickTo(c, 'rotationX', { duration: 0.7, ease: 'power3.out' }), ry = G.quickTo(c, 'rotationY', { duration: 0.7, ease: 'power3.out' });
      const ix = G.quickTo(im, 'x', { duration: 0.9, ease: 'power3.out' }), iy = G.quickTo(im, 'y', { duration: 0.9, ease: 'power3.out' });
      c.addEventListener('pointermove', (e) => { const r = c.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5; ry(nx * 14); rx(-ny * 12); ix(-nx * 24); iy(-ny * 24); });
      c.addEventListener('pointerleave', () => { rx(0); ry(0); ix(0); iy(0); });
    });
  }

  /* ------------------------------------------------------------ 8. EFECTOS DE SCROLL */
  // fadeInUp (animación CSS 5) con retraso en cascada
  const revealIO = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-visible'); obs.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el) => {
    const sibs = $$(':scope > .reveal', el.parentElement);
    el.style.setProperty('--delay', `${Math.max(sibs.indexOf(el), 0) * 0.08}s`);
    revealIO.observe(el);
  });

  // Contadores animados
  const countIO = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.unobserve(en.target);
      const el = en.target, end = parseFloat(el.dataset.count), suf = el.dataset.suffix || '', o = { v: 0 };
      if (!motion) { el.textContent = end.toLocaleString('es-ES') + suf; return; }
      G.to(o, { v: end, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString('es-ES') + suf; } });
    });
  }, { threshold: 0.5 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  // Línea de tiempo: el riel dorado se dibuja con el scroll
  const rail = $('.timeline-rail i');
  if (rail) {
    if (motion && ST) G.to(rail, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.timeline', start: 'top 70%', end: 'bottom 70%', scrub: true } });
    else rail.style.transform = 'scaleY(1)';
  }

  // Galería: zoom y desplazamiento de imagen dentro de su marco
  if (motion && ST) {
    $$('.gallery figure img').forEach((img) => G.fromTo(img, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
  }

  // Inclinación 3D de álbumes siguiendo el cursor
  $$('.album-card').forEach((card) => {
    const sl = $('.album-sleeve', card);
    if (!sl) return;
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      sl.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 26}deg`);
      sl.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 26}deg`);
    });
    card.addEventListener('pointerleave', () => { sl.style.setProperty('--rx', '0deg'); sl.style.setProperty('--ry', '0deg'); });
  });


  /* ------------------------------------------------------------ 9. REPRODUCTOR (estilo Spotify: cola, listas, me gusta, panel completo) */
  const audio = $('#audio');
  const albumById = (id) => ALBUMS.find((a) => a.id === id);
  const mkTracks = (a) => a.tracks.map((t, i) => ({ ...t, i, albumId: a.id, album: a.title, cover: a.cover, color: a.color, key: `${a.id}:${i}` }));
  const LIB = ALBUMS.flatMap(mkTracks);
  const byKey = new Map(LIB.map((t) => [t.key, t]));

  /* ----- Historias y videoclips por canción ----- */
  const SLUG = window.MJ_SLUG || ((t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
  const STORIES = window.MJ_STORIES || {}, CLIPS = window.MJ_CLIPS || {};
  const ERA_OF = { 'off-the-wall': 'off-the-wall', thriller: 'thriller', bad: 'bad', dangerous: 'dangerous-history', history: 'dangerous-history', invincible: 'invincible', xscape: 'xscape' };
  const slugOf = (t) => SLUG(t.title);
  const clipOf = (t) => (t && CLIPS[slugOf(t)]) || null;
  const storyOf = (t) => (t && STORIES[slugOf(t)]) || null;
  const storyHTML = (t) => {
    const st = storyOf(t), a = albumById(t.albumId), c = clipOf(t);
    const v = /versión original/i.test(t.title) ? 'orig' : /versión alternativa/i.test(t.title) ? 'alt' : '';
    const note = v ? `<p class="ns-note"><i class="bi bi-info-circle" aria-hidden="true"></i> ${v === 'orig' ? 'Esta es la versión original (demo) de la canción, previa a la producción moderna del álbum.' : 'Versión alternativa de la canción incluida en la edición deluxe.'}</p>` : '';
    return `<p class="ns-kicker"><i class="bi bi-journal-richtext" aria-hidden="true"></i> Detrás de la canción</p>
      <h3 class="ns-title">${esc(t.title.replace(/\s*\((Versión|Theme)[^)]*\)\s*$/i, ''))}</h3>
      <p class="ns-meta">${esc(a.title)} · ${esc(String(st ? st.y : a.year))}</p>
      ${st ? `<p class="ns-by">${esc(st.by)}</p>` : ''}${note}
      ${(st ? st.s : [a.blurb]).map((p) => `<p class="ns-p">${esc(p)}</p>`).join('')}
      ${c ? `<button type="button" class="ns-clip" data-clip="${esc(slugOf(t))}" aria-label="Ver el videoclip de ${esc(t.title)}"><img src="assets/video/clips/${esc(slugOf(t))}.jpg" alt="" width="320" height="180"><span class="ns-clip-play"><i class="bi bi-play-fill" aria-hidden="true"></i></span><span class="ns-clip-t"><small>${c.live ? 'En vivo' : 'Videoclip oficial'}</small><b>${fmt(c.d)}</b></span></button>` : ''}
      <a class="ns-era" href="historia.html#era-${esc(ERA_OF[t.albumId] || '')}"><i class="bi bi-clock-history" aria-hidden="true"></i> Ver esta época en Historia</a>`;
  };

  let queue = [], cur = -1, hist = [], qsrc = { type: 'album', id: '', name: '' };
  let shuffle = local.get('mj-shuffle', false), repeat = local.get('mj-repeat', 'off');   // off | all | one
  let liked = local.get('mj-liked', []).filter((k) => byKey.has(k));
  let lists = local.get('mj-playlists', []).map((l) => ({ ...l, keys: (l.keys || []).filter((k) => byKey.has(k)) }));
  const saveLib = () => { local.set('mj-liked', liked); local.set('mj-playlists', lists); };

  const P = {
    play: $('#playBtn'), prev: $('#prevBtn'), next: $('#nextBtn'), mute: $('#muteBtn'), seek: $('#seek'), vol: $('#volume'),
    cur: $('#curTime'), dur: $('#durTime'), title: $('#playerTitle'), album: $('#playerAlbum'), cover: $('#playerCover'), box: $('#player'),
    shuf: $('#shuffleBtn'), rep: $('#repeatBtn'), eq: $('#eq'),
  };
  const fill = (r) => r.style.setProperty('--pct', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
  const now = () => queue[cur];
  const isLiked = (k) => liked.includes(k);
  const srcLabel = () => ({ album: 'Álbum', playlist: 'Lista', liked: 'Me gusta' }[qsrc.type] || 'Cola') + (qsrc.name ? ` · ${qsrc.name}` : '');

  /* ----- Cola ----- */
  const setQueueItems = (items, src) => { queue = items.slice(); qsrc = src; cur = -1; hist = []; };
  const ensureAlbumQueue = (albumId) => {
    if (qsrc.type === 'album' && qsrc.id === albumId && queue.length) return;
    const a = albumById(albumId); setQueueItems(mkTracks(a), { type: 'album', id: albumId, name: a.title });
  };

  // Ecualizador animado (barras con GSAP)
  const eqBars = P.eq ? $$('i', P.eq) : [];
  let eqTween = null;
  const eqRun = (on) => {
    if (!G || !eqBars.length) return;
    if (on && !eqTween) eqTween = G.to(eqBars, { height: () => `${25 + Math.random() * 75}%`, duration: 0.35, repeat: -1, repeatRefresh: true, yoyo: true, ease: 'sine.inOut', stagger: 0.07 });
    if (!on && eqTween) { eqTween.kill(); eqTween = null; G.to(eqBars, { height: '30%', duration: 0.3 }); }
  };

  /* ----- Panel completo ----- */
  const NP = { panel: $('#npanel'), back: $('#npBackdrop'), now: $('#npNow'), queue: $('#npQueue'), lib: $('#npLib'), menu: $('#plMenu'), tab: 'now', open: false, libOpen: null, refs: {} };
  const thumb = (t) => `<img src="${esc(t.cover)}" alt="" width="48" height="48" loading="lazy">`;

  const renderNow = () => {
    if (!NP.now) return;
    const t = now();
    if (!t) {
      NP.now.innerHTML = `<div class="np-empty"><i class="bi bi-music-note-beamed" aria-hidden="true"></i><h2>Elige una canción</h2><p>Pulsa cualquier pista del sitio o empieza por un álbum.</p>
        <div class="np-quick">${ALBUMS.slice(0, 4).map((a) => `<button type="button" class="chip-btn" data-play-album="${a.id}">${esc(a.title)}</button>`).join('')}</div></div>`;
      NP.refs = {}; return;
    }
    const next = queue[cur + 1];
    NP.now.innerHTML = `<div class="np-grid"><div class="np-main">
      <div class="np-art" style="--album:${esc(t.color)}">
        <div class="np-vinyl" aria-hidden="true"><div class="vinyl"><span class="vinyl-label" style="background-image:url('${esc(t.cover)}')"></span></div></div>
        <img class="np-cover" src="${esc(t.cover)}" alt="Portada del álbum ${esc(t.album)}" width="400" height="400">
      </div>
      <div class="np-meta">
        <div class="np-titles"><h2 class="np-title">${esc(t.title)}</h2><p class="np-artist">Michael Jackson · <a href="discografia.html#${esc(t.albumId)}">${esc(t.album)}</a></p></div>
        <div class="np-actions">
          <button type="button" class="np-ico np-like${isLiked(t.key) ? ' is-on' : ''}" data-like="${esc(t.key)}" aria-pressed="${isLiked(t.key)}" aria-label="Me gusta"><i class="bi ${isLiked(t.key) ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i></button>
          <button type="button" class="np-ico" data-more="${esc(t.key)}" aria-haspopup="menu" aria-label="Agregar a una lista o a la cola"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="np-prog"><span class="np-cur">0:00</span><input type="range" class="np-seek" min="0" max="100" value="0" step="0.1" aria-label="Progreso de la pista"><span class="np-dur">${fmt(t.dur)}</span></div>
      <div class="np-controls">
        <button type="button" class="np-ico" data-act="shuffle" aria-label="Reproducción aleatoria" aria-pressed="false"><i class="bi bi-shuffle" aria-hidden="true"></i></button>
        <button type="button" class="np-ico np-lg" data-act="prev" aria-label="Pista anterior"><i class="bi bi-skip-start-fill" aria-hidden="true"></i></button>
        <button type="button" class="np-play" data-act="play" aria-label="Reproducir"><i class="bi bi-play-fill" aria-hidden="true"></i></button>
        <button type="button" class="np-ico np-lg" data-act="next" aria-label="Pista siguiente"><i class="bi bi-skip-end-fill" aria-hidden="true"></i></button>
        <button type="button" class="np-ico" data-act="repeat" aria-label="Repetir" aria-pressed="false"><i class="bi bi-repeat" aria-hidden="true"></i></button>
      </div>
      <div class="np-vol"><button type="button" class="np-ico" data-act="mute" aria-label="Silenciar"><i class="bi bi-volume-up" aria-hidden="true"></i></button><input type="range" class="np-volume" min="0" max="1" step="0.01" aria-label="Volumen"></div>
      <p class="np-source">Reproduciendo desde <strong>${esc(srcLabel())}</strong></p>
      ${next ? `<button type="button" class="np-next" data-qi="${cur + 1}"><img src="${esc(next.cover)}" alt="" width="44" height="44"><span><small>A continuación</small><b>${esc(next.title)}</b></span><i class="bi bi-play-fill" aria-hidden="true"></i></button>` : ''}
      </div><aside class="np-story" aria-label="Historia de la canción">${storyHTML(t)}</aside></div>`;
    const q = (s) => $(s, NP.now);
    NP.refs = { seek: q('.np-seek'), cur: q('.np-cur'), dur: q('.np-dur'), play: q('[data-act="play"]'), shuf: q('[data-act="shuffle"]'), rep: q('[data-act="repeat"]'), mute: q('[data-act="mute"]'), vol: q('.np-volume'), art: q('.np-art') };
    NP.refs.vol.value = audio.volume; fill(NP.refs.vol);
    NP.refs.seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (NP.refs.seek.value / 100) * audio.duration; fill(NP.refs.seek); });
    NP.refs.vol.addEventListener('input', () => { audio.volume = Number(NP.refs.vol.value); audio.muted = audio.volume === 0; local.set('mj-vol', audio.volume); P.vol.value = audio.volume; fill(P.vol); fill(NP.refs.vol); muteIcon(); });
    if (audio.duration) { NP.refs.seek.value = (audio.currentTime / audio.duration) * 100; fill(NP.refs.seek); NP.refs.cur.textContent = fmt(audio.currentTime); }
    paintNowState();
    if (motion && NP.open && NP.tab === 'now') G.from([NP.refs.art, ...$$('.np-meta, .np-prog, .np-controls', NP.now)], { y: 24, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'expo.out' });
  };
  const paintNowState = () => {
    const R = NP.refs; if (!R.play) return;
    const playing = !audio.paused;
    R.play.innerHTML = `<i class="bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}" aria-hidden="true"></i>`;
    R.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    R.shuf.classList.toggle('is-on', shuffle); R.shuf.setAttribute('aria-pressed', String(shuffle));
    R.rep.classList.toggle('is-on', repeat !== 'off'); R.rep.setAttribute('aria-pressed', String(repeat !== 'off'));
    $('i', R.rep).className = `bi ${repeat === 'one' ? 'bi-repeat-1' : 'bi-repeat'}`;
    R.art.classList.toggle('is-playing', playing);
    $('i', R.mute).className = `bi ${audio.muted || audio.volume === 0 ? 'bi-volume-mute' : audio.volume < 0.5 ? 'bi-volume-down' : 'bi-volume-up'}`;
  };

  const qRow = (t, i, isNow) => `<li class="q-row${isNow ? ' is-now' : ''}"><button type="button" class="q-play" data-qi="${i}" aria-label="Reproducir ${esc(t.title)}">${thumb(t)}<span class="q-t"><b>${esc(t.title)}</b><small>${esc(t.album)}</small></span><span class="q-d">${fmt(t.dur)}</span></button>${isNow ? '' : `<button type="button" class="q-rm" data-qrm="${i}" aria-label="Quitar de la cola"><i class="bi bi-x-lg" aria-hidden="true"></i></button>`}</li>`;
  const renderQueue = () => {
    if (!NP.queue) return;
    if (!queue.length) { NP.queue.innerHTML = `<div class="np-empty"><i class="bi bi-music-note-list" aria-hidden="true"></i><h2>La cola está vacía</h2><p>Elige un álbum o añade canciones con el botón ＋ de cada pista.</p></div>`; return; }
    const up = queue.slice(cur + 1);
    NP.queue.innerHTML = `
      <p class="np-source">Reproduciendo desde <strong>${esc(srcLabel())}</strong></p>
      <h3 class="np-h">Reproduciendo ahora</h3>
      <ul class="q-list">${cur > -1 ? qRow(queue[cur], cur, true) : '<li class="q-empty">Pulsa ▶ para empezar</li>'}</ul>
      <div class="np-h-row"><h3 class="np-h">A continuación <small>· ${up.length}</small></h3>${up.length ? '<button type="button" class="link-quiet" data-act="clearq">Vaciar cola</button>' : ''}</div>
      <ul class="q-list">${up.length ? up.map((t, k) => qRow(t, cur + 1 + k, false)).join('') : '<li class="q-empty">No hay más canciones en la cola.</li>'}</ul>`;
  };

  const plCover = (keys) => {
    const c = keys.slice(0, 4).map((k) => byKey.get(k)).filter(Boolean);
    if (!c.length) return '<span class="pl-thumb pl-empty"><i class="bi bi-music-note-list" aria-hidden="true"></i></span>';
    return `<span class="pl-thumb">${c.map((t) => `<img src="${esc(t.cover)}" alt="" loading="lazy">`).join('')}</span>`;
  };
  const plRow = (id, name, keys, special) => {
    const open = NP.libOpen === id;
    const tr = open ? `<ul class="q-list pl-tracks">${keys.length ? keys.map((k) => { const t = byKey.get(k); return `<li class="q-row"><button type="button" class="q-play" data-plplay="${esc(id)}" data-key="${esc(k)}" aria-label="Reproducir ${esc(t.title)}">${thumb(t)}<span class="q-t"><b>${esc(t.title)}</b><small>${esc(t.album)}</small></span><span class="q-d">${fmt(t.dur)}</span></button><button type="button" class="q-rm" data-plrm="${esc(id)}" data-key="${esc(k)}" aria-label="Quitar de la lista"><i class="bi bi-x-lg" aria-hidden="true"></i></button></li>`; }).join('') : '<li class="q-empty">Aún no hay canciones. Usa ＋ en cualquier pista.</li>'}</ul>` : '';
    return `<li class="pl-item${open ? ' is-open' : ''}"><div class="pl-row">
      ${special ? '<span class="pl-thumb pl-heart"><i class="bi bi-heart-fill" aria-hidden="true"></i></span>' : plCover(keys)}
      <button type="button" class="pl-name" data-plopen="${esc(id)}" aria-expanded="${open}"><b>${esc(name)}</b><small>${keys.length} ${keys.length === 1 ? 'canción' : 'canciones'}</small></button>
      <button type="button" class="np-ico" data-plplayall="${esc(id)}" aria-label="Reproducir ${esc(name)}"${keys.length ? '' : ' disabled'}><i class="bi bi-play-fill" aria-hidden="true"></i></button>
      ${special ? '' : `<button type="button" class="np-ico" data-pldel="${esc(id)}" aria-label="Eliminar la lista ${esc(name)}"><i class="bi bi-trash3" aria-hidden="true"></i></button>`}
    </div>${tr}</li>`;
  };
  const renderLib = () => {
    if (!NP.lib) return;
    NP.lib.innerHTML = `
      <form class="pl-new" id="plNew" autocomplete="off"><label class="visually-hidden" for="plName">Nombre de la nueva lista</label><input id="plName" class="field" type="text" maxlength="40" placeholder="Nueva lista de reproducción…"><button type="submit" class="btn-add">Crear</button></form>
      <ul class="pl-list">${plRow('liked', 'Canciones que me gustan', liked, true)}${lists.map((l) => plRow(l.id, l.name, l.keys, false)).join('')}</ul>
      ${lists.length ? '' : '<p class="np-hint">Crea tu primera lista y añade canciones con el botón ＋ de cada pista.</p>'}`;
  };
  const renderPanel = () => { renderNow(); renderQueue(); renderLib(); };

  const setTab = (tab, focus) => {
    NP.tab = tab;
    NP.panel.classList.toggle('is-wide', tab === 'now');
    $$('.np-tabs [role="tab"]').forEach((b) => { const on = b.dataset.tab === tab; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    [['now', NP.now], ['queue', NP.queue], ['lib', NP.lib]].forEach(([k, el]) => { el.hidden = k !== tab; el.classList.toggle('is-on', k === tab); });
    if (tab === 'now') renderNow(); if (tab === 'queue') renderQueue(); if (tab === 'lib') renderLib();
  };
  const openPanel = (tab = 'now') => {
    if (!NP.panel) return;
    NP.open = true; NP.panel.classList.add('is-open'); NP.panel.setAttribute('aria-hidden', 'false'); NP.panel.inert = false;
    body.classList.add('np-open'); NP.back.hidden = false;
    $('#expandBtn')?.setAttribute('aria-expanded', 'true');
    setTab(tab);
  };
  const closePanel = () => {
    if (!NP.panel || !NP.open) return;
    NP.open = false; NP.panel.classList.remove('is-open'); NP.panel.setAttribute('aria-hidden', 'true'); NP.panel.inert = true;
    body.classList.remove('np-open'); NP.back.hidden = true; closeMenu();
    $('#expandBtn')?.setAttribute('aria-expanded', 'false');
  };
  if (NP.panel) NP.panel.inert = true;

  /* ----- Menú contextual de una canción ----- */
  let menuKey = null;
  const closeMenu = () => { if (NP.menu && !NP.menu.hidden) { NP.menu.hidden = true; menuKey = null; } };
  const openMenu = (key, anchor) => {
    const t = byKey.get(key); if (!t) return;
    menuKey = key;
    NP.menu.innerHTML = `
      <p class="pm-title">${esc(t.title)}<small>${esc(t.album)}</small></p>
      <button type="button" role="menuitem" data-m="next"><i class="bi bi-skip-forward-fill" aria-hidden="true"></i> Reproducir a continuación</button>
      <button type="button" role="menuitem" data-m="queue"><i class="bi bi-list-ol" aria-hidden="true"></i> Agregar a la cola</button>
      <button type="button" role="menuitem" data-m="like"><i class="bi ${isLiked(key) ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i> ${isLiked(key) ? 'Quitar de Me gusta' : 'Me gusta'}</button>
      <hr><p class="pm-sub">Agregar a una lista</p>
      ${lists.map((l) => `<button type="button" role="menuitem" data-m="pl" data-id="${esc(l.id)}"><i class="bi ${l.keys.includes(key) ? 'bi-check2-square' : 'bi-plus-square'}" aria-hidden="true"></i> ${esc(l.name)}</button>`).join('')}
      <form class="pm-new" data-m="new"><input class="field" type="text" maxlength="40" placeholder="Nueva lista…" aria-label="Nombre de la nueva lista"><button type="submit" class="btn-add">＋</button></form>`;
    NP.menu.hidden = false;
    const r = anchor.getBoundingClientRect(), w = NP.menu.offsetWidth, h = NP.menu.offsetHeight;
    let x = Math.min(innerWidth - w - 10, Math.max(10, r.right - w)), y = r.bottom + 8;
    if (y + h > innerHeight - 100) y = Math.max(10, r.top - h - 8);
    NP.menu.style.left = `${x}px`; NP.menu.style.top = `${y}px`;
    if (motion) G.fromTo(NP.menu, { opacity: 0, y: 8, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'expo.out' });
    $('button', NP.menu)?.focus();
  };

  /* ----- Listas y me gusta ----- */
  const uid = () => 'pl' + Date.now().toString(36) + Math.floor(Math.random() * 99);
  const createList = (name, key) => {
    const n = name.trim(); if (!n) return null;
    const l = { id: uid(), name: n, keys: key ? [key] : [] };
    lists.push(l); saveLib(); toast(`Lista «${n}» creada`); SFX.heehee();
    return l;
  };
  const toggleLike = (key) => {
    liked = isLiked(key) ? liked.filter((k) => k !== key) : [key, ...liked];
    saveLib(); SFX.grunt('short'); toast(isLiked(key) ? 'Añadida a Me gusta' : 'Quitada de Me gusta');
    document.dispatchEvent(new CustomEvent('mj:library'));
  };
  const addToList = (id, key) => {
    const l = lists.find((x) => x.id === id); if (!l) return;
    if (l.keys.includes(key)) l.keys = l.keys.filter((k) => k !== key); else l.keys.push(key);
    saveLib(); toast(l.keys.includes(key) ? `Añadida a «${l.name}»` : `Quitada de «${l.name}»`);
    document.dispatchEvent(new CustomEvent('mj:library'));
  };
  const queueNext = (key) => {
    const t = byKey.get(key); if (!t) return;
    if (!queue.length) { setQueueItems([t], { type: 'playlist', id: '', name: 'Tu cola' }); load(0); play(); return; }
    queue.splice(cur + 1, 0, t); toast('Se reproducirá a continuación'); if (NP.open) renderQueue();
  };
  const queueAdd = (key) => {
    const t = byKey.get(key); if (!t) return;
    if (!queue.length) { setQueueItems([t], { type: 'playlist', id: '', name: 'Tu cola' }); load(0); play(); return; }
    queue.push(t); toast('Agregada a la cola'); if (NP.open) renderQueue();
  };
  document.addEventListener('mj:library', () => { if (NP.open) { renderNow(); renderLib(); } syncLikeButtons(); });
  const syncLikeButtons = () => {};

  /* ----- Estado visual ----- */
  const syncUI = () => {
    const playing = !!audio && !audio.paused && !audio.ended;
    const t = now();
    if (P.play) {
      P.play.innerHTML = `<i class="bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}" aria-hidden="true"></i>`;
      P.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    }
    P.box?.classList.toggle('is-playing', playing);
    eqRun(playing);
    $$('.track').forEach((el) => {
      const on = !!t && el.dataset.album === t.albumId && Number(el.dataset.i) === t.i;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on && playing));
      const ic = $('i', el); if (ic) ic.className = `bi ${on && playing ? 'bi-pause-fill' : 'bi-play-fill'}`;
    });
    $$('.album-card').forEach((card) => {
      const on = !!t && card.dataset.album === t.albumId;
      card.classList.toggle('is-playing', on && playing);
      const ic = $('.album-play i', card); if (ic) ic.className = `bi ${on && playing ? 'bi-pause-fill' : 'bi-play-fill'}`;
    });
    $$('.album-detail').forEach((d) => d.classList.toggle('is-playing', playing && !!t && d.dataset.album === t.albumId));
    $$('#playAlbum').forEach((b) => { const on = playing && !!t && b.dataset.album === t.albumId; b.innerHTML = `<span>${on ? 'Pausar álbum' : 'Reproducir álbum'}</span><i class="bi ${on ? 'bi-pause-fill' : 'bi-play-fill'}" aria-hidden="true"></i>`; });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    paintNowState();
  };

  const paintModes = () => {
    if (P.shuf) { P.shuf.classList.toggle('is-on', shuffle); P.shuf.setAttribute('aria-pressed', String(shuffle)); }
    if (P.rep) {
      P.rep.classList.toggle('is-on', repeat !== 'off'); P.rep.setAttribute('aria-pressed', String(repeat !== 'off'));
      $('i', P.rep).className = `bi ${repeat === 'one' ? 'bi-repeat-1' : 'bi-repeat'}`;
      P.rep.setAttribute('aria-label', `Repetir: ${{ off: 'desactivado', all: 'lista completa', one: 'una pista' }[repeat]}`);
    }
    paintNowState();
  };

  const setMedia = (t) => {
    if (!('mediaSession' in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: 'Michael Jackson', album: t.album, artwork: [{ src: new URL(t.cover, location.href).href, sizes: '512x512' }] });
  };

  const load = (idx, silent) => {
    if (!audio || !queue.length) return;
    cur = Math.max(0, Math.min(queue.length - 1, idx));
    hist.push(cur); if (hist.length > 60) hist.shift();
    const t = now();
    audio.dataset.err = '';
    audio.src = t.src;
    P.title.textContent = t.title; P.album.textContent = `Michael Jackson · ${t.album}`;
    P.cover.innerHTML = `<img src="${esc(t.cover)}" alt="">`;
    P.seek.value = 0; fill(P.seek); P.seek.style.setProperty('--buf', '0%');
    P.cur.textContent = '0:00'; P.dur.textContent = fmt(t.dur);
    setMedia(t);
    if (!silent) { pushRecent(t.key); syncUI(); }
    if (NP.panel) { renderNow(); if (NP.tab === 'queue') renderQueue(); }
    paintClipBtn();
    document.dispatchEvent(new CustomEvent('mj:track', { detail: t }));
  };
  // Reproducidas recientemente (la usa la plataforma musica.html)
  const pushRecent = (key) => { const r = local.get('mj-recent', []).filter((k) => k !== key); r.unshift(key); local.set('mj-recent', r.slice(0, 30)); };
  const play = async () => {
    if (cur === -1) { if (!queue.length) ensureAlbumQueue(ALBUMS[0].id); load(shuffle ? Math.floor(Math.random() * queue.length) : 0); }
    try { await audio.play(); } catch (err) { if (!['AbortError', 'NotAllowedError'].includes(err.name)) toast('No se pudo reproducir la pista.'); }
  };
  const toggle = () => (audio.paused ? play() : audio.pause());

  const pick = (dir, auto) => {
    if (!queue.length) return -1;
    if (auto && repeat === 'one') return cur;
    if (shuffle && queue.length > 1) {
      if (dir < 0 && hist.length > 1) { hist.pop(); return hist.pop(); }
      let n; do { n = Math.floor(Math.random() * queue.length); } while (n === cur);
      return n;
    }
    const n = cur + dir;
    if (n >= queue.length) return auto && repeat !== 'all' ? -1 : 0;
    return Math.max(0, n);
  };
  const step = (dir, auto) => {
    const n = pick(dir, auto);
    if (n === -1) { audio.pause(); audio.currentTime = 0; syncUI(); return; }
    load(n); play();
  };

  const playKey = (albumId, i) => {
    const t = now();
    if (t && t.albumId === albumId && t.i === i) { toggle(); return; }
    // Si la canción ya está en la cola actual (p. ej. una lista), se salta a ella; si no, se crea la cola del álbum
    const inQ = queue.findIndex((q) => q.albumId === albumId && q.i === i);
    if (inQ > -1 && qsrc.type !== 'album') { load(inQ); play(); return; }
    ensureAlbumQueue(albumId);
    const idx = queue.findIndex((q) => q.i === i);
    if (idx < 0) return;
    load(idx); play();
  };
  const playAlbum = (id, opts = {}) => {
    const same = qsrc.type === 'album' && qsrc.id === id && queue.length && cur > -1;
    if (opts.shuffle !== undefined) { shuffle = opts.shuffle; local.set('mj-shuffle', shuffle); paintModes(); }
    if (same && !opts.restart) { toggle(); return; }
    ensureAlbumQueue(id);
    load(shuffle ? Math.floor(Math.random() * queue.length) : 0); play();
  };
  const playList = (id, startKey) => {
    const keys = id === 'liked' ? liked : (lists.find((l) => l.id === id) || { keys: [] }).keys;
    if (!keys.length) return;
    const items = keys.map((k) => byKey.get(k));
    const name = id === 'liked' ? 'Canciones que me gustan' : lists.find((l) => l.id === id).name;
    setQueueItems(items, { type: id === 'liked' ? 'liked' : 'playlist', id, name });
    const start = startKey ? Math.max(0, keys.indexOf(startKey)) : (shuffle ? Math.floor(Math.random() * items.length) : 0);
    load(start); play();
  };
  /* ----- Videoclips: superposición con reproductor propio ----- */
  const clipList = () => Object.keys(CLIPS).sort((a, b) => CLIPS[a].o - CLIPS[b].o);
  const VO = { el: null, v: null, slug: '', list: [], wasPlaying: false, ui: {} };
  const buildVO = () => {
    const el = document.createElement('div');
    el.className = 'vo'; el.id = 'vo'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Videoclip');
    el.innerHTML = `<div class="vo-bg" data-vo="close"></div>
      <div class="vo-wrap">
        <div class="vo-main">
          <header class="vo-top"><div class="vo-heading"><p class="vo-kicker"></p><h2 class="vo-title"></h2><p class="vo-sub"></p></div>
            <div class="vo-top-btns"><button type="button" class="vo-ic" data-vo="audio" title="Escuchar solo el audio" aria-label="Escuchar solo el audio"><i class="bi bi-music-note-beamed" aria-hidden="true"></i></button><button type="button" class="vo-ic" data-vo="close" aria-label="Cerrar el videoclip"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div></header>
          <div class="vo-stage"><video playsinline preload="metadata"></video><div class="vo-click" data-vo="toggle"></div>
            <button type="button" class="vo-big" data-vo="toggle" aria-label="Reproducir"><i class="bi bi-play-fill" aria-hidden="true"></i></button>
            <div class="vo-bar"><button type="button" class="vo-ic" data-vo="prev" aria-label="Videoclip anterior"><i class="bi bi-skip-start-fill" aria-hidden="true"></i></button>
              <button type="button" class="vo-ic vo-play" data-vo="toggle" aria-label="Pausar"><i class="bi bi-pause-fill" aria-hidden="true"></i></button>
              <button type="button" class="vo-ic" data-vo="next" aria-label="Videoclip siguiente"><i class="bi bi-skip-end-fill" aria-hidden="true"></i></button>
              <span class="vo-time">0:00</span><input type="range" class="vo-seek" min="0" max="100" step="0.1" value="0" aria-label="Progreso del videoclip"><span class="vo-dur">0:00</span>
              <button type="button" class="vo-ic" data-vo="mute" aria-label="Silenciar"><i class="bi bi-volume-up" aria-hidden="true"></i></button><input type="range" class="vo-vol" min="0" max="1" step="0.01" value="0.8" aria-label="Volumen del video">
              <button type="button" class="vo-ic" data-vo="full" aria-label="Pantalla completa"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i></button></div></div>
        </div>
        <aside class="vo-side" aria-label="Más videoclips"><h3>Más videoclips</h3><ol class="vo-list"></ol></aside>
      </div>`;
    document.body.appendChild(el);
    VO.el = el; VO.v = $('video', el);
    VO.ui = { title: $('.vo-title', el), sub: $('.vo-sub', el), kick: $('.vo-kicker', el), play: $('.vo-play', el), big: $('.vo-big', el), time: $('.vo-time', el), dur: $('.vo-dur', el), seek: $('.vo-seek', el), vol: $('.vo-vol', el), mute: $('[data-vo="mute"]', el), list: $('.vo-list', el), stage: $('.vo-stage', el) };
    const v = VO.v, u = VO.ui;
    const ic = (b, c) => { $('i', b).className = `bi ${c}`; };
    const paint = () => {
      const p = !v.paused && !v.ended; ic(u.play, p ? 'bi-pause-fill' : 'bi-play-fill'); u.play.setAttribute('aria-label', p ? 'Pausar' : 'Reproducir');
      u.big.classList.toggle('is-hidden', p); el.classList.toggle('is-playing', p);
      ic(u.mute, v.muted || v.volume === 0 ? 'bi-volume-mute' : v.volume < 0.5 ? 'bi-volume-down' : 'bi-volume-up');
    };
    v.addEventListener('play', paint); v.addEventListener('pause', paint); v.addEventListener('volumechange', paint);
    v.addEventListener('loadedmetadata', () => { u.dur.textContent = fmt(v.duration); });
    v.addEventListener('timeupdate', () => { if (!v.duration) return; u.seek.value = (v.currentTime / v.duration) * 100; fill(u.seek); u.time.textContent = fmt(v.currentTime); });
    v.addEventListener('ended', () => { paint(); vStep(1, true); });
    v.addEventListener('error', () => { toast('No se pudo cargar este videoclip.'); });
    u.seek.addEventListener('input', () => { if (v.duration) v.currentTime = (u.seek.value / 100) * v.duration; fill(u.seek); });
    u.vol.addEventListener('input', () => { v.volume = Number(u.vol.value); v.muted = v.volume === 0; fill(u.vol); local.set('mj-vvol', v.volume); });
    v.volume = Number(local.get('mj-vvol', 0.8)); u.vol.value = v.volume; fill(u.vol);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-vo]'); const li = e.target.closest('[data-vslug]');
      if (li) { openClip(li.dataset.vslug, VO.list); return; }
      if (!b) return;
      const a = b.dataset.vo;
      if (a === 'close') closeClip();
      if (a === 'toggle') (v.paused ? v.play() : v.pause());
      if (a === 'prev') vStep(-1);
      if (a === 'next') vStep(1);
      if (a === 'mute') { v.muted = !v.muted; }
      if (a === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else u.stage.requestFullscreen?.(); }
      if (a === 'audio') { const t = LIB.find((x) => slugOf(x) === VO.slug); closeClip(); if (t) playKey(t.albumId, t.i); }
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') { const f = $$('button, input, [href]', el).filter((x) => !x.disabled && x.offsetParent !== null); if (!f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    });
    document.addEventListener('keydown', (e) => {
      if (el.hidden || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === 'Escape') { if (!document.fullscreenElement) closeClip(); }
      else if (e.code === 'Space') { e.preventDefault(); if (document.activeElement && document.activeElement.tagName === 'BUTTON') return; v.paused ? v.play() : v.pause(); }
      else if (e.key === 'ArrowRight') v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
      else if (e.key === 'ArrowLeft') v.currentTime = Math.max(0, v.currentTime - 5);
      else if (e.key.toLowerCase() === 'm') v.muted = !v.muted;
      else if (e.key.toLowerCase() === 'f') u.stage.requestFullscreen?.();
    });
  };
  const vStep = (dir, auto) => {
    const i = VO.list.indexOf(VO.slug), n = VO.list[i + dir];
    if (n) openClip(n, VO.list); else if (auto) { VO.v.currentTime = 0; }
  };
  const openClip = (slug, list) => {
    const c = CLIPS[slug]; if (!c) return;
    if (!VO.el) buildVO();
    const opening = VO.el.hidden;
    if (opening) { VO.wasPlaying = !!audio && !audio.paused; if (audio) audio.pause(); }
    VO.slug = slug; VO.list = list && list.length ? list : clipList();
    const a = albumById(c.a), u = VO.ui, v = VO.v;
    u.kick.textContent = c.live ? 'En vivo · Bucarest, 1992' : `Videoclip oficial · ${c.y}`;
    u.title.textContent = c.t; u.sub.textContent = `Michael Jackson · ${a ? a.title : ''}`;
    v.poster = `assets/video/clips/${slug}.jpg`; v.src = `assets/video/clips/${slug}.mp4`;
    u.seek.value = 0; fill(u.seek); u.time.textContent = '0:00'; u.dur.textContent = fmt(c.d);
    u.list.innerHTML = VO.list.map((s) => `<li><button type="button" data-vslug="${esc(s)}" class="${s === slug ? 'is-on' : ''}"><img src="assets/video/clips/${esc(s)}.jpg" alt="" width="96" height="54" loading="lazy"><span><b>${esc(CLIPS[s].t)}</b><small>${esc((albumById(CLIPS[s].a) || {}).title || '')} · ${fmt(CLIPS[s].d)}</small></span></button></li>`).join('');
    const on = $('.is-on', u.list); if (on) on.scrollIntoView({ block: 'nearest' });
    VO.el.hidden = false; body.classList.add('vo-open');
    v.play().catch(() => {});
    if (opening) { VO.opener = document.activeElement; $('[data-vo="close"].vo-ic', VO.el).focus({ preventScroll: true }); if (motion) { G.fromTo(VO.el, { opacity: 0 }, { opacity: 1, duration: 0.4 }); G.from($('.vo-main', VO.el), { y: 40, scale: 0.96, duration: 0.7, ease: 'expo.out' }); } }
    document.dispatchEvent(new CustomEvent('mj:clip', { detail: slug }));
  };
  const closeClip = () => {
    if (!VO.el || VO.el.hidden) return;
    if (document.fullscreenElement) document.exitFullscreen();
    VO.v.pause(); VO.v.removeAttribute('src'); VO.v.load();
    VO.el.hidden = true; body.classList.remove('vo-open');
    if (VO.wasPlaying && audio) audio.play().catch(() => {});
    VO.opener?.focus?.({ preventScroll: true });
  };
  // Botón de videoclip en la barra del reproductor
  const clipBtn = document.createElement('button');
  clipBtn.type = 'button'; clipBtn.className = 'ctrl ctrl-sm'; clipBtn.id = 'clipBtn'; clipBtn.hidden = true;
  clipBtn.setAttribute('aria-label', 'Ver el videoclip de esta canción'); clipBtn.title = 'Ver videoclip';
  clipBtn.innerHTML = '<i class="bi bi-camera-video" aria-hidden="true"></i>';
  $('#queueBtn')?.before(clipBtn);
  clipBtn.addEventListener('click', () => { const t = now(); if (t && clipOf(t)) openClip(slugOf(t)); });
  function paintClipBtn() { const t = now(); clipBtn.hidden = !(t && clipOf(t)); }
  document.addEventListener('click', (e) => { const c = e.target.closest('[data-clip]'); if (c) { e.preventDefault(); openClip(c.dataset.clip); } });

  window.MJ = {
    playKey, playAlbum, sync: syncUI, isPlaying: () => !!audio && !audio.paused, current: now, openPanel, closePanel,
    tracks: LIB, byKey, albums: ALBUMS, album: albumById, audio, clips: CLIPS, clipList, clipOf, storyOf, storyHTML, slugOf, openClip, closeClip, eraOf: (id) => ERA_OF[id],
    isLiked, toggleLike, addToList, createList, queueNext, queueAdd, openMenu, playList,
    liked: () => liked.slice(), lists: () => lists.map((l) => ({ ...l, keys: l.keys.slice() })), recent: () => local.get('mj-recent', []).filter((k) => byKey.has(k)),
    deleteList: (id) => { lists = lists.filter((l) => l.id !== id); saveLib(); document.dispatchEvent(new CustomEvent('mj:library')); },
    renameList: (id, name) => { const l = lists.find((x) => x.id === id); if (l && name.trim()) { l.name = name.trim().slice(0, 40); saveLib(); document.dispatchEvent(new CustomEvent('mj:library')); } },
    reorderList: (id, keys) => { const l = lists.find((x) => x.id === id); if (l) { l.keys = keys.filter((k) => byKey.has(k)); saveLib(); document.dispatchEvent(new CustomEvent('mj:library')); } },
    playTracks: (keys, name, startKey, doShuffle, srcId) => {
      const items = keys.map((k) => byKey.get(k)).filter(Boolean); if (!items.length) return;
      if (doShuffle !== undefined) { shuffle = doShuffle; local.set('mj-shuffle', shuffle); paintModes(); }
      setQueueItems(items, { type: 'playlist', id: srcId || '', name: name || 'Tu cola' });
      const start = startKey ? Math.max(0, items.findIndex((t) => t.key === startKey)) : (shuffle ? Math.floor(Math.random() * items.length) : 0);
      load(start); play();
    },
    queueState: () => ({ queue: queue.slice(), cur, src: { ...qsrc } }),
    toggle: () => (cur === -1 ? play() : toggle()),
  };

  if (audio) {
    /* ----- Clics globales: pistas, álbumes, menú ----- */
    document.addEventListener('click', (e) => {
      const t = e.target.closest('.track');
      if (t) { playKey(t.dataset.album, Number(t.dataset.i)); openPanel('now'); return; }
      const a = e.target.closest('[data-play-album]');
      if (a) { playAlbum(a.dataset.playAlbum); return; }
      const more = e.target.closest('[data-more]');
      if (more) { e.stopPropagation(); if (!NP.menu.hidden && menuKey === more.dataset.more) closeMenu(); else openMenu(more.dataset.more, more); return; }
      if (!e.target.closest('#plMenu')) closeMenu();
    });

    /* ----- Menú contextual ----- */
    NP.menu?.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-m]'); if (!b || !menuKey) return;
      const k = menuKey, m = b.dataset.m;
      if (m === 'next') { queueNext(k); closeMenu(); }
      if (m === 'queue') { queueAdd(k); closeMenu(); }
      if (m === 'like') { toggleLike(k); closeMenu(); }
      if (m === 'pl') { addToList(b.dataset.id, k); openMenu(k, document.querySelector(`[data-more="${CSS.escape(k)}"]`) || NP.menu); }
    });
    NP.menu?.addEventListener('submit', (e) => {
      e.preventDefault(); const inp = $('input', NP.menu), k = menuKey;
      const l = createList(inp.value, k); if (l) { closeMenu(); if (NP.open) renderLib(); document.dispatchEvent(new CustomEvent('mj:library')); }
    });

    /* ----- Panel: pestañas, cierre, acciones ----- */
    $$('.np-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    $('.np-tabs')?.addEventListener('keydown', (e) => {
      const tabs = $$('.np-tabs [role="tab"]'), i = tabs.findIndex((x) => x.getAttribute('aria-selected') === 'true');
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].dataset.tab, true); }
    });
    $('#npClose')?.addEventListener('click', closePanel);
    NP.back?.addEventListener('click', closePanel);
    $('#expandBtn')?.addEventListener('click', () => (NP.open ? closePanel() : openPanel('now')));
    $('#queueBtn')?.addEventListener('click', () => (NP.open && NP.tab === 'queue' ? closePanel() : openPanel('queue')));
    const info = $('#playerInfo');
    info?.addEventListener('click', () => (NP.open ? closePanel() : openPanel('now')));
    info?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); NP.open ? closePanel() : openPanel('now'); } });

    NP.panel?.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'play') { if (cur === -1) play(); else toggle(); }
        if (a === 'prev') P.prev.click();
        if (a === 'next') P.next.click();
        if (a === 'shuffle') { shuffle = !shuffle; local.set('mj-shuffle', shuffle); paintModes(); }
        if (a === 'repeat') { repeat = { off: 'all', all: 'one', one: 'off' }[repeat]; local.set('mj-repeat', repeat); paintModes(); }
        if (a === 'mute') { audio.muted = !audio.muted; muteIcon(); paintNowState(); }
        if (a === 'clearq') { queue = queue.slice(0, cur + 1); renderQueue(); toast('Cola vaciada'); }
        return;
      }
      const lk = e.target.closest('[data-like]'); if (lk) { toggleLike(lk.dataset.like); return; }
      const qi = e.target.closest('[data-qi]'); if (qi) { load(Number(qi.dataset.qi)); play(); return; }
      const qrm = e.target.closest('[data-qrm]'); if (qrm) { const i = Number(qrm.dataset.qrm); queue.splice(i, 1); if (i < cur) cur--; renderQueue(); return; }
      const pp = e.target.closest('[data-plplay]'); if (pp) { playList(pp.dataset.plplay, pp.dataset.key); return; }
      const pa = e.target.closest('[data-plplayall]'); if (pa) { playList(pa.dataset.plplayall); return; }
      const po = e.target.closest('[data-plopen]'); if (po) { NP.libOpen = NP.libOpen === po.dataset.plopen ? null : po.dataset.plopen; renderLib(); return; }
      const pr = e.target.closest('[data-plrm]'); if (pr) { const id = pr.dataset.plrm, k = pr.dataset.key; if (id === 'liked') toggleLike(k); else addToList(id, k); renderLib(); return; }
      const pd = e.target.closest('[data-pldel]'); if (pd) { const l = lists.find((x) => x.id === pd.dataset.pldel); if (l && confirm(`¿Eliminar la lista «${l.name}»?`)) { lists = lists.filter((x) => x !== l); saveLib(); renderLib(); toast('Lista eliminada'); } }
    });
    NP.panel?.addEventListener('submit', (e) => {
      if (e.target.id !== 'plNew') return;
      e.preventDefault(); const inp = $('#plName'); if (createList(inp.value)) renderLib();
    });

    /* ----- Barra inferior ----- */
    P.play.addEventListener('click', toggle);
    P.prev.addEventListener('click', () => { if (audio.currentTime > 3 || !queue.length) { audio.currentTime = 0; return; } step(-1, false); });
    P.next.addEventListener('click', () => { if (!queue.length) { play(); return; } step(1, false); });
    P.shuf?.addEventListener('click', () => { shuffle = !shuffle; local.set('mj-shuffle', shuffle); paintModes(); toast(shuffle ? 'Reproducción aleatoria activada' : 'Reproducción en orden'); });
    P.rep?.addEventListener('click', () => { repeat = { off: 'all', all: 'one', one: 'off' }[repeat]; local.set('mj-repeat', repeat); paintModes(); toast({ off: 'Repetición desactivada', all: 'Repetir lista', one: 'Repetir una pista' }[repeat]); });
    paintModes();

    audio.addEventListener('play', syncUI);
    audio.addEventListener('pause', syncUI);
    audio.addEventListener('ended', () => step(1, true));
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) { P.dur.textContent = fmt(audio.duration); if (NP.refs.dur) NP.refs.dur.textContent = fmt(audio.duration); }
      if (audio.dataset.resume) { audio.currentTime = Number(audio.dataset.resume); audio.dataset.resume = ''; }
    });
    audio.addEventListener('waiting', () => P.play.classList.add('is-loading'));
    ['playing', 'canplay'].forEach((ev) => audio.addEventListener(ev, () => P.play.classList.remove('is-loading')));
    audio.addEventListener('progress', () => {
      if (!audio.duration || !audio.buffered.length) return;
      P.seek.style.setProperty('--buf', `${(audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100}%`);
    });
    let lastSave = 0;
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      P.seek.value = pct; fill(P.seek); P.cur.textContent = fmt(audio.currentTime);
      if (NP.refs.seek && !NP.refs.seek.matches(':active')) { NP.refs.seek.value = pct; fill(NP.refs.seek); NP.refs.cur.textContent = fmt(audio.currentTime); }
      if (Date.now() - lastSave > 1000) { lastSave = Date.now(); savePlayer(); }
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
        try { navigator.mediaSession.setPositionState({ duration: audio.duration, position: audio.currentTime, playbackRate: 1 }); } catch { /* ignorar */ }
      }
    });
    audio.addEventListener('error', () => {
      if (audio.dataset.err) return;
      audio.dataset.err = '1';
      toast('No se pudo cargar esta canción. Pasando a la siguiente…');
      if (queue.length > 1 && cur < queue.length - 1) setTimeout(() => step(1, true), 900);
    });
    P.seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (P.seek.value / 100) * audio.duration; fill(P.seek); });

    audio.volume = Number(local.get('mj-vol', 0.8)); P.vol.value = audio.volume; fill(P.vol);
    P.vol.addEventListener('input', () => { audio.volume = Number(P.vol.value); audio.muted = audio.volume === 0; local.set('mj-vol', audio.volume); fill(P.vol); muteIcon(); if (NP.refs.vol) { NP.refs.vol.value = audio.volume; fill(NP.refs.vol); } });
    P.mute.addEventListener('click', () => { audio.muted = !audio.muted; muteIcon(); });
    muteIcon();

    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      [['play', () => play()], ['pause', () => audio.pause()], ['previoustrack', () => step(-1, false)], ['nexttrack', () => step(1, false)],
       ['seekto', (d) => { if (d.seekTime != null) audio.currentTime = d.seekTime; }]].forEach(([a, fn]) => { try { ms.setActionHandler(a, fn); } catch { /* no soportado */ } });
    }

    document.addEventListener('keydown', (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) || e.target.isContentEditable || e.target.getAttribute('role') === 'button';
      if (e.key === 'Escape' && !body.classList.contains('vo-open')) { if (!NP.menu.hidden) closeMenu(); else if (NP.open) closePanel(); }
      if (e.code === 'Space' && !typing && !body.classList.contains('modal-open') && !body.classList.contains('vo-open')) { e.preventDefault(); toggle(); }
    });
    addEventListener('scroll', closeMenu, { passive: true });

    /* ----- Persistencia entre subpáginas ----- */
    const savePlayer = () => { const t = now(); if (t) sess.set('mj-player', { key: t.key, t: audio.currentTime, playing: !audio.paused, keys: queue.map((q) => q.key), src: qsrc }); };
    addEventListener('pagehide', savePlayer);
    const saved = sess.get('mj-player', null);
    if (saved && byKey.has(saved.key)) {
      const items = (saved.keys || []).map((k) => byKey.get(k)).filter(Boolean);
      if (items.length) setQueueItems(items, saved.src || { type: 'album', id: byKey.get(saved.key).albumId, name: byKey.get(saved.key).album });
      else ensureAlbumQueue(byKey.get(saved.key).albumId);
      const idx = queue.findIndex((q) => q.key === saved.key);
      load(idx > -1 ? idx : 0, true);
      audio.dataset.resume = saved.t || 0;
      if (saved.playing) audio.play().catch(() => {});
      syncUI();
    }
  }
  function muteIcon() {
    if (!P.mute) return;
    const ic = audio.muted || audio.volume === 0 ? 'bi-volume-mute' : audio.volume < 0.5 ? 'bi-volume-down' : 'bi-volume-up';
    P.mute.innerHTML = `<i class="bi ${ic}" aria-hidden="true"></i>`;
    P.mute.setAttribute('aria-label', audio.muted ? 'Activar sonido' : 'Silenciar');
  }

  /* ----- Botón de efecto: ¡Hee-Hee! (etiqueta <audio> con assets/audio/hee-hee.mp3) ----- */
  const heeAudio = $('#heeheeAudio');
  const heeHee = (btn) => {
    if (!heeAudio) return;
    heeAudio.currentTime = 0; heeAudio.volume = 1;
    heeAudio.play().catch(() => {});
    if (audio && !audio.paused) { const v0 = audio.volume; audio.volume = v0 * 0.35; setTimeout(() => { audio.volume = v0; }, 1300); }   // la música baja un instante
    const r = (btn || document.body).getBoundingClientRect();
    sparkBurst(r.left + r.width / 2, r.top + r.height / 2, 22);
    if (btn && motion) G.fromTo(btn, { scale: 1.35, rotate: -12 }, { scale: 1, rotate: 0, duration: 0.8, ease: 'elastic.out(1,.35)' });
  };
  ['heeheeBtn', 'heeheeBtn2'].forEach((id) => $('#' + id)?.addEventListener('click', (e) => heeHee(e.currentTarget)));
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.isContentEditable) heeHee($('#heeheeBtn'));
  });


  /* ------------------------------------------------------------ 9b. VIDEOS INMERSIVOS (audio apagado por defecto) */
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const videoMuters = [];                                    // cada video registra cómo silenciarse
  const muteOtherVideos = (except) => videoMuters.forEach((m) => { if (m.v !== except && !m.v.muted) m.mute(); });
  const pauseMusic = () => { if (window.MJ && window.MJ.isPlaying()) audio.pause(); };
  const vids = [];
  $$('.vbg[data-video]').forEach((box) => {
    const v = $('video', box);
    if (!v) return;
    const st = { box, v, start: Number(box.dataset.start) || 0, end: Number(box.dataset.end) || 0, userPaused: false, visible: false };
    vids.push(st);
    videoMuters.push({ v, mute: () => paintVSound(st, false) });
    v.muted = true; v.defaultMuted = true; v.volume = 0.85;
    if (reduceMotion || saveData) { box.classList.add('is-static'); return; }        // solo el póster
    const ensure = () => { if (!v.getAttribute('src')) { v.src = v.dataset.src; v.load(); } };
    v.addEventListener('loadedmetadata', () => { if (st.start) { try { v.currentTime = st.start; } catch { /* aún no buscable */ } } });
    v.addEventListener('playing', () => box.classList.add('is-ready'));
    v.addEventListener('timeupdate', () => { const lim = st.end || v.duration; if (lim && v.currentTime >= lim - 0.12) v.currentTime = st.start; });   // bucle del tramo elegido
    v.addEventListener('ended', () => { v.currentTime = st.start; v.play().catch(() => {}); });
    st.update = () => {
      if (st.visible && !st.userPaused && !document.hidden) { ensure(); v.play().catch(() => {}); } else v.pause();
    };
    new IntersectionObserver(([e]) => { st.visible = e.isIntersecting; st.update(); }, { threshold: 0.15 }).observe(box);
  });
  document.addEventListener('visibilitychange', () => vids.forEach((s) => s.update && s.update()));

  const paintVSound = (st, on) => {
    st.v.muted = !on;
    $$('.vctrls').forEach((c) => {
      if (!(c.closest('section, .intro') || c).contains(st.box)) return;
      const b = $('.vsound', c); if (!b) return;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? 'Silenciar el audio del video' : 'Activar audio del video');
      b.innerHTML = `<i class="bi ${on ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}" aria-hidden="true"></i><span>Audio del video: ${on ? 'activado' : 'apagado'}</span>`;
    });
  };
  $$('.vctrls').forEach((c) => {
    const host = c.closest('section, .intro');
    const st = vids.find((s) => host && host.contains(s.box));
    if (!st || st.box.classList.contains('is-static')) { c.hidden = true; return; }
    const pb = $('.vpause', c), sb = $('.vsound', c);
    pb.addEventListener('click', () => {
      st.userPaused = !st.userPaused; st.update();
      pb.innerHTML = `<i class="bi ${st.userPaused ? 'bi-play-fill' : 'bi-pause-fill'}" aria-hidden="true"></i>`;
      pb.setAttribute('aria-label', st.userPaused ? 'Reanudar video de fondo' : 'Pausar video de fondo');
    });
    sb.addEventListener('click', () => {
      const on = st.v.muted;                                  // si estaba mudo, lo activamos
      if (on) {
        muteOtherVideos(st.v);                                  // un solo video con sonido
        pauseMusic();                                           // sin mezclar con la música del reproductor
        if (st.userPaused) pb.click();
        st.v.play().catch(() => {});
      }
      paintVSound(st, on);
    });
  });

  // Movimiento de los videos con el scroll (cámara lenta hacia dentro)
  if (motion && ST) {
    $$('.vbg-page, .vbg-hero').forEach((b) => G.to(b, { yPercent: 12, scale: 1.1, ease: 'none', scrollTrigger: { trigger: b.parentElement, start: 'top top', end: 'bottom top', scrub: true } }));
  }
  // Franja del moonwalk: la secuencia avanza al bajar
  $$('.moonwalk-strip').forEach((strip) => {
    const img = $('img', strip);
    if (!img || !motion || !ST) { strip.classList.add('is-static'); return; }
    G.fromTo(img, { x: 0 }, { x: () => -(img.offsetWidth - strip.clientWidth), ease: 'none', scrollTrigger: { trigger: strip, start: 'top bottom', end: 'bottom top', scrub: 0.6, invalidateOnRefresh: true } });
  });


  /* ------------------------------------------------------------ 9c. SALA DE CINE (videos como entretenimiento) */
  const fmtT = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
  const theaters = $$('[data-theater]');
  theaters.forEach((root) => {
    const v = $('.theater-screen video', root), screen = $('.theater-screen', root);
    const items = $$('.theater-list button', root);
    const els = {
      title: $('.theater-title', root), sub: $('.theater-sub', root), big: $('.theater-big', root), play: $('.tplay', root),
      seek: $('.tseek', root), time: $('.ttime', root), dur: $('.tdur', root), mute: $('.tmute', root), full: $('.tfull', root),
      back: $('.theater-back', root), glow: $('.theater-glow', root),
    };
    const st = { idx: 0, start: 0, end: 0, userPaused: false, visible: false, loaded: false, timer: null };
    const autoOK = !reduceMotion && !saveData;
    v.muted = true; v.defaultMuted = true; v.volume = 0.85;
    const bctx = els.back.getContext('2d'), gctx = els.glow.getContext('2d');

    // El fondo ambiental toma los colores del póster antes de dar play
    const paintPoster = (src) => {
      const im = new Image();
      im.onload = () => { try { bctx.drawImage(im, 0, 0, 32, 18); gctx.drawImage(im, 0, 0, 32, 18); } catch { /* sin acceso */ } };
      im.src = src;
    };
    const lim = () => st.end || v.duration || 0;
    const setClip = (i, autoplay = true) => {
      const b = items[i]; if (!b) return;
      st.idx = i; st.start = Number(b.dataset.start) || 0; st.end = Number(b.dataset.end) || 0; st.loaded = true;
      els.title.textContent = b.dataset.title; els.sub.textContent = b.dataset.sub;
      v.setAttribute('aria-label', `Video: ${b.dataset.title}`);
      items.forEach((x, k) => { x.classList.toggle('is-on', k === i); x.setAttribute('aria-current', String(k === i)); });
      v.poster = b.dataset.poster; paintPoster(b.dataset.poster); v.src = b.dataset.src; v.load();
      els.seek.value = 0; els.time.textContent = '0:00';
      if (autoplay) v.play().catch(() => {});
    };
    const next = () => { if (items.length > 1) setClip((st.idx + 1) % items.length); else { v.currentTime = st.start; v.play().catch(() => {}); } };

    v.addEventListener('loadedmetadata', () => { if (st.start) { try { v.currentTime = st.start; } catch { /* aún no buscable */ } } els.dur.textContent = fmtT(lim() - st.start); });
    v.addEventListener('timeupdate', () => {
      const L = lim(); if (!L) return;
      const span = Math.max(0.1, L - st.start);
      els.seek.value = Math.min(100, Math.max(0, ((v.currentTime - st.start) / span) * 100));
      els.seek.style.setProperty('--pct', `${els.seek.value}%`);
      els.time.textContent = fmtT(Math.max(0, v.currentTime - st.start));
      if (v.currentTime >= L - 0.12) next();
    });
    v.addEventListener('ended', next);
    const paintPlay = () => {
      const paused = v.paused;
      root.classList.toggle('is-paused', paused);
      els.play.innerHTML = `<i class="bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}" aria-hidden="true"></i>`;
      els.play.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
      els.big.setAttribute('aria-label', paused ? 'Reproducir video' : 'Pausar video');
    };
    v.addEventListener('play', paintPlay); v.addEventListener('pause', paintPlay);
    v.addEventListener('playing', () => root.classList.add('is-live'));

    // Ambilight: los colores del video se derraman alrededor del marco
    const paintGlow = () => {
      if (v.readyState < 2) return;
      try { bctx.drawImage(v, 0, 0, 32, 18); gctx.drawImage(v, 0, 0, 32, 18); } catch { /* sin acceso al frame */ }
    };
    const glowOn = () => { if (!st.timer && !reduceMotion) st.timer = setInterval(paintGlow, 130); };
    const glowOff = () => { clearInterval(st.timer); st.timer = null; };
    v.addEventListener('playing', glowOn); v.addEventListener('pause', glowOff);

    const toggle = () => {
      if (!st.loaded) { setClip(st.idx, true); st.userPaused = false; return; }
      if (v.paused) { st.userPaused = false; v.play().catch(() => {}); } else { st.userPaused = true; v.pause(); }
    };
    els.big.addEventListener('click', toggle);
    els.play.addEventListener('click', toggle);
    $('.theater-shade', root).addEventListener('click', toggle);

    els.seek.addEventListener('input', () => {
      const L = lim(); if (!L) return;
      v.currentTime = st.start + (els.seek.value / 100) * (L - st.start);
      els.seek.style.setProperty('--pct', `${els.seek.value}%`);
    });

    // Audio: apagado por defecto; al activarlo se silencia el resto
    const paintMute = () => {
      const on = !v.muted;
      els.mute.setAttribute('aria-pressed', String(on));
      els.mute.setAttribute('aria-label', on ? 'Silenciar el audio del video' : 'Activar el audio del video');
      els.mute.innerHTML = `<i class="bi ${on ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}" aria-hidden="true"></i>`;
      root.classList.toggle('has-sound', on);
    };
    els.mute.addEventListener('click', () => {
      const on = v.muted;
      if (on) { muteOtherVideos(v); pauseMusic(); if (!st.loaded) setClip(st.idx, true); v.play().catch(() => {}); }
      v.muted = !on; paintMute();
    });
    videoMuters.push({ v, mute: () => { v.muted = true; paintMute(); } });
    paintMute();

    els.full.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen(); return; }
      const f = screen.requestFullscreen || screen.webkitRequestFullscreen;
      if (f) f.call(screen); else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    });

    items.forEach((b, i) => b.addEventListener('click', () => { st.userPaused = false; setClip(i, true); }));
    $$('.theater-list img', root).forEach((im) => { im.decoding = 'async'; });

    // Primer clip listo (solo póster) y reproducción automática (silenciada) al entrar en pantalla
    const first = items[0];
    if (first) { els.title.textContent = first.dataset.title; els.sub.textContent = first.dataset.sub; v.poster = first.dataset.poster; paintPoster(first.dataset.poster); items[0].classList.add('is-on'); }
    paintPlay();
    new IntersectionObserver(([e]) => {
      st.visible = e.isIntersecting;
      if (e.isIntersecting) {
        if (autoOK && !st.userPaused) { if (!st.loaded) setClip(0, true); else v.play().catch(() => {}); }
      } else v.pause();
    }, { threshold: 0.35 }).observe(root);
    document.addEventListener('visibilitychange', () => { if (document.hidden) v.pause(); else if (st.visible && autoOK && !st.userPaused && st.loaded) v.play().catch(() => {}); });
  });
  audio?.addEventListener('play', () => videoMuters.forEach((m) => { if (!m.v.muted) m.mute(); }));


  /* ------------------------------------------------------------ 10. CARRITO + ÉXITO + TOAST */
  const toastEl = $('#toast');
  const toastI = toastEl && window.bootstrap ? bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2400 }) : null;
  const toast = (msg) => { if (!toastI) return; $('#toastMsg').textContent = msg; toastI.show(); };

  const KEY = 'mjstory-cart';
  let cart = local.get(KEY, []);
  const cartList = $('#cartList'), cartEmpty = $('#cartEmpty'), cartTotal = $('#cartTotal'), cartCount = $('#cartCount'), checkout = $('#checkoutBtn'), clearBtn = $('#clearCart');

  const renderCart = () => {
    const count = cart.reduce((s, i) => s + i.qty, 0), total = cart.reduce((s, i) => s + i.qty * i.price, 0);
    if (cartCount) { cartCount.textContent = count; cartCount.setAttribute('aria-label', `${count} artículos en el carrito`); }
    if (!cartList) return;
    cartTotal.textContent = money(total);
    cartEmpty.hidden = cart.length > 0; checkout.disabled = !cart.length; clearBtn.disabled = !cart.length;
    cartList.innerHTML = cart.map((i) => `
      <li data-key="${esc(i.key)}">
        <div><p class="cart-item-name">${esc(i.name)}</p><p class="cart-item-meta">Talla / edición: ${esc(i.size)} · ${money(i.price)} c/u</p></div>
        <div class="qty" role="group" aria-label="Cantidad de ${esc(i.name)}">
          <button type="button" data-a="dec" aria-label="Restar una unidad"><i class="bi bi-dash" aria-hidden="true"></i></button>
          <output aria-live="polite">${i.qty}</output>
          <button type="button" data-a="inc" aria-label="Sumar una unidad"><i class="bi bi-plus" aria-hidden="true"></i></button>
          <button type="button" class="cart-remove ms-2" data-a="rm" aria-label="Eliminar ${esc(i.name)}"><i class="bi bi-x" aria-hidden="true"></i></button>
        </div>
        <span class="cart-line-total">${money(i.qty * i.price)}</span>
      </li>`).join('');
  };
  const saveCart = () => { local.set(KEY, cart); renderCart(); };

  const successEl = $('#successModal');
  const showSuccess = (title, msg, withCart = true) => {
    if (!successEl) { toast(msg); return; }
    $('#successLabel').textContent = title; $('#successMsg').textContent = msg;
    $('#goCart').hidden = !withCart;
    bootstrap.Modal.getOrCreateInstance(successEl).show();
  };
  successEl?.addEventListener('shown.bs.modal', () => {
    SFX.success();
    if ($('#goCart').hidden) setTimeout(() => SFX.heehee(), 380);
    if (reduceMotion) return;
    const svg = $('#successCheck');
    svg.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)' });
    $$('circle, path', svg).forEach((el, i) => {
      const len = el.getTotalLength(); el.style.strokeDasharray = len;
      el.animate([{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 500, delay: i * 250, fill: 'backwards', easing: 'ease-out' });
    });
  });
  $('#goCart')?.addEventListener('click', () => {
    bootstrap.Modal.getOrCreateInstance(successEl).hide();
    successEl.addEventListener('hidden.bs.modal', () => bootstrap.Modal.getOrCreateInstance('#cartModal').show(), { once: true });
  });

  const addToCart = ({ id, name, price, size }) => {
    const key = `${id}__${size}`, ex = cart.find((i) => i.key === key);
    if (ex) ex.qty += 1; else cart.push({ key, id, name, price, size, qty: 1 });
    saveCart(); SFX.add();
    showSuccess('¡Añadido!', `${name} (${size}) se agregó a tu carrito.`);
    if (cartCount && G) G.fromTo(cartCount, { scale: 1.8 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1,.4)' });
  };
  window.MJ.addToCart = addToCart;

  cartList?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const key = b.closest('li').dataset.key, it = cart.find((i) => i.key === key); if (!it) return;
    if (b.dataset.a === 'inc') it.qty++;
    if (b.dataset.a === 'dec') it.qty--;
    if (b.dataset.a === 'rm' || it.qty <= 0) cart = cart.filter((i) => i.key !== key);
    saveCart();
  });
  clearBtn?.addEventListener('click', () => { cart = []; saveCart(); });
  checkout?.addEventListener('click', () => {
    if (!cart.length) return;
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0), id = 'MJ-' + Date.now().toString().slice(-6);
    cart = []; saveCart();
    bootstrap.Modal.getOrCreateInstance('#cartModal').hide();
    $('#cartModal').addEventListener('hidden.bs.modal', () => showSuccess('¡Pedido confirmado!', `Pedido ${id} por ${money(total)}. Gracias, coleccionista (simulación).`, false), { once: true });
  });
  renderCart();


  /* ------------------------------------------------------------ 11. TIENDA */
  const grid = $('#productGrid');
  if (grid) {
    const items = $$('.shop-item', grid);
    const state = { cat: 'all', q: '', sort: 'featured' };
    const empty = $('#shopEmpty'), count = $('#shopCount');

    const apply = () => {
      const q = state.q.trim().toLowerCase();
      let vis = items.filter((it) => (state.cat === 'all' || it.dataset.cat === state.cat) && (!q || it.dataset.name.toLowerCase().includes(q) || it.dataset.tags.toLowerCase().includes(q)));
      const by = { 'price-asc': (a, b) => a.dataset.price - b.dataset.price, 'price-desc': (a, b) => b.dataset.price - a.dataset.price, name: (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'es'), featured: (a, b) => a.dataset.order - b.dataset.order };
      vis.sort(by[state.sort]);
      items.forEach((it) => it.classList.toggle('d-none', !vis.includes(it)));
      vis.forEach((it) => grid.appendChild(it));
      vis.forEach((it, i) => { it.classList.remove('is-visible'); void it.offsetWidth; it.style.setProperty('--delay', `${i * 0.05}s`); it.classList.add('is-visible'); });
      empty.hidden = vis.length > 0;
      count.textContent = `${vis.length} ${vis.length === 1 ? 'pieza' : 'piezas'}`;
    };
    $$('.chip-btn[data-filter]').forEach((b) => b.addEventListener('click', () => {
      $$('.chip-btn[data-filter]').forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
      state.cat = b.dataset.filter; apply();
    }));
    $('#shopSearch').addEventListener('input', (e) => { state.q = e.target.value; apply(); });
    $('#shopSort').addEventListener('change', (e) => { state.sort = e.target.value; apply(); });

    // Agregar al carrito
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.product-card'); if (!card) return;
      if (e.target.closest('.btn-add')) {
        const sel = $('.btn-check:checked', card);
        addToCart({ id: card.dataset.id, name: card.dataset.name, price: Number(card.dataset.price), size: sel ? sel.value : 'Única' });
      }
      const w = e.target.closest('.wish');
      if (w) {
        const on = w.getAttribute('aria-pressed') !== 'true';
        w.setAttribute('aria-pressed', String(on));
        $('i', w).className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`;
        const list = local.get('mj-wish', []).filter((x) => x !== card.dataset.id); if (on) list.push(card.dataset.id);
        local.set('mj-wish', list); SFX.flip(); toast(on ? 'Guardado en favoritos' : 'Quitado de favoritos');
      }
      if (e.target.closest('.quick')) openQuick(card);
    });
    local.get('mj-wish', []).forEach((id) => {
      const w = $(`.product-card[data-id="${id}"] .wish`, grid);
      if (w) { w.setAttribute('aria-pressed', 'true'); $('i', w).className = 'bi bi-heart-fill'; }
    });

    // Vista rápida
    const qm = $('#quickModal');
    let quickCard = null;
    const openQuick = (card) => {
      quickCard = card;
      $('#quickImg').innerHTML = $('.product-stage', card).innerHTML.replace(/<button[\s\S]*?<\/button>|<span class="product-tag">[\s\S]*?<\/span>/g, '');
      $('#quickName').textContent = card.dataset.name;
      $('#quickPrice').textContent = money(Number(card.dataset.price));
      $('#quickLong').textContent = card.dataset.long;
      const sizes = card.dataset.sizes.split('|');
      $('#quickSize').innerHTML = sizes.map((s) => `<option>${esc(s)}</option>`).join('');
      bootstrap.Modal.getOrCreateInstance(qm).show();
    };
    $('#quickAdd')?.addEventListener('click', () => {
      if (!quickCard) return;
      addToCart({ id: quickCard.dataset.id, name: quickCard.dataset.name, price: Number(quickCard.dataset.price), size: $('#quickSize').value });
    });
    $('#quickAdd')?.addEventListener('click', () => bootstrap.Modal.getOrCreateInstance(qm).hide());
    apply();
  }


  /* ------------------------------------------------------------ 12. DISCOGRAFÍA (COVERFLOW) */
  const cf = $('#coverflow');
  if (cf && ALBUMS.length) {
    const cards = $$('.cf-item', cf);
    const detail = $('#albumDetail');
    let idx = Math.max(0, ALBUMS.findIndex((a) => '#' + a.id === location.hash));
    if (idx < 0) idx = 0;

    let first = true;
    const layout = () => {
      const w = cards[0].offsetWidth;
      cards.forEach((c, i) => {
        const d = i - idx, ab = Math.abs(d);
        const props = { x: d * w * 0.5 + Math.sign(d) * w * 0.28, z: -ab * 150, rotationY: d === 0 ? 0 : d > 0 ? -50 : 50, scale: d === 0 ? 1 : 0.84, opacity: ab > 3 ? 0 : 1 - ab * 0.2, zIndex: 100 - ab, y: 0, rotationX: 0 };
        if (motion) G.to(c, { ...props, duration: first ? 1.6 : 1, delay: first ? 1.1 + ab * 0.1 : 0, ease: 'expo.out', overwrite: true });
        else { c.style.transform = `translateX(${props.x}px) translateZ(${props.z}px) rotateY(${props.rotationY}deg) scale(${props.scale})`; c.style.opacity = props.opacity; c.style.zIndex = props.zIndex; }
        c.setAttribute('aria-current', String(d === 0));
        c.tabIndex = d === 0 ? 0 : -1;
      });
      first = false;
    };
    const render = () => {
      const a = ALBUMS[idx];
      const total = Math.round(a.tracks.reduce((sum, t) => sum + t.dur, 0) / 60);
      const rows = a.tracks.map((t, i) => (t.bonus && !(a.tracks[i - 1] && a.tracks[i - 1].bonus) ? '<li class="track-sep" aria-hidden="true">Versiones originales · edición deluxe</li>' : '')
        + `<li><button type="button" class="track" data-album="${a.id}" data-i="${i}" aria-pressed="false"><span>${esc(t.title)}</span>${t.single ? '<small>Sencillo</small>' : ''}<small class="dur">${fmt(t.dur)}</small><i class="bi bi-play-fill" aria-hidden="true"></i></button>${window.MJ_CLIPS && window.MJ_CLIPS[SLUG(t.title)] ? `<button type="button" class="track-more track-vid" data-clip="${SLUG(t.title)}" aria-label="Ver el videoclip de ${esc(t.title)}" title="Videoclip"><i class="bi bi-camera-video" aria-hidden="true"></i></button>` : ''}<button type="button" class="track-more" data-more="${a.id}:${i}" aria-haspopup="menu" aria-label="Más opciones de ${esc(t.title)}"><i class="bi bi-three-dots" aria-hidden="true"></i></button></li>`).join('');
      detail.dataset.album = a.id;
      detail.classList.toggle('has-wide', !!a.wide);
      detail.style.setProperty('--bgimg', `url('${new URL(a.wide || a.cover, location.href).href}')`);
      detail.style.setProperty('--album', a.color);
      detail.innerHTML = `
        <div class="row g-5 align-items-center">
          <div class="col-12 col-lg-5">
            <div class="detail-vinyl"><div class="vinyl" role="img" aria-label="Vinilo de ${esc(a.title)}"><span class="vinyl-label" style="background-image:url('${esc(a.cover)}')"></span></div></div>
          </div>
          <div class="col-12 col-lg-7">
            <p class="detail-meta">${esc(a.date)} · ${esc(a.label)}</p>
            <h2 class="detail-title gold-text">${esc(a.title)}</h2>
            <p>${esc(a.blurb)}</p>
            <div>${a.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
            <div class="facts">${a.facts.map((f) => `<div class="fact"><strong>${esc(f[0])}</strong><span>${esc(f[1])}</span></div>`).join('')}</div>
            <div class="detail-actions">
              <button type="button" class="btn-liquid" id="playAlbum" data-play-album="${a.id}" data-album="${a.id}"><span>Reproducir álbum</span><i class="bi bi-play-fill" aria-hidden="true"></i></button>
              <button type="button" class="btn-ghost" id="shuffleAlbum"><i class="bi bi-shuffle me-2" aria-hidden="true"></i>Aleatorio</button>
            </div>
          </div>
        </div>
        <div class="row g-5 mt-1">
          <div class="col-12 col-lg-7"><h3 class="h5 mb-3">Lista de canciones <small class="text-secondary">· ${a.tracks.length} pistas · ${total} min</small></h3>
            <ol class="tracklist${a.tracks.length > 12 ? ' long' : ''}">${rows}</ol>
          </div>
          <div class="col-12 col-lg-5"><h3 class="h5 mb-3">Sencillos destacados</h3>
            ${a.singles.map((s) => `<div class="single-card mb-3"><span class="yr">${esc(s[1])}</span><h3>${esc(s[0])}</h3><p>${esc(s[2])}</p></div>`).join('')}
          </div>
        </div>`;
      $('#shuffleAlbum').addEventListener('click', () => window.MJ.playAlbum(a.id, { shuffle: true, restart: true }));
      if (motion) G.from(detail.children, { y: 30, opacity: 0, duration: 0.9, stagger: 0.1, ease: 'expo.out' });
      history.replaceState(null, '', '#' + a.id);
      window.MJ.sync();
    };
    const go = (n, snd = true) => {
      const next = (n + cards.length) % cards.length;
      if (next === idx) return;
      idx = next; layout(); render(); if (snd) SFX.whoosh();
    };
    cards.forEach((c, i) => c.addEventListener('click', () => { if (i === idx) window.MJ.playAlbum(ALBUMS[i].id); else go(i); }));
    $('#cfPrev').addEventListener('click', () => go(idx - 1));
    $('#cfNext').addEventListener('click', () => go(idx + 1));
    cf.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(idx - 1); if (e.key === 'ArrowRight') go(idx + 1); });
    let sx = null;
    cf.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    addEventListener('pointerup', (e) => { if (sx === null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 60) go(idx + (dx < 0 ? 1 : -1)); });
    addEventListener('resize', layout);
    addEventListener('hashchange', () => { const i = ALBUMS.findIndex((a) => '#' + a.id === location.hash); if (i > -1) go(i, false); });
    if (motion) G.set(cards, { y: 160, opacity: 0, rotationX: 40 });
    layout(); render();
  }


  /* ------------------------------------------------------------ 13. FRASES + FORMULARIOS */
  const slider = $('.quote-slider');
  if (slider) {
    const slides = $$('.quote-slide', slider), dots = $('.dots', slider.parentElement);
    let q = 0, timer;
    dots.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Frase ${i + 1}"></button>`).join('');
    const bs = $$('button', dots);
    const show = (n) => {
      const prev = slides[q]; q = (n + slides.length) % slides.length;
      slides.forEach((s, i) => { s.classList.toggle('is-on', i === q); s.setAttribute('aria-hidden', String(i !== q)); });
      bs.forEach((b, i) => b.classList.toggle('is-on', i === q));
      if (motion) G.fromTo(slides[q], { opacity: 0, y: 24, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: 'expo.out' });
      if (motion && prev !== slides[q]) G.to(prev, { opacity: 0, duration: 0.4 });
    };
    const auto = () => { clearInterval(timer); timer = setInterval(() => show(q + 1), 6500); };
    bs.forEach((b, i) => b.addEventListener('click', () => { show(i); SFX.flip(); auto(); }));
    show(0); auto();
  }

  const validate = (form) => {
    let ok = true;
    $$('[data-v]', form).forEach((f) => {
      const rule = f.dataset.v, v = f.value.trim(); let msg = '';
      if (rule === 'name' && v.length < 2) msg = 'Escribe tu nombre (mín. 2 caracteres).';
      if (rule === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = 'Introduce un correo electrónico válido.';
      if (rule === 'select' && !v) msg = 'Elige una opción.';
      if (rule === 'msg' && v.length < 10) msg = 'Cuéntanos un poco más (mín. 10 caracteres).';
      const err = $('.err', f.parentElement);
      if (err) err.textContent = msg;
      f.classList.toggle('is-invalid', !!msg); f.setAttribute('aria-invalid', String(!!msg));
      if (msg && ok) { f.focus(); ok = false; }
    });
    return ok;
  };
  $('#contactForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validate(e.target)) return;
    e.target.reset();
    showSuccess('¡Mensaje enviado!', 'Gracias por escribir al Fan Club. Te responderemos pronto (simulación).', false);
  });
  $$('.newsletter-form').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = $('input', f), fb = $('.form-feedback', f.parentElement);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) { inp.setAttribute('aria-invalid', 'true'); fb.textContent = 'Introduce un correo electrónico válido.'; inp.focus(); return; }
    inp.removeAttribute('aria-invalid'); fb.textContent = '¡Bienvenido al Fan Club! Revisa tu bandeja (simulado).'; f.reset(); SFX.success();
  }));


  /* ------------------------------------------------------------ 14. NAVBAR + VOLVER ARRIBA + SONIDO DE SECCIÓN */
  const nav = $('#mainNav'), btt = $('#backToTop');
  const onScroll = () => {
    nav?.classList.toggle('is-scrolled', scrollY > 40);
    btt?.classList.toggle('is-visible', scrollY > innerHeight * 0.8);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  btt?.addEventListener('click', () => { scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); SFX.whoosh(); });
  $('#year') && ($('#year').textContent = new Date().getFullYear());
  $$('[data-remind]').forEach((b) => b.addEventListener('click', () => { b.textContent = 'Anotado ✓'; b.disabled = true; SFX.add(); toast('Recordatorio guardado (simulado)'); }));
  $$('.social a').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); toast('Red social simulada para el proyecto.'); }));
  $$('a[href="#"]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault()));

  // Destello sonoro muy suave al entrar a cada sección importante
  let lastShimmer = 0;
  const secIO = new IntersectionObserver((entries, obs) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      obs.unobserve(en.target);
      if (Date.now() - lastShimmer > 1500) { lastShimmer = Date.now(); SFX.shimmer(); }
    });
  }, { threshold: 0.6 });
  $$('.section-head, .band, .stat, .timeline-item').forEach((el) => secIO.observe(el));

  /* ------------------------------------------------------------ 15. PULIDO DE INTERFAZ */
  // Titulares de sección: cada palabra sube desde una máscara al entrar en pantalla
  if (motion && ST) {
    const wrapWords = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const m = document.createElement('span'); m.className = 'wm';
            const w = document.createElement('span'); w.className = 'wi'; w.textContent = part;
            m.appendChild(w); frag.appendChild(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) wrapWords(n);
      });
    };
    $$('.section-title').forEach((t) => {
      t.setAttribute('aria-label', t.textContent.trim());
      wrapWords(t);
      const words = $$('.wi', t); words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
      G.set(words, { yPercent: 115, rotate: 5 });
      ST.create({ trigger: t, start: 'top 88%', once: true, onEnter: () => G.to(words, { yPercent: 0, rotate: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out' }) });
    });
  }

  // Botones magnéticos: se acercan al cursor (propiedad "translate", sin chocar con el hover CSS)
  if (finePointer && motion) {
    $$('.btn-liquid, .btn-ghost, .icon-btn, .vbtn, .tbtn, .album-play').forEach((el) => {
      let tx = 0, ty = 0, cx = 0, cy = 0, run = false;
      const loop = () => {
        cx += (tx - cx) * 0.18; cy += (ty - cy) * 0.18;
        el.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`;
        if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) requestAnimationFrame(loop); else run = false;
      };
      const kick = () => { if (!run) { run = true; requestAnimationFrame(loop); } };
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.28; ty = (e.clientY - (r.top + r.height / 2)) * 0.38; kick();
      });
      el.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
    });
  }

  // Brillo dorado que sigue al cursor dentro de las tarjetas
  const GLARE = '.product-card, .single-card, .pillar, .record, .contact-card, .perk, .era-card, .album-detail, .theater-list button';
  let glareRaf = null;
  document.addEventListener('pointermove', (e) => {
    if (glareRaf || e.pointerType === 'touch') return;
    glareRaf = requestAnimationFrame(() => {
      glareRaf = null;
      const el = e.target.closest && e.target.closest(GLARE);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', `${e.clientX - r.left}px`); el.style.setProperty('--gy', `${e.clientY - r.top}px`);
    });
  });
  $$(GLARE).forEach((el) => el.classList.add('glare'));
})();
