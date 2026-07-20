const AGENCY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AGENCY_CACHE_SCHEMA_VERSION = 3;
const AGENCY_CACHE_V2_KEY = 'agencyCatalogCache';
const AGENCY_CONFIG_KEY = 'agencyDataConfig';
const CoderedPlatformApiUrl = () => (typeof ShalomExtensionShared !== 'undefined' && ShalomExtensionShared.CODERED_API_BASE_URL)
    || 'https://platform.codered.host/api/v1';
const DEFAULT_AGENCY_CONFIG = {
    source: 'codered',
    apiToken: '',
    cacheDurationMs: AGENCY_CACHE_TTL_MS,
    lastSyncAt: null
};
const AGENCY_CACHE_KEYS = {
    terrestre: 'agenciasTerrestre',
    aereo: 'agenciasAereo',
    lastUpdated: 'agenciasLastUpdated',
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
    const splitAgenciesByChannel = (agencies = []) => {
        const terrestre = [];
        const aereo = [];
        normalizeAgencyList(agencies, { source: 'codered' }).forEach((agency) => {
            if (agencyHasChannel(agency, 'TERRESTRE')) terrestre.push(agency);
            if (agencyHasChannel(agency, 'AEREO')) aereo.push(agency);
        });
        return { terrestre, aereo };
    };
    const serializeSafeError = (error) => {
        if (error instanceof Error) {
            return { name: error.name, message: error.message };
        }
        if (error && typeof error === 'object') {
            return {
                code: error.code ?? error.tipo ?? 'unknown',
                message: error.message ?? 'Error no identificado',
                status: error.status ?? null
            };
        }
        return { code: 'unknown', message: String(error) };
    };

    const sanitizeAgencyConfig = (config = {}) => ({
            source: 'codered',
            apiToken: toNullableString(config.apiToken) || '',
            cacheDurationMs: toNumberOrNull(config.cacheDurationMs) || DEFAULT_AGENCY_CONFIG.cacheDurationMs,
            lastSyncAt: toNullableString(config.lastSyncAt)
        });

    const getAgencyConfig = async () => {
        const tokenKey = typeof ShalomExtensionShared !== 'undefined' ? ShalomExtensionShared.CODERED_TOKEN_STORAGE_KEY : 'coderedApiToken';
        const items = await storageGet([AGENCY_CONFIG_KEY, tokenKey]);
        return {
            ...sanitizeAgencyConfig({
                ...(items[AGENCY_CONFIG_KEY] || {}),
                apiToken: items[tokenKey] || items[AGENCY_CONFIG_KEY]?.apiToken || ''
            }),
            apiBaseUrl: CoderedPlatformApiUrl()
        };
    };

    const saveAgencyConfig = async (config = {}) => {
        const next = sanitizeAgencyConfig(config);
        await storageSet({ [AGENCY_CONFIG_KEY]: next });
        const tokenKey = typeof ShalomExtensionShared !== 'undefined' ? ShalomExtensionShared.CODERED_TOKEN_STORAGE_KEY : 'coderedApiToken';
        await storageSet({ [tokenKey]: next.apiToken });
        return {
            ...next,
            apiBaseUrl: CoderedPlatformApiUrl()
        };
    };

    const clearAgencyConfig = async () => {
        await saveAgencyConfig(DEFAULT_AGENCY_CONFIG);
    };

    const getCachedAgencyData = async () => {
        const items = await storageGet([
            AGENCY_CACHE_KEYS.terrestre,
            AGENCY_CACHE_KEYS.aereo,
            AGENCY_CACHE_KEYS.lastUpdated,
            AGENCY_CACHE_KEYS.v2
        ]);

        const cacheV2 = isPlainObject(items[AGENCY_CACHE_KEYS.v2]) ? items[AGENCY_CACHE_KEYS.v2] : null;
        const hasTerrestre = Array.isArray(items[AGENCY_CACHE_KEYS.terrestre]);
        const hasAereo = Array.isArray(items[AGENCY_CACHE_KEYS.aereo]);
        const v3Agencies = Array.isArray(cacheV2?.agencies) ? cacheV2.agencies : [];
        const agencies = v3Agencies.length ? v3Agencies : [...(hasTerrestre ? items[AGENCY_CACHE_KEYS.terrestre] : []), ...(hasAereo ? items[AGENCY_CACHE_KEYS.aereo] : [])];
        const derivedByChannel = splitAgenciesByChannel(agencies);

        return {
            schemaVersion: Number(cacheV2?.schemaVersion || (hasTerrestre || hasAereo ? 2 : 0)),
            source: cacheV2?.source || null,
            syncedAt: cacheV2?.syncedAt || null,
            lastCheckedAt: cacheV2?.lastCheckedAt || null,
            etag: cacheV2?.etag || null,
            cursor: cacheV2?.cursor || null,
            cacheDurationMs: cacheV2?.cacheDurationMs || AGENCY_CACHE_TTL_MS,
            agencies,
            terrestre: hasTerrestre ? items[AGENCY_CACHE_KEYS.terrestre] : derivedByChannel.terrestre,
            aereo: hasAereo ? items[AGENCY_CACHE_KEYS.aereo] : derivedByChannel.aereo,
            lastUpdated: toTimestampOrNull(items[AGENCY_CACHE_KEYS.lastUpdated] || cacheV2?.syncedAt) || 0,
            hasTerrestre,
            hasAereo,
            errors: Array.isArray(cacheV2?.errors) ? cacheV2.errors : []
        };
    };

    const isExpired = (lastUpdated, ttl = AGENCY_CACHE_TTL_MS) => !lastUpdated || (Date.now() - lastUpdated) >= ttl;
    const hasLocalCopy = (cache) => cache.hasTerrestre && cache.hasAereo;
    const getAgencyCacheStatus = async () => {
        const [cache, config] = await Promise.all([getCachedAgencyData(), getAgencyConfig()]);
        const ttl = config.cacheDurationMs || cache.cacheDurationMs || AGENCY_CACHE_TTL_MS;
        const source = config.source || cache.source || 'codered';
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
        source: patch.source || cache.source || 'codered',
        apiSchemaVersion: 1,
        etag: patch.etag ?? cache.etag ?? null,
        cursor: patch.cursor ?? cache.cursor ?? null,
        syncedAt: patch.syncedAt ?? cache.syncedAt ?? null,
        lastCheckedAt: patch.lastCheckedAt ?? cache.lastCheckedAt ?? null,
        lastAgencyUpdate: patch.lastAgencyUpdate ?? cache.lastAgencyUpdate ?? null,
        cacheDurationMs: patch.cacheDurationMs ?? cache.cacheDurationMs ?? AGENCY_CACHE_TTL_MS,
        agencies: Array.isArray(patch.agencies) ? patch.agencies : (Array.isArray(cache.agencies) ? cache.agencies : []),
        agenciasTerrestre: Array.isArray(patch.terrestre) ? patch.terrestre : (Array.isArray(cache.terrestre) ? cache.terrestre : []),
        agenciasAereo: Array.isArray(patch.aereo) ? patch.aereo : (Array.isArray(cache.aereo) ? cache.aereo : [])
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
        const [, agencyConfig] = await Promise.all([getCachedAgencyData(), getAgencyConfig()]);
        try {
            const refreshed = await refreshCodeRedAgencyCache({ force });
            await saveAgencyConfig({
                ...agencyConfig,
                source: 'codered',
                lastSyncAt: new Date(refreshed.syncedAt || Date.now()).toISOString()
            });
            return {
                ...refreshed,
                source: 'codered',
                updated: true,
                errors: []
            };
        } catch (error) {
            const cached = await getCachedAgencyData();
            const fallbackEntry = {
                type: 'fallback_used',
                source: 'codered',
                reason: 'code_red_unavailable',
                checkedAt: new Date().toISOString()
            };
            await storageSet({
                agencyFallbackState: fallbackEntry
            });
            return {
                ...cached,
                updated: false,
                source: 'codered',
                errors: [...(cached.errors || []), serializeSafeError(error)]
            };
        }
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

    const saveAgencyCache = async ({ terrestre, aereo, lastUpdated = Date.now(), cacheDurationMs = AGENCY_CACHE_TTL_MS }) => {
        const normalizedTerrestre = normalizeAgencyList(terrestre, { segmento: 'TERRESTRE', source: 'local' });
        const normalizedAereo = normalizeAgencyList(aereo, { segmento: 'AEREO', source: 'local' });
        await storageSet({
            [AGENCY_CACHE_KEYS.terrestre]: normalizedTerrestre,
            [AGENCY_CACHE_KEYS.aereo]: normalizedAereo,
            [AGENCY_CACHE_KEYS.lastUpdated]: lastUpdated,
            [AGENCY_CACHE_KEYS.v2]: {
                schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
                source: 'codered',
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
            [AGENCY_CACHE_KEYS.v2]: {
                schemaVersion: AGENCY_CACHE_SCHEMA_VERSION,
                source: 'codered',
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
            source: cache.source || 'codered',
            syncedAt: cache.syncedAt || null,
            lastCheckedAt: cache.lastCheckedAt || null,
            etag: cache.etag || null,
            cursor: cache.cursor || null,
            cacheDurationMs: cache.cacheDurationMs || AGENCY_CACHE_TTL_MS,
            agencies: Array.isArray(cache.agencies) && cache.agencies.length ? cache.agencies : [...normalizeAgencyList(cache.terrestre, { segmento: 'TERRESTRE', source: cache.source || 'codered' }), ...normalizeAgencyList(cache.aereo, { segmento: 'AEREO', source: cache.source || 'codered' })]
        };
    };

    const fetchAgencies = async () => {
        const cache = await ensureAgencyCache();
        return Array.isArray(cache.agencies) && cache.agencies.length ? cache.agencies : [...cache.terrestre, ...cache.aereo];
    };

    const refreshAgencies = async (options = {}) => refreshAgencyCache(options);

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
        AGENCY_CACHE_TTL_MS,
        AGENCY_CACHE_SCHEMA_VERSION,
        AGENCY_CACHE_V2_KEY,
        getAgencyConfig,
        saveAgencyConfig,
        clearAgencyConfig,
        getCachedAgencyData,
        getAgencyCacheStatus,
        getCachedAgencies,
        clearAgencyCache,
        fetchAgencies,
        ensureAgencyCache,
        refreshAgencyCache,
        refreshAgencies,
        refreshCodeRedAgencyCache,
        applyAgencyChanges,
        saveAgencyCache,
        serializeSafeError,
        isAgencyCO: (value) => value === true
            || String(value).toUpperCase() === 'TRUE'
            || String(value).toUpperCase() === 'SI'
            || String(value).toUpperCase() === 'S'
            || value === '1'
            || value === 1,
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
