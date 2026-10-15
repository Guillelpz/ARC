# Estado del workflow

Ver `docs/WORKFLOW.md`. Ciclos 1–28 cerrados e implementados. Las specs y documentos de los ciclos 1–22 se eliminaron el 2026-10-12, y los de los ciclos 23–27 el 2026-10-15; todos están en el historial de git. Se conserva `cycle-28/` como entrada del siguiente ciclo.

## En curso

- Ciclo 23 (P23.1, límite semanal VILLAIN) — **cerrado** (merge e042d2e; análisis en `cycle-23/analysis.md`, en el historial de git). Reactivado por el usuario el 2026-10-12 solo para esto; pasos 1-2 omitidos. Fuera de él, el workflow sigue en pausa hasta que el usuario lo reactive con datos de uso real.
- Ciclo 26 (registro de series de Gym por voz) — **cerrado** (merge 163eb2c, push a origin; análisis en `cycle-26/analysis.md`, en el historial de git). T8 pendiente de la prueba en iPhone. El workflow vuelve a pausa.
- Ciclo 27 (captura rápida por voz desde el «+») — **cerrado** (merge 1f1e706, push a origin; análisis en `cycle-27/analysis.md`, en el historial de git). Pendiente la prueba del usuario en iPhone. El workflow vuelve a pausa. Spec aprobada el 2026-10-13; §3-A: sin clave, un hábito nuevo nunca se crea solo (siempre tarjeta).
- Ciclo 28 (menos llamadas a Haiku en la captura) — **cerrado** (merge ea67c15, push a origin; análisis en `cycle-28/analysis.md`). El workflow vuelve a pausa. Arrancado el 2026-10-14 con la decisión M-B.

## Ciclo 29+ — Módulo Comida (fase 1: registro manual)

Arrancado por el usuario el 2026-10-15 (pasos 1-2 omitidos; decisiones F1-F12 aprobadas en el chat, no se reabren). El tech-lead divide en fases/ciclos (`docs/TECH_SPEC-food.md`). Fases siguientes, **fuera de este alcance**: integraciones con apps/bases de comida (fase 2, investigación) y registro por voz (fase 3). El modelo de datos debe dejarlas encajar sin migraciones.

- **F1 Pantalla:** «Comida» (paleta HERO), tarjeta en «Yo» junto a Gym, como el módulo Gym (registrar datos a mano: «arroz 100 g», «1000 kcal»). Formato inspirado en MyFitnessPal. Sin party.
- **F2 Alimentos:** catálogo integrado de ~100-150 alimentos básicos con valores por 100 g (fuentes públicas: USDA FoodData Central, dominio público, contrastado con BEDCA; **no** datos de MyFitnessPal: API cerrada y base propietaria) + alimentos propios del usuario (crear, archivar, reactivar, como los ejercicios propios). Nombres en español (dejar sitio para alias EN de la fase de voz).
- **F3 Diario:** lista única por día (sin desayuno/comida/cena), selector de día sin futuro, «Deshacer» por entrada; datos de solo añadir como `GymSet`/`GymUndo`.
- **F4 Añadido rápido:** «1000 kcal» a secas, macros opcionales.
- **F5 Cantidad:** g/ml por defecto + raciones opcionales por alimento («1 huevo = 60 g»).
- **F6 Nutrientes:** kcal, proteína, carbohidratos y grasa (nada más).
- **F7 Objetivo:** manual, kcal + reparto en % de P/C/G (gramos derivados). Sin datos corporales ni TDEE.
- **F8 RPG:** tracker HERO fijo nuevo «Dieta» con +1 automático el día cumplido (kcal entre el 90 % y el 110 % del objetivo); **en vivo**: aparece en cuanto entra en rango (XP y toast como siempre) y se retira si se sale (pasarse o deshacer), patrón `gym-auto-<día>`. Reglas de XP existentes; el módulo no da XP propia.
- **F9 Extras que entran:** recientes/frecuentes (arriba del buscador, última cantidad prerrellenada); platos guardados (como rutinas: «Mi desayuno» = varios alimentos, añadir de un toque); resumen semanal (media kcal/macros vs objetivo + gráfico 8 semanas, SVG propio como Progreso del gym).
- **F10 Pospuestos:** copiar día anterior, fibra/azúcar/sal, agua, comidas separadas, TDEE.
- **F11 «Hoy»:** fila «Comida · 1.640 / 2.200 kcal» que abre la pantalla Comida (volver → Inicio con foco en «Hoy», como Gym).
- **F12 Datos:** clave propia en localStorage, en export/import, backups, `restoreLast` y fusión (`mergeLog`); copias antiguas sin comida siguen importándose y fusionándose. Sin dependencias de runtime, sin backend. Push a `main` tras cada ciclo cerrado.

