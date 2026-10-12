# TECH_SPEC — Límite semanal VILLAIN (P23.1, ciclo 23)

> Entrada: P23.1, aprobada por el usuario el 2026-10-12 (retoma P11.2). Base: `main` tras el ciclo 22. Rama: `cycle-23`.
> Análisis previo aprovechado: `docs/cycles/cycle-11/proposals.md` y `evaluation.md` (sección P11.2).

## 1. Resumen

Las actividades VILLAIN (Beer, Burgers y las propias) pueden tener un **límite semanal opcional** (entero ≥ 1). Se puede sobrepasar: registrar no se bloquea nunca. Si el total de la semana en curso **supera** el límite, la tarjeta muestra un aviso accesible. El límite **no cambia** XP, niveles, rachas, «Hoy», ranking ni party.
Fuera del alcance: penalizar XP, rachas «bajo control», límites diarios, límites en la party, el aviso en Inicio, marcar las semanas pasadas, un historial de límites y pedir el límite al crear la actividad.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Campo | `weeklyLimit?: number` propio en `Tracker`, solo VILLAIN. No se reutiliza `weeklyGoal`. | Reutilizarlo cambiaría `missing`, `goalPct`, `streak` y `weekly` (lo señala evaluation P11.2). Con un campo propio, ninguna regla existente se toca. |
| Fijas VILLAIN | Clave nueva y opcional `limits?: Record<string, number>` en `life-rpg-custom-v1`. **No** van en `goals`. | `readCustom` de las versiones ya desplegadas descarta `goals.beer` como inválido y avisaría de datos dañados (backup sellado). Una clave desconocida se conserva tal cual (P13.1): es compatible hacia delante. |
| Propias VILLAIN | `weeklyLimit` dentro del tracker, en `custom.trackers`. | Igual que `weeklyGoal`. Una versión antigua conserva el campo porque `readCustom` copia el tracker con spread. |
| Sin límite | Ausencia del campo o de la clave. No hay valor por defecto. | Beer y Burgers no tienen límite hoy. |
| Cuándo avisa | `week > weeklyLimit`, con `week` = semana en curso hasta hoy (el mismo `week` de `trackerStats`). Llegar justo al límite no avisa. | «Máximo 2» permite 2. |
| Dónde se calcula | `over: number \| null` nuevo en `TrackerStats` (`trackerStats`): `null` sin límite y `max(0, week − limit)` con límite. | Lógica de dominio en `core/`, cubierta por el selfcheck. La UI no compara. |
| Barra | Sin barra de progreso del límite: solo texto y aviso. | Una barra que se llena invita a completarla, y V2 no tiene color de aviso. |
| Historial | Sin `limitLog`. | El límite no afecta a rachas ni a semanas pasadas: no hay nada retroactivo que proteger (ver §3). |
| Edición | Lápiz en todas las tarjetas VILLAIN. En las fijas solo se edita el límite; en las propias, nombre, incremento, límite y archivar. Campo vacío = sin límite. | Reutiliza el formulario de P7.2b. |
| Fusionar copias | `limits`: se queda lo local; si difiere, se cuenta como conflicto (igual que `goals`). `weeklyLimit` entra en la `sig` de las propias. | Misma regla que los objetivos. |
| Accesibilidad | El aviso va en una región `aria-live="polite"` propia de la tarjeta, montada siempre que haya límite (`sr-only` y vacía mientras no se supera). | Se anuncia al cruzar el límite, sin tocar la región global `role="status"` (que ya comparten el toast y los banners). |

## 3. Decisiones que requieren aprobación

Recomendación por defecto entre corchetes. El implementer sigue la recomendación salvo que el usuario diga otra cosa.

