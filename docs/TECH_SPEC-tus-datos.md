# TECH SPEC — «Tus datos» en la home (P3.3 + P3.2)

> Ciclo 3. Fuente: `docs/cycles/cycle-3/proposals.md` (P3.2, P3.3) con los cambios de `docs/cycles/cycle-3/evaluation.md`. Base: `main` con los ciclos 1 y 2.

## 1. Resumen

Se sustituye el pie de la home (tres enlaces sueltos: Borrar todo, Exportar copia, Importar copia) por un bloque **«Tus datos»** que agrupa exportar, importar y borrar todo, y muestra el estado de la última copia exportada. Se guarda la fecha de la última exportación en una clave nueva `life-rpg-meta-v1`, se pide almacenamiento persistente una vez al arrancar y se avisa si no hay copia o si tiene 14 días o más. «Borrar todo» ofrece exportar antes si la copia no es reciente. Además, de la deuda de los ciclos 1 y 2: se retrasa `revokeObjectURL` y se guarda una copia interna antes de importar o borrar.
**No incluye:** copias automáticas a fichero, UI para restaurar backups internos, modal nuevo, pantalla de ajustes, cambios en PARTY, renombrar claves ni backend.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Copy «demo» | No hay cambios de texto. El ciclo 2 ya quitó «Restablecer demo», «Historial de ejemplo» y «Fecha demo». Los chips «de ejemplo» (`HomeView`) y «Party de ejemplo» (`PartyView`) **se mantienen**. | Las parties siguen siendo ficticias y `STYLE_GUIDE.md` fija esas etiquetas. Quitarlas daría a entender que son reales. |
| Formato de meta | `life-rpg-meta-v1` = `{"lastExportAt":"<ISO 8601>"}` | Un objeto, para que se puedan añadir campos sin cambiar la clave. |
| Meta corrupta | Se trata como «nunca exportado», sin backup ni aviso, y se sobrescribe en la siguiente exportación. | Solo contiene una fecha. Al perderla, el fallo va en la dirección segura (el aviso sale de más). |
| Cuándo se cuenta una copia | Cuando se lanza la descarga en `exportData`. Importar no cuenta. | El navegador no informa de si la descarga terminó. Esto se marca con `ponytail:`. |
| Umbral del aviso | `EXPORT_REMIND_DAYS = 14` (`ponytail:`). El aviso solo sale si hay datos (eventos o misiones nuevas). | No tiene sentido pedir una copia a quien aún no tiene nada. |
| Días transcurridos | Días completos de 24 h entre `lastExportAt` y `now`, con un mínimo de 0. | Es simple y aguanta un reloj que retrocede. |
| `persist()` | Se llama una vez desde `main.tsx`, solo si `persisted()` es falso. Se ignoran el resultado y los errores. | Así lo pide la evaluación. En `main.tsx` se ejecuta una sola vez, también con StrictMode. |
| «Borrar todo» con copia vieja | Si la copia está pendiente (`due`), primero sale `confirm('¿Exportar una copia antes de borrar?…')`. **Aceptar** exporta y **no borra**. **Cancelar** pasa al `confirm` de borrado de siempre. | No hay modal ni carrera entre la descarga y un segundo diálogo. Tras exportar, la copia ya está al día y el siguiente clic va directo al borrado. |
| Copia interna antes de importar o borrar | Se copian los valores brutos actuales de las dos claves a `<clave>.backup.last`, que se **sobrescribe** cada vez. Solo se hace si hay datos. | El tamaño queda acotado (una copia por clave). Con la condición «solo si hay datos», un segundo «Borrar todo» no machaca la copia con `[]`. |
| Fallo de la copia interna | Se ignora y la operación sigue. | El usuario ya confirmó y el diálogo le ofreció exportar. Se marca con `ponytail:`. |
| `revokeObjectURL` | `setTimeout(() => URL.revokeObjectURL(url), 10_000)` | Revocarlo enseguida puede cancelar la descarga en navegadores antiguos (deuda del ciclo 1). |
| «Ahora» en el render | `App.tsx` crea un solo `const now = new Date()` y saca `today = localDate(now)` de él. | Mantiene la impureza que ya había (un warning de `react(purity)`) en lugar de añadir otra. |

## 3. Decisiones que requieren aprobación

