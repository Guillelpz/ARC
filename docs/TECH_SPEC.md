# TECH SPEC — Life RPG (Build Day MVP)

> **Histórico.** Documento de la demo de hackathon. Lo implementado sigue estas reglas, pero el estado vigente y el alcance futuro están en `docs/ESTADO-ACTUAL.md`.

Fuente de verdad de producto: `MVP-RPG.md`. Este documento solo decide el **cómo**. Ninguna funcionalidad nueva.

---

## 1. Technical Decisions

| Decisión | Elección |
|---|---|
| Build | **Vite + React 18 + TypeScript** (plantilla `react-ts`) |
| Estilos | **Tailwind CSS v4** vía `@tailwindcss/vite` (sin `tailwind.config`, sin PostCSS) |
| Iconos | **lucide-react** |
| Animación | **CSS puro** (transiciones + 2 keyframes). Sin librería de animación |
| Estado | `useState` en `App.tsx`. Sin Redux/Zustand/Context |
| Persistencia | `localStorage`, aislado en `core/storage.ts` |
| Routing | Ninguno. `tab: 'you' \| 'party'` en estado |
| Tests | Sin framework. `core/selfcheck.ts` con `console.assert` que se ejecuta en DEV al arrancar |

Justificación: Vite arranca en segundos y no tiene SSR ni routing que interfieran (Next.js sobra sin backend). Tailwind v4 son 2 líneas de configuración. Lucide da el emblema y los iconos de tracker sin assets propios. Cero dependencias más.

**Decisiones sobre ambigüedades del PRD:**

1. **Fechas como strings, no `Date`.** `occurredAt` = `"YYYY-MM-DDTHH:mm:ss"` local, sin zona. Los rangos se comparan **lexicográficamente** (`occurredAt >= "2026-10-05"` y `< "2026-10-08"`). Así no hay bugs de zona horaria. `Date` solo se usa (en UTC) para sumar días y obtener el día de la semana.
2. **Fecha demo** = constante `DEMO_DATE = "2026-10-07"`. Los eventos nuevos usan `DEMO_DATE + "T" + horaLocalActual`. Las semanas se calculan con `mondayOf(DEMO_DATE)` y no se hardcodean.
3. **Doble pulsación:** cada toque crea un evento, sin debounce. Es el comportamiento honesto y el reset lo cubre.
4. **Restablecer:** sin `confirm()`, para poder ensayar rápido. Vuelve a los 28 eventos semilla y limpia toast y feedback.
5. **Porcentaje de composición:** `heroPct = Math.round(hero/player*100)` y `villainPct = 100 - heroPct`. Con el dataset sale 79/21 y siempre suma 100.
6. **Empate en el ranking:** `sort` estable, con la fila del usuario la primera en el array antes de ordenar, de modo que el usuario gana los empates. En el guion no se produce ninguno.
7. **Diferencia 0** se muestra como `±0`. Las negativas usan `−` (U+2212). Las diferencias siempre en color neutro (slate), en todas las ramas.
8. **Toast de level-up:** si sube Player, título `LEVEL UP — PLAYER N` y detalle con el resto de subidas (`Gym Lv. 4 · Hero Lv. 4`). Si no sube Player pero sí otra cosa, título `LEVEL UP` y la lista en el detalle. Dura 2000 ms y un nuevo toast reemplaza al anterior.
9. **Ubicación del proyecto:** subcarpeta `app/`, porque la raíz no está vacía y el `create vite` en `.` sería interactivo.

**Qué se persiste y qué se calcula:**

| Persistido (localStorage `life-rpg-demo-v1`) | Constante en código | Derivado (nunca guardado) |
|---|---|---|
| `ActivityEvent[]` | `TRACKERS`, `PARTY`, `DEMO_DATE`, umbrales | Totales, comparaciones, % objetivo, XP, niveles, composición, fila del usuario en Party, ranking |

---

## 2. Minimal Architecture

