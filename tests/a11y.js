// Usage: npm install && node tests/a11y.js
// Runs the axe-core accessibility scanner on the real page, in light and dark mode and in the states a visitor can reach
// (a card pinned, the help dialog open). Exits non-zero if axe reports any violation.
// Uses the Chrome that is installed (channel "chrome"); set CHROME_PATH to use a different browser binary.
const { chromium } = require('playwright-core');
const axe = require('axe-core');
const path = require('path');

const page = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

const STATES = [
  ['home', async () => {}],
  ['card pinned, path chosen', async p => { await p.click('.card[data-id=Yarvin] .n'); await p.selectOption('#pathSel', 'Vance'); }],
  ['filtered by a badge', async p => { await p.click('#legend .pill[data-f=crypto]'); }],
  ['help dialog open', async p => { await p.click('#helpBtn'); }],
];

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  let failures = 0;
  for (const scheme of ['light', 'dark']) {
    for (const [name, setup] of STATES) {
      const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: scheme });
      const p = await context.newPage();
      await p.goto(page);
      await p.waitForSelector('.card');
      await setup(p);
      await p.waitForTimeout(250);
      await p.evaluate(axe.source);
      const result = await p.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
      const label = `${scheme} / ${name}`;
      if (result.violations.length) {
        failures += result.violations.length;
        console.error(`FAIL ${label}`);
        for (const v of result.violations) {
          console.error(`  ${v.id} (${v.impact}): ${v.help}`);
          for (const n of v.nodes.slice(0, 4)) console.error(`    ${n.target.join(' ')}  ${(n.failureSummary || '').split('\n')[1] || ''}`);
          if (v.nodes.length > 4) console.error(`    …and ${v.nodes.length - 4} more`);
        }
      } else console.log(`ok   ${label}`);
      await context.close();
    }
  }
  await browser.close();
  if (failures) { console.error(`\n${failures} accessibility violation${failures === 1 ? '' : 's'}`); process.exit(1); }
  console.log('\nno accessibility violations');
})();
