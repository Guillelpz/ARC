# TECH_SPEC — Módulo Comida (fase 1: registro manual)

> Entrada: decisiones F1-F12 de `docs/cycles/STATE.md` («Ciclo 29+ — Módulo Comida»), aprobadas y cerradas. Esta spec no las reabre.
> Dos ciclos: **29** (núcleo usable: datos, catálogo, diario, objetivo, Dieta, «Yo» y «Hoy») y **30** (alimentos propios, platos guardados, resumen semanal).

## 1. Resumen

Pantalla «Comida» (paleta HERO, cuelga de «Yo» como Gym) para apuntar a mano alimentos en g/ml o en raciones, o kcal a secas («añadido rápido»), en una lista única por día con selector de día y «Deshacer» por entrada. Incluye un catálogo integrado de unos 140 alimentos (USDA FDC/BEDCA, por 100 g), recientes/frecuentes, un objetivo de kcal + % de macros con historial por día y un tracker HERO fijo «Dieta» con +1 automático en vivo cuando las kcal del día quedan entre el 90 % y el 110 % del objetivo. Los datos van en una clave propia, que entra en copias, backups, `restoreLast` y fusión. Fuera de alcance: fuentes externas (fase 2), voz (fase 3), comidas separadas, copiar el día, fibra/azúcar/sal, agua, TDEE y party.

## 2. Decisiones técnicas

| # | Decisión | Por qué (una línea) |
|---|---|---|
| T1 | Cada entrada guarda una **instantánea** de nombre, cantidad y nutrientes (`kcal/p/c/f`), además de `foodId`. | Corregir el catálogo o importar un alimento externo nunca reescribe el pasado ni cambia qué días cuentan en Dieta. Es un hecho registrado, no un derivado. |
| T2 | Datos de solo añadir: `FoodEntry` + `FoodUndo` (como `GymSet`/`GymUndo`), sin editar ni borrar. | Es el mismo patrón que el gym, así que `mergeLog` sirve tal cual. |
| T3 | El objetivo es una lista `goals: FoodGoal[]` con `from` (día). En un día rige la última entrada con `from ≤ día`; antes de la primera, rige la primera. | El patrón de objetivo vigente, por días en lugar de semanas. Con «el primero rige hacia atrás», al empezar se pueden rellenar los días pasados sin sorpresas. |
| T4 | Cambiar el objetivo crea o sustituye la entrada con `from = hoy` (nunca para un día pasado). No se puede borrar el objetivo, solo cambiarlo. | Así los días pasados no se reevalúan: solo cambia hoy (o todos, si es el primer objetivo). |
| T5 | El rango de Dieta usa enteros: `min = ceil(0.9·kcal − 1e-9)`, `max = floor(1.1·kcal + 1e-9)`, y se compara con `Math.round(kcal del día)`. | Evita errores de coma flotante (1990 × 0,9). |
| T6 | Dieta replica la regla del gym con una función propia `dietSync` en `core/food.ts`: si el día está en rango y `dayTotal('dieta') === 0`, añade `dieta-auto-<día>`; si está fuera de rango, retira las automáticas vivas. Lo manual nunca se toca. | Es idempotente y sirve para añadir, deshacer, cambiar el objetivo, importar, fusionar y recuperar. No se refactoriza `gym.ts` para no tocar GY1-GY22. |
| T7 | Los líquidos usan `base: 'ml'` con los valores por 100 g de la fuente aplicados a 100 ml. | `ponytail:` error ≤ 4 % (leche, zumos). Para afinarlo, se añade la densidad. |
| T8 | El catálogo es un array TS escrito a mano en `core/foodCatalog.ts`, con `src` y `ref` (fdcId o código BEDCA) por alimento. No hay script ni dependencia. Sin bebidas alcohólicas. | Es auditable con la referencia, y el selfcheck comprueba la coherencia. El alcohol rompe la comprobación 4/4/9 y ya existe Beer (VILLAIN). |
| T9 | Búsqueda sin acentos ni mayúsculas, sobre nombre y alias, ordenada por exacto > empieza por > todas las palabras como prefijo > contiene, con un máximo de 20 resultados. Los alimentos propios van antes que el catálogo cuando empatan. | Es determinista y sirve para la fase 3 (alias EN). |
| T10 | Medias semanales calculadas **sobre los días con registros**, no sobre 7. | Un día sin apuntar no es un día de 0 kcal. |
| T11 | `readFood` conserva los campos desconocidos (arriba, en entradas y en alimentos) y deduplica ids de alimentos y platos (gana el primero). | Fases 2 y 3 sin migración. Cierra la deuda que `readGym` tiene con las rutinas. |
| T12 | Las kcal se muestran con separador de miles siempre (`1.640`) mediante `fmtKcal` propio. | `Intl` es-ES no agrupa números de 4 cifras. |
| T13 | Recientes y frecuentes entran en el **ciclo 29**. | Son baratos y sin ellos la pantalla es incómoda. |

## 3. Decisiones que requieren aprobación

Solo lo que no cubren F1-F12. Entre corchetes, la opción recomendada, que es la que asume la spec.

- **A. Parámetros del tracker «Dieta».** [**A1**] `type 'count'`, unidad `días`, `+1 día`, `xpPerUnit 30` (igual que Gym/BJJ), objetivo semanal por defecto **5 días**, editable como en las demás fijas HERO. A2: sin objetivo semanal. En ese caso no aparece en «Te faltan», pero tampoco se puede fijar uno, porque `setGoal` exige un valor por defecto.
- **B. Visibilidad de Dieta para quien no usa Comida.** [**B1**] Dieta se oculta (se marca como archivada solo en lo derivado, sin persistirlo) mientras no haya objetivo de kcal ni eventos de `dieta`. Así no ocupa el primer puesto en HERO (`byRecent` pone primero lo no usado) ni sale en «Te faltan», y los tests de UI actuales no cambian. B2: visible siempre.
- **C. «+1 día» / «−» manual en la tarjeta Dieta.** [**C1**] Se permiten, igual que en Gym (D1 del ciclo 24): el manual nunca se retira, y un «−» que deja sin Dieta un día en rango se repone en el mismo guardado (neto 0). C2: tarjeta sin botones, pero hay que tocar `TrackerCard`.
- **D. Importar (reemplazar) una copia sin `food`.** [**D1**] La comida local se vacía, con aviso en la confirmación, igual que el gym («Importar» reemplaza todo). Al fusionar o recuperar se conserva la local. D2: conservarla también al importar.
- **E. Medias semanales** (ciclo 30). [**E1**] Sobre los días con registros (T10). E2: sobre 7 días.

