const assert = require('node:assert/strict');
const fs = require('node:fs');

assert.match(fs.readFileSync('site/index.html', 'utf8'), /<h1>Sample site<\/h1>/);
console.log('Sample site smoke check passed');
