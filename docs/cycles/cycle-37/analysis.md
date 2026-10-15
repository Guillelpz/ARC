# Análisis ciclo 37

## Entregado
«Dictar comida» en la pantalla Comida (`FoodVoiceLog`, `interpretFood` local, sin IA): guarda en el día del selector con la misma tarjeta que la captura; otro día dicho en la frase no guarda. Guardia g/ml en `routeCapture` («beef 200 g» ya no cae en Beer). Nada recortado. Tests 273 en verde.

## Deuda nueva
- Menor 3 sin corregir: «hola» genera un ítem pendiente; «No se ha entendido» casi inalcanzable.
- `ponytail:` nuevos: dos shells de micro (VoiceLog y FoodVoiceLog); `interpretFood` sin Haiku hasta el 38.
- Menores 1 y 2 corregidos antes del merge («200g» pegado; FVZ12b con Running/Reading).

## Fricción
Los menores 1 y 2 los corrigió el orquestador tras el review, sin segunda vuelta. El implementer ya editó ESTADO-ACTUAL en el ciclo, así que el cierre fue de ajuste.

## Riesgos del ciclo 38 (Haiku + memoria)
- Parche `ponytail:` de `pickCapture` (manda el parser si ve comida y Haiku ve hábito nuevo o nada): revisarlo cuando Haiku conozca la comida, o dejará de ser necesario.
- `max_tokens` 1000: varios alimentos por frase con estimación de macros pueden truncar el JSON; validar el tope (máx. 8 ítems) y que el truncado caiga al parser.
- CV9 (selfcheck de la memoria) puede chocar al extender O1/O3 a comida (claves de `memoKey`, «recall» solo si el alimento sigue vivo): revisar el assert antes de tocar `memory.ts`.
- La estimación de Haiku nunca se guarda sola (FV3); no mezclarlo con `deviceSure`.