```
app/
├─ index.html
├─ vite.config.ts            # react() + tailwindcss()
└─ src/
   ├─ main.tsx               # render <App/>, llama runSelfCheck() si import.meta.env.DEV
   ├─ index.css             # @import "tailwindcss"; @theme (colores); keyframes
   ├─ App.tsx               # ÚNICO estado: events, tab, toast, lastGain. Handler addEvent/reset
   ├─ core/                 # sin React. Funciones puras + 1 módulo de IO
   │  ├─ types.ts           # todos los tipos
   │  ├─ trackers.ts        # TRACKERS (6 constantes)
   │  ├─ seed.ts            # DEMO_DATE, SEED_EVENTS (28)
   │  ├─ storage.ts         # loadEvents / saveEvents. ÚNICO punto que toca localStorage
   │  ├─ stats.ts           # addDays, mondayOf, total, trackerStats
   │  ├─ rpg.ts             # levelInfo, deriveGame, diffLevelUps
   │  ├─ party.ts           # PARTY (3 amigos), buildRanking
   │  └─ selfcheck.ts       # asserts de los criterios de aceptación
   └─ components/           # presentación pura: props in, JSX out
      ├─ PlayerHeader.tsx   # YOU, Player Lv, emblema, barras HERO/VILLAIN, franja %
      ├─ TrackerCard.tsx    # tarjeta + botón + XP flotante
      ├─ ProgressBar.tsx    # barra reutilizada (header, objetivos, party)
      ├─ PartyView.tsx      # ranking
      └─ LevelUpToast.tsx   # aviso superpuesto
```

Reglas:
- `components/` **no importa** de `storage.ts` ni calcula XP o totales. Recibe `GameState` ya derivado.
- `core/` **no importa** React.
- Para cambiar a una base de datos solo se toca `storage.ts`, y para añadir una actividad basta con añadir una entrada a `TRACKERS`.

---

## 3. Data Models

`core/types.ts`:

```ts
export type Branch = 'hero' | 'villain'

export type Tracker = {
  id: string                      // 'gym' | 'bjj' | 'running' | 'reading' | 'beer' | 'burgers'
  name: string                    // 'Gym'
  branch: Branch
  type: 'count' | 'distance' | 'duration'   // 'quantity' no se usa en la demo; amount lo cubre
  unit: 'sesiones' | 'clases' | 'km' | 'min' | 'unidades'
  increment: number               // lo que añade el botón
  buttonLabel: string             // '+1 sesión' (siempre muestra cuánto añade)
  xpPerUnit: number
  weeklyGoal?: number             // ausente en Beer/Burgers
}

export type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string              // 'YYYY-MM-DDTHH:mm:ss' local, sin zona
}

export type LevelInfo = {
  xp: number
  level: number
  xpInLevel: number
  threshold: number
  progress: number                // 0..1 dentro del nivel
}

export type TrackerStats = {
  tracker: Tracker
  week: number                    // semana actual hasta hoy incluido
  prev: number                    // mismo tramo de la semana anterior
  diff: number                    // week - prev
  allTime: number
  goalPct: number | null          // sin limitar (125 si 5/4); null si no hay objetivo
  xp: LevelInfo                   // umbral 60
}

export type GameState = {
  trackers: TrackerStats[]
  hero: LevelInfo                 // umbral 200
  villain: LevelInfo              // umbral 200
  player: LevelInfo               // umbral 250
  heroPct: number | null          // null si player.xp === 0
  weeklyHeroXp: number
}

export type PartyMember = {
  id: string
  name: string
  isYou?: boolean
  playerLevel: number
  heroLevel: number
  villainLevel: number
  weeklyHeroXp: number
  gym: number
  bjj: number
  runningKm: number
  beer: number
}
```

`core/trackers.ts`, con valores exactos de la §9 del PRD:

