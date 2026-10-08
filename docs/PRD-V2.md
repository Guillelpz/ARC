# PRD V2 — Pantallas, actividades nuevas con «IA» y parties múltiples

> **Histórico.** Documento de la demo de hackathon. Lo implementado sigue estas reglas, pero el estado vigente y el alcance futuro están en `docs/ESTADO-ACTUAL.md`.

Documento incremental sobre `MVP-RPG.md` (V1) y `docs/TECH_SPEC.md`. Todo lo que este PRD no menciona sigue igual que en V1: motor de estadísticas, fórmulas RPG, umbrales, fecha demo, dataset de 28 eventos, toast de level-up y reset.

**Decisión de scope V2:** cinco vistas con navegación local, actividades personalizadas clasificadas por una heurística local presentada como «IA», y dos parties simuladas con catálogos de criterios propios. Sin backend, sin auth, sin dependencias nuevas.

---

## 1. Objetivo

Pasar de «un personaje con seis botones» a «un personaje que crece con cualquier cosa que hagas, y que se mide distinto en cada grupo de amigos».

Tres cosas que la demo V2 debe probar:

1. **Cualquier actividad cabe.** Escribes algo nuevo («meditar», «comer pizza a las 3am»), la app propone si es HERO o VILLAIN y con cuánta XP, y tú decides.
2. **Cada party tiene sus reglas.** Una misma acción sube tu personaje global siempre, pero solo sube tu nivel en una party si esa party aceptó esa actividad como criterio.
3. **La interfaz se entiende sola.** HERO y VILLAIN tienen pantallas propias con identidad visual separada (claro / oscuro).

Métrica de éxito de la demo: la secuencia del §9 se completa en menos de 2 minutos sin errores y el público entiende la regla «global siempre, party solo si es criterio» al ver `+ Beer`.

## 2. Usuarios e historia de demo

Usuario único, `YOU`, sin cuenta. Los amigos siguen siendo ficticios.

**Historia:** «Pertenezco a dos grupos. Con *Los del Gym* (Carlos, Alex, Dani) vale todo, también las cervezas. En *La Oficina* (Lucía, Marta, Pablo) solo cuentan running, lectura y las burgers del viernes; la cerveza se propuso y no se aceptó. Hoy he empezado a meditar y anoche comí pizza a las 3am: lo añado, la app me sugiere la rama, lo propongo a mis parties y cada una decide».

## 3. Alcance

### P0 — imprescindible

| # | Funcionalidad | Qué construimos |
|---|---|---|
| P0-1 | Navegación | Barra inferior fija con 5 destinos: `Inicio`, `HERO`, `VILLAIN`, `Nuevo`, `Party`. Estado local, sin router. |
| P0-2 | Inicio | Cabecera del personaje actual (`PlayerHeader`) + resumen de parties + accesos + pie con reset. |
| P0-3 | Misiones HERO | Tarjetas HERO (6 semilla filtradas + personalizadas) sobre tema claro. |
| P0-4 | Misiones VILLAIN | Tarjetas VILLAIN sobre tema oscuro. |
| P0-5 | Pantalla Desconocido | Texto libre → análisis «IA» → propuesta editable → crear misión → proponer a parties → resultado. |
| P0-6 | Clasificador local | Función pura de palabras clave y reglas; devuelve rama, confianza, motivo, tipo, unidad, incremento y XP sugerida. |
| P0-7 | Trackers personalizados | Persistidos en localStorage; se comportan como los semilla (tarjeta, botón, stats, XP). |
| P0-8 | Parties múltiples | Dos parties fijas en código, cada una con miembros ficticios y criterios iniciales. |
| P0-9 | Progresión por party | Tus niveles HERO/VILLAIN/PLAYER y XP semanal HERO en cada party, derivados solo de los trackers aceptados en ella. |
| P0-10 | Votación simulada | Proponer un tracker a una party produce aceptación/rechazo determinista con el voto visible de cada amigo. |
| P0-11 | Pantalla Party | Selector de party, tus niveles en ella, ranking, lista de criterios aceptados y rechazados. |
| P0-12 | «Cuenta en» | Cada tarjeta indica en qué parties cuenta esa actividad. |

