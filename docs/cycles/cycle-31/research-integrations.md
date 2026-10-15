# Investigación: integraciones de Comida (fase 2)

Fecha: 2026-10-15. Autor: agente investigador. Alcance: PWA sin backend en GitHub Pages, iPhone y Safari, datos solo en localStorage, sin dependencias de runtime nuevas sin okay del usuario.

Punto de partida en el código: `Food` ya tiene `source?: string` (≤ 20) y `ref?: string` (≤ 100; «fdcId, código BEDCA o código de barras»), y cada `FoodEntry` guarda una instantánea de sus valores. Un alimento externo encaja como `Food` propio con `source: 'off'` y `ref: <EAN>` **sin migrar datos** (`app/src/core/types.ts:159-166`).

Marcas usadas: **[verificado]** = comprobado hoy con petición real (curl con cabecera `Origin`) o en documentación oficial; **[fuente terciaria]** = blogs de terceros o competidores; **[sin confirmar]** = no pude comprobarlo.

---

## 1. Resumen

- **Open Food Facts (OFF) por código de barras es la única integración externa que funciona hoy, desde el navegador, sin clave, sin servidor y gratis.** [verificado] `GET https://world.openfoodfacts.org/api/v2/product/{EAN}.json` responde con `Access-Control-Allow-Origin: *` y acepta la cabecera `X-User-Agent` en la preflight. Un producto Hacendado de prueba (8480000118837) devuelve kcal, proteínas, hidratos y grasas por 100 g.
- **La búsqueda por texto de OFF no es fiable desde el navegador.** [verificado] Search-a-licious (`search.openfoodfacts.org`) no devuelve `Access-Control-Allow-Origin` para orígenes ajenos (la preflight da 400), así que el navegador bloquearía la respuesta. La búsqueda clásica (`/cgi/search.pl`, `/api/v2/search`) devolvió hoy un 503 «temporarily unavailable». Además, OFF limita la búsqueda a 10 peticiones por minuto y desaconseja buscar mientras se escribe.
- **USDA FoodData Central sí tiene CORS** [verificado]: responde con `Access-Control-Allow-Origin: *`. Pero `DEMO_KEY` tiene un límite de 10 peticiones (`X-Ratelimit-Limit: 10`), así que haría falta que el usuario pegase su propia clave de api.data.gov. Además, sus datos son estadounidenses y el catálogo actual ya cubre lo básico. Aporta poco.
- **FatSecret, Edamam, Nutritionix y MyFitnessPal quedan descartados.** FatSecret exige OAuth 2.0 con un proxy en IPs registradas. Edamam cuesta desde 14 $ al mes, exige atribución y prohíbe cachear. Nutritionix es de pago (la página devuelve 402). MyFitnessPal no tiene API pública. BEDCA no tiene API y su licencia exige autorización para cualquier uso no personal.
- **El código de barras en el iPhone no se puede leer con la API nativa.** [verificado en caniuse y en foros de Apple] `BarcodeDetector` está desactivada por defecto en Safari iOS 17 a 26.6 y el flag está roto desde iOS 18. Las opciones son: (a) teclear el EAN, sin dependencias; (b) el polyfill `barcode-detector` (licencia MIT, sobre `zxing-wasm`, wasm del lector de unos 1,04 MiB), que es una dependencia nueva; o (c) foto a Claude visión con la clave del usuario, también sin dependencias.
- **Leer la etiqueta con Claude visión es viable y barato.** Con Haiku 5.5 sale por unos 0,05-0,1 céntimos de dólar por foto; con Sonnet 5.5, por unos 1-2 céntimos. Reutiliza `askHaiku` y el patrón de clave del usuario, no añade dependencias y funciona con productos que OFF no tiene. Es la segunda integración con más valor.
- **Importar CSV es viable sin dependencias, pero tiene poco valor para este usuario.** El exportador de MyFitnessPal es de Premium [fuente terciaria]. Cronometer y FatSecret exportan CSV, Lose It también, y Yazio solo PDF. Además, cada app usa un formato distinto. Lo dejaría para cuando alguien lo pida.
- **Apple Health desde una PWA no es posible.** HealthKit es solo para apps nativas. El puente con Atajos de iOS es técnicamente posible pero frágil. Health Connect tampoco tiene API web.
- **Recomendación:** guardar el dato copiado en el dispositivo como `Food` propio con `source`/`ref` (funciona sin conexión y sigue el patrón actual), en vez de consultarlo cada vez.

