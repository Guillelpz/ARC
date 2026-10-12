# Estado del workflow

Ver `docs/WORKFLOW.md`. Ciclos 1–22 cerrados e implementados; sus specs y documentos de ciclo se eliminaron el 2026-10-12 (están en el historial de git).

## En curso

- Ciclo 23 (P23.1, límite semanal VILLAIN) — **paso 7 (merge a main) hecho**; falta el análisis (paso 8). Reactivado por el usuario el 2026-10-12 solo para esto; pasos 1-2 omitidos. Fuera de él, el workflow sigue en pausa hasta que el usuario lo reactive con datos de uso real.

## Decisiones vigentes del usuario

- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1` y textos «demo»: no se renombran de momento.
- Push de `main` a origin tras cada ciclo cerrado; nunca force-push ni otras ramas. Commits con el email noreply de GitHub; reescribir el historial solo con okay del usuario.
- Despliegue: GitHub Pages (repo público); entorno `github-pages` limitado a `main` (2026-10-12).
- Sincronización: opción A, sin servidor («Importar y fusionar» + compartir copia). Worker/servidor descartado por ahora (RGPD art. 9).
- IA: solo heurística en producción, sin endpoint; el proxy solo en `npm run dev`.
- Balance de XP: se deja como está. PARTY: sigue simulada (2026-10-12).
- Límite VILLAIN (2026-10-12): opcional y sobrepasable; pasarse solo avisa (sin efecto en XP, niveles, rachas ni party). Solo semana en curso, aviso solo en la tarjeta, avisa al pasarse (no al llegar), se edita en la tarjeta.

## Propuestas no implementadas

| id | título | estado |
|---|---|---|
| P3.5 | Cuentas + sincronización (partir en a/b) | pospuesta |
| P13.4 | Endpoint de IA en servidor | no aprobada (2026-10-12: sin endpoint) |