### P1 — si sobra tiempo

| # | Funcionalidad |
|---|---|
| P1-1 | Proponer una actividad **existente** (p. ej. Beer o Gym) a una party donde no es criterio, desde la tarjeta o desde la pantalla Party. Reutiliza la misma votación. |
| P1-2 | Feedback por party al registrar: `+15 VILLAIN XP · cuenta en Los del Gym`. |
| P1-3 | Toast de level-up también para niveles de party. |
| P1-4 | Atajo en la pantalla Desconocido: si el texto coincide con un tracker existente, ofrecer ir a él en lugar de duplicarlo. |

### Fuera de alcance

- Backend, cuentas, IA real o llamadas a cualquier API, dependencias nuevas.
- Crear, editar, borrar o abandonar parties; invitar amigos reales; chat.
- Editar o borrar trackers personalizados (se eliminan con «Restablecer demo»).
- Objetivos semanales para trackers personalizados.
- Pesos de XP distintos por party (la party acepta o no; no reescala).
- Votar tú en propuestas de otros; propuestas de los amigos; volver a proponer algo rechazado.
- Fecha de ingreso en una party o corte temporal de criterios (ver regla R5).
- Router, URLs por pantalla, animaciones nuevas, rediseño del motor V1.

## 4. Pantallas

Navegación global y cabecera/Inicio/Party usan la base neutral de la guía de estilo; HERO es un modo claro local y VILLAIN un modo oscuro local, sin mezclar paletas (ver `.claude/skills/frontend-stylist/references/style-guide-template.md`). La barra inferior no lleva color de rama; la vista activa se marca con borde, peso y `aria-current`. Iconos Lucide: `House`, `Shield`, `Moon`, `Sparkles`, `Users`.

### 4.1 Inicio

Contenido, de arriba abajo:

1. `PlayerHeader` actual sin cambios funcionales: `YOU`, `PLAYER LEVEL N`, barras HERO/VILLAIN, distribución de XP. Es el progreso **global**.
2. Dos accesos lado a lado (panel claro y panel oscuro, separados): `Misiones HERO · N` y `Misiones VILLAIN · N`, con el XP semanal de cada rama.
3. Bloque «Tus parties»: una fila por party con nombre, etiqueta `de ejemplo`, tu `Lv.` en esa party y tu posición en su ranking. Tocar abre Party con esa party seleccionada.
4. Botón secundario `Añadir algo nuevo` → pantalla Desconocido.
5. Pie actual: `Historial de ejemplo · Fecha demo: 7 oct 2026 · Restablecer demo`.

Acciones: navegar; restablecer demo.

### 4.2 Misiones HERO

- Fondo y tarjetas del tema claro HERO en toda la superficie.
- Cabecera: `HERO · Lv. N`, XP y barra hacia el siguiente nivel (global).
- Lista de `TrackerCard` HERO: primero los 4 semilla, después los personalizados en orden de creación.
- Cada tarjeta añade una línea de metadatos: `Cuenta en: Los del Gym · La Oficina` o `Cuenta en: ninguna party`.
- Tarjetas personalizadas: icono genérico (`Sparkles`) y etiqueta `Nueva`; sin objetivo semanal.
- Estado vacío no aplica (siempre hay semilla).

Acción: registrar (`+1`, `+5 km`, `+30 min`…), igual que V1, con XP flotante y toast global.

### 4.3 Misiones VILLAIN

Idéntica estructura a 4.2 sobre tema oscuro VILLAIN. Sin objetivos ni mensajes de «te falta», como en V1.

### 4.4 Desconocido («Añadir algo nuevo»)

Título `Desconocido`, subtítulo `Añade algo nuevo a tu personaje`. Base neutral; la propuesta se pinta con la paleta de la rama elegida.

**Paso 1 — Escribir.** Campo de texto (2–40 caracteres tras recortar espacios) y botón `Analizar con IA`. Deshabilitado si el texto es inválido o si ya existe un tracker con el mismo nombre (comparación sin mayúsculas ni tildes); en ese caso, mensaje `Ya tienes «Beer»`.

