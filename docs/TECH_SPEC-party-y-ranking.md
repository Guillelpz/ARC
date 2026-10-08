# TECH SPEC — Ciclo 9: proponer actividades existentes (P9.2) y ranking prorrateado (P9.3)

Base: `main` con los ciclos 1-8. Fuente: `docs/cycles/cycle-9/proposals.md` (P9.2, P9.3) con los cambios de `docs/cycles/cycle-9/evaluation.md`.

## 1. Resumen

- **P9.2:** en la tarjeta de una actividad **propia y activa** (HERO o VILLAIN), el botón «Proponer a party» abre un selector con el tema de la tarjeta que solo lista las parties donde la actividad no está propuesta ni es criterio. Usa el `propose` de `App.tsx`. El resultado («Aceptada en … 3/3» / «Rechazada en … 1/3») se deriva de `PartyState` (`criteria` y `rejected`), así que se conserva al recargar.
- **P9.3:** el XP semanal de los amigos simulados se prorratea por los días transcurridos de la semana (lunes 1/7 … domingo 7/7). `buildRanking` recibe `today` como parámetro obligatorio. `PartyView` añade una línea aclaratoria.
- **Fuera de alcance:** retirar propuestas, repetir una votación rechazada, proponer actividades fijas, votación real, aleatoriedad en los amigos, cambiar sus niveles o el XP del usuario. No se toca `storage.ts` ni el esquema persistido.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Firma de `buildRanking` | `buildRanking(game, members, metric, today)`, todos obligatorios (se quitan los valores por defecto). Así `tsc` señala cada llamada; un parámetro obligatorio no puede ir detrás de opcionales. |
| Días transcurridos | `8 − daysLeftInWeek(today)`: reutiliza la función del ciclo 7 (lunes → 1, domingo → 7). |
| Prorrateo | Se redondea cada campo por separado (`weeklyHeroXp`, `weeklyVillainXp`) con `Math.round(x × d / 7)`, y la profundidad se suma después (`rankScore` no cambia). No hay casos de `.5`: haría falta que `x·d/7 = k + ½`, es decir `7 | x·d` con `x·d/7` no entero, lo que es imposible. |
| Mutación | `buildRanking` devuelve copias (`{ ...m, … }`) y `PARTIES` queda intacto (lo comprueba el assert K1). |
| `today` en `PartyView` | Nueva prop `today`, pasada desde `App`. Es el cambio más pequeño para llamar a `buildRanking` con VILLAIN o profundidad. |
| Dónde se calculan las parties disponibles y el resultado (P9.2) | En `MissionsView`, junto al `countsIn` que ya calcula, a partir del mismo `partyStates` de `App`. Se evita una prop nueva de tipo mapa; se respeta lo que pide la evaluación: derivarlo de `partyStates`, sin estado local. |
| «No propuesta ni criterio» | Una party está disponible si `!s.criteria.some(id)` y `!s.rejected.some(id)`. Toda propuesta de una custom acaba en uno de los dos conjuntos. |
| Votos de una aceptada | `vote(t.branch, s.party)`: es puro y determinista, y es lo mismo que ya muestra `PartyView.Criteria`. |
| ¿Extraer el selector de `UnknownView`? | No. Son unas 10 líneas con otro tamaño y otra paleta, y extraerlo obligaría a pasar 3 o 4 props de clases. Se escribe directamente en `TrackerCard` con `THEME[t.branch]`. `UnknownView` no se toca. |
| Panel de propuesta | Sustituye la fila de registro, igual que la edición. Abrir uno cierra el otro. |
| `proposeTo` sin `goals` (menor del ciclo 8) | `propose` pasa a usar `allTrackers(c.trackers, c.goals)`. No cambia el resultado (`proposeTo` solo mira `id` y `branch`), pero mantiene la coherencia. |
| Tests de UI | U13 ya existe (ciclo 8). P9.2 → **U14**; P9.3 → **U15**. |

## 3. Decisiones que requieren aprobación

