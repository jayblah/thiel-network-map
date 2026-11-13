// Reads data.js for the Node tools (check.js, check-links.js, build-static.js). The page itself loads data.js with a <script> tag.
const fs = require('fs');
const vm = require('vm');

function loadData() {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync('data.js', 'utf8') + '\nthis.DATA = DATA;', sandbox);
  return sandbox.DATA;
}

// Text links and card links go to English Wikipedia (or, for text links only, to a source the map already cites).
const WIKI_PREFIX = 'https://en.wikipedia.org/wiki/';
const isWikipedia = u => typeof u === 'string' && u.startsWith(WIKI_PREFIX);

module.exports = { loadData, isWikipedia };
