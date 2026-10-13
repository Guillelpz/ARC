# TECH SPEC — Ciclo 28: menos llamadas a Haiku en la captura por voz

Rama `cycle-28`. Petición aprobada en `docs/cycles/STATE.md` («Ciclo 28»): O3 + O1 con la decisión **M-B**.

## 1. Resumen

- **O3:** `interpretCapture` deja de llamar a Haiku cuando el dispositivo ya está seguro: otro día (C6), serie de gym completa con ejercicio reconocido o coincidencia **exacta y única** con una palabra del nombre o de un alias de un hábito activo. Las coincidencias aproximadas (prefijos, erratas) siguen yendo a Haiku.
- **O1:** memoria de frases confirmadas: frase normalizada sin números, unidades ni palabras vacías → `gym/<exerciseId>` o `tracker/<trackerId>`. Se aprende al guardar automáticamente una decisión de Haiku (o de la propia memoria), se borra al «Deshacer»/«Editar», se valida al usarla y la cantidad siempre la saca el parser.
- La memoria es una caché del dispositivo (M-B): clave propia en localStorage, fuera de copias, fusión, `backupCurrent` y «Recuperar copia anterior»; «Borrar todo» la vacía.
- **No entra:** alias aprendidos (O2), recorte del prompt (O4), botón para ver o vaciar la memoria, cambios en la pantalla Gym («Dictar serie», `interpretGym`; ver §3), cambios visibles en la UI.

## 2. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| «Coincidencia exacta» (O3) | Palabra de la frase (≥ 3 letras, sin stopwords ni unidades) **igual** a una palabra del nombre o de `ALIASES` (classify) de un hábito activo, y **un único hábito** con coincidencia exacta. Nueva función `exactTracker`. | Es la puntuación 3 de `matchTracker`; si dos hábitos empatan, se pregunta a Haiku. |
| Gym seguro (O3) | `routeCapture` da `gym` e `isComplete(draft)`. Gym incompleto → Haiku (puede completar). | `matchExercise` ya es exacto por alias. |
| Hábito seguro con cantidad que no encaja («corrí 30 minutos») | Seguro igualmente: no se llama a Haiku; sale el formulario como hoy. | Haiku no arregla la unidad del hábito; con `pickCapture` acababa igual. |
| Otro día | Si el router dice `other-day`, no se llama a Haiku. | `pickCapture` ya hacía ganar al parser: la llamada era inútil. Sin cambio de comportamiento. |
| Orden de decisión | otro día > seguro (O3) > memoria lista > Haiku (con respaldo memoria-no-lista ?? router). | El dispositivo seguro manda; la memoria solo cubre lo que antes iba a Haiku. |
| Memoria «lista» | Solo se salta Haiku si el comando de la memoria cumple `isReady`. Si no está lista: con clave y conexión se llama a Haiku (la memoria queda de respaldo); sin clave u offline se usa el comando de la memoria. | Una cantidad incompleta puede completarla Haiku. |
| Qué se aprende | Solo comandos `gym`/`tracker` con `source` `'ai'` o `'memory'` que se **guardaron automáticamente** en la captura. No se aprende de `new` (al crear, el nombre ya da coincidencia exacta O3), ni del formulario, ni de decisiones del parser. | Solo las decisiones de Haiku aportan algo que el dispositivo no sabe. |
| Cuándo se escribe | Al guardar (no hay temporizador). «Deshacer» y «Editar» de esa captura borran la entrada. Deshacer después desde la pantalla de misiones no la borra (`ponytail:`). | Es lo que pide O1 sin estado extra. |
| Clave de la frase | `memoKey(text)`: `captureNorm`, quitar números, `ALL_UNITS`, palabras de series/reps (`GYM_WORDS`) y `STOPWORDS`; unir con espacios; `null` si < 3 caracteres o si es otro día; máx. 120 caracteres. | «ate a burguer», «eat a burguer» y «burguer» → `burguer`. |
| Tope y expulsión | **200 entradas, LRU**: array en orden de uso; aprender o usar una entrada la mueve al final; al pasar de 200 se quita la primera. | ~20 KB como mucho; de sobra para las frases de una persona. Sin fechas. |
| Validación al usar | La entrada solo vale si el ejercicio está en `ctx.exercises` (activos) o el hábito en `ctx.trackers` y no archivado; si no, no se usa (no se borra: si se reactiva, vuelve a valer). | Cubre «Recuperar», importar y archivar sin tocar esos flujos. |
| Marca de origen | `source: 'ai' \| 'parser' \| 'memory'` en `Src` y `VoiceCommand`. | Hace falta para refrescar la LRU y no aprender del parser. |
| Gym desde la memoria | `parseGym(text, exercises, unit, forceId?)`: con `forceId` se usa ese ejercicio y se aplica su regla de peso corporal. | Reutiliza el parser entero para la cantidad. |
| Formato guardado | `life-rpg-capture-memo-v1` = `{"v":1,"entries":[{"k","kind","id"}]}`. Ilegible o `v` desconocida → memoria vacía, sin backup ni aviso. | Es una caché: perderla solo cuesta volver a llamar a Haiku. |

