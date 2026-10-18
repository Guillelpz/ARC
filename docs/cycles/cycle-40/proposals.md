# Propuestas — ciclo 40

Contexto: ciclos 1–39 cerrados; Comida (fases 1-3) y Gym (núcleo + ciclo 25) completos y probados en iPhone. No se repiten P24.11/P39.4 (temporizador, rechazada) ni P13.4 (endpoint). P3.5, P24.6, P24.9 y P39.2 siguen pospuestas: no ha cambiado nada que las desbloquee (sin datos de uso real nuevos), así que no se reabren aquí. P40.2 deja fuera, a propósito, la parte de P39.2 «olvidar la frase al deshacer desde misiones».

## P40.1 — Espacio de almacenamiento: medir y avisar antes de llenarse (`calidad`)
- Problema: la estimación de `storage.ts:296` («~5 años hasta el límite de ~5 MB») es anterior a Comida y solo cuenta eventos. Hoy cada entrada de comida guarda una instantánea completa (`FoodEntry`). Además, `.backup.last` y `.backup.prev` duplican todas las claves de datos (eventos, gym, comida y custom), así que los datos ocupan unas 3 veces su tamaño. Los `.backup.<stamp>` no se purgan nunca (`storage.ts:260`). Al llenarse, el guardado falla y solo entonces sale `SaveFailBanner`: el usuario se entera cuando ya no se guarda lo que apunta. Es el riesgo de pérdida de datos más concreto que queda sin backend (§4 «Persistencia»).
- Propuesta:
  - Una función pura en `storage.ts` que mida los bytes por clave de la app (datos, backups y caché de voz).
  - En «Tus datos», una línea «Ocupado: X MB de ~5 MB».
  - Un aviso persistente desde un umbral (por ejemplo, 70 %), con «Exportar copia» y una acción para borrar los `.backup.<stamp>` sellados (con confirmación y exportando antes).
  - Recalcular la estimación del `ponytail:` con datos de Comida.
  - Tests en `storage.test.ts`.
  - **No** incluye: migrar a IndexedDB, compactar el log ni tocar `.backup.last`/`.prev`.
- Valor: alto (adelanta el único fallo de guardado previsible) / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: —

## P40.2 — Voz sin clave: no guardar hábitos por palabras sueltas, y menores de la captura (`deuda`)
- Problema: sin clave de Anthropic, el router sigue guardando «I ran out of milk» como Running +1 (`capture.ts:184`, `ponytail:`). En el ciclo 39 solo se endureció el camino con clave (`deviceSure`). Hay además deuda abierta en §4 «Voz»:
  - `memoKey` no separa «100kg» pegado y pierde aciertos de caché.
  - La cuenta atrás de «hábito nuevo» no se para si la tarjeta aparece con la pestaña oculta.
  - Falta el assert de que `voiceSummary` no contiene la clave.
  - El test U-M3 es débil.
- Propuesta:
  - Sin clave, un hábito existente con palabras ajenas al hábito y sin cantidad dicha no se guarda solo: sale una tarjeta «¿Apuntar en Running?» con «Apuntar» y «Escribir a mano».
  - Con cantidad o con coincidencia limpia, se guarda como hoy.
  - Separar número y unidad en `memoKey`.
  - Parar la cuenta atrás si `document.hidden`.
  - Assert de `voiceSummary` y endurecer U-M3.
  - Asserts CV nuevos o revisados.
  - **No** incluye: olvidar la frase al deshacer desde misiones ni métricas de Haiku (P39.2, pospuesta), ni fechas tipo «el 3 de octubre».
- Valor: medio (evita registros falsos con XP en el uso sin clave) / Coste: S / Riesgo: bajo
- Requiere: matiz de C3 («hábito existente se guarda directamente») solo para el caso sin clave, sin cantidad y con palabras ajenas. Necesita el okay del usuario.
- Depende de: —

