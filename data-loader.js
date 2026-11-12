// Reads data.js for the Node tools (check.js, check-links.js, build-static.js). The page itself loads data.js with a <script> tag.
const fs = require('fs');
const vm = require('vm');

function loadData() {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync('data.js', 'utf8') + '\nthis.DATA = DATA;', sandbox);
  return sandbox.DATA;
}

module.exports = { loadData };