1. **Sin historial de límites ni marcas en semanas pasadas.** El aviso solo mira la semana en curso con el límite actual, y «Últimas 8 semanas» de VILLAIN no cambia. [Sí. Si algún día se marcan las semanas pasadas, haría falta un `limitLog` como `goalLog`.]
2. **El aviso solo sale en la tarjeta VILLAIN**, sin línea «Te pasaste en…» en «Hoy» de Inicio. [Sí. En VILLAIN solo se registra desde la tarjeta, que es donde se ve el aviso. La línea en Inicio sería un ciclo aparte.]
3. **Llegar justo al límite no avisa**; solo superarlo. [Sí.]
4. **Fusionar copias:** si las dos copias tienen límites distintos, se queda el local y se cita en el mensaje de conflicto (como con los objetivos). [Sí.]
5. **El límite no se pide al crear la actividad** en «Nuevo»: se pone editando la tarjeta. [Sí.]

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `Tracker.weeklyLimit?`, `Limits`, `CustomData.limits?`, `TrackerEdit.weeklyLimit?`, `TrackerStats.over`. |
| `app/src/core/trackers.ts` | `isFixedVillain`, `setLimit`; `allTrackers(…, limits)` aplica el límite a las fijas VILLAIN. |
| `app/src/core/stats.ts` | `trackerStats` devuelve `over`. |
| `app/src/core/classify.ts` | `editTracker` trata `weeklyLimit` (solo VILLAIN). |
| `app/src/core/storage.ts` | `readCustom` valida `limits` y `weeklyLimit`; `'limits'` entra en `KNOWN`. |
| `app/src/core/merge.ts` | `sig` incluye `weeklyLimit`; conflictos de `limits`; se borra `limits` si queda vacío. |
| `app/src/core/selfcheck.ts` | Asserts L1–L6 (nuevos). Los existentes no cambian. |
| `app/src/core/storage.test.ts` | C15–C17. |
| `app/src/App.tsx` | `allTrackers` con `custom.limits`; `saveTracker` con la rama de las fijas VILLAIN; `hasData` cuenta `limits`; texto de conflicto de `mergeData`. |
| `app/src/components/MissionsView.tsx` | `onSave` para todas las tarjetas. |
| `app/src/components/TrackerCard.tsx` | Línea semanal con límite, aviso, campo «Límite semanal» y `aria-label` del lápiz. |
| `app/src/App.test.tsx`, `app/src/a11y.test.tsx` | U23–U25 y A7. |
| `docs/ESTADO-ACTUAL.md`, `docs/cycles/STATE.md` | Estado tras el ciclo. |

No hay archivos nuevos ni dependencias. `rpg.ts`, `party.ts`, `seed.ts` y `UnknownView` no cambian.

## 5. Modelos de datos

```ts
// types.ts
export type Tracker = { /* … */ weeklyGoal?: number; weeklyLimit?: number /* solo VILLAIN, entero ≥ 1; ausente = sin límite */ ; /* … */ }
export type TrackerEdit = { name: string; increment: number; weeklyGoal: number | null; weeklyLimit?: number | null } // undefined = no tocar; null = sin límite
export type Limits = Record<string, number> // trackerId fijo VILLAIN → weeklyLimit (entero ≥ 1)
export type CustomData = { trackers: Tracker[]; proposals: Proposal[]; goals?: Goals; goalLog?: GoalLogEntry[]; limits?: Limits }
export type TrackerStats = { /* … */ over: number | null /* unidades por encima de weeklyLimit en la semana en curso; null = sin límite */ }
```

`weeklyLimit` es opcional en `TrackerEdit` para que las llamadas actuales a `editTracker` (E2–E5) compilen sin tocarlas.

## 6. Persistencia y migración

- **Sin migración.** Los datos guardados no tienen `limits` ni `weeklyLimit`: se leen igual que hoy y significan «sin límite». No se reescribe nada al cargar.
- **`life-rpg-custom-v1`** puede llevar `limits?: { beer?: n, burgers?: n }` y `weeklyLimit` dentro de cada tracker propio VILLAIN. Si `limits` queda vacío, se omite (igual que `goals`).
- **Validación en `readCustom`:**
  - `limits` que no es un objeto → `dropped += 1` y se ignora.
  - Cada entrada con id fijo VILLAIN (`isFixedVillain`) y valor entero ≥ 1 se conserva. Cualquier otra entrada (`gym`, `custom-x`, `0`, `2.5`, `'3'`) → `dropped += 1`.
  - `weeklyLimit` de un tracker se conserva solo si `branch === 'villain'`, es un número finito y > 0, con la misma regla que `weeklyGoal`. Si no, se borra el campo y el tracker cuenta como `fixed` (se conserva).
  - Se añade `'limits'` a `KNOWN`, para que el bucle de claves desconocidas no la copie sin validar.
