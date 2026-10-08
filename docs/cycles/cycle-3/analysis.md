# Análisis ciclo 3

## Entregado frente a lo especificado
Entregado completo (P3.3, P3.2): T1 meta de exportación, copia interna y `requestPersist`; T2 conexión en `App` (exportar antes de «Borrar todo», copia previa a borrar/importar); T3 bloque «Tus datos» en la home. Desviación aceptada: `requestPersist()` se llama en `exportData`. Review CAMBIOS y luego APROBADO en segunda vuelta (build, lint, 26 tests). Sin recortes.

## Deuda nueva
- `menor` 3: `lastExportAt` futura (reloj mal puesto) da 0 días y suprime el aviso; descartar fechas > `now` en `loadLastExport`.
- `menor` 4: `setLastExport` se aplica aunque `saveLastExport` falle por cuota; al recargar vuelve a «sin copia».
- `menor` 5: con almacenamiento bloqueado (`locked`), `backupCurrent` lee la clave bruta y puede copiar el valor corrupto o nada.
- `ponytail:` nuevos (`storage.ts`, `App.tsx`): exportación cuenta al lanzar la descarga; recordatorio fijo a 14 días; copia de dos niveles (tres destructivas seguidas pierden la más antigua); `persist()` solo petición.
- `CLAUDE.md` desfasado (no editado): la sección de `storage.ts` solo cita dos claves; falta `life-rpg-meta-v1`, la copia interna `.backup.last`/`.backup.prev` y `requestPersist`.

## Fricción del proceso
La primera revisión halló dos importantes de integridad (copia no atómica, sobrescritura del único backup) que la spec no anticipaba: costó una segunda vuelta. Conviene que el tech-lead incluya en la spec "las operaciones destructivas con copia: atomicidad y número de niveles". Además, dos agentes escribiendo `docs/` a la vez obligan a `git add` selectivo.

## Huecos y riesgos para el siguiente ciclo
- No hay UI para restaurar `.backup.last/.prev` (P4.4): la red de seguridad existe pero solo se usa por DevTools.
- Los backups con sello `<clave>.backup.<stamp>` nunca se purgan y pueden llenar la cuota, lo que haría fallar `save*` y `backupCurrent`.
- Sin tests de UI del flujo exportar/borrar; sigue pendiente persistencia solo local, party simulada e IA sin endpoint.
