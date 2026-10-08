# Propuestas — ciclo 7

Contexto: ciclo 5 (P4.4) y ciclo 6 (P4.3 editar/archivar propias + objetivo semanal en custom HERO, P4.5 tests de componentes) se dan por hechos. P3.4 y P3.5 siguen pospuestas. Foco pedido: motivar el uso diario sin backend.

## P7.1 — Rachas semanales por actividad (`producto`)
- Problema: no hay ninguna noción de constancia: el único feedback es el objetivo de la semana en curso (`goalPct` en `stats.ts:55`, «Objetivo cumplido» en `TrackerCard.tsx:62`), que se reinicia cada lunes sin memoria. Cumplir 8 semanas seguidas se ve igual que cumplir una (no hay `streak` en `src/`).
- Propuesta: `streak(events, tracker, today)` puro en `stats.ts`: número de semanas lun–dom consecutivas, terminando en la anterior, con el objetivo semanal cumplido; la semana en curso suma si ya está cumplida y no rompe la racha si aún no. Se muestra en `TrackerCard` («Racha: 5 semanas») y la mejor racha activa en la home. Toast al ampliar la racha (reutiliza el toast de level-up). Asserts en `selfcheck.ts` (racha 0, racha que sigue con la semana en curso a medias, racha rota, evento en día pasado que la recompone). NO: rachas diarias (castigan un día de descanso y chocan con objetivos semanales), XP extra por racha, rachas en VILLAIN (ver P7.2), guardar la racha (se deriva).
- Valor: alto (es el gancho clásico de vuelta diaria/semanal y encaja con el modelo semanal existente) / Coste: S / Riesgo: bajo (solo derivado; si P4.1 permite registrar ayer, la racha se puede reparar, que es lo deseado).
- Requiere: nada.
- Depende de: — (con P4.3 las custom HERO con objetivo entran solas).

## P7.2 — Límite semanal en VILLAIN y objetivo ajustable en las fijas (`producto`)
- Problema: en VILLAIN no hay meta alguna (`selfcheck.ts:34`, «villain sin objetivo»): más cerveza solo da más XP, sin ningún feedback de control. Y los objetivos de las 6 fijas están clavados en `trackers.ts:4-7` (Gym 4, Running 20 km...): si no encajan con el usuario, la barra de progreso no motiva o es inalcanzable, y P4.3 excluye editar las fijas.
- Propuesta: (a) campo opcional `weeklyLimit` en VILLAIN: la tarjeta muestra «3 / 5 esta semana» con barra que se pone en estado de aviso al pasar el límite y «Semana bajo control» al cerrar la semana dentro; la racha de P7.1 cuenta semanas bajo el límite. (b) Overrides de objetivo/límite para las fijas guardados en `life-rpg-custom-v1` (`goals: { [trackerId]: number }`), editables con la misma UI de P4.3 y validados en `readCustom` (finito > 0; datos antiguos sin `goals` siguen válidos, con test). NO: penalizar XP por pasar el límite, cambiar `xpPerUnit` o umbrales, límites diarios.
- Valor: medio-alto (da sentido a la rama VILLAIN más allá de acumular, y objetivos realistas = barra que motiva) / Coste: M / Riesgo: medio (esquema compatible en `custom` y nuevo assert de dominio).
- Requiere: cambio de reglas de juego (VILLAIN pasa a tener límite opcional; el selfcheck `villain sin objetivo` se mantiene para el caso sin límite) y cambio de esquema compatible en `life-rpg-custom-v1`. Sin dependencias.
- Depende de: P4.3 (UI de edición y validación de `weeklyGoal`); P7.1 para la parte de racha.

## P7.3 — Bloque «Hoy» en la home (`producto`)
- Problema: la home enseña niveles y composición all-time, pero nada del día: ningún componente usa `today` fuera de `MissionsView`/`TrackerCard`. Al abrir la app no se ve qué se ha hecho hoy ni qué falta para los objetivos de la semana, que es justo lo que empuja a registrar.
- Propuesta: tarjeta arriba en la home con XP ganada hoy (suma de eventos del día × `xpPerUnit`), actividades registradas hoy y «Te faltan» para los objetivos HERO no cumplidos (p. ej. «Gym: 2 sesiones, quedan 4 días»), cada una con acceso directo a su pantalla. Función pura `todaySummary(events, trackers, today)` en `stats.ts` con assert. Estado vacío si no hay nada hoy («Aún nada hoy»). NO: notificaciones push ni recordatorios (requieren PWA/service worker, otro ciclo), registrar desde la home, recomendaciones de IA.
- Valor: alto (convierte la home en el punto de entrada diario) / Coste: S / Riesgo: bajo.
- Requiere: nada.
- Depende de: — (si entra P7.1/P7.2, mostrar rachas en riesgo y límites aquí es una línea más).

## P7.4 — Cerrar los dos menores del ciclo 4 (`deuda`)
- Problema: `add` (`App.tsx:84-88`) acepta deshacer un evento ya deshecho (solo lo impide la UI) y `history` (`stats.ts:34`) marca como deshecho el destino de cualquier `undoes`, aunque el evento sea positivo (análisis ciclo 4, «Deuda nueva»). Con P4.3 y P7.x tocando estos caminos, conviene cerrarlos antes.
- Propuesta: en `history` solo cuenta `undoes` si `amount < 0`; en `add`, ignorar un deshacer cuyo destino ya está deshecho (misma regla, reutilizando `history`/un helper de `stats.ts`). Assert en `selfcheck.ts` para cada caso. NO: tocar `readEvents` ni el formato del evento.
- Valor: medio (integridad de datos) / Coste: S / Riesgo: bajo.
- Requiere: nada.
- Depende de: —
