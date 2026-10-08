# TECH SPEC V2 — Pantallas, «IA» local y parties múltiples

> **Histórico.** Documento de la demo de hackathon. Lo implementado sigue estas reglas, pero el estado vigente y el alcance futuro están en `docs/ESTADO-ACTUAL.md`.

Incremental sobre `docs/TECH_SPEC.md` (V1, no se toca). Producto: `docs/PRD-V2.md` con las recomendaciones por defecto de §12 (Q1 retroactivo, Q2 sin pesos, Q3 HERO + `baja`, Q4 P1, Q5 no, Q6 ninguna marcada, Q7 `Desconocido`/`Nuevo`, Q8 fila genérica, Q9 un amigo por party, Q10 toast global). Diseño: `docs/DESIGN-V2.md` + `docs/STYLE_GUIDE.md`. Todo lo no mencionado aquí sigue como en V1.

---

## 1. Technical Decisions

- **Stack sin cambios:** React + TS + Vite + Tailwind v4 + Lucide (`app/package.json`). **Cero dependencias nuevas**, sin router (`useState<Screen>`), sin backend.
- **Un solo motor de cálculo:** `deriveGame(events, today, trackers = TRACKERS)`. Global = todos los trackers; party = `deriveGame` con `trackers` filtrado por criterios. No hay segunda fórmula (recomendación PRD §7).
- **Persistido:** `ActivityEvent[]` (clave V1 `life-rpg-demo-v1`, sin cambios) + `CustomData = { trackers, proposals }` (clave nueva `life-rpg-custom-v1`). **Derivado:** lista completa de trackers, resultado de cada voto, criterios, «Cuenta en», progreso por party, rankings.
- **Voto no persistido:** se guarda solo `Proposal {trackerId, partyId, proposedAt}`; `vote(branch, party)` se recalcula siempre (determinista).
- **Compatibilidad V1:** no hay migración. Clave nueva ausente o corrupta → `{ trackers: [], proposals: [] }`. Eventos/propuestas con `trackerId` desconocido se ignoran solos (los cálculos iteran sobre trackers, no sobre eventos).

Decisiones que resuelven ambigüedades del PRD/diseño:

| # | Decisión |
|---|---|
| D1 | XP por unidad editable en rango **1–50** (no 5–50): el valor sugerido de duración es 1 XP/min (PRD §6.1) y debe ser válido. Se redondea y limita en `createTracker`. |
| D2 | Cambiar el **tipo** en la propuesta resetea `increment` y `xpPerUnit` a los defaults del tipo (`TYPE_DEFAULTS`). La rama no toca la XP. |
| D3 | Unidad de los personalizados `count` = `unidades` (PRD §7). La tarjeta muestra `0 unidades esta semana` (el «veces» del diseño es solo la etiqueta del segmento `Veces`). |
| D4 | Clasificador: coincidencia por **inicio de palabra** (`\b` + palabra clave sobre texto normalizado), así «cervezas» cuenta y «caminar» no dispara `min`. Unidades con regex `(\d|\b)km\b` y `(\d|\b)(min|minutos?|horas?)\b`. «madrugada» solo en la regla horaria (no se cuenta dos veces). |
| D5 | Ids: parties `los-del-gym`, `la-oficina`; trackers personalizados `custom-${crypto.randomUUID()}` (el id lo genera la UI; `createTracker` es pura y lo recibe). |
| D6 | `PartyMember` pierde `gym/bjj/runningKm/beer` (Q8). `buildRanking(game, members = PARTIES[0].members)` conserva su firma V1 para que los asserts V1 pasen sin tocarlos. |
| D7 | La selección de party vive en `App` (`partyId`), para que Inicio pueda abrir Party con una party concreta y se recuerde entre pantallas. |
| D8 | Tono del toast lo decide `App`: título `LEVEL UP — PLAYER …` → `neutral`; si no → rama del tracker registrado. `diffLevelUps` no cambia. |

## 2. Minimal Architecture

```text
app/src/
  core/
    types.ts        MOD  tipos nuevos (§3)
    trackers.ts     MOD  + allTrackers()
    rpg.ts          MOD  deriveGame con parámetro trackers; + weeklyXp()
    party.ts        MOD  PARTIES, vote, partyCriteria, proposeTo, derivePartyState, countsIn, buildRanking
    classify.ts     NEW  classify, normalizeText, nombres, TYPE_DEFAULTS, createTracker
    storage.ts      MOD  + parseCustom / loadCustom / saveCustom / EMPTY_CUSTOM
    selfcheck.ts    MOD  asserts V1 intactos + bloque V2 (§4.6)
    seed.ts         —    sin cambios
    stats.ts        —    sin cambios
  components/
    BottomNav.tsx   NEW  5 destinos, exporta type Screen
    Segmented.tsx   NEW  selector segmentado (party, rama, tipo)
    HomeView.tsx    NEW  Inicio
    MissionsView.tsx NEW Misiones HERO / VILLAIN (sustituye section() de App)
    UnknownView.tsx NEW  Desconocido: 4 pasos
    PartyView.tsx   MOD  selector + tú en la party + ranking genérico + criterios
    TrackerCard.tsx MOD  countsIn, icono Sparkles + chip Nueva, tokens de rama
    ProgressBar.tsx MOD  prop color → tone: 'hero'|'villain'|'neutral'
    PlayerHeader.tsx MOD estilo (sin cambios funcionales)
    LevelUpToast.tsx MOD Toast + tone
  App.tsx           MOD  estado (events, custom, screen, partyId, toast, gain) y derivación
  index.css         MOD  tokens de STYLE_GUIDE + prefers-reduced-motion
```