## 4. Impacto en el código

**Nuevos**

| Archivo | Responsabilidad |
|---|---|
| `app/src/core/food.ts` | Lógica pura: `EMPTY_FOOD`, `DIET_TRACKER`, `fold`, `allFoods`, `portion`, `liveEntries`, `dayEntries`, `dayTotals`, `goalOn`, `setFoodGoal`, `macroGrams`, `kcalRange`, `inRange`, `dietSync`, `dietDays`, `dietActive`, `withDiet`, `searchFoods`, `recentFoods`, `frequentFoods`, `lastPortion`, `undoEntries`, parsers, `fmtKcal`. En el ciclo 30: `mealEntries`, `mealFromEntries`, `foodWeekly`, `nameTaken`. |
| `app/src/core/foodCatalog.ts` | `CATALOG: Food[]` (§7.6). Solo datos. |
| `app/src/components/FoodView.tsx` | Pantalla: cabecera con «Volver», `DayPicker`, totales del día, `FoodGoalCard`, `FoodAdd` y diario. |
| `app/src/components/FoodAdd.tsx` | Buscador, recientes/frecuentes, panel de cantidad y añadido rápido. |
| `app/src/components/FoodGoalCard.tsx` | Ver y editar el objetivo (kcal + %). |
| `app/e2e/food.e2e.ts` | e2e del ciclo 29. |
| Ciclo 30: `FoodCustom.tsx`, `FoodMeals.tsx`, `FoodWeek.tsx` | Crear/archivar alimentos propios, platos y resumen semanal. |

**Modificados**

| Archivo | Cambio |
|---|---|
| `core/types.ts` | Tipos de §5. |
| `core/trackers.ts` | `dieta` añadido **al final** de `TRACKERS` (no cambian los índices que usan los asserts) y `['días','día']` en `SINGULAR`. |
| `core/storage.ts` | `FOOD_KEY`, `readFood`, `saveFood`, la clave en `loadAll`/`lockStorage`/`isDataKey`/`backupCurrent`/`hasLastBackup`/`readLast`/`restoreLast`/`EMPTY_RAW`, y `food?` en `Backup`/`exportBackup`/`parseBackup`. |
| `core/merge.ts` | Fusión de `food` (§6.4) y contadores en `MergeResult`. |
| `core/selfcheck.ts` | FD1-FD17 y los tres asserts que cambian (§11). |
| `App.tsx` | Estado `food`, guardado, handlers, `dietSync` en todos los flujos, `withDiet` en `trackers`, navegación. |
| `components/BottomNav.tsx` | `Screen` incluye `'food'`, y «Yo» queda activa en `gym` y en `food`. |
| `components/MeView.tsx` | Tarjeta «Comida» y foco al volver (`focusCard`). |
| `components/HomeView.tsx` | Fila «Comida» en «Hoy». |
| `App.test.tsx`, `a11y.test.tsx`, `core/storage.test.ts` | Tests nuevos (§11). |
| `docs/ESTADO-ACTUAL.md`, `CLAUDE.md`, `AGENTS.md` | Documentación (última tarea de cada ciclo). |

## 5. Modelos de datos

```ts
// types.ts
export type FoodBase = 'g' | 'ml'
export type Nutrients = { kcal: number; p: number; c: number; f: number } // p/c/f en g
export type Serving = { name: string; qty: number } // «unidad» = 50 (g o ml de la base); name 1..30, qty (0, 2000]
// Valores por 100 de `base`. kcal 0..900, p/c/f 0..100.
export type Food = Nutrients & {
  id: string            // catálogo: kebab estable (nunca empieza por 'food-'); propios: 'food-<uuid>'
  name: string          // 1..40, español
  base: FoodBase
  servings?: Serving[]  // 0..5
  aliases?: string[]    // 0..10, 1..40 c/u; fase 3: alias EN
  source?: string       // catálogo: 'usda' | 'bedca'; propios: ausente = 'user'; fase 2: 'off'…  (≤ 20)
  ref?: string          // fdcId, código BEDCA o código de barras (fase 2) (≤ 100)
  archived?: boolean    // solo propios
}
export type Portion = { qty: number; serving?: { name: string; n: number } } // qty en g/ml (0, 2000]; serving.n 0.25..50 → qty = n·serving.qty
export type FoodEntry = Partial<Omit<Nutrients, 'kcal'>> & Portion & {
  id: string
  occurredAt: string    // 'YYYY-MM-DDTHH:mm:ss'
  name: string          // instantánea, 1..60
  kcal: number          // 0..20000, 1 decimal
  foodId?: string       // ausente = añadido rápido
  base?: FoodBase       // presente si hay foodId
  via?: string          // ausente = a mano; 'meal' (ciclo 30); fase 3: 'voice'
}
// Añadido rápido: sin foodId, base ni serving; qty = 0 se permite SOLO aquí (no hay cantidad). p/c/f ausentes = no indicados.
export type FoodUndo = { id: string; undoes: string; occurredAt: string } // occurredAt = el de la entrada
export type FoodLogEntry = FoodEntry | FoodUndo
export type FoodGoal = { from: string; kcal: number; p: number; c: number; f: number } // kcal entero 800..10000; % enteros 0..100 que suman 100
export type MealItem = { foodId: string; qty: number; serving?: { name: string; n: number } }
export type Meal = { id: string; name: string; items: MealItem[] } // 'meal-<uuid>'; name 1..40; 1..20 ítems
export type FoodData = { log: FoodLogEntry[]; foods: Food[]; goals?: FoodGoal[]; meals?: Meal[] } // foods: solo propios (y en fase 2, externos guardados)
export type FoodDay = Nutrients & { entries: number }   // suma de entradas vivas
export type FoodWeek = { monday: string; days: number; avg: Nutrients | null; goal: number | null; inRange: number; current: boolean } // ciclo 30
```

Encaje de las fases siguientes sin migración:
- **Fase 2:** un producto externo se copia en `foods` con `source: 'off'` y `ref: <código de barras>`. Las entradas ya son autónomas (T1).
- **Fase 3:** `aliases` (EN) entra en `searchFoods`. Las entradas por voz llevan `via: 'voice'`, y los campos desconocidos se conservan (T11).

