# Workflow de ciclos (spec-driven, orquestado por agentes)

La sesión principal de Claude Code orquesta. Los agentes de `.claude/agents/` hacen el trabajo y se pasan la información **por archivos**, no por el chat.

## Ciclo N

| # | Paso | Agente (modelo) | Produce | Gate |
|---|---|---|---|---|
| 1 | Proponer | `product-strategist` (opus) | `docs/cycles/cycle-N/proposals.md` | — |
| 2 | Evaluar | `proposal-evaluator` (opus) | `docs/cycles/cycle-N/evaluation.md` | — |
| 3 | **Aprobación** | usuario | decisión en `STATE.md` | **okay del usuario** |
| 4 | Especificar y diseñar | `tech-lead` (opus) | `docs/TECH_SPEC-<tema>.md` | Si añade «Decisiones que requieren aprobación» no cubiertas en 3 → okay del usuario |
| 5 | Implementar | `implementer` (sonnet) | rama `cycle-N`, un commit por tarea | build + lint verdes |
| 6 | Revisar | `reviewer` (sonnet) | `docs/cycles/cycle-N/review.md` | `CAMBIOS` → vuelve a 5 (máximo 2 vueltas; después se pregunta al usuario) |
| 7 | Integrar | orquestador | merge `--no-ff` a `main` | build + lint en `main` |
| 8 | Analizar | `cycle-analyst` (sonnet) | `analysis.md`, `ESTADO-ACTUAL.md` actualizado | — |
| 9 | Avisar | orquestador | resumen en el chat y notificación push | — |

**Solapamiento:** cuando el ciclo N entra en el paso 5, se lanzan los pasos 1-2 del ciclo N+1 y sus propuestas se envían al usuario. Así la aprobación llega mientras N se implementa. Sin aprobación no empieza ningún paso 4.

## Reglas

- **Al usuario solo le llegan** las propuestas evaluadas (paso 3), las decisiones de spec no cubiertas (paso 4), los bloqueos sin salida y el aviso de fin de ciclo.
- **Mientras se espera un okay:** se sigue solo con lo ya aprobado; si no queda nada aprobado, el workflow se para.
- Las dependencias de desarrollo están permitidas. Las de runtime, el backend, las cuentas y los cambios de reglas de juego necesitan okay.
- Git: `main` es estable; cada ciclo trabaja en `cycle-N`. Sin remoto ni push.
- El usuario para el workflow cuando quiera; el estado queda en `STATE.md` para retomarlo.

## Economía de tokens

- Cada agente devuelve un resumen de ≤10 líneas; el detalle queda en su archivo. El orquestador no lee diffs ni specs completas: solo las secciones de decisiones y backlog si las necesita.
- Un `implementer` por spec (no por tarea). Las correcciones reutilizan el mismo agente con SendMessage si sigue vivo.
- Las comprobaciones mecánicas (build, lint, merge) las ejecuta el orquestador directamente, sin lanzar agentes.
- Los agentes leen primero con Grep y diffs; los documentos históricos de la demo solo cuando hacen falta.
- Opus solo donde el criterio importa (proponer, evaluar, especificar).

## Invocación

Si un agente de `.claude/agents/` no está registrado en la sesión (pasa con los que se crean a mitad de sesión), se lanza `general-purpose` con el modelo del frontmatter y la instrucción «Lee `.claude/agents/<nombre>.md` y actúa según ese rol».

## Estado

`docs/cycles/STATE.md` es la memoria del workflow: ciclo en curso, paso, propuestas aprobadas, rechazadas o pendientes. Lo actualiza solo el orquestador.
