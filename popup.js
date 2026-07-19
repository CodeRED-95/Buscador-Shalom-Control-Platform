document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema guardado para que combine con el buscador
    chrome.storage.local.get(['pref_tema'], (res) => {
        if (res.pref_tema === 'dark') {
            document.body.classList.add('dark-theme');
        }
    });

    // Lógica para alternar tema
    const btnTema = document.getElementById('theme-toggle-popup');
    btnTema.onclick = () => {
        const esOscuro = document.body.classList.toggle('dark-theme');
        chrome.storage.local.set({ pref_tema: esOscuro ? 'dark' : 'light' });
    };

    document.getElementById('btnVerAgencias')?.addEventListener('click', () => {
        window.open('grid.html', '_blank');
    });

    document.getElementById('btnAjustes')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});