# TECH SPEC — Ciclo 40: almacenamiento y voz sin clave

Fuente: `docs/cycles/cycle-40/evaluation.md` y decisiones D1 y D3 de `docs/cycles/STATE.md` (sección «Ciclo 40»). Orden: **P40.1 → P40.2**. P40.3, P40.4 y P40.5 no entran.

## 1. Resumen

- **P40.1:** función pura `storageUsage` en `storage.ts` que mide (en caracteres, clave + valor) todas las claves `life-rpg-*`, agrupadas en datos, copias internas (`.backup.last/.prev`), copias selladas (`.backup.<stamp>`) y caché del dispositivo. En «Tus datos», una línea «Espacio usado: aprox. X MB de ~5 MB (N %)» y un aviso persistente desde el 70 %. **No se purga nada (D3)**: las copias selladas solo se cuentan y se mencionan en el aviso.
- **P40.2:** cuando la frase la resuelve el parser (sin clave, sin conexión o con Haiku caído), un hábito existente sin `deviceSure` y sin cantidad dicha **no se guarda solo**: sale la tarjeta «¿Apuntar en X?» con «Apuntar» y «Descartar» (D1). Además: la cuenta atrás de «hábito nuevo» no arranca si la pestaña ya está oculta; assert MC6 de «100kg» en `memoKey` (sin tocar `memoKey`); U-V1 y U-M3 más estrictos.
- **No entra:** purgar ni exportar `.backup.<stamp>`, IndexedDB, compactar el log, olvidar la frase al deshacer desde misiones (P39.2), fechas tipo «el 3 de octubre», cambios en Haiku, en la memoria o en Comida por voz.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Unidad de medida | Caracteres (`key.length + value.length`) de las claves que empiezan por `life-rpg-`. Se muestran como «MB» con 1 M de caracteres ≈ 1 MB y la palabra «aprox.» | Chrome y Safari limitan por unidades UTF-16 (~5 M por origen). La cuota real no se puede consultar: `navigator.storage.estimate()` no cubre localStorage. |
| Cuota de referencia | `STORAGE_QUOTA = 5_000_000` y `USAGE_WARN = 0.7` | Es el límite habitual. El 70 % deja margen para exportar. |
| Claves ajenas del origen | No se miden. El texto avisa de que el porcentaje es orientativo porque otras apps del mismo dominio comparten el espacio | Se sigue lo que pide el evaluador y no se leen datos de otras apps. |
| Cuándo se mide | En un efecto de `App.tsx` con dependencias `[screen, events, custom, gym, food]` que solo mide si `screen === 'home'`, declarado **después** de los efectos de guardado. Nunca en el render | Así se mide al abrir Inicio («Tus datos» está siempre en Inicio) y después de cada guardado hecho en Inicio. |
| Dónde se avisa | Solo en «Tus datos», que ya tiene «Exportar copia» al lado | No hace falta un botón nuevo ni otro banner en cada pantalla. |
| Copias selladas | Se cuentan (`sealed`, `sealedCount`) y, si existen, se mencionan en el aviso; no hay acción para borrarlas | D3. |
| Criterio de D1 | Función pura `needsConfirm(c, ctx)` en `capture.ts`: `kind === 'tracker'`, `source === 'parser'`, cantidad lista (`amount !== null && problem === null`), `said === null` y `!deviceSure(c, ctx)` | Reutiliza `deviceSure` y `resolveAmount`. Un número suelto («corrí 5») cuenta como cantidad dicha, porque `said` no es null. |
| Dónde se marca | `interpretCapture` (haiku.ts) añade `confirm: true` al comando solo si Haiku **no** respondió bien (`!ai?.ok`). El camino `done` de `localCapture` no se marca | Si Haiku respondió, decide Haiku, aunque `pickCapture` elija la cantidad del parser. `done` solo sale si el comando es `deviceSure`, viene de la memoria (O1) o es de otro día. |
| Memoria (O1) | `source: 'memory'` no pide confirmación | La frase ya la confirmó Haiku antes. |
| Botones de la tarjeta | «Apuntar» y «Descartar». **No** se repite «Escribir a mano»: el botón de arriba de la pantalla ya abre el formulario con lo oído | Dos botones con el mismo nombre son un problema de accesibilidad y vuelven ambiguos los tests. |
| Cuenta atrás | Ninguna en la tarjeta «¿Apuntar en X?» | Regla del evaluador: nunca hay cuenta atrás en un hábito existente. |
| «100kg» en `memoKey` | Solo se añade el assert MC6; `memoKey` no cambia | `normalizeVoice` ya separa número y letra (`voice.ts:84`). |
| Assert de `voiceSummary` | Se refuerza U-V1 (no contiene `sk-ant-`); no hay assert en selfcheck | `voiceSummary` vive en `components/`, no recibe la clave y U-V1 ya la prueba por la UI. |

