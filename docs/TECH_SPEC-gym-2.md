# TECH_SPEC — Gym 2: progreso, volumen, rutinas, «Hoy» y deuda de sesiones (ciclo 25)

## 1. Resumen

Se construye sobre el módulo Gym del ciclo 24 (`core/gym.ts`, `life-rpg-gym-v1`, `GymView`):
**P24.7** gráfico del mejor 1RM estimado por semana (8 semanas) del ejercicio seleccionado; **P24.8** series y volumen (peso × reps) por grupo muscular en la semana en curso frente al mismo tramo de la anterior; **P24.10** rutinas: guardar la sesión de un día como rutina y cargarla como guía de la sesión del día; **P24.12** una fila «Gym» en el bloque «Hoy»; y la **deuda de sesiones**, que hace cumplir la regla «día con series vivas ⇒ al menos 1 sesión de Gym».
No se construye: nivel Gym, XP nueva, sobrecarga, temporizador, edición de rutinas (se borran y se vuelven a guardar), nada de party. XP y reglas de juego no cambian (la sesión automática ya existía).

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Progreso (P24.7) | `weeklyBest1rm` = máximo `e1rm` (Epley, ≤12 reps, peso > 0) por semana lun–dom, 8 semanas, solo series vivas; semana sin dato → `null` | Reutiliza `e1rm`, `mondayOf`/`addDays` y la convención de `weekly` |
| Gráfico | SVG propio (`polyline` + `circle`, `stroke="currentColor"` con `text-hero`), `aria-hidden`, con una lista `sr-only` por semana | D7: sin dependencias. Mismo patrón accesible que «Últimas semanas» |
| Escala Y | De `min` a `max` de las semanas con dato (si son iguales, línea centrada); fuera del SVG se muestra el texto «Mejor del periodo: X» | Con base 0, los cambios de 1RM no se verían |
| Volumen (P24.8) | La métrica principal es el **nº de series** por grupo; la secundaria, el **volumen** Σ kg×reps (kg normalizados con `toKg`, se muestran en la unidad preferida y redondeados a entero) | Las series cuentan también el peso corporal; el volumen mezcla kg y lbs sin errores |
| Comparación | Semana en curso hasta hoy frente al mismo tramo de la semana anterior (`[lunes−7, hoy−7]`) | Misma regla que `stats.ts` |
| Ejercicio desconocido en el volumen | Se ignora (sin grupo) | No se puede asignar; `ponytail:` |
| Rutina | `{ id, name, items: { exerciseId, sets }[] }` dentro de `GymData.routines?` (misma clave `life-rpg-gym-v1`) | Sin clave nueva: backup, restore, lock e `isDataKey` no cambian |
| Crear rutina | Solo «Guardar la sesión de este día como rutina»: ejercicios en orden de primera serie, `sets` = series vivas de ese día (tope 10) | Sin editor: lo más simple que es útil |
| Cargar rutina | Estado de UI (`useState`, no se persiste): muestra la lista de la rutina con «hechas/objetivo» del día del selector. Al pulsar un ítem, se selecciona ese ejercicio en el formulario (prerrellenado como siempre). **No crea series** | Una serie sin peso ni reps reales sería un dato falso |
| Borrar rutina | Se borra de verdad (con confirm) | Es configuración, no historial; el efecto en la fusión está en §3 |
| Límites de rutina | Nombre 2–40 (`isValidName`), único normalizado; 1–20 ítems; `sets` entero 1–10; máximo 20 rutinas | Validación en la frontera |
| «Hoy» (P24.12) | Una fila «Gym · N series · M ejercicios» si hay series hoy; abre Gym, y «Volver» regresa a Inicio | Mínimo útil (ver §3) |
| Invariante de sesión | Función pura `ensureAuto(events, log, days)` que devuelve las sesiones automáticas que faltan; App la llama donde se rompe la regla | Una sola función para las dos deudas; se prueba en selfcheck |

## 3. Decisiones que requieren aprobación

> **Aprobado por el usuario (2026-10-12): todas las opciones recomendadas.** 1 y 3: se recrea la sesión automática (también al importar y fusionar). 2: «Recuperar» con copia sin gym conserva las series y recrea sesiones, con aviso. 4: las rutinas se fusionan (por id; conflicto → se mantiene la local y se avisa). 5: «Hoy» muestra la fila resumen «Gym · N series · M ejercicios». 6: «Volver» desde Gym abierto desde «Hoy» va a Inicio con foco en «Hoy».

