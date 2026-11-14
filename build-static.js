// Usage: node build-static.js
// Writes a plain-HTML copy of everything on the map (people, what the book says about them, their connections) into index.html,
// inside <noscript>. Search engines and social-media crawlers that do not run scripts read it, and so do visitors with JavaScript off.
// It is generated from data.js, so rerun this after changing data.js; `node check.js` fails if the copy is out of date.
const fs = require('fs');
const { loadData } = require('./data-loader');

const START = '<!-- static-content:start -->';
const END = '<!-- static-content:end -->';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The page's text as semantic HTML: a heading per section, a list of cards, each with its facts and connections.
function render(data) {
  const { nodes: N, edges: E, cats: CAT, sections: SECTIONS, hub: HUB } = data;
  const other = (e, id) => e.a === id ? e.b : e.a;
  const consOf = id => E.filter(e => e.a === id || e.b === id);
  const rel = id => { const e = consOf(id).find(x => other(x, id) === HUB); return e ? e.label : ''; };

  const facts = n => [
    ['Companies', n.cos], ['Thiel funding', n.fund], ['Crypto', n.crypto], ['Views', n.views],
    ['Christian nationalism', n.faith], ['Core beliefs', n.beliefs && n.beliefs.join(' ')], ['Government reach', n.gov && n.gov.text],
  ].filter(([, v]) => v).map(([k, v]) => `<br>${k}: ${esc(v)}`).join('');

  const person = n => {
    const name = n.wiki ? `<a href="${esc(n.wiki)}">${esc(n.name)}</a>` : esc(n.name);
    const sub = n.sub.length ? ` (${esc(n.sub.join('; '))})` : '';
    const link = n.id !== HUB && rel(n.id) ? `<br>Link to Thiel: ${esc(rel(n.id))}` : '';
    const cons = consOf(n.id).map(e => `${esc(N[other(e, n.id)].name)} (${esc(e.label)})`).join('; ');
    return `<li><strong>${name}</strong>${sub}${link}${facts(n)}${cons ? `<br>Connected to: ${cons}` : ''}</li>`;
  };

  const out = [
    '<div class="nojs">',
    `<h2>${esc(N[HUB].name)}'s network</h2>`,
    '<p>This map is interactive and needs JavaScript. Without it, this page lists everything on the map as text.</p>',
    `<h3>${esc(N[HUB].name)}</h3>`,
    `<ul>${person(N[HUB])}</ul>`,
  ];
  for (const [cat] of SECTIONS) {
    const ids = Object.keys(N).filter(id => N[id].cat === cat);
    if (ids.length) out.push(`<h3>${esc(CAT[cat])}</h3>`, `<ul>${ids.map(id => person(N[id])).join('\n')}</ul>`);
  }
  out.push('</div>');
  return out.join('\n');
}

// Replaces whatever sits between the two markers in the page.
function inject(html, block) {
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a < 0 || b < a) throw new Error('index.html has no static-content markers');
  return html.slice(0, a + START.length) + '\n' + block + '\n' + html.slice(b);
}

module.exports = { render, inject };

if (require.main === module) {
  const file = 'index.html';
  const raw = fs.readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const html = inject(raw.replace(/\r\n/g, '\n'), render(loadData()));
  fs.writeFileSync(file, crlf ? html.replace(/\n/g, '\r\n') : html);
  console.log(`wrote the text version of the map into ${file} (${html.length} characters)`);
}
