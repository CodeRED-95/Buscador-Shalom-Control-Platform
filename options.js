let agenciasTerrestre = [];
let agenciasAereo = [];
let currentType = 'TERRESTRE';
const CHANNEL_STORAGE_KEY = 'pref_canal_agencia';

const sendMessage = (type, payload = {}) => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            reject(new Error(lastError.message));
            return;
        }
        if (!response || !response.ok) {
            const error = response?.error || { message: 'Error inesperado' };
            reject(error);
            return;
        }
        resolve(response);
    });
});

const setStatusText = (text) => {
    const el = document.getElementById('cacheStatus');
    if (el) el.textContent = text;
};

const setSyncSummary = (text) => {
    const el = document.getElementById('syncSummary');
    if (el) el.textContent = text;
};

const formatSyncSummary = (status, cache) => {
    if (!status) return 'Última sincronización: nunca';
    const sourceLabel = status.source === 'codered' ? 'CodeRED Platform' : status.source === 'codered-with-gist-fallback' ? 'CodeRED + Gist fallback' : 'Gist';
    const total = cache?.agencies?.length ?? cache?.total ?? 0;
    const syncedAt = status.syncedAt || cache?.syncedAt || cache?.lastSyncAt || null;
    return `Fuente activa: ${sourceLabel} · ${total} agencias · última sincronización: ${syncedAt || 'nunca'}`;
};

const updateStatusUI = async () => {
    try {
        const { status, cache } = await sendMessage('CATALOG_STATUS');
        const modeLabel = status.source === 'codered' ? 'CodeRED Platform' : status.source === 'codered-with-gist-fallback' ? 'CodeRED Platform · Gist fallback' : 'Gist';
        const freshnessLabel = status.stale ? 'vencida' : 'vigente';
        const offlineLabel = status.offline ? ' - modo offline' : '';
        setStatusText(`Estado de caché: ${modeLabel} / ${freshnessLabel}${offlineLabel}`);
        setSyncSummary(formatSyncSummary(status, cache));
    } catch (err) {
        setStatusText('Estado de caché: no disponible');
        setSyncSummary('Última sincronización: no disponible');
    }
};

const refreshLocalLists = async () => {
    const response = await sendMessage('CATALOG_GET');
    agenciasTerrestre = response.cache?.terrestre || [];
    agenciasAereo = response.cache?.aereo || [];
    return response;
};

window.onload = async () => {
    chrome.storage.local.get(['ghToken', 'pref_tema', 'agencyDataConfig', CHANNEL_STORAGE_KEY], async (items) => {
        if (items.ghToken) document.getElementById('ghToken').value = items.ghToken;
        if (items.pref_tema === 'dark') document.body.classList.add('dark-theme');
        const savedChannel = ['AUTO', 'TERRESTRE', 'AEREO'].includes(items[CHANNEL_STORAGE_KEY]) ? items[CHANNEL_STORAGE_KEY] : 'TERRESTRE';
        chrome.storage.local.set({ [CHANNEL_STORAGE_KEY]: savedChannel });

        try {
            const config = items.agencyDataConfig || (await sendMessage('CONFIG_GET')).config;
            document.getElementById('dataSource').value = config.source || 'codered-with-gist-fallback';
            document.getElementById('apiBaseUrl').value = config.apiBaseUrl || '';
            document.getElementById('apiToken').value = config.apiToken || '';
            await refreshLocalLists();
            await updateStatusUI();
        } catch (err) {
            console.error('Error al cargar configuración inicial:', err);
        } finally {
            renderTable();
        }
    });
};

const isCO = (val) => val === true || String(val).toUpperCase() === 'TRUE' || String(val).toUpperCase() === 'SI' || String(val).toUpperCase() === 'S' || val === '1' || val === 1;

document.getElementById('theme-toggle-opt').onclick = () => {
    const esOscuro = document.body.classList.toggle('dark-theme');
    chrome.storage.local.set({ pref_tema: esOscuro ? 'dark' : 'light' });
};