| id | name | branch | type | unit | increment | buttonLabel | xpPerUnit | weeklyGoal |
|---|---|---|---|---|---:|---|---:|---:|
| gym | Gym | hero | count | sesiones | 1 | `+1 sesión` | 30 | 4 |
| bjj | BJJ | hero | count | clases | 1 | `+1 clase` | 30 | 3 |
| running | Running | hero | distance | km | 5 | `+5 km` | 5 | 20 |
| reading | Reading | hero | duration | min | 30 | `+30 min` | 1 | 120 |
| beer | Beer | villain | count | unidades | 1 | `+1` | 15 | — |
| burgers | Burgers | villain | count | unidades | 1 | `+1` | 20 | — |

Iconos (mapa `id → LucideIcon` en `TrackerCard.tsx`, no en core): `Dumbbell`, `Swords`, `Footprints`, `BookOpen`, `Beer`, `Sandwich`. Ramas: HERO `Shield` y VILLAIN `Moon`.

---

## 4. Core Logic

### 4.1 Fechas y agregación (`core/stats.ts`)

```ts
export const addDays = (d: string, n: number): string => {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}
export const mondayOf = (d: string): string =>
  addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7))

// [start, end) con strings YYYY-MM-DD; la comparación lexicográfica es correcta con el formato fijo
export const total = (events: ActivityEvent[], trackerId: string, start = '', end = '9999') =>
  events
    .filter(e => e.trackerId === trackerId && e.occurredAt >= start && e.occurredAt < end)
    .reduce((s, e) => s + e.amount, 0)

export function trackerStats(t: Tracker, events: ActivityEvent[], today: string) {
  const thisStart = mondayOf(today)         // 2026-10-05
  const thisEnd = addDays(today, 1)         // 2026-10-08 (exclusivo)
  const week = total(events, t.id, thisStart, thisEnd)
  const prev = total(events, t.id, addDays(thisStart, -7), addDays(thisEnd, -7)) // [09-28, 10-01)
  const allTime = total(events, t.id)
  return {
    week, prev, diff: week - prev, allTime,
    goalPct: t.weeklyGoal ? (week / t.weeklyGoal) * 100 : null,
  }
}
```

- El ancho de la barra de objetivo es `Math.min(goalPct, 100)` y se calcula en el componente. El texto muestra el valor real (`5/4`).
- Se compara lunes–miércoles con lunes–miércoles, nunca con la semana completa.

### 4.2 RPG (`core/rpg.ts`)

```ts
export const THRESHOLD = { activity: 60, branch: 200, player: 250 } as const

export const levelInfo = (xp: number, threshold: number): LevelInfo => ({
  xp, threshold,
  level: 1 + Math.floor(xp / threshold),
  xpInLevel: xp % threshold,
  progress: (xp % threshold) / threshold,
})

export function deriveGame(events: ActivityEvent[], today: string): GameState
// por tracker: stats = trackerStats(); xp = levelInfo(allTime * xpPerUnit, 60)
// heroXp = Σ xp de trackers hero; villainXp igual; playerXp = heroXp + villainXp
// heroPct = playerXp ? Math.round(heroXp / playerXp * 100) : null
// weeklyHeroXp = Σ (week * xpPerUnit) de trackers hero

export function diffLevelUps(before: GameState, after: GameState): { title: string; detail: string } | null
// compara level de cada tracker, hero, villain y player.
// Etiquetas: '<Tracker.name> Lv. N', 'Hero Lv. N', 'Villain Lv. N'.
// Si sube player: title 'LEVEL UP — PLAYER N' y detail = resto unido por ' · '
// Si sube algo sin player: title 'LEVEL UP' y detail = lista. Si no sube nada: null.
```

XP de un evento = `amount × xpPerUnit`. Es lineal, sin multiplicadores ni penalizaciones. Como el XP de una actividad es `allTime × xpPerUnit`, sale el mismo resultado que sumar evento a evento.

### 4.3 Flujo de registro (`App.tsx`)

