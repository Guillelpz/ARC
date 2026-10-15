# Propuestas — ciclo 39

Contexto: el módulo Comida está completo (fases 1-3, ciclos 29-38). El análisis del ciclo 38 pide medir Haiku con uso real y validar en iPhone antes de abrir más voz. Siguen vigentes estas decisiones: sin backend, PARTY simulada y dependencias de runtime solo con okay.

## P39.1 — Comida: copiar el día anterior (`producto`)
- Problema: F10 lo dejó pospuesto. Hoy, repetir un día parecido obliga a añadir alimento a alimento o a guardar antes un plato (`useFood.ts`, `addMeal`). Es el hueco de Comida con más uso diario.
- Propuesta: en el día del selector, un botón «Copiar de ayer» (o del día anterior con registros) que añade de golpe todas las entradas vivas de ese día como instantáneas nuevas, con un solo `setFood`, un solo `dietSync` y un «Deshacer» único, como la voz con varios alimentos. Necesita un helper puro en `food.ts` con un assert FD nuevo. NO entra: elegir qué entradas copiar (se usa «Deshacer» por entrada), copiar desde cualquier fecha ni comidas separadas.
- Valor alto / Coste S / Riesgo bajo
- Requiere: nada.
- Depende de: —

## P39.2 — Medir el coste y la tasa de aciertos de Haiku en el dispositivo (`calidad`)
- Problema: el coste de 0,003 $ por frase con comida es estimado y no está medido (§4 de ESTADO-ACTUAL, «Comida»). El análisis del ciclo 38 pide medirlo, junto con los aciertos, antes de ampliar la voz. Hoy no se registra nada.
- Propuesta: contadores locales en una clave de dispositivo nueva, fuera de copias como la memoria M-B: llamadas a Haiku por flujo (captura, gym, comida, etiqueta), tokens de entrada y salida leídos de `usage` en la respuesta de `postHaiku`, llamadas evitadas por O3/O1, y capturas deshechas o editadas. Se muestran en Ajustes como «Uso de IA (este dispositivo)», con el coste aproximado y un botón para reiniciar. NO entra: enviar métricas a ningún sitio ni guardar las frases.
- Valor medio (desbloquea decidir sobre la voz con datos) / Coste S / Riesgo bajo
- Requiere: nada (una clave nueva de localStorage, solo de este dispositivo).
- Depende de: —

## P39.3 — Saneamiento: errores de voz que guardan datos equivocados y menores de datos (`deuda`)
- Problema: `deviceSure` casa por palabra suelta («I ran out of milk» → Running) y se salta a Haiku, así que guarda un registro falso. Deshacer desde misiones no olvida la frase aprendida (§4, «Voz»). `readGym` no deduplica ids de rutina (§4, «Gym»). `saveMeal` admite nombres repetidos, `deleteMeal` borra sin confirmación y `addMeal` no avisa si el plato no existe (§4, «Comida (menores)»). Además hay nombres USDA imprecisos (§4, «Catálogo USDA»).
- Propuesta: exigir a `deviceSure` que la frase sea el nombre o alias del hábito más, como mucho, la cantidad y la unidad, con un assert CV nuevo. Olvidar la frase al deshacer un evento que vino de la captura. Deduplicar los ids de rutina en `readGym`. Nombres de plato únicos y confirmación al borrar un plato. Renombrar las 3-4 filas imprecisas del catálogo sin cambiar su `ref`. NO entra: rehacer el matching ni la heurística «arroz con pollo» → Arroz (se espera a los datos de P39.2).
- Valor medio (menos registros falsos guardados solos) / Coste M / Riesgo bajo
- Requiere: nada.
- Depende de: —

## P39.4 — Gym: temporizador de descanso (P24.11) (`producto`)
- Problema: está pospuesto desde el ciclo 24 (STATE.md). Gym ya tiene progreso, volumen, rutinas y voz (ciclos 25-26), y entre series hay que salir de la PWA para cronometrar el descanso.
- Propuesta: al registrar una serie se ofrece una cuenta atrás de descanso, con duración configurable (60/90/120/180 s; se guarda en `GymData` como preferencia, igual que la unidad). Avisa por vibración (`navigator.vibrate` donde exista) y con texto en vivo para a11y. Es solo UI, sin eventos ni XP. NO entra: notificaciones en segundo plano ni el service worker (iOS no las garantiza con la PWA cerrada), ni la sobrecarga progresiva (P24.9 sigue pospuesta).
- Valor medio / Coste S-M / Riesgo bajo (en iOS los temporizadores se pausan en segundo plano, así que el tiempo restante se calcula con la hora de inicio)
- Requiere: nada (un campo opcional nuevo en `GymData`, validado en `readGym` y fusionado como la unidad).
- Depende de: —

## P39.5 — Cerrar la validación en iPhone y fijar `KEYBOARD_ON_IOS` (`calidad`)
- Problema: siguen abiertas las checklists de `DEPLOY.md` de los ciclos 26-27 (T8), 33 (I4, etiquetas), 35 (escáner) y 36-38 (voz de Comida). `KEYBOARD_ON_IOS` sigue en `'never'` (§4, «Voz»). El análisis del ciclo 38 pide validar antes de abrir más voz.
- Propuesta: unificar las checklists en una sola sección de `DEPLOY.md`, ordenada por tiempo de prueba, y que «Probar voz» genere un resumen copiable (agente, modo standalone, resultado de cada API) para pegarlo en el chat. Con el resultado del usuario: fijar `KEYBOARD_ON_IOS` y corregir lo que falle, dentro del mismo ciclo si es pequeño. NO entra: funcionalidades nuevas de voz.
- Valor alto (riesgo real de que la voz o el escáner no funcionen en el único dispositivo del usuario) / Coste S, más el tiempo del usuario / Riesgo bajo
- Requiere: la prueba del usuario en el iPhone (bloqueante para la segunda mitad).
- Depende de: —

## No propuestas en este ciclo
- Agua, fibra/azúcar/sal, comidas separadas y TDEE (F10): fibra/azúcar/sal obliga a volver a transcribir 188 filas de USDA y amplía F6; TDEE necesita datos corporales, que F7 descartó; comidas separadas cambia F3. Ninguna tiene hoy evidencia de uso que la justifique; mejor esperar a usar «copiar día» (P39.1).
- P3.5 (cuentas), P13.4 (endpoint) y P24.6 (nivel Gym): nada ha cambiado desde que se pospusieron; siguen sin okay a backend ni a cambiar las reglas de juego.