- **Versiones anteriores** (PWA en caché u otra pestaña): conservan `limits` como clave desconocida y `weeklyLimit` dentro del tracker por el spread. No los muestran, pero tampoco los borran ni avisan de datos dañados.
- **Exportar/importar, `.backup.last` y restaurar:** sin código nuevo. `exportBackup` serializa `custom` entero y `parseBackup`/`readLast` pasan por `readCustom`.
- **«Borrar todo»:** `EMPTY_CUSTOM` no lleva `limits`. `hasData` cuenta `limits`, así que se hace la copia interna aunque solo haya límites.
- **Sincronía entre pestañas:** sin cambios. El evento `storage` recarga `custom` entero.

## 7. Lógica de dominio

```ts
// trackers.ts
export const isFixedVillain = (id: string) => TRACKERS.some(t => t.id === id && t.branch === 'villain')

// Objeto nuevo. Sin la clave si limit es null o redondeado < 1. Si `id` no es fija VILLAIN, devuelve `limits` sin tocar.
export function setLimit(limits: Limits = {}, id: string, limit: number | null): Limits {
  if (!isFixedVillain(id)) return limits
  const { [id]: _old, ...rest } = limits
  const l = limit === null ? 0 : Math.round(limit)
  return l < 1 ? rest : { ...rest, [id]: l }
}

export function allTrackers(custom: Tracker[], goals: Goals = {}, goalLog: GoalLogEntry[] = [], limits: Limits = {}): Tracker[]
//   fijas: (goals[t.id] && t.weeklyGoal) → override de objetivo (como hoy)
//          ; si no, (t.branch === 'villain' && limits[t.id]) → { ...t, weeklyLimit: limits[t.id] }
//          ; si no, t (misma identidad que TRACKERS)
//   propias: tal cual (su weeklyLimit ya viene en el tracker). Luego withPast como hoy.
```

```ts
// stats.ts — trackerStats añade:
over: t.weeklyLimit ? Math.max(0, week - t.weeklyLimit) : null,
```

`deriveGame` ya propaga el campo con `...s`. No hay más cambios en el motor: `streak`, `goalPct`, `weekly`, `todaySummary`, `branchWeekly`, `deriveGame`, `derivePartyState` y `buildRanking` siguen leyendo solo `weeklyGoal`, `xpPerUnit` y los eventos.

```ts
// classify.ts — editTracker, tras la línea de weeklyGoal:
if (e.weeklyLimit !== undefined) {
  if (t.branch === 'villain' && e.weeklyLimit !== null && Number.isFinite(e.weeklyLimit) && e.weeklyLimit >= 1) next.weeklyLimit = Math.round(e.weeklyLimit)
  else delete next.weeklyLimit
}
if (t.branch === 'hero') delete next.weeklyLimit // una HERO nunca lleva límite
```

```ts
// merge.ts
const sig = (t: Tracker) => JSON.stringify([t.name, t.increment, t.weeklyGoal ?? null, t.weeklyLimit ?? null, !!t.archived, t.branch, t.type, t.unit, t.xpPerUnit])
// tras el bucle de goals:
for (const t of TRACKERS) if (isFixedVillain(t.id) && (lc.limits?.[t.id] ?? null) !== (ic.limits?.[t.id] ?? null)) conflicts.push(t.name)
// `custom` ya hereda lc.limits por el spread; añadir:
if (custom.limits && Object.keys(custom.limits).length === 0) delete custom.limits
```

`changed` no cambia: los límites de la copia nunca se adoptan.

**`App.saveTracker`**: al principio, antes de la lógica de objetivos:

```ts
if (!t.custom && t.branch === 'villain') {
  setCustom(c => {
    const { limits: _l, ...rest } = c
    const limits = setLimit(c.limits, t.id, t.weeklyLimit ?? null)
    return Object.keys(limits).length ? { ...rest, limits } : rest
  })
  return
}
```

Las propias VILLAIN siguen por el camino actual: se reemplaza el tracker y `logGoal` no apunta nada porque `weeklyGoal` sigue `undefined`.
`trackers = useMemo(() => allTrackers(custom.trackers, custom.goals, custom.goalLog, custom.limits), [..., custom.limits])`.
`hasData` añade `|| Object.keys(custom.limits ?? {}).length > 0`.
Texto de conflicto en `mergeData`: «(nombre, incremento, objetivo, límite o archivado)».
`add()` no cambia: **registrar no se bloquea**.

## 8. UI

Todo en la paleta VILLAIN de la tarjeta (`THEME.villain`), sin tokens nuevos. HERO no cambia de forma visible.