## 3. Decisiones que requieren aprobación

Ninguna. D1 y D3 ya están decididas. Lo demás son detalles técnicos que siguen la evaluación. Consecuencia ya aceptada en D1: el ejemplo del ciclo 27 «ate a burguer» sin clave pasa a pedir confirmación. Cambian U-C2, A-C3, E11 y la checklist de `DEPLOY.md`.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | `STORAGE_QUOTA`, `USAGE_WARN`, tipo `Usage`, `storageUsage()`, `usageWarn()`; se reescribe el `ponytail:` de `saveFood` (línea ~296). |
| `app/src/core/storage.test.ts` | Casos de `storageUsage`/`usageWarn`. |
| `app/src/core/capture.ts` | `confirm?: true` en la variante `tracker` de `CaptureCommand`; `needsConfirm()`; se actualiza el `ponytail:` de `deviceSure`. |
| `app/src/core/haiku.ts` | `interpretCapture` marca `confirm`. |
| `app/src/core/haiku.test.ts` | Se ajustan 3 casos y se añaden los de D1. |
| `app/src/core/selfcheck.ts` | Asserts nuevos SU1, CV15 y MC6. Ninguno existente cambia. |
| `app/src/App.tsx` | Estado `usage` y efecto de medida; prop `usage` a `HomeView`. |
| `app/src/components/HomeView.tsx` | Línea de espacio usado y aviso en «Tus datos». |
| `app/src/components/CaptureView.tsx` | `Res` `{ k: 'ask' }`, `confirmAsk()`, texto de estado y panel de la rama. |
| `app/src/components/CaptureCards.tsx` | Componente `ConfirmTracker`; `NewHabitCard` para la cuenta atrás si la pestaña ya está oculta al montarse. |
| `app/src/App.test.tsx`, `app/src/a11y.test.tsx`, `app/e2e/capture.e2e.ts` | Tests nuevos y ajustados (§11). |
| `docs/ESTADO-ACTUAL.md`, `docs/DEPLOY.md` | Estado del producto y checklist de captura. |

## 5. Modelos de datos

```ts
// storage.ts
export const STORAGE_QUOTA = 5_000_000 // caracteres; ponytail: estimado, la cuota real de localStorage no se puede consultar y la comparten otras apps del mismo origen
export const USAGE_WARN = 0.7
export type Usage = {
  total: number       // suma de todo lo de abajo (solo claves life-rpg-*)
  data: number        // life-rpg-demo-v1, -custom-v1, -gym-v1, -food-v1
  backups: number     // <clave>.backup.last y <clave>.backup.prev
  sealed: number      // <clave>.backup.<AAAAMMDDTHHMMSS> (copias de datos dañados, no se purgan: D3)
  sealedCount: number
  device: number      // resto de life-rpg-*: meta, voz, clave de IA, memoria de frases, privacidad de Comida
}

// capture.ts — solo cambia la variante tracker
| Src & { kind: 'tracker'; trackerId: string; amount: number | null; said: Measure | null; problem: Problem | null; food?: FoodItem[]; confirm?: true } // confirm = D1: pedir «¿Apuntar en X?»
```

`confirm` no se persiste nunca. Viaja solo del intérprete a la vista.

## 6. Persistencia y migración

- No cambia ningún formato persistido ni ninguna clave. No hay migración.
- `storageUsage` solo lee (`length`, `key`, `getItem`). Si el almacenamiento lanza un error (modo privado, permisos), devuelve `null` y la UI oculta la línea.
- Las copias selladas se conservan tal cual (D3).

## 7. Lógica de dominio

### 7.1 `storageUsage` y `usageWarn` (storage.ts)

```ts
const SEALED = /\.backup\.\d{8}T\d{6}$/      // mismo sello que loadAll
const INTERNAL = /\.backup\.(?:last|prev)$/
export function storageUsage(store: Pick<Storage, 'length' | 'key' | 'getItem'> = localStorage): Usage | null
```

