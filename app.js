// Thiel network map behaviour. Content lives in data.js, styling in styles.css.
// To add a badge/detail type, add one entry to FACETS; to add a filter, add one entry to FILTERS.
'use strict';
const N = DATA.nodes, E = DATA.edges, CAT = DATA.cats;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

// ---------- configuration ----------
// Category sections in display order; span = grid columns (of 12) on wide screens.
const SECTIONS = [['infl', 5], ['pp', 7], ['neo', 12], ['pol', 12], ['prot', 12], ['faith', 12], ['net', 12], ['oth', 12]];

// Kinds of government reach; color names map to .c-<color> classes in styles.css.
const GOV = {
  contractor: { color: 'navy', pill: 'gov contractor', title: 'Government contractor', reach: 'government contractors' },
  official: { color: 'gold', pill: '&#9733; in government', title: 'Holds or held a government role', reach: 'in government' },
  influence: { color: 'slate', pill: 'gov influence', title: 'Investor or lobbyist with government reach', reach: 'with government influence' },
  abroad: { color: 'teal', pill: 'abroad', title: 'Dealings with non-US governments', reach: 'dealing with other governments' },
};
const REACH_ORDER = ['official', 'contractor', 'influence', 'abroad'];

// Filters. `chip` ones become buttons in the bar; the rest are triggered from summary counts.
const FILTERS = {
  all: { chip: 'Everyone', test: () => true },
  anti: { chip: 'Anti-democracy / exit views', test: n => n.anti },
  faith: { chip: 'Christian Nationalism', test: n => n.faith || n.cat === 'faith' },
  fund: { chip: 'Funded by Thiel', test: n => n.fund },
  net: { chip: 'Network states', test: n => n.cat === 'net' },
  gov: { chip: 'Government reach', test: n => n.gov },
  flag: { chip: '&#9888; White supremacist associations', test: n => n.assoc },
  ...Object.fromEntries(Object.keys(GOV).map(k => [`gov:${k}`, { test: n => n.gov && n.gov.kinds.includes(k) }])),
};

// ---------- small helpers ----------
const storage = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: ignore */ } },
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const arrow = (e, id) => e.kind === 'plain' ? '&harr;' : (e.a === id ? '&rarr;' : '&larr;');
const other = (e, id) => e.a === id ? e.b : e.a;
const consOf = id => E.filter(e => e.a === id || e.b === id);

// text formatting: escape, then optionally add Wikipedia links, then wrap money amounts
const MONEY = /\$\d[\d,]*(?:\.\d+)?(?:\s?(?:billion|million|thousand)|[KMB])?\+?/g;
const ENT = DATA.ent || {};
const ENTRE = new RegExp('(?<![A-Za-z0-9])(' + Object.keys(ENT).sort((a, b) => b.length - a.length)
  .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![A-Za-z0-9])', 'g');
const link = s => s.replace(ENTRE, m => `<a class="wk" href="${ENT[m]}" target="_blank" rel="noopener" title="Wikipedia: ${m}">${m}</a>`);
const money = (s, tag = 'span') => s.replace(MONEY, m => `<${tag} class="money">${m}</${tag}>`);
const fmt = s => money(link(esc(s)));            // body text: links + money
const plain = s => money(esc(s));                // no links (source titles, facts)
const svgText = s => money(esc(s), 'tspan');     // inside SVG <text>
const bold = s => s.replace(/\*([^*]+)\*/g, '<b>$1</b>');

// ---------- facets: one entry per kind of badge / detail block ----------
// pills(n) -> card badges; panel(n) -> details-panel block; tray(n) -> hover-tray row; legend -> [[[pill text, color], description], ...]
const pill = (text, color, title = '') => `<span class="pill c-${color}"${title ? ` title="${title}"` : ''}>${text}</span>`;
const block = (color, head, body, cls = '') => `<div class="dsec c-${color} ${cls}"><span class="h">${head}</span>${body}</div>`;
const trayRow = (color, label, text, max) => `<span class="d c-${color}"><em>${label}</em>${fmt(cut(text, max))}</span>`;