**`MissionsView`**: `onSave={onSave}` en todas las tarjetas (las fijas HERO ya lo tenían porque todas tienen `weeklyGoal`; ahora lo tienen también Beer y Burgers).

**`TrackerCard`**:
- **Lápiz:** `aria-label` = propia → `Editar {name}`; fija HERO → `Editar objetivo de {name}` (como hoy); fija VILLAIN → `Editar límite de {name}`.
- **Línea semanal** (bloque `text-sm leading-6`): si `t.weeklyLimit`, el número grande `{week}` seguido de ` {unit} esta semana · límite {weeklyLimit}`. Sin límite, se queda como hoy.
- **Aviso:** solo si `t.weeklyLimit`, justo debajo de la línea semanal:
  ```tsx
  <p aria-live="polite" className={stats.over ? 'flex items-center gap-2 text-sm font-medium leading-6' : 'sr-only'}>
    {stats.over ? <><CircleAlert className="size-4 shrink-0" aria-hidden /> Te has pasado de tu límite semanal en {stats.over} {unitFor(stats.over, t.unit)}.</> : null}
  </p>
  ```
  Hereda `text-villain-text` de la tarjeta, con icono `CircleAlert` (STYLE_GUIDE §Color: avisos = texto principal + `CircleAlert`, sin color semántico). El tono es neutro y en segunda persona, sin exclamaciones ni juicio. No usa `.pop`: el aviso no se celebra.
- **Formulario:**
  - Estado `eLimit`, que `open()` inicializa con `t.weeklyLimit ? String(t.weeklyLimit) : ''`.
  - Si `t.branch === 'villain'`: `<label>Límite semanal ({unit})` + `input type="number" min=1 step=1 placeholder="Sin límite"`, con la ayuda en `c.muted`: «Déjalo vacío para no tener límite. Pasarte no cambia tu XP.». Mismas clases que el campo de objetivo.
  - El campo de objetivo sigue solo en HERO.
  - `limitOk = eLimit.trim() === '' || Math.round(Number(eLimit)) >= 1`. `canSave = fixed ? goalOk && limitOk : !nameErr && incOk && goalOk && limitOk`.
  - `nextT()` pasa `weeklyLimit: eLimit.trim() === '' ? null : Number(eLimit)`.
  - Guardar en una fija: HERO como hoy; VILLAIN → `onSave({ ...t, weeklyLimit: eLimit.trim() === '' ? undefined : Number(eLimit) })`.
  - Archivar (propias) sigue usando `nextT()` si `canSave`.
- **Estados:** sin límite, la tarjeta se ve como hoy. Con límite y sin pasarse, se ven la línea «· límite N» y la región vacía (`sr-only`). Al pasarse, aparece el aviso visible y el lector lo anuncia una vez al cruzar. Si se corrige (− o Deshacer) por debajo del límite, el aviso se va. No hay estados de carga ni de error nuevos.

## 9. Backlog (rama `cycle-23`)

Cada tarea cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, y deja la app funcionando.

**T1 — Dominio del límite (core)**
- Archivos: `types.ts`, `trackers.ts`, `stats.ts`, `classify.ts`, `selfcheck.ts`.
- Qué: tipos de §5; `isFixedVillain`, `setLimit` y el 4.º parámetro de `allTrackers`; `over` en `trackerStats`; `editTracker` según §7; asserts L1–L5 (§11).
- Depende de: —.
- Aceptación: L1–L5 pasan y ningún assert existente cambia ni falla. La UI no cambia, porque `App` todavía no pasa `limits` y ningún tracker tiene `weeklyLimit`.

**T2 — Persistencia**
- Archivos: `storage.ts`, `storage.test.ts`.
- Qué: validación de §6 y `'limits'` en `KNOWN`; tests C15–C17.
- Depende de: T1.
- Aceptación: C1–C14 sin cambios y en verde (en particular, C3 y C8 siguen descartando `weeklyGoal` en VILLAIN y `goals.beer`); C15–C17 en verde.

**T3 — Fusión**
- Archivos: `merge.ts`, `selfcheck.ts`.
- Qué: §7 (`sig`, conflictos de `limits`, borrar `limits` vacío); assert L6.
- Depende de: T1.
- Aceptación: M1–M8 y L6 pasan.