```ts
const [events, setEvents] = useState<ActivityEvent[]>(loadEvents)   // seed si vacío o corrupto
useEffect(() => saveEvents(events), [events])
const game = useMemo(() => deriveGame(events, DEMO_DATE), [events])

function add(t: Tracker) {
  const ev = { id: crypto.randomUUID(), trackerId: t.id, amount: t.increment,
               occurredAt: `${DEMO_DATE}T${new Date().toTimeString().slice(0, 8)}` }
  const next = [...events, ev]
  const up = diffLevelUps(game, deriveGame(next, DEMO_DATE))
  setEvents(next)                                   // nunca mutar; el evento se crea fuera del updater (StrictMode)
  setLastGain({ trackerId: t.id, xp: t.increment * t.xpPerUnit, branch: t.branch, key: ev.id })
  if (up) setToast({ ...up, key: ev.id })           // un useEffect con setTimeout(2000) lo limpia
}
const reset = () => { setEvents(SEED_EVENTS); setToast(null); setLastGain(null) }
```

### 4.4 Storage (`core/storage.ts`)

```ts
const KEY = 'life-rpg-demo-v1'
export function loadEvents(): ActivityEvent[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (Array.isArray(v)) return v } catch {}
  return SEED_EVENTS
}
export const saveEvents = (e: ActivityEvent[]) => { try { localStorage.setItem(KEY, JSON.stringify(e)) } catch {} }
```

### 4.5 Party (`core/party.ts`)

`PARTY` constante con Carlos, Alex y Dani (datos de la §11 del PRD tal cual).
`buildRanking(game)`: construye la fila `YOU` a partir de `game` (player, hero y villain level, weeklyHeroXp, y `week` de gym, bjj, running y beer), la pone **primero** en `[you, ...PARTY]` y ordena de forma estable por `weeklyHeroXp` descendente.

---

## 5. Demo Seed Data

`core/seed.ts` exporta `DEMO_DATE = '2026-10-07'` y `SEED_EVENTS` (28 eventos) generados con un helper:

```ts
const ev = (n: number, date: string, trackerId: string, amount = 1): ActivityEvent =>
  ({ id: `seed-${String(n).padStart(2, '0')}`, trackerId, amount, occurredAt: `${date}T09:00:00` })
```

| Fecha | Eventos (trackerId:amount) | # |
|---|---|---:|
| 2026-09-28 | gym:1, bjj:1, running:5, reading:30, burgers:1 | 5 |
| 2026-09-29 | reading:30 | 1 |
| 2026-09-30 | gym:1, bjj:1, running:7, beer:1, beer:1, burgers:1 | 6 |
| 2026-10-05 | gym:1, bjj:1, running:4, reading:30 | 4 |
| 2026-10-06 | gym:1, running:6, reading:30, beer:1, beer:1, burgers:1 | 6 |
| 2026-10-07 | gym:1, bjj:1, running:8, reading:30, beer:1, beer:1 | 6 |
| | | **28** |

Las fechas son absolutas, como exige el PRD (fecha demo fija), pero ningún valor de semana se hardcodea: todo sale de `mondayOf(DEMO_DATE)`.

Resultado esperado al abrir (verificado a mano y por `selfcheck.ts`):

| | Semana | Anterior | Diff | Histórico | XP | Lv |
|---|---:|---:|---:|---:|---:|---:|
| Gym | 3 | 2 | +1 | 5 | 150 | 3 |
| BJJ | 2 | 2 | ±0 | 4 | 120 | 3 |
| Running | 18 | 12 | +6 | 30 | 150 | 3 |
| Reading | 90 | 60 | +30 | 150 | 150 | 3 |
| Beer | 4 | 2 | +2 | 6 | 90 | 2 |
| Burgers | 1 | 2 | −1 | 3 | 60 | 2 |

HERO 570 (Lv 3) · VILLAIN 150 (Lv 1) · PLAYER 720 (Lv 3) · 79% / 21% · XP HERO semanal 330 (3.º en Party).

---

## 6. Component Map

