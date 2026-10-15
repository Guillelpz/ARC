# Revisión ciclo 33 — Foto de la etiqueta

Veredicto: APROBADO

build, lint y test (256) en verde sobre cycle-33. 0 bloqueantes, 0 importantes, 2 menores.

Comprobado: postHaiku admite content array y timeoutMs sin cambiar el valor por defecto (tests de askHaiku intactos); askLabel con timeout de 20 s; downscale a 1568 px sin ampliar, JPEG 0.85, solo se envía el reencuadre (sin EXIF), HEIC no decodificable lleva a null y a error `image`; labelFromAI valida por 100 g/ml o por ración (reescala), kcal desde kJ, valores absurdos a null, coherencia de kcal como aviso sin bloquear; revisión en FoodCustom con source 'label'; sin clave el botón no se ofrece y se explica; aviso de privacidad una vez; la foto no se persiste; tests con fetch/downscale simulados.

Menores (no bloquean):
- app/src/components/FoodLabel.tsx: `coherent` de LabelResult no se usa (FoodCustom recalcula); campo muerto salvo en asserts.
- app/src/components/FoodLabel.tsx: el clic extra de «Hacer o elegir foto» tras aceptar el aviso es aceptable, pero queda como deuda ponytail (iOS puede bloquear el click() programático tras el aviso: validar en la checklist del iPhone).

Pendiente de proceso (I4): el usuario debe ejecutar la checklist con 10-20 etiquetas reales antes de cerrar el ciclo.