## 3. Decisiones que requieren aprobación

- **D1 — ¿O3 también en «Dictar serie» de la pantalla Gym (`interpretGym`)?** La petición habla de la captura del «+». Allí, una serie que el parser completa también se manda a Haiku, aunque solo se usa si Haiku la completa. **Recomendación: sí**, como tarea T6 opcional (una línea: si `isComplete(parsed)`, no se llama; más un test). Si no se aprueba, T6 no se hace y el resto no cambia.

No hay más: no hay backend, dependencias ni cambios de reglas de juego, y M-B ya cubre la persistencia.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/classify.ts` | + `exactTracker(norm, trackers, skip)`. |
| `app/src/core/voice.ts` | `VoiceCommand.source` admite `'memory'`; `parseGym(…, forceId?)`. |
| `app/src/core/capture.ts` | `Src.source` admite `'memory'`; `CaptureCtx.memo?: Memo`; `export` de `ALL_UNITS`; + `deviceSure(c, ctx)`. |
| `app/src/core/memory.ts` (nuevo) | `MEMO_MAX`, tipos `Memo`/`MemoEntry`, `memoKey`, `learn`, `forget`, `readMemo`, `recall`, `localCapture`. Puro, sin React ni localStorage. |
| `app/src/core/haiku.ts` | `interpretCapture` usa `localCapture` y solo llama a Haiku si no está resuelto. |
| `app/src/core/storage.ts` | + `MEMO_KEY`, `loadMemo`, `saveMemo`, `clearMemo`. Fuera de `isDataKey`, `backupCurrent`, `restoreLast`, export y fusión (no se tocan). |
| `app/src/App.tsx` | `interpretCapt` añade `memo: loadMemo()` al ctx; nuevos `learnCapture`/`forgetCapture`; `reset()` llama a `clearMemo()`. |
| `app/src/components/CaptureView.tsx` | Props `onLearn`/`onForget`; se llaman al guardar automáticamente y en Deshacer/Editar; `aiNote` pasa a `source !== 'ai'`. |
| `app/src/core/selfcheck.ts` | Asserts CV12-CV13 y MC1-MC5. |
| `app/src/core/haiku.test.ts`, `storage.test.ts`, `src/App.test.tsx` | Tests nuevos (§11). |
| `docs/ESTADO-ACTUAL.md`, `CLAUDE.md`, `AGENTS.md` | Documentar `memory.ts`, la clave y la regla O3. |

## 5. Modelos de datos

```ts
// memory.ts
export const MEMO_MAX = 200
export type MemoEntry = { k: string; kind: 'gym' | 'tracker'; id: string } // k = memoKey; id = exerciseId | trackerId
export type Memo = MemoEntry[] // orden de uso: el último es el más reciente

// capture.ts
export type Src = { text: string; source: 'ai' | 'parser' | 'memory'; aiError?: HaikuError }
export type CaptureCtx = { exercises: Exercise[]; trackers: Tracker[]; all: Tracker[]; unit: WeightUnit; memo?: Memo } // import type { Memo } from './memory'

