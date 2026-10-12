# Review ciclo 24 (módulo Gym)

Veredicto: **CAMBIOS** (0 bloqueantes, 1 importante, 3 menores). build, lint y test (118) pasan en `cycle-24`.

## Importante
1. `app/src/App.tsx:~312` (confirmación de «Recuperar copia anterior»): `restoreLast` intercambia también `life-rpg-gym-v1` con su `.backup.last`, pero el texto solo habla de registros y misiones. Las series de gym pueden cambiar sin aviso (el import sí lo avisa). Corrección: añadir a la confirmación «Series de gym: X → Y» cuando `r.gym !== null`, igual que en importar. (Desviación declarada: no aceptable tal cual.)

## Menores
1. `app/src/core/merge.ts:3`: `core/merge` importa `EMPTY_GYM` de `storage.ts`; mejor definir `EMPTY_GYM` en `gym.ts`/`types` para no acoplar la fusión pura a la capa de persistencia.
2. `restoreLast` con `.backup.last` sin clave gym (copias anteriores al módulo) conserva el gym actual mientras cambian los eventos: series sin sesión automática correspondiente. Aceptable, pero documentar con `ponytail:`.
3. `App.tsx` `autoSession` no registra sesión si hay una manual en el día y luego se deshace esa manual con series vivas: el día queda con series y 0 sesiones. Caso límite, documentar.

## Verificado
- Migración: copia sin `gym` → `gym: null` (import deja EMPTY_GYM y avisa de las series locales; fusión conserva el gym local, GY11). Clave gym ausente en localStorage → vacío. `readGym` valida series/ejercicios, conserva claves desconocidas y descarta `__proto__`. Backups: `backupCurrent`, `hasLastBackup`, `readLast`, `restoreLast`, `lockStorage`, `isDataKey` incluyen la clave gym.
- merge: M1-M8 intactos (diff solo añade; `mergeLog` genérico reutiliza la lógica anterior); gym idempotente, sin mutar, `id~n` con `undoes` reasignado, deshacer duplicado = ya estaba.
- Sesión automática: id/hora fijos `gym-auto-<día>`, sin duplicar con manual, retracción como evento `undoes` correcto, dedupe entre dispositivos (GY8-GY10); XP igual que manual (GY13); sin cambios en `rpg.ts`/`stats.ts`.
- selfcheck: ningún assert existente modificado (solo imports); GY1-GY13 significativos.
- Arquitectura: `gym.ts` sin React, récords y sesión derivados, sin party en el módulo. UI: sin hex ni `slate-*`, paleta HERO; BottomNav 6 pestañas con e2e a 320 px.

## Desviaciones declaradas
- 3 expectativas de `storage.test.ts` actualizadas (loadAll/parseBackup/readLast devuelven gym): correcto, es consecuencia del contrato nuevo.
- E4 sin «Cargar ejemplo», «Repetir serie» por ejercicio, RecordBanner sin prefijo, `exportBackup` con gym opcional, mensaje extra de validación de nombre: aceptadas.
- Confirmación de «Recuperar» sin mención a gym: ver importante 1.

## Vuelta 2

Veredicto final: **OK** (APROBADO). Commit 766a2a9.

- Importante 1 (confirmación de «Recuperar» sin mención a gym): resuelto. `App.tsx` añade «Series de gym: X → Y.» cuando la copia trae gym; test U32 lo cubre. Cuando `r.gym` es null (copia anterior al módulo) no hay aviso, pero conserva el gym actual y queda documentado con ponytail; aceptable.
- Menor (EMPTY_GYM en storage): resuelto; vive en `gym.ts`, `storage.ts` lo reexporta y `merge.ts` ya no depende de storage.
- Menores de sesiones: aplazados por decisión de producto, con comentario `ponytail:` que declara el límite. Aceptable.
- Sin cambios de comportamiento fuera de lo anterior. build, lint y test (119) pasan según el caller.
