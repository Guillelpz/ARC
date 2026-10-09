# Evaluación — ciclo 16

He contrastado las propuestas con `main` (ciclos 1-13) y con la rama `cycle-15` (`TECH_SPEC-lint-y-deshacer-hoy.md`). Las citas son correctas: `trackerStats` en `stats.ts:75-86`, `goalAt`/`mondayOf`/`total` existen, `vite.config.ts:20` y `KNOWN` en `storage.ts:32`. Hay una salvedad: P16.2 dice que la home solo muestra XP total y composición, pero cada botón de rama ya enseña la XP de la semana (`HomeView.tsx:82`, `weeklyXp`).

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P16.1 | APROBAR CON CAMBIOS | S | bajo | El problema es real y el dato ya existe. Es una función pura nueva sin tocar las existentes y un gráfico CSS sin dependencias. Solo hay que concretar la accesibilidad y la semana en curso. |
| P16.2 | APROBAR CON CAMBIOS (ciclo 17) | S | bajo-medio | Tiene valor, pero la línea «Esta semana» duplica lo que ya muestra la home. Además, choca con el `HomeView` que reescribe el ciclo 15 y depende de P16.1. |
| P16.3 | APROBAR CON CAMBIOS | XS | bajo | Desactiva de verdad la trampa del build local, frente a solo documentarla como hizo el ciclo 15. Con el cambio, el proxy de `preview` se queda sin uso. |

## Cambios pedidos

**P16.1.**
- `weekly()` debe reproducir exactamente la regla de `streak`: la semana en curso se mide con `t.weeklyGoal` y las pasadas con `goalAt`. Filtra una sola vez los eventos del tracker, igual que `streak`. En VILLAIN, o en una actividad sin objetivo, `goal` es `null` y `met` es `false`, así que no se marca nada.
- Asserts: (1) el número de semanas cumplidas seguidas que devuelve `weekly`, contando desde la actual hacia atrás, coincide con `streak` (si la actual no se ha cumplido, se cuenta desde la anterior). (2) Un caso hecho a mano con `pastGoals`, porque la semilla solo cubre unas 2 semanas y el resto saldría a 0. (3) La suma de los totales de 8 semanas coincide con `total` en ese rango.
- Accesibilidad: un `aria-label` en un `div` sin rol se ignora. Las barras llevan `aria-hidden` y debajo va una lista `sr-only` («Semana del 29 sept: 3 de 4 sesiones, cumplida»), o bien un `role="img"` con un resumen. El cumplimiento no puede ir solo por color: hace falta borde, icono o texto. La semana en curso se distingue como «en curso», porque si no siempre parece peor.
- Sin dependencias de runtime: divs con altura en `%` y tokens de la rama (`bg-hero`/`bg-villain` y `*-border` para la pista). No necesita aprobación del usuario. Hay que comprobar el contraste 3:1 de la barra contra `*-surface` en las dos paletas y que entre en 390 px. Si la tarjeta queda demasiado larga, se mete en un `<details>` «Últimas 8 semanas», con el mismo patrón que «Últimos registros».
- Test de UI: la lista accesible existe y nombra la semana cumplida.

**P16.2** (en el ciclo 17, con `cycle-15` mergeado y P16.1 hecha).
- Quitar la línea «Esta semana: HERO +x / VILLAIN +y», porque repite `HomeView.tsx:82`.
- La suma por rama va en `core/`, con una función pura de `stats.ts` que reutiliza `weekly` y que tenga su assert. No se calcula en el componente. Las archivadas cuentan.
- Accesibilidad y semana en curso: lo mismo que en P16.1. La home es neutra (`app-*`) y las barras de rama ya tienen precedente en `PlayerHeader`. Hay que verificar el contraste de la barra VILLAIN sobre `app-surface`.

**P16.3.**
- `defineConfig(({ command, mode }) => …)` con `__AI_PROXY__ = command === 'serve' && !!key`. Se quita `preview: { proxy }`, que deja de tener uso porque el bundle ya no llama, y se actualiza el `ponytail:`. Vitest arranca como `serve`, así que los tests no cambian.
- Actualizar todos los textos que dicen «dev/preview»: `DEPLOY.md:10` (la frase que acaba de añadir el ciclo 15), `app/README.md:12`, `ESTADO-ACTUAL.md:54` y `:67`, y las menciones de `CLAUDE.md`/`AGENTS.md` si cambian.
- El ciclo 14 (e2e contra `preview`, sin key en la CI) no se ve afectado.

## Ciclo recomendado

**Ciclo 16 = P16.1 + P16.3.** Las dos son independientes y no tocan `HomeView`. Con `cycle-15` solo comparten `stats.ts` y `selfcheck.ts`, en zonas distintas (`weekly` va al final y no toca `todaySummary`). Conviene abrir la rama después de mergear `cycle-15`. Orden: P16.3 (T1, unas pocas líneas) → `weekly` + asserts → la UI de la tarjeta.

**P16.2** pasa al ciclo 17, cuando el gráfico de P16.1 ya esté validado y `HomeView` estable después del ciclo 15.
