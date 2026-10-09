# Review ciclo 15

Veredicto: APROBADO

Hallazgos: 0 bloqueantes, 0 importantes, 2 menores.

Verificación en `cycle-15`: `npm run build` OK, `npm run lint` (`oxlint --deny-warnings`) exit 0, `npm test` 3 ejecuciones seguidas con 83/83 y sin intermitencias.

## Puntos de atención
1. Lint: script con `--deny-warnings`; solo 2 disables (`App.tsx:58` y `:60`, `react/set-state-in-effect -- ver ponytail`), justo encima de la línea afectada. La spec preveía un tercero (pureza, `:52`); no hace falta porque el lint ya sale limpio. CI hereda el script sin cambios.
2. `todaySummary.done[].undo`: usa `history(..., Infinity)` + `canUndo` + día de hoy; sin `undo` en +2/−1. H7 y H8 coinciden con la spec; H1-H6 intactos.
3. «Deshacer»: pasa por `undo` → `add` con `undoes`; `add` devuelve la cantidad (0 si no registra); foco a `h2#hoy` cuando `amount + registrado <= 0`; no queda `left!`. U23 cubre los 3 casos de la spec.
4. Concordancia: «Deshacer +1 sesiones en Gym» repite la unidad plural que ya muestra la fila («+1 sesiones») y que usa `TrackerCard.tsx:223` («Deshacer 1 sesiones…»). Es coherente con la app; el «+» usa `buttonLabel` («+1 sesión»), que es el único sitio con singular. No bloquea.

## Menores
- `HomeView.tsx:136`: etiqueta accesible con plural con 1 («+1 sesiones»). Opcional: usar la misma forma que `buttonLabel` si más adelante se añade un helper de pluralización; hoy sería exceso. Mismo caso en `TrackerCard.tsx:223`.
- `App.test.tsx` U23 (nombre): la spec lo llama U13; el número U23 es el correcto por continuidad (U22 existente). Solo actualizar la mención en la spec si se quiere.
