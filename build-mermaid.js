// Usage: node build-mermaid.js
// Regenerates thiel-network.mmd (Mermaid source) and thiel-network.md (the same diagram plus Wikipedia links) from data.js,
// so the diagram can never drift from the interactive map. Do not edit those two files by hand.
const fs = require('fs');
const vm = require('vm');

const sandbox = {};
vm.runInNewContext(fs.readFileSync('data.js', 'utf8') + '\nthis.DATA = DATA;', sandbox);
const { nodes: N, edges: E, cats: CAT, sections: SECTIONS } = sandbox.DATA;
const HUB = 'T';

// Mermaid subgraph id and colours for each category: [id, section fill, accent stroke, node fill]
const LOOK = {
  infl: ['Influences', '#f1f7ff', '#3b6fc9', '#dbe9ff'],
  pp: ['PayPal', '#f0faf1', '#2e8b3d', '#d6f1d9'],
  neo: ['Neoreaction', '#fff7ee', '#d9770a', '#ffe0bd'],
  pol: ['Politics', '#fff1f7', '#c2185b', '#ffd6e8'],
  prot: ['Protegees', '#eefaf9', '#12877f', '#c9f0ec'],
  oth: ['Other', '#f6f6f6', '#666666', '#e4e4e4'],
  obs: ['Observers', '#f7f2ee', '#8a6d5a', '#eadfd8'],
  net: ['Nets', '#fffbe3', '#b8860b', '#fff2a8'],
  faith: ['Faith', '#f6f1ff', '#6a45b8', '#e4d8fb'],
};
const ARROW = { strong: '==>', normal: '-->', weak: '-.->', plain: '---' };
const q = s => String(s).replace(/"/g, "'");

function nodeText(n) {
  const rows = [`<b>${q(n.name)}</b>`];
  if (n.sub.length) rows.push(`(${q(n.sub.join(', '))})`);
  if (n.id === HUB) { // the hub lists its companies bare, then the rest labelled
    if (n.cos) rows.push(q(n.cos));
  } else if (n.cos) rows.push(`<b>Cos:</b> ${q(n.cos)}`);
  if (n.id === HUB) { if (n.faith) rows.push(`<b>Faith:</b> ${q(n.faith)}`); return rows.join('<br/>'); } // the hub's box stays short
  if (n.fund) rows.push(`<b>Thiel $:</b> ${q(n.fund)}`);
  if (n.crypto) rows.push(`<b>Crypto:</b> ${q(n.crypto)}`);
  if (n.views) rows.push(`<b>Views:</b> ${q(n.views)}`);
  if (n.faith) rows.push(`<b>Faith:</b> ${q(n.faith)}`);
  if (n.gov) rows.push(`<b>Gov:</b> ${q(n.gov.text)}`);
  return rows.join('<br/>');
}
function nodeLine(n) {
  const t = nodeText(n);
  if (n.id === HUB) return `${n.id}(("${t}"))`;
  return n.cat === 'net' ? `${n.id}{{"${t}"}}` : `${n.id}["${t}"]`;
}

const out = ['graph LR', `    ${nodeLine(N[HUB])}`, ''];
for (const [cat] of SECTIONS) {
  const ids = Object.keys(N).filter(id => N[id].cat === cat);
  if (!ids.length) continue;
  out.push(`    subgraph ${LOOK[cat][0]}["${q(CAT[cat])}"]`, ...ids.map(id => `        ${nodeLine(N[id])}`), '    end', '');
}
for (const e of E) out.push(`    ${e.a} ${ARROW[e.kind]}${e.label ? `|"${q(e.label)}"|` : ''} ${e.b}`);
out.push('');
for (const [cat] of SECTIONS) if (LOOK[cat]) out.push(`    style ${LOOK[cat][0]} fill:${LOOK[cat][1]},stroke:${LOOK[cat][2]},stroke-width:2px`);
for (const [cat, [, , stroke, fill]] of Object.entries(LOOK)) out.push(`    classDef ${cat} fill:${fill},stroke:${stroke},stroke-width:2px,color:#1a1a1a`);
out.push('    classDef center fill:#1d2433,stroke:#000,stroke-width:3px,color:#ffffff');
out.push('    classDef anti stroke:#e11d1d,stroke-width:4px,stroke-dasharray:6 3');
out.push(`    class ${HUB} center`);
for (const [cat] of SECTIONS) {
  const ids = Object.keys(N).filter(id => N[id].cat === cat);
  if (ids.length) out.push(`    class ${ids.join(',')} ${cat}`);
}
const anti = Object.keys(N).filter(id => N[id].anti).sort();
if (anti.length) out.push(`    class ${anti.join(',')} anti`);
const mermaid = out.join('\n') + '\n';

const wikis = Object.values(N).filter(n => n.wiki).map(n => `- [${n.name}](${n.wiki})`).join('\n');
const doc = `# Peter Thiel Network (from The Nerd Reich)

Generated from data.js by build-mermaid.js; do not edit by hand.

**Legend:** red dashed border = echoes Thiel-style anti-democracy / exit views as described in the book; hexagon = network state, startup city or freedom-city project; box colour = category; "Faith:" lines = Christian nationalist associations. For the interactive version open index.html.

\`\`\`mermaid
${mermaid}\`\`\`

## Wikipedia links

${wikis}
`;
fs.writeFileSync('thiel-network.mmd', mermaid);
fs.writeFileSync('thiel-network.md', doc);
console.log(`wrote thiel-network.mmd and thiel-network.md (${Object.keys(N).length} people and projects, ${E.length} links)`);
