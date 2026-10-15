# Análisis ciclo 29 — Comida (núcleo)

## Entregado frente a lo especificado
- Entregado: pantalla Comida (objetivo kcal + %, diario con deshacer, buscador, cantidades, añadido rápido), clave `life-rpg-food-v1` con export/import/fusión/recuperar, tracker fijo Dieta con +1 automático (`dietSync`) y tests (selfcheck FD, UI, axe, e2e). Review aprobado sin bloqueantes.
- Recortado: catálogo de 130 filas en vez de 140 (sin ficha FDC); alimentos propios, platos y resumen semanal pasan al ciclo 30 (misma spec, no se borra).

## Deuda nueva
- Menores: la spec dice «140» (histórica); `sameFood` en `merge.ts` con `JSON.stringify`.
- `ponytail:` nuevos: nombres con estado de cocinado; cuota de localStorage (~5 años); líquidos con valores por 100 g sobre 100 ml (error ≤ 4 %); `useFood` pendiente de extraer si `App.tsx` pasa de ~550 líneas.
- Catálogo sin contrastar con BEDCA; sin alimentos españoles típicos.

## Fricción del proceso
- El test U-C1 fue inestable (~1/6 con carga) y exigió un commit posterior al merge (`asyncUtilTimeout` 3 s). Debería detectarse antes del merge: el reviewer debería repetir `npm test` varias veces.
- El implementer tuvo que desviarse de la spec (140 → 130) por falta de fichas FDC; la spec debía permitir rango desde el inicio (lo hizo).

## Riesgos para el ciclo 30
- Alimentos propios y platos tocan `mergeLog`/fusión: cuidar ids y la instantánea de entradas.
- La Dieta depende del objetivo vigente: cambios retroactivos en rango deben seguir sin reescribir el pasado.
- Crecimiento de `App.tsx` y de localStorage; la voz (fase 3) y fuentes externas (fase 2) siguen sin planificar.
