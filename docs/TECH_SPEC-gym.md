# TECH SPEC — Módulo Gym (ciclo 24)

Entrada: `docs/cycles/STATE.md` («Ciclo 24 — Módulo Gym», D1-D8 y decisiones del paso 3), `cycle-24/proposals.md` y `evaluation.md` (P24.1-P24.5 aprobadas con cambios; P24.6-P24.12 pospuestas, fuera de esta spec).

## 1. Resumen

Se construye un módulo de gimnasio personal: un catálogo de 21 ejercicios más los propios (que se crean y se archivan), series peso × repeticiones registradas en el día del selector, sesión del día con «Deshacer» por serie, récords derivados (peso máximo, 1RM Epley, más repeticiones con un peso) con aviso, y unidades kg/lbs. La primera serie de un día apunta automáticamente la sesión del tracker `gym` con un evento real de id determinista (`gym-auto-<día>`). Se añaden la pantalla «Gym» (HERO), la sección «Yo» y una 6.ª pestaña en BottomNav. Todo se guarda en una clave nueva de localStorage con validación, backups, export/import y fusión.

No se construyen XP propia, nivel Gym, party, gráficas, rutinas, temporizador, edición de ejercicios propios ni integración con «Hoy». XP, niveles y reglas de party siguen igual.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde viven las series | Clave propia `life-rpg-gym-v1` con `GymData = { log, exercises, unit? }` | No toca el formato de eventos y aísla la corrupción. Una versión anterior de la app la ignora sin romper nada |
| Inmutabilidad | `log` es solo de añadir: `GymSet` o `GymUndo` (`undoes` = id de la serie). Nunca se borra ni se edita | Es la misma regla que `ActivityEvent` |
| Derivados | Récords, sesión del día, última serie y peso mostrado se calculan en cada render y nunca se guardan | Es la arquitectura de la app |
| Sesión automática | `ActivityEvent` real `{ id: 'gym-auto-<día>', trackerId: 'gym', amount: 1, occurredAt: '<día>T12:00:00' }`. Si se reemite el mismo día, el id es `gym-auto-<día>-<n>` (n ≥ 2) | Con id y contenido deterministas, la regla `same` de `merge.ts` la deduplica entre dispositivos (decisión del usuario, paso 3) |
| Cuándo se emite | Después de registrar una serie en el día D, se emite si `dayTotal(events,'gym',D) ≤ 0` | «Sin duplicar la manual»: si ya hay sesión neta ese día, no se emite. Si el usuario quitó la sesión con «−» y vuelve a registrar una serie, la sesión reaparece una vez (D1: serie ⇒ sesión). No hay bucle, porque cada serie como mucho deja el neto en 1 |
| Deshacer todas las series del día | Cuando D se queda sin series vivas, se deshacen (evento −1 con `undoes`) las automáticas vivas de D, de la más nueva a la más antigua, mientras `clampAmount` lo permita. Las sesiones manuales no se tocan | La automática pertenece a las series y la manual es independiente. Se aparta de la recomendación de la evaluación («salvo +1 manual»): con manual + automática, quitar las series deja 1 sesión (la manual) en vez de 2 |
| Días pasados | La serie y su sesión automática caen en el día del selector (nunca en el futuro, `day > today ⇒ today`). La automática lleva la hora 12:00:00 de ese día | Mismo comportamiento que el selector de HERO |
| Unidades | Cada serie guarda `weight` + `unit` tal como se registró, redondeado a 2 decimales. Para comparar se usa kg (factor 0,45359237, clave redondeada a 3 decimales). Para mostrar se usa la unidad preferida: si coincide con la registrada, el valor exacto; si no, convertido y redondeado a 1 decimal | Así lo pidió la evaluación (sin canónico) y la visualización es estable |
| Preferencia | `GymData.unit` (ausente = kg). Al fusionar se queda la local | Es una preferencia, no un dato |
| −/+ del peso | Salto de 2,5 kg / 5 lbs según la unidad del formulario, con mínimo 0 y máximo 2000 | Decisión del usuario (paso 3) |
| Entrada de decimales | `<input type="text" inputMode="decimal">` + `parseWeight` (acepta `,` o `.`) | `type="number"` falla con la coma del teclado es-ES |
| Epley | `reps === 1 ? kg : kg × (1 + reps/30)`, solo con `reps ≤ 12` y `peso > 0` | Lo pide la evaluación. Con 1 repetición, el 1RM es el propio peso |
| «Más repeticiones con un peso» | Se compara por peso (clave en kg). En la tarjeta de récords se muestra la serie con más repeticiones (empate: la de más peso y, después, la primera) | Es lo más simple que sigue siendo legible |
| Aviso de récord | Solo si el ejercicio ya tenía series vivas y la nueva mejora estrictamente. Nunca en la primera serie ni al deshacer | Lo pide la evaluación |
| Ejercicios propios | id `custom-<uuid>`, se crean y se archivan (no se editan ni se borran) y se reactivan | Patrón de los trackers custom y recorte de P24.5 aplicado desde el principio |
| Fusión de series | La regla de eventos de `merge.ts` se extrae a un helper genérico `mergeLog` y se usa en los dos sitios | «Reutiliza la regla, no inventa otra». M1-M8 protegen la refactorización |
| Importar (reemplazar) una copia sin `gym` | El gym local se reemplaza por vacío, con aviso explícito en la confirmación. Se puede recuperar con «Recuperar copia anterior» | «Importar» reemplaza todo. Mezclar series locales con eventos importados dejaría sesiones automáticas incoherentes |
| Navegación | 6 pestañas (Inicio, HERO, VILLAIN, Nuevo, Party, Yo) y `Screen` += `'me' \| 'gym'`. En Gym, la pestaña activa es «Yo» | Decisión del usuario (paso 3) |
| Selector de ejercicio | `<select>` nativo con `<optgroup>` por grupo | Es accesible, cabe a 320 px y no necesita componente nuevo |
| Selector de día | El de `MissionsView` se extrae a `DayPicker.tsx` y lo usan las dos pantallas | Reutilizar en vez de duplicar |
| ids de tests | selfcheck `GY1–GY13`, storage.test `GS1–GS6`, App.test `U26–U31`, a11y `A8–A9`, e2e `E4–E5` (los prefijos existentes se comprobaron con Grep: G1-G4 y U1-U25 ya están ocupados) | Fricción del ciclo 23 |