**Paso 2 — Propuesta «IA».** Tarjeta con:
- `La IA propone: VILLAIN` + confianza (`alta` / `media` / `baja`).
- Motivo legible: `Detectado: «pizza», «3am»`. Sin pistas: `Sin pistas claras: elige tú`.
- Campos editables: rama (dos botones HERO / VILLAIN), tipo (`Veces` / `Km` / `Minutos`), XP por unidad (número entero 5–50).
- Vista previa del botón resultante: `+1 · 20 XP`.
- Acciones: `Crear misión` y `Volver`.

**Paso 3 — Proponer a parties.** Tras crear, el tracker ya existe y cuenta en tu progreso global. Lista de parties con casilla (ninguna marcada por defecto). Acciones: `Proponer` (deshabilitado sin selección) y `Ahora no`.

**Paso 4 — Resultado.** Por cada party propuesta: `Aceptada 2/3` o `Rechazada 1/3`, con el voto de cada amigo (`Carlos ✕ · Alex ✓ · Dani ✓`). Texto: `En las parties que la aceptaron, tus registros de Meditar suman XP; en el resto, solo a tu personaje`. Acciones: `Ir a Misiones HERO|VILLAIN` y `Añadir otra`.

Sin marcar ninguna party, el flujo termina en el paso 3 con el mismo botón `Ir a Misiones…`.

### 4.5 Party

- Selector de party (dos botones tipo segmento) arriba; recuerda la última seleccionada mientras la app está abierta.
- Etiqueta visible `Party de ejemplo`.
- Bloque «Tú en esta party»: `PLAYER Lv.`, HERO y VILLAIN con nivel y XP, calculados solo con sus criterios. Comparación de una línea: `Global: Lv. 3 · Aquí: Lv. 2`.
- Ranking semanal HERO (misma regla que V1, pero tu XP semanal HERO solo cuenta criterios de esta party). Fila: nombre, niveles Player/HERO/VILLAIN y XP semanal HERO. Tu fila se resalta.
- «Criterios de esta party», en dos paneles separados HERO / VILLAIN: nombre de cada tracker aceptado. Debajo, `No aceptados:` con los rechazados y su recuento de votos.

Acciones: cambiar de party; (P1) proponer una actividad existente.

## 5. Flujos

### 5.1 Añadir actividad nueva

```text
Desconocido: escribir "comer pizza a las 3am"
  → Analizar con IA → classify(texto)
      = { branch: villain, confidence: alta, reasons: [pizza, 3am], type: count, unit: unidades, increment: 1, xpPerUnit: 20 }
  → usuario acepta o cambia rama/tipo/XP
  → Crear misión → se persiste el Tracker personalizado (no crea eventos)
  → Proponer a [Los del Gym, La Oficina]
      → vote(tracker, party) por cada party → se persiste una Proposal por party
  → Resultado: Los del Gym Aceptada 2/3 · La Oficina Rechazada 1/3
  → Ir a Misiones VILLAIN → aparece la tarjeta "Comer pizza a las 3am" con "Cuenta en: Los del Gym"
```

### 5.2 Registrar en una actividad

```text
+1 en tarjeta → 1 ActivityEvent (igual que V1)
  → global: siempre suma
  → cada party: suma solo si trackerId ∈ criterios(party)
  → toast de level-up global (V1); niveles de party se ven en Party/Inicio
```

### 5.3 Votación simulada

Cada amigo ficticio tiene una postura fija por rama: `{ hero: boolean, villain: boolean }`. Una propuesta se acepta si votan sí al menos 2 de los 3 amigos. El usuario proponente no vota. Es determinista: misma rama y misma party → mismo resultado siempre, también tras reset.

| Party | Amigo | Acepta HERO | Acepta VILLAIN |
|---|---|:-:|:-:|
| Los del Gym | Carlos | ✓ | ✕ |
| | Alex | ✓ | ✓ |
| | Dani | ✓ | ✓ |
| La Oficina | Lucía | ✓ | ✕ |
| | Marta | ✓ | ✕ |
| | Pablo | ✓ | ✓ |

