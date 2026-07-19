let listaAgencias = [];
let currentType = 'TERRESTRE';
let currentChosenChannel = 'AUTO';
let ultimaCargaSolicitada = 0;

// 1. Cargar la data desde la copia local.
async function cargarDatos(tipo = 'TERRESTRE') {
    const idCarga = ++ultimaCargaSolicitada;
    console.log(`[Shalom Pro] Intentando cargar agencias: ${tipo}...`);
    try {
        const cache = await ShalomAgencyStore.ensureAgencyCache({ allowRefresh: false });
        if (idCarga !== ultimaCargaSolicitada || tipo !== currentType) return;

        const agencias = tipo === 'AEREO' ? cache.aereo : cache.terrestre;
        listaAgencias = ShalomAgencyStore.prepareAgencies(agencias, tipo);
        if (currentChosenChannel !== 'AUTO') {
            actualizarSelectorCanal(currentChosenChannel);
        }

        if (cache.errors && cache.errors.length) {
            console.warn("[Shalom Pro] Se usara la ultima copia local disponible:", cache.errors);
        }
        
        console.log(`[Shalom Pro] Agencias ${tipo} cargadas desde almacenamiento local:`, listaAgencias.length);
    } catch (error) {
        console.error("[Shalom Pro] Error al cargar agencias locales:", error);
    }
}

const isCO = (val) => val === true || String(val).toUpperCase() === 'TRUE' || String(val).toUpperCase() === 'SI' || String(val).toUpperCase() === 'S' || val === '1' || val === 1;

const canalDisponibleParaAgencia = (agencia, canal) => ShalomAgencyStore.agencyHasChannel(agencia, canal);

const obtenerTextoChosen = (agencia, canal) => {
    if (!agencia) return '';
    if (canal === 'AUTO') {
        return ShalomAgencyStore.getChosenTextForChannel(agencia, currentType) || ShalomAgencyStore.getChosenTextForChannel(agencia, 'TERRESTRE') || ShalomAgencyStore.getChosenTextForChannel(agencia, 'AEREO') || '';
    }
    return ShalomAgencyStore.getChosenTextForChannel(agencia, canal) || '';
};

function actualizarSelectorCanal(canal) {
    currentChosenChannel = canal;
    const selector = document.getElementById('selector-canal-chosen');
    if (!selector) return;
    selector.value = canal;
    const opciones = Array.from(selector.options);
    const tieneTerr = listaAgencias.some(agencia => canalDisponibleParaAgencia(agencia, 'TERRESTRE'));
    const tieneAereo = listaAgencias.some(agencia => canalDisponibleParaAgencia(agencia, 'AEREO'));
    opciones.forEach(option => {
        if (option.value === 'TERRESTRE') option.disabled = !tieneTerr;
        if (option.value === 'AEREO') option.disabled = !tieneAereo;
    });
}

