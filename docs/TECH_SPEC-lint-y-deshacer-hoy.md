# TECH SPEC — Lint estricto y deshacer desde «Hoy» (ciclo 15)

Fuente: `docs/cycles/cycle-15/proposals.md` (P15.3, P15.1) con los cambios de `docs/cycles/cycle-15/evaluation.md`. Base: `main` con los ciclos 1-13.

## 1. Resumen

- **P15.3 reducida:** `npm run lint` pasa a `oxlint --deny-warnings`. Los 3 warnings que ya están aceptados (`App.tsx:52` pureza, `:58` y `:59` setState en el efecto de guardado) se silencian línea a línea y remiten a su `ponytail:`. No se toca la ruta de guardado ni el cálculo de «hoy».
- **P15.1:** en «Registrado hoy» de la home, cada fila que tenga un registro de hoy que se pueda deshacer lleva un botón «Deshacer». Ese botón anula el **último** registro con el `undo` existente. `todaySummary` expone ese evento (`done[].undo?`). `add` devuelve la cantidad registrada, lo que quita el `left!` (menor del ciclo 12).
- **Menor del ciclo 13:** no se toca `vite.config.ts`, así que `preview` sigue usando la IA. Solo se documenta en `docs/DEPLOY.md` que el build que se publica se hace sin `.env.local`, o en CI.
- **Fuera de alcance:** deshacer registros de otros días desde la home, deshacer varios a la vez, «rehacer», toasts con botón, P15.2 y reescribir el guardado.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Silenciar warnings | `// oxlint-disable-next-line <regla> -- ver ponytail` justo encima de cada línea afectada. Es lo más local y deja visible la deuda. |
| Id de la regla | El que imprime `npm run lint` hoy, en forma `plugin/regla` (p. ej. `react/purity`). No se adivina: se copia de la salida. |
| CI | No se edita. `ci.yml` y `deploy-pages.yml` llaman a `npm run lint`, así que heredan `--deny-warnings`. |
| Origen del evento a deshacer | `todaySummary` lo calcula con `history(events, t.id, Infinity)` y toma la primera fila con `canUndo` cuyo día es `today`. Así reutiliza el orden y la condición de la rama, sin el corte de 10. |
| Sin registro que se pueda deshacer entero (p. ej. +2 y luego −1) | `undo` queda `undefined` y la fila no muestra el botón. Es el mismo criterio que en la rama. |
| Valor de retorno de `add` | `number`: la cantidad realmente registrada (negativa al corregir o deshacer). Devuelve `0` si no registró nada. Los callers con tipo `=> void` siguen compilando. |
| Foco | «+» de «Te faltan»: va a `h2#hoy` si `registrado >= left`. «Deshacer»: va a `h2#hoy` si `d.amount + registrado <= 0`, es decir, si la fila desaparece. Si la fila sigue, el foco se queda en el botón. |
| `TodayList` | Cada fila lleva una `action?` opcional. Desaparecen `left` y `left!`, y la lista no conoce el dominio. |
| DEPLOY.md | Una frase en «Antes de elegir». No se cambia código. |

## 3. Decisiones que requieren aprobación

