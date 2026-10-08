# Review ciclo 7: Hoy y rachas

Veredicto: **APROBADO**

`build`, `lint` y `npm test` (52 tests) pasan en `cycle-7`.

## Hallazgos

Bloqueantes: 0. Importantes: 0. Menores: 2.

- menor, `app/src/core/stats.ts` (`todaySummary`): `missing` ignora los eventos de `today` solo por el filtro de `week`. Es correcto, pero depende de que `stats.week` venga de `deriveGame` con el mismo `today`. Conviene un comentario o un assert si se reutiliza con otro `today`.
- menor, `app/src/components/HomeView.tsx` (lista «Te faltan»): navega siempre a `'hero'`. Hoy es correcto porque `weeklyGoal` solo existe en HERO (`classify.ts:118`). Si algún día VILLAIN tiene objetivo, hay que usar `t.branch`.

## Contraste con los puntos de atención

1. **Regla de racha:** `streak` devuelve 0 sin `weeklyGoal` y sin eventos propios. La semana en curso solo suma si ya cumple y nunca rompe. Hacia atrás usa el objetivo actual y corta en la primera semana incumplida o en la semana del primer evento. `todaySummary` y `best` filtran las archivadas, y el empate lo gana el primero. Cumple.
2. **Fechas:** el rango de la semana en curso es `[lunes, today+1)` y el de las pasadas `[w, w+7)`. `daysLeftInWeek` da lunes=7 y domingo=1 (assert H3). Se cubre el primer evento (S6), el lunes (H3) y un día pasado que recompone la racha (S4).
3. **P7.4:** `undoneIds` solo cuenta los `undoes` con `amount < 0`, y `history` lo reutiliza. `add` rechaza deshacer un id ya anulado. Los asserts R1 y R2 lo cubren.
4. **Asserts:** solo se añaden (R, S, H); el único `-` del diff de `selfcheck.ts` es la línea de imports. Rendimiento: el coste de `streak` es O(semanas · eventos del tracker) por tarjeta. La spec lo asume y el `ponytail:` marca el límite.

## Arquitectura y UI

`streak` no se persiste. `core/` sigue sin React y la persistencia no cambia. La UI usa tokens (`app-*`, `c.chip`), sin hex ni `slate`, y el tono es consistente. No hay exceso de código.
