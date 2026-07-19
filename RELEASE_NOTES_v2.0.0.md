# Release Notes v2.0.0

Buscador Shalom Control v2.0.0 es la primera versión estable centrada en CodeRED Platform.

Highlights:
- CodeRED como fuente principal.
- Sincronización con `ETag`, `304`, `changes` incremental y `full sync`.
- Selector visible terrestre / aéreo con preferencia persistida.
- Caché local v3 y migración de configuraciones anteriores.
- Eliminación de la integración heredada con GitHub Gist.

Security:
- Sin token hardcodeado.
- Sin `<all_urls>`.
- Sin `eval`.
- Sin código remoto ejecutable.

Validation:
- `npm test`