- Recorre `i = 0..store.length-1` con `k = store.key(i)` y se salta los `null` y las claves que no empiezan por `life-rpg-`.
- `n = k.length + (store.getItem(k)?.length ?? 0)`.
- Cada clave va a un solo grupo, en este orden:
  1. `SEALED` → `sealed` (y `sealedCount++`);
  2. `INTERNAL` → `backups`;
  3. `KEY`/`CUSTOM_KEY`/`GYM_KEY`/`FOOD_KEY` → `data`;
  4. cualquier otra → `device`.
- `total = data + backups + sealed + device`.
- Si algo lanza un error, devuelve `null`.

`usageWarn = (u: Usage): boolean => u.total >= USAGE_WARN * STORAGE_QUOTA`.

Nuevo texto del `ponytail:` de `saveFood`: primero hay que medir `JSON.stringify(makeEntry(...)).length` con una entrada real del catálogo y poner esa cifra. La plantilla es: «~N caracteres por entrada de comida y ~10 al día → ~X M al año; `.backup.last/.prev` pueden triplicarlo tras importar o borrar: con uso intenso de Comida el límite (~5 M) llega en ~Y años. `storageUsage` lo mide y «Tus datos» avisa al 70 %; el fallo sigue avisándose con SaveFailBanner.»

### 7.2 `needsConfirm` (capture.ts)

```ts
// D1 (ciclo 40): lo que resuelve el parser (sin clave, sin conexión o con Haiku caído) solo se guarda solo si el dispositivo está
// seguro (deviceSure) o hay una cantidad dicha que resolveAmount acepta. Si no, la vista pregunta «¿Apuntar en X?».
export function needsConfirm(c: CaptureCommand, ctx: CaptureCtx): c is Extract<CaptureCommand, { kind: 'tracker' }> {
  return c.kind === 'tracker' && c.source === 'parser' && c.amount !== null && c.problem === null && c.said === null && !deviceSure(c, ctx)
}
```

El `ponytail:` de `deviceSure` (líneas 182-185) pasa a decir: «sin clave o con Haiku caído, un hábito no seguro y sin cantidad dicha no se guarda solo: `needsConfirm` (D1). Palabras de < 3 letras se ignoran (como exactHits). Una frase mixta hábito + comida ya no es segura.»

### 7.3 `interpretCapture` (haiku.ts)

```ts
const { cmd, done } = localCapture(text, ctx)
if (done) return cmd
const ai = key && online ? await askCapture(text, ctx, key, fetchImpl) : null
const c = pickCapture(ai?.ok ? ai.cmd : null, cmd, ctx)
const out = ai && !ai.ok ? { ...c, aiError: ai.error } : c
return !ai?.ok && needsConfirm(out, ctx) ? { ...out, confirm: true } : out
```

`interpretFood`, `pickCapture`, `routeCapture`, `memory.ts` y `learn` no cambian. `learn` ya ignora `source: 'parser'`.

### 7.4 Casos resultantes, sin clave

| Frase | Hoy | Ciclo 40 |
|---|---|---|
| «I ran out of milk» | Running +1 guardado | «¿Apuntar en Running?» |
| «ate a burguer», «leí un libro» | guardado | tarjeta |
| «comí una hamburguesa», «corrí 5 km», «fui al gimnasio» (`deviceSure`) | guardado | guardado (sin cambios) |
| «Read 50 pages of the name of the wind», «corrí 5» (cantidad dicha) | guardado | guardado (sin cambios) |
| «corrí 30 minutos» (`problem: 'unit'`) | formulario de cantidad | igual |
| Con clave y Haiku OK | decide Haiku | igual |
| Con clave y Haiku 401/500/timeout o sin conexión | parser guardado | tarjeta (con nota de IA si hay `aiError`) |

## 8. UI

### 8.1 «Tus datos» (HomeView, paleta neutral `app-*`)