```
App (estado: events, tab, toast, lastGain; derivado: game)
├─ tab === 'you'
│  ├─ PlayerHeader  { game }
│  │   └─ ProgressBar ×3 (player, hero, villain)
│  ├─ <h2>HERO</h2>    TrackerCard ×4 { stats, gain?, onAdd }
│  ├─ <h2>VILLAIN</h2> TrackerCard ×2
│  │   └─ ProgressBar (objetivo, solo si goalPct !== null) + ProgressBar fina (XP actividad)
│  └─ footer: "Historial de ejemplo · Fecha demo: 7 oct 2026 · [Restablecer demo]"
├─ tab === 'party'
│  └─ PartyView { rows: buildRanking(game) }   etiqueta "Party de ejemplo"
├─ LevelUpToast { toast }   (fixed, centrado arriba, solo si toast)
└─ nav fija inferior: [YOU] [PARTY]
```

**PlayerHeader:** `YOU` · `PLAYER LEVEL 3` con barra `xpInLevel/250`. El emblema es un círculo de 72 px con `conic-gradient(var(--color-hero) 0 {heroPct}%, var(--color-villain) 0)` y un disco interior oscuro con el número de nivel. Debajo, dos filas: HERO y VILLAIN con nivel, `570 XP` y barra. La franja de composición es una barra 2 colores con el texto `79% HERO · 21% VILLAIN`, etiqueta **Distribución de XP**. Si `heroPct === null`, en su lugar se muestra «Tu personaje empieza aquí».

**TrackerCard** (texto exacto):
- `GYM · Lv. 3`
- Con objetivo: **`3 / 4 sesiones esta semana`** más una barra. Sin objetivo: **`4 unidades esta semana`**, sin barra.
- `+1 vs. mismo tramo anterior` (las unidades km/min se añaden: `+6 km vs. mismo tramo anterior`).
- `Histórico: 5 sesiones`
- Botón `[ +1 sesión ]` con `active:scale-95`.
- Si `gain?.trackerId === id`: `<span key={gain.key} className="float-xp">+30 HERO XP</span>`. La `key` reinicia la animación en cada toque.

**Colores** (`@theme` en `index.css`): `--color-hero: #22d3ee` (cyan-400), `--color-villain: #a78bfa` (violet-400), fondo `slate-950` y tarjetas `slate-900`. No se usa rojo ni verde en ningún sitio. La tarjeta VILLAIN recibe el mismo peso visual que HERO.

**Animaciones (solo estas 4):**
1. Botón: `transition active:scale-95`.
2. Barras: `transition-[width] duration-500`.
3. `.float-xp`: keyframe de 900 ms, `translateY(0→-32px)` y `opacity 1→0`, `position:absolute`, `pointer-events:none`.
4. Toast: keyframe `pop` de 200 ms (`scale .9→1`, `opacity 0→1`). Se desmonta a los 2000 ms.

**Layout:** contenedor `mx-auto max-w-[420px] px-4 pb-24`. Tarjetas en 1 columna. Nada de anchos fijos superiores a 390 px.

---

## 7. Implementation Backlog

Cada tarea deja la app ejecutable. Si el trabajo se corta en cualquier punto, lo construido ya se puede presentar.

