# Review ciclo 21 — Importar y fusionar + compartir la copia

Veredicto: **APROBADO**

Gate en `cycle-21`: build OK, lint OK (0 warnings), `npm test` x3 (95 tests, estable), e2e 3/3.

Hallazgos: 0 bloqueantes, 0 importantes, 2 menores.

## Comprobaciones
- `core/merge.ts` sigue la spec: locales intactos y en orden, `id~n` con reasignación de `undoes`, idempotente (M3), deshacer duplicado descartado y `undone` ampliado (sin doble deshacer), custom por spec (trackers, goals, goalLog solo de misiones añadidas, proposals por par). Pura, sin mutar (M8). M1-M8 presentes y no relajan nada.
- `mergeData`: stale corta con `STALE_BLOCK_TEXT`; `!changed` avisa sin confirmar; cancelar no cambia nada; `backupCurrent` antes de aplicar y aborta si falla; `setCanRestore` antes de aplicar, así que «Recuperar copia anterior» deshace la fusión (U-F4).
- Compartir: solo standalone + `pointer: coarse` + `canShare`; `AbortError` no cuenta; otros errores caen a descarga y cuentan; `reset` no espera a `share` para borrar (solo cambia el aviso).

## Menores
1. `app/src/App.test.tsx`: sin test de la rama `stale` en `mergeData` ni del fallo de `backupCurrent` (ambas ramas existen en `App.tsx` `mergeData`). Añadir en un ciclo próximo.
2. `app/src/App.tsx` `reset()`: el aviso «Copia exportada…» ahora llega tras la promesa; si la hoja de compartir queda abierta, el usuario no ve nada hasta cerrarla. Aceptable; verificar en el iPhone real (condición abierta desde el ciclo 15).
