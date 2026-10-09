# TECH SPEC — Racha con objetivo vigente y aviso de guardado fallido (ciclo 11)

Fuente: `docs/cycles/cycle-11/proposals.md` (P11.1, P11.3, P11.5) con los cambios de `docs/cycles/cycle-11/evaluation.md`. Base: `main` con los ciclos 1-10.

## 1. Resumen

- **P11.1 (+ P11.5):** al cambiar el objetivo semanal de una actividad (fija HERO o propia), se apunta el objetivo anterior en `custom.goalLog`. `streak` evalúa cada semana pasada con el objetivo que estaba vigente entonces. El registro se adjunta a cada `Tracker` en `allTrackers` como `pastGoals` (derivado, no se persiste) y solo se escribe en `App.saveTracker`. Se absorben los menores P11.5 (2) y (3).
- **P11.3:** `saveEvents`/`saveCustom` informan de si han podido escribir. Si falla una escritura, la home y la rama activa muestran un aviso persistente con «Exportar copia ahora», que se anuncia en la región `role="status"` global. El aviso desaparece con el siguiente guardado correcto.
- **Fuera de alcance:** reconstruir objetivos anteriores al registro, mostrar el histórico en la UI, XP por racha, límites VILLAIN (P11.2), purgar `.backup.<stamp>` (descartado en la evaluación), reintentos, IndexedDB. P11.5 (1) ya está hecho (`App.tsx:128` pasa `c.goals`).

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Semántica de `until` | `until` = lunes (YYYY-MM-DD) de la semana en que se hizo el cambio. Es **exclusivo**: `goal` rige en las semanas cuyo lunes es `< until`. La semana del cambio y las siguientes usan el siguiente apunte o, si no lo hay, el objetivo actual. |
| Objetivo de una semana pasada `w` | Es el primer apunte (por `until` ascendente) con `until > w`. Si no hay ninguno, se usa `weeklyGoal` actual. |
| «Antes del primer apunte, el objetivo actual (retroactivo)» | Las semanas anteriores al primer apunte usan el `goal` de ese apunte, que era el objetivo actual hasta ese momento. Es la misma retroactividad de hoy, congelada en el momento del cambio. Si no hay apuntes, se usa el objetivo actual de hoy (S5/G4 no cambian). Es la única lectura en la que bajar el objetivo no hace crecer la racha hacia atrás. |
| Varios cambios en la misma semana | `logGoal` no añade nada si ya existe un apunte con el mismo `trackerId` y `until`: cuenta el primero. |
| `null → objetivo` | Se apunta `goal: null`. En `streak`, una semana pasada con objetivo `null` corta la racha, así que la racha empieza en la semana del cambio. |
| `objetivo → null` | Se apunta el objetivo anterior. Sin objetivo actual, `streak` = 0, como hoy. |
| Objetivo efectivo de las fijas | Antes: `c.goals[id] ?? defaultGoal(id)`. Después: lo mismo, pero tras `setGoal`. «Sin valor» en una fija vuelve al valor por defecto, y eso es lo que se apunta. Así el redondeo y el valor por defecto quedan cubiertos. |
| `pastGoals` en `Tracker` | Es derivado: `allTrackers` lo pone o lo quita siempre y `saveTracker` lo elimina antes de guardar. Nunca llega a `c.trackers`. |
| `goals: {}` (P11.5-2) | `saveTracker` quita la clave `goals` cuando `setGoal` devuelve `{}`. Igual con `goalLog` vacío: no se escribe la clave. |
| Clave bloqueada (P11.3) | Si la clave está bloqueada, `save*` devuelve `null`: no se intenta escribir y no se muestra el aviso nuevo, porque ya lo da `noticeFor`. `false` = `setItem` lanzó. `true` = se escribió. |
| Anuncio accesible | Se usa el `<p role="status">` global de `App`. Si el guardado ha fallado, su texto es el del fallo, que tiene prioridad sobre el toast y el adelantamiento. El banner visible no lleva `role`, para no duplicar el anuncio ni romper U18 (`getByRole('status')`). |
| `hasData` | También cuenta `goalLog` no vacío, para que «Borrar todo» haga `backupCurrent` aunque solo haya cambios de objetivo. |

## 3. Decisiones que requieren aprobación