Regla: los componentes no calculan XP, criterios ni votos por su cuenta; llaman a funciones de `core/`. Solo `storage.ts` toca `localStorage`.

## 3. Data Models (`app/src/core/types.ts`)

```ts
export type Branch = 'hero' | 'villain'

export type Tracker = {
  id: string
  name: string
  branch: Branch
  type: 'count' | 'distance' | 'duration'
  unit: 'sesiones' | 'clases' | 'km' | 'min' | 'unidades'
  increment: number
  buttonLabel: string
  xpPerUnit: number
  weeklyGoal?: number
  custom?: true                       // NUEVO: personalizados (sin weeklyGoal)
}

// ActivityEvent, LevelInfo, TrackerStats, GameState: SIN CAMBIOS

export type PartyMember = {           // MOD: se eliminan gym, bjj, runningKm, beer (Q8)
  id: string
  name: string
  isYou?: boolean
  playerLevel: number
  heroLevel: number
  villainLevel: number
  weeklyHeroXp: number
}

export type Friend = PartyMember & { stance: Record<Branch, boolean> }   // postura de voto fija
export type Party = { id: string; name: string; members: Friend[]; seedCriteria: string[] }

export type Proposal = { trackerId: string; partyId: string; proposedAt: string } // 'YYYY-MM-DDTHH:mm:ss'
export type CustomData = { trackers: Tracker[]; proposals: Proposal[] }           // persistido

export type VoteResult = {
  partyId: string
  accepted: boolean
  yes: number
  total: number
  votes: { name: string; yes: boolean }[]   // en orden de members
}

export type PartyState = {                 // derivado, nunca persistido
  party: Party
  game: GameState                          // deriveGame solo con criterios
  criteria: Tracker[]                      // en orden de la lista de trackers
  rejected: { tracker: Tracker; result: VoteResult }[]
  ranking: PartyMember[]
  position: number                         // 1-based, tu puesto
}

export type Confidence = 'alta' | 'media' | 'baja'
export type Classification = {
  branch: Branch
  confidence: Confidence
  reasons: string[]                        // p. ej. ['pizza', '3am']
  reason: string                           // 'Detectado: «pizza», «3am»' | 'Sin pistas claras: elige tú'
  type: Tracker['type']
  unit: 'unidades' | 'km' | 'min'
  increment: number
  xpPerUnit: number
}
export type TrackerDraft = { name: string; branch: Branch; type: Tracker['type']; xpPerUnit: number }
```

Nota de build: quitar los 4 campos de `PartyMember` rompe `party.ts` y `PartyView.tsx` V1; la tarea C1 los ajusta en el mismo paso (§7).

## 4. Core Logic

### 4.1 `trackers.ts`
```ts
export const allTrackers = (custom: Tracker[]): Tracker[] => [...TRACKERS, ...custom]
```
Orden = semilla y luego personalizados por creación (orden de las misiones).

### 4.2 `rpg.ts`
```ts
export function deriveGame(events: ActivityEvent[], today: string, trackers: Tracker[] = TRACKERS): GameState
// cuerpo V1 idéntico, cambiando TRACKERS.map por trackers.map
export const weeklyXp = (g: GameState, b: Branch): number =>
  g.trackers.filter(s => s.tracker.branch === b).reduce((a, s) => a + s.week * s.tracker.xpPerUnit, 0)
```
`App` **siempre** pasa `allTrackers(custom.trackers)`. `diffLevelUps` empareja por índice: `before` y `after` deben derivarse con la misma lista (se cumple en `add`).

