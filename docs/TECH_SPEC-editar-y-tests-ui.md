# TECH SPEC — Editar/archivar actividades propias (P4.3) y tests de componentes (P4.5)

Ciclo 6. Base: `main` con ciclos 1–5. Fuente: `docs/cycles/cycle-4/proposals.md` (P4.3, P4.5) + cambios pedidos en `docs/cycles/cycle-4/evaluation.md`.

## 1. Resumen

- **P4.3:** en las tarjetas de actividades propias (`custom: true`) se puede editar nombre, incremento por defecto y objetivo semanal (solo HERO), y archivar. Archivar oculta la tarjeta de HERO/VILLAIN; sus eventos siguen contando en XP, histórico y parties. Se reactiva desde Inicio.
- **No:** editar rama, tipo, unidad ni `xpPerUnit`; editar las 6 fijas; borrar eventos o actividades.
- **P4.5:** Testing Library + happy-dom en Vitest, un archivo `App.test.tsx` que recorre los flujos críticos sobre `<App />` real con `localStorage` real del entorno y `confirm` simulado.
- Orden: P4.3 (T1–T2), luego P4.5 (T3–T5). Sin dependencias de runtime, sin renombrar claves, sin cambiar reglas de juego.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| `xpPerUnit` | No editable. | XP = allTime × `xpPerUnit`: editarlo cambiaría XP pasada. Con esto ninguna edición toca XP (nombre, incremento y objetivo no entran en `deriveGame`). No requiere aprobación. |
| Campo de archivo | `archived?: boolean` en `Tracker`. Archivar = `archived: true`; reactivar = `archived: false`. | Sin `delete`/destructuring; `readCustom` acepta cualquier booleano. |
| Dónde se filtra | Las archivadas siguen en `allTrackers` (XP, party, `countsIn`). Se filtran solo en `MissionsView`, en el contador de misiones de `HomeView` y en lo que se pasa a `UnknownView`. | Lo pide la evaluación. |
| `UnknownView` | Recibe solo trackers activos. | Evita «Sumar a X» sobre una tarjeta oculta. Se puede crear una nueva con el nombre de una archivada (`ponytail:`). |
| Nombre duplicado al editar | `isDuplicateName(nombre, todos los trackers salvo él mismo)` incluyendo archivadas → «Guardar» desactivado. | Reutiliza `isDuplicateName`. |
| Normalizar la edición | Función pura `editTracker` en `core/classify.ts` (junto a `createTracker` y `buttonLabel`). | Recalcula `buttonLabel` (pedido) y concentra el redondeo y las reglas de objetivo. |
| `buttonLabel` | Corregir: `'+1'` solo si `unit === 'unidades' && increment === 1`; si no, `` `+${increment} ${unit}` ``. | Hoy devuelve `'+1'` para cualquier incremento con `unidades`; al editar el incremento quedaría mal. Los asserts actuales siguen pasando. |
| Validación de campos nuevos | `readCustom` repara (quita el campo, conserva el tracker, `dropped++` una vez por tracker): `weeklyGoal` no numérico, no finito, ≤ 0 o en rama `villain`; `archived` no booleano. | Mismo patrón que `undoes` en `readEvents`: nada se descarta en bloque y el original se copia a `.backup.<stamp>` vía `loadAll`. |
| Esquema | `life-rpg-custom-v1` y el envoltorio de exportación siguen en `version: 1`. Campos opcionales. | Compatible hacia atrás y hacia delante. |
| UI de edición | Formulario inline dentro de `TrackerCard` (estado local `editing`); un solo callback `onSave(t: Tracker)` para editar, archivar y reactivar. | Sin modales ni pantallas nuevas. |
| Confirmación al archivar | Ninguna; el formulario explica que es reversible. | Es reversible y no toca eventos. |
| Entorno de tests | `happy-dom` (más ligera que jsdom), declarado por archivo con `// @vitest-environment happy-dom`. | No cambia el entorno de los tests de `core/`. Si una API falla en happy-dom, cambiar ese comentario a `jsdom` y la devdep: una línea. |
| Peer de Testing Library | `@testing-library/dom` como devdep (peer obligatorio de `@testing-library/react` 16). Sin `user-event` ni `jest-dom`: `fireEvent` y `getBy*`, que fallan si no encuentran el elemento. | Mínimo que funciona. |
| Selección de tarjetas en tests | La raíz de `TrackerCard` pasa a tener `role="group" aria-label={t.name}`. | Mejora accesible de una línea; permite `within(getByRole('group', { name: 'Gym' }))`. |
| Fecha en tests | `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))` (miércoles local). | Solo se falsea `Date`; los timers reales no interfieren con Testing Library. |