Ninguna. No hay dependencias nuevas, ni backend, ni cambios en las reglas de juego. Las claves existentes no cambian y solo se añade `life-rpg-meta-v1`, que la evaluación ya aprobó.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | Clave `META_KEY`, `loadLastExport`, `saveLastExport`, `exportAge`, `backupDue`, `EXPORT_REMIND_DAYS`, `backupCurrent` y `requestPersist`. Se quita la doble línea en blanco (l. 35-36). |
| `app/src/core/storage.test.ts` | Tests de las funciones nuevas. |
| `app/src/main.tsx` | Llama a `requestPersist()`. |
| `app/src/App.tsx` | Estado `lastExport`, `now` único, `exportData` (guarda la meta y retrasa la revocación), `backupCurrent` antes de importar o borrar, flujo de «Borrar todo» con exportación previa y props nuevas para `HomeView`. |
| `app/src/components/HomeView.tsx` | Sustituye el `<footer>` por la sección «Tus datos». |

No hay archivos nuevos. `selfcheck.ts` no cambia.

## 5. Modelos de datos

En `storage.ts`, sin tocar `types.ts`, porque no es dominio:

```ts
export type Meta = { lastExportAt: string } // ISO 8601 (Date.toISOString())
export type CopyStatus = { days: number | null; due: boolean } // days null = nunca exportado
```

## 6. Persistencia y migración

- **Nueva:** `localStorage['life-rpg-meta-v1'] = '{"lastExportAt":"2026-10-08T10:00:00.000Z"}'`. Si falta (todos los usuarios actuales), significa «nunca exportado». No hace falta migración: el primer arranque muestra el aviso si hay datos.
- **Nuevas:** `life-rpg-demo-v1.backup.last` y `life-rpg-custom-v1.backup.last`, con el valor bruto anterior a un import o a «Borrar todo». Se sobrescriben y la restauración es manual (DevTools), como ya pasa con los backups de `loadAll`.
- `life-rpg-demo-v1` y `life-rpg-custom-v1` no cambian ni de formato ni de nombre. El bloqueo (`locked`) no afecta a la meta.

## 7. Lógica de dominio (`storage.ts`)

```ts
const META_KEY = 'life-rpg-meta-v1'
// ponytail: recordatorio fijo a 14 días; hacerlo configurable si alguien lo pide o cuando haya copias automáticas.
export const EXPORT_REMIND_DAYS = 14

// null si falta, no se puede leer, no es objeto o la fecha no es parseable
export function loadLastExport(store: Pick<Storage, 'getItem'> = localStorage): string | null
// try/catch: si falla, no hace nada
export function saveLastExport(iso: string, store: Pick<Storage, 'setItem'> = localStorage): void

// días completos desde lastExportAt; null si es null; nunca negativo
export const exportAge = (lastExportAt: string | null, now: Date): number | null
// due = hasData && (days === null || days >= EXPORT_REMIND_DAYS)
export const backupDue = (lastExportAt: string | null, now: Date, hasData: boolean): CopyStatus

// ponytail: una sola copia interna por clave (`.backup.last`), sobrescrita en cada import/borrado y restaurable a mano; si falla la escritura, se sigue.
export function backupCurrent(store: Store = localStorage): void
//   para KEY y CUSTOM_KEY: raw = getItem(k); si raw !== null → setItem(`${k}.backup.last`, raw); todo en try/catch por clave

// ponytail: persist() es una petición; el navegador puede ignorarla (Safari borra tras 7 días sin uso). La garantía real es exportar.
export function requestPersist(): void
//   navigator.storage?.persisted?.().then(p => p || navigator.storage.persist()).catch(() => {})
```

`exportAge`: `Math.max(0, Math.floor((now.getTime() - Date.parse(last)) / 86_400_000))`. `loadLastExport` valida con `isObj(v) && typeof v.lastExportAt === 'string' && !Number.isNaN(Date.parse(v.lastExportAt))`.

**`App.tsx`:**

```ts
const [lastExport, setLastExport] = useState(loadLastExport)
const now = new Date(); const today = localDate(now)   // sustituye a la l. 46 (conservar el comentario ponytail)
const hasData = events.length > 0 || custom.trackers.length > 0
const copy = backupDue(lastExport, now, hasData)
```

- `exportData()`: igual que ahora, pero revoca con `setTimeout(…, 10_000)`. Después llama a `saveLastExport(stamp)` y a `setLastExport(stamp)`, con `stamp` = el `now` ISO que ya calcula. Añadir `// ponytail: cuenta como copia al lanzar la descarga; el navegador no confirma que se guardó.`
- `importData(text)`: si el usuario acepta el `confirm`, primero `if (hasData) backupCurrent()` y luego `unlockStorage()` y el resto, sin más cambios.
- `reset()`:
  1. Si `copy.due && hasData`: `if (window.confirm('No tienes una copia reciente de tus datos. ¿Exportar una antes de borrar? Aceptar exporta y no borra nada; Cancelar sigue con el borrado.')) { exportData(); setNotice('Copia exportada. Pulsa «Borrar todo» otra vez si quieres borrar.'); return }`
  2. Después, el `confirm` de borrado actual, sin cambiar el texto (está fijado en `STYLE_GUIDE`).
  3. Si confirma: `if (hasData) backupCurrent()` y luego lo que ya hacía (`setEvents([])`, etc.).
