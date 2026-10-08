# Evaluación — ciclo 1

Afirmaciones sobre el código comprobadas: las líneas citadas de `App.tsx` (18, 49, 51, 67, 75), `storage.ts` (7, 8) y `HomeView.tsx` (97) son correctas. `ESTADO-ACTUAL.md` §4 dice «validados al leer», pero eso es falso para los eventos: tiene razón P1.3, no el documento.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P1.1 | APROBAR CON CAMBIOS | S | medio | Sin esto la app no sirve a diario; `core/` ya recibe `today`. Falta el cambio de día con la app abierta y la copy «Fecha demo: 7 oct 2026» (`HomeView.tsx` l. 94). |
| P1.2 | APROBAR CON CAMBIOS | M | medio-alto | Es una decisión del usuario, pero renombrar claves solo añade riesgo de pérdida y el usuario no lo ve. Además, el desplazamiento de la semilla tiene un caso límite con fechas futuras. |
| P1.3 | APROBAR CON CAMBIOS | S-M | bajo | El bug existe tal como se describe: si el JSON está corrupto, carga la semilla y el `useEffect` la guarda encima. Es la única protección de datos. `loadCustom` tiene el mismo problema y la propuesta no lo nombra. |
| P1.4 | APROBAR CON CAMBIOS | S | bajo | La dependencia de desarrollo ya está autorizada (`STATE.md`). Pero `console.assert` no lanza error, así que «ejecutar selfcheck» no hace fallar nada si no se intercepta. |

## Cambios pedidos

- **P1.1:**
  - `today` se calcula en cada render y entra en las dependencias de los `useMemo`. Así se evita que la fecha quede congelada al cambiar de día con la app abierta.
  - Un solo helper local `YYYY-MM-DD`, que usan tanto `today` como `nowStamp`.
  - Quitar «Fecha demo: 7 oct 2026» de `HomeView` en el mismo cambio, porque si no muestra una fecha falsa.
- **P1.2:**
  - **No renombrar las claves.** Mantener las `-v1`: la palabra «demo» de la clave no la ve nadie, y la migración es justo el punto de pérdida de datos que la propia propuesta señala. Si se quiere, posponerlo a cuando haya migraciones de esquema de verdad.
  - Diferenciar «clave ausente → vacío» de «clave corrupta → P1.3». Hoy los dos casos acaban en la semilla.
  - Desplazar la semilla por semanas enteras para conservar el día de la semana. Los eventos posteriores a `today` (por ejemplo, si hoy es lunes) se descartan o se recortan. No deben quedar con fecha futura.
  - Implementarla como una función pura `seedFor(today)` en `core/`, con `SEED_EVENTS = seedFor(DEMO_DATE)`, y un assert nuevo que lo compruebe. Los asserts existentes no se tocan.
- **P1.3:**
  - Añadir `parseEvents(raw)` pura, simétrica a `parseCustom`.
  - Que la regla «no sobrescribir si es ilegible» se aplique a las **dos** claves.
  - Si se descartan elementos inválidos, hacer también una copia de seguridad del valor bruto, porque filtrar en silencio también es perder datos.
  - La importación reutiliza los mismos `parse*` y vive en `storage.ts`. En el componente solo quedan Blob e `<input type="file">`.
- **P1.4:**
  - El test intercepta `console.assert` (con un spy que falle si recibe `false`) y llama a `runSelfCheck()` sin modificar los asserts.
  - Los tests de storage van sobre las funciones `parse*` puras, sin jsdom ni dependencias extra.
  - Comprobar qué versión de Vitest es compatible con Vite 8.

## Ciclo recomendado

**Ciclo 1 = P1.4 + P1.3.** Es la red de seguridad: tests ejecutables y no perder datos. Las dos son baratas y de bajo riesgo, y P1.2 (su migración y su arranque vacío) se apoya en ambas.

**Orden:** P1.4 → P1.3 → (ciclo 2) P1.1 → P1.2.

Alternativa, si se prioriza el uso diario: añadir P1.1 al ciclo 1, porque es S, independiente y no toca datos. Hoy (8 oct) cae en la misma semana que `DEMO_DATE`, así que la semilla sigue «viva» hasta el domingo.
