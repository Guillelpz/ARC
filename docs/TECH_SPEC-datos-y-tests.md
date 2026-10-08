# TECH SPEC — Datos y tests (ciclo 1: P1.4 + P1.3)

> PRD: `docs/cycles/cycle-1/proposals.md` (P1.3, P1.4) con los cambios de `docs/cycles/cycle-1/evaluation.md`.
> Fuera de alcance: P1.1 (fecha real) y P1.2 (onboarding, semilla relativa, «Restablecer demo», copy «demo»), que son del ciclo 2.

## 1. Resumen

- **P1.4:** Vitest como dependencia de desarrollo y `npm test`, que ejecuta `runSelfCheck()` sin tocar sus asserts (falla si algún `console.assert` recibe `false`), más tests de las funciones puras de `storage.ts`.
- **P1.3:** `storage.ts` valida los eventos al leer, igual que ya hace con los trackers custom. Si una clave existe pero es ilegible o tiene elementos inválidos, copia el valor bruto a una clave de backup antes de que nada la sobrescriba y avisa en la home. Hay botones «Exportar copia» e «Importar copia» (JSON con eventos y datos custom).
- **No incluye:** sincronización, backend, copias automáticas, UI para restaurar backups internos, tests de componentes, e2e ni CI. Las claves `-v1` no cambian y el formato persistido es el mismo.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Versión de Vitest | `vitest@^4.1`. Antes de instalar, confirma con `npm view vitest@latest peerDependencies` que `vite` incluye `^8`. Después, `npm ls vite` debe mostrar una sola copia de `vite@8.3.x`. | La evaluación pide verificar la compatibilidad con Vite 8.3.3, que es la versión instalada. |
| Config de Vitest | Sin `vitest.config.ts`: reutiliza `vite.config.ts`. Entorno `node` (el que trae por defecto), sin jsdom ni globals; los tests importan `test/expect/vi` de `vitest`. | Cero archivos nuevos de configuración, y `tsc -b` tipa los tests sin tocar `tsconfig`. |
| Ubicación de los tests | `src/core/*.test.ts`, al lado del código. | Así entran en `tsconfig.app.json` (`include: ["src"]`) y en oxlint sin configuración extra. |
| Selfcheck en Vitest | Un spy sobre `console.assert` acumula los mensajes con `cond === false`, y el test exige que la lista quede vacía. | Lo pide la evaluación: `console.assert` no lanza error. |
| Dónde van los asserts nuevos | La lógica nueva de storage se prueba en `storage.test.ts`. `selfcheck.ts` no cambia. | La evaluación pide que los tests de storage vayan sobre las funciones puras y con Vitest. `selfcheck` sigue siendo el oráculo del motor. |
| Nombres de los parsers | `readEvents(v)` / `readCustom(v)` reciben el JSON ya parseado y devuelven `{ data, dropped } \| null`. `parseCustom(raw)` se queda con la misma firma, como envoltorio. | Este `readEvents` es el «`parseEvents`» que pide la evaluación. Necesita indicar si hubo pérdida, y `parseCustom` no puede cambiar porque lo usan los asserts 131–132. |
| Clave ausente | Eventos → `SEED_EVENTS`; custom → vacío. **Igual que hoy.** | Distinguir «ausente → vacío» es parte de P1.2 (ciclo 2). |
| Clave ilegible (JSON roto o forma incorrecta) | Se copia el valor bruto a un backup y la clave arranca **vacía** (`[]` / `EMPTY_CUSTOM`), no con la semilla. Se avisa. | Cargar la semilla haría pasar datos ficticios por los tuyos y luego se guardaría encima del original: es el bug que describe P1.3. |
| Elementos inválidos | Se conservan los válidos, se copia el valor bruto a un backup y se avisa. | La evaluación lo pide: filtrar en silencio también es perder datos. |
| Clave de backup | `<clave>.backup.<YYYYMMDDTHHmmss>` (UTC, sacada de `toISOString`). | No pisa backups anteriores. Si StrictMode ejecuta dos veces el inicializador en el mismo segundo, la escritura es idempotente. |
| Fallo al escribir el backup (cuota) | La clave queda **bloqueada** en la sesión: `save*` no la escribe y el aviso lo dice. Solo se desbloquea con una importación correcta. | Es el único caso en que guardar sobrescribiría el original sin copia. |
| Validar un evento | Objeto con `id` string no vacío, `trackerId` string, `amount` finito y `occurredAt` que cumpla `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/`. Un `trackerId` desconocido **es válido**. | Es el contrato de `types.ts`. Los `trackerId` huérfanos ya se ignoran al derivar, y descartarlos sería perder datos. |
| Validar los datos custom | Mismos filtros que `parseCustom` hoy. `trackers`/`proposals` ausentes → `[]` sin pérdida; presentes pero sin ser array → ilegible. | No cambia lo que hoy se acepta (el assert de roundtrip sigue pasando). |
| Formato de exportación | `{ app: 'rpg-life-tracker', version: 1, exportedAt, events, custom }`, con indentación de 2 espacios. | Un único archivo con todo lo persistido; `app` y `version` permiten rechazar archivos ajenos. |
| Importar | Reemplaza eventos y datos custom tras `window.confirm`. No hay fusión, ni backup automático del estado previo (el texto de confirmación recomienda exportar antes). | Lo pide la propuesta («valida y reemplaza, con confirmación»). |
| Fecha del archivo exportado | `exportedAt = new Date().toISOString()`; nombre `rpg-life-tracker-<YYYY-MM-DD>.json` (UTC). | Son metadatos, no la fecha del juego. No toca `DEMO_DATE` (P1.1). |

