# MVP — Tu vida como un RPG

> **Histórico.** Documento de la demo de hackathon. Lo implementado sigue estas reglas, pero el estado vigente y el alcance futuro están en `docs/ESTADO-ACTUAL.md`.

## 1. Product thesis

«Tu vida real construye un personaje de RPG. Registra lo que haces y descubre tus estadísticas, tus niveles y tu mezcla de HERO y VILLAIN».

El diferencial es que **una misma acción alimenta tu historial personal y hace progresar tu personaje**, sin convertir cada comportamiento en una tarea que cumplir.

**Decisión de scope: una Home funcional, una pestaña Party simulada, seis actividades y cero backend.**

## 2. Core user experience

1. Abres tu personaje, con historial precargado y seis actividades.
2. Pulsas `+ Gym` o un incremento fijo como `+5 km`.
3. Ves inmediatamente el contador actualizado y el XP ganado.
4. Si cruzas un umbral, aparece el level-up y avanzan las barras del personaje.
5. Consultas las estadísticas calculadas y comparas tu personaje con una Party ficticia.

Sin onboarding, formularios de configuración ni pantallas intermedias.

## 3. MVP scope

P0 significa imprescindible. P1 puede simplificarse si falta tiempo. Las estimaciones incluyen implementación con componentes sencillos; la integración y validación tienen su propio bloque posterior.

| Funcionalidad | Qué construimos | Por qué pertenece a la demo | Prioridad | Complejidad |
|---|---|---|---|---|
| Home del personaje | Nivel global, ramas HERO/VILLAIN, barras y seis tarjetas | Explica el producto al abrirlo | P0 | Media · 20 min |
| Registro inmediato | Botones con incrementos fijos, historial en memoria y localStorage | Demuestra que el producto funciona | P0 | Baja · 12 min |
| Stats engine | Semana actual, comparación equivalente, total histórico y objetivos | Convierte registros en información automáticamente | P0 | Media · 15 min |
| Progresión RPG | XP y niveles derivados del historial, feedback y level-up | Produce el momento memorable | P0 | Media · 15 min |
| Party simulada | Tres amigos y ranking semanal HERO; tu fila es dinámica | Comunica la visión social | P1 | Baja · 8 min |
| Preparación de demo | Historial inicial, fecha simulada y botón de restablecer | Garantiza una presentación reproducible | P0 | Baja · 5 min |

**No habrá creación ni edición de trackers.** Las seis actividades están definidas en código.

## 4. Explicit non-goals

No construiremos:

- Autenticación, cuentas, backend, base de datos remota ni sincronización.
- Amigos reales, invitaciones, permisos, chat o perfiles públicos.
- Creación, edición o clasificación personalizada de actividades.
- Introducción libre de cantidades, fechas o duración.
- Cronómetros, GPS ni importaciones.
- Edición de eventos, borrado individual o registro retroactivo.
- Selectores de periodos, gráficos históricos o dashboards configurables.
- Récords, rachas, predicciones, correlaciones o insights con IA.
- Achievements, quests, inventario, clases, skill trees o cosméticos.
- Avatar generado, ilustraciones propias ni animaciones de personaje.
- Notificaciones, integraciones o funciones de producción.
- Rankings intercambiables por actividad o por rama.

El historial ficticio sustituye semanas de uso. Los amigos ficticios sustituyen toda la infraestructura social.

## 5. Pantallas necesarias

**Vista 1: YOU — casi todo el producto.**

Orden de arriba abajo:

- Nombre fijo: `YOU`.
- `PLAYER LEVEL 3`, con progreso hacia el siguiente nivel.
- Emblema sencillo construido con iconos y CSS.
- HERO y VILLAIN: nivel, XP acumulado y barra hacia el siguiente nivel.
- Franja de composición: `79% HERO · 21% VILLAIN`, etiquetada **«Distribución de XP»**.
- Seis tarjetas agrupadas por rama.

Ejemplo de tarjeta:

> **GYM · Lv. 3**  
> **3 / 4 sesiones esta semana**  
> +1 frente al mismo tramo de la semana pasada  
> 5 sesiones acumuladas  
> **[ +1 sesión ]**

La tarjeta contiene las estadísticas. No hace falta otra pantalla para descubrirlas.

Pie discreto:

> Historial de ejemplo · Fecha demo: 7 oct 2026 · Restablecer demo

**Vista 2: PARTY.**

