const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const test = require('node:test');

const source = readFileSync('agencyStore.js', 'utf8');

function loadStore({ initialStorage = {}, fetch } = {}) {
    const storage = { ...initialStorage };
    const globalScope = {};
    const chrome = {
        storage: {
            local: {
                async get(keys) {
                    return keys.reduce((result, key) => {
                        if (Object.hasOwn(storage, key)) result[key] = storage[key];
                        return result;
                    }, {});
                },
                async set(items) {
                    Object.assign(storage, items);
                }
            }
        }
    };

    runInNewContext(source, {
        chrome,
        fetch: fetch || (() => Promise.reject(new Error('Unexpected fetch'))),
        self: globalScope,
        URL
    });

    return { store: globalScope.ShalomAgencyStore, storage };
}

test('normalizes text and escapes remote fields', () => {
    const { store } = loadStore();

    assert.equal(store.normalizeText('AEREO JOSE'), 'aereo jose');
    assert.equal(store.normalizeText('Aereo Jose'.normalize('NFC')), 'aereo jose');
    assert.equal(store.escapeHtml('<img src=x> & "test"'), '&lt;img src=x&gt; &amp; &quot;test&quot;');
});

test('allows only valid HTTPS external links', () => {
    const { store } = loadStore();

    assert.equal(store.getSafeExternalUrl('javascript:alert(1)'), '');
    assert.equal(store.getSafeExternalUrl('http://maps.example/test'), '');
    assert.equal(store.getSafeExternalUrl('https://maps.example/test'), 'https://maps.example/test');
});

test('prepares incomplete agency records without crashing', () => {
    const { store } = loadStore();
    const agencies = store.prepareAgencies([null, { agencia: 'Lima Centro' }], 'TERRESTRE');

    assert.equal(agencies.length, 2);
    assert.equal(agencies[0].segmento, 'TERRESTRE');
    assert.equal(agencies[1]._searchText, 'lima centro');
});

test('normalizes the new CodeRED agency contract without mutating the input', () => {
    const raw = {
        internal_id: 25,
        id: 610,
        code: ' SHA-000610 ',
        agencia: ' Yarinacocha Av Universitaria ',
        departamento: ' Ucayali ',
        provincia: ' Coronel Portillo ',
        distrito: ' Pucallpa Yarinacocha ',
        direccion: ' av. universitaria ',
        link_mapa: 'https://www.google.com/maps/dir/?api=1&destination=-8.38,-74.56',
        tamano: ' Pequeña ',
        texto_chosen_terrestre: ' 610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE ',
        texto_chosen_aereo: null
    };
    const snapshot = JSON.parse(JSON.stringify(raw));
    const { store } = loadStore();

    const agency = store.normalizeAgency(raw, { segmento: 'TERRESTRE', source: 'codered' });

    assert.deepEqual(raw, snapshot);
    assert.equal(agency.internalId, 25);
    assert.equal(agency.externalId, 610);
    assert.equal(agency.code, 'SHA-000610');
    assert.equal(agency.agency, 'Yarinacocha Av Universitaria');
    assert.equal(agency.department, 'Ucayali');
    assert.equal(agency.province, 'Coronel Portillo');
    assert.equal(agency.district, 'Pucallpa Yarinacocha');
    assert.equal(agency.address, 'av. universitaria');
    assert.equal(agency.mapUrl, 'https://www.google.com/maps/dir/?api=1&destination=-8.38,-74.56');
    assert.equal(agency.size, 'Pequeña');
    assert.equal(agency.chosenTextTerrestrial, '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE');
    assert.equal(agency.chosenTextAir, null);
    assert.equal(agency.texto_chosen_terrestre, agency.chosenTextTerrestrial);
    assert.equal(agency.texto_chosen_aereo, null);
    assert.equal(agency.texto_chosen, null);
    assert.equal(agency.schemaVersion, 2);
    assert.equal(agency.source, 'codered');
});

