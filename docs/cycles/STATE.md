# Estado del workflow

Ver `docs/WORKFLOW.md`. Ciclos 1–22 cerrados e implementados; sus specs y documentos de ciclo se eliminaron el 2026-10-12 (están en el historial de git).

## En curso

- Ciclo 23 (P23.1, límite semanal VILLAIN) — **cerrado** (merge e042d2e; análisis en `cycle-23/analysis.md`). Reactivado por el usuario el 2026-10-12 solo para esto; pasos 1-2 omitidos. Fuera de él, el workflow sigue en pausa hasta que el usuario lo reactive con datos de uso real.

## Ciclo 25 — Gym: progreso, volumen, rutinas y «Hoy»

Aprobado directamente por el usuario el 2026-10-12 a partir de las pospuestas del ciclo 24 (pasos 1-2 omitidos): **P24.7** progreso por ejercicio (mejor 1RM estimado por semanas), **P24.8** volumen semanal por grupo muscular, **P24.10** rutinas/plantillas, **P24.12** gym en el bloque «Hoy», y la **deuda de sesiones del ciclo 24** (los dos `ponytail:`: deshacer la manual con series vivas; `restoreLast` con copia sin gym). Para la deuda, el tech-lead propone el comportamiento y se pregunta al usuario. Siguen vigentes D1-D8 del ciclo 24 (sin party, XP sin cambios, sin dependencias de runtime, paleta HERO).

No aprobadas en este ciclo: P24.6 (nivel Gym), P24.9 (sobrecarga), P24.11 (temporizador) siguen pospuestas; P3.5 y P13.4 sin cambios.

**Paso actual:** 4 (tech-lead → `docs/TECH_SPEC-gym-2.md`).

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

**Estado:** **cerrado** (merge 4da4d02, push a origin; análisis en `cycle-24/analysis.md`). El workflow vuelve a pausa hasta que el usuario lo reactive.

## Decisiones vigentes del usuario

- Se puede proponer backend, cuentas y PARTY real; no se implementan sin okay.
- Dependencias de desarrollo libres; las de runtime necesitan okay.
- Claves de localStorage `*-demo-v1` y textos «demo»: no se renombran de momento.
- Push de `main` a origin tras cada ciclo cerrado; nunca force-push ni otras ramas. Commits con el email noreply de GitHub; reescribir el historial solo con okay del usuario.
- Despliegue: GitHub Pages (repo público); entorno `github-pages` limitado a `main` (2026-10-12).
- Sincronización: opción A, sin servidor («Importar y fusionar» + compartir copia). Worker/servidor descartado por ahora (RGPD art. 9).
- IA: solo heurística en producción, sin endpoint; el proxy solo en `npm run dev`.
- Balance de XP: se deja como está. PARTY: sigue simulada (2026-10-12).
- Límite VILLAIN (2026-10-12): opcional y sobrepasable; pasarse solo avisa (sin efecto en XP, niveles, rachas ni party). Solo semana en curso, aviso solo en la tarjeta, avisa al pasarse (no al llegar), se edita en la tarjeta.

## Propuestas no implementadas

| id | título | estado |
|---|---|---|
| P3.5 | Cuentas + sincronización (partir en a/b) | pospuesta |
| P24.6 | Nivel Gym propio (requiere peso corporal y cambia reglas de juego) | pospuesta |
| P24.7 | G5 Progreso por ejercicio (1RM estimado por semanas) | aprobada (ciclo 25) |
| P24.8 | G7 Volumen semanal por grupo muscular | aprobada (ciclo 25) |
| P24.9 | G8 Sugerencia de sobrecarga progresiva | pospuesta |
| P24.10 | G9 Rutinas/plantillas | aprobada (ciclo 25) |
| P24.11 | G10 Temporizador de descanso | pospuesta |
| P24.12 | Integración del gym con el bloque «Hoy» | aprobada (ciclo 25) |
| P13.4 | Endpoint de IA en servidor | no aprobada (2026-10-12: sin endpoint) |