document.getElementById('toggleApiToken').onclick = () => {
    const input = document.getElementById('apiToken');
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    document.getElementById('toggleApiToken').textContent = isPassword ? 'Ocultar' : 'Mostrar';
};

document.getElementById('saveDataSourceBtn').onclick = async () => {
    try {
        const config = {
            source: document.getElementById('dataSource').value,
            apiBaseUrl: CodeRedApi.normalizeBaseUrl(document.getElementById('apiBaseUrl').value),
            apiToken: document.getElementById('apiToken').value,
            cacheDurationMs: ShalomAgencyStore.AGENCY_CACHE_TTL_MS
        };
        await sendMessage('CONFIG_SAVE', { config });
        chrome.storage.local.set({ agencyDataConfig: config });
        await updateStatusUI();
        alert('Configuración guardada correctamente.');
    } catch (err) {
        console.error('Error al guardar configuración:', err);
        alert('No fue posible guardar la configuración.');
    }
};

document.getElementById('testConnectionBtn').onclick = async () => {
    try {
        const config = (await sendMessage('CONFIG_GET')).config;
        if (!config.apiBaseUrl || !config.apiToken) {
            alert('Primero ingresa la URL base y el token.');
            return;
        }
        const result = await sendMessage('API_TEST_CONNECTION', { apiBaseUrl: config.apiBaseUrl, apiToken: config.apiToken });
        const total = result.info?.total_agencies ?? result.info?.total ?? result.info?.data?.total ?? 0;
        alert(`Conexión correcta. Total de agencias: ${total}.`);
    } catch (err) {
        const code = err?.status || err?.type || 'GENERAL';
        if (code === 401 || code === 'UNAUTHORIZED') alert('Token inválido o expirado.');
        else if (code === 403 || code === 'FORBIDDEN') alert('El token no tiene permiso para consultar agencias.');
        else if (code === 429 || code === 'RATE_LIMIT') alert('Se alcanzó temporalmente el límite de solicitudes.');
        else alert('No fue posible conectar con CodeRED Platform.');
    }
};

document.getElementById('syncNowBtn').onclick = async () => {
    try {
        const result = await sendMessage('CATALOG_SYNC');
        await refreshLocalLists();
        await updateStatusUI();
        alert(`Sincronización completada. Total de agencias: ${result.total || 0}.`);
        renderTable();
    } catch (err) {
        console.error('Error al sincronizar:', err);
        alert('No se pudo sincronizar el catálogo.');
    }
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        document.getElementById('searchAgencia').value = '';
        renderTable();
    };
});

function renderTable(filter = '') {
    const tbody = document.getElementById('agenciasTableBody');
    tbody.innerHTML = '';
    const lista = currentType === 'AEREO' ? agenciasAereo : agenciasTerrestre;
    const normalizedFilter = ShalomAgencyStore.normalizeText(filter);

    lista.forEach((a, index) => {
        if (normalizedFilter && !ShalomAgencyStore.normalizeText(a.agency || a.agencia).includes(normalizedFilter)) return;
        const tr = document.createElement('tr');
        const escape = ShalomAgencyStore.escapeHtml;
        const hasTerr = Boolean(ShalomAgencyStore.getChosenTextForChannel(a, 'TERRESTRE'));
        const hasAereo = Boolean(ShalomAgencyStore.getChosenTextForChannel(a, 'AEREO'));
        const canalBadge = hasTerr && hasAereo ? 'Ambos' : hasTerr ? 'Terrestre' : hasAereo ? 'Aéreo' : 'Sin identificador';
        const badgeCO = isCO(a.co) ? '<span style="background:#e8f5e9;color:#2e7d32;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:5px;border:1px solid #c8e6c9;font-weight:bold;">🛡️ AGENCIA CO</span>' : '';
        const tamanoText = a.size || a.tamano ? `<br><small>Tamaño: ${escape(a.size || a.tamano)}</small>` : '';

        tr.innerHTML = `
            <td><strong>${escape(a.agency || a.agencia)}</strong> <span style="display:inline-block;background:#eceff1;color:#37474f;padding:2px 6px;border-radius:4px;font-size:10px;border:1px solid #cfd8dc;font-weight:bold;">${escape(canalBadge)}</span> ${badgeCO}<br><small>${escape(a.externalId || a.id)}</small>${tamanoText}</td>
            <td>${escape(a.department || a.departamento)} / ${escape(a.province || a.provincia)}</td>
            <td class="acciones-td"></td>
        `;

        const tdAcciones = tr.querySelector('.acciones-td');
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn btn-edit';
        btnEdit.textContent = 'Editar';
        btnEdit.onclick = () => abrirModal(index);

        const btnDel = document.createElement('button');
        btnDel.className = 'btn btn-danger';
        btnDel.textContent = 'Eliminar';
        btnDel.onclick = () => eliminarAgencia(index);

        tdAcciones.appendChild(btnEdit);
        tdAcciones.appendChild(btnDel);
        tbody.appendChild(tr);
    });
}

