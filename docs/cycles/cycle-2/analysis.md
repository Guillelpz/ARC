# Análisis ciclo 2

## Entregado frente a lo especificado
Entregado completo: T1 fecha local real (`localDate`, «hoy» por render y en `visibilitychange`), T2 `seedFor(today)`, T3 arranque vacío con «Cargar ejemplo» y «Borrar todo», T4 CI en GitHub Actions. Review APROBADO (build, lint, 18/18 tests). Sin recortes; formato y claves de storage sin cambios.

## Deuda nueva
- `menor` 1: `App.tsx:46` `localDate(new Date())` en render, warning `react(purity)` de oxlint (exit 0). Alternativa con `useState` descrita en la review, pero desfasa `today` frente a `nowStamp()` tras medianoche.
- `menor` 2: `SEED_EVENTS` y `DEMO_DATE` solo los usan selfcheck y tests.
- `menor` 3: `getItem` que lanza ahora devuelve `[]`; coherente, sin acción.
- `ponytail:` nuevo: `App.tsx` («hoy» recalculado en render y al volver a la pestaña).
- `CLAUDE.md` está desfasado: dice que los eventos usan `DEMO_DATE` y que el seed es el arranque. Hay que actualizarlo (no se tocó aquí).

## Fricción del proceso
- El primer implementer se cortó por el límite de la API y hubo que retomar desde un diff sin commit. Mitigación: pedir commit por tarea (T1..T4) en cuanto pase cada una.
- Un `npm ci` falló con EPERM por un dev server abierto; cerrar el dev server antes de reinstalar.

## Huecos y riesgos para el siguiente ciclo
- Con datos reales, party sigue simulada y los eventos de ejemplo de `PARTIES` no dependen de «hoy»: comprobar que el ranking tiene sentido con usuario vacío.
- Siguen pendientes: persistencia solo local, claves con «demo», IA sin endpoint desplegable, balance de progresión sin validar, sin tests de UI.
- Decidir si se prefiere resolver el warning de purity o mantener el comportamiento actual.