const FACETS = [
  { legend: [[['views', 'red'], 'anti-democracy / exit views']],
    pills: n => n.anti || n.views ? pill('views', 'red') : '',
    panel: n => n.anti ? block('red', 'Anti-democracy / exit views', fmt(n.views || 'Flagged in the book as echoing these views'))
      : n.views ? block('red', 'Views', fmt(n.views)) : '',
    tray: n => n.views ? trayRow('red', 'Views', n.views, 110) : '' },
  { legend: [[['&#10013; faith', 'purple'], 'Christian tie']],
    pills: n => n.faith ? pill('&#10013; faith', 'purple') : '',
    panel: n => n.faith ? block('purple', '&#10013; Christian association', fmt(n.faith)) : '',
    tray: n => n.faith ? trayRow('purple', '&#10013; Faith', n.faith, 110) : '' },
  { legend: [[['$ funding', 'green'], 'Thiel funding']],
    pills: n => n.fund ? pill('$ funding', 'green') : '',
    panel: n => n.fund ? block('green', 'Thiel funding', fmt(n.fund)) : '',
    tray: n => n.fund ? trayRow('green', 'Thiel $', n.fund, 110) : '' },
  { legend: [[['companies', 'blue'], 'companies listed']],
    pills: n => n.cos && n.cat !== 'net' ? pill('companies', 'blue') : '',
    panel: n => n.cos ? block('blue', 'Companies / projects', fmt(n.cos)) : '',
    tray: n => n.cos && n.cat !== 'net' ? trayRow('blue', 'Companies', n.cos, 90) : '' },
  { legend: Object.values(GOV).map(g => [[g.pill, g.color], g.title]),
    pills: n => n.gov ? n.gov.kinds.map(k => pill(GOV[k].pill, GOV[k].color)).join('') : '',
    panel: n => n.gov ? block('navy', 'Government reach',
      `<div>${n.gov.kinds.map(k => pill(GOV[k].pill, GOV[k].color, GOV[k].title)).join(' ')}</div><div class="body">${fmt(n.gov.text)}</div>`) : '',
    tray: n => n.gov ? trayRow('navy', 'Gov', n.gov.text, 120) : '' },
  { legend: [[['&#9888; white supremacist association', 'warn'], 'Documented speeches, writings or statements']],
    pills: n => n.assoc ? pill('&#9888; white supremacist association', 'warn') : '',
    panel: n => n.assoc ? block('warn', 'Associations noted in the book', `<div class="body">${fmt(n.assoc)}</div>`, 'tint') : '',
    tray: n => n.assoc ? trayRow('warn', '&#9888; Flagged', 'white supremacist association (see details)', 120) : '' },
];
const facetHtml = (kind, n) => FACETS.map(f => f[kind](n)).join('');

// ---------- state ----------
const rel = {};
E.forEach(e => {
  if (e.a === 'T' && !rel[e.b]) rel[e.b] = e.label;
  if (e.b === 'T' && !rel[e.a]) rel[e.a] = e.label;
});
const stage = $('#stage'), ov = $('#ov'), tray = $('#tray'), mainEl = $('main');
let pinned = null, filt = 'all', term = '', trayTimer = null;

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
  buttons.forEach(b => b.onclick = () => set(!open));
  keyActions[key] = () => set(!open);
  set(storage.get(store) !== '0', true);
  return { isOpen: () => open, set };
}
addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  const act = keyActions[e.key.toLowerCase()];
  if (act) act();
});

// ---------- legend and filter chips ----------
function renderLegend() {
  const row = (title, items) => `<div class="lrow"><b>${title}</b>${items.join('')}</div>`;
  const lg = (mark, desc) => `<span class="lg">${mark}${desc}</span>`;
  $('#legend').innerHTML =
    row('Box colour', SECTIONS.map(([k]) => lg(`<i class="sw cat-${k}"></i>`, `<span class="cat-${k}" style="color:var(--t);font-weight:600">${CAT[k]}</span>`))) +
    row('Badges', FACETS.flatMap(f => f.legend.map(([p, d]) => lg(pill(...p), d)))) +
    row('Marks', [
      lg('<i class="sw anti"></i>', 'red dashed border: anti-democracy views'),
      lg('<i class="sw notch"></i>', 'notched card: network state or startup city'),
      lg('<b class="t-purple">&#10013;</b>', 'Christian tie (card corner)'),
      lg('<a class="wp static cat-center" href="#">W</a>', 'Wikipedia article for the card'),
      lg('<span class="wk">underlined</span>', 'Wikipedia link for a name in the text'),
      lg('<span class="money">$15M</span>', 'money amount'),
    ]);
}
function renderChips() {
  const chips = Object.entries(FILTERS).filter(([, f]) => f.chip)
    .map(([k, f]) => `<button class="chip" data-f="${k}">${f.chip}</button>`).join('');
  $('#filters').insertAdjacentHTML('beforeend', chips);
}
function syncChips() { $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.f === filt)); }

