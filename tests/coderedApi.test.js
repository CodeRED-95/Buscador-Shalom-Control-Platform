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

test('returns useful errors for invalid JSON', async () => {
    const api = loadApi(async () => ({
        ok: true,
        async text() { return '{'; }
    }));
    await assert.rejects(() => api.fetchCurrentTokenInfo('https://platform.example.com', 'token'), (error) => error.type === 'INVALID_JSON');
});
