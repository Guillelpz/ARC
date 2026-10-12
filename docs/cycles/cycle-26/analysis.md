# Análisis ciclo 26 — registro de series de Gym por voz

## Entregado frente a lo especificado
V1-V5 y decisiones A-E entregadas: micro en Gym y «Hoy», Web Speech con caída al campo de texto, parser ES/EN en `core/voice.ts` (VZ1-VZ19), Haiku 5.5 por `fetch` con clave en Ajustes (fuera de copias, fusión y «Borrar todo»), guardar y revisar (Deshacer/Editar), «Probar voz» y checklist en DEPLOY. Recortado a propósito: T8 (`KEYBOARD_ON_IOS` queda en `'never'`) a la espera de la prueba en iPhone; solo Gym (otros trackers por voz, otro ciclo).

## Deuda nueva
- Menores del review sin tocar: el parser no cubre «a 80 kilos» ni «Nx» con espacios raros; `preview.allowedHosts` en `vite.config.ts` para túneles (inocuo).
- Parser de un solo ejercicio y un peso por comando; sin reintentos ni caché en Haiku.
- Riesgo CI: una ejecución local falló 12 tests (axe A4-A13, U-F4), no reproducida en 14; probable timeout de 5 s por carga. Vigilar.
- Clave de Anthropic en localStorage de un origen compartido (`guillelpz.github.io`): usar clave con límite de gasto.

## Fricción del proceso
- Review en 2 vueltas: los números en palabra (decenas, compuestos, «ochenta cinco») salieron en cascada; la spec debió exigir una tabla completa de números hablados desde el inicio.
- Flaky U-V3/U-V6b: se «arregló» primero esperando en el test (`539a120`); la causa real era un bug (ref de callbacks con `useEffect` en `VoiceLog`, corregido con `useLayoutEffect` en `b27ec55`). Lección: un test intermitente se trata como bug hasta demostrar lo contrario.
- La vuelta 2 se verificó sin tercera ronda de review.
- Los commits del implementer llevan trailer «Sonnet 5.5»; no se reescribe el historial.

## Huecos para el siguiente ciclo
- Ejecutar T8 en la PWA de Pages (iPhone) y fijar `KEYBOARD_ON_IOS`.
- Sin uso real de la voz aún: medir si el parser sin clave basta antes de ampliar a otros trackers.
- Si la CI muestra timeouts, subir `testTimeout` o aligerar los tests de axe.