## 3. Decisiones que requieren aprobación

Vacía. El alcance, la sesión automática como evento real, el efecto en XP/racha/party del tracker `gym`, las 2 sesiones con manual + automática, las 6 pestañas, el salto 2,5 kg / 5 lbs y el catálogo sin plancha ya están aprobados (STATE, paso 3). Solo hay que volver a preguntar en un caso: si el e2e de 320 px falla después de los ajustes de §10, se para y se consulta al usuario antes de aplicar la alternativa B de navegación.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | Tipos de §5 |
| `app/src/core/gym.ts` (nuevo) | Catálogo, grupos, unidades, parse/format, series vivas, récords, `beaten`, `recordText`, sesión automática (`autoSession`, `retractAuto`). Puro, sin React |
| `app/src/core/storage.ts` | `GYM_KEY`, `EMPTY_GYM`, `readGym`, `saveGym`. `loadAll`, `backupCurrent`, `hasLastBackup`, `readLast`, `restoreLast`, `EMPTY_RAW`, `isDataKey`, `lockStorage`, `exportBackup` y `parseBackup` incluyen gym |
| `app/src/core/merge.ts` | Helper `mergeLog` (extraído del bucle actual), fusión de `GymData`, `MergeResult` con `gym`, `setsAdded`, `exercisesAdded` |
| `app/src/core/selfcheck.ts` | Asserts GY1-GY13 |
| `app/src/core/storage.test.ts` | GS1-GS6 |
| `app/src/App.tsx` | Estado `gym` (carga, guardado, sincronía entre pestañas, unsaved, `hasData`, reset/import/merge/restore). `add` se divide en `push(evs, t)`. Nuevos `addSet`, `undoSet`, `setUnit`, `createExercise`, `setExerciseArchived`, estado `record` y pantallas `me` y `gym` |
| `app/src/components/BottomNav.tsx` | 6 ítems, `grid-cols-6`, etiqueta en `<span data-label>` y `gym` marca «Yo» |
| `app/src/components/DayPicker.tsx` (nuevo) | Selector Hoy/Ayer/fecha extraído de `MissionsView` (mismo marcado y clases, prop `tone`) |
| `app/src/components/MissionsView.tsx` | Usa `DayPicker` (sin cambio de comportamiento) |
| `app/src/components/MeView.tsx` (nuevo) | Sección «Yo» (neutral) con tarjeta «Gym» |
| `app/src/components/GymView.tsx` (nuevo) | Pantalla Gym (HERO) |
| `app/src/components/LevelUpToast.tsx` | `RecordBanner` (tarea recortable T10) |
| `app/src/App.test.tsx`, `app/src/a11y.test.tsx`, `app/e2e/smoke.e2e.ts` | Tests de §11 |
| `docs/STYLE_GUIDE.md` | Navegación de 6 destinos e iconos `User` (Yo), `Dumbbell` (Gym) y `Trophy` (récord) |
| `CLAUDE.md`, `AGENTS.md` | Línea de `gym.ts` y clave nueva en `storage.ts`/`merge.ts` (sincronizar los dos). `ESTADO-ACTUAL.md` lo actualiza el cycle-analyst (STATE) |

Sin cambios: `rpg.ts`, `party.ts`, `stats.ts`, `trackers.ts`, `classify.ts`, `seed.ts`.

## 5. Modelos de datos

```ts
// types.ts
export type WeightUnit = 'kg' | 'lbs'
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'
export type Exercise = { id: string; name: string; group: MuscleGroup; kind: 'load' | 'bodyweight'; archived?: boolean }
// weight: kg o lbs según unit, ≥ 0, ≤ 2000, 2 decimales máx.; en 'bodyweight' es el lastre (0 = sin lastre). reps: entero 1..999
export type GymSet = { id: string; exerciseId: string; weight: number; unit: WeightUnit; reps: number; occurredAt: string }
export type GymUndo = { id: string; undoes: string; occurredAt: string } // occurredAt = el de la serie anulada
export type GymEntry = GymSet | GymUndo
export type GymData = { log: GymEntry[]; exercises: Exercise[]; unit?: WeightUnit } // exercises: solo los propios; unit ausente = 'kg'
export type RecordKind = 'weight' | '1rm' | 'reps'
export type GymRecords = { maxWeight: GymSet | null; best1rm: { set: GymSet; kg: number } | null; mostReps: GymSet | null }
```

Catálogo `EXERCISES` en `gym.ts`. Los ids son estables y no se renombran nunca. `kind` es `load`, salvo los marcados con (bw).

