# Análisis ciclo 39

## Entregado frente a lo especificado
Todo lo aprobado: checklist unificada en `DEPLOY.md` y «Copiar resumen» (sin clave); «Copiar día anterior» en Comida (`copyDay`, un solo «Deshacer», FD18); `deviceSure` ya no guarda sin cantidad (CV13 cambiado, CV14); `readGym` descarta rutinas con id repetido; menores de los platos; 3 filas USDA renombradas con alias. Review APROBADO, 297 tests. Recortado a propósito: fijar `KEYBOARD_ON_IOS` y arreglar fallos de iPhone.

## Deuda nueva
- Menor 1: falta un assert de que `voiceSummary` no contiene la clave (la función no la recibe).
- Menor 2: borrar un plato usa `window.confirm` (desviación declarada de U-FD10).
- Sin `ponytail:` nuevos relevantes. Sigue la fusión que puede traer platos con el mismo nombre.

## Fricción del proceso
Sin bloqueos. El ESTADO-ACTUAL ya lo había actualizado el implementer; al cierre solo hizo falta ajustar fecha y deuda.

## Pendiente y riesgos para el siguiente ciclo
- **Mini-ciclo de iPhone (bloqueado por el usuario):** arranca cuando mande los resultados de la checklist unificada de `DEPLOY.md` y el «Copiar resumen». Contenido: fijar `KEYBOARD_ON_IOS` (`'standalone'` o `'always'`; hoy `'never'`), arreglar los fallos (T8 de voz, captura, checklist I4 de etiquetas, `click()` tras el aviso, escáner en PWA).
- **P39.2** (métricas de Haiku) y **P39.4** (temporizador de descanso, sin vibración en iOS): pospuestas. Tampoco olvidar la frase al deshacer desde misiones.
- Riesgo: toda la voz y la cámara siguen sin validar en dispositivo real; no añadir funcionalidad de voz nueva antes de ese resultado.
