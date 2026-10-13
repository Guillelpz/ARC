# Review ciclo 27 — captura rápida por voz

Veredicto: **APROBADO** (0 bloqueantes, 0 importantes, 2 menores).

`npm run build`, `npm run lint` y `npm test` (196 tests, incluye selfcheck CV1-CV11, haiku.test, U-C*, a11y) pasan en `cycle-27`. E2E no ejecutado.

## Desviaciones del implementer
1. CV6 repartido entre T1 y T2: aceptable. La spec (§11) ya define CV6 con la parte `pickCapture`, que solo existe desde T2; no se relaja ningún assert.
2. `missingOf`/`VoiceMissing` en `components/voiceNotes.ts`: aceptable (re-export en `VoiceLog`, sin cambios de comportamiento).
3. `branchTone.ts` (`CARD`/`BRANCH_BTN`/`LABEL`/`BTN`/`PRESS`) y `role="status"` único en `CaptureView`: aceptable. La extracción es literal (mismas clases) y `UnknownView` la reutiliza. Paletas HERO/VILLAIN por rama entera, sin hex ni `slate-*` (grep limpio).
4. `core/rpg.ts:42` `diffLevels` por id: no cambia el comportamiento con listas iguales (el emparejamiento por índice y por id coinciden); para un hábito nuevo parte de nivel 1. Los asserts existentes no se tocan y pasan. Es necesario porque `push(..., [...trackers, t])` añade un tracker.
5. Tests adaptados (A13, E8, U-V7, A5/Nuevo, desaparición de «Dictar serie» en Inicio): coherente con C1 («Dictar» de Hoy y «+» son la captura general). `VoiceLog` sigue en Gym. No hay asserts relajados en `selfcheck.ts` (solo añadidos).

## Puntos de atención
- **Gesto iOS:** `App.openCapture` llama a `beginListen()` síncrono en el onClick, antes de `go()`/transition; `CaptureView` consume `start` una sola vez (ref `consumed`, seguro con StrictMode). OK.
- **Cuenta atrás 10 s** (`CaptureCards.tsx` NewHabitCard): solo con `source==='ai'`, confianza alta, cantidad no nula y sin `archivedDup` (`CaptureView.tsx` ~l.115); el parser limita a «media» (`capture.ts`). Se cancela con pointerdown, teclado, change, click, «Parar», pestaña oculta y al desmontar (cleanup del timeout); nombre duplicado deshabilita crear. OK. Sin clave nunca se crea sola (§3-A).
- **C6:** `other-day` gana siempre en `pickCapture` y no llama a `onAdd`/`onCreate`; «esta mañana» se excluye. OK.
- **Páginas→min:** ×2 solo con `t.id === 'reading'` (`resolveAmount`); custom con unidad «páginas» no convierte (CV4). OK.
- **Stopwords:** `STOPWORDS`/`ALL_UNITS`/números fuera de `matchTracker` y del nombre (CV5, CV10). OK.
- **Deshacer de hábito nuevo:** evento `undoes` + `archived: true`; neto 0 (U-C7). OK.
- **Clave de Anthropic:** `postHaiku` sin `console.*`, errores solo tipados (`HaikuError`); test comprueba que el body no contiene la clave. Sin fugas.
- Validación en frontera de la IA: `captureFromAI` valida enums, ids contra activos, longitudes y rangos; cualquier fallo cae al parser con `aiError`.

## Hallazgos
- **menor** — `app/src/core/rpg.ts:42`: el arreglo de `diffLevels` para hábitos nuevos no tiene assert propio en `selfcheck.ts` (solo lo cubre indirectamente U-C3/U-C7). Añadir uno: `diffLevelUps` con un tracker extra en `after`.
- **menor** — `app/src/components/CaptureCards.tsx` (efecto `visibilitychange`): solo reacciona a un cambio a «hidden»; si la tarjeta aparece con la pestaña ya oculta, la cuenta atrás sigue. Caso marginal.
