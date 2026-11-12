// Weekly research digest. Usage: node ingest/ingest.js   (writes ingest/report.md; never touches data.js)
//
// It gathers facts from public, official sources and lists what a person should look at. It proposes nothing on its own:
// every change to the map is still made by hand, with a source, in a pull request.
//   1. Federal contracts to Palantir, from USAspending.gov, next to what the map says.
//   2. Peter Thiel's political contributions, from the FEC.
//   3. Wikipedia pages on the map that changed since the last run.
//   4. Source links on the map that no longer resolve.
//   5. Cards that still have no cited source.
// Optional environment: FEC_API_KEY (the shared DEMO_KEY works but is rate limited), SNAPSHOT (path of the Wikipedia snapshot).
const fs = require('fs');
const path = require('path');
const { loadData } = require('../data-loader.js');

process.chdir(path.resolve(__dirname, '..'));
const DATA = loadData();
const UA = 'thiel-network-map-research/1.0 (+https://github.com/jayblah/thiel-network-map)';
const SNAPSHOT = process.env.SNAPSHOT || path.join(__dirname, 'snapshot.json');
const out = [];
const say = (...lines) => out.push(...lines);
const usd = n => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`;
const get = async (url, opts = {}) => fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(25000) });
const json = async (url, opts) => { const r = await get(url, opts); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

// ---------- 1. USAspending: Palantir ----------
async function contracts() {
  say('## 1. Federal contracts to Palantir (USAspending.gov)', '');
  const fy = (y) => ({ start_date: `${y - 1}-10-01`, end_date: `${y}-09-30` });
  const now = new Date(), thisFy = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const rows = [];
  for (let y = thisFy - 4; y <= thisFy; y++) {
    const d = await json('https://api.usaspending.gov/api/v2/search/spending_by_category/recipient/', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters: { recipient_search_text: ['PALANTIR'], time_period: [fy(y)] }, category: 'recipient', limit: 10, page: 1 }),
    });
    const total = d.results.reduce((a, r) => a + r.amount, 0);
    rows.push(`| FY${y} | ${usd(total)} | ${d.results.map(r => `${r.name} ${usd(r.amount)}`).join('; ')} |`);
  }
  const parent = await json('https://api.usaspending.gov/api/v2/recipient/1ea8a9a4-3726-3491-9040-66950bb67606-P/?year=all');
  say('| Fiscal year | Total | By recipient |', '|---|---|---|', ...rows, '',
    `All years on record for the parent company (${parent.name}): **${usd(parent.total_transaction_amount)}** in ${parent.total_transactions} transactions.`, '');
  const mapSays = [DATA.facts.find(f => /Palantir/.test(f)), (DATA.nodes.T.gov || {}).text].filter(Boolean).map(t => `- ${t.replace(/\*/g, '')}`);
  say('What the map says:', ...mapSays, '', 'If these disagree, decide whether the map should cite USAspending for the figure, and say which time period it covers.', '');
}

// ---------- 2. FEC: Thiel's contributions ----------
async function fec() {
  say('## 2. Peter Thiel\'s political contributions (FEC)', '');
  const key = process.env.FEC_API_KEY || 'DEMO_KEY', rows = [];
  const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const cycle = new Date().getFullYear() % 2 ? new Date().getFullYear() + 1 : new Date().getFullYear();
  for (const c of [cycle, cycle - 2]) {
    const d = await json(`https://api.open.fec.gov/v1/schedules/schedule_a/?api_key=${key}&contributor_name=${encodeURIComponent('Thiel, Peter')}&two_year_transaction_period=${c}&sort=-contribution_receipt_date&per_page=100`);
    for (const r of d.results) {
      if ((r.contributor_name || '').toUpperCase() !== 'THIEL, PETER') continue; // the name search also returns Thielman, Thielen and others
      if (!/FOUNDERS|THIEL|VALAR|MITHRIL|INVEST|SELF/i.test(r.contributor_employer || '')) continue;
      if (r.contribution_receipt_date >= cutoff) rows.push(`| ${r.contribution_receipt_date} | ${r.contribution_receipt_amount < 0 ? '-' : ''}${usd(Math.abs(r.contribution_receipt_amount))} | ${r.committee.name} | ${r.contributor_employer || ''} |`);
    }
  }
  say(rows.length ? ['Last 90 days:', '', '| Date | Amount | Recipient | Employer on filing |', '|---|---|---|---|', ...rows].join('\n') : 'No contributions by Peter Thiel in the last 90 days.', '',
    'Large gifts to super PACs usually appear in the filings of the receiving committee, not here; check those by hand.', '');
}

