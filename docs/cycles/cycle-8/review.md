# Review ciclo 8 — objetivos de las fijas HERO

Veredicto: **APROBADO**

build, lint y test (57 tests) pasan en cycle-8.

## Puntos de atención
1. Datos: `readCustom` valida `goals` entrada a entrada (id con objetivo por defecto, entero >= 1). Un `goals` que no es objeto cuenta 1 en `dropped`. Sin `goals` no se pierde nada y `dropped` es 0 (C6). Backup, restore y «Borrar todo» operan sobre el JSON completo de `custom`, así que conservan los objetivos. `hasData` los cuenta.
2. P7.2a no se coló. Las fijas VILLAIN no tienen `weeklyGoal`, así que no reciben lápiz (`onSave` solo si `custom || weeklyGoal`). U13 lo comprueba con Beer.
3. Los asserts existentes no cambian de valor. Solo se añaden G1-G4. La tolerancia 1e-9 en G4 es razonable para 100/3.
4. `docs/cycles/STATE.md` no aparece en el diff `main...cycle-8`, así que el cambio es nulo.

## Hallazgos
- menor: `App.tsx:118` y `trackers.ts` (`setGoal`). Al volver al valor por defecto se persiste `goals: {}` en vez de omitir la clave. Es inocuo, porque `readCustom` lo normaliza al leer.
- menor: `App.tsx:126` llama a `proposeTo` con `allTrackers(c.trackers)` sin `goals`. Hoy no afecta, porque `proposeTo` no usa `weeklyGoal`.

Bloqueantes: 0. Importantes: 0. Menores: 2.
