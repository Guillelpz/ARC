# TECH SPEC — Ciclo 39: preparar iPhone, copiar día y saneamiento

Fuente: `docs/cycles/STATE.md` («Ciclo 39», aprobado el 2026-10-15), `cycle-39/evaluation.md` y `cycle-39/proposals.md`. Rama `cycle-39`.

## 1. Resumen

- **P39.5, preparación:** una sola checklist de iPhone en `docs/DEPLOY.md`, ordenada por tiempo de prueba, y un botón «Copiar resumen» en «Probar voz» (`VoiceCheck.tsx`) que nunca incluye la clave. Fijar `KEYBOARD_ON_IOS` queda para el mini-ciclo 39b, con los resultados del usuario.
- **P39.1:** en Comida, «Copiar día anterior» copia todas las entradas vivas del día anterior al del selector (alimentos, rápidas y estimadas) como instantáneas nuevas con `via: 'copy'`. Hay un único «Deshacer» y Dieta se actualiza en vivo.
- **P39.3, recortada:** `deviceSure` no da por segura una frase con palabras ajenas al hábito («I ran out of milk» → Haiku), `readGym` deduplica los ids de rutina, los platos tienen nombre único, piden confirmación al borrarse y avisan si ya no existen, y se renombran 3 filas USDA.
- **No entra:** métricas de Haiku (P39.2), temporizador (P39.4), olvidar la frase al deshacer desde misiones, elegir el día de origen ni cambiar la regla de matching aproximado.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Origen de la copia | Siempre `addDays(day, -1)` del selector, decisión del usuario. | Un origen determinista. |
| Destino y hora | Todas las copias usan `stamp(day)` (un único `at`) y conservan el orden del origen (por `occurredAt` y, a igualdad, por posición en el log). | Así salen en el Diario en el mismo orden. |
| Contenido copiado | `{ ...e, id: newId(), occurredAt: at, via: 'copy' }` de cada entrada viva, con su instantánea tal cual: no se recalcula con el catálogo (T1). | Corregir el catálogo no reescribe el pasado y la copia replica exactamente el día. |
| Doble toque | El botón se desactiva si el día de destino ya tiene alguna entrada viva con `via: 'copy'` (`hasCopy`), con el motivo visible. Se reactiva al deshacer todas las copias. | Se deriva de los datos, así que sobrevive a recargas y cambios de día. Nunca duplica sin aviso. |
| `via: 'copy'` | Es un valor nuevo del campo libre `via`. `readFood` no valida `via`. | No requiere migración. |
| `deviceSure` (hábito) | Además de `exactTracker`, cada palabra de la frase normalizada de ≥ 3 letras debe ser del nombre o los alias del hábito, un número, una unidad (`ALL_UNITS`), la unidad del propio tracker o una stopword. | Es la regla aprobada. Las palabras de < 3 letras se ignoran, como en `exactHits`. |
| Frase mixta hábito + comida | Con la regla nueva deja de ser segura y va a Haiku si hay clave. | Es la consecuencia directa de la regla; sin clave no cambia nada. |
| Sin clave | El router sigue guardando «I ran out of milk» → Running +1, como en C3. El arreglo solo evita saltarse Haiku. | Decisión del evaluador; se documenta en el `ponytail:`. |
| Rutinas repetidas | En `readGym` gana la primera; las demás cuentan en `dropped`. | Es la misma regla que `readFood` aplica a los platos. |
| Nombre de plato | Comparación por `fold` contra los demás platos. Un plato puede llamarse como un alimento. | `nameTaken` es para alimentos. Se reutiliza su normalización (`fold`), no la función. |
| Renombrado USDA | `tomato-canned`, `soy-sauce` y `rabbit-raw` (ver §7.4). Se añade el nombre anterior como alias para que la búsqueda y la voz sigan encontrándolos. Pistachos se queda como está. | El usuario aprobó 3 filas. Conejo crudo frente a cocinado es el error de kcal más grande. |
| Resumen de voz | Función pura `voiceSummary(input)` en `src/components/voiceSummary.ts`. No recibe ni lee la clave. | Se puede probar y no hay forma de filtrar la clave. |
| Portapapeles | `navigator.clipboard.writeText`. Si no existe o falla, se muestra un `<textarea readOnly>` con el resumen y su texto seleccionado. | Sin dependencias. |