---

## 2. Tabla comparativa

| Opción | Qué aporta | Requisitos (clave / servidor / dependencia) | Coste | iOS (PWA) | Privacidad | Licencia | Esfuerzo |
|---|---|---|---|---|---|---|---|
| **OFF por EAN tecleado** | Productos envasados españoles (Hacendado, etc.) con kcal y macros | No / No / No | Gratis | Sí, solo `fetch` | Llega a OFF: el EAN y la IP | ODbL + DbCL; atribución con enlace | **S** |
| **OFF + escáner por cámara (polyfill)** | Lo mismo sin teclear | No / No / **Sí**: `barcode-detector` 3.2.2 (MIT) + `zxing-wasm` 3.1.5 (MIT, wasm ~1 MiB, alojado por nosotros) | Gratis | Sí con `getUserMedia`; la PWA puede volver a pedir permiso | Las imágenes no salen del dispositivo | MIT | **M** |
| **OFF búsqueda por texto** | Encontrar productos por nombre | No / **en la práctica sí** (Search-a-licious sin CORS; la clásica a 10/min y caída hoy) | Gratis | No fiable | Llega a OFF: el texto y la IP | ODbL | M (y riesgo alto) |
| **Etiqueta con foto + Claude** | Cualquier etiqueta, también de productos que no están en OFF | Clave del usuario (ya existe) / No / No | ~0,0005-0,001 $ por foto (Haiku 5.5); ~0,01-0,02 $ (Sonnet 5.5) | Sí, con `<input type=file accept=image/* capture>` (sin `getUserMedia`) | Llega a Anthropic: la foto de la etiqueta | Datos del usuario | **S-M** |
| **USDA FDC API** | Más alimentos genéricos (en inglés) | Clave de api.data.gov del usuario (DEMO_KEY: 10) / No / No | Gratis | Sí (CORS `*`) | Llega a USDA: la consulta y la IP | CC0 | S-M; aporta poco |
| **Ampliar el catálogo USDA estático** | Más genéricos sin red | No / No / No | Gratis | Sí, sin conexión | Nada sale del dispositivo | CC0 | S |
| **FatSecret Platform** | BD grande con marcas | Clave + **OAuth2 con proxy en IPs registradas** | Basic gratis (5.000 llamadas al día) con atribución | Solo con backend | Llega a FatSecret | Propietaria | L (necesita backend) |
| **Edamam Food DB** | BD con marcas y UPC | Clave; CORS sin confirmar | Desde 14 $/mes | — | Llega a Edamam | Propietaria; caché prohibida | L |
| **Nutritionix** | BD de EE. UU. | Clave de pago | De pago (402) | — | — | Propietaria | Descartado |
| **MyFitnessPal API** | — | API cerrada desde 2017-2019 | — | — | — | — | Descartado |
| **BEDCA** | Composición de alimentos española | Sin API; uso no personal con autorización expresa de AESAN | — | — | — | Términos de 2010 restrictivos | Descartado (salvo permiso) |
| **Importador CSV** | Traer el historial de otra app | No / No / No (parser propio; `papaparse` sería opcional) | Gratis | Sí (`<input type=file>`) | Local | Datos del usuario | M por formato |
| **Apple Health (HealthKit)** | Escribir kcal y macros en Salud | Imposible desde la web | — | No | — | — | Descartado |
| **Atajos de iOS como puente** | Mandar el día a Salud | Atajo instalado por el usuario + `shortcuts://` | Gratis | Frágil | Local | — | M; experimental |
| **Health Connect / Google Fit** | Android | Sin API web; Google Fit en retirada | — | No aplica | — | — | Descartado |

---

## 3. Detalle por opción

### 3.1 Open Food Facts