## 3. Decisiones que requieren aprobación

Ninguna. Vitest es una dependencia de desarrollo ya aprobada, las claves no cambian y no se tocan las reglas de juego.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/package.json` | `devDependencies.vitest` y script `"test": "vitest run"`. |
| `app/src/core/selfcheck.test.ts` | **Nuevo.** Ejecuta `runSelfCheck()` con un spy sobre `console.assert`. |
| `app/src/core/storage.ts` | Añade `readEvents`, `readCustom`, `loadAll`, `exportBackup`, `parseBackup` y `unlockStorage`, y el bloqueo en `save*`. `parseCustom` pasa a ser un envoltorio. Se eliminan `loadEvents` y `loadCustom` (solo los usa `App.tsx`). |
| `app/src/core/storage.test.ts` | **Nuevo.** Tests de §11. |
| `app/src/App.tsx` | Carga con `loadAll`, estado `notice`, handlers `exportData` e `importData`. |
| `app/src/components/HomeView.tsx` | Banner de aviso y botones «Exportar copia» / «Importar copia» con un `<input type="file">` oculto. |
| `CLAUDE.md`, `AGENTS.md` | Añadir `npm test` en Comandos y quitar «No hay test runner». El gate pasa a ser build + lint + test. |

`selfcheck.ts`, `main.tsx`, `types.ts` y el resto de `core/` no cambian.

## 5. Modelos de datos

En `storage.ts` (no en `types.ts`: son tipos de persistencia, no de dominio):

```ts
type Store = Pick<Storage, 'getItem' | 'setItem'>
export type Parsed<T> = { data: T; dropped: number } | null          // null = ilegible
export type LoadProblem = { key: string; dropped: number | null;     // null = ilegible
                            backupKey: string | null }               // null = no se pudo copiar → clave bloqueada
