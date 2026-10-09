# TECH_SPEC — Deuda menor del ciclo 6 y avisos accesibles (ciclo 10: P9.1 + P9.4)

Base: `main` con los ciclos 1-9. Fuente: `docs/cycles/cycle-9/proposals.md` (P9.1, P9.4) con los cambios de `docs/cycles/cycle-9/evaluation.md`.

## 1. Resumen

- **P9.1**: (1) «Archivar» en el formulario de edición guarda antes los cambios válidos; (2) «Nuevo» detecta también las misiones archivadas (duplicado exacto y parecidas) y ofrece «Reactivar» en lugar de crear un duplicado; (3) los lectores de `storage.ts` separan `dropped` (descartados) de `fixed` (reparados): los reparados **siguen** generando copia sellada y solo cambian los recuentos y los textos; (4) U1 deja de usar `getByText('1')`.
- **P9.4**: (a) los anuncios de level-up/down, adelantamientos y los dos de «Nuevo» pasan a regiones `role="status"` siempre montadas, con el texto derivado del estado; (b) chequeo axe sobre las pantallas principales en `npm test`, fallando ante violaciones `serious`/`critical`.
- No se hace: purgar backups sellados, cambiar claves o formato persistido, tocar otros flujos de importación, auditoría manual con lector de pantalla, e2e, cambios de contraste ni de reglas de juego. `core/` de dominio (`stats`, `rpg`, `party`) no cambia y `selfcheck.ts` no se toca.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Archivar con cambios | Si `canSave`, se archiva `editTracker(t, formulario)` con `archived: true`; si no, el original con `archived: true`. Sin confirmación. | Lo pide la evaluación; un clic, sin diálogo nuevo. |
| Fijas | Sin cambios: no tienen «Archivar» (ciclo 8). | — |
| `UnknownView` | Recibe **todas** las actividades (`trackers` de `App`, incluidas archivadas). `dup` y `findSimilar` usan todas; `classifyAI` y el `match` de la IA, solo las activas. | El bug real es el duplicado exacto; la IA no debe sugerir «Sumar a» una oculta. |
| Reactivar desde «Nuevo» | Si `similar.archived`, el botón es «Reactivar {nombre}»: `onUnarchive(similar)` + `onGoToMissions(similar.branch)`. No suma registro. | Reutiliza `onUnarchive`; sumar sería una acción que el usuario no ha pedido. |
| `fixed` | Campo nuevo en `Parsed<T>`, `parseBackup`, `LastBackup` y `LoadProblem`. `loadAll` sigue sellando si `dropped + fixed > 0`. | Si no se copia, `saveEvents` sobrescribe el original y se pierde el campo malo. |
| Goals inválidos | Siguen contando como `dropped` (la entrada se descarta). | Es lo que pasa de verdad. |
| Región viva global | Un `<p role="status" className="sr-only">` en `App.tsx`, siempre montado, con `liveText(toast, overtake)` calculado en render. | Sin efecto ni estado extra; mismo orden de prioridad que la UI (toast antes que banner). |
| Animaciones | Los 4 contenedores de `LevelUpToast.tsx` pierden `aria-live` y pasan a `aria-hidden`. Se mantienen sus `key`. | El texto ya lo anuncia la región. |
| «Nuevo» | Un `<p role="status" className="sr-only">` siempre montado en `UnknownView`, con texto derivado de `step`/`created`/`results`. Los dos `aria-live` visibles (`:246`, `:281`) pierden el atributo. | Mismo patrón; el contenido visible no cambia. |
| axe | `axe-core` directo (sin `vitest-axe`), helper de 5 líneas en un archivo nuevo `src/a11y.test.tsx`. Regla `color-contrast` desactivada. | Menos deps; el entorno de Vitest es por archivo, así que pasar a jsdom solo afecta a estos tests. |
| Entorno | `@vitest-environment happy-dom`. Solo si `axe.run` lanza o da falsos positivos imputables al DOM simulado se cambia ese archivo a `jsdom` (devDependency). | Lo pide la evaluación. |

## 3. Decisiones que requieren aprobación