- **Lectura por código de barras:** `GET /api/v2/product/{EAN}.json?fields=code,product_name,product_name_es,brands,nutriments,serving_size,quantity`. En `nutriments` vienen `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g` y `fat_100g`, y en `serving_size` la ración. Un código inexistente devuelve `status: 0`. [verificado hoy con el EAN 8480000118837, Hacendado, completitud 0,79]
- **CORS:** [verificado 2026-10-15] El endpoint de producto responde con `Access-Control-Allow-Origin: *`. La preflight `OPTIONS` con `Access-Control-Request-Headers: x-user-agent` responde 204 y permite `User-Agent`, `X-User-Agent` y `Authorization`.
- **User-Agent:** OFF pide `AppName/Version (email)`. Los navegadores no dejan fijar `User-Agent` en `fetch`, así que conviene mandar `X-User-Agent` (lo admite la preflight) o el parámetro `app_name`. Habría que decidir qué contacto poner, porque el repo es público (puede ser la URL del repo en lugar de un email).
- **Límites:** 15 peticiones por minuto por IP para producto y 10 por minuto para búsqueda. Si se superan, OFF puede banear la IP. El límite es por usuario final, y con un solo usuario sobra.
- **Búsqueda por texto:** la v2 no tiene búsqueda de texto completo y OFF remite a Search-a-licious. [verificado] Search-a-licious no devuelve `Access-Control-Allow-Origin` ni para `world.openfoodfacts.org` ni para `localhost`, y su preflight da 400. Desde GitHub Pages no se puede usar. `/cgi/search.pl` devolvió 503 en la prueba de hoy. Conclusión: no prometer búsqueda por nombre en OFF sin un proxy.
- **Licencia:** la base de datos es ODbL 1.0, cada contenido es DbCL 1.0 y las imágenes son CC BY-SA 3.0. Los términos piden citar la licencia y acreditar a OFF con un enlace a openfoodfacts.org o a la ficha del producto. La cláusula *share-alike* de ODbL se aplica a las bases de datos derivadas que se distribuyan públicamente. Unas pocas fichas copiadas en el localStorage del usuario no son una distribución pública. Lo que **no** debe hacerse es meter un volcado de OFF en el catálogo del repo público sin publicarlo bajo ODbL. No soy abogado; es mi lectura de los términos.
- **Calidad en España:** hay muchos productos Hacendado y Mercadona, pero bastantes fichas incompletas (sin nutrición o sin categoría) [fuente: fichas de OFF]. No encontré cifras agregadas de cobertura en España [sin confirmar]. La interfaz debe tratar «sin nutrición» como un caso normal y ofrecer la foto de la etiqueta como alternativa.
- Fuentes: https://openfoodfacts.github.io/openfoodfacts-server/api/ (consultada 2026-10-15, sin fecha visible; v3.6), https://world.openfoodfacts.org/terms-of-use (consultada 2026-10-15), cabeceras HTTP comprobadas el 2026-10-15.

### 3.2 USDA FoodData Central API

- Usa una clave de api.data.gov. El límite por defecto es de 1.000 peticiones por hora por IP; si se supera, la clave se bloquea una hora. `DEMO_KEY` tiene límites «mucho más bajos»: [verificado] la cabecera devolvió `X-Ratelimit-Limit: 10`. CORS: [verificado] `Access-Control-Allow-Origin: *`. Licencia CC0.
- Encajaría como otra «clave del usuario» en Ajustes, pero los nombres están en inglés, no hay marcas españolas y la app ya tiene 130 genéricos del mismo origen. Es mejor ampliar el catálogo estático cuando se mida qué búsquedas no dan resultado.
- Fuente: https://fdc.nal.usda.gov/api-guide (consultada 2026-10-15).

### 3.3 FatSecret, Edamam y Nutritionix