### 4.3 `party.ts`
```ts
export const PARTIES: Party[] = [
  { id: 'los-del-gym', name: 'Los del Gym', seedCriteria: ['gym', 'bjj', 'running', 'reading', 'beer', 'burgers'], members: [
    { id: 'carlos', name: 'Carlos', playerLevel: 8, heroLevel: 9, villainLevel: 2, weeklyHeroXp: 515, stance: { hero: true, villain: false } },
    { id: 'alex',   name: 'Alex',   playerLevel: 6, heroLevel: 6, villainLevel: 2, weeklyHeroXp: 350, stance: { hero: true, villain: true } },
    { id: 'dani',   name: 'Dani',   playerLevel: 5, heroLevel: 4, villainLevel: 3, weeklyHeroXp: 220, stance: { hero: true, villain: true } },
  ] },
  { id: 'la-oficina', name: 'La Oficina', seedCriteria: ['running', 'reading', 'burgers'], members: [
    { id: 'lucia', name: 'Lucía', playerLevel: 4, heroLevel: 4, villainLevel: 1, weeklyHeroXp: 240, stance: { hero: true, villain: false } },
    { id: 'marta', name: 'Marta', playerLevel: 3, heroLevel: 3, villainLevel: 1, weeklyHeroXp: 160, stance: { hero: true, villain: false } },
    { id: 'pablo', name: 'Pablo', playerLevel: 2, heroLevel: 2, villainLevel: 1, weeklyHeroXp: 120, stance: { hero: true, villain: true } },
  ] },
]

export function vote(branch: Branch, party: Party): VoteResult
// votes = members.map(m => ({ name: m.name, yes: m.stance[branch] })); yes = nº de sí;
// total = members.length; accepted = yes * 2 > total   (3 amigos → ≥2)

export function partyCriteria(party: Party, trackers: Tracker[], proposals: Proposal[]): Tracker[]
// ids = seedCriteria ∪ { p.trackerId | p.partyId === party.id, tracker existe, vote(tracker.branch, party).accepted }
// return trackers.filter(t => ids.has(t.id))

export function proposeTo(proposals: Proposal[], trackerId: string, partyIds: string[], trackers: Tracker[], now: string): Proposal[]
// Devuelve un array NUEVO. Por cada partyId: se omite si la party o el tracker no existen,
// si ya hay Proposal (trackerId, partyId) o si el tracker ya es criterio de esa party (R4).

export function buildRanking(game: GameState, members: PartyMember[] = PARTIES[0].members): PartyMember[]
// you = { id: 'you', name: 'Tú', isYou: true, niveles de game, weeklyHeroXp: game.weeklyHeroXp }
// [you, ...members].sort((a, b) => b.weeklyHeroXp - a.weeklyHeroXp)   // sort estable: ganas empates (R7)

export function derivePartyState(party: Party, events: ActivityEvent[], today: string, trackers: Tracker[], proposals: Proposal[]): PartyState
// criteria = partyCriteria(...); game = deriveGame(events, today, criteria)
// rejected = propuestas de esta party con tracker existente y !vote(...).accepted → { tracker, result }
// ranking = buildRanking(game, party.members); position = ranking.findIndex(r => r.isYou) + 1

export const countsIn = (trackerId: string, states: PartyState[]): string[] =>
  states.filter(s => s.criteria.some(t => t.id === trackerId)).map(s => s.party.name)
```
R5 retroactivo sale gratis: `deriveGame` no mira fechas de aceptación.

### 4.4 `classify.ts` (heurística «IA», pura y determinista)
```ts
export const normalizeText = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

export const HERO_WORDS = ['meditar', 'meditacion', 'yoga', 'correr', 'running', 'caminar', 'andar', 'nadar', 'bici',
  'entrenar', 'gym', 'gimnasio', 'estirar', 'leer', 'lectura', 'estudiar', 'idiomas', 'dormir', 'agua', 'fruta',
  'verdura', 'cocinar', 'ordenar', 'limpiar', 'voluntariado']
export const VILLAIN_WORDS = ['pizza', 'burger', 'hamburguesa', 'cerveza', 'birra', 'vino', 'copa', 'alcohol', 'fumar',
  'tabaco', 'chuches', 'azucar', 'dulces', 'comida rapida', 'fritos', 'scroll', 'tiktok', 'procrastinar', 'trasnochar']
// ponytail: palabras clave por inicio de palabra; un modelo real sustituiría solo classify()

export const TYPE_DEFAULTS = {
  count:    { unit: 'unidades', increment: 1,  xpPerUnit: 20 },
  distance: { unit: 'km',       increment: 5,  xpPerUnit: 5 },
  duration: { unit: 'min',      increment: 30, xpPerUnit: 1 },
} as const

export function classify(text: string): Classification
```
Algoritmo de `classify` (en este orden):
1. `n = normalizeText(text)`.
2. `hero = HERO_WORDS.filter(w => new RegExp('\\b' + w).test(n))`; ídem `villain`.
3. Regla horaria: `m = n.match(/\b[0-5]\s*am\b/) ?? n.match(/\bmadrugada\b/)`; si hay `m`, `villain.push(m[0])`.
4. Si `hero.length === villain.length` (empate o 0): `branch 'hero'`, `confidence 'baja'`, `reasons []`, `reason 'Sin pistas claras: elige tú'`.
5. Si no: gana la lista más larga; `reasons` = la lista ganadora; `confidence = win >= 2 && lose === 0 ? 'alta' : 'media'`; `reason = 'Detectado: ' + reasons.map(r => «r»).join(', ')`.
6. Tipo: `/(\d|\b)km\b/` → `distance`; si no `/(\d|\b)(min|minutos?|horas?)\b/` → `duration`; si no `count`. `unit/increment/xpPerUnit` de `TYPE_DEFAULTS`.

