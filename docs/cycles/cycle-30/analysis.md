# Análisis ciclo 30 — Comida: propios, platos y resumen semanal

## Entregado frente a lo especificado
Todo lo de §9: alimentos propios (crear, archivar, reactivar, nombres únicos), platos guardados (añadir de un toque, máx. 20) y resumen semanal (SVG con lista sr-only, media sobre días con registros). Review APROBADO (228 tests). Con esto la fase 1 de Comida queda completa y `docs/TECH_SPEC-food.md` se elimina. No se recortó nada; `deleteMeal` sin confirmación fue una desviación avisada y aceptada.

## Deuda nueva
- 5 menores sin corregir: nombres de plato repetidos, `deleteMeal` sin confirmar, `addMeal` con plato inexistente sin aviso, media como «X / Y kcal/día», `useFood` sin extraer (ya en ESTADO-ACTUAL §4).
- `ponytail:` nuevo: extraer `useFood` pasado de ~550 líneas de `App.tsx` (ahora 551).

## Fricción del proceso
Sin fallos de workflow. Costó el volumen: el implementer añadió handlers de propios/platos a `App.tsx` en lugar de extraer antes; conviene que la spec fije «refactor primero» cuando un `ponytail:` de tamaño esté a punto de saltar.

## Huecos y entrada para las fases 2 y 3
- **Previo a la fase 2: extraer `useFood`** (estado, handlers de diario, propios, platos, objetivo y `dietSync`) a `src/useFood.ts`, como primer ciclo o T1. Sin esto cada integración engorda `App.tsx`.
- **Fase 2 (investigar integraciones):** el modelo ya guarda instantánea por entrada con `ref` (fdcId) y `Food` propios, así que un alimento externo encaja como `Food` propio con `ref` de origen sin migrar. Preguntas: Open Food Facts (licencia ODbL, código de barras, sin clave) frente a USDA API (clave, límites); coste de la dependencia de red en una app sin backend; la atribución; y no usar MyFitnessPal (API cerrada). Decidir si el dato externo se copia al dispositivo (offline, ya es el patrón) o se consulta siempre.
- **Fase 3 (voz):** reutilizar `capture.ts`/`haiku.ts`/`memory.ts`; falta añadir alias EN al catálogo (los nombres son solo ES), parser de «200 g de arroz» con `parseQty`, y `routeCapture` hoy no conoce Comida (una frase de comida iría a hábito nuevo). Riesgos: raciones ambiguas («un plato de pasta»), coincidencias aproximadas contra 130 alimentos y la regla de «otro día no guarda». Prever e2e y asserts equivalentes a CV/MC.
- **Riesgos abiertos:** la prueba manual en iPhone sigue pendiente; el resumen semanal nunca se ha visto con datos reales de varias semanas; el catálogo de 130 alimentos puede quedarse corto, medir qué buscan sin resultado antes de ampliar.