| group (`GROUPS`, en este orden) | etiqueta | ejercicios `id` «nombre» |
|---|---|---|
| chest | Pecho | `bench-press` «Press banca», `incline-db-press` «Press inclinado con mancuernas», `dips` «Fondos» (bw) |
| back | Espalda | `pull-up` «Dominadas» (bw), `barbell-row` «Remo con barra», `lat-pulldown` «Jalón al pecho», `deadlift` «Peso muerto» |
| legs | Piernas | `squat` «Sentadilla», `leg-press` «Prensa», `lunge` «Zancadas», `romanian-deadlift` «Peso muerto rumano», `leg-curl` «Curl femoral», `calf-raise` «Elevación de gemelos» |
| shoulders | Hombros | `overhead-press` «Press militar», `lateral-raise` «Elevaciones laterales», `face-pull` «Face pull» |
| arms | Brazos | `barbell-curl` «Curl de bíceps con barra», `hammer-curl` «Curl martillo», `triceps-pushdown` «Extensión de tríceps en polea», `skull-crusher` «Press francés» |
| core | Core | `leg-raise` «Elevaciones de piernas» (bw) |

Son 21 ejercicios y no hay plancha.

## 6. Persistencia y migración

- **Clave nueva** `life-rpg-gym-v1` con `GymData`. `EMPTY_GYM = { log: [], exercises: [] }`. Ausente → `EMPTY_GYM`. El efecto de guardado de `App` la escribe al montar, igual que las otras claves, así que existe antes de cualquier `backupCurrent`.
- **`readGym(v): Parsed<GymData>`**
  - Si no es un objeto, o si `log` o `exercises` existen y no son arrays → `null` (ilegible).
  - Entrada con `undoes` → `GymUndo` válido si `id` y `undoes` son strings no vacíos y `occurredAt` cumple `STAMP`.
  - Entrada sin `undoes` → `GymSet` válido si `id` y `exerciseId` son strings no vacíos, `weight` es finito con 0 ≤ w ≤ 2000, `unit` ∈ {kg, lbs}, `reps` es entero 1..999 y `occurredAt` cumple `STAMP`.
  - Las entradas no válidas cuentan en `dropped`. Las válidas se conservan tal cual (campos extra incluidos, como en `readEvents`). Un `exerciseId` desconocido se conserva.
  - Ejercicio válido si `id` es un string que empieza por `custom-`, `name` es un string de 1..40 caracteres tras `trim`, `group` ∈ `MuscleGroup` y `kind` ∈ {load, bodyweight}. Si no, se descarta. Un `archived` que no sea booleano se elimina (`fixed`).
  - Un `unit` presente que no sea kg/lbs se elimina (`fixed`).
  - Las claves desconocidas del nivel superior se copian igual que en `readCustom` (`KNOWN_GYM` incluye `'__proto__'`).
- **`loadAll`** devuelve `{ events, custom, gym, problems }` con el mismo `load()`: si hay datos corruptos o reparados, `<clave>.backup.<stamp>` + `LoadProblem`. Si no se puede hacer el backup, la clave queda bloqueada. `saveGym(g, store)` sigue el patrón de `saveCustom` (`null` si está bloqueada).
- **Backups:** `backupCurrent`, `hasLastBackup` y `restoreLast` recorren `[KEY, CUSTOM_KEY, GYM_KEY]`. `EMPTY_RAW[GYM_KEY] = JSON.stringify(EMPTY_GYM)`. `LastBackup` añade `gym: GymData | null`. `isDataKey` acepta `GYM_KEY` y `lockStorage()` bloquea por defecto las tres claves.
- **Export:** `exportBackup(events, custom, exportedAt, gym)` añade `gym` y `version` sigue en `1`. Una versión anterior de la app importa la copia ignorando `gym` (es un riesgo transitorio aceptado).
- **`parseBackup`** devuelve `gym: GymData | null`. Sin campo `gym` → `null` (copia antigua). Si el campo `gym` existe pero es ilegible → toda la copia es inválida (`null`), igual que con `events`/`custom`. `dropped`/`fixed` suman también los de gym.
- **Migración:** no hace falta ninguna. Las claves `life-rpg-demo-v1` y `life-rpg-custom-v1` no cambian de formato. Las sesiones automáticas son `ActivityEvent` normales: una versión anterior las lee y las cuenta como sesiones.
- **Fusión** (`mergeBackup(local, incoming)`; `Side` añade `gym?: GymData`; ausente = `EMPTY_GYM`):
  - `log`: `mergeLog(local.log, incoming.log, sameEntry, isUndo)`. `sameEntry` compara, en una serie, `exerciseId`, `weight`, `unit`, `reps` y `occurredAt`; en un deshacer, `undoes` y `occurredAt`. Mismo id con contenido distinto → `id~n` y se reasigna `undoes`. Un deshacer de algo ya deshecho cuenta como «ya estaba».
  - Ejercicios: se añaden los ids nuevos. Si el id coincide pero cambia `[name, group, kind, !!archived]`, se queda lo local y el nombre local va a `conflicts`.
  - `unit`: se queda la local.
  - `incoming.gym` ausente → el gym local se devuelve igual (mismo contenido).
  - `MergeResult` añade `gym`, `setsAdded` (entradas de log añadidas) y `exercisesAdded`. `changed` también es true si alguna de las dos es > 0.
- **`mergeLog`** (export interno de `merge.ts`) es el bucle actual de `mergeBackup` generalizado, sin cambio de semántica:

