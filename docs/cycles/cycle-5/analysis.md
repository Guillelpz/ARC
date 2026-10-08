# Análisis ciclo 5 — Restaurar copia interna (P4.4)

## Entregado frente a lo especificado
Completo: «Recuperar copia anterior» en «Tus datos» (intercambio atómico con `.backup.last`, repetible para deshacer), `writeAll` compartido con `backupCurrent`, tests R1–R6 (36/36). Review APROBADO sin bloqueantes. Recortado por spec: restaurar `.backup.prev`/sellados, elegir copia, mostrar fecha, purgar sellados. Desviación aceptada: `setCanRestore(hasLastBackup())` en vez de `true`.

## Deuda nueva
- menor: tras restaurar no se llama a `setCanRestore` (correcto, solo anotado); `.backup.last` guarda el valor bruto de localStorage, que puede diferir de lo visible si la clave estaba bloqueada.
- `ponytail:` nuevos/ajustados en `storage.ts`: solo `.backup.last` se restaura (prev por DevTools); sellados `.backup.<stamp>` sin purga, uno por incidente; cada clave se trata por separado.

## Fricción del proceso
Sin incidencias: ciclo corto (2 tareas) y review limpia. Única fricción: un `docs/cycles/cycle-7/` y otro spec en paralelo en el árbol de trabajo obligan a `git add` selectivo.

## Huecos y riesgos para el siguiente ciclo
- Sigue sin haber copia automática ni sincronización: el único respaldo real es exportar (persist() es solo petición).
- Restaurar no muestra la fecha de la copia ni qué contiene; el usuario decide a ciegas.
- Sin tests de UI: el botón y `restore()` en `App.tsx` solo se verifican a mano.
- Los backups sellados crecen sin límite si hay incidentes repetidos.
