# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RPG Life Tracker: app que convierte hábitos (HERO) y vicios (VILLAIN) en XP y niveles, con PARTY (hoy simulada). Nació como demo de hackathon y ahora está en desarrollo real: el estado actual y la deuda heredada de la demo están en `docs/ESTADO-ACTUAL.md`. Responder al usuario en español.

## Comandos (desde `app/`)

- `npm run dev` — Vite dev server. En DEV, `main.tsx` ejecuta `runSelfCheck()` (`src/core/selfcheck.ts`): los fallos salen como `console.assert` en la consola del navegador y termina con `[selfcheck] done`.
- `npm run build` — `tsc -b && vite build` (es también el type-check).
- `npm run lint` — oxlint (`.oxlintrc.json`) con `--deny-warnings`: cualquier warning rompe la CI.
- `npm test` — Vitest: ejecuta `selfcheck.ts` (falla si algún `console.assert` es falso) los tests de `core/` y los de UI (`src/App.test.tsx`, Testing Library + happy-dom) y el chequeo axe (`src/a11y.test.tsx`).
- `npm run e2e` — Playwright + Chromium sobre un build con `BASE_PATH=/ARC/` (archivos `app/e2e/*.e2e.ts`); `npm test` no lo incluye. Corre en su propio job de la CI.
- `selfcheck.ts` es el oráculo de dominio: si falla, se arregla el motor, nunca los asserts. Para cambios de código, pasar `build`, `lint` y `test`; si cambia `core/`, revisar los asserts afectados.

## Documentos

- `docs/ESTADO-ACTUAL.md` (pantallas, detalles de implementación, lo que falta para producción), `docs/DEPLOY.md` (despliegue a Pages), `docs/STYLE_GUIDE.md` (tokens, tipografía, botones, tono) y `docs/cycles/STATE.md` (ciclo en curso y decisiones vigentes del usuario).
- Las specs y documentos de ciclos ya implementados se eliminan; el porqué de las reglas antiguas queda en el historial de git.
- Las instrucciones recientes del usuario prevalecen sobre cualquier documento.

## Arquitectura