- `main.tsx`: `requestPersist()` justo antes de `createRoot`, fuera del `if (DEV)`.

## 8. UI — bloque «Tus datos» (`HomeView.tsx`)

**Props:** se añade `copy: CopyStatus` y se mantienen `onReset`, `onExport`, `onImport` y `onImportError`.

**Ubicación:** sustituye al `<footer>` (l. 121-140) dentro del segundo `div.rise`, después de «Añadir algo nuevo». Así queda al final de la home en móvil y en la columna derecha en `lg`.

**Estructura** (paleta neutral, tarjeta según la guía):

```
<section aria-labelledby="tus-datos" class="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">
  <h2 id="tus-datos" class="text-lg font-semibold">Tus datos</h2>
  [línea de estado]
  <div class="flex flex-wrap gap-3">  Exportar copia (Secundario, Download) · Importar copia (Secundario, Upload) + <input file> actual  </div>
  Borrar todo (Discreto, Trash2, self-start)
</section>
```

**Línea de estado** (`copy.days`, `copy.due`):

| Caso | Texto | Estilo |
|---|---|---|
| `due` y `days === null` | «Aún no has exportado ninguna copia. Tus datos solo están en este navegador.» | `CircleAlert size-4` + `text-sm leading-6 text-app-text` |
| `due` y `days !== null` | «Tu última copia es de hace {days} días. Exporta otra para no perder lo reciente.» | igual |
| no `due` y `days === 0` | «Última copia: hoy.» | `text-xs leading-5 text-app-muted` |
| no `due` y `days === 1` | «Última copia: hace 1 día.» | igual |
| no `due` y `days > 1` | «Última copia: hace {days} días.» | igual |
| no `due` y `days === null` (sin datos) | «Tus datos se guardan solo en este navegador.» | igual |

- Los botones Secundarios usan la constante `btn` existente más `border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-surface`, igual que «Cargar ejemplo». En `bg-app-surface` el hover no se nota: usar `hover:bg-app-bg`, como las filas de party.
- «Borrar todo» mantiene sus clases de variante Discreto actuales.
- El input de archivo y su `onChange` se mueven tal cual.
- Estados: no hay «cargando» (todo es síncrono). Los errores de importación siguen saliendo por `notice`, arriba. El estado vacío corresponde a la última fila de la tabla.
- Sin hex, sin `slate-*` y sin tokens de rama dentro del bloque.

## 9. Backlog

**T1 — Storage: meta, copia interna y persist.**
- Archivos: `storage.ts`, `storage.test.ts`.
- Qué hacer: implementar el §7 (parte de storage) y quitar la doble línea en blanco.
- Dependencias: ninguna.
- Aceptación:
  - Los tests del §11 pasan.
  - Las funciones aún no se usan en la app.
  - `build`, `lint` y `test` en verde.

**T2 — Conectar en App.**
- Archivos: `App.tsx`, `main.tsx`.
- Qué hacer:
  - `requestPersist()` en `main.tsx`.
  - `now` único en `App.tsx`, estado `lastExport` y `exportData` con meta y revocación retrasada.
  - `backupCurrent` en `importData` y en `reset`.
  - Flujo de exportación previa en `reset`.
  - Calcular `copy` (todavía no se pasa a `HomeView`).
- Dependencias: T1.
- Aceptación:
  - Al exportar se escribe `life-rpg-meta-v1`.
  - Al importar o borrar con datos aparecen las claves `.backup.last` con el valor previo.
  - Con meta ausente y datos, «Borrar todo» pregunta primero si quieres exportar.
  - La app funciona igual en lo demás.
  - `build`, `lint` y `test` en verde.

**T3 — Bloque «Tus datos».**
- Archivos: `HomeView.tsx`, `App.tsx` (pasar `copy`).
- Qué hacer: implementar el §8 y eliminar el `<footer>`.
- Dependencias: T2.
- Aceptación:
  - Los seis casos de la línea de estado se ven como en la tabla.
  - Exportar actualiza a «Última copia: hoy.» sin recargar.
  - Sin scroll horizontal a 320 px.
  - Targets de al menos 44 px.
  - Checklist del §11 superado.
  - `build`, `lint` y `test` en verde.

