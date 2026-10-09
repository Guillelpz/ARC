# TECH SPEC — Importar y fusionar + compartir la copia (ciclo 21)

> Fuentes: `docs/cycles/cycle-20/evaluation.md` (P20.3, alternativa barata y conflictos), `docs/cycles/cycle-15/proposals.md` y `evaluation.md` (P15.2 con sus cambios). Opción A aprobada por el usuario: no hay servidor.

## 1. Resumen

- **Importar y fusionar:** un botón nuevo junto a «Importar copia» que une la copia con los datos actuales en lugar de reemplazarlos. Antes de confirmar se muestra un resumen (registros nuevos, los que ya estaban, misiones nuevas y conflictos). Antes de aplicar se ejecuta `backupCurrent`, y «Recuperar copia anterior» deshace la fusión.
- **Compartir la copia (P15.2):** en la app instalada en móvil, «Exportar copia» abre la hoja nativa (`navigator.share`) y solo cuenta como copia si se comparte de verdad. En cualquier otro caso se descarga como hoy.
- **Lo que no se hace:** no hay sincronización automática ni servidor, el formato de exportación no cambia, no se añade marca `resetAt` y la importación con reemplazo sigue igual.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Dónde vive la fusión | `core/merge.ts`, función pura `mergeBackup(local, incoming)` | Es lógica de dominio y no de persistencia. `storage.ts` sigue siendo solo E/S. |
| Formato exportado | Sin cambios (`version: 1`), con `parseBackup` reutilizado | Las copias antiguas siguen siendo compatibles sin hacer nada. |
| Identidad de un evento | Mismo `id` y además el mismo `trackerId`, `amount` y `occurredAt`. `undoes` no se compara | `readEvents` puede haber quitado un `undoes` inválido en un lado, y eso no convierte el evento en otro distinto. |
| Mismo `id` con contenido distinto (`seed-NN` de «Cargar ejemplo» en dos dispositivos, o cualquier otra colisión) | Se conserva el local y el entrante se añade con el id `${id}~2` (`~3`… si ese también está ocupado con otro contenido). Los `undoes` entrantes que apuntaban al id original se reasignan al nuevo | No se pierde nada y es idempotente: volver a fusionar la misma copia encuentra `seed-01~2` idéntico y lo cuenta como «ya estaba». |
| Deshacer duplicado | Si un negativo entrante con `undoes: X` llega cuando ya hay en local otro negativo que deshace X, se descarta y cuenta como «ya estaba» | El mismo registro deshecho en los dos dispositivos restaría dos veces. Es la misma intención. |
| Resurrección tras «Borrar todo», importar o `restoreLast` | **Sin `resetAt`.** Se documenta con `ponytail:` y se avisa en el texto de confirmación | Los eventos no tienen fecha de creación (`occurredAt` puede ser un día pasado), así que una marca de tiempo no distingue lo borrado de lo registrado después. Una «época» bloquearía también lo nuevo del otro dispositivo. El exceso se ve en el resumen y se deshace con «Recuperar copia anterior». |
| Misiones propias (`custom.trackers`) | Unión por `id`. Si el id existe en los dos lados, **se mantiene la local** y, si algún campo difiere, el nombre se lista como conflicto en el resumen | Sin relojes fiables ni versión base, «gana este dispositivo» al menos es predecible, y avisar evita que la pérdida sea silenciosa. Lo creado solo en el otro dispositivo nunca se pierde. |
| `goals` (objetivos de las fijas HERO) | Se queda el local entero. Si el objetivo efectivo (`goals[id] ?? defaultGoal(id)`) difiere, se cuenta como conflicto con el nombre de la fija | Mismo criterio que una misión que existe en los dos lados. Si falta la clave, no se sabe si «nunca se cambió» o «se volvió al valor por defecto». |
| `goalLog` | Entradas locales más las entrantes cuyo `trackerId` sea una misión **añadida** desde la copia | El objetivo de cada actividad y su historial salen siempre del mismo lado. Mezclar historiales de dos lados genera semanas incoherentes. |
| `proposals` | Unión por `(trackerId, partyId)`. Si coinciden, se queda la local | Ningún lado pierde propuestas. |
| Claves desconocidas de `custom` | Se conservan las locales y se ignoran las entrantes | Coherente con el `ponytail:` de `storage.ts:74`. |
| Clave bloqueada al fusionar | Igual que importar: `stale` corta con `STALE_BLOCK_TEXT`; si no, `backupCurrent` (si `hasData`) y después `unlockStorage()` | El aviso de carga ya dice «hasta que importes una copia», y fusionar también es importar. |
| UI de confirmación | `window.confirm` con el resumen en el texto | Es el patrón que ya usan importar, borrar y recuperar. No hace falta un modal nuevo. |
| Cuándo se comparte | `matchMedia('(display-mode: standalone)').matches && matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })` | Así lo pide el evaluador (solo en standalone). Se añade `pointer: coarse` porque una PWA de escritorio instalada también es standalone y abriría la hoja de Windows, que no tiene «Guardar». |
| Resultado del compartir | Si resuelve → copia hecha. `AbortError` → no cuenta y se avisa. `NotAllowedError` u otro error → descarga, que sí cuenta, como hoy | Son los cambios que pidió el evaluador en P15.2. |
| Dónde está el código de compartir | En `exportData` de `App.tsx`, que pasa a ser `async` y devuelve `Promise<boolean>` | Hay un único llamador real con lógica, y un módulo aparte no se reutilizaría. |

