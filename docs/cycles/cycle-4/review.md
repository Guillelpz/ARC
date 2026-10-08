# Review ciclo 4 — otro día y deshacer

Veredicto: **APROBADO**

build, lint y test (29 tests) en verde sobre `cycle-4`. Los asserts existentes de selfcheck no cambian (la única línea eliminada del diff es el `import`). Se añaden A1–A5 y S1–S3 tal como pide la spec.

## Puntos de atención
1. Datos: `readEvents` repara `undoes` inválido (no string, vacío, null) conservando el evento y contando `dropped`. `loadAll` y `parseBackup` pasan por `readEvents`. Los eventos antiguos sin el campo no cambian. S1–S3 cubren leer, reparar y exportar/importar.
2. Fechas: `dayTotal` y `clampAmount` usan `[day, day+1)`. Las tres barreras contra fechas futuras están: `max`, `onChange` y `if (day > today)` en `add`. `nowStamp(day)` usa el día elegido y la hora actual.
3. Deshacer: el negativo copia el `occurredAt` original, así que cae en el mismo día y semana. `add` exige `amount === -undo.amount`. `clampAmount` impide dejar el día en negativo. `canUndo` se desactiva si «−» ya consumió el día.
4. Selfcheck: sin asserts relajados.

## Hallazgos
- bloqueante: 0
- importante: 0
- menor: 2
  - `app/src/App.tsx:84-88`: `add` no comprueba que `undo` no esté ya deshecho. Solo lo impide la UI (`undone` oculta el botón). Con dos positivos el mismo día, un segundo deshacer fuera de la UI pasaría el clamp. Corrección: rechazar si ya existe un evento con `undoes === undo.id`.
  - `app/src/core/stats.ts:34`: `history` marca como deshecho el destino de cualquier `undoes`, aunque el evento que lo lleva sea positivo (datos editados a mano). Corrección: considerar solo los `undoes` de eventos con `amount < 0`.