test('keeps null values as null and rejects invalid types for text fields', () => {
    const { store } = loadStore();
    const agency = store.normalizeAgency({
        internal_id: '25',
        id: '610',
        code: 123,
        agencia: {},
        departamento: null,
        provincia: undefined,
        distrito: '',
        direccion: [],
        link_mapa: 'http://example.com',
        texto_chosen_terrestre: null,
        texto_chosen_aereo: null
    });

    assert.equal(agency.internalId, 25);
    assert.equal(agency.externalId, 610);
    assert.equal(agency.code, '123');
    assert.equal(agency.agency, null);
    assert.equal(agency.department, null);
    assert.equal(agency.province, null);
    assert.equal(agency.district, null);
    assert.equal(agency.address, null);
    assert.equal(agency.mapUrl, null);
});

test('derives terrestrial legacy chosen text from texto_chosen when unambiguous', () => {
    const { store } = loadStore();
    const agency = store.normalizeAgency({
        id: 610,
        agencia: 'Lima Centro',
        texto_chosen: '610 - LIMA - LIMA - LIMA - LIMA CENTRO - TERRESTRE'
    });

    assert.equal(agency.chosenTextTerrestrial, '610 - LIMA - LIMA - LIMA - LIMA CENTRO - TERRESTRE');
    assert.equal(agency.chosenTextAir, null);
    assert.equal(agency.chosenTextLegacyType, 'TERRESTRE');
});

test('derives air legacy chosen text from texto_chosen when unambiguous', () => {
    const { store } = loadStore();
    const agency = store.normalizeAgency({
        id: 710,
        agencia: 'Lima Air',
        texto_chosen: '710 - LIMA - LIMA - SAN ISIDRO - LIMA AIR - AEREO'
    });

    assert.equal(agency.chosenTextTerrestrial, null);
    assert.equal(agency.chosenTextAir, '710 - LIMA - LIMA - SAN ISIDRO - LIMA AIR - AEREO');
    assert.equal(agency.chosenTextLegacyType, 'AEREO');
});

test('preserves ambiguous legacy chosen text without copying it to both channels', () => {
    const { store } = loadStore();
    const agency = store.normalizeAgency({
        id: 99,
        agencia: 'Ruta Ambigua',
        texto_chosen: '99 - LIMA - LIMA - CENTRAL - RUTA AMBIGUA'
    });

    assert.equal(agency.chosenTextTerrestrial, null);
    assert.equal(agency.chosenTextAir, null);
    assert.equal(agency.chosenTextLegacy, '99 - LIMA - LIMA - CENTRAL - RUTA AMBIGUA');
    assert.equal(agency.chosenTextLegacyType, 'AMBIGUO');
});

test('selects the correct chosen text per channel', () => {
    const { store } = loadStore();
    const agency = store.normalizeAgency({
        id: 610,
        texto_chosen_terrestre: 'T-610',
        texto_chosen_aereo: 'A-610',
        texto_chosen: 'legacy'
    });

    assert.equal(store.getChosenTextForChannel(agency, 'TERRESTRE'), 'T-610');
    assert.equal(store.getChosenTextForChannel(agency, 'AEREO'), 'A-610');
    assert.equal(store.getChosenTextForChannel(agency, 'OTRO'), 'legacy');
    assert.equal(store.agencyHasChannel(agency, 'TERRESTRE'), true);
    assert.equal(store.agencyHasChannel(agency, 'AEREO'), true);
});

test('exposes cache schema version and default source helpers', async () => {
    const { store, storage } = loadStore();
    assert.equal(store.AGENCY_CACHE_SCHEMA_VERSION, 2);
    assert.equal(store.AGENCY_CACHE_V2_KEY, 'agencyCatalogCache');
    assert.equal((await store.getAgencyConfig()).source, 'gist');
    assert.equal((await store.getCachedAgencies()).schemaVersion, 2);
    assert.equal((await store.getCachedAgencies()).source, 'gist');
    assert.equal(storage.agencyCatalogCache, undefined);
});

test('saves and sanitizes the agency source configuration', async () => {
    const { store, storage } = loadStore();
    const config = await store.saveAgencyConfig({
        source: 'codered',
        apiBaseUrl: ' https://api.example.com/agencies ',
        apiToken: ' token-123 ',
        cacheDurationMs: '60000',
        lastSyncAt: ' 2026-07-19T00:00:00.000Z '
    });

    assert.equal(config.source, 'codered');
    assert.equal(config.apiBaseUrl, 'https://api.example.com/agencies');
    assert.equal(config.apiToken, 'token-123');
    assert.equal(config.cacheDurationMs, 60000);
    assert.equal(config.lastSyncAt, '2026-07-19T00:00:00.000Z');
    assert.equal(storage.agencyDataConfig.source, 'codered');
});

