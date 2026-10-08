# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RPG Life Tracker: app que convierte hábitos (HERO) y vicios (VILLAIN) en XP y niveles, con PARTY (hoy simulada). Nació como demo de hackathon y ahora está en desarrollo real: el estado actual y la deuda heredada de la demo están en `docs/ESTADO-ACTUAL.md`. Responder al usuario en español.

## Comandos (desde `app/`)

- `npm run dev` — Vite dev server. En DEV, `main.tsx` ejecuta `runSelfCheck()` (`src/core/selfcheck.ts`): los fallos salen como `console.assert` en la consola del navegador y termina con `[selfcheck] done`.
- `npm run build` — `tsc -b && vite build` (es también el type-check).
- `npm run lint` — oxlint (`.oxlintrc.json`).
- `npm test` — Vitest: ejecuta `selfcheck.ts` (falla si algún `console.assert` es falso) los tests de `core/` y los de UI (`src/App.test.tsx`, Testing Library + happy-dom).
- `selfcheck.ts` es el oráculo de dominio (TECH_SPEC §5/§10 y §4.6 de V2): si falla, se arregla el motor, nunca los asserts. Para cambios de código, pasar `build`, `lint` y `test`; si cambia `core/`, revisar los asserts afectados.

## Documentos

- **Vigente:** `docs/ESTADO-ACTUAL.md` (qué hay, arquitectura, lo que falta para producción), `docs/STYLE_GUIDE.md` (tokens, tipografía, botones, tono) y `docs/DESIGN-V2.md` (pantallas).
- **Histórico (demo):** `MVP-RPG.md`, `docs/PRD-V2.md`, `docs/TECH_SPEC.md`, `docs/TECH_SPEC-V2.md`. Explican el porqué de las reglas implementadas; no fijan el alcance futuro.
- Las instrucciones recientes del usuario prevalecen sobre cualquier documento.

## Arquitectura

- **`ActivityEvent[]` es la única fuente de verdad.** Stats, XP, niveles, ranking y criterios de party se derivan en cada render (`useMemo` en `App.tsx`); nunca se guardan derivados. Las correcciones son eventos con `amount` negativo.
- `app/src/core/` es TypeScript puro, sin React:
  - `stats.ts` — semanas lun–dom sobre strings `YYYY-MM-DD` (comparación lexicográfica, rangos `[start, end)`); compara la semana en curso hasta hoy con el mismo tramo de la anterior. `dayTotal`/`clampAmount` (el «−» no baja de 0 en el día elegido) `undoneIds`, `streak` y `todaySummary` (racha semanal y bloque «Hoy», derivados, no se guardan) e `history` (últimos registros; `undoes?` en `ActivityEvent` enlaza un deshacer con su registro).
  - `rpg.ts` — `deriveGame()`: XP = allTime × `xpPerUnit`; umbrales lineales `THRESHOLD` (actividad 60, rama 200, player 250). `diffLevelUps()` compara dos `GameState` para el toast.
  - `party.ts` — parties y amigos hardcodeados (`PARTIES`); votación simulada por `stance` de rama (mayoría estricta); ranking con amigos prorrateados por día de la semana (`buildRanking(…, today)`); cada party deriva su propio `GameState` solo con sus criterios aceptados.
  - `classify.ts` — `classifyAI()` llama a Claude Haiku vía el proxy de Vite `/api/claude` (key en `app/.env.local` como `ANTHROPIC_API_KEY`); ante cualquier fallo usa `classify()`, la heurística determinista por palabras clave que comprueba el selfcheck.
  - `trackers.ts` (trackers fijos + custom), `seed.ts` (`seedFor(today)` desplaza los 28 eventos de ejemplo por semanas; `DEMO_DATE` solo fija la fecha del selfcheck), `types.ts`.
  - `storage.ts` — única capa de persistencia: localStorage `life-rpg-demo-v1` (eventos) y `life-rpg-custom-v1` (trackers custom + propuestas + `goals`, overrides de objetivo de las fijas HERO), con validación (incl. `weeklyGoal`/`archived` de trackers custom); clave ausente → vacío, clave corrupta → backup `<clave>.backup.<stamp>` + aviso. Exportar/importar copia en JSON (`life-rpg-meta-v1` guarda la fecha de la última exportación); antes de importar o «Borrar todo», `backupCurrent` copia de forma atómica a `.backup.last` (rotando a `.backup.prev`); `restoreLast` restaura `.backup.last` intercambiándola con el estado actual (botón «Recuperar copia anterior»). `requestPersist()` se pide al exportar.
- `App.tsx` tiene todo el estado y la navegación por `screen` (`home | hero | villain | new | party`), sin router. Los componentes de `src/components/` son presentacionales y reciben callbacks.
- Fechas: fecha local real (`localDate` en `stats.ts`; `nowStamp(day?)` en `App.tsx`); cada pantalla de misiones tiene selector de día (sin futuro). Usuario nuevo arranca vacío con «Cargar ejemplo».

## Restricciones

- Hoy no hay backend, auth ni sincronización y PARTY es simulada (ver §5 de `docs/ESTADO-ACTUAL.md`). Cambiarlo, o añadir dependencias, requiere decisión explícita del usuario. No añadir funcionalidades fuera del encargo.
- Estilo: Tailwind v4 sin config; tokens en `@theme` de `src/index.css`. Sin hex ni `slate-*` en componentes. HERO claro / VILLAIN oscuro, sin mezclar paletas.
- Comentarios `ponytail:` marcan simplificaciones deliberadas con su límite.

## Agentes y skills

- `.claude/agents/tech-lead.md` — PRD → especificación técnica y backlog (escribe en `docs/`, no implementa). Lee `docs/ESTADO-ACTUAL.md` y el código; escribe specs incrementales `docs/TECH_SPEC-<tema>.md`.
- Workflow de ciclos (`docs/WORKFLOW.md`, estado en `docs/cycles/STATE.md`): `product-strategist` → `proposal-evaluator` → okay del usuario → `tech-lead` → `implementer` → `reviewer` → merge → `cycle-analyst`. Agentes en `.claude/agents/` (aún sin espejo en `.codex/`).
- `.claude/skills/frontend-stylist` — revisión/corrección de coherencia visual contra `docs/STYLE_GUIDE.md`; no toca `src/core/`.
- `AGENTS.md` y `.codex/agents/` contienen las mismas instrucciones para Codex (sincronizar a mano al editar).
