# TECH_SPEC — Restaurar la copia interna desde la app (ciclo 5: P4.4)

Fuente: `docs/cycles/cycle-4/proposals.md` (P4.4) con los cambios de `docs/cycles/cycle-4/evaluation.md`. Base: `main` con los ciclos 1–4 (`backupCurrent` atómico con rotación `.backup.last` → `.backup.prev`, campo `undoes`).

## 1. Resumen

- En el bloque «Tus datos» de la home aparece «Recuperar copia anterior» si existe alguna `<clave>.backup.last`, es decir, el estado previo al último «Importar» o «Borrar todo».
- Restaurar **intercambia** `.backup.last` con el estado actual. La copia se valida con `readEvents`/`readCustom`; lo actual pasa a `.backup.last`; todo se escribe de forma atómica. Pulsar otra vez deshace la restauración.
- **Fuera de alcance:** restaurar `.backup.prev` o los `.backup.<stamp>` de `loadAll`, listar o elegir copias, mostrar la fecha de la copia (no se guarda) y purgar los backups con sello (ver §2).

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Qué se restaura | Solo `.backup.last`, como pide la evaluación. Los `.backup.<stamp>` son datos que ya fallaron la validación, y `.backup.prev` queda para DevTools. |
| Cómo | Se intercambia por clave: `k ← JSON(copia validada)` y `k.backup.last ← valor bruto actual de k`. **No se llama a `backupCurrent`**, porque machacaría la copia. `.backup.prev` no se toca. |
| Validador | `readEvents`/`readCustom` sobre `JSON.parse` del valor bruto, no `parseBackup`, que espera el envoltorio de exportación. |
| Copia de una sola clave | Cada clave se trata por separado. Solo se restauran las claves que tienen `.backup.last` y las demás no cambian. En la práctica las dos existen siempre, porque `App` guarda ambas al montar. `ponytail:` en el código. |
| Copia ilegible | Si alguna `.backup.last` presente da `null` en el validador, no se restaura nada y se muestra un aviso. No se borra la copia. |
| Copia con elementos inválidos | Se restaura sin ellos y la confirmación dice cuántos se ignoran, igual que al importar. |
| Valor actual ausente | Si una clave sin valor actual tiene copia, en `.backup.last` se guarda su vacío canónico: `'[]'` o `JSON.stringify(EMPTY_CUSTOM)`. |
| Atomicidad | Hay un helper privado `writeAll(store, writes)` en `storage.ts` que escribe todo o revierte lo escrito y devuelve `false`. `backupCurrent` pasa a usarlo, sin cambiar su comportamiento. |
| Clave bloqueada (`locked`) | Si la restauración sale bien, se hace `locked.delete(k)` solo en las claves restauradas, porque ya contienen datos válidos. El valor bruto corrupto se conserva en `.backup.last`. |
| Saber si hay copia | `hasLastBackup()` hace dos `getItem`, sin parsear. `App` guarda el resultado en un estado que se recalcula tras borrar, importar o restaurar, para no leer localStorage en cada render. |
| Fecha en el botón | No se muestra, porque `backupCurrent` no guarda sello. El texto explica qué copia es. |
| Purga de `.backup.<stamp>` | **Fuera.** Solo se crean cuando `loadAll` encuentra datos dañados, y la siguiente escritura de `App` deja la clave limpia. Hay uno por incidente, no uno por carga. Purgar exige ampliar `Store` con `key`/`length`/`removeItem` y borrar datos. Se queda como deuda conocida. |

## 3. Decisiones que requieren aprobación

Ninguna. No hay dependencias nuevas, no se renombran claves y no cambian las reglas de juego. La purga de los backups con sello queda fuera (§2).

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | Nuevos `writeAll` (privado), `hasLastBackup`, `readLast` y `restoreLast`. `backupCurrent` usa `writeAll`. Se actualizan los `ponytail:` de las líneas 52 y 120–121. |
| `app/src/core/storage.test.ts` | Tests R1–R6 (§11). Los tests existentes no cambian. |
| `app/src/App.tsx` | Estado `canRestore`, función `restore()` y prop `onRestore` para la home. |
| `app/src/components/HomeView.tsx` | Prop opcional `onRestore` y botón en «Tus datos». |

## 5. Modelos de datos

`types.ts` no cambia. En `storage.ts`:

```ts
// null en una rama = esa clave no tiene .backup.last
export type LastBackup = { events: ActivityEvent[] | null; custom: CustomData | null; dropped: number }
```

## 6. Persistencia y migración

- Las claves no cambian: `life-rpg-demo-v1`, `life-rpg-custom-v1`, `…backup.last`, `…backup.prev` y `…backup.<stamp>`.
- Restaurar escribe, de forma atómica, 2 valores por clave restaurada: `k` y `k.backup.last`.
- No hace falta migrar. Las `.backup.last` escritas por el ciclo 3 o el 4 son el valor bruto de la clave, así que `readEvents`/`readCustom` las leen tal cual, `undoes` incluido.

