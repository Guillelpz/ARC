# TECH_SPEC — Hoy y rachas (ciclo 7: P7.4, P7.3, P7.1)

Base: `main` con los ciclos 1-6. Fuente: `docs/cycles/cycle-7/proposals.md` con los cambios de `docs/cycles/cycle-7/evaluation.md`.

## 1. Resumen

- **P7.4:** dos guardas de integridad del deshacer, en `core/`. Un evento cuenta como «deshecho» solo si lo anula un evento **negativo** con `undoes`, y `add` ignora un deshacer cuyo destino ya está deshecho.
- **P7.3:** bloque «Hoy» arriba en la home. Muestra la XP neta de hoy por rama, lo registrado hoy, «Te faltan» (objetivos semanales sin cumplir, con los días que quedan) y la mejor racha. Cada fila lleva a la pantalla de su rama.
- **P7.1:** racha semanal por actividad con objetivo. Es un derivado puro, no da XP y se muestra como chip `pop` en `TrackerCard`.
- **No entra:** toast de racha, rachas en VILLAIN o en actividades sin objetivo, registrar desde la home, notificaciones, cambios de esquema o de `storage.ts`, dependencias nuevas.

## 2. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Helper de deshacer | `undoneIds(events): Set<string>` en `stats.ts`. Lo usan `history` y `add`. | Un solo sitio para la regla; `history` ya construía ese set. |
| Guarda en `add` | `if (undo && undoneIds(events).has(undo.id)) return` antes de `clampAmount`. | Es la misma regla que muestra la UI. `readEvents` no se toca. |
| Dónde vive la racha | Campo `streak` en `TrackerStats`, calculado en `trackerStats`. | Así llega a `TrackerCard` (vía `stats`) y a la home (vía `game.trackers`) sin pasar nada nuevo. |
| Coste de la racha | `streak` filtra los eventos por `trackerId` una vez y se corta en la semana del primer evento. Lleva `ponytail:`. | También se recalcula dentro de cada `derivePartyState`: con datos locales es despreciable. |
| Objetivo de semanas pasadas | Se usa el `weeklyGoal` actual, con `ponytail:`. | Regla aprobada; no hay histórico de objetivos. |
| Qué es «semana cumplida» | Total neto de la semana lun–dom (`total`, rango `[lun, lun+7)`) `>= weeklyGoal`. La semana en curso usa `[lun, hoy+1)`, igual que `trackerStats.week`. | Coincide con «Objetivo cumplido» de la tarjeta. |
| Archivadas | No aparecen en «Hoy» (ni en la XP de hoy, ni en registrado, ni en «Te faltan», ni en la mejor racha). La racha solo se ve en la tarjeta, y las archivadas no tienen tarjeta. | Lo más simple. Si se registra y se archiva el mismo día, esa XP sale de «Hoy» pero sigue en los totales. |
| Firma de `todaySummary` | `todaySummary(events, stats: TrackerStats[], today)`. Recibe `game.trackers` y reutiliza `week`, `weeklyGoal` y `streak`. | Lo pide la evaluación: no se recalcula la semana. |
| «Registrado hoy» | Actividades con neto de hoy `> 0`. | Un registro corregido a 0 no es «hecho». |
| XP de hoy | Neto por rama = Σ (amount × xpPerUnit) de los eventos con `occurredAt` de hoy. Solo se muestran las ramas `≠ 0`. | Evaluación: por rama y en neto. |
| «Quedan N días» | `7 − índiceLunes(hoy)` (lunes 7, domingo 1). Se muestra una vez, en el título de «Te faltan». | Evaluación: cuenta hoy. |
| Cantidades | `Math.round` + unidad del tracker (`3 sesiones`, `15 km`, `90 min`). | Evaluación. |
| Cuándo se ve «Hoy» | Siempre, también con el historial vacío (en ese caso muestra los objetivos). | Sin condiciones extra. |
| Chip de racha | Visible si `streak >= 1`, con `key={streak}` para que `pop` se repita cuando crece. | Reutiliza la animación de «Objetivo cumplido». |

## 3. Decisiones que requieren aprobación

Ninguna. Las reglas de la racha ya están aprobadas. No hay dependencias nuevas, ni cambios de esquema, ni se quitan atajos de la demo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/stats.ts` | `undoneIds`, `history` usa `undoneIds`, `streak`, `trackerStats` devuelve `streak`, `todaySummary`, `daysLeftInWeek`. |
| `app/src/core/types.ts` | `TrackerStats.streak`, tipo `TodaySummary`. |
| `app/src/core/selfcheck.ts` | Asserts nuevos (§11). Los existentes no se tocan. |
| `app/src/App.tsx` | Guarda en `add`; `summary = useMemo(todaySummary…)`, que se pasa a `HomeView`. |
| `app/src/components/HomeView.tsx` | Prop `summary` y sección «Hoy». |
| `app/src/components/TrackerCard.tsx` | Chip «Racha: N semanas». |
| `app/src/App.test.tsx` | Tests U11 (Hoy) y U12 (racha). |

No hay archivos nuevos.

## 5. Modelos de datos

```ts
// types.ts
export type TrackerStats = { /* …campos actuales… */ streak: number } // 0 si no hay objetivo