// Inyectar estilos inmediatamente
inyectarEstilos();
// Inyectar Estilos CSS necesarios
function inyectarEstilos() {
    if (document.getElementById('estilos-buscador-shalom')) return;
    const style = document.createElement('style');
    style.id = 'estilos-buscador-shalom';
    style.textContent = `
        #mi-buscador-contenedor { margin-left: 15px; position: relative; font-family: 'Segoe UI', Tahoma, sans-serif; z-index: 1000; display: flex !important; align-items: center; } /* Asegura que el contenedor sea flex para alinear */
        #mi-buscador-contenedor .buscador-wrapper { display: flex; align-items: center; background: #fff; border: 2px solid #d32f2f; border-radius: 25px; padding: 4px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); width: 350px; transition: 0.3s; } /* Ancho un poco más grande para el input */
        #mi-buscador-contenedor.dark-theme .buscador-wrapper { background: #333; border-color: #ff5252; color: #fff; }
        #buscador { border: none; outline: none; flex-grow: 1; font-size: 16px; padding: 5px; background: transparent; color: inherit; min-width: 150px; } /* Texto del input más grande */
        #theme-toggle { background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; margin-left: 10px; filter: grayscale(1); transition: 0.3s; }
        #theme-toggle:hover { filter: none; transform: scale(1.1); }
        
        #resultado-grid {
            position: absolute; top: 55px; left: 50%; transform: translateX(-50%); width: 90vw; max-width: 1000px; max-height: 550px; 
            background: #fff; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.15); /* Sombra más pronunciada */
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; overflow-y: auto; padding: 15px; border: 1px solid #ddd; 
        }
        #mi-buscador-contenedor.dark-theme #resultado-grid { background: #1e1e1e; border-color: #444; color: #eee; }
        
        #mi-buscador-contenedor .tarjeta {
            padding: 18px; border: 1px solid #eee; cursor: pointer; transition: all 0.25s ease; border-radius: 12px; display: flex; flex-direction: column; background: #fff; min-height: 120px;
        }
        #mi-buscador-contenedor .tarjeta:hover { background: #fdf2f2; border-color: #d32f2f; transform: translateY(-3px); box-shadow: 0 6px 15px rgba(211, 47, 47, 0.1); } /* Efecto hover más pronunciado */
        #mi-buscador-contenedor.dark-theme .tarjeta { background: #252525; border-color: #444; }
        #mi-buscador-contenedor.dark-theme .tarjeta:hover { background: #2d1f1f; border-color: #ff5252; box-shadow: 0 6px 15px rgba(255, 82, 82, 0.15); } /* Efecto hover en dark mode */
        
        #mi-buscador-contenedor .tarjeta b { color: #d32f2f; display: block; font-size: 19px; font-weight: 700; margin-bottom: 5px; white-space: normal; word-wrap: break-word; line-height: 1.2; }
        #mi-buscador-contenedor.dark-theme .tarjeta b { color: #ff5252; }
        #mi-buscador-contenedor .ubicacion { font-size: 15px; color: #666; font-weight: 600; display: block; margin: 3px 0; } /* Ubicación más grande */
        #mi-buscador-contenedor.dark-theme .ubicacion { color: #aaa; }
        #mi-buscador-contenedor .direccion { font-size: 14px; color: #888; display: block; line-height: 1.4; white-space: normal; }

        /* Estilos para los badges de CO y Tamaño */
        #mi-buscador-contenedor .tarjeta .btn-mapa-mini {
            background: #1976d2; color: white; padding: 3px 9px; border-radius: 5px; font-size: 13px; font-weight: bold; white-space: nowrap;
        }
        #mi-buscador-contenedor .tarjeta .btn-mapa-mini:hover { background: #1565c0; }

        #mi-buscador-contenedor .tarjeta div:nth-child(2) span { /* Selecciona el div que contiene los badges */
            padding: 3px 8px; border-radius: 5px; font-size: 13px; font-weight: bold; margin-right: 5px;
        }
        #mi-buscador-contenedor .tarjeta div:nth-child(2) span:first-child { /* Badge CO */
            background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;
        }
        #mi-buscador-contenedor .tarjeta div:nth-child(2) span:last-child { /* Badge Tamaño */
            background:#e3f2fd;color:#1565c0;border:1px solid #bbdefb;
        }
    `;
    document.head.appendChild(style);
}

// Función para detectar el segmento activo en la página de Shalom
function sincronizarSegmento() {
    // Usamos selectores más amplios por si el título cambia levemente
    const btnTerr = document.querySelector('button[title*="Terrestre"]') || document.querySelector('button[onclick*="TERRESTRE"]');
    const btnAereo = document.querySelector('button[title*="Aéreo"]') || document.querySelector('button[onclick*="AEREO"]');

    if (btnTerr && !btnTerr.dataset.swHoked) {
        btnTerr.dataset.swHoked = "true";
        btnTerr.addEventListener('click', () => {
            if (currentType !== 'TERRESTRE') {
                currentType = 'TERRESTRE';
                cargarDatos('TERRESTRE');
                const buscador = document.getElementById('buscador');
                const resultados = document.getElementById('resultado-grid');
                if (buscador) buscador.value = '';
                if (resultados) resultados.style.display = 'none';
            }
        });
    }

    if (btnAereo && !btnAereo.dataset.swHoked) {
        btnAereo.dataset.swHoked = "true";
        btnAereo.addEventListener('click', () => {
            if (currentType !== 'AEREO') {
                currentType = 'AEREO';
                cargarDatos('AEREO');
                const buscador = document.getElementById('buscador');
                const resultados = document.getElementById('resultado-grid');
                if (buscador) buscador.value = '';
                if (resultados) resultados.style.display = 'none';
            }
        });
    }

    // Retornar el tipo actual basado en la clase 'active' de la página
    if (btnAereo && btnAereo.classList.contains('active')) return 'AEREO';
    if (btnTerr && btnTerr.classList.contains('active')) return 'TERRESTRE';
    return currentType;
}

