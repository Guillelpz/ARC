# Estado actual — RPG Life Tracker

> Fecha de corte: 2026-10-08. El proyecto nació como demo de hackathon (Build Day) y pasa a desarrollo real.
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
| Inicio (`home`) | Nivel PLAYER, ramas HERO/VILLAIN, composición %, resumen de parties, estado vacío de bienvenida para usuario nuevo, bloque «Tus datos» (estado de la última copia y aviso si pasan 14 días con datos), «Cargar ejemplo» / «Borrar todo» (con confirmación; «Borrar todo» ofrece exportar antes), «Exportar copia» / «Importar copia» (JSON, con confirmación) y aviso si al cargar se perdieron o descartaron datos. |
| HERO / VILLAIN (`hero`, `villain`) | Tarjetas de actividad: registro con incremento fijo, selector de día («Hoy», «Ayer» o fecha pasada) para registrar y corregir, corrección (evento negativo, limitada al total de ese día), «Últimos registros» (10 más recientes) con «Deshacer», semana actual vs. mismo tramo de la anterior, objetivo semanal, XP y nivel por actividad, en qué parties cuenta. |
| Nuevo (`new`) | Crear actividad propia: texto libre → clasificación (Claude Haiku o heurística local) → el usuario confirma rama, tipo, unidad y XP/unidad. Detecta actividades parecidas ya existentes. Permite proponerla a parties. |
| Party (`party`) | Dos parties fijas (*Los del Gym*, *La Oficina*), criterios aceptados/rechazados, ranking semanal (HERO, VILLAIN, profundidad) y nivel del usuario calculado solo con los criterios de esa party. |

Feedback: toast de level-up / level-down, XP flotante, aviso de adelantamientos en el ranking. Transiciones con View Transitions API (`src/viewTransition.ts`).

## 3. Stack

React 19 + TypeScript 6 + Vite 8 + Tailwind CSS v4 (sin config, tokens en `@theme` de `src/index.css`) + lucide-react. Lint con oxlint. Versiones exactas en `app/package.json`.

Sin router, sin gestor de estado, sin backend. Tests con Vitest (`npm test`): `selfcheck.ts` más tests de las funciones puras de `storage.ts`. CI en GitHub Actions (`.github/workflows/ci.yml`: lint, build y test en cada push/PR).

## 4. Arquitectura

- **Fuente de verdad:** `ActivityEvent[]` (`{ id, trackerId, amount, occurredAt, undoes? }`). Todo lo demás (stats, XP, niveles, rankings, criterios de party) se deriva en cada render con `useMemo` en `App.tsx`. Las correcciones son eventos con `amount` negativo; deshacer es un negativo con el mismo `occurredAt` y `undoes: <id>` del positivo anulado (nunca se borra ni edita un evento).
- **`app/src/core/`** — TypeScript puro, sin React:

| Archivo | Responsabilidad |
|---|---|
| `types.ts` | Tipos de dominio. |
| `trackers.ts` | 6 actividades fijas + `allTrackers(custom)`. |
| `stats.ts` | Semanas lun–dom sobre strings `YYYY-MM-DD`, rangos `[start, end)` lexicográficos. `localDate(Date)` da la fecha local real. `dayTotal`, `clampAmount` (la corrección no baja el día de 0), `history()` (últimos registros con `undone`/`canUndo`) y `dayLabel`. |
| `rpg.ts` | `deriveGame()`: XP = allTime × `xpPerUnit`; umbrales lineales `THRESHOLD` (actividad 60, rama 200, player 250). `diffLevelUps/Downs()`. |
| `party.ts` | `PARTIES` hardcodeadas; votación simulada por `stance` (mayoría estricta); estado por party con su propio `deriveGame`. |
| `classify.ts` | `classifyAI()` (Claude Haiku vía proxy) con fallback a `classify()` (palabras clave). `findSimilar()` (prefijo + Levenshtein). |
| `storage.ts` | Única capa de persistencia (localStorage): validadores puros `readEvents` (repara un `undoes` inválido conservando el evento)/`readCustom`, `loadAll` con backup, bloqueo de claves, exportar/importar. |
| `seed.ts` | `seedFor(today)`: 28 eventos de ejemplo relativos a semanas enteras respecto a `today`. `DEMO_DATE` y `SEED_EVENTS` solo los usan selfcheck y tests. |
| `selfcheck.ts` | Asserts de dominio, se ejecutan en DEV al arrancar y en `npm test`. |

