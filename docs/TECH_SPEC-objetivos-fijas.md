# TECH SPEC — Objetivos semanales editables en las actividades fijas (P7.2b, ciclo 8)

Base: `main` con los ciclos 1-7. Fuente: `docs/cycles/cycle-7/proposals.md` (P7.2, parte b) con los cambios de `docs/cycles/cycle-7/evaluation.md`. P7.2a (límite VILLAIN) **no** entra.

## 1. Resumen

- El usuario puede cambiar el objetivo semanal de las 4 fijas HERO (Gym, BJJ, Running, Reading) desde su tarjeta, con el mismo formulario de edición que usan las actividades propias (ciclo 6). Si deja el campo vacío, vuelve el objetivo por defecto.
- Los overrides se guardan en `life-rpg-custom-v1` como `goals: { [trackerId]: number }`. Se aplican en `allTrackers` y se validan en `readCustom`. Los datos sin `goals` siguen siendo válidos.
- Exportar, importar y recuperar copia conservan los overrides porque pasan por `readCustom`.
- Queda fuera: objetivo o límite en VILLAIN (las fijas VILLAIN siguen sin objetivo), editar el nombre, el incremento o el XP de las fijas, archivar fijas, quitar el objetivo de una fija e histórico de objetivos.

## 2. Decisiones técnicas

| Tema | Decisión | Motivo |
|---|---|---|
| Dónde se aplica el override | `allTrackers(custom, goals = {})` devuelve copias de las fijas con `weeklyGoal` sustituido | Así `deriveGame`, `trackerStats`, `streak`, `todaySummary` y party lo reciben sin cambios |
| Qué ids admiten override | Solo las fijas con `weeklyGoal` en `TRACKERS`: gym, bjj, running y reading | P7.2a no está aprobada. Las propias ya guardan `weeklyGoal` en su objeto |
| Valor válido | Entero ≥ 1 | Coincide con `editTracker` y el formulario (`Math.round`, ≥ 1) |
| Campo vacío | Borra el override y vuelve el objetivo de `TRACKERS` | No hace falta un valor centinela. Las fijas HERO siempre tienen objetivo |
| Override igual al valor por defecto | No se guarda: se borra la clave | Deja `goals` limpio |
| Cómo se guarda desde la UI | Se reutiliza `onSave(t)`. `saveTracker` en `App` despacha: si `t.custom`, va a `trackers`; si no, a `goals` con `setGoal` | Las props de `TrackerCard` y `MissionsView` no cambian |
| `editTracker` | No cambia: una fija sigue intacta (assert E4) | Las fijas solo editan el objetivo; no hace falta pasar por `editTracker` |
| Rachas | No cambian. `streak` ya usa el `weeklyGoal` actual hacia atrás (`ponytail:` en `stats.ts:51`). Con el override, cambiar el objetivo de una fija recalcula su racha de forma retroactiva | Es la regla aprobada en el ciclo 7. Se cubre con un assert |
| «Borrar todo» | `setCustom(EMPTY_CUSTOM)` también borra `goals`. `hasData` cuenta `goals` para que haya copia interna antes | Es «todo», y `backupCurrent` lo protege |
| Dato inválido en `goals` | Se descarta la entrada y suma `dropped`, lo que activa la copia `.backup.<stamp>` y el aviso. Si `goals` no es un objeto, se descarta entero y suma 1. Los `trackers` y `proposals` se conservan | Hace falta para no tirar `custom` en bloque |

## 3. Decisiones que requieren aprobación

