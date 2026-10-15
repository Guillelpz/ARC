# Análisis ciclo 34 — catálogo USDA 130 → 188

**Entregado:** +58 alimentos de USDA SR Legacy (188 en total), FD1 con tope 170-190 (X1), docs al día. Recortes: 6 candidatos descartados por el tope y los huevos (colisión con tests). Valores verificados mecánicamente contra el CSV oficial (0 diferencias).

**Deuda nueva:** 3 menores de nombres (tomate en conserva, tamari, estados omitidos) en `ESTADO-ACTUAL.md` §4. Sin `ponytail:` nuevos más allá de la cabecera del catálogo. U-C2 intermitente (una vez, no reproducido en 8): hipótesis aserciones síncronas de foco/neto tras `fireEvent` con CPU cargada; segunda ocurrencia tras U-C1.

**Fricción:** el implementer no tenía red; el orquestador descargó el CSV y pasó los valores. Conviene dar red al implementer o un fichero de datos verificado de entrada en ciclos de datos.

**Riesgos del ciclo 35 (escáner):**
- `barcode-detector`/`zxing-wasm`: dependencia de runtime (okay ya dado, I1-C); fijar versión exacta como dependencia directa (X3) y comprobar licencia, tamaño y compatibilidad con Safari/iOS PWA (`getUserMedia` en standalone).
- X2: el wasm (~1 MiB) debe quedar fuera del precache del SW y cachearse al primer uso; verificar que funciona sin conexión tras ese primer uso y que el e2e/build no lo precachea.
- X3: sin dependencia transitiva flotante; revisar `package-lock` y CSP/rutas con `BASE_PATH=/ARC/`.
- Tests: cámara y detector hay que simularlos (happy-dom); vigilar la flaquedad de U-C1/U-C2 al ampliar `App.test.tsx`. Prueba en iPhone real pendiente.