## 3. Decisiones que requieren aprobación

Ninguna. No hay backend, dependencias, cambios de formato persistido ni cambios de reglas de juego. Condición previa que sigue abierta desde el ciclo 15: comprobar en el iPhone real que la PWA instalada comparte la copia. Está en el checklist manual y no bloquea la implementación, porque si `share` no existe se usa la descarga de hoy.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/merge.ts` (nuevo) | `mergeBackup()` y el tipo `MergeResult`. |
| `app/src/core/selfcheck.ts` | Asserts de la sección «M» (fusión). |
| `app/src/App.tsx` | `mergeData(text)`, `exportData` asíncrono con share y fallback, y el aviso de `reset` que depende de la promesa. |
| `app/src/components/HomeView.tsx` | Botón «Importar y fusionar», prop `onMerge` y modo del input de archivo compartido. |
| `app/src/App.test.tsx` | Tests de fusionar y de compartir. |

No se tocan `storage.ts`, `types.ts` ni el formato de las claves.

## 5. Modelos de datos

```ts
// core/merge.ts
export type MergeResult = {
  events: ActivityEvent[]   // local + nuevos (locales primero, en su orden; luego los entrantes añadidos, en el orden del archivo)
  custom: CustomData
  added: number             // eventos añadidos (incluye renamed)
  existing: number          // eventos entrantes que ya estaban (idénticos o deshacer duplicado)
  renamed: number           // añadidos con id `~n` por colisión
  trackersAdded: number     // misiones propias añadidas
  conflicts: string[]       // nombres (locales) de misiones/fijas donde la copia difiere; se mantiene lo local
  changed: boolean          // added + trackersAdded + propuestas/goalLog añadidos > 0
}
```

Los tipos persistidos no cambian.

## 6. Persistencia y migración

- No hay migración: el formato de `life-rpg-demo-v1`, `life-rpg-custom-v1` y el JSON exportado se mantiene igual. Las copias ya exportadas sirven para reemplazar y para fusionar.
- La fusión escribe por el camino de siempre (`setEvents` y `setCustom` → efectos de guardado). Antes de aplicarla se llama a `backupCurrent()` (con rotación `.backup.last` → `.backup.prev`). Si falla, se aborta con aviso y no se toca nada.
- Los ids `seed-NN~2` son strings válidos para `readEvents` y no necesitan cambios en la validación.

## 7. Lógica de dominio

`mergeBackup(local: { events; custom }, incoming: { events; custom }): MergeResult`. Es pura y no muta sus entradas.

**Eventos**
```
same(a, b) = a.trackerId === b.trackerId && a.amount === b.amount && a.occurredAt === b.occurredAt
byId  = Map(local.events por id)      // se amplía con cada añadido
undone = undoneIds(local.events)      // Set; se amplía con cada deshacer añadido
rename = Map<idOriginal, idFinal>

Pasada 1 (ids finales), por cada e entrante:
  id = e.id; n = 1
  loop: l = byId.get(id)
        si !l            → nuevo con id
        si same(l, e)    → existente (si id !== e.id, es un renombrado ya fusionado antes)
        si no            → id = `${e.id}~${++n}`, repetir
  si id !== e.id: rename.set(e.id, id)
  apuntar (e, id, esExistente); si es nuevo, byId.set(id, e) para que los duplicados del propio archivo se detecten

Pasada 2, por cada e entrante en orden:
  si esExistente → existing++
  si no:
    u = e.undoes !== undefined ? (rename.get(e.undoes) ?? e.undoes) : undefined
    si e.amount < 0 && u && undone.has(u) → existing++ (deshacer duplicado)
    si no → push { ...e, id, ...(u && { undoes: u }) }; added++; si id !== e.id: renamed++; si e.amount < 0 && u: undone.add(u)