Helpers de nombre y creación (mismo archivo):
```ts
export const trackerName = (text: string): string   // trim + espacios colapsados + primera letra mayúscula (R9)
export const isValidName = (text: string): boolean  // 2 <= text.trim().length <= 40
export const isDuplicateName = (text: string, trackers: Tracker[]): boolean
  // trackers.some(t => normalizeText(t.name) === normalizeText(text))
export const clampXp = (n: number): number => Math.min(50, Math.max(1, Math.round(n) || 1))   // D1
export function createTracker(d: TrackerDraft, id: string): Tracker
  // { id, name: d.name, branch, type, ...unit/increment de TYPE_DEFAULTS[d.type], xpPerUnit: clampXp(d.xpPerUnit),
  //   buttonLabel: unit === 'unidades' ? '+1' : `+${increment} ${unit}`, custom: true }   (sin weeklyGoal)
```

#### 4.4b `classifyAI` (Claude Haiku 4.5)
- `classifyAI(text): Promise<Classification>` es lo que usa `UnknownView`. Hace `POST /api/claude` (modelo `claude-haiku-4-5`, structured output `{branch, confidence, type, reason}`, timeout 8 s); unit/increment/xpPerUnit salen de `TYPE_DEFAULTS`, `reasons: []`.
- La key no va al bundle: el proxy de `vite.config.ts` (dev y preview) reenvía a `https://api.anthropic.com/v1/messages` y añade `x-api-key`. Setup: `app/.env.local` con `ANTHROPIC_API_KEY=sk-ant-...` (ignorado por `*.local`) y reiniciar `npm run dev`.
- Cualquier fallo (sin key, red, timeout, HTTP no-2xx, JSON o enums inválidos) → `classify(text)`. La heurística sigue siendo el oráculo del selfcheck.
- Límite: en hosting estático no hay proxy → siempre heurística. No exponer el dev server (`--host`): el proxy gasta la key de quien lo arranca.

### 4.5 `storage.ts`
```ts
const CUSTOM_KEY = 'life-rpg-custom-v1'
export const EMPTY_CUSTOM: CustomData = { trackers: [], proposals: [] }

export function parseCustom(raw: string | null): CustomData   // pura; testeable en selfcheck
// try JSON.parse; si no es objeto → EMPTY_CUSTOM.
// trackers: Array.isArray ? filtrar t con id/name string, branch 'hero'|'villain',
//   increment y xpPerUnit Number.isFinite : []
// proposals: Array.isArray ? filtrar p con trackerId/partyId string : []
// catch → EMPTY_CUSTOM
export const loadCustom = (): CustomData => { try { return parseCustom(localStorage.getItem(CUSTOM_KEY)) } catch { return EMPTY_CUSTOM } }
export const saveCustom = (c: CustomData) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)) } catch { /* cuota */ } }
```
`loadEvents`/`saveEvents` y la clave V1 no cambian. Reset en `App`: `setEvents(SEED_EVENTS); setCustom(EMPTY_CUSTOM)`; los `useEffect` de guardado escriben ambas claves.

### 4.6 `selfcheck.ts` — bloque V2
Añadir **después** del último assert V1 y antes de `console.info`, sin modificar nada anterior (reutiliza `ok`, `tap`, `g0`, `e1`). Imports nuevos: `Proposal, Tracker, GameState` (tipos), `PARTIES, vote, partyCriteria, proposeTo, derivePartyState, countsIn`, `classify, createTracker, trackerName, isDuplicateName, isValidName`, `allTrackers`, `parseCustom`.