```ts
function mergeLog<T extends { id: string; undoes?: string }>(local: T[], incoming: T[], same: (a: T, b: T) => boolean, isUndo: (e: T) => boolean):
  { list: T[]; added: number; existing: number; renamed: number }
// eventos: same = la actual; isUndo = e => e.amount < 0 && !!e.undoes. Gym: isUndo = e => 'undoes' in e
```

## 7. Lógica de dominio (`core/gym.ts`)

```ts
export const GYM_TRACKER = 'gym'
export const MAX_WEIGHT = 2000
export const STEP: Record<WeightUnit, number> = { kg: 2.5, lbs: 5 }
export const LB_KG = 0.45359237
export const GROUPS: { id: MuscleGroup; label: string }[]
export const EXERCISES: Exercise[]                               // §5
export const allExercises = (custom: Exercise[]) => [...EXERCISES, ...custom]
export const exerciseName = (id: string, custom: Exercise[]) => allExercises(custom).find(x => x.id === id)?.name ?? 'Ejercicio desconocido'

const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100, r3 = (x: number) => Math.round(x * 1000) / 1000
export const toKg = (w: number, u: WeightUnit) => (u === 'kg' ? w : w * LB_KG)
export const convert = (w: number, from: WeightUnit, to: WeightUnit) => (from === to ? w : r1(from === 'kg' ? w / LB_KG : w * LB_KG))
export const kgKey = (s: Pick<GymSet, 'weight' | 'unit'>) => r3(toKg(s.weight, s.unit))
export function parseWeight(text: string): number | null   // trim; ',' → '.'; /^\d+(\.\d+)?$/; r2; 0..MAX_WEIGHT; si no, null
export function parseReps(text: string): number | null     // /^\d+$/, 1..999
export const stepWeight = (w: number, u: WeightUnit, dir: 1 | -1) => Math.min(MAX_WEIGHT, Math.max(0, r2(w + dir * STEP[u])))
export const fmtWeight = (w: number, u: WeightUnit) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(w)} ${u}`
// «100 kg × 5»; bodyweight con weight 0: «5 reps»; con lastre: «+10 kg × 5»
export function fmtSet(s: GymSet, pref: WeightUnit, kind: Exercise['kind']): string

export const isUndo = (e: GymEntry): e is GymUndo => 'undoes' in e
export function liveSets(log: GymEntry[]): GymSet[]                     // series no anuladas, en orden del log
export const daySets = (log: GymEntry[], day: string) => liveSets(log).filter(s => s.occurredAt.startsWith(day))
export function lastSet(log: GymEntry[], exerciseId?: string): GymSet | undefined // viva con mayor occurredAt (empate: la última del log)

export const e1rm = (kg: number, reps: number): number | null => (kg > 0 && reps <= 12 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : null)
export function records(sets: GymSet[]): GymRecords  // sets = vivas de UN ejercicio
//  maxWeight: mayor kgKey con weight > 0 (empate: la primera); best1rm: mayor r3(e1rm) (empate: la primera);
//  mostReps: mayor reps (empate: mayor kgKey, luego la primera). Vacío → todo null.
export function beaten(prev: GymSet[], s: GymSet): RecordKind[] // prev = vivas del mismo ejercicio ANTES de s; orden fijo ['weight','1rm','reps']
//  prev vacío → []. 'weight': s.weight > 0 && kgKey(s) > max kgKey(prev).
//  '1rm': e1rm(s) !== null && records(prev).best1rm !== null && r3(e1rm(s)) > r3(best1rm.kg).
//  'reps': existe p en prev con kgKey(p) === kgKey(s) && s.reps > max de esas reps.
// «Nuevo récord en Press banca: peso máximo 105 kg · 1RM estimado 122,5 kg · 6 repeticiones con 105 kg»
// (bodyweight sin lastre: «12 repeticiones sin lastre»). Pesos en pref (convert); 1RM: r1 de la conversión desde kg.
export function recordText(kinds: RecordKind[], s: GymSet, name: string, pref: WeightUnit, kind: Exercise['kind']): string