- **FatSecret:** los tokens OAuth 2.0 «deben pedirse a través de un servidor proxy» desde IPs registradas. El plan Basic es gratis (5.000 llamadas al día) y exige atribución. Necesita backend, así que queda fuera de las restricciones actuales. Fuentes: https://platform.fatsecret.com/docs/guides/authentication/oauth2 y https://platform.fatsecret.com/api-editions (consultadas 2026-10-15).
- **Edamam:** Enterprise Basic cuesta 14 $ al mes (100.000 llamadas) y no hay plan gratuito. La atribución es obligatoria, con suspensión inmediata si falta. Solo puede cachearse un subconjunto de campos, y solo en cuentas de usuario protegidas con contraseña. Eso choca con «copiar al dispositivo». CORS sin confirmar. Fuente: https://developer.edamam.com/food-database-api (consultada 2026-10-15).
- **Nutritionix:** la página de la API devolvió HTTP 402 al consultarla. Los directorios la describen como de pago o *freemium*, sin precios claros [sin confirmar]. Descartado.

### 3.4 BEDCA (España)

- Es la base de datos de AESAN, construida con estándares EuroFIR. No encontré ninguna API. Los términos de uso (v1.0, 2010) dicen que reutilizar los datos para fines que no sean personales, educativos o no comerciales requiere «autorización expresa de AESAN/BEDCA», con cita de la fuente. Una app con repo público y uso personal está en una zona gris. Para incorporar valores BEDCA al catálogo convendría pedir permiso a bedca.adm@gmail.com [sin confirmar que siga activo]. Fuentes: https://www.bedca.net/bdpub/UsoBD.pdf y https://www.aesan.gob.es/AECOSAN/web/seguridad_alimentaria/subseccion/composicion_alimentos_BD.htm (consultadas 2026-10-15).

### 3.5 MyFitnessPal

- No tiene API pública: se cerró a nuevos desarrolladores (2017 o 2019 según la fuente) y la que queda es privada. Las únicas fuentes son terciarias de 2026 (rapidevelopers, documentación de python-myfitnesspal); no hay comunicado oficial reciente [sin confirmar con fuente oficial].
- Exportación: según terceros, la exportación oficial es solo para **Premium y Premium+** y llega por email como 3 CSV (nutrición por comida, peso y ejercicio). La nutrición viene **agregada por comida, no por alimento** [fuente terciaria: nutriscan.app y Foodzilla, 2026]. Sirve para importar totales diarios, no para reconstruir el diario alimento a alimento.

### 3.6 Código de barras en el iPhone

- **`BarcodeDetector`:** caniuse lista iOS 17.0-26.6 como «disabled by default». En los foros de Apple se informa de que el flag está roto desde iOS 18 (WebKit bug 281848). No encontré ningún anuncio de Apple para 2026 [sin confirmar para iOS 27]. Fuentes: https://caniuse.com/mdn-api_barcodedetector y https://developer.apple.com/forums/thread/767761 (consultadas 2026-10-15).
- **Sin dependencias:** (a) campo para teclear el EAN de 8 o 13 dígitos con `inputmode="numeric"` y validación del dígito de control (pura, testeable en `core/`); (b) foto con `<input type="file" accept="image/*" capture="environment">` enviada a Claude para que lea el código y la tabla. No necesita permiso de cámara de larga duración.
- **Con dependencias** [npm registry, 2026-10-15]:
  - `barcode-detector` 3.2.2: MIT, publicado el 2026-08-16. Es un *ponyfill* de la API estándar sobre `zxing-wasm`. Recomendado si se acepta una dependencia, porque el código queda escrito contra la API estándar.
  - `zxing-wasm` 3.1.5: MIT, publicado el 2026-10-06. Wasm de unos 1,46 MiB completo o 1,04 MiB solo lector. Por defecto el wasm se descarga de un CDN [comprobar `locateFile`]. Para que funcione sin conexión y por privacidad, hay que servirlo desde la propia app y añadirlo al precache del service worker.
  - `@ericblade/quagga2` 1.12.1: MIT, publicado el 2025-12-20. Solo 1D, en JS puro y más pesado de integrar.
  - `html5-qrcode` 2.3.8: Apache-2.0, **sin publicaciones desde el 2023-04-15** y descrito como sin mantenimiento. Descartado.
  - `@zxing/library` 0.23.0 (Apache-2.0) y `@zxing/browser` 0.2.1 (MIT): siguen vivos, pero el port JS está en modo mantenimiento [Scanbot, fecha sin confirmar].
