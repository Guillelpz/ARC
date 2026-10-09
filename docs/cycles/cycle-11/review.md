# Review ciclo 11 — racha vigente y aviso de guardado

Veredicto: **APROBADO**

Comprobado en `cycle-11`: `npm run build` OK; `npm run lint` 0 errores y 2 warnings nuevos (ver menor 1); `npm test` x3: 77/77 las tres veces, sin intermitencias.

## Hallazgos

### menor
1. `app/src/App.tsx:57-58`: dos warnings `react(set-state-in-effect)` (en `main` había 0). Una alternativa sin warning exigiría guardar en los handlers (los `setEvents`/`setCustom` usan updaters funcionales en muchos sitios) o un store externo con `useSyncExternalStore`: más código y más riesgo que el efecto actual. Se acepta. Corrección esperada: añadir encima un comentario `ponytail:` que explique que el efecto sincroniza con localStorage (sistema externo) y por eso el setState es intencional, o desactivar la regla en esas dos líneas.
2. `app/src/App.tsx:57`: si una clave pasa de fallo a bloqueada (`null`), `unsaved` se queda como estaba. Caso casi imposible (el bloqueo se fija al cargar); sin acción.

## Puntos de atención
1. Regla de racha: correcta. `goalAt` (`stats.ts`) toma el primer apunte con `until > mon`, así que antes del primer apunte rige su `goal` (el vigente antes del cambio) y sin apuntes rige el actual. `logGoal` conserva el primer cambio de la semana; `null` corta la racha. Bajar el objetivo no la alarga (GL1). Ningún assert existente cambia de valor (S5 solo cambia el mensaje, como pide la spec). GL1-GL6 y H6 presentes.
2. `goalLog`: validado en `readCustom` (formato, lunes, goal>0 o null, `dropped` contado); C10-C12 cubren el round-trip por exportar/importar y backup/restaurar. `pastGoals` se elimina en `saveTracker` y U19 comprueba que no llega a `trackers[]`. `hasData` cuenta `goalLog`.
3. Guardado: `true/false/null` correctos; el estado `unsaved` es por clave y se limpia con el siguiente guardado correcto; `null` no avisa (lo cubre `noticeFor`). El texto del fallo tiene prioridad en `role="status"`. U20 cubre aparecer, exportar y desaparecer. Ningún fallo se traga.
4. Ver menor 1.
5. Tests estables (3 ejecuciones).

UI: banner con tokens por tono, sin hex ni `slate-*`, sin mezclar paletas. Sin exceso de código.
