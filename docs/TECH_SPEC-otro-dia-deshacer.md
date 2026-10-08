# TECH_SPEC — Registrar en otro día y deshacer un registro (ciclo 4: P4.1 + P4.2)

Fuente: `docs/cycles/cycle-4/proposals.md` (P4.1 y P4.2) con los cambios de `docs/cycles/cycle-4/evaluation.md`. Base: `main` con los ciclos 1–3.

## 1. Resumen

- **P4.1:** cada pantalla de misiones (`MissionsView`) tiene un selector de día: «Hoy», «Ayer» o un `<input type="date">` con `max` = hoy. Los registros y las correcciones de esa pantalla se fechan en el día elegido, con la hora actual. La corrección se limita con el total **de ese día** (`dayTotal` en `core/stats.ts`), no con el de la semana.
- **P4.2:** cada `TrackerCard` tiene un desplegable `<details>` «Últimos registros» con los 10 eventos más recientes de la actividad, positivos y correcciones. Cada positivo que no se haya deshecho tiene un botón «Deshacer». Ese botón añade un evento negativo con el mismo `occurredAt` y `undoes: <id>`.
- **Fuera de alcance:** horas editables, fechas futuras, registros masivos, editar o borrar eventos, paginación, historial global y cambios en XP o umbrales. `UnknownView` sigue registrando en el día de hoy. La home no cambia.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Dónde vive el día elegido | En un `useState` de `MissionsView`. El componente ya se monta con `key={screen}`, así que vuelve a «Hoy» al cambiar de pantalla sin código extra. |
| Hora del evento en un día pasado | `${day}T${hora actual}`. `nowStamp` acepta un `day` opcional. |
| Fechas futuras | Triple barrera: `max={today}` en el input; `MissionsView` cambia por `today` un valor vacío o posterior a hoy; y `add()` hace `if (day > today) day = today`. |
| Límite de la corrección | `clampAmount(events, trackerId, day, amount)` en `core/stats.ts` redondea la cantidad y no deja el día por debajo de 0. Si el día ya está en negativo (datos antiguos corregidos con el límite semanal), el límite es 0 y nunca pasa a positivo. |
| Cambio de regla | Hoy «−» puede restar hasta el total de la semana. Con esta spec solo puede restar hasta el total del día elegido, como piden la propuesta y la evaluación ya aprobadas. Para corregir otro día, se elige ese día en el selector. |
| Cómo se marca un registro deshecho | Con la opción (b) de la evaluación, que el usuario ya decidió: un campo opcional `undoes?: string` en `ActivityEvent`. Un positivo está deshecho si algún evento tiene `undoes` igual a su id. |
| Deshacer parcial | No existe. «Deshacer» solo está activo si `dayTotal(día del evento) >= amount`; si no, aparece desactivado. Para restar menos se usa «−» con ese día elegido. Así «deshecho» siempre significa que el registro se anuló entero. |
| Fecha del evento de deshacer | El mismo `occurredAt` que el registro original, aunque sea de otra semana. El negativo cae en el mismo día y en la misma semana que el positivo. |
| Confirmación al deshacer | No se pide. Deshacer es un evento más y el registro se puede volver a hacer. |
| `undoes` inválido al leer | Se repara: el evento se conserva sin el campo y cuenta en `dropped`. Así `loadAll` copia el valor bruto y avisa, igual que con el resto de datos inválidos. No se descarta el evento, porque eso cambiaría la XP. |
| `undoes` que apunta a un id que no existe | Se acepta y no tiene efecto. |
| Selección de los 10 registros | La hace `history()` en `core/stats.ts`, una función pura con asserts. Ordena por `occurredAt` descendente; si empatan, el último insertado va primero. Así el negativo de deshacer sale justo encima de su positivo. |
| Formato de fecha en la UI | `dayLabel(day, today)` en `core/stats.ts` devuelve «Hoy», «Ayer» o una fecha corta como `lun, 5 oct`, con `toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })`. |
| Aviso de que no se registra hoy | Si el día elegido no es hoy, el botón principal de la tarjeta lo indica (`+5 km · ayer`). Así es difícil registrar en otro día por despiste. |

## 3. Decisiones que requieren aprobación

