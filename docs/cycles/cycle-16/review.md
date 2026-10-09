# Revisión ciclo 16

Veredicto: **APROBADO**

Hallazgos: 0 bloqueantes, 0 importantes, 2 menores.

Verificado en `cycle-16`: `npm run build` OK, `npm run lint` (ya con `--deny-warnings`) código 0, `npm test` 3 veces seguidas con 84/84 y sin intermitencias. La key no aparece en `dist`.

## Puntos de atención
1. T1 correcto. `__AI_PROXY__ = command === 'serve' && !!key`, `preview` sin proxy, key fuera del bundle. Los textos «dev/preview» quedan corregidos en vite.config, classify.ts, README, DEPLOY, ESTADO-ACTUAL y CLAUDE.md. Solo quedan menciones en specs históricas.
2. `weekly` (stats.ts) aplica la misma regla que `streak`: semana en curso con `t.weeklyGoal` y pasadas con `goalAt`. Rangos `[lunes, lunes+7)` y la actual `[lunes, today+1)`. W1 compara con `streak` en 11 casos; W2 y W3 comprueban valores a mano; los asserts existentes no cambian.
3. UI: barras y leyenda con `aria-hidden`, `<ul sr-only>` con frase por semana, cumplimiento con icono `Check`, semana en curso con borde discontinuo y texto «(en curso)», tokens `hero`/`villain` por rama sin hex ni mezcla. Ocho columnas `flex-1` sin texto caben en 390 px. Test U-W1 cubre las frases.

## Menores
- `app/src/components/TrackerCard.tsx` (bloque «Últimas 8 semanas»): la leyenda «borde discontinuo: semana en curso» se muestra aunque ninguna fila esté cumplida. Es cosmético y la spec la pide así.
- `weekText` y `max` se calculan en cada render aunque el `<details>` esté cerrado. Coste despreciable con 8 filas; no hace falta cambiarlo.
