/* MJ Music · plataforma de escucha dedicada a Michael Jackson (rutas por hash, biblioteca, búsqueda, videoclips) */
(() => {
  'use strict';
  const MJ = window.MJ;
  const view = document.getElementById('mpView'), side = document.getElementById('mpSide'), nowEl = document.getElementById('mpNow');
  if (!MJ || !view) return;

  /* ------------------------------------------------------------ utilidades */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const hm = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’`´.]/g, '');
  const G = window.gsap, motion = !!G && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } } };
  const ALB = MJ.albums, TR = MJ.tracks, CLIPS = MJ.clips, MAIN_ALBUMS = ALB;
  const T = (title) => TR.find((t) => t.title === title);
  const keysOf = (titles) => titles.map(T).filter(Boolean).map((t) => t.key);
  const sum = (keys) => keys.reduce((n, k) => n + MJ.byKey.get(k).dur, 0);
  const albumDur = (a) => a.tracks.reduce((n, t) => n + t.dur, 0);
  const clipsOf = (aid) => MJ.clipList().filter((s) => CLIPS[s].a === aid);

  /* ------------------------------------------------------------ mixes editoriales */
  const MIXES = [
    { id: 'numero-1', name: 'Número 1 en Billboard', desc: 'Los temas que llegaron a lo más alto del Hot 100.', color: '#d4af37', icon: 'bi-trophy-fill',
      titles: ['Don\'t Stop \'Til You Get Enough', 'Rock with You', 'Billie Jean', 'Beat It', 'I Just Can\'t Stop Loving You', 'Bad', 'The Way You Make Me Feel', 'Man in the Mirror', 'Dirty Diana', 'Black or White', 'You Are Not Alone'] },
    { id: 'baile', name: 'Para bailar', desc: 'Funk, disco y new jack swing para mover el cuerpo.', color: '#e5483c', icon: 'bi-lightning-charge-fill',
      titles: ['Don\'t Stop \'Til You Get Enough', 'Get on the Floor', 'Working Day and Night', 'Burn This Disco Out', 'Wanna Be Startin\' Somethin\'', 'P.Y.T. (Pretty Young Thing)', 'Billie Jean', 'Thriller', 'The Way You Make Me Feel', 'Smooth Criminal', 'Jam', 'In the Closet', 'Remember the Time', 'You Rock My World', 'Slave to the Rhythm', 'Love Never Felt So Good'] },
    { id: 'baladas', name: 'Baladas', desc: 'La voz más íntima de Michael.', color: '#4b7bec', icon: 'bi-moon-stars-fill',
      titles: ['She\'s Out of My Life', 'Human Nature', 'I Just Can\'t Stop Loving You', 'Liberian Girl', 'Who Is It', 'Will You Be There', 'Gone Too Soon', 'You Are Not Alone', 'Stranger in Moscow', 'Childhood (Theme from Free Willy 2)', 'Butterflies', 'Speechless', 'You Are My Life', 'Smile'] },
    { id: 'mensaje', name: 'Mensaje y conciencia', desc: 'Canciones para cambiar el mundo.', color: '#2fa36b', icon: 'bi-globe-americas',
      titles: ['Man in the Mirror', 'Heal the World', 'Black or White', 'Earth Song', 'They Don\'t Care About Us', 'Keep the Faith', 'Why You Wanna Trip on Me', 'The Lost Children', 'Cry', 'Childhood (Theme from Free Willy 2)'] },
    { id: 'rock', name: 'Rock y tensión', desc: 'Guitarras, portazos y mucha actitud.', color: '#9b59b6', icon: 'bi-music-note-beamed',
      titles: ['Beat It', 'Dirty Diana', 'Give In to Me', 'Speed Demon', 'Leave Me Alone', 'D.S.', '2 Bad', 'Scream', 'Privacy', 'Threatened'] },
    { id: 'duetos', name: 'Duetos e invitados', desc: 'Michael junto a otros grandes nombres.', color: '#ff9a3c', icon: 'bi-people-fill',
      titles: ['The Girl Is Mine', 'It\'s the Falling in Love', 'Just Good Friends', 'I Just Can\'t Stop Loving You', 'Jam', 'Black or White', 'Give In to Me', 'Scream', 'This Time Around', 'Whatever Happens', 'Love Never Felt So Good'] },
    { id: 'demos', name: 'Rarezas y demos', desc: 'Las versiones originales de Xscape.', color: '#8e8e93', icon: 'bi-vinyl-fill',
      keys: () => TR.filter((t) => t.bonus).map((t) => t.key) },
  ].map((m) => ({ ...m, keys: m.keys ? m.keys() : keysOf(m.titles) }));
  const mixById = (id) => MIXES.find((m) => m.id === id);
  const POPULAR = keysOf(['Billie Jean', 'Beat It', 'Smooth Criminal', 'Thriller', 'Man in the Mirror', 'Don\'t Stop \'Til You Get Enough', 'Black or White', 'Bad', 'The Way You Make Me Feel', 'Rock with You', 'They Don\'t Care About Us', 'Earth Song', 'You Are Not Alone', 'Remember the Time', 'Heal the World', 'Human Nature', 'Dirty Diana', 'You Rock My World', 'Love Never Felt So Good', 'Scream']);

  /* ------------------------------------------------------------ piezas de interfaz */
  const coverCollage = (keys, cls = '') => {
    const imgs = [...new Set(keys.map((k) => MJ.byKey.get(k).cover))].slice(0, 4);
    if (imgs.length < 4) return `<span class="pc-cover ${cls}"><img src="${esc(imgs[0] || ALB[0].cover)}" alt="" loading="lazy"></span>`;
    return `<span class="pc-cover pc-grid ${cls}">${imgs.map((s) => `<img src="${esc(s)}" alt="" loading="lazy">`).join('')}</span>`;
  };
  const mixCover = (m, cls = '') => `<span class="pc-cover pc-mix ${cls}" style="--mc:${m.color}"><span class="pc-mix-bg">${coverCollage(m.keys)}</span><i class="bi ${m.icon}" aria-hidden="true"></i></span>`;
  const likedCover = (cls = '') => `<span class="pc-cover pc-liked ${cls}"><i class="bi bi-heart-fill" aria-hidden="true"></i></span>`;
  const listCover = (l, cls = '') => (l.keys.length ? coverCollage(l.keys, cls) : `<span class="pc-cover pc-empty ${cls}"><i class="bi bi-music-note-list" aria-hidden="true"></i></span>`);
  const playBtn = (ctx, label) => `<button type="button" class="pc-play" data-play-ctx="${esc(ctx)}" aria-label="Reproducir ${esc(label)}"><i class="bi bi-play-fill" aria-hidden="true"></i></button>`;

  const albumCard = (a) => `<article class="pcard" style="--ac:${a.color}"><a class="pc-link" href="#/album/${a.id}"><span class="pc-cover"><img src="${esc(a.cover)}" alt="Portada de ${esc(a.title)}" loading="lazy"></span><b>${esc(a.title)}</b><small>${a.year} · Álbum</small></a>${playBtn('album:' + a.id, a.title)}</article>`;
  const mixCard = (m) => `<article class="pcard" style="--ac:${m.color}"><a class="pc-link" href="#/mix/${m.id}">${mixCover(m)}<b>${esc(m.name)}</b><small>${esc(m.desc)}</small></a>${playBtn('mix:' + m.id, m.name)}</article>`;
  const trackCard = (t) => `<article class="pcard" style="--ac:${t.color}"><a class="pc-link" href="#/album/${t.albumId}"><span class="pc-cover"><img src="${esc(t.cover)}" alt="" loading="lazy"></span><b>${esc(t.title)}</b><small>${esc(t.album)}</small></a><button type="button" class="pc-play" data-play-key="${esc(t.key)}" aria-label="Reproducir ${esc(t.title)}"><i class="bi bi-play-fill" aria-hidden="true"></i></button></article>`;
  const videoCard = (slug, list) => { const c = CLIPS[slug]; return `<button type="button" class="vcard" data-vclip="${slug}"${list ? ` data-vlist="${list}"` : ''}><span class="vc-thumb"><img src="assets/video/clips/${slug}.jpg" alt="" loading="lazy" width="320" height="180"><i class="bi bi-play-fill" aria-hidden="true"></i><em>${fmt(c.d)}</em></span><b>${esc(c.t)}</b><small>${esc(MJ.album(c.a).title)} · ${c.live ? 'En vivo' : c.y}</small></button>`; };
  const shelf = (title, sub, items, more) => `<section class="mp-shelf"><header><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${more ? `<a href="${more[0]}" class="mp-more">${more[1]}</a>` : ''}</header><div class="shelf-wrap"><button type="button" class="sh-arrow sh-l" data-shelf="-1" aria-label="Desplazar a la izquierda"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><div class="shelf" tabindex="-1">${items.join('')}</div><button type="button" class="sh-arrow sh-r" data-shelf="1" aria-label="Desplazar a la derecha"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div></section>`;

  /* Fila de canción */
  const row = (t, i, o = {}) => {
    const k = t.key, c = MJ.clipOf(t), liked = MJ.isLiked(k);
    const cover = o.cover ? `<img src="${esc(t.cover)}" alt="" width="40" height="40" loading="lazy">` : '';
    return `<div class="mp-rowwrap" data-key="${esc(k)}"><div class="mp-row${o.cover ? ' has-cover' : ''}" role="row" data-ctx-i="${i}">
      <span class="r-n"><b>${o.num === false ? '' : i + 1}</b><button type="button" class="r-play" data-row-play="${i}" aria-label="Reproducir ${esc(t.title)}"><i class="bi bi-play-fill" aria-hidden="true"></i></button><span class="r-eq" aria-hidden="true"><i></i><i></i><i></i></span></span>
      <span class="r-title">${cover}<span><b class="r-name">${esc(t.title)}</b><small>Michael Jackson${t.single ? ' · Sencillo' : ''}${t.bonus ? ' · Original' : ''}</small></span></span>
      <span class="r-album">${o.albumLink === false ? '' : `<a href="#/album/${t.albumId}">${esc(t.album)}</a>`}</span>
      <span class="r-tools">${c ? `<button type="button" class="r-ico" data-vclip="${MJ.slugOf(t)}" aria-label="Ver el videoclip de ${esc(t.title)}" title="Videoclip"><i class="bi bi-camera-video" aria-hidden="true"></i></button>` : ''}<button type="button" class="r-ico r-like${liked ? ' is-on' : ''}" data-plike="${esc(k)}" aria-pressed="${liked}" aria-label="${liked ? 'Quitar de Me gusta' : 'Me gusta'}"><i class="bi ${liked ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i></button></span>
      <span class="r-dur">${fmt(t.dur)}</span>
      <span class="r-more"><button type="button" class="r-ico" data-story="${esc(k)}" aria-expanded="false" aria-label="Leer la historia de ${esc(t.title)}" title="Historia de la canción"><i class="bi bi-journal-richtext" aria-hidden="true"></i></button>${o.remove ? `<button type="button" class="r-ico" data-rm="${esc(k)}" aria-label="Quitar de la lista"><i class="bi bi-x-lg" aria-hidden="true"></i></button>` : ''}<button type="button" class="r-ico" data-more="${esc(k)}" aria-haspopup="menu" aria-label="Más opciones"><i class="bi bi-three-dots" aria-hidden="true"></i></button></span>
    </div><div class="row-story" hidden></div></div>`;
  };
  const table = (tracks, o = {}) => `<div class="mp-table" role="table" aria-label="Lista de canciones"><div class="mp-th" role="row"><span>#</span><span>Título</span><span class="r-album">Álbum</span><span></span><span class="r-dur"><i class="bi bi-clock" aria-hidden="true"></i></span><span></span></div>${tracks.map((t, i) => row(t, i, o)).join('')}</div>`;

  /* ------------------------------------------------------------ contexto de reproducción */
  let ctxKeys = [], ctxId = '', ctxName = '';        // lista visible actualmente (para reproducir desde una fila)
  const srcOf = () => MJ.queueState().src || {};
  const ctxIsCurrent = (ctx) => {
    const s = srcOf(), [type, id] = ctx.split(':');
    if (type === 'album') return s.type === 'album' && s.id === id;
    if (type === 'liked') return s.id === 'liked';
    if (type === 'list') return s.id === id;
    return s.id === ctx;
  };
  const playCtx = (ctx, shuffle) => {
    if (ctxIsCurrent(ctx) && shuffle === undefined) { MJ.toggle(); return; }
    const [type, id] = ctx.split(':');
    if (type === 'album') { MJ.playAlbum(id, { shuffle: shuffle === undefined ? undefined : shuffle, restart: true }); return; }
    if (type === 'liked') { if (!MJ.liked().length) { toast('Aún no tienes canciones en Me gusta'); return; } MJ.playList('liked'); return; }
    if (type === 'list') { MJ.playList(id); return; }
    if (type === 'mix') { const m = mixById(id); MJ.playTracks(m.keys, m.name, null, shuffle, ctx); return; }
    if (type === 'artist') { MJ.playTracks(POPULAR, 'Michael Jackson · Populares', null, shuffle, 'artist'); }
  };
  const toast = (m) => { const t = document.getElementById('toast'); if (t) { t.textContent = m; t.classList.add('is-show'); setTimeout(() => t.classList.remove('is-show'), 2200); } };

  /* ------------------------------------------------------------ vistas */
  const bar = (right = '') => `<div class="mp-bar"><div class="mp-nav"><button type="button" class="mb-ic" data-nav="-1" aria-label="Atrás"><i class="bi bi-chevron-left" aria-hidden="true"></i></button><button type="button" class="mb-ic" data-nav="1" aria-label="Adelante"><i class="bi bi-chevron-right" aria-hidden="true"></i></button></div>
    <form class="mp-search" role="search" data-search><i class="bi bi-search" aria-hidden="true"></i><input type="search" id="mpQ" placeholder="¿Qué quieres escuchar de Michael?" autocomplete="off" aria-label="Buscar canciones, álbumes y videoclips" value="${esc(R.q || '')}"><kbd aria-hidden="true">/</kbd></form>
    <div class="mp-bar-r">${right}<button type="button" class="mb-ic mb-now" data-now-toggle aria-label="Mostrar u ocultar el panel Ahora suena" title="Panel Ahora suena"><i class="bi bi-layout-sidebar-inset-reverse" aria-hidden="true"></i></button><a class="mb-av" href="#/artist" aria-label="Ir a Michael Jackson"><img src="assets/img/mj-logo-gold.png" alt=""></a></div></div>`;
  const hero = (color, inner, cls = '') => `<header class="mp-hero ${cls}" style="--hc:${color}">${inner}</header>`;

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; };
  const vHome = () => {
    const recent = MJ.recent().map((k) => MJ.byKey.get(k));
    const recentAlbums = [...new Set(recent.map((t) => t.albumId))].map(MJ.album);
    const quick = [{ ctx: 'liked', href: '#/liked', name: 'Canciones que me gustan', cover: likedCover('q-cover') }];
    [...recentAlbums, ...ALB].filter((a, i, arr) => arr.indexOf(a) === i).slice(0, 5).forEach((a) => quick.push({ ctx: 'album:' + a.id, href: '#/album/' + a.id, name: a.title, cover: `<span class="pc-cover q-cover"><img src="${esc(a.cover)}" alt="" loading="lazy"></span>` }));
    [MIXES[0], MIXES[1]].forEach((m) => quick.push({ ctx: 'mix:' + m.id, href: '#/mix/' + m.id, name: m.name, cover: mixCover(m, 'q-cover') }));
    const day = new Date(); const seed = day.getFullYear() * 400 + day.getMonth() * 31 + day.getDate();
    const withStory = TR.filter((t, i) => !t.bonus && MJ.storyOf(t) && TR.findIndex((x) => x.title === t.title) === i); const pickT = withStory[seed % withStory.length];
    const st = MJ.storyOf(pickT);
    const featured = MJ.clipList().filter((s) => ['thriller', 'billie-jean', 'smooth-criminal', 'black-or-white', 'remember-the-time', 'scream', 'beat-it', 'bad', 'earth-song'].includes(s));
    return `${bar()}<div class="mp-body" style="--hc:#7a5a14"><div class="mp-glow"></div>
      <h2 class="mp-greet">${greeting()}</h2>
      <div class="mp-quick">${quick.map((q) => `<div class="mp-qtile"><a href="${q.href}">${q.cover}<b>${esc(q.name)}</b></a><button type="button" class="pc-play" data-play-ctx="${q.ctx}" aria-label="Reproducir ${esc(q.name)}"><i class="bi bi-play-fill" aria-hidden="true"></i></button></div>`).join('')}</div>
      ${recent.length ? shelf('Seguir escuchando', 'Lo último que sonó en tu sesión', recent.slice(0, 12).map(trackCard)) : ''}
      <section class="spot" style="--ac:${pickT.color}"><img src="${esc(pickT.cover)}" alt=""><div><p class="ns-kicker"><i class="bi bi-journal-richtext" aria-hidden="true"></i> La canción del día</p><h3>${esc(pickT.title)}</h3><p class="spot-by">${esc(pickT.album)} · ${st.y}</p><p>${esc(st.s[0])}</p><div class="spot-btns"><button type="button" class="btn-liquid btn-liquid-sm" data-play-key="${esc(pickT.key)}"><span>Escuchar</span><i class="bi bi-play-fill" aria-hidden="true"></i></button><button type="button" class="btn-ghost-sm" data-story-open="${esc(pickT.key)}">Leer la historia</button></div></div></section>
      ${shelf('Hecho para escuchar', 'Mixes editoriales de Michael Jackson', MIXES.map(mixCard))}
      ${shelf('Álbumes', 'De Off the Wall a Xscape', ALB.map(albumCard), ['#/artist', 'Ver discografía'])}
      ${shelf('Videoclips', 'Los cortometrajes que cambiaron el género', featured.map((s) => videoCard(s)), ['#/videos', 'Ver todos'])}
      ${shelf('Las más escuchadas', 'Los grandes éxitos', POPULAR.slice(0, 12).map((k) => trackCard(MJ.byKey.get(k))))}
      <section class="era-strip"><header><h2>Por época</h2><a href="historia.html" class="mp-more">Ver la historia</a></header><div class="era-chips">${(window.MJ_ERAS || []).map((e) => `<a href="historia.html#era-${e.id}" style="--ec:${e.color}"><img src="assets/img/eras/${e.id}/${String(e.hero).padStart(2, '0')}.jpg" alt="" loading="lazy"><b>${esc(e.name)}</b><small>${esc(e.years)}</small></a>`).join('')}</div></section>
    </div>`;
  };

  const vArtist = () => {
    const vids = MJ.clipList().length, songs = new Set(TR.map((t) => t.title)).size, followed = store.get('mj-follow', false);
    const pop = POPULAR.slice(0, showMorePop ? 10 : 5).map((k) => MJ.byKey.get(k));
    return `${bar()}<div class="mp-body artist">
      <header class="artist-hero"><img class="ah-img" src="assets/Heros/6.jpg" alt=""><div class="ah-shade"></div>
        <div class="ah-in"><p class="verified"><i class="bi bi-patch-check-fill" aria-hidden="true"></i> Artista verificado</p><h1>Michael Jackson</h1><p class="ah-sub">El Rey del Pop · ${ALB.length} álbumes · ${songs} canciones · ${vids} videoclips</p></div></header>
      <div class="mp-actions">${playRound('artist')}<button type="button" class="pill-btn" data-shuffle-ctx="artist"><i class="bi bi-shuffle" aria-hidden="true"></i> Aleatorio</button><button type="button" class="pill-btn${followed ? ' is-on' : ''}" data-follow aria-pressed="${followed}">${followed ? 'Siguiendo' : 'Seguir'}</button></div>
      <h2 class="mp-h2">Populares</h2>${table(pop, { cover: true })}
      <button type="button" class="link-quiet pop-more" data-pop-more>${showMorePop ? 'Ver menos' : 'Ver más'}</button>
      ${shelf('Discografía', 'Álbumes de estudio y recopilatorios', ALB.slice().reverse().map(albumCard))}
      ${shelf('Mixes', 'Selecciones para cada momento', MIXES.map(mixCard))}
      <section class="about" style="--ac:#d4af37"><img src="assets/img/eras/thriller/02.jpg" alt="Michael Jackson con un cachorro de tigre, fotografía del álbum Thriller"><div><h2 class="mp-h2">Acerca de</h2><p>Michael Jackson (Gary, Indiana, 1958 – Los Ángeles, 2009) es conocido como el Rey del Pop. Comenzó a los cinco años con The Jackson 5 y, como solista, publicó álbumes que cambiaron la música, el baile y el videoclip: Off the Wall, Thriller, Bad, Dangerous, HIStory e Invincible. Thriller es considerado el álbum más vendido de la historia.</p><div class="about-stats"><span><b>13</b> Grammys en vida</span><span><b>5</b> n.º 1 de un mismo álbum (Bad)</span><span><b>8</b> Grammys en una noche (1984)</span></div><a class="btn-ghost-sm" href="historia.html">Recorrer su historia</a></div></section>
    </div>`;
  };
  let showMorePop = false;
  const playRound = (ctx) => `<button type="button" class="play-round" data-play-ctx="${esc(ctx)}" aria-label="Reproducir"><i class="bi bi-play-fill" aria-hidden="true"></i></button>`;

  const vAlbum = (id) => {
    const a = MJ.album(id); if (!a) return vNotFound();
    const tracks = TR.filter((t) => t.albumId === id), total = albumDur(a), c = clipsOf(id);
    return `${bar()}<div class="mp-body">${hero(a.color, `<img class="hero-cover" src="${esc(a.cover)}" alt="Portada de ${esc(a.title)}"><div class="hero-txt"><p class="hero-type">Álbum</p><h1 class="hero-title">${esc(a.title)}</h1><p class="hero-meta"><a href="#/artist"><img src="assets/img/mj-logo-gold.png" alt="">Michael Jackson</a> · ${a.year} · ${tracks.length} canciones, ${hm(total)}</p></div>`)}
      <div class="mp-actions">${playRound('album:' + id)}<button type="button" class="pill-btn" data-shuffle-ctx="album:${id}"><i class="bi bi-shuffle" aria-hidden="true"></i> Aleatorio</button>${c.length ? `<button type="button" class="pill-btn" data-vclip="${c[0]}" data-vlist="${id}"><i class="bi bi-camera-video" aria-hidden="true"></i> Videoclips (${c.length})</button>` : ''}<a class="pill-btn" href="historia.html#era-${MJ.eraOf(id)}"><i class="bi bi-clock-history" aria-hidden="true"></i> Su época</a></div>
      ${table(tracks)}
      <section class="about album-about" style="--ac:${a.color}"><div><h2 class="mp-h2">Acerca del álbum</h2><p>${esc(a.blurb)}</p><dl class="credits"><div><dt>Lanzamiento</dt><dd>${esc(a.date)}</dd></div><div><dt>Sello</dt><dd>${esc(a.label)}</dd></div><div><dt>Producción</dt><dd>${esc(a.producer)}</dd></div></dl><div class="tags">${a.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div></div>
        <div class="facts-col">${a.facts.map((f) => `<div class="fact"><strong>${esc(f[0])}</strong><span>${esc(f[1])}</span></div>`).join('')}</div></section>
      ${c.length ? shelf('Videoclips de este álbum', '', c.map((s) => videoCard(s, id))) : ''}
      ${shelf('Más de Michael Jackson', '', ALB.filter((x) => x.id !== id).map(albumCard))}
      <p class="mp-copy">${esc(a.date)} · ${esc(a.label)}</p></div>`;
  };

  const vMix = (id) => {
    const m = mixById(id); if (!m) return vNotFound();
    const tracks = m.keys.map((k) => MJ.byKey.get(k));
    return `${bar()}<div class="mp-body">${hero(m.color, `${mixCover(m, 'hero-cover')}<div class="hero-txt"><p class="hero-type">Mix</p><h1 class="hero-title">${esc(m.name)}</h1><p class="hero-desc">${esc(m.desc)}</p><p class="hero-meta"><a href="#/artist"><img src="assets/img/mj-logo-gold.png" alt="">MJ Music</a> · ${tracks.length} canciones, ${hm(sum(m.keys))}</p></div>`)}
      <div class="mp-actions">${playRound('mix:' + id)}<button type="button" class="pill-btn" data-shuffle-ctx="mix:${id}"><i class="bi bi-shuffle" aria-hidden="true"></i> Aleatorio</button></div>${table(tracks, { cover: true })}</div>`;
  };

  const vLiked = () => {
    const keys = MJ.liked(), tracks = keys.map((k) => MJ.byKey.get(k));
    return `${bar()}<div class="mp-body">${hero('#5b3df5', `${likedCover('hero-cover')}<div class="hero-txt"><p class="hero-type">Lista</p><h1 class="hero-title">Canciones que me gustan</h1><p class="hero-meta"><a href="#/artist"><img src="assets/img/mj-logo-gold.png" alt="">Tú</a> · ${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}${tracks.length ? ', ' + hm(sum(keys)) : ''}</p></div>`)}
      ${tracks.length ? `<div class="mp-actions">${playRound('liked')}<button type="button" class="pill-btn" data-shuffle-ctx="liked"><i class="bi bi-shuffle" aria-hidden="true"></i> Aleatorio</button></div>${table(tracks, { cover: true })}` : emptyState('bi-heart', 'Aquí aparecerán tus favoritas', 'Pulsa el corazón en cualquier canción para guardarla en esta lista.', '<a class="btn-liquid btn-liquid-sm" href="#/artist"><span>Explorar canciones</span></a>')}</div>`;
  };

  const vList = (id) => {
    const l = MJ.lists().find((x) => x.id === id); if (!l) return vNotFound();
    const tracks = l.keys.map((k) => MJ.byKey.get(k));
    const q = norm(R.addq || '');
    const cand = q ? TR.filter((t) => !l.keys.includes(t.key) && !t.bonus && norm(`${t.title} ${t.album}`).includes(q)).slice(0, 8) : [];
    return `${bar()}<div class="mp-body">${hero('#7a5a14', `${listCover(l, 'hero-cover')}<div class="hero-txt"><p class="hero-type">Lista</p>${R.editing ? `<form class="rename" data-rename="${esc(id)}"><input class="field" value="${esc(l.name)}" maxlength="40" aria-label="Nombre de la lista" autofocus><button class="btn-add" type="submit">Guardar</button></form>` : `<h1 class="hero-title">${esc(l.name)}</h1>`}<p class="hero-meta"><a href="#/artist"><img src="assets/img/mj-logo-gold.png" alt="">Tú</a> · ${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}${tracks.length ? ', ' + hm(sum(l.keys)) : ''}</p></div>`)}
      <div class="mp-actions">${tracks.length ? playRound('list:' + id) + `<button type="button" class="pill-btn" data-shuffle-ctx="list:${id}"><i class="bi bi-shuffle" aria-hidden="true"></i> Aleatorio</button>` : ''}<button type="button" class="pill-btn" data-edit-list><i class="bi bi-pencil" aria-hidden="true"></i> Cambiar nombre</button><button type="button" class="pill-btn pill-danger" data-del-list="${esc(id)}"><i class="bi bi-trash3" aria-hidden="true"></i> Eliminar</button></div>
      ${tracks.length ? table(tracks, { cover: true, remove: true }) : emptyState('bi-music-note-list', 'Empecemos a llenar tu lista', 'Busca abajo canciones para agregar o usa el botón ⋯ en cualquier pista.')}
      <section class="finder"><h2 class="mp-h2">Busquemos algo para tu lista</h2><div class="mp-search finder-in"><i class="bi bi-search" aria-hidden="true"></i><input type="search" id="mpAddQ" placeholder="Busca canciones o álbumes" aria-label="Buscar canciones para agregar" value="${esc(R.addq || '')}" autocomplete="off"></div>
        <ul class="finder-list">${cand.map((t) => `<li><img src="${esc(t.cover)}" alt="" width="44" height="44"><span><b>${esc(t.title)}</b><small>${esc(t.album)}</small></span><button type="button" class="pill-btn" data-add-to="${esc(id)}" data-key="${esc(t.key)}">Agregar</button></li>`).join('')}</ul></section></div>`;
  };

  const vVideos = (aid) => {
    const all = MJ.clipList(), list = aid ? all.filter((s) => CLIPS[s].a === aid) : all, feat = CLIPS.thriller ? 'thriller' : all[0];
    const chips = [['', 'Todos']].concat(ALB.filter((a) => clipsOf(a.id).length).map((a) => [a.id, a.title]));
    return `${bar()}<div class="mp-body" style="--hc:#5a1a14"><div class="mp-glow"></div>
      <h1 class="mp-h1">Videoclips</h1><p class="mp-lead">Los cortometrajes y videos oficiales de Michael Jackson: ${all.length} piezas, de Off the Wall a Xscape.</p>
      ${aid ? '' : `<button type="button" class="vfeat" data-vclip="${feat}"><img src="assets/video/clips/${feat}.jpg" alt=""><span class="vf-shade"></span><span class="vf-txt"><small>Destacado</small><b>${esc(CLIPS[feat].t)}</b><em>John Landis · 1983 · ${fmt(CLIPS[feat].d)}</em></span><span class="vf-play"><i class="bi bi-play-fill" aria-hidden="true"></i></span></button>`}
      <div class="mp-chips" role="tablist">${chips.map(([id, n]) => `<a href="#/videos${id ? '/' + id : ''}" class="mp-chip${(aid || '') === id ? ' is-on' : ''}" role="tab" aria-selected="${(aid || '') === id}">${esc(n)}</a>`).join('')}</div>
      <div class="vgrid">${list.map((s) => videoCard(s, aid || '')).join('')}</div></div>`;
  };

  const vLibrary = () => {
    const ls = MJ.lists();
    return `${bar()}<div class="mp-body"><h1 class="mp-h1">Tu biblioteca</h1><div class="lib-m">
      <a class="lib-item" href="#/liked">${likedCover('li-c')}<span><b>Canciones que me gustan</b><small>Lista · ${MJ.liked().length} canciones</small></span></a>
      ${ls.map((l) => `<a class="lib-item" href="#/playlist/${esc(l.id)}">${listCover(l, 'li-c')}<span><b>${esc(l.name)}</b><small>Lista · ${l.keys.length} canciones</small></span></a>`).join('')}
      ${MIXES.map((m) => `<a class="lib-item" href="#/mix/${m.id}">${mixCover(m, 'li-c')}<span><b>${esc(m.name)}</b><small>Mix · ${m.keys.length} canciones</small></span></a>`).join('')}
      ${ALB.map((a) => `<a class="lib-item" href="#/album/${a.id}"><span class="pc-cover li-c"><img src="${esc(a.cover)}" alt="" loading="lazy"></span><span><b>${esc(a.title)}</b><small>Álbum · ${a.year}</small></span></a>`).join('')}</div>
      <button type="button" class="btn-liquid btn-liquid-sm" data-new-list><span>Crear una lista</span><i class="bi bi-plus-lg" aria-hidden="true"></i></button></div>`;
  };

  const emptyState = (ic, h, p, extra = '') => `<div class="mp-empty"><i class="bi ${ic}" aria-hidden="true"></i><h2>${h}</h2><p>${p}</p>${extra}</div>`;
  const vNotFound = () => `${bar()}<div class="mp-body">${emptyState('bi-compass', 'No encontramos esa página', 'Vuelve al inicio y sigue explorando.', '<a class="btn-liquid btn-liquid-sm" href="#/"><span>Ir al inicio</span></a>')}</div>`;

  /* ---- búsqueda ---- */
  const searchIndex = TR.filter((t, i) => !t.bonus && TR.findIndex((x) => x.title === t.title) === i).map((t) => { const st = MJ.storyOf(t); return { t, hay: norm(`${t.title} ${t.album} ${t.albumId} ${st ? st.y + ' ' + st.by : ''}`), story: st ? norm(st.s.join(' ')) : '' }; });
  const score = (q, it) => { const title = norm(it.t.title); if (title === q) return 100; if (title.startsWith(q)) return 80; if (title.includes(q)) return 60; if (norm(it.t.album).includes(q)) return 40; if (it.hay.includes(q)) return 30; if (it.story.includes(q)) return 10; return 0; };
  const vSearch = (q) => {
    if (!q) {
      const tiles = [...ALB.map((a) => ({ n: a.title, c: a.color, href: '#/album/' + a.id, img: a.cover })), ...MIXES.map((m) => ({ n: m.name, c: m.color, href: '#/mix/' + m.id, img: MJ.byKey.get(m.keys[0]).cover })), { n: 'Videoclips', c: '#b01e2e', href: '#/videos', img: 'assets/video/clips/thriller.jpg' }, { n: 'Historia', c: '#2d6a9f', href: 'historia.html', img: 'assets/img/eras/thriller/04.jpg' }];
      return `${bar()}<div class="mp-body"><h1 class="mp-h1">Explorar todo</h1><div class="browse">${tiles.map((t) => `<a class="btile" href="${t.href}" style="--bc:${t.c}"><b>${esc(t.n)}</b><img src="${esc(t.img)}" alt="" loading="lazy"></a>`).join('')}</div></div>`;
    }
    const nq = norm(q), type = R.stype || 'all';
    const hits = searchIndex.map((it) => ({ it, s: score(nq, it) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || TR.indexOf(a.it.t) - TR.indexOf(b.it.t));
    const songs = hits.map((x) => x.it.t);
    const albums = ALB.filter((a) => norm(`${a.title} ${a.year} ${a.producer} ${a.tags.join(' ')}`).includes(nq));
    const vids = MJ.clipList().filter((s) => norm(`${CLIPS[s].t} ${MJ.album(CLIPS[s].a).title}`).includes(nq));
    const mixes = MIXES.filter((m) => norm(`${m.name} ${m.desc}`).includes(nq));
    const lists = MJ.lists().filter((l) => norm(l.name).includes(nq));
    const total = songs.length + albums.length + vids.length + mixes.length + lists.length;
    const chips = [['all', 'Todo'], ['songs', 'Canciones'], ['albums', 'Álbumes'], ['videos', 'Videoclips'], ['mixes', 'Mixes y listas']];
    let top = '';
    const best = hits[0] && hits[0].s >= 60 ? hits[0].it.t : null;
    if (best) top = `<section class="srch-top"><div><h2 class="mp-h2">Mejor resultado</h2><article class="top-card" style="--ac:${best.color}"><img src="${esc(best.cover)}" alt=""><b>${esc(best.title)}</b><small>Canción · ${esc(best.album)}</small><button type="button" class="pc-play" data-play-key="${esc(best.key)}" aria-label="Reproducir ${esc(best.title)}"><i class="bi bi-play-fill" aria-hidden="true"></i></button></article></div><div><h2 class="mp-h2">Canciones</h2>${table(songs.slice(0, 4), { cover: true, num: false })}</div></section>`;
    const body = !total ? emptyState('bi-search', `No hay resultados para «${esc(q)}»`, 'Prueba con el título de una canción, un álbum, un año o el nombre de un colaborador: Quincy Jones, Slash, Paul McCartney…') : `
      ${(type === 'all' || type === 'songs') ? (type === 'all' ? top : '') : ''}
      ${type === 'songs' ? `<h2 class="mp-h2">Canciones</h2>${table(songs, { cover: true })}` : ''}
      ${type === 'all' && songs.length > 4 && !best ? `<h2 class="mp-h2">Canciones</h2>${table(songs.slice(0, 6), { cover: true })}` : ''}
      ${(type === 'all' || type === 'albums') && albums.length ? shelf('Álbumes', '', albums.map(albumCard)) : ''}
      ${(type === 'all' || type === 'videos') && vids.length ? shelf('Videoclips', '', vids.map((s) => videoCard(s))) : ''}
      ${(type === 'all' || type === 'mixes') && (mixes.length || lists.length) ? shelf('Mixes y listas', '', [...mixes.map(mixCard), ...lists.map((l) => `<article class="pcard"><a class="pc-link" href="#/playlist/${esc(l.id)}">${listCover(l)}<b>${esc(l.name)}</b><small>Lista · ${l.keys.length} canciones</small></a></article>`)]) : ''}`;
    return `${bar()}<div class="mp-body"><div class="mp-chips" role="tablist">${chips.map(([id, n]) => `<button type="button" class="mp-chip${type === id ? ' is-on' : ''}" data-stype="${id}" role="tab" aria-selected="${type === id}">${n}</button>`).join('')}</div>${body}</div>`;
  };

  /* ------------------------------------------------------------ enrutado */
  const R = { name: 'home', id: '', q: '', stype: 'all', editing: false, addq: '' };
  const parse = () => {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, '')), [name = '', ...rest] = h.split('/');
    R.name = name || 'home'; R.id = rest.join('/'); R.q = R.name === 'search' ? R.id : '';
  };
  let ctxList = [];
  const render = (keepScroll) => {
    parse();
    let html, color = '#7a5a14', tab = R.name;
    switch (R.name) {
      case 'home': html = vHome(); tab = 'home'; break;
      case 'search': html = vSearch(R.q); break;
      case 'artist': html = vArtist(); break;
      case 'album': html = vAlbum(R.id); color = (MJ.album(R.id) || {}).color; tab = 'home'; break;
      case 'mix': html = vMix(R.id); color = (mixById(R.id) || {}).color; tab = 'home'; break;
      case 'liked': html = vLiked(); color = '#5b3df5'; tab = 'library'; break;
      case 'playlist': html = vList(R.id); tab = 'library'; break;
      case 'videos': html = vVideos(R.id); color = '#8f1d24'; break;
      case 'library': html = vLibrary(); break;
      default: html = vNotFound();
    }
    const top = view.scrollTop;
    view.innerHTML = html;
    view.style.setProperty('--vc', color || '#7a5a14');
    view.scrollTop = keepScroll ? top : 0;
    // contexto para reproducir desde una fila
    const ctx = { album: () => ({ keys: TR.filter((t) => t.albumId === R.id).map((t) => t.key), id: 'album:' + R.id, name: (MJ.album(R.id) || {}).title }), mix: () => ({ keys: (mixById(R.id) || { keys: [] }).keys, id: 'mix:' + R.id, name: (mixById(R.id) || {}).name }), liked: () => ({ keys: MJ.liked(), id: 'liked', name: 'Canciones que me gustan' }), playlist: () => { const l = MJ.lists().find((x) => x.id === R.id) || { keys: [], name: '' }; return { keys: l.keys, id: 'list:' + R.id, name: l.name }; }, artist: () => ({ keys: POPULAR, id: 'artist', name: 'Michael Jackson · Populares' }) };
    const c = ctx[R.name] ? ctx[R.name]() : null;
    ctxList = c ? c.keys : []; ctxId = c ? c.id : ''; ctxName = c ? c.name : '';
    if (R.name === 'search') { const s = view.querySelectorAll('.mp-row'); const q = norm(R.q); ctxList = searchIndex.map((it) => ({ it, s: score(q, it) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.it.t.key); ctxId = 'search'; ctxName = `Búsqueda · ${R.q}`; void s; }
    $$('#mpTabs a').forEach((a) => a.classList.toggle('is-on', a.dataset.tab === tab));
    $$('.mp-side [data-lib-on]').forEach((el) => el.classList.remove('is-on'));
    const sel = R.name === 'album' ? `[data-lib="album:${R.id}"]` : R.name === 'playlist' ? `[data-lib="list:${R.id}"]` : R.name === 'liked' ? '[data-lib="liked"]' : R.name === 'mix' ? `[data-lib="mix:${R.id}"]` : '';
    if (sel) $(sel, side)?.classList.add('is-on');
    $$('.sn-item', side).forEach((a) => a.classList.toggle('is-on', a.dataset.snav === (R.name === 'home' ? 'home' : R.name)));
    syncPlaying(); animateIn();
    document.title = ({ home: 'MJ Music · Inicio', search: 'Buscar · MJ Music', artist: 'Michael Jackson · MJ Music', videos: 'Videoclips · MJ Music', library: 'Tu biblioteca · MJ Music' })[R.name] || ((R.name === 'album' && MJ.album(R.id)) ? `${MJ.album(R.id).title} · MJ Music` : 'MJ Music');
  };
  const animateIn = () => {
    if (!motion) return;
    G.from(view.querySelectorAll('.mp-shelf, .mp-quick, .mp-hero, .artist-hero, .mp-table, .spot, .mp-actions, .browse, .vgrid, .about'), { y: 22, opacity: 0, duration: 0.7, stagger: 0.06, ease: 'expo.out', clearProps: 'all' });
  };

  /* ------------------------------------------------------------ barra lateral */
  const renderSide = () => {
    const ls = MJ.lists(), f = R.libFilter || 'all';
    const items = [];
    if (f === 'all' || f === 'lists') {
      items.push(`<li><a class="lib-row" data-lib="liked" href="#/liked">${likedCover('lr-c')}<span><b>Canciones que me gustan</b><small>Lista · ${MJ.liked().length} canciones</small></span></a>${playBtn('liked', 'Canciones que me gustan')}</li>`);
      ls.forEach((l) => items.push(`<li><a class="lib-row" data-lib="list:${esc(l.id)}" href="#/playlist/${esc(l.id)}">${listCover(l, 'lr-c')}<span><b>${esc(l.name)}</b><small>Lista · ${l.keys.length} canciones</small></span></a>${l.keys.length ? playBtn('list:' + l.id, l.name) : ''}</li>`));
      MIXES.forEach((m) => items.push(`<li><a class="lib-row" data-lib="mix:${m.id}" href="#/mix/${m.id}">${mixCover(m, 'lr-c')}<span><b>${esc(m.name)}</b><small>Mix · ${m.keys.length} canciones</small></span></a>${playBtn('mix:' + m.id, m.name)}</li>`));
    }
    if (f === 'all' || f === 'albums') ALB.forEach((a) => items.push(`<li><a class="lib-row" data-lib="album:${a.id}" href="#/album/${a.id}"><span class="pc-cover lr-c"><img src="${esc(a.cover)}" alt="" loading="lazy"></span><span><b>${esc(a.title)}</b><small>Álbum · ${a.year}</small></span></a>${playBtn('album:' + a.id, a.title)}</li>`));
    side.innerHTML = `<nav class="side-card sn" aria-label="Principal">
        <a class="sn-item" data-snav="home" href="#/"><i class="bi bi-house-door-fill" aria-hidden="true"></i><span>Inicio</span></a>
        <a class="sn-item" data-snav="search" href="#/search"><i class="bi bi-search" aria-hidden="true"></i><span>Buscar</span></a>
        <a class="sn-item" data-snav="videos" href="#/videos"><i class="bi bi-camera-video-fill" aria-hidden="true"></i><span>Videoclips</span></a>
        <a class="sn-item" data-snav="artist" href="#/artist"><i class="bi bi-person-badge-fill" aria-hidden="true"></i><span>Michael Jackson</span></a>
      </nav>
      <div class="side-card lib"><header><h2><i class="bi bi-collection-fill" aria-hidden="true"></i> Tu biblioteca</h2><button type="button" class="mb-ic" data-new-list aria-label="Crear una lista" title="Crear una lista"><i class="bi bi-plus-lg" aria-hidden="true"></i></button></header>
        <div class="mp-chips sm">${[['all', 'Todo'], ['lists', 'Listas'], ['albums', 'Álbumes']].map(([id, n]) => `<button type="button" class="mp-chip${f === id ? ' is-on' : ''}" data-libf="${id}">${n}</button>`).join('')}</div>
        <ul class="lib-list">${items.join('')}</ul></div>
      <p class="side-foot">Proyecto de fans · Las canciones son de sus respectivos titulares. <a href="historia.html">Historia</a> · <a href="discografia.html">Discografía</a></p>`;
    $$('.sn-item', side).forEach((a) => a.classList.toggle('is-on', a.dataset.snav === (R.name === 'home' ? 'home' : R.name)));
    syncPlaying();
  };

  /* ------------------------------------------------------------ panel Ahora suena */
  const renderNow = () => {
    const t = MJ.current(), qs = MJ.queueState();
    if (!t) {
      nowEl.innerHTML = `<div class="now-empty"><i class="bi bi-vinyl-fill" aria-hidden="true"></i><h2>Ahora suena</h2><p>Elige una canción y aquí verás su portada, su historia y los créditos.</p></div>`;
      return;
    }
    const next = qs.queue.slice(qs.cur + 1, qs.cur + 4);
    nowEl.innerHTML = `<div class="now-in" style="--ac:${esc(t.color)}"><header><h2>${esc(t.album)}</h2><button type="button" class="mb-ic" data-now-toggle aria-label="Ocultar el panel"><i class="bi bi-x-lg" aria-hidden="true"></i></button></header>
      <img class="now-cover" src="${esc(t.cover)}" alt="Portada de ${esc(t.album)}">
      <div class="now-meta"><div><h3>${esc(t.title)}</h3><p>Michael Jackson</p></div><button type="button" class="r-ico r-like${MJ.isLiked(t.key) ? ' is-on' : ''}" data-plike="${esc(t.key)}" aria-pressed="${MJ.isLiked(t.key)}" aria-label="Me gusta"><i class="bi ${MJ.isLiked(t.key) ? 'bi-heart-fill' : 'bi-heart'}" aria-hidden="true"></i></button></div>
      <div class="np-story now-story">${MJ.storyHTML(t)}</div>
      ${next.length ? `<section class="now-next"><header><h4>A continuación</h4><button type="button" class="link-quiet" data-open-queue>Abrir cola</button></header>${next.map((n, i) => `<button type="button" class="nn-row" data-qplay="${qs.cur + 1 + i}"><img src="${esc(n.cover)}" alt="" width="40" height="40"><span><b>${esc(n.title)}</b><small>${esc(n.album)}</small></span></button>`).join('')}</section>` : ''}</div>`;
    if (motion) G.from('.now-in > *', { y: 16, opacity: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out', clearProps: 'all' });
  };

  /* ------------------------------------------------------------ estado de reproducción */
  const syncPlaying = () => {
    const t = MJ.current(), playing = MJ.isPlaying();
    $$('.mp-rowwrap').forEach((w) => { const on = !!t && w.dataset.key === t.key; w.classList.toggle('is-current', on); w.classList.toggle('is-playing', on && playing); const b = $('.r-play i', w); if (b) b.className = `bi ${on && playing ? 'bi-pause-fill' : 'bi-play-fill'}`; });
    $$('[data-play-ctx]').forEach((b) => { const on = ctxIsCurrent(b.dataset.playCtx) && playing; b.classList.toggle('is-on', on); const i = $('i', b); if (i) i.className = `bi ${on ? 'bi-pause-fill' : 'bi-play-fill'}`; b.setAttribute('aria-label', (on ? 'Pausar ' : 'Reproducir ')); });
    $$('[data-play-key]').forEach((b) => { const on = !!t && b.dataset.playKey === t.key && playing; const i = $('i', b); if (i) i.className = `bi ${on ? 'bi-pause-fill' : 'bi-play-fill'}`; });
    $$('.lib-row.is-playing, .mp-qtile.is-playing').forEach((el) => el.classList.remove('is-playing'));
    $$('[data-lib]', side).forEach((el) => el.classList.toggle('is-playing', ctxIsCurrent(el.dataset.lib) && playing));
  };
  const syncLikes = () => {
    $$('[data-plike]').forEach((b) => { const on = MJ.isLiked(b.dataset.plike); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); const i = $('i', b); if (i) i.className = `bi ${on ? 'bi-heart-fill' : 'bi-heart'}`; });
  };

  /* ------------------------------------------------------------ eventos */
  document.addEventListener('click', (e) => {
    const g = (s) => e.target.closest(s);
    let el;
    if ((el = g('[data-play-ctx]'))) { e.preventDefault(); playCtx(el.dataset.playCtx); return; }
    if ((el = g('[data-shuffle-ctx]'))) { playCtx(el.dataset.shuffleCtx, true); return; }
    if ((el = g('[data-play-key]'))) { const t = MJ.byKey.get(el.dataset.playKey); if (MJ.current() && MJ.current().key === t.key) MJ.toggle(); else MJ.playTracks([t.key, ...TR.filter((x) => x.albumId === t.albumId && x.key !== t.key).map((x) => x.key)], t.album, t.key, false, 'album:' + t.albumId); return; }
    if ((el = g('[data-row-play]'))) { const w = el.closest('.mp-rowwrap'), key = w.dataset.key; if (MJ.current() && MJ.current().key === key) { MJ.toggle(); return; } startRow(key); return; }
    if ((el = g('[data-plike]'))) { MJ.toggleLike(el.dataset.plike); return; }
    if ((el = g('[data-story]'))) { toggleStory(el); return; }
    if ((el = g('[data-story-open]'))) { const t = MJ.byKey.get(el.dataset.storyOpen); location.hash = `#/album/${t.albumId}`; setTimeout(() => { const b = $(`.mp-rowwrap[data-key="${CSS.escape(t.key)}"] [data-story]`); if (b) { toggleStory(b, true); b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 250); return; }
    if ((el = g('[data-rm]'))) { const id = R.id; MJ.addToList(id, el.dataset.rm); return; }
    if ((el = g('[data-add-to]'))) { MJ.addToList(el.dataset.addTo, el.dataset.key); return; }
    if ((el = g('[data-vclip]'))) { const slug = el.dataset.vclip, l = el.dataset.vlist; e.preventDefault(); MJ.openClip(slug, l ? MJ.clipList().filter((s) => CLIPS[s].a === l) : null); return; }
    if ((el = g('[data-shelf]'))) { const sh = el.parentElement.querySelector('.shelf'); sh.scrollBy({ left: Number(el.dataset.shelf) * sh.clientWidth * 0.85, behavior: 'smooth' }); return; }
    if ((el = g('[data-nav]'))) { history.go(Number(el.dataset.nav)); return; }
    if ((el = g('[data-now-toggle]'))) { const off = document.body.classList.toggle('mp-now-off'); store.set('mj-now-off', off); return; }
    if ((el = g('[data-stype]'))) { R.stype = el.dataset.stype; render(true); return; }
    if ((el = g('[data-libf]'))) { R.libFilter = el.dataset.libf; renderSide(); return; }
    if ((el = g('[data-new-list]'))) { const n = MJ.lists().length + 1; const l = MJ.createList(`Mi lista n.º ${n}`); if (l) { R.pendingEdit = true; document.dispatchEvent(new CustomEvent('mj:library')); location.hash = `#/playlist/${l.id}`; } return; }
    if ((el = g('[data-edit-list]'))) { R.editing = !R.editing; render(true); $('.rename input', view)?.select(); return; }
    if ((el = g('[data-del-list]'))) { const l = MJ.lists().find((x) => x.id === el.dataset.delList); if (l && confirm(`¿Eliminar la lista «${l.name}»?`)) { MJ.deleteList(l.id); location.hash = '#/library'; } return; }
    if ((el = g('[data-follow]'))) { const on = !store.get('mj-follow', false); store.set('mj-follow', on); el.classList.toggle('is-on', on); el.textContent = on ? 'Siguiendo' : 'Seguir'; el.setAttribute('aria-pressed', String(on)); toast(on ? 'Ahora sigues a Michael Jackson' : 'Dejaste de seguir a Michael Jackson'); return; }
    if ((el = g('[data-pop-more]'))) { showMorePop = !showMorePop; render(true); return; }
    if ((el = g('[data-open-queue]'))) { MJ.openPanel('queue'); return; }
    if ((el = g('[data-qplay]'))) { const i = Number(el.dataset.qplay); const q = MJ.queueState().queue[i]; if (q) MJ.playTracks(MJ.queueState().queue.map((x) => x.key), MJ.queueState().src.name, q.key, undefined, MJ.queueState().src.id); return; }
    // fila: clic en tarjetas táctiles
    if ((el = g('.mp-row')) && coarse && !g('button, a')) { const w = el.closest('.mp-rowwrap'); if (MJ.current() && MJ.current().key === w.dataset.key) MJ.toggle(); else startRow(w.dataset.key); }
  });
  document.addEventListener('dblclick', (e) => { const r = e.target.closest('.mp-row'); if (r && !e.target.closest('button, a')) startRow(r.closest('.mp-rowwrap').dataset.key); });
  const startRow = (key) => {
    if (ctxId.startsWith('album:')) { const t = MJ.byKey.get(key); MJ.playKey(t.albumId, t.i); return; }
    const src = ctxId === 'liked' ? 'liked' : ctxId.startsWith('list:') ? ctxId.slice(5) : ctxId;
    if (src === 'liked' || ctxId.startsWith('list:')) { MJ.playList(src, key); return; }
    MJ.playTracks(ctxList.length ? ctxList : [key], ctxName, key, false, ctxId);
  };
  const toggleStory = (btn, force) => {
    const w = btn.closest('.mp-rowwrap'), box = $('.row-story', w), open = force !== undefined ? force : box.hidden;
    if (open && !box.innerHTML) box.innerHTML = `<div class="np-story rs-in">${MJ.storyHTML(MJ.byKey.get(w.dataset.key))}</div>`;
    box.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('is-on', open);
    if (open && motion) G.from(box, { height: 0, opacity: 0, duration: 0.5, ease: 'expo.out', clearProps: 'all' });
  };
  // Buscador
  document.addEventListener('submit', (e) => {
    if (e.target.matches('[data-search]')) { e.preventDefault(); const q = $('#mpQ').value.trim(); location.hash = q ? `#/search/${encodeURIComponent(q)}` : '#/search'; }
    if (e.target.matches('[data-rename]')) { e.preventDefault(); MJ.renameList(e.target.dataset.rename, $('input', e.target).value); R.editing = false; render(true); renderSide(); }
  });
  let st = 0;
  document.addEventListener('input', (e) => {
    if (e.target.id === 'mpQ') { clearTimeout(st); st = setTimeout(() => { const q = e.target.value.trim(); const h = q ? `#/search/${encodeURIComponent(q)}` : '#/search'; if (location.hash !== h) { history.replaceState(null, '', h); parse(); const sc = view.scrollTop; view.innerHTML = vSearch(R.q); view.scrollTop = sc; const i = $('#mpQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); ctxList = []; render0(); } }, 220); }
    if (e.target.id === 'mpAddQ') { R.addq = e.target.value; clearTimeout(st); st = setTimeout(() => { const v = e.target.value; render(true); const i = $('#mpAddQ'); if (i) { i.focus(); i.setSelectionRange(v.length, v.length); } }, 200); }
  });
  const render0 = () => { render(true); const i = $('#mpQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } };
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName) && !e.ctrlKey && !e.metaKey) { e.preventDefault(); const i = $('#mpQ'); if (i) i.focus(); else location.hash = '#/search'; }
    if (e.key === 'Escape' && e.target.id === 'mpQ') e.target.blur();
  });

  addEventListener('hashchange', () => { R.editing = !!R.pendingEdit; R.pendingEdit = false; R.addq = ''; if (R.name !== 'search') R.stype = 'all'; render(); });
  document.addEventListener('mj:track', () => { syncPlaying(); renderNow(); });
  document.addEventListener('mj:library', () => { renderSide(); syncLikes(); if (['liked', 'playlist', 'library', 'home'].includes(R.name)) render(true); renderNow(); });
  const au = MJ.audio; if (au) { au.addEventListener('play', syncPlaying); au.addEventListener('pause', syncPlaying); }

  /* ------------------------------------------------------------ alto de la barra superior (en móvil ocupa dos filas) */
  const mainNav = document.getElementById('mainNav');
  const setNavH = () => { if (mainNav && !$('#navMenu.show')) document.body.style.setProperty('--mp-nav', `${mainNav.offsetHeight}px`); };
  setNavH(); addEventListener('resize', setNavH); addEventListener('load', setNavH);

  /* ------------------------------------------------------------ inicio */
  if (store.get('mj-now-off', false)) document.body.classList.add('mp-now-off');
  parse(); renderSide(); render(); renderNow();
  if (motion) G.from('.mp-side, .mp-now', { opacity: 0, y: 20, duration: 0.8, stagger: 0.1, ease: 'expo.out', delay: 0.4, clearProps: 'all' });
})();