Ninguna. El usuario ya decidió el campo `undoes?`. No hay dependencias nuevas ni backend, y la XP y los umbrales no cambian. El nuevo límite de «−» (del total de la semana al del día) viene de la propuesta y la evaluación aprobadas.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `ActivityEvent.undoes?: string` y el tipo `HistoryRow`. |
| `app/src/core/stats.ts` | Nuevas `dayTotal`, `clampAmount`, `history` y `dayLabel`. |
| `app/src/core/storage.ts` | `readEvents` valida `undoes` o lo repara. |
| `app/src/core/selfcheck.ts` | Asserts A1–A5 (§11). Los existentes no se tocan. |
| `app/src/core/storage.test.ts` | Tests S1–S3 de `undoes` (§11). |
| `app/src/App.tsx` | `nowStamp(day?)`, `add(t, amount, day = today, undo?)` y `undo(t, e)`. Pasa `today` y `onUndo` a `MissionsView`. |
| `app/src/components/MissionsView.tsx` | Selector de día. Calcula `dayTotal` y `history` de cada tarjeta. |
| `app/src/components/TrackerCard.tsx` | Props nuevas `today`, `dayTotal`, `dayNote`, `history` y `onUndo`. «−» se desactiva con `dayTotal <= 0`. Añade el `<details>` «Últimos registros». |

No hay archivos nuevos.

## 5. Modelos de datos

```ts
// types.ts
export type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string // 'YYYY-MM-DDTHH:mm:ss' local, sin zona
  undoes?: string    // id del evento positivo que este negativo deshace
}

export type HistoryRow = { event: ActivityEvent; undone: boolean; canUndo: boolean }
```

## 6. Persistencia y migración

- Las claves y el formato no cambian. `life-rpg-demo-v1` sigue guardando `ActivityEvent[]` y la exportación sigue en `version: 1`. `undoes` es opcional.
- **Datos existentes:** ningún evento tiene `undoes`, así que todos siguen siendo válidos sin migración. Ninguno aparece como «deshecho».
- **Copias exportadas:** las antiguas se importan igual que hasta ahora. Una copia nueva con `undoes` también se puede importar en una versión anterior de la app: el `filter` de esa versión conserva el campo extra y no lo usa.
- `readEvents` deja de ser un simple `filter` y pasa a filtrar y reparar:

```ts
export function readEvents(v: unknown): Parsed<ActivityEvent[]> {
  if (!Array.isArray(v)) return null
  let dropped = 0
  const data: ActivityEvent[] = []
  for (const e of v) {
    if (!isEvent(e)) { dropped++; continue }
    if (e.undoes !== undefined && (typeof e.undoes !== 'string' || e.undoes === '')) {
      const fixed = { ...e }; delete fixed.undoes; data.push(fixed); dropped++ // reparado: se conserva sin el campo
    } else data.push(e)
  }
  return { data, dropped }
}
```

`isEvent`, `loadAll`, `parseBackup` y `exportBackup` no cambian.

## 7. Lógica de dominio

**`core/stats.ts`**

```ts
// total neto de un día [day, day+1)
export const dayTotal = (events: ActivityEvent[], trackerId: string, day: string) =>
  total(events, trackerId, day, addDays(day, 1))

// redondea; una corrección no deja el día por debajo de 0 (si ya lo está, no resta nada)
export const clampAmount = (events: ActivityEvent[], trackerId: string, day: string, amount: number) =>
  Math.max(Math.round(amount), -Math.max(0, dayTotal(events, trackerId, day)))

// ponytail: recorre todos los eventos por tarjeta y render (O(n·tarjetas)); indexar por trackerId si se nota.
export function history(events: ActivityEvent[], trackerId: string, limit = 10): HistoryRow[] {
  const undone = new Set(events.flatMap(e => (e.undoes ? [e.undoes] : [])))
  return events.filter(e => e.trackerId === trackerId).reverse() // empate: último insertado primero
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0)) // sort estable
    .slice(0, limit)
    .map(e => ({
      event: e,
      undone: undone.has(e.id),
      canUndo: e.amount > 0 && !undone.has(e.id) && dayTotal(events, trackerId, e.occurredAt.slice(0, 10)) >= e.amount,
    }))
}

export const dayLabel = (day: string, today: string) =>
  day === today ? 'Hoy' : day === addDays(today, -1) ? 'Ayer'
    : new Date(day + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
```

`deriveGame`, `trackerStats`, `party.ts` y `rpg.ts` no cambian. Todo se calcula a partir de `occurredAt`, así que un evento fechado en un día pasado ya cuenta en su semana.

**`App.tsx`**