1. **Deshacer o «−» de la sesión de Gym en un día con series vivas** (`ponytail:` de `addSet`).
   - **Recomendada (A):** se cumple la regla. El deshacer o el «−» se aplica y, en el mismo guardado, se añade la sesión automática del día (`gym-auto-<día>[-n]`). Neto 0: la XP no cambia, no hay toast ni animación y el historial muestra el deshacer y la nueva «+1». Para dejar el día sin sesión hay que deshacer sus series en Gym.
   - **Alternativa (B):** estado actual. Se permiten 0 sesiones con series vivas y la sesión vuelve al registrar otra serie. Solo se cambia el `ponytail:` por un texto definitivo.
2. **`restoreLast` con una copia anterior al módulo Gym** (`r.gym === null`).
   - **Recomendada (A):** se conserva el gym actual y, después de recuperar, se añaden las sesiones automáticas que falten (`ensureAuto` sobre todos los días con series). El confirm lo avisa: «Esta copia es anterior al módulo Gym: tus N series de gym se conservan y los días con series vuelven a contar como sesión.».
   - **Alternativa (B):** se trata como gym vacío, igual que «Importar» con esa copia. El gym actual pasa a `.backup.last` (se recupera pulsando otra vez «Recuperar») y el confirm dice que quedan 0 series.
3. **Alcance de la regla de la decisión 1A** (solo si se aprueba 1A).
   - **Recomendada:** aplicar `ensureAuto` también tras «Importar» y «Fusionar». Una fusión puede juntar una serie viva de un dispositivo con la sesión retirada en el otro.
   - **Alternativa:** aplicarla solo al deshacer, al «−» y al recuperar.
4. **Rutinas en la fusión.**
   - **Recomendada:** entran. Se añaden las rutinas de la copia cuyo `id` no existe en local; si el `id` coincide y el contenido es distinto, se mantiene la local y su nombre sale en «conflictos». Una rutina borrada aquí vuelve si sigue en la copia (igual que los registros, `ponytail:` (1) de `merge.ts`).
   - **Alternativa:** no entran en la fusión; solo viajan con «Importar» (reemplazo) y en «Exportar».
5. **Qué muestra «Hoy».**
   - **Recomendada:** una fila «Gym · 12 series · 4 ejercicios» que abre Gym, solo si hay series hoy.
   - **Alternativa:** además, el récord batido hoy («Nuevo récord en Press banca»). Es más trabajo y repite el banner.
6. **«Volver» desde Gym abierto desde «Hoy».**
   - **Recomendada:** vuelve a Inicio con el foco en el encabezado «Hoy».
   - **Alternativa:** vuelve siempre a «Yo», como ahora.

## 4. Impacto en el código

| Archivo | Cambio |
|---|---|
| `app/src/core/types.ts` | `Routine`, `RoutineItem`, `GymData.routines?`, `WeekBest`, `GroupVolume`, `GymDay` |
| `app/src/core/gym.ts` | `ensureAuto`, `weeklyBest1rm`, `groupVolume`, `gymDay`, `routineFromDay`, `routineProgress`, `MAX_ROUTINES`, `validRoutineName` |
| `app/src/core/storage.ts` | `readGym` valida `routines`; `KNOWN_GYM` + `'routines'` |
| `app/src/core/merge.ts` | Fusión de rutinas (si se aprueba 3.4A); `MergeResult.routinesAdded` |
| `app/src/core/selfcheck.ts` | GY14–GY21 |
| `app/src/core/storage.test.ts` | Casos de `readGym` con rutinas |
| `app/src/App.tsx` | `add` con `ensureAuto`; `push` sin animación si el neto es 0; `restore`/`importData`/`mergeData` con `ensureAuto`; `saveRoutine`/`deleteRoutine`; `gymToday`; `gymFrom`; `hasData` incluye rutinas; se eliminan los dos `ponytail:` |
| `app/src/components/GymView.tsx` | Tarjetas «Progreso», «Volumen semanal» y «Rutinas», y panel de la rutina cargada |
| `app/src/components/HomeView.tsx` | Fila Gym en «Hoy»; props `gymToday`, `onOpenGym`, `focusHoy` |
| `app/src/App.test.tsx`, `app/src/a11y.test.tsx`, `app/e2e/smoke.e2e.ts` | Ver §11 |
| `docs/ESTADO-ACTUAL.md`, `CLAUDE.md`, `AGENTS.md` | Estado y descripción de `gym.ts`/`storage.ts` |

