const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const test = require('node:test');

const source = readFileSync('content.js', 'utf8');

function createMockDocument() {
    const elements = new Map();
    const head = {
        appendChild(node) {
            elements.set(node.id, node);
        }
    };
    const body = {};
    const createElement = (tagName) => ({
        tagName: String(tagName).toUpperCase(),
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, toggle() { return false; } },
        appendChild() {},
        insertBefore() {},
        addEventListener() {},
        setAttribute() {},
        querySelector() { return null; },
        textContent: '',
        innerHTML: ''
    });

    const options = [
        { text: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE', value: '1' },
        { text: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - AEREO', value: '2' }
    ];
    const select = {
        options,
        value: '',
        dispatchEvent() {},
        addEventListener() {}
    };
    const chosenContainer = { find() { return { text() {} }; } };
    const tarjeta = {
        dataset: {
            textoChosen: '',
            textoChosenTerrestre: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE',
            textoChosenAereo: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - AEREO'
        }
    };
    const buscador = { value: '' };
    const resultados = { style: { display: 'grid' } };
    const selector = {
        value: 'AUTO',
        options: [
            { value: 'AUTO', disabled: false },
            { value: 'TERRESTRE', disabled: false },
            { value: 'AEREO', disabled: false }
        ]
    };

    elements.set('selector-canal-chosen', selector);
    elements.set('buscador', buscador);
    elements.set('resultado-grid', resultados);
    elements.set('select-os-pro', select);

    return {
        elements,
        head,
        body,
        createElement,
        getElementById(id) {
            return elements.get(id) || null;
        },
        querySelector(selectorText) {
            if (selectorText === 'select[id*="osProDestino"]') return select;
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

test('content helpers choose the right channel text and perform DOM selection', async () => {
    const document = createMockDocument();
    const calls = [];
    const globalScope = {};

    runInNewContext(source, {
        self: globalScope,
        document,
        window: {
            location: { hostname: 'shalom.pe' },
            jQuery: (el) => ({
                trigger(name) { calls.push(name); },
                next() {
                    return {
                        find() {
                            return { text() {} };
                        }
                    };
                }
            })
        },
        chrome: {
            storage: {
                local: {
                    async get() {
                        return {};
                    },
                    async set() {}
                }
            }
        },
        MutationObserver: class { observe() {} },
        console,
        URL,
        Event: class {
            constructor(type, init = {}) {
                this.type = type;
                this.bubbles = Boolean(init.bubbles);
            }
        },
        ShalomAgencyStore: {
            ensureAgencyCache: async () => ({ terrestre: [], aereo: [], errors: [] }),
            prepareAgencies: (agencies) => agencies,
            filterBySearchText: (agencies) => agencies,
            escapeHtml: (value) => String(value),
            getSafeExternalUrl: () => '',
            getChosenTextForChannel: (agency, canal) => {
                if (canal === 'TERRESTRE') return agency.texto_chosen_terrestre || '';
                if (canal === 'AEREO') return agency.texto_chosen_aereo || '';
                return agency.texto_chosen || '';
            },
            agencyHasChannel: (agency, canal) => Boolean(canal === 'TERRESTRE' ? agency.texto_chosen_terrestre : agency.texto_chosen_aereo)
        }
    });

    const helpers = globalScope.ShalomContentHelpers;
    assert.equal(typeof helpers.seleccionarAgencia, 'function');
    assert.equal(helpers.obtenerTextoChosen({
        texto_chosen_terrestre: 'T',
        texto_chosen_aereo: 'A',
        texto_chosen: 'L'
    }, 'TERRESTRE'), 'T');
    assert.equal(helpers.obtenerTextoChosen({
        texto_chosen_terrestre: 'T',
        texto_chosen_aereo: 'A',
        texto_chosen: 'L'
    }, 'AEREO'), 'A');

    const input = { value: 'x' };
    const grid = { style: { display: 'grid' } };
    helpers.seleccionarAgencia({
        dataset: {
            textoChosen: '',
            textoChosenTerrestre: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - TERRESTRE',
            textoChosenAereo: '610 - UCAYALI - CORONEL PORTILLO - PUCALLPA YARINACOCHA - YARINACOCHA AV UNIVERSITARIA - AEREO'
        }
    }, input, grid);

    const select = document.querySelector('select[id*="osProDestino"]');
    assert.equal(select.value, '1');
    assert.equal(grid.style.display, 'none');
    assert.equal(input.value, '');
});
