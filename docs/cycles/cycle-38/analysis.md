# Análisis ciclo 38 y balance de la fase 3 (voz de Comida)

## Entregado frente a lo especificado
- Ciclo 38: Haiku con esquema ampliado (`foods[]`) en la captura y en «Dictar comida» (`interpretFood`), estimaciones y raciones propuestas con confirmación (FV3), O3/O1 extendidos a comida. Sin recortes relevantes.
- Fase 3 (36-38): parser ES/EN sin IA (36), «Dictar comida» en Comida con día del selector (37), Haiku y memoria (38). FV1-FV6 cumplidas. Con esto el módulo Comida queda completo (fases 1-3).

## Deuda nueva
- Menor residual: excepción del catálogo (`head` en `foodItemsFromAI`): «arroz con pollo» puede quedar como Arroz y guardarse sola; mitigado con Deshacer/Editar.
- Coste ≈ 0,003 $ por frase con comida, estimado, sin medir.
- Frases de varios alimentos no se aprenden (O1); la estimación de Haiku se valida solo por rangos.
- Del 37: «hola» genera un pendiente; dos shells de micro duplicados (`ponytail:`).
- Pendiente del usuario: pruebas en iPhone de las fases 2 y 3.

## Fricción del proceso
- El review necesitó 2 vueltas (aviso de privacidad sin actualizar). Costó más la caza de tests intermitentes: el reviewer atribuyó la causa al timeout de `findBy*` y el orquestador halló la real (lectura de localStorage antes del efecto de guardado). Ajuste: el reviewer debe pedir reproducción antes de teorizar; la regla `vi.waitFor` ya está en §3 de ESTADO-ACTUAL.
- Cambios de privacidad (nuevos datos enviados a Anthropic) deberían ir en la lista de comprobación del implementer.

## Huecos para el siguiente ciclo
- Medir el coste real y la tasa de aciertos de Haiku en comida con uso real antes de ampliar.
- Validar en iPhone (voz, `KEYBOARD_ON_IOS`, escáner, etiquetas) antes de abrir más funcionalidad de voz.
- Pospuestos de Comida: copiar día, fibra/azúcar/sal, agua, comidas separadas, TDEE; catálogo sin platos españoles.