- **Permisos de cámara en la PWA de iOS:** hay informes (WebKit 215884, foro de Apple de junio de 2025) de que la PWA instalada vuelve a pedir el permiso de cámara al cambiar de ruta o hash y de que el stream se corta tras abrir el Centro de control. Esta app no tiene router (usa `screen` en el estado), lo que reduce el riesgo, pero conviene abrir la cámara solo dentro del gesto y cerrarla al salir. `<input capture>` evita todo esto porque usa la cámara del sistema. Fuentes: https://bugs.webkit.org/show_bug.cgi?id=215884 y https://developer.apple.com/forums/thread/788518.

### 3.7 Importar desde otras apps

| App | Exportación | Formato | Fuente |
|---|---|---|---|
| MyFitnessPal | Solo Premium (por email) | 3 CSV, nutrición **por comida** | Terceros 2026 [sin confirmar con la ayuda oficial] |
| Cronometer | Sí, gratis (Account → Export Data → Servings) | CSV por alimento, con una advertencia: algunos gramos se convierten a raciones por licencias | forums.cronometer.com (personal de Cronometer) |
| Lose It | Desde loseit.com en escritorio | CSV, una fila por entrada (fecha, nombre, comida, cantidad, unidades, calorías); macros sin confirmar | Blogs de competidores 2026 |
| FatSecret | Sí (Diario → Exportar) | PDF o CSV | https://www.fatsecret.com/fatsecret-app-help/reports-page/use-export-or-print-function |
| Yazio | Solo PDF (PRO); el historial completo, con solicitud RGPD | Sin CSV oficial | nutrola.app (competidor) [sin confirmar] |

- **Viabilidad:** un importador en el dispositivo es S-M por formato. Hace falta un parser CSV propio de ~40 líneas en `core/` (comillas, separador `,` o `;` y coma decimal española) y un mapeo por formato hacia `FoodEntry` con instantánea (kcal y P/C/G) sin `foodId`. Se puede integrar con la idempotencia de `mergeBackup` (ids deterministas por fecha, comida y nombre). Riesgos: formatos sin documentar que cambian, fechas y zonas horarias, y MyFitnessPal agregado por comida. **Valor bajo** para un usuario que ya registra aquí; solo compensa si el usuario viene de otra app con historial.

### 3.8 Salud del sistema

- **HealthKit:** solo para apps nativas con *entitlement*; no hay ninguna API web [fuentes terciarias coincidentes; ningún documento de Apple anuncia lo contrario].
- **Atajos de iOS como puente:** la PWA podría abrir `shortcuts://run-shortcut?name=…&input=text&text=<JSON>` con el resumen del día, y un atajo instalado por el usuario usaría «Registrar muestra de salud» (Energía alimentaria, Proteínas, etc.). Es posible pero frágil: el usuario tiene que instalar el atajo, la PWA sale a la app Atajos, no hay retorno fiable a una PWA standalone y es difícil de testear. No verifiqué la sintaxis exacta del esquema ni el paso de JSON [sin confirmar]. Experimental, como mucho.
- **Google Fit / Health Connect:** Google Fit dejó de admitir altas en 2024 y se retira (2025-2026 según la fuente). Health Connect es una API de Android sin acceso web. No aplica a iPhone. Fuentes: https://9to5google.com/2024/05/04/google-fit-api-shutdown/ y https://www.spikeapi.com/blog/google-fit-shutdown-what-developers-need-to-know-and-how-to-prepare.

### 3.9 Etiqueta nutricional con foto (Claude visión)