## 6. Persistencia y migración

### 6.1 Clave
`life-rpg-food-v1` → `FoodData`. Clave ausente → `EMPTY_FOOD = { log: [], foods: [] }`. `goals` y `meals` se omiten si están vacíos (igual que `routines`). No hay que migrar nada: es una clave nueva y los datos actuales no cambian.

### 6.2 `readFood(v): Parsed<FoodData>`
- Si no es un objeto, o si `log`/`foods` existen pero no son arrays → `null` (ilegible: backup `.backup.<stamp>` y aviso; lo hace `loadAll`).
- **Entradas:** `FoodUndo` necesita `id`, `undoes` no vacíos y `occurredAt` STAMP. `FoodEntry` necesita `id` no vacío, STAMP, `name` 1..60, `kcal` finito 0..20000 y `qty` finito con 0 ≤ qty ≤ 2000 (0 solo sin `foodId`). Si existen, `p/c/f` finitos 0..2000, `foodId` string no vacío, `base` g/ml (obligatorio si hay `foodId`) y `serving` `{name 1..30, n 0.25..50}`. Una entrada no válida se descarta (`dropped`). La válida se guarda **tal cual**, con sus campos desconocidos.
- **Alimentos:** `id` empieza por `food-` (longitud > 5), `name` 1..40 tras `trim`, `base` válido y valores en rango (§5). Si no cumple → se descarta. Si el id está repetido → se descarta (gana el primero). `servings`/`aliases` con elementos no válidos: se quitan esos elementos (`fixed`, y si el array se queda vacío se quita el campo). `archived`, `source` o `ref` de tipo incorrecto → se quita el campo (`fixed`). Los campos desconocidos se conservan.
- **`goals`:** si no es un array → `dropped++`. Una entrada con `from` YYYY-MM-DD, `kcal` entero 800..10000 y `p,c,f` enteros ≥ 0 que suman 100 se acepta. Si no, `dropped++`. Si hay `from` repetido, gana el último (`fixed++`).
- **`meals`:** igual que `readRoutine`. id `meal-…`, nombre 1..40 e ítems `{foodId no vacío, qty (0,2000], serving?}`, con el ítem no válido quitado (`fixed`) y un máximo de 20. Un plato sin ítems o con id repetido se descarta.
- Las claves desconocidas de arriba se conservan (`KNOWN_FOOD = log, foods, goals, meals, __proto__`).

### 6.3 Copias, backups y bloqueo
- `Backup` recibe `food?: FoodData`, y `version` sigue siendo 1. `exportBackup(events, custom, at, gym?, food?)`.
- `parseBackup` devuelve `food: FoodData | null`: sin campo → `null` (copia anterior al módulo); ilegible → toda la copia no es válida (como el gym). `dropped`/`fixed` suman.
- `FOOD_KEY` entra en `lockStorage` por defecto, `isDataKey`, `backupCurrent`, `hasLastBackup`, `readLast` (`LastBackup.food`), `restoreLast` y `EMPTY_RAW`.
- **Importar** (reemplazar): `food = b.food ?? EMPTY_FOOD` (decisión D1). La confirmación añade `Comida: X → Y entradas.` o, si es una copia sin comida y hay comida local, `Esta copia es anterior al módulo Comida: tus X entradas de comida también se reemplazan (quedan 0).` (X/Y = `liveEntries(...).length`).
- **Recuperar** con `r.food === null`: se conserva la comida actual. La confirmación lleva `Comida: X → Y entradas.` o `…anterior al módulo Comida: tus X entradas se conservan.`
- **Borrar todo:** `EMPTY_FOOD`.
- En todos estos flujos, y en la fusión, los eventos finales son `withAutos(events, gym.log, food)`. Es un helper local de `App` que concatena `ensureAuto(...)` del gym y `dietSync(..., dietDays(food, events), today, uuid)`.

### 6.4 Fusión (`merge.ts`)
- `log`: `mergeLog<FoodLogEntry>(l.log, i.log, sameFood, isFoodUndo)`. `sameFood` compara `undoes+occurredAt` en las entradas de deshacer. En las demás compara `JSON.stringify` de `[name, kcal, p, c, f, qty, serving, foodId, occurredAt]`.
- `foods` por id: los nuevos se añaden. Si el id coincide pero `[name, base, kcal, p, c, f, !!archived]` es distinto, se mantiene el local y su nombre va a `conflicts`.
- `meals` por id, como las rutinas. Si hay conflicto, gana el local y se avisa.
- `goals` por `from`: los nuevos se añaden (ordenados por `from`). Si coincide `from` pero el contenido es distinto, gana el local y se añade `Objetivo de calorías` a `conflicts`.
- `MergeResult` recibe `food: FoodData`, `foodAdded` (entradas de log), `foodsAdded`, `mealsAdded` y `goalsAdded`, y todos cuentan en `changed`. El aviso de la fusión añade `y N entradas de comida` (entradas + alimentos + platos).
- Una copia sin `food` → `EMPTY_FOOD` del lado entrante: se conserva lo local.

## 7. Lógica de dominio (`core/food.ts`)

### 7.1 Básicos
```ts
export const EMPTY_FOOD: FoodData = { log: [], foods: [] }
export const DIET_TRACKER = 'dieta'
export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
export const allFoods = (custom: Food[]) => [...custom, ...CATALOG]     // propios primero
export const foodById = (id: string, custom: Food[]) => allFoods(custom).find(f => f.id === id)
export const portion = (food: Food, qty: number): Nutrients          // valor·qty/100; kcal y macros a 1 decimal
export const isFoodUndo = (e: FoodLogEntry): e is FoodUndo => 'undoes' in e
export function liveEntries(log): FoodEntry[]                        // como liveSets
export const dayEntries = (log, day) => liveEntries(log).filter(e => e.occurredAt.startsWith(day))
export function dayTotals(log, day): FoodDay                         // suma; p/c/f ausentes cuentan 0; resultado a 1 decimal
export function undoEntries(log, ids: string[], newId): FoodUndo[]   // como undoMany
export function makeEntry(food: Food, p: Portion, id: string, occurredAt: string, via?: string): FoodEntry // instantánea: name, base, foodId, qty, serving, portion(food, qty)
export function quickEntry(i: { kcal: number; p?: number; c?: number; f?: number; name?: string }, id, occurredAt): FoodEntry // name por defecto «Añadido rápido», qty 0
export const fmtKcal = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
```
Parsers (coma o punto decimal, `trim`, `null` si no vale): `parseQty` (0, 2000], 1 decimal; `parseServings` 0.25..50, redondeo a 0.25; `parseKcal` entero 1..10000; `parseMacro` 0..1000, 1 decimal, vacío → `undefined`; `parsePct` entero 0..100.

