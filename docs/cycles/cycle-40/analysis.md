# Análisis ciclo 40 — Almacenamiento y voz sin clave

**Entregado vs especificado.** T1-T7 completos, review APROBADO (0 bloqueantes, 0 importantes, 2 menores). P40.1: `storageUsage`/`usageWarn` puros y de solo lectura, aviso en «Tus datos» al 70 % de una cuota estimada de 5 M caracteres, sin purga (D3). P40.2: `needsConfirm` + tarjeta «¿Apuntar en X?» (D1) cuando no hay coincidencia exacta y limpia y no se dijo cantidad; cuenta atrás parada con la pestaña oculta; asserts nuevos SU1, CV15, MC6 y U-M3 reforzado (exporta de verdad). Nada recortado dentro del ciclo; P40.3 pospuesta y P40.4/P40.5 pasan al 41 por decisión del usuario.

**Deuda nueva.**
- menor: `docs/TECH_SPEC-cycle40.md:131,266` cita «leí un libro» como tarjeta (error de la evaluación; es `deviceSure` y se guarda sola). Se resuelve al eliminar la spec.
- menor: `App.tsx:129` mide el espacio con cada cambio de `events`/`food` en Inicio, no solo tras guardar; coste de unos ms con >3 MB.
- `ponytail:` nuevos (4): medir solo al entrar en Inicio con >3 MB; `needsConfirm` ignora palabras de <3 letras y una frase mixta hábito+comida ya no es segura; `STORAGE_QUOTA` estimada; `saveFood` ~0,62 M/año (límite en ~3 años con copias ×3, cifra sin test).

**Fricción del proceso.** La evaluación asumió un ejemplo («leí un libro») sin comprobarlo en `selfcheck.ts:671`; el implementer tuvo que desviarse y el reviewer arbitrar. Conviene que el evaluator verifique en código los ejemplos que cambia. El implementer actualizó `ESTADO-ACTUAL.md` en T7 (útil, el analista solo añadió la deuda).

**Para el ciclo 41.** P40.5 (D2): Haiku en «Escribir a mano» con la clave del dispositivo y quitar el proxy dev; hay que reescribir las frases de CLAUDE.md sobre `classifyAI` y `__AI_PROXY__` y añadir aviso de privacidad propio. P40.4: editar rutinas, partir `GymView` (~380 líneas) y avisar al reponer la sesión. Riesgo: ninguna purga de copias selladas, así que el aviso al 70 % solo informa; si el usuario lo ve, no tiene acción en la app. Vigilar también que un «Apuntar» no aprenda en la memoria (hoy correcto).