// Sesión automática (D1)
export const autoIdRe = (day: string) => new RegExp(`^gym-auto-${day}(-\\d+)?$`)
export function autoSession(events: ActivityEvent[], day: string): ActivityEvent | null
//  dayTotal(events, 'gym', day) > 0 → null. n = nº de eventos con id que cumple autoIdRe(day) + 1.
//  → { id: n === 1 ? `gym-auto-${day}` : `gym-auto-${day}-${n}`, trackerId: 'gym', amount: 1, occurredAt: `${day}T12:00:00` }
export function retractAuto(events: ActivityEvent[], log: GymEntry[], day: string, newId: () => string): ActivityEvent[]
//  daySets(log, day).length > 0 → []. Automáticas vivas de `day` (autoIdRe, amount > 0, no en undoneIds), de la más nueva a la más antigua (orden en events):
//  por cada una, si clampAmount(events + acumulados, 'gym', day, -1) === -1 → { id: newId(), trackerId: 'gym', amount: -1, occurredAt: auto.occurredAt, undoes: auto.id }.
```

Reglas de juego: no cambian. Una sesión automática es +1 en `gym` (30 XP), igual que una manual, así que mueve racha, objetivo, «Hoy», ranking y votación de «Los del Gym» (aprobado). `deriveGame` y `party.ts` no saben nada del módulo.

**Flujo en `App.tsx`:**
- `push(evs: ActivityEvent[], t: Tracker)` es la cola actual de `add`: `next`, `deriveGame`, toast de subida (o de bajada si la suma < 0), `setGain`, adelantamientos. `add` construye su evento y llama a `push([ev], t)`, con el comportamiento actual intacto.
- `addSet(input: Omit<GymSet, 'id' | 'occurredAt'>, day): { kinds: RecordKind[]; auto: boolean }`
  1. Si `day > today`, se usa `today`.
  2. `set = { id: crypto.randomUUID(), ...input, weight: r2(input.weight), occurredAt: nowStamp(day) }`, creado fuera del updater.
  3. `prev = liveSets(gym.log)` del mismo ejercicio y `kinds = beaten(prev, set)`.
  4. `setGym({ ...gym, log: [...gym.log, set] })`.
  5. `ev = autoSession(events, day)`. Si existe, `push([ev], gymTracker)`, con `gymTracker` sacado de `trackers`.
  6. Si `kinds.length` y no se ha recortado T10, `setRecord({ key: set.id, text: recordText(...) })`.
- `undoSet(s): { retracted: boolean }`
  1. Si ya está deshecha, no se hace nada.
  2. Se crea `u: GymUndo = { id: uuid, undoes: s.id, occurredAt: s.occurredAt }` y `log2 = [...gym.log, u]`.
  3. `setGym(...)`.
  4. `evs = retractAuto(events, log2, s.occurredAt.slice(0, 10), () => crypto.randomUUID())`. Si no está vacío, `push(evs, gymTracker)`. No hay aviso de récord.
- `setUnit(u)` guarda `unit: 'lbs'`, o quita el campo si es kg. `createExercise(e)` y `setExerciseArchived(id, archived)` operan sobre `gym.exercises`.
- `hasData` también cuenta `gym.log.length > 0 || gym.exercises.length > 0`.
- `reset` hace `setGym(EMPTY_GYM)`.
- `importData` hace `setGym(b.gym ?? EMPTY_GYM)`.
- `mergeData` pasa `gym` y aplica `r.gym`.
- `restore` usa `r.gym ?? gym`.
- `onStorage` hace `setGym(r.gym)`.
- `unsaved` incluye `gym`.
- `UpdateBanner` tone: `gym` → `'hero'`.

**Textos de import y fusión** (se añaden a los actuales; `k` = series vivas):
- En la confirmación de importar, si `b.gym === null && kLocal > 0`: ` Esta copia es anterior al módulo Gym: tus ${kLocal} series de gym también se reemplazan (quedan 0).` Si no, y si `kLocal + kCopia > 0`: ` Series de gym: ${kLocal} → ${kCopia}.`
- En la fusión, si `r.setsAdded + r.exercisesAdded > 0`: ` y ${r.setsAdded} entradas de gym` tras «misiones nuevas», y lo mismo en el aviso final.

## 8. UI

**BottomNav**
- `ITEMS` añade `{ screen: 'me', label: 'Yo', Icon: User }` al final y la lista pasa a `grid-cols-6`.
- La etiqueta va en `<span data-label className="block w-full whitespace-nowrap text-center">`.
- `aria-current="page"` en «Yo» si `screen` es `'me'` o `'gym'`.
- No cambian clases de altura ni tamaño de texto. Si el e2e E5 falla, se aplica `tracking-tight` a la etiqueta. Si sigue fallando, se para (§3).

**MeView (`me`, paleta neutral)**
- Mismo contenedor de pantalla que la guía, `h1` «Yo» y metadato «Tus módulos personales.».
- Tarjeta-botón «Gym» en panel HERO (`rounded-xl border border-hero-border bg-hero-surface text-hero-text p-4`, `Dumbbell` + nombre + `ChevronRight`), con el subtítulo «Series, pesos y récords». Al pulsarla, `onOpenGym()`.
- Prop `focusGym: boolean`: si es true, al montar enfoca la tarjeta (con `ref` + `useEffect`).

**GymView (`gym`, paleta HERO: `min-h-dvh bg-hero-bg text-hero-text`), en este orden:**
1. Botón secundario HERO «Volver» (`ArrowLeft`) → `onBack()`. App hace `go('me')` con `focusGym = true`, así el foco vuelve a la tarjeta Gym de «Yo». Debajo, la etiqueta `HERO`, el `h1` «Gym» y el metadato «Cada día con series cuenta como sesión de Gym en HERO.». Si `saveFailed`, `SaveFailBanner tone="hero"`.
2. `Segmented` «Unidad de peso» con kg/lbs (`toneFor` → `'hero'`).
3. `DayPicker tone="hero"`, con la etiqueta «Registrar en».
4. `<label>` «Ejercicio» + `<select>` con `<optgroup label={GROUPS.label}>` y los ejercicios no archivados. Por defecto, el ejercicio de `lastSet(log)` si no está archivado; si no, `bench-press`.
5. **Tarjeta «Registrar serie»**
   - Campo «Peso (kg|lbs)», o «Lastre (kg|lbs)» si es de peso corporal, entre dos botones de icono: `Minus` con `aria-label="Bajar 2,5 kg"` y `Plus` con «Subir 2,5 kg» (5 lbs en lbs). Después, el campo «Repeticiones» (`inputMode="numeric"`).
   - Prerrelleno al cambiar de ejercicio o de unidad: `lastSet(log, id)` convertido a la preferencia, con sus repeticiones. Si no hay última serie: peso vacío (con carga) o `0` (peso corporal) y repeticiones vacías.
   - Botón principal «Registrar serie».
   - Botón secundario «Repetir serie», solo si hay `lastSet`. Su texto visible es «Repetir serie» y el nombre accesible es «Repetir serie: 100 kg × 5». Registra exactamente `weight`/`unit`/`reps` de la última serie en el día elegido.
   - Errores en línea (`CircleAlert`, `text-hero-text`): «Indica un peso entre 0 y 2000.», «Indica un peso mayor que 0.» (con carga), «Indica las repeticiones (1 a 999).». No se registra nada.
6. Párrafo `role="status"` de la pantalla:
   - Al registrar: «Serie registrada: Press banca, 100 kg × 5.» y, si hubo sesión automática, « Sesión de Gym apuntada en HERO (hoy|ayer|<fecha>).». Si hubo récord, el texto es `recordText(...)` + la parte de la sesión.
   - Al deshacer: «Serie deshecha.» y, si se retiró la sesión, « Sesión de Gym retirada.».
7. **Tarjeta «Récords · <ejercicio>»**
   - Filas: «Peso máximo» (`fmtWeight` + `× reps`), «1RM estimado» (`≈ 116,7 kg`, metadato «Epley, series de hasta 12 repeticiones») y «Más repeticiones» (`fmtSet`).
   - Se ocultan las filas con valor `null`. Sin series: «Aún no hay series de este ejercicio.».
8. **Tarjeta «Sesión de hoy»** (o «Sesión del <dayLabel>»)
   - `daySets(log, day)` agrupadas por ejercicio, por orden de la primera serie. Cada fila muestra «Serie n · 100 kg × 5» y un botón «Deshacer» con `aria-label="Deshacer serie n de Press banca: 100 kg × 5"`.
   - Las deshechas desaparecen. Sin series: «No hay series este día.».
   - Si se elimina la fila enfocada, el foco va al encabezado de la tarjeta (`tabIndex={-1}`).
9. **Tarjeta «Ejercicios propios»**
   - `<details>` «Añadir ejercicio» con Nombre (2-40 caracteres, `trackerName`), «Grupo» (`<select>` de `GROUPS`), `Segmented` «Tipo» (Con carga / Peso corporal) y el botón «Crear ejercicio» (id `custom-${crypto.randomUUID()}`).
   - Si el nombre ya existe (`normalizeText` contra catálogo y propios, archivados incluidos): «Ya existe un ejercicio con ese nombre.», o «Ya tienes «X» archivado: reactívalo abajo.» si está archivado.
   - Lista de propios activos con «Archivar» y de archivados con «Reactivar». Al crear uno, queda seleccionado.

No hay estado «cargando» (todo es síncrono). Los textos siguen el tono de la guía: segunda persona, sin exclamaciones.

**RecordBanner (T10, recortable)**
- `{ key, text }`, `aria-hidden` (el anuncio ya lo hace el `role="status"` de GymView).
- Mismas clases que `OvertakeBanner`, pero con la paleta HERO (`border-hero bg-hero-surface text-hero-text`, insignia `bg-hero text-hero-on-accent` con `Trophy`, título «Nuevo récord»).
- En App se renderiza si `record && !toast && !overtake` y se cierra a los 3200 ms, como `overtake`.

## 9. Backlog

Un commit por tarea en la rama `cycle-24`. Cada tarea cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, y con `[selfcheck] done` sin fallos.

| # | Objetivo | Archivos | Funcionalidad exacta | Depende | Aceptación |
|---|---|---|---|---|---|
| T1 | Núcleo puro del gym (P24.1) | `types.ts`, `gym.ts`, `selfcheck.ts` | Tipos §5 (salvo el catálogo). En `gym.ts`, todo §7 salvo `EXERCISES`/`GROUPS` (con `exerciseName` sobre una lista vacía si hace falta) y la sesión automática | — | GY2-GY5 pasan. Sin cambios de UI |
| T2 | Persistencia | `storage.ts`, `storage.test.ts`, `App.tsx`, `selfcheck.ts` | §6 salvo la fusión. App carga, guarda y sincroniza `gym`, y lo incluye en reset/import/restore/`hasData`/`unsaved`, con los textos de importar | T1 | GS1-GS6 y la parte de import de GY11. Sin cambios visibles salvo el texto de importar |
| T3 | Fusión | `merge.ts`, `selfcheck.ts`, `App.tsx` | Extraer `mergeLog` (M1-M8 sin tocar y en verde), fusión de gym y textos de fusión | T2 | GY11 (fusión) y GY12 |
| T4 | Sesión automática (P24.2) | `gym.ts`, `App.tsx`, `selfcheck.ts` | `autoSession`/`retractAuto`. `push` extraído de `add`. `addSet`/`undoSet` en App (aún sin UI) | T3 | GY6-GY10 y GY13. U1-U25 en verde (el comportamiento de `add` no cambia) |
| T5 | Catálogo (P24.4) | `gym.ts`, `selfcheck.ts` | `GROUPS` y `EXERCISES` de §5 | T1 | GY1 |
| T6 | DayPicker | `DayPicker.tsx`, `MissionsView.tsx` | Extracción sin cambio de marcado ni clases | — | Tests existentes del selector y A3/A4 en verde |
| T7 | Navegación + «Yo» (P24.3a) | `BottomNav.tsx`, `MeView.tsx`, `GymView.tsx` (esqueleto: «Volver», h1, metadato), `App.tsx`, `STYLE_GUIDE.md`, `smoke.e2e.ts`, `a11y.test.tsx`, `App.test.tsx` | §8 BottomNav, MeView, `Screen` += `me`/`gym` y foco al volver | T6 | E5 y A8 en verde. U26 |
| T8 | Pantalla Gym (P24.3b) | `GymView.tsx`, `App.tsx`, tests | §8 puntos 2-8 | T4, T5, T7 | U27-U29, U31, A9, E4 y E3 ampliado |
| T9 | Ejercicios propios | `GymView.tsx`, `App.tsx`, `App.test.tsx` | §8 punto 9 | T8 | U30 |
| T10 | Banner de récord (**recortable**) | `LevelUpToast.tsx`, `App.tsx` | §8 RecordBanner | T8 | Se ve al batir un récord y no se superpone al level-up. Los tests siguen en verde |
| T11 | Documentación | `CLAUDE.md`, `AGENTS.md` | Línea `gym.ts` en `core/`, `GYM_KEY` en `storage.ts`, fusión de gym en `merge.ts`, pantallas `me`/`gym` | T9/T10 | Los dos archivos dicen lo mismo |

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Pérdida de series por validación demasiado estricta | `readGym` descarta por entrada, nunca en bloque, y hace backup `.backup.<stamp>` ante cualquier problema (GS2, GS3) | — |
| Romper la fusión actual al extraer `mergeLog` | M1-M8 no se tocan y deben seguir en verde antes de añadir gym | Duplicar el bucle para gym sin tocar el de eventos (comentario `ponytail:`) |
| Sesiones duplicadas o negativas | GY6-GY10. Siempre se pasa por `clampAmount` y se usan ids deterministas | — |
| Etiquetas truncadas a 320 px | E5 con medición real. Primero se prueba `tracking-tight` | Parar y preguntar (alternativa B) |
| PWA antigua en caché con datos nuevos | La versión vieja ignora `life-rpg-gym-v1` y lee las automáticas como sesiones. Un «Borrar todo» hecho en la versión vieja deja las series huérfanas (sin sesión) | Aceptado: es transitorio hasta el aviso de versión nueva |
| Ciclo largo | Orden P24.1 → P24.2 → P24.4 → P24.3 | Si T1-T4 consumen más de la mitad del ciclo: se elimina T10 y la «Reactivar» de T9 (archivar sigue). Nada más se añade |
| Toast de level-up y récord a la vez | El banner espera a `!toast && !overtake` | Recortar T10 |

Checklist a 320 px en móvil real antes del push (cycle-23).

## 11. Verificación

**selfcheck.ts (bloque nuevo `// GY1–GY13 — módulo Gym`; no se toca ningún assert existente):**
- GY1: `EXERCISES.length === 21`, ids únicos, 6 grupos con al menos 1 ejercicio cada uno, sin `plank`, y los `bodyweight` son exactamente `dips,pull-up,leg-raise`.
- GY2: unidades.
  - `|toKg(100,'lbs') − 45.359| < 0.001`, `convert(100,'kg','lbs') === 220.5` y `convert(102.5,'kg','kg') === 102.5`.
  - `fmtWeight(102.5,'kg') === '102,5 kg'`.
  - `parseWeight('102,5') === 102.5`, `parseWeight('102.555') === 102.56`, y `parseWeight('-1')`, `parseWeight('abc')` y `parseWeight('2001')` devuelven `null`.
  - `stepWeight(100,'kg',1) === 102.5`, `stepWeight(100,'lbs',1) === 105` y `stepWeight(1,'kg',-1) === 0`.
