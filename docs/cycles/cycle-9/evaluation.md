# Evaluación — ciclo 9

Base: `main` (ciclos 1-6) más el árbol de `cycle-7` (T1 hecha; `todaySummary` empezada). Se asume que el ciclo 7 y el ciclo 8 (P7.2b) estarán mergeados antes del 9.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P9.1 | APROBAR CON CAMBIOS | S | bajo | Los cuatro menores existen: el botón Archivar usa `t` y no el formulario (`TrackerCard.tsx:122`), `UnknownView` recibe `active`, `dropped++` cuenta lo reparado (`storage.ts:24`, `:44-49`) y U1 usa `getByText('1')`. El punto 3 de la propuesta se contradice. |
| P9.2 | APROBAR CON CAMBIOS | S | bajo | Problema real: `onPropose` solo se llama en `UnknownView.tsx:90`. Es solo UI, y `countsIn`/`rejected` ya salen de `PartyState`. Riesgo de mezclar paletas si se reutiliza el bloque tal cual. |
| P9.3 | APROBAR CON CAMBIOS (solo con okay de regla) | S | medio | El diagnóstico es correcto (`party.ts:6-13` fijos frente a `rpg.ts:29`). Le faltan dos llamadas que hay que cambiar (`PartyView.tsx:66` y `App.tsx:106-107` llaman a `buildRanking` directamente) y no dice que el assert de adelantamiento deja de cumplirse. |
| P9.4 | APROBAR CON CAMBIOS | S-M | bajo | Confirmado: los cuatro contenedores `aria-live` se montan con contenido y `key` nueva (`LevelUpToast.tsx:26/45/69/92`). Lo mismo pasa en `UnknownView.tsx:246` y `:281`, que la propuesta no menciona. axe es devDependency: no necesita okay. |

## Cambios pedidos

**P9.1**
- (1) Al archivar se aplica `editTracker` con el formulario si `canSave`; si no, se archiva el original. Va después del ciclo 8, que toca el mismo formulario.
- (2) El bug real es el duplicado exacto: el `dup` de `UnknownView.tsx:64` tiene que incluir las archivadas, y no solo `findSimilar`. «Reactivar» reutiliza `onUnarchive`.
- (3) Los reparados **sí** siguen generando copia sellada. Si no se copian, `saveEvents` sobrescribe el original y se pierde el campo malo. Solo cambian el recuento (`fixed` aparte) y los textos (`noticeFor` y los `confirm` de importar y recuperar).

**P9.2**
- El selector usa el tema de la tarjeta (`THEME[t.branch]`), no las clases neutras `app-*` de `UnknownView`. Si se extrae un componente, recibe las clases por props.
- Solo ofrece las parties en las que la actividad no está propuesta ni es criterio. Se calcula en `App` a partir de `partyStates`.
- El resultado de la votación se muestra a partir de `countsIn` y `PartyState.rejected` (persistente), no con estado local. Solo en tarjetas `custom` activas. No toca `core/`.

**P9.3**
- `today` es obligatorio en `buildRanking` (sin valor por defecto), para que `tsc` marque todas las llamadas. El prorrateo se hace sobre cada campo del miembro (`weeklyHeroXp`, `weeklyVillainXp`) y la profundidad se suma después. Lleva `ponytail:`.
- Una línea en `PartyView` («amigos: su ritmo de la semana hasta hoy») para no presentar como reales cifras inventadas.

**P9.4**
- El texto de la región `status` se deriva de `toast`/`overtake` en el render. Así no hace falta un efecto, y un helper compartido da el mismo texto que el banner. Se incluyen los dos `aria-live` de `UnknownView`.
- Si axe no funciona sobre happy-dom, esos tests usan `@vitest-environment jsdom`, que es otra devDependency.

## P9.3: qué asserts cambian y qué tiene que aprobar el usuario

Con `DEMO_DATE` (miércoles, 3/7): Carlos 221/13, Alex 150/64, Dani 94/90, Lucía 103/6, Marta 69/19, Pablo 51/51. Tú: HERO 330 (Gym) y 180 (Oficina); VILLAIN 80.

| línea | hoy | con prorrateo |
|---|---|---|
| 40 y 86 | `carlos,alex,you,dani`, pos. 3 | `you,carlos,alex,dani`, pos. 1 |
| 50 y 90 | `carlos,you,alex,dani` | `you,carlos,alex,dani` |
| 51 | `overtakes` = `Alex` | **falla**: no hay ningún adelantamiento |
| 85 | `lucia,you,marta,pablo`, pos. 2 | `you,lucia,marta,pablo`, pos. 1 |
| 87 | `dani,alex,you,carlos` | `dani,you,alex,carlos` |
| 88 | `lucia,pablo,marta,you` | `you,lucia,pablo,marta` |

Las líneas 39, 84 y 91 no cambian. Propuesta de migración: los asserts actuales se evalúan con `today = '2026-10-11'` (domingo, 7/7, la regla antigua). Sus valores esperados se mantienen, porque el ejemplo no tiene eventos después del miércoles. Además se añaden asserts nuevos con `DEMO_DATE` y los valores de la tabla, y un adelantamiento nuevo en un lunes.

**Okay del usuario:** (a) la regla de prorrateo lineal de los amigos simulados; (b) que con el ejemplo, a mitad de semana, vayas 1.º en HERO en las dos parties: el ejemplo pierde la persecución de Carlos y la escena «adelantas a Alex con +Gym» pasa al domingo; (c) mover los asserts 40/50/51/85-88/90 a domingo y añadir los asserts nuevos de arriba.

## Ciclo 9 recomendado

**P9.2 + P9.3**: las dos son PARTY y no se pisan (UI de tarjeta frente a `party.ts`/`PartyView`). Ninguna toca `storage.ts` ni el esquema. Si el usuario no da el okay a P9.3, el ciclo queda en **P9.2 + P9.1**.
Siguiente: P9.1 + P9.4 (ciclo 10). P9.4 conviene al final, para que axe cubra todas las pantallas nuevas.