Ninguna pendiente. El usuario ya aprobó el prorrateo lineal y la migración de asserts descrita en §11. No hay dependencias nuevas.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/party.ts` | `paced()` privado y `buildRanking(…, today)` obligatorio; `derivePartyState` le pasa `today`. |
| `app/src/core/selfcheck.ts` | Migración de 8 asserts a domingo y asserts nuevos K1–K5 (ver §11). |
| `app/src/App.tsx` | `today` en las dos llamadas a `buildRanking` (líneas 106-107); `today` a `PartyView`; `onPropose={propose}` a `MissionsView`; `propose` con `c.goals`. |
| `app/src/components/PartyView.tsx` | Prop `today`; `buildRanking(game, s.party.members, metric, today)`; línea aclaratoria. |
| `app/src/components/MissionsView.tsx` | Prop `onPropose`; calcula `proposable` y `proposals` por tarjeta custom. |
| `app/src/components/TrackerCard.tsx` | Botón «Proponer a party», panel de selección y líneas de resultado. |
| `app/src/App.test.tsx` | U14 y U15. |

No hay archivos nuevos. `types.ts` y `storage.ts` no cambian.

## 5. Modelos de datos

Los tipos de dominio no cambian. Cambian estas firmas:

```ts
// party.ts
export function buildRanking(game: GameState, members: PartyMember[], metric: RankMetric, today: string): PartyMember[]

// MissionsView Props: añade
onPropose: (trackerId: string, partyIds: string[]) => void

// TrackerCard Props: añade (solo se pasan en custom)
proposable?: Party[]                                   // parties donde se puede proponer
proposals?: { party: string; result: VoteResult }[]    // resultado de las propuestas hechas
onPropose?: (partyIds: string[]) => void

// PartyView Props: añade
today: string
```

## 6. Persistencia y migración

No cambia nada. Las propuestas se siguen guardando en `life-rpg-custom-v1.proposals` mediante el `propose` actual. El resultado de la votación se deriva y no se guarda. El prorrateo se deriva de `today`. Los datos existentes no necesitan migración.

## 7. Lógica de dominio

```ts
// party.ts
import { daysLeftInWeek } from './stats'

// ponytail: amigos simulados a ritmo lineal (semanal × días transcurridos / 7; lun 1/7 … dom 7/7).
// Se sustituye por su XP semanal real cuando haya PARTY real (P3.5).
const paced = (m: PartyMember, today: string): PartyMember => {
  const d = 8 - daysLeftInWeek(today)
  return { ...m, weeklyHeroXp: Math.round(m.weeklyHeroXp * d / 7), weeklyVillainXp: Math.round(m.weeklyVillainXp * d / 7) }
}

export function buildRanking(game, members, metric, today) {
  const you = { /* igual que hoy */ }
  return [you, ...members.map(m => paced(m, today))].sort((a, b) => rankScore(b, metric) - rankScore(a, metric))
}
// derivePartyState: const ranking = buildRanking(game, party.members, 'hero', today)
```

Las reglas que ya existen no cambian: el usuario va primero (`sort` estable, gana los empates), `rankScore` y `overtakes` siguen igual, y los niveles de los amigos no se tocan.

Valores de referencia: miércoles `DEMO_DATE`, 3/7. Carlos 221/13, Alex 150/64, Dani 94/90, Lucía 103/6, Marta 69/19 y Pablo 51/51. Con el ejemplo, tú tienes HERO 330 en Los del Gym y 180 en La Oficina, y VILLAIN 80 y 20. El lunes 2026-10-12 (1/7): Carlos 74/4, Alex 50/21 y Dani 31/30.

P9.2 en `MissionsView` (solo para `s.tracker.custom`; las tarjetas que muestra ya son activas):

```ts
const has = (s: PartyState, id: string) => s.criteria.some(c => c.id === id)
const isRejected = (s: PartyState, id: string) => s.rejected.some(r => r.tracker.id === id)
const proposable = (t: Tracker) => partyStates.filter(s => !has(s, t.id) && !isRejected(s, t.id)).map(s => s.party)
const proposals = (t: Tracker) => partyStates.flatMap(s =>
  has(s, t.id) ? [{ party: s.party.name, result: vote(t.branch, s.party) }]
  : s.rejected.filter(r => r.tracker.id === t.id).map(r => ({ party: s.party.name, result: r.result })))