## 3. Decisiones que requieren aprobación

- **`@testing-library/dom` como devdep adicional.** Es peer obligatorio de `@testing-library/react` (aprobada); sin él no instala. Solo desarrollo, cero runtime. Si no se aprueba, P4.5 no se puede hacer con Testing Library.

Nada más: no hay cambio de reglas de juego (no se edita `xpPerUnit`), ni claves nuevas, ni deps de runtime.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `Tracker.archived?: boolean`; tipo `TrackerEdit`. |
| `app/src/core/classify.ts` | Corregir `buttonLabel`; nueva `editTracker`. |
| `app/src/core/storage.ts` | `readCustom` valida/repara `weeklyGoal` y `archived`. |
| `app/src/core/storage.test.ts` | Tests C1–C5 de `readCustom`. |
| `app/src/core/selfcheck.ts` | Asserts E1–E5. |
| `app/src/App.tsx` | `saveTracker`; pasar `onSave`, archivadas y activos a las vistas. |
| `app/src/components/TrackerCard.tsx` | Botón «Editar», formulario inline, «Archivar»; `role="group"`. |
| `app/src/components/MissionsView.tsx` | Filtra archivadas; pasa `onSave` (solo custom) y `nameTaken`. |
| `app/src/components/HomeView.tsx` | Sección «Archivadas» con «Reactivar»; el contador excluye archivadas. |
| `app/src/App.test.tsx` (nuevo) | Tests de componentes U1–U10. |
| `app/package.json` | devDeps `@testing-library/react`, `@testing-library/dom`, `happy-dom`. |

## 5. Modelos de datos

```ts
// types.ts
export type Tracker = {
  // ...campos actuales sin cambios
  weeklyGoal?: number   // ya existía; ahora también en custom HERO
  custom?: true
  archived?: boolean    // nuevo; ausente = activo
}

export type TrackerEdit = { name: string; increment: number; weeklyGoal: number | null } // null = sin objetivo
```

## 6. Persistencia y migración

- Misma clave `life-rpg-custom-v1`, mismo `{ trackers, proposals }`. Solo aparecen dos campos opcionales en cada tracker custom.
- **Datos existentes:** sin `weeklyGoal` ni `archived` → válidos tal cual (`dropped: 0`, sin backup ni aviso). No hay migración.
- **Datos con campos basura** (editados a mano o de otra versión): `readCustom` quita el campo inválido y conserva el tracker; cuenta 1 en `dropped` por tracker reparado. `loadAll` copia el bruto a `.backup.<stamp>` y la home avisa (comportamiento actual).
- **Vuelta atrás a una versión anterior:** el `readCustom` antiguo deja pasar campos extra; las archivadas reaparecen y el objetivo se ve. Sin pérdida.
- Exportar/importar y «Recuperar copia anterior» pasan por `readCustom`: mismas reglas, sin cambios en `parseBackup`/`readLast`.

`readCustom` (sustituye el `filter` de trackers):

```ts
let fixedN = 0
const trackers: Tracker[] = []
for (const t of rawT) {
  if (!(isObj(t) && typeof t.id === 'string' && typeof t.name === 'string' && (t.branch === 'hero' || t.branch === 'villain') &&
    Number.isFinite(t.increment) && Number.isFinite(t.xpPerUnit))) continue
  const fixed = { ...t } as Tracker
  let bad = false
  if (t.weeklyGoal !== undefined && !(t.branch === 'hero' && typeof t.weeklyGoal === 'number' && Number.isFinite(t.weeklyGoal) && t.weeklyGoal > 0)) { delete fixed.weeklyGoal; bad = true }
  if (t.archived !== undefined && typeof t.archived !== 'boolean') { delete fixed.archived; bad = true }
  if (bad) fixedN++
  trackers.push(fixed)
}
// dropped = (rawT.length - trackers.length) + fixedN + (rawP.length - proposals.length)
```