```ts
const nowStamp = (day?: string, d = new Date()) => `${day ?? localDate(d)}T${d.toTimeString().slice(0, 8)}`

// amount < 0 = corrección; no deja el día por debajo de 0. undo = registro positivo que se anula entero.
function add(t: Tracker, amount: number, day = today, undo?: ActivityEvent) {
  if (day > today) day = today
  amount = clampAmount(events, t.id, day, amount)
  if (!amount || (undo && amount !== -undo.amount)) return
  const ev: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount,
    occurredAt: undo ? undo.occurredAt : nowStamp(day), ...(undo && { undoes: undo.id }) }
  // ... resto igual (next, after, toasts, gain, adelantamientos)
}
const undo = (t: Tracker, e: ActivityEvent) => add(t, -e.amount, e.occurredAt.slice(0, 10), e)
```

`propose` sigue llamando a `nowStamp()`. `UnknownView` sigue llamando a `onAdd(t, n)`, que registra en el día de hoy.

## 8. UI

**`MissionsView`** (props nuevas: `today: string`, `onAdd: (t, amount, day) => void`, `onUndo: (t, e) => void`)

- Estado `const [day, setDay] = useState(today)`; `yesterday = addDays(today, -1)`.
- Entre la búsqueda y la rejilla de tarjetas va un bloque `flex flex-col gap-1` con:
  - La etiqueta «Registrar en», con `text-xs leading-5 text-{b}-muted`.
  - Un segmento con los tokens de la rama, no los neutrales, porque la pantalla es HERO o VILLAIN. Contenedor: `grid grid-flow-col auto-cols-fr gap-1 rounded-lg border border-{b}-border bg-{b}-surface p-1`.
  - Las opciones «Hoy» y «Ayer» son `<button aria-pressed>` con `min-h-11 rounded-md text-sm font-medium text-{b}-muted`. La activa usa `bg-hero text-hero-on-accent` o `bg-villain text-villain-on-accent`, más `font-semibold`.
  - La tercera celda es `<input type="date" max={today} value={day} aria-label="Elegir día">`. Tiene el mismo tamaño, `bg-transparent text-center` y `scheme-light` en HERO o `scheme-dark` en VILLAIN, para que el icono del calendario se vea. Lleva las clases de opción activa cuando `day` no es ni hoy ni ayer.
  - `onChange` del input: `setDay(v && v <= today ? v : today)`.
  - Las clases van como literales por rama en un objeto, igual que `THEME` en `TrackerCard`.
- Props de cada tarjeta: `today`, `dayTotal={dayTotal(events, id, day)}`, `dayNote={day === today ? undefined : dayLabel(day, today).toLowerCase()}`, `history={history(events, id)}`, `onAdd={n => onAdd(s.tracker, n, day)}` y `onUndo={e => onUndo(s.tracker, e)}`.

**`TrackerCard`**

- «−»: `disabled={!valid || dayTotal <= 0}`.
- Botón principal: `` valid ? `+${n} ${t.unit}${dayNote ? ` · ${dayNote}` : ''}` : t.buttonLabel ``.
- Debajo de los botones, si `history.length > 0`, va un `<details className="text-xs leading-5 {c.muted}">`. Su `<summary className="min-h-11 cursor-pointer ...">` dice «Últimos registros». Dentro hay una lista `flex flex-col gap-1`. Cada fila (`key={event.id}`) es `flex items-center justify-between gap-2` y contiene:
  - El texto `${dayLabel(día, today)} · ${signed(amount)} ${t.unit} · ${signed(amount * t.xpPerUnit)} XP`, con `tabular-nums`.
  - En un negativo: chip «corrección», o «deshecho» si tiene `undoes`. Usa la clase `c.chip` de la tarjeta.
  - En un positivo deshecho (`undone`): chip «deshecho».
  - En cualquier otro positivo: botón secundario «Deshacer» con `min-h-11 rounded-lg border px-3 text-xs font-medium`, más `c.chip` y estilos de foco. Lleva `disabled={!canUndo}` y `aria-label` «Deshacer {cantidad} {unidad} de {día}».
- Si no hay registros, no se muestra el `<details>`. No hay estado de carga: todo es síncrono. Deshacer da el mismo feedback que una corrección: XP flotante negativa, `bump` y toast de LEVEL DOWN si toca.
- Todo usa la paleta de la rama, sin hex ni `slate-*`.

## 9. Backlog

