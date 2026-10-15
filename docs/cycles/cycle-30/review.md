# Revisión ciclo 30

Veredicto: APROBADO

build, lint y test pasan (228 tests). Sin hallazgos bloqueantes ni importantes.

## Comprobado
- Nombres únicos: `nameTaken` hace fold contra catálogo y propios; el archivado ofrece «Reactivar». FD14 lo cubre.
- Archivar: las entradas guardan su instantánea, así que el pasado no cambia. `mealEntries` cuenta como `missing` los archivados y desconocidos.
- `addMeal` pasa por `syncDiet` con el día elegido (acotado a hoy), así que Dieta se sincroniza en vivo.
- `foodWeekly`: semanas lun–dom, rango `[lunes, lunes+7)` y `d <= today`. La media es sobre días con registros (E1). El objetivo es el de `min(domingo, hoy)`. FD15 cubre los casos.
- `readFood` valida los platos: id `meal-`, nombre de 1 a 40, máx. 20 ítems, ids repetidos descartados y `fixed`/`dropped` contados. `merge.ts` los fusiona por id.
- SVG con `aria-hidden` y `ul.sr-only` equivalente. Usa tokens `hero-*`, sin hex ni `slate-*`. Los errores van con icono y `text-hero-text`.

## Hallazgos
- menor: `saveMeal` admite nombres de plato repetidos. La spec no pide unicidad.
- menor: `deleteMeal` no pide confirmación (desviación avisada, aceptada).
- menor: `addMeal` con un plato inexistente no avisa (aceptada).
- menor: la media se muestra como «X / Y kcal/día» (aceptada).
- menor: `useFood` sin extraer (`App.tsx` 551 líneas). Ya está anotado en ESTADO-ACTUAL como `ponytail:`.