Ninguna. El usuario ya ha aprobado la regla y el esquema de `goalLog`. No hay dependencias nuevas, no hay backend y no se elimina ningún atajo de la demo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `GoalLogEntry`, `PastGoal`; `Tracker.pastGoals?`; `CustomData.goalLog?`. |
| `app/src/core/trackers.ts` | `allTrackers(custom, goals, goalLog)` adjunta `pastGoals`; nuevo `logGoal`. |
| `app/src/core/stats.ts` | Nuevo `goalAt`; `streak` usa el objetivo vigente; se retira el `ponytail:` de la línea 51; comentario de contrato en `todaySummary`. |
| `app/src/core/storage.ts` | `readCustom` valida `goalLog`; `saveEvents`/`saveCustom` devuelven `boolean \| null`. |
| `app/src/core/selfcheck.ts` | Asserts GL1-GL6 y H6; S5 se renombra (mismo valor). |
| `app/src/core/storage.test.ts` | C10-C12 (goalLog) y W1-W2 (resultado de guardar). |
| `app/src/App.tsx` | `allTrackers(..., custom.goalLog)`; `saveTracker` reescrito; `hasData`; estado `unsaved`; texto de la región status; props del banner. |
| `app/src/components/SaveFailBanner.tsx` (nuevo) | Banner presentacional con tono `app`/`hero`/`villain` y botón «Exportar copia ahora». |
| `app/src/components/HomeView.tsx`, `MissionsView.tsx` | Props `saveFailed: boolean` y `onExport` (Missions); renderizan el banner al principio de `<main>`. |
| `app/src/App.test.tsx` | U19 (registro de objetivos) y U20 (guardado fallido). |

## 5. Modelos de datos

```ts
// types.ts
export type GoalLogEntry = { trackerId: string; goal: number | null; until: string } // until: lunes YYYY-MM-DD, exclusivo; goal rige en semanas < until (null = sin objetivo)
export type PastGoal = Omit<GoalLogEntry, 'trackerId'>

export type Tracker = {
  // …campos actuales…
  pastGoals?: PastGoal[] // derivado en allTrackers desde custom.goalLog, orden ascendente por until; nunca se persiste
}

export type CustomData = { trackers: Tracker[]; proposals: Proposal[]; goals?: Goals; goalLog?: GoalLogEntry[] } // goalLog ausente = sin cambios registrados
```

## 6. Persistencia y migración

- Clave `life-rpg-custom-v1`, campo opcional nuevo `goalLog`. No hay migración: si falta, todo funciona como hoy (racha retroactiva con el objetivo actual). El formato no cambia de versión.
- `readCustom`:
  - Si `v.goalLog === undefined`, no hace nada.
  - Si no es un array, `dropped += 1` y se ignora.
  - Si es un array, conserva cada entrada válida: `isObj`, `trackerId` string no vacío, `goal === null || (typeof goal === 'number' && Number.isFinite(goal) && goal > 0)`, `until` con formato `/^\d{4}-\d{2}-\d{2}$/` y `mondayOf(until) === until`. Una entrada inválida suma 1 a `dropped`. No se comprueba que `trackerId` exista: es inocuo y conserva datos.
  - Solo pone `data.goalLog` si queda al menos una entrada, igual que `goals`. Así C6 sigue sin la propiedad.
  - Para conservar el orden de las claves: `data` = `{ trackers, proposals }`, después `goals` si lo hay y después `goalLog` si lo hay.
- Exportar/importar, `backupCurrent`, `readLast`/`restoreLast`: todos pasan por `JSON.stringify(custom)` y `readCustom`, así que el campo se conserva sin más código. Lo cubren los tests C11/C12.
- «Borrar todo» deja `EMPTY_CUSTOM` (sin `goalLog`) después de copiarlo en `.backup.last`.
- `saveEvents`/`saveCustom` no cambian el formato, solo el valor de retorno.

## 7. Lógica de dominio

### 7.1 `trackers.ts`

