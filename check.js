// Usage: node check.js
// Validates data.js: every connection points at a real card, no duplicates, nothing orphaned, and the fields have the shapes app.js expects.
// Exits with a non-zero status (and lists the problems) if anything is wrong. Needs no packages.
const fs = require('fs');
const vm = require('vm');

const sandbox = {};
vm.runInNewContext(fs.readFileSync('data.js', 'utf8') + '\nthis.DATA = DATA;', sandbox);
const { nodes: N, edges: E, cats: CAT, sections: SECTIONS, facts: FACTS, ent: ENT } = sandbox.DATA;

// the kinds of government reach are defined once, in app.js
const appSource = fs.readFileSync('app.js', 'utf8');
const govBlock = appSource.slice(appSource.indexOf('const GOV = ['), appSource.indexOf('const GOV_BY_KEY'));
const GOV_KEYS = new Set([...govBlock.matchAll(/key: '(\w+)'/g)].map(m => m[1]));
const KINDS = new Set(['strong', 'normal', 'weak', 'plain']);
const WIKI = /^https:\/\/en\.wikipedia\.org\/wiki\//;

const problems = [];
const bad = msg => problems.push(msg);

if (!GOV_KEYS.size) bad('could not read the government kinds from app.js');

// categories and sections
for (const [k] of SECTIONS) if (!CAT[k]) bad(`section "${k}" is not in cats`);
for (const k of Object.keys(CAT)) if (k !== 'center' && !SECTIONS.some(([s]) => s === k)) bad(`category "${k}" has no section`);

// cards
for (const [id, n] of Object.entries(N)) {
  const at = `card ${id}`;
  if (!n.name) bad(`${at}: no name`);
  if (!CAT[n.cat]) bad(`${at}: unknown category "${n.cat}"`);
  if (n.wiki && !WIKI.test(n.wiki)) bad(`${at}: wiki is not an English Wikipedia address`);
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

// text links and summary facts
for (const [name, url] of Object.entries(ENT || {})) if (!WIKI.test(url)) bad(`ent "${name}": not an English Wikipedia address`);
if (!Array.isArray(FACTS) || !FACTS.length) bad('facts is empty');

if (problems.length) {
  console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'} in data.js:\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`data.js ok: ${Object.keys(N).length} cards, ${E.length} connections`);