### 7.2 Objetivo
```ts
export function goalOn(goals: FoodGoal[] = [], day: string): FoodGoal | null
// ordenados por from: el último con from ≤ day; si ninguno, el primero; sin objetivos → null
export function setFoodGoal(goals: FoodGoal[] = [], g: Omit<FoodGoal, 'from'>, today: string): FoodGoal[]
// sustituye la entrada con from === today o la añade; devuelve un array nuevo ordenado
export const macroGrams = (g: FoodGoal) => ({ p: r0(g.kcal*g.p/100/4), c: r0(g.kcal*g.c/100/4), f: r0(g.kcal*g.f/100/9) })
export const kcalRange = (kcal: number) => ({ min: Math.ceil(kcal*0.9 - 1e-9), max: Math.floor(kcal*1.1 + 1e-9) })
export function inRange(food: FoodData, day: string): boolean // goalOn existe y min ≤ round(dayTotals.kcal) ≤ max
```
Los % que propone el formulario la primera vez son P 20 / C 50 / G 30.

### 7.3 Dieta (en vivo)
```ts
export const dietAutoRe = (day: string) => new RegExp(`^dieta-auto-${day}(-\\d+)?$`)
export function dietSync(events: ActivityEvent[], food: FoodData, days: string[], today: string, newId: () => string): ActivityEvent[]
```
Para cada `day` único con `day ≤ today`, en orden y acumulando lo ya decidido en `[...events, ...out]`:
- **En rango** y `dayTotal(dieta, day) === 0` → `{ id: 'dieta-auto-<day>' | 'dieta-auto-<day>-<n>', trackerId: 'dieta', amount: 1, occurredAt: '<day>T12:00:00' }`, donde `n` = número de ids que casan con `dietAutoRe(day)` + 1, como en `autoSession`.
- **Fuera de rango** (o sin objetivo) → por cada automática viva del día (positiva, no deshecha), de la más reciente a la más antigua, un `{ amount: -1, undoes: auto.id, occurredAt: auto.occurredAt }` solo si `clampAmount(...) === -1`, como en `retractAuto`.
- Nada más. Lo manual no se toca. Es idempotente: `dietSync(events ⧺ out, …) = []`.

```ts
export const dietDays = (food: FoodData, events: ActivityEvent[]) => // días con alguna entrada del log (vivas o no) ∪ días con eventos dieta-auto-*; ordenados
export const dietActive = (food: FoodData, events: ActivityEvent[]) => (food.goals?.length ?? 0) > 0 || events.some(e => e.trackerId === DIET_TRACKER)
export const withDiet = (ts: Tracker[], active: boolean) => active ? ts : ts.map(t => t.id === DIET_TRACKER ? { ...t, archived: true } : t) // B1: derivado, no se persiste
```

**Cuándo se llama** (en `App.tsx`, siempre dentro del mismo guardado que el cambio):

| Acción | `days` | Efecto |
|---|---|---|
| Añadir entrada, añadido rápido o plato (día del selector, también pasado) | `[day]` | Si entra en rango: +1, con XP y toast normales. |
| Deshacer entrada(s) | días de las entradas deshechas | Si sale del rango: −1 (`undoes`), y puede bajar de nivel como cualquier deshacer. |
| Cambiar el objetivo | `dietDays(...)` (todos) | Los días pasados conservan su objetivo y no cambian (operación nula). Solo cambia hoy, o todos si es el **primer** objetivo (rige hacia atrás, T3). |
| «−»/«Deshacer» manual en la tarjeta Dieta o en «Hoy» | `[day]` | Si el día sigue en rango, se repone la automática: neto 0, sin XP ni toast (`push` ya lo trata). Igual que `ensureAuto`. |
| «+1 día» manual | — | No se llama. El manual se queda aunque el día salga de rango. |
| Importar / fusionar / recuperar | `dietDays(food, events)` | Repara todo: añade lo que falta y retira lo que sobra. |

En `add()` de App: `extra = t.id === DIET_TRACKER && amount < 0 ? dietSync([...events, ev], food, [day], today, uuid) : []`, paralelo al gym. En los handlers de comida: `const next = {...food, log: [...]}; setFood(next); const evs = dietSync(events, next, days, today, uuid); if (evs.length) push(evs, dietTracker())`.

### 7.4 Búsqueda, recientes y frecuentes
```ts
export function searchFoods(q: string, foods: Food[], n = 20): Food[]
```
`fold(q)` vacío → `[]`. Se excluyen los `archived`. La puntuación sobre `fold(name)` y `fold(alias)`:
- 0: igual al nombre o a un alias.
- 1: el nombre empieza por q.
- 2: cada palabra de q es prefijo de alguna palabra del nombre o de un alias.
- 3: el nombre o un alias contiene q.
- Si no se cumple nada, queda fuera.

Se ordena por puntuación y, a igualdad, por el orden de `foods` (propios primero).

```ts
export function recentFoods(log, n = 8): { foodId: string; last: Portion }[]          // foodIds distintos por última entrada viva (empate: la posterior en el log)
export function frequentFoods(log, today, n = 8): { foodId: string; last: Portion }[] // entradas vivas en [today−27, today]; nº desc, empate más reciente
export function lastPortion(log, foodId): Portion | null
```
En la UI se filtran los ids desconocidos y los propios archivados. El prerrelleno al elegir un alimento es `lastPortion ?? (servings?.[0] ? { qty: s.qty, serving: { name: s.name, n: 1 } } : { qty: 100 })`.

### 7.5 Ciclo 30
```ts
export function mealEntries(m: Meal, foods: Food[], newId, occurredAt): { entries: FoodEntry[]; missing: number } // ítems con foodId desconocido o archivado → missing; via 'meal'
export function mealFromEntries(entries: FoodEntry[], name: string, id: string): Meal | null // solo con foodId; orden dado; máximo 20; null si no queda ninguno
export function nameTaken(name: string, custom: Food[]): Food | 'catalog' | null            // fold; devuelve el propio (archivado → «Reactivar»)
export function foodWeekly(food: FoodData, today: string, n = 8): FoodWeek[]
// por semana lun–dom (la en curso, hasta today): days = días con ≥1 entrada viva; avg = suma/days (null si 0);
// goal = goalOn(goals, min(domingo, today))?.kcal ?? null; inRange = días de la semana con inRange()
```

