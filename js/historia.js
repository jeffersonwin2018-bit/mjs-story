/* Historia · render de las 8 eras, galería 3D, línea de tiempo y navegación */
(() => {
  'use strict';
  const ERAS = window.MJ_ERAS || [];
  const root = document.getElementById('eraRoot'), nav = document.getElementById('eraNav');
  if (!root || !ERAS.length) return;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const G = window.gsap, ST = window.ScrollTrigger;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !!G && !reduce;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const img = (e, n) => `assets/img/eras/${e.id}/${n}.jpg`;
  const abs = (u) => new URL(u, location.href).href;   // las variables CSS con url() se resuelven respecto a la hoja de estilos

  /* ---------- Navegación fija por eras ---------- */
  nav.innerHTML = `<div class="en-track">${ERAS.map((e) => `<a href="#era-${e.id}" class="en-chip" data-nav="${e.id}" style="--ec:${e.color}"><b>${e.n}</b><span>${esc(e.name)}</span><small>${esc(e.years.split(' ')[0])}</small></a>`).join('')}</div><i class="en-bar" aria-hidden="true"></i>`;

  /* ---------- Capítulos ---------- */
  const findTrack = (title) => (window.MJ ? window.MJ.tracks.find((t) => t.title === title) : null);
  const chapter = (e, idx) => {
    const songs = (e.songs || []).map((title) => {
      const t = findTrack(title); if (!t) return '';
      const clip = window.MJ.clipOf(t);
      return `<span class="ec-song"><button type="button" class="ec-play track" data-album="${t.albumId}" data-i="${t.i}" aria-label="Reproducir ${esc(t.title)}"><i class="bi bi-play-fill" aria-hidden="true"></i><span>${esc(t.title)}</span></button>${clip ? `<button type="button" class="ec-vid" data-clip="${window.MJ.slugOf(t)}" aria-label="Ver el videoclip de ${esc(t.title)}"><i class="bi bi-camera-video" aria-hidden="true"></i></button>` : ''}</span>`;
    }).join('');
    const album = e.album ? window.MJ.album(e.album) : null;
    return `<article class="era" id="era-${e.id}" data-era="${e.id}" style="--ec:${e.color}">
      <div class="era-bg" aria-hidden="true" style="background-image:url('${img(e, String(e.hero).padStart(2, '0'))}')"></div>
      <div class="era-shade" aria-hidden="true"></div>
      <div class="container era-in">
        <header class="era-head">
          <span class="era-num" aria-hidden="true">${e.n}</span>
          <div>
            <p class="eyebrow ev">${esc(e.kicker)} · ${esc(e.years)}</p>
            <h2 class="era-title ev">${esc(e.name)}</h2>
            <p class="era-lead ev">${esc(e.lead)}</p>
          </div>
        </header>
        <div class="era-grid">
          <div class="era-gallery ev" data-gallery="${idx}" aria-roledescription="galería" aria-label="Fotografías de la etapa ${esc(e.name)}">
            <div class="deck" tabindex="0">${e.pics.map((p, i) => `<figure class="ep" data-i="${i}" style="--bgi:url('${abs(img(e, p[0]))}');--pos:${p[2]}"><img src="${img(e, p[0])}" alt="${esc(p[1])}" loading="lazy" decoding="async"><figcaption>${esc(p[1])}</figcaption></figure>`).join('')}</div>
            <div class="deck-ui"><button type="button" class="dk-b" data-dk="-1" aria-label="Foto anterior"><i class="bi bi-arrow-left" aria-hidden="true"></i></button>
              <p class="dk-cap" aria-live="polite"></p>
              <span class="dk-count"></span>
              <button type="button" class="dk-b" data-dk="1" aria-label="Foto siguiente"><i class="bi bi-arrow-right" aria-hidden="true"></i></button>
              <button type="button" class="dk-b dk-zoom" data-dk="zoom" aria-label="Ampliar la foto"><i class="bi bi-arrows-fullscreen" aria-hidden="true"></i></button></div>
          </div>
          <div class="era-text">
            ${e.paras.map((p) => `<p class="ev">${esc(p)}</p>`).join('')}
            <ul class="era-stats ev" aria-label="Datos clave">${e.stats.map((s) => `<li><strong>${esc(s[0])}</strong><span>${esc(s[1])}</span></li>`).join('')}</ul>
            ${songs ? `<div class="ev"><p class="era-sub"><i class="bi bi-music-note-beamed" aria-hidden="true"></i> Suena en esta etapa</p><div class="ec-songs">${songs}</div></div>` : ''}
            <div class="era-cta ev">${album ? `<button type="button" class="btn-liquid btn-liquid-sm" data-play-album="${album.id}"><span>Escuchar ${esc(album.title)}</span><i class="bi bi-play-fill" aria-hidden="true"></i></button><a class="btn-ghost-sm" href="discografia.html#${album.id}">Ver álbum</a>` : '<span class="era-note"><i class="bi bi-info-circle" aria-hidden="true"></i> Esta etapa es anterior a los discos del archivo; la música comienza en Off the Wall.</span>'}</div>
          </div>
        </div>
        <div class="era-tl ev">
          <p class="era-sub"><i class="bi bi-clock-history" aria-hidden="true"></i> Cronología</p>
          <ol>${e.timeline.map((t) => `<li><time>${esc(t[0])}</time><p>${esc(t[1])}</p></li>`).join('')}</ol>
        </div>
      </div>
    </article>`;
  };
  const build = () => { root.innerHTML = ERAS.map(chapter).join(''); init(); };

  /* ---------- Galería en abanico 3D ---------- */
  const decks = [];
  const initDeck = (box, e) => {
    const deck = $('.deck', box), figs = $$('.ep', deck), n = figs.length, cap = $('.dk-cap', box), cnt = $('.dk-count', box);
    let a = 0, timer = 0;
    const paint = () => {
      figs.forEach((f, i) => {
        const d = (i - a + n) % n;
        f.style.setProperty('--d', Math.min(d, 4));
        f.dataset.d = String(d > 3 ? 'x' : d);
        f.setAttribute('aria-hidden', String(d !== 0));
        f.classList.toggle('is-front', d === 0);
      });
      cap.textContent = figs[a].querySelector('figcaption').textContent;
      cnt.textContent = `${String(a + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    };
    const go = (to) => { a = (to + n) % n; paint(); };
    box.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-dk]');
      if (b) { b.dataset.dk === 'zoom' ? openBox(e, a) : go(a + Number(b.dataset.dk)); return; }
      const f = ev.target.closest('.ep');
      if (f) { f.classList.contains('is-front') ? openBox(e, a) : go(Number(f.dataset.i)); }
    });
    deck.addEventListener('keydown', (ev) => { if (ev.key === 'ArrowRight') { ev.preventDefault(); go(a + 1); } if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(a - 1); } if (ev.key === 'Enter') openBox(e, a); });
    // Deslizar con el dedo
    let sx = null;
    deck.addEventListener('pointerdown', (ev) => { sx = ev.clientX; });
    addEventListener('pointerup', (ev) => { if (sx === null) return; const dx = ev.clientX - sx; sx = null; if (Math.abs(dx) > 50 && deck.matches(':hover, :focus-within, :active')) go(a + (dx < 0 ? 1 : -1)); });
    // Inclinación 3D con el cursor
    if (motion && fine) {
      const rx = G.quickTo(deck, 'rotationX', { duration: 0.8, ease: 'power3.out' }), ry = G.quickTo(deck, 'rotationY', { duration: 0.8, ease: 'power3.out' });
      box.addEventListener('pointermove', (ev) => { const r = box.getBoundingClientRect(); ry(((ev.clientX - r.left) / r.width - 0.5) * 16); rx(-((ev.clientY - r.top) / r.height - 0.5) * 12); });
      box.addEventListener('pointerleave', () => { rx(0); ry(0); });
    }
    // Pase automático suave mientras está a la vista y sin interacción
    const auto = () => { clearInterval(timer); if (!motion) return; timer = setInterval(() => { if (box._vis && !box.matches(':hover, :focus-within')) go(a + 1); }, 5200); };
    new IntersectionObserver(([en]) => { box._vis = en.isIntersecting; }).observe(box);
    auto(); paint();
    decks.push({ go, get a() { return a; } });
  };

  /* ---------- Visor ampliado ---------- */
  let lb = null;
  const openBox = (e, start) => {
    if (!lb) {
      lb = document.createElement('div'); lb.className = 'lbx'; lb.hidden = true; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Fotografía ampliada');
      lb.innerHTML = '<button type="button" class="lbx-x" data-l="x" aria-label="Cerrar"><i class="bi bi-x-lg" aria-hidden="true"></i></button><button type="button" class="lbx-n lbx-p" data-l="-1" aria-label="Anterior"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><figure><img alt=""><figcaption></figcaption></figure><button type="button" class="lbx-n lbx-nx" data-l="1" aria-label="Siguiente"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>';
      document.body.appendChild(lb);
      lb.addEventListener('click', (ev) => { const b = ev.target.closest('[data-l]'); if (b) { b.dataset.l === 'x' ? closeBox() : step(Number(b.dataset.l)); } else if (!ev.target.closest('figure')) closeBox(); });
      document.addEventListener('keydown', (ev) => { if (lb.hidden) return; if (ev.key === 'Escape') closeBox(); if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1); });
    }
    lb._e = e; lb._i = start; lb._from = document.activeElement; paintBox(); lb.hidden = false; document.body.style.overflow = 'hidden'; $('[data-l="x"]', lb).focus({ preventScroll: true });
    if (motion) G.fromTo(lb, { opacity: 0 }, { opacity: 1, duration: 0.35 });
  };
  const paintBox = () => { const p = lb._e.pics[lb._i]; const im = $('img', lb); im.src = img(lb._e, p[0]); im.alt = p[1]; $('figcaption', lb).textContent = `${p[1]}  ·  ${lb._i + 1}/${lb._e.pics.length}`; if (motion) G.fromTo(im, { scale: 0.94, opacity: 0.2 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' }); };
  const step = (d) => { const n = lb._e.pics.length; lb._i = (lb._i + d + n) % n; paintBox(); };
  const closeBox = () => { lb.hidden = true; document.body.style.overflow = ''; lb._from?.focus?.({ preventScroll: true }); };

  /* ---------- Inicio ---------- */
  function init() {
    $$('[data-gallery]').forEach((b, i) => initDeck(b, ERAS[i]));
    const chapters = $$('.era'), chips = $$('.en-chip'), bar = $('.en-bar', nav);
    const setActive = (id) => {
      chips.forEach((c) => { const on = c.dataset.nav === id; c.classList.toggle('is-on', on); if (on) { c.setAttribute('aria-current', 'true'); const tr = c.parentElement; tr.scrollTo({ left: c.offsetLeft - tr.clientWidth / 2 + c.clientWidth / 2, behavior: motion ? 'smooth' : 'auto' }); } else c.removeAttribute('aria-current'); });
    };
    const act = new IntersectionObserver((en) => { en.forEach((x) => { if (x.isIntersecting) setActive(x.target.dataset.era); }); }, { rootMargin: '-45% 0px -50% 0px' });
    chapters.forEach((c) => act.observe(c));
    const prog = () => { const r = root.getBoundingClientRect(), p = Math.max(0, Math.min(1, (innerHeight * 0.4 - r.top) / (r.height - innerHeight * 0.2))); bar.style.transform = `scaleX(${p})`; };
    addEventListener('scroll', prog, { passive: true }); prog();
    chips.forEach((c) => c.addEventListener('click', (ev) => { ev.preventDefault(); const t = $(c.getAttribute('href')); if (t) { t.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' }); history.replaceState(null, '', c.getAttribute('href')); } }));

    // Aparición escalonada + parallax del fondo
    const ev = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('is-in'); ev.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.ev', root).forEach((el, k) => { el.style.setProperty('--k', String(k % 4)); ev.observe(el); });
    if (motion && ST) {
      chapters.forEach((c) => {
        G.fromTo($('.era-bg', c), { yPercent: -8, scale: 1.12 }, { yPercent: 8, scale: 1.02, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
        G.fromTo($('.era-num', c), { yPercent: 30, opacity: 0.4 }, { yPercent: -30, opacity: 1, ease: 'none', scrollTrigger: { trigger: c, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }
    // Línea de tiempo: dibuja la guía al entrar
    $$('.era-tl', root).forEach((tl) => { const lis = $$('li', tl); const o = new IntersectionObserver(([x]) => { if (x.isIntersecting) { tl.classList.add('is-drawn'); lis.forEach((li, k) => li.style.setProperty('--k', String(k))); o.disconnect(); } }, { threshold: 0.2 }); o.observe(tl); });
    const h = location.hash; if (h && $(h)) setTimeout(() => $(h).scrollIntoView({ block: 'start' }), 350);
    if (window.MJ) window.MJ.sync();
  }

  // MJ (reproductor) se crea en main.js, que se carga antes que este archivo.
  if (window.MJ) build(); else addEventListener('DOMContentLoaded', build);
})();