// voice.ts
export type VoiceCommand = { kind: 'gym'; text: string; draft: GymDraft; source: 'ai' | 'parser' | 'memory'; aiError?: HaikuError }
```

`pickDraft` no cambia: sigue devolviendo `'ai' | 'parser'`.

## 6. Persistencia y migración

- Clave nueva `life-rpg-capture-memo-v1`, JSON `{ "v": 1, "entries": MemoEntry[] }`. No existe hoy, así que no hay migración: clave ausente = memoria vacía.
- `loadMemo(store = localStorage): Memo` → `readMemo(json(raw))`; cualquier excepción → `[]`.
- `saveMemo(m, store): boolean` → `setItem(MEMO_KEY, JSON.stringify({ v: 1, entries: m }))`; si falla (cuota), `false` y no se avisa (caché).
- `clearMemo(store): boolean` → `removeItem(MEMO_KEY)`.
- `readMemo(v: unknown): Memo`: si no es objeto o `v.v !== 1` o `entries` no es array → `[]`. Entradas válidas: `k` string de 1-120 caracteres, `kind` `'gym' | 'tracker'`, `id` string de 1-100 caracteres; las demás se descartan. Si hay claves `k` repetidas, se queda la última. Si quedan más de `MEMO_MAX`, se quedan las últimas `MEMO_MAX`.
- Como la clave de IA: `isDataKey(MEMO_KEY) === false`, no entra en `backupCurrent`, `restoreLast`, `exportBackup`, `parseBackup`, `mergeBackup` ni `lockStorage`. No hace falta tocar esas funciones; los tests lo fijan.
- «Borrar todo» (`reset()` en App, tras el `confirm` y el `backupCurrent` correctos): `clearMemo()`. La clave de IA y `life-rpg-voice-v1` siguen sin tocarse (decisión D del ciclo 26).
- Comentario en storage, junto a la clave: `// Memoria de frases de la captura (caché de este dispositivo, M-B): fuera de copias, fusión, backupCurrent y «Recuperar»; «Borrar todo» la vacía.`

## 7. Lógica de dominio

### 7.1 `exactTracker` (classify.ts)

```ts
// Hábito con coincidencia exacta de palabra (nombre o ALIASES) y único: si hay dos, undefined.
export function exactTracker(norm: string, trackers: Tracker[], skip: ReadonlySet<string> = new Set()): Tracker | undefined
```
Las palabras de la frase se filtran igual que en `matchTracker` (≥ 3 letras, sin números, sin `skip` ni `STOPWORDS`). Las del hábito, igual: `words(name + ALIASES)` sin `STOPWORDS`. Se buscan los hábitos con alguna `w === x`; si hay exactamente uno, se devuelve.

### 7.2 `deviceSure` (capture.ts)

```ts
export function deviceSure(c: CaptureCommand, ctx: CaptureCtx): boolean {
  if (c.kind === 'gym') return isComplete(c.draft, ctx.exercises)
  if (c.kind === 'tracker') return exactTracker(captureNorm(c.text), ctx.trackers, ALL_UNITS)?.id === c.trackerId
  return false
}
```
`ponytail:` coincidencia exacta por palabra suelta («I ran out of milk» → Running). Si aparecen falsos positivos, exigir que la palabra no vaya seguida de otra desconocida o mandar a Haiku las frases largas.

### 7.3 Memoria (memory.ts)

```ts
const GYM_WORDS = new Set('x por by rep reps repeticion repeticiones repetition repetitions serie series set sets kilogramo kilogramos'.split(' '))
export function memoKey(text: string): string | null
// captureNorm → si isOtherDay → null; quitar /^\d+(\.\d+)?$/, ALL_UNITS, GYM_WORDS y STOPWORDS; join(' ').slice(0, 120); null si < 3.

export function learn(m: Memo, c: CaptureCommand): Memo
// Devuelve el mismo `m` (misma referencia) si c.source no es 'ai'/'memory', c.kind no es gym/tracker, gym sin exerciseId o memoKey null.
// Si no: quita la entrada con el mismo k, añade { k, kind, id } al final y recorta por delante hasta MEMO_MAX.

export function forget(m: Memo, text: string): Memo
// Sin k o sin entrada → el mismo `m`; si no, filtrado.

export function recall(text: string, ctx: CaptureCtx): CaptureCommand | null
// k = memoKey(text); e = ctx.memo?.find(x => x.k === k).
// gym: si e.id no está en ctx.exercises → null; si no → { kind: 'gym', text, source: 'memory', draft: parseGym(text, ctx.exercises, ctx.unit, e.id) }.
// tracker: t = ctx.trackers.find(x => x.id === e.id && !x.archived); si no hay → null;
//   si no → { text, source: 'memory', kind: 'tracker', trackerId: t.id, ...resolveAmount(t, measures(captureNorm(text))) }.

export function localCapture(text: string, ctx: CaptureCtx): { cmd: CaptureCommand; done: boolean }
// parsed = routeCapture(text, ctx)
// parsed.kind === 'other-day' || deviceSure(parsed, ctx) → { cmd: parsed, done: true }
// mem = recall(text, ctx); mem && isReady(mem, ctx) → { cmd: mem, done: true }
// → { cmd: mem ?? parsed, done: false }
```

