# Evaluación — ciclo 11

Base: `main` (ciclos 1-8) leída en el árbol de `cycle-9`, que solo cambia party/ranking. Se asume el orden 9 → 10 → 11.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P11.1 | APROBAR CON CAMBIOS (solo con okay de regla) | M | medio | El problema es real (`stats.ts:51-54` usa `t.weeklyGoal` para todas las semanas). Falta decidir qué pasa con «sin objetivo → con objetivo» y dónde se registra el cambio. |
| P11.2 | POSPONER (ciclo 12, después de P11.1) | M-L | medio-alto | Tal como está escrita, rompe código: «reutilizar `goals`» no es gratis y deja abierta la lectura de la XP. Ver abajo. |
| P11.3 | APROBAR CON CAMBIOS | S | bajo | Es real: `storage.ts:94` y `:98` tragan el error. La purga es lo único arriesgado, y además la propuesta la justifica mal. |
| P11.4 | APROBAR CON CAMBIOS | S | bajo | Cabe en el ciclo, pero la home no tiene XP flotante (solo `TrackerCard.tsx:200`) y la fila ya es un `<button>` (`HomeView.tsx:41`), así que no se le puede meter otro botón dentro. |
| P11.5 | APROBAR CON CAMBIOS (dentro de P11.1) | XS | bajo | (1) ya está hecho: `App.tsx:126` pasa `c.goals`. (2) y (3) tocan el mismo código que P11.1. |

## Cambios pedidos

**P11.1**
- El registro se adjunta al `Tracker` en `allTrackers(custom, goals, goalLog)`, por ejemplo con `pastGoals?: { goal, until }[]`. Así `streak(events, t, today)` mantiene su firma y no hay que pasar un parámetro por `deriveGame`/`derivePartyState`.
- Se escribe en un solo punto, `App.saveTracker`, mediante una función pura de `core/` (`logGoal(log, old, next, today)`). Ese punto cubre la edición de fijas y propias, y también el archivar con formulario que introduce P9.1 en el ciclo 10.
- Si hay varios cambios en la misma semana, se conserva la **primera** entrada: el objetivo vigente antes del primer cambio.
- Pasar de «sin objetivo» a «con objetivo» guarda `goal: null` hasta ese lunes, y las semanas anteriores no cuentan. Si el usuario prefiere que sí cuenten, no se registra nada.
- `readCustom`: una entrada inválida suma 1 a `dropped`. Tests C nuevos y backup round-trip.
- Absorbe P11.5 (2) y (3): `setGoal` en `App` omite `goals` cuando queda `{}`, y se añade un assert `todaySummary`/`deriveGame` con el mismo `today`.

**P11.3**
- Se quita la purga de sellados. Cada `.backup.<stamp>` sale de un incidente distinto, porque tras reparar se guarda limpio y la siguiente carga ya no sella. No son «copias redundantes de un mismo incidente»: borrar las antiguas pierde los datos crudos de incidentes anteriores. Además, `Store` no expone `key`/`length`. Se hará si algún día se mide un problema de cuota.
- El aviso se quita con el siguiente guardado correcto. El caso de clave bloqueada ya lo avisa `noticeFor` (`App.tsx:21`), así que no se duplica. Va después del ciclo 10 (región `role="status"` de P9.4).

**P11.4**
- `<li>` con dos botones hermanos: «ir a la rama» (el actual) y «+». Este último usa `aria-label` con `buttonLabel` y el nombre («+1 sesión en Gym»), porque `unit` va en plural. Paleta neutra `app-*`.
- El feedback en la home se limita al toast y a los banners, que son globales (`App.tsx:192-193`). No se añade XP flotante. Se corrige también `onGo={() => onNavigate('hero')}` (`HomeView.tsx:133`) para que use `t.branch`.

## P11.1 y P11.2: reglas, esquemas y asserts

**P11.1.** Regla: la decisión de P7.1 «objetivo actual también hacia atrás» pasa a «objetivo vigente en cada semana desde que existe registro». Lo anterior al registro sigue siendo retroactivo. Esquema: `goalLog?: { trackerId, goal: number | null, until: lunes }[]` en `life-rpg-custom-v1`, compatible porque si falta no cambia nada. Asserts: S5 (`selfcheck.ts:200`) no se rompe, porque es el caso «sin registro» y solo se renombra. Se añaden asserts para bajar, subir, `null→objetivo` y varios cambios en la misma semana. **Okay del usuario:** (a) la regla nueva; (b) que lo anterior al registro siga siendo retroactivo; (c) el caso `null → objetivo`.

**P11.2. Qué ha cambiado respecto a P7.2a.** Ya existen P4.3, P7.1 y P7.2b, de las que dependía. Además, ahora la semana en curso rompe la racha, aparece «Te pasaste en» en «Hoy» y se corrige el enlace de «Te faltan». **Lo que no dice:** reutilizar `weeklyGoal`/`goals` para VILLAIN cambia la semántica en `todaySummary.missing` (`stats.ts:95`, VILLAIN aparecería en «Te faltan»), en `goalPct` y en `streak` (`>=`). Además, hoy se descarta por diseño en `readCustom` (`storage.ts:43`, y `:55` porque `defaultGoal('beer')` es `undefined`), en `setGoal`, en `allTrackers` y en `editTracker` (`classify.ts:118`). Pedido: un campo propio, `weeklyLimit` (solo VILLAIN). Para Beer y Burgers se guarda en `goals` validado por rama, y «sin valor» significa sin límite. Hay que decidir también si la mejor racha de «Hoy» (`stats.ts:97`) mezcla las dos ramas. **Asserts y tests que cambian:** G2 (`setGoal({}, 'beer', 5)`), el test de `storage.test.ts:269` (`beer: 3` descartado) y U13 (Beer sin lápiz). «villain sin objetivo» (`:34`), E3 y C3 se mantienen si se usa un campo propio. **Okay del usuario:** (a) VILLAIN con meta opcional; (b) que la XP VILLAIN siga subiendo por encima del límite (subir de nivel «pasándote»); (c) racha VILLAIN: la semana en curso no suma y sí rompe; (d) esquema `weeklyLimit` + `goals` para Beer/Burgers.

## Ciclo 11 recomendado

**P11.1 (+ P11.5) + P11.3**: los dos trabajan en `core/`/`storage.ts` y en `App`, sin UI nueva salvo el aviso, y ninguno añade dependencias. Si el usuario no da el okay a P11.1, el ciclo queda en **P11.3 + P11.4**, y P11.1 se reduce a su alternativa XS (aviso en el formulario).
Siguiente (ciclo 12): **P11.2 + P11.4**. Las dos tocan el bloque «Hoy», y P11.2 hereda el `goalLog` para los límites.
