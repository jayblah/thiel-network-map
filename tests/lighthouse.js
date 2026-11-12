// Usage: npm install && node tests/lighthouse.js
// Serves the site locally (gzip-compressed, like GitHub Pages) and audits it with Lighthouse on a throttled mobile profile.
// Exits non-zero if a category falls below its target or the page grows past its size budget, so the page cannot quietly get slower.
// Uses the Chrome that is installed; set CHROME_PATH to use a different browser binary.
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// What the page must keep scoring (out of 100) and how heavy it may get (compressed KB over the wire).
const TARGETS = { performance: 90, accessibility: 100, 'best-practices': 95, seo: 90 };
const MAX_TRANSFER_KB = 100;

const root = path.resolve(__dirname, '..');
const TYPES = { '.txt': 'text/plain', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };

function serve() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const url = req.url.split('?')[0];
      const file = path.join(root, url === '/' ? 'index.html' : url);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      const type = TYPES[path.extname(file)] || 'application/octet-stream';
      const body = fs.readFileSync(file);
      const zip = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && /^text|javascript/.test(type);
      res.writeHead(200, { 'content-type': type, ...(zip ? { 'content-encoding': 'gzip' } : {}), 'cache-control': 'max-age=600' });
      res.end(zip ? zlib.gzipSync(body) : body);
    }).listen(0, '127.0.0.1', () => resolve(server));
  });
}

// Chrome occasionally fails to open its debugging port on a busy CI machine; try a few times before giving up.
async function launchChrome(chromeLauncher, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await chromeLauncher.launch({ chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], chromePath: process.env.CHROME_PATH || undefined });
    } catch (e) {
      if (i >= attempts) throw e;
      console.error(`Chrome did not start (attempt ${i} of ${attempts}); retrying`);
    }
  }
}

(async () => {
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/`;
  const chrome = await launchChrome(chromeLauncher);
  let failed = false;
  try {
    const { lhr } = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: Object.keys(TARGETS) });
    for (const [id, target] of Object.entries(TARGETS)) {
      const score = Math.round((lhr.categories[id].score || 0) * 100);
      const ok = score >= target;
      if (!ok) failed = true;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(15)} ${String(score).padStart(3)}  (target ${target})`);
      if (!ok) for (const ref of lhr.categories[id].auditRefs) {
        const a = lhr.audits[ref.id];
        if (ref.weight > 0 && a.score !== null && a.score < 0.9) console.log(`       - ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`);
      }
    }
    const kb = Math.round(lhr.audits['total-byte-weight'].numericValue / 1024);
    const sizeOk = kb <= MAX_TRANSFER_KB;
    if (!sizeOk) failed = true;
    console.log(`${sizeOk ? 'ok  ' : 'FAIL'} ${'transfer size'.padEnd(15)} ${String(kb).padStart(3)} KB (budget ${MAX_TRANSFER_KB} KB)`);
    const m = lhr.audits;
    console.log(`     first contentful paint ${m['first-contentful-paint'].displayValue}, largest ${m['largest-contentful-paint'].displayValue}, blocking time ${m['total-blocking-time'].displayValue}, layout shift ${m['cumulative-layout-shift'].displayValue}`);
  } finally {
    await chrome.kill();
    server.close();
  }
  if (failed) process.exit(1);
})().catch(e => { console.error(e); process.exit(1); });