Ninguna. `axe-core` (y `jsdom`, solo si hace falta) son devDependencies ya aprobadas. Sin deps de runtime, sin cambios de reglas de juego, sin cambios de formato persistido.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/storage.ts` | `fixed` en `Parsed`, `readEvents`, `readCustom`, `loadAll`/`LoadProblem`, `parseBackup`, `LastBackup`/`readLast`. |
| `app/src/core/storage.test.ts` | Ajuste de recuentos (S2, C2, C3, y `toEqual` con `fixed: 0`) y test nuevo de `loadAll` con solo reparados. |
| `app/src/App.tsx` | `noticeFor` con texto de «reparados»; textos de `confirm` de importar y recuperar; `UnknownView` recibe `trackers` y `onUnarchive`; se borra `active` y su `ponytail:`; región `role="status"`. |
| `app/src/components/TrackerCard.tsx` | Botón «Archivar» guarda los cambios válidos. |
| `app/src/components/UnknownView.tsx` | `dup`/`similar` sobre todas; botón «Reactivar»; prop `onUnarchive`; región `status`; fuera los dos `aria-live`. |
| `app/src/components/LevelUpToast.tsx` | `aria-live` → `aria-hidden` en los 4 contenedores; `export function liveText`. |
| `app/src/App.test.tsx` | U1 arreglado; U16, U17, U18 nuevos. |
| `app/src/a11y.test.tsx` (nuevo) | Chequeo axe A1–A6 y U19 (`liveText` de banners). |
| `app/package.json` | devDependency `axe-core` (y `jsdom` solo si hace falta). |

## 5. Modelos de datos

Solo cambian tipos de `storage.ts` (no persistidos):

```ts
export type Parsed<T> = { data: T; dropped: number; fixed: number } | null // null = ilegible
export type LoadProblem = { key: string; dropped: number | null; fixed: number; backupKey: string | null } // fixed = 0 si ilegible
export type LastBackup = { events: ActivityEvent[] | null; custom: CustomData | null; dropped: number; fixed: number }
// parseBackup → { events; custom; dropped: number; fixed: number } | null
```

`UnknownView` Props: `trackers` pasa a significar «todas, incluidas archivadas»; nueva prop `onUnarchive: (t: Tracker) => void`.

## 6. Persistencia y migración

- Sin cambios de claves ni de formato. Nada que migrar.
- Comportamiento de `loadAll`: `if (r && r.dropped === 0 && r.fixed === 0) return r.data`. Con solo reparados se sigue copiando el bruto a `<clave>.backup.<stamp>` y se registra el problema (`dropped: 0, fixed: n`); los datos reparados se usan y se guardan como hoy.
- `readEvents`: un evento con `undoes` inválido → se conserva sin el campo y suma a `fixed` (antes `dropped`). No válido → `dropped`.
- `readCustom`: tracker con `weeklyGoal`/`archived` inválido (`fixedN`) → `fixed`; tracker o propuesta inválidos y entradas de `goals` inválidas → `dropped`. `dropped = rawT.length - trackers.length + rawP.length - proposals.length + gDropped`.
- `parseBackup` y `readLast` suman `fixed` igual que `dropped`.

## 7. Lógica de dominio

Sin cambios en `stats`, `rpg`, `party`, `classify`. Textos (en `App.tsx`):

```ts
const noticeFor = (problems: LoadProblem[]) => !problems.length ? null
  : problems.some(p => p.backupKey === null) ? /* texto actual de bloqueo, sin cambios */
  : problems.every(p => p.dropped === 0)
    ? 'Hemos corregido algunos datos guardados con campos no válidos; no se ha perdido ningún registro. El original está copiado aparte en este navegador.'
    : /* texto actual de «no se pudo leer», sin cambios */
```

(`dropped === null` = ilegible, así que `every(p => p.dropped === 0)` solo es cierto si todo fue reparación.)

`confirm` de importar y de recuperar: se mantiene `Se ignorarán N elementos no válidos.` solo con `dropped > 0`, y se añade `Se corregirán N elementos con campos no válidos.` si `fixed > 0`.

`liveText` (en `LevelUpToast.tsx`, usando las mismas constantes `PASSED`/`RANK_NAME` que los banners):

```ts
export function liveText(toast: Toast | null, o: Overtake | null): string {
  if (toast) return toast.detail ? `${toast.title}. ${toast.detail}` : toast.title
  if (!o) return ''
  const where = `${o.position}.º en ${o.party}`
  if (o.lost) return `${PASSED[o.lost].title}: ${o.names.join(', ')} te ${o.names.length > 1 ? 'superan' : 'supera'} en ${RANK_NAME[o.lost]} · ${where}`
  return `${o.position === 1 ? 'Líder de la party' : 'Adelantamiento'}: Superas a ${o.names.join(', ')} · ${where}`
}
```

En `App.tsx`: `liveText(toast, overtake)` (el banner solo se ve si `!toast`, y `liveText` ya da prioridad al toast). Marcar con `// ponytail: dos avisos seguidos con el mismo texto pueden no repetirse en el lector; añadir la key como texto oculto si molesta.`

Texto de la región de `UnknownView`:
- `step === 'parties' && created` → `Misión creada: ${created.name}. Ya cuenta en tu personaje.`
- `step === 'result'` → `results.map(r => `${nombre de party}: ${r.accepted ? 'Aceptada' : 'Rechazada'} ${r.yes}/${r.total}`).join('. ')`
- resto → `''`.

## 8. UI