**T4 — UI y estado**
- Archivos: `App.tsx`, `MissionsView.tsx`, `TrackerCard.tsx`, `App.test.tsx`, `a11y.test.tsx`.
- Qué: §7 (App) y §8; tests U23–U25 y A7.
- Depende de: T1–T3.
- Aceptación: U1–U22 sin cambios (U13 sigue comprobando que no existe «Editar objetivo de Beer»); U23–U25 y A7 en verde; checklist manual de §11.

**T5 — Documentación**
- Archivos: `docs/ESTADO-ACTUAL.md`, `docs/cycles/STATE.md`.
- Qué:
  - En §2, la fila HERO/VILLAIN dice: «límite semanal opcional en VILLAIN (solo avisa)».
  - En «Actividades propias»: «las fijas VILLAIN editan solo su límite».
  - En §4: `limits?` en la persistencia, y `setLimit`/`isFixedVillain`/`over` en las tablas de `trackers.ts` y `stats.ts`.
  - En §5 / «Pausa»: quitar «límite VILLAIN» de las decisiones abiertas.
  - En `STATE.md`: P23.1 hecha.
- Depende de: T4.
- Aceptación: los documentos coinciden con el código.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Una versión antigua (PWA en caché) lee `limits`/`weeklyLimit` | Clave nueva fuera de `goals` y campo nuevo del tracker: ambos se conservan sin avisar (P13.1, spread). | — |
| Confundir el límite con un objetivo (aparecer en «Te faltan» o en la racha) | Campo propio. L4 comprueba `missing`, `streak`, `goalPct` y XP con límite. | — |
| Región `aria-live` montada a la vez que el cambio y que no se anuncia | Se monta con el límite (al guardar) y se anuncia al cruzarlo después (registro). Si se pone un límite ya superado, el aviso es visible pero no se anuncia: es aceptable, porque el usuario acaba de guardar. | Quitar `aria-live` y dejar solo el texto visible. |
| `onSave` en todas las tarjetas abre el formulario en fijas sin campo útil | Todas las fijas tienen campo: HERO el objetivo, VILLAIN el límite. | — |
| Conflictos de fusión más ruidosos | Solo si los límites difieren de verdad. | Quitar `weeklyLimit` de `sig` (los conflictos son informativos). |

Qué recortar primero: la región `aria-live` (dejar solo el texto visible) y A7. Nunca recortar la validación de `readCustom` ni L4.

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`** (bloque `// L1–L6 — límite semanal VILLAIN`; ningún assert existente cambia):
- **L1 `setLimit`:**
  - `JSON.stringify(setLimit({}, 'beer', 2.6)) === '{"beer":3}'`.
  - `setLimit({ beer: 2 }, 'beer', null)`, `setLimit({ beer: 2 }, 'beer', 0)`, `setLimit({}, 'gym', 2)` y `setLimit({}, 'custom-x', 2)` no tienen claves.
  - La entrada no se muta.
- **L2 `allTrackers` con límites:**
  - `allTrackers([], {}, [], { beer: 2, gym: 5 })`: beer tiene `weeklyLimit` 2, gym no tiene `weeklyLimit` y conserva `weeklyGoal` 4.
  - `TRACKERS[4].weeklyLimit === undefined`.
  - `[1]` es `TRACKERS[1]` (misma identidad).
- **L3 `over`:** con `SEED_EVENTS` y `DEMO_DATE` (beer `week` 4), un límite de 2 → `over` 2; de 4 → 0; de 5 → 0; sin límite → `null`.
- **L4 nada cambia salvo el aviso:** con `lt = allTrackers([], {}, [], { beer: 1, burgers: 1 })`:
  - `sum(deriveGame(SEED_EVENTS, DEMO_DATE, lt)) === sum(g0)`.
  - beer tiene `streak` 0 y `goalPct` `null`.
  - `todaySummary(...).missing` no incluye ninguna VILLAIN y `best` es igual que sin límites.
  - `ps(SEED_EVENTS, lt)`: los `sum(game)` y `ids(ranking)` son iguales que en `ps(SEED_EVENTS)`.
  - `weekly(SEED_EVENTS, beerConLímite, DEMO_DATE)` tiene todas las filas con `goal === null`.
- **L5 `editTracker`:**
  - En `pizza`, `weeklyLimit: 2.4` → 2; `null` → sin campo; `undefined` → conserva el límite que tenía.
  - En `med` (HERO), `weeklyLimit: 3` → sin campo.
  - `editTracker(TRACKERS[4], …) === TRACKERS[4]`.
