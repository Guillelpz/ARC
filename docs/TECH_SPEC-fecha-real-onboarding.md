# TECH SPEC — Fecha real, onboarding vacío y CI (ciclo 2)

Fuentes: `docs/cycles/cycle-1/proposals.md` (P1.1, P1.2) con los cambios de `docs/cycles/cycle-1/evaluation.md`, y `docs/cycles/cycle-3/proposals.md` (P3.1) con los cambios de `docs/cycles/cycle-3/evaluation.md`. Se parte de `main`, que ya incluye el ciclo 1 (`npm test` con Vitest, `loadAll` con backups, exportar/importar).

## 1. Resumen

- **P1.1:** «hoy» pasa a ser la fecha local real del navegador, tanto para derivar (stats, XP, party) como para fechar registros nuevos. `core/` sigue recibiendo `today` por parámetro. El selfcheck sigue usando `DEMO_DATE` como fixture y sus asserts no cambian de valor.
- **P1.2:** un usuario sin datos guardados arranca vacío. La home muestra una tarjeta con «Cargar ejemplo», que carga los 28 eventos semilla desplazados por semanas enteras hasta la semana actual, sin eventos futuros. «Restablecer demo» pasa a «Borrar todo» y vacía, en vez de cargar la semilla.
- **P3.1:** workflow de GitHub Actions con `npm ci`, lint, build y test en `push` y `pull_request`. Solo se escribe el archivo, sin remoto ni push.
- **Fuera de alcance:** renombrar claves de localStorage, bloque «Tus datos», `persist()` y aviso de copia (P3.2/P3.3), PARTY (sigue simulada y con «de ejemplo»), editar la fecha de un registro y zonas horarias por usuario.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Fecha local | Un solo helper puro `localDate(d: Date)` en `core/stats.ts` (`getFullYear/getMonth/getDate`, no `toISOString`, que es UTC). Lo usan `today` y `nowStamp`. |
| Cambio de día con la app abierta | `today` se calcula en cada render y entra en las dependencias de los `useMemo`. Además, un listener `visibilitychange` fuerza un render al volver a la pestaña. Así, la app que se deja en segundo plano por la noche amanece con la semana correcta. |
| Fecha fija del selfcheck | `DEMO_DATE` se queda en `seed.ts` como fixture. Solo lo usan `selfcheck.ts`, `SEED_EVENTS` y los tests. `App.tsx` deja de importarlo. |
| Semilla relativa | Función pura `seedFor(today)` en `core/seed.ts`. Desplaza por semanas enteras (conserva el día de la semana) y descarta los eventos con fecha posterior a `today`. `SEED_EVENTS = seedFor(DEMO_DATE)`, idéntico al actual. |
| Clave ausente vs. corrupta | Ausente → `[]` (onboarding). Corrupta → `[]` + backup + aviso: el comportamiento actual de `loadAll` no cambia. |
| Cuándo se ofrece «Cargar ejemplo» | Solo si `events.length === 0`. Sin confirmación, porque no hay nada que perder. Reemplaza `events` y no toca `custom`. |
| `reset()` | Vacía `events` y `custom` con el mismo `window.confirm`. Etiqueta «Borrar todo». Es la versión sobre la que se apoyará P3.3. |
| Claves | `life-rpg-demo-v1` / `life-rpg-custom-v1` no se tocan (decidido por el usuario). |
| Usuarios con la semilla vieja guardada | Sus datos no se modifican. Los eventos semilla del 28 sep al 7 oct quedan como historial pasado. No se limpian, porque pueden estar mezclados con registros reales. |
| CI | Un único job en `ubuntu-latest` con Node 22 (Vite 8 exige `^20.19 \|\| >=22.12`), `working-directory: app` y caché npm sobre `app/package-lock.json`. |

## 3. Decisiones que requieren aprobación

