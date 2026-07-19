const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const test = require('node:test');

const source = readFileSync('coderedApi.js', 'utf8');

function loadApi(fetch) {
    const globalScope = {};
    runInNewContext(source, {
        self: globalScope,
        fetch,
        URL,
        AbortController,
        setTimeout,
        clearTimeout
    });
    return globalScope.CodeRedApi;
}

test('normalizes base urls and rejects api paths', () => {
    const api = loadApi(() => Promise.reject(new Error('unexpected')));
    assert.equal(api.normalizeBaseUrl(' https://platform.example.com/ '), 'https://platform.example.com');
    assert.equal(api.normalizeBaseUrl('http://192.168.18.124:8090/'), 'http://192.168.18.124:8090');
    assert.equal(api.normalizeBaseUrl('https://platform.example.com/api/v1/agencies'), '');
});

test('builds api urls under api/v1', () => {
    const api = loadApi(() => Promise.reject(new Error('unexpected')));
    assert.equal(api.buildApiUrl('https://platform.example.com', 'me'), 'https://platform.example.com/api/v1/me');
});

test('fetches and paginates agencies safely', async () => {
    const calls = [];
    const fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.includes('/api/v1/agencies?page=1&per_page=2')) {
            return {
                ok: true,
                async text() {
                    return JSON.stringify({
                        data: [{ id: 1 }, { id: 2 }],
                        meta: { current_page: 1, last_page: 2, per_page: 2, total: 4 },
                        links: { next: 'next' }
                    });
                }
            };
        }
        if (url.includes('/api/v1/agencies?page=2&per_page=2')) {
            return {
                ok: true,
                async text() {
                    return JSON.stringify({
                        data: [{ id: 3 }, { id: 4 }],
                        meta: { current_page: 2, last_page: 2, per_page: 2, total: 4 },
                        links: { next: null }
                    });
                }
            };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };
    const api = loadApi(fetch);
    const agencies = await api.fetchAllAgencies('https://platform.example.com', 'token', { perPage: 2, maxPages: 5 });
    assert.equal(agencies.length, 4);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
});

test('fetches metadata etag and incremental changes pages', async () => {
    const calls = [];
    const fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url.includes('/api/v1/catalog/metadata')) {
            return {
                ok: true,
                status: 200,
                headers: { get(name) { return name.toLowerCase() === 'etag' ? 'etag-9' : null; } },
                async text() { return JSON.stringify({ cursor: 'cursor-9' }); }
            };
        }
        if (url.includes('/api/v1/agencies/changes?per_page=2&cursor=cursor-9')) {
            return {
                ok: true,
                status: 200,
                headers: { get() { return null; } },
                async text() {
                    return JSON.stringify({
                        upserted: [{ id: 10 }],
                        deleted: [3],
                        next_cursor: 'cursor-10'
                    });
                }
            };
        }
        if (url.includes('/api/v1/agencies/changes?per_page=2&cursor=cursor-10')) {
            return {
                ok: true,
                status: 200,
                headers: { get() { return null; } },
                async text() {
                    return JSON.stringify({
                        upserted: [],
                        deleted: [],
                        next_cursor: null
                    });
                }
            };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };
    const api = loadApi(fetch);
    const metadata = await api.fetchCatalogMetadataIfChanged('https://platform.example.com', 'token', 'etag-1');
    const changes = await api.fetchAllAgenciesChanges('https://platform.example.com', 'token', { cursor: 'cursor-9', perPage: 2 });

    assert.equal(metadata.etag, 'etag-9');
    assert.equal(metadata.status, 200);
    assert.equal(changes.length, 2);
    assert.equal(changes[0].next_cursor, 'cursor-10');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
    assert.equal(calls[0].options.headers['If-None-Match'], 'etag-1');
});

test('returns useful errors for invalid JSON', async () => {
    const api = loadApi(async () => ({
        ok: true,
        async text() { return '{'; }
    }));
    await assert.rejects(() => api.fetchCurrentTokenInfo('https://platform.example.com', 'token'), (error) => error.type === 'INVALID_JSON');
});