## 3. Decisiones que requieren aprobación

Ninguna. Todo está dentro de lo aprobado. Solo hay dos efectos colaterales, ya decididos en §2 y que no reabren nada: «Read 50 pages of the name of the wind» deja de ser segura (en CV13 y en el test O3 pasa a llamar a Haiku con clave), y las frases mixtas hábito + comida también van a Haiku.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `docs/DEPLOY.md` | Sección única «Prueba en iPhone (pendiente)» ordenada por tiempo. Se mueven ahí la subchecklist de voz de «Comprobar tras desplegar» y las tres secciones de Comida. |
| `app/src/components/voiceSummary.ts` (nuevo) | `voiceSummary(input): string`, puro. |
| `app/src/components/VoiceCheck.tsx` | Botón «Copiar resumen», estado de copia y respaldo con `textarea`. |
| `app/src/core/food.ts` | `copyDay`, `hasCopy` y `mealNameTaken`. |
| `app/src/useFood.ts` | Handler `copyDay(day)`. `saveMeal` rechaza nombres repetidos. `addMeal` devuelve `gone: true` si el plato no existe. |
| `app/src/components/FoodCopyDay.tsx` (nuevo) | Botón, motivo cuando está desactivado, estado y «Deshacer». Es presentacional. |
| `app/src/components/FoodView.tsx` | Prop `onCopyDay` y `<FoodCopyDay key={day}>` dentro de la tarjeta «Diario», bajo el `h2`. |
| `app/src/App.tsx` | Pasa `foodHandlers.copyDay` a `FoodView`. |
| `app/src/components/FoodMeals.tsx` | Error por nombre repetido, `window.confirm` al borrar y aviso «Ese plato ya no existe.». |
| `app/src/core/capture.ts` | `deviceSure` con la regla nueva. Se sustituye el `ponytail:` de la línea 183. |
| `app/src/core/classify.ts` | Exporta `trackerWords(t: Tracker): string[]`, que es `words(\`${t.name} ${ALIASES[t.id] ?? ''}\`)`. |
| `app/src/core/storage.ts` | `readGym`: dedupe de rutinas por id. |
| `app/src/core/foodCatalog.ts` | 3 nombres y 3 alias. |
| `app/src/core/types.ts` | Comentario de `via`: añadir `'copy'` (ciclo 39). |
| `app/src/core/selfcheck.ts` | FD18, FD19, GY23, CV13 cambiado y CV14 (§11). |
| `app/src/core/haiku.test.ts` | Ajuste del test O3 (§11). |
| `app/src/App.test.tsx`, `app/src/a11y.test.tsx`, `app/e2e/food.e2e.ts` | Tests nuevos (§11). |
| `docs/ESTADO-ACTUAL.md`, `CLAUDE.md`/`AGENTS.md` | Cierre (T8). |

## 5. Modelos de datos

No hay tipos persistidos nuevos. `FoodEntry.via` admite también `'copy'` (solo cambia el comentario). Tipos nuevos de la UI y del hook:

```ts
// useFood.addMeal
{ ids: string[]; missing: number; diet: DietChange; gone?: true }
// useFood.copyDay
(day: string) => { ids: string[]; diet: DietChange }
// voiceSummary.ts
export type VoiceSummaryInput = {
  ua: string; standalone: boolean; iosStandalone: boolean | null /* navigator.standalone; null si no existe */
  recognition: 'SpeechRecognition' | 'webkitSpeechRecognition' | null
  lang: string; online: boolean; keyboardOnIos: string
  outcome: SpeechOutcome; ms: number; log: SpeechLog; at: string /* sello local YYYY-MM-DDTHH:mm:ss */
}
```

## 6. Persistencia y migración

- **Comida:** las copias son `FoodEntry` normales en `life-rpg-food-v1`. Entran en export/import, backups y fusión con `mergeLog`, y se deduplican por id como cualquier otra entrada. No hay migración.
- **Gym:** `readGym` deja de admitir dos rutinas con el mismo id. Los datos guardados con duplicados se reparan al leer: se conserva la primera y `dropped` suma 1 por cada repetida, así que sale el aviso estándar de datos reparados al cargar. El siguiente guardado los deja limpios. `mergeBackup` no cambia.
- **Platos ya guardados con nombre repetido:** no se tocan, ni al leer ni al fusionar. Solo se impide crear otro repetido. `ponytail:` en `mealNameTaken`: la fusión puede traer nombres repetidos.
- **Resumen de voz:** no se guarda nada.

