# Estado actual — RPG Life Tracker

> Fecha de corte: 2026-10-09 (tras ciclo 17). El proyecto nació como demo de hackathon (Build Day) y pasa a desarrollo real.
> Este documento describe **lo que hay hoy en el código** y lo que lo separa de un producto en producción. Es la referencia principal; los PRD y specs anteriores quedan como histórico (ver §7).

## 1. Qué es

App web (móvil primero) que convierte actividades de la vida real en un personaje RPG:

- **HERO**: hábitos (Gym, BJJ, Running, Reading + los que cree el usuario).
- **VILLAIN**: vicios (Beer, Burgers + los que cree el usuario).
- Cada registro suma XP a la actividad, a su rama y al nivel global **PLAYER**.
- **Party**: grupos de amigos con criterios propios; una actividad solo cuenta en una party si esa party la aceptó.

## 2. Funcionalidad implementada

| Pantalla (`screen`) | Qué hace |
|---|---|
| Inicio (`home`) | Bloque «Hoy» (XP neta de hoy por rama, registrado hoy con «Deshacer» por fila (anula ese registro; mueve el foco a «Hoy» si desaparece la fila), «Te faltan» con días restantes y mejor racha; cada fila lleva a su rama y tiene un «+» que registra el incremento de hoy, moviendo el foco a «Hoy» si con eso se cumple el objetivo), nivel PLAYER, ramas HERO/VILLAIN, composición %, bloque «Últimas semanas» (HERO vs VILLAIN: XP por semana, últimas 8, barras CSS, semana en curso con borde discontinuo, lista `sr-only`; solo con XP), resumen de parties, estado vacío de bienvenida para usuario nuevo, bloque «Tus datos» (estado de la última copia y aviso si pasan 14 días con datos), «Cargar ejemplo» / «Borrar todo» (con confirmación; «Borrar todo» ofrece exportar antes), «Exportar copia» / «Importar copia» (JSON, con confirmación), «Recuperar copia anterior» (intercambia el estado actual con `.backup.last`; repetirlo deshace) y aviso si al cargar se perdieron o descartaron datos. |
| HERO / VILLAIN (`hero`, `villain`) | Tarjetas de actividad: registro con incremento fijo, selector de día («Hoy», «Ayer» o fecha pasada) para registrar y corregir, corrección (evento negativo, limitada al total de ese día), «Últimos registros» (10 más recientes) con «Deshacer», semana actual vs. mismo tramo de la anterior, objetivo semanal con chip de racha semanal (semanas seguidas cumpliendo el objetivo vigente en cada semana; cambiar el objetivo no reescribe el pasado; no da XP), «Últimas 8 semanas» (barras CSS por semana, `Check` si cumplida, borde discontinuo la semana en curso, lista `sr-only`), XP y nivel por actividad, en qué parties cuenta. |
| Actividades propias | (Las 4 fijas HERO editan solo su objetivo semanal; campo vacío = valor por defecto.) En su tarjeta (HERO/VILLAIN) se pueden editar nombre, incremento y objetivo semanal (solo HERO) y archivar; no se cambia rama, tipo, unidad ni XP/unidad. Las archivadas se ocultan de las tarjetas, pero su XP, histórico y parties siguen contando; se reactivan desde Inicio o con «Reactivar» en Nuevo si el usuario escribe su nombre. |
| Nuevo (`new`) | Crear actividad propia: texto libre → clasificación (Claude Haiku o heurística local) → el usuario confirma rama, tipo, unidad y XP/unidad. Detecta actividades parecidas ya existentes, incluidas las archivadas (ofrece «Reactivar»). Permite proponerla a parties. |
| Party (`party`) | Dos parties fijas (*Los del Gym*, *La Oficina*), criterios aceptados/rechazados, ranking semanal (HERO, VILLAIN, profundidad; los amigos simulados puntúan prorrateados por día de la semana), «proponer actividad existente» desde una tarjeta custom a parties donde aún no hay criterio ni rechazo, y nivel del usuario calculado solo con los criterios de esa party. |

