# Análisis ciclo 35 (escáner con cámara) y balance de la fase 2 de Comida

## Entregado
- Escáner con cámara sobre el flujo tecleado (`FoodScanner` dentro de `FoodBarcode`, `scan.ts`): `BarcodeDetector` nativo o ponyfill `barcode-detector` + `zxing-wasm` (MIT/Apache-2.0, `THIRD_PARTY.md`). Wasm fuera del precache y cacheado al primer uso (X2); sin red, el campo sigue disponible. Nada recortado. Review APROBADO; el menor 1 (cámara abierta si la pestaña se ocultaba durante la carga) se corrigió antes del merge.

## Balance de la fase 2 (ciclos 32-35)
- Entregadas las cuatro vías de I1: OFF tecleado (32), foto de etiqueta con Haiku (33), catálogo USDA 130 → 188 (34) y escáner (35). Todo con datos copiados al dispositivo (I3), aviso de privacidad único (I2) y una sola dependencia de runtime nueva (X3). Cuatro ciclos seguidos sin bloqueantes.
- Reutilizar `search()` y `foodByRef` evitó duplicar lógica entre tecleado y cámara.

## Deuda nueva
- Menor 2: chunk de entrada +4,8 KB frente a < 2 KB de la spec; aceptado, el criterio no se perseguirá.
- Menor 3: wasm sin limpieza dentro de una versión y sin timeout (`ponytail:`).
- Menores previos del 33 y 32 siguen en `ESTADO-ACTUAL.md` §4. Pruebas en iPhone pendientes: checklist I4 (33) y escáner (35).

## Fricción del proceso
- La spec fijaba criterios numéricos (tamaño de chunk, `grep`) que el reviewer midió y que no reflejaban el riesgo real; conviene formularlos como «sin código de la librería en el chunk de entrada».
- El orquestador tuvo que corregir un menor tras el review para no abrir otra vuelta: válido para cambios de una línea.
- Los tests de UI intermitentes (U-C1/U-C2) siguen en vigilancia.

## Huecos para la fase 3 (voz de Comida por el «+»)
- `routeCapture` (`capture.ts`) no conoce Comida: hay que añadir un destino «comida» (alimento + cantidad, «1000 kcal» a secas) junto a gym/hábito, con `deviceSure` y memoria `memo` (los asserts CV/MC no lo cubren).
- Faltan alias en inglés en el catálogo (F2 dejó sitio): sin ellos «ate 200 g of rice» no casa; también plurales y raciones («2 huevos»).
- Riesgo de colisión: hábitos existentes tipo «Burgers» frente a alimentos; definir prioridad y confirmación (tarjeta antes de guardar si hay ambigüedad).
- Otro día, entradas con varios alimentos por frase y efecto en el tracker «Dieta» en vivo (toast al entrar en rango) por decidir. Sin clave, confianza limitada a «media», como en la captura.