```ts
// Devuelve `log` (misma referencia) si no hay cambio o ya hay apunte de esta semana (cuenta el primero).
export function logGoal(log: GoalLogEntry[] = [], trackerId: string, old: number | null, next: number | null, today: string): GoalLogEntry[] {
  if (old === next) return log
  const until = mondayOf(today)
  if (log.some(e => e.trackerId === trackerId && e.until === until)) return log
  return [...log, { trackerId, goal: old, until }]
}

export function allTrackers(custom: Tracker[], goals: Goals = {}, goalLog: GoalLogEntry[] = []): Tracker[] {
  const past = new Map<string, PastGoal[]>()
  for (const { trackerId, goal, until } of [...goalLog].sort((a, b) => a.until.localeCompare(b.until))) // estable: empate → el primero apuntado
    past.set(trackerId, [...(past.get(trackerId) ?? []), { goal, until }])
  const withPast = (t: Tracker): Tracker => {
    const p = past.get(t.id)
    if (!p && !t.pastGoals) return t // mantiene la identidad de TRACKERS
    const { pastGoals: _, ...b } = t
    return p ? { ...b, pastGoals: p } : b
  }
  return [...TRACKERS.map(t => (goals[t.id] && t.weeklyGoal ? { ...t, weeklyGoal: goals[t.id] } : t)), ...custom].map(withPast)
}
```

`trackers.ts` importa `mondayOf` de `./stats`. `stats.ts` solo importa tipos, así que no hay ciclo. Comentario junto a `logGoal`: `// ponytail: crece como mucho una entrada por actividad y semana con cambio; sin compactar. Compactar si algún día pesa.`

### 7.2 `stats.ts`

```ts
// objetivo vigente en la semana pasada que empieza en `mon`: el primer apunte con until > mon; sin apunte posterior, el actual.
// Requiere pastGoals en orden ascendente (lo garantiza allTrackers). No usar `??`: goal null es un valor válido.
export const goalAt = (t: Tracker, mon: string): number | null | undefined => {
  const p = t.pastGoals?.find(x => x.until > mon)
  return p ? p.goal : t.weeklyGoal
}
```

En `streak`:
- Se quita el `ponytail:` de las líneas 51-52 y se sustituye por: `// semanas pasadas con el objetivo vigente entonces (goalAt); la semana en curso, con el actual. O(semanas · eventos del tracker).`
- La semana en curso no cambia: usa `t.weeklyGoal`, y `if (!goal) return 0` se mantiene.
- En el bucle: `const g = goalAt(t, w); if (!g || total(own, t.id, w, addDays(w, 7)) < g) break`.
- `first` (el corte en el primer evento) no cambia.

En `todaySummary`, encima de la función (P11.5-3): `// stats debe venir de deriveGame(events, today, …) con el mismo today: missing usa s.week, que es la semana de ese today.`

`deriveGame`, `derivePartyState`, `trackerStats` y `goalPct` no cambian de firma. Reciben los trackers con `pastGoals` desde `App`.

### 7.3 `App.saveTracker` (único punto de escritura del registro)

```ts
const saveTracker = (input: Tracker) => {
  const { pastGoals: _, ...t } = input // derivado: no se persiste
  setCustom(c => {
    const old = t.custom ? c.trackers.find(x => x.id === t.id)?.weeklyGoal : (c.goals?.[t.id] ?? defaultGoal(t.id))
    let next: CustomData, now: number | undefined
    if (t.custom) { next = { ...c, trackers: c.trackers.map(x => (x.id === t.id ? t : x)) }; now = t.weeklyGoal }
    else {
      const { goals: _g, ...rest } = c
      const goals = setGoal(c.goals, t.id, t.weeklyGoal ?? null)
      next = Object.keys(goals).length ? { ...rest, goals } : rest // P11.5-2: sin goals: {}
      now = goals[t.id] ?? defaultGoal(t.id)
    }
    const goalLog = logGoal(c.goalLog, t.id, old ?? null, now ?? null, today)
    return goalLog.length ? { ...next, goalLog } : next
  })
}
```

Esto cubre la edición de fijas y propias, el archivar con formulario (P9.1) y `unarchive`, que pasa por `saveTracker` y no cambia el objetivo, así que no apunta nada. Las VILLAIN fijas tienen `old = now = null` y no apuntan nada. `create` y `propose` no cambian.

En `App`:
- `trackers = useMemo(() => allTrackers(custom.trackers, custom.goals, custom.goalLog), [custom.trackers, custom.goals, custom.goalLog])`.
- `hasData` añade `|| (custom.goalLog?.length ?? 0) > 0`.

### 7.4 Guardado (P11.3)

```ts
// true = escrito; false = setItem lanzó (cuota, modo privado…); null = clave bloqueada, no se intenta (lo avisa noticeFor)
export const saveEvents = (e: ActivityEvent[], store: Store = localStorage): boolean | null => {
  if (locked.has(KEY)) return null
  try { store.setItem(KEY, JSON.stringify(e)); return true } catch { return false }
}
// saveCustom: igual con CUSTOM_KEY
```

