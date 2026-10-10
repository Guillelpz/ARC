# Análisis ciclo 21 — Importar y fusionar + compartir copia

**Entregado frente a spec:** las 3 tareas completas. T1 `core/merge.ts` (`mergeBackup`, asserts M1-M8), T2 «Importar y fusionar» en la UI (stale, sin cambios, backup previo, deshacible), T3 compartir con `navigator.share` y respaldo a descarga (P15.2). Review aprobada: 0 bloqueantes, gate verde (95 tests, e2e 3/3). Sin recortes relevantes.

**Deuda nueva**
- Menor 1: sin test de la rama `stale` de `mergeData` ni del fallo de `backupCurrent`.
- Menor 2: en `reset()`, el aviso «Copia exportada…» llega tras la hoja de compartir; verificar en iPhone real.
- `ponytail:` nuevos: `merge.ts` (borrado que sigue en la copia resucita; doble corrección resta dos veces; misma actividad manual en dos dispositivos = dos registros) y `App.tsx` (Chrome Android no comparte JSON, cae a descarga).

**Fricción del proceso:** el implementer se cortó al final por fin de sesión, pero sus 3 commits estaban completos; hay que comprobar el estado del repo antes de relanzar, no asumir que falta trabajo.

**Riesgos para el siguiente ciclo**
- La fusión sin servidor no distingue borrados: resolverlo exige `createdAt` por evento o servidor (decisión de sync).
- Compartir solo está verificado en tests; falta probarlo en dispositivo real (iPhone, condición abierta desde el ciclo 15).
- Workflow pausado: decisiones abiertas = balance de XP, PARTY real, IA en servidor, cuentas/sync, límite VILLAIN.
