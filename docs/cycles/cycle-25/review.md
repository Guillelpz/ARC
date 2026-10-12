# Review ciclo 25 — Gym 2

Veredicto: **APROBADO**. `build`, `lint`, `test` (127) y `e2e` (6) en verde sobre `cycle-25`.

Hallazgos: 0 bloqueantes, 0 importantes, 3 menores.

## Comprobaciones
- `ensureAuto` (`gym.ts`): idempotente, ids `gym-auto-<día>[-n]` sin colisión (cuenta también las deshechas), sin duplicados entre días repetidos, GY14 cubre manual neta 0, auto deshecha, varios días y repetición. En `add` solo actúa con `amount < 0` y se guarda junto al deshacer en un único `push`; neto 0 sin XP, toast ni animación (GY21 + test UI). Se recrea tras importar, fusionar y recuperar (solo si `r.gym === null`; con gym propio la copia ya lo trae). Nunca se llama en un effect ni al arrancar.
- Compatibilidad: `routines` ausente se omite al guardar (`deleteRoutine`, merge y `readGym`); copias del ciclo 24 y anteriores se leen sin cambios (GY19 con `old`). Campos desconocidos se siguen conservando. Nada persistido es derivado: progreso, volumen, `gymDay` y progreso de rutina se calculan con `useMemo`.
- Fusión de rutinas: añade por id nuevo, conflicto (mismo id, otro contenido) mantiene lo local y lo avisa, idempotente, sin mutar, `changed` y `routinesAdded` correctos (GY20).
- Kg/lbs mezclados: todo se normaliza con `toKg` y se convierte solo al mostrar (GY15, GY16).
- Selfcheck: los asserts existentes están intactos (el diff solo añade); GY14-GY21 son significativos. XP, `rpg.ts` y `party.ts` sin cambios. `core/` sin React.
- UI: solo tokens `hero-*`/`app-*`, sin hex ni `slate-*`; botones `min-h-11`; foco gestionado; lista `sr-only` para el gráfico; gráfico con `aria-hidden`. axe en verde (unit y e2e), 320 px sin scroll.

## Desviaciones declaradas
- «Nombre de la rutina», GY21 en T10, texto del confirm «Rutinas: X → Y.», fila Gym tras «Registrado hoy» sin encabezado, miles con punto: aceptables.
- GymView con 380 líneas sin extraer componentes: aceptable en este ciclo (menor 3).

## Menores
1. `app/src/core/storage.ts` (`readGym`, bucle de rutinas): no se deduplican ids de rutina. Un archivo manipulado con dos rutinas del mismo id da claves React repetidas y «Borrar» quita ambas. Descartar o ignorar el id repetido y contarlo en `dropped`.
2. `app/src/App.tsx:171` y `HomeView.tsx:150`: con un día con series y solo sesiones manuales, «−»/deshacer de la sesión repone una sesión automática y devuelve 0 sin mensaje; es el efecto de la decisión 1A y es coherente, pero el usuario no recibe aviso. Valorar un texto en un próximo ciclo.
3. `app/src/components/GymView.tsx` (380 líneas): extraer Progreso, Volumen y Rutinas a componentes cuando se vuelva a tocar el archivo.
