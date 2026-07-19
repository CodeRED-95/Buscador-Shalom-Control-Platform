const DEFAULT_GIST_ID = "acfb5aaccf90743075a8143511b48ae7";
const DEFAULT_AEREO_GIST_ID = "27710267e825c3b205be8d3c8f0acc46";
const AGENCY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AGENCY_CACHE_SCHEMA_VERSION = 3;
const AGENCY_CACHE_V2_KEY = 'agencyCatalogCache';
const AGENCY_CONFIG_KEY = 'agencyDataConfig';
const DEFAULT_AGENCY_CONFIG = {
    source: 'gist',
    apiBaseUrl: '',
    apiToken: '',
    cacheDurationMs: AGENCY_CACHE_TTL_MS,
    lastSyncAt: null
};
const AGENCY_CACHE_KEYS = {
    terrestre: 'agenciasTerrestre',
    aereo: 'agenciasAereo',
    lastUpdated: 'agenciasLastUpdated',
    gistIds: 'agenciasGistIds',
    v2: AGENCY_CACHE_V2_KEY
};

(function initAgencyStore(globalScope) {
    const storageGet = (keys) => chrome.storage.local.get(keys);
    const storageSet = (items) => chrome.storage.local.set(items);

    const toTrimmedString = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value !== 'string') {
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return null;
        }
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    };

    const toNullableString = (value) => {
        const trimmed = toTrimmedString(value);
        return trimmed === null ? null : trimmed;
    };

    const normalizeText = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getSafeExternalUrl = (value) => {
        try {
            const url = new URL(String(value || ''));
            return url.protocol === 'https:' ? url.href : '';
        } catch {
            return '';
        }
    };

    const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

    const toNumberOrNull = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    };

    const toTimestampOrNull = (value) => {
        if (value === null || value === undefined || value === '') return null;
        const numeric = toNumberOrNull(value);
        if (numeric !== null) return numeric;
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const isCO = (value) => value === true || String(value).toUpperCase() === 'TRUE' || String(value).toUpperCase() === 'SI' || String(value).toUpperCase() === 'S' || value === '1' || value === 1;

    const inferChosenChannel = (value) => {
        const normalized = normalizeText(value);
        if (!normalized) return null;
        if (normalized.includes('aereo') || normalized.includes('aéreo')) return 'AEREO';
        if (/\bterrestre\b/.test(normalized)) return 'TERRESTRE';
        return null;
    };

    const normalizeAgency = (rawAgency, context = {}) => {
        const source = isPlainObject(rawAgency) ? { ...rawAgency } : {};
        const chosenTerrestrial = toNullableString(source.texto_chosen_terrestre);
        const chosenAir = toNullableString(source.texto_chosen_aereo);
        const legacyChosen = toNullableString(source.texto_chosen);
        const legacyChannel = !chosenTerrestrial && !chosenAir && legacyChosen !== null ? inferChosenChannel(legacyChosen) : null;

        const normalized = {
            schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
            source: toNullableString(context.source) || null,
            internalId: toNumberOrNull(source.internal_id),
            externalId: toNumberOrNull(source.id),
            code: toNullableString(source.code),
            agency: toNullableString(source.agencia),
            department: toNullableString(source.departamento),
            province: toNullableString(source.provincia),
            district: toNullableString(source.distrito),
            address: toNullableString(source.direccion),
            mapUrl: getSafeExternalUrl(source.link_mapa) || null,
            size: toNullableString(source.tamano),
            chosenTextTerrestrial: chosenTerrestrial || (legacyChannel === 'TERRESTRE' ? legacyChosen : null),
            chosenTextAir: chosenAir || (legacyChannel === 'AEREO' ? legacyChosen : null),
            chosenTextLegacy: legacyChosen,
            chosenTextLegacyType: legacyChosen ? (legacyChannel || 'AMBIGUO') : null,
            segment: toNullableString(context.segmento),
            isCO: isCO(source.co)
        };

        return {
            ...source,
            ...normalized,
            id: source.id,
            internal_id: source.internal_id,
            agencia: normalized.agency,
            departamento: normalized.department,
            provincia: normalized.province,
            distrito: normalized.district,
            direccion: normalized.address,
            link_mapa: normalized.mapUrl,
            tamano: normalized.size,
            texto_chosen: normalized.chosenTextLegacy,
            texto_chosen_terrestre: normalized.chosenTextTerrestrial,
            texto_chosen_aereo: normalized.chosenTextAir,
            co: source.co
        };
    };

    const getChosenTextForChannel = (agency, channel) => {
        const normalizedChannel = String(channel || '').toUpperCase();
        if (!agency || typeof agency !== 'object') return null;
        if (normalizedChannel === 'AEREO') {
            return toNullableString(agency.chosenTextAir || agency.texto_chosen_aereo || null);
        }
        if (normalizedChannel === 'TERRESTRE') {
            return toNullableString(agency.chosenTextTerrestrial || agency.texto_chosen_terrestre || null);
        }
        return toNullableString(agency.chosenTextLegacy || agency.texto_chosen || null);
    };

    const agencyHasChannel = (agency, channel) => Boolean(getChosenTextForChannel(agency, channel));
    const normalizeAgencyList = (agencies, context = {}) => (Array.isArray(agencies) ? agencies : []).map(agency => normalizeAgency(agency, context));

    const getConfiguredGistIds = async () => {
        const items = await storageGet(['gistIdTerr', 'gistIdAereo']);
        return {
            terrestre: items.gistIdTerr || DEFAULT_GIST_ID,
            aereo: items.gistIdAereo || DEFAULT_AEREO_GIST_ID
        };
    };

    const sanitizeAgencyConfig = (config = {}) => {
        const source = toNullableString(config.source) || DEFAULT_AGENCY_CONFIG.source;
        const normalizedSource = ['codered', 'codered-with-gist-fallback', 'gist'].includes(source) ? source : 'gist';
        return {
            source: normalizedSource,
            apiBaseUrl: toNullableString(config.apiBaseUrl) || '',
            apiToken: toNullableString(config.apiToken) || '',
            cacheDurationMs: toNumberOrNull(config.cacheDurationMs) || DEFAULT_AGENCY_CONFIG.cacheDurationMs,
            lastSyncAt: toNullableString(config.lastSyncAt)
        };
    };

    const getAgencyConfig = async () => {
        const items = await storageGet([AGENCY_CONFIG_KEY]);
        return sanitizeAgencyConfig(items[AGENCY_CONFIG_KEY] || {});
    };

    const saveAgencyConfig = async (config = {}) => {
        const next = sanitizeAgencyConfig(config);
        await storageSet({ [AGENCY_CONFIG_KEY]: next });
        return next;
    };

    const clearAgencyConfig = async () => {
        await saveAgencyConfig(DEFAULT_AGENCY_CONFIG);
    };

    const readLegacyAgencies = (cacheV2) => ({
        terrestre: Array.isArray(cacheV2?.agenciasTerrestre) ? cacheV2.agenciasTerrestre : [],
        aereo: Array.isArray(cacheV2?.agenciasAereo) ? cacheV2.agenciasAereo : []
    });

    const getCachedAgencyData = async () => {
        const items = await storageGet([
            AGENCY_CACHE_KEYS.terrestre,
            AGENCY_CACHE_KEYS.aereo,
            AGENCY_CACHE_KEYS.lastUpdated,
            AGENCY_CACHE_KEYS.gistIds,
            AGENCY_CACHE_KEYS.v2
        ]);

        const cacheV2 = isPlainObject(items[AGENCY_CACHE_KEYS.v2]) ? items[AGENCY_CACHE_KEYS.v2] : null;
        const hasTerrestre = Array.isArray(items[AGENCY_CACHE_KEYS.terrestre]);
        const hasAereo = Array.isArray(items[AGENCY_CACHE_KEYS.aereo]);
        const legacySplit = readLegacyAgencies(cacheV2);
        const v3Agencies = Array.isArray(cacheV2?.agencies) ? cacheV2.agencies : [];
        const agencies = Number(cacheV2?.schemaVersion || 0) >= 3
            ? v3Agencies
            : (v3Agencies.length ? v3Agencies : [...legacySplit.terrestre, ...legacySplit.aereo]);

        return {
            schemaVersion: Number(cacheV2?.schemaVersion || (hasTerrestre || hasAereo ? 2 : 0)),
            source: cacheV2?.source || null,
            syncedAt: cacheV2?.syncedAt || null,
            lastCheckedAt: cacheV2?.lastCheckedAt || null,
            etag: cacheV2?.etag || null,
            cursor: cacheV2?.cursor || null,
            cacheDurationMs: cacheV2?.cacheDurationMs || AGENCY_CACHE_TTL_MS,
            agencies,
            terrestre: hasTerrestre ? items[AGENCY_CACHE_KEYS.terrestre] : [],
            aereo: hasAereo ? items[AGENCY_CACHE_KEYS.aereo] : [],
            lastUpdated: toTimestampOrNull(items[AGENCY_CACHE_KEYS.lastUpdated] || cacheV2?.syncedAt) || 0,
            gistIds: items[AGENCY_CACHE_KEYS.gistIds] || null,
            hasTerrestre,
            hasAereo
        };
    };

    const isExpired = (lastUpdated, ttl = AGENCY_CACHE_TTL_MS) => !lastUpdated || (Date.now() - lastUpdated) >= ttl;
    const hasLocalCopy = (cache) => cache.hasTerrestre && cache.hasAereo;
    const haveGistIdsChanged = (cacheIds, currentIds) => {
        if (!cacheIds) return true;
        return cacheIds.terrestre !== currentIds.terrestre || cacheIds.aereo !== currentIds.aereo;
    };

    const getAgencyCacheStatus = async () => {
        const [cache, config] = await Promise.all([getCachedAgencyData(), getAgencyConfig()]);
        const ttl = config.cacheDurationMs || cache.cacheDurationMs || AGENCY_CACHE_TTL_MS;
        const source = config.source || cache.source || 'gist';
        const stale = isExpired(cache.lastUpdated, ttl);
        const hasData = Array.isArray(cache.agencies) ? cache.agencies.length > 0 : (cache.hasTerrestre || cache.hasAereo);

        return {
            source,
            cacheDurationMs: ttl,
            lastUpdated: cache.lastUpdated || null,
            syncedAt: cache.syncedAt || null,
            lastCheckedAt: cache.lastCheckedAt || null,
            etag: cache.etag || null,
            cursor: cache.cursor || null,
            stale,
            hasData,
            offline: stale && hasData,
            updated: !stale && hasData,
            cacheSource: cache.source || null
        };
    };

    const readJsonFileFromGist = async (gistData, preferredNames) => {
        if (!gistData || !gistData.files) {
            throw new Error('Respuesta de Gist invalida');
        }

        const names = Array.isArray(preferredNames) ? preferredNames : [preferredNames];
        const files = Object.values(gistData.files);
        const file = names.map(name => gistData.files[name]).find(Boolean)
            || files.find(f => f.filename && f.filename.toLowerCase().endsWith('.json'));

        if (!file || (!file.content && !file.raw_url)) {
            throw new Error('Archivo JSON no encontrado en el Gist');
        }

        let content = file.content;
        if ((!content || file.truncated) && file.raw_url) {
            const rawResponse = await fetch(file.raw_url);
            if (!rawResponse.ok) {
                throw new Error(`GitHub raw respondio ${rawResponse.status}`);
            }
            content = await rawResponse.text();
        }

        const agencies = JSON.parse(content);
        if (!Array.isArray(agencies)) {
            throw new Error('El archivo JSON de agencias debe ser una lista');
        }

        return agencies;
    };

    const fetchGistAgencies = async (gistId, preferredNames) => {
        const response = await fetch(`https://api.github.com/gists/${gistId}`);
        if (!response.ok) {
            throw new Error(`GitHub respondio ${response.status}`);
        }
        return readJsonFileFromGist(await response.json(), preferredNames);
    };

    const fetchCodeRedAgencies = async (config) => {
        const agencyConfig = sanitizeAgencyConfig(config);
        if (!agencyConfig.apiBaseUrl) {
            throw new Error('apiBaseUrl no configurada para CodeRED Platform');
        }

        const headers = { Accept: 'application/json' };
        if (agencyConfig.apiToken) {
            headers.Authorization = `Bearer ${agencyConfig.apiToken}`;
        }

        const response = await fetch(agencyConfig.apiBaseUrl, { headers });
        if (!response.ok) {
            throw new Error(`CodeRED respondio ${response.status}`);
        }

        const payload = await response.json();
        const agencies = Array.isArray(payload) ? payload : (Array.isArray(payload?.agencies) ? payload.agencies : null);
        if (!Array.isArray(agencies)) {
            throw new Error('La respuesta de CodeRED debe ser una lista o contener agencies[]');
        }

        return agencies;
    };

    const normalizeAgencyKey = (agency) => {
        const key = agency?.externalId ?? agency?.id ?? agency?.internalId ?? agency?.code;
        return key === null || key === undefined || key === '' ? null : String(key);
    };

    const applyAgencyChanges = (agencies, { upserted = [], deleted = [], source = 'codered' } = {}) => {
        const map = new Map();
        normalizeAgencyList(agencies, { source }).forEach((agency) => {
            const key = normalizeAgencyKey(agency);
            if (key) map.set(key, agency);
        });
        (Array.isArray(upserted) ? upserted : []).forEach((agency) => {
            const normalized = normalizeAgency(agency, { source });
            const key = normalizeAgencyKey(normalized);
            if (key) map.set(key, normalized);
        });
        (Array.isArray(deleted) ? deleted : []).forEach((item) => {
            const key = item && typeof item === 'object'
                ? normalizeAgencyKey(normalizeAgency(item, { source }))
                : (item === null || item === undefined || item === '' ? null : String(item));
            if (key) map.delete(key);
        });
        return Array.from(map.values());
    };

    const buildV3Cache = (cache, patch = {}) => ({
        schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
        source: patch.source || cache.source || 'gist',
        apiSchemaVersion: 1,
        etag: patch.etag ?? cache.etag ?? null,
        cursor: patch.cursor ?? cache.cursor ?? null,
        syncedAt: patch.syncedAt ?? cache.syncedAt ?? null,
        lastCheckedAt: patch.lastCheckedAt ?? cache.lastCheckedAt ?? null,
        lastAgencyUpdate: patch.lastAgencyUpdate ?? cache.lastAgencyUpdate ?? null,
        cacheDurationMs: patch.cacheDurationMs ?? cache.cacheDurationMs ?? AGENCY_CACHE_TTL_MS,
        agencies: Array.isArray(patch.agencies) ? patch.agencies : (Array.isArray(cache.agencies) ? cache.agencies : []),
        agenciasTerrestre: Array.isArray(patch.terrestre) ? patch.terrestre : (Array.isArray(cache.terrestre) ? cache.terrestre : []),
        agenciasAereo: Array.isArray(patch.aereo) ? patch.aereo : (Array.isArray(cache.aereo) ? cache.aereo : []),
        gistIds: patch.gistIds ?? cache.gistIds ?? null
    });

    const saveV3CacheAtomically = async (cachePatch) => {
        const current = await getCachedAgencyData();
        const next = buildV3Cache(current, cachePatch);
        await storageSet({
            [AGENCY_CACHE_KEYS.v2]: next,
            [AGENCY_CACHE_KEYS.lastUpdated]: next.syncedAt || next.lastCheckedAt || 0
        });
        return getCachedAgencyData();
    };

    const refreshGistAgencyCache = async ({ force = false } = {}) => {
        const [cache, gistIds] = await Promise.all([getCachedAgencyData(), getConfiguredGistIds()]);

        if (!force && hasLocalCopy(cache) && !isExpired(cache.lastUpdated, cache.cacheDurationMs) && !haveGistIdsChanged(cache.gistIds, gistIds)) {
            return { ...cache, updated: false, errors: [] };
        }

        const [terrestreResult, aereoResult] = await Promise.allSettled([
            fetchGistAgencies(gistIds.terrestre, ['agencias_terrestre.json', 'agencias.json']),
            fetchGistAgencies(gistIds.aereo, ['agencias_aereo.json'])
        ]);

        const nextCache = {
            terrestre: terrestreResult.status === 'fulfilled' ? normalizeAgencyList(terrestreResult.value, { segmento: 'TERRESTRE', source: 'gist' }) : cache.terrestre,
            aereo: aereoResult.status === 'fulfilled' ? normalizeAgencyList(aereoResult.value, { segmento: 'AEREO', source: 'gist' }) : cache.aereo,
            lastUpdated: cache.lastUpdated,
            gistIds
        };

        const errors = [];
        if (terrestreResult.status === 'rejected') errors.push({ tipo: 'TERRESTRE', message: terrestreResult.reason.message });
        if (aereoResult.status === 'rejected') errors.push({ tipo: 'AEREO', message: aereoResult.reason.message });

        const hasFreshData = terrestreResult.status === 'fulfilled' || aereoResult.status === 'fulfilled';
        const fullyUpdated = terrestreResult.status === 'fulfilled' && aereoResult.status === 'fulfilled';
        if (hasFreshData) {
            nextCache.lastUpdated = fullyUpdated ? Date.now() : cache.lastUpdated;
            nextCache.gistIds = fullyUpdated ? gistIds : cache.gistIds;

            const storageUpdate = {
                [AGENCY_CACHE_KEYS.lastUpdated]: nextCache.lastUpdated,
                [AGENCY_CACHE_KEYS.gistIds]: nextCache.gistIds,
                [AGENCY_CACHE_KEYS.v2]: {
                    schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
                    source: 'gist',
                    apiSchemaVersion: 1,
                    syncedAt: nextCache.lastUpdated || null,
                    lastCheckedAt: nextCache.lastUpdated || null,
                    agencies: [...nextCache.terrestre, ...nextCache.aereo],
                    agenciasTerrestre: nextCache.terrestre,
                    agenciasAereo: nextCache.aereo
                }
            };

            if (terrestreResult.status === 'fulfilled') {
                storageUpdate[AGENCY_CACHE_KEYS.terrestre] = nextCache.terrestre;
            }
            if (aereoResult.status === 'fulfilled') {
                storageUpdate[AGENCY_CACHE_KEYS.aereo] = nextCache.aereo;
            }

            await storageSet(storageUpdate);
        }

        return { ...nextCache, updated: fullyUpdated, errors, schemaVersion: AGENCY_CACHE_SCHEMA_VERSION, source: 'gist', syncedAt: nextCache.lastUpdated || null, lastCheckedAt: nextCache.lastUpdated || null, agencies: [...nextCache.terrestre, ...nextCache.aereo] };
    };

    const refreshCodeRedAgencyCache = async ({ force = false } = {}) => {
        const [cache, agencyConfig] = await Promise.all([getCachedAgencyData(), getAgencyConfig()]);
        if (!agencyConfig.apiBaseUrl) {
            throw new Error('apiBaseUrl no configurada para CodeRED Platform');
        }

        if (!cache.agencies || !cache.agencies.length || force || !cache.etag) {
            const metadata = await CodeRedApi.fetchCatalogMetadata(agencyConfig.apiBaseUrl, agencyConfig.apiToken);
            const fullSync = await CodeRedApi.fetchAllAgencies(agencyConfig.apiBaseUrl, agencyConfig.apiToken, { onProgress: () => {} });
            const agencies = normalizeAgencyList(fullSync, { source: 'codered' });
            const syncedAt = Date.now();
            return saveV3CacheAtomically({
                source: 'codered',
                cacheDurationMs: agencyConfig.cacheDurationMs,
                etag: metadata.etag,
                cursor: metadata.json?.cursor || metadata.json?.next_cursor || null,
                syncedAt,
                lastCheckedAt: syncedAt,
                lastAgencyUpdate: syncedAt,
                agencies,
                terrestre: [],
                aereo: []
            });
        }

        const metadata = await CodeRedApi.fetchCatalogMetadataIfChanged(agencyConfig.apiBaseUrl, agencyConfig.apiToken, cache.etag);
        const checkedAt = Date.now();
        if (metadata.status === 304) {
            return saveV3CacheAtomically({
                source: 'codered',
                cacheDurationMs: agencyConfig.cacheDurationMs,
                lastCheckedAt: checkedAt
            });
        }

        const metadataCursor = metadata.json?.cursor || metadata.json?.next_cursor || cache.cursor || null;
        if (metadata.json?.full_sync_required) {
            const fullSync = await CodeRedApi.fetchAllAgencies(agencyConfig.apiBaseUrl, agencyConfig.apiToken, { onProgress: () => {} });
            const agencies = normalizeAgencyList(fullSync, { source: 'codered' });
            return saveV3CacheAtomically({
                source: 'codered',
                cacheDurationMs: agencyConfig.cacheDurationMs,
                etag: metadata.etag,
                cursor: metadataCursor,
                syncedAt: checkedAt,
                lastCheckedAt: checkedAt,
                lastAgencyUpdate: checkedAt,
                agencies,
                terrestre: [],
                aereo: []
            });
        }

        const pages = await CodeRedApi.fetchAllAgenciesChanges(agencyConfig.apiBaseUrl, agencyConfig.apiToken, {
            cursor: cache.cursor || metadataCursor || '',
            onProgress: () => {}
        });
        let agencies = Array.isArray(cache.agencies) ? [...cache.agencies] : [];
        let nextCursor = cache.cursor || metadataCursor || null;
        for (const page of pages) {
            agencies = applyAgencyChanges(agencies, {
                upserted: page.upserted || page.data?.upserted || [],
                deleted: page.deleted || page.data?.deleted || [],
                source: 'codered'
            });
            nextCursor = page.next_cursor || page.cursor || page.meta?.next_cursor || nextCursor;
            if (page.full_sync_required) {
                const fullSync = await CodeRedApi.fetchAllAgencies(agencyConfig.apiBaseUrl, agencyConfig.apiToken, { onProgress: () => {} });
                agencies = normalizeAgencyList(fullSync, { source: 'codered' });
                break;
            }
        }

        return saveV3CacheAtomically({
            source: 'codered',
            cacheDurationMs: agencyConfig.cacheDurationMs,
            etag: metadata.etag,
            cursor: nextCursor,
            syncedAt: checkedAt,
            lastCheckedAt: checkedAt,
            lastAgencyUpdate: checkedAt,
            agencies,
            terrestre: [],
            aereo: []
        });
    };

    const refreshAgencyCache = async ({ force = false } = {}) => {
        const [cache, agencyConfig] = await Promise.all([getCachedAgencyData(), getAgencyConfig()]);

        if (agencyConfig.source === 'codered' || agencyConfig.source === 'codered-with-gist-fallback') {
            try {
                const refreshed = await refreshCodeRedAgencyCache({ force });
                await saveAgencyConfig({
                    ...agencyConfig,
                    lastSyncAt: new Date(refreshed.syncedAt || Date.now()).toISOString()
                });
                return {
                    ...refreshed,
                    source: agencyConfig.source,
                    updated: true,
                    errors: []
                };
            } catch (error) {
                const cached = await getCachedAgencyData();
                const hasValidCache = Array.isArray(cached.agencies) && cached.agencies.length > 0;
                if (agencyConfig.source === 'codered-with-gist-fallback' && !hasValidCache) {
                    const fallback = await refreshGistAgencyCache({ force });
                    fallback.errors = [...(fallback.errors || []), { tipo: 'CODERED', message: error.message }];
                    return fallback;
                }
                return {
                    ...cached,
                    updated: false,
                    source: agencyConfig.source,
                    errors: [...(cached.errors || []), { tipo: 'CODERED', message: error.message }]
                };
            }
        }

        return refreshGistAgencyCache({ force });
    };

    const ensureAgencyCache = async ({ force = false, allowRefresh = true } = {}) => {
        try {
            if (!force && !allowRefresh) {
                const cache = await getCachedAgencyData();
                if (hasLocalCopy(cache)) {
                    return { ...cache, updated: false, errors: [] };
                }
            }

            return await refreshAgencyCache({ force });
        } catch (error) {
            const cache = await getCachedAgencyData();
            return { ...cache, updated: false, errors: [{ tipo: 'GENERAL', message: error.message }] };
        }
    };

    const saveAgencyCache = async ({ terrestre, aereo, gistIds, lastUpdated = Date.now(), cacheDurationMs = AGENCY_CACHE_TTL_MS }) => {
        const currentIds = gistIds || await getConfiguredGistIds();
        const normalizedTerrestre = normalizeAgencyList(terrestre, { segmento: 'TERRESTRE', source: 'local' });
        const normalizedAereo = normalizeAgencyList(aereo, { segmento: 'AEREO', source: 'local' });
        await storageSet({
            [AGENCY_CACHE_KEYS.terrestre]: normalizedTerrestre,
            [AGENCY_CACHE_KEYS.aereo]: normalizedAereo,
            [AGENCY_CACHE_KEYS.lastUpdated]: lastUpdated,
            [AGENCY_CACHE_KEYS.gistIds]: currentIds,
            [AGENCY_CACHE_KEYS.v2]: {
                schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
                source: 'gist',
                apiSchemaVersion: 1,
                syncedAt: lastUpdated,
                lastCheckedAt: lastUpdated,
                cacheDurationMs,
                agencies: [...normalizedTerrestre, ...normalizedAereo],
                agenciasTerrestre: normalizedTerrestre,
                agenciasAereo: normalizedAereo
            }
        });

        return getCachedAgencyData();
    };

    const clearAgencyCache = async () => {
        await storageSet({
            [AGENCY_CACHE_KEYS.terrestre]: [],
            [AGENCY_CACHE_KEYS.aereo]: [],
            [AGENCY_CACHE_KEYS.lastUpdated]: 0,
            [AGENCY_CACHE_KEYS.gistIds]: null,
            [AGENCY_CACHE_KEYS.v2]: {
                schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
                source: 'gist',
                apiSchemaVersion: 1,
                syncedAt: null,
                lastCheckedAt: null,
                cacheDurationMs: AGENCY_CACHE_TTL_MS,
                agencies: [],
                agenciasTerrestre: [],
                agenciasAereo: []
            }
        });
    };

    const getCachedAgencies = async () => {
        const cache = await getCachedAgencyData();
        return {
            schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
            source: cache.source || 'gist',
            syncedAt: cache.syncedAt || null,
            lastCheckedAt: cache.lastCheckedAt || null,
            etag: cache.etag || null,
            cursor: cache.cursor || null,
            cacheDurationMs: cache.cacheDurationMs || AGENCY_CACHE_TTL_MS,
            agencies: Array.isArray(cache.agencies) && cache.agencies.length ? cache.agencies : [...normalizeAgencyList(cache.terrestre, { segmento: 'TERRESTRE', source: cache.source || 'gist' }), ...normalizeAgencyList(cache.aereo, { segmento: 'AEREO', source: cache.source || 'gist' })]
        };
    };

    const fetchAgencies = async () => {
        const cache = await ensureAgencyCache();
        return Array.isArray(cache.agencies) && cache.agencies.length ? cache.agencies : [...cache.terrestre, ...cache.aereo];
    };

    const refreshAgencies = async (options = {}) => refreshAgencyCache(options);
    const refreshAgenciesFromConfiguredSource = async () => refreshAgencyCache({ force: true });

    const prepareAgencies = (agencies, segmento) => normalizeAgencyList(agencies, { segmento, source: 'cache' }).map(agency => ({
        ...agency,
        segmento: agency.segment || segmento,
        _searchText: normalizeText([
            agency.agency,
            agency.department,
            agency.province,
            agency.district,
            agency.address,
            agency.externalId,
            agency.internalId,
            agency.code
        ].filter(Boolean).join(' '))
    }));

    const filterBySearchText = (agencies, query) => {
        const normalizedQuery = normalizeText(query);
        if (!normalizedQuery) return agencies;
        return agencies.filter(agency => agency._searchText.includes(normalizedQuery));
    };

    globalScope.ShalomAgencyStore = {
        DEFAULT_GIST_ID,
        DEFAULT_AEREO_GIST_ID,
        AGENCY_CACHE_TTL_MS,
        AGENCY_CACHE_SCHEMA_VERSION,
        AGENCY_CACHE_V2_KEY,
        getConfiguredGistIds,
        getAgencyConfig,
        saveAgencyConfig,
        clearAgencyConfig,
        getCachedAgencyData,
        getAgencyCacheStatus,
        getCachedAgencies,
        clearAgencyCache,
        fetchAgencies,
        fetchCodeRedAgencies,
        ensureAgencyCache,
        refreshAgencyCache,
        refreshAgencies,
        refreshAgenciesFromConfiguredSource,
        refreshCodeRedAgencyCache,
        applyAgencyChanges,
        saveAgencyCache,
        normalizeAgency,
        getChosenTextForChannel,
        agencyHasChannel,
        normalizeAgencyList,
        prepareAgencies,
        filterBySearchText,
        normalizeText,
        escapeHtml,
        getSafeExternalUrl
    };
})(typeof self !== 'undefined' ? self : window);