// ---------- 3. Wikipedia: pages that changed ----------
async function wikipedia() {
  say('## 3. Wikipedia pages on the map that changed', '');
  const pages = Object.values(DATA.nodes).filter(n => n.wiki).map(n => ({ id: n.id, name: n.name, title: decodeURIComponent(n.wiki.split('/wiki/')[1]) }));
  const now = {};
  for (let i = 0; i < pages.length; i += 40) {
    const chunk = pages.slice(i, i + 40);
    const d = await json(`https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvprop=ids|timestamp&redirects=1&format=json&titles=${encodeURIComponent(chunk.map(p => p.title.replace(/_/g, ' ')).join('|'))}`);
    const byTitle = {};
    (d.query.redirects || []).forEach(r => { byTitle[r.from] = r.to; });
    for (const p of chunk) {
      const t = p.title.replace(/_/g, ' '), pg = Object.values(d.query.pages).find(x => x.title === (byTitle[t] || t));
      const rev = pg && pg.revisions && pg.revisions[0];
      if (rev) now[p.id] = { revid: rev.revid, ts: rev.timestamp, title: pg.title };
    }
  }
  const before = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : null;
  if (!before) say(`First run: recorded ${Object.keys(now).length} pages as the baseline. Changes will be listed from the next run.`, '');
  else {
    const changed = Object.entries(now).filter(([id, r]) => before[id] && before[id].revid !== r.revid);
    say(changed.length ? ['| Page | Last edited | Changes |', '|---|---|---|', ...changed.map(([id, r]) => `| ${DATA.nodes[id].name} | ${r.ts.slice(0, 10)} | [diff](https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(r.title.replace(/ /g, '_'))}&diff=${r.revid}&oldid=${before[id].revid}) |`)].join('\n') : 'No page changed.', '',
      'Most edits are minor. Scan each diff for a changed job title, a new company or a new government role.', '');
  }
  fs.writeFileSync(SNAPSHOT, JSON.stringify(now));
}

// ---------- 4. Source links ----------
async function sourceLinks() {
  say('## 4. Source links that no longer resolve', '');
  const urls = [];
  for (const n of Object.values(DATA.nodes)) {
    for (const s of n.sources || []) urls.push({ who: n.name, label: s.l, url: s.u });
    if (n.link) urls.push({ who: n.name, label: n.link.l, url: n.link.u });
  }
  const bad = [];
  let next = 0, unreachable = 0;
  const worker = async () => {
    while (next < urls.length) {
      const item = urls[next++];
      try {
        let r = await get(item.url, { method: 'HEAD', redirect: 'follow' });
        if (r.status === 405 || r.status === 400) r = await get(item.url, { redirect: 'follow' });
        // 401, 403 and 429 mean the publisher blocks automated visitors; the map already marks those with a lock
        if (r.status === 404 || r.status === 410) bad.push({ ...item, why: String(r.status) });
      } catch (e) {
        const code = e.cause && e.cause.code || e.name;
        if (code === 'ENOTFOUND') bad.push({ ...item, why: 'address does not exist' });
        else unreachable++; // resets and timeouts are usually a publisher turning automated visitors away
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  say(bad.length ? ['| Card | Source | Problem |', '|---|---|---|', ...bad.map(b => `| ${b.who} | [${b.label.slice(0, 70)}](${b.url}) | ${b.why} |`)].join('\n') : `None of the ${urls.length} source links is dead.`, '');
  if (unreachable) say(`${unreachable} link(s) did not answer an automated visitor (usually a publisher blocking bots); not counted as dead.`, '');
}

// ---------- 5. Coverage ----------
function coverage() {
  say('## 5. Cards with no cited source', '');
  const none = Object.values(DATA.nodes).filter(n => !(n.sources && n.sources.length)).map(n => n.name);
  say(none.length ? `${none.length} of ${Object.keys(DATA.nodes).length}: ${none.join(', ')}` : 'Every card has at least one source.', '');
}

(async () => {
  say(`# Weekly research digest, ${new Date().toISOString().slice(0, 10)}`, '',
    'Facts gathered from official sources. Nothing here has been added to the map. Check each item, then make any change by hand with a source.', '');
  for (const step of [contracts, fec, wikipedia, sourceLinks, coverage]) {
    try { await step(); } catch (e) { say(`_${step.name} could not run: ${e.message}_`, ''); }
  }
  fs.writeFileSync(path.join(__dirname, 'report.md'), out.join('\n'));
  console.log(out.join('\n'));
})();
