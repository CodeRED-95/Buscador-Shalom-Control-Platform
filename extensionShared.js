const ShalomExtensionShared = (() => {
    const CODERED_PLATFORM_ORIGIN = 'https://platform.codered.host';
    const API_BASE_PATH = '/api/v1';
    const CODERED_API_BASE_URL = `${CODERED_PLATFORM_ORIGIN}${API_BASE_PATH}`;
    const CODERED_TOKEN_STORAGE_KEY = 'coderedApiToken';

    const getStoredTheme = () => new Promise((resolve) => {
        chrome.storage.local.get(['pref_tema'], (items) => {
            resolve(items?.pref_tema === 'dark' ? 'dark' : 'light');
        });
    });

    const normalizeToken = (value) => String(value ?? '')
        .trim()
        .replace(/^Bearer\s+/i, '');

    const maskToken = (value) => {
        const normalized = normalizeToken(value);
        if (!normalized) return '';
        if (normalized.length <= 8) return '••••••••';
        return `${normalized.slice(0, 4)}••••••${normalized.slice(-4)}`;
    };

    const applyStoredTheme = async (root = document.body) => {
        if (!root) return 'light';
        const theme = await getStoredTheme();
        root.classList.toggle('dark-theme', theme === 'dark');
        return theme;
    };

    const toggleStoredTheme = (root = document.body) => {
        if (!root) return 'light';
        const isDark = root.classList.toggle('dark-theme');
        chrome.storage.local.set({ pref_tema: isDark ? 'dark' : 'light' });
        return isDark ? 'dark' : 'light';
    };

    return {
        CODERED_PLATFORM_ORIGIN,
        API_BASE_PATH,
        CODERED_API_BASE_URL,
        CODERED_TOKEN_STORAGE_KEY,
        getStoredTheme,
        normalizeToken,
        maskToken,
        applyStoredTheme,
        toggleStoredTheme
    };
})();
