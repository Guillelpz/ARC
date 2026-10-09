# Evaluación — ciclo 15

He contrastado las propuestas con `main` (ciclos 1-12) y con la rama `cycle-13`. Las citas de línea de `App.tsx` y `HomeView.tsx` son correctas.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P15.1 | APROBAR CON CAMBIOS | S | bajo | Es un hueco real del ciclo 12 y el `undo` actual sirve tal cual. Falta resolver de dónde sale el evento y qué pasa con el foco. |
| P15.2 | APROBAR CON CAMBIOS (después del ciclo 14) | S-M | bajo-medio | El problema es real: `lastExport` se marca al lanzar la descarga. Pero, tal como está escrita, cambia la exportación en escritorio y rompe el flujo de «Borrar todo». |
| P15.3 | APROBAR CON CAMBIOS (reducida) | XS (no M) | bajo | `--deny-warnings` tiene valor. Reescribir la ruta de guardado para quitar 2 warnings no lo tiene. |

## Cambios pedidos

**P15.1.**
- **Origen del evento.** `HomeView` no recibe `events`, y `history()` corta en 10 (`stats.ts:35`): con más de 10 registros en un día, entre deshechos y deshacer, el último que se puede deshacer quedaría fuera. Propongo que `todaySummary` devuelva `done[].undo?: ActivityEvent`. Sería el registro positivo más reciente de hoy con la misma condición que `canUndo`: no deshecho y `dayTotal >= amount`. Va acompañado de un test en `core/`. Es un cambio pequeño en `core/` (no «nada nuevo», como dice la propuesta) y evita pasar `events` a la home. Si el neto es mayor que 0 pero ningún registro se puede deshacer entero (por ejemplo, +2 y luego −1), la fila no muestra el botón. Es el mismo criterio que en la rama.
- **Etiqueta accesible con contenido:** `Deshacer +1 vaso en Agua`, con el mismo patrón que el «+» (`HomeView.tsx:51`).
- **Foco:** si al deshacer el neto queda en 0, la fila desaparece y el foco se pierde. Hay que llevarlo a `h2#hoy`, como hace ya el «+».
- **Arreglar `left!`:** que `add` devuelva la cantidad registrada (ya la calcula con `clampAmount`) y que el foco se decida con ese valor.
- Tests: deshacer desde la home, la fila que desaparece con el foco en «Hoy», y que no haya botón si no hay nada que deshacer.

**P15.2.**
- **Solo en la app instalada:** `matchMedia('(display-mode: standalone)').matches && navigator.canShare?.(…)`. En Chrome y Edge de escritorio, `canShare` con archivos es verdadero y la propuesta cambiaría la descarga de siempre por la hoja de compartir de Windows, que no tiene «Guardar archivo». Además, es el escenario que la propuesta describe como problemático.
- **«Borrar todo»** (`App.tsx:151-152`) llama a `exportData()` después de un `confirm()` y pone «Copia exportada» enseguida. Con `share` asíncrono, ese aviso mentiría si el usuario cancela. `exportData` tiene que devolver una promesa con el resultado, y el aviso depende de ella. Además, `share` después de `confirm` puede fallar con `NotAllowedError` porque ya no hay gesto del usuario. En ese caso hay que recurrir a la descarga, que sigue contando como copia, como hoy.
- **Android:** Chrome no comparte `application/json` (no está en su lista de tipos). `canShare` devuelve falso y se usa la descarga. Hay que dejarlo así y marcarlo con un `ponytail:`.
- Quitar el caso e2e: Chromium sin interfaz no tiene hoja de compartir y simularla no aporta nada que el test de UI no cubra.
- **Condición previa:** comprobar en el iPhone del usuario, con la PWA del ciclo 14, si la descarga falla de verdad. Si funciona, la parte de compartir sobra.

**P15.3.**
- **(c) sí:** `"lint": "oxlint --deny-warnings"`. Cubre `ci.yml` y `deploy-pages.yml` sin tocarlos.
- **(a) y (b) no:** los 3 warnings ya están documentados como simplificaciones deliberadas (`ponytail:` en `App.tsx:49` y `:57`). Se silencian con `// oxlint-disable-next-line <regla> -- ver ponytail` en esas líneas.
- La alternativa propuesta tampoco es mejor. Un ref leído durante el render es otro aviso de pureza. «Hoy» como estado obliga a recalcular la fecha dentro de `add`, porque el estado aún no se ha actualizado en el mismo handler. Y meter `useSyncExternalStore` toca la ruta que evita perder datos solo para contentar al linter.

## Ciclo recomendado

**Ciclo 15 = P15.1 + P15.3 reducida**, con P15.3 como tarea inicial de unas 4 líneas. Ninguna de las dos depende del ciclo 14 y no chocan: P15.3 solo añade comentarios en `App.tsx:52`, `:58` y `:59`.

**P15.2** entra en el ciclo 15 si el ciclo 14 está mergeado y el usuario ha comprobado el iPhone antes de que el tech-lead escriba la especificación. Si no, pasa al ciclo 16. Comparte `exportData` y `App.tsx` con P15.1, pero no hay solape real: P15.1 toca `add` y P15.2 toca `exportData` y `reset`.
