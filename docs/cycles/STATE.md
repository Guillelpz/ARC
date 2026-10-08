# Estado del workflow

Ver `docs/WORKFLOW.md`.

## En curso

- Ciclo 1 — cerrado (a712108).
- Ciclo 2 — cerrado (7982124).
- Ciclo 3 (P3.3 + P3.2) — paso 4 (spec).

## Decisiones del usuario (2026-10-08)

- Onboarding: si entra en un ciclo, el usuario nuevo arranca **vacío** con un botón «Cargar ejemplo» que carga los datos semilla.
- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1`: no se renombran.
- Repo remoto: lo crea el usuario. La CI se escribe para GitHub Actions; no hay push.

## Propuestas

| id | título | estado | ciclo |
|---|---|---|---|
| P1.1 | Fecha real (con cambios de evaluation.md) | aprobada | 2 |
| P1.2 | Onboarding vacío + «Cargar ejemplo» (con cambios, sin renombrar claves) | aprobada | 2 |
| P1.3 | No perder datos: validar al leer + exportar/importar (con cambios) | aprobada | 1 |
| P1.4 | Tests ejecutables `npm test` (con cambios) | aprobada | 1 |
| P3.1 | CI build+lint+test (GitHub Actions, push + PR; sin remoto todavía) | hecha | 2 |
| P3.2 | Almacenamiento persistente + aviso de copia → dentro de P3.3 | aprobada | 3 |
| P3.3 | Bloque «Tus datos» en la home (después de P1.1/P1.2) | aprobada | 3 |
| P3.4 | Despliegue + endpoint de IA | pospuesta (decisión del usuario: hosting, key, KV) | — |
| P3.5 | Cuentas + sincronización (partir en a/b) | pospuesta | — |
