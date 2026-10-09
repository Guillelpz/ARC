# Análisis ciclo 12 — Registrar desde «Te faltan»

## Entregado frente a lo especificado
Completo (T1+T2): cada fila de «Te faltan» tiene «+» que llama a `add(t, t.increment)` (hoy, mismos clamps y feedback), la fila navega a su rama, foco a `h2#hoy` cuando `left <= increment`, tests U21/U22. Sin cambios en `core/`. Nada recortado. Review aprobado a la primera, build/lint/test verdes (79/79, 3 ejecuciones).

## Deuda nueva
- menor sin corregir: `HomeView.tsx` usa `left!` y compara el foco con `m.left`; si `add` llegara a recortar la cantidad, el foco podría desincronizarse. Hoy inocuo (incremento positivo).
- `ponytail:` nuevos: ninguno.

## Fricción del proceso
Ninguna relevante: un solo ciclo sin rebotes. Solo el `STATE.md` se actualiza en un commit aparte tras el merge.

## Huecos para el siguiente ciclo
- El «+» solo registra el incremento fijo y solo hoy; no hay cantidad ni día desde la home.
- Sin deshacer directo desde «Te faltan» (hay que ir a la rama); un toque accidental exige navegar.
- Los tests siguen dependiendo de textos/aria-labels de la UI; sigue sin e2e real.