```ts
  // ---- V2 (PRD-V2 §8) ----
  const [gymP, ofi] = PARTIES
  const NOW = `${DEMO_DATE}T12:00:00`
  const ids = (ts: { id: string }[]) => ts.map(t => t.id).join()
  const sum = (g: GameState) => [g.hero.xp, g.hero.level, g.villain.xp, g.villain.level, g.player.xp, g.player.level, g.weeklyHeroXp].join()
  const ps = (events: ActivityEvent[], trackers: Tracker[] = TRACKERS, proposals: Proposal[] = []) =>
    PARTIES.map(p => derivePartyState(p, events, DEMO_DATE, trackers, proposals))

  ok(ids(partyCriteria(gymP, TRACKERS, [])) === 'gym,bjj,running,reading,beer,burgers', 'criterios Los del Gym')
  ok(ids(partyCriteria(ofi, TRACKERS, [])) === 'running,reading,burgers', 'criterios La Oficina')
  const [sg0, so0] = ps(SEED_EVENTS)
  ok(sum(sg0.game) === sum(g0), 'Los del Gym = global al abrir')
  ok(sum(so0.game) === '300,2,60,1,360,2,180', 'La Oficina: HERO 300 L2, VILLAIN 60 L1, PLAYER 360 L2, sem 180')
  ok(ids(so0.ranking) === 'lucia,you,marta,pablo' && so0.position === 2, 'ranking La Oficina')
  ok(ids(sg0.ranking) === 'carlos,alex,you,dani' && sg0.position === 3, 'ranking Los del Gym inicial')
  const [sg1, so1] = ps(e1)
  ok(ids(sg1.ranking) === 'carlos,you,alex,dani' && sg1.game.weeklyHeroXp === 360, 'Los del Gym tras +Gym')
  ok(sum(so1.game) === sum(so0.game) && ids(so1.ranking) === ids(so0.ranking), '+Gym: La Oficina no cambia')
  const eb = tap(SEED_EVENTS, 'beer'); const [sgb, sob] = ps(eb)
  ok(deriveGame(eb, DEMO_DATE).villain.xp === 165 && sgb.game.villain.xp === 165 && sob.game.villain.xp === 60, '+Beer: 165 / 165 / 60')
  ok(countsIn('beer', [sg0, so0]).join(' · ') === 'Los del Gym', 'Beer cuenta en Los del Gym')
  ok(countsIn('running', [sg0, so0]).join(' · ') === 'Los del Gym · La Oficina', 'Running cuenta en ambas')

  const c = classify
  const m = c('meditar'); ok(m.branch === 'hero' && m.type === 'count' && m.increment === 1 && m.xpPerUnit === 20, 'IA meditar')
  const p = c('comer pizza a las 3am')
  ok(p.branch === 'villain' && p.confidence === 'alta' && p.reasons.includes('pizza') && p.reasons.includes('3am'), 'IA pizza 3am')
  const r = c('correr 5 km'); ok(r.branch === 'hero' && r.type === 'distance' && r.unit === 'km' && r.increment === 5 && r.xpPerUnit === 5, 'IA correr km')
  const l = c('leer 30 minutos'); ok(l.branch === 'hero' && l.type === 'duration' && l.unit === 'min' && l.increment === 30 && l.xpPerUnit === 1, 'IA leer min')
  const x = c('xyzzy'); ok(x.branch === 'hero' && x.confidence === 'baja' && x.reason.startsWith('Sin pistas claras'), 'IA sin pistas')
  ok(JSON.stringify(c('Pizza')) === JSON.stringify(c('pizza')) && JSON.stringify(c('comer pizza a las 3am')) === JSON.stringify(p), 'IA determinista')
  ok(c('caminar').type === 'count', 'caminar no es duración')

  const med = createTracker({ name: 'Meditar', branch: 'hero', type: 'count', xpPerUnit: 20 }, 'custom-meditar')
  const pizza = createTracker({ name: trackerName('comer pizza a las 3am'), branch: 'villain', type: 'count', xpPerUnit: 20 }, 'custom-pizza')
  const all = allTrackers([med, pizza])
  ok(pizza.name === 'Comer pizza a las 3am' && med.buttonLabel === '+1' && med.custom === true && !med.weeklyGoal, 'createTracker')
  ok(countsIn(med.id, ps(SEED_EVENTS, all)).length === 0, 'Meditar: ninguna party')
  const em = [...SEED_EVENTS, { id: 'check-med', trackerId: med.id, amount: 1, occurredAt: NOW }]
  ok(deriveGame(em, DEMO_DATE, all).hero.xp === 590 && ps(em, all)[1].game.hero.xp === 300, 'Meditar: +20 global, Oficina 300')
  const pm = proposeTo([], med.id, PARTIES.map(q => q.id), all, NOW)
  ok(pm.length === 2 && PARTIES.every(q => { const v = vote('hero', q); return v.accepted && v.yes === 3 && v.total === 3 }), 'Meditar 3/3 en ambas')
  const [smg, smo] = ps(em, all, pm)
  ok(smg.criteria.some(t => t.id === med.id) && smo.criteria.some(t => t.id === med.id), 'Meditar en criterios')
  ok(smo.game.hero.xp === 320, 'retroactivo: Oficina 300 → 320')
  ok(proposeTo(pm, med.id, [ofi.id], all, NOW).length === 2, 'no proponer dos veces')
  ok(proposeTo([], 'beer', [gymP.id], all, NOW).length === 0, 'no proponer un criterio existente')

  const vg = vote('villain', gymP), vo = vote('villain', ofi)
  ok(vg.accepted && vg.yes === 2 && vg.votes.find(v => v.name === 'Carlos')?.yes === false, 'VILLAIN: Gym 2/3, Carlos no')
  ok(!vo.accepted && vo.yes === 1 && vo.votes.find(v => v.name === 'Pablo')?.yes === true, 'VILLAIN: Oficina 1/3, Pablo sí')
  const pp = proposeTo([], pizza.id, PARTIES.map(q => q.id), all, NOW)
  const ep = [...SEED_EVENTS, { id: 'check-pizza', trackerId: pizza.id, amount: 1, occurredAt: NOW }]
  const [spg, spo] = ps(ep, all, pp)
  ok(deriveGame(ep, DEMO_DATE, all).villain.xp === 170 && spg.game.villain.xp === 170 && spo.game.villain.xp === 60, 'pizza: +20 global, +20 Gym, +0 Oficina')
  ok(spo.rejected.map(q => `${q.tracker.id}:${q.result.yes}/${q.result.total}`).join() === 'custom-pizza:1/3', 'Oficina: No aceptados')

  ok(['beer', 'Beer', 'Béer'].every(n => isDuplicateName(n, all)) && !isDuplicateName('Meditar yoga', all), 'nombres únicos')
  ok(!isValidName(' a ') && isValidName('ab') && !isValidName('x'.repeat(41)), 'longitud 2–40')
  ok(parseCustom('{roto').trackers.length === 0 && parseCustom(null).proposals.length === 0, 'clave corrupta → vacío')
  ok(parseCustom(JSON.stringify({ trackers: [med], proposals: pm })).proposals.length === 2, 'roundtrip custom')
```
«Tras reset: 28 eventos, 0 personalizados, 0 propuestas» queda cubierto por `SEED_EVENTS.length === 28` (V1) + `EMPTY_CUSTOM`.