Ninguna. No hay dependencias nuevas, cambios de reglas ni cambios de persistencia. `--deny-warnings` ya lo aprobó el usuario con el ciclo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/package.json` | `"lint": "oxlint --deny-warnings"`. |
| `app/src/App.tsx` | 3 comentarios `oxlint-disable-next-line`. `add` devuelve `number`. `undo` devuelve el resultado de `add`. `HomeView` recibe `onUndo`. |
| `docs/DEPLOY.md` | Frase sobre el build sin `.env.local`. |
| `app/src/core/types.ts` | `TodaySummary['done'][number].undo?: ActivityEvent`. |
| `app/src/core/stats.ts` | `todaySummary` rellena `undo`. |
| `app/src/core/selfcheck.ts` | Asserts H7 y H8. |
| `app/src/components/HomeView.tsx` | `TodayList` con `action?`, botón «Deshacer», foco y props `onAdd`/`onUndo` que devuelven `number`. |
| `app/src/App.test.tsx` | U13 (deshacer desde la home). |

## 5. Modelos de datos

```ts
// types.ts
export type TodaySummary = {
  xp: Record<Branch, number>
  done: { tracker: Tracker; amount: number; undo?: ActivityEvent }[] // undo: último registro de hoy que se puede deshacer entero
  missing: { tracker: Tracker; left: number }[]
  // …resto sin cambios
}
```

No cambia ningún tipo persistido.

## 6. Persistencia y migración

Sin cambios. Deshacer desde la home crea el mismo evento que en la rama (`amount` negativo, mismo `occurredAt`, `undoes: <id>`).

## 7. Lógica de dominio

`stats.ts`, dentro del bucle de `todaySummary`:

```ts
if (net > 0) {
  // history sin límite: con más de 10 registros hoy, el último que se puede deshacer no se corta
  const undo = history(events, t.id, Infinity).find(r => r.canUndo && r.event.occurredAt.slice(0, 10) === today)?.event
  done.push({ tracker: t, amount: net, ...(undo && { undo }) })
}
```

- `history` ya ordena por `occurredAt` descendente y, en caso de empate, pone primero el último insertado. `canUndo` = positivo, no deshecho y `dayTotal >= amount`.
- Coste: `history` es O(eventos del tracker) por cada fila de `done`. Basta con el `ponytail:` que ya tiene `history`.

`App.tsx`:

```ts
function add(t: Tracker, amount: number, day = today, undo?: ActivityEvent): number {
  // cada `return` anticipado pasa a `return 0`; al final `return amount` (el valor tras clampAmount)
}
const undo = (t: Tracker, e: ActivityEvent) => add(t, -e.amount, e.occurredAt.slice(0, 10), e)
```

`MissionsView` y `UnknownView` no cambian: un `=> number` se puede asignar a un `=> void`.

## 8. UI

`HomeView`:

- Props: `onAdd: (t: Tracker) => number` y la nueva `onUndo: (t: Tracker, e: ActivityEvent) => number`. En `App.tsx` se pasan `onAdd={t => add(t, t.increment)}` y `onUndo={undo}`.
- `TodayList` recibe `rows: { t: Tracker; text: string; action?: { label: string; aria: string; run: () => void } }[]`. Pinta el segundo botón solo si hay `action`, con las mismas clases que el «+» actual. Muestra `label` como texto visible y `aria` como `aria-label`. La prop `onAdd` de `TodayList` desaparece.
- «Registrado hoy»: `action` solo si existe `d.undo`.
  - `label: 'Deshacer'`
  - `aria: \`Deshacer +${d.undo.amount} ${t.unit} en ${t.name}\`` (p. ej. «Deshacer +1 vaso en Agua»; el nombre empieza por el texto visible)
  - `run: () => { if (d.amount + onUndo(t, d.undo) <= 0) hoyRef.current?.focus() }`
- «Te faltan»: `action` con `label: t.buttonLabel` y `aria: \`${t.buttonLabel} en ${t.name}\`` (las dos como hoy), y `run: () => { if (onAdd(t) >= m.left) hoyRef.current?.focus() }`.
- Estados: si no hay registros hoy, se mantiene «Aún nada hoy.». Si no se puede deshacer nada, la fila se queda sin botón. El feedback es el de `add`: XP flotante, toast de level-down y aviso `role="status"`. Si el guardado falla, aparece el `SaveFailBanner` existente.
- Estilo: paleta `app-*` (la home es neutra) y botón `min-h-11 min-w-11`, sin colores nuevos.

## 9. Backlog

**T1 — Lint estricto y nota de despliegue (P15.3 reducida y menor del ciclo 13)**
- Archivos: `app/package.json`, `app/src/App.tsx`, `docs/DEPLOY.md`.
- Pasos:
  1. Ejecuta `npm run lint` y anota los 3 ids de regla.
  2. Añade `// oxlint-disable-next-line <regla> -- ver ponytail` justo encima de la línea 52 (`const now = new Date()…`) y otro encima de cada línea de guardado (58 y 59). Los `ponytail:` existentes no se tocan. Si oxlint no acepta la descripción tras `--`, quítala.
  3. Cambia el script a `"lint": "oxlint --deny-warnings"`.
  4. En `docs/DEPLOY.md`, en «Antes de elegir», tras la viñeta de `ANTHROPIC_API_KEY`, añade: «Haz el build que vayas a publicar sin `app/.env.local` (o en CI): con la key, `__AI_PROXY__` queda a `true` y el sitio intentaría llamar a `/api/claude`, que no existe en el hosting. `npm run preview` en local sí usa la IA si hay key.»
- Dependencias: ninguna.
- Aceptación: `npm run lint` termina con 0 warnings y exit 0. Un warning nuevo provocado a propósito (p. ej. `new Date()` en otro render) da exit ≠ 0; no se commitea. `build` y `test` en verde. Sin cambios de comportamiento.

**T2 — `todaySummary` expone `done[].undo` (core)**
- Archivos: `app/src/core/types.ts`, `app/src/core/stats.ts`, `app/src/core/selfcheck.ts`.
- Pasos: aplica §5 y §7 y añade H7 y H8 (§11). H1-H6 no cambian.
- Dependencias: T1 (solo por orden; no hay solape).
- Aceptación: `npm test` en verde y `[selfcheck] done` sin fallos. La UI todavía no usa el campo.

