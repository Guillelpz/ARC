# Review ciclo 6

Veredicto: APROBADO

build, lint y test pasan en cycle-6 (50 tests, 3 ficheros).

## Hallazgos

### menor
1. `app/src/components/TrackerCard.tsx:122` Archivar desde el formulario descarta en silencio los cambios sin guardar del formulario. Aceptable; valorar deshabilitar o avisar.
2. `app/src/App.tsx:115` Se puede crear una misión con el nombre de una archivada (ya anotado con `ponytail:`). Es un duplicado posible y visible al reactivar.
3. `app/src/core/storage.ts:46` `dropped` cuenta también los trackers reparados, no solo los descartados. El mensaje de importación puede decir "descartados" sin que se haya perdido nada. Revisar el texto.
4. `app/src/App.test.tsx:28` `getByText('1')` (U1) depende del texto exacto del contador. Frágil ante cambios de maquetación. Preferir una consulta por rol o etiqueta.
5. `app/package.json` Nuevas devDependencies (`@testing-library/*`, `happy-dom`). Confirmar que la spec las autoriza (CLAUDE.md exige decisión explícita para añadir dependencias).

## Puntos de atención
1. Datos: OK. `readCustom` conserva el tracker y borra `weeklyGoal`/`archived` inválidos (tests C2, C3). El formato antiguo da `dropped: 0` (C1). Exportar/importar conserva ambos campos (C5).
2. Reglas: OK. `editTracker` no toca `xpPerUnit`, id, rama ni unidad. Las archivadas siguen en `deriveGame` y party; solo se filtran en la UI (MissionsView, HomeView, UnknownView). El assert E5 lo cubre.
3. Tests de UI: comprueban comportamiento real (localStorage, XP invariante, botones deshabilitados, confirm). Las consultas están acotadas con `role=group` por tarjeta. `window.confirm = vi.fn` está justificado porque happy-dom no lo define, y se restaura con `restoreAllMocks`.
4. selfcheck: solo se añaden E1–E5. Ningún assert existente cambia. `buttonLabel` pasa a `+N unidades` cuando el incremento es distinto de 1. El selfcheck sigue pasando.