Si un guardado en localStorage falla, la home y la rama activa muestran un aviso persistente con «Exportar copia ahora» (también anunciado en `role="status"`); desaparece con el siguiente guardado correcto.

Feedback: avisos anunciados por regiones `role="status"` (`liveText` en `components/liveText.ts`); toast de level-up / level-down, XP flotante, aviso de adelantamientos en el ranking. Transiciones con View Transitions API (`src/viewTransition.ts`).

## 3. Stack

React 19 + TypeScript 6 + Vite 8 + Tailwind CSS v4 (sin config, tokens en `@theme` de `src/index.css`) + lucide-react. Lint con oxlint (`--deny-warnings`: cualquier warning rompe CI). Versiones exactas en `app/package.json`.

Sin router, sin gestor de estado, sin backend. Tests con Vitest (`npm test`): `selfcheck.ts`, tests de las funciones puras de `storage.ts` (incl. restauración) y `src/App.test.tsx` (Testing Library + happy-dom sobre `<App />` real: registrar, día pasado, corrección, deshacer, editar/archivar, exportar/importar/borrar/recuperar) y `src/a11y.test.tsx` (chequeo axe-core sobre las vistas). Solo devDependencies. CI en GitHub Actions (`.github/workflows/ci.yml`: lint, build y test en cada push/PR).

## 4. Arquitectura

- **Fuente de verdad:** `ActivityEvent[]` (`{ id, trackerId, amount, occurredAt, undoes? }`). Todo lo demás (stats, XP, niveles, rankings, criterios de party) se deriva en cada render con `useMemo` en `App.tsx`. Las correcciones son eventos con `amount` negativo; deshacer es un negativo con el mismo `occurredAt` y `undoes: <id>` del positivo anulado (nunca se borra ni edita un evento).
- **`app/src/core/`** — TypeScript puro, sin React:

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Tipos de dominio. |
| `trackers.ts` | 6 actividades fijas + `allTrackers(custom, goals, goalLog)` (aplica overrides de objetivo a las fijas HERO y adjunta `pastGoals` derivado), `defaultGoal`, `setGoal`, `logGoal`. |
| `stats.ts` | Semanas lun–dom sobre strings `YYYY-MM-DD`, rangos `[start, end)` lexicográficos. `localDate(Date)` da la fecha local real. `dayTotal`, `clampAmount` (la corrección no baja el día de 0), `history()` (últimos registros con `undone`/`canUndo`), `undoneIds` (solo un negativo con `undoes` anula; `add` ignora deshacer algo ya deshecho), `goalAt` (objetivo vigente en una semana) y `streak` (campo de `TrackerStats`), `branchWeekly` (XP semanal por rama, 8 semanas, cuenta archivadas) y `shortDate`, `weekly` (últimas 8 semanas con la misma regla que `streak`, derivado en `MissionsView`), `todaySummary`, `daysLeftInWeek` y `dayLabel`. |
| `rpg.ts` | `deriveGame()`: XP = allTime × `xpPerUnit`; umbrales lineales `THRESHOLD` (actividad 60, rama 200, player 250). `diffLevelUps/Downs()`. |
| `party.ts` | `PARTIES` hardcodeadas; votación simulada por `stance` (mayoría estricta); estado por party con su propio `deriveGame`; `buildRanking(…, today)` prorratea a los amigos (semanal × días transcurridos / 7). |
| `classify.ts` | `classifyAI()` (Claude Haiku vía proxy) con fallback a `classify()` (palabras clave). `editTracker()` edita nombre/incremento/objetivo de una custom sin tocar `xpPerUnit`. `findSimilar()` (prefijo + Levenshtein). |
| `storage.ts` | Única capa de persistencia (localStorage): validadores puros `readEvents` (repara un `undoes` inválido conservando el evento)/`readCustom`, `loadAll` con backup, bloqueo de claves, exportar/importar (las claves desconocidas de `life-rpg-custom-v1` se conservan al guardar), `restoreLast` (intercambio atómico con `.backup.last`) y helper privado `writeAll`. `saveEvents`/`saveCustom` devuelven `true`/`false`/`null` (clave bloqueada). |
| `seed.ts` | `seedFor(today)`: 28 eventos de ejemplo relativos a semanas enteras respecto a `today`. `DEMO_DATE` y `SEED_EVENTS` solo los usan selfcheck y tests. |
| `selfcheck.ts` | Asserts de dominio, se ejecutan en DEV al arrancar y en `npm test`. |

