# Integración con CodeRED Platform

## Arquitectura actual

La extensión `Buscador Shalom Control` hoy consume agencias desde GitHub Gist y guarda una copia local en `chrome.storage.local`.

Flujo actual:
- `background.js` inicializa y refresca la caché.
- `agencyStore.js` descarga, valida y normaliza los datos.
- `content.js` carga la copia local y la usa para buscar e insertar agencias dentro de Shalom Control.
- `options.js` administra el catálogo, edita registros y vuelve a publicar el contenido en Gist.
- `grid.js` muestra el catálogo completo con filtros.
- `popup.js` solo ofrece accesos rápidos y tema visual.

## Fuente Gist actual

La fuente activa sigue siendo Gist.

IDs por defecto:
- Terrestre: `acfb5aaccf90743075a8143511b48ae7`
- Aéreo: `27710267e825c3b205be8d3c8f0acc46`

La descarga se realiza con:
- `https://api.github.com/gists/<id>`
- `raw_url` del archivo cuando GitHub devuelve contenido truncado

## Arquitectura propuesta

La extensión ya no debe depender directamente del JSON exacto de la fuente remota.

Capas previstas:
- `AgencyDataSource`
- `GistAgencySource`
- `CodeREDPlatformAgencySource`
- `fetchAgencies()`
- `refreshAgencies()`
- `getCachedAgencies()`
- `clearAgencyCache()`

En este sprint solo se preparó la separación, sin cambiar la fuente activa.

## Contrato JSON de CodeRED Platform

Formato esperado de entrada:

```json
{
  "internal_id": 25,
  "id": 610,
  "code": "SHA-000610",
  "agencia": "Yarinacocha Av Universitaria",
  "departamento": "Ucayali",
  "provincia": "Coronel Portillo",
  "distrito": "Pucallpa Yarinacocha",
  "direccion": "av. universitaria mza a lote 6, yarinacocha - coronel portillo - ucayali",
  "link_mapa": "https://www.google.com/maps/dir/?api=1&destination=-8.38,-74.56",
  "tamano": "Pequeña",
  "texto_chosen_terrestre": "...",
  "texto_chosen_aereo": null
}
```

## Contrato interno de la extensión

El contrato interno ya no depende de los nombres exactos del origen remoto.

Campos normalizados:
- `internalId`
- `externalId`
- `code`
- `agency`
- `department`
- `province`
- `district`
- `address`
- `mapUrl`
- `size`
- `chosenTextTerrestrial`
- `chosenTextAir`

Compatibilidad temporal:
- `texto_chosen`
- `texto_chosen_terrestre`
- `texto_chosen_aereo`

La función de normalización actual es `normalizeAgency(rawAgency, context)`.

## Compatibilidad temporal

Reglas actuales:
- Si existen `texto_chosen_terrestre` o `texto_chosen_aereo`, se respetan.
- Si solo existe `texto_chosen`, se intenta inferir el canal.
- Si el texto heredado es ambiguo, se conserva como `chosenTextLegacy`.
- No se sobrescribe un campo nuevo con el heredado.
- El objeto original no se muta.

## Diferencia entre `internal_id`, `id` y `code`

- `internal_id`: identificador interno de la plataforma.
- `id`: identificador externo visible o funcional de la agencia.
- `code`: código alfanumérico estable, útil para trazabilidad y lectura humana.

## Campos de texto elegido

- `texto_chosen_terrestre`: texto exacto para el canal terrestre.
- `texto_chosen_aereo`: texto exacto para el canal aéreo.

Durante la migración, la extensión sigue aceptando `texto_chosen` para no perder compatibilidad con registros antiguos.

## Estrategia de caché

La caché actual se conserva y se versiona de forma compatible.

Datos guardados:
- versión de esquema
- fuente
- fecha de sincronización
- agencias normalizadas

Estructura conceptual:

```json
{
  "schemaVersion": 2,
  "source": "gist",
  "syncedAt": "2026-07-19T00:00:00.000Z",
  "agencies": []
}
```

La caché antigua por listas separadas todavía sigue disponible para no romper la extensión.

## Selector terrestre/aéreo

Todavía no se implementó el selector visible final.

Lo que sí está preparado:
- la normalización diferencia terrestre y aéreo
- el contrato ya acepta ambos canales
- `content.js` puede seguir usando el valor heredado mientras exista

## Seguridad del token

Si CodeRED Platform requiere token:
- debe guardarse solo en `chrome.storage.local`
- no debe quedar en el código fuente
- no debe registrarse en consola

Nota importante:
- `chrome.storage.local` no es un almacén criptográfico
- sirve para persistencia local, no para secretos de alta sensibilidad

## Permisos Manifest V3

Permisos actuales:
- `storage`
- `alarms`

Hosts actuales:
- `https://api.github.com/gists/*`
- `https://gist.githubusercontent.com/*`
- `https://*.shalom.pe/*`
- `https://*.shalomcontrol.com/*`

Para CodeRED Platform se deberá agregar solo el dominio real de la API cuando esté confirmado.
No se debe usar `<all_urls>`.

## Roadmap de migración

### Sprint 01
- diagnóstico
- normalización
- abstracción mínima de fuente
- pruebas

### Sprint 02
- cliente API de CodeRED Platform
- configuración de URL y token
- sincronización manual
- fallback Gist

### Sprint 03
- CodeRED como fuente principal
- caché versionada
- fallback offline
- indicadores de sincronización

### Sprint 04
- selector terrestre/aéreo
- uso correcto de `chosenTextTerrestrial` y `chosenTextAir`
- deshabilitar selección si el canal no existe

### Sprint 05
- integración completa con `content.js`
- selección automática en Shalom
- pruebas de DOM

### Sprint 06
- retirar Gist
- limpieza
- documentación final
- preparación de release

