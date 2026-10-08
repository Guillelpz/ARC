# Estado del workflow

Ver `docs/WORKFLOW.md`.

## En curso

- Ciclo 1 — paso 4 (spec): P1.4 + P1.3.

## Decisiones del usuario (2026-10-08)

- Onboarding: si entra en un ciclo, el usuario nuevo arranca **vacío** con un botón «Cargar ejemplo» que carga los datos semilla.
- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1`: no se renombran.

## Propuestas

| id | título | estado | ciclo |
|---|---|---|---|
| P1.1 | Fecha real (con cambios de evaluation.md) | aprobada | 2 |
| P1.2 | Onboarding vacío + «Cargar ejemplo» (con cambios, sin renombrar claves) | aprobada | 2 |
| P1.3 | No perder datos: validar al leer + exportar/importar (con cambios) | aprobada | 1 |
| P1.4 | Tests ejecutables `npm test` (con cambios) | aprobada | 1 |