## 7. Lógica de dominio

### 7.1 `food.ts`

```ts
// Entradas vivas de `from` como instantáneas nuevas para `at` (mismo orden que el Diario). No muta `log`.
export function copyDay(log: FoodLogEntry[], from: string, newId: () => string, at: string): FoodEntry[] {
  return dayEntries(log, from).map((e, i) => ({ e, i }))
    .sort((a, b) => (a.e.occurredAt < b.e.occurredAt ? -1 : a.e.occurredAt > b.e.occurredAt ? 1 : a.i - b.i))
    .map(({ e }) => ({ ...e, id: newId(), occurredAt: at, via: 'copy' }))
}
export const hasCopy = (log: FoodLogEntry[], day: string) => dayEntries(log, day).some(e => e.via === 'copy')
// ponytail: solo impide crear repetidos; la fusión puede traer dos platos con el mismo nombre (ids distintos) y se dejan.
export const mealNameTaken = (name: string, meals: Meal[] = []) => meals.some(m => fold(m.name) === fold(name))
```

Para no duplicar el comparador, la ordenación puede extraerse a un helper `byTime` compartido con `FoodView`/`FoodMeals`. Es opcional.

### 7.2 `useFood.ts`

```ts
function copyDay(day: string): { ids: string[]; diet: DietChange } {
  if (day > today) day = today
  if (hasCopy(food.log, day)) return { ids: [], diet: 0 }
  const entries = copyEntries(food.log, addDays(day, -1), uuid, stamp(day)) // import { copyDay as copyEntries } from './core/food'
  if (!entries.length) return { ids: [], diet: 0 }
  return { ids: entries.map(e => e.id), diet: syncDiet({ ...food, log: [...food.log, ...entries] }, [day]) }
}
```

- Hay un `setFood` y un `dietSync` por copia, y el «Deshacer» usa `undoFood(ids)`, que ya existe.
- `saveMeal(name, ids)` devuelve `false` si `mealNameTaken(name, food.meals)`. El componente lo comprueba antes para dar el error concreto.
- `addMeal`: si `!m`, devuelve `{ ids: [], missing: 0, diet: 0, gone: true }`.

### 7.3 `deviceSure` (`capture.ts`)

```ts
// ¿Está el dispositivo seguro sin preguntar a Haiku? Gym completo, comida lista sin resto, o hábito con coincidencia exacta y única
// y sin palabras ajenas: fuera del nombre/alias del hábito solo números, unidades (incl. la del tracker) y stopwords.
// ponytail: sin clave el router sigue guardando estas frases (C3, «I ran out of milk» → Running +1); esto solo evita saltarse Haiku.
// Palabras de < 3 letras se ignoran (como exactHits). Una frase mixta hábito + comida ya no es segura.
if (c.kind === 'tracker') {
  const t = exactTracker(captureNorm(c.text), ctx.trackers, ALL_UNITS)
  if (t?.id !== c.trackerId) return false
  const own = new Set([...trackerWords(t), ...normalizeText(t.unit).split(/[^a-z0-9]+/)])
  return normalizeText(captureNorm(c.text)).split(/[^a-z0-9]+/)
    .every(w => w.length < 3 || /^\d+$/.test(w) || own.has(w) || ALL_UNITS.has(w) || STOPWORDS.has(w))
}
```

Los casos `gym` y `food` no cambian. Comprobado a mano contra `STOPWORDS` y `ALIASES` actuales:

| Frase | Palabras de ≥ 3 letras | Resultado |
|---|---|---|
| «corrí 30 minutos» | `corri` (alias), `30`, `minutos` (unidad) | segura (sigue con `problem: 'unit'`, como hoy) |
| «Read 50 pages of the name of the wind» | `name` y `wind` son ajenas | no segura |
| «comí una hamburguesa» | `comi` (stopword), `hamburguesa` (alias) | segura |
| «fui al gimnasio» | `fui` (stopword), `gimnasio` (alias) | segura |
| «I ran out of milk» | `out` y `milk` son ajenas | no segura |

### 7.4 Catálogo

