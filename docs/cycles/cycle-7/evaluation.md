# Evaluación — ciclo 7

Base: `main` (ciclos 1-4) + rama `cycle-5` (T1 de restaurar copia; `HomeView`/`App.tsx` con cambios sin commit). Se asume el ciclo 6 (P4.3 + P4.5) hecho antes de implementar el 7.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P7.1 | APROBAR CON CAMBIOS | S | bajo | Problema real: `goalPct` (`stats.ts:55`) no tiene memoria y no hay `streak` en `src/`. Es un derivado puro, sin esquema nuevo. El toast es el punto débil. |
| P7.2 | POSPONER (ciclo 8, partida) | M | medio | Depende de P4.3 (ciclo 6) y de P7.1. Junta dos cambios de reglas distintos. Hoy `weeklyGoal` solo afecta a la UI (`stats.ts:55`, `TrackerCard.tsx:61-68`), así que el riesgo de dominio es bajo, pero el de esquema (`goals` en `custom`) no lo es. |
| P7.3 | APROBAR CON CAMBIOS | S | bajo | Afirmación correcta: solo `MissionsView`/`TrackerCard` usan `today`. Pero «XP ganada hoy» mezcla HERO y VILLAIN en un número. |
| P7.4 | APROBAR | XS | bajo | Confirmado. `history` (`stats.ts:32`) mete en `undone` cualquier `undoes`, aunque el evento sea positivo (`readEvents` lo acepta). `add` (`App.tsx:85-88`) no comprueba si el destino ya está deshecho: solo lo frenan la UI y `clampAmount`. Hoy solo es alcanzable con datos importados o editados, pero un doble deshacer resta XP dos veces. |

## Cambios pedidos

**P7.1**
- Sin toast de pantalla completa. `LevelUpToast` tiene un solo hueco (`toast`) y la racha crece justo en el toque que cumple el objetivo, que suele ser también el del level-up: se pisarían. En su lugar, la racha va en la tarjeta con la animación `pop` que ya usa «Objetivo cumplido».
- La «mejor racha» de la home va dentro del bloque «Hoy» de P7.3, no en un elemento aparte.
- La racha se calcula con el objetivo **actual** del tracker, también para semanas pasadas: si con P4.3 se baja el objetivo, la racha crece hacia atrás. Hay que marcarlo con `ponytail:`.
- El bucle hacia atrás se corta en la semana del primer evento del tracker, y no se recorre `events` entero por cada semana: se filtra una vez por `trackerId`.
- Solo cuentan los trackers con `weeklyGoal` (HERO). Las archivadas (P4.3) no se muestran.

**P7.3**
- XP de hoy por rama («+60 HERO · +15 VILLAIN»), no en un solo número. Contando negativos, se muestra el neto.
- `todaySummary` se calcula en `App.tsx` con `useMemo` y se pasa a `HomeView` ya calculado: el componente sigue siendo presentacional. «Te faltan» reutiliza `week` y `weeklyGoal` de `game.trackers`, sin recalcular la semana.
- «Quedan N días» cuenta hoy (domingo = 1). Las cantidades van redondeadas y con unidad (km/min).
- Se implementa después de mergear el ciclo 5, que también toca `HomeView`.

**P7.4**
- Las dos guardas se hacen en `core/`. `history` cuenta un `undoes` solo si `amount < 0`. Un helper puro en `stats.ts` (p. ej. `isUndone(events, id)`) lo usan `history` y `add`. Un assert para cada caso. Se deja sin tocar `readEvents`, como dice la propuesta.

**P7.2 (cuando entre)**: hay que partirla. (a) `weeklyLimit` en VILLAIN, más su racha «bajo control», va en un ciclo. (b) Los overrides `goals` de las fijas se aplican en `allTrackers` y se validan en `readCustom`, con un test de datos antiguos sin `goals`. Va sobre la UI de edición de P4.3.

## Cambios de reglas de juego: necesitan el okay del usuario

1. **P7.1:** introducir la racha como mecánica visible. Las condiciones son: semanal (no diaria), sin XP, la semana en curso no la rompe y se calcula con el objetivo actual de forma retroactiva.
2. **P7.2a:** que VILLAIN tenga una meta (límite semanal opcional). Hoy el diseño es «más vicio = más XP, sin meta», y el selfcheck lo fija (`selfcheck.ts:34`).
3. **P7.2b:** que los objetivos de las 6 fijas (`trackers.ts:4-7`, fijados en TECH_SPEC) pasen a ser editables. Además, cambia el esquema de `life-rpg-custom-v1`.

P7.3 y P7.4 no cambian reglas.

## Ciclo 7 recomendado

**P7.4 → P7.3 + P7.1**, con los cambios de arriba. P7.4 va primero, como tarea corta: cierra la integridad del deshacer antes de añadir más derivados. Las tres tocan `stats.ts`, `selfcheck.ts` y la home y TrackerCard. No tocan `storage.ts` ni el esquema, y no añaden dependencias. Si el usuario no da el okay al punto 1, el ciclo queda en P7.4 + P7.3.

Orden siguiente: P7.2a → P7.2b (ciclo 8, con P4.3 ya mergeado).