| # | Objetivo | Archivos | Funcionalidad exacta | Dep. | Aceptación | Máx |
|---|---|---|---|---|---|---:|
| T1 | Scaffold | `app/*`, `vite.config.ts`, `index.css`, `App.tsx` | `npm create vite@latest app -- --template react-ts`; `npm i lucide-react`; `npm i -D tailwindcss @tailwindcss/vite`; `@import "tailwindcss"` + `@theme`; fondo oscuro + contenedor móvil; borrar el boilerplate de Vite | — | `npm run dev` muestra "YOU" sobre fondo oscuro | 8 |
| T2 | Núcleo de datos | `core/types.ts`, `trackers.ts`, `seed.ts`, `storage.ts` | Tipos de §3, TRACKERS, 28 SEED_EVENTS, load/save | T1 | `SEED_EVENTS.length === 28` | 10 |
| T3 | Motor stats + RPG | `core/stats.ts`, `rpg.ts`, `selfcheck.ts`, `main.tsx` | §4.1, §4.2. selfcheck con asserts de §10 (estado inicial, tras +Gym y tras +Beer), ejecutado en DEV | T2 | Consola sin `Assertion failed` | 15 |
| T4 | Flujo central sin estética | `App.tsx`, `TrackerCard.tsx`, `ProgressBar.tsx` | Estado `events` + `useMemo(deriveGame)` + `add` + persistencia + reset en el pie. Tarjetas con todos los textos de §6 | T3 | Pulsar +1 sesión: Gym pasa a 4/4 e histórico 6; tras recargar se mantiene; reset vuelve a 3/4 | 15 |
| T5 | Cabecera del personaje | `PlayerHeader.tsx` | Player/HERO/VILLAIN con barras, emblema cónico y franja % | T4 | Muestra Lv 3, 570/150/720, 79%·21%; tras +Gym muestra Lv 4 | 12 |
| T6 | Wow moment | `LevelUpToast.tsx`, `TrackerCard.tsx`, `App.tsx`, `index.css` | `diffLevelUps`, toast de 2 s, XP flotante y keyframes | T5 | Desde reset, +Gym muestra «LEVEL UP — PLAYER 4 / Gym Lv. 4 · Hero Lv. 4» y «+30 HERO XP» | 12 |
| T7 | Party | `core/party.ts`, `PartyView.tsx`, nav en `App.tsx` | PARTY + buildRanking + vista + 2 botones de nav | T3 | Inicial: Carlos, Alex, Tú (330), Dani. Tras +Gym: Tú 2.º (360) | 8 |
| — | **FEATURE FREEZE (min 75)** | | | | | |
| T8 | Pulido | componentes | Jerarquía tipográfica (números grandes), espaciado, estados `active`, comprobar 390 px | T7 | Sin scroll horizontal a 390 px | 12 |
| T9 | Validación y ensayo | — | Checklist §10 y la secuencia `reset → Gym → Beer → Party → recargar` ×3 | T8 | Guion < 90 s sin errores en consola | 25 |

---

## 8. Time Budget (120 min)

| Min | Tareas | Hito |
|---|---|---|
| 0–8 | T1 | Home vacía ejecutándose |
| 8–18 | T2 | Datos y persistencia |
| 18–33 | T3 | Números que cuadran con el PRD (selfcheck verde) |
| 33–48 | T4 | **Primer hito demostrable:** registro real end to end |
| 48–60 | T5 | Personaje visible |
| 60–72 | T6 | Wow moment |
| 72–80 | T7 | Party (freeze en el min 75: si T7 no está, se aplica el recorte) |
| 80–92 | T8 | Presentable. **Diseño congelado en el min 92** |
| 92–120 | T9 | Validación + ensayos + margen |

**Con solo 90 min:** T1–T6 terminadas en el min 65, T7 en versión compacta (nombre, nivel, HERO XP) en 5 min, T8 en 5 min y T9 en 15 min.

---

## 9. Risk & Cut Plan

| # | Riesgo | Prevención | Alternativa | ¿Recortar? |
|---|---|---|---|---|
| 1 | Bugs de fecha/zona horaria que rompen las comparaciones | Strings `YYYY-MM-DD`, comparación lexicográfica y `Date` solo en UTC; selfcheck en T3 | Hardcodear `WEEK_START='2026-10-05'` en stats.ts | No |
| 2 | Contadores, XP o niveles desincronizados | Solo se persisten eventos; todo sale de `deriveGame` vía `useMemo` | — (no negociable) | Nunca |
| 3 | localStorage con datos viejos o corruptos que borran el level-up | Clave versionada, `try/catch` con fallback a seed y botón de reset visible | Cambiar la clave a `-v2` | No |
| 4 | Doble registro por StrictMode (updater o efecto ejecutados dos veces) | Crear el evento fuera del updater y guardar en `useEffect([events])`, que es idempotente | Quitar `<StrictMode>` en `main.tsx` | No |
| 5 | El pulido visual (emblema, animaciones) consume el tiempo del flujo central | Orden del backlog: estética tras T4; animaciones solo en CSS | Kill list | Sí, según la kill list |