```

`proposeTo` sigue siendo la protección final contra duplicados y criterios ya existentes, y sus asserts no cambian.

## 8. UI

**TrackerCard (solo custom; los props llegan `undefined` en las fijas):**
- En el bloque `muted`, debajo de «Cuenta en: …», va una línea por propuesta: `Aceptada en {party} · {yes}/{total}` o `Rechazada en {party} · {yes}/{total}`. Va dentro de un `<div aria-live="polite">` que se monta siempre en las tarjetas custom, aunque esté vacío, para que el lector de pantalla anuncie el resultado al proponer.
- Si `proposable.length > 0` y no se está editando ni proponiendo, se muestra el botón `Proponer a party`, con icono `Users` de lucide, `aria-label="Proponer {t.name} a una party"` y las clases de un botón secundario de la tarjeta: `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.chip}`. Si no queda ninguna party disponible, el botón no aparece.
- Panel (estado local `proposing` y `picked: string[]`, que se vacía al abrir): `<fieldset>` con `<legend className="text-xs font-medium">¿A qué parties la propones?</legend>` y un checkbox por party disponible (`label` con `min-h-11`, input `size-5`, más `accent-hero` en HERO o `accent-villain scheme-dark` en VILLAIN; se añade como `check` a `THEME`). Debajo, `Cancelar` (`c.chip`) y `Proponer` (`c.button`, deshabilitado si no hay nada marcado). «Proponer» llama a `onPropose(picked)` y cierra el panel. Mientras está abierto, sustituye la fila de registro; al abrir «Editar» se cierra.
- No hay estado de carga ni de error: es síncrono y determinista.

**PartyView:** debajo del `<h2>` del ranking va `<p className="text-xs leading-5 text-app-muted">Amigos: su ritmo de la semana hasta hoy.</p>`.

**Tono:** los textos van en español, cortos y sin exclamaciones, como el resto de la tarjeta.

## 9. Backlog

### T1 — Ranking prorrateado (P9.3)
- **Objetivo:** que los amigos sumen XP a ritmo lineal durante la semana.
- **Archivos:** `core/party.ts`, `core/selfcheck.ts`, `App.tsx`, `components/PartyView.tsx`, `App.test.tsx`.
- **Funcionalidad:** §7 (`paced`, firma nueva, `derivePartyState`); `today` en `App.tsx:106-107`; prop `today` en `PartyView` y línea aclaratoria; migración de asserts y K1–K5 (§11); U15.
- **Dependencias:** ninguna.
- **Aceptación:** `build`, `lint` y `test` en verde; ningún assert cambia salvo los 8 de la tabla de §11; en dev, el miércoles con el ejemplo vas 1.º en HERO en las dos parties y Carlos tiene 221 XP.

### T2 — Proponer una actividad existente (P9.2)
- **Objetivo:** poder proponer cualquier misión propia activa a las parties que falten.
- **Archivos:** `App.tsx`, `components/MissionsView.tsx`, `components/TrackerCard.tsx`, `App.test.tsx`.
- **Funcionalidad:** §7 (P9.2) y §8 (TrackerCard); `onPropose={propose}` a `MissionsView`; `propose` con `allTrackers(c.trackers, c.goals)`.
- **Dependencias:** ninguna; es independiente de T1. Si van en ramas paralelas, `App.tsx` y `App.test.tsx` se fusionan a mano.
- **Aceptación:** `build`, `lint` y `test` en verde; U14 pasa; las fijas no muestran el botón; `UnknownView` no cambia.

## 10. Riesgos

| Riesgo | Prevención / recorte |
|---|---|
| Se olvida una llamada a `buildRanking` y se queda con la regla vieja | `today` es obligatorio: `tsc` falla. Hay tres llamadas fuera de `core` y de selfcheck (`App.tsx` ×2 y `PartyView`). |
| Arreglar asserts «a ojo» | Solo se migran los 8 asserts listados, con sus valores intactos. Si otro assert falla, se arregla el motor. |
| Mezclar paletas en el selector | Solo se usan las clases de `THEME[t.branch]`; nada de `app-*` dentro de la tarjeta. |
| Ruido de banners de adelantamiento | No cambia la detección de `App.add`. Con el prorrateo, los adelantamientos se reparten mejor a lo largo de la semana. Si molesta, se ajusta en otro ciclo. |
| Recorte si algo se complica | T2 puede quitar el `aria-live` y las líneas de resultado: el «Cuenta en» que ya existe muestra las aceptadas y `PartyView` las rechazadas. T1 no tiene recorte posible. |

## 11. Verificación

### Migración de asserts existentes (único cambio permitido; aprobado)

Antes de la línea 40 se añaden `const SUN = '2026-10-11'` y `const rk = (g: GameState) => buildRanking(g, PARTIES[0].members, 'hero', SUN)`. El helper `ps` (línea 77) pasa a tener un parámetro `today = DEMO_DATE` y se lo pasa a `derivePartyState`. Antes de la línea 85 se añaden `const [sgS, soS] = ps(SEED_EVENTS, TRACKERS, [], SUN)`, y antes de la línea 90 `const sg1S = ps(e1, TRACKERS, [], SUN)[0]`. Los valores esperados y los mensajes **no cambian**.

| Línea | Antes | Después |
|---|---|---|
| 40 | `buildRanking(g0)` | `rk(g0)` |
| 50 | `buildRanking(g1)` | `rk(g1)` |
| 51 | `overtakes(buildRanking(g1), buildRanking(g0))` y `overtakes(buildRanking(g0), buildRanking(g1))` | `overtakes(rk(g1), rk(g0))` y `overtakes(rk(g0), rk(g1))` |
| 85 | `so0.ranking`, `so0.position` | `soS.ranking`, `soS.position` |
| 86 | `sg0.ranking`, `sg0.position` | `sgS.ranking`, `sgS.position` |
| 87 | `buildRanking(sg0.game, gymP.members, 'villain')` | `buildRanking(sgS.game, gymP.members, 'villain', SUN)` |
| 88 | `buildRanking(so0.game, ofi.members, 'depth')` | `buildRanking(soS.game, ofi.members, 'depth', SUN)` |
| 90 | `sg1.ranking`, `sg1.game.weeklyHeroXp` | `sg1S.ranking`, `sg1S.game.weeklyHeroXp` |

Las líneas 39, 84 y 91 no se tocan (`sg0`, `so0`, `sg1` y `so1` siguen en `DEMO_DATE`). El domingo es 7/7, así que conservan sus valores, y el ejemplo no tiene eventos después del miércoles.

### Asserts nuevos (al final, después de G1–G4; se importan `rankScore` y el tipo `PartyMember`)

```ts
// K1–K5 — ranking prorrateado: amigos a ritmo lineal (lun 1/7 … dom 7/7)
const MON = '2026-10-12'
const fr = (r: PartyMember[], id: string) => r.find(m => m.id === id)!
const rkMon = buildRanking(g0, gymP.members, 'hero', MON)
ok(fr(rkMon, 'carlos').weeklyHeroXp === 74 && fr(rkMon, 'carlos').weeklyVillainXp === 4 && fr(sg0.ranking, 'carlos').weeklyHeroXp === 221 &&
  fr(rk(g0), 'carlos').weeklyHeroXp === 515 && gymP.members[0].weeklyHeroXp === 515, 'K1 prorrateo lun/mié/dom sin mutar PARTIES')