## 5. Demo Seed Data

Sin cambios en `SEED_EVENTS` ni `DEMO_DATE`. Datos nuevos solo en código: `PARTIES` (§4.3). Estado inicial = 28 eventos + `EMPTY_CUSTOM`. Los del Gym reproduce la Party V1 (mismos amigos y XP) con los 6 semilla como criterio → tus números ahí = globales. La Oficina abre con HERO 300 / VILLAIN 60 / PLAYER 360 Lv. 2, puesto 2.º de 4.

## 6. Component Map

```text
App (estado: events, custom, screen, partyId, toast, gain)
├─ screen 'home'    → HomeView ── PlayerHeader, filas de party (PartyState[]), botón → 'new'
├─ screen 'hero'    → MissionsView branch=hero    ── TrackerCard × n (countsIn)
├─ screen 'villain' → MissionsView branch=villain ── TrackerCard × n
├─ screen 'new'     → UnknownView ── Segmented (rama, tipo)
├─ screen 'party'   → PartyView ── Segmented (party)
├─ LevelUpToast (si toast)
└─ BottomNav
```

Derivación en `App` (única):
```ts
const [custom, setCustom] = useState<CustomData>(loadCustom)
useEffect(() => saveCustom(custom), [custom])
const trackers = useMemo(() => allTrackers(custom.trackers), [custom.trackers])
const game = useMemo(() => deriveGame(events, DEMO_DATE, trackers), [events, trackers])
const partyStates = useMemo(() => PARTIES.map(p => derivePartyState(p, events, DEMO_DATE, trackers, custom.proposals)), [events, trackers, custom.proposals])
const [screen, setScreen] = useState<Screen>('home')       // navegar: setScreen + window.scrollTo(0, 0)
const [partyId, setPartyId] = useState(PARTIES[0].id)
// add(t): igual que V1 pero deriveGame(next, DEMO_DATE, trackers); toast con tone (D8)
// create(t: Tracker): setCustom(c => ({ ...c, trackers: [...c.trackers, t] }))
// propose(trackerId, partyIds): setCustom(c => ({ ...c, proposals: proposeTo(c.proposals, trackerId, partyIds, allTrackers(c.trackers), now) }))
//   now = `${DEMO_DATE}T${new Date().toTimeString().slice(0, 8)}` calculado fuera del updater
// reset(): confirm(...) → setEvents(SEED_EVENTS); setCustom(EMPTY_CUSTOM); setToast(null); setGain(null)
```

Props (contratos fijos; los fija U1):

| Componente | Props |
|---|---|
| `BottomNav` | `screen: Screen`, `onChange(s: Screen)`. Exporta `type Screen = 'home' \| 'hero' \| 'villain' \| 'new' \| 'party'`. |
| `Segmented<T extends string>` | `options: { value: T; label: string }[]`, `value: T`, `onChange(v: T)`, `label: string`, `toneFor?(v: T): 'hero' \| 'villain' \| 'neutral'` |
| `ProgressBar` | `value: number` (0..1), `tone: 'hero' \| 'villain' \| 'neutral'`, `thin?`, `label: string` |
| `TrackerCard` | `stats: TrackerStats`, `gain: Gain \| null`, `onAdd()`, `countsIn: string[]` |
| `MissionsView` | `branch: Branch`, `game: GameState`, `partyStates: PartyState[]`, `gain`, `onAdd(t: Tracker)` |
| `HomeView` | `game`, `partyStates`, `onNavigate(s: Screen)`, `onOpenParty(id: string)`, `onReset()` (contadores y XP semanal por rama con `weeklyXp`) |
| `PartyView` | `states: PartyState[]`, `selectedId: string`, `onSelect(id)`, `global: GameState` |
| `UnknownView` | `trackers: Tracker[]`, `parties: Party[]`, `onCreate(t: Tracker)`, `onPropose(trackerId: string, partyIds: string[])`, `onGoToMissions(b: Branch)` |
| `LevelUpToast` | `toast: Toast` con `Toast = { title; detail; key; tone: 'hero' \| 'villain' \| 'neutral' }` |