document.getElementById('searchAgencia').oninput = (e) => renderTable(e.target.value);

const eliminarAgencia = (index) => {
    if (confirm('¿Estás seguro de eliminar esta agencia?')) {
        if (currentType === 'AEREO') agenciasAereo.splice(index, 1);
        else agenciasTerrestre.splice(index, 1);
        renderTable();
    }
};

const abrirModal = (index = -1) => {
    const modal = document.getElementById('modalEditor');
    const isEdit = index > -1;
    document.getElementById('modalTitle').innerText = isEdit ? 'Editar Agencia' : 'Nueva Agencia';
    document.getElementById('editIndex').value = index;
    const lista = currentType === 'AEREO' ? agenciasAereo : agenciasTerrestre;
    const a = isEdit ? lista[index] : { id: '', agencia: '', departamento: '', provincia: '', distrito: '', direccion: '', texto_chosen: '', texto_chosen_terrestre: '', texto_chosen_aereo: '' };

    document.getElementById('fieldId').value = a.externalId || a.id || '';
    document.getElementById('fieldAgencia').value = a.agency || a.agencia || '';
    document.getElementById('fieldDep').value = a.department || a.departamento || '';
    document.getElementById('fieldProv').value = a.province || a.provincia || '';
    document.getElementById('fieldDist').value = a.district || a.distrito || '';
    document.getElementById('fieldDir').value = a.address || a.direccion || '';
    document.getElementById('fieldTextoChosen').value = a.texto_chosen || '';
    document.getElementById('fieldMaps').value = a.link_mapa || a.mapUrl || '';
    document.getElementById('fieldTamano').value = a.size || a.tamano || 'Mediana';
    document.getElementById('fieldEsCO').checked = isCO(a.co);
    modal.style.display = 'flex';
};

const cerrarModal = () => {
    document.getElementById('modalEditor').style.display = 'none';
};

document.getElementById('cancelBtn').onclick = () => cerrarModal();
document.getElementById('addBtn').onclick = () => abrirModal();
document.getElementById('viewGridBtn').onclick = () => window.open('grid.html', '_blank');