En `App`:

```ts
const [unsaved, setUnsaved] = useState({ events: false, custom: false })
useEffect(() => { const ok = saveEvents(events); if (ok !== null) setUnsaved(u => (u.events === !ok ? u : { ...u, events: !ok })) }, [events])
useEffect(() => { const ok = saveCustom(custom); if (ok !== null) setUnsaved(u => (u.custom === !ok ? u : { ...u, custom: !ok })) }, [custom])
const saveFailed = unsaved.events || unsaved.custom
```

- Cada clave se limpia con su siguiente guardado correcto.
- `saveLastExport` no cambia: el meta no son datos del usuario.
- Constante exportada desde `SaveFailBanner.tsx`: `SAVE_FAIL_TEXT = 'No se ha podido guardar en este navegador. Lo que registres ahora se perderá al recargar: exporta una copia.'`
- Región status: `{saveFailed ? SAVE_FAIL_TEXT : liveText(toast, overtake)}`.

## 8. UI

- **`SaveFailBanner({ tone: 'app' | 'hero' | 'villain', onExport })`**: es un `div` sin `role`, con `CircleAlert` (`aria-hidden`), el texto `SAVE_FAIL_TEXT` y un botón «Exportar copia ahora» (icono `Download`) que llama a `onExport`. No tiene botón de cerrar porque el aviso es persistente. Clases por tono:
  - `app`: `border-app-border bg-app-surface text-app-text`. Botón: `border border-app-border text-app-text outline-app-text hover:bg-app-bg`.
  - `hero`: `border-hero-border bg-hero-surface text-hero-text`. Botón: `border border-hero-border text-hero-text outline-hero`.
  - `villain`: `border-villain-border bg-villain-surface text-villain-text`. Botón: `border border-villain-border text-villain-text outline-villain`.
  - Base: `flex items-start gap-3 rounded-xl border p-4 shadow-sm`. Botón: `min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2`.
  - Sin hex ni `slate-*`. El nombre «Exportar copia ahora» lo distingue del «Exportar copia» de «Tus datos» (U5).
- **HomeView**: con `saveFailed`, el banner (`tone="app"`, `onExport={onExport}`) va como primer hijo de `<main>`, antes de `notice`, con `lg:col-span-2`.
- **MissionsView**: props nuevas `saveFailed` y `onExport`. El banner (`tone={branch}`) va dentro de `<main>`, justo después de `<header>`.
- `UnknownView` y `PartyView` no muestran el banner. La propuesta pide «home y rama activa», y la región status lo anuncia en cualquier pantalla.
- No hay UI nueva para P11.1: la tarjeta muestra la racha calculada con la regla nueva.

## 9. Backlog

**T1 — Núcleo de objetivos vigentes** (sin dependencias)
- Archivos: `types.ts`, `trackers.ts`, `stats.ts`, `selfcheck.ts`.
- Hacer: tipos §5; `logGoal` y `allTrackers` con `goalLog` (§7.1); `goalAt` y `streak` (§7.2); comentario de `todaySummary`; asserts GL1-GL6 y H6; renombrar S5.
- Aceptación: S1-S6, G1-G4 y H1-H5 siguen pasando con los mismos valores; los asserts nuevos pasan; `npm test`, `build` y `lint` en verde. La app no cambia de comportamiento, porque `App` aún no pasa `goalLog`.

**T2 — `goalLog` en almacenamiento** (depende de T1)
- Archivos: `storage.ts`, `storage.test.ts`.
- Hacer: validación de §6 en `readCustom`; tests C10-C12.
- Aceptación: C1-C9 sin cambios; C10-C12 pasan.

**T3 — Escribir el registro en `saveTracker`** (depende de T1 y T2)
- Archivos: `App.tsx`, `App.test.tsx`.
- Hacer: §7.3 (`saveTracker`, `allTrackers` con `goalLog`, `hasData`); test U19.
- Aceptación: U9, U10, U13 y U16 siguen pasando; U19 pasa; `goals: {}` ya no se persiste.

**T4 — `save*` devuelve el resultado** (sin dependencias)
- Archivos: `storage.ts`, `storage.test.ts`.
- Hacer: §7.4 en storage; tests W1-W2; añadir `saveCustom` al import del test.
- Aceptación: «sin poder copiar: bloquea» y R6 siguen pasando; W1-W2 pasan.