### 7.6 Catálogo (`core/foodCatalog.ts`)
- Son 140 alimentos. Los valores por 100 g se toman de **USDA FoodData Central** (SR Legacy o Foundation; `source: 'usda'`, `ref: fdcId`). Los platos españoles que no están en FDC se toman de **BEDCA** (`source: 'bedca'`, `ref: código`). Ningún dato de MyFitnessPal. kcal en entero; p/c/f a 1 decimal.
- **Cómo se genera:** el implementer transcribe a mano cada fila desde la ficha FDC/BEDCA cuyo id pone en `ref`, contrastando con BEDCA los alimentos básicos. Cabecera del archivo: fuente, licencia (FDC: dominio público, CC0) y fecha de consulta.
- **Cómo se comprueba:** FD1 (coherencia) y, en la revisión, el reviewer contrasta 15 filas al azar con su `ref`.
- Raciones solo donde son obvias (huevo unidad 50 g, plátano 120 g, manzana 180 g, naranja 150 g, yogur 125 g, rebanada de pan de molde 25 g, vaso 250 ml, cucharada de aceite 13 g, lata de atún escurrida 52 g…). Alias ES solo para sinónimos claros (patata/papa, plátano/banana, judías verdes/vainas).
- Lista (id → nombre). Base `ml` para leches, bebida de soja, kéfir, zumo, refrescos y gazpacho; el resto en `g`.
  - **Cereales (16):** rice-white-cooked Arroz blanco cocido; rice-white-raw Arroz blanco crudo; rice-brown-cooked Arroz integral cocido; pasta-cooked Pasta cocida; pasta-raw Pasta cruda; bread-white Pan blanco; bread-wholemeal Pan integral; bread-sliced Pan de molde; oats Copos de avena; corn-flakes Cereales de maíz; wheat-flour Harina de trigo; quinoa-cooked Quinoa cocida; couscous-cooked Cuscús cocido; tortilla-wrap Tortilla de trigo; crispbread Biscotes; rice-cakes Tortitas de arroz.
  - **Patatas y legumbres (10):** potato-boiled Patata cocida; potato-raw Patata cruda; sweet-potato-baked Boniato asado; potato-chips Patatas fritas de bolsa; french-fries Patatas fritas; lentils-cooked Lentejas cocidas; chickpeas-cooked Garbanzos cocidos; white-beans-cooked Alubias blancas cocidas; peas-cooked Guisantes cocidos; hummus Hummus.
  - **Verduras (16):** lettuce Lechuga; tomato Tomate; onion Cebolla; red-pepper Pimiento rojo; green-pepper Pimiento verde; carrot Zanahoria; broccoli Brócoli; spinach Espinacas; zucchini Calabacín; eggplant Berenjena; cucumber Pepino; mushrooms Champiñones; green-beans Judías verdes; cauliflower Coliflor; asparagus Espárragos verdes; corn-sweet Maíz dulce.
  - **Frutas (17):** apple Manzana; banana Plátano; orange Naranja; mandarin Mandarina; strawberry Fresa; grapes Uva; pear Pera; peach Melocotón; pineapple Piña; watermelon Sandía; melon Melón; kiwi Kiwi; blueberries Arándanos; mango Mango; avocado Aguacate; cherries Cerezas; raisins Pasas.
  - **Carnes (15):** chicken-breast-raw Pechuga de pollo cruda; chicken-breast-grilled Pechuga de pollo a la plancha; chicken-thigh Muslo de pollo; turkey-breast Pechuga de pavo; beef-mince Carne picada de ternera; beef-steak Filete de ternera; pork-loin Lomo de cerdo; pork-ribs Costillas de cerdo; beef-burger Hamburguesa de ternera; serrano-ham Jamón serrano; cooked-ham Jamón cocido; chorizo Chorizo; frankfurter Salchicha tipo frankfurt; bacon Bacon; turkey-slices Fiambre de pavo.
  - **Pescado y marisco (12):** salmon Salmón; hake Merluza; tuna-water Atún al natural; tuna-oil Atún en aceite escurrido; sardines-oil Sardinas en aceite; cod Bacalao; prawns Gambas; mussels Mejillones; squid Calamar; sea-bass Lubina; sea-bream Dorada; surimi Surimi.
  - **Huevos y lácteos (18):** egg Huevo; egg-white Clara de huevo; milk-whole Leche entera; milk-semi Leche semidesnatada; milk-skim Leche desnatada; yogurt-plain Yogur natural; yogurt-greek Yogur griego; yogurt-skim Yogur desnatado; fresh-cheese Queso fresco; manchego Queso manchego curado; mozzarella Mozzarella; gouda Queso en lonchas; cottage Requesón; butter Mantequilla; cream-cooking Nata para cocinar; kefir Kéfir; soy-drink Bebida de soja; whey Proteína whey en polvo.
  - **Grasas, frutos secos y semillas (11):** olive-oil Aceite de oliva; sunflower-oil Aceite de girasol; almonds Almendras; walnuts Nueces; peanuts Cacahuetes; peanut-butter Crema de cacahuete; cashews Anacardos; sunflower-seeds Pipas de girasol; chia Semillas de chía; olives Aceitunas; mayonnaise Mayonesa.
  - **Dulces, platos y bebidas (25):** sugar Azúcar; honey Miel; dark-chocolate Chocolate negro 70 %; milk-chocolate Chocolate con leche; maria-cookies Galletas María; croissant Cruasán; muffin Magdalena; jam Mermelada; ice-cream Helado de vainilla; cocoa-drink-powder Cacao soluble; pizza Pizza margarita; spanish-omelette Tortilla de patatas (BEDCA); gazpacho Gazpacho (BEDCA); paella Paella (BEDCA); lentil-stew Lentejas estofadas (BEDCA); ketchup Kétchup; tomato-sauce Tomate frito; orange-juice Zumo de naranja; cola Refresco de cola; cola-zero Refresco de cola sin azúcar; coffee Café solo; protein-bar Barrita de proteínas; granola Granola; popcorn Palomitas; dates Dátiles.
  - En total, 140. Si una fila no pasa FD1 con los datos de la fuente, se quita y se apunta en el commit, sin forzar los valores.