**Puntos que tocan la «lista de claves de datos»** (fricción del ciclo 24). No hay clave nueva, así que `backupCurrent`, `restoreLast`, `readLast`, `hasLastBackup`, `lockStorage`, `isDataKey`, `EMPTY_RAW` y `loadAll` **no cambian**. Sí cambian, porque `GymData` crece: `readGym` (validación), `mergeBackup` (rutinas), `hasData` en App, los textos de confirmación de importar, fusionar y recuperar, y `exportBackup` (sin cambio de código: las rutinas van dentro de `gym`).

## 5. Modelos de datos

```ts
export type RoutineItem = { exerciseId: string; sets: number } // sets: entero 1..10
export type Routine = { id: string; name: string; items: RoutineItem[] } // id 'routine-<uuid>'; 1..20 ítems; exerciseId únicos
export type GymData = { log: GymEntry[]; exercises: Exercise[]; unit?: WeightUnit; routines?: Routine[] } // routines ausente = ninguna
export type WeekBest = { monday: string; kg: number | null; current: boolean } // kg: mejor e1rm en kg; null = sin dato
export type GroupVolume = { group: MuscleGroup; label: string; sets: number; kg: number; prevSets: number; prevKg: number }
export type GymDay = { sets: number; exercises: number } // series vivas de un día y ejercicios distintos
```

## 6. Persistencia y migración

- **Formato:** `life-rpg-gym-v1` gana el campo opcional `routines`. No hay migración: si falta, no hay rutinas. Al guardar con 0 rutinas se **omite el campo** (`deleteRoutine` hace lo mismo que `setUnit` con `unit`), así los datos de quien no use rutinas quedan idénticos.
- **Versión anterior (rollback):** `readGym` del ciclo 24 copia las claves desconocidas tal cual, así que las rutinas sobreviven aunque no se usen.
- **Validación en `readGym`:**
  - `routines` presente y no array → se ignora el campo y cuenta `dropped += 1`.
  - Rutina no válida (no es objeto, `id` sin prefijo `routine-`, nombre recortado fuera de 1–40, `items` no array) → se descarta y cuenta `dropped`.
  - Ítem no válido (`exerciseId` no string o vacío, `sets` no entero 1–10) o `exerciseId` repetido → se quita el ítem y cuenta `fixed`. Si una rutina queda con 0 ítems, se descarta (`dropped`). Si tiene más de 20, se recorta (`fixed`).
  - Más de 20 rutinas: se conservan (no se pierde nada) y la UI no deja crear más.
  - `exerciseId` desconocido: se conserva (puede ser un ejercicio propio de otra copia).
  - Datos con errores → el mecanismo actual (backup `<clave>.backup.<stamp>` + aviso).
- **Export/import:** sin cambios de código; `gym.routines` viaja dentro de `gym`. Las copias del ciclo 24 (gym sin `routines`) y las anteriores al módulo (sin `gym`) siguen importándose igual.
- **Fusión (si se aprueba 3.4A):** `routines = [...local, ...entrantes cuyo id no existe en local]`. Si el `id` coincide y `JSON.stringify([name, items])` es distinto → conflicto con el nombre local. Es idempotente y no muta la entrada. Si el resultado tiene 0 rutinas, se omite el campo. `changed` incluye `routinesAdded > 0`.
- **Sesiones creadas por `ensureAuto`:** son eventos normales (`gym-auto-<día>[-n]`, `T12:00:00`) y se guardan con `saveEvents` como cualquier `push`.

## 7. Lógica de dominio (`core/gym.ts`, puras, sin mutar)

