# Análisis ciclo 23 — Límite semanal VILLAIN (P23.1)

## Entregado frente a lo especificado
- Límite semanal opcional en VILLAIN, editable en la tarjeta; pasarse (`week > límite`) muestra un aviso neutro (`over` en `TrackerStats`) sin efecto en XP, niveles, rachas ni party. Las 5 decisiones del usuario se cumplen.
- Persistencia: `limits` (fijas) y `weeklyLimit` (custom), sin migración; incluido en export/import/backup y en `mergeBackup` (conflicto: gana lo local).
- Tests: selfcheck L1–L6, C18–C20, App y axe A7. Review aprobada: 0 bloqueantes, 0 importantes. Sin recortes.

## Deuda nueva
- Menor de la review (tests C15 duplicados) ya corregido en `cf56338` (renombrados a C18–C20). La spec §4 aún dice C15–C17 (cosmético).
- `ponytail:` nuevos: ninguno.
- Pendientes sin ejecutar: checklist manual §11 (`npm run dev`, móvil 320 px) y e2e local (corre en CI al hacer push).

## Fricción del proceso
- La spec numeró mal los tests (C15–C17 ya existían); el tech-lead debería comprobar los ids libres con Grep.
- Ciclo con pasos 1-2 omitidos y reactivación puntual: STATE.md exigió edición manual del orquestador.

## Huecos y riesgos para el siguiente ciclo
- Sin historial de límites ni aviso en Inicio: el límite pasado no se ve; valorar con uso real.
- Sin aviso al llegar al límite (solo al pasarlo); puede resultar tarde.
- Falta validar la UI en móvil real antes de confiar en el despliegue (push a main despliega).
