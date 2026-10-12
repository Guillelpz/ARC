# Estado del workflow

Ver `docs/WORKFLOW.md`. Ciclos 1–22 cerrados e implementados; sus specs y documentos de ciclo se eliminaron el 2026-10-12 (están en el historial de git).

## En curso

- Ciclo 23 (P23.1, límite semanal VILLAIN) — **paso 4 (tech-lead)**. Reactivado por el usuario el 2026-10-12 solo para esto; pasos 1-2 omitidos (decisión directa del usuario). Fuera de él, el workflow sigue en pausa hasta que el usuario lo reactive con datos de uso real.

### P23.1 — Límite semanal opcional en VILLAIN

- Regla (usuario, 2026-10-12): límite semanal opcional que se puede sobrepasar; pasarse **solo avisa**: no cambia XP, niveles ni rachas.
- Notas técnicas de la evaluación anterior (P11.2): no reutilizar `weeklyGoal`/`goals` tal cual para VILLAIN, porque cambia la semántica de `todaySummary.missing` (VILLAIN saldría en «Te faltan»), `goalPct` y `streak`, y hoy se descarta por diseño en `readCustom`, `setGoal`, `allTrackers` y `editTracker`. Propuesta: campo propio `weeklyLimit` (solo VILLAIN); para Beer y Burgers, override validado por rama; «sin valor» = sin límite. Asserts/tests afectados si se reutiliza `goals`: G2 (`setGoal({}, 'beer', 5)`), el test de `storage.test.ts` que descarta `beer: 3` y U13 (Beer sin lápiz); «villain sin objetivo», E3 y C3 se mantienen con un campo propio.

## Decisiones vigentes del usuario

- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1` y textos «demo»: no se renombran de momento.
- Push de `main` a origin tras cada ciclo cerrado; nunca force-push ni otras ramas. Commits con el email noreply de GitHub; reescribir el historial solo con okay del usuario.
- Despliegue: GitHub Pages (repo público); entorno `github-pages` limitado a `main` (2026-10-12).
- Sincronización: opción A, sin servidor («Importar y fusionar» + compartir copia). Worker/servidor descartado por ahora (RGPD art. 9).
- IA: solo heurística en producción, sin endpoint; el proxy solo en `npm run dev`.
- Balance de XP: se deja como está. PARTY: sigue simulada (2026-10-12).

## Propuestas no implementadas

| id | título | estado |
|---|---|---|
| P3.5 | Cuentas + sincronización (partir en a/b) | pospuesta |
| P13.4 | Endpoint de IA en servidor | no aprobada (2026-10-12: sin endpoint) |
| P23.1 | Límite semanal opcional en VILLAIN (sustituye a P7.2a/P11.2) | aprobada, ciclo 23 en curso |