ok(ids(sg0.ranking) === 'you,carlos,alex,dani' && sg0.position === 1 && ids(so0.ranking) === 'you,lucia,marta,pablo' && so0.position === 1, 'K2 ranking HERO miércoles')
const depthO = buildRanking(so0.game, ofi.members, 'depth', DEMO_DATE)
ok(ids(buildRanking(sg0.game, gymP.members, 'villain', DEMO_DATE)) === 'dani,you,alex,carlos' && ids(depthO) === 'you,lucia,pablo,marta' &&
  rankScore(fr(depthO, 'pablo'), 'depth') === 102, 'K3 VILLAIN y profundidad miércoles (suma de campos redondeados)')
ok(ids(sg1.ranking) === 'you,carlos,alex,dani' && !overtakes(sg1.ranking, sg0.ranking).length, 'K4 +Gym miércoles: sin adelantamiento')
const rm = (n: number) => buildRanking(deriveGame(Array.from({ length: n }, (_, i) => ev('gym', 1, MON, `mon${i}`)), MON), gymP.members, 'hero', MON)
ok(ids(rm(2)) === 'carlos,you,alex,dani' && ids(rm(3)) === 'you,carlos,alex,dani' && overtakes(rm(3), rm(2)).join() === 'Carlos', 'K5 adelantamiento en lunes')
```

En K3, la profundidad de Pablo es 51 + 51 = 102; con un único `round` sobre 240 saldría 103.

### Tests de UI

- **U14 (P9.2):** se precarga en `CU` `{ trackers: [base, pizza], proposals: [{ trackerId: 'custom-pizza', partyId: 'la-oficina', proposedAt: '2026-10-06T09:00:00' }] }`, donde `pizza` es una custom VILLAIN de tipo `count`. Pasos:
  1. En HERO, `card('Gym')` no tiene botón `/^Proponer/`.
  2. Se pulsa `Proponer Meditar a una party`, se marca `La Oficina` y se pulsa `Proponer`.
  3. `CU.proposals` contiene `{ trackerId: 'custom-med', partyId: 'la-oficina' }`, y la tarjeta muestra `Aceptada en La Oficina · 3/3` y `Cuenta en: La Oficina`.
  4. Se abre de nuevo el panel: solo ofrece `Los del Gym`. Tras proponerla ahí, el botón desaparece.
  5. En VILLAIN, `card('Pizza…')` muestra `Rechazada en La Oficina · 1/3`, y el panel solo ofrece `Los del Gym`.
- **U15 (P9.3):** con la fecha falsa del 2026-10-07, «Cargar ejemplo» y luego `go('Party')`. Se comprueba que aparece `Amigos: su ritmo de la semana hasta hoy.`, que el primer `ol li` tiene `aria-current="true"` y que se ve `221 XP`.

### Checklist manual

- [ ] En dev aparece `[selfcheck] done` sin fallos en la consola.
- [ ] Party → VILLAIN y Profundidad cambian de orden según el día (se puede comprobar con la fecha del sistema o con el ejemplo).
- [ ] Al proponer desde una tarjeta VILLAIN, el panel queda en oscuro, sin blancos ni `app-*`, y los checkboxes se ven bien.
- [ ] Al recargar después de proponer, la línea «Aceptada/Rechazada en …» sigue ahí.
- [ ] En móvil (360 px), el panel y los botones no desbordan y los objetivos táctiles miden 44 px o más.

## 12. Handoff para Claude Code

1. Lee `docs/ESTADO-ACTUAL.md` y esta spec. Haz T1 y luego T2; cada una en su commit, y cada una deja `npm run build`, `npm run lint` y `npm test` en verde desde `app/`.
2. En T1, empieza por `party.ts` y deja que `tsc` te lleve a cada llamada. Migra los asserts **exactamente** como dice la tabla de §11 y no toques ningún otro. Si falla un assert que no está en la tabla, el error está en el motor.
3. En T2, no toques `core/` ni `UnknownView.tsx`. Usa solo las clases de `THEME[t.branch]`.
4. No añadas dependencias. No actualices `docs/ESTADO-ACTUAL.md` en este ciclo.