## 7. Lógica de dominio

**`buttonLabel(unit, increment)`** (classify.ts):
```ts
export const buttonLabel = (unit: string, increment: number) =>
  unit === 'unidades' && increment === 1 ? '+1' : `+${increment} ${unit}`
```

**`editTracker(t: Tracker, e: TrackerEdit): Tracker`** (classify.ts), pura:
- Si `!t.custom` → devuelve `t` sin cambios.
- `name = trackerName(e.name)` (trim, espacios colapsados, primera mayúscula). La validez (`isValidName`, duplicado) la comprueba la UI antes de llamar.
- `increment = Math.max(1, Math.round(e.increment) || 1)`.
- `buttonLabel = buttonLabel(t.unit, increment)`.
- `weeklyGoal`: si `t.branch === 'hero'` y `e.weeklyGoal` es finito y ≥ 1 → `Math.round(e.weeklyGoal)`; en cualquier otro caso el campo se elimina (`delete`).
- `id`, `branch`, `type`, `unit`, `xpPerUnit`, `custom`, `archived` se copian sin tocar.

**Archivar/reactivar:** `{ ...t, archived: true }` / `{ ...t, archived: false }`, inline en el componente. No afecta a `deriveGame`, `trackerStats`, `partyCriteria` ni `countsIn` (siguen recibiendo `allTrackers(custom.trackers)`).

**App.tsx:**
```ts
const saveTracker = (t: Tracker) => setCustom(c => ({ ...c, trackers: c.trackers.map(x => (x.id === t.id ? t : x)) }))
const active = useMemo(() => trackers.filter(t => !t.archived), [trackers])
const archived = useMemo(() => custom.trackers.filter(t => t.archived), [custom.trackers])
```
- `MissionsView` recibe `onSave={saveTracker}`; `UnknownView` recibe `trackers={active}`; `HomeView` recibe `archived` y `onUnarchive={t => saveTracker({ ...t, archived: false })}`.
- `saveTracker` no cambia `events`: no hay toast ni XP flotante.

## 8. UI

Paleta de la rama en la tarjeta (clases `c.*` existentes de `TrackerCard`); Inicio con tokens `app-*`. Sin hex ni `slate-*`. Iconos lucide: `Pencil`, `Archive`, `ArchiveRestore`. Áreas táctiles `min-h-11`.

**TrackerCard** (solo si `t.custom && onSave`):
- En la cabecera, junto al XP: botón icono `Pencil`, `aria-label={`Editar ${t.name}`}`, borde `c.chip`. Abre `editing` (estado local) y rellena el formulario con los valores actuales (`weeklyGoal` vacío si no hay).
- Formulario inline (debajo de la cabecera, sustituye a la zona de registro mientras está abierto):
  - «Nombre»: `<input maxLength={40}>`. Error inline (`text-xs`, `c.muted`): «2–40 caracteres» si `!isValidName`, «Ya tienes una misión con ese nombre» si `nameTaken(nombre)`.
  - «Incremento (unidad)»: `<input type="number" min={1} step={1}>`. Válido si `Math.round(n) >= 1`.
  - «Objetivo semanal (unidad)»: solo si `t.branch === 'hero'`. `<input type="number" min={1} step={1}>`; vacío = sin objetivo. Válido si vacío o `≥ 1`.
  - Botones: «Cancelar» (secundario `c.chip`) y «Guardar» (primario `c.button`, `disabled` si algo no es válido). Guardar: `const next = editTracker(t, edit); onSave(next); setQty(String(next.increment)); setEditing(false)`.
  - Debajo, separado: texto `text-xs c.muted` «Archivar la oculta de esta lista. Sus registros siguen contando y puedes reactivarla desde Inicio.» + botón secundario `Archive` «Archivar» → `onSave({ ...t, archived: true })`.