export type TodaySummary = {
  xp: Record<Branch, number>                       // neto de hoy por rama
  done: { tracker: Tracker; amount: number }[]     // neto de hoy > 0, en el orden de game.trackers
  missing: { tracker: Tracker; left: number }[]    // con weeklyGoal y week < goal; left = goal − week
  daysLeft: number                                 // 1..7, cuenta hoy
  best: { tracker: Tracker; weeks: number } | null // mayor streak > 0; empate: el primero
}
```

`ActivityEvent` y `Tracker` no cambian.

## 6. Persistencia y migración

Nada cambia. No se guarda nada nuevo: racha y «Hoy» se derivan en cada render. `storage.ts` y `readEvents` no se tocan, así que no hay migración. Los datos ya guardados que tengan un positivo con `undoes`, que hoy marca su destino como deshecho, pasan a mostrar ese destino como **no** deshecho. Es correcto, porque ese positivo nunca restó nada: el XP ya contaba el destino.

## 7. Lógica de dominio (`stats.ts`)

```ts
// solo un negativo con undoes anula; un positivo con undoes (datos importados/editados) no
export const undoneIds = (events: ActivityEvent[]) =>
  new Set(events.flatMap(e => (e.undoes && e.amount < 0 ? [e.undoes] : [])))

// history: const undone = undoneIds(events)   (resto igual)