- Nueva prop `usage: Usage | null`. Si es `null`, no se muestra nada nuevo.
- Debajo del estado de la copia va una línea con `text-xs leading-5 text-app-muted`: `Espacio usado: aprox. {mb(total)} de ~5 MB ({pct} %). Orientativo: el navegador no deja consultar su límite y lo comparten otras apps del mismo dominio.`
  - `mb(n)`: `n < 100_000` → `< 0,1 MB`; si no, `(n / 1e6).toFixed(1).replace('.', ',') + ' MB'`.
  - `pct = Math.round(total / STORAGE_QUOTA * 100)`; si `total > 0` y el redondeo da 0, se muestra `< 1`.
- Con `usageWarn(usage)` sale un aviso persistente, con el mismo patrón que `copy.due` (`<p>` con `CircleAlert`, `text-sm text-app-text`): `El espacio de este navegador está casi lleno (aprox. {pct} %). Exporta una copia ahora: si se llena, lo que apuntes dejará de guardarse.`
  - Si además `sealedCount > 0`, se añade: ` Incluye {n} {copia|copias} de datos dañados (aprox. {mb(sealed)}) que solo se borran desde las herramientas del navegador.`
- No hay `role="status"` nuevo: es un aviso estático de la sección, no un cambio en vivo.

### 8.2 App.tsx

```ts
const [usage, setUsage] = useState(() => storageUsage())
// oxlint-disable-next-line react/set-state-in-effect -- medir tras guardar (mismo patrón que los efectos de guardado)
useEffect(() => { if (screen === 'home') setUsage(storageUsage()) }, [screen, events, custom, gym, food])
```

Va justo después de los tres efectos de guardado. El de `food` se ejecuta antes porque está dentro de `useFood`, que se llama antes. Se pasa `usage={usage}` a `HomeView`.

### 8.3 Tarjeta «¿Apuntar en X?» (CaptureView + CaptureCards)

- `Res` añade `| { k: 'ask'; cmd: Extract<CaptureCommand, { kind: 'tracker' }>; t: Tracker }`.
- En `process`, caso `'tracker'`, después de encontrar `tr`: `if (cmd.confirm && cmd.amount !== null) { setMode('idle'); setRes({ k: 'ask', cmd, t: tr }); return }`. No llama a `onAdd` ni a `onLearn`.
- `confirmAsk()`:
  - Llama a `ref.current.onAdd(t.id, cmd.amount!)`.
  - Si devuelve un evento: `setRes({ k: 'trk', text: cmd.text, t, ev, note: convNote(cmd.said, cmd.amount), food: cmd.food ?? null, fres: null }); focusMic()`. FV4 «Apuntar también en Comida» sigue igual.
  - Si devuelve `null`: `setRes({ k: 'form', text: cmd.text, t, problem: null, amount: cmd.amount })`.
  - No llama a `onLearn`.
- «Descartar» → `close()`. No guarda nada.
- `statusText` para `'ask'`: `¿Apuntar en ${t.name}? +${amount} ${unitFor(amount, t.unit)}. Aún no se ha apuntado nada.` Va sin `font-semibold`.
- `branch`: `'ask'` usa `CARD[res.t.branch]`, con la paleta de la rama como `trk`/`form`.
- `ConfirmTracker` (CaptureCards.tsx), con `{ tracker, heard, aiDown, onConfirm, onDiscard }`:
  - `<p>` muted `Oído: «{heard}»`.
  - Si `aiDown` (= `cmd.aiError !== undefined`): `<p>` muted `La IA no ha respondido: interpretado en el dispositivo.`
  - Botones: «Apuntar» (`${c.secondary} font-semibold`, recibe el foco al montarse con `ref` + `useEffect`, como el input de `TrackerResult`) y «Descartar» (`c.link`).
  - Sin cuenta atrás.
- El «Escribir a mano» de arriba ya abre `UnknownView` con `heard.current`. No cambia.

### 8.4 Cuenta atrás con la pestaña oculta (NewHabitCard)

En el efecto de `visibilitychange`, antes de suscribirse: `if (document.visibilityState === 'hidden') { onStop(); return }`. Así, si la tarjeta aparece con la pestaña ya oculta, la cuenta atrás se para y el aviso pasa a «Cuenta atrás parada. Revisa la propuesta.».

## 9. Backlog

Rama `cycle-40`. Cada tarea cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.

**T1 — Medir el almacenamiento (core).**
- Archivos: `storage.ts`, `storage.test.ts`, `selfcheck.ts`.
- Qué: §5 y §7.1, y el nuevo texto del `ponytail:` de `saveFood` con la cifra medida.
- Depende de: —
- Aceptación: SU1 pasa y los casos ST-U1…U4 de §11 pasan. Sin cambios visibles.