```ts
// Sesiones automáticas que faltan: para cada día de `days` (sin repetir, en orden) con daySets > 0 y dayTotal(gym) === 0
// sobre [...events, ...out], añade autoSession([...events, ...out], día). Idempotente: aplicado al resultado, devuelve [].
export function ensureAuto(events: ActivityEvent[], log: GymEntry[], days: string[]): ActivityEvent[]
// Días con series vivas (para restore/import/merge): [...new Set(liveSets(log).map(s => s.occurredAt.slice(0, 10)))].sort()
export const setDays = (log: GymEntry[]): string[]

// 8 semanas (la última, la en curso). Series vivas del ejercicio con occurredAt en [monday, monday+7);
// kg = max e1rm(toKg(weight, unit), reps) sin redondear (se muestra con fromKg); null si ninguna da e1rm.
export function weeklyBest1rm(log: GymEntry[], exerciseId: string, today: string, n = 8): WeekBest[]

// Una fila por grupo de GROUPS, en ese orden, aunque esté a 0. cur = [mondayOf(today), today]; prev = [mondayOf(today)−7, today−7].
// sets: nº de series vivas; kg: Σ toKg(weight, unit) × reps (sin redondear). Ejercicio desconocido (no está en allExercises(custom)) → se ignora.
export function groupVolume(log: GymEntry[], custom: Exercise[], today: string): GroupVolume[]

export function gymDay(log: GymEntry[], day: string): GymDay // { sets: daySets.length, exercises: ids distintos }

// Ítems en orden de primera serie viva del día; sets = min(10, nº de series). null si el día no tiene series.
export function routineFromDay(log: GymEntry[], day: string, name: string, id: string): Routine | null
// done = series vivas de ese ejercicio en `day`; complete = done >= sets
export function routineProgress(r: Routine, log: GymEntry[], day: string): { exerciseId: string; sets: number; done: number; complete: boolean }[]
export const MAX_ROUTINES = 20
```

Reglas en App (deuda, según la decisión aprobada):
- **1A:** en `add(t, amount, day, undo)`, si `t.id === GYM_TRACKER` y `amount < 0`, se calcula `ev` igual que ahora y `extra = ensureAuto([...events, ev], gym.log, [day])`, y se llama a `push([ev, ...extra], t)`. `add` devuelve el neto (`amount + extra.length`). En `push`, si el neto es 0, no hay `setGain` ni toast (los adelantamientos no cambian). Se elimina el `ponytail:` de `addSet`.
- **2A:** en `restore()`, si `r.gym === null`, `ev2 = [...ev, ...ensureAuto(ev, gym.log, setDays(gym.log))]` y se hace `setEvents(ev2)`. El effect de guardado lo escribe después del `restoreLast`, y `.backup.last` conserva el estado anterior, así que un segundo «Recuperar» sigue funcionando. Se añade el texto del confirm de §3.2 y se elimina el `ponytail:`.
- **3 (recomendada):** igual en `importData` (con `b.gym ?? EMPTY_GYM`, normalmente no añade nada) y en `mergeData` (sobre `r.events`/`r.gym`). Lo añadido no cuenta en los mensajes de «registros añadidos».

XP: una sesión automática vale lo mismo que una manual (GY13). En 1A el neto es 0, así que la XP no cambia.

## 8. UI (paleta HERO en Gym; `app-*` en Inicio; tokens de `@theme`, sin hex)

Orden en `GymView`: cabecera, unidad, día, ejercicio, **panel de la rutina cargada** (si hay), registrar serie, status, récords, **Progreso**, sesión, **Volumen semanal**, **Rutinas**, ejercicios propios. Todas las tarjetas nuevas usan `card` y un `<section aria-labelledby>` con `h2`.

- **Progreso · {ejercicio}:**
  - SVG `viewBox="0 0 100 40"`, alto `h-24`, `aria-hidden`. Una polilínea une las semanas con dato consecutivas (los huecos cortan la línea). Hay un círculo por semana con dato; el de la semana en curso, hueco (`fill="none"`).
  - Debajo: «Mejor del periodo: ≈ X kg» y la leyenda «Mejor 1RM estimado por semana (Epley)».
  - `<ul className="sr-only">` con una línea por semana: «Semana del 28 sept (en curso): ≈ 120 kg» o «…: sin datos».
  - Sin ninguna semana con dato: «Aún no hay datos para el progreso: cuenta el 1RM estimado de series con peso y de hasta 12 repeticiones.».
