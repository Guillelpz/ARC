# Review ciclo 9 — party y ranking

Veredicto: APROBADO

Build, lint y test (59/59) en verde sobre cycle-9.

## Hallazgos
- bloqueante: 0
- importante: 0
- menor: 1

### menor
- `app/src/App.test.tsx` (U15 antes de U14): orden invertido de los tests. Sin impacto.

## Puntos de atención
1. Asserts: los 8 asserts de la tabla de migración solo cambian el helper (`rk`, `sgS`, `soS`, `sg1S`, fecha SUN = 2026-10-11). Valores esperados y mensajes idénticos. `ps` gana el parámetro `today = DEMO_DATE`. Los demás asserts no se tocan. K1–K5 son nuevos.
2. Prorrateo: `paced` usa d = 8 − daysLeftInWeek(today), de 1/7 (lunes) a 7/7 (domingo), con `Math.round` por campo. No muta `PARTIES` (K1 lo comprueba). `today` es obligatorio y las 5 llamadas fuera de selfcheck lo pasan (`App.tsx:106-107`, `PartyView.tsx:67`, `party.ts:80`).
3. P9.2: `proposable` excluye parties donde ya hay criterio o rechazo. Solo se pasa a tarjetas custom. El selector usa `THEME[branch]` (`check` accent-hero / accent-villain), sin mezclar paletas. El resultado se deriva de `proposals` en localStorage (persiste al recargar). `propose` ahora usa `c.goals`, como pide la spec.
4. `TrackerCard` `relative flex flex-col gap-3`: sin el botón queda un solo hijo en flow (el `float-xp` es absoluto), así que no cambia el layout.
