# Buscador Shalom Control

Extensión de Chrome para buscar agencias de Shalom desde una interfaz ligera, con sincronización automática desde CodeRED Platform y caché local para uso offline.

Versión estable: `2.0.0`

## Qué hace

- Busca agencias terrestres y aéreas.
- Guarda la preferencia de canal.
- Sincroniza el catálogo desde CodeRED Platform.
- Mantiene una copia local para seguir funcionando sin conexión.
- Permite configurar solo el token de API.

## Requisitos

- Google Chrome o un navegador compatible con extensiones `Manifest V3`.
- Un token generado en CodeRED Platform con la habilidad `agencies:read`.

## Instalación

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions/`.
3. Activa `Modo desarrollador`.
4. Haz clic en `Cargar descomprimida`.
5. Selecciona la carpeta del proyecto.

## Uso

1. Abre la extensión desde el ícono de Chrome.
2. Abre `Configuración`.
3. Pega el token de CodeRED Platform.
4. Guarda el token para iniciar la sincronización automática.
5. Usa el buscador y el selector Terrestre/Aéreo para encontrar y enviar agencias.

## Configuración

- El token se guarda solo en `chrome.storage.local`.
- La URL de CodeRED Platform está fija internamente en `https://platform.codered.host/api/v1`.
- El catálogo se sincroniza automáticamente al guardar un token válido y durante el arranque de la extensión.
- Si no hay conexión, la extensión usa la caché local disponible.

## Estado en Ajustes

La pantalla de configuración muestra:

- Estado de conexión.
- Última sincronización.
- Cantidad de agencias.
- Fuente activa.
- Versión de esquema.

## Troubleshooting

- `401`: token inválido, expirado o revocado.
- `403`: token válido, pero sin permiso `agencies:read`.
- `429`: límite de solicitudes temporalmente alcanzado.
- Sin conexión: la extensión seguirá usando la caché local si existe.

## Permisos usados

- `storage`: guardar token, preferencias y caché local.
- `alarms`: ejecutar sincronización automática.
- `https://*.shalom.pe/*` y `https://*.shalomcontrol.com/*`: integrar el buscador dentro de los sitios compatibles.

## Desarrollo y pruebas

Para ejecutar las pruebas:

```bash
npm test
```

## Estructura

- `background.js`: sincronización, cache y mensajes.
- `agencyStore.js`: normalización, almacenamiento y lectura de agencias.
- `content.js`: inyección del buscador en Shalom.
- `popup.html` y `popup.js`: acceso rápido y ajustes.
- `options.html` y `options.js`: configuración del token y estado.
- `tests/`: pruebas automáticas.

## Notas

- No se guarda el token en `chrome.storage.sync`.
- No se usa Gist en runtime.
- El catálogo local permanece aunque limpies el token, salvo acción explícita para borrarlo.

