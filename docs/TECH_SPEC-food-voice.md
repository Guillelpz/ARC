# TECH SPEC — Comida fase 3: registro por voz (ciclos 36-38)

Fuente del qué: `docs/cycles/STATE.md` § «Ciclos 36+ — Comida fase 3: voz» (FV1-FV6 y valores por defecto; no se reabren). Base: `docs/cycles/cycle-35/analysis.md` (huecos), código a 2026-10-15 (tras ciclo 35).

## 1. Resumen

- Se construye: un **parser determinista de comida ES/EN** en `core/foodVoice.ts` (cantidades, unidades, raciones, «N kcal», varios alimentos por frase, catálogo + propios con alias EN y plurales), su integración en la **captura general** (`routeCapture`, solo hoy), el **guardado de varias entradas con un único «Deshacer»** y Dieta en vivo, «Apuntar también en Comida» en el choque con un hábito (FV4), Comida **prerrellenada** cuando falta algo, el botón **«Dictar» en Comida** (día del selector) y, al final, **Haiku** (varios alimentos, estimación de desconocidos con «Estimación», ración típica a confirmar) con **O3/O1** extendidos a comida.
- No se construye: comidas separadas (desayuno/cena), copiar día, fechas («el 3 de octubre»), aprendizaje de alias (O2), buscador de Comida con alias EN, cambios en `rpg.ts`/`stats.ts`, dependencias nuevas.
- Tres ciclos: **36** parser + captura sin IA; **37** «Dictar» en Comida sin IA; **38** Haiku + memoria. Cada uno deja la app desplegable; sin clave todo funciona desde el 36.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Alias EN, genéricos y raciones habladas | Tabla aparte `core/foodAliases.ts` (`VOICE_ALIASES: Record<catalogId, string[]>`, `SERVING_WORDS`). Las 188 filas de `foodCatalog.ts` no se tocan. | FD1 e ids intactos; FD12 (orden de `searchFoods`) intacto: añadir «arroz» como alias en el catálogo lo rompe. |
| Plurales | Se derivan al comparar (`pluralEq`), no se guardan. | Sin duplicar datos; cubre catálogo y propios. |
| Coincidencia | Solo exacta por términos (nombre, alias del catálogo/propio, `VOICE_ALIASES`) con plurales; el término más largo gana; sin erratas. | Determinista; lo aproximado va a Haiku (como O3). |
| Varios por frase | Separadores `y`, `and`, `,`, `;` fuera de un término («Crema de cacao y avellanas» es uno). Un tramo = un alimento salvo que otro término lleve su propia cantidad. | FV2; evita partir «arroz con leche» en dos registros. |
| Orden en `routeCapture` | otro día > gym > hábito con coincidencia **exacta** (+ comida adjunta, FV4) > comida (término o «kcal») > hábito aproximado > comida desconocida (verbo de comer o g/ml) > hábito nuevo. | FV4 «se apunta el hábito como hoy»; la comida gana a las erratas («2 peras» ya no cae en Gym por «pesas», «beef» no cae en Beer). |
| Unidades de comida en `UNIT_WORDS.other` | Se añaden (g, gramos, ml, cl, l, litros, kcal, calorías…; «kg» ya estaba). | `memoKey` las quita; un hábito de veces no apunta «200 g» como 200 unidades (hoy lo hace). |
| Cantidad de un hábito en el choque FV4 | Se calcula sin las medidas de comida (g/ml/kcal). | «hamburguesa 200 g» → Burgers +1 y 200 g en Comida. |
| Dos guardados de XP | Nunca dos `push` (App) en el mismo manejador: `push` usa `events` del cierre y el segundo pisa al primero. Todo lo de comida va en **un** `setFood` + **un** `dietSync`. | Bug latente si se combinan hábito y comida en un toque. |
| Haiku | Un único esquema de captura ampliado con `foods[]` (no una segunda llamada). Haiku devuelve **nombres**, no ids: el cliente los resuelve con el mismo matcher. El catálogo no va en el prompt. | Una sola latencia; prompt pequeño; el catálogo sigue siendo la fuente de las kcal. |
| Estimación (FV3) | Solo la produce Haiku; nunca `ready`; se guarda al confirmar. Sin «propio» → entrada tipo añadido rápido con macros; con «propio» → `Food` propio `source: 'estimate'` + entrada normal. | FV3; sin cambios de formato. |
| `via` | Las entradas por voz llevan `via: 'voice'` (campo ya previsto en `FoodEntry`). | Sin migración. |
| Memoria O1 | Solo frases de **un** alimento resuelto por Haiku y guardado solo. `MemoEntry.kind` admite `'food'`. | El `id` cabe en 100 caracteres; las de varios alimentos no se aprenden (`ponytail:`). |
| Dos shells de micro | `FoodVoiceLog.tsx` copia el patrón de `VoiceLog.tsx` (privacidad, escucha, campo de texto, callbacks por ref). | `ponytail:` unificar en un hook si aparece un tercero. |

## 3. Decisiones que requieren aprobación

Ver la sección final (§13): solo lo no cubierto por FV1-FV6 y los valores por defecto.

## 4. Impacto en el código

**Nuevos**
- `app/src/core/foodAliases.ts` — `VOICE_ALIASES` (EN de los 188 + genéricos ES), `SERVING_WORDS`, `GENERIC_SERVING`.
- `app/src/core/foodVoice.ts` — parser y lógica pura de comida por voz (§7).
- `app/src/components/FoodVoiceCard.tsx` — filas del resultado (registrado / a confirmar / pendiente / sin reconocer) y acciones; lo usan la captura y Comida.
- `app/src/components/FoodPending.tsx` — tarjeta «Por voz: pendiente» en Comida.
- `app/src/components/FoodVoiceLog.tsx` (ciclo 37) — micro + «Escribir» de Comida.
- `app/e2e/food-voice.e2e.ts`.

