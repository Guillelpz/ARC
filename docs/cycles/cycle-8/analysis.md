# Análisis ciclo 8 — objetivos editables en las fijas HERO (P7.2b)

## Entregado frente a lo especificado
Completo: Gym, BJJ, Running y Reading editan su objetivo semanal desde la tarjeta; override en `life-rpg-custom-v1` (`goals?`), validado en `readCustom`, conservado en backup/export/import/«Borrar todo». Asserts G1-G4, tests C6-C9 y U13; 57 tests. Recortado por diseño: P7.2a (límite VILLAIN) y editar nombre/incremento/XP de fijas.

## Deuda nueva
- menor: `setGoal` persiste `goals: {}` al volver al valor por defecto (inocuo; `readCustom` normaliza).
- menor: `App.tsx:126` llama a `proposeTo` con `allTrackers(c.trackers)` sin `goals`; hoy no afecta.
- `ponytail:` nuevo: solo el ya existente de `UnknownView` (archivadas) aparece en el diff; ningún `ponytail:` propio del ciclo.
- Una versión anterior de la app perdería `goals` al guardar `custom` (spec §10); irrelevante sin despliegues antiguos.

## Fricción del proceso
Sin bloqueos: review aprobada a la primera, 0 bloqueantes. Solo coordinación de docs en paralelo con otro agente (hay que hacer `git add` selectivo).

## Riesgos para el siguiente ciclo
- Cambiar el objetivo recalcula las rachas pasadas de forma retroactiva (regla del ciclo 7); puede sorprender al usuario.
- P7.2a (límite VILLAIN) sigue pendiente de decisión de producto.
- Las fijas VILLAIN siguen sin objetivo; la asimetría HERO/VILLAIN crece.
