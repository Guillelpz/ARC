# Review ciclo 34 — catálogo USDA 130 → 188

Veredicto: APROBADO

Build, lint y test (8 ficheros, 256 tests) en verde sobre cycle-34.

Hallazgos: 0 bloqueantes, 0 importantes, 3 menores.

Verificación mecánica: las 58 filas nuevas de `foodCatalog.ts` coinciden con `usda-verified.txt` en `ref`, kcal entero y p/c/f a 1 decimal (0 diferencias). No hay ids ni refs duplicados. Los dos últimos pasos de comprobación (ids kebab, sin prefijo `food-`) los cubre FD1.

Otros puntos revisados:
- `selfcheck.ts`: solo cambia el tope de FD1 (`>= 170 && <= 190`), como pide X1.
- Bebidas en `base: 'ml'`: almond-milk y apple-juice. Los alias `col` y `nocilla` son correctos y no chocan con otros nombres.
- Docs: `CLAUDE.md` y `ESTADO-ACTUAL.md` (dos sitios) dicen 188. La fecha de consulta de la cabecera es 2026-10-15.
- Desviaciones declaradas (un commit; 6 filas descartadas por el tope y los huevos por colisión con tests): aceptables. 188 queda dentro de 170-190 y supera el mínimo de 40 nuevos. La spec permite descartar candidatos y prohíbe ajustar valores.

Menores:
1. `foodCatalog.ts` (tomato-canned): «Tomate triturado en conserva» es el 170051 «Tomatoes, red, ripe, canned, packed in tomato juice», es decir, tomate en conserva (entero) y no triturado. Mejor «Tomate en conserva».
2. `foodCatalog.ts` (soy-sauce): el 174278 es «Soy sauce made from soy (tamari)». El nombre «Salsa de soja» omite que es tamari (más proteína que la salsa común). Mejor «Salsa de soja (tamari)».
3. `foodCatalog.ts` (rabbit-raw, brussels-sprouts, hazelnuts, pistachios, cabbage...): algunos nombres no indican el estado (conejo crudo, pistachos tostados sin sal). El ponytail de cabecera lo cubre solo en parte.

U-C2 intermitente: no veo relación con el catálogo, que no interviene en ese test. En `App.test.tsx:1229` encadena dictado simulado, `findByText` (timeout por defecto de 1 s) y `Editar` con aserciones síncronas sobre `activeElement` y el neto. La causa probable es el timeout de 1 s o el orden de efectos cuando la CPU va cargada (por ejemplo `build` en paralelo). Sin reproducirlo no lo doy por confirmado.