**Modificados**
- `core/capture.ts` — `kind: 'food'`, `food?` en `tracker`, orden de `routeCapture`, `deviceSure`/`isReady`, unidades de comida, `captureFromAI` con `foods`, `pickCapture`.
- `core/classify.ts` — exportar `exactHits(norm, trackers, skip): Tracker[]` (lo usa `exactTracker`, sin cambiar su resultado).
- `core/memory.ts` — `kind: 'food'` en `learn`/`recall`/`readMemo`.
- `core/haiku.ts` — `foodItemSchema`, `captureSchema` + `foods`, `CAPTURE_SYSTEM` ampliado, `FOOD_SYSTEM`/`foodSchema`/`askFood`/`interpretFood`, `max_tokens`.
- `core/food.ts` — `quickEntry` acepta `via` opcional (4º parámetro).
- `core/off.ts` — `FoodDraft.source: 'off' | 'label' | 'estimate'`.
- `src/useFood.ts` — `addVoice`, `undoVoice`.
- `App.tsx` — `foodPrefill`, `openFoodWith`, callbacks de comida para `CaptureView` y `FoodView`, `foods` en el `CaptureCtx`.
- `components/CaptureView.tsx`, `CaptureCards.tsx` (`TrackerResult` + «Apuntar también en Comida»), `FoodView.tsx`, `FoodAdd.tsx` (prop `open`), `FoodCustom.tsx` (chip «Estimación»).
- `core/selfcheck.ts` (FVZ1-FVZ17; CV9 cambia), `core/haiku.test.ts`, `App.test.tsx`, `a11y.test.tsx`.
- Docs: `docs/ESTADO-ACTUAL.md`, `CLAUDE.md`/`AGENTS.md` (módulos de `core/`), `docs/DEPLOY.md` (checklist iPhone).

## 5. Modelos de datos

Sin cambios en tipos persistidos salvo `MemoEntry.kind` (caché) y el valor `'estimate'` en `Food.source` (ya admitido: string ≤ 20).

```ts
// core/foodVoice.ts
export const MAX_FOOD_ITEMS = 8
export type FoodQty = { n: number; unit: 'g' | 'ml' | 'serving' | null; word: string } // g/ml ya convertidos (kg ×1000, l ×1000, cl ×10); serving = nº de raciones; null = número sin unidad
export type FoodProblem = 'missing' | 'range' | 'unit' | 'guess' // guess = ración típica propuesta por Haiku (confirmar)
export type FoodItem =
  | { k: 'food'; said: string; foodId: string; qty: FoodQty | null; portion: Portion | null; problem: FoodProblem | null }
  | { k: 'quick'; said: string; kcal: number; name: string }                                  // «500 kcal»
  | { k: 'estimate'; said: string; draft: Omit<Food, 'id'>; portion: Portion }                 // solo Haiku; nunca se guarda sola
  | { k: 'pending'; said: string; query: string; ids: string[]; qty: FoodQty | null }        // ids ≥ 2 ambiguo; [] desconocido
export type FoodParse = { items: FoodItem[]; rest: string }  // rest = palabras de contenido sin reconocer ('' si ninguna)
export type VoiceAdd = { food: Food; portion: Portion } | { quick: { kcal: number; name: string } } | { estimate: Omit<Food, 'id'>; portion: Portion; own: boolean }

// core/capture.ts
export type CaptureCommand =
  | VoiceCommand
  | Src & { kind: 'tracker'; trackerId: string; amount: number | null; said: Measure | null; problem: Problem | null; food?: FoodItem[] } // food = FV4
  | Src & { kind: 'food'; items: FoodItem[]; rest: string }
  | /* new, other-day, unknown sin cambios */
export type CaptureCtx = { /* …igual… */ foods?: Food[] } // propios (también archivados); ausente = []

// core/memory.ts
export type MemoEntry = { k: string; kind: 'gym' | 'tracker' | 'food'; id: string }

// App.tsx (no persistido)
type FoodPrefill = { heard: string; items: FoodItem[] }
```

## 6. Persistencia y migración

- `life-rpg-food-v1`: mismo formato. Entradas nuevas con `via: 'voice'`; propios desde estimación con `source: 'estimate'`. `readFood` ya admite ambos (campos desconocidos se conservan; `source` ≤ 20). Copias, fusión, backups y `restoreLast` sin cambios.
- `life-rpg-capture-memo-v1`: sigue en `v: 1`; `readMemo` acepta `kind: 'food'`. Una versión anterior de la app descarta esas entradas (es caché: sin pérdida de datos de usuario).
- No hay migración. Ningún derivado se guarda (Dieta sigue saliendo de `dietSync`).

## 7. Lógica de dominio

### 7.1 `foodAliases.ts`
- `VOICE_ALIASES[id]`: (a) **EN**: ≥ 1 nombre común inglés para **cada** uno de los 188 ids (a partir de la descripción USDA de su `ref`: `'rice-white-cooked': ['rice', 'white rice', 'cooked rice']`, `'rice-white-raw': ['raw rice', 'uncooked rice']`, `'egg': ['egg']`, `'milk-semi': ['milk', 'semi skimmed milk']`…); (b) **genéricos ES** solo donde el catálogo tiene variantes y una es claramente la habitual en un plato (decisión A1): `arroz`→`rice-white-cooked`, `arroz integral`→`rice-brown-cooked`, `pasta`→`pasta-cooked`, `pan`→`bread-white`, `patata`→`potato-boiled`, `lentejas`/`garbanzos`/`alubias`→cocidas, `pollo`/`pechuga de pollo`/`pollo a la plancha`→`chicken-breast-grilled`, `pavo`→`turkey-breast`, `hamburguesa`→`beef-burger`, `leche`→`milk-semi`, `yogur`→`yogurt-plain`, `aceite`→`olive-oil`, `cafe`→`coffee`, `coca cola`/`cola`→`cola`, `salsa de tomate`→`tomato-sauce`, `queso gouda`/`gouda`→`gouda`, `avena`→`oats`, `cereales`→`corn-flakes`, `helado`→`ice-cream`. Sin genérico donde no hay uno claro (`jamon`, `atun`, `queso`, `tortilla`): caen en «pendiente» y se abre el buscador.
- Reglas (assert FVZ3): claves ⊂ ids del catálogo; cada id con ≥ 1 alias; 1-40 caracteres; normalizados (`foodNorm`) únicos en toda la tabla y distintos del nombre o alias del catálogo de **otro** alimento. Los alias compartidos que ya existen en el catálogo (`papa`, `papas fritas`) no se tocan: quedan ambiguos.
- `SERVING_WORDS: Record<string, string>` palabra → primera palabra (normalizada) del nombre de la ración: `vaso/vasos/glass/glasses→vaso`, `lata/latas/can/cans→lata`, `rebanada(s)/slice(s)→rebanada`, `cucharada(s)/tablespoon(s)/tbsp→cucharada`, `taza(s)/cup(s)→taza`. `GENERIC_SERVING`: `racion(es) porcion(es) serving(s) portion(s) unidad(es) pieza(s) piece(s)` → primera ración del alimento.