**T2 — «Tus datos» muestra el espacio y avisa.**
- Archivos: `App.tsx`, `HomeView.tsx`, `App.test.tsx`, `a11y.test.tsx`.
- Qué: §8.1 y §8.2.
- Depende de: T1.
- Aceptación: U-S1, U-S2 y A-S1 pasan; lint sin warnings (el `oxlint-disable` lleva su motivo).

**T3 — Criterio D1 en core.**
- Archivos: `capture.ts`, `haiku.ts`, `selfcheck.ts`, `haiku.test.ts`.
- Qué: §5 (`confirm`), §7.2 y §7.3, y CV15.
- Depende de: —
- Aceptación: CV15 pasa, los casos de `haiku.test.ts` de §11 pasan y los asserts existentes no cambian. La UI aún ignora `confirm` (la app sigue igual).

**T4 — Tarjeta «¿Apuntar en X?».**
- Archivos: `CaptureView.tsx`, `CaptureCards.tsx`, `App.test.tsx`, `a11y.test.tsx`, `e2e/capture.e2e.ts`.
- Qué: §8.3.
- Depende de: T3.
- Aceptación: U-C2 (ajustado), U-C9, U-C10, A-C3 (ajustado), A-C4 y E11 (ajustado) pasan; `npm run e2e` en verde.

**T5 — Cuenta atrás con la pestaña ya oculta.**
- Archivos: `CaptureCards.tsx`, `App.test.tsx`.
- Qué: §8.4.
- Depende de: —
- Aceptación: U-C4c pasa; U-C4 y U-C4b siguen verdes.

**T6 — Asserts y tests menores.**
- Archivos: `selfcheck.ts`, `App.test.tsx`.
- Qué: MC6, U-M3 reforzado y U-V1 reforzado (§11).
- Depende de: —
- Aceptación: pasan.

**T7 — Documentación.**
- Archivos: `docs/ESTADO-ACTUAL.md`, `docs/DEPLOY.md`.
- Depende de: T1–T6.
- Qué:
  - **ESTADO-ACTUAL:** fecha de corte (ciclo 40).
  - **§2 Inicio:** añadir la línea de espacio y el aviso del 70 %.
  - **§2 Nuevo:** sin clave o con Haiku caído, un hábito no seguro y sin cantidad dicha pide «¿Apuntar en X?».
  - **§3 Persistencia:** `storageUsage`/`usageWarn`; los sellados siguen sin purgarse (D3).
  - **§3 Voz:** CV1-CV15 y MC1-MC6; `needsConfirm`.
  - **§4 Persistencia:** el espacio ya se mide y se avisa al 70 %; sigue sin purga ni compactación.
  - **§4 Voz:** quitar las deudas cerradas: «memoKey no separa 100kg», que era falsa y ahora fija MC6; «sin clave el router sigue guardando "I ran out of milk"»; la cuenta atrás con la pestaña oculta; el assert de `voiceSummary`; U-M3 débil.
  - **DEPLOY.md, línea ~98:** «ate a burguer» → Burgers +1 **con clave**; sin clave, «¿Apuntar en Burgers?» → «Apuntar» → Burgers +1. Añadir «I ran out of milk» sin clave → tarjeta, nada guardado hasta «Apuntar».
- `CLAUDE.md`/`AGENTS.md` (`needsConfirm` en `capture.ts`, `storageUsage` en `storage.ts`, CV1-CV15/MC1-MC6) los actualiza el cycle-analyst tras el merge.

## 10. Riesgos

| Riesgo | Prevención | Recorte si se complica |
|---|---|---|
| Medir cuesta (con varios MB, `getItem` copia cadenas grandes) | Solo en Inicio y tras cambios de datos, nunca en el render. `ponytail:` en el efecto: «con >3 MB, medir solo al entrar en Inicio» | Quitar `events/custom/gym/food` de las dependencias: se mide solo al entrar en Inicio. |
| El porcentaje engaña (Firefox cuenta distinto; otras apps del dominio) | «aprox.», «orientativo» y aviso al 70 %, no al 95 % | — |
| Happy-dom aplica cuota y U-S2 falla al escribir 3,6 M | Probar primero. Si lanza, U-S2 pasa a cubrirse con ST-U3 (`usageWarn`) más una prueba de `HomeView` aislada con `usage` inyectado | U-S2 con render de `HomeView` y props mínimas. |
| D1 molesta en el uso sin clave (más toques) | Lo aceptó el usuario. La memoria y `deviceSure` siguen guardando solos lo seguro | — |
| `confirm` con FV4 (comida adjunta) | `confirmAsk` pasa `food` a `trk` igual que hoy | — |
| Tests que dependían de «ate a burguer» guardado solo | Lista cerrada: U-C2, A-C3, E11 y `haiku.test` (3 casos). Ninguno más usa esas frases (grep hecho) | — |

