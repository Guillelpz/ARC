# Evaluación — ciclo 39

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P39.1 Copiar el día anterior | APROBAR CON CAMBIOS | S | bajo | Hueco real (F10) y barato: reutiliza el patrón de `addMeal`/`addVoice` en `useFood.ts` (un `setFood`, un `syncDiet`, `ids` para el «Deshacer»). |
| P39.2 Uso de Haiku en el dispositivo | POSPONER (o APROBAR CON CAMBIOS en el ciclo 40) | S-M | bajo | La consola de Anthropic ya da el coste exacto de la clave dedicada. Lo nuevo son los aciertos, y sin uso real en el iPhone (P39.5) no hay datos que contar. |
| P39.3 Saneamiento voz y datos | APROBAR CON CAMBIOS | M → S-M recortada | bajo-medio | Los problemas existen (confirmados en el código), pero mezcla 6 cosas y una de ellas obliga a tocar el modelo. |
| P39.4 Temporizador de descanso | POSPONER | S-M | bajo | Safari de iOS no implementa `navigator.vibrate`: en el único dispositivo del usuario, el aviso se queda en un texto en pantalla. Además añade un campo a `GymData` (`readGym`, `KNOWN_GYM`, `mergeLog`, asserts) para una preferencia. |
| P39.5 Validación en iPhone | APROBAR, partida | S + tiempo del usuario | bajo | Es la deuda que más bloquea (ciclos 26-38). Se parte en una preparación, que entra en este ciclo, y en el cierre, que va aparte. |

## Cambios pedidos

**P39.1**
- Un único origen determinista: el **día anterior al del selector**, no «el último día con registros». Sin entradas vivas en ese día, el botón se desactiva con el motivo visible.
- El helper puro (`copyDay(log, from, ids, at)` en `food.ts`) copia también las entradas rápidas y las estimadas. Las copias son instantáneas (T1) con `via: 'copy'` para distinguirlas.
- Assert FD: no copia entradas deshechas, ids nuevos, no muta la entrada, día de destino correcto.
- Test de UI del «Deshacer» único y del doble toque: el segundo toque no debe duplicar sin aviso, o como mínimo debe quedar cubierto por el mismo «Deshacer».

**P39.3**
- **`deviceSure`:** el problema es real. Sin cantidad, `resolveAmount` usa `increment`, así que «I ran out of milk» guarda Running +1 sin preguntar a Haiku.
  - Recortar el arreglo al `ponytail:` de `capture.ts:183`: fuera del nombre o alias del hábito, solo se aceptan palabras de cantidad, unidad y stopwords.
  - Comprobar con un assert CV que «ate a burguer» y «burguer» siguen resolviéndose en el dispositivo.
  - Dejar escrito que **sin clave** el router sigue guardando esa frase (C3). El arreglo solo evita saltarse Haiku.
- **Olvidar la frase al deshacer desde misiones:** sacarlo del ciclo. Los `ActivityEvent` no guardan la frase, y añadirla toca la fuente de verdad y mete texto dictado en las copias. Como mucho, un mapa en memoria `eventId → frase` dentro de la sesión, con su `ponytail:`. Si no, se pospone.
- **Se queda:** dedupe de ids en `readGym` (assert GY nuevo; fuera de `merge.ts` no cambia nada), nombre único en `saveMeal` (reutilizar `nameTaken`), `confirm` en `deleteMeal` y aviso de `addMeal` sin plato.
- **Renombrar USDA:** solo `name`, sin tocar `id` ni `ref`. Revisar que ni los alias de `foodAliases.ts` ni los asserts FD dependan del nombre.

**P39.5 (para que no bloquee)**
- **Ciclo 39, sin esperar al usuario:**
  - Unificar las checklists en `DEPLOY.md`, ordenadas por tiempo.
  - En `VoiceCheck.tsx`, que ya tiene «Detalles técnicos», un botón «Copiar resumen» con el user agent, standalone, `SpeechRecognition` sí/no, error y transcripción. Nunca la clave. Si el portapapeles falla, el resumen se muestra en texto seleccionable.
- **Ciclo 39b o 40, cuando lleguen los resultados:** fijar `KEYBOARD_ON_IOS` y arreglar lo pequeño. Es un mini-ciclo con implementer y reviewer, sin strategist.

**P39.2 (si se aprueba más adelante)**
- Quitar tokens y coste: ya los da la consola de Anthropic.
- Contar solo llamadas por flujo, las evitadas por O1/O3 y las capturas deshechas o editadas.
- Clave de dispositivo fuera de copias, como la M-B, y vaciada por «Borrar todo».
- `PostResult` no cambia: el contador va en los llamadores.

## Ciclo recomendado

**Ciclo 39 = P39.1 + P39.3 recortada + preparación de P39.5.** Orden: P39.5 (preparación, para que el usuario pueda probar cuanto antes) → P39.1 → P39.3.

No toca la arquitectura: todo cambia por eventos o entradas de solo añadir. `core/` sigue puro, `storage.ts` solo cambia por la dedupe de `readGym`, no hay dependencias nuevas y todo es paleta HERO.

**Decisiones del usuario:**
1. Origen de «Copiar»: el día anterior al del selector (recomendado) o el último día con registros.
2. Olvidar la frase al deshacer desde misiones: mapa en memoria de la sesión, o posponer.
3. P39.2: ciclo 40 tras la prueba en el iPhone, o descartarla y usar la consola de Anthropic.
4. Cuándo hará la prueba en el iPhone (marca la fecha de 39b).