**Kill list (del PRD, obligatoria):**
- **Min 45** sin T4 verde: se eliminan emblema, franja % y barras de XP por actividad. Se mantienen números de nivel y barras de objetivo.
- **Min 60** sin flujo central: Party se queda en nombre, nivel y HERO XP; el XP flotante se sustituye por el toast simple.
- **Min 90** sin demo presentable: Party pasa a ser un bloque dentro de Home, sin nav ni transiciones, y se para todo lo ornamental.
- **Nunca recortar:** registro real, agregación desde eventos, ambas ramas, progreso global, persistencia y reset.

**Si en el min 60 no hay demo funcional:** saltar T5 y T6 y mostrar en la cabecera solo `PLAYER LV / HERO LV / VILLAIN LV` como texto, y el toast como un `<div>` con el texto, sin animación. Después, T7 compacta y directos a T9.

---

## 10. Definition of Done

`selfcheck.ts` automatiza los asserts marcados con ⚙. El resto se comprueba a mano.

- [ ] ⚙ Tras reset hay exactamente 28 eventos y las 6 tarjetas coinciden con la tabla de §5.
- [ ] ⚙ Gym: `3/4`, histórico 5, 150 XP. Tras un toque: 1 evento más, `4/4`, histórico 6, 180 XP y diff `+2`.
- [ ] ⚙ Ese toque sube Gym, HERO y Player de Lv 3 a Lv 4. HERO pasa de 570 a 600 y VILLAIN se queda en 150.
- [ ] ⚙ `+5 km` suma 5 km y 25 HERO XP; `+30 min` suma 30 min y 30 HERO XP; `+ Beer` suma 1 y 15 VILLAIN XP sin reducir nada.
- [ ] ⚙ Las comparaciones usan [lun 28 sep, jue 1 oct) frente a [lun 5 oct, jue 8 oct).
- [ ] ⚙ Ranking: inicial Carlos, Alex, Tú, Dani. Tras +Gym: Carlos, Tú, Alex, Dani.
- [ ] Beer y Burgers no muestran objetivo, barra de objetivo ni mensajes de «te falta».
- [ ] Recargar conserva los eventos y Restablecer permite repetir el level-up.
- [ ] El toast y el «+30 HERO XP» aparecen y desaparecen en unos 2 s.
- [ ] Party muestra «Party de ejemplo».
- [ ] A 390 px (DevTools) no hay scroll horizontal y todos los botones se pueden tocar.
- [ ] La consola no muestra errores ni `Assertion failed`.
- [ ] El guion de §13 del PRD se completa en menos de 90 s.

---

## 11. Claude Code Handoff

> Implementa el MVP descrito en `docs/TECH_SPEC.md` (spec técnica) y `MVP-RPG.md` (producto). Trabaja en `app/`. Ejecuta el backlog §7 **en orden, T1→T9**, y comprueba el criterio de aceptación de cada tarea antes de pasar a la siguiente.
>
> Reglas duras:
> 1. Solo se persisten `ActivityEvent[]`. Todo lo demás se deriva con `deriveGame(events, DEMO_DATE)`.
> 2. `core/` es TypeScript puro sin React. `components/` no calcula dominio ni toca localStorage.
> 3. Fechas: strings `YYYY-MM-DD[THH:mm:ss]` y comparación lexicográfica. Nada de `new Date()` local para rangos.
> 4. Dependencias permitidas: react, react-dom, lucide-react, tailwindcss, @tailwindcss/vite. Ninguna más.
> 5. No se añaden pantallas, formularios, rutas ni funcionalidades fuera del PRD. Nada de rojo ni verde. VILLAIN en violeta.
> 6. Las cifras de §5 y §10 son el oráculo: si `selfcheck` falla, se arregla el motor, nunca los asserts.
> 7. Respeta el feature freeze (min 75) y la kill list de §9.
>
> Empieza ya por T1.
