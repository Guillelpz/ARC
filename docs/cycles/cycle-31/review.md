# Revisión ciclo 31a (refactor useFood)

Veredicto: APROBADO

Build, lint y test (228) en verde.

## Hallazgos
- menor: `AGENTS.md` no se actualizó (CLAUDE.md pide sincronizarlo a mano). Falta la mención a `src/useFood.ts` en la línea de `App.tsx`.
- menor: el efecto `saveFood` ahora corre antes que los de events/custom/gym (el hook se llama antes), así que el orden de escritura en storage cambia de food-último a food-primero. No es atómico ni antes ni ahora; sin impacto funcional.
- menor: `pushDiet`/`dietTracker` son declaraciones hoisted que leen `trackers` (const posterior); correcto porque solo se invocan desde handlers, pero frágil si alguien los llama durante el render.

## Verificado
- Los 9 handlers son idénticos al original (solo `nowStamp` -> `stamp`, `push(evs, dietTracker())` -> `pushDiet`).
- `syncDiet` conserva setFood + push en el mismo manejador (un solo render); closures de `food`/`events` iguales a las originales, sin awaits.
- `unsaved.food` pasa a `foodUnsaved` con la misma lógica; `saveFailed` lo incluye; SaveFailBanner intacto.
- Importar, fusionar, recuperar y «Borrar todo» siguen usando `setFood` (líneas 362, 402, 425, 445) y el evento `storage` también (deps `[setFood]`, estable).
- CLAUDE.md y ESTADO-ACTUAL.md actualizados.
