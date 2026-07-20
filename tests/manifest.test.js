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

test('popup and options do not expose the removed catalog view', () => {
    const popupHtml = readFileSync('popup.html', 'utf8');
    const popupJs = readFileSync('popup.js', 'utf8');
    const optionsHtml = readFileSync('options.html', 'utf8');
    const optionsJs = readFileSync('options.js', 'utf8');

    assert.equal(popupHtml.includes('Ver Catálogo'), false);
    assert.equal(popupJs.includes('grid.html'), false);
    assert.equal(optionsHtml.includes('viewGridBtn'), false);
    assert.equal(optionsJs.includes('grid.html'), false);
    assert.equal(existsSync('grid.html'), false);
    assert.equal(existsSync('grid.js'), false);
});