export type Loaded = { events: ActivityEvent[]; custom: CustomData; problems: LoadProblem[] }
export type Backup = { app: 'rpg-life-tracker'; version: 1; exportedAt: string; events: ActivityEvent[]; custom: CustomData }
```

`ActivityEvent` y `CustomData` no cambian.

## 6. Persistencia y migración

- **Claves:** `life-rpg-demo-v1` (eventos) y `life-rpg-custom-v1` (custom), **con el mismo formato**. No hay migración: todo lo que hoy se guarda bien sigue leyéndose igual (`dropped === 0`, sin backup ni aviso).
- **Datos ya guardados:**
  - Válidos → sin cambios.
  - Con elementos inválidos → se conservan los válidos y el original completo queda en `<clave>.backup.<stamp>`.
  - Ilegibles → arranca vacío y el original queda en el backup.
  - Antes de este cambio, un evento inválido se aceptaba tal cual; ahora se descarta, pero queda en el backup.
- **Backups:** solo se crean cuando hay pérdida. No se borran solos y no tienen UI de restauración.
  `// ponytail: restaurar un backup interno es manual (DevTools → Local Storage). Añadir UI cuando un usuario real lo necesite.`
- **Exportación e importación:** un archivo JSON (`Backup`), fuera de localStorage. Importar escribe en las claves `-v1` mediante el flujo normal (`setEvents`/`setCustom` → `useEffect` → `save*`).

## 7. Lógica de dominio (`storage.ts`)

```ts
const json = (raw: string): unknown => { try { return JSON.parse(raw) } catch { return undefined } }
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const isEvent = (e: unknown): e is ActivityEvent => isObj(e) && typeof e.id === 'string' && e.id !== '' &&
  typeof e.trackerId === 'string' && typeof e.amount === 'number' && Number.isFinite(e.amount) &&
  typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)

export function readEvents(v: unknown): Parsed<ActivityEvent[]>
// !Array.isArray(v) → null; si no, data = v.filter(isEvent), dropped = v.length - data.length

export function readCustom(v: unknown): Parsed<CustomData>
// !isObj(v) → null. Si trackers o proposals están presentes (!== undefined) y no son array → null.
// Filtros idénticos a los de parseCustom hoy; dropped = descartados de trackers + descartados de proposals.

export const parseCustom = (raw: string | null): CustomData => readCustom(json(raw ?? 'null'))?.data ?? EMPTY_CUSTOM
```

Nota: hoy `Number.isFinite(t.increment)` acepta solo números. Mantenlo tal cual.

**Carga** (sustituye a `loadEvents`/`loadCustom`):

```ts
const locked = new Set<string>()   // claves que no se pueden escribir en esta sesión
export function loadAll(store: Store = localStorage, now = new Date()): Loaded
```

Para cada clave, con `load(key, read, ifMissing, ifUnreadable)`:

1. `raw = store.getItem(key)`. Si lanza una excepción o devuelve `null`, el resultado es `ifMissing` (eventos `SEED_EVENTS`, custom `EMPTY_CUSTOM`) y no hay problema.
2. `r = read(json(raw))`. Si `r && r.dropped === 0`, el resultado es `r.data`.
3. En otro caso: `backupKey = \`${key}.backup.${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}\``, y `try { store.setItem(backupKey, raw) } catch { locked.add(key); backupKey = null }`.
4. Añade `{ key, dropped: r ? r.dropped : null, backupKey }` a `problems` y devuelve `r ? r.data : ifUnreadable` (`[]` o `EMPTY_CUSTOM`).

**Guardado:** `saveEvents(e, store: Store = localStorage)` y `saveCustom(c, store = localStorage)` no hacen nada si `locked.has(key)`; el resto queda igual. `export const unlockStorage = () => locked.clear()` se llama tras importar y en los tests.

**Exportar e importar:**

```ts
export const exportBackup = (events: ActivityEvent[], custom: CustomData, exportedAt: string): string =>
  JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt, events, custom } satisfies Backup, null, 2)

export function parseBackup(raw: string): { events: ActivityEvent[]; custom: CustomData; dropped: number } | null
// v = json(raw). Devuelve null si: !isObj(v), v.app !== 'rpg-life-tracker', v.version !== 1,
// readEvents(v.events) === null o readCustom(v.custom) === null.
// dropped = la suma de ambos.
```