- **Viabilidad:** alta. Se reutilizan `askHaiku` (fetch directo con la clave del usuario) y el patrón de «gana el borrador validado; cualquier fallo → manual». El prompt pide JSON `{name, base:'g'|'ml', kcal, p, c, f, serving?}` por 100 g o 100 ml. El resultado se valida en `core/` con los mismos límites que un `Food` propio y el usuario lo **confirma** antes de guardarlo; nunca se guarda solo. También puede leer el EAN impreso, que serviría de `ref`.
- **Coste** (precios de Anthropic consultados el 2026-10-06; Haiku 5.5 a 0,10 $/0,50 $ por MTok y Sonnet 5.5 a 2 $/10 $). Los modelos 4.7 y posteriores usan resolución alta: `⌈w/28⌉×⌈h/28⌉` tokens visuales, con un máximo de 4.784 tokens y lado largo de 2.576 px. Si la app reduce la foto a 1.568 px de lado largo (por ejemplo, 1568×1176 ≈ 2.352 tokens):
  - Haiku 5.5: ~2.800 tokens de entrada (0,00028 $) + ~300-800 de salida y razonamiento (0,00015-0,0004 $) ≈ **0,0005-0,0007 $ por foto**. A resolución completa, ≈ 0,001 $.
  - Sonnet 5.5: ~2.800 × 2 $ (0,0056 $) + ~500-1.000 de salida × 10 $ (0,005-0,01 $) ≈ **0,01-0,016 $ por foto**.
  - Recomendación: Haiku 5.5 por defecto. Una tabla nutricional es texto denso, pero bien encuadrada Haiku debería bastar; queda pendiente medirlo con 10-20 etiquetas reales [sin medir].
- **Privacidad:** la foto sale del dispositivo hacia Anthropic con la clave del usuario. Según la documentación, Anthropic no entrena con las imágenes subidas y estas no se guardan más allá de la petición (FAQ de visión). La retención de los registros de la API sigue la política comercial [no verificada en detalle]. Hay que avisar una vez, igual que con el aviso de la voz, y reducir y recortar la imagen antes de enviarla (los metadatos EXIF no se procesan, pero mejor no enviarlos: al reescalar en un canvas se eliminan).
- Fuente: https://platform.claude.com/docs/en/build-with-claude/vision (consultada 2026-10-15).

### 3.10 Transversal

- **Sin conexión, copiar frente a consultar:** se recomienda **copiar**. El alimento externo se guarda como `Food` propio con `source: 'off' | 'label'` y `ref: <EAN>`, y la entrada guarda su instantánea, como ya ocurre. Ventajas: funciona sin conexión, no repite peticiones (respeta los 15/min), sobrevive a cambios o borrados en OFF, entra en backups, export y fusión sin tocar `storage.ts`, y no hay migración. Desventajas: si OFF corrige la ficha, la copia no se entera (se acepta; quizá un botón «Actualizar desde OFF» más adelante). Antes de ir a la red, buscar el EAN en los `Food` propios por `ref`: si ya existe, no se consulta. Habría que revisar el límite de nombres únicos y el número de propios.
- **Privacidad y RGPD:** sin backend, la app no es «responsable» de un tratamiento centralizado, pero en el aviso debe decir qué sale del dispositivo:
  - OFF: el EAN, la IP y el user-agent del navegador. No es un dato de salud por sí mismo, aunque revela hábitos de compra.
  - Anthropic: la foto de la etiqueta (no de la persona) y la clave del usuario.
  - USDA: el texto buscado.
  - Nunca se envía el diario, el peso ni los objetivos.
  - El polyfill del código de barras procesa la imagen en local.
- **Licencias en un repo público:**
  - Atribución visible a OFF (texto «Datos de Open Food Facts (ODbL)» con enlace) en la ficha del alimento importado y en Ajustes o Acerca de.
  - No versionar volcados de OFF en el repo.
  - USDA es CC0 (ya citado en `foodCatalog.ts`).
  - BEDCA, solo con permiso.
  - Las dependencias MIT exigen conservar el aviso de licencia en el bundle (Vite lo conserva en los comentarios `@license`; conviene confirmarlo en el build).

---

## 4. Recomendación: fase 2 por ciclos (valor/esfuerzo)

0. **Ciclo 31 (en curso):** extraer `useFood`. Es el requisito previo que ya fijó el análisis del ciclo 30.
1. **Ciclo A (S): Open Food Facts por EAN tecleado, sin dependencias.**
   - `core/off.ts` puro: validar el EAN (dígito de control), mapear `nutriments` a `Food` (por 100 g o 100 ml; `energy-kcal_100g`, o kJ/4,184 si falta) y detectar fichas incompletas.
   - El fetch, fuera de `core/`, con `X-User-Agent`, timeout y manejo de 404, 429 y 503.
   - Antes de pedir nada, buscar el EAN en los propios por `ref`.
   - Pantalla de confirmación editable y guardado como propio con `source: 'off'` y `ref` = EAN.
   - Atribución a OFF y aviso de privacidad de una vez.
   - Asserts nuevos y un e2e con `page.route` mockeado.