```
- `// ponytail:` en `merge.ts` (tres límites): (1) lo borrado con «Borrar todo», importar o `restoreLast` y que sigue en la copia vuelve, porque sin servidor ni fecha de creación no hay forma de distinguirlo; para cerrarlo haría falta `createdAt` por evento o un servidor. (2) Dos correcciones (negativos sin `undoes`) del mismo registro hechas en los dos dispositivos restan dos veces, y el día puede quedar en negativo; se corrige con «+». (3) La misma actividad apuntada a mano en los dos dispositivos son dos registros distintos (ids distintos).

**Custom**
- `trackers`: los locales sin cambios, y además los entrantes cuyo `id` no está en local (`trackersAdded`). Si el id está en los dos lados, se compara `name, increment, weeklyGoal ?? null, !!archived, branch, type, unit, xpPerUnit`. Si alguno difiere, se añade a `conflicts` el `name` local.
- `goals`: `local.goals` sin cambios. Por cada fija con `defaultGoal(id) !== undefined`, si `(local.goals?.[id] ?? def) !== (incoming.goals?.[id] ?? def)`, se añade a `conflicts` el nombre de la fija (`TRACKERS`).
- `goalLog`: `[...(local.goalLog ?? []), ...(incoming.goalLog ?? []).filter(e => addedIds.has(e.trackerId))]`. La clave se omite si queda vacía (convención actual).
- `proposals`: `local.proposals` más las entrantes cuyo par `(trackerId, partyId)` no esté en local.
- Resultado: `{ ...local.custom, trackers, proposals, ...(goals), ...(goalLog) }`, sin `goals` ni `goalLog` si quedan vacíos.
- `changed = added > 0 || trackersAdded > 0 || propuestasAñadidas > 0 || goalLogAñadidas > 0`.

No cambia ninguna regla de stats, RPG ni party, y los asserts existentes no se tocan.

## 8. UI

**Inicio → «Tus datos»** (`HomeView`)
- Se añade el botón «Importar y fusionar» (icono `Merge` de lucide-react, ya instalado) justo después de «Importar copia», con el mismo estilo secundario (`btn border border-app-border …`).
- El `<input type="file">` es el mismo para los dos botones. `const mode = useRef<'replace' | 'merge'>('replace')`: cada botón fija el modo antes de `fileRef.current?.click()`, y en `onChange` se llama a `file.text().then(mode.current === 'merge' ? onMerge : onImport, onImportError)`.
- Nueva prop `onMerge: (text: string) => void`.

**`mergeData(text)` en `App.tsx`**
1. Si `stale`, se muestra `setNotice(STALE_BLOCK_TEXT)` y termina.
2. `parseBackup(text)`. Si devuelve `null`, se muestra el mismo aviso que al importar («Ese archivo no es una copia válida de RPG Life Tracker.»).
3. `r = mergeBackup({ events, custom }, b)`.
4. Si `!r.changed`, se muestra el aviso `'Esa copia no trae nada nuevo: ya tienes todos sus registros.'`, con ` En ${r.conflicts.join(', ')} la copia tiene otros cambios; se mantiene lo de este dispositivo.` si hay conflictos. Termina sin confirmar ni copia interna.
5. Se pide `window.confirm` con este texto:
   `¿Fusionar esta copia con tus datos? Se añaden ${added} registros nuevos (${existing} ya estaban) y ${trackersAdded} misiones nuevas.`
   - si `renamed` es mayor que 0: ` ${renamed} registros coinciden en identificador con uno tuyo pero son distintos (p. ej. del ejemplo): se añaden aparte.`
   - si hay `conflicts`: ` En ${conflicts.join(', ')} la copia tiene otros cambios (nombre, incremento, objetivo o archivado): se mantiene lo de este dispositivo.`
   - `dropped` y `fixed` del parseo, con las mismas frases que al importar.
   - ` No se borra nada. Lo que hayas borrado aquí y siga en la copia volverá a aparecer. Si no te convence, «Recuperar copia anterior» lo deshace.`
   Si el usuario cancela, no pasa nada.
6. Si `hasData && !backupCurrent()`, se muestra el aviso `'No se pudo guardar la copia interna, así que no se ha fusionado nada. Exporta una copia y vuelve a intentarlo.'` y termina.
7. Se ejecuta `setCanRestore(hasLastBackup()); unlockStorage(); setEvents(r.events); setCustom(r.custom); setToast(null); setGain(null); setOvertake(null)`.
8. Se muestra el aviso `Copia fusionada: ${added} registros y ${trackersAdded} misiones nuevas.`