### 7.2 `foodVoice.ts` — parser
1. **`foodNorm(text)`**, en este orden: `normalizeText` → `(\d),(\d)`→`$1.$2` → `[,;]`→` y ` → `normalizeVoice` (números en palabra, «un/una/uno»→1, separa «200g», respeta «treinta y cinco») → «N [unidad] y medio/y media/and a half» → N+0,5 → `media docena`→6, `1 docena`/`docena`/`a dozen`→12 → `1 cuarto (de)`/`a quarter (of)`→0.25 → `medio|media|half( a| an)?`→0.5. Se aplica igual a frases y a términos.
2. **Términos** (`foodTerms(own)`, memorizado por referencia de `own`): propios activos (nombre + `aliases`) primero, después catálogo (nombre + `aliases` + `VOICE_ALIASES`). Un término con varios ids: si uno es propio gana el propio; si no, queda ambiguo.
3. **`pluralEq(a, b)`**: `a === b` o uno es plural del otro: `+s`, `+es`, `z→ces`, `y→ies` («nuez/nueces», «arroz/arroces», «cherry/cherries», «huevo/huevos», «tomate/tomates»). Se compara palabra a palabra en términos de varias palabras.
4. **`findFoods(tokens, terms)`**: de izquierda a derecha, el término más largo (en palabras) que encaje, sin solapes.
5. **Tramos**: se parte por `y`/`and` fuera de un término. En cada tramo:
   - Medidas: número + palabra siguiente si es unidad de `FOOD_UNITS` (g, kg, ml, cl, l, kcal y sus variantes ES/EN), de `SERVING_WORDS` o `GENERIC_SERVING`. `a`/`an` justo antes de un término o de una palabra de unidad/ración cuenta como 1.
   - Asignación: la medida va al término que la sigue (`N [unidad] [de|of] término`); si no, al término anterior del tramo sin medida; si no, se ignora.
   - Con medida «kcal» → **un** `quick` (`kcal` 1..10.000 redondeado; nombre: el del alimento si hay un término, si no las palabras de contenido con mayúscula inicial ≤ 60, si no `'Añadido rápido'`); los términos del tramo se consumen.
   - Ítems: los términos con medida propia y, si ninguno la tiene, el primero. Término con un id → `food` (`portionFor`); con ≥ 2 → `pending` (`query` = término). Los demás términos y las palabras de contenido sobrantes van a `rest`.
   - Tramo sin términos ni kcal: si `anyFood` (Comida, §8.3) o la frase `looksLikeFood`, `pending` con `query` = palabras de contenido (si hay); si no, nada.
   - Palabras de contenido: ≥ 3 letras, no número, no `STOPWORDS`, no unidad/ración, no `FOOD_FILLER` (`desayune desayunado cene cenado almorce almorzado merende merendado comido tomado bebido breakfast lunch dinner snack had for plato`).
6. **`portionFor(food, q)`** → `{ portion, problem }`:
   - `q` null: con raciones → 1 de la primera (FV6); sin → `missing`.
   - g/ml: `qty = r1(n)`; base distinta → 1:1 (`ponytail:` como ya hace el catálogo con líquidos); fuera de (0, 2000] → `range`.
   - serving: ración cuyo nombre empieza por la palabra (`SERVING_WORDS`) o la primera si es genérica; sin ración que encaje → `unit`. `n` redondeado a 0,25, 0,25..50 y `n·qty ≤ 2000`, si no `range`.
   - número sin unidad: con raciones → n raciones; sin raciones y `n ≥ 10` → g/ml de la base; `n < 10` → `missing` (decisión A2).
7. `parseFoodVoice(text, own, opts?: { anyFood?: boolean; forceId?: string }): FoodParse` — con `forceId` (memoria) la frase entera es ese alimento y su cantidad es la primera medida. Máx. `MAX_FOOD_ITEMS`.
8. `itemReady(i)` = `quick`, o `food` con `portion` y sin `problem`. `foodReady(items)` = no vacío y todos listos.
9. `looksLikeFood(norm)`: verbo de comer (`comi comido desayune… cene… almorce… merende… ate eaten eat breakfast lunch dinner`) o una medida g/ml/cl/l (no kg). Los de beber no cuentan (no cambia «3 vasos de agua», CV10).
10. `voiceAdds(items, own, ownFlags)`: `FoodItem[]` listos o confirmados → `VoiceAdd[]`. `itemText(i, own)`: «Arroz blanco cocido · 200 g · 260 kcal» (`fmtPortion`, `fmtKcal`).
11. `estimateEntry(draft, portion, id, at)`: entrada sin `foodId`, `qty: 0`, `name` = `trimName(`${draft.name} (${fmtPortion(portion, draft.base)})`, 60)`, kcal/p/c/f = `portion(draft, qty)`, `via: 'voice'`.
12. `ponytail:` «bocadillo de calamares» se resuelve como Calamar (incompleto, sin ración): no es `deviceSure`, así que con clave decide Haiku; sin clave abre Comida con Calamar.