## 8. UI

**Navegación (ciclo 29)**
- `Screen` incluye `'food'`. En `App`, `focusGym: boolean` pasa a `focusCard: 'gym' | 'food' | null` y `gymFrom` pasa a `moduleFrom: 'me' | 'home'`, compartido por los dos módulos.
- `openFood(from)` funciona como `openGym`. En `backFromFood`, si se vino de `home`, `focusHoy`; si no, `focusCard = 'food'` y se va a `me`.
- BottomNav: «Yo» queda activa con `gym | food`. UpdateBanner usa tono `hero` en `food`.
- **«Yo»:** tarjeta «Comida» debajo de Gym, con el mismo estilo, icono `Utensils` y subtítulo «Calorías, macros y objetivo».
- **«Hoy»:** fila en el mismo `ul` que la de Gym, visible si hay objetivo o entradas hoy.
  - Con objetivo: `Comida · 1.640 / 2.200 kcal`. Sin objetivo: `Comida · 1.640 kcal`.
  - Abre Comida con `moduleFrom = 'home'`.
  - HomeView recibe `foodToday: { kcal: number; goal: number | null } | null` y `onOpenFood`.

**FoodView (paleta HERO, `bg-hero-bg`, tarjetas `bg-hero-surface border-hero-border`)**, de arriba a abajo:
1. Cabecera: «Volver», `h1` «Comida» y `DayPicker` (`tone="hero"`, sin futuro). Con `saveFailed`, `SaveFailBanner tone="hero"`.
2. **Totales del día:** `1.640 / 2.200 kcal`, `ProgressBar` (máx. 100 %) y una línea de estado.
   - Sin objetivo: «Sin objetivo de calorías».
   - Por debajo del rango: «Te faltan N kcal para el rango (1.980–2.420)».
   - En rango: «Dentro del objetivo: cuenta en Dieta».
   - Por encima: «Te has pasado N kcal del rango».
   - Debajo, los macros `P 95/110 g · C 180/275 g · G 60/73 g` (sin objetivo, solo los gramos). Sin colores de error (no hay token): texto `text-hero-text` + icono.
3. **FoodGoalCard:** sin objetivo, se abre en modo edición con el texto «Fija tu objetivo de calorías: los días dentro del 90–110 % cuentan en Dieta.».
   - Campos: kcal (`inputMode="numeric"`) y P/C/G en %, con los gramos derivados en vivo.
   - Error en línea `Los porcentajes suman X %; tienen que sumar 100.` o `Entre 800 y 10.000 kcal.`
   - Guardar → `setFoodGoal(goals, g, today)`, con el aviso «El nuevo objetivo rige desde hoy; los días anteriores conservan el suyo.» (salvo si es el primero).
4. **FoodAdd:**
   - Buscador `type="search"` con etiqueta visible «Buscar alimento» y hasta 20 resultados como lista de botones (nombre + `kcal/100 g`).
   - Con la búsqueda vacía, `Segmented` «Recientes | Frecuentes» (8 cada uno). Si están vacíos: «Aún no has apuntado alimentos.».
   - Sin resultados: «Sin resultados para «x». Apunta las calorías con «Añadido rápido».».
   - Al elegir un alimento sale el **panel de cantidad**: nombre, cantidad (prerrellenada §7.4), selector de unidad (`g`/`ml` + raciones del alimento; con ración, la cantidad es el nº de raciones y se muestra «= 120 g»), vista previa `195 kcal · P 4 · C 42 · G 0,4`, y los botones «Añadir» y «Cancelar».
   - **Añadido rápido** (botón que despliega): kcal (obligatorio), P/C/G opcionales, nombre opcional y «Añadir».
   - Tras añadir: la búsqueda se vacía, el foco vuelve al buscador y el estado (`role="status"`) dice `Añadido: Arroz blanco cocido 150 g (195 kcal)`. Si Dieta cambió: `… · Día dentro del objetivo: +1 Dieta` o `… · Fuera del rango: se retira el +1 de Dieta`.
5. **Diario** (`h2` «Diario»): entradas vivas del día en orden de `occurredAt`, cada una con nombre, porción (`150 g`, `2 Huevo (100 g)`, o nada en el añadido rápido), kcal y un botón «Deshacer» (`aria-label="Deshacer <nombre> <kcal> kcal"`). Vacío: «Nada apuntado este día.». Al deshacer, el foco pasa a la siguiente fila o al `h2`, y se anuncia en el estado.

**Ciclo 30**
- **Alimentos propios:** en FoodAdd, «Crear alimento» (también desde «Sin resultados», prerrellenando el nombre).
  - Campos: nombre, base g/ml, kcal/P/C/G por 100 y hasta 5 raciones (nombre + cantidad).
  - Validación: rangos de §5. Si P+C+G > 100 → «Los macros suman más de 100 g por 100 g.». Si `nameTaken` → «Ya existe» (y «Reactivar» si está archivado).
  - Al guardar se abre su panel de cantidad. En los resultados, los propios llevan «Archivar»; los archivados se reactivan desde «Crear» con el mismo nombre (como los ejercicios).
- **Platos** (`FoodMeals`, tarjeta «Platos»): «Guardar como plato» lista las entradas del día con alimento (casillas, ninguna marcada), nombre y «Guardar» (como máximo 20 platos).
  - Cada plato muestra la lista de alimentos con su kcal total actual, «Añadir» (un toque: `mealEntries` → entradas al día del selector, `via: 'meal'`) y «Borrar».
  - Tras añadir, el aviso trae «Deshacer» para todas sus entradas (`undoEntries`). Si faltan alimentos: «N alimentos del plato ya no existen y no se han añadido».
- **Resumen semanal** (`FoodWeek`, tarjeta «Semana»):
  - Esta semana: media kcal/P/C/G por día con registros frente al objetivo, días con registro y días en rango (`5 días · 4 en rango`).
  - Gráfico SVG propio de 8 barras (media kcal por semana), con una marca horizontal del objetivo de cada semana y la semana en curso con borde discontinuo, como Progreso del gym: `aria-hidden` + `ul.sr-only` («Semana del 28 sept: media 1.950 kcal en 5 días · objetivo 2.200 · 4 en rango»). Sin datos: «Aún no hay semanas con registros.».

## 9. Backlog

Un commit por tarea. Cada tarea termina con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.

### Ciclo 29 — núcleo usable (rama `cycle-29`)