**Ejecución:** tech-lead (spec + fases) → okay del usuario (resumen ≤15 líneas + decisiones abiertas) → implementer `cycle-29` (y siguientes si hay varias fases) → reviewer → merge `--no-ff` → push → cycle-analyst.

**Spec aprobada (2026-10-15):** `docs/TECH_SPEC-food.md`, ciclos 29 (núcleo) y 30 (propios, platos, resumen semanal), seguidos; decisiones A1, B1, C1, D1, E1 (las recomendadas).

**Estado:** ciclo 29 **cerrado** (merge d3c4ddd, push; review APROBADO; análisis en `cycle-29/analysis.md`). Ciclo 30 en implementación (rama `cycle-30`).

## Ciclo 28 — Menos llamadas a Haiku en la captura por voz

Aprobado por el usuario el 2026-10-14 (pasos 1-2 omitidos). Motivo: rapidez (respuesta instantánea frente a 1-2 s), uso sin conexión y menos datos enviados; el coste ya es bajo (~0,0002 $ por frase).

- **O3 Saltarse Haiku si el dispositivo está seguro:** coincidencia exacta con el nombre o un alias de un hábito activo, o serie de gym completa con ejercicio reconocido → no se llama a Haiku. Las coincidencias aproximadas (erratas, prefijos: «bread» → Reading) siguen yendo a Haiku. Otro día (C6) se sigue detectando en el dispositivo.
- **O1 Memoria de frases confirmadas:** al apuntar algo por voz que no se deshace, se guarda la frase normalizada sin números → decisión (gym/ejercicio, hábito). Una frase equivalente después se resuelve en el dispositivo (el parser saca la cantidad). Deshacer borra la entrada. Al usarla se valida que el hábito/ejercicio siga existiendo y activo. Tope de tamaño (lo fija el tech-lead).
- **No entra:** alias aprendidos (O2), recorte del prompt (O4).
- **Decisión M (usuario, 2026-10-14): M-B.** La memoria de frases es caché del dispositivo, como la clave de Anthropic: fuera de Exportar/Importar, fusión y «Recuperar copia anterior»; «Borrar todo» la vacía igualmente.

**Estado:** **cerrado** (merge ea67c15, push a origin; review APROBADO en `cycle-28/review.md`; análisis en `cycle-28/analysis.md`). La spec se eliminó al cerrar (está en el historial de git). El workflow vuelve a pausa hasta que el usuario lo reactive.

## Ciclo 27 — Captura rápida por voz: gym, hábito existente o hábito nuevo

Arrancado por el usuario el 2026-10-13 tras una evaluación de viabilidad en el chat (pasos 1-2 omitidos; decisiones C1-C9 aprobadas, no se reabren). Rama `cycle-27` (spec eliminada, en el historial de git).

- **Objetivo:** pulsar «+» → escucha en el mismo toque → transcribe → decide y registra. Ejemplos de aceptación: «80kg bench press 5 reps» → serie de Gym; «Read 50 pages of the name of the wind» → Reading +100 min; «ate a burguer» / «eat a burguer» / «burguer» → Burgers +1; «grounding 30 min» → propuesta de hábito nuevo (rama evaluada, medido en tiempo, 30 min).
- **C1 Entradas:** el «+» de Inicio (entre HERO y VILLAIN, hoy navega a `new`) y la pestaña «Nuevo» abren la captura con el micro ya activo (el reconocimiento debe arrancar dentro del gesto: iOS). Queda «Escribir a mano» para el flujo actual de `UnknownView`. El botón «Dictar serie» de Inicio pasa a ser la captura general; el de Gym sigue solo para series.
- **C2 Lectura:** conversión fija 1 página = 2 min (Reading sigue en minutos); el aviso muestra la conversión («50 páginas ≈ 100 min»).
- **C3 Hábito existente:** se guarda directamente con «Deshacer» (y «Editar»), como las series del ciclo 26.
- **C4 Hábito nuevo:** siempre tarjeta de propuesta (nombre, rama, tipo/unidad, cantidad editables). Con confianza «alta» se crea sola a los **10 s** con cuenta atrás visible; cualquier interacción con la tarjeta la cancela. Con confianza media/baja nunca se crea sola. Al crearla se apunta también la cantidad dicha.
- **C5 Unidades libres:** la IA puede proponer tipo `custom` con unidad propia («páginas», «vasos»).
- **C6 Solo hoy:** si la frase menciona otro día (ayer, mañana, el otro día, yesterday…), no se guarda nada y se muestra: «Por voz solo se apunta hoy. Para otro día, hazlo a mano.»
- **C7 IA:** una única interpretación con Haiku 5.5 y la clave del usuario (camino de `haiku.ts`), que también sustituye a la clasificación por proxy de dev en este flujo; sin clave o ante fallo → router determinista en `core/` cubierto por el selfcheck. Sin dependencias nuevas, sin backend.
- **C8 Idioma:** ES/EN; el reconocimiento usa el idioma de Ajustes (sin cambios).
- **C9** Sin paso de party al crear por voz (se puede proponer después desde las misiones).