## 11. Verificación

### Asserts de `selfcheck.ts` (nuevos; ningún assert existente cambia)

- **SU1 storageUsage.** Con un store falso `{ length, key(i), getItem }` con estas claves:
  - `life-rpg-demo-v1` = `'[]'`;
  - `life-rpg-food-v1.backup.last` = `'abc'`;
  - `life-rpg-food-v1.backup.20261008T123456` = `'xyz'`;
  - `life-rpg-ai-key-v1` = `'sk'`;
  - `otra-app` = `'zzzz'`.

  Se comprueba:
  - `data`, `backups`, `sealed` y `device` son la longitud de clave + valor de su clave;
  - `sealedCount === 1`;
  - `total` es su suma (sin `otra-app`);
  - un store cuyo `key` lanza → `null`;
  - `usageWarn({ ...u, total: 3_500_000 })` es `true` y con `3_499_999` es `false`.
- **CV15 needsConfirm.** Con el `ctx` de CV1–CV14 y `nc = t => needsConfirm(routeCapture(t, ctx), ctx)`:
  - `true` para «I ran out of milk», «ate a burguer» y «leí un libro»;
  - `false` para «corrí 5 km», «comí una hamburguesa», «fui al gimnasio», «Read 50 pages of the name of the wind», «corrí 5», «corrí 30 minutos» (`problem`), «80kg bench press 5 reps» (gym) y «grounding 30 min» (new);
  - `false` para un tracker igual a «ate a burguer» con `source: 'ai'` y con `source: 'memory'`.
- **MC6 memoKey con número pegado.** `memoKey('máquina de piernas 100kg 10') === 'maquina piernas'`, `memoKey('press banca 80kg 5') === memoKey('press banca 80 kg 5')`, y `memoKey('3x5 press banca') === 'press banca'`.

### Tests

- **`storage.test.ts`**
  - ST-U1: la clasificación de SU1, con `fakeStore` ampliado con `length`/`key`.
  - ST-U2: se ignoran las claves sin el prefijo `life-rpg-`.
  - ST-U3: el umbral exacto de `usageWarn`.
  - ST-U4: un `getItem` que lanza → `null`.
- **`haiku.test.ts`**
  - «sin clave u offline…»: `expect(a).toEqual({ ...routeCapture('ate a burguer', ctx), confirm: true })`.
  - «401» y «trackerId inventado»: añadir `confirm: true` al `toMatchObject`.
  - Nuevo: «corrí 5 km» sin clave no lleva `confirm`.
  - Nuevo: «I ran out of milk» con 500 → `{ kind: 'tracker', trackerId: 'running', confirm: true, aiError: 'http' }`.
  - Nuevo: Haiku OK que devuelve `tracker` burgers (`reply({ ...cap, kind: 'tracker', trackerId: 'burgers', amount: null })`) → `source: 'ai'`, sin `confirm`.
  - Nuevo: memoria lista («ate a burguer» + `burg`) → sin `confirm`.