- Etiqueta visible: `Party de ejemplo`.
- Ranking semanal HERO con tres amigos y el usuario.
- Cada fila muestra nivel global, niveles de ambas ramas y cuatro estadísticas.
- Tu fila usa tus datos reales del navegador y cambia al registrar actividades.

Navegación: dos botones, `YOU` y `PARTY`. Sin rutas adicionales obligatorias.

**Dirección visual:** fondo oscuro, HERO cian, VILLAIN violeta, números grandes y barras visibles. Evitar verde/rojo, corazones de salud o símbolos de aprobación y castigo.

## 6. Modelo de datos mínimo

No necesitamos una entidad `User`: basta con un nombre fijo.

```ts
type Tracker = {
  id: string
  name: string
  branch: "hero" | "villain"
  type: "count" | "distance" | "duration"
  unit: "sesiones" | "clases" | "km" | "min" | "unidades"
  increment: number
  xpPerUnit: number
  weeklyGoal?: number
}

type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string // fecha y hora local, formato ISO sin zona
}

type PartyMember = {
  id: string
  name: string
  playerLevel: number
  heroLevel: number
  villainLevel: number
  weeklyHeroXp: number
  gym: number
  bjj: number
  runningKm: number
  beer: number
}
```

Decisiones:

- Trackers y amigos: constantes en código.
- Eventos: única información persistida en localStorage.
- Totales, XP y niveles: se calculan; no se guardan por separado.
- Clave de almacenamiento versionada, por ejemplo `life-rpg-demo-v1`.
- La fila del usuario en Party se deriva del historial.

`Quantity` queda contemplado por `amount`, pero no tendrá una actividad ni interfaz específica en esta demo.

## 7. Stats engine mínimo

**Construir realmente:**

| Estadística | Decisión |
|---|---|
| Total de la semana actual | Sí, dato principal de cada tarjeta |
| Total histórico | Sí, segunda línea |
| Comparación con periodo anterior | Sí, diferencia absoluta contra los mismos días |
| Progreso contra objetivo semanal | Sí, solo en trackers con objetivo |
| Total diario | Fuera de la interfaz |
| Total mensual y últimos 30 días | Fuera |
| Variación porcentual temporal | Fuera; añade casos especiales sin mejorar mucho la demo |
| Récords y consistencia | Fuera |
| Gráficos por día/semana/mes | Fuera |

Una sola función de agregación sirve para todos los tipos:

```text
total(tracker, inicio, fin):
    filtrar eventos por tracker y fecha dentro de [inicio, fin)
    sumar amount
```

Aplicaciones:

```text
semanal = total(tracker, lunesActual, mañana)
anterior = total(tracker, lunesAnterior, mañanaMenos7Días)
histórico = suma de amount de todos sus eventos

diferencia = semanal - anterior

si existe objetivo:
    cumplimiento = semanal / objetivo × 100
    anchoBarra = mínimo(cumplimiento, 100)
```

Para count, cada evento lleva `amount = 1`. Para running se suman kilómetros; para lectura, minutos.

**Regla importante de comparación:** el miércoles se compara lunes–miércoles con lunes–miércoles anteriores. No comparar una semana incompleta con siete días completos.

Mostrar:

> `+6 km vs. mismo tramo anterior`

Para cerveza, `+2` se muestra con estilo neutro: no representa mejora ni empeoramiento.

Si se supera un objetivo, mostrar el valor real, por ejemplo `5/4`; únicamente la barra se limita al 100%.

## 8. Sistema RPG mínimo

Todas las fórmulas son lineales. No hay multiplicadores, penalizaciones ni curvas exponenciales.

```text
XP del evento = amount × xpPerUnit

XP actividad = suma del XP de sus eventos

HERO XP = suma del XP de actividades HERO
VILLAIN XP = suma del XP de actividades VILLAIN

PLAYER XP = HERO XP + VILLAIN XP
```

Niveles:

```text
Nivel actividad = 1 + floor(XP actividad / 60)

Hero Level = 1 + floor(HERO XP / 200)
Villain Level = 1 + floor(VILLAIN XP / 200)

Player Level = 1 + floor(PLAYER XP / 250)
```

Progreso dentro del nivel:

```text
XP dentro del nivel = XP acumulado % umbral
```

Composición:

```text
Hero % = HERO XP / PLAYER XP × 100
Villain % = VILLAIN XP / PLAYER XP × 100
```

Sin eventos, mostrar «Tu personaje empieza aquí» en lugar de dividir entre cero.