## 8. UI

Todo va en `HomeView` (la app arranca ahí). Estilos según `STYLE_GUIDE.md` (avisos: `text-app-text` + `CircleAlert`, sin color semántico).

**Banner de aviso.** Prop `notice: string | null`, más `onDismissNotice`. Se muestra como primer hijo de `<main>`, a ancho completo (`lg:col-span-2`). Es un `role="status"` con `rounded-xl border border-app-border bg-app-surface p-4 shadow-sm`, el icono `CircleAlert`, el texto en `text-sm text-app-text` y un botón `X` con `aria-label="Cerrar aviso"` y `min-h-11 min-w-11`.

**Textos** (los define `App.tsx`; `HomeView` solo muestra lo que recibe):

| Caso | `notice` |
|---|---|
| Algún `problem` con `backupKey === null` | «Parte de tus datos guardados no se pudo leer ni copiar. Tus cambios no se guardarán en este navegador hasta que importes una copia.» |
| Hay `problems`, todos con backup | «Parte de tus datos guardados no se pudo leer. El original está copiado aparte en este navegador. Exporta una copia para conservar lo que ves.» |
| Archivo no válido | «Ese archivo no es una copia válida de RPG Life Tracker.» |
| Error al leer el archivo | «No se pudo leer el archivo.» |
| Importación correcta | «Copia importada: N registros y M misiones nuevas.» |

**Botones.** En el `<footer>`, junto a «Restablecer demo», con el mismo estilo de enlace. Esa línea queda igual (su copy es del ciclo 2).

- «Exportar copia» (`Download`) → `onExport()`.
- «Importar copia» (`Upload`) → hace `click()` en un `<input type="file" accept=".json,application/json" hidden>`. En `onChange`: `file.text()` → `onImport(text)`, o `onImportError()` si la lectura falla. Después vacía `input.value` para poder elegir el mismo archivo otra vez.

**`App.tsx`:**

```ts
const [loaded] = useState(loadAll)
const [events, setEvents] = useState(loaded.events)
const [custom, setCustom] = useState(loaded.custom)
const [notice, setNotice] = useState<string | null>(() => noticeFor(loaded.problems))
```

- `exportData()`: `exportBackup(events, custom, new Date().toISOString())` → `Blob` (`application/json`) → `URL.createObjectURL` → un `<a download="rpg-life-tracker-YYYY-MM-DD.json">` temporal con `click()` → `URL.revokeObjectURL`.
- `importData(text)`:
  1. `parseBackup`; si da `null`, muestra el aviso de archivo no válido.
  2. Pide `window.confirm(\`¿Importar esta copia? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${n} y ${m}.${dropped ? \` Se ignorarán ${dropped} elementos no válidos.\` : ''} Exporta antes si quieres conservar lo actual.\`)`.
  3. Si se acepta: `unlockStorage()`, `setEvents`, `setCustom`, limpia `toast`/`gain`/`overtake` y muestra el aviso de éxito.

No hay estado de carga: la lectura y el parseo son síncronos salvo `file.text()`, que es casi instantáneo.

## 9. Backlog

**T1 — P1.4: `npm test` con Vitest** (sin dependencias)
- Archivos: `app/package.json`, `app/src/core/selfcheck.test.ts` (nuevo), `CLAUDE.md`, `AGENTS.md`.
- Instala `vitest` como devDependency, verificando la versión según §2. Añade `"test": "vitest run"`.
- Crea `selfcheck.test.ts`:
  ```ts
  import { expect, test, vi } from 'vitest'
  import { runSelfCheck } from './selfcheck'
  test('selfcheck: todos los asserts pasan', () => {
    const failed: string[] = []
    const spy = vi.spyOn(console, 'assert').mockImplementation((cond, ...msg) => { if (!cond) failed.push(msg.join(' ')) })
    try { runSelfCheck() } finally { spy.mockRestore() }
    expect(failed).toEqual([])
  })
  ```