### 7.3 `routeCapture` (capture.ts)
```ts
const t = captureNorm(text), own = ctx.foods ?? []
if (isOtherDay(t)) → other-day
if (matchExercise(...)) → gym                                  // sin cambios
const fp = parseFoodVoice(text, own)                            // solo términos o kcal
if (exactHits(t, ctx.trackers, ALL_UNITS).length) {             // hábito exacto: como hoy (FV4)
  const tr = matchTracker(t, ctx.trackers, ALL_UNITS)!
  const ms = fp.items.length ? measures(t).filter(m => !FOOD_UNIT_SET.has(m.word)) : measures(t)
  return { ...src, kind: 'tracker', trackerId: tr.id, ...resolveAmount(tr, ms), ...(fp.items.length && { food: fp.items }) }
}
if (fp.items.length) → { ...src, kind: 'food', ...fp }
const tr = matchTracker(...); if (tr) → tracker (como hoy)
if (looksLikeFood(t)) { const any = parseFoodVoice(text, own, { anyFood: true }); if (any.items.length) → food }
return newFromText(text, ctx)
```
- `deviceSure`: `food` → `source === 'parser' && foodReady(items) && rest === ''`. `tracker` sin cambios (la comida adjunta no lo altera).
- `isReady`: `food` → `foodReady(items)`.
- **Asserts CV**: todos siguen pasando sin cambios en el ciclo 36 (revisado frase a frase: ninguna frase de CV1-CV13/MC1-MC5 contiene un término de comida que no sea a la vez hábito exacto; «comí una hamburguesa» sigue siendo `tracker/burgers/1/null` y ahora lleva `food`). Solo **CV9** cambia en el ciclo 38 (`required.length` 17 → 18 por `foods`).

### 7.4 Guardado (`useFood.ts`)
```ts
addVoice(adds: VoiceAdd[], day: string): { ids: string[]; created: string[]; diet: DietChange }
undoVoice(ids: string[], archive: string[]): { undone: number; diet: DietChange }
```
- `addVoice`: `day > today` → today; un `stamp(day)` común; `estimate` con `own` → crea `Food` (`food-<uuid>`, `source: 'estimate'`) y `makeEntry(..., 'voice')`; sin `own` → `estimateEntry`; `quick` → `quickEntry(..., 'voice')`. **Un** `syncDiet(next, [day])` (un `setFood`, como mucho un `pushDiet`: XP y toast de Dieta como siempre).
- `undoVoice`: `undoEntries` + archiva `archive` (decisión A5) en el mismo `next` y `syncDiet` con los días afectados.
- Nombres existentes (`addFoodEntry`, `undoFood`…) sin cambios.

### 7.5 Haiku (ciclo 38)
```ts
export const foodItemSchema = { type: 'object', properties: {
  name: { type: 'string' },                                   // en español, singular, sin cantidades
  amount: nullable('number'), unit: { type: 'string', enum: ['g', 'kg', 'ml', 'l', 'kcal', 'serving', 'none'] },
  servingWord: { type: 'string' }, base: { type: 'string', enum: ['g', 'ml'] },
  kcal100: { type: 'number' }, p100: { type: 'number' }, c100: { type: 'number' }, f100: { type: 'number' },
  typicalQty: nullable('number'),                             // g/ml de una ración típica, o null
}, required: [/* los 10 */], additionalProperties: false }
```
- `captureSchema`: `kind` añade `'food'`; propiedad `foods: { type: 'array', items: foodItemSchema }` en `required` (18). `foodSchema` (Comida): `{ otherDay, foods }`.
- `CAPTURE_SYSTEM` añade: «kind "food" si es comida o bebida que se ha tomado y no es una actividad de `<habitos>`. Si la comida es un hábito de la lista («hamburguesa» = Burgers), kind "tracker" y rellena también foods. foods: cada alimento en orden (máx. 8), name en español y singular sin cantidades; amount y unit tal como se dicen (serving = unidades, raciones, vasos…; servingWord la palabra dicha o ""); kcal100/p100/c100/f100: estimación por 100 g o 100 ml del alimento tal como se suele comer; typicalQty: g o ml de una ración típica, o null. Lista vacía si no hay comida.» `FOOD_SYSTEM`: la versión solo comida, con `otherDay`.
- `capturePrompt`/`foodPrompt` añaden `<propios>` con hasta 100 nombres de propios activos (limpios de `<>`). El catálogo **no** va en el prompt.
- `foodItemsFromAI(v, own): FoodItem[] | null` — `null` si no es array o algún elemento no cumple tipos/enums (manda el parser); recorta a 8. Por elemento: `name` 1..60; resuelve con `findFoods(foodNorm(name))` (primer término): un id → `food` con `portionFor`; si queda `missing` y hay `typicalQty` (0, 2000] → `portion = typicalQty × (n de serving o 1)`, `problem: 'guess'`. ≥ 2 ids → `pending`. Sin término: `unit: 'kcal'` y 1..10.000 → `quick`; si no, estimación válida (kcal100 0..900, macros 0..100, suma ≤ 100) y cantidad (g/ml, o raciones/ninguna con `typicalQty`) → `estimate` (`draft.servings = [{ name: 'Ración', qty: typicalQty }]` si hay); si no, `pending` con `query = name`.
- `captureFromAI`: `foods` ausente → `[]` (tolerante: los mocks de CV8/haiku.test siguen valiendo). `kind: 'food'` con lista vacía → `unknown`; `kind: 'tracker'` + foods → `food` adjunto.
- `pickCapture`: otro día gana (igual). IA `food` y parser `food` → la IA salvo que el parser tenga **más** ítems listos. IA `food` con `foods` inválido → `null` → parser. Resto igual (si la IA respondió, decide ella).
- `interpretFood(text, own, key, online)`: otro día → `other-day` (sin guardar, §8.3); parser `anyFood`; `deviceSure` u O1 listo → sin llamada; si no, `askFood` (`FOOD_SYSTEM`, `foodSchema`) y `pickFood` (misma regla).
- **Coste / `max_tokens`**: ~60 tokens de salida por alimento; captura con comida ≈ 150-600 tokens de salida (2-4 veces lo actual, del orden de milésimas de dólar por frase). `max_tokens`: captura **400 → 1000** (8 alimentos + campos base); `askFood` **800**. Si se corta (`max_tokens`), `postHaiku` ya devuelve `invalid` → parser. Timeout 8 s sin cambios.