**La composición representa XP acumulado, no proporción de tiempo, cantidad de acciones ni calidad de vida.** Los pesos son decisiones lúdicas del prototipo.

Con el historial propuesto:

| Indicador | Al abrir | Después de `+ Gym` |
|---|---:|---:|
| Gym XP / nivel | 150 · Lv. 3 | 180 · Lv. 4 |
| HERO XP / nivel | 570 · Lv. 3 | 600 · Lv. 4 |
| VILLAIN XP / nivel | 150 · Lv. 1 | Sin cambios |
| PLAYER XP / nivel | 720 · Lv. 3 | 750 · Lv. 4 |

Un único registro produce una progresión visible y coherente.

## 9. Datos iniciales de la demo

| Tracker | Rama | Tipo y unidad | Botón | Objetivo semanal | XP por unidad | Histórico inicial |
|---|---|---|---|---|---:|---:|
| Gym | HERO | Count · sesiones | `+1 sesión` | 4 sesiones | 30 | 5 sesiones |
| BJJ | HERO | Count · clases | `+1 clase` | 3 clases | 30 | 4 clases |
| Running | HERO | Distance · km | `+5 km` | 20 km | 5 | 30 km |
| Reading | HERO | Duration · min | `+30 min` | 120 min | 1 | 150 min |
| Beer | VILLAIN | Count · unidades | `+1` | Ninguno | 15 | 6 unidades |
| Burgers | VILLAIN | Count · unidades | `+1` | Ninguno | 20 | 3 unidades |

Los incrementos fijos evitan formularios y validaciones. El botón debe mostrar siempre cuánto añade.

Beer y Burgers muestran estadísticas y XP, pero **no metas, avisos para consumir más ni mensajes de “te falta una”**.

## 10. Dataset histórico de demo

Usar una **fecha de demo fija: miércoles 7 de octubre de 2026**. Todos los nuevos registros pertenecen a ese día simulado. Mostrarlo en el pie para que sea transparente.

Esto evita que la demo cambie de comportamiento al presentarla otro día.

| Fecha | Eventos |
|---|---|
| Lun 28 sep | Gym · BJJ · Run 5 km · Read 30 min · Burger |
| Mar 29 sep | Read 30 min |
| Mié 30 sep | Gym · BJJ · Run 7 km · Beer ×2 · Burger |
| Jue 1–dom 4 oct | Sin eventos |
| Lun 5 oct | Gym · BJJ · Run 4 km · Read 30 min |
| Mar 6 oct | Gym · Run 6 km · Read 30 min · Beer ×2 · Burger |
| Mié 7 oct | Gym · BJJ · Run 8 km · Read 30 min · Beer ×2 |

`Beer ×2` representa dos eventos count independientes. En total hay **28 eventos**, suficientes para demostrar el motor.

Resultados calculados:

| Actividad | Esta semana | Tramo anterior equivalente | Diferencia | Histórico |
|---|---:|---:|---:|---:|
| Gym | 3 | 2 | +1 | 5 |
| BJJ | 2 | 2 | 0 | 4 |
| Running | 18 km | 12 km | +6 km | 30 km |
| Reading | 90 min | 60 min | +30 min | 150 min |
| Beer | 4 | 2 | +2 | 6 |
| Burgers | 1 | 2 | −1 | 3 |

Estos valores deben salir de los eventos; no se escriben manualmente en las tarjetas.

## 11. Social mock

Tres amigos, con estadísticas de la semana demo:

| Persona | Player Lv. | Hero Lv. | Villain Lv. | Gym | BJJ | Running | Beer | HERO XP semanal |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Carlos | 8 | 9 | 2 | 5 | 4 | 31 km | 1 | 515 |
| Alex | 6 | 6 | 2 | 4 | 3 | 22 km | 4 | 350 |
| Dani | 5 | 4 | 3 | 2 | 2 | 8 km | 7 | 220 |

Los niveles representan toda su trayectoria ficticia. El ranking usa únicamente XP de la semana.

Para que los XP semanales también cuadren con las reglas, sus minutos de lectura implícitos son Carlos 90, Alex 30 y Dani 60.

**Ranking inicial:**

1. Carlos — 515 XP.
2. Alex — 350 XP.
3. Tú — 330 XP.
4. Dani — 220 XP.

Después de registrar Gym:

1. Carlos — 515 XP.
2. Tú — 360 XP.
3. Alex — 350 XP.
4. Dani — 220 XP.

Construir únicamente este ranking. Mostrar las dos ramas en las fichas conserva la visión dual sin añadir otro sistema de ordenación.

