# Review ciclo 23 — Límite semanal VILLAIN (P23.1)

Veredicto: **APROBADO (OK)**. 0 bloqueantes, 0 importantes, 1 menor.

Verificación en `app/` sobre `cycle-23`: `npm run build` OK, `npm run lint` OK (0 warnings), `npm test` OK (104 tests).

## Comprobaciones
- Spec y 5 decisiones del §3: se cumplen. Sin historial de límites, sin aviso en Inicio, avisa solo con `week > límite`, conflicto de fusión y sin campo al crear.
- Producto: `over` es un campo nuevo en `TrackerStats`. `weeklyGoal`, `streak`, `weekly`, `todaySummary`, `rpg.ts` y `party.ts` no cambian. L4 comprueba igualdad de XP, niveles, racha, Hoy, party y ranking con y sin límites.
- localStorage hacia atrás y adelante: sin migración, y la ausencia de `limits` o `weeklyLimit` significa «sin límite». Los límites de las fijas están en `limits` y no en `goals`, así que las versiones desplegadas lo conservan como clave desconocida y no avisan de datos dañados. `'limits'` está en `KNOWN` y `readCustom` valida las entradas. `weeklyLimit` en un tracker HERO o con valor inválido se borra y cuenta como `fixed`.
- `mergeBackup`: `sig` incluye `weeklyLimit`. Los límites distintos cuentan como conflicto y se conserva lo local. `limits` vacío se borra. L6 lo cubre.
- Export, import y `.backup.last`: pasan por `readCustom`. C17 hace el round-trip. `hasData` cuenta `limits`.
- selfcheck: solo hay líneas añadidas (L1–L6) y un cambio de import. No se tocó ningún assert existente.
- UI y accesibilidad: el aviso usa `aria-live="polite"` en un `<p>` que está montado siempre que haya límite, con `sr-only` mientras no se supera. El icono es `aria-hidden` y el texto hereda color de la tarjeta, sin hex ni `slate-*` ni mezcla de paletas. Tono neutro, «Pasarte no cambia tu XP». A7 pasa axe. El `aria-label` del lápiz distingue objetivo y límite.
- Exceso: ninguno.

## Hallazgos
1. **menor** — `app/src/core/storage.test.ts:340`. Los tests nuevos reutilizan `C15`, que ya existe en la línea 331 (`C15 __proto__`). Renómbralos a `C18`, `C19` y `C20` (la spec decía C15–C17 por error) y ajusta la mención en `docs/TECH_SPEC-limite-villain.md` §4 si se quiere. No bloquea.