- En `CLAUDE.md` y `AGENTS.md`, sección Comandos: añade `npm test` (Vitest: selfcheck + tests de `core/`) y sustituye «No hay test runner» por el gate build + lint + test.
- Aceptación:
  - `npm test` en verde.
  - Si se cambia temporalmente un valor esperado (p. ej. `'hero 570 Lv3'` → 571), `npm test` falla con ese mensaje. Revierte el cambio después.
  - `npm run build` y `npm run lint` en verde.
  - `npm ls vite` muestra una sola copia.

**T2 — Validadores puros de storage** (depende de T1)
- Archivos: `app/src/core/storage.ts` y `app/src/core/storage.test.ts` (nuevo).
- Implementa `readEvents`, `readCustom`, `json` y `parseCustom` como envoltorio (§7). `loadEvents` y `loadCustom` **todavía no** cambian: así no hay filtrado silencioso antes de que exista el backup.
- Aceptación:
  - Pasan los tests 1–2 de §11.
  - Pasan los asserts 131–132 del selfcheck sin cambios.
  - build, lint y test en verde.

**T3 — Carga sin pérdida: backup, bloqueo y aviso** (depende de T2)
- Archivos: `storage.ts`, `storage.test.ts`, `App.tsx`, `HomeView.tsx`.
- Implementa `loadAll`, `locked`, `save*` con `store` y `unlockStorage`, y elimina `loadEvents`/`loadCustom`. `App` carga con `loadAll` y muestra `notice` con el banner de §8.
- Aceptación:
  - Pasan los tests 3 de §11.
  - Con datos válidos no aparece aviso y no se crea ninguna clave nueva.
  - Si escribes `{roto` en `life-rpg-demo-v1` y recargas: aparece el aviso, existe `life-rpg-demo-v1.backup.<stamp>` con `{roto` y la app arranca sin registros (no con la semilla).
  - build, lint y test en verde.

**T4 — Exportar e importar copia** (depende de T3)
- Archivos: `storage.ts`, `storage.test.ts`, `App.tsx`, `HomeView.tsx`.
- Implementa `exportBackup` y `parseBackup` (§7), y los botones y handlers de §8.
- Aceptación:
  - Pasan los tests 4 de §11.
  - Exportar → borrar localStorage → recargar → importar el archivo deja exactamente los mismos registros, misiones y propuestas.
  - Un JSON ajeno muestra el aviso de archivo no válido y no cambia nada.
  - Si cancelas el confirm, no cambia nada.
  - build, lint y test en verde.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Vitest no admite Vite 8 o arrastra otra copia de `vite`. | Comprobación de peers en T1 y `npm ls vite`. | Fija la última versión de Vitest cuyo peer incluya `^8`. Si no existe ninguna, para y avisa: no instales `vite@7` en paralelo. |
| `vite.config.ts` (plugins Tailwind/React, `loadEnv`) rompe Vitest. | Los tests solo importan `core/`, sin CSS. | Crea `app/vitest.config.ts` mínimo, sin plugins (`defineConfig({ test: {} })` de `vitest/config`). |
| La validación nueva descarta eventos que hoy funcionan (p. ej. un `occurredAt` con otro formato). | El backup guarda el original y el aviso lo hace visible. Comprueba antes, en tu navegador, que los datos actuales dan `dropped === 0`. | Relaja solo esa regla (p. ej. el regex) y añade su test. |
| StrictMode ejecuta `loadAll` dos veces. | Clave de backup con precisión de segundos e idempotente. Los `problems` se recalculan igual. | — |
| Importar con una clave bloqueada sobrescribe el original sin copia. | El confirm lo dice («Exporta antes…») y la importación es una acción explícita. | Aceptado. |
| Se acumulan backups en localStorage. | Solo se crean cuando hay pérdida, que es raro. | Limpieza manual. Añadir rotación si llega a pasar. |