### 7.6 Memoria O1 y O3 (ciclo 38)
- `learn`: `kind: 'food'` si `source` es `ai`/`memory`, un solo ítem `food` listo → `{ k: memoKey(text), kind: 'food', id: foodId }`. Varios ítems: no aprende (`ponytail:` límite de 100 caracteres de `id`).
- `recall`: entrada `food` → el alimento existe (catálogo o propio no archivado) → `{ kind: 'food', source: 'memory', ...parseFoodVoice(text, own, { forceId: id }) }`; la cantidad la saca siempre el parser.
- `readMemo` acepta `'food'`. `forget` sin cambios (al «Deshacer»/«Editar»).
- O3 ya cubierto por `deviceSure` (§7.3); comida con `rest` o pendientes → Haiku si hay clave.

## 8. UI

Paletas: el resultado de comida en la captura usa la paleta **HERO** (`CARD.hero`); dentro de una tarjeta de hábito VILLAIN, la parte de comida usa la paleta VILLAIN de esa tarjeta (no se mezclan). Comida sigue en HERO. Tono de `STYLE_GUIDE.md`; chip con el patrón de «Confianza».

### 8.1 Captura (`CaptureView`)
- `case 'food'`: ítems listos → `onSaveFood` (`addVoice`, hoy); si solo hay **un** ítem, no listo, `pending` o `food` sin `guess` → no guarda y navega a Comida prerrellenada (FV1, como gym incompleto). Si no, tarjeta `FoodVoiceCard`.
- Región `role="status"`: «Registrado en Comida: 2 alimentos · 403 kcal» + `dietNote`; sin nada guardado: «Revisa la propuesta: no se ha apuntado nada.»; deshecho: «Deshecho: 2 alimentos (403 kcal).» + `dietNote`.
- `FoodVoiceCard` (`tone`, `rows`, callbacks): «Oído: «…»»; lista `ul`: registradas (icono `Check`, `itemText`); a confirmar: chip «Estimación» o «Ración propuesta», texto, en estimación casilla «Guardar también como alimento propio» (desmarcada), botón «Apuntar» (cada confirmación suma sus ids al mismo «Deshacer»); pendientes: «X · falta la cantidad», ««papa»: hay varios alimentos», ««bocadillo»: no está en tus alimentos»; `rest` ≠ '' → «Sin reconocer: tostadas». Acciones: «Completar en Comida» (si hay pendientes; abre Comida con ellos), «Deshacer» (si hay ids; también archiva los propios creados), «Editar» (deshace todo y abre Comida con **todos** los ítems como pendientes), «Cerrar». Botones `min-h-11`.
- Aprendizaje: tras guardar solo y sin pendientes, `onLearn(cmd)` (el filtro está en `learn`).
- **FV4** (`TrackerResult`): si `cmd.food`, botón «Apuntar también en Comida» bajo «Deshacer/Editar». Al pulsarlo: ítems listos → `addVoice` y debajo la `FoodVoiceCard` (paleta de la rama) con su propio «Deshacer comida» (decisión A6); con pendientes → abre Comida prerrellenada. «Deshacer» del hábito no toca la comida.

### 8.2 Comida prerrellenada (`FoodView`, `FoodPending`, `FoodAdd`)
- `App`: `foodPrefill` + `openFoodWith(items, heard)` (`moduleFrom: 'home'`, se limpia en `goTo`, `openCapture`, `backFromFood`, como `gymPrefill`).
- `FoodView` copia `prefill.items` a su estado `pending`. Tarjeta «Por voz: pendiente» (`h2`, «Oído: «…»», filas con «Revisar» y «Quitar»), encima de «Apuntar comida». Con un solo pendiente se abre directamente.
- «Revisar» → `FoodAdd` prop `open: { key: number } & ({ kind: 'qty'; food: Food; portion: Portion } | { kind: 'search'; query: string } | { kind: 'review'; draft: FoodDraft } | { kind: 'quick'; kcal: number; name: string })`: `food` → panel de cantidad con la porción (o la por defecto); `pending` ambiguo o desconocido → buscador con la consulta (sin resultados ofrece «Crear alimento» con el nombre: FV3 sin clave); `estimate` → `FoodCustom` en «Revisar alimento» con chip «Estimación»; `quick` → formulario de añadido rápido relleno. Al añadir, la fila sale de `pending`.

### 8.3 «Dictar» en Comida (ciclo 37, `FoodVoiceLog`)
- Tarjeta «Por voz» sobre «Apuntar comida»: «Dictar comida» (`Mic`) y «Escribir» (`Keyboard`); privacidad compartida (`voiceAck`), errores con `speechErrorText`/`offlineText`/`noApiText(«lo que has comido»)`.
- Interpreta con `interpretFood` (solo comida, `anyFood`), guarda en el **día del selector** (`addVoice`), misma `FoodVoiceCard` (HERO). «Completar»/«Editar» añaden a `pending` en la misma pantalla.
- Frase con otro día: no guarda; «Para otro día, cámbialo en el selector y dicta sin decir el día.» (decisión A7).
- Estados: escuchando, procesando («Procesando…»), sin voz/sin conexión → campo de texto enfocado, error de IA → interpretado en el dispositivo (mismo aviso que gym).

## 9. Backlog

Un commit por tarea. Cada tarea cierra con `npm run build`, `npm run lint`, `npm test` en verde (y `[selfcheck] done` sin fallos en dev).