`parseGym` con `forceId`: `const m = forceId ? { id: forceId, alias: '' } : matchExercise(t, exercises)`, y el `replace` del alias solo si `m.alias !== ''`. Sin `forceId`, nada cambia (VZ1-VZ19 siguen igual).

### 7.4 `interpretCapture` (haiku.ts)

```ts
export async function interpretCapture(text, ctx, key, online, fetchImpl?) {
  const { cmd, done } = localCapture(text, ctx)
  if (done) return cmd
  const ai = key && online ? await askCapture(text, ctx, key, fetchImpl) : null
  const c = pickCapture(ai?.ok ? ai.cmd : null, cmd, ctx)
  return ai && !ai.ok ? { ...c, aiError: ai.error } : c
}
```
`pickCapture`, `routeCapture`, `captureFromAI` y el prompt no cambian (CV1-CV11 no se tocan). Actualizar el comentario de `interpretCapture`: «el dispositivo decide si está seguro (O3) o lo recuerda (O1); Haiku solo para lo demás».

## 8. UI

No hay pantallas ni textos nuevos. La única diferencia visible es que la respuesta es instantánea cuando el dispositivo está seguro o recuerda la frase.

`CaptureView`:
- Props nuevas `onLearn: (cmd: CaptureCommand) => void` y `onForget: (text: string) => void`.
- En `process`: tras `onSaveGym` correcto → `r.onLearn(cmd)`; en `tracker`, si `ev` → `r.onLearn(cmd)`. Nada en `new`, `form`, `other-day` ni `unknown`.
- `undoGym` y `editGym` → `ref.current.onForget(res.cmd.text)`; `undoTracker` y `editTracker` → `ref.current.onForget(res.text)`.
- `aiNote`: `res.cmd.source !== 'ai'` (en lugar de `=== 'parser'`), para que un respaldo de la memoria con 401/429 también avise.

`App.tsx`:
```ts
const learnCapture = (c: CaptureCommand) => { const m = loadMemo(), n = learn(m, c); if (n !== m) saveMemo(n) }
const forgetCapture = (text: string) => { const m = loadMemo(), n = forget(m, text); if (n !== m) saveMemo(n) }
```
`interpretCapt` añade `memo: loadMemo()` al ctx. La memoria no es estado de React: no se pinta, se lee al usarla (como `loadAiKey`). `reset()`: `clearMemo()` junto a `setEvents([])…`.

## 9. Backlog

Un commit por tarea en `cycle-28`. Cada tarea termina con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, y `[selfcheck] done` sin fallos.

**T1 — O3: el dispositivo seguro no llama a Haiku**
- Archivos: `classify.ts` (`exactTracker`), `capture.ts` (`deviceSure`, `export ALL_UNITS`), `haiku.ts` (`interpretCapture`: por ahora `const parsed = routeCapture(…); if (parsed.kind === 'other-day' || deviceSure(parsed, ctx)) return parsed`), `selfcheck.ts` (CV12, CV13), `haiku.test.ts`.
- Aceptación: con clave y en línea, `fetch` no se llama para «Read 50 pages of the name of the wind», «80kg bench press 5 reps», «corrí 30 minutos» ni «ayer leí 20 páginas»; sí se llama para «ate a burguer», «grounding 30 min» y «press banca 80». Los tests de captura actuales siguen verdes sin cambios.
- Commit: `feat(capture): sin llamada a Haiku si el dispositivo está seguro (O3)`.

**T2 — Memoria pura y `localCapture`** (depende de T1)
- Archivos: `memory.ts` (nuevo), `voice.ts` (`source`, `parseGym` con `forceId`), `capture.ts` (`Src.source`, `CaptureCtx.memo`), `haiku.ts` (`interpretCapture` según §7.4), `selfcheck.ts` (MC1-MC5), `haiku.test.ts`.
- Aceptación: sin `ctx.memo`, el comportamiento es idéntico al de T1. Con una memoria en el ctx, los casos de §11 pasan.
- Commit: `feat(core): memoria de frases de la captura (O1, puro)`.

**T3 — Persistencia de la memoria** (depende de T2)
- Archivos: `storage.ts` (`MEMO_KEY`, `loadMemo`, `saveMemo`, `clearMemo`, comentario M-B), `storage.test.ts`.
- Aceptación: tests de §11 (storage) en verde; `isDataKey(MEMO_KEY)` es false; `backupCurrent` no crea `life-rpg-capture-memo-v1.backup.*`.
- Commit: `feat(storage): clave de la memoria de la captura (caché del dispositivo)`.

