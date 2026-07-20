const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('options page only exposes token configuration and read-only status', () => {
    const html = readFileSync('options.html', 'utf8');
    const js = readFileSync('options.js', 'utf8');

    assert.equal(html.includes('Token de API'), true);
    assert.equal(html.includes('apiBaseUrl'), false);
    assert.equal(html.includes('dataSource'), false);
    assert.equal(html.includes('gist'), false);
    assert.equal(html.includes('cacheDuration'), false);
    assert.equal(js.includes('apiBaseUrl'), false);
    assert.equal(js.includes('dataSource'), false);
    assert.equal(js.includes('gist'), false);
});

