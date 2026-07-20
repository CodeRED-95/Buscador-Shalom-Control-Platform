const ShalomExtensionShared = (() => {
    const getStoredTheme = () => new Promise((resolve) => {
        chrome.storage.local.get(['pref_tema'], (items) => {
            resolve(items?.pref_tema === 'dark' ? 'dark' : 'light');
        });
    });

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
        getStoredTheme,
        applyStoredTheme,
        toggleStoredTheme
    };
})();