- Nota: XP/unidad no aparece en el formulario (no editable).
- Raíz de la tarjeta: añadir `role="group" aria-label={t.name}`.

**MissionsView:**
- `shown` añade `!s.tracker.archived` al filtro.
- Props nuevas: `onSave: (t: Tracker) => void`. A cada `TrackerCard` le pasa `onSave={s.tracker.custom ? onSave : undefined}` y `nameTaken={n => isDuplicateName(n, game.trackers.map(x => x.tracker).filter(x => x.id !== s.tracker.id))}`.

**HomeView:**
- `branchSummary.count` excluye archivadas.
- Si `archived.length > 0`: sección «Archivadas» (mismo contenedor que «Tus parties»: lista `divide-y` en `bg-app-surface`), justo después de «Tus parties». Cada fila: nombre, chip `HERO`/`VILLAIN` (`border-app-border text-app-muted`), botón secundario `ArchiveRestore` «Reactivar», `aria-label={`Reactivar ${t.name}`}`. Sin la sección si no hay archivadas (estado vacío = no se muestra).
- Feedback: al reactivar la fila desaparece; al archivar la tarjeta desaparece (el texto previo lo explica). Sin estados de carga ni error (todo es síncrono y local).

## 9. Backlog

**T1 — Núcleo de edición y esquema compatible** (P4.3)
- Archivos: `core/types.ts`, `core/classify.ts`, `core/storage.ts`, `core/storage.test.ts`, `core/selfcheck.ts`.
- Hace: `archived?` y `TrackerEdit` (§5); fix de `buttonLabel` y `editTracker` (§7); `readCustom` con reparación (§6); tests C1–C5 y asserts E1–E5 (§11).
- Depende de: —.
- Aceptación: `build`, `lint`, `test` en verde; ningún assert existente modificado; la app se comporta igual (nadie llama aún a `editTracker`).

**T2 — UI de editar, archivar y reactivar** (P4.3)
- Archivos: `App.tsx`, `components/TrackerCard.tsx`, `components/MissionsView.tsx`, `components/HomeView.tsx`.
- Hace: §7 (App) y §8 completo, incluido `role="group"`.
- Depende de: T1.
- Aceptación: checklist manual M1–M6; `build`, `lint`, `test` en verde.

**T3 — Infraestructura de tests de UI + registrar, día pasado, corrección y Deshacer** (P4.5)
- Archivos: `app/package.json` (devDeps), `app/src/App.test.tsx`.
- Hace: `npm i -D @testing-library/react @testing-library/dom happy-dom`. Cabecera y `beforeEach`/`afterEach` de §11; tests U1–U4.
- Depende de: T2 (usa `role="group"`).
- Aceptación: `npm test` ejecuta `App.test.tsx` en happy-dom y los tests de `core/` siguen en entorno node; U1–U4 pasan; `build` y `lint` en verde.

**T4 — Tests de «Tus datos»** (P4.5)
- Archivos: `app/src/App.test.tsx`.
- Hace: U5–U8.
- Depende de: T3.
- Aceptación: pasan; ningún cambio en `src/` fuera del archivo de test.

**T5 — Tests de editar y archivar** (P4.5)
- Archivos: `app/src/App.test.tsx`.
- Hace: U9–U10.
- Depende de: T3.
- Aceptación: pasan; `build`, `lint`, `test` en verde.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| `readCustom` marca como dañados datos buenos y salta el aviso en la home. | C1 (formato antiguo → `dropped: 0`) y C4 (campos válidos se conservan). | — |
| El `qty` de la tarjeta queda con el incremento viejo. | `setQty(String(next.increment))` al guardar; U9 lo comprueba. | — |
| happy-dom no soporta algo (p. ej. `<details>`, `File`). | Los tests no dependen de `File.text()` (objeto falso) y abren `<details>` con clic en `summary`. | Cambiar el comentario del archivo a `jsdom` y la devdep. |
| Tests frágiles por textos. | Consultar por rol + nombre accesible y `localStorage`, no por clases. | Recortar asserts de texto y dejar los de `localStorage`. |
| Tarjeta archivada por error. | Texto explicativo antes del botón; reactivar en Inicio. | — |