**Exportar (`exportData`, P15.2)**
```ts
async function exportData(): Promise<boolean> {
  const stamp = new Date().toISOString(), name = `rpg-life-tracker-${stamp.slice(0, 10)}.json`
  const text = exportBackup(events, custom, stamp)
  const done = () => { saveLastExport(stamp); setLastExport(stamp); requestPersist(); return true }
  const file = new File([text], name, { type: 'application/json' })
  // ponytail: Chrome Android no comparte application/json (canShare = false) → descarga. Solo en la app instalada en táctil:
  // en escritorio (incluida la PWA instalada) la hoja de compartir no tiene «Guardar archivo».
  if (window.matchMedia?.('(display-mode: standalone)').matches && window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return done() }
    catch (e) { if (e instanceof DOMException && e.name === 'AbortError') { setNotice('No se ha exportado la copia.'); return false } } // NotAllowedError (sin gesto, p. ej. tras confirm) u otro → descarga
  }
  /* descarga actual con <a download> y revokeObjectURL, sin cambios */
  return done() // ponytail actual: la descarga cuenta como copia al lanzarse
}
```
- `reset`: la rama «Aceptar exporta y no borra» pasa a `void exportData().then(ok => setNotice(ok ? 'Copia exportada. Pulsa «Borrar todo» otra vez si quieres borrar.' : 'No se ha exportado la copia y no se ha borrado nada.')); return`. `reset` no espera a la promesa: sale enseguida sin borrar, como hoy.
- Los demás llamadores (`HomeView.onExport`, `SaveFailBanner` en Inicio y en las ramas) siguen recibiendo `() => void`, y `exportData` encaja sin cambiar sus tipos. Si cancela desde una rama, el aviso solo se ve en Inicio, y el banner de guardado fallido sigue a la vista.

## 9. Backlog

**T1 — Fusión pura en `core/`**
- Objetivo: `mergeBackup` según §7.
- Archivos: `app/src/core/merge.ts` (nuevo) y `app/src/core/selfcheck.ts`.
- Depende de: nada.
- Aceptación: los asserts M1–M8 (§11) pasan, `build`, `lint` y `test` en verde, y la app no cambia (nada la usa todavía).

**T2 — «Importar y fusionar» en la UI**
- Objetivo: el botón, `mergeData` y el resumen de §8.
- Archivos: `HomeView.tsx`, `App.tsx` y `App.test.tsx`.
- Depende de: T1.
- Aceptación: los tests U-F1–U-F4 (§11) pasan, «Importar copia» (U6) sigue igual, a11y en verde, y `build`, `lint` y `test` en verde.

**T3 — Compartir la copia (P15.2)**
- Objetivo: `exportData` asíncrono con share y los fallbacks, y el aviso de `reset` según §8.
- Archivos: `App.tsx` y `App.test.tsx`.
- Depende de: nada (independiente de T1 y T2; si se hace en paralelo, rebasar sobre T2 por `App.tsx`).
- Aceptación: los tests U-S1–U-S4 pasan, U5 y U7 siguen en verde sin cambios (happy-dom no es standalone → descarga), y `build`, `lint` y `test` en verde. No se añade caso e2e.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| La fusión duplica datos (ejemplo cargado en los dos dispositivos, o la misma actividad apuntada en los dos) | El resumen muestra las cifras antes de confirmar, y «Recuperar copia anterior» deshace | Se acepta como límite (`ponytail:`). |
| Se pierde la edición de una misión hecha en el otro dispositivo | Se lista por nombre como conflicto en la confirmación | Rehacer la edición a mano. Un «gana la copia» por misión queda para otro ciclo si se pide. |
| `share` falla de forma distinta en iOS (sin gesto tras `confirm`) | Cualquier error que no sea `AbortError` pasa a la descarga | Recortar T3 sin tocar T1 ni T2. |
| `exportData` asíncrono rompe tests que esperan un efecto síncrono | En happy-dom no se cumple la condición de standalone, así que la descarga y `saveLastExport` siguen siendo síncronos antes del primer `await` | Envolver las aserciones nuevas en `vi.waitFor`. |
| Fusionar con una clave bloqueada pisa un original ilegible | Mismo criterio que importar (decisión explícita), y el original sigue en `.backup.<stamp>` si se pudo copiar | — |

## 11. Verificación

