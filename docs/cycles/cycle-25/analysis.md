# Análisis ciclo 25 — Gym 2

## Entregado frente a lo especificado
Según `TECH_SPEC-gym-2.md` (T1-T10) se entregó todo: progreso por ejercicio (mejor 1RM Epley por semana, 8 semanas, SVG con lista `sr-only`), volumen semanal por grupo, rutinas (guardar desde la sesión, cargar como guía con contadores por día, borrar; fusión por id con conflicto local), fila Gym en «Hoy» y regla «día con series vivas ⇒ ≥ 1 sesión» (`ensureAuto`, también tras importar, fusionar y recuperar). Rutinas viven en `life-rpg-gym-v1` (`routines` opcional). Asserts GY14-GY21; 127 tests + 6 e2e, axe en verde. Review: aprobado, 0 bloqueantes.
Recortado: edición de rutinas (solo borrar y volver a guardar), temporizador, nivel/XP de gym.
Desviaciones aceptadas: campo «Nombre de la rutina», GY21 movido a T10, texto del confirm «Rutinas: X → Y.», fila Gym sin encabezado.

## Deuda nueva
Menores sin corregir:
1. `readGym` (`storage.ts`) no deduplica ids de rutina: claves React repetidas y «Borrar» quita ambas con un archivo manipulado.
2. Reposición silenciosa de la sesión automática (`App.tsx:171`, `HomeView.tsx:150`): «−»/deshacer devuelve 0 sin aviso (consecuencia de 1A).
3. `GymView.tsx` ~380 líneas: extraer Progreso, Volumen y Rutinas al volver a tocarlo.
`ponytail:` nuevos: sesión manual deshecha con series vivas (ahora cubierta por `ensureAuto`, comentario por revisar), aviso repetido en lector de pantalla, ejercicio sin grupo ignorado en volumen.

## Fricción del proceso
Sin fallos graves. El comentario `ponytail:` de la copia sin gym quedó obsoleto al introducir `ensureAuto`; el implementer debería limpiar comentarios que la propia tarea invalida. Spec grande (10 tareas) con reordenaciones (GY21): conviene fijar el orden de asserts en la spec.

## Huecos y riesgos para el siguiente ciclo
- Propuestas pendientes: P24.6, P24.9, P24.11 (nivel/XP gym, sobrecarga, edición de rutinas/temporizador según backlog).
- Aviso al usuario cuando `ensureAuto` repone sesión (menor 2).
- Sin ejemplo cargable de gym; el volumen ignora ejercicios sin grupo de otras copias.
- Persistencia sigue siendo solo localStorage; el gym crece sin límite de series.