## Ciclo 26 — Registro de series de Gym por voz

Arrancado por el usuario el 2026-10-12 con las decisiones V1-V5 ya aprobadas (pasos 1-2 omitidos; no se reabren). Rama `cycle-26` (spec eliminada, en el historial de git).

- **Alcance:** solo series de Gym («80 kg press banca 5 reps»). Otros trackers por voz («he corrido 5 km»), en un ciclo posterior; el comando se diseña para poder crecer.
- **V1 Voz:** Web Speech API; un toque en el micro y empieza a escuchar, se para al detectar silencio. Se acepta que el audio pase por Google/Apple, con aviso la primera vez. Sin soporte (Firefox) o sin conexión → campo de texto. El usuario usa **iPhone**: verificar la Web Speech API en la PWA instalada en iOS antes o al principio de la spec.
- **V2 Botón:** en la pantalla Gym y en Inicio/«Hoy».
- **V3 Interpretación:** Haiku 5.5 llamado desde el navegador con una API key que el usuario pega en Ajustes (solo localStorage de ese dispositivo; nunca en repo, build ni copias exportadas). Sin backend. Sin clave o ante cualquier fallo → parser determinista en `core/` (patrón `classifyAI`/`classify`), cubierto por el selfcheck. De momento solo lo usa el propio usuario. Cambia la decisión «IA solo heurística en producción» para este caso. `fetch` frente al SDK (dependencia de runtime): decide el usuario en la spec.
- **V4 Parser:** español e inglés, con sinónimos/alias por ejercicio. Con unidad, gana la unidad; sin unidad, el número mayor es el peso; peso corporal con un solo número → repeticiones. Varias series («3x5», «3 series de 5», «3 sets of 5»). kg por defecto; lbs/libras/pounds se guardan en lbs.
- **V5 Guardado:** guarda directamente y luego se revisa: aviso con lo oído y lo registrado, «Deshacer» de todas las series del comando y «Editar» (deshacer + formulario prerrellenado). Si no reconoce el ejercicio o faltan las repeticiones, no guarda: abre el formulario prerrellenado. Sesión automática y récords como hoy.

**Ejecución:** tech-lead (spec: verificación previa en iPhone/PWA, parser ES/EN en `core/` con asserts nuevos, Haiku 5.5 con clave en Ajustes y structured outputs, guardar y revisar, micro en Gym y «Hoy», tests UI/a11y/e2e con APIs simuladas) → **okay del usuario** (resumen ≤15 líneas + decisiones abiertas) → implementer en `cycle-26` → reviewer (máx. 2 vueltas) → merge `--no-ff` con build/lint/test/e2e → push a `main` → cycle-analyst.

**Decisiones de spec aprobadas (2026-10-12), todas las recomendadas (§13 de la spec):** A `fetch` directo, sin SDK; B prueba en iPhone con `vite preview` + túnel `cloudflared` (o Pages con okay); C plan B en iOS = el botón abre el campo de texto y se dicta con el teclado, solo donde falle según la prueba; D «Borrar todo» no toca la clave; E sin unidad dicha → preferencia del gym (kg por defecto). El usuario pide hacerlo todo seguido y hará la prueba del iPhone al final: T8 (`KEYBOARD_ON_IOS`) se queda en `'never'` con caída al texto tras error de voz hasta que la prueba dé resultado.