**Asserts en `selfcheck.ts` (T1)**, con `L` = 3 eventos locales `l1`–`l3` (incluye `seed-01` con fecha A) y 1 custom `custom-a`:
- M1: si la copia es igual a la local, `added === 0`, `existing === n` y `changed === false`.
- M2: un evento nuevo con UUID se añade al final y los locales mantienen el orden.
- M3: `seed-01` con otra fecha se añade como `seed-01~2`. Al volver a fusionar el resultado con la misma copia, `added === 0`.
- M4: un deshacer entrante con `undoes: 'seed-01'` se reasigna a `'seed-01~2'` cuando `seed-01` se ha renombrado.
- M5: si el registro X ya está deshecho en local y llega otro negativo con `undoes: X` e id distinto, cuenta como `existing` y no se añade.
- M6: un tracker entrante `custom-b` se añade junto con su entrada de `goalLog`. Un `goalLog` entrante de `gym` o de `custom-a` no se añade.
- M7: si `custom-a` tiene otro `name` en la copia, se queda el local y `conflicts` incluye su nombre. Si `goals.gym` difiere, `conflicts` incluye `'Gym'`.
- M8: las propuestas se unen por `(trackerId, partyId)` sin duplicados, y las entradas no se mutan (comparar `JSON.stringify` antes y después).

Los asserts existentes no cambian.

**Tests de UI (`App.test.tsx`)**, con `vi.waitFor` para leer localStorage:
- U-F1: con local `x1`, al fusionar una copia `{x1, x2}` el confirm contiene `1 registros nuevos (1 ya estaban)`. Tras aceptar, se guardan `[x1, x2]`, existe `.backup.last` y aparece el aviso «Copia fusionada: 1 registros y 0 misiones nuevas.».
- U-F2: si se cancela el confirm, localStorage no cambia y no se crea `.backup.last`.
- U-F3: al fusionar la misma copia otra vez, aparece el aviso «Esa copia no trae nada nuevo…» y no se pide confirm.
- U-F4: tras fusionar, «Recuperar copia anterior» vuelve al estado previo (solo `x1`).

**Tests de compartir** (`matchMedia` simulado con `matches: true`, y `navigator.canShare` y `navigator.share` con `Object.defineProperty(…, { configurable: true })`):
- U-S1: si `share` resuelve, se guarda `lastExportAt` y no se llama a `createObjectURL`.
- U-S2: si se rechaza con `AbortError`, no se guarda `lastExportAt`, aparece «No se ha exportado la copia.» y no hay descarga.
- U-S3: si se rechaza con `NotAllowedError`, se llama a `createObjectURL` y se guarda `lastExportAt`.
- U-S4: con `canShare` en `false`, hay descarga y no se llama a `share`.

**Checklist manual**
- [ ] En el iPhone con la PWA instalada, «Exportar copia» abre la hoja, «Guardar en Archivos» marca «Última copia: hoy» y cancelar no la marca.
- [ ] En el iPhone, «Borrar todo» → «Aceptar» (exportar) descarga o comparte y el aviso coincide con lo ocurrido.
- [ ] En el escritorio (pestaña y PWA instalada), «Exportar copia» sigue descargando el archivo.
- [ ] En Android con la PWA, la copia se descarga.
- [ ] Hacer «Cargar ejemplo» en dos navegadores con fechas distintas (cambiar el reloj), exportar en uno y fusionar en el otro: se ven los dos conjuntos, al recargar sigue igual y una segunda fusión dice «nada nuevo».
- [ ] Fusionar y después «Recuperar copia anterior» deja el estado previo.
- [ ] En móvil estrecho (360 px), los cuatro botones de «Tus datos» se reparten en varias líneas sin desbordar.

## 12. Handoff para Claude Code

1. Empezar por T1: `merge.ts` con el pseudocódigo de §7 tal cual, más los asserts M1–M8. Reutilizar `undoneIds` (`stats.ts`), `defaultGoal` y `TRACKERS` (`trackers.ts`). No tocar `storage.ts`.
2. T2: copiar la estructura de `importData` para `mergeData` (stale → parse → confirm → `backupCurrent` → `unlockStorage` → set). Los textos son exactamente los de §8.
3. T3: `exportData` según §8. No añadir un módulo de utilidades, ni tipos propios para `navigator.share` (ya están en `lib.dom`), ni un caso e2e.
4. Cada tarea se cierra con `npm run build`, `npm run lint` (`--deny-warnings`) y `npm test` en verde desde `app/`, y `[selfcheck] done` sin fallos en `npm run dev`. No actualizar `docs/ESTADO-ACTUAL.md` en este ciclo.