Ninguna pendiente. El usuario ya aprobó P7.2b: objetivos de las fijas editables y cambio de esquema compatible de `life-rpg-custom-v1`, conservado al exportar e importar. No hay dependencias nuevas, los asserts existentes no cambian y no se elimina ningún atajo de la demo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `Goals` y `CustomData.goals?` |
| `app/src/core/trackers.ts` | `allTrackers(custom, goals)`, `defaultGoal(id)`, `setGoal(goals, id, goal)` |
| `app/src/core/storage.ts` | `readCustom` valida y devuelve `goals` |
| `app/src/core/selfcheck.ts` | Asserts G1–G4 |
| `app/src/core/storage.test.ts` | `describe('readCustom: goals')` C6–C9 |
| `app/src/App.tsx` | `trackers` memo con `custom.goals`; `saveTracker` despacha; `hasData` |
| `app/src/components/MissionsView.tsx` | `onSave` también para las fijas HERO |
| `app/src/components/TrackerCard.tsx` | Lápiz y formulario reducido (solo objetivo) para las fijas HERO |
| `app/src/App.test.tsx` | U13 |

No hay archivos nuevos.

## 5. Modelos de datos

```ts
// types.ts
export type Goals = Record<string, number> // trackerId fijo HERO → weeklyGoal (entero ≥ 1)
export type CustomData = { trackers: Tracker[]; proposals: Proposal[]; goals?: Goals } // goals ausente = sin overrides
```

`EMPTY_CUSTOM` no cambia: sigue sin `goals`.

## 6. Persistencia y migración

- Clave: `life-rpg-custom-v1`, con el formato `{ trackers, proposals, goals? }`. No hace falta migrar: si falta `goals`, no hay overrides. La versión de clave no cambia.
- `readCustom(v)`, después de validar `trackers` y `proposals`:
  - Si `v.goals === undefined`, no se añade nada.
  - Si `!isObj(v.goals)`, se descarta y se hace `dropped += 1`.
  - Por cada `[id, g]`, se conserva si `defaultGoal(id) !== undefined && typeof g === 'number' && Number.isInteger(g) && g >= 1`. Si no, `dropped += 1`. Un valor igual al de por defecto se conserva y no cuenta como descartado.
  - `data.goals` solo existe si queda al menos una entrada válida. Así C1 y `readCustom({})` siguen dando exactamente lo mismo que hoy.
- `exportBackup`, `parseBackup`, `readLast`, `restoreLast` y `backupCurrent` no cambian: serializan `custom` entero o lo leen con `readCustom`.
- Compatibilidad hacia atrás: una versión anterior de la app lee estos datos sin error (`readCustom` ignora `goals`), pero al guardar `custom` los perdería. Ver §10.

## 7. Lógica de dominio (`trackers.ts`)

```ts
export const defaultGoal = (id: string): number | undefined => TRACKERS.find(t => t.id === id)?.weeklyGoal

export const allTrackers = (custom: Tracker[], goals: Goals = {}): Tracker[] => [
  ...TRACKERS.map(t => (goals[t.id] && t.weeklyGoal ? { ...t, weeklyGoal: goals[t.id] } : t)),
  ...custom,
]

// Devuelve un objeto nuevo. Sin la clave `id` si: goal null o redondeado < 1, igual al valor por defecto,
// o `id` no es una fija con objetivo (en ese caso devuelve `goals` sin tocar).
export function setGoal(goals: Goals = {}, id: string, goal: number | null): Goals
```

- `allTrackers` no muta `TRACKERS`: crea copias solo para los ids con override.
- No cambian XP, niveles, umbrales, `xpPerUnit` ni party. `weeklyGoal` solo afecta a `goalPct`, `streak` y `todaySummary.missing`.
- `streak`: no cambia nada. Usa el objetivo actual hacia atrás, como ya dice su `ponytail:`. No se añaden comentarios nuevos.

## 8. UI

**`MissionsView`**: `onSave={s.tracker.custom || s.tracker.weeklyGoal ? onSave : undefined}`. Las fijas VILLAIN no tienen `weeklyGoal`, así que se quedan sin lápiz.

