# Estado del workflow

Ver `docs/WORKFLOW.md`.

## En curso

Orden: 9 → 10. El primero no cerrado de la lista es el siguiente a especificar.

- Ciclo 1 — cerrado (a712108).
- Ciclo 2 — cerrado (7982124).
- Ciclo 3 — cerrado.
- Ciclo 4 — cerrado.
- Ciclo 5 — cerrado (bc660e8).
- Ciclo 6 — cerrado (df87f37).
- Ciclo 7 — cerrado (ef60fdc).
- Ciclo 9 (P9.2 + P9.3) — paso 4 (spec).
- Ciclo 10 (P9.1 + P9.4): aprobado.
- Ciclo 8 — cerrado (3906d6f). P7.2a no aprobada todavía.

## Decisiones del usuario (2026-10-08)

- Onboarding: si entra en un ciclo, el usuario nuevo arranca **vacío** con un botón «Cargar ejemplo» que carga los datos semilla.
- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1`: no se renombran.
- P4.2: campo opcional `undoes?` en `ActivityEvent` aprobado.
- P7.1 rachas: semanal por actividad, sin XP, la semana en curso no la rompe, objetivo actual también hacia atrás; `pop` en tarjeta + mejor racha en «Hoy».
- P9.3: prorrateo lineal de la XP semanal de los amigos simulados por día transcurrido; asserts de ranking actuales se mueven al domingo 2026-10-11 + asserts nuevos de miércoles y lunes.
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
| P4.1 | Registrar en otro día (con cambios de evaluation.md) | aprobada | 4 |
| P4.2 | Historial + deshacer concreto (`undoes?`) | aprobada | 4 |
| P4.3 | Editar/archivar actividades propias | aprobada | 6+ |
| P4.4 | Restaurar `.backup.last` desde la app (rehecha por el evaluador) | aprobada | 5 |
| P4.5 | Tests de componentes (RTL + jsdom) | aprobada | 6+ |
| P7.1 | Rachas semanales (regla aprobada tal cual) | aprobada | 7 |
| P7.2a | Límite semanal opcional en VILLAIN | pendiente (no aprobada) | — |
| P7.2b | Objetivos editables en las 6 fijas | aprobada | 8 |
| P7.3 | Bloque «Hoy» en la home | aprobada | 7 |
| P7.4 | Cerrar menores del ciclo 4 (deshacer) | aprobada | 7 |
| P9.1 | Cerrar menores del ciclo 6 (después del ciclo 8) | aprobada | 10 |
| P9.2 | Proponer a una party una actividad existente | aprobada | 9 |
| P9.3 | Ranking prorrateado (regla aprobada) | aprobada | 9 |
| P9.4 | Avisos accesibles + axe | aprobada | 10 |
