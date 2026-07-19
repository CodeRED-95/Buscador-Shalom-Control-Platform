# Changelog

## 2.0.0 - 2026-07-19

### Added
- Sincronización estable con CodeRED Platform usando `ETag`, `304`, `changes` incremental y full sync.
- Selector visible de canal `Terrestre` y `Aéreo` con preferencia persistida.
- Badges de estado de canal en grid, popup y opciones.
- Registro local de fallback cuando CodeRED no responde.

### Changed
- CodeRED pasa a ser la fuente principal.
- Se eliminó la integración heredada con GitHub Gist.
- Se migró la configuración antigua a la nueva fuente estable.
- Se actualizó la caché local a esquema v3.

### Security
- Sin `eval`.
- Sin `<all_urls>`.
- Sin token hardcodeado.
- Sin token en `content.js`.
- Solo hosts necesarios por Shalom Control.

### Testing
- Cobertura para instalación limpia, migración de caché, `304`, incremental, full sync, offline y selector de canal.