### Ciclo 36 — Parser y captura de comida sin IA (FV1, FV2, FV4 con catálogo/propios, FV6)

**T36.1 Tabla de alias** — `core/foodAliases.ts`, `selfcheck.ts`. EN para los 188, genéricos de §7.1, `SERVING_WORDS`, `GENERIC_SERVING`. Acept.: FVZ3; FD1 y FD12 intactos; `foodCatalog.ts` sin diff.

**T36.2 Parser** — `core/foodVoice.ts`, `selfcheck.ts`. `foodNorm`, `foodTerms`, `pluralEq`, `findFoods`, `portionFor`, `parseFoodVoice`, `itemReady`, `foodReady`, `looksLikeFood`, `itemText`, `FOOD_UNITS`/`FOOD_UNIT_SET`. Dep.: T36.1. Acept.: FVZ1, FVZ2, FVZ4-FVZ8.

**T36.3 Router** — `capture.ts`, `classify.ts`, `selfcheck.ts`. Unidades de comida en `UNIT_WORDS.other`, `exactHits`, tipos §5, orden §7.3, `deviceSure`/`isReady`. Dep.: T36.2. Acept.: FVZ9, FVZ10; CV1-CV13, MC1-MC5 y `haiku.test.ts` sin cambios y en verde.

**T36.4 Guardado** — `food.ts` (`quickEntry` con `via`), `foodVoice.ts` (`voiceAdds`), `useFood.ts` (`addVoice`, `undoVoice`). Acept.: FVZ11; un solo `setFood` y como mucho un `pushDiet` por llamada (revisión de código).

**T36.5 Captura UI** — `FoodVoiceCard.tsx`, `CaptureView.tsx`, `CaptureCards.tsx`, `App.tsx` (`foods` en el ctx, `onSaveFood`, `onUndoFood`, `onOpenFood`). §8.1 sin filas de estimación/ración propuesta (llegan en el 38). Dep.: T36.3-4. Acept.: U-FV1-U-FV4.

**T36.6 Comida prerrellenada** — `FoodPending.tsx`, `FoodView.tsx`, `FoodAdd.tsx` (`open`), `App.tsx` (`foodPrefill`). «Editar» y «Completar en Comida». Acept.: U-FV5, U-FV6, A-FV1, A-FV2.

**T36.7 e2e y docs** — `e2e/food-voice.e2e.ts` (E-FV1), `ESTADO-ACTUAL.md` (Comida y Voz), `CLAUDE.md`/`AGENTS.md` (`foodVoice.ts`, `foodAliases.ts`, FVZ), `DEPLOY.md` (checklist iPhone: «200 gramos de arroz y dos huevos», «comí una hamburguesa»).

### Ciclo 37 — «Dictar» en Comida sin IA (FV5)

**T37.1 Núcleo** — `haiku.ts`: `interpretFood` solo con parser (la rama de Haiku llega en el 38; sin clave ya es el comportamiento final). Acept.: FVZ12.

**T37.2 UI** — `FoodVoiceLog.tsx`, `FoodView.tsx`, `App.tsx`. §8.3. Acept.: U-FV7, U-FV8, A-FV3.

**T37.3 e2e y docs** — E-FV2, `ESTADO-ACTUAL.md`, `DEPLOY.md`.

### Ciclo 38 — Haiku y memoria (FV3, FV6 con ración propuesta, FV4 estimado, O1)

**T38.1 Esquemas y prompts** — `haiku.ts`: `foodItemSchema`, `captureSchema` + `foods`, `CAPTURE_SYSTEM`, `FOOD_SYSTEM`, `foodSchema`, prompts con `<propios>`, `max_tokens` 1000/800. Acept.: FVZ17; **CV9** pasa a `required.length === 18` (único assert CV que cambia: el esquema crece por FV2/FV3); `haiku.test.ts` `max_tokens` 400 → 1000.

**T38.2 Resolución IA** — `foodVoice.ts` (`foodItemsFromAI`, `estimateEntry`), `capture.ts` (`captureFromAI`, `pickCapture`). Acept.: FVZ13, FVZ14, FVZ16; CV6/CV8 sin cambios.

**T38.3 Llamadas** — `haiku.ts` (`askFood`, rama Haiku de `interpretFood`, `pickFood`), `haiku.test.ts`. Acept.: tests H-FV1-H-FV5 (§11).

**T38.4 Memoria** — `memory.ts`. Acept.: FVZ15; MC1-MC5 sin cambios.

**T38.5 UI de confirmación** — `FoodVoiceCard.tsx` (estimación y ración propuesta), `FoodCustom.tsx` (chip «Estimación»), `off.ts` (`source`), `CaptureView`/`FoodVoiceLog`/`App`. Acept.: U-FV9-U-FV11, A-FV4.

**T38.6 e2e y docs** — E-FV3, `ESTADO-ACTUAL.md` (cierre de la fase 3, coste), `CLAUDE.md`/`AGENTS.md`.

## 10. Riesgos

| Riesgo | Prevención | Recorte si se complica |
|---|---|---|
| Falsos positivos de comida en frases de hábitos | Solo coincidencia exacta; hábito exacto antes que comida; FVZ9 + todos los CV. | Quitar `looksLikeFood` (desconocidos solo con Haiku). |
| Genérico equivocado (arroz crudo vs cocido) | Tabla cerrada y revisable (A1); el texto «Registrado» muestra el nombre y las kcal; «Editar». | Quitar genéricos dudosos de la tabla. |
| Dos `push` en el mismo manejador (XP perdida) | §2; `addVoice`/`undoVoice` atómicos; FV4 con «Deshacer comida» aparte. | — |
| Respuesta de Haiku larga o cortada | `max_tokens` 1000, recorte a 8, `invalid` → parser. | Limitar a 4 alimentos. |
| `FoodAdd` con demasiados modos | `open` con `key`, una sola vía de entrada. | Pendientes solo como búsqueda (sin panel de cantidad). |
| 188 alias EN a mano | Assert de cobertura e integridad; tomados de la descripción USDA. | Empezar por los 130 originales y completar en el 37. |
| Tamaño de `CaptureView` (~300 líneas) | La comida vive en `FoodVoiceCard`. | — |