Consecuencia: HERO se acepta en ambas (3/3); VILLAIN se acepta en Los del Gym (2/3) y se rechaza en La Oficina (1/3). Cumple el ejemplo del usuario con la cerveza.

## 6. Reglas de negocio

- **R1 — Global.** El progreso global es exactamente el de V1, extendido a todos los trackers (semilla + personalizados): todo evento suma `amount × xpPerUnit` a su rama y al PLAYER.
- **R2 — Por party.** Para cada party, tus XP y niveles se calculan con las **mismas fórmulas y umbrales** de V1, pero solo sobre eventos cuyo tracker esté en `criterios(party)`. El XP por unidad es el del tracker; la party no lo modifica.
- **R3 — Criterios.** `criterios(party) = criterios iniciales en código ∪ trackers con propuesta aceptada en esa party`.
- **R4 — Propuestas.** Un tracker se puede proponer una sola vez a cada party. El resultado es definitivo hasta «Restablecer demo». No se puede proponer a una party un tracker que ya es criterio en ella.
- **R5 — Histórico (decisión).** **Retroactivo.** Cuando un criterio se acepta, cuentan todos tus eventos de ese tracker, también los anteriores a la aceptación. Motivo: el XP de party se deriva en cada render de `eventos + criterios` como un conjunto, sin fechas de alta, igual que todo lo demás. Es lo más simple y no requiere guardar instantes de corte. Consecuencia visible (aceptable y explicable): aceptar un criterio puede subir tu nivel de party de golpe; la pantalla de resultado lo muestra (`+120 XP en Los del Gym`, P1) o basta con verlo en Party.
- **R6 — Amigos.** Sus niveles por party y su XP semanal son constantes. Cada amigo tiene datos distintos en cada party en la que está («cada persona evoluciona a su ritmo en cada party»), aunque en esta demo cada amigo pertenece a una sola party.
- **R7 — Ranking.** Por party: XP semanal HERO descendente, orden estable con tu fila primero (ganas empates), como en V1.
- **R8 — Tono.** La «IA» propone, no juzga. Textos neutros: `La IA propone: VILLAIN`, nunca «mal hábito». Sin rojo/verde; los votos usan ✓/✕ con texto, no color de aprobación/castigo.
- **R9 — Nombres.** Nombre del tracker = texto escrito, recortado y con la primera letra en mayúscula. Único sin distinguir mayúsculas ni tildes.

### 6.1 Clasificador «IA» (heurística local)

Es una **función pura determinista** en `core/`. No hay modelo, red ni API. La UI la llama «IA»; este PRD deja claro que es una heurística de palabras clave.

1. Normalizar: minúsculas, sin tildes (`normalize('NFD')`), espacios colapsados.
2. Contar coincidencias con dos listas de palabras clave (≈15–25 cada una; lista final en la implementación). Ejemplos:
   - HERO: meditar, yoga, correr, caminar, nadar, bici, entrenar, gym, estirar, leer, estudiar, idiomas, dormir, agua, fruta, verdura, cocinar, ordenar, voluntariado.
   - VILLAIN: pizza, burger, hamburguesa, cerveza, vino, copa, alcohol, fumar, chuches, azúcar, comida rápida, scroll, tiktok, procrastinar, trasnochar, madrugada.
3. Regla horaria: `/\b[0-5]\s*am\b/` o «madrugada» (no se usa `h` para no confundir horas de madrugada con duraciones como «1h de yoga») suma 1 a VILLAIN.
4. Rama = la de más coincidencias. Empate o cero coincidencias → HERO con confianza `baja` y motivo `Sin pistas claras: elige tú`.
5. Confianza: `alta` si la ganadora tiene ≥2 y la otra 0; `media` si gana por al menos 1; `baja` en el resto.
6. Tipo y unidad: contiene `km` → `distance · km · +5 · 5 XP/km`; contiene `min`, `minutos`, `hora` → `duration · min · +30 · 1 XP/min`; resto → `count · unidades · +1 · 20 XP`.