**T1 — Límite de corrección por día en core**
- Objetivo: que «−» se limite con el total del día y no con el de la semana. Es la base de P4.1 y P4.2.
- Archivos: `core/stats.ts`, `core/selfcheck.ts`, `App.tsx`, `MissionsView.tsx` y `TrackerCard.tsx`.
- Qué hacer:
  - Añadir `dayTotal` y `clampAmount` (§7) y los asserts A1–A2 (§11).
  - `add` usa `clampAmount(events, t.id, today, amount)`.
  - `MissionsView` recibe `today` como prop y calcula el `dayTotal` de cada tarjeta. `TrackerCard` desactiva «−» con `dayTotal <= 0`.
- Depende de: nada.
- Aceptación: build, lint y test en verde. Una corrección hoy no deja el día por debajo de lo registrado hoy. «−» está desactivado en una actividad sin registros hoy, aunque tenga registros esa semana.

**T2 — Selector de día en `MissionsView` (P4.1)**
- Objetivo: registrar y corregir en un día pasado.
- Archivos: `App.tsx` (`nowStamp(day?)` y `add(t, amount, day = today)` con la guarda contra fechas futuras), `core/stats.ts` (`dayLabel`), `MissionsView.tsx` y `TrackerCard.tsx` (`dayNote`).
- Qué hacer: el selector y el botón principal de §8, y pasar `day` en `onAdd`.
- Depende de: T1.
- Aceptación:
  - Un registro con «Ayer» suma a la semana anterior si hoy es lunes, y a la semana actual cualquier otro día.
  - El input no permite fechas futuras.
  - Al cambiar de pantalla, el selector vuelve a «Hoy».
  - `UnknownView` sigue registrando hoy.
  - El botón principal muestra `· ayer` o la fecha elegida.

**T3 — `undoes` y `history()` en core**
- Objetivo: el modelo y la lógica de P4.2, todavía sin UI.
- Archivos: `core/types.ts`, `core/storage.ts`, `core/storage.test.ts`, `core/stats.ts` y `core/selfcheck.ts`.
- Qué hacer: los tipos de §5, el nuevo `readEvents` de §6, `history()` de §7, los asserts A3–A5 y los tests S1–S3 (§11).
- Depende de: T1, porque usa `dayTotal`.
- Aceptación: build, lint y test en verde. Los datos actuales cargan sin aviso.

**T4 — «Últimos registros» y «Deshacer» (P4.2)**
- Objetivo: ver los registros de una actividad y anular uno concreto.
- Archivos: `App.tsx` (`add(..., undo?)`, `undo` y la prop `onUndo`), `MissionsView.tsx` y `TrackerCard.tsx`.
- Qué hacer: `add` y `undo` según §7, y el `<details>` de §8.
- Depende de: T2 y T3.
- Aceptación:
  - Deshacer un registro de la semana pasada resta en esa semana, no en la actual, y la fila queda marcada como «deshecho».
  - Un registro no se puede deshacer dos veces.
  - Si un registro ya se compensó con «−», su «Deshacer» está desactivado.
  - El estado «deshecho» se conserva al recargar y al exportar e importar una copia.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Registrar en otro día por despiste (selector en «Ayer») | El día aparece en el botón principal y el selector vuelve a «Hoy» al cambiar de pantalla. | — |
