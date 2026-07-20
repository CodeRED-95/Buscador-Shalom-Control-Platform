document.addEventListener('DOMContentLoaded', () => {
    ShalomExtensionShared.applyStoredTheme(document.body);

    const btnTema = document.getElementById('theme-toggle-popup');
    btnTema.onclick = () => ShalomExtensionShared.toggleStoredTheme(document.body);

    document.getElementById('btnAjustes')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