- **`ActivityEvent[]` es la única fuente de verdad.** Stats, XP, niveles, ranking y criterios de party se derivan en cada render (`useMemo` en `App.tsx`); nunca se guardan derivados. Las correcciones son eventos con `amount` negativo.
- `app/src/core/` es TypeScript puro, sin React:
  - `stats.ts` — semanas lun–dom sobre strings `YYYY-MM-DD` (comparación lexicográfica, rangos `[start, end)`); compara la semana en curso hasta hoy con el mismo tramo de la anterior. `dayTotal`/`clampAmount` (el «−» no baja de 0 en el día elegido) `undoneIds`, `goalAt`, `streak` (con el objetivo vigente de cada semana), `weekly` (últimas 8 semanas) y `todaySummary` (racha semanal y bloque «Hoy», derivados, no se guardan) e `history` (últimos registros; `undoes?` en `ActivityEvent` enlaza un deshacer con su registro).
  - `rpg.ts` — `deriveGame()`: XP = allTime × `xpPerUnit`; umbrales lineales `THRESHOLD` (actividad 60, rama 200, player 250). `diffLevelUps()` compara dos `GameState` para el toast.
  - `party.ts` — parties y amigos hardcodeados (`PARTIES`); votación simulada por `stance` de rama (mayoría estricta); ranking con amigos prorrateados por día de la semana (`buildRanking(…, today)`); cada party deriva su propio `GameState` solo con sus criterios aceptados.
  - `classify.ts` — `classifyAI()` llama a Claude Haiku vía el proxy de Vite `/api/claude`, solo en `npm run dev` (key en `app/.env.local` como `ANTHROPIC_API_KEY`); sin key o en cualquier build (`__AI_PROXY__` false) ni llama; ante cualquier fallo usa `classify()`, la heurística determinista por palabras clave que comprueba el selfcheck.
  - `gym.ts` — módulo Gym: catálogo de 21 ejercicios, unidades kg/lbs, series (`GymSet`/`GymUndo`, solo de añadir), récords derivados (peso máximo, 1RM Epley, más repeticiones) sesión automática del tracker `gym` (`autoSession`/`retractAuto`, evento real con id `gym-auto-<día>`) con la regla «día con series vivas ⇒ ≥ 1 sesión» (`ensureAuto`/`setDays`), progreso (`weeklyBest1rm`: mejor 1RM por semana), volumen por grupo (`groupVolume`), `gymDay` (fila de «Hoy») y rutinas (`routineFromDay`/`routineProgress`, máx. 20). Los asserts GY1-GY22 están en `selfcheck.ts`.
  - `voice.ts` — registro de series por voz: `parseGym` (parser determinista ES/EN con `ALIASES`, números en palabra, «3x5», unidad dicha o preferencia), `isComplete`, `draftText`, `fromAI`, `pickDraft`; `haiku.ts` — `askHaiku` (fetch directo a Anthropic, `claude-haiku-5-5`, con la clave del usuario) e `interpretGym` (parser + Haiku, gana el borrador completo; cualquier fallo → parser). Asserts VZ1-VZ16 y GY22 (`undoMany`) en `selfcheck.ts`. `src/speech.ts` (fuera de `core/`) envuelve la Web Speech API (`beginListen` arranca la escucha dentro del gesto).
  - `capture.ts` — captura rápida por voz desde el «+»/«Nuevo»/«Dictar»: `routeCapture` (determinista, siempre se ejecuta y es el respaldo) reparte la frase entre gym, hábito existente (`matchTracker` de `classify.ts`, `resolveAmount`) o hábito nuevo (`newFromText`); `interpretCapture` (en `haiku.ts`) añade Haiku y combina con `pickCapture`. Otro día → no guarda. Sin clave el parser limita la confianza a «media» (un hábito nuevo nunca se crea solo). Asserts CV1-CV11 en `selfcheck.ts`.
  - `trackers.ts` (trackers fijos + custom), `seed.ts` (`seedFor(today)` desplaza los 28 eventos de ejemplo por semanas; `DEMO_DATE` solo fija la fecha del selfcheck), `types.ts`.
  - `merge.ts` — `mergeBackup(local, incoming)`: fusión pura de copias («Importar y fusionar»): conserva lo local, añade eventos nuevos (ids en conflicto → `id~n`, reasignando `undoes`), idempotente, sin mutar; custom por spec; la regla de ids/`undoes` es el helper `mergeLog`, que también fusiona las series y los ejercicios propios del gym (gana la unidad local). Los asserts M1-M8 están en `selfcheck.ts`.
  - `storage.ts` — única capa de persistencia: localStorage `life-rpg-demo-v1` (eventos) y `life-rpg-gym-v1` (`GymData`: series, ejercicios propios, unidad y `routines` opcionales, validadas en `readGym` y fusionadas por id; entra en backups, export/import y fusión; una copia sin `gym` deja el gym local vacío al importar) y `life-rpg-custom-v1` (trackers custom + propuestas + `goals`, overrides de objetivo de las fijas HERO, + `goalLog`, objetivos anteriores para la racha), con validación (incl. `weeklyGoal`/`archived` de trackers custom); clave ausente → vacío, clave corrupta → backup `<clave>.backup.<stamp>` + aviso. Exportar/importar copia en JSON (`life-rpg-meta-v1` guarda la fecha de la última exportación); antes de importar o «Borrar todo», `backupCurrent` copia de forma atómica a `.backup.last` (rotando a `.backup.prev`); `restoreLast` restaura `.backup.last` intercambiándola con el estado actual (botón «Recuperar copia anterior»). Dos claves de este dispositivo, **fuera de copias, fusión, `backupCurrent` y «Borrar todo»**: `life-rpg-ai-key-v1` (clave de Anthropic del usuario) y `life-rpg-voice-v1` (aviso de privacidad de la voz). `requestPersist()` se pide al exportar. «Compartir copia» usa `navigator.share` solo en la PWA instalada con táctil y `canShare`; si no, descarga.
- PWA: `vite.config.ts` genera `sw.js` en el build (solo PROD; `dev` no registra service worker) y el aviso de versión nueva sale en la UI. **Todo push a main que toque `app/` despliega a producción (GitHub Pages)** tras lint, test y e2e. Kill switch: `sw_kill` en `deploy-pages.yml` (`SW_KILL=1`), ver `docs/DEPLOY.md`.
- `App.tsx` tiene todo el estado y la navegación por `screen` (`home | hero | villain | new | party | me | gym`; Gym cuelga de la pestaña «Yo»), sin router. Los componentes de `src/components/` son presentacionales y reciben callbacks.
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