Valores sugeridos alineados con V1 (Burgers 20 XP/unidad; Running 5 XP/km; Reading 1 XP/min).

## 7. Modelo conceptual de datos

| Categoría | Qué | Dónde |
|---|---|---|
| **Fuente de verdad persistida** | `ActivityEvent[]` | localStorage `life-rpg-demo-v1` (sin cambios) |
| | `Tracker[]` personalizados (misma forma que `Tracker`, con `custom: true`) | localStorage, clave nueva `life-rpg-custom-v1` |
| | `Proposal[]` = `{ trackerId, partyId, proposedAt }` | misma clave nueva |
| **Constantes en código** | 6 `TRACKERS` semilla, `DEMO_DATE`, umbrales, `SEED_EVENTS` | sin cambios |
| | `PARTIES`: `{ id, name, members[], seedCriteria: trackerId[] }`; cada miembro con niveles, XP semanal HERO y postura de voto | `core/party.ts` |
| | Listas de palabras clave del clasificador | `core/` |
| **Derivado (nunca guardado)** | Lista completa de trackers (semilla + personalizados) | |
| | Resultado de cada propuesta (`vote(tracker.branch, party)`) — **no se guarda el resultado**, solo que se propuso | |
| | Criterios por party, «Cuenta en», tus XP/niveles globales y por party, rankings, estadísticas | |

Notas:
- Guardar solo «se propuso» y recalcular el voto mantiene la regla «todo derivado»: cambiar una postura en código cambia el resultado sin migraciones.
- `Tracker.unit` ya cubre `unidades`, `km` y `min`; los personalizados usan solo esos tres.
- Carga defensiva: si la clave nueva falta o está corrupta → `{ trackers: [], proposals: [] }`. Eventos o propuestas que apunten a trackers inexistentes se ignoran al derivar.
- «Restablecer demo» vuelve a los 28 eventos y vacía trackers personalizados y propuestas.
- Persistencia sigue aislada en `core/storage.ts`.
- Recomendación para el Tech Lead (no obligatoria): parametrizar el cálculo actual para recibir la lista de trackers a considerar; el progreso de party es ese mismo cálculo con los trackers filtrados por criterios. Evita una segunda fórmula.

### 7.1 Datos de parties de la demo

**Los del Gym** = la Party de V1, sin cambios: Carlos, Alex, Dani con sus datos actuales. Criterios iniciales: los 6 trackers semilla. Por tanto, tus valores en ella coinciden con los globales al abrir.

**La Oficina** — criterios iniciales: Running, Reading (HERO) y Burgers (VILLAIN). Beer **no** es criterio (figura como «No aceptado 1/3» solo si se propone en P1).

| Persona | Player Lv. | HERO Lv. | VILLAIN Lv. | XP semanal HERO |
|---|---:|---:|---:|---:|
| Lucía | 4 | 4 | 1 | 240 |
| Marta | 3 | 3 | 1 | 160 |
| Pablo | 2 | 2 | 1 | 120 |

Tus valores en La Oficina al abrir (derivados del dataset V1): HERO 300 XP (Running 150 + Reading 150) → Lv. 2; VILLAIN 60 (Burgers) → Lv. 1; PLAYER 360 → Lv. 2; XP semanal HERO 180 (18 km × 5 + 90 min × 1). Ranking: Lucía 240, **Tú 180**, Marta 160, Pablo 120.

## 8. Criterios de aceptación

Verificables a mano o en `selfcheck.ts` (⚙ = automatizable, función pura).

**Regresión V1**
- ⚙ Tras reset: 28 eventos, 0 trackers personalizados, 0 propuestas; HERO 570, VILLAIN 150, PLAYER 720 (Lv. 3).
- ⚙ Todos los asserts actuales de `selfcheck.ts` siguen pasando sin modificarlos.
- ⚙ Ranking de Los del Gym: inicial Carlos, Alex, Tú (330), Dani; tras `+ Gym`: Carlos, Tú (360), Alex, Dani.

