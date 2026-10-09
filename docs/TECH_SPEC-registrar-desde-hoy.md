# TECH SPEC — Registrar desde «Te faltan» (P11.4, ciclo 12)

Fuente: `docs/cycles/cycle-11/proposals.md` (P11.4) con los cambios de `docs/cycles/cycle-11/evaluation.md`.

## 1. Resumen

Cada fila de «Te faltan», en el bloque «Hoy» de la home, tiene un botón «+» hermano del botón actual «ir a la rama». Ese botón registra `t.increment` **hoy** con el `add` que ya existe. Además, «Te faltan» deja de llevar siempre a `'hero'` y cada fila lleva a `t.branch`.
**No incluye** selector de día, corrección ni deshacer desde la home, registrar actividades sin objetivo, XP flotante en la home, reordenar la home ni cambios en `core/`, en las reglas o en la persistencia.

## 2. Decisiones técnicas

| Tema | Decisión |
|---|---|
| Estructura de la fila | `<li class="flex">` con dos `<button>` hermanos: navegación (el actual, `flex-1`) y «+». No se pueden anidar botones. |
| Qué filas lo llevan | Solo `summary.missing` («Te faltan»). «Registrado hoy» sigue igual, con un solo botón de navegación. |
| Llamada | `onAdd(t)` → `App` hace `add(t, t.increment)`. `day` toma por defecto `today` (`App.tsx:93`) y no se pasa día desde la home. |
| Texto visible | `t.buttonLabel` (p. ej. «+1 sesión», «+5 km», «+1»), el mismo que en otros puntos de la app (`UnknownView`). |
| Nombre accesible | `aria-label={`${t.buttonLabel} en ${t.name}`}` → «+1 sesión en Gym». Se usa `buttonLabel` y no `unit` porque `unit` va en plural (evaluación). |
| Feedback | Solo lo global que ya existe: toast de level-up, banners de adelantamiento (`App.tsx:211-212`) y región `role="status"` (`App.tsx:214`), más la actualización del propio bloque «Hoy» (línea de XP neta, «Registrado hoy», cantidad restante). No se añade XP flotante en la home. `add` sigue llamando a `setGain`: en la home no se pinta y se limpia a los 900 ms. Es inocuo. |
| Foco al cumplir | Si el registro completa el objetivo (`m.left <= t.increment`), la fila desaparece y el foco se perdería. En ese caso se enfoca el `<h2 id="hoy">`, con `tabIndex={-1}`. Es lo mínimo para no dejar el foco en `body`. |
| Navegación de «Te faltan» | `onGo={onNavigate}` (`TodayList` ya llama a `onGo(t.branch)`). Hoy no hay VILLAIN en `missing`, así que el fallo está latente. P11.2 lo necesitará. |
| Paleta | Neutra `app-*`, la misma que la fila (el bloque «Hoy» mezcla ramas). |
| Guardado fallido | Sin cambios: `SaveFailBanner` ya se muestra en la home y el aviso sale por la región `role="status"`. |

## 3. Decisiones que requieren aprobación

Ninguna. No hay dependencias nuevas, ni cambios de reglas, de esquema ni de atajos de la demo.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/components/HomeView.tsx` | Prop nueva `onAdd: (t: Tracker) => void`. `TodayList` acepta `onAdd?` opcional: si lo recibe, pinta el botón «+» hermano. «Te faltan» pasa `onGo={onNavigate}` y `onAdd`. Al `<h2 id="hoy">` se le añade `tabIndex={-1}` y una ref para el foco. |
| `app/src/App.tsx` | Pasa `onAdd={t => add(t, t.increment)}` a `HomeView`. |
| `app/src/App.test.tsx` | Tests U21 y U22 (§11). |

`core/`, `storage.ts`, `selfcheck.ts` y los tipos no cambian.

## 5. Modelos de datos

Sin cambios. Solo cambian las props de componentes:

```ts
// HomeView Props
onAdd: (t: Tracker) => void
// TodayList
{ rows: { t: Tracker; text: string; left?: number }[]; onGo: (s: Screen) => void; onAdd?: (t: Tracker, left: number) => void }
```

(`left` solo llega en las filas de «Te faltan» y sirve para decidir el foco.)

## 6. Persistencia y migración

Sin cambios. El registro es un `ActivityEvent` normal creado por `add`. Lo guarda el efecto de `App.tsx:58` y no hay que migrar nada.

## 7. Lógica de dominio

No se añade lógica de dominio. Reglas que se reutilizan tal cual:
- `add(t, t.increment)`: fecha `nowStamp(today)`, level-up/down con `diffLevelUps`, adelantamientos en party.
- `todaySummary` se recalcula en el render: `left` baja en `t.increment`, y si `week >= weeklyGoal` la fila sale de «Te faltan». El tracker aparece en «Registrado hoy» y la línea de XP neta se actualiza.

## 8. UI

Fila de «Te faltan» (solo cuando `TodayList` recibe `onAdd`):

```tsx
<li key={t.id} className="flex items-stretch">
  <button type="button" onClick={() => onGo(t.branch)} className="flex min-h-11 flex-1 items-center gap-3 px-3 text-left …(clases actuales)">
    …nombre, texto, ChevronRight (sin cambios)
  </button>
  {onAdd && (
    <button type="button" onClick={() => onAdd(t, left!)} aria-label={`${t.buttonLabel} en ${t.name}`}
      className="m-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-app-border px-3 text-sm font-semibold tabular-nums text-app-text hover:bg-app-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-text">
      {t.buttonLabel}
    </button>
  )}