**T1. Tipos, catálogo y núcleo puro.**
- Archivos: `types.ts`, `core/foodCatalog.ts`, `core/food.ts` (§7.1, 7.2, 7.4 y `fold`; sin Dieta) y `selfcheck.ts`.
- Criterios: FD1-FD5, FD12, FD13 y FD17 pasan; los asserts existentes no cambian.

**T2. Tracker Dieta y `dietSync`.**
- Archivos: `trackers.ts` (Dieta al final + `SINGULAR`), `food.ts` (§7.3) y `selfcheck.ts`.
- Criterios: FD6-FD8 y FD16 pasan. Cambian **solo** los asserts de §11.2, y el commit explica por qué.

**T3. Persistencia.**
- Archivos: `storage.ts` (§6.1-6.3) y `storage.test.ts`.
- Criterios: FD9 y FD10. `storage.test.ts` cubre la clave corrupta → backup + aviso, la clave bloqueada, que `backupCurrent`/`restoreLast` incluyen `FOOD_KEY` y que una copia sin `food` → `null`.

**T4. Fusión.**
- Archivos: `merge.ts` (§6.4) y `selfcheck.ts`.
- Criterios: FD11, y M1-M8 sin cambios.

**T5. Cableado en App** (sin pantalla todavía).
- Estado `food` y efecto de guardado con `unsaved.food`.
- `onStorage`, `hasData` (+ log, foods, goals y meals), `reset`, `exportData` (pasa `food`), `importData`/`mergeData`/`restore` con textos de §6.3 y `withAutos`.
- `trackers = withDiet(allTrackers(...), dietActive(food, events))`.
- Handlers `addFoodEntry(food, portion, day)`, `addQuick(input, day)`, `undoFood(ids)` y `saveFoodGoal(g)`, cada uno con `dietSync` (§7.3). `add()` aplica la reposición de Dieta.
- Criterios: la app arranca igual con datos existentes (sin `life-rpg-food-v1`), Dieta no se ve y los tests actuales pasan.

**T6. FoodView, FoodGoalCard y FoodAdd** (§8, puntos 1-5).
- Criterios:
  - Apuntar «arroz 150 g» y «1000 kcal» en hoy y en un día pasado.
  - Deshacer.
  - Fijar el objetivo y ver el +1 de Dieta en vivo con su toast, y la retirada al pasarse.
  - Recientes/frecuentes con la última cantidad.
  - Ningún componente pasa de ~250 líneas.

**T7. Navegación.**
- Archivos: `BottomNav`, `MeView` (tarjeta Comida, `focusCard`), `HomeView` (fila «Hoy») y `App` (`openFood`/`backFromFood`).
- Criterios: «Volver» devuelve el foco a la tarjeta de «Yo» o a «Hoy», según el origen.

**T8. Tests.**
- Archivos: `App.test.tsx` (U-FD1…U-FD8), `a11y.test.tsx` (FoodView vacía, con entradas y con resultados) y `e2e/food.e2e.ts` (§11.3).

**T9. Documentación.**
- `ESTADO-ACTUAL.md`: fila «Comida», detalles de §6/§7 y deuda.
- `CLAUDE.md` y `AGENTS.md`: `food.ts`, `foodCatalog.ts`, `FOOD_KEY` y Dieta.
- `docs/cycles/STATE.md`: estado.

### Ciclo 30 — propios, platos y resumen (rama `cycle-30`)

- **T1. Núcleo:** `mealEntries`, `mealFromEntries`, `nameTaken` y `foodWeekly` (§7.5), con FD14 y FD15.
- **T2. Alimentos propios** (`FoodCustom.tsx` y handlers `createFood`/`setFoodArchived` en App).
  - Criterios: crear, archivar y reactivar; nombre único frente al catálogo y los propios; el propio aparece en la búsqueda primero.
- **T3. Platos** (`FoodMeals.tsx` y handlers `saveMeal`/`deleteMeal`/`addMeal`, con `dietSync` del día).
  - Criterios: añadir con un toque, deshacer todo, aviso de alimentos que faltan y máximo de 20 platos.
- **T4. Resumen semanal** (`FoodWeek.tsx`).
  - Criterios: media sobre días con registros y lista `sr-only` equivalente al gráfico.
- **T5. Tests UI/a11y/e2e** (U-FD9…U-FD12, axe en las tres tarjetas, e2e de plato).
- **T6. Documentación**, igual que en el T9 del ciclo 29.

## 10. Riesgos

| Riesgo | Prevención | Recorte si se complica |
|---|---|---|
| Valores del catálogo inventados o mal transcritos. | `ref` obligatorio, FD1 y muestreo de 15 filas por el reviewer. | Bajar a ~100 filas (las básicas) antes que dejar datos sin fuente. |
| El +1 de Dieta parpadea (entra y sale del rango) y el toast molesta. | Es la regla F8. `push` con neto 0 no anima nada. | Ninguno: es lo aprobado. |
| Retiradas silenciosas de Dieta al importar o fusionar (bajada de nivel sin explicación). | `setToast(null)` como en el gym. El aviso de la fusión ya dice que se reevalúan los días. | — |
| `App.tsx` crece todavía más. | Los handlers son finos: toda la lógica está en `food.ts`. | `ponytail:` extraer un hook `useFood` cuando pase de ~550 líneas. |
| Cuota de localStorage: unos 200 B por entrada, ~10 al día → ~0,7 MB al año. | `ponytail:` en `saveFood` (límite de ~5 años junto al resto). El fallo ya se avisa con `SaveFailBanner`. | — |
| Asserts que dependen de `TRACKERS`. | Dieta al final; solo cambian los de §11.2. | — |
| Ciclo 29 demasiado grande. | Tareas independientes y desplegables. | Llevar recientes/frecuentes (parte de T6) al ciclo 30. |

## 11. Verificación