// ---------- cards and sections ----------
function card(n, extra = '') {
  const flags = [n.anti && 'anti', n.faith && 'faith', n.cat === 'net' && 'net', extra].filter(Boolean).join(' ');
  const pills = facetHtml('pills', n);
  return `<div class="card cat-${n.cat} ${flags}" data-id="${n.id}">`
    + `<div class="n">${esc(n.name)}</div>`
    + (n.sub.length ? `<div class="s">${fmt(n.sub.join(' · '))}</div>` : '')
    + (rel[n.id] && n.id !== 'T' ? `<div class="r">${fmt(rel[n.id])}</div>` : '')
    + (n.id === 'T' ? `<div class="r">${fmt(n.cos)}</div><div class="r">${fmt(n.faith)}</div>` : '')
    + (pills ? `<div class="pills">${pills}</div>` : '')
    + (n.wiki ? `<a class="wp" href="${n.wiki}" target="_blank" rel="noopener" title="Open Wikipedia article">W</a>` : '')
    + '</div>';
}
const countWhere = test => Object.values(N).filter(test).length;
const stat = (filter, color, count, label) => `<button class="stat c-${color}" data-f="${filter}"><b>${count}</b>${label}</button>`;

function renderStage() {
  const T = N.T;
  const reach = `<section class="band c-navy"><h3>Reach into government</h3><div class="row">`
    + REACH_ORDER.map(k => stat(`gov:${k}`, GOV[k].color, countWhere(FILTERS[`gov:${k}`].test), GOV[k].reach)).join('')
    + `</div><div class="facts">${DATA.facts.map(f => `<span>${bold(plain(f))}</span>`).join('')}</div></section>`;
  const flags = `<section class="band dashed c-warn"><h3>&#9888; White supremacist associations</h3><div class="row">`
    + stat('flag', 'warn', countWhere(FILTERS.flag.test), 'people with documented associations')
    + `</div><div class="note">Listed only where <i>The Nerd Reich</i> points to specific speeches, writings or statements. These are the book's characterizations, not independent findings, and some people named have disputed them.</div></section>`;
  const sections = SECTIONS.map(([k, span]) => {
    const ns = Object.values(N).filter(n => n.cat === k);
    return ns.length ? `<section class="sec cat-${k}" style="grid-column:span ${span}"><h3>${CAT[k]}</h3><div class="grid">${ns.map(n => card(n)).join('')}</div></section>` : '';
  }).join('');
  stage.insertAdjacentHTML('afterbegin',
    `<div class="hero-wrap">${card(T, 'hero')}<div class="hero-note">${$('#howto').innerHTML}</div></div>` + reach + flags + sections);
}

// ---------- connection lines ----------
const els = {};
function relBox(el) {
  const a = el.getBoundingClientRect(), b = stage.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height };
}
function draw(id, withLabels) {
  ov.setAttribute('width', stage.scrollWidth);
  ov.setAttribute('height', stage.scrollHeight);
  const cats = new Set();
  let s = '';
  consOf(id).forEach((e, i) => {
    if (!els[other(e, id)]) return;
    const A = relBox(els[e.a]), B = relBox(els[e.b]), cat = N[e.a].cat;
    const ca = [A.x + A.w / 2, A.y + A.h / 2], cb = [B.x + B.w / 2, B.y + B.h / 2];
    const dx = cb[0] - ca[0], dy = cb[1] - ca[1], len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(120, len * .25) * (i % 2 ? 1 : -1);
    const cx = (ca[0] + cb[0]) / 2 - dy / len * bend, cy = (ca[1] + cb[1]) / 2 + dx / len * bend;
    cats.add(cat);
    s += `<path class="edge ${e.kind} cat-${cat}" d="M${ca[0]},${ca[1]} Q${cx},${cy} ${cb[0]},${cb[1]}"${e.kind === 'plain' ? '' : ` marker-end="url(#ah-${cat})"`}/>`;
    if (withLabels && e.label) {
      const tx = .25 * ca[0] + .5 * cx + .25 * cb[0], ty = .25 * ca[1] + .5 * cy + .25 * cb[1];
      s += `<text class="lbl cat-${cat}" x="${tx}" y="${ty}" text-anchor="middle">${svgText(cut(e.label, 46))}</text>`;
    }
  });
  const defs = [...cats].map(c => `<marker id="ah-${c}" class="cat-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>`).join('');
  ov.innerHTML = `<defs>${defs}</defs>${s}`;
}
const clearLines = () => { ov.innerHTML = ''; };