**`TrackerCard`**: `const fixed = !t.custom`.
- El lápiz se muestra si `onSave` existe; ya no hace falta `t.custom &&`. `aria-label`: `Editar ${t.name}` en las propias y `Editar objetivo de ${t.name}` en las fijas.
- En las fijas, el formulario solo muestra el campo «Objetivo semanal (unidad)» y Cancelar/Guardar. Se ocultan Nombre, Incremento y el bloque Archivar.
  - `placeholder={String(defaultGoal(t.id))}`. Debajo, en `text-xs ${c.muted}`: «Déjalo vacío para volver a {def} {unit}.»
  - `open()` rellena `eGoal` con el objetivo actual (`t.weeklyGoal`).
  - `canSave = fixed ? goalOk : !nameErr && incOk && goalOk`.
  - `save()` en una fija: `onSave({ ...t, weeklyGoal: eGoal.trim() === '' ? undefined : Number(eGoal) })` y `setEditing(false)`. No toca `qty`.
- Las propias no cambian.
- No hay tokens ni clases nuevas: se reutiliza `field`, `c.chip` y `c.button`.

**`App`**:
- `trackers = useMemo(() => allTrackers(custom.trackers, custom.goals), [custom.trackers, custom.goals])`.
- `saveTracker = (t) => t.custom ? (map actual) : setCustom(c => ({ ...c, goals: setGoal(c.goals, t.id, t.weeklyGoal ?? null) }))`.
- `hasData` también es verdadero si `Object.keys(custom.goals ?? {}).length > 0`.
- `propose` puede seguir con `allTrackers(c.trackers)`: los objetivos no influyen en party.

Estados: no hay ni vacío ni carga nuevos. Error: Guardar se desactiva si el valor no es vacío y es menor que 1. Feedback: la barra de objetivo, «Objetivo cumplido», la racha y «Te faltan» en Inicio se actualizan en el siguiente render.

## 9. Backlog

### T1 — Overrides en core y persistencia
- **Objetivo:** el dominio y el almacenamiento soportan `goals` sin que cambie nada en la UI.
- **Archivos:** `types.ts`, `trackers.ts`, `storage.ts`, `selfcheck.ts` y `storage.test.ts`.
- **Funcionalidad:** §5, §6 y §7. Asserts G1–G4 y tests C6–C9 (§11).
- **Dependencias:** ninguna.
- **Aceptación:**
  - Los asserts existentes no cambian (E4 incluido) y siguen pasando.
  - `build`, `lint` y `test` pasan.
  - La app funciona igual que antes: `App` sigue llamando a `allTrackers(custom.trackers)`.

### T2 — Editar el objetivo de las fijas HERO
- **Objetivo:** el usuario edita y restaura el objetivo de Gym, BJJ, Running y Reading.
- **Archivos:** `App.tsx`, `MissionsView.tsx`, `TrackerCard.tsx` y `App.test.tsx`.
- **Funcionalidad:** §8. Test U13 (§11).
- **Dependencias:** T1.
- **Aceptación:**
  - U9–U12 siguen pasando sin cambios.
  - Los VILLAIN fijos no tienen lápiz.
  - El XP no cambia al editar.
  - `build`, `lint` y `test` pasan.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Al volver a una versión anterior desplegada, el primer guardado de `custom` borra `goals` | Es aceptable: se pierden objetivos, no registros. Exportar los conserva | Nada |
| `goals` inválido tira `custom` entero | `readCustom` descarta por entrada y nunca devuelve `null` por `goals` (test C8) | — |
| Mutar `TRACKERS` al aplicar overrides | `allTrackers` copia con spread (assert G1: `TRACKERS[0].weeklyGoal === 4` después) | — |
| Al bajar el objetivo, la racha crece hacia atrás | Es la regla aprobada en el ciclo 7, ya marcada con `ponytail:` (assert G4) | — |
| El formulario de `TrackerCard` se llena de condicionales | Una sola bandera `fixed` y dos bloques ocultos | Recorte: si se complica, el formulario de la fija va en un bloque JSX aparte dentro de la misma tarjeta |

## 11. Verificación

