# Review ciclo 10 (deuda menor + avisos accesibles)

Veredicto: **CAMBIOS** (1 importante).

Comprobado sobre `cycle-10`: `npm run build` OK; `npm run lint` 0 errores y 1 aviso (ver menor 1); `npm test` 70/70 en 14 de 17 ejecuciones. Falló `U6 importar` en 3 (intermitente reproducido).

## Hallazgos

### Importante

1. **Test intermitente `U6 importar`.** `app/src/App.test.tsx:93-94`.
   - Error: `expect(stored()).toEqual(ev)` en la línea 94 recibe `[]`. El aviso «Copia importada…» sí está en el DOM.
   - Causa: `saveEvents` se ejecuta en un `useEffect` pasivo (`App.tsx:54`). `importFile` resuelve `file.text()` con una promesa, así que `setEvents` corre fuera de `act`. `findByText` resuelve en cuanto el MutationObserver ve el aviso, que puede ocurrir antes de que React vacíe los efectos pasivos. La lectura síncrona de localStorage corre una carrera con ese vaciado.
   - No es `confirm`, ni timers (solo se falsea `Date`), ni estado compartido. El test no cambió en este ciclo; el ciclo 10 solo le añadió carga y lo hace visible.
   - Corrección: sustituir la línea 94 por `await vi.waitFor(() => expect(stored()).toEqual(ev))`. Revisar igual la línea 90 si se endurece: ahí no hay mutación, así que es estable.
   - Verificar con un bucle de 20 ejecuciones de `npm test`.

### Menor

1. **Aviso de lint `only-export-components`** en `LevelUpToast.tsx:113` (`export function liveText`). Sí se puede arreglar sin complicar nada, pero `liveText` depende de `PASSED` y `RANK_NAME`, que hoy son constantes locales del mismo archivo. Mover las tres piezas (`PASSED`, `RANK_NAME`, `liveText`) a `app/src/components/liveText.ts` (módulo sin componentes). `LevelUpToast.tsx` importa `PASSED` y `RANK_NAME` de ahí; `App.tsx` y `a11y.test.tsx` importan `liveText` de ahí. Es un movimiento mecánico. Si no se quiere tocar, un comentario `// oxlint-disable-next-line` con motivo también vale, pero es peor.
2. **`aria-label="Importar copia"` en el `<input type="file" hidden>`** (`HomeView.tsx:222`). Válido: está fuera de la lista de T5, pero es el tipo de arreglo pequeño (atributo/`aria-label`) que §T5 autoriza para violaciones de axe. Con `hidden` el input no está en el árbol de accesibilidad real (el botón visible es el control); el atributo solo evita la regla `label` en happy-dom y no hace daño. Si se quiere dejar claro, añadir una nota al commit; no hace falta cambiarlo.
3. `U18` (`App.test.tsx:269-272`) comprueba con `^LEVEL UP\.` el texto de la región. Correcto, pero depende del título exacto del toast; aceptable.

## Contraste con los puntos de atención

- **P9.1 reparados:** `storage.ts` mantiene el sellado con `dropped || fixed` (`loadAll`), así que el original no se pierde. `readCustom` ya no suma `fixedN` a `dropped`. `noticeFor` cae al texto de «no se pudo leer» si hay un problema ilegible (`dropped: null`). Conforme.
- **Duplicado con archivadas:** `UnknownView` usa todas para `dup`/`findSimilar` y solo las activas para `classifyAI` y `match`. «Reactivar» llama a `onUnarchive` + `onGoToMissions`. `canAnalyze` bloquea el duplicado exacto. Conforme.
- **Archivar con cambios:** `TrackerCard.tsx` usa `canSave ? nextT() : t`; cubierto por U16. Conforme.
- **Regiones aria-live:** una sola región global `role="status"` en `App.tsx` (texto derivado en render) y una en `UnknownView`; los 4 contenedores animados pasan a `aria-hidden` y se quitan los dos `aria-live` visibles. `ponytail:` documentado. No hay doble anuncio. Conforme.
- **Arquitectura:** `selfcheck.ts` y `core/` de dominio sin tocar; persistencia solo en `storage.ts`; sin hex ni `slate-*` nuevos; `axe-core` es devDependency prevista.
- **Exceso:** nada relevante.

## Segunda vuelta (orquestador)

Commit 7babee2: U6 con `vi.waitFor`; `liveText` movido a `components/liveText.ts`. Lint sin avisos; `npm test` 5/5 en verde (70 tests). APROBADO.