### 11.1 Asserts nuevos (`selfcheck.ts`, bloque «Comida», con `DEMO_DATE` como hoy)
- **FD1 catálogo:** 100 ≤ n ≤ 150; ids únicos que casan con `/^[a-z0-9-]+$/` y no empiezan por `food-`; nombres únicos tras `fold`; todos los valores finitos ≥ 0; `kcal ≤ 900`; `p+c+f ≤ 100`; `|kcal − (4p+4c+9f)| ≤ max(20, 0.12·kcal)`; `source ∈ {usda, bedca}` con `ref` no vacío (usda → `/^\d+$/`); raciones con qty > 0 y nombres únicos por alimento.
- **FD2 `portion`/`makeEntry`:** 150 g de un alimento de 130 kcal → 195; 2 raciones de 50 g → qty 100; la instantánea conserva name/foodId/base.
- **FD3 `dayTotals`:** suma solo lo vivo; un deshecho no cuenta; un añadido rápido sin macros suma 0 en p/c/f; otro día no cuenta.
- **FD4 `goalOn`/`setFoodGoal`:** el primero rige hacia atrás; el cambio rige desde su `from`; el mismo día lo sustituye; no muta.
- **FD5 `kcalRange`:** 2200 → [1980, 2420]; 1990 → [1791, 2189]; 2000 → [1800, 2200]; `inRange` en los bordes (1800 y 2200 sí; 1799 y 2201 no).
- **FD6 `dietSync` añadir:** en rango y sin Dieta → exactamente `dieta-auto-D` a las 12:00; aplicado otra vez → `[]`; con un +1 manual → `[]`; día futuro → `[]`.
- **FD7 retirar:** fuera de rango → retira solo las automáticas vivas (la manual se queda); tras retirar y volver a entrar → `dieta-auto-D-2`; `«−»` manual de la automática con el día en rango → se repone (neto 0).
- **FD8 cambio de objetivo:** con eventos coherentes, `setFoodGoal` hoy + `dietSync(dietDays)` solo produce eventos en hoy; el primer objetivo produce los de los días pasados en rango.
- **FD9 `readFood`:** datos válidos → `dropped 0, fixed 0` y salida idéntica; los campos desconocidos se conservan (arriba, `source:'off'` en el alimento, `via:'voice'` en la entrada); entradas no válidas descartadas; una ración mala se quita (`fixed`); un objetivo con % que no suman 100 se descarta; ids de alimento/plato repetidos se descartan; clave no objeto → `null`.
- **FD10 copias:** ida y vuelta de `exportBackup`/`parseBackup` con `food`; sin `food` → `food: null`; `food` ilegible → copia `null`.
- **FD11 fusión:** idempotente; colisión de id → `id~2` con `undoes` reasignado; conflicto de alimento, plato u objetivo → gana el local y se avisa; copia sin `food` → lo local intacto; `changed` cuando solo se añaden objetivos.
- **FD12 `searchFoods`:** «platano» → Plátano; «papa» (alias) → Patata; orden exacto > prefijo > palabras > contiene; archivados fuera; `''` → `[]`; máximo n.
- **FD13 recientes/frecuentes:** distintos, por fecha y por número; deshechos fuera; ventana de 28 días; `lastPortion` con ración.
- **FD14 (c30) platos:** `mealEntries` con ids desconocidos → `missing`; `via: 'meal'`; `mealFromEntries` ignora los añadidos rápidos.
- **FD15 (c30) `foodWeekly`:** media sobre días con registros; semana en curso hasta hoy; objetivo vigente; `inRange` por días.
- **FD16 `withDiet`/`dietActive`:** inactivo → Dieta `archived` sin mutar `TRACKERS`; activo con objetivo o con eventos.
- **FD17 parsers y `fmtKcal`:** «150,5» → 150.5; 0 y 2001 → null; `fmtKcal(1640)` = `1.640`; `fmtKcal(999)` = `999`.

### 11.2 Asserts que cambian (por la regla nueva «tracker fijo Dieta»)
- **G1:** `allTrackers([]).length === 6` → `7`.
- **«orden por uso: seed»:** se antepone `dieta` (sin uso → primero): `'dieta,gym,bjj,running,reading,beer,burgers'`.
- **«orden por uso: sin uso primero…»:** `'dieta,custom-meditar,burgers,gym,bjj,running,reading,beer'`.
- **P1** sigue pasando gracias a `SINGULAR['días'] = 'día'`.
- Si falla cualquier otro assert, se arregla el código, no el assert.

### 11.3 Tests
- **UI (`App.test.tsx`):**
  - U-FD1: «Yo» → Comida → «Volver» con el foco en la tarjeta.
  - U-FD2: buscar «arroz», elegir y añadir 150 g → diario y estado.
  - U-FD3: añadido rápido de 1000 kcal.
  - U-FD4: objetivo 2000 + 1900 kcal → Dieta +1 en HERO; deshacer → se retira.
  - U-FD5: fila «Hoy» `1.900 / 2.000 kcal` → abre Comida → «Volver» con el foco en «Hoy».
  - U-FD6: día pasado con el selector.
  - U-FD7: exportar/importar con comida y copia antigua sin comida (texto de confirmación).
  - U-FD8: Dieta oculta sin objetivo.
  - Esperar el guardado con `vi.waitFor`.
- **a11y:** axe sin violaciones en FoodView vacía, con entradas y con resultados de búsqueda.
- **e2e (`food.e2e.ts`):** a 320 px, desde «Yo» → Comida, fijar objetivo, añadido rápido y alimento del catálogo; la fila «Hoy» muestra las kcal; sin desbordamiento horizontal; recargar conserva el diario.

### 11.4 Checklist manual
- Recargar conserva diario, objetivo y Dieta.
- Clave `life-rpg-food-v1` corrupta → aviso + `.backup.<stamp>`.
- Fusionar dos copias con la misma comida → «no trae nada nuevo».
- «Recuperar copia anterior» tras «Borrar todo» devuelve la comida.
- iPhone: teclado numérico en las cantidades y el panel de cantidad visible con el teclado abierto.
- Contraste de la línea de estado del rango.

## 12. Handoff para Claude Code

1. Esperar el okay del usuario a las decisiones A-E (§3). La spec asume A1, B1, C1, D1 y E1.
2. Rama `cycle-29` desde `main`. Ejecutar T1-T9 en orden, con un commit por tarea y build/lint/test en verde en cada una.
3. No tocar `gym.ts`, `rpg.ts`, `stats.ts` ni `party.ts`. Dieta reutiliza `dayTotal`, `clampAmount` y `undoneIds` de `stats.ts`.
4. Catálogo: no inventar valores. Cada fila lleva su `ref` real, y si una fila no pasa FD1 con los datos de la fuente, se quita.
5. Ningún dato en `localStorage` existente cambia de formato. La única clave nueva es `life-rpg-food-v1`.
6. Al cerrar el ciclo 29, merge `--no-ff` y push. El ciclo 30 empieza desde `main` con la misma spec (§9, ciclo 30).
