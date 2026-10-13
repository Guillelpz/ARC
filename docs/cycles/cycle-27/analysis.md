# Análisis ciclo 27 — captura rápida por voz

## Entregado frente a lo especificado
T1-T7 completos: `core/capture.ts` (router determinista), Haiku (`postHaiku`, `interpretCapture`), `CaptureView`/`CaptureCards`, entradas «+», «Nuevo» y «Dictar», gym, hábito existente (páginas→min en Reading), hábito nuevo con cuenta atrás de 10 s solo con IA y confianza alta, otro día rechazado. Asserts CV1-CV11, tests U-C*, a11y y e2e (E10, E11). Review APROBADO, 196 tests. Recortes deliberados: fechas explícitas sin detectar, cantidades enteras 1..999, sin paso de party. Pendiente: prueba manual en iPhone (checklist de la spec) y T8 del ciclo 26.

## Deuda nueva
- menor: `diffLevels` por id (`core/rpg.ts:42`) sin assert propio en `selfcheck.ts`.
- menor: `CaptureCards.tsx` no detiene la cuenta atrás si la pestaña ya estaba oculta al aparecer la tarjeta.
- `ponytail:` nuevos: lista cerrada de «otro día» (sin fechas), «5,5 km» se guarda como 6, coincidencia palabra a palabra sin pesos, dos caminos de IA (`classifyAI` vs clave del usuario).
- E2E no ejecutado en el review (solo lo corre la CI al push).

## Fricción del proceso
- CV6 se repartió entre T1 y T2 porque depende de `pickCapture`: la spec debería ordenar asserts según la tarea que habilita su código.
- Cambios de comportamiento global (el «Dictar» de Hoy pasó a captura) obligaron a adaptar varios tests (A13, E8, U-V7); la spec podría listar de antemano los tests afectados.
- `CLAUDE.md`/`AGENTS.md` se actualizaron dentro del ciclo (T7), lo que evitó deriva.

## Riesgos para el siguiente ciclo
- Sin validar en iPhone real: gesto de micro dentro del toque, `KEYBOARD_ON_IOS`, cuenta atrás en PWA.
- Coste/latencia de Haiku por cada captura y clave en el navegador (riesgo asumido).
- Unificar `classifyAI` con la clave del usuario; usar datos de uso real antes de ampliar (fechas, multiactividad por frase).
