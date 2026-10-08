# Análisis ciclo 7: Hoy y rachas

## Entregado frente a lo especificado
Entregado completo: P7.4 (guardas del deshacer: `undoneIds` + rechazo en `add`), P7.3 (bloque «Hoy» en la home) y P7.1 (racha semanal con chip en `TrackerCard`). Review APROBADO sin bloqueantes ni importantes; 52 tests. Sin recortes. Lo excluido por spec sigue fuera: toast de racha, rachas en VILLAIN o sin objetivo, notificaciones.

## Deuda nueva
- Menor: `todaySummary.missing` depende de que `stats.week` venga de `deriveGame` con el mismo `today` (sin comentario ni assert).
- Menor: la lista «Te faltan» navega siempre a `'hero'`; habrá que usar `t.branch` si VILLAIN tiene objetivo.
- `ponytail:` nuevo en `stats.ts` (`streak`): usa el `weeklyGoal` actual en semanas pasadas y cuesta O(semanas·eventos) por tarjeta (y otra vez en cada `derivePartyState`).
- Heredada y abierta: los 4 menores del ciclo 6 (propuesta P9.1).

## Fricción del proceso
Sin fallos de implementación ni review. El coste estuvo en la preparación: ciclo 9 evaluado y propuesto antes de cerrar el 7, con un ciclo 8 sin rastro en este análisis; conviene que `STATE.md` deje claro qué ciclo es el siguiente.

## Para el siguiente ciclo
- Ranking de party injusto (P9.3): el lunes el usuario va a 0 frente a la semana completa de los amigos; cambia reglas y asserts de ranking, necesita decisión explícita.
- La racha mezcla objetivo actual con pasado: si el usuario baja el objetivo, la racha crece sin mérito.
- «Hoy» no permite registrar desde la home; decidir si merece la pena antes de añadir más contenido a la home.