Recorte si algo se complica: U10 (archivar) puede quedarse solo con la comprobación en `localStorage`; la sección «Archivadas» no se recorta (es la única vía de reactivar).

## 11. Verificación

**selfcheck.ts** (añadir; los existentes no cambian, `med.buttonLabel === '+1'` y `pag.buttonLabel === '+1 páginas'` siguen siendo ciertos):
- E1 `buttonLabel('unidades', 1) === '+1' && buttonLabel('unidades', 3) === '+3 unidades' && buttonLabel('km', 5) === '+5 km'`.
- E2 `editTracker(med, { name: '  meditar   mucho ', increment: 2.6, weeklyGoal: 4.4 })` → `name 'Meditar mucho'`, `increment 3`, `buttonLabel '+3 unidades'`, `weeklyGoal 4`, y `id`, `branch`, `unit`, `xpPerUnit`, `custom` iguales a `med`.
- E3 `editTracker(med, { ..., increment: 0, weeklyGoal: null })` → `increment 1`, `!('weeklyGoal' in r)`; `editTracker(pizza, { ..., weeklyGoal: 5 })` → sin `weeklyGoal` (villain).
- E4 `editTracker(TRACKERS[0], { name: 'X', increment: 9, weeklyGoal: 1 }) === TRACKERS[0]` (fija intacta).
- E5 XP invariante: con `em` (§V2 de selfcheck), `sum(deriveGame(em, DEMO_DATE, allTrackers([{ ...editTracker(med, { name: 'M2', increment: 5, weeklyGoal: 3 }), archived: true }, pizza])))` igual a `sum(deriveGame(em, DEMO_DATE, all))`.

**storage.test.ts** (`describe('readCustom: campos de P4.3')`), con `base = { id: 'c', name: 'X', branch: 'hero', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 20, custom: true }`:
- C1 formato antiguo (`base`) → `{ data: { trackers: [base], proposals: [] }, dropped: 0 }`.
- C2 `weeklyGoal` en `'x'`, `null`, `0`, `-1` → tracker conservado sin `weeklyGoal`, `dropped` = 4 (cuatro trackers).
- C3 `{ ...base, branch: 'villain', weeklyGoal: 3 }` y `{ ...base, archived: 'yes' }` → conservados sin el campo, `dropped: 2`.
- C4 `{ ...base, weeklyGoal: 5, archived: true }` y `{ ...base, archived: false }` → iguales, `dropped: 0`.
- C5 `parseBackup(exportBackup([], { trackers: [{ ...base, weeklyGoal: 5, archived: true }], proposals: [] }, 'x'))` conserva ambos campos.

**App.test.tsx** — cabecera y preparación:
```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { unlockStorage } from './core/storage'

const EV = 'life-rpg-demo-v1', CU = 'life-rpg-custom-v1'
const stored = () => JSON.parse(localStorage.getItem(EV) ?? '[]')
beforeEach(() => {
  localStorage.clear(); unlockStorage()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
  window.scrollTo = vi.fn() as never
  let n = 0; vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as never)
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
```
Navegación con los botones de `BottomNav` (`getByRole('button', { name: 'HERO' })`; si hay ambigüedad con la home, `within(getByRole('navigation', { name: 'Principal' }))`). `confirm` con `vi.spyOn(window, 'confirm').mockReturnValueOnce(...)`. Importar: `fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [{ text: () => Promise.resolve(json) }] } })` y `await screen.findByText(...)`.