- GY3: `|e1rm(100,5) − 116.667| < 0.01`, `e1rm(100,1) === 100`, y `e1rm(100,13)` y `e1rm(0,5)` devuelven `null`.
- GY4: `records` sobre press banca con {100 kg×5, 225 lbs×3, 80 kg×12, 80 kg×10}:
  - `maxWeight` = la de 225 lbs.
  - `best1rm.set` = 100×5.
  - `mostReps` = 80×12.
  - Con un `GymUndo` de la de 225 lbs, `liveSets` → `maxWeight` = 100×5.
- GY5: `beaten` con las series de GY4 como `prev`:
  - `[]` como prev → `[]`.
  - 105 kg×1 → `['weight']`.
  - 80 kg×13 → `['reps']`.
  - 100 kg×6 → `['1rm','reps']`.
  - Repetir 100×5 → `[]`.
  - `recordText(['weight'], …)` === «Nuevo récord en Press banca: peso máximo 105 kg».
- GY6: `autoSession([], D)` → `{ id: 'gym-auto-D', occurredAt: 'DT12:00:00', amount: 1 }`. Con ese evento añadido → `null`. Con un +1 manual en D → `null`. En un día pasado D′, el `occurredAt` empieza por D′.
- GY7: deshacer.
  - Con series s1 y s2 en D: deshacer s1 → `retractAuto` `[]`. Deshacer también s2 → 1 evento `{ amount: -1, undoes: 'gym-auto-D', occurredAt: 'DT12:00:00' }`. Tras aplicarlo, `dayTotal('gym',D) === 0` y `autoSession` → `gym-auto-D-2`.
  - Con «−» manual previo (neto 0) → `retractAuto` `[]`.
  - Con manual + automática → retira solo la automática y `dayTotal === 1`.