| El usuario no puede restar hoy lo que registró otro día de la misma semana | Es la regla nueva: debe elegir ese día en el selector. «Deshacer» en el historial cubre el caso sin pensar en fechas. | — |
| `<input type="date">` poco legible o roto en VILLAIN (fondo oscuro) o en Safari iOS | `scheme-dark`, `min-h-11` y prueba en móvil. | Quitar el input y dejar solo «Hoy» y «Ayer», que cubren el caso principal. |
| La tarjeta crece en móvil | El `<details>` está cerrado por defecto. | — |
| Reparar un `undoes` inválido muestra el aviso de datos dañados | Solo pasa con datos editados a mano. | — |

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`** (los existentes no cambian):

```ts
// A1 — un evento en un día pasado cuenta en su semana (mar 29 sep: tramo comparable de la semana anterior a DEMO_DATE)
const past = get(deriveGame([...SEED_EVENTS, { id: 'check-past', trackerId: 'gym', amount: 1, occurredAt: '2026-09-29T20:00:00' }], DEMO_DATE), 'gym')
ok(past.week === 3 && past.prev === 3 && past.allTime === 6, 'día pasado: cuenta en su semana')
// A2 — límite de la corrección por día
const dd: ActivityEvent[] = [
  { id: 'd1', trackerId: 'gym', amount: 2, occurredAt: '2026-10-05T10:00:00' },
  { id: 'd2', trackerId: 'gym', amount: 1, occurredAt: '2026-10-06T10:00:00' },
  { id: 'd3', trackerId: 'beer', amount: -1, occurredAt: '2026-10-07T10:00:00' },
]
ok(dayTotal(dd, 'gym', '2026-10-05') === 2 && dayTotal(dd, 'gym', '2026-10-07') === 0, 'dayTotal')
ok(clampAmount(dd, 'gym', '2026-10-05', -5) === -2 && clampAmount(dd, 'gym', '2026-10-07', -1) === 0, 'corrección: el día no baja de 0')
ok(clampAmount(dd, 'beer', '2026-10-07', -1) === 0 && clampAmount(dd, 'gym', '2026-10-05', 2.6) === 3, 'día negativo: 0; positivos redondeados')
// A3 — history: orden, deshecho y canUndo
const hu: ActivityEvent[] = [
  { id: 'h1', trackerId: 'running', amount: 5, occurredAt: '2026-10-05T09:00:00' },
  { id: 'h2', trackerId: 'running', amount: 3, occurredAt: '2026-10-06T09:00:00' },
  { id: 'h3', trackerId: 'running', amount: -5, occurredAt: '2026-10-05T09:00:00', undoes: 'h1' },
]
const hr = history(hu, 'running')
ok(hr.map(r => r.event.id).join() === 'h2,h3,h1', 'history: orden desc, empate último primero')
ok(hr[2].undone && !hr[2].canUndo && hr[0].canUndo && !hr[1].canUndo, 'history: deshecho y canUndo')
// A4 — un registro compensado con «−» (sin undoes) no se puede deshacer
ok(!history([hu[0], { id: 'h4', trackerId: 'running', amount: -2, occurredAt: '2026-10-05T10:00:00' }], 'running')[1].canUndo, 'history: día insuficiente')
// A5 — límite de 10
ok(history(Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, trackerId: 'gym', amount: 1, occurredAt: NOW })), 'gym').length === 10, 'history: 10')
```

`dayTotal`, `clampAmount` y `history` se importan de `./stats`. A5 va después de la declaración de `NOW`.

**Tests en `storage.test.ts`:**
- S1: `readEvents([{ ...good, undoes: 'a' }])` da `dropped 0` y conserva `undoes`.
- S2: `readEvents([{ ...good, undoes: 3 }, { ...good, id: 'b', undoes: '' }])` da 2 eventos sin `undoes` y `dropped 2`.
- S3: un evento con `undoes` conserva el campo tras `exportBackup` y `parseBackup`.

**Cierre de cada tarea:** desde `app/`, `npm run build`, `npm run lint` y `npm test` en verde, y `[selfcheck] done` en la consola en dev, sin fallos.

**Checklist manual (móvil de 375 px y escritorio):**
- [ ] En HERO y VILLAIN el selector se lee bien, incluido el icono del calendario en el fondo oscuro. No hay scroll horizontal a 320 px.
- [ ] Al registrar con «Ayer» y con una fecha de la semana pasada, la cifra semanal y «vs. mismo tramo anterior» cambian donde corresponde.
- [ ] No se puede elegir mañana, ni escribiendo la fecha.
- [ ] Al ir a Inicio y volver, el selector está en «Hoy».
- [ ] «Últimos registros» muestra 10 filas como máximo, el negativo de deshacer aparece encima de su positivo y la XP lleva signo.
- [ ] Al deshacer aparece la XP flotante negativa y, si toca, el toast de bajada. La fila pasa a «deshecho» y sigue así al recargar.
- [ ] Tras exportar, borrar todo e importar, los registros deshechos siguen marcados.
- [ ] En «Nuevo», registrar una actividad parecida la registra en el día de hoy.

## 12. Handoff para Claude Code

1. Trabaja en la rama `cycle-4` y sigue el orden T1 → T2 → T3 → T4. Haz un commit por tarea, con `build`, `lint` y `test` en verde antes de cada uno.
2. No toques los asserts existentes de `selfcheck.ts`. Si alguno falla, arregla el motor.
3. La lógica va en `core/` (`stats.ts` y `storage.ts`). Los componentes solo reciben datos y callbacks. No crees archivos nuevos ni añadas dependencias.
4. Los eventos nunca se borran ni se editan: deshacer es un evento negativo con `undoes`.
5. Usa clases de Tailwind literales por rama (patrón `THEME`) y tokens de `@theme`. Revisa la UI final con la skill `frontend-stylist`.
6. No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