Tests:
- U1 Registrar hoy: HERO → en `group 'Gym'` clic «+1 sesiones» → `stored()` tiene 1 evento `gym`, `amount 1`, `occurredAt` empieza por `2026-10-07`; la tarjeta muestra `1` y «/ 4 sesiones esta semana».
- U2 Día pasado: clic «Ayer» → el botón dice «+1 sesiones · ayer» → evento en `2026-10-06`. `fireEvent.change` del input «Elegir día» a `2026-09-30` → evento en esa fecha; a `2026-10-10` (futuro) → vuelve a «Hoy» (`aria-pressed`).
- U3 Corrección: «Restar 1 sesiones a Gym» desactivado con el día a 0; tras +1, restar → evento `-1`; vuelve a desactivarse.
- U4 Deshacer: tras +1, clic en «Últimos registros», clic «Deshacer 1 sesiones de Hoy» → último evento `amount -1`, `undoes` = id del positivo; aparece «deshecho»; no hay botón «Deshacer» para ese registro.
- U5 Exportar: «Exportar copia» → `URL.createObjectURL` llamado con un `Blob`; `life-rpg-meta-v1` tiene `lastExportAt`; se ve «Última copia: hoy.».
- U6 Importar: archivo `'{roto'` → «Ese archivo no es una copia válida de RPG Life Tracker.» y `stored()` sin cambios. Copia válida (`exportBackup` de 1 evento) con `confirm → false` → nada cambia; con `confirm → true` → `stored()` = la copia y «Copia importada: 1 registros y 0 misiones nuevas.».
- U7 Borrar todo cancelado: «Cargar ejemplo» (28 eventos) → «Borrar todo» con `confirm` `[false, false]` → siguen 28 eventos. Con `[false, true]` → `stored()` vacío, existe `life-rpg-demo-v1.backup.last`, aparece «Recuperar copia anterior».
- U8 Recuperar: tras U7 (en el mismo test), «Recuperar copia anterior» con `confirm → true` → 28 eventos y «Copia recuperada: 28 registros y 0 misiones nuevas.».
- U9 Editar: `localStorage[CU]` precargado con `{ trackers: [base 'Meditar' hero], proposals: [] }` y un evento suyo → HERO → `group 'Meditar'` → «Editar Meditar»; nombre «Gym» → «Guardar» desactivado; nombre «Meditar mucho», incremento 3, objetivo 5 → «Guardar» → en `CU`: `name 'Meditar mucho'`, `increment 3`, `buttonLabel '+3 unidades'`, `weeklyGoal 5`, `xpPerUnit 20`; la tarjeta muestra «+3 unidades» y «/ 5 unidades esta semana»; el texto `Lv. … · … XP` de la cabecera HERO no cambia.
- U10 Archivar/reactivar: misma precarga → «Editar Meditar» → «Archivar» → no hay `group 'Meditar'`; cabecera HERO con el mismo XP; Inicio → sección «Archivadas» con «Reactivar Meditar» → clic → HERO muestra otra vez `group 'Meditar'`; en `CU`, `archived false`.

**Checklist manual** (`npm run dev`, consola con `[selfcheck] done` sin fallos):
- M1 Crear una misión HERO en «Nuevo», editarla (nombre, incremento 2, objetivo 3): botón «+2 …» y barra de objetivo; recargar → se mantiene.
- M2 Una misión VILLAIN custom no muestra «Objetivo semanal» en el formulario.
- M3 Las 6 fijas no tienen botón «Editar».
- M4 Archivar: desaparece de HERO, el XP de HERO/PLAYER no cambia, sigue en «Cuenta en» de la party que la aceptó; aparece en «Archivadas» de Inicio; reactivar la devuelve. Recargar entre pasos.
- M5 Exportar con una archivada con objetivo, «Borrar todo», importar → vuelve archivada y con objetivo.
- M6 Móvil (≤ 375 px): el formulario no desborda; botones ≥ 44 px; foco visible en HERO y VILLAIN.

## 12. Handoff para Claude Code

1. Lee este documento, `CLAUDE.md`, `core/classify.ts`, `core/storage.ts`, `components/TrackerCard.tsx`, `MissionsView.tsx`, `HomeView.tsx` y `App.tsx`.
2. Implementa T1 → T5 en orden, un commit por tarea (`T1: …`). Cada tarea termina con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.
3. No toques asserts existentes de `selfcheck.ts` ni tests existentes de `storage.test.ts`; si fallan, el fallo está en el código nuevo.
4. No añadas más dependencias que `@testing-library/react`, `@testing-library/dom` y `happy-dom` (solo `-D`). No cambies `vite.config.ts` ni el entorno global de Vitest: el entorno va en el comentario del archivo de test.
5. Marca con `ponytail:` en `App.tsx` que `UnknownView` solo ve activas y que se puede crear una misión con el nombre de una archivada.
6. No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