**Estado:** **cerrado** (merge 163eb2c, push a origin; análisis en `cycle-26/analysis.md`, en el historial de git). T8 (`KEYBOARD_ON_IOS`) pendiente de la prueba del usuario en iPhone, ya posible en la PWA de Pages (checklist en `docs/DEPLOY.md`). El workflow vuelve a pausa.

## Ciclo 25 — Gym: progreso, volumen, rutinas y «Hoy»

Aprobado directamente por el usuario el 2026-10-12 a partir de las pospuestas del ciclo 24 (pasos 1-2 omitidos): **P24.7** progreso por ejercicio (mejor 1RM estimado por semanas), **P24.8** volumen semanal por grupo muscular, **P24.10** rutinas/plantillas, **P24.12** gym en el bloque «Hoy», y la **deuda de sesiones del ciclo 24** (los dos `ponytail:`: deshacer la manual con series vivas; `restoreLast` con copia sin gym). Para la deuda, el tech-lead propone el comportamiento y se pregunta al usuario. Siguen vigentes D1-D8 del ciclo 24 (sin party, XP sin cambios, sin dependencias de runtime, paleta HERO).

No aprobadas en este ciclo: P24.6 (nivel Gym), P24.9 (sobrecarga), P24.11 (temporizador) siguen pospuestas; P3.5 y P13.4 sin cambios.

Decisiones de spec aprobadas (2026-10-12), todas las recomendadas: la sesión automática se recrea al deshacer/«−» con series vivas, también al importar y fusionar; «Recuperar» con copia sin gym conserva las series y recrea sesiones con aviso; las rutinas se fusionan (conflicto → local + aviso); «Hoy» muestra «Gym · N series · M ejercicios»; «Volver» desde Gym abierto desde «Hoy» → Inicio con foco en «Hoy».

**Estado:** **cerrado** (merge 0766842, push a origin; análisis en `cycle-25/analysis.md`, en el historial de git). El workflow vuelve a pausa hasta que el usuario lo reactive.

## Ciclo 24 — Módulo Gym (preparado)

Decisiones vigentes del usuario (2026-10-12), no se reabren. Algunas frases del encargo llegaron truncadas; donde se indica «(interpretación)» es la lectura del orquestador, y lo no cubierto lo decide el tech-lead o se pregunta.

- **Objetivo:** módulo de gimnasio de desarrollo personal (ejercicios, pesos, repeticiones). **Nada de party** en el módulo (ni criterios, ni ranking, ni propuestas).
- **D1 Tracker «gym»:** el «+1 sesión» manual se mantiene. Registrar ≥1 serie en un día registra automáticamente la sesión de Gym de ese día; como mucho una automática por día y sin duplicar si ya hay sesión manual. El tech-lead define qué pasa al deshacer todas las series del día y con días pasados (selector de día).
- **D2 XP:** sin cambios. La XP del gym sigue viniendo solo de las sesiones del tracker «gym»; el módulo no da XP propia. No se cambian reglas de juego.
- **D3 Datos:** modelo, persistencia, export/import/fusión (`merge.ts`) y migración los decide el tech-lead respetando la arquitectura (eventos inmutables, derivados nunca guardados, correcciones/deshacer como eventos, `storage.ts` única capa, validación y backups como el resto de claves). Las copias antiguas sin datos de gym deben seguir importándose y fusionándose.
- **D4 Navegación:** pantalla nueva «Gym» (paleta HERO, interpretación). Sección nueva «Yo» en la navegación principal con una tarjeta «Gym» que lleva a esa pantalla; «Yo» es el sitio para futuros módulos personales (interpretación). El tech-lead decide cómo encaja en BottomNav (hoy 5 pestañas) sin romper a11y ni móvil.
- **D5 Unidades:** kg y lbs, kg por defecto, preferencia del usuario (interpretación). Se permiten decimales. Cambiar la preferencia no altera los datos registrados, solo cómo se muestran. Botones −/+ del peso con salto de 2,5 (el salto en lbs lo decide el tech-lead, interpretación).
- **D6 Producción:** tras el merge, push a `main` (despliega a Pages).
- **D7:** sin dependencias de runtime nuevas.
- **D8:** paleta HERO (clara) en la pantalla Gym; seguir `docs/STYLE_GUIDE.md`.

