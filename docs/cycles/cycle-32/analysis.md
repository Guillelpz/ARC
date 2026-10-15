# Análisis ciclo 32 — código de barras tecleado → Open Food Facts

**Entregado:** todo lo especificado (T1-T10): `core/off.ts` (`normEan`, `parseOff`, `fetchOff`), panel `FoodBarcode`, formulario de revisión con atribución ODbL y aviso de coherencia, búsqueda previa por `ref`, aviso de privacidad de un solo uso. Sin recortes. Review APROBADO a la primera (245 tests); e2e E-FI1/E-FI2 añadidos pero el reviewer no los ejecutó.

**Deuda nueva (menores sin corregir):**
1. `FoodBarcode`: comprobación de conexión duplicada (`net.online` y `navigator.onLine`).
2. `merge.ts`: mismo EAN con ids distintos → dos alimentos con el mismo `ref` (falta `ponytail:`).
3. `kind="label"` de `FoodNetPrivacy`/`foodNetText.ts` sin uso hasta el ciclo 33.
`ponytail:` nuevos: UPC-E y GTIN-14 no se aceptan; solo `_100g` (una ficha solo con `_serving` queda incompleta).

**Fricción:** ninguna relevante; el review no ejecuta e2e, que queda para la CI del push.

**Riesgos para el ciclo 33 (foto → Haiku):**
- Privacidad: la imagen sale del dispositivo hacia Anthropic; reutilizar `NET_PRIVACY` con `kind="label"` y dejar claro que se envía la foto.
- Coste y tamaño: reducir a ≤ 1568 px antes de enviar; HEIC sin decodificar en algunos navegadores → error `image`.
- Fiabilidad: Haiku puede inventar o confundir valores por ración y por 100 g; la revisión obligatoria y el aviso de coherencia kcal/macros son la defensa. Hace falta el checklist manual con 10-20 etiquetas reales (I4).
- Tests sin red ni cámara: simular `fetch`, `createImageBitmap` y `canvas`; sin clave de Anthropic, la opción debe degradar a «Crear a mano».
- Solo `FoodCustom` con `draft` y `source`: decidir qué `source` se guarda (`label`) y que `readFood` lo valide.