test('keeps transitional fallback mode when saving configuration', async () => {
    const { store } = loadStore();
    const config = await store.saveAgencyConfig({
        source: 'codered-with-gist-fallback',
        apiBaseUrl: 'https://platform.example.com',
        apiToken: 'token',
        cacheDurationMs: 60000
    });

    assert.equal(config.source, 'codered-with-gist-fallback');
});

test('reports cache status and respects configured cache duration', async () => {
    const now = Date.now();
    const { store } = loadStore({
        initialStorage: {
            agencyDataConfig: {
                source: 'gist',
                apiBaseUrl: '',
                apiToken: '',
                cacheDurationMs: 1000,
                lastSyncAt: null
            },
            agencyCatalogCache: {
                schemaVersion: 2,
                source: 'gist',
                syncedAt: new Date(now - 500).toISOString(),
                cacheDurationMs: 1000,
                agencies: [{ id: 1 }]
            }
        }
    });

    const status = await store.getAgencyCacheStatus();

    assert.equal(status.source, 'gist');
    assert.equal(status.cacheDurationMs, 1000);
    assert.equal(status.stale, false);
    assert.equal(status.offline, false);
    assert.equal(status.updated, true);
});

test('marks cache offline when it is stale but still has data', async () => {
    const now = Date.now();
    const { store } = loadStore({
        initialStorage: {
            agencyDataConfig: {
                source: 'gist',
                apiBaseUrl: '',
                apiToken: '',
                cacheDurationMs: 1000,
                lastSyncAt: null
            },
            agencyCatalogCache: {
                schemaVersion: 2,
                source: 'gist',
                syncedAt: new Date(now - 5000).toISOString(),
                cacheDurationMs: 1000,
                agencies: [{ id: 1 }]
            }
        }
    });

    const status = await store.getAgencyCacheStatus();

    assert.equal(status.stale, true);
    assert.equal(status.offline, true);
    assert.equal(status.hasData, true);
});

test('returns normalized agencies from fetchAgencies and refreshAgencies', async () => {
    const fetch = async (url) => {
        if (url.includes('acfb5aaccf90743075a8143511b48ae7')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_terrestre.json': {
                                filename: 'agencias_terrestre.json',
                                content: '[{"internal_id":1,"id":2,"code":"SHA-000002","agencia":"Caja","texto_chosen_terrestre":"2 - LIMA - LIMA - LIMA - CAJA - TERRESTRE"}]'
                            }
                        }
                    };
                }
            };
        }
        if (url.includes('27710267e825c3b205be8d3c8f0acc46')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_aereo.json': {
                                filename: 'agencias_aereo.json',
                                content: '[{"internal_id":3,"id":4,"code":"SHA-000004","agencia":"Air","texto_chosen_aereo":"4 - LIMA - LIMA - AIR - AEREO"}]'
                            }
                        }
                    };
                }
            };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };

    const { store } = loadStore({ fetch });
    const agencies = await store.fetchAgencies();
    const refreshed = await store.refreshAgencies({ force: true });

    assert.equal(Array.isArray(agencies), true);
    assert.equal(agencies.length >= 2, true);
    assert.equal(refreshed.schemaVersion, 2);
    assert.equal(refreshed.source, 'gist');
    assert.equal(refreshed.agencies.length >= 2, true);
});