- **UI:** `App.tsx` tiene todo el estado y la navegación; `src/components/` son presentacionales con callbacks.
- **Persistencia:** localStorage `life-rpg-demo-v1` (eventos) y `life-rpg-custom-v1` (`{ trackers, proposals }`), validados al leer (eventos y custom). Si hay datos ilegibles o inválidos, el valor bruto se copia a `<clave>.backup.<stamp>` antes de sobrescribir y se avisa en la home; clave ilegible → arranca vacía (no semilla). `life-rpg-meta-v1` (`{ lastExportAt }`) guarda la última exportación. Antes de borrar o importar se hace copia interna atómica de eventos+custom en `<clave>.backup.last` (rota a `.backup.prev`); si falla, se aborta con aviso. `exportData` pide `navigator.storage.persist()`. Si el backup falla, la clave se bloquea (`save*` no escribe) hasta importar una copia.
- **IA:** `vite.config.ts` monta un proxy `/api/claude` → `api.anthropic.com` solo en `dev`/`preview`, con `ANTHROPIC_API_KEY` de `app/.env.local` (nunca entra al bundle). En un build estático no existe y siempre se usa la heurística.

## 5. Herencia de la demo (lo que falta para producción)

Cosas que funcionan pero son atajos de hackathon. Ninguna está decidida; cada una requiere decisión de producto/técnica antes de tocarla.

| Área | Estado actual | Implicación |
|---|---|---|
| Fecha | Resuelto en ciclo 2: «hoy» es la fecha local real, recalculada en cada render y al volver a la pestaña. | `App.tsx:46` llama `localDate(new Date())` en render (1 warning `react(purity)` de oxlint, exit 0). |
| Datos iniciales | Resuelto en ciclo 2: arranque vacío; «Cargar ejemplo» carga `seedFor(hoy)`; «Borrar todo» vacía. | Si `getItem` lanza, se devuelve `[]` (sin pérdida). |
| Party | Amigos, parties y votos son ficticios y deterministas (`PARTIES`, `stance`). | Requiere backend, cuentas e invitaciones para ser real. |
| Usuarios | Un único usuario local, sin cuenta. | Sin auth ni sincronización entre dispositivos. |
| Persistencia | Solo localStorage del navegador, con exportar/importar manual. Las claves llevan «demo» en el nombre. | Pérdida de datos al borrar el navegador (persist es solo petición); recordatorio fijo de 14 días, sin copias automáticas, sin UI para restaurar backups internos (manual en DevTools) ni migraciones de esquema. |
| IA | Proxy de Vite solo en local; sin reintentos, caché ni límite de uso. | Necesita un endpoint de servidor para funcionar desplegada. |
| Progresión | Umbrales lineales y XP/unidad fijos; sin límite de registros por día; solo la corrección se limita al total del día. | Balance de juego sin validar con usuarios. |
| Calidad | `npm test` (Vitest) solo cubre selfcheck y funciones puras de storage; sin tests de componentes ni e2e. CI ya existe (ciclo 2). | Añadir cobertura de UI si el proyecto crece. |
| Copy | Quedan textos y claves con «demo» (`life-rpg-demo-v1`, «Party de ejemplo»). | Revisar cuando se quiten los atajos anteriores. |

Simplificaciones marcadas en código con `ponytail:` (límite conocido + cómo crecer): `classify.ts` (heurística por palabras clave, llamada única a Claude sin reintentos, similitud por prefijo/erratas) y `vite.config.ts` (proxy solo en dev) y `storage.ts` (restaurar backup interno manual; copia de dos niveles; `persist()` solo petición; recordatorio fijo a 14 días) y `App.tsx` («hoy» recalculado en render y al volver a la pestaña) y `stats.ts` (`history` recorre todos los eventos por tarjeta, O(n·tarjetas)).

## 6. Cómo trabajar

Desde `app/`:

- `npm run dev` — servidor de desarrollo; en la consola del navegador aparece `[selfcheck] done` (los fallos salen como `console.assert`).
- `npm run build` — `tsc -b && vite build` (también es el type-check).
- `npm run lint` — oxlint.
- `npm test` — Vitest (`vitest run`): selfcheck + tests de `storage.ts`.
- IA opcional: crear `app/.env.local` con `ANTHROPIC_API_KEY=...`.

Regla: `selfcheck.ts` es el oráculo del dominio; si falla, se arregla el motor, no los asserts (salvo cambio de reglas decidido explícitamente).

## 7. Documentos

| Documento | Estado |
|---|---|
| `docs/ESTADO-ACTUAL.md` | **Vigente.** Este documento. |
| `docs/STYLE_GUIDE.md` | **Vigente.** Tokens, tipografía, tono visual. |
| `docs/DESIGN-V2.md` | Vigente como descripción de pantallas; nació para la demo. |
| `MVP-RPG.md`, `docs/PRD-V2.md` | Histórico: PRD de la demo (V1 y V2). Útiles para entender el porqué de reglas. |
| `docs/TECH_SPEC.md`, `docs/TECH_SPEC-V2.md` | Histórico: specs de la demo. Las fórmulas y decisiones siguen implementadas tal cual. |