| id | `name` nuevo | Alias añadido (`aliases`) |
|---|---|---|
| `tomato-canned` | «Tomate en conserva» | `tomate triturado` |
| `soy-sauce` | «Salsa de soja tamari» | `salsa de soja` |
| `rabbit-raw` | «Conejo crudo» | `conejo` |

`id`, `ref` y los valores no cambian. `VOICE_ALIASES` va por `id`, así que no se toca. FD1 exige nombres únicos por `fold`: los nuevos no chocan. Las entradas ya registradas conservan su nombre (instantánea).

### 7.5 `readGym`

En el bucle de rutinas, `if (r && !routines.some(y => y.id === r.r.id)) { push; fixedN += r.fixed } else rDropped++`.

## 8. UI

### 8.1 «Probar voz» (`VoiceCheck`, paleta de app)

Tras una prueba (`run` presente), bajo el `<dl>`, aparece el botón secundario «Copiar resumen» con el icono `Copy` de lucide.

- **Copia correcta:** `role="status"` visible con «Resumen copiado. Pégalo en el chat.».
- **Fallo o sin `navigator.clipboard`:** el texto «No se ha podido copiar: selecciona el texto y cópialo.» y un `<textarea readOnly rows={8} aria-label="Resumen de la prueba de voz">` con el resumen, enfocado y con su texto seleccionado (`select()`).
- **Nueva prueba:** limpia el estado.

Formato de `voiceSummary` (una línea por campo, en español):

```
Probar voz · RPG Life Tracker · <at>
Agente: <ua>
Modo: app instalada | navegador · navigator.standalone: sí | no | no existe
Reconocimiento: webkitSpeechRecognition | SpeechRecognition | no disponible
Idioma: es-ES · Conexión: sí | no · KEYBOARD_ON_IOS: never
Resultado: «<texto>» en 1,2 s | Error: <error> (<detalle>)
Eventos: 0 ms start · 140 ms audiostart · … | Sin eventos
```

### 8.2 Comida, «Copiar día anterior» (`FoodCopyDay`, HERO)

Va en la tarjeta «Diario», bajo el `h2`. Props: `food`, `day`, `today`, `onCopy(day)` y `onUndo(ids)`. Prev = `addDays(day, -1)`, con `n` entradas vivas y `k` kcal.

- **Botón:** `secondary` con el icono `Copy`, «Copiar día anterior» y `aria-describedby` apuntando a la pista.
- **Pista** (siempre visible, `text-sm text-hero-muted`):
  - `n > 0` y sin copia: «Añade lo de {dayLabel(prev, today) en minúsculas}: N alimentos · K kcal».
  - `n === 0`: «Nada apuntado el día anterior.» (botón desactivado).
  - `hasCopy`: «Ya has copiado el día anterior aquí. Deshaz las copias para volver a copiar.» (botón desactivado).
- **Al copiar:** `role="status"` con «Copiado: N alimentos · K kcal{dietNote}» y botón «Deshacer». El estado se guarda con sus `ids`, como en `FoodMeals`.
- **«Deshacer»:** «Deshecho: N entradas copiadas{dietNote}», y el foco pasa al botón «Copiar día anterior».
- **Cambio de día:** el estado se limpia con `key={day}` en el padre.

### 8.3 Platos (`FoodMeals`)

- **Guardar:** si `mealNameTaken(n, meals)`, aparece el error «Ya tienes un plato con ese nombre.».
- **Borrar:** `window.confirm(\`¿Borrar el plato «${m.name}»? Lo que ya has apuntado no cambia.\`)`. Si se cancela, no pasa nada (el mismo patrón que las rutinas de `GymView`).
- **Añadir:** con `r.gone`, el estado muestra «Ese plato ya no existe.».

Todo con tokens HERO; sin hex ni `slate-*`. Todos los objetivos táctiles miden ≥ 44 px (`min-h-11`).

## 9. Backlog

Hay un commit por tarea, en orden. Cada tarea se cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.

**T1 — Checklist unificada (`docs/DEPLOY.md`).** Commit `docs: checklist de iPhone unificada (ciclo 39)`.

