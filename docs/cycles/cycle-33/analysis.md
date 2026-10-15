# Análisis ciclo 33 — Foto de la etiqueta → Haiku

**Entregado:** todo lo especificado: `postHaiku` con content array y timeout, `askLabel` (20 s), reducción a 1568 px en el dispositivo (`image.ts`), `labelFromAI` (por 100 g o ración, kJ → kcal, absurdos a null), panel `FoodLabel` con revisión en `FoodCustom` (`source: 'label'`), aviso de privacidad una vez, tests y e2e E-FI3. Sin recortes de código; la validación I4 (10-20 etiquetas reales) queda pendiente del usuario.

**Deuda nueva:** menor 1, `coherent` de `LabelResult` sin uso fuera de asserts. Menor 2 y `ponytail:` del clic extra tras aceptar el aviso: iOS puede bloquear el `click()` programático (validar en el iPhone). HEIC no decodificable acaba en error `image` sin alternativa.

**Fricción del proceso:** el cierre depende de una prueba manual (I4) que el workflow no modela: el ciclo se cierra en código con pendiente externo. Conviene un estado «cerrado, pendiente de prueba» explícito en STATE.md.

**Riesgos del ciclo 34 (catálogo USDA):**
- X1: FD1 (catálogo) con máximo de 170-190 alimentos: ampliar sin pasar el tope ni romper los asserts de tamaño y de ids; ids estables para recientes, platos y `mergeLog`.
- Calidad de datos: solo USDA FDC, sin BEDCA; los huecos españoles (jamón serrano, merluza, manchego, chorizo) siguen sin ficha. Valores por 100 g sin contrastar.
- Peso del bundle y precache del SW al crecer el catálogo estático; duplicados con alimentos propios o con `ref` de OFF.
- El ciclo 35 (escáner) añade wasm: X2/X3 deben respetarse; la prueba del iPhone de la foto puede cambiar el patrón de aviso + clic que el escáner reutilizaría.