Commit por tarea en cuanto pase cada una.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Firefox muestra un diálogo de permiso con `persist()` al arrancar. | Solo se pide si `persisted()` es falso, y el navegador recuerda la respuesta. | Mover `requestPersist()` al primer `exportData`, que es un gesto del usuario. |
| La copia interna llena la cuota y `save*` falla sin avisar. | Una sola copia por clave (`.backup.last`), sobrescrita, y solo si hay datos. | Quitar `backupCurrent` del flujo de «Borrar todo» y dejarlo solo en importar. |
| El usuario cancela la descarga y aun así se cuenta como copia. | Es aceptable y está marcado con `ponytail:`. | — |
| El texto del primer `confirm` es largo. | Explica qué hace cada botón porque los nativos dicen «Aceptar» y «Cancelar». | Recortar el texto, sin cambiar el flujo. |
| El warning de purity de oxlint en `App.tsx`. | Un solo `new Date()` en el render. | `lint` sale con 0 errores; se aceptan warnings. |

Si hay que recortar, se quita primero la copia interna (T2, parte de `backupCurrent`) y después `requestPersist`. El bloque y el aviso son el núcleo.

## 11. Verificación

**`selfcheck.ts`:** sin cambios, porque no cambian las reglas de juego. Debe seguir saliendo `[selfcheck] done` sin fallos.

**Tests nuevos en `storage.test.ts`** (con `fakeStore`, con `getItem`/`setItem`):
- `loadLastExport`:
  - Clave ausente → `null`.
  - `'{roto'` → `null`.
  - `{"lastExportAt":"x"}` → `null`.
  - `[]` → `null`.
  - Válido → la cadena.
  - Un `getItem` que lanza → `null`.
- `saveLastExport` y `loadLastExport`: el roundtrip devuelve la misma ISO. Un `setItem` que lanza no propaga el error.
- `exportAge`:
  - `null` → `null`.
  - Mismo instante → 0.
  - +13 días y 23 h → 13.
  - +14 días → 14.
  - Fecha futura → 0.
- `backupDue`:
  - Sin datos y nunca → `{ days: null, due: false }`.
  - Con datos y nunca → `due: true`.
  - Con datos, 13 días → `false`.
  - Con datos, 14 días → `true`.
- `backupCurrent`:
  - Copia los valores brutos de las dos claves a `.backup.last`.
  - Si una clave falta, no escribe su copia.
  - Con un store cuyas escrituras fallan, no lanza.
  - Una segunda llamada sobrescribe la copia anterior.

**Checklist manual** (`npm run dev`, móvil a 375 px y escritorio):
1. Con el navegador limpio: la home muestra «Tus datos» con «Tus datos se guardan solo en este navegador.» y sin aviso.
2. Pulsa «Cargar ejemplo»: aparece el aviso «Aún no has exportado ninguna copia…».
3. Pulsa «Exportar copia»: se descarga el JSON y el estado pasa a «Última copia: hoy.». Recarga y sigue igual.
4. En DevTools, pon `lastExportAt` a hace 20 días y recarga: «Tu última copia es de hace 20 días…».
5. Pulsa «Borrar todo» con la copia vieja:
   - Sale el primer diálogo. «Aceptar» descarga y no borra; el aviso de arriba lo confirma.
   - Pulsa «Borrar todo» otra vez: va directo al diálogo de borrado. Acepta: queda vacío y existe `life-rpg-demo-v1.backup.last` con los eventos anteriores.
6. Importar una copia con datos: existe `.backup.last` con el estado previo. Importar un archivo no válido muestra el aviso de siempre.
7. En la consola: `await navigator.storage.persisted()` tras recargar (en Chrome suele ser `true` si el sitio tiene engagement; basta con que no haya errores).
8. Sin scroll horizontal a 320 px. Navegando con el teclado, el foco es visible en los tres botones.

`npm run build`, `npm run lint` y `npm test` en verde desde `app/`.

## 12. Handoff para Claude Code

- Empieza por T1: es puro y con tests, y no toca la UI. Después T2 y T3, con un commit por tarea.
- No renombres claves ni cambies el formato de `life-rpg-demo-v1`, `life-rpg-custom-v1` ni del JSON de exportación (`version: 1`).
- No cambies el texto del `confirm` de borrado: está fijado en `STYLE_GUIDE.md`. El único texto nuevo de `confirm` es el de la exportación previa (§7).
- No toques los chips «de ejemplo» ni «Party de ejemplo».
- Todo lo de `localStorage` y `navigator.storage` va en `storage.ts`. `HomeView` sigue siendo presentacional: recibe `copy` y callbacks.
- Cierra el dev server antes de `npm ci` (EPERM en el ciclo 2). Deja en el informe la salida de `build`, `lint` y `test`.
