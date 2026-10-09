# Estado del workflow

Ver `docs/WORKFLOW.md`.

## En curso

Orden: 16 → 17 → 14 (bloqueado). El primero no cerrado de la lista es el siguiente a especificar.

- Ciclo 1 — cerrado (a712108).
- Ciclo 2 — cerrado (7982124).
- Ciclo 3 — cerrado.
- Ciclo 4 — cerrado.
- Ciclo 5 — cerrado (bc660e8).
- Ciclo 6 — cerrado (df87f37).
- Ciclo 7 — cerrado (ef60fdc).
- Ciclo 8 — cerrado (3906d6f). P7.2a no aprobada todavía.
- Ciclo 9 — cerrado (4760257).
- Ciclo 10 — cerrado (7d6d19e).
- Ciclo 11 — cerrado (26b7c76).
- Ciclo 13 — cerrado (b31ba3d).
- Ciclo 15 — cerrado (2a20baa).
- Ciclo 16 — cerrado (418aaf5).
- Ciclo 18: el proponedor recomienda no abrir más ciclos locales; el usuario activa el despliegue (P18.1). Después, ciclo 14.
- Ciclo 17 (P16.2 + P18.2) — fusionado; paso 8 (análisis). Se adelanta al 14 por estar este bloqueado.
- Ciclo 14 (P13.3 + P13.5): aprobado; **bloqueado** hasta que el usuario active el despliegue (elija hosting) y lo compruebe en el móvil.
- Ciclo 12 — cerrado. P11.2 no aprobada.

## Nota

El 2026-10-09 se reescribió el historial (email noreply) antes del primer push: los hashes citados en este archivo y en `docs/cycles/` son anteriores y ya no existen.

## Decisiones del usuario (2026-10-08)

- Onboarding: si entra en un ciclo, el usuario nuevo arranca **vacío** con un botón «Cargar ejemplo» que carga los datos semilla.
- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1`: no se renombran.
- P4.2: campo opcional `undoes?` en `ActivityEvent` aprobado.
- P7.1 rachas: semanal por actividad, sin XP, la semana en curso no la rompe, objetivo actual también hacia atrás; `pop` en tarjeta + mejor racha en «Hoy».
- P9.3: prorrateo lineal de la XP semanal de los amigos simulados por día transcurrido; asserts de ranking actuales se mueven al domingo 2026-10-11 + asserts nuevos de miércoles y lunes.
- P11.1 (2026-10-09): `goalLog?` en life-rpg-custom-v1; racha con el objetivo vigente cada semana; antes del primer apunte, el objetivo vigente justo antes de ese cambio (aclarado 2026-10-09: bajar el objetivo nunca alarga la racha pasada); sin apuntes, objetivo de hoy; varios cambios en una semana → el primero; de «sin objetivo» a objetivo → la racha empieza en la semana del cambio.
- P13.2 (2026-10-09): hosting sin decidir → se deja el despliegue preparado (build + workflow) sin activar; sin IA en producción.
- P16.3 (2026-10-09): la IA solo funciona en `npm run dev` (`__AI_PROXY__ = command === 'serve' && !!key`); preview usa la heurística.
- Despliegue (2026-10-09): GitHub Pages (repo público). El usuario crea el repo vacío en la web y pasa la URL; el orquestador añade el remoto y hace push. Commits nuevos con el email noreply de GitHub (el usuario lo facilita); reescribir el historial solo con su okay.

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
| P11.1 | Objetivo vigente por semana (`goalLog`), absorbe P11.5 | aprobada | 11 |
| P11.2 | Límite semanal VILLAIN (`weeklyLimit`, sustituye a P7.2a) | no aprobada | — |
| P11.3 | No perder registros en silencio si falla el guardado | aprobada | 11 |
| P11.4 | Registrar desde «Te faltan» en la home | aprobada | 12 |
| P11.5 | Menores de objetivos → dentro de P11.1 | aprobada | 11 |
| P13.1 | Guardar sin borrar claves desconocidas de `custom` | aprobada | 13 |
| P13.2 | Sitio estático sin IA (despliegue preparado, sin activar; hosting por decidir) | aprobada | 13 |
| P13.3 | PWA instalable/offline (sw.js generado en build, kill switch) | aprobada | 14 |
| P13.4 | Endpoint de IA en servidor | no aprobada | — |
| P13.5 | e2e en Chromium real en la CI (Playwright) | aprobada | 14 |
| P15.1 | Deshacer desde «Hoy» (con cambios) | aprobada | 15 |
| P15.2 | Exportar con Web Share en móvil instalado | no aprobada por ahora | — |
| P15.3 | Lint `--deny-warnings` (reducida: silenciar los 3 warnings aceptados con su ponytail) | aprobada | 15 |
| P16.1 | Tendencia 8 semanas por actividad (barras CSS accesibles) | aprobada | 16 |
| P16.2 | HERO vs VILLAIN semana a semana en la home | aprobada | 17 |
| P16.3 | Menores del ciclo 13 (IA solo en dev) | aprobada | 16 |
| P18.1 | Activar despliegue en GitHub Pages | repo creado y main subido (2026-10-09); falta que el usuario active Pages y lance el workflow | — |
| P18.2 | Plural en aria-label de «Deshacer» | aprobada (dentro del ciclo 17) | 17 |
