# Evaluación — ciclo 4

Base: `main` + rama `cycle-3` (T1 hecho; `App.tsx` ya llama a `backupCurrent`, `copy`, `requestPersist`).

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P4.1 | APROBAR CON CAMBIOS | S | bajo | Problema real (`App.tsx:85` clampa a `-week`, `nowStamp()` en l. 87). `STAMP` acepta cualquier día. |
| P4.2 | APROBAR CON CAMBIOS | M | bajo | Problema real, pero falta saber qué registro ya se deshizo y, sin P4.1, el clamp semanal anula el «Deshacer» de semanas pasadas. |
| P4.3 | POSPONER | M | medio | Útil, pero es otro frente (esquema de `custom`, UI de edición) y no cabe con P4.1+P4.2. |
| P4.4 | APROBAR CON CAMBIOS (ciclo 5) | S | medio | Depende de que el ciclo 3 esté mergeado. Así como está escrita no sirve: restaura copias corruptas y su `backupCurrent` machaca la copia que se restaura. |
| P4.5 | POSPONER | S-M | bajo | Si la lógica nueva va a `core/` con asserts, P4.1/P4.2 no la necesitan. Encaja mejor junto a P4.3/P4.4. |

## Cambios pedidos

**P4.1**
- Un solo selector de día por pantalla (`MissionsView`), no uno por tarjeta: menos ruido y menos props. El valor por defecto vuelve a «Hoy» al cambiar de pantalla.
- El clamp sale de `App.tsx` a una función pura en `core/stats.ts` (p. ej. `dayTotal(events, trackerId, day)`), con asserts en `selfcheck.ts`: «evento en día pasado cuenta en su semana» y «la corrección no deja el día por debajo de 0».
- `add(t, amount, day = today)`. `UnknownView` sigue registrando hoy. El `-` de la tarjeta se desactiva con `dayTotal === 0`, no con `week === 0`.
- `max` = `today`, que ya se recalcula en cada render.

**P4.2**
- Saber qué registros ya se deshicieron. Dos opciones: (a) emparejar por conteo los negativos que tengan igual `trackerId`, `occurredAt` y `-amount`; ojo, porque `nowStamp` tiene resolución de segundos y dos toques en el mismo segundo colisionan. (b) Añadir a `ActivityEvent` un campo opcional `undoes?: id`; `readEvents` ya conserva campos extra, pero hay que validarlo. Recomiendo (b): es explícito y no rompe datos antiguos. El tech-lead decide.
- «Deshacer» va por la misma regla de clamp por día de P4.1. Por eso **P4.2 depende de P4.1**.
- La lista muestra también los negativos (marcados como corrección), con el texto en la paleta de su rama. Selección de los 10 en `core/` (función pura con assert).

**P4.4 (para el ciclo 5)**
- Restaurar solo `.backup.last`, el estado previo a importar o borrar. Los `.backup.<stamp>` de `loadAll` son datos que ya fallaron la validación: pasarlos otra vez por el validador devuelve lo que ya está cargado o nada.
- Restaurar = intercambiar: leer `.backup.last` → validar con `readEvents`/`readCustom` (no con `parseBackup`, que espera el envoltorio de exportación) → escribir lo actual en `.backup.last` → aplicar. Si se llama antes a `backupCurrent()`, se pierde la copia.
- Sin «(fecha)», salvo que el ciclo 3 guarde el sello junto a la copia. La limpieza de copias con sello necesita `key()`/`removeItem` en `Store` y borra datos: fuera de alcance, salvo que se mida que llenan la cuota.

**P4.3 (cuando entre)**
- Validar en `readCustom` los campos nuevos (`weeklyGoal` finito > 0, `archived` booleano). Hoy el filtro deja pasar campos extra sin comprobarlos y un `weeklyGoal` basura da `NaN` en la barra.
- Recalcular `buttonLabel` al editar el incremento.
- Las archivadas siguen en `allTrackers` (XP y party). Solo se filtran en `MissionsView`.

**P4.5 (cuando entre)**
- `// @vitest-environment jsdom` por archivo para no cambiar el entorno de los tests de `core/`, y mocks de `confirm` y `crypto.randomUUID`. `startViewTransition` ya tiene fallback.

## Ciclo 4 recomendado

**P4.1 + P4.2**, en ese orden y con los cambios de arriba. Las dos tocan `add()` y `TrackerCard`/`MissionsView`, no tocan `storage.ts` ni la home (sin choque con el ciclo 3) y no añaden dependencias. Si el tech-lead elige `undoes?`, es un campo opcional en `ActivityEvent`: no cambia el cálculo de XP.

Orden siguiente: P4.4 (después de mergear el ciclo 3) → P4.3 + P4.5.
