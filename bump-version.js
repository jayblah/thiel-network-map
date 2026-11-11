// Usage: node bump-version.js <version>   e.g. node bump-version.js 1.17
// Rewrites the ?v= suffix on the stylesheet and scripts in index.html; app.js shows it in the header.
const fs = require('fs');
const version = process.argv[2];
if (!/^\d+(\.\d+)*$/.test(version || '')) { console.error('Give a version like 1.17'); process.exit(1); }
const file = 'index.html';
const html = fs.readFileSync(file, 'utf8');
const updated = html.replace(/((?:styles\.css|data\.js|app\.js)\?v=)[\d.]+/g, '$1' + version);
if (updated === html) { console.error('No ?v= suffixes changed (already at ' + version + '?)'); process.exit(1); }
fs.writeFileSync(file, updated);
console.log('index.html now at v' + version);