- GY8: fusión de dos dispositivos. A y B tienen cada uno `gym-auto-D` y series distintas. Resultado: un único evento con ese id, `dayTotal === 1`, 4 series vivas, y volver a fusionar → `added === 0 && setsAdded === 0`.
- GY9: manual + automática. A tiene un +1 manual (id aleatorio) y B tiene `gym-auto-D` → la fusión da `dayTotal === 2`.
- GY10: deshacer entre dispositivos. A y B tienen auto + retirada con ids de deshacer distintos → `dayTotal === 0` y la retirada de B cuenta como `existing`. Si A además tiene `gym-auto-D-2` → `dayTotal === 1`.
- GY11: copia antigua. `parseBackup` de un JSON sin `gym` → `gym === null` y los eventos se leen. `mergeBackup(local con gym, entrante sin gym)` → `JSON.stringify(r.gym) === JSON.stringify(local.gym)`, `setsAdded === 0`.
- GY12: colisión. La misma id de serie con otro peso → `id~2`, y el `GymUndo` entrante pasa a `undoes` del renombrado. Un deshacer duplicado → «ya estaba». Las entradas no se mutan (comparación con `JSON.stringify` antes y después).
- GY13: XP sin cambios. `deriveGame([gym-auto-D], D)` → la XP de gym es 30 (igual que un +1 manual).

