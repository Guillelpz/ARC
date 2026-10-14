# Análisis ciclo 28 — menos llamadas a Haiku en la captura (O3 + O1, M-B)

## Entregado frente a lo especificado
- T1-T5 completas: O3 (`deviceSure`: gym completo, coincidencia exacta y única, otro día → sin Haiku), O1 (`core/memory.ts`, LRU de 200 frases confirmadas por Haiku, validadas contra lo activo, olvidadas al «Deshacer»/«Editar»), clave `life-rpg-capture-memo-v1` fuera de copias y vaciada por «Borrar todo». Asserts CV12-CV13 y MC1-MC5, ninguno relajado. Sin cambios de UI.
- Recortado: T6 (D1) fuera de alcance a propósito. Tests de UI U-M1..U-M3 en lugar de U-C8..U-C10 (desvío aceptado).

## Deuda nueva
- Menor 1: U-M3 (`App.test.tsx`) exporta con datos vacíos y `as never`; prueba poco. Falta cubrir `restoreLast`/`parseBackup` en `storage.test.ts`.
- Menor 2: `memoKey` usa `captureNorm` pero en gym se aprende el texto original; «100kg» pegado deja dígitos en la clave y no casa con otro número. Solo pierde aciertos; sin assert.
- Menor 3: `deviceSure` casa por palabra suelta («I ran out of milk» → Running); riesgo de falso positivo sin llamada a Haiku.
- `ponytail:` nuevo: deshacer desde la pantalla de misiones no olvida la frase aprendida.

## Fricción del proceso
- Sin fallos relevantes: review aprobada a la primera. Único roce: los ids de tests de UI de la spec no coincidieron con los implementados.

## Huecos y riesgos para el siguiente ciclo
- Sigue pendiente la prueba en iPhone real (T8, `KEYBOARD_ON_IOS`) y el e2e de captura.
- Medir el ahorro real de llamadas a Haiku; la caché es solo local y sin caducidad por antigüedad.
- Vigilar falsos positivos de `deviceSure` antes de ampliar O3.