- **TrackerCard, Archivar**: la función compartida `next()` = `editTracker(t, { name: eName, increment: Number(eInc), weeklyGoal: eGoal.trim() === '' ? null : Number(eGoal) })` la usan `save` y Archivar. Archivar: `onSave?.({ ...(canSave ? next() : t), archived: true })`. Texto de ayuda: «Archivar guarda los cambios válidos y la oculta de esta lista. Sus registros siguen contando y puedes reactivarla desde Inicio.»
- **UnknownView**:
  - `const active = trackers.filter(t => !t.archived)`; `classifyAI(text, active)` y `match = active.find(...)`.
  - `dup` y `findSimilar` sobre `trackers` (todas). `canAnalyze = valid && !dup` (igual).
  - Ayuda: `dup` → «Ya tienes «X»» + « (archivada)» si `similar.archived`; parecida → «Se parece a «X»» + « (archivada)».
  - Botón: si `similar.archived` → «Reactivar {name}» (clase `SECONDARY`, icono `ArchiveRestore` `aria-hidden`), `onClick={() => { onUnarchive(similar); onGoToMissions(similar.branch) }}`; si no, el «Sumar a…» actual.
  - Región `<p role="status" className="sr-only">` al final de `<main>`; quitar `aria-live` de `:246` y `:281`.
- **App**: `const unarchive = (t: Tracker) => saveTracker({ ...t, archived: false })`, usado por `HomeView` y `UnknownView`. `<p role="status" className="sr-only">{liveText(toast, overtake)}</p>` justo antes de `<BottomNav>`, fuera de los condicionales de pantalla.
- Sin cambios visuales salvo el botón «Reactivar» y la palabra «(archivada)»; paleta neutra `app-*` (es la vista neutra).

## 9. Backlog

**T1 — `dropped` / `fixed` en storage (P9.1.3)**
- Archivos: `core/storage.ts`, `core/storage.test.ts`, `App.tsx` (`noticeFor`, 2 `confirm`).
- Hacer: §5–§7. `readEvents` reparado → `fixed++`. `readCustom` → `fixed: fixedN`, `dropped` sin `fixedN`. `loadAll` sella si `dropped || fixed`, `LoadProblem.fixed`. `parseBackup`/`readLast` suman `fixed`.
- Tests: S2 → `{ data: [...], dropped: 0, fixed: 2 }`; C2 → `dropped 0`, `fixed 4`; C3 → `dropped 0`, `fixed 2`; añadir `fixed: 0` a los `toEqual` de las líneas 7, 12, 25, 37, 106, 185, 235, 246, 257, 261. Nuevo en `loadAll`: «solo reparados»: bruto `[{...good, undoes: 3}]` → `events` sin `undoes`, `problems[0]` = `{ dropped: 0, fixed: 1 }`, y `s.m.get(BK(EV))` = bruto.
- Acepta: build, lint, test en verde.

**T2 — Archivar guarda cambios + U1 (P9.1.1, P9.1.4)**
- Archivos: `components/TrackerCard.tsx`, `App.test.tsx`.
- Hacer: §8 TrackerCard. U1: sustituir `getByText('1')` y la línea siguiente por `expect(card('Gym').getByText(/\/ 4 sesiones esta semana/).textContent).toMatch(/^1 \/ 4 sesiones esta semana/)`.
- U16: `preload()`, HERO, «Editar Meditar», nombre «Meditar zen», «Archivar» → en storage `trackers[0]` = `{ name: 'Meditar zen', archived: true }`. Segundo caso: reactivar desde Inicio, editar, nombre `''` (inválido), «Archivar» → `name: 'Meditar zen'`, `archived: true`.
- Depende de: —.

**T3 — Duplicado de archivada en «Nuevo» (P9.1.2)**
- Archivos: `components/UnknownView.tsx`, `App.tsx`, `App.test.tsx`.
- Hacer: §8 UnknownView y `unarchive` en App. Borrar `active` y el `ponytail:` de `App.tsx:119`.
- U17: `preload()` con `archived: true`; ir a «Nuevo»; escribir «meditar» → texto `/Ya tienes «Meditar» \(archivada\)/`, «Analizar con IA» deshabilitado, sin botón «Sumar a»; clic «Reactivar Meditar» → heading «Misiones HERO», `group` «Meditar» visible y `archived: false` en storage.
- Depende de: —.

**T4 — Regiones `status` (P9.4a)**
- Archivos: `components/LevelUpToast.tsx`, `App.tsx`, `components/UnknownView.tsx`, `App.test.tsx`.
- Hacer: §7 `liveText`, §8 regiones; en `LevelUpToast.tsx` los 4 `aria-live="polite"` → `aria-hidden`.
- U18: HERO, Gym «+1 sesiones» ×2 → `screen.getByRole('status').textContent` casa con `/^LEVEL UP\. .*Gym Lv\. 2/`; ningún elemento con `aria-live` dentro del toast (`document.querySelector('.levelup-backdrop')!.getAttribute('aria-hidden')` = `'true'`).
- Depende de: T3 (mismo archivo `UnknownView.tsx`).

