# Análisis ciclo 11 — racha vigente y aviso de guardado

**Entregado vs. especificado.** Todo lo de la spec (T1-T5): `goalLog` en `custom` (validado, exportable, con backup), `goalAt` y `streak` con el objetivo vigente de cada semana, y `save*` devolviendo `true/false/null` con banner «Exportar copia ahora» en home y ramas. Review APROBADO, 77/77 tests estables. Recortado por diseño: reconstruir objetivos anteriores al registro, mostrar el histórico en UI, límites VILLAIN, purga de backups sellados.

**Deuda nueva.**
- Menor 1: 2 warnings `react(set-state-in-effect)` en `App.tsx:57-58` (antes 0), aceptados con `ponytail:`.
- Menor 2: si una clave pasa de fallo a bloqueada, `unsaved` queda como estaba; caso casi imposible, sin acción.
- `ponytail:` nuevos: setState en el efecto de guardado; dos avisos iguales seguidos pueden no repetirse en el lector (banner); `goalLog` sin compactar.
- Semanas anteriores al primer apunte usan ese primer objetivo (retroactividad congelada, no historial real).

**Fricción del proceso.** El reviewer ejecutó un `git stash` por error (restaurado sin pérdida): prohibirlo explícitamente en su definición (solo lectura sobre el árbol de trabajo). Además, otro agente escribía a la vez en `docs/`, por lo que se requirió `git add` selectivo.

**Para el siguiente ciclo (P13).** P13.1: `readCustom` descarta las claves de primer nivel desconocidas de `custom`; hacerlo antes del primer despliegue, porque una versión antigua pierde `goalLog` o no apunta cambios (ya evaluado). Persistencia sigue solo en localStorage (riesgo iOS/ITP a 7 días); sin despliegue ni sincronización. El aviso de guardado fallido no sustituye a copias automáticas.