**Alcance aprobado (núcleo):** G1 catálogo de ~20-25 ejercicios predefinidos por grupo muscular + ejercicios propios; cada uno con carga o de peso corporal (lastre opcional). G2 registrar series (peso × repeticiones) en el día del selector (sin futuro); formulario prerrellenado con la última serie del ejercicio y botón «Repetir serie». G3 sesión del día con lo registrado ese día y «Deshacer» por serie. G4 récords personales derivados (peso máximo, mejor 1RM estimado Epley, más repeticiones con un peso) con aviso al batir récord (toast/liveText). G6 sesión diaria automática (D1). Unidades (D5), pantalla y sección «Yo» (D4).

**Fuera de alcance (registrar como propuestas pospuestas P24.x):** nivel Gym propio (nivel de fuerza por ejercicio con 1RM/peso corporal, tablas Novato…Élite, nivel global por ejercicios clave o DOTS, alternativa por volumen; requiere registro de peso corporal —dato de salud— y cambia reglas de juego: necesita okay explícito); G5 progreso por ejercicio (mejor 1RM estimado por semanas); G7 volumen semanal por grupo muscular; G8 sugerencia de sobrecarga progresiva; G9 rutinas/plantillas; G10 temporizador de descanso; integración con el bloque «Hoy» (interpretación).

**Ejecución:** strategist → evaluator → **okay del usuario** (resumen ≤15 líneas) → tech-lead (`docs/TECH_SPEC-gym.md`, asserts nuevos en selfcheck: 1RM/récords, kg/lbs, sesión automática sin duplicados, deshacer, fusión; tests UI/a11y) → implementer en `cycle-24` → reviewer (máx. 2 vueltas, después se pregunta) → merge `--no-ff`, build/lint/test/e2e, push → cycle-analyst (actualiza `ESTADO-ACTUAL.md` con Gym y «Yo»; CLAUDE.md/AGENTS.md si cambia core/storage).

**Aprobado por el usuario (2026-10-12, paso 3):** P24.1, P24.2, P24.3, P24.4 y P24.5 con los cambios de `cycle-24/evaluation.md`; orden P24.1 → P24.2 → P24.4 → P24.3 (recorte de P24.5 si hace falta). Decisiones:
- BottomNav con **6 pestañas** («Yo» como sexta), con e2e a 320 px sin etiquetas truncadas.
- Sesión automática como **evento real** con id y hora fijos por día (`gym-auto-<día>`), deduplicada por `merge.ts`; cuenta como una sesión manual (XP, racha, ranking, votación).
- Manual en un dispositivo + series en otro el mismo día → al fusionar se **aceptan 2 sesiones**.
- Salto −/+ de **2,5 kg / 5 lbs**; catálogo de 21 ejercicios **sin plancha**.
- P24.6-P24.12 pospuestas.

**Estado:** **cerrado** (merge 4da4d02, push a origin; análisis en `cycle-24/analysis.md`, en el historial de git). El workflow vuelve a pausa hasta que el usuario lo reactive.

## Decisiones vigentes del usuario

- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1` y textos «demo»: no se renombran de momento.
- Push de `main` a origin tras cada ciclo cerrado; nunca force-push ni otras ramas. Commits con el email noreply de GitHub; reescribir el historial solo con okay del usuario.
- Despliegue: GitHub Pages (repo público); entorno `github-pages` limitado a `main` (2026-10-12).
- Sincronización: opción A, sin servidor («Importar y fusionar» + compartir copia). Worker/servidor descartado por ahora (RGPD art. 9).
- IA: solo heurística en producción, sin endpoint; el proxy solo en `npm run dev`. Excepción en el ciclo 26 (voz): Haiku con la clave del usuario guardada en el dispositivo (V3).
- Balance de XP: se deja como está. PARTY: sigue simulada (2026-10-12).
- Límite VILLAIN (2026-10-12): opcional y sobrepasable; pasarse solo avisa (sin efecto en XP, niveles, rachas ni party). Solo semana en curso, aviso solo en la tarjeta, avisa al pasarse (no al llegar), se edita en la tarjeta.

## Propuestas no implementadas

| id | título | estado |
|---|---|---|
| P3.5 | Cuentas + sincronización (partir en a/b) | pospuesta |
| P24.6 | Nivel Gym propio (requiere peso corporal y cambia reglas de juego) | pospuesta |
| P24.9 | G8 Sugerencia de sobrecarga progresiva | pospuesta |
| P24.11 | G10 Temporizador de descanso | pospuesta |
| P13.4 | Endpoint de IA en servidor | no aprobada (2026-10-12: sin endpoint) |
