# Análisis ciclo 36 — comida por voz en la captura (sin IA)

**Entregado:** parser de comida, tarjeta en el «+» con Deshacer, FV4 (hábito + «Apuntar también en Comida»), Comida prerrellenada, e2e y docs. Review APROBADO (0 bloqueantes, 2 menores).

**Deuda nueva:** «beef 200 g» casa con Beer y abre el formulario sin guardar (guardia de unidad g/ml → comida sugerida). Parche `ponytail:` en `pickCapture` (manda el parser si ve comida y Haiku ve hábito nuevo o nada), a revisar en el 38.

**Riesgos ciclo 37 («Dictar» en Comida):** reutilizar el parser sin pasar por el choque con hábitos; guardar en el día del selector (no solo hoy); el gesto del micro debe arrancar la escucha en iOS; cuidar de no duplicar la lógica de la tarjeta.

**Riesgos ciclo 38 (Haiku y memoria):** el parche de `pickCapture` debe retirarse o redefinirse; alimento desconocido estimado por Haiku nunca se guarda solo (FV3); extender O1/O3 a comida sin falsos positivos (misma familia que «beef»/Beer y `deviceSure` por palabra suelta); tests sin llamar a la API real.