// Lógica de Inyección Principal
async function inicializarInyeccion() {
    const res = await chrome.storage.local.get(['allowedDomains', 'pref_tema']);
    
    // 1. Verificar dominio
    if (res.allowedDomains) {
        const list = res.allowedDomains.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== "");
        const current = window.location.hostname.split('.')[0].toLowerCase();
        if (list.length > 0 && !list.includes(current)) return;
    }

    // 2. Cargar Datos iniciales
    currentType = sincronizarSegmento();
    cargarDatos(currentType);

    // 3. Crear el Observer para inyectar en el header
    const observer = new MutationObserver(() => {
        const headerRow = document.querySelector('.mdl-layout__header-row') || document.querySelector('header .mdl-layout__header-row');
        
        if (headerRow && !document.getElementById('mi-buscador-contenedor')) {
            console.log("[Shalom Pro] Header detectado. Inyectando buscador...");
            
            const div = document.createElement('div');
            div.id = 'mi-buscador-contenedor';
            if (res.pref_tema === 'dark') div.classList.add('dark-theme');
            
            div.innerHTML = `
                <div class="buscador-wrapper">
                    <input type="text" id="buscador" placeholder="🔍 Buscar agencia..." autocomplete="off">
                    <select id="selector-canal-chosen" title="Canal de selección" style="margin-left:8px;border:none;background:transparent;font-size:12px;max-width:110px;">
                        <option value="AUTO">Auto</option>
                        <option value="TERRESTRE">Terrestre</option>
                        <option value="AEREO">Aéreo</option>
                    </select>
                    <button id="theme-toggle" title="Cambiar tema">🌓</button>
                </div>
                <div id="resultado-grid" style="display:none;"></div>
            `;

            // Insertar después del spacer
            const spacer = headerRow.querySelector('.mdl-layout-spacer');
            if (spacer) headerRow.insertBefore(div, spacer.nextSibling);
            else headerRow.appendChild(div);

            // Setup de eventos del buscador inyectado
            const input = div.querySelector('#buscador');
            const grid = div.querySelector('#resultado-grid');
            const btnTema = div.querySelector('#theme-toggle');
            const selectorCanal = div.querySelector('#selector-canal-chosen');

            btnTema.onclick = () => {
                const esOscuro = div.classList.toggle('dark-theme');
                chrome.storage.local.set({ pref_tema: esOscuro ? 'dark' : 'light' });
            };

            selectorCanal.onchange = (e) => {
                actualizarSelectorCanal(e.target.value);
            };

            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (val.length < 2) { grid.style.display = 'none'; return; }
                
                const filtrados = ShalomAgencyStore.filterBySearchText(listaAgencias, val);
                const escape = ShalomAgencyStore.escapeHtml;
                
                grid.style.display = 'grid';
                grid.innerHTML = filtrados.map(a => {
                    const mapUrl = ShalomAgencyStore.getSafeExternalUrl(a.link_mapa);
                    const chosenTextTerr = ShalomAgencyStore.getChosenTextForChannel(a, 'TERRESTRE');
                    const chosenTextAereo = ShalomAgencyStore.getChosenTextForChannel(a, 'AEREO');
                    const hasTerr = Boolean(chosenTextTerr);
                    const hasAereo = Boolean(chosenTextAereo);
                    return `
                    <div class="tarjeta" data-texto-chosen="${escape(a.texto_chosen)}" data-texto-chosen-terrestre="${escape(chosenTextTerr)}" data-texto-chosen-aereo="${escape(chosenTextAereo)}">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                            <b style="flex-grow: 1;">${escape(String(a.agencia || '').toUpperCase())}</b>
                            ${mapUrl ? `
                                <a href="${escape(mapUrl)}" target="_blank" rel="noopener noreferrer" class="btn-mapa-mini" style="text-decoration:none; margin-left: 10px; background: #1976d2; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; white-space: nowrap;">📍 MAPA</a>
                            ` : ''}
                        </div>
                        <div style="margin-bottom: 6px; display: flex; gap: 6px; flex-wrap: wrap;">
                            ${isCO(a.co) ? '<span style="background:#e8f5e9;color:#2e7d32;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:bold;border:1px solid #c8e6c9;">🛡️ AGENCIA CO</span>' : ''}
                            <span style="background:#e3f2fd;color:#1565c0;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:bold;border:1px solid #bbdefb;">📏 ${escape(a.tamano || 'Mediana')}</span>
                            ${hasTerr ? '<span style="background:#fff3e0;color:#ef6c00;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:bold;border:1px solid #ffcc80;">🚛 Terrestre</span>' : ''}
                            ${hasAereo ? '<span style="background:#ede7f6;color:#5e35b1;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:bold;border:1px solid #d1c4e9;">✈️ Aéreo</span>' : ''}
                        </div>
                        <span class="ubicacion">${escape(a.departamento)} / ${escape(a.provincia)} / ${escape(a.distrito)}</span>
                        <small class="direccion">${escape(a.direccion)}</small>
                    </div>
                `;
                }).join('');
            });

            grid.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('btn-mapa-mini')) return;
                seleccionarAgencia(e.target.closest('.tarjeta'), input, grid);
            });

            actualizarSelectorCanal(currentChosenChannel);
        }
        
        // Sincronizar botones de la página original en cada mutación
        const segmentoDetectado = sincronizarSegmento();
        if (segmentoDetectado !== currentType) {
            currentType = segmentoDetectado;
            cargarDatos(currentType);

            const buscador = document.getElementById('buscador');
            const resultados = document.getElementById('resultado-grid');
            if (buscador) buscador.value = '';
            if (resultados) resultados.style.display = 'none';
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function seleccionarAgencia(tarjeta, input, grid) {
    if (!tarjeta) return;
    const selector = document.getElementById('selector-canal-chosen');
    const canalSeleccionado = selector ? selector.value : 'AUTO';
    const textoBuscado = obtenerTextoChosen({
        texto_chosen: tarjeta.dataset.textoChosen || '',
        texto_chosen_terrestre: tarjeta.dataset.textoChosenTerrestre || '',
        texto_chosen_aereo: tarjeta.dataset.textoChosenAereo || ''
    }, canalSeleccionado);
    if (!textoBuscado) {
        console.warn('[Shalom Pro] La agencia seleccionada no tiene texto elegido para el canal actual.');
        return;
    }
    const select = document.querySelector('select[id*="osProDestino"]');
    
    if (select) {
        let opcion = Array.from(select.options).find(opt => opt.text.trim() === textoBuscado.trim());
        if (opcion) {
            select.value = opcion.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            if (window.jQuery) {
                const $select = window.jQuery(select);
                $select.trigger("chosen:updated");
                $select.next('.chosen-container').find('span').text(opcion.text);
            }
            grid.style.display = 'none';
            input.value = '';
        }
    }
}

const ShalomContentHelpers = {
    cargarDatos,
    sincronizarSegmento,
    seleccionarAgencia,
    obtenerTextoChosen,
    actualizarSelectorCanal,
    canalDisponibleParaAgencia
};

if (typeof self !== 'undefined') {
    self.ShalomContentHelpers = ShalomContentHelpers;
}

// Iniciar proceso
inicializarInyeccion();