## 11. Verificación

### Asserts nuevos en `selfcheck.ts` (FVZ)
Helper `fz(text, own?)` → por ítem `food:<id>:<qty>[:<n>]`, `miss:<id>:<problem>`, `quick:<kcal>:<name>`, `pend:<query>:<nº ids>`, unidos por `|`.

- **FVZ1 foodNorm**: «medio kilo de arroz» → `food:rice-white-cooked:500`; «un kilo y medio de patatas» → `food:potato-boiled:1500`; «media docena de huevos» → `food:egg:300:6`; «trescientos gramos de pasta» → `food:pasta-cooked:300`; «arroz 150,5 g» → `150.5`; «treinta y cinco gramos de almendras» → `food:almonds:35` (la «y» del número no parte la frase).
- **FVZ2 pluralEq/findFoods**: `pluralEq` nuez/nueces, arroz/arroces, cherry/cherries, huevo/huevos, tomate/tomates, y `false` para arroz/avena; «crema de cacao y avellanas 20 g» → un ítem `hazelnut-cocoa-spread`; «patatas fritas 100 g» → `french-fries`; propio «Mi tarta» gana; propio archivado no casa.
- **FVZ3 tabla**: §7.1 reglas; `CATALOG.length === 188`.
- **FVZ4 portionFor**: g, kg, ml, cl («33 cl de cola» → 330), l; base g con ml 1:1; «2500 g de arroz» → `miss:…:range`; «3 latas de cola» → `food:cola:990:3`; «una cucharada de aceite» → `food:olive-oil:13:1`; «2 rebanadas de pan» → `miss:bread-white:unit`.
- **FVZ5 FV6**: «una manzana» y «manzana» → `food:apple:180:1`; «arroz» → `miss:rice-white-cooked:missing`; «arroz 200» → `200`; «arroz 5» → `missing`; «2 hamburguesas» (sin hábito) → `miss:beef-burger:missing`; «medio plátano» → `food:banana:60:0.5`; «2 vasos de leche» → `food:milk-semi:500:2`.
- **FVZ6 kcal**: «500 kcal» → `quick:500:Añadido rápido`; «1000 calorías»; «un bocadillo de 600 kcal» → `quick:600:Bocadillo`; «0 kcal» y «20000 kcal» → sin quick.
- **FVZ7 varios**: «200 g de arroz, 150 g de pollo y una manzana» → 3 listos (260 / 247,5 / 93,6 kcal); «arroz 200 g y pollo 150 g»; «200 g de arroz 150 g de pollo» → 2; «café con leche» → `food:coffee:50:1` y `rest` contiene «leche»; tope 8 ítems.
- **FVZ8 EN**: «ate 200 g of rice» → `food:rice-white-cooked:200`; «two eggs and a banana» → `food:egg:100:2|food:banana:120:1`; «a glass of milk» → `food:milk-semi:250:1`; «half an apple» → `0.5`; «papa 100 g» → `pend:papa:2`.
- **FVZ9 routeCapture**: «comí una hamburguesa» → `tracker/burgers/1/null` con `food[0]` `beef-burger` `missing`; «hamburguesa 200 g» → Burgers 1 + `beef-burger` 200; «200 g de arroz» → `food`; «2 peras» → `food:pear:360:2`; «ayer comí arroz» → `other-day`; «80kg bench press 5 reps» → gym; «comí un bocadillo» → `food` con `pend:bocadillo:0`; «3 vasos de agua» → `new` (como CV10).
- **FVZ10 deviceSure/isReady**: seguros «200 g de arroz», «500 kcal», «two eggs and a banana»; no seguros «arroz», «papa 100 g», «comí un bocadillo», «café con leche».
- **FVZ11 voiceAdds/entradas**: entradas con `via: 'voice'`, `foodId`, `qty` y `serving`; quick con `via` y `qty: 0`; `quickEntry` sin `via` igual que antes (FD2 intacto).
- **FVZ12 interpretFood local**: «un bocadillo» en Comida → `pend:bocadillo:0` (sin verbo); «ayer 200 g de arroz» → `other-day`; «200 g de arroz» → `food` sin llamada (fetch simulado no llamado).
- **FVZ13 foodItemsFromAI**: nombre «arroz blanco» → catálogo con la cantidad de la IA; desconocido válido → `estimate` (`source: 'estimate'`, no `itemReady`); `typicalQty` con «arroz» sin cantidad → `problem: 'guess'`; kcal100 950 → `pend`; elemento con `unit` fuera del enum → `null`; 9 elementos → 8.
- **FVZ14 captureFromAI/pickCapture**: `foods` ausente → `[]`; `kind: 'food'` vacío → `unknown`; `tracker` + foods → `food` adjunto; IA food 1 listo vs parser 2 listos → parser; IA food vs parser tracker → IA; otro día gana.
- **FVZ15 memoria**: `memoKey('200 gramos de arroz') === 'arroz'`; `learn` de IA un alimento → `kind: 'food'`; de parser o con 2 ítems → mismo `m`; `recall` saca la cantidad del parser («arroz 300 g» → 300) y devuelve `null` con el propio archivado; `readMemo` acepta `food`.
- **FVZ16 estimateEntry**: nombre «Bocadillo de calamares (200 g)», kcal = per100 × 2, `qty: 0`, sin `foodId`, `via: 'voice'`, nombre ≤ 60.
- **FVZ17 esquemas/prompts**: `captureSchema.required` incluye `foods` (18) y `kind` incluye `food`; `foodItemSchema` 10 requeridos, `additionalProperties: false`; el prompt no contiene `<` de la frase ni nombres del catálogo; incluye `<propios>` sin archivados.

**Asserts que cambian**: solo CV9 (ciclo 38, 17 → 18). Ningún otro CV/MC/FD/VZ/GY se toca.