Si hay que recortar, la UI de T4 puede ir en un incremento aparte. T1–T3 no se recortan: son la protección de datos.

## 11. Verificación

**`selfcheck.ts`:** sin cambios; todos sus asserts deben pasar (T1 los ejecuta con `npm test`).

**`storage.test.ts`** (entorno node, sin jsdom). Store falso:

```ts
const fakeStore = (init: Record<string, string> = {}, failWrites = false) => {
  const m = new Map(Object.entries(init))
  return { m, getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failWrites) throw new Error('quota'); m.set(k, v) } }
}
```

1. **`readEvents`:**
   - El roundtrip de `SEED_EVENTS` (`JSON.parse(JSON.stringify(...))`) devuelve los mismos datos con `dropped 0`.
   - Una mezcla de un evento válido con `null`, uno sin `id`, `amount: '3'`, `amount: null` y `occurredAt: '2026-10-07'` conserva solo el válido, con `dropped 5`.
   - Un evento con `trackerId: 'borrado'` se conserva.
   - `{}`, `'x'` y `undefined` devuelven `null`.
2. **`readCustom`:**
   - `{}` → vacío, `dropped 0`.
   - `{ trackers: 'x' }` → `null`.
   - Un tracker sin `name` → `dropped 1`.
   - `parseCustom('{roto')` y `parseCustom(null)` → `EMPTY_CUSTOM`.
3. **`loadAll(store, fixedDate)`** (llama a `unlockStorage()` en `beforeEach`):
   - Store vacío → `SEED_EVENTS` y `EMPTY_CUSTOM`, `problems: []` y ninguna escritura.
   - Datos válidos → los devuelve sin `problems` ni escrituras.
   - `{roto` en eventos → `events: []`, `problems[0].dropped === null`, y el backup contiene exactamente `{roto`.
   - Elementos inválidos en eventos → conserva los válidos, `dropped > 0` y el backup tiene el bruto.
   - Custom ilegible → `EMPTY_CUSTOM` y backup.
   - Con `failWrites` y clave corrupta → `backupKey === null`, y después `saveEvents([...], store)` no escribe.
4. **`exportBackup` / `parseBackup`:**
   - El roundtrip con la semilla, un tracker custom y una propuesta devuelve lo mismo con `dropped 0`.
   - `app` distinto, `version: 2`, `{roto` o falta de `events` → `null`.
   - Un evento inválido dentro → `dropped 1`.

**Checklist manual** (`npm run dev`):

- [ ] La consola muestra `[selfcheck] done` sin fallos.
- [ ] Con datos existentes válidos: no aparece aviso, los registros son los mismos y no hay claves `.backup.` nuevas.
- [ ] `{roto` en cada clave → aviso, backup creado, la app usable. Al registrar algo y recargar, el aviso ya no aparece.
- [ ] Exportar → el archivo se descarga con el nombre correcto y es legible.
- [ ] Importar en otra sesión o navegador → mismos datos. Cancelar no cambia nada. Un archivo ajeno muestra el aviso.
- [ ] En móvil (DevTools a 375 px): el banner y los botones del footer caben y miden al menos 44 px; el selector de archivos se abre.

## 12. Handoff para Claude Code

1. Lee esta spec, `app/src/core/storage.ts`, `app/src/App.tsx` y `app/src/components/HomeView.tsx`.
2. Ejecuta T1 → T2 → T3 → T4, en ese orden. Cada tarea se cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.
3. No modifiques `selfcheck.ts`. Si un assert falla, el error está en `storage.ts`.
4. No toques `DEMO_DATE`, `nowStamp`, la semilla, «Restablecer demo» ni la copy «demo» (ciclo 2).
5. No añadas dependencias de runtime. Iconos: `Download`, `Upload`, `CircleAlert` y `X` de `lucide-react`.
6. Si una decisión de esta spec choca con el código, para y avisa en vez de improvisar.