test('refreshes from CodeRED Platform when configured and falls back to Gist on failure', async () => {
    const calls = [];
    const fetch = async (url, options = {}) => {
        calls.push({ url, options });
        if (url === 'https://codered.example/api/agencies') {
            return {
                ok: true,
                async json() {
                    return [{
                        internal_id: 25,
                        id: 610,
                        code: 'SHA-000610',
                        agencia: ' Yarinacocha Av Universitaria ',
                        departamento: ' Ucayali ',
                        provincia: ' Coronel Portillo ',
                        distrito: ' Pucallpa Yarinacocha ',
                        direccion: ' av. universitaria ',
                        link_mapa: 'https://www.google.com/maps/dir/?api=1&destination=-8.38,-74.56',
                        tamano: ' Pequeña ',
                        texto_chosen_terrestre: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE'
                    }];
                }
            };
        }
        if (url.includes('acfb5aaccf90743075a8143511b48ae7')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_terrestre.json': {
                                filename: 'agencias_terrestre.json',
                                content: '[{"id":"1","agencia":"Fallback"}]'
                            }
                        }
                    };
                }
            };
        }
        if (url.includes('27710267e825c3b205be8d3c8f0acc46')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_aereo.json': {
                                filename: 'agencias_aereo.json',
                                content: '[{"id":"2","agencia":"Fallback Air"}]'
                            }
                        }
                    };
                }
            };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };

    const { store } = loadStore({
        fetch,
        initialStorage: {
            agencyDataConfig: {
                source: 'codered',
                apiBaseUrl: 'https://codered.example/api/agencies',
                apiToken: 'secret',
                cacheDurationMs: 60000,
                lastSyncAt: null
            }
        }
    });

    const result = await store.refreshAgencies({ force: true });

    assert.equal(result.source, 'codered');
    assert.equal(result.agencies[0].externalId, 610);
    assert.equal(result.agencies[0].chosenTextTerrestrial, '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE');
    assert.equal(calls[0].url, 'https://codered.example/api/agencies');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer secret');
});

test('falls back to Gist when CodeRED refresh fails', async () => {
    const fetch = async (url) => {
        if (url === 'https://codered.example/api/agencies') {
            return { ok: false, status: 500 };
        }
        if (url.includes('acfb5aaccf90743075a8143511b48ae7')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_terrestre.json': {
                                filename: 'agencias_terrestre.json',
                                content: '[{"id":"1","agencia":"Fallback"}]'
                            }
                        }
                    };
                }
            };
        }
        if (url.includes('27710267e825c3b205be8d3c8f0acc46')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_aereo.json': {
                                filename: 'agencias_aereo.json',
                                content: '[{"id":"2","agencia":"Fallback Air"}]'
                            }
                        }
                    };
                }
            };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };

    const { store } = loadStore({
        fetch,
        initialStorage: {
            agencyDataConfig: {
                source: 'codered-with-gist-fallback',
                apiBaseUrl: 'https://codered.example/api/agencies',
                apiToken: '',
                cacheDurationMs: 60000,
                lastSyncAt: null
            }
        }
    });

    const result = await store.refreshAgencies({ force: true });

    assert.equal(result.source, 'gist');
    assert.ok(result.errors.some((entry) => entry.tipo === 'CODERED'));
    assert.equal(result.agencies.length >= 1, true);
});

test('downloads raw Gist content when the API omits embedded content', async () => {
    const calls = [];
    const fetch = async (url) => {
        calls.push(url);
        if (url.includes('acfb5aaccf90743075a8143511b48ae7')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_terrestre.json': {
                                filename: 'agencias_terrestre.json',
                                content: null,
                                raw_url: 'https://gist.example/terrestre.json'
                            }
                        }
                    };
                }
            };
        }
        if (url.includes('27710267e825c3b205be8d3c8f0acc46')) {
            return {
                ok: true,
                async json() {
                    return {
                        files: {
                            'agencias_aereo.json': {
                                filename: 'agencias_aereo.json',
                                content: '[{"id":"2"}]'
                            }
                        }
                    };
                }
            };
        }
        if (url === 'https://gist.example/terrestre.json') {
            return { ok: true, async text() { return '[{"id":"1"}]'; } };
        }
        throw new Error(`Unexpected URL: ${url}`);
    };

    const { store, storage } = loadStore({ fetch });
    const result = await store.refreshAgencyCache({ force: true });

    assert.equal(result.updated, true);
    assert.equal(result.terrestre[0].id, '1');
    assert.equal(storage.agenciasAereo[0].id, '2');
    assert.ok(calls.includes('https://gist.example/terrestre.json'));
});