**`selfcheck.ts`.** Asserts nuevos, junto a E1–E5. Ningún assert existente cambia.
- **G1:** `allTrackers([], { gym: 2 })`: el gym tiene `weeklyGoal === 2`, bjj sigue con 3, `TRACKERS[0].weeklyGoal === 4` y `allTrackers([]).length === 6`.
- **G2 `setGoal`:** `setGoal({}, 'gym', 2.6)` da `{ gym: 3 }`. `setGoal({ gym: 3 }, 'gym', null)`, `setGoal({ gym: 3 }, 'gym', 4)` (el valor por defecto) y `setGoal({ gym: 3 }, 'gym', 0)` dan `{}`. `setGoal({}, 'beer', 5)` y `setGoal({}, 'custom-x', 5)` dan `{}`.
- **G3 XP invariante:** `sumE(deriveGame(SEED_EVENTS, DEMO_DATE, allTrackers([], { gym: 1, running: 50 }))) === sumE(deriveGame(SEED_EVENTS, DEMO_DATE))`.
- **G4 objetivos derivados:** con `gt = allTrackers([], { gym: 3 })`:
  - `streak(s3, gt[0], DEMO_DATE) === 3` (racha retroactiva con el override).
  - `get(deriveGame(hv, DEMO_DATE, gt), 'gym').goalPct` vale `100 / 3 * 1`.
  - En `todaySummary(hv, deriveGame(hv, DEMO_DATE, gt).trackers, DEMO_DATE).missing`, el gym tiene `left === 2`.

**`storage.test.ts`** (`describe('readCustom: goals')`):
- **C6:** datos antiguos sin `goals` → `{ trackers, proposals }` sin clave `goals` y `dropped` 0.
- **C7:** `{ goals: { gym: 2, reading: 60 } }` se conserva con `dropped` 0.
- **C8:** `goals: 'x'` → sin goals, `dropped` 1 y los trackers se conservan. `goals: { beer: 3, 'custom-x': 3, nope: 3, gym: 0, bjj: 2.5, running: '5', reading: 90 }` → `{ reading: 90 }` y `dropped` 6.
- **C9:** `parseBackup(exportBackup([], { trackers: [], proposals: [], goals: { gym: 2 } }, 'x'))?.custom.goals` es `{ gym: 2 }`.

**`App.test.tsx` U13:**
1. HERO: «Editar objetivo de Gym», poner 2 y Guardar.
2. En `localStorage[CU].goals` queda `{ gym: 2 }`, la tarjeta muestra `/ 2 sesiones esta semana` y `heroXp()` no cambia.
3. Abrir de nuevo, vaciar el campo y Guardar: `goals` sin gym y `/ 4 sesiones`.
4. No existe ningún botón «Editar objetivo de Beer».
5. En el formulario de Gym no hay campo Nombre ni botón Archivar.

**Checklist manual (en dev y en móvil):**
- [ ] Cambiar el objetivo de Running y recargar: se mantiene.
- [ ] Exportar, «Borrar todo» e importar: el objetivo vuelve.
- [ ] «Borrar todo» y «Recuperar copia anterior»: el objetivo vuelve.
- [ ] Bajar el objetivo de Gym por debajo de lo hecho esta semana: aparecen «Objetivo cumplido» y la racha, y desaparece de «Te faltan» en Inicio.
- [ ] VILLAIN: Beer y Burgers sin lápiz. Las propias editan igual que antes.
- [ ] En la consola de dev sale `[selfcheck] done` sin fallos.

## 12. Handoff para Claude Code

1. Implementa T1 entero y comprueba que pasan `npm run build`, `npm run lint` y `npm test` desde `app/` antes de tocar la UI. La app no debe cambiar de comportamiento.
2. T2: no cambies las firmas de las props de `TrackerCard` ni de `MissionsView`. El despacho entre propias y fijas se hace en `saveTracker` de `App`.
3. No toques `editTracker`, `streak`, `rpg.ts`, `party.ts` ni los asserts existentes. Si alguno falla, el error está en tu cambio.
4. No hay dependencias nuevas ni tokens nuevos, y `docs/ESTADO-ACTUAL.md` no se actualiza en este ciclo.