- Nueva sección «Prueba en iPhone (pendiente)», justo después de «Comprobar tras desplegar». Empieza con «Preparación» (iOS, Siri y Dictado, PWA instalada, clave en Ajustes, túnel opcional) y sigue por bloques ordenados por tiempo, cada uno con su duración estimada:
  1. «Probar voz» ×5 en Safari y ×5 en la PWA, y pulsar «Copiar resumen» y pegarlo en el chat (T8, ~10 min).
  2. Voz de Gym (ciclo 26).
  3. Captura del «+» (ciclo 27): «Read 50 pages…» → Reading +100 min; «ate a burguer» → Burgers +1; «grounding 30 min» → tarjeta de propuesta; «ayer…» → aviso; con clave, una propuesta de confianza «alta» con cuenta atrás de 10 s.
  4. Comida por voz (ciclos 36-38).
  5. Código de barras tecleado (ciclo 32).
  6. Escáner (ciclo 35).
  7. Foto de la etiqueta I4 (ciclo 33, incluido el `click()` tras el aviso; ~45 min).
- Se mueven los ítems existentes sin perder ninguno y se borran las secciones viejas. «Comprobar tras desplegar» queda solo con lo genérico.
- **Aceptación:** ningún ítem de las checklists anteriores desaparece (diff revisable); no se toca código.

**T2 — «Copiar resumen» en «Probar voz».** Archivos: `voiceSummary.ts` y `VoiceCheck.tsx`, más los tests U-V1, U-V2 y A11Y-1. Commit `feat(voz): copiar resumen de la prueba de voz`.

- **Aceptación:** el resumen tiene todos los campos de §8.1; nunca contiene la clave guardada; el respaldo `textarea` aparece si el portapapeles falla.

**T3 — `copyDay`/`hasCopy` en core.** Archivos: `food.ts`, `types.ts` (comentario) y FD18 en `selfcheck.ts`. Commit `feat(comida): copyDay y hasCopy`.

- **Aceptación:** FD18 pasa y la UI aún no cambia.

**T4 — «Copiar día anterior» en la UI.** Depende de T3. Archivos: `useFood.ts`, `FoodCopyDay.tsx`, `FoodView.tsx` y `App.tsx`, más U-C39-1 a U-C39-3, A11Y-2 y E-FD3. Commit `feat(comida): copiar día anterior`.

- **Aceptación:** §8.2 completo; Dieta entra y sale en vivo con su toast; un solo «Deshacer» retira todas las copias.

**T5 — `deviceSure` sin palabras ajenas.** Archivos: `classify.ts` (`trackerWords`), `capture.ts`, `selfcheck.ts` (CV13 y CV14) y `haiku.test.ts`. Commit `fix(voz): deviceSure no se salta Haiku con palabras ajenas al hábito`.

- **Aceptación:** «I ran out of milk» no es segura y con clave llama a Haiku; sin clave sigue guardando Running (CV1 no cambia).

**T6 — Rutinas repetidas en `readGym`.** Archivos: `storage.ts` y GY23. Commit `fix(gym): readGym descarta rutinas con id repetido`.

**T7 — Menores de platos y renombrado USDA.** Archivos: `food.ts` (`mealNameTaken`), `useFood.ts`, `FoodMeals.tsx`, `foodCatalog.ts`, FD19 y U-ML1 a U-ML3. Commit `fix(comida): platos con nombre único, confirmación al borrar y 3 nombres USDA`.

- **Aceptación:** §8.3; FD1 sigue pasando; buscar «conejo», «salsa de soja» o «tomate triturado» encuentra la fila renombrada.

**T8 — Documentación de cierre.** Archivos: `docs/ESTADO-ACTUAL.md` y `CLAUDE.md`/`AGENTS.md` si cambian sus listas de asserts (FD18-FD19, GY23, CV14). Commit `docs: estado tras el ciclo 39`.

- En `ESTADO-ACTUAL.md`: quitar de §4 «sin copiar el día», `deviceSure` por palabra suelta, el dedupe de `readGym`, los 3 menores de platos y las 3 filas USDA (dejar pistachos); añadir el `via: 'copy'` y la checklist unificada.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| `deviceSure` más estricto ⇒ más llamadas a Haiku (coste y latencia). | La memoria O1 aprende tras la primera llamada. Los casos frecuentes («corrí 5 km», «comí una hamburguesa») siguen siendo seguros (CV14). | Si molesta, ampliar con `FOOD_FILLER` u otras palabras de relleno en un ciclo posterior; no aquí. |
| Copiar dos veces por error. | `hasCopy` lo desactiva y además hay «Deshacer». | — |
| Renombrar rompe la voz o la búsqueda por el nombre viejo. | Alias con el nombre anterior; FD19 lo comprueba. | — |
| El portapapeles de iOS falla en la PWA. | Respaldo con `textarea` seleccionado. | — |
| La dedupe de rutinas muestra el aviso de datos reparados a quien tenga duplicados. | Es el comportamiento estándar y conserva la primera. | — |
| La tarea crece. | — | Si T7 se complica, el renombrado USDA va solo en otro commit; T1-T5 son lo prioritario. |