Ninguna. El arranque vacío, las claves, las dependencias de desarrollo y la CI sin remoto ya están decididos por el usuario. No cambia ninguna regla de juego.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/stats.ts` | + `localDate(d: Date): string`. |
| `app/src/core/seed.ts` | Lista base privada `BASE`, + `seedFor(today)` y `SEED_EVENTS = seedFor(DEMO_DATE)`. Importa `addDays` y `mondayOf` de `stats.ts`. |
| `app/src/core/storage.ts` | `loadAll`: clave de eventos ausente → `[]`. Se quita el import de `SEED_EVENTS`. |
| `app/src/core/selfcheck.ts` | + asserts de `localDate` y `seedFor`. Los existentes no se tocan. |
| `app/src/core/storage.test.ts` | El test «store vacío» espera `events: []`. |
| `app/src/App.tsx` | `today`, `nowStamp` con fecha real, refresco con `visibilitychange`, `loadExample()` y `reset()` que vacía. Deja de importar `DEMO_DATE` y `SEED_EVENTS`. |
| `app/src/components/HomeView.tsx` | Fuera «Historial de ejemplo · Fecha demo: 7 oct 2026 ·». + tarjeta de estado vacío. «Restablecer demo» → «Borrar todo». |
| `docs/STYLE_GUIDE.md` | Copy: «Restablecer demo» → «Borrar todo» (l. 14, 96, 109, 150). Se quita «Historial de ejemplo · Fecha demo…» de la l. 130. |
| `.github/workflows/ci.yml` | Nuevo (P3.1). |

## 5. Modelos de datos

Sin cambios en `types.ts`. Se mantiene `ActivityEvent.occurredAt` = `'YYYY-MM-DDTHH:mm:ss'` local, sin zona, que ahora sí es la fecha local real.

## 6. Persistencia y migración

- **Formato:** sin cambios. Las mismas claves y el mismo JSON. No hace falta migración.
- **Datos ya guardados:** se cargan tal cual. Quien tenga la semilla de la demo la conserva como historial pasado (cae en semanas anteriores a la actual) y puede vaciar con «Borrar todo».
- **Clave de eventos ausente:** `[]`. No se escribe nada al cargar, aunque el `useEffect` de `saveEvents` guardará `[]` en el primer render, como hoy guarda la semilla.
- **Clave corrupta o con elementos inválidos:** igual que en el ciclo 1 (backup + aviso + bloqueo si no se puede copiar).
- **«Cargar ejemplo»:** escribe los eventos en `life-rpg-demo-v1` mediante el `saveEvents` existente. Los ids son `seed-NN`. No hay colisión, porque solo se ofrece con la lista vacía.
- `persist()`, `exportData` (nombre de archivo en UTC) y el resto de «Tus datos» no se tocan.

## 7. Lógica de dominio

### `core/stats.ts`

```ts
// fecha local del navegador; no usar toISOString (UTC: desfasa el día cerca de medianoche)
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```

### `core/seed.ts`

```ts
export const DEMO_DATE = '2026-10-07' // fixture del selfcheck y los tests; la app usa la fecha real

const BASE: ActivityEvent[] = [ /* los 28 ev(...) actuales, sin cambios */ ]

const DAY = 864e5
// Semilla relativa a `today`: misma forma (semana actual y anterior), desplazada por semanas enteras
// para conservar el día de la semana; nunca deja eventos posteriores a `today`.
export function seedFor(today: string): ActivityEvent[] {
  const days = Math.round((Date.parse(`${mondayOf(today)}T00:00:00Z`) - Date.parse(`${mondayOf(DEMO_DATE)}T00:00:00Z`)) / DAY)
  return BASE
    .map(e => ({ ...e, occurredAt: addDays(e.occurredAt.slice(0, 10), days) + e.occurredAt.slice(10) }))
    .filter(e => e.occurredAt.slice(0, 10) <= today)
}

export const SEED_EVENTS = seedFor(DEMO_DATE) // = los 28 eventos de siempre
```

`days` siempre es múltiplo de 7, porque es la diferencia entre dos lunes. Los eventos de hoy quedan a las 09:00 aunque sea antes de esa hora. Es inocuo: `total()` compara por día. Se deja tal cual.

### `core/storage.ts`

```ts
const events = load(KEY, readEvents, [], [])   // antes: SEED_EVENTS si la clave no existe
```

### `App.tsx`

```ts
import { localDate } from './core/stats'
import { seedFor } from './core/seed'

const nowStamp = (d = new Date()) => `${localDate(d)}T${d.toTimeString().slice(0, 8)}`

// dentro del componente
const [, refresh] = useReducer((n: number) => n + 1, 0)
useEffect(() => {
  const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
  document.addEventListener('visibilitychange', onVisible)
  return () => document.removeEventListener('visibilitychange', onVisible)
}, [])
// ponytail: «hoy» se recalcula en cada render y al volver a la pestaña; con la app visible
// pasada la medianoche y sin tocar nada, la pantalla muestra el día anterior hasta la siguiente
// interacción. Añadir un timer a medianoche si molesta.
const today = localDate(new Date())

