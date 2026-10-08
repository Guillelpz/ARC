# Análisis ciclo 6

## Entregado frente a lo especificado
- P4.3 completo: editar nombre, incremento y objetivo (solo HERO) y archivar/reactivar actividades propias; el XP pasado no cambia (`editTracker`, asserts E1-E5, esquema compatible con copias antiguas).
- P4.5 completo: `App.test.tsx` con Testing Library + happy-dom (registrar, día pasado, corrección, deshacer, Tus datos, editar/archivar). 50 tests en 3 ficheros.
- Sin recortes visibles. Las devDependencies nuevas (incl. `@testing-library/dom`) estaban autorizadas en la spec: el menor 5 de la review queda cerrado.

## Deuda nueva
- Menores sin corregir: (1) archivar desde el formulario descarta cambios sin guardar; (2) se puede crear una misión con el nombre de una archivada (`ponytail:` en `App.tsx:115`); (3) `dropped` cuenta también trackers reparados, el mensaje de importación puede decir "descartados" sin pérdida; (4) U1 usa `getByText('1')`, frágil.
- `ponytail:` nuevo: solo el de `UnknownView` (1).

## Fricción del proceso
- La review fue limpia (APROBADO, 0 bloqueantes). El único ruido fue el menor 5, falso positivo: el reviewer no cruzó las dependencias con la sección de decisiones de la spec. Conviene indicárselo.
- Conflicto de escritura concurrente en `docs/` con otro agente: usar `git add` por archivo.

## Riesgos para el siguiente ciclo
- Los tests de UI dependen de textos y de `DEMO_DATE`/fecha: cambios de copy los romperán; tratar esos fallos como mantenimiento, no como regresión de dominio.
- Resolver (2) y (3) antes de que haya usuarios reales con archivadas e importaciones.
- Sigue sin cubrirse e2e en navegador real ni la UI de IA.