## 11. Verificación

### Asserts (`selfcheck.ts`)

Los asserts de dominio solo se cambian donde la regla aprobada lo exige: CV13.

- **FD18 (nuevo) — `copyDay`/`hasCopy`.** Log con dos entradas de ayer (alimento con `serving` y añadido rápido) y una estimada (`estimateEntry`, sin `foodId`), una cuarta deshecha, y una de hoy. `copyDay(log, ayer, nid, \`${hoy}T09:00:00\`)` debe:
  - devolver 3 entradas, en el orden del origen, con ids nuevos y distintos de los del origen;
  - tener todas `occurredAt` igual a `at` y `via === 'copy'`, también la estimada, que antes tenía `via: 'voice'`;
  - conservar `name`, `kcal`, `p/c/f`, `qty`, `serving`, `foodId` y `base`;
  - no incluir la entrada deshecha;
  - no mutar el log (`JSON.stringify` igual antes y después).

  Además, `copyDay` de un día vacío devuelve `[]`; `hasCopy(log, hoy)` es false antes de añadir las copias y true después; y tras deshacer todas las copias vuelve a ser false.
- **FD19 (nuevo) — platos y catálogo.**
  - `mealNameTaken(' DESAYUNO ', [meal 'Desayuno'])` es true; con `'Cena'` es false; con `undefined` es false.
  - Las filas `tomato-canned`, `soy-sauce` y `rabbit-raw` tienen el `name` y el `ref` de §7.4 (`'170051'`, `'174278'`, `'172521'`).
  - `searchFoods` de `'tomate triturado'`, `'salsa de soja'` y `'conejo'` devuelve primero el id correcto.
  - `parseFoodVoice('200 g de conejo', [])` resuelve `rabbit-raw`.
- **GY23 (nuevo) — rutinas repetidas.** `readGym({ log: [], exercises: [], routines: [rA, { ...rA, name: 'Otra' }, rB] })` debe dar `routines` igual a `[rA, rB]` (gana la primera) y `dropped === 1`. Sin duplicados, `dropped === 0`.
- **CV13 (cambiado).** «Read 50 pages of the name of the wind» pasa de la lista de seguras a la de no seguras, porque `name` y `wind` son ajenas (regla aprobada en P39.3). Quedan seguras `['80kg bench press 5 reps', 'corrí 30 minutos']`. No seguras: `['press banca 80', 'ate a burguer', 'grounding 30 min', 'ayer leí 20 páginas', 'Read 50 pages of the name of the wind']`.
- **CV14 (nuevo) — `deviceSure` sin palabras ajenas.**
  - No seguras: `'I ran out of milk'`, `'corrí con mi perro'`.
  - Seguras: `'corrí 5 km'`, `'comí una hamburguesa'`, `'drank 3 beers'`, `'cómics 10 páginas'` (unidad propia del tracker) y `'fui al gimnasio'`.
  - `routeCapture('I ran out of milk', ctx)` sigue dando `tracker/running`, lo que documenta C3 sin clave.
  - `localCapture('ate a burguer', memo burguer → burgers).done` y `localCapture('burguer', mismo memo).done` siguen siendo true (se resuelven en el dispositivo por memoria O1, como en MC5).
- **Sin cambios:** CV1-CV12, MC1-MC5 (la memoria no usa `deviceSure` en `recall`, y en `localCapture` solo cambia qué frases resuelve el parser), FVZ10 (rama de comida intacta), FD1 (los nombres nuevos son únicos), FD14 y GY20.

### Vitest