**Parties**
- ⚙ Criterios iniciales: Los del Gym = 6 semilla; La Oficina = running, reading, burgers.
- ⚙ Tus niveles en Los del Gym = globales al abrir.
- ⚙ La Oficina al abrir: HERO 300 (Lv. 2), VILLAIN 60 (Lv. 1), PLAYER 360 (Lv. 2), XP semanal HERO 180; ranking Lucía, Tú, Marta, Pablo.
- ⚙ `+ Beer`: VILLAIN global 150 → 165; Los del Gym 150 → 165; La Oficina sigue en 60.
- ⚙ `+ Gym`: La Oficina no cambia en nada.
- La tarjeta Beer muestra `Cuenta en: Los del Gym`; Running muestra `Cuenta en: Los del Gym · La Oficina`.

**Clasificador**
- ⚙ «meditar» → HERO, count, +1, 20 XP.
- ⚙ «comer pizza a las 3am» → VILLAIN, confianza alta, motivos incluyen «pizza» y «3am».
- ⚙ «correr 5 km» → HERO, distance, km, +5, 5 XP/km.
- ⚙ «leer 30 minutos» → HERO, duration, min, +30, 1 XP/min.
- ⚙ «xyzzy» → HERO, confianza baja, motivo «Sin pistas claras».
- ⚙ Mismo texto → mismo resultado (determinista); «Pizza» y «pizza» coinciden.

**Trackers personalizados y propuestas**
- Crear «Meditar» (HERO, +1, 20 XP) lo muestra al final de Misiones HERO con `Cuenta en: ninguna party`; un toque suma 20 HERO XP global.
- ⚙ Proponer Meditar a ambas → Aceptada 3/3 en las dos; desde entonces aparece en sus criterios.
- ⚙ Retroactivo: con 1 evento de Meditar ya registrado, aceptar en La Oficina sube allí HERO de 300 a 320.
- ⚙ Proponer «Comer pizza a las 3am» (VILLAIN) → Los del Gym Aceptada 2/3 (Carlos ✕); La Oficina Rechazada 1/3 (Pablo ✓). Un registro posterior: VILLAIN global +20, Los del Gym +20, La Oficina +0.
- No se puede crear un tracker con nombre existente («beer», «Beer», «Béer»).
- No se puede proponer dos veces el mismo tracker a la misma party.
- Recargar conserva trackers, propuestas y eventos; «Restablecer demo» los elimina y vuelve al estado inicial.
- Una clave `life-rpg-custom-v1` corrupta no rompe la app (arranca sin personalizados).

**UI**
- 5 destinos de navegación usables a 390 px sin scroll horizontal; vista activa con `aria-current`.
- Misiones HERO usa solo tokens HERO claros y Misiones VILLAIN solo tokens VILLAIN oscuros; ninguna superficie mezcla ambas paletas.
- La palabra «IA» aparece en la pantalla Desconocido; ningún texto juzga al usuario.
- `npm run build` y `npm run lint` pasan; la consola no muestra `Assertion failed`.

## 9. Guion de demo (≈110 s)

| Tiempo | Acción | Mensaje |
|---|---|---|
| 0–15 s | Inicio | «Mi personaje global y mis dos parties, con un nivel distinto en cada una». |
| 15–30 s | Misiones HERO → `+ Gym` | Level-up V1. «Mi vida sube mi personaje». |
| 30–50 s | Misiones VILLAIN → `+ Beer`; abrir Party y alternar | «La cerveza me sube VILLAIN global y en Los del Gym; en La Oficina no se aceptó, ahí no cuenta». |
| 50–85 s | Desconocido: «comer pizza a las 3am» → IA propone VILLAIN → Crear → proponer a ambas | «La IA propone, yo decido. Cada party vota: Gym acepta, Oficina no». |
| 85–100 s | Misiones VILLAIN → `+1` pizza; Party | «Cuenta donde se aceptó». |
| 100–110 s | Inicio | «Un personaje, muchas tablas: cada grupo decide qué cuenta». |

Validar especialmente: `reset → Gym → Beer → Party (alternar) → crear pizza → proponer → +1 pizza → recargar`.

## 10. Orden de construcción y recortes

Orden sugerido (cada paso deja la app ejecutable):

