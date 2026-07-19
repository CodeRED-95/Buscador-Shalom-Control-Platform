let allAgencies = [];
let lastFiltered = [];

async function init() {
    chrome.storage.local.get(['pref_tema'], async (items) => {
        if (items.pref_tema === 'dark') document.body.classList.add('dark-theme');
        
        try {
            const cache = await ShalomAgencyStore.ensureAgencyCache({ allowRefresh: false });
            const agenciesT = ShalomAgencyStore.prepareAgencies(cache.terrestre, 'TERRESTRE');
            const agenciesA = ShalomAgencyStore.prepareAgencies(cache.aereo, 'AEREO');

            allAgencies = [...agenciesT, ...agenciesA];
            render();
        } catch (err) {
            document.getElementById('stats').innerText = "Error al cargar agencias locales.";
            console.error(err);
        }
    });
}

const isCO = (val) => val === true || String(val).toUpperCase() === 'TRUE' || String(val).toUpperCase() === 'SI' || String(val).toUpperCase() === 'S' || val === '1' || val === 1;

const getChannelBadge = (agency) => {
    const hasTerr = Boolean(ShalomAgencyStore.getChosenTextForChannel(agency, 'TERRESTRE'));
    const hasAereo = Boolean(ShalomAgencyStore.getChosenTextForChannel(agency, 'AEREO'));
    if (hasTerr && hasAereo) return 'Ambos';
    if (hasTerr) return 'Terrestre';
    if (hasAereo) return 'Aéreo';
    return 'Sin identificador';
};

function render() {
    const searchVal = document.getElementById('search').value;
    const normalizedSearch = ShalomAgencyStore.normalizeText(searchVal);
    const segmentFilter = document.getElementById('filterSegment').value;
    const typeFilter = document.getElementById('filterType').value;
    const sizeFilter = document.getElementById('filterSize').value;

    lastFiltered = allAgencies.filter(a => {
        const matchesSearch = !normalizedSearch || a._searchText.includes(normalizedSearch);
        const matchesSegment = segmentFilter === 'TODOS' || a.segmento === segmentFilter;
        const matchesType = typeFilter === 'TODOS' || (typeFilter === 'CO' ? isCO(a.co) : !isCO(a.co));
        const matchesSize = sizeFilter === 'TODOS' || a.tamano === sizeFilter;

        return matchesSearch && matchesSegment && matchesType && matchesSize;
    });

    const grid = document.getElementById('grid');
    const escape = ShalomAgencyStore.escapeHtml;
    grid.innerHTML = lastFiltered.map((a, index) => `
        <div class="card" data-index="${index}" style="cursor: pointer;">
            <div style="margin-bottom: 10px;">
                <span class="badge badge-segment">${a.segmento === 'AEREO' ? '✈️ Aéreo' : '🚛 Terrestre'}</span>
                <span class="badge" style="background:#eceff1;color:#37474f;border:1px solid #cfd8dc;">${getChannelBadge(a)}</span>
                ${isCO(a.co) ? '<span class="badge badge-co">🛡️ AGENCIA CO</span>' : ''}
                <span class="badge badge-tamano">📏 ${escape(a.tamano || 'Mediana')}</span>
            </div>
            <b>${escape(String(a.agencia || '').toUpperCase())}</b>
            <div class="info">
                📍 <strong>${escape(a.departamento)}</strong> / ${escape(a.provincia)} / ${escape(a.distrito)}
                <span class="direccion">${escape(a.direccion)}</span>
            </div>
            <div class="footer-id">ID de Agencia: ${escape(a.id || 'N/A')}</div>
        </div>
    `).join('');

    document.getElementById('stats').innerText = `Encontradas ${lastFiltered.length} agencias (${allAgencies.length} en total).`;
}

// Usar delegación de eventos para evitar manejadores inline que violan la CSP
document.getElementById('grid').addEventListener('click', (e) => {
    // Si hizo clic en el icono de mapa, no abrir el detalle
    if (e.target.classList.contains('map-shortcut')) return;
    
    const card = e.target.closest('.card');
    if (card) {
        const index = parseInt(card.dataset.index);
        if (!isNaN(index)) {
            openDetail(index);
        }
    }
});

const openDetail = (index) => {
    const a = lastFiltered[index];
    if (!a) return;

    const modal = document.getElementById('detailModal');
    const body = document.getElementById('modalBody');
    const escape = ShalomAgencyStore.escapeHtml;
    const mapUrl = ShalomAgencyStore.getSafeExternalUrl(a.link_mapa);
    
    body.innerHTML = `
        <div style="margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap;">
            <span class="badge badge-segment" style="font-size: 15px; padding: 4px 12px;">${a.segmento === 'AEREO' ? '✈️ Aéreo' : '🚛 Terrestre'}</span>
            <span class="badge" style="font-size: 15px; padding: 4px 12px; background:#eceff1;color:#37474f;border:1px solid #cfd8dc;">${getChannelBadge(a)}</span>
            ${isCO(a.co) ? '<span class="badge badge-co" style="font-size: 15px; padding: 4px 12px;">🛡️ AGENCIA CO</span>' : ''}
            <span class="badge badge-tamano" style="font-size: 15px; padding: 4px 12px;">📏 Tamaño: ${escape(a.tamano || 'Mediana')}</span>
        </div>
        <b>${escape(String(a.agencia || '').toUpperCase())}</b>
        <div class="info">
            <p>📍 <strong>Departamento:</strong> ${escape(a.departamento)}</p>
            <p>🏙️ <strong>Provincia / Distrito:</strong> ${escape(a.provincia)} / ${escape(a.distrito)}</p>
            <p>🏠 <strong>Dirección Exacta:</strong><br>${escape(a.direccion)}</p>
        </div>
        ${mapUrl ? `
            <div style="margin-top: 20px;">
                <a href="${escape(mapUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration: none;">
                    <button style="background: #1976d2; color: white; border: none; padding: 12px 15px; border-radius: 8px; font-weight: 600; cursor: pointer; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px;">
                        📍 MAPA (Google Maps)
                    </button>
                </a>
            </div>
        ` : ''}
        <div class="footer-id" style="font-size: 14px; margin-top: 30px;">ID de Agencia: ${escape(a.id || 'N/A')}</div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

const closeDetail = () => {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};

// Cerrar al hacer click fuera
document.getElementById('detailModal').onclick = (e) => {
    if (e.target.id === 'detailModal') closeDetail();
};

// Listeners para filtros automáticos
document.querySelectorAll('.controls input, .controls select').forEach(el => {
    el.addEventListener('input', render);
});

init();
