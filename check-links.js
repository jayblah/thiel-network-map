// Usage: node check-links.js   (Node 18 or newer; needs internet)
// Checks that every Wikipedia address in data.js still resolves. Publisher addresses in `sources` are not checked
// because many block automated requests (that is what their ok/blocked flag records).
const { loadData, isWikipedia } = require('./data-loader');

const { nodes: N, ent: ENT } = loadData();

const urls = new Map(); // address -> who uses it
const add = (u, who) => { if (u) urls.set(u, [...(urls.get(u) || []), who]); };
for (const [id, n] of Object.entries(N)) add(n.wiki, `card ${id}`);
for (const [name, u] of Object.entries(ENT || {})) if (isWikipedia(u)) add(u, `text link "${name}"`); // cited publisher addresses are not checked, like the rest of the sources

async function check(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'corruptography-link-check (github.com/jayblah/corruptography)' } });
      if (res.ok) return null;
      if (res.status !== 429 && res.status < 500) return `HTTP ${res.status}`;
    } catch { /* retry */ }
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  return 'no response';
}

(async () => {
  const broken = [];
  for (const [url, who] of urls) {
    const problem = await check(url);
    if (problem) broken.push(`${url}  ${problem}  (${who.join(', ')})`);
  }
  if (broken.length) { console.error(`${broken.length} broken link${broken.length === 1 ? '' : 's'}:\n- ` + broken.join('\n- ')); process.exit(1); }
  console.log(`all ${urls.size} Wikipedia links resolve`);
})();