- **UI:** `App.tsx` tiene todo el estado y la navegación; `src/components/` son presentacionales con callbacks.
- **Persistencia:** localStorage `life-rpg-demo-v1` (eventos) y `life-rpg-custom-v1` (`{ trackers, proposals, goals?, goalLog? }`; `goalLog` apunta el objetivo anterior al cambiarlo, `until` = lunes exclusivo), validados al leer (eventos y custom; `readEvents`/`readCustom` separan descartados de reparados). Si hay datos ilegibles o inválidos, el valor bruto se copia a `<clave>.backup.<stamp>` antes de sobrescribir y se avisa en la home; clave ilegible → arranca vacía (no semilla). `life-rpg-meta-v1` (`{ lastExportAt }`) guarda la última exportación. Antes de borrar o importar se hace copia interna atómica de eventos+custom en `<clave>.backup.last` (rota a `.backup.prev`); si falla, se aborta con aviso. La app restaura solo `.backup.last` (`.backup.prev` y `.backup.<stamp>` solo por DevTools; los sellados no se purgan). `exportData` pide `navigator.storage.persist()`. Si el backup falla, la clave se bloquea (`save*` no escribe) hasta importar una copia.
- **IA:** `vite.config.ts` monta un proxy `/api/claude` → `api.anthropic.com` solo en `npm run dev`, con `ANTHROPIC_API_KEY` de `app/.env.local` (nunca entra al bundle). `__AI_PROXY__` (define de Vite) es `true` solo en `dev` con key; en cualquier build es `false` y `classifyAI` usa la heurística sin llamar. Despliegue preparado pero **no activado**: el repo tiene remoto público (https://github.com/Guillelpz/ARC) y falta que el usuario active GitHub Pages (Settings → Pages → «GitHub Actions» y lanzar «Deploy Pages»); `BASE_PATH` para `base`, workflow manual `deploy-pages.yml` (solo `workflow_dispatch`) y guía en `docs/DEPLOY.md`.

## 5. Herencia de la demo (lo que falta para producción)

Cosas que funcionan pero son atajos de hackathon. Ninguna está decidida; cada una requiere decisión de producto/técnica antes de tocarla.

| Área | Estado actual | Implicación |
|---|---|---|
| Fecha | Resuelto en ciclo 2: «hoy» es la fecha local real, recalculada en cada render y al volver a la pestaña. | `App.tsx` llama `localDate(new Date())` en render; el lint ya sale limpio (sin aviso de pureza). |
| Datos iniciales | Resuelto en ciclo 2: arranque vacío; «Cargar ejemplo» carga `seedFor(hoy)`; «Borrar todo» vacía. | Si `getItem` lanza, se devuelve `[]` (sin pérdida). |
| Party | Amigos, parties y votos son ficticios y deterministas (`PARTIES`, `stance`). | Requiere backend, cuentas e invitaciones para ser real. |
| Usuarios | Un único usuario local, sin cuenta. | Sin auth ni sincronización entre dispositivos. |
| Persistencia | Solo localStorage del navegador, con exportar/importar manual. Las claves llevan «demo» en el nombre. | Pérdida de datos al borrar el navegador (persist es solo petición); recordatorio fijo de 14 días, sin copias automáticas, UI para restaurar solo `.backup.last` (el resto, manual en DevTools; backups con sello sin purgar) ni migraciones de esquema. |
| IA | Proxy de Vite solo en local (en este equipo no existe `app/.env.local`: la IA no se ha usado en local); sin reintentos, caché ni límite de uso. | Necesita un endpoint de servidor para funcionar desplegada (P13.4). |
| Progresión | Umbrales lineales y XP/unidad fijos; sin límite de registros por día; solo la corrección se limita al total del día. | Balance de juego sin validar con usuarios. |
| Calidad | `npm test` cubre selfcheck, storage y los flujos críticos de UI (`App.test.tsx`, ciclo 6); sin e2e en navegador real. CI ya existe (ciclo 2). | Ampliar `App.test.tsx` al añadir flujos; los tests dependen de textos de la UI. |
| Copy | Quedan textos y claves con «demo» (`life-rpg-demo-v1`, «Party de ejemplo»). | Revisar cuando se quiten los atajos anteriores. |

Simplificaciones marcadas en código con `ponytail:` (límite conocido + cómo crecer): `party.ts` (amigos simulados a ritmo lineal; lun 1/7 … dom 7/7) y `classify.ts` (heurística por palabras clave, llamada única a Claude sin reintentos, similitud por prefijo/erratas) y `vite.config.ts` (proxy solo en dev y con key; endpoint real pendiente) y `storage.ts` (claves desconocidas de custom copiadas sin validar) y `App.tsx` (aviso `role="status"`: dos avisos seguidos con el mismo texto pueden no repetirse en el lector) y `App.tsx`/`trackers.ts` (`setGoal` persiste `goals: {}` al volver al valor por defecto; inocuo) y `storage.ts` (restaurar solo `.backup.last`, sin purga de sellados; copia de dos niveles; `persist()` solo petición; recordatorio fijo a 14 días) y `App.tsx` («hoy» recalculado en render y al volver a la pestaña) y `stats.ts` (`weekly` hace 8 sumas por tarjeta y render; indexar por semana si se nota) y `stats.ts` (`history` recorre todos los eventos por tarjeta, O(n·tarjetas); `streak` es O(semanas·eventos) por tarjeta) y `trackers.ts` (`goalLog` crece una entrada por actividad y semana con cambio, sin compactar) y `stats.ts` (`branchWeekly` filtra todos los eventos por tracker y semana, O(trackers·eventos)) y `trackers.ts` (`unitFor`: singular solo para unidades fijas y por defecto) y `App.tsx` (efecto de guardado con setState: 2 `oxlint-disable` de `react/set-state-in-effect` en `App.tsx:58,60`; sin objetivos anteriores al registro: semanas previas al primer apunte usan ese primer objetivo).

## 6. Cómo trabajar

Desde `app/`:

- `npm run dev` — servidor de desarrollo; en la consola del navegador aparece `[selfcheck] done` (los fallos salen como `console.assert`).
- `npm run build` — `tsc -b && vite build` (también es el type-check).
- `npm run lint` — oxlint con `--deny-warnings`; cualquier warning rompe CI.
- `npm test` — Vitest (`vitest run`): selfcheck + tests de `storage.ts` + tests de UI (`App.test.tsx`, happy-dom) + axe (`a11y.test.tsx`). En tests de UI que lean localStorage tras una acción asíncrona, esperar con `vi.waitFor` (el guardado va en un efecto).
- IA opcional: crear `app/.env.local` con `ANTHROPIC_API_KEY=...`.

Regla: `selfcheck.ts` es el oráculo del dominio; si falla, se arregla el motor, no los asserts (salvo cambio de reglas decidido explícitamente).

## 7. Documentos

| Documento | Estado |
|---|---|
| `docs/ESTADO-ACTUAL.md` | **Vigente.** Este documento. |
| `docs/DEPLOY.md` | **Vigente.** Despliegue estático (Pages/Cloudflare), aún sin activar. |
| `docs/STYLE_GUIDE.md` | **Vigente.** Tokens, tipografía, tono visual. |
| `docs/DESIGN-V2.md` | Vigente como descripción de pantallas; nació para la demo. |
| `MVP-RPG.md`, `docs/PRD-V2.md` | Histórico: PRD de la demo (V1 y V2). Útiles para entender el porqué de reglas. |
| `docs/TECH_SPEC.md`, `docs/TECH_SPEC-V2.md` | Histórico: specs de la demo. Las fórmulas y decisiones siguen implementadas tal cual. |