**T4 — Conexión en la app** (depende de T3)
- Archivos: `App.tsx`, `CaptureView.tsx`, `App.test.tsx`.
- Aceptación: U-C8 a U-C10 de §11; los U-C* y U-V* actuales siguen verdes; e2e sin cambios (`npm run e2e` en verde).
- Commit: `feat(capture): aprende las frases confirmadas y las olvida al deshacer`.

**T5 — Documentación** (depende de T4)
- `docs/ESTADO-ACTUAL.md` (captura: O3, memoria y tope; nueva clave en persistencia), `CLAUDE.md` y `AGENTS.md` (viñeta de `capture.ts`/`memory.ts` y la clave en la de `storage.ts`, junto a `life-rpg-ai-key-v1`: fuera de copias, fusión, `backupCurrent` y «Recuperar»; «Borrar todo» sí la vacía).
- Commit: `docs: memoria de la captura y O3`.

**T6 — (solo si se aprueba D1) O3 en `interpretGym`**
- `haiku.ts`: si `isComplete(parsed, exercises)` → `{ kind: 'gym', text, draft: parsed, source: 'parser' }` sin llamar. `haiku.test.ts`: con clave, «80 kilos press banca 5 repeticiones» no llama a `fetch`. Revisar U-V8 en `App.test.tsx`: hoy espera 2 llamadas con frases completas; pasa a usar frases que el parser no completa (p. ej. «press banca 80» → 500 y «sentadilla 100» → 401) y mantiene las aserciones del aviso.
- Commit: `feat(voice): serie completa sin llamada a Haiku en Gym`.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| Falsos positivos de O3 (palabra exacta en una frase que habla de otra cosa) | Unicidad, `ponytail:` documentado; con «Deshacer», el error se corrige en un toque. | Limitar O3 a frases de ≤ 4 palabras útiles. |
| La memoria aprende una decisión mala que nadie deshace | Solo aprende de Haiku; Deshacer/Editar borra; LRU de 200. | — |
| Memoria apuntando a hábitos o ejercicios que ya no existen (importar, «Recuperar», archivar) | `recall` valida contra los activos del ctx. | — |
| Colisión de claves por quitar stopwords («no bebí cerveza» y «bebí cerveza» → `no cerveza` frente a `cerveza`: no colisionan; otras sí podrían) | Las colisiones apuntan a la misma actividad en la práctica; Deshacer la corrige. | Dejar de quitar `STOPWORDS` en `memoKey` (MC1 cambia). |
| Tests de UI que cuentan llamadas a `fetch` | Revisados: U-V7 y U-C4 usan frases que siguen yendo a Haiku; U-V8 usa `interpretGym` (solo cambia con T6). | — |
| T4 se complica | T1 ya aporta la mayor parte de la rapidez y es desplegable sola. | Cerrar el ciclo con T1 (y T6); O1 queda para otro ciclo. |

## 11. Verificación

