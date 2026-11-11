// Thiel network map behaviour. Content lives in data.js, styling in styles.css.
// To add a badge/detail type, add one entry to FACETS; to add a filter, add one entry to FILTERS.
(() => {
  'use strict';
  const N = DATA.nodes, E = DATA.edges, CAT = DATA.cats;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

  // ---------- configuration ----------
  const HUB = 'T'; // id of the central node (Peter Thiel)
  const TRAY_DELAY_MS = 140;               // hover pause before the connection tray opens
  const TRAY_CAP = { hub: 12, other: 16 }; // max people listed in the tray
  const TRAY_GAP = 24;                     // breathing room needed around the tray
  const TRAY_MIN_HEIGHT = 110;
  const LABEL_MAX = 46;                    // longest line label drawn on the map
  const STORE = { side: 'thielSide', legend: 'thielLegend', theme: 'thielTheme' };

  // Category sections in display order; span = grid columns (of 12) on wide screens.
  const SECTIONS = [['infl', 5], ['pp', 7], ['neo', 12], ['pol', 12], ['prot', 12], ['faith', 12], ['net', 12], ['oth', 12]];

  // Kinds of government reach; color names map to .c-<color> classes in styles.css.
  const GOV = {
    contractor: { color: 'navy', pill: 'Gov Contractor', title: 'Government contractor', reach: 'Government Contractors' },
    official: { color: 'gold', pill: '&#9733; In Government', title: 'Holds or held a government role', reach: 'In Government' },
    influence: { color: 'slate', pill: 'Gov Influence', title: 'Investor or lobbyist with government reach', reach: 'With Government Influence' },
    abroad: { color: 'teal', pill: 'Abroad', title: 'Dealings with non-US governments', reach: 'Dealing with Other Governments' },
  };
  const REACH_ORDER = ['official', 'contractor', 'influence', 'abroad'];

  // Filters. Entries with `chip` become buttons in the bar; the rest are triggered from the summary counts.
  const FILTERS = {
    all: { chip: 'Everyone', test: () => true },
    anti: { chip: 'Anti-Democracy / Exit Views', test: n => n.anti },
    faith: { chip: 'Christian Nationalism', test: n => n.faith || n.cat === 'faith' },
    fund: { chip: 'Funded by Thiel', test: n => n.fund },
    net: { chip: 'Network States', test: n => n.cat === 'net' },
    gov: { chip: 'Government Reach', test: n => n.gov },
    ...Object.fromEntries(Object.keys(GOV).map(k => [`gov:${k}`, { test: n => n.gov && n.gov.kinds.includes(k) }])),
  };

  // ---------- small helpers ----------
  const storage = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: ignore */ } },
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const CROSS = '<span class="cross">&#10013;</span>';
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const other = (e, id) => e.a === id ? e.b : e.a;
  const consOf = id => E.filter(e => e.a === id || e.b === id);
  const arrow = (e, id) => e.kind === 'plain' ? '&harr;' : (e.a === id ? '&rarr;' : '&larr;');
  const countWhere = test => Object.values(N).filter(test).length;
  const extLink = (cls, href, label, attrs = '') => `<a class="${cls}" href="${href}" target="_blank" rel="noopener" ${attrs}>${label}</a>`;

  // text formatting: escape, then optionally add Wikipedia links, then wrap money amounts
  const MONEY = /\$\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|thousand)|[KMB])?\+?/g;
  const ENT = DATA.ent || {};
  const ENTRE = new RegExp('(?<![A-Za-z0-9])(' + Object.keys(ENT).sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z0-9])', 'g');
  const link = s => s.replace(ENTRE, m => extLink('wk', ENT[m], m, `title="Wikipedia: ${m}"`));
  const money = (s, tag = 'span') => s.replace(MONEY, m => `<${tag} class="money">${m}</${tag}>`);
  const fmt = s => money(link(esc(s)));         // body text: links + money
  const plain = s => money(esc(s));             // no links (source titles, facts, text inside buttons)
  const svgText = s => money(esc(s), 'tspan');  // inside SVG <text>
  const bold = s => s.replace(/\*([^*]+)\*/g, '<b>$1</b>');

  // ---------- facets: one entry per kind of badge / detail block ----------
  // pills(n) -> card badges; panel(n) -> details-panel block; tray(n) -> hover-tray row;
  // legend -> [[[pill text, color], description], ...]
  const pill = (text, color, title = '') => `<span class="pill c-${color}"${title ? ` title="${title}"` : ''}>${text}</span>`;
  const block = (color, head, body) => `<div class="dsec c-${color}"><span class="h">${head}</span>${body}</div>`;
  // the tray is display-only (pointer-events: none), so its text carries no links
  const trayRow = (color, label, text, max) => `<span class="d c-${color}"><em>${label}</em>${plain(cut(text, max))}</span>`;

  const FACETS = [
    { legend: [[['Views', 'red'], 'Anti-democracy / exit views']],
      pills: n => n.anti || n.views ? pill('Views', 'red') : '',
      panel: n => n.anti ? block('red', 'Anti-Democracy / Exit Views', fmt(n.views || 'Flagged in the book as echoing these views'))
        : n.views ? block('red', 'Views', fmt(n.views)) : '',
      tray: n => n.views ? trayRow('red', 'Views', n.views, 110) : '' },
    { legend: [[[`${CROSS} Faith`, 'purple'], 'Christian tie']],
      pills: n => n.faith ? pill(`${CROSS} Faith`, 'purple') : '',
      panel: n => n.faith ? block('purple', `${CROSS} Christian Association`, fmt(n.faith)) : '',
      tray: n => n.faith ? trayRow('purple', `${CROSS} Faith`, n.faith, 110) : '' },
    { legend: [[['$ Funding', 'green'], 'Thiel funding']],
      pills: n => n.fund ? pill('$ Funding', 'green') : '',
      panel: n => n.fund ? block('green', 'Thiel Funding', fmt(n.fund)) : '',
      tray: n => n.fund ? trayRow('green', 'Thiel $', n.fund, 110) : '' },
    { legend: [[['Companies', 'pink'], 'Companies listed']],
      pills: n => n.cos && n.cat !== 'net' ? pill('Companies', 'pink') : '',
      panel: n => n.cos ? block('pink', 'Companies / Projects', fmt(n.cos)) : '',
      tray: n => n.cos && n.cat !== 'net' ? trayRow('pink', 'Companies', n.cos, 90) : '' },
    { legend: Object.values(GOV).map(g => [[g.pill, g.color], g.title]),
      pills: n => n.gov ? n.gov.kinds.map(k => pill(GOV[k].pill, GOV[k].color)).join('') : '',
      panel: n => n.gov ? block('navy', 'Government Reach',
        `<div>${n.gov.kinds.map(k => pill(GOV[k].pill, GOV[k].color, GOV[k].title)).join(' ')}</div><div class="body">${fmt(n.gov.text)}</div>`) : '',
      tray: n => n.gov ? trayRow('navy', 'Gov', n.gov.text, 120) : '' },
  ];
  const facetHtml = (kind, n) => FACETS.map(f => f[kind](n)).join('');

  // ---------- state ----------
  // How each node relates to the hub: the label of its first edge to or from it.
  const rel = {};
  E.forEach(e => {
    [[e.a, e.b], [e.b, e.a]].forEach(([from, to]) => { if (from === HUB && !rel[to]) rel[to] = e.label; });
  });
  const stage = $('#stage'), ov = $('#ov'), tray = $('#tray'), mainEl = $('main'), sideEl = $('#side');
  const els = {}; // node id -> card element
  let pinned = null, filt = 'all', term = '', trayTimer = null;
  const isHub = id => id === HUB;
  const redrawPinned = () => { if (pinned) draw(pinned, !isHub(pinned)); };

  // ---------- panel toggles (legend and details panel share one mechanism) ----------
  const keyActions = {};
  function panelToggle({ store, key, buttons, apply }) {
    let open = true;
    const set = (v, keep) => {
      open = v;
      buttons.forEach(b => b.setAttribute('aria-pressed', v));
      apply(v);
      if (!keep) storage.set(store, v ? '1' : '0');
    };
    buttons.forEach(b => b.addEventListener('click', () => set(!open)));
    keyActions[key] = () => set(!open);
    set(storage.get(store) !== '0', true);
    return { isOpen: () => open, set };
  }

  // ---------- legend and filter chips ----------
  function renderLegend() {
    const row = (title, items) => `<div class="lrow"><b>${title}</b>${items.join('')}</div>`;
    const lg = (mark, desc) => `<span class="lg">${mark}${desc}</span>`;
    $('#legend').innerHTML =
      row('Box Colour', SECTIONS.map(([k]) => lg(`<i class="sw cat-${k}"></i>`, `<span class="cat-${k} lg-cat">${CAT[k]}</span>`))) +
      row('Badges', FACETS.flatMap(f => f.legend.map(([p, d]) => lg(pill(...p), d)))) +
      row('Marks', [
        lg('<i class="sw anti"></i>', 'Red dashed border: anti-democracy views'),
        lg('<i class="sw notch"></i>', 'Notched card: network state or startup city'),
        lg(`<b class="t-purple">${CROSS}</b>`, 'Christian tie (card corner)'),
        lg('<span class="wp static cat-center">W</span>', 'Wikipedia article for the card'),
        lg('<span class="wk">underlined</span>', 'Wikipedia link for a name in the text'),
        lg('<span class="money">$15M</span>', 'Money amount'),
      ]);
  }
  function renderChips() {
    const chips = Object.entries(FILTERS).filter(([, f]) => f.chip)
      .map(([k, f]) => `<button class="chip" data-f="${k}">${f.chip}</button>`).join('');
    $('#filters').insertAdjacentHTML('beforeend', chips);
  }
  const syncChips = () => $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === filt));

  // ---------- cards and sections ----------
  function card(n, extra = '') {
    const flags = [n.anti && 'anti', n.faith && 'faith', n.cat === 'net' && 'net', extra].filter(Boolean).join(' ');
    const pills = facetHtml('pills', n);
    return `<div class="card cat-${n.cat} ${flags}" data-id="${n.id}">`
      + `<button type="button" class="n">${esc(n.name)}</button>`
      + (n.sub.length ? `<div class="s">${fmt(n.sub.join(' · '))}</div>` : '')
      + (rel[n.id] ? `<div class="r">${fmt(rel[n.id])}</div>` : '')
      + (isHub(n.id) ? `<div class="r">${fmt(n.cos)}</div><div class="r">${fmt(n.faith)}</div>` : '')
      + (pills ? `<div class="pills">${pills}</div>` : '')
      + (n.wiki ? extLink('wp', n.wiki, 'W', `title="Open Wikipedia article" aria-label="Wikipedia article: ${esc(n.name)} (opens in a new tab)"`) : '')
      + '</div>';
  }
  const stat = (filter, color, count, label) => `<button class="stat c-${color}" data-f="${filter}"><b>${count}</b>${label}</button>`;

  function renderStage() {
    const reach = `<section class="band c-navy joined"><h2>Reach Into Government</h2><div class="row">`
      + REACH_ORDER.map(k => stat(`gov:${k}`, GOV[k].color, countWhere(FILTERS[`gov:${k}`].test), GOV[k].reach)).join('')
      + `</div><div class="facts">${DATA.facts.map(f => `<span>${bold(plain(f))}</span>`).join('')}</div></section>`;
    const sections = SECTIONS.map(([k, span]) => {
      const ns = Object.values(N).filter(n => n.cat === k);
      return ns.length ? `<section class="sec cat-${k}" style="grid-column:span ${span}"><h2>${CAT[k]}</h2><div class="grid">${ns.map(n => card(n)).join('')}</div></section>` : '';
    }).join('');
    stage.insertAdjacentHTML('afterbegin', `<div class="hero-wrap">${card(N[HUB], 'hero')}${reach}</div>` + sections);
    $$('.card').forEach(c => { els[c.dataset.id] = c; });
  }

  // ---------- connection lines ----------
  function relBox(el) {
    const a = el.getBoundingClientRect(), b = stage.getBoundingClientRect();
    return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
  }
  const centre = b => [b.x + b.w / 2, b.y + b.h / 2];
  function edgeSvg(e, i, withLabels) {
    const cat = N[e.a].cat;
    const [ax, ay] = centre(relBox(els[e.a])), [bx, by] = centre(relBox(els[e.b]));
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(120, len * .25) * (i % 2 ? 1 : -1); // alternate curve direction so parallel lines don't overlap
    const cx = (ax + bx) / 2 - dy / len * bend, cy = (ay + by) / 2 + dx / len * bend;
    const marker = e.kind === 'plain' ? '' : ` marker-end="url(#ah-${cat})"`;
    let svg = `<path class="edge ${e.kind} cat-${cat}" d="M${ax},${ay} Q${cx},${cy} ${bx},${by}"${marker}/>`;
    if (withLabels && e.label) { // label sits on the curve at t = 0.5
      svg += `<text class="lbl cat-${cat}" x="${.25 * ax + .5 * cx + .25 * bx}" y="${.25 * ay + .5 * cy + .25 * by}" text-anchor="middle">${svgText(cut(e.label, LABEL_MAX))}</text>`;
    }
    return { cat, svg };
  }
  function draw(id, withLabels) {
    ov.setAttribute('width', stage.scrollWidth);
    ov.setAttribute('height', stage.scrollHeight);
    const edges = consOf(id).filter(e => els[other(e, id)]).map((e, i) => edgeSvg(e, i, withLabels));
    const markers = [...new Set(edges.map(x => x.cat))].map(c =>
      `<marker id="ah-${c}" class="cat-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`).join('');
    ov.innerHTML = `<defs>${markers}</defs>${edges.map(x => x.svg).join('')}`;
  }

  // ---------- dimming, filtering, pinning ----------
  const setDim = show => Object.entries(els).forEach(([id, el]) => el.classList.toggle('dim', !!show && !show.has(id)));
  function neighbours(id) { const s = new Set([id]); consOf(id).forEach(e => s.add(other(e, id))); return s; }
  const haystack = n => [n.name, n.cos, n.views, n.faith, n.fund, n.sub.join(' '), rel[n.id] || ''].join(' ').toLowerCase();
  function applyFilter() {
    if (pinned) return;
    const t = term.trim().toLowerCase();
    if (filt === 'all' && !t) { setDim(null); return; }
    setDim(new Set(Object.values(N).filter(n => FILTERS[filt].test(n) && (!t || haystack(n).includes(t))).map(n => n.id)));
  }
  const reset = () => { ov.innerHTML = ''; applyFilter(); };
  function unpin() {
    pinned = null;
    $$('.card.sel').forEach(c => { c.classList.remove('sel'); c.querySelector('.n').setAttribute('aria-pressed', 'false'); });
  }
  function clearSelection() { unpin(); reset(); }
  function setFilter(k) { filt = k; syncChips(); clearSelection(); }
  function pin(id) {
    hideTray();
    if (!side.isOpen()) side.set(true, true);
    unpin();
    pinned = id;
    els[id].classList.add('sel');
    els[id].querySelector('.n').setAttribute('aria-pressed', 'true');
    setDim(neighbours(id));
    draw(id, !isHub(id));
    showDetails(id);
  }
  // hover or keyboard focus on a card: spotlight it and open the tray (unless something is pinned)
  function previewCard(id) { setDim(neighbours(id)); draw(id, false); showTray(id); }
  function endPreview() { reset(); hideTray(); }

  // ---------- hover tray ----------
  function hideTray() { clearTimeout(trayTimer); tray.classList.remove('show'); tray.setAttribute('aria-hidden', 'true'); }
  function trayItems(id, viewRect) {
    const position = r => r.bottom < viewRect.top + 8 ? 'up' : (r.top > viewRect.bottom - 8 ? 'down' : '');
    return consOf(id).map(e => { const o = other(e, id); return { o, e, p: els[o] ? position(els[o].getBoundingClientRect()) : '' }; })
      .sort((x, y) => (!!y.p) - (!!x.p)); // off-screen people first
  }
  function trayHtml(id, items) {
    const cap = isHub(id) ? TRAY_CAP.hub : TRAY_CAP.other, offscreen = items.filter(i => i.p).length;
    const person = ({ o, e, p }) => `<div class="chip2 cat-${N[o].cat}">`
      + (p ? `<i>${p === 'up' ? '&uarr; Above' : '&darr; Below'}</i>` : '')
      + `<b>${esc(N[o].name)}</b>`
      + (N[o].sub.length ? `<span class="sb">${plain(N[o].sub.join(' · '))}</span>` : '')
      + `<span class="rl">${arrow(e, id)} ${plain(e.label || 'connected')}</span>${facetHtml('tray', N[o])}</div>`;
    return `<div class="th">Connected to <b>${esc(N[id].name)}</b> &middot; ${items.length}${offscreen ? ` &middot; ${offscreen} off-screen shown first` : ''}</div>`
      + `<div class="chips">${items.slice(0, cap).map(person).join('')}`
      + (items.length > cap ? `<div class="chip2"><span>+${items.length - cap} more (click the card to see all in the side panel)</span></div>` : '')
      + '</div>';
  }
  // Put the tray above or below the card, whichever has room; fall back to a compact tray if neither fits.
  function placeTray(cardRect, viewRect) {
    tray.style.maxHeight = ''; tray.classList.remove('compact');
    const need = tray.offsetHeight + TRAY_GAP, roomTop = cardRect.top - viewRect.top, roomBot = viewRect.bottom - cardRect.bottom;
    const above = roomTop >= need ? (roomBot >= need ? roomTop <= roomBot : true) : (roomBot >= need ? false : roomTop > roomBot);
    tray.classList.toggle('top', above); tray.classList.toggle('bot', !above);
    const room = (above ? roomTop : roomBot) - 20;
    if (need - TRAY_GAP > room) {
      tray.classList.add('compact');
      if (tray.offsetHeight > room) tray.style.maxHeight = Math.max(TRAY_MIN_HEIGHT, room) + 'px';
    }
  }
  function showTray(id) {
    clearTimeout(trayTimer);
    trayTimer = setTimeout(() => {
      if (!consOf(id).length) return;
      const viewRect = $('#view').getBoundingClientRect();
      tray.innerHTML = trayHtml(id, trayItems(id, viewRect));
      placeTray(els[id].getBoundingClientRect(), viewRect);
      tray.classList.add('show'); tray.setAttribute('aria-hidden', 'false');
    }, TRAY_DELAY_MS);
  }

  // ---------- details panel ----------
  const sourcesHtml = n => n.sources && n.sources.length
    ? block('accent', 'Sources Cited in the Book (to Fact-Check)',
      n.sources.map(s => extLink('srcl', s.u, `${plain(s.l)}<i class="${s.s === 'ok' ? '' : 'bl'}">${s.s === 'ok' ? 'Opens' : 'May Be Paywalled'}</i>`)).join('')
      + `<div class="hint fine">Addresses are exactly as cited in the book's endnotes. Every one was checked to exist; some publishers block automated access, so a few may ask you to log in.</div>`)
    : '';
  const connectionButton = (e, id) => {
    const o = other(e, id);
    return `<button class="con cat-${N[o].cat}" data-go="${o}">${arrow(e, id)} <b>${esc(N[o].name)}</b><span>${plain(e.label || '')}</span></button>`;
  };
  function showDetails(id) {
    const n = N[id], cons = consOf(id);
    sideEl.innerHTML = `<h2>${esc(n.name)}</h2><span class="cat cat-${n.cat}">${CAT[n.cat] || ''}</span>`
      + (n.sub.length ? `<div class="hint">${fmt(n.sub.join(' · '))}</div>` : '')
      + (n.wiki ? extLink('wl', n.wiki, 'Wikipedia article &#8599;') : '')
      + (rel[id] ? `<p><b>Link to Thiel:</b> ${fmt(rel[id])}</p>` : '')
      + facetHtml('panel', n)
      + sourcesHtml(n)
      + block('mute', `Connections (${cons.length})`, cons.map(e => connectionButton(e, id)).join(''));
    sideEl.scrollTop = 0;
  }

  // ---------- start up ----------
  const VERSION = new URL(document.currentScript.src).searchParams.get('v'); // single source of truth: the ?v= in index.html
  $('#ver').textContent = `v${VERSION}`;

  renderLegend();
  renderChips();
  renderStage();
  syncChips();

  const side = panelToggle({
    store: STORE.side, key: 'd', buttons: [$('#sideBtn'), $('#sideTab')],
    apply: open => {
      mainEl.classList.toggle('collapsed', !open);
      $('#sideTab').innerHTML = open ? '&#9656;' : '&#9666;';
      redrawPinned();
    },
  });
  panelToggle({
    store: STORE.legend, key: 'l', buttons: [$('#legendBtn'), $('#legendTab')],
    apply: open => { $('#legend').hidden = !open; $('#legendTab .chev').innerHTML = open ? '&#9652;' : '&#9662;'; },
  });

  // how-to-read dialog: native <dialog> gives Esc-to-close and focus handling; also close on backdrop click
  const help = $('#help');
  $('#helpBody').innerHTML = $('#howto').innerHTML;
  const openHelp = () => { if (!help.open) help.showModal(); };
  $('#helpBtn').addEventListener('click', openHelp);
  $('#helpClose').addEventListener('click', () => help.close());
  help.addEventListener('click', e => { if (e.target === help) help.close(); });

  // keyboard shortcuts (ignored while typing)
  Object.assign(keyActions, { '?': openHelp, escape: () => { hideTray(); if (pinned) clearSelection(); } });
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const act = keyActions[e.key.toLowerCase()];
    if (act) act();
  });

  // pointer and keyboard focus both preview a card
  const cardOf = e => e.target.closest('.card');
  [['mouseover', 'focusin', previewCard], ['mouseout', 'focusout', endPreview]].forEach(([pointerEvt, focusEvt, handler]) => {
    [pointerEvt, focusEvt].forEach(type => document.addEventListener(type, e => {
      const c = cardOf(e);
      if (c && !pinned) handler(c.dataset.id);
    }));
  });

  document.addEventListener('click', e => {
    const f = e.target.closest('[data-f]');
    if (f) { setFilter(f.dataset.f); return; }
    const go = e.target.closest('[data-go]');
    if (go) { pin(go.dataset.go); els[go.dataset.go].scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (e.target.closest('a')) return; // external links
    const c = cardOf(e);
    if (c) { pin(c.dataset.id); return; }
    if (!e.target.closest('aside,header,.bar') && pinned) clearSelection();
  });
  const searchBox = $('#q'), searchClear = $('#qClear');
  function setSearch(value) {
    term = value;
    searchBox.value = value;
    searchClear.hidden = !value;
    clearSelection();
  }
  searchBox.addEventListener('input', () => setSearch(searchBox.value));
  searchClear.addEventListener('click', () => { setSearch(''); searchBox.focus(); });
  // light/dark: an explicit choice (saved) overrides the operating-system setting
  const root = document.documentElement, themeSwitch = $('#theme'), systemDark = matchMedia('(prefers-color-scheme:dark)');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : systemDark.matches;
  const syncThemeSwitch = () => themeSwitch.setAttribute('aria-checked', isDark());
  const savedTheme = storage.get(STORE.theme);
  if (savedTheme === 'light' || savedTheme === 'dark') root.dataset.theme = savedTheme;
  syncThemeSwitch();
  systemDark.addEventListener('change', syncThemeSwitch);
  themeSwitch.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    storage.set(STORE.theme, root.dataset.theme);
    syncThemeSwitch();
  });
  addEventListener('resize', redrawPinned);
})();