2. **Ciclo B (S-M): leer la etiqueta con foto (Claude Haiku 5.5, clave del usuario).**
   - `<input capture>`, reducción en canvas a ~1.568 px y `askHaiku` con imagen.
   - Validación pura del JSON y el mismo formulario de confirmación que el ciclo A.
   - Si la foto contiene el EAN, guardarlo como `ref`. Sirve de alternativa cuando OFF no tiene el producto o está incompleto.
   - Sin clave, el botón se oculta.
3. **Ciclo C (M, requiere okay para una dependencia): escáner en vivo.**
   - `barcode-detector` sobre `zxing-wasm`, con el wasm alojado y precacheado y carga perezosa solo al abrir el escáner.
   - Usar `BarcodeDetector` nativa si existe; si no, el polyfill.
   - Probar en el iPhone el re-prompt de permisos.
   - Hacerlo solo si en A y B el usuario echa de menos escanear; teclear 13 dígitos o hacer una foto puede bastar.
4. **Ciclo D (S, sin red): ampliar el catálogo estático** con los genéricos que más se busquen sin resultado (USDA, CC0), una vez que haya datos.
5. **Más adelante o nunca:**
   - Importador CSV (Cronometer y FatSecret primero, por ser gratis y por alimento), solo si hay un caso real.
   - Atajos de iOS hacia Salud, como experimento.
   - USDA API con clave del usuario.
   - FatSecret, Edamam y Nutritionix, solo si algún día hay backend.
   - BEDCA, solo con permiso escrito.

Encaje con la fase 3 (voz): los ciclos A y B producen `Food` propios con nombre, lo que mejora `matchTracker`/`routeCapture` sin más cambios.

---

## 5. Decisiones para el usuario

| # | Decisión | Opciones | Recomendada |
|---|---|---|---|
| D1 | ¿Se permiten peticiones de red a terceros desde Comida? | Sí, a OFF (y a Anthropic con clave) / No, todo local | **Sí, a OFF y a Anthropic**, con aviso de privacidad de una vez |
| D2 | Dato externo: ¿copiar o consultar siempre? | Copiar como `Food` propio con `source`/`ref` / Consultar en cada uso | **Copiar** (sin conexión, sin migración, es el patrón actual) |
| D3 | Primera integración | OFF por EAN tecleado / Foto de etiqueta / Escáner | **OFF por EAN tecleado (ciclo A)** y después la foto (ciclo B) |
| D4 | Dependencia de escáner (`barcode-detector` + `zxing-wasm`, MIT, ~1 MiB de wasm perezoso) | Aceptar ahora / Aplazar / Nunca | **Aplazar** hasta usar A+B en el iPhone |
| D5 | Modelo para leer etiquetas | Haiku 5.5 / Sonnet 5.5 / Elegible | **Haiku 5.5** (~0,0006 $ por foto); medir con 10-20 etiquetas antes de cambiar |
| D6 | Búsqueda por nombre en OFF | Intentarla / Descartarla sin backend | **Descartarla** (sin CORS en Search-a-licious; la clásica a 10/min e inestable) |
| D7 | Contacto en `X-User-Agent` de OFF (el repo es público) | Email / URL del repo | **URL del repo** (`RPGLifeTracker/<versión> (+https://github.com/…)`) |
| D8 | Importador CSV de otras apps | Hacerlo ya / Solo si se necesita | **Solo si se necesita** (MyFitnessPal es de Premium y agregado por comida) |
| D9 | Apple Health vía Atajos | Experimentar / Descartar | **Descartar por ahora** (frágil; HealthKit no es accesible desde la web) |
| D10 | USDA API / BEDCA | Integrar / Ampliar el catálogo estático / Pedir permiso a BEDCA | **Ampliar el catálogo estático (USDA CC0)** cuando haya datos de búsquedas fallidas; BEDCA solo con permiso |