- **`haiku.test.ts`:** en «O3: el dispositivo seguro no llama a fetch», sustituir «Read 50 pages…» por «corrí 5 km». En «O3: lo aproximado o incompleto sí llama a fetch», añadir «Read 50 pages of the name of the wind» e «I ran out of milk».
- **`App.test.tsx`:** leer localStorage con `vi.waitFor` (regla de §3 de ESTADO).
  - **U-V1:** con una prueba simulada (reconocimiento falso que devuelve texto) y la clave `sk-ant-test-XYZ` guardada, «Copiar resumen» llama a `clipboard.writeText` con un texto que contiene el agente, «Reconocimiento:», el resultado y «KEYBOARD_ON_IOS», y que no contiene `sk-ant-test-XYZ`; sale «Resumen copiado».
  - **U-V2:** si `writeText` rechaza, aparecen el `textarea` con el resumen y el aviso, y el `textarea` tiene el foco.
  - **U-C39-1:** con 2 entradas ayer y 0 hoy, «Copiar día anterior» deja 2 entradas hoy con `via: 'copy'`; el estado dice «Copiado: 2 alimentos…»; el botón queda desactivado con su motivo; un segundo clic no añade nada.
  - **U-C39-2:** «Deshacer» retira las 2 copias de un golpe y el botón se reactiva. Con un objetivo que la copia mete en rango, aparece el +1 de Dieta y el «Deshacer» lo retira (`dietNote`).
  - **U-C39-3:** sin entradas ayer, el botón está desactivado y se ve «Nada apuntado el día anterior.». Con el selector en ayer, copia desde anteayer al Diario de ayer.
  - **U-ML1:** guardar un plato con el nombre de otro plato muestra el error y no guarda.
  - **U-ML2:** «Borrar» con `confirm` false no borra; con true, borra.
  - **U-ML3:** `addMeal` con un plato inexistente (handler directo o carrera simulada) muestra «Ese plato ya no existe.». Si la carrera no se puede simular en UI, basta con cubrir `gone` en el hook o con FD19.
- **`a11y.test.tsx`:**
  - **A11Y-1:** axe sobre Ajustes con el resultado de «Probar voz» y el `textarea` de respaldo visible.
  - **A11Y-2:** axe sobre Comida con «Copiar día anterior» en sus estados activo y desactivado con pista.

### e2e

- **E-FD3 (`food.e2e.ts`, 320 px):** apuntar un alimento con el selector en «Ayer», volver a «Hoy», «Copiar día anterior», recargar y comprobar que la fila sigue en el Diario de hoy. «Deshacer» la quita. Sin scroll horizontal.

### Checklist manual

- [ ] Ajustes → «Probar voz» → «Copiar resumen» y pegar en una nota: están todos los campos y no está la clave.
- [ ] Comida en un día con objetivo: copiar ayer → el total y la barra se actualizan, y sale el toast de Dieta si entra en rango.
- [ ] El botón queda desactivado tras copiar; deshacer una sola copia desde el Diario lo deja desactivado mientras quede alguna viva.
- [ ] Recargar tras copiar: las copias persisten. Exportar, Importar y fusionar en otra pestaña no duplica.
- [ ] Borrar un plato pide confirmación; un nombre repetido da error.
- [ ] Buscar «conejo» → «Conejo crudo».
- [ ] 320 px sin scroll horizontal en Comida y Ajustes.
- [ ] `npm run dev`: `[selfcheck] done` sin fallos.

## 12. Handoff para Claude Code

1. Crea la rama `cycle-39` desde `main`. Lee esta spec y, del código, `food.ts`, `useFood.ts`, `FoodView.tsx`, `FoodMeals.tsx`, `capture.ts` (`deviceSure`), `classify.ts` (`exactHits`, `ALIASES`), `storage.ts` (`readGym`) y `VoiceCheck.tsx`.
2. Ejecuta T1 → T8 en orden, con un commit por tarea y el mensaje indicado. Tras cada una, pasa `npm run build`, `npm run lint` y `npm test` desde `app/`. Tras T4 y T7, además, `npm run e2e`.
3. No toques los asserts salvo CV13 (§11). Si otro assert falla, el error está en el motor.
4. No añadas dependencias. `core/` sigue puro. Paleta HERO en Comida y de app en Ajustes, sin hex ni `slate-*`.
5. No toques `KEYBOARD_ON_IOS`: eso es el ciclo 39b, con los resultados del iPhone.
6. Si algo de la spec contradice el código (p. ej. qué palabras son stopwords en CV14), ajusta el ejemplo del assert, no la regla, y anótalo en el commit.