- **L6 `mergeBackup`:**
  - Local `limits: { beer: 2 }` y entrante `{ beer: 3 }` → `conflicts` incluye «Beer», `custom.limits` es `{ beer: 2 }` y `!changed`.
  - Local sin límites y entrante `{ beer: 3 }` → conflicto y `custom` sin `limits`.
  - Una propia con `weeklyLimit` distinto → conflicto con su nombre.

**`storage.test.ts`:**
- **C15** `readCustom({ limits: { beer: 2, burgers: 5 } })` → `limits` igual, `dropped` 0. Sin `limits` → no está la propiedad.
- **C16** `limits: 'x'` → `dropped` 1. `{ beer: 0, burgers: 2.5, gym: 3, 'custom-x': 2, nope: 1 }` → sin `limits` y `dropped` 5. Trackers `{villain, weeklyLimit: 3}` (se conserva), `{hero, weeklyLimit: 3}`, `{villain, weeklyLimit: -1}` y `{villain, weeklyLimit: 'x'}` → los tres últimos sin el campo y `fixed` 3.
- **C17** round-trip de `exportBackup`/`parseBackup` y de `backupCurrent`/`readLast` con `limits` y `weeklyLimit`.

**`App.test.tsx`** (fecha fija miércoles 2026-10-07):
- **U23 límite de fija:**
  - En VILLAIN, «Editar límite de Beer»: no hay «Nombre» ni «Archivar».
  - Spinbutton `2` y «Guardar» → `custom().limits` es `{ beer: 2 }` y el texto «· límite 2» está en la tarjeta.
  - Tres «+1 unidades» → `stored()` tiene 3 eventos (no se bloquea).
  - Aparece «Te has pasado de tu límite semanal en 1 unidad.».
  - La cabecera muestra `Lv. 1 · 45 XP`.
  - Restar 1 → el aviso desaparece.
  - Editar a vacío → `custom()` sin `limits`.
- **U24 límite de propia:**
  - Precarga de una propia VILLAIN «Pizza» con `weeklyLimit: 1` y 2 eventos esta semana → el aviso es visible y su `<p>` tiene `aria-live="polite"`.
  - «Editar Pizza», `getByLabelText(/^Límite semanal/)` = `5` y «Guardar» → `custom().trackers[0].weeklyLimit === 5`, sin aviso y sin `goalLog`.
- **U25 campos por rama:**
  - En «Editar objetivo de Gym» no hay «Límite semanal».
  - En «Editar Pizza» no hay «Objetivo semanal».
  - Beer sin límite → no hay «· límite» ni aviso.

**`a11y.test.tsx`:**
- **A7:** VILLAIN con `limits: { beer: 1 }` precargado y el ejemplo cargado (beer por encima) → `serious()` vacío.

**Checklist manual** (`npm run dev` y móvil a 320 px):
1. `[selfcheck] done` sin fallos en la consola.
2. Poner el límite de Beer a 2, registrar 3, recargar → el límite y el aviso siguen. La XP VILLAIN sube 15 por unidad igual que sin límite.
3. Con un lector de pantalla (VoiceOver/NVDA): al cruzar el límite se anuncia el aviso una vez.
4. Exportar, «Borrar todo» e importar → el límite vuelve. «Recuperar copia anterior» también.
5. A 320 px la línea «· límite N» y el aviso no desbordan. El contraste del aviso es el de `text-villain-text` sobre `villain-surface`.
6. HERO, Inicio y Party se ven igual que antes.

## 12. Handoff para Claude Code

1. `git switch -c cycle-23` desde `main`. Lee `CLAUDE.md` y esta spec. Ejecuta T1→T5 en orden, con un commit por tarea.
2. Las §5 y §7 tienen el código casi literal: úsalo. No reutilices `weeklyGoal`, `goals` ni `goalLog` para el límite.
3. No toques ningún assert ni test existente. Si alguno falla, el fallo está en tu cambio (CLAUDE.md: se arregla el motor).
4. El tono del aviso es exactamente el de §8, sin exclamaciones. Usa solo tokens `villain-*` y no añadas color semántico.
5. Si una decisión de §3 vuelve cambiada por el usuario, solo afecta a §8 (UI) o a L6/U23; el modelo de datos sirve igual.
6. Cierra con `npm run build`, `npm run lint` y `npm test` desde `app/`, y el checklist de §11. `npm run e2e` no debería cambiar; ejecútalo antes del merge.