const game = useMemo(() => deriveGame(events, today, trackers), [events, today, trackers])
const partyStates = useMemo(
  () => PARTIES.map(p => derivePartyState(p, events, today, trackers, custom.proposals)),
  [events, today, trackers, custom.proposals],
)
```

- En `add()`, las dos llamadas que hoy usan `DEMO_DATE` (`deriveGame(next, …)` y `derivePartyState(p, next, …)`) pasan a usar `today`. Los niveles dependen solo de `allTime`, así que un `today` de un render anterior no altera los toasts de nivel.
- `loadExample = () => setEvents(seedFor(today))`.
- `reset()`:

```ts
function reset() {
  if (!window.confirm('¿Borrar todos tus registros y misiones nuevas? No se puede deshacer. Exporta una copia antes si quieres conservarlos.')) return
  setEvents([]); setCustom(EMPTY_CUSTOM); setToast(null); setGain(null); setOvertake(null)
}
```

- A `HomeView` se le pasa `onLoadExample={events.length === 0 ? loadExample : undefined}`.

Motor (`rpg.ts`, `party.ts`, `stats.ts` salvo `localDate`), reglas de semana, XP y umbrales: **sin cambios**.

## 8. UI

**HomeView**
- Se quita el `<span>Historial de ejemplo · Fecha demo: 7 oct 2026 ·</span>` del footer (P1.1, en la misma tarea).
- La prop nueva es `onLoadExample?: () => void`. Si existe, se muestra una tarjeta en `main`, después del aviso (`notice`) y antes de `PlayerHeader`:
  - Contenedor: `flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5 lg:col-span-2` (neutral).
  - `h2` (`text-lg font-semibold`): «Empieza tu historial».
  - `p` (`text-sm leading-6`): «Registra tu primera actividad en HERO o VILLAIN. Si prefieres ver antes cómo funciona, carga un ejemplo de dos semanas; puedes borrarlo cuando quieras con «Borrar todo».»
  - Botón secundario neutral (`btn` + `border border-app-border bg-transparent text-app-text outline-app-text hover:bg-app-surface`): «Cargar ejemplo».
  - Cuando hay eventos, la tarjeta desaparece sola, porque la prop pasa a ser `undefined`. No hay estados de carga ni de error: todo es síncrono.
- En el footer, el botón de reset cambia de icono y texto: `Trash2` + «Borrar todo». Mismo estilo discreto y misma posición. P3.3 lo moverá a «Tus datos».
- Estado vacío del resto de pantallas: no cambia. `PlayerHeader` ya muestra «Tu personaje empieza aquí» con `heroPct === null`, y las tarjetas muestran 0.
- El chip «de ejemplo» de las parties y «Party de ejemplo» se quedan como están, porque PARTY sigue simulada.

## 9. Backlog

**T1 — Fecha real (P1.1)**
- Archivos: `core/stats.ts`, `App.tsx`, `components/HomeView.tsx`, `core/selfcheck.ts`.
- Qué: `localDate`, `nowStamp` con fecha real, `today` en render y en las dependencias de los `useMemo`, refresco con `visibilitychange`, `add()` con `today`, y quitar el span «Fecha demo». Assert de `localDate` (§11).
- Depende de: nada.
- Aceptación: no queda ningún `DEMO_DATE` en `App.tsx`. Un registro nuevo lleva la fecha local de hoy. Con el reloj del sistema a las 00:30 locales en UTC+2, el registro sale con la fecha local, no la UTC. Build, lint y test en verde.

**T2 — `seedFor(today)` (P1.2, núcleo)**
- Archivos: `core/seed.ts`, `core/selfcheck.ts`.
- Qué: `BASE` privada, `seedFor` y `SEED_EVENTS = seedFor(DEMO_DATE)`. Asserts de `seedFor` (§11). Sin cambios de UI.
- Depende de: T1 (usa el mismo modelo de fecha; técnicamente independiente).
- Aceptación: todos los asserts existentes pasan sin tocarlos, más los nuevos. `npm test` en verde.

**T3 — Onboarding vacío y «Borrar todo» (P1.2, app)**
- Archivos: `core/storage.ts`, `core/storage.test.ts`, `App.tsx`, `components/HomeView.tsx`, `docs/STYLE_GUIDE.md`.
- Qué: `loadAll` sin la semilla, `loadExample`, tarjeta de estado vacío, `reset()` que vacía con la nueva copy, botón «Borrar todo» (`Trash2`) y copy de la guía de estilo.
- Depende de: T2.
- Aceptación: con localStorage limpio, la app arranca a 0 con la tarjeta. «Cargar ejemplo» deja la semana actual y la anterior con datos y ningún evento futuro. Recargar conserva los datos. «Borrar todo» vacía y vuelve a mostrar la tarjeta. Los datos guardados previamente se cargan intactos. No queda la palabra «demo» en la UI (`grep -i demo app/src/components`). Build, lint y test en verde.

**T4 — CI (P3.1), independiente**
- Archivos: `.github/workflows/ci.yml` (nuevo).
- Qué: el workflow de §12. Comprobar que `app/.gitignore` sigue ignorando `*.local` (ahí está `.env.local`; verificado hoy).
- Depende de: nada (puede ir en cualquier momento).
- Aceptación: el YAML es válido. En local, `npm ci && npm run lint && npm run build && npm test` desde `app/` termina en verde (prueba que el lockfile está sincronizado). Sin push ni remoto.

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Desfase UTC (registro fechado ayer o mañana cerca de la medianoche) | Usar solo `localDate`, nunca `toISOString()` para fechas de dominio. Assert con un `Date` construido en hora local. | — |
| Semana congelada con la app abierta | `today` en cada render + `visibilitychange`. | Recortar el listener: el cálculo por render ya cubre la siguiente interacción. |
| Un usuario actual pierde datos al cambiar `loadAll` | Solo cambia la rama «clave ausente». Los tests de `loadAll` cubren las ramas válida, corrupta y bloqueada. | — |
| Eventos semilla futuros o fuera de semana | `seedFor` filtra `> today` y desplaza por lunes. Asserts del lunes y de una fecha lejana. | — |
| `npm ci` falla en CI por lockfile desincronizado | Ejecutar `npm ci` en local en T4. | Regenerar el lock con `npm install` y commitearlo. |

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`** (después de «corrección −5 km deshace +5 km», porque usan `g0` y `sum0`). Hay que importar `localDate` de `./stats` y `seedFor` de `./seed`.