// ---------- dimming, filtering, hover and pin ----------
function setDim(show) { Object.entries(els).forEach(([id, e]) => e.classList.toggle('dim', !!show && !show.has(id))); }
function neighbours(id) { const s = new Set([id]); consOf(id).forEach(e => s.add(other(e, id))); return s; }
function focus(id, pin) { setDim(neighbours(id)); draw(id, pin && id !== 'T'); }
function applyFilter() {
  if (pinned) return;
  const t = term.trim().toLowerCase();
  if (filt === 'all' && !t) { setDim(null); return; }
  const haystack = n => [n.name, n.cos, n.views, n.faith, n.fund, n.sub.join(' '), rel[n.id] || ''].join(' ').toLowerCase();
  setDim(new Set(Object.values(N).filter(n => FILTERS[filt].test(n) && (!t || haystack(n).includes(t))).map(n => n.id)));
}
function reset() { clearLines(); applyFilter(); }
function unpin() { pinned = null; $$('.card.sel').forEach(x => x.classList.remove('sel')); }
function setFilter(k) { filt = k; syncChips(); unpin(); clearLines(); applyFilter(); }

function hideTray() { clearTimeout(trayTimer); tray.classList.remove('show'); tray.setAttribute('aria-hidden', 'true'); }
function showTray(id) {
  clearTimeout(trayTimer);
  trayTimer = setTimeout(() => {
    const cons = consOf(id);
    if (!cons.length) return;
    const vr = $('#view').getBoundingClientRect(), cr = els[id].getBoundingClientRect();
    const pos = r => r.bottom < vr.top + 8 ? 'up' : (r.top > vr.bottom - 8 ? 'down' : '');
    const items = cons.map(e => { const o = other(e, id); return { o, e, p: els[o] ? pos(els[o].getBoundingClientRect()) : '' }; })
      .sort((x, y) => (!!y.p) - (!!x.p));
    const offscreen = items.filter(i => i.p).length, cap = id === 'T' ? 12 : 16;
    tray.innerHTML = `<div class="th">Connected to <b>${esc(N[id].name)}</b> &middot; ${cons.length}${offscreen ? ` &middot; ${offscreen} off-screen shown first` : ''}</div><div class="chips">`
      + items.slice(0, cap).map(({ o, e, p }) => `<div class="chip2 cat-${N[o].cat}">`
        + (p ? `<i>${p === 'up' ? '&uarr; above' : '&darr; below'}</i>` : '')
        + `<b>${esc(N[o].name)}</b>`
        + (N[o].sub.length ? `<span class="sb">${fmt(N[o].sub.join(' · '))}</span>` : '')
        + `<span class="rl">${arrow(e, id)} ${fmt(e.label || 'connected')}</span>${facetHtml('tray', N[o])}</div>`).join('')
      + (items.length > cap ? `<div class="chip2"><span>+${items.length - cap} more (click the card to see all in the side panel)</span></div>` : '')
      + '</div>';
    // place above or below the card, whichever has room; shrink to compact if neither fits
    tray.style.maxHeight = ''; tray.classList.remove('compact');
    const need = tray.offsetHeight + 24, roomTop = cr.top - vr.top, roomBot = vr.bottom - cr.bottom;
    const top = roomTop >= need ? (roomBot >= need ? roomTop <= roomBot : true) : (roomBot >= need ? false : roomTop > roomBot);
    tray.classList.toggle('top', top); tray.classList.toggle('bot', !top);
    const room = (top ? roomTop : roomBot) - 20;
    if (need - 24 > room) {
      tray.classList.add('compact');
      if (tray.offsetHeight > room) tray.style.maxHeight = Math.max(110, room) + 'px';
    }
    tray.classList.add('show'); tray.setAttribute('aria-hidden', 'false');
  }, 140);
}

