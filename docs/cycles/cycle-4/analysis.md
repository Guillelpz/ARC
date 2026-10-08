# Análisis ciclo 4 — otro día y deshacer

**Entregado (P4.1, P4.2):** selector de día (Hoy/Ayer/fecha, sin futuro) en las misiones; corrección limitada al total del día (`dayTotal`, `clampAmount`); `undoes?` en eventos con reparación al leer; «Últimos registros» (10) y «Deshacer» por tarjeta; asserts A1–A5 y tests S1–S3. Todo lo especificado; recortes previstos respetados (sin horas editables, sin historial global, `UnknownView` registra hoy). Review aprobada sin bloqueantes.

**Deuda nueva**
- menor: `add` (`App.tsx:84-88`) no rechaza deshacer un evento ya deshecho; solo lo impide la UI.
- menor: `history` (`stats.ts:34`) trata como deshecho el destino de cualquier `undoes`, aunque el evento sea positivo (datos editados a mano).
- `ponytail:` nuevo: `history` recorre todos los eventos por tarjeta (O(n·tarjetas)).
- Cambio de regla: «−» ya no resta hasta el total semanal sino el del día; el usuario debe elegir el día.

**Fricción del proceso:** la spec ya incluía el código casi completo (§6–7), así que implementar fue directo; el único coste fue que "docs: estado tras merge ciclo 4" no dejó ESTADO-ACTUAL con la funcionalidad nueva (la spec prohibía tocarlo en el ciclo), y se completó en este cierre. Los hallazgos menores quedan sin dueño tras la aprobación.

**CLAUDE.md desfasado (sin editar):** la sección de Arquitectura no menciona `undoes`, `dayTotal`/`clampAmount`/`history`/`dayLabel` en `stats.ts` ni el selector de día / «Deshacer»; dice que «las correcciones son eventos negativos» sin el matiz de `undoes`; y «los eventos nuevos usan `DEMO_DATE`» y `seed.ts (28 eventos; DEMO_DATE fija "hoy")` ya eran falsos desde el ciclo 2 (hoy es la fecha local; `seedFor(today)`).

**Para el siguiente ciclo:** corregir los dos menores (barato, en `add` y `history`); un registro deshecho se puede rehacer, pero no hay editar importe; sin tests de UI para el selector/`<details>` (checklist manual en móvil, sobre todo `<input type=date>` en VILLAIN/iOS, no verificado por agentes); el historial es por actividad, sin vista global; sigue pendiente party real, backend y restaurar copias internas.