## 12. Wow moment

**Un toque en Gym transforma varios datos relacionados en una evolución del personaje.**

Secuencia visual:

1. El botón responde con una pequeña escala.
2. Gym pasa de `3/4` a `4/4`; su barra se llena.
3. Flota `+30 HERO XP` sobre la tarjeta.
4. Aparece un único aviso durante unos dos segundos:

   > **LEVEL UP — PLAYER 4**  
   > Gym Lv. 4 · Hero Lv. 4

5. Se actualizan los niveles y barras de la cabecera.
6. La comparación de Gym pasa de `+1` a `+2` y su histórico de `5` a `6`.
7. Al abrir Party, el usuario ocupa el segundo puesto.

Usar transiciones CSS y un aviso superpuesto. No encadenar tres modales ni incorporar una librería de partículas.

## 13. Demo script — 80 segundos

| Tiempo | Qué enseñas y haces | Qué dices |
|---|---|---|
| 0–12 s | Home, personaje y ambas ramas | «Tu vida real construye un personaje. Cada actividad genera estadísticas y experiencia en HERO o VILLAIN: dos facetas, sin penalizaciones». |
| 12–23 s | Señalas Gym, Running y Reading | «Aquí hay un historial de ejemplo. La app ya calcula sesiones, kilómetros, minutos y comparaciones automáticamente». |
| 23–38 s | Pulsas `+ Gym` | «Acabo de entrenar. Un toque actualiza mi objetivo, suma experiencia y hace evolucionar mi personaje». **Ocurre el level-up.** |
| 38–50 s | Señalas Gym actualizado | «Ahora tengo cuatro sesiones esta semana, seis acumuladas y dos más que en el mismo tramo anterior». |
| 50–60 s | Pulsas `+ Beer` | «También registro mis otras facetas. VILLAIN gana experiencia y contribuye al nivel global. No resta nada». |
| 60–73 s | Abres Party | «Esta Party es simulada. Mi fila sí responde a lo que registro: con el entrenamiento acabo de subir al segundo puesto». |
| 73–80 s | Vuelves al personaje | «No solo guardas lo que haces. Ves qué personaje estás construyendo con tu vida». |

## 14. Plan de implementación — 120 minutos

| Minutos | Trabajo | Resultado verificable |
|---|---|---|
| 0–8 | Arrancar el proyecto con el entorno disponible; fijar colores y contenedor móvil | Home vacía ejecutándose |
| 8–20 | Definir trackers, 28 eventos y fecha demo; persistencia y reset | Historial cargado y recuperable |
| 20–35 | Agregaciones, objetivos, comparaciones y fórmulas RPG | Los resultados coinciden con las tablas |
| 35–55 | Cabecera y tarjetas conectadas a datos; botones de registro | Flujo central funcional |
| 55–70 | Feedback de XP, barras y aviso de level-up | Wow moment reproducible |
| 70–78 | Party, amigos fijos y fila dinámica | El registro de Gym cambia el ranking |
| 78–90 | Jerarquía visual, espaciado móvil y textos | Producto presentable |
| 90–105 | Comprobar persistencia, reset, fechas y dobles pulsaciones | Demo estable |
| 105–120 | Ensayar, corregir defectos y preparar entrega | Demo completa en menos de 90 segundos |

**Si solo hay 90 minutos:** terminar el flujo central en el minuto 70, dedicar como máximo cinco minutos a una Party compacta y reservar los últimos quince para validación y ensayo.

No cambiar de framework, instalar un sistema de diseño completo ni explorar alternativas visuales durante el desarrollo.

## 15. Feature freeze

**Minuto 75: cierre absoluto de funcionalidades.**

A partir de ahí:

- Se termina de conectar lo ya iniciado.
- Se corrigen errores.
- Se ajusta diseño y feedback.
- Se ensaya y prepara la demo.

En el minuto 90, congelar también el diseño. Solo arreglar defectos que afecten a comprensión o funcionamiento.

## 16. Acceptance criteria

El MVP está terminado cuando:

- Al restablecer, existen exactamente 28 eventos y las seis tarjetas coinciden con el dataset.
- Gym muestra inicialmente `3/4`, 5 sesiones históricas y 150 XP.
- Un toque en Gym crea exactamente un evento y muestra `4/4`, 6 sesiones históricas y 180 XP.
- Ese toque cambia Gym, HERO y Player de nivel 3 a nivel 4.
- HERO pasa de 570 a 600 XP; VILLAIN permanece en 150.
- `+5 km` añade cinco kilómetros y 25 HERO XP.
- `+30 min` añade treinta minutos y 30 HERO XP.
- `+ Beer` añade una unidad y 15 VILLAIN XP, sin reducir ningún valor.
- Beer y Burgers no muestran objetivos.
- Las comparaciones utilizan los mismos días de ambas semanas.
- Recargar conserva los eventos registrados.
- Restablecer recupera los datos originales y permite repetir el level-up.
- Party identifica sus datos como ficticios y actualiza la posición del usuario después de Gym.
- A 390 px de ancho no hay desplazamiento horizontal y todos los botones son utilizables.
- La secuencia de demo se completa en menos de 90 segundos sin errores de ejecución.

## 17. Kill list

| Momento | Señal de retraso | Recorte obligatorio |
|---|---|---|
| Minuto 45 | Registrar aún no actualiza correctamente estadísticas y XP | Eliminar emblema decorativo, franja porcentual y barras de XP por actividad. Mantener números de nivel y barras de objetivos. |
| Minuto 60 | El flujo central sigue incompleto | Reducir Party a nombre, nivel y HERO XP; eliminar estadísticas secundarias de amigos. Sustituir el efecto flotante por un aviso sencillo. |
| Minuto 90 | La demo todavía falla o no es presentable | Convertir Party en un bloque compacto dentro de Home; eliminar navegación y transiciones. Detener cualquier trabajo ornamental. |

**Nunca recortar:** registro real, agregación desde eventos, ambas ramas, progreso global, persistencia y reset.

La visión social sobrevive como un bloque pequeño; no necesita una pantalla elaborada.

## 18. Top risks

| Riesgo | Impacto | Cómo evitarlo |
|---|---|---|
| Dedicar demasiado tiempo al personaje o al diseño RPG | No llegar a tener un flujo completo | Iconos y CSS; ningún avatar personalizado |
| Guardar contadores, XP y niveles por separado | Los valores se contradicen | Derivar todo del mismo historial |
| Fechas o comparaciones mal definidas | Estadísticas incorrectas y demo cambiante | Fecha simulada fija, semanas de lunes a domingo y comparación equivalente |
| El historial guardado elimina el level-up esperado | El wow moment desaparece | Reset visible y ensayo desde estado inicial |
| Convertir cada tipo de tracker en un formulario distinto | Se dispara el scope | Un botón de incremento fijo por actividad |

Validar especialmente la secuencia `reset → Gym → Beer → Party → recargar`.

## 19. Naming critique: HERO / VILLAIN

| Dimensión | Evaluación |
|---|---|
| Memorabilidad | Alta: la oposición es fácil de recordar |
| Claridad | Comunica RPG inmediatamente; necesita una frase para explicar la ausencia de penalización |
| Riesgo moralizante | Alto: «villano» tiene una carga negativa y la selección de actividades la refuerza |
| Potencial visual | Alto: colores, emblemas y dos progresiones diferenciadas |
| Potencial social | Alto: facilita identidades y conversación entre amigos |
| Potencial RPG | Alto: encaja con niveles, experiencia y futuras clases |

**Mantendría HERO / VILLAIN para el hackathon**, porque ayuda a entender y recordar el concepto rápidamente. Pero decir «no juzgamos» no neutraliza por sí solo los nombres: la interfaz debe demostrarlo.

Medidas concretas:

- Ambas ramas suman al nivel global.
- Ambas reciben feedback equivalente.
- VILLAIN no aparece en rojo.
- No existe una proporción «ideal».
- Las comparaciones no llevan valoración positiva o negativa.
- No se añaden metas de consumo a Beer o Burgers.

Si durante el ensayo la audiencia sigue entendiendo «bueno contra malo», la única alternativa que consideraría es **HERO / ROGUE**: conserva el lenguaje RPG y reduce la carga moral, aunque «Rogue» es menos comprensible para algunas personas.

## 20. Final recommendation

Construiría **un personaje con seis botones**, cuyas tarjetas ya contienen sus estadísticas. La Party sería una extensión pequeña de esa Home.

La concesión principal es aceptar actividades, incrementos y fecha de demo fijos. A cambio, el núcleo funciona de verdad: los eventos producen métricas, XP, niveles y cambios en el ranking.

**La demo debe concentrarse en Gym:** un toque completa un objetivo, actualiza el historial, sube niveles y cambia tu posición social. Esa cadena explica el producto mejor que diez funcionalidades adicionales.