### Tests (fetch y voz simulados; la API real nunca se llama)
- `App.test.tsx` — **36**: U-FV1 sin clave «200 g de arroz y una manzana» → 2 entradas `via: 'voice'`, «Deshacer» → 2 `FoodUndo`; U-FV2 con objetivo, la frase pone el día en rango → toast/nota de Dieta, «Deshacer» la retira; U-FV3 «arroz» → pantalla Comida con «Arroz blanco cocido» en el panel de cantidad y nada guardado; U-FV4 «comí una hamburguesa» → Burgers +1 y «Apuntar también en Comida» abre Comida; U-FV5 «Editar» → deshace y lista pendientes; U-FV6 «papa 100 g» → buscador con «papa». **37**: U-FV7 «Dictar comida» con el selector en «Ayer» → entrada de ayer y Dieta de ayer; U-FV8 frase con otro día → mensaje y nada guardado. **38**: U-FV9 con clave «un bocadillo de calamares» y respuesta simulada → chip «Estimación», nada guardado hasta «Apuntar»; U-FV10 con «Guardar también como alimento propio» → propio `source: 'estimate'` + entrada, «Deshacer» lo archiva; U-FV11 memoria: segunda frase igual sin llamada.
- `haiku.test.ts` (38): H-FV1 O3 sin fetch para «200 g de arroz»; H-FV2 fetch para «comí un bocadillo»; H-FV3 cuerpo con `foods` en el esquema, `max_tokens` 1000 y sin la clave; H-FV4 `askFood` 800 y fallo 500 → parser con `aiError`; H-FV5 sin clave u offline → sin fetch.
- `a11y.test.tsx`: A-FV1 tarjeta de comida en la captura; A-FV2 Comida con pendientes; A-FV3 Comida con «Por voz»; A-FV4 fila «Estimación».
- e2e `food-voice.e2e.ts`: E-FV1 (36) «+» a 320 px sin clave, «200 gramos de arroz y dos huevos» → «Registrado en Comida», recarga, diario con 2 filas, 0 llamadas, axe; E-FV2 (37) «Dictar comida» en «Ayer»; E-FV3 (38) con clave y respuesta interceptada → «Estimación» → «Apuntar», axe, sin desbordes a 320 px.

### Checklist manual (por ciclo, móvil y PWA)
- Recargar tras guardar por voz: las entradas siguen y Dieta cuadra con el diario.
- «Deshacer» retira todas las de la frase; el foco vuelve al micro.
- iPhone (PWA instalada): la escucha arranca en el toque de «Dictar comida»; con `KEYBOARD_ON_IOS` el campo se abre enfocado.
- Tarjeta VILLAIN (Burgers) con «Apuntar también en Comida» sin mezclar paletas.
- 320 px: chips y filas sin desbordes.

## 12. Handoff para Claude Code

1. Rama `cycle-36`. Lee esta spec, `capture.ts`, `memory.ts`, `classify.ts`, `voice.ts`, `food.ts`, `useFood.ts`, `CaptureView.tsx`, `FoodAdd.tsx`.
2. Orden estricto T36.1 → T36.7; un commit por tarea; en cada una, `build`, `lint`, `test` en verde. Tras T36.3 ejecuta todos los CV/MC antes de seguir: si alguno falla, se ajusta el router, nunca el assert.
3. Reglas que no se negocian: `ActivityEvent[]`/`FoodData.log` de solo añadir; un `setFood` y como mucho un `push` por manejador; nada de comida en `rpg.ts`/`stats.ts`; tokens de `@theme`, sin hex ni `slate-*`; comentarios `ponytail:` donde §2 y §7 marcan límites.
4. Al cerrar cada ciclo: merge `--no-ff`, push a `main`, `ESTADO-ACTUAL.md` actualizado. Los ciclos 37 y 38 parten de `main` con el anterior ya desplegado.

## 13. Decisiones que requieren aprobación

Cada una con la opción recomendada (R). Lo demás está cubierto por FV1-FV6 y los valores por defecto.

- **A1 Genéricos** («arroz», «pollo», «leche»…): (R) apuntan a la forma lista para comer de una tabla cerrada (§7.1; «arroz crudo» sigue disponible diciéndolo); alternativa: siempre ambiguo y se abre Comida (el ejemplo de FV1 «200 gramos de arroz» no se guardaría solo).
- **A2 Número sin unidad en alimento sin ración** («arroz 200», «2 hamburguesas»): (R) ≥ 10 = g/ml; < 10 pide la cantidad. Alternativa: pedir siempre.
- **A3 Varios alimentos con alguno incompleto**: (R) se guardan los completos y la tarjeta lista los pendientes con «Completar en Comida». Alternativa: no guardar ninguno.
- **A4 Estimación confirmada sin «Guardar también como alimento propio»**: (R) entrada tipo añadido rápido con nombre «X (200 g)», kcal y macros (no sale en Recientes). Alternativa: crear siempre el propio.
- **A5 «Deshacer» de una estimación guardada como propio**: (R) anula la entrada y archiva el propio creado (como el hábito nuevo). Alternativa: dejar el propio.
- **A6 FV4**: (R) «Deshacer» del hábito y «Deshacer comida» por separado (un solo botón obligaría a dos guardados de XP en el mismo toque). Alternativa: un único «Deshacer», con un manejador combinado en `App`.
- **A7 «Dictar» en Comida con otro día en la frase**: (R) no guarda y pide cambiar el selector. Alternativa: ignorar la palabra y usar el día del selector.
- **A8 Alias EN y genéricos**: (R) solo para la voz; el buscador de Comida no cambia (FD12 intacto). Alternativa: también en el buscador (cambia el orden de resultados y FD12).
- **A9 Haiku**: (R) una sola llamada con el esquema de la captura ampliado (`max_tokens` 400 → 1000; ~2-4 veces el coste por frase con comida). Alternativa: segunda llamada solo para comida (más latencia, mismo coste total).