**T5 — Aviso de guardado fallido** (depende de T4)
- Archivos: `components/SaveFailBanner.tsx` (nuevo), `HomeView.tsx`, `MissionsView.tsx`, `App.tsx`, `App.test.tsx`.
- Hacer: estado `unsaved`, región status y banner en la home y en la rama (§7.4, §8); test U20.
- Aceptación: U1-U18 sin cambios; U20 pasa; el chequeo axe (`a11y.test.tsx`) sigue en verde.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| `pastGoals` se cuela en `c.trackers` (un derivado persistido) | Se elimina en `saveTracker` y `allTrackers` lo recalcula siempre; U19 comprueba que no está en `trackers[]`. | — |
| Usar `??` en `goalAt` convierte `null` en el objetivo actual | Comentario en el código y assert GL3. | — |
| `until` desordenado (importado o con el reloj cambiado) | `allTrackers` ordena; `find` toma el primero con `until > w`. | — |
| `setState` en efectos provoca renders de más | El updater devuelve el mismo objeto si no cambia nada. | — |
| El espía de `setItem` no intercepta en happy-dom | Usar `vi.spyOn(Storage.prototype, 'setItem')`; si no intercepta, `vi.spyOn(localStorage, 'setItem')`. | — |
| Recorte | — | Si T5 se alarga, se entrega solo con el banner de la home y la región status, y el de MissionsView pasa al ciclo siguiente. P11.1 no se recorta. |

## 11. Verificación

### Asserts en `selfcheck.ts` (bloque «S1–S6», junto a G4)

`DEMO_DATE = 2026-10-07` (miércoles; lunes en curso `2026-10-05`). Se usan `s3` (semanas 14/9: 4, 21/9: 3, 28/9: 4) y `G = TRACKERS[0]` (gym, objetivo 4).

| id | Assert | Esperado |
|---|---|---|
| S5 (renombrado) | `st(s3, { ...G, weeklyGoal: 3 }) === 3`, mensaje `'S5 sin registro: objetivo actual retroactivo'` | 3 (sin cambio de valor) |
| GL1 bajar | `st(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: 4, until: '2026-10-05' }] })` | 1 (28/9 cumple 4; 21/9 tiene 3 < 4). Sin registro daría 3. |
| GL2 subir | `st(s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] })` | 3. Sin registro daría 0. |
| GL3 null→objetivo | `st(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] })` | 1 (28/9 con el actual 3; 21/9 con null corta) |
| GL4 logGoal | `l1 = logGoal(undefined, 'gym', 4, 3, DEMO_DATE)` → `[{ trackerId: 'gym', goal: 4, until: '2026-10-05' }]`; `logGoal(l1, 'gym', 3, 2, '2026-10-09') === l1`; `logGoal(l1, 'gym', 3, 3, DEMO_DATE) === l1`; `logGoal(l1, 'gym', 3, 5, '2026-10-12')` tiene longitud 2 y el último es `{ goal: 3, until: '2026-10-12' }` | la primera de la semana manda |
| GL5 allTrackers | `a = allTrackers([], { gym: 3 }, [{ trackerId: 'gym', goal: 2, until: '2026-10-05' }, { trackerId: 'gym', goal: 4, until: '2026-09-28' }])`: los `until` de `a[0].pastGoals` son `'2026-09-28,2026-10-05'`; `a[1] === TRACKERS[1]`; `TRACKERS[0].pastGoals === undefined`; `streak(s3, a[0], DEMO_DATE) === 1` (28/9 con objetivo 2; 21/9 con 4 corta) | orden e inmutabilidad |
| GL6 deriveGame | `get(deriveGame(s3, DEMO_DATE, allTrackers([], { gym: 3 }, [{ trackerId: 'gym', goal: 4, until: '2026-10-05' }])), 'gym').streak === 1` | el registro llega al motor |
| H6 (P11.5-3) | con `hv` (H1): `todaySummary(hv, deriveGame(hv, DEMO_DATE).trackers, DEMO_DATE).missing` cumple `left === weeklyGoal − week` del mismo `game` para todos los elementos; y con `'2026-10-12'` en los dos sitios, gym `left === 4` (semana nueva) | contrato del mismo `today` |