- **Volumen semanal:**
  - Una fila por grupo con series > 0 o `prevSets` > 0: «Pecho · 9 series · 2.450 kg» y debajo, en `text-hero-muted`, «semana anterior hasta hoy: 7 series · 1.980 kg».
  - Barra horizontal CSS (`bg-hero`, ancho = `sets / max(sets)`), `aria-hidden`.
  - Si no hay nada en ninguna de las dos semanas: «Aún no hay series esta semana.». El volumen de peso corporal sin lastre suma 0 kg; se explica con una línea `text-xs`: «El volumen es peso × repeticiones; el peso corporal sin lastre cuenta solo como serie.».
- **Rutinas:**
  - Formulario «Guardar la sesión de {hoy|ayer|el día} como rutina» con un campo «Nombre» y el botón «Guardar rutina», deshabilitado si el día no tiene series (con la ayuda «Registra alguna serie en este día para guardarla como rutina.»).
  - Errores en línea (patrón `CircleAlert`): nombre no válido, nombre repetido o máximo de 20.
  - Lista de rutinas: nombre + «N ejercicios», botones «Cargar» y «Borrar» (`min-h-11`, `aria-label` con el nombre). «Borrar» pide `window.confirm('¿Borrar la rutina «X»? Tus series no cambian.')`.
  - Lista vacía: «Aún no tienes rutinas.».
- **Panel de rutina cargada:**
  - Título «Rutina: {nombre}» con el botón «Quitar».
  - Lista de ítems: botón «{ejercicio} · {done}/{sets} series» que llama a `changeExercise(id)`. Si está completo, icono `Check` + texto «hecho» (no solo color). Un ejercicio archivado o desconocido sale como texto «(no disponible)», sin botón.
  - Al cargar, el foco va al título del panel y el status dice «Rutina {nombre} cargada.». Los contadores siguen el día del selector.
  - Si se borra la rutina activa, el panel se cierra.
- **Inicio · «Hoy»:**
  - Si `gymToday.sets > 0`, debajo de «Registrado hoy» va una lista de una fila (estilo `TodayList`, botón `min-h-11`): «Gym» · «12 series · 4 ejercicios» + `ChevronRight`. Abre Gym con `gymFrom = 'home'`.
  - Con 6A, «Volver» lleva a `home` y pone el foco en `#hoy` (prop `focusHoy`, como `focusGym`). Desde «Yo», sin cambios.
- **Deuda:**
  - Con 1A no hay texto nuevo en las tarjetas: el historial ya lo refleja. Se borran los dos `ponytail:` y se sustituyen por un comentario de la regla.

## 9. Backlog (rama `cycle-25`, un commit por tarea; cada una deja build, lint y test en verde)

**T1 — `ensureAuto` + `setDays` (core).** Archivos: `gym.ts`, `selfcheck.ts`. Funciones de §7 y GY14.
Criterio: GY1–GY14 pasan y no hay cambios de UI.

**T2 — Deuda 1 en App (según la decisión 1).** Archivos: `App.tsx`, `App.test.tsx`. Con 1A: `add`/`push` como en §7 y test UI (registrar una serie, ir a HERO, deshacer el «+1» automático → el día sigue con 1 sesión y no aparece toast de bajada). Con 1B: solo se cambia el `ponytail:` por un comentario definitivo.
Depende de T1.

**T3 — Deuda 2 (y 3) en restore/import/merge.** Archivos: `App.tsx`, `App.test.tsx`. §7 2A/3 y el texto del confirm. Test UI: estado con series + `.backup.last` sin gym → «Recuperar» → las series se conservan y los días tienen sesión.
Depende de T1.

**T4 — Progreso (core + UI).** Archivos: `types.ts`, `gym.ts`, `selfcheck.ts` (GY15), `GymView.tsx`, `App.test.tsx`.
Criterio: tarjeta con SVG y lista sr-only, estado vacío, y la unidad preferida aplicada.

**T5 — Volumen semanal (core + UI).** Archivos: `types.ts`, `gym.ts`, `selfcheck.ts` (GY16), `GymView.tsx`, `App.test.tsx`.
Criterio: kg y lbs mezclados se muestran correctamente en kg y en lbs.

**T6 — Gym en «Hoy».** Archivos: `gym.ts` (`gymDay`, GY17), `App.tsx` (`useMemo` de `gymToday`, `gymFrom`, `focusHoy`), `HomeView.tsx`, `App.test.tsx`.
Criterio: la fila aparece solo con series hoy; ida y vuelta con el foco en «Hoy».

