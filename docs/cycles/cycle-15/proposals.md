# Propuestas — ciclo 15

Se da por hecho lo de los ciclos 13 (claves desconocidas, despliegue preparado) y 14 (PWA offline, e2e en Chromium). No se vuelven a proponer P11.2/P7.2a ni P13.4 (no aprobadas) ni P3.5 (pospuesta).

## P15.1 — Deshacer desde «Hoy» en la home (`producto`)
- Problema: el «+» de «Te faltan» registra con un toque (ciclo 12), pero corregir un toque accidental obliga a ir a la rama, buscar la tarjeta y usar «Últimos registros» (`cycle-12/analysis.md`, huecos). Es el gesto más rápido de la app y el único que no se puede deshacer en el mismo sitio.
- Propuesta: en la lista «Registrado hoy» del bloque «Hoy», cada actividad con un registro positivo de hoy que se pueda deshacer lleva un botón «Deshacer», que anula el **último** de esos registros con el `undo` existente (`App.tsx:121`: evento negativo con `undoes`, mismos clamps y avisos). El dato sale de `history()`/`canUndo` de `stats.ts`; no hace falta nada nuevo en `core/`. De paso, cierra el menor del ciclo 12: quitar el `left!` y calcular el foco con el valor que de verdad se registró. NO: deshacer registros de otros días desde la home ni varios a la vez, «rehacer» ni toast con botón temporal.
- Valor: alto (cierra el bucle registrar/corregir en la home) / Coste: S / Riesgo: bajo
- Requiere: nada (sin cambios de reglas; deshacer ya existe).
- Depende de: —

## P15.2 — Exportar la copia de forma fiable en el móvil instalado (`producto`)
- Problema: exportar es la única garantía real de los datos (`storage.ts:221`, `ponytail:`), pero `exportData` (`App.tsx:160-169`) lanza una descarga con `<a download>` y marca la copia como hecha **al lanzarla** (`ponytail:` de la línea 166). En una PWA instalada en iOS (ciclo 14), las descargas de blobs son poco fiables: si no se guarda nada, la app cree que hay copia y no vuelve a avisar en 14 días. Esto se convierte en una pérdida de datos silenciosa en el caso de uso principal (móvil).
- Propuesta: si `navigator.canShare?.({ files: [file] })` es verdadero, exportar con `navigator.share({ files })` (hoja nativa: «Guardar en Archivos», Drive, correo) y marcar `lastExport` **solo si la promesa se resuelve**; si el usuario cancela (`AbortError`), no se marca y se avisa. Si no se puede compartir, se usa la descarga de hoy. Test de UI con `navigator.share` simulado (resuelve, cancela o no existe) y un caso en el e2e. NO: copias automáticas, sincronización ni cambios en el formato JSON o en la importación.
- Valor: alto (reduce el riesgo de perder datos en móvil) / Coste: S / Riesgo: bajo (la API es nativa y, si no está, se mantiene el comportamiento de hoy)
- Requiere: nada (API web nativa, sin dependencias). Conviene comprobar en el iPhone real del usuario tras el ciclo 14.
- Depende de: ciclo 14 (P13.3) para el escenario instalado; funciona sin él.

## P15.3 — Lint sin warnings y CI estricta (`deuda`)
- Problema: oxlint acepta 3 warnings: `react(purity)` por `new Date()` en el render (`App.tsx:52`, §5 «Fecha») y 2 `set-state-in-effect` en el guardado (`App.tsx:58-59`, `ponytail:` del ciclo 11). Con warnings aceptados, la CI no puede usar `--deny-warnings` y un warning nuevo y real pasa desapercibido.
- Propuesta: (a) «hoy» como estado (`useState(() => localDate(new Date()))`) que se actualiza en el `visibilitychange` existente y antes de cada registro, lo que sustituye al `refresh` actual; (b) `unsaved` se calcula en el mismo sitio donde se guarda, sin setState en el efecto. La opción más corta: un `useSyncExternalStore` o un ref con el resultado del último `save*` que se lee al renderizar. Si no queda limpio, se guarda en los handlers. (c) `lint` con `--deny-warnings` en `package.json` y en la CI. NO: cambiar el orden ni el formato del guardado, ni añadir un timer de medianoche.
- Valor: medio (deja la CI más estricta y elimina dos `ponytail:`) / Coste: M / Riesgo: medio (toca la ruta de guardado y el aviso de fallo; los tests de guardado fallido del ciclo 11 deben seguir verdes sin cambios)
- Requiere: nada.
- Depende de: —

No se proponen:
- **Cantidad y día desde la home:** la rama ya lo permite con un toque más, y meter un selector en «Te faltan» duplicaría la UI de la tarjeta sin un problema observado.
- **Desacoplar los tests del texto:** consultan por rol y nombre accesible, que es parte del contrato de accesibilidad (ciclo 10). Desacoplarlos con `data-testid` o con constantes compartidas empeora ese contrato. El coste real (cambiar un texto obliga a cambiar el test) es pequeño y deliberado.
