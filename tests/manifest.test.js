const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const test = require('node:test');

test('manifest is valid and all referenced local assets exist', () => {
    const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
    const referencedFiles = [
        manifest.background.service_worker,
        manifest.action.default_popup,
        manifest.options_page,
        ...manifest.content_scripts.flatMap(script => script.js),
        ...Object.values(manifest.icons),
        ...Object.values(manifest.action.default_icon)
    ];

    assert.equal(manifest.manifest_version, 3);
    for (const file of referencedFiles) {
        assert.equal(existsSync(file), true, `Missing manifest asset: ${file}`);
    }
});
