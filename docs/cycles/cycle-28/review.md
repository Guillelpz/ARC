# Review ciclo 28 — menos llamadas a Haiku (O3 + O1, M-B)

**Veredicto: APROBADO** (OK). Hallazgos: 0 bloqueantes, 0 importantes, 3 menores.

Verificado sobre `cycle-28`: `npm run build`, `npm run lint` y `npm test` en verde (207 tests, incluye selfcheck).
T1-T5 cumplen la spec. T6 (D1) fuera de alcance a propósito. U-M1..U-M3 en lugar de U-C8..U-C10: desvío aceptado.

## M-B
- `MEMO_KEY` no está en `isDataKey` (lista exacta de claves) y `backupCurrent`, `restoreLast`, `exportBackup`, `parseBackup` y `mergeBackup` no se han tocado: la clave queda fuera. No hay iteración por prefijo `life-rpg-` en storage.
- `reset()` llama a `clearMemo()` después del `confirm` y del `backupCurrent` correctos; no toca la clave de IA (U-M3 lo comprueba).
- Formato `{v:1, entries}`, `readMemo` valida, descarta, deduplica y recorta a 200; error de lectura o JSON roto devuelve `[]` sin backup ni aviso.

## Resto
- Deshacer y Editar (gym y hábito) llaman a `onForget`; solo se aprende de `source` `ai`/`memory` y solo tras guardar automáticamente (no en `form`, `new` ni otro día).
- Validación al usar: `recall` exige ejercicio en `ctx.exercises` (activos) y hábito activo no archivado; no borra la entrada.
- Orden de decisión correcto en `localCapture`; `interpretCapture` solo llama a Haiku si no está resuelto. `aiNote` usa `source !== 'ai'`.
- `core/` sigue sin React ni localStorage; `memory.ts` es puro. Sin derivados persistidos. Sin cambios de UI visibles.
- Selfcheck: solo se añaden asserts (CV12, CV13, MC1-MC5); ninguno relajado. Cubren memoKey, learn/forget/LRU, readMemo, recall (validación por activo, peso corporal) y localCapture.

## Hallazgos menores
1. `app/src/App.test.tsx` (U-M3): llama a `exportBackup([], …)` con datos vacíos y `as never`; prueba poco que la memoria no entra en copias. La cobertura real está en `storage.test.ts` (backupCurrent/isDataKey). Convendría añadir `restoreLast`/`parseBackup` en el test de storage.
2. `app/src/core/memory.ts:13` (`memoKey`): usa `captureNorm`, pero lo que se aprende en gym es el texto original; frases pegadas como «100kg» (sin espacio) dejan un token con dígitos en la clave y no casan al repetirlas con otro número. Solo pierde aciertos de caché, no es un fallo. Verificar con un assert si se quiere.
3. `app/src/core/capture.ts` (`deviceSure`): coincidencia exacta por palabra suelta («I ran out of milk» → Running). Ya documentado con `ponytail:` en la spec; vigilar falsos positivos.