**storage.test.ts**
- GS1: `readGym` roundtrip, entradas inválidas en `dropped` (peso −1, reps 1,5, unidad «st», sin `occurredAt`), `archived` no booleano en `fixed` y claves desconocidas conservadas.
- GS2: `loadAll` con gym corrupto (JSON roto) → `.backup.<stamp>` y `problems` con `GYM_KEY`, eventos y custom intactos.
- GS3: si falla el backup de gym, `saveGym` devuelve `null`.
- GS4: `backupCurrent`/`readLast`/`restoreLast` incluyen gym y rotan `.prev`.
- GS5: `exportBackup`→`parseBackup` hace roundtrip de gym. Una copia sin `gym` → `null`. `gym` ilegible → copia inválida.
- GS6: `isDataKey(GYM_KEY)`.

**App.test.tsx (con `vi.waitFor` para leer localStorage)**
- U26: Yo → tarjeta Gym → «Volver» → el foco está en la tarjeta Gym. La pestaña «Yo» tiene `aria-current` en las dos pantallas.
- U27: registrar 100×5 → aparece en «Sesión de hoy» y la tarjeta Gym de HERO muestra +1 sesión. Una 2.ª serie no añade sesión. Deshacer las dos → la sesión vuelve a 0 y el estado dice «Sesión de Gym retirada».
- U28: la primera serie no avisa de récord. 105×5 tras 100×5 → `role="status"` contiene «Nuevo récord en Press banca». Deshacer no avisa.
- U29: pasar a lbs → la fila muestra «220,5 lbs × 5» y `life-rpg-gym-v1.log` no cambia (igual antes y después). −/+ suma 5.
- U30: crear un ejercicio propio (queda seleccionado), nombre duplicado rechazado, archivar (desaparece del selector) y reactivar.
- U31: «Ayer» → la serie y `gym-auto-<ayer>` quedan en el día de ayer. «Repetir serie» registra el mismo peso, unidad y reps. «Borrar todo» vacía gym.

**a11y.test.tsx:** A8 «Yo» y A9 Gym con series y récords. Ninguna con violaciones serias.

**e2e (`smoke.e2e.ts`)**
- E4: a 320×640, Yo → Gym → registrar 60 kg × 8 → HERO: la XP de Gym sube 30. Recargar → la serie sigue en «Sesión de hoy».
- E5: a 320×640, 6 botones en «Principal». Por cada uno, `[data-label]` cumple `scrollWidth <= clientWidth` y su rectángulo cabe dentro del botón.
- E3 se amplía con «Yo» y Gym.

**Checklist manual (móvil real, 320 px y uno normal):**
- Nav sin cortes.
- Teclado decimal con coma.
- −/+ en kg y lbs.
- Registrar, recargar y comprobar que sigue.
- Serie en «Ayer».
- Deshacer todas → sesión retirada en HERO.
- Exportar → importar en otro navegador → fusionar con series en los dos el mismo día → 1 sesión.
- El aviso de récord no se pisa con un level-up.
- Paleta HERO sin mezclas.

## 12. Handoff para Claude Code

1. Crea la rama `cycle-24` desde `main`. Lee esta spec, `CLAUDE.md`, `core/merge.ts`, `core/storage.ts` y `App.tsx` (`add`, `importData`, `mergeData`, `restore`, `onStorage`).
2. Ejecuta T1-T11 en orden, con un commit por tarea (email noreply). Cada tarea deja build, lint y test en verde y `[selfcheck] done` sin fallos. Si falla un assert existente, se arregla el motor, no el assert.
3. En T3, extrae `mergeLog` primero y comprueba M1-M8 **antes** de añadir gym.
4. En T4, `add` debe comportarse exactamente igual (U1-U25). `push` recibe una lista de eventos.
5. Antes de añadir tests, haz Grep de los ids (`GY`, `GS`, `U26`-`U31`, `A8`-`A9`, `E4`-`E5`).
6. Si E5 falla con `tracking-tight`, para y avisa: no apliques la alternativa B.
7. Recorte (P24.5): si T1-T4 consumen más de medio ciclo, se elimina T10 y la «Reactivar» de T9. Nada fuera de esta spec (P24.6-P24.12 pospuestas).
8. No toques `rpg.ts`, `party.ts`, `stats.ts`, ni las claves o el formato de `life-rpg-demo-v1`/`life-rpg-custom-v1`. No añadas dependencias de runtime.
