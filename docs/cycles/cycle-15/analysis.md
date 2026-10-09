# Análisis ciclo 15

## Entregado frente a lo especificado
- P15.3: `npm run lint` pasa a `oxlint --deny-warnings`; el lint sale limpio con solo 2 disables de `react/set-state-in-effect` (`App.tsx:58,60`). La spec preveía un tercero (pureza) que no hizo falta. CI hereda el script. Nota añadida en `docs/DEPLOY.md`.
- P15.1: botón «Deshacer» en cada fila de «Registrado hoy» (`todaySummary.done[].undo`, `add` devuelve la cantidad, foco a `h2#hoy` si la fila desaparece). Tests U23 y asserts H7/H8. Nada recortado.

## Deuda nueva
- Menor: plural con 1 en «Deshacer +1 sesiones» (`HomeView.tsx:136`, `TrackerCard.tsx:223`); sin helper de pluralización.
- Menor: la spec llama U13 al test que es U23 (solo nomenclatura).
- `ponytail:` nuevo: setState en el efecto de guardado (aviso aceptado con disable); alternativa, guardar en cada handler.

## Fricción del proceso
- Sin fallos. Único desajuste: la spec anticipó 3 disables y bastaron 2; conviene que el tech-lead verifique el lint real antes de fijar el número.

## Riesgos para el ciclo siguiente
- `--deny-warnings` hace que cualquier dependencia/regla nueva de oxlint pueda romper CI al actualizar; fijar versión.
- Persisten los huecos de producción (§5): sin backend, IA solo en local, persistencia solo localStorage.