**T7 — Rutinas: modelo y persistencia.** Archivos: `types.ts`, `gym.ts` (`routineFromDay`, `routineProgress`, `MAX_ROUTINES`), `storage.ts` (`readGym`), `storage.test.ts`, `selfcheck.ts` (GY18, GY19).
Criterio: una copia del ciclo 24 se lee sin cambios (`routines` ausente) y las rutinas con errores se reparan o descartan con su recuento.

**T8 — Rutinas en la fusión (según la decisión 4).** Archivos: `merge.ts`, `selfcheck.ts` (GY20), `App.tsx` (texto «y N rutinas» en los mensajes de fusión e importación cuando sea > 0).
Con 4B: la fusión conserva `lg.routines` (ya ocurre con el spread) y GY20 comprueba que no se añaden las entrantes. Depende de T7.

**T9 — Rutinas: UI.** Archivos: `GymView.tsx`, `App.tsx` (`saveRoutine`, `deleteRoutine`, `hasData`), `App.test.tsx`, `a11y.test.tsx`.
Criterio: guardar, cargar, contadores por día, seleccionar ejercicio, borrar con confirm y estados vacío/error. Depende de T7.

**T10 — e2e + docs.** Archivos: `e2e/smoke.e2e.ts` (registrar una serie → guardar rutina → recargar → la rutina sigue y se carga; Gym a 320 px sin scroll horizontal), `docs/ESTADO-ACTUAL.md` (Gym con progreso/volumen/rutinas/«Hoy», quitar P24.7/8/10/12 de §5 y la deuda), `CLAUDE.md` y `AGENTS.md` (`gym.ts`: `ensureAuto`, progreso, volumen, rutinas; `storage.ts`: `routines` en `life-rpg-gym-v1`).

## 10. Riesgos

| Riesgo | Prevención |
|---|---|
| `ensureAuto` crea sesiones duplicadas o en bucle | Es idempotente (GY14). Solo se llama en acciones del usuario, nunca en un effect ni al arrancar |
| Neto 0 en `push` muestra «+0 XP» o un toast | Comprobación explícita del neto 0 y test UI en T2 |
| Volumen de lbs mal sumado | Todo se acumula en kg con `toKg`; GY16 con kg y lbs mezclados |
| `readGym` descarta rutinas válidas | Casos en `storage.test.ts`; las de exceso de ítems se recortan, no se descartan |
| Rendimiento: `liveSets` se recorre varias veces por render | `useMemo` en GymView por `gym.log`; `ponytail:` si el log crece (riesgo de escala ya anotado) |
| GymView demasiado largo | Se permite extraer `GymProgress`, `GymVolume` y `GymRoutines` como componentes presentacionales en `components/` si pasa de ~350 líneas |

**Recorte de seguridad** (en este orden):
1. Quitar la comparación con la semana anterior en el volumen (solo la semana en curso).
2. «Volver» desde «Hoy» va siempre a «Yo» (6B).
3. Rutinas fuera de la fusión (4B).
4. Si T7–T9 se complican, **P24.10 completo pasa al ciclo siguiente**. T1–T6 son independientes y se despliegan solos.

La deuda (T1–T3) no se recorta.

## 11. Verificación

**Asserts nuevos en `selfcheck.ts`.** GY1–GY13 y M1–M8 no cambian. Fecha fija `DEMO_DATE`; `D` = un día de esa semana.
- **GY14 `ensureAuto`:**
  - Día con series y manual deshecha → 1 evento `gym-auto-D`; con `gym-auto-D` previo y deshecho → `gym-auto-D-2`.
  - Día con manual viva → `[]`. Día sin series → `[]`.
  - Dos días → dos eventos en orden.
  - Aplicado a `[...events, ...out]` → `[]` (idempotente).
  - `setDays` excluye las series deshechas.
- **GY15 `weeklyBest1rm`:**
  - 8 filas y solo la última `current`.
  - 100 kg×5 y 220 lbs×3 la misma semana → máximo correcto en kg (≈116,67 frente a 220·0,4536·1,1 ≈ 109,77).
  - Una serie deshecha no cuenta; 13 reps → `null`.
  - Semana sin series → `null`; serie de hace 9 semanas fuera de rango.