- **`App.test.tsx`**
  - **U-C2 (ajustado):** sin clave, «ate a burguer» en «Nuevo»:
    - sale `¿Apuntar en Burgers? +1 unidad. Aún no se ha apuntado nada.` y `net('burgers') === 0`;
    - el foco está en «Apuntar»; al pulsarlo sale `Registrado: Burgers · +1 unidad · +20 VILLAIN XP`;
    - después, el flujo actual de Editar → 2 → Apuntar.
  - **U-C9 (nuevo):** sin clave, «I ran out of milk»:
    - sale la tarjeta «¿Apuntar en Running?»;
    - con `vi.waitFor`, `stored()` sigue vacío;
    - «Descartar» quita la tarjeta y no guarda nada;
    - el botón «Escribir a mano» de arriba abre `UnknownView` con la frase.
  - **U-C10 (nuevo):** con clave y `fetch` → 500, «I ran out of milk»:
    - tarjeta, más el texto «La IA no ha respondido: interpretado en el dispositivo.»;
    - `fetch` se llama 1 vez y no se guarda nada.
  - **U-C4c (nuevo):** con `vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')` antes de `dictateNewWithKey()`:
    - tras 12 `tick(1000)`, `customTrackers()` sigue vacío;
    - sale «Cuenta atrás parada. Revisa la propuesta.».
  - **U-M3 (reforzado):** «Cargar ejemplo», memoria y clave guardadas, «Exportar copia»:
    - `const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob; const text = await blob.text()`;
    - `text` no contiene `KEY2`, `'maquina'` ni `'life-rpg-capture-memo-v1'`;
    - después, «Borrar todo» con las aserciones actuales.
  - **U-V1 (reforzado):** además, `expect(txt).not.toMatch(/sk-ant-/)`.
  - **U-S1 (nuevo):** con el ejemplo cargado, en Inicio sale `/^Espacio usado: aprox\. .+ de ~5 MB/` y no sale «casi lleno».
  - **U-S2 (nuevo):** antes del render, `localStorage.setItem('life-rpg-food-v1.backup.20261008T123456', 'x'.repeat(3_600_000))`:
    - sale `/está casi lleno \(aprox\. 72 %\)/`, con «Incluye 1 copia de datos dañados»;
    - el botón «Exportar copia» sigue en la sección.
- **`a11y.test.tsx`**
  - A-C3: la frase pasa a «comí una hamburguesa», que se guarda sola.
  - A-C4 (nuevo): «ate a burguer» → tarjeta «¿Apuntar en Burgers?» sin violaciones serias.
  - A-S1 (nuevo): Inicio con el aviso de U-S2 sin violaciones serias.
- **`e2e/capture.e2e.ts`, E11:** tras «eat a burguer», sale `¿Apuntar en Burgers?`, se pulsa «Apuntar» y se comprueba `Registrado: Burgers · +1 unidad`, `net === 1` y `calls.length === 0`.

### Checklist manual (dev, `npm run dev`, móvil o emulación a 320 px)

- [ ] La consola muestra `[selfcheck] done` sin fallos (SU1, CV15 y MC6 incluidos).
- [ ] Inicio → «Tus datos» muestra «Espacio usado: aprox. …». Con el ejemplo cargado no hay aviso.
- [ ] En DevTools, crear una clave `life-rpg-x.backup.20260101T000000` de 3,6 M de caracteres y volver a Inicio: sale el aviso con la mención a la copia dañada. Borrar la clave y volver a Inicio: el aviso desaparece.
- [ ] Sin clave: «I ran out of milk» → tarjeta y nada guardado; «Apuntar» → Running +1 con su «Deshacer». «comí una hamburguesa» → se guarda sola.
- [ ] Con clave y sin red (DevTools offline, escribiendo la frase): «ate a burguer» → tarjeta.
- [ ] Propuesta de hábito nuevo con clave: cambiar de pestaña mientras procesa → al volver, la cuenta atrás está parada.
- [ ] Recargar: nada de lo descartado aparece en HERO/VILLAIN.

## 12. Handoff para Claude Code

1. Crear la rama `cycle-40` desde `main`. Leer `capture.ts` (líneas 155-207), `haiku.ts` (`interpretCapture`), `CaptureView.tsx`, `CaptureCards.tsx`, `storage.ts` (`loadAll`, `saveFood`) y `HomeView.tsx` («Tus datos»).
2. Hacer las tareas T1 → T7 en orden, con un commit por tarea. Después de cada una: `npm run build`, `npm run lint` y `npm test` desde `app/`. Tras T4, también `npm run e2e`.
3. No modificar ningún assert existente de `selfcheck.ts`. Si alguno falla, el error está en la implementación, no en el assert.
4. No añadir dependencias. No tocar `memoKey`, `pickCapture`, `routeCapture` ni `interpretFood`. No borrar ni exportar `.backup.<stamp>` (D3).
5. Textos de la UI exactamente como en §8. Los tests los buscan literalmente.
6. Al terminar, pasar al reviewer con la lista de tests nuevos o ajustados de §11.