`UnknownView` (estado local `step: 'write' | 'proposal' | 'parties' | 'result'`, `text`, `draft: TrackerDraft`, `created: Tracker | null`, `selected: string[]`, `results: VoteResult[]`): `Analizar` → `classify(text)` → `draft = { name: trackerName(text), branch, type, xpPerUnit }`; cambiar tipo aplica D2; `Crear misión` → `createTracker(draft, \`custom-${crypto.randomUUID()}\`)` → `onCreate`; `Proponer` → `onPropose(...)` y `results = selected.map(id => vote(created.branch, party(id)))`. Validación paso 1: `isValidName` y `isDuplicateName(text, trackers)` (mensaje `Ya tienes «{nombre existente}»`). Textos, layout y estados: DESIGN-V2 §3 y §6.

`TrackerCard`: icono `ICONS[t.id] ?? Sparkles`; chip `Nueva` si `t.custom`; `Registra tu primera vez` si `t.custom && allTime === 0`; línea `Cuenta en: ${countsIn.join(' · ') || 'ninguna party'}`.

## 7. Implementation Backlog

Fase C (núcleo) antes que fase U (UI). **‖** = paralelizable con las demás del mismo grupo (archivos disjuntos). Tras cada tarea: `npm run build` y `npm run lint` en `app/` deben pasar.

| ID | Tarea | Archivos (exclusivos) | Depende | Hecho cuando | Máx. |
|---|---|---|---|---|---|
| C1 | Tipos V2 + adaptar usos de `PartyMember` | `core/types.ts`, `core/party.ts` (solo quitar los 4 campos de `PARTY` y `buildRanking`), `components/PartyView.tsx` (solo borrar la línea Gym/BJJ/Running/Beer) | — | Tipos de §3 existen; build verde; asserts V1 pasan | 8 min |
| C2 ‖ | Clasificador y creación de trackers | `core/classify.ts` (nuevo) | C1 | Firmas exactas de §4.4 | 15 min |
| C3 ‖ | Motor generalizado + parties | `core/trackers.ts`, `core/rpg.ts`, `core/party.ts` | C1 | Firmas de §4.1–4.3; `PARTY` sustituido por `PARTIES`; `App` V1 sigue compilando (`buildRanking(game)`) | 15 min |
| C4 ‖ | Persistencia custom | `core/storage.ts` | C1 | §4.5; `loadEvents/saveEvents` intactos | 7 min |
| C5 | Selfcheck V2 | `core/selfcheck.ts` | C2, C3, C4 | Bloque §4.6 añadido; `npm run dev` sin `Assertion failed`. Si falla un assert, se corrige el motor, nunca el assert | 10 min |
| U1 | Esqueleto V2: navegación, estado, contratos | `App.tsx`, `index.css` (tokens STYLE_GUIDE + reduced-motion), `components/BottomNav.tsx`, `components/Segmented.tsx`, `components/ProgressBar.tsx` (`tone`, actualizar llamadas en `PlayerHeader`/`TrackerCard` solo en la prop), `components/LevelUpToast.tsx` (solo `tone` en `Toast`), `components/MissionsView.tsx` (funcional), `components/TrackerCard.tsx` (solo `countsIn` + icono fallback + chip), stubs con props finales de `HomeView.tsx`, `UnknownView.tsx` y nueva firma de `PartyView.tsx` | C5 | 5 destinos navegables con `aria-current`; Misiones HERO/VILLAIN registran y muestran `Cuenta en:`; reset limpia ambas claves; persistencia tras recargar | 20 min |
| U2 ‖ | Inicio | `components/HomeView.tsx` | U1 | DESIGN §1: PlayerHeader, accesos con contador y XP semanal, «Tus parties» (Lv. y `N.º de 4`, abre Party), `Añadir algo nuevo`, pie con reset | 12 min |
| U3 ‖ | Misiones con tema | `components/MissionsView.tsx`, `components/TrackerCard.tsx` | U1 | DESIGN §2; HERO solo tokens `hero-*`, VILLAIN solo `villain-*`; float-xp por rama | 12 min |
| U4 ‖ | Party | `components/PartyView.tsx` | U1 | DESIGN §4: selector, tú (PLAYER/HERO/VILLAIN + `Global: Lv. X · Aquí: Lv. Y`), ranking genérico con tu fila marcada, criterios HERO/VILLAIN, `No aceptados: X · 1/3` | 15 min |
| U5 ‖ | Desconocido | `components/UnknownView.tsx` | U1 | DESIGN §3: 4 pasos; flujo §5.1 del PRD reproduce `Gym Aceptada 2/3 · Oficina Rechazada 1/3` con votos por nombre | 25 min |
| U6 ‖ | Restyle cabecera y toast | `components/PlayerHeader.tsx`, `components/LevelUpToast.tsx`, `components/ProgressBar.tsx` (estilo) | U1 | Sin `slate-*`, hex ni `rounded-2xl`; paneles de rama; toast según `tone` | 10 min |
| V1 | Verificación + revisión visual | ninguno (solo correcciones puntuales del dueño del archivo) | U2–U6 | §10 completo; revisión `frontend-stylist` sobre `components/` | 10 min |