- **GY16 `groupVolume`:**
  - Press banca 100 kg×5 + 220 lbs×5 → chest `sets 2`, `kg ≈ 998,95` (±0,01), y `fromKg` a lbs ≈ 2202,3.
  - Dominadas sin lastre ×10 → back `sets 1, kg 0`.
  - Un ejercicio propio cuenta en su grupo; uno desconocido se ignora.
  - Una serie de `mondayOf(D)−7` hasta `D−7` cuenta en `prev`; una de `D−6` (posterior al tramo) no.
  - 6 filas en el orden de `GROUPS`.
- **GY17 `gymDay`:** 3 series de 2 ejercicios, una deshecha → `{ sets: 2, exercises: … }` correcto; día vacío → `{0,0}`.
- **GY18 `routineFromDay`/`routineProgress`:**
  - Orden de primera serie; 12 series → `sets 10`; día sin series → `null`.
  - El progreso cuenta solo las series del `day` dado; `complete` cuando `done >= sets`.
- **GY19 `readGym` con rutinas:**
  - Sin `routines` → sin campo y `dropped 0`.
  - Ítem con `sets 0` → quitado (`fixed 1`); rutina sin ítems válidos → `dropped 1`; `routines: 5` → `dropped 1`.
  - Una copia exportada del ciclo 24 (`parseBackup`) sigue siendo válida.
- **GY20 fusión de rutinas (4A):**
  - Añade por id nuevo; mismo id con distinto contenido → se mantiene la local + conflicto.
  - Copia sin `routines` → las locales intactas y `!changed`.
  - Idempotente; sin mutar las entradas (`JSON.stringify` antes/después).
  - Con 4B: las entrantes no se añaden.
- **GY21 (1A) XP:** `deriveGame` con `[manual, deshacer manual, auto]` da la misma XP de gym que `[manual]`.

**Tests UI (`App.test.tsx`):** T2 (deshacer la sesión con series), T3 (recuperar copia sin gym), T4 (lista sr-only del progreso), T5 (volumen en lbs), T6 (fila «Hoy» → Gym → Volver con el foco en «Hoy»), T9 (guardar, cargar y borrar rutina, errores de nombre). **a11y (`a11y.test.tsx`):** GymView con rutina cargada, progreso y volumen con datos, e Inicio con la fila Gym.

**Cierre de cada tarea:** `npm run build`, `npm run lint`, `npm test` en verde desde `app/`, y `[selfcheck] done` sin fallos en dev. En T10, además, `npm run e2e`.

**Checklist manual (móvil 320–390 px y escritorio):**
- [ ] Cambiar kg↔lbs actualiza el progreso y el volumen sin alterar los datos.
- [ ] Recargar conserva las rutinas; la rutina cargada se cierra al recargar (esperado).
- [ ] Exportar con rutinas → importar en una ventana privada → aparecen.
- [ ] Fusionar una copia del ciclo 24 no toca las rutinas.
- [ ] Deshacer «+1 sesión» en HERO con series ese día (1A): el día sigue con 1 sesión y sin toast.
- [ ] «Hoy» con series: la fila abre Gym y «Volver» vuelve a Inicio.
- [ ] Sin scroll horizontal en Gym a 320 px; los botones de rutina miden ≥ 44 px.

## 12. Handoff para Claude Code

1. Antes de T2, T3, T8 y T6 hay que confirmar con el orquestador las respuestas del usuario a §3. Si no las hay, implementa las **recomendadas** y apúntalo en el commit.
2. Rama `cycle-25` desde `main`. Haz T1→T10 en orden, un commit por tarea (`feat(gym): …`, `fix(gym): …`, `docs: …`) y pasa build, lint y test antes de cada commit.
3. Lee antes `core/gym.ts`, `storage.ts` (`readGym`), `merge.ts`, `App.tsx` (`add`, `push`, `addSet`, `undoSet`, `restore`, `importData`, `mergeData`) y `GymView.tsx`. Reutiliza `liveSets`, `daySets`, `e1rm`, `toKg`/`fromKg`/`fmtWeight`, `autoSession`, `mondayOf`/`addDays`/`shortDate`, `isValidName`/`normalizeText` y `card`/`primary`/`secondary` de GymView.
4. No toques XP, `rpg.ts`, `party.ts` ni las claves de storage. Sin dependencias de runtime. No guardes derivados (progreso, volumen, `gymDay` y el progreso de la rutina se calculan en el render).
5. Si GY1–GY13 o M1–M8 fallan, se arregla el código, no los asserts.