// ---------- details panel ----------
const sourcesHtml = n => n.sources && n.sources.length
  ? block('accent', 'Sources cited in the book (to fact-check)',
    n.sources.map(s => `<a class="srcl" href="${s.u}" target="_blank" rel="noopener">${plain(s.l)}<i class="${s.s === 'ok' ? '' : 'bl'}">${s.s === 'ok' ? 'opens' : 'may be paywalled'}</i></a>`).join('')
    + `<div class="hint fine">Addresses are exactly as cited in the book's endnotes. Every one was checked to exist; some publishers block automated access, so a few may ask you to log in.</div>`)
  : '';
function show(id) {
  const n = N[id], cons = consOf(id);
  $('#side').innerHTML = `<h2>${esc(n.name)}</h2><span class="cat cat-${n.cat}">${CAT[n.cat] || ''}</span>`
    + (n.sub.length ? `<div class="hint">${fmt(n.sub.join(' · '))}</div>` : '')
    + (n.wiki ? `<a class="wl" href="${n.wiki}" target="_blank" rel="noopener">Wikipedia article &#8599;</a>` : '')
    + (rel[id] && id !== 'T' ? `<p><b>Link to Thiel:</b> ${fmt(rel[id])}</p>` : '')
    + facetHtml('panel', n)
    + sourcesHtml(n)
    + block('mute', `Connections (${cons.length})`, cons.map(e => {
      const o = other(e, id);
      return `<button class="con cat-${N[o].cat}" data-go="${o}">${arrow(e, id)} <b>${esc(N[o].name)}</b><span>${fmt(e.label || '')}</span></button>`;
    }).join(''));
  $('#side').scrollTop = 0;
  $$('#side .con').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    pin(b.dataset.go);
    els[b.dataset.go].scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}
function pin(id) {
  hideTray();
  if (!side.isOpen()) side.set(true, true);
  unpin(); pinned = id; els[id].classList.add('sel');
  focus(id, true); show(id);
}

// ---------- start up ----------
renderLegend();
renderChips();
renderStage();
$$('.card').forEach(c => els[c.dataset.id] = c);
syncChips();

const side = panelToggle({
  store: 'thielSide', key: 'd', buttons: [$('#sideBtn'), $('#sideTab')],
  apply: open => {
    mainEl.classList.toggle('collapsed', !open);
    $('#sideTab').innerHTML = open ? '&#9656;' : '&#9666;';
    if (pinned) draw(pinned, pinned !== 'T');
  },
});
panelToggle({ store: 'thielLegend', key: 'l', buttons: [$('#legendBtn'), $('#legendTab')],
  apply: open => { $('#legend').hidden = !open; $('#legendTab .chev').innerHTML = open ? '&#9652;' : '&#9662;'; } });

$('#side').innerHTML = '<h2>Details</h2><p class="hint">Hover any card to trace its links through the map. Click one to pin it and read its companies, Thiel funding, views, Christian associations and every connection. Click the background to clear. Use the filters above to spotlight anti-democracy views, Christian nationalism, Thiel funding or network states.</p>';

document.addEventListener('mouseover', e => { const c = e.target.closest('.card'); if (c && !pinned) { focus(c.dataset.id, false); showTray(c.dataset.id); } });
document.addEventListener('mouseout', e => { const c = e.target.closest('.card'); if (c && !pinned) { reset(); hideTray(); } });
document.addEventListener('click', e => {
  const f = e.target.closest('[data-f]');
  if (f) { setFilter(f.dataset.f); return; }
  if (e.target.closest('a.wp,a.wl,a.wk,a.srcl')) return;
  const c = e.target.closest('.card');
  if (c) { pin(c.dataset.id); return; }
  if (e.target.closest('aside,header,.bar')) return;
  if (pinned) { unpin(); reset(); }
});
$('#q').oninput = e => { term = e.target.value; unpin(); clearLines(); applyFilter(); };
$('#theme').onclick = () => {
  const r = document.documentElement;
  const dark = r.dataset.theme === 'dark' || (!r.dataset.theme && matchMedia('(prefers-color-scheme:dark)').matches);
  r.dataset.theme = dark ? 'light' : 'dark';
};
addEventListener('resize', () => { if (pinned) draw(pinned, pinned !== 'T'); });