**Ningún assert existente cambia de valor.** S1-S6, G1-G4, H1-H5 y K* usan trackers sin `pastGoals` y por tanto la regla de antes. S5 solo se renombra.

### Tests de `storage.test.ts`

- **C10 válidos:** `readCustom({ goalLog: [{ trackerId: 'gym', goal: 4, until: '2026-10-05' }, { trackerId: 'custom-x', goal: null, until: '2026-09-28' }] })` conserva los dos, con `dropped` 0 y `fixed` 0. `readCustom({})` no tiene la propiedad `goalLog`.
- **C11 inválidos:** `goalLog: 'x'` → `dropped` 1 y sin `goalLog`. Un array con `null`, `{ trackerId: '', … }`, `goal: 0`, `goal: '3'`, `until: '2026-10-06'` (no es lunes), `until: '5/10'` y una entrada válida → `dropped` 6 y queda 1.
- **C12 round-trip:** `parseBackup(exportBackup([], { trackers: [], proposals: [], goalLog: [e] }, 'x'))?.custom.goalLog` es `[e]`. `backupCurrent` + `readLast` sobre un `fakeStore` con `CU` que contiene `goalLog` → `readLast(s).custom.goalLog` es `[e]`.
- **W1:** `saveEvents([good], fakeStore())` y `saveCustom(EMPTY_CUSTOM, fakeStore())` → `true`. Con `fakeStore({}, true)` → `false` y no lanzan.
- **W2:** en «sin poder copiar: bloquea», `saveEvents([good], s)` → `null` (además de lo que ya comprueba).

### Tests de UI en `App.test.tsx`

Las lecturas de localStorage posteriores a una acción van dentro de `await vi.waitFor(...)`.

- **U19 registro de objetivos:** `render`, ir a HERO.
  - Editar el objetivo de Gym a `3` (igual que `edit` de U13). Esperar: `custom.goals` es `{ gym: 3 }` y `custom.goalLog` es `[{ trackerId: 'gym', goal: 4, until: '2026-10-05' }]`.
  - Editar a `''`. Esperar: `custom` sin la clave `goals` (`not.toHaveProperty('goals')`) y `goalLog` con la misma única entrada.
  - Con `preload()` y `Meditar`, editar el objetivo a `5`. Esperar: `goalLog` contiene `{ trackerId: 'custom-med', goal: null, until: '2026-10-05' }` y `trackers[0]` no tiene `pastGoals`.
- **U20 guardado fallido:** `render`, ir a HERO, y `vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })`.
  - Pulsar «+1 sesiones» en Gym. Esperar: aparece `SAVE_FAIL_TEXT` en la pantalla y la región `status` tiene ese texto.
  - `go('Inicio')`: el banner sigue ahí, con el botón «Exportar copia ahora». Al pulsarlo se llama a `URL.createObjectURL`.
  - `spy.mockRestore()`, volver a HERO y pulsar «+1 sesiones» otra vez. Esperar: el texto desaparece y `stored()` tiene 2 eventos.

### Checklist manual

1. Gym con 4/4 en las dos semanas anteriores. Bajar el objetivo a 2: la racha no crece. Recargar: se mantiene.
2. Cambiar el objetivo dos veces en el mismo día: `goalLog` (DevTools) tiene una sola entrada.
3. Exportar, «Borrar todo», importar: `goalLog` vuelve y la racha es la misma.
4. En DevTools, llenar la cuota (`localStorage.setItem('x', 'a'.repeat(1e7))` en un bucle) y registrar: aparece el aviso en HERO (claro) y en VILLAIN (oscuro), legible en los dos. Borrar `x` y registrar: el aviso desaparece.
5. Móvil (375 px): el banner no desborda y el botón mide ≥ 44 px de alto.
6. `npm run dev`: la consola termina en `[selfcheck] done` sin fallos.

## 12. Handoff para Claude Code

- Implementa en este orden: T1 → T2 → T3, luego T4 → T5 (T4 puede ir en paralelo a T1-T3). Al cerrar cada tarea, ejecuta `npm run build`, `npm run lint` y `npm test` desde `app/`.
- No cambies el valor de ningún assert existente. Si alguno falla, el fallo está en el motor.
- `pastGoals` es derivado: no lo escribas nunca en `custom`. El registro solo se escribe en `saveTracker`.
- No añadas purga de `.backup.<stamp>` ni dependencias. No toques `noticeFor` ni el flujo de clave bloqueada.
- No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