## P40.3 — Open Food Facts: fichas con datos solo por ración y saneamiento del código de barras (`producto`)
- Problema: `parseOff` solo lee los valores `_100g` (§4 «Comida»). Un producto de OFF que solo trae `_serving` queda incompleto y el usuario tiene que teclear la nutrición, que está en la ficha. Menores abiertos:
  - `FoodBarcode` comprueba la conexión dos veces (`net.online` y `navigator.onLine`).
  - `mergeLog` puede dejar dos alimentos propios con el mismo `ref`/EAN tras fusionar. `foodByRef` lo tolera, pero «Ya lo tienes» elige uno al azar del orden.
- Propuesta:
  - Si faltan los valores `_100g` y la ficha trae `serving_quantity` en g/ml, convertir de ración a 100 g/ml (mismo criterio que `labelFromAI`), con la nota «calculado desde la ración» en «Revisar alimento».
  - Una sola comprobación de conexión.
  - `foodByRef` prefiere el alimento activo y más reciente de forma determinista.
  - Assert FI nuevo y casos en `off.test.ts`.
  - **No** incluye: búsqueda OFF por texto (I5, descartada) ni deduplicar alimentos al fusionar.
- Valor: medio (menos tecleo en el flujo más usado de Comida) / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: —

## P40.4 — Gym: editar rutinas y partir `GymView` (`producto`)
- Problema: las rutinas no tienen editor: para cambiar una serie objetivo o quitar un ejercicio hay que borrarla y volver a guardarla desde la sesión de un día (§2 Gym, §4 Gym). `GymView.tsx` ronda las 380 líneas. Al reponer la sesión automática tras «−»/deshacer no sale ningún aviso (§4 Gym), y el usuario ve que la sesión «no se quita» sin saber por qué.
- Propuesta:
  - «Editar» en cada rutina: renombrar (nombre único), quitar ejercicios, cambiar series objetivo y reordenar con subir/bajar, sin arrastrar.
  - Validación en `core/gym.ts` con un assert GY nuevo.
  - Extraer la tarjeta Rutinas (y lo que haga falta) de `GymView.tsx`.
  - Aviso en `liveText` al reponer la sesión: «Hay series ese día: la sesión se mantiene».
  - **No** incluye: crear rutinas desde cero sin sesión, nivel Gym (P24.6) ni sobrecarga progresiva (P24.9).
- Valor: medio / Coste: M / Riesgo: bajo (las rutinas ya se validan y fusionan por id)
- Requiere: nada.
- Depende de: —

## P40.5 — Formulario «Escribir a mano» con Haiku usando la clave del usuario (`producto`)
- Problema: en producción, el formulario a mano (`UnknownView`) clasifica solo con la heurística de palabras clave (`classify.ts:66`, solo en dev con el proxy), aunque el usuario ya tenga su clave guardada para la voz. Hay dos caminos de IA y el código lo reconoce como deuda (`haiku.ts:92`, `ponytail:`; §4 «IA»). Es justo el camino al que la captura manda los casos difíciles («Escribir a mano»).
- Propuesta:
  - Con clave, `classifyAI` usa `postHaiku` con esquema estructurado (rama, tipo, unidad, XP/unidad) y el timeout de 8 s.
  - Sin clave o ante un fallo, la heurística de siempre. El proxy de dev se elimina o queda como alternativa solo en dev.
  - Tests con `fetch` simulado. La API real nunca se llama en tests.
  - **No** incluye: endpoint propio (P13.4, rechazada), cambiar la confirmación manual de rama, tipo, unidad y XP, ni crear el hábito sin confirmar.
- Valor: medio (mejor clasificación en el flujo manual sin coste nuevo de infraestructura) / Coste: S-M / Riesgo: medio (la clave en el navegador es un riesgo asumido y ya existente; el envío de texto a Anthropic necesita el mismo aviso de privacidad que la voz)
- Requiere: ampliar la excepción de la decisión vigente «IA: solo heurística en producción», hoy limitada a la voz (V3), al formulario a mano. Necesita el okay explícito del usuario. Sin dependencias de runtime.
- Depende de: —