**T5 — Chequeo axe (P9.4b)**
- Archivos: `package.json` (`npm i -D axe-core`), `src/a11y.test.tsx` (nuevo).
- Hacer: cabecera `// @vitest-environment happy-dom`; `beforeEach` mínimo copiado de `App.test.tsx` (localStorage.clear, `unlockStorage`, Date falso 2026-10-07 12:00, `scrollTo`, `confirm`). Helper:
  ```ts
  async function serious() {
    const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' | ')}`)
  }
  ```
  Tests (cada uno `expect(await serious()).toEqual([])`): A1 home vacía; A2 home tras «Cargar ejemplo»; A3 HERO con ejemplo; A4 VILLAIN con ejemplo; A5 «Nuevo»; A6 Party con ejemplo. U19: `liveText(null, { key: 'k', party: 'X', names: ['Alex'], position: 2 })` = `'Adelantamiento: Superas a Alex · 2.º en X'` y con `lost: 'hero'` = `'Te adelantan: Alex te supera en HERO · 2.º en X'`.
- Si `axe.run` lanza o da violaciones que no existen en un navegador real: cambiar la cabecera a `jsdom` y `npm i -D jsdom`.
- Violaciones reales: arreglar las de arreglo pequeño (atributo, `aria-label`, `alt`, rol). Las que no, se excluyen en el helper por id con comentario `ponytail:` y se apuntan como deuda en el review.
- Depende de: T1–T4 (axe debe ver el estado final).

Cada tarea cierra con `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.

## 10. Riesgos

- **axe en happy-dom** puede fallar o dar falsos positivos (`getComputedStyle`, visibilidad). Mitigación: archivo propio para cambiar a jsdom sin tocar `App.test.tsx`. Recorte: si tampoco va en jsdom, quedarse con A1, A5 y U19 y apuntarlo.
- **Contraste** no se comprueba (regla desactivada): límite aceptado en la propuesta.
- **`getByRole('status')` ambiguo** en Inicio si hay `notice` (HomeView ya usa `role="status"`). U18 corre en HERO; no usar `getByRole('status')` en Inicio.
- **Tests que dependen del texto de `confirm`**: ninguno compara el texto completo; U6/U8 no cambian.
- **Deuda a11y conocida fuera de alcance** (apuntar, no arreglar): el aviso de Inicio (`HomeView.tsx:91`) es un `role="status"` que se monta ya con contenido (mismo problema que el toast); el `aria-live` de resultados de propuestas en `TrackerCard.tsx:108` anuncia toda la lista y no solo el cambio; contraste de tokens sin verificar automáticamente; sin prueba con lector de pantalla real. Las violaciones serias que axe saque y no se arreglen en T5 se añaden aquí en el review.

## 11. Verificación

- `selfcheck.ts`: sin cambios; `[selfcheck] done` sin fallos.
- `storage.test.ts`: S2, C2, C3 cambian (reparados pasan de `dropped` a `fixed`) y test nuevo «solo reparados» (T1).
- `App.test.tsx`: U1 arreglado, U16, U17, U18. `a11y.test.tsx`: A1–A6, U19.
- Checklist manual (`npm run dev`):
  - [ ] Editar el nombre de una misión y pulsar «Archivar»: en Inicio aparece archivada con el nombre nuevo.
  - [ ] En «Nuevo», escribir el nombre de una archivada: «(archivada)» y «Reactivar» funcionan; no se puede crear el duplicado.
  - [ ] Meter en DevTools un evento con `undoes: 3` en `life-rpg-demo-v1` y recargar: aviso de «corregido», existe `life-rpg-demo-v1.backup.<stamp>`, el registro sigue.
  - [ ] Con lector de pantalla (NVDA o VoiceOver), un level-up y un adelantamiento se anuncian una vez; crear una misión y proponerla se anuncia.
  - [ ] Móvil: toast y banners se ven igual que antes.

## 12. Handoff para Claude Code

Implementa T1 → T5 en orden, un commit por tarea (`T1: …`). Lee antes `core/storage.ts`, `storage.test.ts`, `TrackerCard.tsx`, `UnknownView.tsx`, `LevelUpToast.tsx` y `App.test.tsx`. No toques `selfcheck.ts`, `stats`, `rpg`, `party` ni el formato persistido. No añadas dependencias de runtime; la única devDependency es `axe-core` (más `jsdom` solo si happy-dom no sirve, y dilo en el commit). Si axe saca violaciones serias de arreglo no trivial, exclúyelas por id con `ponytail:` y apúntalas; no rediseñes. Cierra cada tarea con `npm run build`, `npm run lint` y `npm test` desde `app/`.