Paralelismo: {C2, C3, C4} en paralelo; {U2, U3, U4, U5, U6} en paralelo. Si se trabaja en serie, orden de valor: U3 → U4 → U5 → U2 → U6 (PRD §10: Party antes que Desconocido; tema al final). P1 (proponer existentes, feedback por party, toast de party, atajo a tracker existente) **no** entra en este backlog; `proposeTo` ya los soporta cuando se pidan.

## 8. Time Budget (≈115 min)

| Bloque | Min |
|---|---:|
| C1–C5 núcleo + asserts | 35 |
| U1 esqueleto | 20 |
| U2–U5 pantallas (en serie ≈ 64; en paralelo ≈ 25) | 40 |
| U6 + revisión visual | 10 |
| Feature freeze, ensayo del guion PRD §9 | 10 |

## 9. Risk & Cut Plan

| Riesgo | Prevención | Alternativa / recorte |
|---|---|---|
| Generalizar `deriveGame` rompe números V1 | Parámetro con default `TRACKERS`; asserts V1 intactos (C5) | Revertir rpg.ts y calcular party con copia filtrada: nunca fórmula nueva |
| Contratos de props cambian a mitad y chocan las tareas paralelas | U1 fija props y stubs antes de paralelizar | Las U* no cambian props; si hace falta, se para y se edita en serie |
| `localStorage` V1 o clave nueva corrupta | `parseCustom` defensivo + assert | Botón «Restablecer demo» |
| Clasificador falla con frases de la demo | Las 5 frases del PRD en asserts | La propuesta siempre es editable; rama editable nunca se recorta |
| Restyle consume la sesión | Tema en U3/U6, después de funcionalidad | Kill list de tema: solo fondo + tarjetas en Misiones |

**Plan de recorte (min 60 sin demo V2):** cerrar U1 + U3 + U4 (navegación, misiones, Party con criterios) — la regla «global siempre, party solo si es criterio» ya se demuestra con `+ Beer`. Después U5 recortado: sin edición de tipo/XP ni vista previa (solo rama). Después quitar «Tus parties» de Inicio y la línea `Global/Aquí`. **Nunca recortar:** R1–R3, votación visible, clasificador con rama editable, persistencia y reset.

## 10. Definition of Done

- [ ] `npm run build` y `npm run lint` pasan en `app/`; consola en dev sin `Assertion failed` ni errores.
- [ ] Tras reset: 28 eventos; HERO 570 / VILLAIN 150 / PLAYER 720 Lv. 3; sin misiones nuevas.
- [ ] `+ Gym`: toast `LEVEL UP — PLAYER 4`; Los del Gym ranking Carlos, Tú (360), Alex, Dani; La Oficina sin cambios.
- [ ] `+ Beer`: VILLAIN global y Los del Gym 165; La Oficina 60. Beer: `Cuenta en: Los del Gym`; Running: ambas.
- [ ] Desconocido: «comer pizza a las 3am» → `La IA propone: VILLAIN`, `Confianza alta`, `Detectado: «pizza», «3am»`; «beer»/«Béer» bloqueados con `Ya tienes «Beer»`.
- [ ] Crear + proponer a ambas → `Aceptada 2/3` (Carlos ✕) y `Rechazada 1/3` (Pablo ✓); `+1` pizza → VILLAIN global y Gym +20, Oficina +0; Party Oficina lista `No aceptados: Comer pizza a las 3am · 1/3`.
- [ ] Recargar conserva eventos, misiones y propuestas; «Restablecer demo» (con confirm) vuelve al estado inicial; clave `life-rpg-custom-v1` con basura → arranca sin personalizados.
- [ ] 320 y 390 px: 5 destinos sin scroll horizontal, `aria-current` en la activa; Misiones HERO solo `hero-*`, VILLAIN solo `villain-*`.
- [ ] Secuencia PRD §9 completa en < 2 min: `reset → Gym → Beer → Party (alternar) → crear pizza → proponer → +1 pizza → recargar`.

## 11. Claude Code Handoff

1. Lee `AGENTS.md`, este documento, `docs/DESIGN-V2.md` y `docs/STYLE_GUIDE.md`. El PRD manda en producto; este documento manda en firmas y archivos.
2. Ejecuta C1 → {C2, C3, C4} → C5. No toques UI hasta que C5 pase sin `Assertion failed`.
3. Ejecuta U1 completo (contratos de §6) y luego {U2…U6}, cada agente solo en sus archivos asignados.
4. Nada de dependencias nuevas, router, backend, ni lógica de XP/votos/criterios dentro de componentes. `localStorage` solo en `core/storage.ts`.
5. Cierra con V1 (§10) y la revisión `frontend-stylist`. No declares la UI probada sin abrirla.
