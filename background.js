importScripts('agencyStore.js', 'coderedApi.js');

const AGENCY_REFRESH_ALARM = 'shalom-agencies-refresh';
const REFRESH_PERIOD_MINUTES = 24 * 60;
let activeSyncPromise = null;

const scheduleAgencyRefresh = () => {
    chrome.alarms.create(AGENCY_REFRESH_ALARM, {
        periodInMinutes: REFRESH_PERIOD_MINUTES
    });
};

const initializeAgencyCache = async () => {
    scheduleAgencyRefresh();
    try {
        const result = await ShalomAgencyStore.ensureAgencyCache();
        if (result.errors && result.errors.length) {
            console.warn('[Shalom Pro] Cache de agencias inicializado con copia local. Errores:', result.errors);
        }
    } catch (error) {
        console.error('[Shalom Pro] Error al inicializar el cache de agencias:', error);
    }
};

const serializeError = (error) => ({
    type: error?.type || 'GENERAL',
    message: error?.message || 'Error inesperado',
    status: error?.status || null
});

const getCatalogPayload = async () => {
    const cache = await ShalomAgencyStore.getCachedAgencies();
    const status = await ShalomAgencyStore.getAgencyCacheStatus();
    return { cache, status };
};

const syncCatalog = async () => {
    if (activeSyncPromise) return activeSyncPromise;
    activeSyncPromise = (async () => {
        const result = await ShalomAgencyStore.refreshAgencyCache({ force: true });
        return {
            source: result.source || 'gist',
            total: Array.isArray(result.agencies) ? result.agencies.length : 0,
            syncedAt: result.syncedAt || Date.now(),
            errors: result.errors || []
        };
    })().finally(() => {
        activeSyncPromise = null;
    });
    return activeSyncPromise;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload = {} } = message || {};
    const respond = (value) => sendResponse({ ok: true, ...value });
    const reject = (error) => sendResponse({ ok: false, error: serializeError(error) });

    if (!type) return;
    if (type === 'CATALOG_GET') {
        getCatalogPayload().then(respond).catch(reject);
        return true;
    }
    if (type === 'CATALOG_SYNC') {
        syncCatalog().then(respond).catch(reject);
        return true;
    }
    if (type === 'CATALOG_STATUS') {
        ShalomAgencyStore.getAgencyCacheStatus().then((status) => respond({ status })).catch(reject);
        return true;
    }
    if (type === 'API_TEST_CONNECTION') {
        CodeRedApi.fetchCurrentTokenInfo(payload.apiBaseUrl, payload.apiToken)
            .then((info) => respond({ info }))
            .catch(reject);
        return true;
    }
    if (type === 'CONFIG_GET') {
        Promise.all([ShalomAgencyStore.getAgencyConfig(), ShalomAgencyStore.getCachedAgencies()])
            .then(([config, cache]) => respond({ config, cache }))
            .catch(reject);
        return true;
    }
    if (type === 'CONFIG_SAVE') {
        ShalomAgencyStore.saveAgencyConfig(payload.config || {})
            .then((config) => respond({ config }))
            .catch(reject);
        return true;
    }
});

chrome.runtime.onInstalled.addListener(() => {
    initializeAgencyCache();
});

chrome.runtime.onStartup.addListener(() => {
    initializeAgencyCache();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== AGENCY_REFRESH_ALARM) return;

    ShalomAgencyStore.refreshAgencyCache({ force: true }).then((result) => {
        if (result.errors && result.errors.length) {
            console.warn('[Shalom Pro] No se pudo actualizar todo el cache de agencias:', result.errors);
        }
    }).catch((error) => {
        console.error('[Shalom Pro] Error al ejecutar la actualizacion programada:', error);
    });
});
