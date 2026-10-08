# Análisis ciclo 9 — party y ranking

## Entregado frente a lo especificado
- P9.3: ranking con amigos simulados prorrateados por día de la semana (1/7 lunes … 7/7 domingo), `today` obligatorio en `buildRanking`/`derivePartyState`. Asserts migrados solo en el helper; K1–K5 nuevos.
- P9.2: proponer una actividad custom existente a parties sin criterio ni rechazo; el resultado persiste vía `proposals`.
- No se recortó nada; review aprobada a la primera (59/59 tests).

## Deuda nueva
- menor: en `App.test.tsx` U15 va antes de U14 (sin impacto).
- `ponytail:` nuevo en `party.ts`: amigos a ritmo lineal; el límite es que no modela días de descanso ni ritmo real.

## Fricción del proceso
- Sin incidencias en el ciclo. Único roce: `docs/cycles/STATE.md` se actualiza en dos commits separados tras el merge.

## Huecos y riesgos para el siguiente ciclo
- PARTY sigue siendo ficticia: el prorrateo mejora la verosimilitud pero no sustituye backend/cuentas.
- Proponer solo cubre tarjetas custom; las fijas no se pueden proponer a parties nuevas.
- Lunes: los amigos puntúan 1/7, así que el ranking del lunes es casi siempre favorable al usuario; revisar si confunde.
