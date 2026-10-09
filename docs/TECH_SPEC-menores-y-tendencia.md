# TECH SPEC — Menores del ciclo 13 y tendencia de 8 semanas (ciclo 16)

Fuente: `docs/cycles/cycle-16/proposals.md` (P16.3, P16.1) con los cambios de `docs/cycles/cycle-16/evaluation.md` y la decisión del usuario sobre la IA. Base: `main` con los ciclos 1-13 y 15. El lint usa `--deny-warnings`, así que no puede aparecer ningún warning nuevo.

## 1. Resumen

- **P16.3:** la IA solo funciona en `npm run dev`. `__AI_PROXY__` vale `command === 'serve' && !!key` y se quita el proxy de `preview`. Un build local con key ya no hace llamadas. Además se comenta `'__proto__'` en `KNOWN`, se añade una línea sobre `favicon.svg` en `DEPLOY.md` y se corrigen todos los textos que dicen «dev/preview».
- **P16.1:** función pura `weekly(events, t, today, n = 8)` en `stats.ts` con la misma regla que `streak`, y un `<details>` «Últimas 8 semanas» en `TrackerCard` con 8 barras CSS y una lista `sr-only`.
- **No entra:** P16.2 (va al ciclo 17), endpoint de IA (P13.4), activar el despliegue, librerías de gráficos, rangos configurables ni pantallas nuevas. No hay cambios de persistencia ni de reglas de juego.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| IA en preview | Desaparece (decisión del usuario). Así `vite preview` sirve exactamente el bundle publicable. |
| Vitest | Arranca como `serve`, así que `__AI_PROXY__` se comporta igual que hoy y los tests no cambian. |
| Regla de `weekly` | Es idéntica a `streak`: si no hay `t.weeklyGoal` actual, todas las semanas tienen `goal: null` (igual que el `return 0` de `streak`). La semana en curso usa `t.weeklyGoal` y las pasadas, `goalAt`. No se mira la rama, porque `streak` tampoco lo hace (VILLAIN nunca tiene `weeklyGoal`). |
| Semana en curso | `[lunes, today+1)`, igual que `streak`/`trackerStats`. Se marca con `current: true`. |
| Dónde se calcula | En `MissionsView`, igual que `history(...)`. No se añade a `TrackerStats`, para que `deriveGame` y las parties no lo calculen sin necesidad. |
| Escala de las barras | Alto = `total / max(totales, 1)`. Los totales ≤ 0 no tienen barra. Más simple que escalar respecto al objetivo. |
| Longitud de la tarjeta | Va dentro de `<details>` «Últimas 8 semanas», con el mismo patrón que «Últimos registros». Solo se muestra si alguna de las 8 semanas tiene total ≠ 0. |
| Accesibilidad | Las barras, iconos y leyenda llevan `aria-hidden`. Debajo va una `<ul className="sr-only">` con una frase por semana. |
| Señales sin depender del color | Las semanas cumplidas llevan un icono `Check` bajo la barra. La semana en curso usa borde discontinuo, sin relleno. Una leyenda visible lo explica. |
| Contraste | `bg-hero` (#285B70) sobre `hero-surface` (#FFF) da ≈ 7:1, y `bg-villain` (#B2A0CF) sobre `villain-surface` (#211E2A) ≈ 6,9:1. Las dos superan 3:1. Los bordes discontinuos usan los mismos tokens. |

## 3. Decisiones que requieren aprobación

Ninguna. La IA solo en `dev` ya la decidió el usuario. No hay dependencias nuevas ni cambios de reglas o de persistencia.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/vite.config.ts` | `({ command, mode })`, `__AI_PROXY__ = command === 'serve' && !!key`, se quita `preview: { proxy }` y se actualiza el `ponytail:`. |
| `app/src/core/classify.ts` | Comentario de `declare const __AI_PROXY__` (l. 64). |
| `app/src/core/storage.ts` | Comentario en `KNOWN` (l. 32). |
| `docs/DEPLOY.md`, `app/README.md`, `docs/ESTADO-ACTUAL.md`, `CLAUDE.md` | Textos de la IA y de `favicon` (detalle en T1). `AGENTS.md` no menciona el proxy, así que no se toca. |
| `app/src/core/types.ts` | Tipo `WeekRow`. |
| `app/src/core/stats.ts` | `weekly()` al final del archivo. |
| `app/src/core/selfcheck.ts` | Asserts W1–W3. |
| `app/src/components/MissionsView.tsx` | Pasa `weeks={weekly(events, s.tracker, today)}`. |
| `app/src/components/TrackerCard.tsx` | Prop `weeks`, bloque «Últimas 8 semanas» y dos claves en `THEME`. |
| `app/src/App.test.tsx` | Test U-W1. |

## 5. Modelos de datos

```ts
// types.ts
export type WeekRow = {
  monday: string        // YYYY-MM-DD, lunes de la semana
  total: number         // neto de la semana; la en curso, hasta today incluido
  goal: number | null   // objetivo vigente (en curso: t.weeklyGoal; pasadas: goalAt); null sin objetivo actual
  met: boolean          // goal !== null && total >= goal
  current: boolean      // true solo en la última fila
}
```

No se persiste nada nuevo.

## 6. Persistencia y migración

Sin cambios. `weekly` es derivado y nunca se guarda. Las claves `life-rpg-demo-v1` y `life-rpg-custom-v1` quedan igual.

## 7. Lógica de dominio

```ts
// stats.ts, al final. Misma regla que streak: sin objetivo actual no hay semanas cumplidas.
// ponytail: 8 sumas sobre los eventos del tracker por tarjeta y render; indexar por semana si se nota.
export function weekly(events: ActivityEvent[], t: Tracker, today: string, n = 8): WeekRow[] {
  const own = events.filter(e => e.trackerId === t.id)
  const cur = mondayOf(today)
  return Array.from({ length: n }, (_, i) => {
    const monday = addDays(cur, -7 * (n - 1 - i))
    const current = i === n - 1
    const tot = total(own, t.id, monday, current ? addDays(today, 1) : addDays(monday, 7))
    const goal = t.weeklyGoal ? (current ? t.weeklyGoal : goalAt(t, monday)) || null : null
    return { monday, total: tot, goal, met: goal !== null && tot >= goal, current }
  })
}
```

- El orden es ascendente: la fila 0 es la más antigua y la 7 la semana en curso.
- Coherencia con `streak`: las semanas anteriores al primer evento suman 0, así que no se cumplen, igual que el corte de `streak` en `first`. Un `goalAt` igual a `null` o `undefined` se convierte en `goal: null` y deja `met: false`, igual que el `break` de `streak`.

## 8. UI

`TrackerCard`. Prop nueva `weeks: WeekRow[]`. El bloque va justo antes del `<details>` «Últimos registros» y se renderiza solo si `weeks.some(w => w.total !== 0)`.

```tsx
<details className={`text-xs leading-5 ${c.muted}`}>
  <summary className="min-h-11 cursor-pointer py-3">Últimas 8 semanas</summary>
  <div aria-hidden className={`flex h-16 items-end gap-1 border-b ${c.chip}`}>
    {weeks.map(w => <div key={w.monday} className="flex h-full flex-1 items-end">
      <div className={`w-full rounded-t ${w.current ? `min-h-1 border-2 border-dashed ${c.barNow}` : c.bar}`}
        style={{ height: `${w.total > 0 ? (w.total / max) * 100 : 0}%` }} />
    </div>)}
  </div>
  <div aria-hidden className="flex gap-1">{weeks.map(w => <span key={w.monday} className="flex h-4 flex-1 justify-center">{w.met && <Check className="size-3" />}</span>)}</div>
  <p aria-hidden className="flex flex-wrap items-center gap-1"><Check className="size-3" /> objetivo cumplido · borde discontinuo: semana en curso</p>
  <ul className="sr-only">{weeks.map(w => <li key={w.monday}>{weekText(w, t.unit)}</li>)}</ul>
</details>
```

- `max = Math.max(1, ...weeks.map(w => w.total))`.
- `THEME`:
  - hero: `bar: 'bg-hero'`, `barNow: 'border-hero'`.
  - villain: `bar: 'bg-villain'`, `barNow: 'border-villain'`.
  - Son clases literales, sin hex.
  - La semana en curso lleva `min-h-1`, para que su borde discontinuo se vea aunque vaya a 0.
- `weekText` es una función local del componente:
  - Fecha: `new Date(monday + 'T00:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })`.
  - Formato: `Semana del {fecha}{current ? ' (en curso)' : ''}: {goal ? `${total} de ${goal} ${unit}` : `${total} ${unit}`}{met ? ', cumplida' : goal && !current ? ', no cumplida' : ''}`.
  - Ejemplo: «Semana del 28 sept: 4 de 4 sesiones, cumplida».
  - La semana en curso sin cumplir no dice «no cumplida».
- 390 px: 8 columnas `flex-1` con `gap-1` caben en el ancho de la tarjeta (≈ 300 px útiles). No hay textos por columna.
- Estados:
  - Sin registros en 8 semanas: no se muestra el bloque.
  - VILLAIN o sin objetivo: barras sin `Check` y frases sin «de N».
  - No hay carga ni errores posibles, porque todo es derivado.

## 9. Backlog

### T1 — P16.3: IA solo en `dev` y menores del ciclo 13
- **Objetivo:** un build nunca llama a `/api/claude`, y se cierran los menores 2 y 3.
- **`app/vite.config.ts`:**
  - `defineConfig(({ command, mode }) => …)`.
  - `define: { __AI_PROXY__: JSON.stringify(command === 'serve' && !!key) }`.
  - `server: { proxy }` sin `preview`.
  - Nuevo `ponytail:`: «IA solo en `npm run dev` y con key; un build (también `vite preview`) usa la heurística sin llamar. Endpoint real: P13.4.»
- **`classify.ts:64`:** el comentario pasa a «true solo en `npm run dev` con ANTHROPIC_API_KEY; en cualquier build, false».
- **`storage.ts:32`:** comentario encima de `KNOWN`: `'__proto__'` no es un campo. Está para que el bucle de claves desconocidas no haga `data['__proto__'] = x`, que cambiaría el prototipo.
- **`docs/DEPLOY.md:10`:** se sustituye por «Un `npm run build` nunca usa la IA, aunque exista `app/.env.local`: `__AI_PROXY__` solo es `true` en `npm run dev`. `npm run preview` sirve ese mismo build, sin IA.». En «Antes de elegir» se añade «`index.html` enlaza `/favicon.svg`; Vite lo reescribe con `base` al hacer el build, no hay que tocarlo.». La frase «Publica siempre el build del hosting, no uno local» de la l. 9 se mantiene.
- **`app/README.md:12`:** «solo `dev`/`preview`» pasa a «solo `npm run dev`».
- **`docs/ESTADO-ACTUAL.md`:**
  - l. 54: «solo en `dev`/`preview`» pasa a «solo en `npm run dev`», y «es `true` solo con key» pasa a «es `true` solo en `dev` con key; en cualquier build es `false`».
  - l. 67: se quita «Un `npm run build` local con key genera `__AI_PROXY__ = true`: no publicar ese build.».
- **`CLAUDE.md:28`:** «vía el proxy de Vite `/api/claude`» pasa a «vía el proxy de Vite `/api/claude`, solo en `npm run dev`», y «sin key (`__AI_PROXY__` false, p. ej. build de hosting)» pasa a «sin key o en cualquier build (`__AI_PROXY__` false)». `AGENTS.md` y `.codex/` no lo mencionan, así que no cambian.
- **Dependencias:** ninguna.
- **Aceptación:**
  - Con `app/.env.local` presente: `npm run build && npm run preview`, y en «Nuevo» no hay ninguna petición a `/api/claude` en Network.
  - `npm run dev` con key sigue usando la IA.
  - `build`, `lint` y `test` en verde.

### T2 — `weekly()` y asserts
- **Objetivo:** función pura que devuelve las últimas 8 semanas.
- **Archivos:** `types.ts` (`WeekRow`), `stats.ts` (`weekly`, §7, al final del archivo, sin tocar `todaySummary` ni `streak`) y `selfcheck.ts` (W1–W3, §11).
- **Dependencias:** ninguna.
- **Aceptación:**
  - W1–W3 pasan y los asserts existentes no se tocan.
  - `build`, `lint` y `test` en verde, con `[selfcheck] done` en dev.

### T3 — Tendencia en la tarjeta
- **Objetivo:** mostrar las 8 semanas en HERO y VILLAIN.
- **Archivos:**
  - `TrackerCard.tsx`: prop `weeks`, `THEME.bar/barNow`, bloque §8 y `weekText`.
  - `MissionsView.tsx`: `weeks={weekly(events, s.tracker, today)}` junto a `history=`.
  - `App.test.tsx`: U-W1.
- **Dependencias:** T2.
- **Aceptación:**
  - U-W1 y `a11y.test.tsx` (axe) pasan.
  - Sin hex ni `slate-*`.
  - Checklist manual §11.

## 10. Riesgos

- **El texto de la fecha depende del ICU** («sept» frente a «sep»). Prevención: el test usa una regex sin el mes exacto.
- **La lista `sr-only` dentro de un `<details>` cerrado no se lee hasta abrirlo.** Es el mismo comportamiento que «Últimos registros» y es aceptable. Si molesta, se saca la `<ul>` fuera del `<details>`.
- **Un warning nuevo de oxlint** (p. ej. `jsx-key` o variables sin usar) rompería el lint. Prevención: `npm run lint` en cada tarea.
- **Recorte si se complica:** se quita la leyenda visible. El `Check`, el borde discontinuo y la lista `sr-only` son obligatorios.

## 11. Verificación

Asserts nuevos en `selfcheck.ts`, después de GL6. Hay que añadir `total` y `weekly` al import de `./stats` y el tipo `WeekRow` al de `./types`. Se usan `s2`, `s2b`, `s3`, `s6`, `G`, `ev` y `DEMO_DATE` (2026-10-07, miércoles).

```ts
// W1–W3 — tendencia semanal coherente con streak y total
const run = (w: WeekRow[]) => { let n = 0; for (let i = w.length - 2; i >= 0 && w[i].met; i--) n++; return n + (w[w.length - 1].met ? 1 : 0) }
const wc: [ActivityEvent[], Tracker][] = [[s2, G], [s2b, G], [s3, G], [[...s3, ev('gym', 1, '2026-09-26', 'wk-fix')], G], [s6, G], [SEED_EVENTS, G], [SEED_EVENTS, TRACKERS[4]],
  [s3, { ...G, weeklyGoal: 3 }], [s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: 4, until: '2026-10-05' }] }],
  [s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] }], [s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] }]]
ok(wc.every(([e, t]) => run(weekly(e, t, DEMO_DATE)) === streak(e, t, DEMO_DATE)), 'W1 weekly coherente con streak')
const w2 = weekly(s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] }, DEMO_DATE)
const w3 = weekly(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] }, DEMO_DATE)
ok(w2.map(r => `${r.total}/${r.goal}/${+r.met}`).join() === '0/3/0,0/3/0,0/3/0,0/3/0,4/3/1,3/3/1,4/3/1,0/5/0'
  && w2[0].monday === '2026-08-17' && w2[7].monday === '2026-10-05' && w2.filter(r => r.current).length === 1 && w2[7].current
  && w3.map(r => `${r.goal}/${+r.met}`).slice(4).join() === 'null/0,null/0,3/1,3/0'
  && weekly(SEED_EVENTS, TRACKERS[4], DEMO_DATE).every(r => r.goal === null && !r.met), 'W2 objetivos por semana a mano')
ok(TRACKERS.every(t => weekly(SEED_EVENTS, t, DEMO_DATE).reduce((s, r) => s + r.total, 0) === total(SEED_EVENTS, t.id, '2026-08-17', addDays(DEMO_DATE, 1))), 'W3 suma = total del rango')
```

W1 incluye los casos de S2–S6 y GL1–GL3, así que hereda sus valores esperados. Si W1–W3 fallan, se arregla `weekly`, no los asserts.

**U-W1** (`App.test.tsx`):

```ts
test('U-W1 tendencia semanal', () => {
  streakEvents(); render(<App />); go('HERO')
  expect(card('Gym').getByText('Últimas 8 semanas')).toBeTruthy()
  expect(card('Gym').getByText(/^Semana del 28 sep.*: 4 de 4 sesiones, cumplida$/)).toBeTruthy()
  expect(card('Gym').getByText(/^Semana del 5 oct.* \(en curso\): 2 de 4 sesiones$/)).toBeTruthy()
})
```

No lee localStorage. Si más adelante un test de la tendencia lee localStorage tras una acción, se espera con `vi.waitFor`.

**Checklist manual** (`npm run dev`, «Cargar ejemplo»):
- [ ] HERO, Gym: se abre «Últimas 8 semanas», hay 8 barras, la última tiene borde discontinuo y las cumplidas llevan `Check`.
- [ ] VILLAIN, Beer: barras lilas sobre fondo oscuro, sin `Check`, legibles.
- [ ] Una actividad nueva sin registros no muestra el bloque. Al registrar algo, aparece.
- [ ] Cambiar el objetivo de Gym no cambia los `Check` de las semanas pasadas (`goalAt`).
- [ ] A 390 px (DevTools) no hay desbordamiento horizontal.
- [ ] Con un lector de pantalla y el `<details>` abierto, se leen las 8 frases y no las barras.
- [ ] T1: `npm run build && npm run preview` con `.env.local` → en «Nuevo», cero peticiones a `/api/claude`.

## 12. Handoff para Claude Code

1. La rama sale de `main` (ya incluye el ciclo 15). El orden es T1 → T2 → T3, con un commit por tarea.
2. Cada tarea termina con `npm run build`, `npm run lint` (sin warnings) y `npm test` en verde desde `app/`.
3. T2: `weekly` se añade al final de `stats.ts` sin modificar `streak`, `goalAt` ni `todaySummary`. Los asserts S*/GL*/H* no se tocan.
4. T3: solo tokens de `@theme` mediante clases literales en `THEME`, sin hex. El componente sigue siendo presentacional: recibe `weeks` ya calculado.
5. No hay tarea general de actualizar `ESTADO-ACTUAL.md`. Las únicas ediciones de ese archivo son las de T1.
