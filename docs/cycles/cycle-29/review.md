# Revisión ciclo 29 — Comida (núcleo usable)

Veredicto: **APROBADO**

`npm run build`, `npm run lint` y `npm test` pasan en `cycle-29`: 6 ficheros y 223 tests.

## Hallazgos

Bloqueantes: 0. Importantes: 0. Menores: 3.

### Desviaciones del implementer

1. **130 filas en lugar de 140.** Aceptada. La spec (§9, línea 248) permite quitar las filas que no pasen FD1 y apuntarlo en el commit. FD1 acota el catálogo a 100-150 filas. `ESTADO-ACTUAL.md` y `CLAUDE.md` ya dicen 130.
2. **Nombres con el estado de cocinado.** Aceptada. Lleva un `ponytail:` y los nombres siguen siendo únicos.
3. **`deriveGame` usa `withDiet(TRACKERS, false)` por defecto.** Aceptada. Es coherente con B1, con la Dieta oculta sin objetivo ni eventos, y hace pasar H2. `rpg.ts` importa `food.ts`, que sigue siendo TypeScript puro.
4. **Tres `expect` de `storage.test.ts` ganan `food`.** Aceptada. Es el cambio previsto de la forma de `Loaded`, `parseBackup` y `LastBackup`.
5. **`Side.food` acepta `null`.** Aceptada. Una copia sin `food` se trata como `EMPTY_FOOD`.
6. **`FoodQty.tsx` y `foodStyle.ts`.** Aceptada. Separan componentes para que ninguno pase de ~250 líneas (el mayor tiene 112). Los estilos usan solo tokens `hero-*`, sin hex ni `slate-*`.

### Muestreo del catálogo

Contrasté 15 filas con lo que recuerdo de USDA SR Legacy:

| Alimento | fdcId |
|---|---|
| Arroz blanco cocido | 168878 |
| Arroz blanco crudo | 168877 |
| Huevo | 171287 |
| Leche entera | 171265 |
| Aceite de oliva | 171413 |
| Aceite de girasol | 171017 |
| Plátano | 173944 |
| Manzana | 171688 |
| Pechuga de pollo cruda | 171077 |
| Copos de avena | 169705 |
| Almendras | 170567 |
| Salmón | 175167 |
| Lentejas cocidas | 172421 |
| Pasta cocida | 169737 |
| Patata cruda | 170026 |

Todas coinciden en fdcId, kcal y macros por 100 g.

Dos filas no las pude confirmar de memoria: la leche desnatada (173432, 35 kcal; recuerdo 34) y la patata cocida (170440, 86 kcal). Ambas están dentro de la tolerancia de FD1.

### Lógica de Dieta (`dietSync`)

- **+1 y retirada.** Es idempotente. En rango, y sin neto ya en el día, añade `dieta-auto-<día>` (o `-n` si ya hubo otro). Fuera de rango retira solo las automáticas vivas, con `clampAmount`, sin bajar de 0 y sin tocar lo manual.
- **Interacción con el manual.** Si `dayTotal != 0`, no añade nada. El «−» manual en un día en rango repone la automática (neto 0), y el handler `add` lo recoge.
- **Cambio de objetivo.** Reevalúa `dietDays` (log más autos). El objetivo rige desde hoy y el primero rige hacia atrás.
- **Importar, fusionar y recuperar.** `withAutos` encadena `ensureAuto` y `dietSync`. Se hace `setToast(null)`.

### Migración y copias sin `food`

- Una clave ausente da `EMPTY_FOOD`. Una clave corrupta hace backup y avisa.
- `parseBackup` devuelve `food: null` para una copia sin `food`, e inválida para una ilegible.
- Importar una copia sin `food` avisa de que la comida local se reemplaza. Fusionar y recuperar la conservan.
- `FOOD_KEY` está en `lockStorage`, `isDataKey`, `EMPTY_RAW`, `backupCurrent`, `restoreLast` y `hasLastBackup`.

### Arquitectura, estilo y a11y

- Los derivados no se persisten. `dietActive` y `withDiet` se calculan en cada render, y la persistencia queda solo en `storage.ts`.
- Los asserts existentes solo cambian los de §11.2 (6 → 7 fijas). No hay ninguno relajado.
- a11y: etiquetas con `htmlFor`, `role="status"` y secciones con `aria-labelledby`. Hay tests axe de FoodView vacía, con entradas y con resultados.

### Menores

- `docs/TECH_SPEC-food.md` (líneas 8 y 234) sigue diciendo «140». La spec es histórica, así que no hace falta cambiarla.
- `merge.ts:~35` `sameFood` compara con `JSON.stringify` y castea cada campo. Funciona, pero es poco legible.
- `foodToday` cuenta con el objetivo vigente aunque no haya entradas hoy. Es lo esperado.
