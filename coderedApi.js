const CODE_RED_API_TIMEOUT_MS = 15000;
const CODE_RED_DEFAULT_PER_PAGE = 100;
const CODE_RED_MAX_PAGES = 100;

(function initCodeRedApi(globalScope) {
    const normalizeBaseUrl = (value) => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim().replace(/\/+$/, '');
        if (!trimmed) return '';
        if (!/^https?:\/\//i.test(trimmed)) return '';
        if (/\/api\/v\d+\/.*$/i.test(trimmed)) return '';
        return trimmed;
    };

    const buildApiUrl = (baseUrl, path, params = {}) => {
        const normalizedBase = normalizeBaseUrl(baseUrl);
        if (!normalizedBase) throw new Error('URL base inválida');
        const base = new URL(normalizedBase);
        const cleanPath = String(path || '').replace(/^\/+/, '');
        const url = new URL(`/api/v1/${cleanPath}`, base);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    };

    const createError = (type, message, status = null) => ({ type, message, status });

    const request = async (baseUrl, path, { token = '', method = 'GET', headers = {}, body = null, timeoutMs = CODE_RED_API_TIMEOUT_MS, params = {} } = {}) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const requestHeaders = {
            Accept: 'application/json',
            ...headers
        };
        if (token) requestHeaders.Authorization = `Bearer ${token}`;
        if (body !== null && body !== undefined && method !== 'GET' && method !== 'HEAD') {
            requestHeaders['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(buildApiUrl(baseUrl, path, params), {
                method,
                headers: requestHeaders,
                body: body !== null && body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal
            });
            const text = await response.text();
            let json = null;
            if (text) {
                try {
                    json = JSON.parse(text);
                } catch {
                    throw createError('INVALID_JSON', 'Respuesta JSON inválida', response.status);
                }
            }
            if (!response.ok) {
                const typeByStatus = {
                    401: 'UNAUTHORIZED',
                    403: 'FORBIDDEN',
                    404: 'NOT_FOUND',
                    422: 'UNPROCESSABLE_ENTITY',
                    429: 'RATE_LIMIT',
                    500: 'SERVER_ERROR'
                };
                throw createError(typeByStatus[response.status] || 'HTTP_ERROR', 'Solicitud fallida', response.status);
            }
            return { response, json };
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw createError('TIMEOUT', 'La solicitud excedió el tiempo permitido');
            }
            if (error?.type) throw error;
            if (String(error?.message || '').includes('Failed to fetch') || String(error?.message || '').includes('NetworkError')) {
                throw createError('NETWORK_ERROR', 'No fue posible conectar con CodeRED Platform');
            }
            throw createError('UNKNOWN', 'Error inesperado en la solicitud');
        } finally {
            clearTimeout(timer);
        }
    };

    const fetchCurrentTokenInfo = async (baseUrl, token) => {
        const { json } = await request(baseUrl, 'me', { token });
        return json;
    };

    const fetchCatalogMetadata = async (baseUrl, token) => {
        const { json } = await request(baseUrl, 'catalog/metadata', { token });
        return json;
    };

    const fetchAgenciesPage = async (baseUrl, token, page = 1, perPage = CODE_RED_DEFAULT_PER_PAGE) => {
        const { json } = await request(baseUrl, 'agencies', { token, params: { page, per_page: perPage } });
        if (Array.isArray(json)) {
            return { data: json, links: {}, meta: { current_page: page, last_page: page, per_page: perPage, total: json.length } };
        }
        const data = Array.isArray(json?.data) ? json.data : null;
        if (!Array.isArray(data)) {
            throw createError('INVALID_STRUCTURE', 'La respuesta de agencies no contiene data[]');
        }
        return {
            data,
            links: json.links || {},
            meta: json.meta || { current_page: page, last_page: page, per_page: perPage, total: data.length }
        };
    };

    const fetchAllAgencies = async (baseUrl, token, { perPage = CODE_RED_DEFAULT_PER_PAGE, maxPages = CODE_RED_MAX_PAGES, onProgress = null } = {}) => {
        const agencies = [];
        let page = 1;
        let lastPage = 1;
        let previousFingerprint = '';
        while (page <= maxPages) {
            const result = await fetchAgenciesPage(baseUrl, token, page, perPage);
            const data = Array.isArray(result.data) ? result.data : [];
            const fingerprint = JSON.stringify(data.slice(0, 3));
            if (page > 1 && data.length === 0) {
                throw createError('EMPTY_PAGE', `La página ${page} llegó vacía`);
            }
            if (fingerprint && fingerprint === previousFingerprint) {
                throw createError('REPEATED_PAGE', `La página ${page} repite contenido`);
            }
            previousFingerprint = fingerprint;
            agencies.push(...data);
            const metaLastPage = Number(result.meta?.last_page || 0);
            const linkNext = result.links?.next;
            lastPage = metaLastPage || lastPage;
            if (typeof onProgress === 'function') {
                onProgress({ page, lastPage, received: agencies.length, total: Number(result.meta?.total || agencies.length) });
            }
            if (!linkNext && page >= lastPage) break;
            if (!metaLastPage && !linkNext) break;
            page += 1;
        }
        if (page > maxPages) {
            throw createError('MAX_PAGES_EXCEEDED', 'Se superó el límite de páginas permitido');
        }
        return agencies;
    };

    globalScope.CodeRedApi = {
        CODE_RED_API_TIMEOUT_MS,
        CODE_RED_DEFAULT_PER_PAGE,
        CODE_RED_MAX_PAGES,
        normalizeBaseUrl,
        buildApiUrl,
        request,
        fetchCurrentTokenInfo,
        fetchCatalogMetadata,
        fetchAgenciesPage,
        fetchAllAgencies
    };
})(typeof self !== 'undefined' ? self : window);
