# Buscador Shalom Control

Extensión de Chrome para buscar, consultar y administrar agencias de **Shalom Control** desde una interfaz rápida, simple y centralizada.

Versión estable: `2.0.0`

## Características

- Búsqueda de agencias terrestres y aéreas.
- Filtros por segmento, tamaño y Centro de Operaciones.
- Selección rápida de agencias dentro del sistema.
- Enlaces seguros a Google Maps.
- Panel de administración para agregar, editar y eliminar registros.
- Actualización automática del catálogo desde CodeRED Platform.
- Tema claro y oscuro.
- Caché local para mejorar la experiencia de consulta.

## Requisitos

- Google Chrome o un navegador compatible con extensiones `Manifest V3`.
- Acceso a los dominios donde se usa la extensión.

## Instalación

### Opción 1: instalar desde código fuente

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions/`.
3. Activa `Modo desarrollador`.
4. Haz clic en `Cargar descomprimida`.
5. Selecciona la carpeta del proyecto.

### Opción 2: publicar o distribuir como ZIP

Si vas a subirla a la Chrome Web Store o compartirla como paquete, incluye estos archivos principales:

- `manifest.json`
- `background.js`
- `agencyStore.js`
- `content.js`
- `options.html`
- `options.js`
- `popup.html`
- `popup.css`
- `popup.js`
- `icons/`

## Uso

1. Abre la extensión desde el ícono de Chrome.
2. Busca la agencia que necesitas.
3. Aplica filtros si quieres acotar resultados.
4. Desde el panel de administración puedes mantener el catálogo actualizado.

## Estructura del proyecto

- `manifest.json`: configuración principal de la extensión.
- `background.js`: tareas en segundo plano y sincronización.
- `agencyStore.js`: carga, normalización y almacenamiento de agencias.
- `content.js`: inyección de la interfaz en las páginas compatibles.
- `options.html` y `options.js`: panel de configuración.
- `popup.html`, `popup.css` y `popup.js`: ventana emergente principal.
- `tests/`: pruebas automáticas del manifiesto y la lógica de datos.

## Desarrollo

Instalar dependencias no es necesario para ejecutar la extensión, pero sí para correr las pruebas del proyecto:

```bash
npm test
```

## Permisos usados

La extensión solicita estos permisos y accesos:

- `storage`: guardar configuración local, caché y preferencias.
- `alarms`: actualizar automáticamente el catálogo.
- `https://*.shalom.pe/*` y `https://*.shalomcontrol.com/*`: integrar la búsqueda dentro de los sitios donde opera la extensión.

## Notas

- La extensión no depende de código remoto ejecutable; el catálogo remoto se usa como datos.
- Las pruebas incluidas validan el manifiesto, la normalización, la sincronización incremental y la migración de almacenamiento.

## Licencia

Uso interno o según la licencia que decidas aplicar al publicar el proyecto.
