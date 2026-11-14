// Usage: node check.js
// Validates data.js: every connection points at a real card, no duplicates, nothing orphaned, and the fields have the shapes app.js expects.
// Exits with a non-zero status (and lists the problems) if anything is wrong. Needs no packages.
const fs = require('fs');
const crypto = require('crypto');
const { loadData, isWikipedia } = require('./data-loader');

const DATA = loadData();
const { nodes: N, edges: E, cats: CAT, sections: SECTIONS, ent: ENT, govKinds, hub: HUB } = DATA;

const appSource = fs.readFileSync('app.js', 'utf8');
const GOV_KEYS = new Set((govKinds || []).map(g => g.key));
const KINDS = new Set(['strong', 'normal', 'weak', 'plain']);

const problems = [];
const bad = msg => problems.push(msg);

if (!GOV_KEYS.size) bad('data.js has no govKinds');
if (!N[HUB]) bad(`hub "${HUB}" is not a card`);

// the data-updates log: dated, newest first, each with at least one line
const UPD = DATA.updates || [];
if (!UPD.length) bad('data.js has no updates log');
UPD.forEach((u, i) => { if (!/^\d{4}-\d\d-\d\d$/.test(u.date) || !u.items || !u.items.length) bad(`updates[${i}] needs a date (YYYY-MM-DD) and items`); if (i && u.date >= UPD[i - 1].date) bad(`updates[${i}] is not older than the one before it`); });

// categories and sections
for (const [k] of SECTIONS) if (!CAT[k]) bad(`section "${k}" is not in cats`);
for (const k of Object.keys(CAT)) if (k !== 'center' && !SECTIONS.some(([s]) => s === k)) bad(`category "${k}" has no section`);

// cards
for (const [id, n] of Object.entries(N)) {
  const at = `card ${id}`;
  if (!n.name) bad(`${at}: no name`);
  if (!CAT[n.cat]) bad(`${at}: unknown category "${n.cat}"`);
  if (n.wiki && !isWikipedia(n.wiki)) bad(`${at}: wiki is not an English Wikipedia address`);
  if (n.link && !(n.link.u && n.link.l && /^https:\/\//.test(n.link.u))) bad(`${at}: link needs an https u and a label l`);
  if (n.gov) {
    if (!n.gov.text) bad(`${at}: gov has no text`);
    if (!Array.isArray(n.gov.kinds) || !n.gov.kinds.length) bad(`${at}: gov has no kinds`);
    else for (const k of n.gov.kinds) if (!GOV_KEYS.has(k)) bad(`${at}: unknown gov kind "${k}"`);
  }
  for (const s of n.sources || []) {
    if (!s.l || !/^https?:\/\//.test(s.u || '')) bad(`${at}: a source needs a label l and an address u`);
    if (!['ok', 'blocked'].includes(s.s)) bad(`${at}: source state must be ok or blocked`);
  }
  for (const f of ['cos', 'fund', 'views', 'faith', 'crypto']) if (n[f] === '') bad(`${at}: empty ${f} (leave empty fields out)`);
}

// portraits: every credited person has both image files and a full credit
const PEOPLE = DATA.people || [], PICS = DATA.portraits || {};
for (const id of PEOPLE) if (!N[id]) bad(`people: no card "${id}"`);
for (const [id, c] of Object.entries(PICS)) {
  if (!PEOPLE.includes(id)) bad(`portrait ${id}: not listed in people`);
  if (!Array.isArray(c) || c.length !== 3 || !c[0] || (c[1] && !/^https:\/\/commons\.wikimedia\.org\//.test(c[2])) || (c[2] && !/^https:\/\//.test(c[2]))) bad(`portrait ${id}: needs [photographer, licence, page address]; a licence needs a Commons address, and a credit with no licence may carry any https source link or none`);
  for (const f of [`img/${id}.webp`, `img/${id}-lg.webp`]) if (!fs.existsSync(f)) bad(`portrait ${id}: missing ${f}`);
}

// connections
const seen = new Set();
const degree = {};
E.forEach((e, i) => {
  const at = `connection ${i} (${e.a} to ${e.b})`;
  for (const end of [e.a, e.b]) { if (!N[end]) bad(`${at}: no card "${end}"`); degree[end] = (degree[end] || 0) + 1; }
  if (e.a === e.b) bad(`${at}: connects a card to itself`);
  if (!KINDS.has(e.kind)) bad(`${at}: unknown kind "${e.kind}"`);
  if (!e.label) bad(`${at}: no label`);
  const key = [e.a, e.b].sort().join('|');
  if (seen.has(key)) bad(`${at}: duplicate of an earlier connection`);
  seen.add(key);
});
for (const id of Object.keys(N)) if (!degree[id]) bad(`card ${id}: has no connections`);

// the page's Content Security Policy: every inline script must be allowed by its hash, and inline style attributes are forbidden
const html = fs.readFileSync('index.html', 'utf8').split('\r\n').join('\n');
const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1];
if (!csp) bad('index.html has no Content-Security-Policy meta tag');
else {
  const allowed = [...csp.matchAll(/'sha256-([^']+)'/g)].map(m => m[1]);
  for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const hash = crypto.createHash('sha256').update(m[1]).digest('base64');
    if (!allowed.includes(hash)) bad(`an inline script in index.html has hash sha256-${hash}, which the Content-Security-Policy does not allow (update the meta tag)`);
  }
}
// the plain-text copy of the map (for crawlers and visitors without scripts) must match data.js
const { render, inject } = require('./build-static');
if (inject(html, render(DATA)) !== html) bad('the text copy of the map in index.html is out of date: run node build-static.js');
if (/\sstyle="/.test(html) || /style="/.test(appSource)) bad('inline style attributes are blocked by the Content-Security-Policy; set the property from script instead');

// text links: each must be a Wikipedia address or a source the map already cites (an essay, an article), and must actually be used somewhere in the text
const CITED = new Set(Object.values(N).flatMap(n => [...(n.sources || []).map(s => s.u), n.link && n.link.u].filter(Boolean)));
const allText = [];
(function collect(v) { if (typeof v === 'string') allText.push(v); else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); })([N, E]);
const corpus = allText.join('\n');
const escapeRe = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [name, url] of Object.entries(ENT || {})) {
  if (!isWikipedia(url) && !CITED.has(url)) bad(`ent "${name}": not an English Wikipedia address or a source cited on a card`);
  if (!new RegExp('(?<![A-Za-z0-9])' + escapeRe(name) + '(?![A-Za-z0-9])').test(corpus)) bad(`ent "${name}": not mentioned anywhere in the text, so it can never link (remove it)`);
}

if (problems.length) {
  console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'} in data.js:\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`data.js ok: ${Object.keys(N).length} cards, ${E.length} connections`);