**selfcheck (nuevos; CV1-CV11 y VZ* no cambian).** Usar el `ctx` del bloque CV (añadir los asserts dentro de ese bloque).
- **CV12 `exactTracker`:** «Read 50 pages of the name of the wind» → reading; «corrí 5 km» → running; «fui al gimnasio» → gym; «ate a burguer» → undefined (errata); «lectur» → undefined (prefijo); `exactTracker('shower 10 min', [Cold shower, Hot shower])` → undefined (dos exactas).
- **CV13 `deviceSure`** sobre `routeCapture`: true para «80kg bench press 5 reps», «Read 50 pages of the name of the wind» y «corrí 30 minutos»; false para «press banca 80» (gym incompleto), «ate a burguer», «grounding 30 min» y «ayer leí 20 páginas».
- **MC1 `memoKey`:** «Read 50 pages of the name of the wind» y «Read 30 pages of the name of the wind» → `read name wind`; «ate a burguer», «eat a burguer» y «burguer» → `burguer`; «la máquina de piernas 100 10» y «máquina de piernas 120 kilos 8 repeticiones» → `maquina piernas`; «30» → null; «ayer leí 20 páginas» → null.
- **MC2 `learn`/`forget`:** `source: 'parser'` → la misma referencia; un tracker `'ai'` → 1 entrada; volver a aprender la misma clave con otro id → 1 entrada con el id nuevo; 201 claves distintas → 200 y la primera ya no está; aprender con `'memory'` una entrada antigua la mueve al final; `forget` la quita; `forget` de una frase desconocida → la misma referencia.
- **MC3 `readMemo`:** `null`, `'x'`, `{ v: 2, entries: [] }` → `[]`; se descartan las entradas con `kind` desconocido, `k` vacío o `id` no string; con `k` repetida queda la última; 250 válidas → las últimas 200.
- **MC4 `recall`:** memoria `maquina piernas → gym leg-press`: «máquina de piernas 120 kilos 8» → gym leg-press 120 × 8, completo, `source: 'memory'`; `barra alta → gym pull-up`: «barra alta 12» → 0 kg × 12, completo (regla de peso corporal); `bread → tracker reading`: «bread 20 pages» → reading 40; hábito archivado o inexistente → null; ejercicio fuera de la lista activa → null; sin `memo` → null.
- **MC5 `localCapture`:** «ayer leí 20 páginas» → done, `other-day`; «80kg bench press 5 reps» → done, `parser`; «ate a burguer» sin memoria → no done, `parser`; con `burguer → burgers` → done, `memory`, burgers 1; memoria `maquina piernas` + «máquina de piernas 100» (incompleto) → no done, `cmd.source === 'memory'`; memoria que apunta a un archivado → no done, `cmd` = el del router.

**Vitest.**
- `haiku.test.ts`: casos de aceptación de T1; memoria lista → `fetch` no se llama; memoria incompleta con clave → 1 llamada, y si Haiku falla (500) el resultado es el de la memoria con `aiError`; memoria sin clave → comando de la memoria.
- `storage.test.ts`: `loadMemo` con clave ausente, JSON roto y válido; `saveMemo`/`clearMemo`; `isDataKey(MEMO_KEY) === false`; `backupCurrent` y `exportBackup` no la incluyen.
- `App.test.tsx`:
  - **U-C8:** con clave, «la máquina de piernas 100 10» (Haiku responde leg-press) se registra; después, «máquina de piernas 120 8» → «Registrado: Prensa · 120 kg × 8» con `fetch` llamado 1 vez en total.
  - **U-C9:** tras U-C8, «Deshacer» → la entrada desaparece de `life-rpg-capture-memo-v1` y la frase siguiente vuelve a llamar a `fetch`.
  - **U-C10:** con memoria y clave de IA guardadas, «Borrar todo» elimina `life-rpg-capture-memo-v1` y conserva `life-rpg-ai-key-v1`; el JSON exportado no contiene la clave ni las frases.

**Checklist manual (dev y PWA en iPhone).**
- [ ] Con clave: «leí 20 páginas» se registra al instante (sin la pausa de 1-2 s); «comí una burguer» tarda como antes.
- [ ] Una frase rara resuelta por Haiku, repetida con otra cantidad, sale al instante y con la cantidad nueva.
- [ ] En modo avión, con la PWA abierta y una frase aprendida escrita en el campo de texto, se registra.
- [ ] Deshacer y repetir: vuelve a preguntar a Haiku (pausa visible).
- [ ] Archivar el hábito aprendido: la frase ya no lo usa; al reactivarlo, vuelve a funcionar.
- [ ] «Borrar todo» y recargar: la memoria está vacía y la clave de IA sigue en Ajustes.

## 12. Handoff para Claude Code

1. Lee `CLAUDE.md`, esta spec y `capture.ts`, `haiku.ts`, `voice.ts`, `classify.ts` (`matchTracker`) y `CaptureView.tsx`. Trabaja en `cycle-28`.
2. Sigue T1 → T5 en orden, con un commit por tarea y build/lint/test en verde en cada una. T6 solo si el usuario aprueba D1.
3. No toques `routeCapture`, `pickCapture`, `captureFromAI`, el prompt ni el esquema: CV1-CV11 y VZ* deben pasar sin cambios. Si un assert existente falla, el fallo está en el motor.
4. La memoria nunca entra en copias, fusión, `backupCurrent` ni `restoreLast`: no añadas `MEMO_KEY` a esas listas. Solo «Borrar todo» la vacía.
5. Añade los `ponytail:` de §2 y §7.2 (O3 por palabra suelta; Deshacer desde misiones no olvida la frase).
6. Al terminar: `npm run e2e` y el checklist manual en dev; la prueba en iPhone la hace el usuario.
