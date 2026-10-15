# Review ciclo 37

Veredicto: APROBADO

build, lint y test (273) pasan en cycle-37.

## Hallazgos

- menor — `app/src/core/selfcheck.ts` (FVZ12b): la guardia g/ml solo tiene un assert negativo («beef 200 g») y uno de no regresión («beer»). Falta uno que fije que un hábito aproximado con unidad legítima (Running «5 km», Reading «20 min») no se desvía a comida. CV/MC siguen en verde.
- menor — `app/src/core/capture.ts:153`: `MEASURE_G_ML` exige espacio tras el dígito. Si `captureNorm` no separa «200g», «beef 200g» seguiría yendo a hábito. Conviene comprobarlo o usar `\d\s*`.
- menor — `FoodVoiceLog.tsx`: «hola» genera un ítem pendiente (desviación declarada). Es aceptable por la spec, pero el texto «No se ha entendido» queda casi inalcanzable.

## Comprobado

- El día del selector se usa al guardar: `addVoice(adds, r.day)` y `dietSync` con `[day]`. Hay test U-FV7 con «Ayer» y Deshacer.
- Otro día dicho en la frase no guarda (A7): `localFood` devuelve `other-day` y el test U-FV8 lo cubre.
- La escucha arranca dentro del gesto: `dictate` → `begin` → `listen` sin `await` previo, igual que VoiceLog.
- Deshacer y Editar anulan las entradas y devuelven los ítems como pendientes.
- Accesibilidad y estilo: `role=status`, label en el input, tokens VT.hero sin hex, paleta HERO.
- Mover los helpers a `foodVoiceText.ts` está bien. La guardia en el commit de T37.1 es aceptable.