**T3 — Botón «Deshacer» en la home, foco y `add` con retorno (P15.1 y menor del ciclo 12)**
- Archivos: `app/src/App.tsx`, `app/src/components/HomeView.tsx`, `app/src/App.test.tsx`.
- Pasos: aplica §7 (`add`/`undo`) y §8, y añade U13 (§11). Busca `left!` en el código: no debe quedar ninguno.
- Dependencias: T2.
- Aceptación: `build`, `lint` y `test` en verde. U11, U1-U12 y a11y pasan sin tocarlos.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| El id de la regla o la sintaxis del `disable` no coinciden con la versión de oxlint | Copiar el id de la salida real y comprobarlo con `npm run lint` | Quitar la descripción `-- …` |
| `--deny-warnings` rompe la CI por un warning que solo sale allí | La CI usa el mismo `npm run lint` y el mismo lockfile | — |
| Doble toque en «Deshacer» | `add` ya ignora un `undo` cuyo evento está deshecho (`undoneIds`). El segundo toque, tras el re-render, actúa sobre el siguiente registro, que es lo esperado | — |
| La fila desaparece y el foco cae en `body` | Foco en `h2#hoy` cuando `d.amount + registrado <= 0` | — |
| Rendimiento de `history(…, Infinity)` por cada fila de `done` | Pocas filas; ya existe el `ponytail:` de `history` | Indexar por `trackerId` si se nota |

Si algo se complica, T1 y T2 se entregan por separado. T3 depende de T2.

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`** (bloque H, después de H4, con el helper `ev(trackerId, amount, day, id)`):

```ts
const ua = [ev('gym', 1, DEMO_DATE, 'u1'), ev('gym', 1, DEMO_DATE, 'u2')]
const ud = (es: ActivityEvent[]) => todaySummary(es, deriveGame(es, DEMO_DATE).trackers, DEMO_DATE).done.find(d => d.tracker.id === 'gym')
ok(ud(ua)?.undo?.id === 'u2'
  && ud([...ua, { ...ev('gym', -1, DEMO_DATE, 'u3'), undoes: 'u2' }])?.undo?.id === 'u1'
  && ud([ev('gym', 2, DEMO_DATE, 'u4'), ev('gym', -1, DEMO_DATE, 'u5')])?.undo === undefined
  && ud([ev('gym', 1, '2026-10-06', 'u6'), ev('gym', 1, DEMO_DATE, 'u7')])?.undo?.id === 'u7', 'H7 hoy: último registro que se puede deshacer')
const many = [ev('gym', 1, DEMO_DATE, 'm0'), ...Array.from({ length: 10 }, (_, i) => [ev('gym', 1, DEMO_DATE, `p${i}`), { ...ev('gym', -1, DEMO_DATE, `n${i}`), undoes: `p${i}` }]).flat()]
ok(ud(many)?.undo?.id === 'm0', 'H8 hoy: deshacer no se corta en 10')
```

Los asserts existentes no cambian.

**U13 en `App.test.tsx`** (lecturas de localStorage con `await vi.waitFor(…)`):

1. Render. Pulsa `+1 sesiones en Gym` en «Te faltan». Pulsa `Deshacer +1 sesiones en Gym`. Espera a que `stored()` tenga 2 eventos y que el segundo sea `{ amount: -1, undoes: <id del primero> }`. Comprueba que se ve «Aún nada hoy.» y que `document.activeElement` es el heading «Hoy».
2. Dos `+1` → un «Deshacer» → la fila «Gym +1 sesiones» sigue y el botón «Deshacer +1 sesiones en Gym» sigue presente.
3. Precarga hoy `gym +2` y la corrección `gym −1` (sin `undoes`). La fila «Gym +1 sesiones» existe y no hay ningún botón `/^Deshacer/`.

**Checklist manual** (`npm run dev`):
- [ ] `npm run lint`: 0 warnings.
- [ ] Home: «+» en «Te faltan» → aparece «Deshacer» en «Registrado hoy» → al pulsarlo, la XP de hoy vuelve al valor anterior y la rama muestra el registro como deshecho.
- [ ] Deshacer el único registro: la fila desaparece y el foco (teclado) queda en «Hoy».
- [ ] Recargar tras deshacer: el estado persiste.
- [ ] Móvil (390 px): la fila con nombre, cantidad y «Deshacer» cabe sin desbordar.

## 12. Handoff para Claude Code

1. Rama `cycle-15`. Haz T1, T2 y T3 en orden, con un commit por tarea (`T1: …`).
2. Antes de T1, ejecuta `npm run lint` desde `app/` para copiar los ids exactos de las reglas.
3. No toques el efecto de guardado ni el cálculo de `today` más allá de los comentarios. No edites `ci.yml` ni `deploy-pages.yml`. No edites `ESTADO-ACTUAL.md` (lo hace otro paso del ciclo).
4. Si un assert de H1-H6 o un test existente falla, el problema está en tu cambio, no en el test.
5. Cierra cada tarea con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.
