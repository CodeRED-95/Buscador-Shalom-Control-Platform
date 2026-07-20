const sendMessage = (type, payload = {}) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(new Error(lastError.message));
            return;
        }
        if (!response || !response.ok) {
            reject(response?.error || { message: 'Error inesperado' });
            return;
        }
        resolve(response);
    });
});

const tokenInput = document.getElementById('apiToken');
const tokenStatus = document.getElementById('tokenStatus');
const lastSyncValue = document.getElementById('lastSyncValue');
const agencyCountValue = document.getElementById('agencyCountValue');
const sourceValue = document.getElementById('sourceValue');
const schemaValue = document.getElementById('schemaValue');
const syncSummary = document.getElementById('syncSummary');

const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
};

const formatDateTime = (value) => {
    if (!value) return 'Nunca';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

const normalizeToken = (value) => ShalomExtensionShared.normalizeToken(value);

const setConnectionStatus = (text) => setText('tokenStatus', `Estado de conexión: ${text}`);

const refreshReadOnlyStatus = async () => {
    try {
        const [{ status, cache }, { config }] = await Promise.all([
            sendMessage('CATALOG_STATUS'),
            sendMessage('CONFIG_GET')
        ]);
        const agencies = Array.isArray(cache?.agencies) ? cache.agencies.length : 0;
        const sourceLabel = status?.source === 'codered' ? 'CodeRED Platform' : 'Caché local';
        const syncedAt = status?.syncedAt || cache?.syncedAt || cache?.lastSyncAt || null;

        setText('lastSyncValue', formatDateTime(syncedAt));
        setText('agencyCountValue', String(agencies));
        setText('sourceValue', sourceLabel);
        setText('schemaValue', String(cache?.schemaVersion || 3));
        setText('syncSummary', `Fuente: ${sourceLabel} · ${agencies} agencias · última sincronización: ${formatDateTime(syncedAt)}`);

        if (!config?.apiToken) {
            setConnectionStatus('sin configurar');
        }
    } catch {
        setText('lastSyncValue', 'No disponible');
        setText('agencyCountValue', '0');
        setText('sourceValue', 'CodeRED Platform');
        setText('schemaValue', '1');
        setText('syncSummary', 'Última sincronización: no disponible');
    }
};

const loadTokenState = async () => {
    const { config, cache } = await sendMessage('CONFIG_GET');
    const savedToken = normalizeToken(config?.apiToken || '');
    tokenInput.value = savedToken || '';
    tokenInput.placeholder = 'Token de API';
    tokenInput.type = 'password';
    document.getElementById('toggleApiToken').textContent = 'Mostrar';

    if (savedToken) {
        tokenInput.value = savedToken;
        setConnectionStatus('conectado');
    } else if (cache?.agencies?.length) {
        setConnectionStatus('usando caché local');
    } else {
        setConnectionStatus('sin configurar');
    }
};

const saveToken = async () => {
    const token = normalizeToken(tokenInput.value);
    const result = await sendMessage('CONFIG_SAVE', {
        config: {
            apiToken: token
        }
    });
    if (token) {
        setConnectionStatus('conectando...');
        const test = await testConnection({ silent: true });
        if (test.ok) {
            setConnectionStatus('conectado');
            await refreshReadOnlyStatus();
            return result.sync || result;
        }
        await refreshReadOnlyStatus();
        return null;
    }
    setConnectionStatus('sin configurar');
    await refreshReadOnlyStatus();
    return null;
};

const testConnection = async ({ silent = false } = {}) => {
    const token = normalizeToken(tokenInput.value);
    if (!token) {
        if (!silent) alert('Primero ingresa un token.');
        setConnectionStatus('sin configurar');
        return { ok: false };
    }

    try {
        setConnectionStatus('conectando...');
        const me = await CodeRedApi.fetchCurrentTokenInfo(ShalomExtensionShared.CODERED_API_BASE_URL, token);
        const metadata = await CodeRedApi.fetchCatalogMetadata(ShalomExtensionShared.CODERED_API_BASE_URL, token);
        const abilities = Array.isArray(me?.abilities) ? me.abilities : [];
        const canRead = abilities.includes('agencies:read') || abilities.includes('*');
        const total = metadata?.json?.total_agencies ?? metadata?.json?.total ?? metadata?.json?.data?.total ?? 0;
        const schemaVersion = metadata?.json?.schema_version ?? metadata?.json?.api_schema_version ?? 1;

        setText('agencyCountValue', String(total || 0));
        setText('schemaValue', String(schemaVersion || 1));
        setText('syncSummary', `Fuente: CodeRED Platform · ${total || 0} agencias · versión de esquema: ${schemaVersion || 1}`);

        if (!canRead) {
            setConnectionStatus('token válido, pero sin permiso agencies:read');
            if (!silent) alert('El token es válido, pero no tiene el permiso agencies:read.');
            return { ok: false, abilities };
        }

        setConnectionStatus('conectado');
        if (!silent) {
            alert(`Conexión correcta. Token válido con acceso al catálogo.\nAbilities: ${abilities.join(', ') || 'ninguna'}\nTotal de agencias: ${total || 0}\nVersión de esquema: ${schemaVersion || 1}`);
        }
        return { ok: true, abilities, total, schemaVersion };
    } catch (err) {
        const code = err?.status || err?.type;
        if (code === 401 || code === 'UNAUTHORIZED') {
            setConnectionStatus('token inválido');
            if (!silent) alert('Token inválido, expirado o revocado.');
        } else if (code === 403 || code === 'FORBIDDEN') {
            setConnectionStatus('token sin permiso');
            if (!silent) alert('El token es válido, pero no tiene el permiso agencies:read.');
        } else if (code === 429 || code === 'RATE_LIMIT') {
            setConnectionStatus('rate limit temporal');
            if (!silent) alert('Se alcanzó temporalmente el límite de solicitudes.');
        } else if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
            setConnectionStatus('sin conexión');
            if (!silent) alert('No fue posible conectar con CodeRED Platform.');
        } else {
            setConnectionStatus('sin conexión');
            if (!silent) alert('No fue posible conectar con CodeRED Platform.');
        }
        return { ok: false, error: err };
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    ShalomExtensionShared.applyStoredTheme(document.body);
    await loadTokenState();
    await refreshReadOnlyStatus();
});

document.getElementById('theme-toggle-opt').onclick = () => {
    ShalomExtensionShared.toggleStoredTheme(document.body);
};

document.getElementById('toggleApiToken').onclick = () => {
    const input = document.getElementById('apiToken');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    document.getElementById('toggleApiToken').textContent = isPassword ? 'Ocultar' : 'Mostrar';
};

document.getElementById('saveTokenBtn').onclick = async () => {
    try {
        const result = await saveToken();
        if (result) alert('Token guardado y sincronización iniciada.');
        else alert('Token guardado.');
    } catch (err) {
        console.error('Error al guardar token:', err);
        alert('No fue posible guardar el token.');
    }
};

document.getElementById('testConnectionBtn').onclick = async () => {
    await testConnection();
};

document.getElementById('clearTokenBtn').onclick = async () => {
    if (!confirm('¿Quieres limpiar solo el token? La caché local se mantendrá.')) return;
    try {
        await sendMessage('CONFIG_SAVE', { config: { apiToken: '' } });
        tokenInput.value = '';
        setConnectionStatus('sin configurar');
        await refreshReadOnlyStatus();
        alert('Token eliminado. La caché local se mantiene.');
    } catch (err) {
        console.error('Error al limpiar token:', err);
        alert('No fue posible limpiar el token.');
    }
};