// lunes = 7 … domingo = 1
export const daysLeftInWeek = (today: string) => 7 - ((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7)

// ponytail: usa el weeklyGoal actual también para semanas pasadas (si baja el objetivo, la racha
// crece hacia atrás); guardar el histórico de objetivos si importa. O(semanas · eventos del tracker).
export function streak(events: ActivityEvent[], t: Tracker, today: string): number {
  const goal = t.weeklyGoal
  if (!goal) return 0
  const own = events.filter(e => e.trackerId === t.id)
  if (!own.length) return 0
  const first = mondayOf(own.reduce((m, e) => (e.occurredAt < m ? e.occurredAt : m), own[0].occurredAt).slice(0, 10))
  const cur = mondayOf(today)
  let n = total(own, t.id, cur, addDays(today, 1)) >= goal ? 1 : 0 // la semana en curso suma, no rompe
  for (let w = addDays(cur, -7); w >= first; w = addDays(w, -7)) {
    if (total(own, t.id, w, addDays(w, 7)) < goal) break
    n++
  }
  return n
}
```

- `trackerStats` añade `streak: streak(events, t, today)` al objeto que devuelve.
- `todaySummary(events, stats, today)`:
  1. `live = stats.filter(s => !s.tracker.archived)`.
  2. `todays = events.filter(e => e.occurredAt.slice(0, 10) === today)`.
  3. Para cada `s` de `live`: `net` = Σ amount de `todays` con `trackerId === s.tracker.id`. Se suma `net × xpPerUnit` a `xp[branch]`, y si `net > 0` entra en `done` con `amount: net`.
  4. `missing` = `live` con `weeklyGoal` y `week < weeklyGoal`, con `left: weeklyGoal − week`.
  5. `daysLeft = daysLeftInWeek(today)`.
  6. `best` = el primer `s` de `live` con el `streak` máximo, si es `> 0`; si no, `null`.
- `App.add`: la primera línea, tras el clamp de `day`, es `if (undo && undoneIds(events).has(undo.id)) return`.

## 8. UI

**Home (`HomeView`), sección «Hoy».** Es el primer elemento de `<main>`, después del aviso y de «Empieza tu historial». Usa la paleta neutral: `section aria-labelledby="hoy"` con `rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5 lg:col-span-2 flex flex-col gap-3`, clase `rise`, y dentro `h2 id="hoy"` con el texto «Hoy».
- XP de hoy: si `done` está vacío, `p text-sm text-app-muted` con «Aún nada hoy.». Si no, `p text-sm font-semibold tabular-nums` con las ramas `≠ 0`, unidas por « · » y formateadas como `+60 HERO` o `−15 VILLAIN` (signo menos tipográfico, como `signed`). El texto va siempre en `text-app-text`: nada de `text-villain` sobre neutral.
- «Registrado hoy»: aparece si hay `done`. Es una lista `ul divide-y divide-app-border rounded-lg border border-app-border`. Cada fila es un `button` (`min-h-11 w-full flex items-center gap-3 px-3 text-left hover:bg-app-bg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text`) con `{name}`, `+{round(amount)} {unit}` en `text-app-muted tabular-nums` y un `ChevronRight`. Al pulsarlo llama a `onNavigate(tracker.branch)`.
- «Te faltan»: aparece si hay `missing`. Lleva un subtítulo `h3 text-sm font-semibold` con `Te faltan · queda 1 día` o `Te faltan · quedan N días`, y debajo una lista igual que la anterior con `{name}` y `{round(left)} {unit}`. Al pulsar una fila, `onNavigate('hero')`.
- Mejor racha: aparece si `best`. Es un `p text-sm` con el icono `Flame` (`size-4`, `aria-hidden`) y el texto `Mejor racha: {name} · {weeks} {weeks === 1 ? 'semana' : 'semanas'}`.
- No hay estados de carga ni de error: todo es síncrono y derivado.

**`TrackerCard`.** Si `stats.streak >= 1`, se añade un chip justo después de «Objetivo cumplido», dentro del mismo `div` y con las mismas clases (`pop ml-2 inline-flex … ${c.chip}`). Lleva `key={stats.streak}`, el icono `Flame` y el texto `Racha: N semana(s)`. No hay toast. Las tarjetas VILLAIN no lo muestran nunca, porque su `streak` es 0.

El tono sigue `STYLE_GUIDE`: breve, sin exclamaciones.

## 9. Backlog

**T1 — P7.4 guardas del deshacer**
- Archivos: `stats.ts`, `App.tsx`, `selfcheck.ts`.
- Qué: `undoneIds` (§7), que `history` lo use, y la guarda en `add`. Asserts R1 y R2.
- Depende de: nada.
- Aceptación: los asserts nuevos pasan, A3/A4 siguen en verde y U4 pasa. `build`, `lint` y `test` en verde.

**T2 — P7.3 `todaySummary` y bloque «Hoy» (sin mejor racha)**
- Archivos: `types.ts` (`TodaySummary` con `best`), `stats.ts` (`daysLeftInWeek`, `todaySummary` con `best: null` fijo de momento), `App.tsx` (`useMemo` y prop `summary`), `HomeView.tsx`, `selfcheck.ts` (H1–H4), `App.test.tsx` (U11).
- Depende de: T1.
- Aceptación: §8 «Hoy» sin la línea de racha; U1–U10 siguen en verde.

**T3 — P7.1 racha en core y en la tarjeta**
- Archivos: `types.ts` (`streak` en `TrackerStats`), `stats.ts` (`streak`, `trackerStats`), `TrackerCard.tsx` (chip), `selfcheck.ts` (S1–S6), `App.test.tsx` (U12, parte de la tarjeta).
- Depende de: T1.
- Aceptación: el chip aparece y re-anima al crecer; los asserts de semilla (`inicial …`, `sum`) no cambian.

**T4 — Mejor racha en «Hoy»**
- Archivos: `stats.ts` (`best` real en `todaySummary`), `HomeView.tsx` (línea `Flame`), `selfcheck.ts` (H5), `App.test.tsx` (U12, parte de la home).
- Depende de: T2 y T3.
- Aceptación: «Mejor racha: Gym · 3 semanas» aparece en el caso de U12 y no aparece si no hay rachas.

Cada tarea se cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, y con `[selfcheck] done` sin fallos en dev.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| Que textos nuevos de la home choquen con las consultas de los tests existentes (`getByText`, `btn`). | Los textos de «Hoy» no repiten «Lv.», «Última copia» ni nombres de botones existentes. Ejecutar todo `App.test.tsx`. | — |
| Coste de `streak` dentro de las parties (`deriveGame` × parties). | Filtrar una vez y cortar en el primer evento (`ponytail:`). | Sacar `streak` de `trackerStats` y calcularlo solo en `MissionsView`/`App`. |
| Que la racha retroactiva confunda tras editar el objetivo. | Regla aprobada, con `ponytail:` en el código. | — |
| Que se pisen las animaciones `pop` (racha y objetivo en el mismo toque). | Las dos son chips locales a la tarjeta, sin hueco compartido. | — |
| Si T3 o T4 se complican. | — | Se entrega el ciclo con T1 y T2 (P7.4 + P7.3), como prevé la evaluación. |

## 11. Verificación

Asserts nuevos en `selfcheck.ts` (los existentes no cambian). Para los fixtures se usa `wk(mon, n, id = 'gym')`: n eventos de +1 en días consecutivos desde `mon`, a las 10:00, con ids únicos. `G = TRACKERS[0]` (Gym, objetivo 4), `DEMO_DATE = 2026-10-07` (miércoles).

- **R1:** `!undoneIds([h1, { id: 'p', trackerId: 'running', amount: 5, occurredAt: h1.occurredAt, undoes: 'h1' }]).has('h1')` y, con esos mismos eventos, `history(...)` marca `h1` como no `undone`.
- **R2:** `undoneIds(hu).has('h1')`, con el `hu` de A3. Es lo que bloquea un segundo deshacer en `add`.
- **S1:** `streak(SEED_EVENTS, G, DEMO_DATE) === 0` (3/4 esta semana, 2/4 la anterior) y `streak(SEED_EVENTS, TRACKERS[4], DEMO_DATE) === 0` (Beer, sin objetivo).
- **S2:** semana en curso a medias: `wk('2026-09-21',4)` + `wk('2026-09-28',4)` + `wk('2026-10-05',2)` → 2. Con `wk('2026-10-05',3)` añadido (5 en total en la semana) → 3.
- **S3:** racha rota: `wk('2026-09-14',4)` + `wk('2026-09-21',3)` + `wk('2026-09-28',4)` → 1.
- **S4:** un día pasado la recompone: el caso de S3 más un +1 el `2026-09-26` → 3.
- **S5:** objetivo actual retroactivo: el caso de S3 con `{ ...G, weeklyGoal: 3 }` → 3.
- **S6:** corte en el primer evento: `wk('2026-09-28',4)` → 1, y `deriveGame` con esos eventos da `streak === 1` en Gym.
- **H1:** con `+1 gym` hoy, `+1 beer` hoy y `+5 running` ayer, `todaySummary(ev, deriveGame(ev, DEMO_DATE).trackers, DEMO_DATE)` da `xp.hero === 30`, `xp.villain === 15` y `done` con ids `gym,beer`.
- **H2:** en ese mismo caso, `missing` es `gym:3,bjj:3,running:15,reading:120` y `daysLeft === 5`.
- **H3:** `daysLeftInWeek('2026-10-11') === 1` (domingo) y `daysLeftInWeek('2026-10-12') === 7` (lunes).
- **H4:** una custom archivada con un evento hoy no entra en `done` ni en `xp`.
- **H5 (T4):** con los eventos de S2 (3 semanas), `best` es Gym con 3 semanas; con `[]`, `best === null`.

Tests de UI en `App.test.tsx` (fecha fija 2026-10-07):
- **U11:** con el historial vacío, la home muestra «Aún nada hoy.» y «Te faltan · quedan 5 días», con Gym «4 sesiones». Ir a HERO, pulsar `+1 sesiones` en Gym y volver a Inicio: aparece «+30 HERO», Gym en registrado y «3 sesiones» en faltan. Pulsar la fila de faltan de Gym lleva a la pantalla HERO (heading «Misiones HERO»).
- **U12:** precargar en `EV` los eventos de S2 (sin los 3 extra). En HERO, la tarjeta Gym muestra «Racha: 2 semanas»; pulsar `+1` dos veces → «Racha: 3 semanas». En Inicio aparece «Mejor racha: Gym · 3 semanas».

Checklist manual (`npm run dev`, móvil 375 px):
- [ ] «Hoy» en la home sin historial, con la semilla («Cargar ejemplo») y tras registrar; recargar y comprobar que se mantiene (es derivado).
- [ ] El chip de racha anima al cumplir el objetivo, junto a «Objetivo cumplido», y no aparece toast de racha. El level-up, si toca, sigue saliendo.
- [ ] Archivar una actividad custom con racha: desaparece de «Hoy» y de la mejor racha.
- [ ] Con el modo oscuro de VILLAIN, ninguna tarjeta muestra racha.
- [ ] Foco visible con teclado en las filas de «Hoy».

## 12. Handoff para Claude Code

1. Trabaja en la rama `cycle-7` desde `main`. Implementa T1 → T2 → T3 → T4, un commit por tarea.
2. Lee antes `stats.ts`, `App.tsx` (`add`), `HomeView.tsx`, `TrackerCard.tsx`, `selfcheck.ts` y `App.test.tsx`.
3. No toques `storage.ts`, `readEvents`, `rpg.ts` (salvo que `TrackerStats` ya trae `streak` vía `trackerStats`) ni los asserts existentes. Si uno falla, el fallo está en el motor.
4. Copia los snippets de §7 tal cual, incluidos los comentarios `ponytail:`. Las clases de UI salen de §8 y de los patrones ya presentes en `HomeView` (lista de parties) y `TrackerCard` (chip «Objetivo cumplido»).
5. Cierra cada tarea con `npm run build`, `npm run lint` y `npm test` en `app/`. No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
