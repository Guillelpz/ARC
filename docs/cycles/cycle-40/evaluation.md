# Evaluación — ciclo 40

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P40.1 | APROBAR CON CAMBIOS | S | bajo (medio si se purga) | Problema real: `storage.ts:296` ignora las copias `.backup.last/prev` (×3) y la comida; hoy solo se avisa al fallar (`SaveFailBanner`). La purga de `.backup.<stamp>` es el único punto con riesgo de pérdida. |
| P40.2 | APROBAR CON CAMBIOS (decisión D1) | S-M | bajo | Real (`capture.ts:184`, CV14 confirma «I ran out of milk» → Running). Pero el criterio está mal definido y un submenor es falso (ver abajo). |
| P40.3 | POSPONER | S | bajo | Sin caso real: OFF suele calcular `_100g` a partir de `_serving` cuando hay `serving_quantity`. «Al azar» es falso: `foodByRef` ya prefiere el activo (FI7). |
| P40.4 | APROBAR CON CAMBIOS | M | bajo | Real (§4 Gym). `GymView.tsx` tiene 415 líneas, no ~380. Encaja mejor en el ciclo 41. |
| P40.5 | POSPONER hasta la decisión D2 | S-M | medio | Real (`classify.ts:66`, `haiku.ts:92`), pero cambia una decisión vigente («IA solo heurística»). Si el usuario acepta, va al ciclo 41. |

## Cambios pedidos

**P40.1**
- Medir en caracteres (clave + valor) de todas las claves `life-rpg-*` y mostrar «aprox.»: la cuota real no se puede consultar.
- Explicar que el origen `guillelpz.github.io` lo comparten otros repos de Pages, así que el porcentaje es orientativo.
- La purga **no** puede apoyarse en «Exportar copia»: la exportación no incluye los `.backup.<stamp>`, que guardan el contenido crudo de una clave dañada. Antes de borrarlos, descargar ese contenido en crudo (un JSON) o dejar la purga fuera del ciclo.
- Calcular el tamaño al abrir «Tus datos» y tras un guardado, nunca en cada render.

**P40.2**
- No hace falta tocar `memoKey` para «100kg». `normalizeVoice` ya separa número y letra (`voice.ts:84`) y `kg` está en `ALL_UNITS`. Basta con un assert MC que lo fije y con corregir §4 de `ESTADO-ACTUAL.md`.
- Definir el criterio con el código que ya existe: guardar solo si `deviceSure` (coincidencia exacta y única, sin palabras ajenas) **o** si hay una cantidad dicha que `resolveAmount` acepta. En cualquier otro caso, mostrar la tarjeta de confirmación.
- Aplicarlo a todo resultado con `source: 'parser'`, no solo cuando falta la clave. Con clave, si Haiku falla o no hay conexión, hoy se guarda igual.
- Ojo: este criterio hace que, sin clave, «ate a burguer» y «leí un libro» pidan confirmación. Hoy se guardan solos y eran ejemplos de aceptación del ciclo 27 (CV1/CV7 comprueban la ruta, no el guardado). Por eso hace falta la decisión D1.
- Actualizar la tarjeta del `ponytail:` de `capture.ts:184`.
- En la tarjeta nueva, mantener la regla de la cuenta atrás: ninguna cuenta atrás en un hábito existente.

**P40.4**
- Validar con un único helper puro (nombre único sin acentos, 1..20 ítems, `exerciseId` únicos, `sets` 1..10), con assert GY24.
- El editor guarda la rutina con el mismo `id`. Si se edita en dos dispositivos, al fusionar gana la local y se avisa (comportamiento ya aprobado en el ciclo 25).
- Al partir `GymView` no puede cambiar ningún texto ni rol que usen los tests.

**P40.5 (si se aprueba)**
- Pasar la clave como parámetro desde `App`, no leerla desde `UnknownView`.
- Usar `claude-haiku-5-5` (hoy `classifyAI` usa `claude-haiku-4-5`) y `postHaiku` con `fetchImpl` inyectable.
- Mostrar el aviso de privacidad una sola vez (patrón I2): el aviso de voz trata del audio, no del texto escrito.
- Quitar el proxy de dev: dos caminos de IA son justo la deuda que se quiere cerrar.

## Decisiones del usuario (preguntas cerradas)

- **D1 (P40.2, matiza C3):** cuando la frase la resuelve el parser (sin clave o con Haiku caído), ¿un hábito existente sin coincidencia exacta y limpia y sin cantidad dicha (por ejemplo «I ran out of milk» o «ate a burguer») debe…
  - (a) pedir confirmación con la tarjeta «¿Apuntar en X?» (recomendada);
  - (b) seguir guardándose solo, como hoy, y se descarta P40.2 salvo los menores;
  - (c) pedir confirmación solo si hay palabras ajenas, y guardar solas las coincidencias aproximadas sin palabras ajenas («burguer»).
- **D2 (P40.5, amplía la excepción V3):** ¿se permite que «Escribir a mano» use Haiku con la clave guardada en el dispositivo?
  - (a) sí, y se elimina el proxy de dev (recomendada si se aprueba);
  - (b) sí, y se mantiene el proxy como alternativa en dev;
  - (c) no: el formulario sigue solo con la heurística en producción y P40.5 se descarta.
- **D3 (P40.1):** ¿qué se hace con la purga de `.backup.<stamp>`?
  - (a) se incluye, descargando antes su contenido en crudo;
  - (b) se deja fuera y solo se mide y se avisa (recomendada).

## Ciclo recomendado

**Ciclo 40 = P40.1 + P40.2**: los dos son S, de calidad y riesgo de datos, y tocan zonas distintas (`storage.ts`/«Tus datos» y `capture.ts`/`CaptureCards`). Orden: P40.1, luego P40.2. Si D1 = (b), el ciclo queda en P40.1 más los menores de P40.2.
**Ciclo 41:** P40.4, y P40.5 si D2 = (a) o (b), en ese orden o como dos ciclos si el tech-lead estima P40.4 en M alto. P40.3 se pospone hasta tener un producto real afectado.