## 7. Lógica de dominio (`storage.ts`)

```ts
const EMPTY_RAW = { [KEY]: '[]', [CUSTOM_KEY]: JSON.stringify(EMPTY_CUSTOM) }

// Escribe todo o revierte lo escrito (removeItem si no existía). false si algo falla. No lanza.
function writeAll(store: Store & Partial<Pick<Storage, 'removeItem'>>, writes: [string, string][]): boolean

// backupCurrent: dentro de try { construir writes leyendo las claves } catch { return false }; luego return writeAll(store, writes).
// Mismo orden que hoy: por clave, primero `.backup.prev ← last` (si last existe) y luego `.backup.last ← raw`.

export function hasLastBackup(store: Pick<Storage, 'getItem'> = localStorage): boolean
// true si existe alguna `${k}.backup.last` (k ∈ [KEY, CUSTOM_KEY]). Si getItem lanza → false.

export function readLast(store: Pick<Storage, 'getItem'> = localStorage): LastBackup | 'none' | 'unreadable'
// Por clave: raw = getItem(`${k}.backup.last`). Si raw es null, esa rama es null.
// Si no es null: r = read(json(raw)); si r es null → 'unreadable'; si no, rama = r.data y dropped += r.dropped.
// Si las dos ramas son null → 'none'. Si getItem lanza → 'unreadable'.

export function restoreLast(r: LastBackup, store: Store & Partial<Pick<Storage, 'removeItem'>> = localStorage): boolean
// writes = para cada clave con rama no null:
//   [`${k}.backup.last`, store.getItem(k) ?? EMPTY_RAW[k]], [k, JSON.stringify(rama)]
// (las lecturas, dentro de try → false). ok = writeAll(store, writes); si ok, locked.delete(k) en las claves escritas.
```

Propiedad: `restoreLast` aplicado dos veces seguidas (con `readLast` en medio) deja `k` y `k.backup.last` como estaban, salvo la normalización de JSON de lo validado.

## 8. UI

**`App.tsx`:**

```ts
const [canRestore, setCanRestore] = useState(hasLastBackup)

function restore() {
  const r = readLast()
  if (r === 'none') { setCanRestore(false); return setNotice('No hay ninguna copia interna que recuperar.') }
  if (r === 'unreadable') return setNotice('La copia interna está dañada y no se puede recuperar. Tus datos actuales no se han tocado.')
  const ev = r.events ?? events, cu = r.custom ?? custom
  if (!window.confirm(`¿Recuperar la copia guardada antes de tu último «Importar» o «Borrar todo»? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${ev.length} y ${cu.trackers.length}.${r.dropped ? ` Se ignorarán ${r.dropped} elementos no válidos.` : ''} Lo que tienes ahora queda guardado como copia: si cambias de idea, pulsa otra vez «Recuperar copia anterior».`)) return
  if (!restoreLast(r)) return setNotice('No se pudo recuperar la copia, así que no se ha cambiado nada. Exporta una copia y vuelve a intentarlo.')
  setEvents(ev); setCustom(cu); setToast(null); setGain(null); setOvertake(null)
  setNotice(`Copia recuperada: ${ev.length} registros y ${cu.trackers.length} misiones nuevas.`)
}
```

- En `reset()` y en `importData()`, después de que `backupCurrent()` termine bien, se añade `setCanRestore(true)`.
- `HomeView` recibe `onRestore={canRestore ? restore : undefined}`, igual que `onLoadExample`.

**`HomeView.tsx`:** prop `onRestore?: () => void`. Si existe, en el `div` de «Exportar» e «Importar» se añade un tercer botón con el mismo estilo secundario. Lleva el icono `RotateCcw` de lucide-react, que ya es dependencia, y el texto «Recuperar copia anterior». Sin hex ni paletas de rama: tokens `app-*`, como sus hermanos. Estados:

- Sin copia: el botón no aparece.
- Error: aviso en el `notice` existente.
- Éxito: aviso de confirmación.

No hay estado de carga, porque la operación es síncrona.

## 9. Backlog

**T1 — Núcleo de restauración en `storage.ts`**
- Objetivo: restaurar e intercambiar `.backup.last` con funciones puras y testeadas.
- Archivos: `app/src/core/storage.ts`, `app/src/core/storage.test.ts`.
- Funcionalidad: `writeAll`, el refactor de `backupCurrent` sobre él, `hasLastBackup`, `readLast` y `restoreLast` según §7. Se actualizan los `ponytail:`:
  - Línea 52: «restaurar `.backup.<stamp>` es manual (DevTools); no se purgan; uno por incidente de datos dañados».
  - Línea 120: «la app solo restaura `.backup.last`; `.backup.prev`, por DevTools».
  - Se añade uno en `restoreLast` sobre las claves sin copia.