</li>
```

Handler en `HomeView`: `(t, left) => { onAdd(t); if (left <= t.increment) hoyRef.current?.focus() }`.

Estados de la pantalla:
- Sin objetivos pendientes: el bloque «Te faltan» no aparece, igual que ahora.
- Objetivo cumplido con este registro: la fila desaparece y el foco pasa a «Hoy».
- Level-up: aparece el toast global.
- Fallo al guardar: aparece el banner que ya existe.

Accesibilidad: el botón de navegación conserva su nombre («Gym 4 sesiones»), así que U11 no cambia. El «+» tiene nombre propio y un área táctil mínima de 44 px.

## 9. Backlog

**T1 — Botón «+» en «Te faltan» y destino por rama**
- Objetivo: registrar hoy desde la home y que cada fila lleve a su rama.
- Archivos: `HomeView.tsx`, `App.tsx`.
- Funcionalidad: lo descrito en §4, §5 y §8. «Registrado hoy» no recibe `onAdd`.
- Dependencias: ninguna.
- Aceptación: en la home, «+1 sesión en Gym» crea un evento `{ trackerId: 'gym', amount: 1 }` con fecha de hoy. La fila pasa a «Gym 3 sesiones» y aparece «+30 HERO». Al cumplir el objetivo, la fila desaparece y el foco queda en «Hoy». La fila de navegación sigue llevando a «Misiones HERO». `build`, `lint` y `test` en verde.

**T2 — Tests de UI**
- Objetivo: cubrir T1.
- Archivos: `App.test.tsx`.
- Funcionalidad: U21 y U22 (§11).
- Dependencias: T1.
- Aceptación: `npm test` en verde, con A1/A2 (axe) sin violaciones nuevas.

(T1 y T2 pueden ir en el mismo commit si se prefiere. Cada uno deja la app funcionando.)

## 10. Riesgos

| Riesgo | Prevención | Recorte |
|---|---|---|
| Toques por error al registrar desde la home (sin confirmación) | El botón está separado de la fila y tiene un nombre claro. La corrección y el «Deshacer» siguen en la tarjeta. | — |
| Pérdida de foco al desaparecer la fila | Foco en el `h2` «Hoy» (§8). | Si da problemas, quitar el manejo de foco y dejar un `ponytail:`. No recomendado. |
| Fila estrecha en móvil con etiquetas largas («+30 min») | `shrink-0` en el «+» y el nombre en `flex-1`. | Truncar el nombre (`truncate`). |
| Romper U11 por cambiar nombres accesibles | El botón de navegación no cambia. El «+» es hermano. | — |

## 11. Verificación

`selfcheck.ts` no cambia: no se toca `core/`.

Tests nuevos en `App.test.tsx`. Leen localStorage, así que se usa `vi.waitFor`:

- **U21 registrar desde la home**: `render(<App />)`. Clic en `btn('+1 sesión en Gym')`. Después, `await vi.waitFor(() => expect(stored()).toHaveLength(1))`, con `stored()[0]` `toMatchObject({ trackerId: 'gym', amount: 1 })` y `occurredAt` que empiece por `'2026-10-07'`. En la pantalla: `getByText('+30 HERO')`, `getByRole('button', { name: /^Gym 3 sesiones/ })` y `getByRole('button', { name: /^Gym \+1 sesiones/ })` («Registrado hoy»). Segundo clic en «+1 sesión en Gym»: `getByRole('status').textContent` debe cumplir `/Gym Lv\. 2/` (mismo caso que U18). Por último, clic en la fila «Gym 2 sesiones» → `getByRole('heading', { name: 'Misiones HERO' })`.
- **U22 cumplir el objetivo desde la home**: se precargan en `EV` 3 eventos de gym (`2026-10-05` y `2026-10-06`, `amount: 1`). Se hace `render` y clic en «+1 sesión en Gym». Comprobaciones: `queryByRole('button', { name: /^Gym 1 sesiones/ })` es `null`, `queryByRole('button', { name: '+1 sesión en Gym' })` es `null`, `document.activeElement` es el heading «Hoy» y `await vi.waitFor(() => expect(stored()).toHaveLength(4))`.

Checklist manual (`npm run dev`, consola con `[selfcheck] done`):
- [ ] En la home, «+» en Running suma 5 km, y la fila y la XP neta se actualizan sin cambiar de pantalla.
- [ ] Al subir de nivel desde la home aparece el toast.
- [ ] Tras recargar, el registro sigue ahí y aparece en «Últimos registros» de la tarjeta con fecha de hoy.
- [ ] En móvil (≈360 px), la fila no desborda y los dos botones se pueden pulsar por separado.
- [ ] Con teclado: Tab pasa de la fila al «+», y al cumplir el objetivo el foco queda en «Hoy».

## 12. Handoff para Claude Code

1. Lee `app/src/components/HomeView.tsx` (`TodayList`, bloque «Hoy») y `App.tsx:93` (`add`).
2. Implementa T1: cambia el `TodayList` (prop opcional `onAdd`, `left` por fila), pon `onGo={onNavigate}` en «Te faltan», añade `tabIndex={-1}` y la ref al `h2#hoy`, y pasa `onAdd` desde `App`. No toques `core/`.
3. Implementa T2 (U21, U22) siguiendo el estilo de `App.test.tsx`, con `vi.waitFor` para localStorage.
4. Desde `app/`: `npm run build`, `npm run lint` y `npm test` en verde. Después, el checklist manual.
5. No añadas XP flotante, selector de día ni botones en «Registrado hoy». Si P11.2 entra en el mismo ciclo, su línea «Te pasaste en» no lleva «+».
