# TECH_SPEC — HERO contra VILLAIN semana a semana (ciclo 17: P16.2 + P18.2)

## 1. Resumen

- **P16.2:** la home gana un bloque «Últimas semanas» con la XP neta de cada rama en las 8 últimas semanas (barras pareadas HERO/VILLAIN y una lista accesible). Incluye los cambios de `cycle-16/evaluation.md`: sin la línea «Esta semana» (repetiría `HomeView.tsx:82`), la suma por rama va en `core/` con su assert y se reutilizan `weekly()` y el patrón de barras accesibles de `TrackerCard`.
- **P18.2:** los `aria-label` de «Deshacer» (home y tarjeta) usan el singular cuando la cantidad es 1 («Deshacer +1 sesión en Gym»).
- **No entra:** cambios en `deriveGame`, umbrales, XP o niveles; comparativa con la party; rangos configurables; textos visibles «+1 sesiones» (botón principal, «Registrado hoy», historial) ni el `aria-label` de «Restar»; i18n.
- Sin dependencias nuevas, sin cambios de persistencia ni de reglas.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Suma por rama | `branchWeekly(events, trackers, today, n = 8)` en `stats.ts`, que suma `weekly()` × `xpPerUnit` de cada tracker | Lo pide la evaluación. Reutiliza la definición de semana de P16.1 sin duplicarla. |
| Archivadas | Cuentan. Se pasa `trackers` de `App.tsx` (`allTrackers(custom.trackers, …)` ya las incluye) | Es la misma regla que la XP de `deriveGame`. |
| Dónde se calcula | `useMemo` en `App.tsx`, que pasa la prop `weeks` a `HomeView` | `HomeView` no recibe `events`. La lógica queda en `core/`. |
| Línea «Esta semana» | No se añade | Repite `weekXp` del botón de rama (evaluación). |
| Color de las barras | HERO `bg-hero`; VILLAIN `bg-villain-bg` (no `bg-villain`) | `villain` (#B2A0CF) sobre `app-surface` da unos 2,2:1 y no llega a 3:1. `villain-bg` ya se usa en la home neutra (`PlayerHeader`, barra de distribución). |
| Semana en curso | Borde discontinuo (`border-2 border-dashed`), como en `TrackerCard`, y «(en curso)» en el texto accesible | Mismo patrón que el ciclo 16. Así una semana a medias no parece peor. |
| Valores negativos (datos importados) | La barra se recorta a 0 (`Math.max(0, v)`) y el texto muestra el valor real | `clampAmount` lo impide en el uso normal, pero no hay que romper con datos raros. |
| Visibilidad | El bloque solo aparece si alguna semana tiene XP distinta de 0 | Igual que la tendencia de la tarjeta. Un usuario nuevo no ve un gráfico vacío. |
| Formato de fecha | Se extrae `shortDate(d)` a `stats.ts` (junto a `dayLabel`) y lo usan `TrackerCard.weekText` y la home | Así no se duplica `toLocaleDateString`. El texto de la tarjeta no cambia. |
| Singular (P18.2) | `unitFor(n, unit)` en `trackers.ts` con un `Map` `sesiones→sesión`, `clases→clase`, `unidades→unidad`. Cualquier otra unidad (km, min y las propias) se deja igual | Es la forma que ya usa la app en `buttonLabel` de las fijas («+1 sesión», «+1 clase»). Con `Map` en lugar de un objeto literal, una unidad propia llamada `constructor` o `__proto__` no devuelve un prototipo. |
| Alcance de P18.2 | Solo los dos `aria-label` de «Deshacer» | Es lo que pide el encargo. El resto de textos «+1 sesiones» queda fuera (ver §1). |

## 3. Decisiones que requieren aprobación

Ninguna.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | Nuevo tipo `BranchWeek`. |
| `app/src/core/stats.ts` | Nuevas `branchWeekly()` y `shortDate()`. Las funciones existentes no cambian. |
| `app/src/core/trackers.ts` | Nueva `unitFor()`. |
| `app/src/core/selfcheck.ts` | Asserts `BW1–BW3` y `P1`. |
| `app/src/App.tsx` | `useMemo` de `branchWeekly` y prop `weeks` a `HomeView`. |
| `app/src/components/HomeView.tsx` | Bloque «Últimas semanas». `unitFor` en el `aria-label` de «Deshacer». |
| `app/src/components/TrackerCard.tsx` | `unitFor` en el `aria-label` de «Deshacer». `weekText` usa `shortDate`. |
| `app/src/App.test.tsx` | Se ajustan U4 y U23 al singular y se añade `U-HV1`. |

## 5. Modelos de datos

```ts
// types.ts
export type BranchWeek = {
  monday: string    // YYYY-MM-DD
  hero: number      // XP neta de la semana (en curso: hasta today incluido)
  villain: number
  current: boolean  // solo la última
}
```

No cambia ningún tipo persistido.

## 6. Persistencia y migración

No hay cambios: no se guarda nada nuevo y todo se deriva de `ActivityEvent[]`. Los datos existentes funcionan tal cual.

## 7. Lógica de dominio

```ts
// stats.ts — al final, después de weekly()
// XP neta por rama y semana; archivadas incluidas (misma regla que deriveGame). Eventos de trackers desconocidos: ignorados.
// ponytail: weekly() por tracker filtra todos los eventos cada vez (O(trackers·eventos)); indexar por trackerId si se nota.
export function branchWeekly(events: ActivityEvent[], trackers: Tracker[], today: string, n = 8): BranchWeek[] {
  const cur = mondayOf(today)
  const out: BranchWeek[] = Array.from({ length: n }, (_, i) => ({ monday: addDays(cur, -7 * (n - 1 - i)), hero: 0, villain: 0, current: i === n - 1 }))
  for (const t of trackers) weekly(events, t, today, n).forEach((w, i) => { out[i][t.branch] += w.total * t.xpPerUnit })
  return out
}

// «28 sept»; mismo formato que tenía TrackerCard.weekText
export const shortDate = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
```

```ts
// trackers.ts
// ponytail: singular solo para las unidades de las fijas y por defecto; las unidades propias se quedan como están. Ampliar el Map si hace falta.
const SINGULAR = new Map([['sesiones', 'sesión'], ['clases', 'clase'], ['unidades', 'unidad']])
export const unitFor = (n: number, unit: string) => (Math.abs(n) === 1 ? SINGULAR.get(unit) ?? unit : unit)
```

Reglas:
- Ninguna función existente cambia. Los asserts actuales no se tocan.
- La semana en curso de `branchWeekly` es, por construcción, `weeklyXp(game, b)` con el mismo `today` (`week` = total desde el lunes hasta hoy incluido).

## 8. UI

**Home, bloque «Últimas semanas»** (`HomeView`, nueva prop `weeks: BranchWeek[]`):
- Ubicación: el `<div className="rise">` que envuelve `PlayerHeader` pasa a ser `rise flex flex-col gap-6` y contiene `PlayerHeader` y, debajo, la nueva sección. Así la rejilla `lg:grid-cols-2` sigue igual.
- Solo se renderiza si `weeks.some(w => w.hero !== 0 || w.villain !== 0)`.
- Estructura (tokens `app-*`, la misma tarjeta que «Tus datos»):
  - `<section aria-labelledby="ultimas-semanas" className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-5">`
  - `<h2 id="ultimas-semanas" className="text-lg font-semibold">Últimas semanas</h2>` y `<p className="text-xs leading-5 text-app-muted">XP neta por semana</p>`.
  - Gráfico `aria-hidden`: `flex h-24 items-end gap-2 border-b border-app-border`. Por semana, una columna `flex h-full flex-1 items-end gap-0.5` con dos barras `flex-1 rounded-t` (HERO a la izquierda y VILLAIN a la derecha). Altura `${Math.max(0, v) / max * 100}%` con `max = Math.max(1, ...weeks.flatMap(w => [w.hero, w.villain]))`. Barra normal `bg-hero` / `bg-villain-bg`. Semana en curso `min-h-1 border-2 border-dashed border-hero` / `border-villain-bg`, sin relleno. Usar clases literales en un objeto `{ hero: …, villain: … }` para que Tailwind las detecte.
  - Leyenda `aria-hidden`, `flex flex-wrap items-center gap-2 text-xs text-app-muted`: muestra `size-3 rounded-sm bg-hero` «HERO» · muestra `bg-villain-bg` «VILLAIN» · «borde discontinuo: semana en curso».
  - `<ul className="sr-only">`, con un `li` por semana: `Semana del ${shortDate(w.monday)}${w.current ? ' (en curso)' : ''}: HERO ${w.hero} XP, VILLAIN ${w.villain} XP`.
- Estados: sin XP no hay bloque (el estado vacío de bienvenida ya existe). No hay estados de carga ni de error, porque es una derivación síncrona.
- Comprobar que cabe en 390 px (8 columnas × 2 barras con `gap-2`, unos 15 px por barra) y que no hay scroll horizontal.

**«Deshacer», solo el `aria-label`:**
- `HomeView.tsx:136`: `` `Deshacer +${u.amount} ${unitFor(u.amount, d.tracker.unit)} en ${d.tracker.name}` ``
- `TrackerCard.tsx:243`: `` `Deshacer ${e.amount} ${unitFor(e.amount, t.unit)} de ${day}` ``

## 9. Backlog

**T1 — Singular en «Deshacer» (P18.2)**
- Archivos: `core/trackers.ts`, `core/selfcheck.ts`, `components/HomeView.tsx`, `components/TrackerCard.tsx`, `App.test.tsx`.
- Qué: `unitFor` (§7), assert `P1` (§11) y los dos `aria-label` (§8). En los tests, U4 pasa a `'Deshacer 1 sesión de Hoy'` y U23 (`undoBtn`) a `'Deshacer +1 sesión en Gym'`.
- Depende de: —
- Aceptación: `P1` pasa. U4 y U23 pasan con el singular. Los textos visibles no cambian (U1–U3 siguen pasando sin tocarlos).

**T2 — `branchWeekly` en `core/`**
- Archivos: `core/types.ts`, `core/stats.ts`, `core/selfcheck.ts`.
- Qué: el tipo `BranchWeek`, `branchWeekly()` y `shortDate()` (§7) y los asserts `BW1–BW3` (§11). Por ahora `TrackerCard` no se toca (T3).
- Depende de: —
- Aceptación: `BW1–BW3` pasan y los asserts existentes (incl. W1–W3) siguen igual.

**T3 — Bloque «Últimas semanas» en la home**
- Archivos: `App.tsx`, `components/HomeView.tsx`, `components/TrackerCard.tsx`, `App.test.tsx`.
- Qué: `const weeks = useMemo(() => branchWeekly(events, trackers, today), [events, trackers, today])` en `App.tsx` y la prop a `HomeView`. La sección de §8. `TrackerCard.weekText` pasa a usar `shortDate` (sin cambio de texto). Test `U-HV1` (§11).
- Depende de: T2.
- Aceptación: U-W1 sigue pasando sin cambios. U-HV1 pasa. axe (`a11y.test.tsx`) sin violaciones. Checklist manual de §11.

Cada tarea se cierra con `npm run build`, `npm run lint` (con `--deny-warnings`, sin `oxlint-disable` nuevos) y `npm test` en verde desde `app/`, y con `[selfcheck] done` sin fallos en dev.

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| La home se alarga demasiado en el móvil | `h-24`, un solo bloque, sin texto adicional | Meter el gráfico en `<details>` «Últimas semanas», con el mismo patrón que la tarjeta. |
| Contraste de VILLAIN | Se usa `bg-villain-bg` (no `bg-villain`) | — |
| Tailwind no genera las clases de borde o fondo | Clases literales en un objeto por rama | — |
| Coste por render (6–10 trackers × 8 semanas) | `useMemo` en `App.tsx` | El `ponytail:` de §7 indica cómo crecer. |
| Tests que dependen de textos | Solo U4 y U23 cambian, y lo hacen de forma explícita | — |

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`** (no se modifica ninguno existente; importar `weeklyXp`, `branchWeekly` y `unitFor`):

```ts
// P1 — singular coherente con los buttonLabel de las fijas
ok(unitFor(1, 'sesiones') === 'sesión' && unitFor(-1, 'clases') === 'clase' && unitFor(1, 'unidades') === 'unidad'
  && unitFor(2, 'sesiones') === 'sesiones' && unitFor(1, 'km') === 'km' && unitFor(1, 'páginas') === 'páginas' && unitFor(1, 'constructor') === 'constructor'
  && TRACKERS.filter(t => t.increment === 1 && t.unit !== 'unidades').every(t => t.buttonLabel === `+1 ${unitFor(1, t.unit)}`), 'P1 unitFor')

// BW1–BW3 — XP por rama y semana (después de E1–E5: usa g0, em, med y pizza, que ya existen)
const bw = branchWeekly(SEED_EVENTS, TRACKERS, DEMO_DATE)
ok(bw.length === 8 && bw[0].monday === '2026-08-17' && bw[7].current && bw.filter(r => r.current).length === 1
  && bw[7].hero === g0.weeklyHeroXp && bw[7].villain === weeklyXp(g0, 'villain'), 'BW1 semana en curso = XP semanal')
ok((['hero', 'villain'] as const).every(b => bw.reduce((s, r) => s + r[b], 0) ===
  TRACKERS.filter(t => t.branch === b).reduce((s, t) => s + total(SEED_EVENTS, t.id, '2026-08-17', addDays(DEMO_DATE, 1)) * t.xpPerUnit, 0)), 'BW2 suma = XP del rango')
// em = semilla + 1 registro de med (20 XP) hoy; archivada o no, cuenta igual
const bwa = (archived: boolean) => branchWeekly(em, allTrackers([archived ? { ...med, archived: true } : med, pizza]), DEMO_DATE)
ok(JSON.stringify(bwa(true)) === JSON.stringify(bwa(false)) && bwa(true)[7].hero === bw[7].hero + 20, 'BW3 archivadas cuentan')
```

**Test de UI `U-HV1`** (`App.test.tsx`):

```ts
test('U-HV1 HERO contra VILLAIN en la home', () => {
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Últimas semanas' })).toBeNull() // usuario nuevo
  cleanup(); streakEvents(); render(<App />)
  expect(screen.getByRole('heading', { name: 'Últimas semanas' })).toBeTruthy()
  expect(screen.getByText(/^Semana del 28 sep.*: HERO 120 XP, VILLAIN 0 XP$/)).toBeTruthy()
  expect(screen.getByText(/^Semana del 5 oct.* \(en curso\): HERO 60 XP, VILLAIN 0 XP$/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '+1 sesión en Gym' }))
  expect(screen.getByText(/\(en curso\): HERO 90 XP, VILLAIN 0 XP$/)).toBeTruthy()
})
```

Si se amplía para leer localStorage después de una acción, hay que esperar con `vi.waitFor` (el guardado va en un efecto).

**Checklist manual** (`npm run dev`):
- [ ] Usuario nuevo: no aparece «Últimas semanas». Con «Cargar ejemplo» sí aparece, con barras de las dos ramas.
- [ ] La semana en curso se ve con borde discontinuo en las dos ramas. Registrar desde «Hoy» hace crecer la barra al momento.
- [ ] 390 px: sin scroll horizontal y las 16 barras se distinguen. En `lg`, la sección queda bajo `PlayerHeader`, en la columna izquierda.
- [ ] Al archivar una custom con registros, las barras no cambian.
- [ ] Recargar: el bloque es igual (es una derivación, no se guarda nada).
- [ ] Lector de pantalla: «Deshacer» de la home dice «+1 sesión», el de la tarjeta dice «1 sesión de Hoy» y la lista de semanas se lee.

## 12. Handoff para Claude Code

1. Rama `cycle-17` desde `main`. Orden T1 → T2 → T3, un commit por tarea.
2. No toques `deriveGame`, `weekly`, `streak` ni los asserts existentes. Si un assert existente falla, el fallo está en tu cambio.
3. Copia el patrón de barras de `TrackerCard.tsx:214-226` (gráfico `aria-hidden` + `ul.sr-only`), pero con tokens `app-*` y `bg-villain-bg` para VILLAIN.
4. Sin dependencias nuevas, sin `oxlint-disable` nuevos, sin hex ni `slate-*`.
5. Antes de cerrar cada tarea: `npm run build`, `npm run lint` y `npm test` desde `app/`, y `[selfcheck] done` limpio en dev.
