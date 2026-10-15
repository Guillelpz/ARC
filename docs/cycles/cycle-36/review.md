# Review ciclo 36 — APROBADO

build, lint y test (269) pasan en cycle-36.

Hallazgos: 0 bloqueantes, 0 importantes, 2 menores.

## Menores
1. `capture.ts` (routeCapture) y `classify.ts`: «beef 200 g» y «ate 200 g of beef» caen en el hábito aproximado Beer. Comprobado: `kind tracker`, `amount null`, `problem unit`, no está listo y `deviceSure` es false. Abre el formulario sin apuntar nada (sin clave). No guarda 200 cervezas. «200 gramos de ternera» va a comida (1 ítem). Sugerencia: guardia de unidad que mande a comida una frase con g/ml cuando el hábito aproximado no mide en masa.
2. `capture.ts` pickCapture: el parche `ponytail:` es correcto y está acotado al ciclo 38. Mantenerlo en el backlog del 38.

## Verificado
- Prioridad de routeCapture: otro día, gym, exacto (+comida adjunta FV4), comida, aproximado, comida desconocida, nuevo. «otro día» no guarda («... ayer» da other-day).
- Los CV/MC siguen intactos (el selfcheck pasa).
- «arroz y pollo» da 2 ítems listos, `deviceSure` true. «hamburguesa 200 g» da Burgers +1 con comida adjunta.
- Guardado múltiple: un `addVoice` (un solo setFood y dietSync) y un `undoVoice`. FV4 tiene dos «Deshacer» separados (A6).
- a11y: role=status, botones con aria-label y foco gestionado; tokens HERO sin mezclar.