- Depende de: —
- Aceptación: los tests R1–R6 y los existentes de `backupCurrent` pasan sin cambios. La UI no cambia.

**T2 — Botón «Recuperar copia anterior»**
- Objetivo: exponer la restauración en «Tus datos».
- Archivos: `app/src/App.tsx`, `app/src/components/HomeView.tsx`.
- Funcionalidad: §8.
- Depende de: T1.
- Aceptación: el checklist manual de §11 está en verde.

Cada tarea cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, y con `[selfcheck] done` sin fallos en dev.

## 10. Riesgos

| Riesgo | Prevención | Recorte si se complica |
|---|---|---|
| Machacar la copia que se restaura | No se llama a `backupCurrent` y hay un test de doble restauración (R3). | — |
| Restauración a medias (cuota) | `writeAll` revierte y hay un test (R4). | — |
| `canRestore` desfasado (copia borrada en DevTools) | `restore()` detecta `'none'` y oculta el botón. | — |
| Copia y estado actual de momentos distintos si solo una clave tiene copia | Se documenta con `ponytail:`. No pasa con el flujo normal. | — |
| Refactor de `backupCurrent` | Sus 4 tests actuales siguen sin cambios. | Si da guerra, `restoreLast` copia el patrón `put`/revert localmente y `backupCurrent` no se toca. |

## 11. Verificación

Los asserts de `selfcheck.ts` no cambian, porque no hay lógica de dominio nueva. Tests nuevos en `storage.test.ts`, con el `fakeStore` existente:

- **R1 `readLast`:**
  - store vacío → `'none'`;
  - solo `EV.backup.last = JSON([good])` → `{ events: [good], custom: null, dropped: 0 }`;
  - `EV.backup.last = '{roto'` → `'unreadable'`;
  - `JSON([good, null])` → `dropped: 1`.
- **R2 intercambio:** con `{ EV: 'cur', EV.backup.last: JSON([good]), EV.backup.prev: 'p', CU: 'c' }`, `restoreLast(readLast(s), s)` → `true`. Resultado: `EV === JSON([good])`, `EV.backup.last === 'cur'`, `EV.backup.prev === 'p'` y `CU === 'c'`, sin `CU.backup.last`.
- **R3 doble restauración:** con las dos claves y sus `.last` válidos, dos ciclos `readLast` + `restoreLast` devuelven `EV`, `CU` y sus `.last` a los valores iniciales (usar valores ya normalizados con `JSON.stringify`).
- **R4 atómico:** un `setItem` que falla en la 3.ª escritura → `false`, y el mapa queda idéntico al inicial.
- **R5 actual ausente:** `{ EV.backup.last: JSON([good]) }` → `EV.backup.last === '[]'` después de restaurar.
- **R6 desbloqueo:**
  - `loadAll` con escrituras fallidas bloquea `EV`;
  - con escrituras ya permitidas, `restoreLast` → `true`;
  - después, `saveEvents([good], s)` escribe.

  Usar un `fakeStore` con un interruptor mutable de fallo.
- **R7 `hasLastBackup`:** `false` en un store vacío, `true` con cualquiera de las dos `.last`.

Checklist manual (dev):

1. Con datos, «Borrar todo» → aparece «Recuperar copia anterior». Pulsarlo y aceptar → vuelven los datos y la XP.
2. Pulsarlo otra vez → vuelve el estado vacío. Una tercera vez → vuelven los datos.
3. Importar una copia → recuperar → vuelven los datos de antes de importar.
4. Cancelar la confirmación → nada cambia.
5. Recargar tras restaurar → se mantiene lo restaurado y el botón sigue visible.
6. Navegador limpio → el botón no aparece.
7. En DevTools, poner `life-rpg-demo-v1.backup.last = '{roto'` y recargar → aviso de copia dañada; los datos no cambian.
8. Móvil (≤ 390 px): los tres botones de «Tus datos» se reparten en varias filas sin desbordar.

## 12. Handoff para Claude Code

1. Lee `app/src/core/storage.ts` (sobre todo `backupCurrent` y `locked`), `app/src/core/storage.test.ts`, `App.tsx` (`reset`, `importData`) y el bloque «Tus datos» de `HomeView.tsx`.
2. Haz T1 primero, con sus tests en verde, antes de tocar la UI. Nunca llames a `backupCurrent` desde la restauración.
3. Después haz T2, copiando el patrón de `importData`: confirmar → escribir → `setEvents`/`setCustom` → limpiar `toast`, `gain` y `overtake` → aviso.
4. Sin dependencias nuevas, sin renombrar claves y sin tocar `selfcheck.ts`. No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
