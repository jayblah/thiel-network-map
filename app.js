// Thiel network map behaviour. Content lives in data.js, styling in styles.css.
// To add a badge/detail type or a filter chip, add one entry to FACETS. Kinds of government reach live in GOV.
(() => {
  'use strict';
  const { nodes: N, edges: E, cats: CAT, sections: SECTIONS, facts: FACTS } = DATA;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

  // ---------- configuration ----------
  const HUB = 'T'; // id of the central node (Peter Thiel)
  const TRAY_DELAY_MS = 140;               // hover pause before the connection tray opens
  const TRAY_CAP = { hub: 12, other: 16 }; // max people listed in the tray
  const TRAY_GAP = 24;                     // breathing room needed around the tray
  const TRAY_FIT_SLACK = 20;               // extra room kept clear when deciding whether the tray fits
  const TRAY_MIN_HEIGHT = 110;
  const OFFSCREEN_MARGIN = 8;              // a card this close to the viewport edge counts as off-screen
  const BEND = { max: 120, ratio: .25 };   // how far connection lines curve
  const STORE = { side: 'thielSide', legend: 'thielLegend', theme: 'thielTheme' };
  const REPO = 'https://github.com/jayblah/thiel-network-map'; // where corrections are reported

  // Kinds of government reach, in display order; colour names map to .c-<colour> classes in styles.css.
  const GOV = [
    { key: 'official', color: 'gold', icon: 'official', pill: 'In Government', title: 'Holds or held a government role', reach: 'In Government' },
    { key: 'contractor', color: 'navy', icon: 'contractor', pill: 'Gov Contractor', title: 'Government contractor', reach: 'Government Contractors' },
    { key: 'influence', color: 'slate', icon: 'influence', pill: 'Gov Influence', title: 'Investor or lobbyist with government reach', reach: 'With Government Influence' },
    { key: 'abroad', color: 'teal', icon: 'abroad', pill: 'Abroad', title: 'Dealings with non-US governments', reach: 'Dealing with Other Governments' },
  ];
  const GOV_BY_KEY = Object.fromEntries(GOV.map(g => [g.key, g]));
  const govSpec = g => ({ label: g.pill, color: g.color, icon: g.icon, f: `gov:${g.key}`, title: g.title });

  // ---------- small helpers ----------
  const storage = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: ignore */ } },
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  const other = (e, id) => e.a === id ? e.b : e.a;
  const isHub = id => id === HUB;
  const arrow = (e, id) => e.kind === 'plain' ? '&harr;' : (e.a === id ? '&rarr;' : '&larr;');
  const countWhere = test => Object.values(N).filter(test).length;
  const extLink = (cls, href, label, attrs = '') => `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener" ${attrs}>${label}</a>`;

  // adjacency, built once: node id -> its edges
  const EDGES_OF = {};
  E.forEach(e => { (EDGES_OF[e.a] ||= []).push(e); (EDGES_OF[e.b] ||= []).push(e); });
  const consOf = id => EDGES_OF[id] || [];
  // how each node relates to the hub: the label of its first edge to or from it
  const rel = {};
  consOf(HUB).forEach(e => { const o = other(e, HUB); if (!(o in rel)) rel[o] = e.label; });

  // text formatting: escape, then optionally add Wikipedia links, then wrap money amounts
  const MONEY = /\$\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|thousand)|[KMB])?\+?/g;
  const ENT = DATA.ent || {};
  const ENTRE = new RegExp('(?<![A-Za-z0-9])(' + Object.keys(ENT).sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z0-9])', 'g');
  const link = s => s.replace(ENTRE, m => extLink('wk', ENT[m], m, `title="Wikipedia: ${m}"`));
  const money = s => s.replace(MONEY, m => `<span class="money">${m}</span>`);
  const fmt = s => money(link(esc(s)));         // body text: links + money
  const plain = s => money(esc(s));             // no links (source titles, facts, text inside buttons)
  const bold = s => s.replace(/\*([^*]+)\*/g, '<b>$1</b>');

  // ---------- icons, badges and detail blocks ----------
  // Line icons (24x24 grid, drawn with currentColor) shared by badges, panel headings, tray labels and chips.
  const ICON_PATHS = {
    views: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
    faith: '<path d="M12 3v18M6.5 9h11"/>',
    fund: '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.5c0-1-1.3-1.7-3-1.7s-3 .8-3 2 1.3 1.6 3 2 3 .8 3 2-1.3 2-3 2-3-.7-3-1.7"/>',
    crypto: '<circle cx="12" cy="12" r="9"/><path d="M10 7.5v9M10 7.5h3a2 2 0 0 1 0 4h-3M10 11.5h3.5a2.3 2.3 0 0 1 0 4.5H10M11.5 6v1.5M11.5 16.5V18"/>',
    cos: '<path d="M5 21V4h9v17M14 9h5v12M3 21h18M8 8h2M8 12h2M8 16h2"/>',
    contractor: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',
    official: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    influence: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8.5a5 5 0 0 1 0 7"/>',
    net: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="9" cy="18" r="2.5"/><path d="M8 7l8 1M7 8l2 8M17 10l-6 6"/>',
    abroad: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.2 3.5 14.8 0 18M12 3c-3.5 3.2-3.5 14.8 0 18"/>',
  };
  const icon = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;
  const iconed = (name, html) => (name ? icon(name) : '') + html;

  // A badge. With `f` a click filters the map. `compact` is the card form: icon only, with the words in the tooltip and
  // screen-reader label; it is clickable but not focusable (the legend badges are the keyboard route to the same filters).
  function pill(label, color, { icon: ic, f = '', title = '', compact = false } = {}) {
    const cls = `pill c-${color}${compact ? ' only' : ''}`, data = f ? ` data-f="${f}"` : '';
    if (compact) return `<span class="${cls}" role="img" aria-label="${esc(label)}" title="${esc(title || label)}"${data}>${iconed(ic, '')}</span>`;
    const tip = title ? ` title="${esc(title)}"` : '';
    return f ? `<button type="button" class="${cls}"${data}${tip}>${iconed(ic, esc(label))}</button>` : `<span class="${cls}"${tip}>${iconed(ic, esc(label))}</span>`;
  }
  const block = (color, head, body, ic) => `<div class="dsec c-${color}"><span class="h">${iconed(ic, head)}</span>${body}</div>`;
  // the tray is display-only (pointer-events: none), so its text carries no links
  const trayRow = (color, label, text, max, ic) => `<span class="d c-${color}"><em>${iconed(ic, label)}</em>${plain(cut(text, max))}</span>`;

  // Facets: one entry per kind of badge / detail block / filter chip. Fields:
  //   key + color + icon       identity (key is also the filter id and, by default, the node field it reads)
  //   label, desc              badge text and its legend description (no label: no badge, e.g. network states)
  //   has(n), text(n)          whether a node gets the badge/block, and the text shown (default: n[key])
  //   head                     details-panel heading (string or fn); no head: no panel block
  //   tray {label, max}        hover-tray row; no tray: none
  //   chip                     text of the filter chip; chipId/chipTest add a second filter (anti-democracy)
  //   filter(n)                what the filter matches (default: has)
  const facet = def => {
    const f = { has: n => n[def.key], text: n => n[def.key], ...def };
    if (f.label) {
      f.specs ||= [{ label: f.label, color: f.color, icon: f.icon, f: f.key, title: f.desc }];
      f.badges ||= n => f.has(n) ? f.specs : [];
    }
    return f;
  };
  const FACETS = [
    facet({ key: 'views', color: 'red', icon: 'views', label: 'Views', desc: 'Anti-democracy / exit views',
      has: n => n.anti || n.views, fallback: 'Flagged in the book as echoing these views',
      head: n => n.anti ? 'Anti-Democracy / Exit Views' : 'Views', tray: { label: 'Views' },
      chip: 'Anti-Democracy / Exit Views', chipId: 'anti', chipTest: n => n.anti }),
    facet({ key: 'faith', color: 'purple', icon: 'faith', label: 'Christian Nationalism', desc: 'Christian nationalist tie',
      head: 'Christian Nationalist Association', tray: { label: 'Christian Nationalism' },
      chip: 'Christian Nationalism', filter: n => n.faith || n.cat === 'faith' }),
    facet({ key: 'fund', color: 'green', icon: 'fund', label: 'Funding', desc: 'Thiel funding',
      head: 'Thiel Funding', tray: { label: 'Thiel $' }, chip: 'Funded by Thiel' }),
    facet({ key: 'cos', color: 'pink', icon: 'cos', label: 'Companies', desc: 'Companies listed',
      head: 'Companies / Projects', tray: { label: 'Companies', max: 90 } }),
    facet({ key: 'crypto', color: 'sky', icon: 'crypto', label: 'Crypto', desc: 'Crypto tie',
      head: 'Crypto', tray: { label: 'Crypto' }, chip: 'Crypto' }),
    facet({ key: 'net', color: 'net', icon: 'net', has: n => n.cat === 'net', chip: 'Network States' }),
    facet({ key: 'gov', color: 'navy', icon: 'official', label: 'Government Reach', has: n => n.gov, text: n => n.gov.text,
      specs: GOV.map(govSpec), badges: n => n.gov ? n.gov.kinds.map(k => govSpec(GOV_BY_KEY[k])) : [],
      head: 'Government Reach', lead: true, tray: { label: 'Gov', max: 120 }, chip: 'Government Reach' }),
  ];

  // Filters: "everyone", one per facet, the anti-democracy chip, and one per kind of government reach.
  const FILTERS = { all: { chip: 'Everyone', test: () => true } };
  FACETS.forEach(f => {
    const look = { color: f.color, icon: f.icon };
    FILTERS[f.key] = { test: f.filter || f.has, chip: f.chipId ? undefined : f.chip, ...look }; // with chipId, the chip filters on chipTest instead
    if (f.chipId) FILTERS[f.chipId] = { test: f.chipTest, chip: f.chip, ...look };
  });
  GOV.forEach(g => { FILTERS[`gov:${g.key}`] = { test: n => n.gov && n.gov.kinds.includes(g.key) }; });

  const facetHtml = {
    pills: n => FACETS.flatMap(f => f.badges ? f.badges(n) : []).map(s => pill(s.label, s.color, { icon: s.icon, f: s.f, title: s.title, compact: true })).join(''),
    panel: n => FACETS.filter(f => f.head && f.has(n)).map(f => {
      const lead = f.lead ? `<div>${f.badges(n).map(s => pill(s.label, s.color, { icon: s.icon, title: s.title })).join(' ')}</div>` : '';
      return block(f.color, typeof f.head === 'function' ? f.head(n) : f.head, `${lead}<div class="body">${fmt(f.text(n) || f.fallback)}</div>`, f.icon);
    }).join(''),
    tray: n => FACETS.filter(f => f.tray && f.has(n) && f.text(n)).map(f => trayRow(f.color, f.tray.label, f.text(n), f.tray.max || 110, f.icon)).join(''),
  };

  // ---------- state ----------
  const stage = $('#stage'), ov = $('#ov'), tray = $('#tray'), mainEl = $('main'), sideEl = $('#side');
  const els = {}; // node id -> card element
  let pinned = null, filt = 'all', term = '', trayTimer = null, resizeFrame = 0;
  let pathTo = null, pathAvoid = true, currentPath = null; // 'how is A connected to B' state
  const redrawPinned = () => paintSelection();

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
  // Arrowhead for each kind of connection: a filled triangle, an open line arrow, or none (plain = mutual).
  const HEAD = { strong: 'solid', normal: 'line', weak: 'solid', plain: null };
  const arrowPath = { solid: 'M0,0 L10,5 L0,10 z', line: 'M1.5,1 L8.5,5 L1.5,9' };
  // a small drawing of one connection style, for the legend
  const sampleLine = kind => `<svg class="ln" viewBox="0 0 40 10" aria-hidden="true"><path class="edge ${kind} cat-oth" d="M2,5 H${HEAD[kind] === 'solid' ? 33 : 38}"/>`
    + (HEAD[kind] ? `<g class="tip ${HEAD[kind]} cat-oth" transform="translate(30 0)"><path d="${arrowPath[HEAD[kind]]}"/></g>` : '') + '</svg>';
  function renderLegend() {
    const row = (title, items) => `<div class="lrow"><b>${title}</b>${items.join('')}</div>`;
    const lg = (mark, desc) => `<span class="lg">${mark}${desc}</span>`;
    $('#legend').innerHTML =
      row('Box Colour', SECTIONS.map(([k]) => lg(`<i class="sw cat-${k}"></i>`, `<span class="cat-${k} lg-cat">${CAT[k]}</span>`))) +
      row('Badges', FACETS.flatMap(f => f.specs || []).map(s => lg(pill(s.label, s.color, { icon: s.icon, f: s.f }), esc(s.title)))) +
      row('Marks', [
        lg('<i class="sw anti"></i>', 'Red dashed border: anti-democracy views'),
        lg('<i class="sw notch"></i>', 'Notched card: network state or startup city'),
        lg('<span class="wp static cat-center">W</span>', 'Wikipedia article for the card'),
        lg('<span class="wp static cat-center">&#8599;</span>', 'Link chosen for the card (article or interview)'),
        lg('<span class="wk">underlined</span>', 'Wikipedia link for a name in the text'),
        lg('<span class="money">$15M</span>', 'Money amount'),
      ]) +
      row('Lines', [
        lg(sampleLine('strong'), 'Close tie: founder, funder, mentor'),
        lg(sampleLine('normal'), 'Tie: influence, support or role'),
        lg(sampleLine('weak'), 'Looser or critical tie'),
        lg(sampleLine('plain'), 'Mutual or peer tie (no arrow)'),
        lg('', 'Arrows point from the one acting (influencing, funding, hiring, criticising) to the other'),
      ]);
  }
  function renderChips() {
    const chips = Object.entries(FILTERS).filter(([, f]) => f.chip)
      .map(([k, f]) => `<button class="btn chip${f.color ? ` tinted c-${f.color}` : ''}" data-f="${k}">${iconed(f.icon, f.chip)}</button>`).join('');
    $('#filters').insertAdjacentHTML('beforeend', chips + '<span id="count" class="count" aria-live="polite"></span>');
  }
  // everything that sets a filter (chips, badges, counts) shows which one is active
  const syncFilterButtons = () => $$('[data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === filt));

  // ---------- cards and sections ----------
  // the small round link in a card's corner (Wikipedia "W", or the card's own link)
  const cornerLink = (url, mark, title, cls = '') => extLink(`wp${cls}`, url, mark, `title="${esc(title)}" aria-label="${esc(title)} (opens in a new tab)"`);
  function card(n, { cls = '', lines = '', tail = '' } = {}) {
    const flags = [n.anti && 'anti', n.cat === 'net' && 'net', cls].filter(Boolean).join(' ');
    const pills = facetHtml.pills(n);
    return `<div class="card cat-${n.cat} ${flags}" data-id="${esc(n.id)}">`
      + `<button type="button" class="n">${esc(n.name)}</button>`
      + (n.sub.length ? `<div class="s">${fmt(n.sub.join(' · '))}</div>` : '')
      + (rel[n.id] ? `<div class="r">${fmt(rel[n.id])}</div>` : '')
      + lines
      + (pills ? `<div class="pills">${pills}</div>` : '')
      + (n.wiki ? cornerLink(n.wiki, 'W', `Wikipedia article: ${n.name}`) : '')
      + (n.link ? cornerLink(n.link.u, '&#8599;', n.link.l, n.wiki ? ' alt' : '') : '')
      + tail + '</div>';
  }
  const stat = (g, count) => `<button class="stat c-${g.color}" data-f="gov:${g.key}">${icon(g.icon)}<b>${count}</b>${g.reach}</button>`;

  function renderStage() {
    const reach = `<section class="reach"><h2>Reach Into Government</h2><div class="row">`
      + GOV.map(g => stat(g, countWhere(FILTERS[`gov:${g.key}`].test))).join('')
      + `</div><div class="facts">${FACTS.map(f => `<span>${bold(plain(f))}</span>`).join('')}</div></section>`;
    const hub = N[HUB];
    const hubLines = [hub.cos, hub.faith].filter(Boolean).map(t => `<div class="r">${fmt(t)}</div>`).join('');
    const sections = SECTIONS.map(([k, span]) => {
      const ns = Object.values(N).filter(n => n.cat === k);
      return ns.length ? `<section class="sec cat-${k}" style="--span:${span}"><h2>${CAT[k]}</h2><div class="grid">${ns.map(n => card(n)).join('')}</div></section>` : '';
    }).join('');
    stage.insertAdjacentHTML('afterbegin', card(hub, { cls: 'hero', lines: hubLines, tail: reach }) + sections);
    $$('.card').forEach(c => { els[c.dataset.id] = c; });
  }

  // ---------- connection lines ----------
  // Each line is a quadratic curve between two cards' centres, trimmed so it starts and ends on the cards' borders.
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const inside = (r, [x, y]) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
  // Binary-search the parameter where the curve crosses a card's border. `from` is the t known to be inside the card
  // and `to` a t outside it; returns the t nearest the border on the outside.
  function crossing(point, rect, from, to) {
    for (let i = 0; i < 18; i++) {
      const mid = (from + to) / 2;
      if (inside(rect, point(mid))) from = mid; else to = mid;
    }
    return to;
  }
  function edgeSvg(e, i, boxOf) {
    const cat = N[e.a].cat, ra = boxOf(e.a), rb = boxOf(e.b);
    const A = [ra.x + ra.w / 2, ra.y + ra.h / 2], B = [rb.x + rb.w / 2, rb.y + rb.h / 2];
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(BEND.max, len * BEND.ratio) * (i % 2 ? 1 : -1); // alternate curve direction so parallel lines don't overlap
    const C = [(A[0] + B[0]) / 2 - dy / len * bend, (A[1] + B[1]) / 2 + dx / len * bend];
    const point = t => lerp(lerp(A, C, t), lerp(C, B, t), t);
    // keep only the part of the curve between the two borders (the whole curve if the cards overlap)
    let t0 = crossing(point, ra, 0, 1), t1 = 1 - crossing(t => point(1 - t), rb, 0, 1); // searched over the whole curve: the Thiel card is big enough to hold its midpoint
    if (t0 >= t1) { t0 = 0; t1 = 1; }
    const P0 = point(t0), P2 = point(t1);
    const P1 = lerp(P0, lerp(C, B, t0), (t1 - t0) / (1 - t0)); // control point of the trimmed segment
    const marker = HEAD[e.kind] ? ` marker-end="url(#${HEAD[e.kind]}-${cat})"` : '';
    return `<path class="edge ${e.kind} cat-${cat}" d="M${P0[0]},${P0[1]} Q${P1[0]},${P1[1]} ${P2[0]},${P2[1]}"${marker}/>`;
  }
  const draw = id => drawEdges(consOf(id).filter(e => els[other(e, id)]));
  function drawEdges(list) {
    ov.setAttribute('width', stage.scrollWidth);
    ov.setAttribute('height', stage.scrollHeight);
    // read every position first (one stage rect, one rect per card), then build the markup
    const origin = stage.getBoundingClientRect(), boxes = {};
    const boxOf = nid => boxes[nid] ||= (r => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }))(els[nid].getBoundingClientRect());
    const paths = list.map((e, i) => edgeSvg(e, i, boxOf));
    const heads = [...new Set(list.map(e => HEAD[e.kind] && `${HEAD[e.kind]}-${N[e.a].cat}`).filter(Boolean))];
    const markers = heads.map(id => {
      const [head, cat] = id.split('-');
      return `<marker id="${id}" class="cat-${cat} ${head}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="${arrowPath[head]}"/></marker>`;
    }).join('');
    ov.innerHTML = `<defs>${markers}</defs>${paths.join('')}`;
  }

  // ---------- dimming, filtering, pinning ----------
  // The hub never dims: the government counts inside its card are controls and must stay readable.
  const setDim = show => Object.entries(els).forEach(([id, el]) => el.classList.toggle('dim', !!show && !show.has(id) && !isHub(id)));
  function neighbours(id) { const s = new Set([id]); consOf(id).forEach(e => s.add(other(e, id))); return s; }
  // everything a search can match on a card, including its connection labels and badge names
  const haystack = n => [n.name, n.cos, n.views, n.faith, n.fund, n.crypto, n.gov && n.gov.text, n.sub.join(' '), rel[n.id] || '',
    ...consOf(n.id).map(e => e.label), ...FACETS.flatMap(f => f.badges ? f.badges(n).map(s => s.label) : [])].join(' ').toLowerCase();
  const TOTAL = Object.keys(N).length;
  const showCount = k => { $('#count').textContent = k === null ? '' : (k ? `${k} of ${TOTAL} shown` : 'No matches'); };
  function applyFilter() {
    if (pinned) return;
    const t = term.trim().toLowerCase();
    if (filt === 'all' && !t) { setDim(null); showCount(null); return; }
    const hits = Object.values(N).filter(n => FILTERS[filt].test(n) && (!t || haystack(n).includes(t))).map(n => n.id);
    setDim(new Set(hits));
    showCount(hits.length);
  }
  const reset = () => { ov.innerHTML = ''; applyFilter(); };
  function unpin() {
    pinned = pathTo = currentPath = null;
    $$('.card.sel').forEach(c => { c.classList.remove('sel'); c.querySelector('.n').removeAttribute('aria-pressed'); });
  }
  function clearSelection() { unpin(); reset(); syncUrl(); }
  function setFilter(k) { filt = k; syncFilterButtons(); clearSelection(); }
  const toggleFilter = k => setFilter(filt === k && k !== 'all' ? 'all' : k); // clicking the active filter again clears it
  function pin(id) {
    hideTray();
    if (!side.isOpen()) side.set(true, true);
    unpin();
    pinned = id;
    els[id].classList.add('sel');
    els[id].querySelector('.n').setAttribute('aria-pressed', 'true');
    showCount(null);
    paintSelection();
    showDetails(id);
    syncUrl();
  }
  // Spotlight what is selected: the chosen path between two cards, or one card's connections.
  function paintSelection() {
    if (!pinned) return;
    if (currentPath) { setDim(new Set(currentPath.nodes)); drawEdges(currentPath.edges); return; }
    setDim(neighbours(pinned));
    draw(pinned);
  }
  // hover or keyboard focus on a card: spotlight it and open the tray (unless something is pinned)
  function previewCard(id) { setDim(neighbours(id)); showCount(null); draw(id); showTray(id); }
  function endPreview() { reset(); hideTray(); }

  // ---------- how is A connected to B ----------
  // Breadth-first search over the connections, ignoring their direction; optionally refusing to route through the hub.
  function findPath(from, to, avoidHub) {
    const prev = { [from]: null }, queue = [from];
    for (let i = 0; i < queue.length && !(to in prev); i++) {
      for (const e of consOf(queue[i])) {
        const o = other(e, queue[i]);
        if (o in prev || (avoidHub && isHub(o) && o !== to)) continue;
        prev[o] = { id: queue[i], e };
        queue.push(o);
      }
    }
    if (!(to in prev)) return null;
    const nodes = [to], edges = [];
    for (let id = to; prev[id]; id = prev[id].id) { nodes.unshift(prev[id].id); edges.unshift(prev[id].e); }
    return { nodes, edges };
  }
  const pathsFor = (a, b) => ({ any: findPath(a, b, false), avoid: isHub(a) || isHub(b) ? null : findPath(a, b, true) });
  function computePath() {
    currentPath = null;
    if (!pinned || !pathTo) return;
    const { any, avoid } = pathsFor(pinned, pathTo);
    currentPath = (pathAvoid && avoid) || any;
  }
  function renderPath() {
    const box = $('#pathResult');
    if (!box) return;
    if (!currentPath) { box.innerHTML = pathTo ? '<p class="hint">No connection found.</p>' : ''; return; }
    const { any, avoid } = pathsFor(pinned, pathTo);
    const steps = n => `${n} step${n === 1 ? '' : 's'}`;
    const viaHub = any.nodes.slice(1, -1).includes(HUB);
    const choice = (via, text, on) => `<button class="btn${on ? ' on' : ''}" data-via="${via}">${text}</button>`;
    const choices = avoid && viaHub
      ? `<div class="via">${choice('avoid', `Without Thiel · ${steps(avoid.edges.length)}`, pathAvoid)}${choice('any', `Shortest · ${steps(any.edges.length)}, via Thiel`, !pathAvoid)}</div>`
      : (viaHub ? '<p class="hint">Every route between them runs through Thiel.</p>' : '');
    const hop = (e, from) => `<div class="hop">${arrow(e, from)} ${plain(e.label || 'connected')}</div>`;
    const list = currentPath.nodes.map((id, i) =>
      `<button class="btn con cat-${N[id].cat}" data-go="${esc(id)}"><b>${esc(N[id].name)}</b></button>` + (i < currentPath.edges.length ? hop(currentPath.edges[i], id) : '')).join('');
    box.innerHTML = `${choices}<p class="hint">${steps(currentPath.edges.length)}</p>${list}`;
  }
  function setPath(to) {
    pathTo = to || null;
    computePath();
    paintSelection();
    renderPath();
    const sel = $('#pathSel');
    if (sel) sel.value = pathTo || '';
    syncUrl();
  }
  const pathBox = n => `<div class="dsec c-accent"><span class="h">How is ${esc(n.name)} connected to…</span>`
    + `<select id="pathSel" aria-label="Find the connection to another card"><option value="">Choose a card</option>`
    + Object.values(N).filter(x => x.id !== n.id).sort((x, y) => x.name.localeCompare(y.name)).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')
    + `</select><div id="pathResult"></div></div>`;

  // ---------- the address bar mirrors the view, so any view can be shared ----------
  function syncUrl() {
    const p = new URLSearchParams();
    if (pinned) p.set('card', pinned);
    if (pathTo) { p.set('to', pathTo); if (!pathAvoid) p.set('via', 'any'); }
    if (filt !== 'all') p.set('filter', filt);
    if (term.trim()) p.set('q', term.trim());
    const h = p.toString();
    history.replaceState(null, '', location.pathname + location.search + (h ? '#' + h : ''));
  }
  function applyHash() {
    const p = new URLSearchParams(location.hash.slice(1)), card = p.get('card'), to = p.get('to');
    filt = FILTERS[p.get('filter')] ? p.get('filter') : 'all';
    term = p.get('q') || '';
    searchBox.value = term;
    searchClear.hidden = !term;
    pathAvoid = p.get('via') !== 'any';
    syncFilterButtons();
    clearSelection();
    if (card && els[card]) { pin(card); if (to && els[to] && to !== card) setPath(to); }
  }

  // ---------- hover tray ----------
  function hideTray() { clearTimeout(trayTimer); tray.classList.remove('show'); tray.setAttribute('aria-hidden', 'true'); }
  function trayItems(id, viewRect) {
    const position = r => r.bottom < viewRect.top + OFFSCREEN_MARGIN ? 'up' : (r.top > viewRect.bottom - OFFSCREEN_MARGIN ? 'down' : '');
    return consOf(id).map(e => { const o = other(e, id); return { o, e, p: els[o] ? position(els[o].getBoundingClientRect()) : '' }; })
      .sort((x, y) => (!!y.p) - (!!x.p)); // off-screen people first
  }
  function trayHtml(id, items) {
    const cap = isHub(id) ? TRAY_CAP.hub : TRAY_CAP.other, offscreen = items.filter(i => i.p).length;
    const person = ({ o, e, p }) => `<div class="chip2 cat-${N[o].cat}">`
      + (p ? `<i>${p === 'up' ? '&uarr; Above' : '&darr; Below'}</i>` : '')
      + `<b>${esc(N[o].name)}</b>`
      + (N[o].sub.length ? `<span class="sb">${plain(N[o].sub.join(' · '))}</span>` : '')
      + `<span class="rl">${arrow(e, id)} ${plain(e.label || 'connected')}</span>${facetHtml.tray(N[o])}</div>`;
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
    const room = (above ? roomTop : roomBot) - TRAY_FIT_SLACK;
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
    return `<button class="btn con cat-${N[o].cat}" data-go="${esc(o)}">${arrow(e, id)} <b>${esc(N[o].name)}</b><span>${plain(e.label || '')}</span></button>`;
  };
  function showDetails(id) {
    const n = N[id], cons = consOf(id);
    sideEl.innerHTML = `<h2>${esc(n.name)}</h2><span class="cat cat-${n.cat}">${CAT[n.cat] || ''}</span>`
      + (n.sub.length ? `<div class="hint">${fmt(n.sub.join(' · '))}</div>` : '')
      + (n.link ? extLink('wl', n.link.u, `${esc(n.link.l)} &#8599;`) : '')
      + (n.wiki ? extLink('wl', n.wiki, 'Wikipedia article &#8599;') : '')
      + (rel[id] ? `<p><b>Link to Thiel:</b> ${fmt(rel[id])}</p>` : '')
      + facetHtml.panel(n)
      + sourcesHtml(n)
      + pathBox(n)
      + block('mute', `Connections (${cons.length})`, cons.map(e => connectionButton(e, id)).join(''))
      + extLink('wl', `${REPO}/issues/new?title=${encodeURIComponent('Correction: ' + n.name)}`, 'Report a correction for this card &#8599;');
    sideEl.scrollTop = 0;
  }

  // ---------- start up ----------
  const VERSION = new URL(document.currentScript.src).searchParams.get('v'); // single source of truth: the ?v= in index.html
  $('#ver').textContent = `v${VERSION}`;

  renderLegend();
  renderChips();
  renderStage();
  syncFilterButtons();

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
  Object.assign(keyActions, { '?': openHelp, '/': () => { searchBox.focus(); searchBox.select(); }, escape: () => { hideTray(); if (pinned) clearSelection(); } });
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const act = keyActions[e.key.toLowerCase()];
    if (act) { e.preventDefault(); act(); }
  });

  // Pointer and keyboard focus both preview a card. These events also fire when moving between a card's own children,
  // so act only when the pointer or focus actually enters or leaves a card.
  const cardOf = node => node && node.closest ? node.closest('.card') : null;
  [['mouseover', 'focusin', previewCard, 'enter'], ['mouseout', 'focusout', endPreview, 'leave']].forEach(([pointerEvt, focusEvt, handler]) => {
    [pointerEvt, focusEvt].forEach(type => document.addEventListener(type, e => {
      const c = cardOf(e.target);
      if (c && !pinned && c !== cardOf(e.relatedTarget)) handler(c.dataset.id);
    }));
  });

  document.addEventListener('change', e => { if (e.target.id === 'pathSel') setPath(e.target.value); });
  document.addEventListener('click', e => {
    const via = e.target.closest('[data-via]');
    if (via) { pathAvoid = via.dataset.via === 'avoid'; computePath(); paintSelection(); renderPath(); syncUrl(); return; }
    const f = e.target.closest('[data-f]');
    if (f) { toggleFilter(f.dataset.f); return; }
    const go = e.target.closest('[data-go]');
    if (go) { pin(go.dataset.go); els[go.dataset.go].scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    if (e.target.closest('a')) return; // external links
    const c = cardOf(e.target);
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
  addEventListener('resize', () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(redrawPinned); });

  $('#report').href = `${REPO}/issues/new`;
  addEventListener('hashchange', applyHash);
  applyHash(); // open the view named in the address, if any
})();