```ts
ok(localDate(new Date(2026, 9, 7, 23, 59)) === '2026-10-07' && localDate(new Date(2026, 0, 5, 0, 0)) === '2026-01-05', 'fecha local YYYY-MM-DD')
const sx = seedFor('2026-12-16') // miércoles, +10 semanas
ok(sx.length === 28 && sx[0].occurredAt === '2026-12-07T09:00:00' && sum0(deriveGame(sx, '2026-12-16')) === sum0(g0), 'seedFor: semanas enteras, mismas stats')
const sl = seedFor('2026-10-12') // lunes: mar y mié de la semana base caerían en el futuro
ok(sl.length === 16 && sl.every(e => e.occurredAt.slice(0, 10) <= '2026-10-12'), 'seedFor: sin eventos futuros')
```

**Asserts existentes:** no cambian. `SEED_EVENTS` sigue siendo los mismos 28 eventos y `DEMO_DATE` sigue fijo.

**Tests de Vitest:** `storage.test.ts`, el test «store vacío», pasa a esperar `{ events: [], custom: EMPTY_CUSTOM, problems: [] }`. Es el cambio de regla decidido por el usuario: arrancar vacío.

**Gates por tarea** (desde `app/`): `npm run build`, `npm run lint` y `npm test` en verde, más `[selfcheck] done` sin fallos en la consola en dev.

**Checklist manual:**
- [ ] localStorage limpio → home a 0, tarjeta «Empieza tu historial» y ningún «Fecha demo».
- [ ] «Cargar ejemplo» → la tarjeta desaparece, HERO/VILLAIN con datos esta semana y la anterior, ninguna fecha posterior a hoy (DevTools → Local Storage).
- [ ] Registrar +1 → el `occurredAt` guardado lleva la fecha local de hoy.
- [ ] Recargar → se conservan los datos.
- [ ] «Borrar todo» → confirmación, vacío y la tarjeta vuelve.
- [ ] Con datos guardados antes del cambio (copiar un `life-rpg-demo-v1` antiguo) → se cargan sin aviso y sin cambios.
- [ ] Dejar la pestaña en segundo plano y volver → sin errores. Para simular el cambio de día, cambiar el reloj del sistema y volver a la pestaña: la semana se recalcula.
- [ ] Móvil a 320 px: la tarjeta de estado vacío no desborda y el botón mide ≥ 44 px.

## 12. Handoff para Claude Code

1. Leer `CLAUDE.md`, esta spec y los archivos de §4. Implementar **T1 → T2 → T3** en orden, cada una con su gate en verde antes de pasar a la siguiente. **T4** es independiente: se puede hacer al final o en paralelo.
2. No tocar los asserts existentes de `selfcheck.ts`. Si alguno falla, el error está en `seedFor`/`localDate`, no en el assert.
3. No renombrar claves, no tocar `persist()`, `exportData` ni crear el bloque «Tus datos» (eso es del ciclo 3). No tocar `PartyView` ni los chips «de ejemplo».
4. Sin dependencias nuevas. Iconos: `Trash2` de `lucide-react` (ya instalado).
5. T4: escribir solo el archivo. No crear remoto ni hacer push.
6. Al cerrar, no actualizar `docs/ESTADO-ACTUAL.md`: lo hace el cycle-analyst.
