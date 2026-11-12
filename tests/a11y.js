// Usage: npm install && node tests/a11y.js
// For light and dark mode and for each state a visitor can reach (a card pinned, a filter on, the help dialog open):
//   1. loads the page as it is served and fails on any script error or Content-Security-Policy violation;
//   2. runs the axe-core accessibility scanner on the same state and fails on any violation.
// (Step 2 reloads with the policy bypassed, because axe itself fetches stylesheets, which the policy forbids.)
// Uses the Chrome that is installed (channel "chrome"); set CHROME_PATH to use a different browser binary.
const { chromium } = require('playwright-core');
const axe = require('axe-core');
const path = require('path');

const page = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const STATES = [
  ['home', async () => {}],
  ['card pinned, path chosen', async p => { await p.click('.card[data-id=Yarvin] .n'); await p.selectOption('#pathSel', 'Vance'); }],
  ['filtered by a chip', async p => { await p.click('.chip[data-f=crypto]'); }],
  ['help dialog open', async p => { await p.click('#helpBtn'); }],
];

// Opens the page in the given scheme and reaches the given state; returns the page and any errors it logged.
async function visit(browser, scheme, setup, extra = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: scheme, ...extra });
  const p = await context.newPage();
  const errors = [];
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', e => errors.push(String(e)));
  await p.addInitScript(() => document.addEventListener('securitypolicyviolation', e => console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)));
  await p.goto(page);
  await p.waitForSelector('.card');
  await setup(p);
  await p.waitForTimeout(250);
  return { context, p, errors };
}

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  let failures = 0;
  for (const scheme of ['light', 'dark']) {
    for (const [name, setup] of STATES) {
      const label = `${scheme} / ${name}`;

      const served = await visit(browser, scheme, setup);
      if (served.errors.length) {
        failures += served.errors.length;
        console.error(`FAIL ${label}: page errors`);
        served.errors.forEach(e => console.error(`  ${e}`));
      }
      await served.context.close();

      const scan = await visit(browser, scheme, setup, { bypassCSP: true });
      await scan.p.evaluate(axe.source);
      const result = await scan.p.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
      if (result.violations.length) {
        failures += result.violations.length;
        console.error(`FAIL ${label}: accessibility`);
        for (const v of result.violations) {
          console.error(`  ${v.id} (${v.impact}): ${v.help}`);
          for (const n of v.nodes.slice(0, 4)) console.error(`    ${n.target.join(' ')}  ${(n.failureSummary || '').split('\n')[1] || ''}`);
          if (v.nodes.length > 4) console.error(`    …and ${v.nodes.length - 4} more`);
        }
      } else if (!served.errors.length) console.log(`ok   ${label}`);
      await scan.context.close();
    }
  }
  await browser.close();
  if (failures) { console.error(`\n${failures} problem${failures === 1 ? '' : 's'} found`); process.exit(1); }
  console.log('\nno accessibility violations, script errors or policy violations');
})();