document.getElementById('confirmBtn').onclick = () => {
    const index = parseInt(document.getElementById('editIndex').value);
    const textoChosenManual = document.getElementById('fieldTextoChosen').value.trim();

    const nuevaAgencia = {
        id: document.getElementById('fieldId').value,
        agencia: document.getElementById('fieldAgencia').value.trim(),
        departamento: document.getElementById('fieldDep').value.trim(),
        provincia: document.getElementById('fieldProv').value.trim(),
        distrito: document.getElementById('fieldDist').value.trim(),
        direccion: document.getElementById('fieldDir').value.trim(),
        texto_chosen: textoChosenManual || `${document.getElementById('fieldId').value} - ${document.getElementById('fieldDep').value.trim()} - ${document.getElementById('fieldProv').value.trim()} - ${document.getElementById('fieldDist').value.trim()} - ${document.getElementById('fieldAgencia').value.trim()} - ${currentType}`,
        texto_chosen_terrestre: currentType === 'TERRESTRE' ? (textoChosenManual || `${document.getElementById('fieldId').value} - ${document.getElementById('fieldDep').value.trim()} - ${document.getElementById('fieldProv').value.trim()} - ${document.getElementById('fieldDist').value.trim()} - ${document.getElementById('fieldAgencia').value.trim()} - TERRESTRE`) : (document.getElementById('fieldTextoChosen').value.trim() || ''),
        texto_chosen_aereo: currentType === 'AEREO' ? (textoChosenManual || `${document.getElementById('fieldId').value} - ${document.getElementById('fieldDep').value.trim()} - ${document.getElementById('fieldProv').value.trim()} - ${document.getElementById('fieldDist').value.trim()} - ${document.getElementById('fieldAgencia').value.trim()} - AEREO`) : (document.getElementById('fieldTextoChosen').value.trim() || ''),
        link_mapa: document.getElementById('fieldMaps').value.trim(),
        tamano: document.getElementById('fieldTamano').value,
        co: document.getElementById('fieldEsCO').checked
    };

    const lista = currentType === 'AEREO' ? agenciasAereo : agenciasTerrestre;
    if (index > -1) lista[index] = nuevaAgencia;
    else lista.push(nuevaAgencia);
    cerrarModal();
    renderTable();
};

document.getElementById('saveGistBtn').onclick = async () => {
    const token = document.getElementById('ghToken').value;
    const gistIds = await ShalomAgencyStore.getConfiguredGistIds();
    if (!token) return alert('Por favor ingresa tu Token de GitHub');

    const updateGist = async (id, data, filename) => {
        const response = await fetch(`https://api.github.com/gists/${id}`, {
            method: 'PATCH',
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files: { [filename]: { content: JSON.stringify(data, null, 2) } } })
        });
        if (!response.ok) throw new Error(`GitHub respondio ${response.status} al guardar ${filename}`);
    };

    try {
        await updateGist(gistIds.terrestre, agenciasTerrestre, 'agencias_terrestre.json');
        await updateGist(gistIds.aereo, agenciasAereo, 'agencias_aereo.json');
        await ShalomAgencyStore.saveAgencyCache({ terrestre: agenciasTerrestre, aereo: agenciasAereo, gistIds });
        chrome.storage.local.set({ ghToken: token }, () => alert('¡Ambos Gists actualizados con éxito!'));
    } catch (err) {
        console.error('Error al sincronizar con GitHub:', err);
        alert('Error al sincronizar. Revisa tu token de GitHub.');
    }
};

document.getElementById('refreshConfiguredSourceBtn').remove?.();
const btnRefresh = document.createElement('button');
btnRefresh.id = 'refreshConfiguredSourceBtn';
btnRefresh.className = 'btn btn-edit';
btnRefresh.textContent = '↻ Sincronizar Fuente';
document.getElementById('saveDataSourceBtn').insertAdjacentElement('afterend', btnRefresh);
btnRefresh.onclick = async () => {
    try {
        const result = await sendMessage('CATALOG_SYNC');
        await refreshLocalLists();
        await updateStatusUI();
        agenciasTerrestre = result.source === 'gist' ? agenciasTerrestre : [];
        agenciasAereo = result.source === 'gist' ? agenciasAereo : [];
        alert(`Sincronización completada. Total de agencias: ${result.total || 0}.`);
        renderTable();
    } catch (err) {
        console.error('Error al sincronizar la fuente configurada:', err);
        alert('No se pudo sincronizar la fuente configurada.');
    }
};
