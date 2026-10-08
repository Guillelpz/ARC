# Review ciclo 3 — «Tus datos»

**Veredicto: CAMBIOS**

`build`, `lint` y `test` en verde (24 tests). Sin hex ni `slate-*` en HomeView. `selfcheck.ts` sin tocar. La desviación de `requestPersist()` en `exportData` está aceptada.

## Hallazgos

### importante
1. `app/src/core/storage.ts` (`backupCurrent`): la copia de seguridad es un par (eventos, custom) pero se escribe clave a clave con try/catch independiente. Si falla la segunda (cuota), `.backup.last` queda mezclado: eventos nuevos con custom antiguo, y además sin ningún aviso. Corrección: escribir ambas o ninguna (si falla una, restaurar la anterior o no tocar ninguna) y devolver `boolean`. Así `App.tsx` puede avisar con `notice` («No se pudo guardar la copia interna») cuando falle antes de borrar o importar. El `confirm` ya se aceptó, pero el usuario debe saber que no hay red de seguridad.
2. `app/src/App.tsx` (`reset`/`importData`, `if (hasData) backupCurrent()`): `.backup.last` es la única copia y se sobrescribe con cualquier dato. Caso realista: Borrar todo (backup = datos reales) → «Cargar ejemplo» → Borrar todo otra vez, o importar encima: el backup pasa a ser el ejemplo y los datos reales se pierden sin aviso. Corrección mínima: no sobrescribir cuando los eventos actuales son exactamente `seedFor(today)` (o el ejemplo), o conservar la copia anterior en `.backup.prev` rotando. Si se prefiere dejarlo como está, debe constar en el `ponytail:` con ese límite explícito.

### menor
3. `app/src/core/storage.ts` (`exportAge`): una `lastExportAt` en el futuro (reloj mal puesto una vez) da 0 días y suprime el aviso indefinidamente. Valdría descartar fechas posteriores a `now` en `loadLastExport`. No bloquea.
4. `app/src/App.tsx` (`exportData`): `setLastExport(stamp)` se aplica aunque `saveLastExport` falle por cuota, y al recargar el estado vuelve a «sin copia». Es coherente con el `ponytail:`, solo queda anotado.
5. `backupCurrent` lee la clave bruta: si el almacenamiento está bloqueado (`locked`) porque la clave estaba corrupta, `hasData` puede ser verdadero con datos en memoria y la copia guardaría el valor corrupto o nada. Casos raros; sin acción.

## Puntos de atención
1. Orden: la copia interna se hace tras el `confirm` y antes de `setEvents`/`unlockStorage`, así que los efectos `save*` no pueden pisar el valor previo. El orden es correcto. Los riesgos son los hallazgos 1 y 2.
2. «Borrar todo»: ningún camino borra sin el segundo `confirm`. Aceptar el primer diálogo exporta y retorna; Cancelar pasa al `confirm` de borrado. Correcto, y el texto de borrado no cambia.
3. `life-rpg-meta-v1`: se valida objeto, `lastExportAt` de tipo string y `Date.parse` no NaN. Un `getItem` que lanza devuelve `null`. Correcto, salvo el hallazgo 3.

## Segunda vuelta (commit 1eae641)

**Veredicto: APROBADO.** `build`, `lint` y `test` en verde (26 tests).

1. Hallazgo importante 1 (copia atómica y aviso): `backupCurrent` escribe todo o revierte lo escrito y devuelve `boolean`. `reset` e `importData` abortan con `notice` si falla, sin borrar ni importar. Test de reversión añadido. Resuelto.
2. Hallazgo importante 2 (sobrescritura): rotación `.backup.last` a `.backup.prev`, con el límite anotado en el `ponytail:` (tres operaciones destructivas seguidas pierden la más antigua). El caso borrar, ejemplo, borrar conserva ahora los datos reales en `prev`. Resuelto.

Pendiente: los menores 3 a 5 siguen sin cambios; no bloquean.