1. Núcleo: trackers combinados, parties con criterios, votación, progreso por party, clasificador + asserts (sin UI).
2. Persistencia de trackers y propuestas + reset ampliado.
3. Navegación de 5 destinos; mover tarjetas a Misiones HERO / VILLAIN; Inicio con `PlayerHeader`.
4. Pantalla Party con selector, tus niveles, ranking y criterios.
5. Pantalla Desconocido completa.
6. Temas claro/oscuro por pantalla y pulido (revisión `frontend-stylist`).
7. **Feature freeze.** Validación y ensayo.

Kill list:
- Si el paso 5 va tarde: quitar la edición de tipo y XP (solo rama editable) y la vista previa del botón.
- Si sigue tarde: quitar el bloque «Tus parties» de Inicio y la línea de comparación global/party en Party.
- Si el tema visual va tarde: mantener la base actual y aplicar tema claro/oscuro solo al fondo y tarjetas de cada pantalla de misiones.
- **Nunca recortar:** regla global vs party (R1–R3), votación visible, clasificador local con propuesta editable de rama, persistencia y reset.

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El clasificador acierta poco con textos libres | Parece una «IA» tonta | Siempre es una propuesta editable; motivo visible; confianza `baja` honesta; frases de demo probadas en asserts. |
| Presentar heurística como «IA» | Expectativa falsa | El PRD lo documenta; en UI, «La IA propone» + «tú decides». Sin afirmar aprendizaje ni personalización. |
| Saltos retroactivos de nivel en party al aceptar un criterio | Confusión | Es coherente con «todo derivado»; se explica en el resultado de la propuesta. |
| Romper los números de V1 al generalizar el cálculo | Se pierde el wow moment | Los asserts de V1 no se tocan; Los del Gym replica la Party V1. |
| 5 destinos en la barra a 390 px | Botones apretados | Icono + etiqueta corta; comprobar a 390 px y 320 px. |
| Restyle claro/oscuro consume la sesión | Funcionalidad sin terminar | Tema solo tras el paso 5; kill list específica. |
| Datos viejos en localStorage (clave nueva ausente o corrupta) | Arranque roto | Carga defensiva y reset visible. |
| Etiquetar actividades como VILLAIN suena moralizante | Rechazo del público | Tono R8, sin rojo/verde, VILLAIN también suma. |

## 12. Preguntas abiertas (con recomendación por defecto)

| # | Pregunta | Recomendación por defecto |
|---|---|---|
| Q1 | ¿Los eventos anteriores a la aceptación de un criterio cuentan en la party? | **Sí, retroactivo** (R5). Lo más simple y coherente con derivar todo. |
| Q2 | ¿Puede la party ponderar distinto el XP de un criterio? | No. Aceptar o no; el XP es el del tracker. |
| Q3 | ¿Qué propone la «IA» si no encuentra pistas o hay empate? | HERO con confianza `baja` y aviso «elige tú». |
| Q4 | ¿Se pueden proponer actividades existentes (Beer a La Oficina)? | Sí, pero P1; misma votación (Beer → Rechazada 1/3). |
| Q5 | ¿Se puede volver a proponer algo rechazado o editar/borrar un tracker personalizado? | No en V2; solo «Restablecer demo». |
| Q6 | ¿Parties seleccionadas por defecto al proponer? | Ninguna; el usuario elige explícitamente. |
| Q7 | ¿Nombre de la pantalla? | Título `Desconocido`, pestaña `Nuevo`, subtítulo «Añade algo nuevo a tu personaje». |
| Q8 | ¿Fila del ranking con las 4 estadísticas de V1 (Gym, BJJ, Running, Beer)? | Fila genérica: niveles + XP semanal HERO en ambas parties. Las 4 estadísticas fijas no tienen sentido en La Oficina. |
| Q9 | ¿Un amigo en varias parties con ritmos distintos? | El modelo lo permite (datos por party); en la demo cada amigo está en una sola party para no tocar el ranking V1. El ejemplo vivo de «ritmo por party» eres tú. |
| Q10 | ¿Level-up de party en el toast? | No en P0 (P1-3); el toast sigue siendo global. |
