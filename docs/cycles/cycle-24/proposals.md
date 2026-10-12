# Propuestas — ciclo 24 (Módulo Gym)

Alcance y decisiones D1-D8 fijados por el usuario en `docs/cycles/STATE.md` («Ciclo 24 — Módulo Gym»). Estas propuestas no los reabren: ordenan el núcleo aprobado, señalan riesgos y casos borde y registran lo pospuesto. El detalle técnico es del tech-lead.

## P24.1 — Núcleo de datos del gym en `core/` + `storage.ts` (`producto`)
- Problema: hoy el gym es solo un contador de sesiones (`trackers.ts:5`, tracker fijo `gym`, 30 XP/sesión); no hay dónde guardar ejercicios, series ni pesos, y `merge.ts`/export solo conocen eventos y custom.
- Propuesta: primer bloque del ciclo, sin UI: catálogo (G1) + ejercicios propios, series como eventos inmutables con deshacer como evento (G2/G3), récords derivados (G4: peso máximo, mejor 1RM Epley, más reps con un peso) y unidades (D5), todo puro y con asserts en `selfcheck.ts`. Persistencia en una clave propia con validación, backup ante corrupción, export/import y fusión; las copias antiguas sin gym se importan y fusionan igual (D3). Aclaraciones a resolver por el tech-lead:
  - Cambiar la preferencia kg/lbs no reescribe nada: cada serie conserva el peso tal como se registró (o un canónico explícito); los récords comparan en una unidad común y se muestran en la preferida, con redondeo de visualización estable.
  - Salto de −/+ en lbs: propuesta 5 lbs (discos habituales); en kg 2,5 (D5).
  - Peso corporal: «más reps» como récord principal; el lastre opcional cuenta como peso; sin lastre no hay 1RM (Epley con peso 0 no tiene sentido).
  - Epley solo hasta un tope razonable de reps (p. ej. ≤12) o marcado como estimado; la fórmula diverge con muchas reps.
  - Primera serie de un ejercicio: no anunciar «récord» (si no, cada ejercicio nuevo dispara aviso).
  - Deshacer una serie que fijaba un récord: el récord se recalcula (es derivado), sin aviso.
  - Ejercicios propios: crear y archivar; borrar uno con series no debe dejar series huérfanas (archivar en vez de borrar).
- NO: XP propia del módulo, nivel Gym, party, gráficas.
- Valor alto (desbloquea todo lo demás) / Coste M / Riesgo medio (nueva clave de storage y fusión: riesgo de pérdida de datos si la validación falla).
- Requiere: nada (sin dependencias de runtime; sin cambio de reglas de juego).
- Depende de: —

## P24.2 — Sesión automática (G6/D1): casos borde y riesgo de duplicados (`producto`)
- Problema: D1 pide «≥1 serie en un día ⇒ sesión de gym ese día, máx. una automática y sin duplicar la manual». El tracker `gym` alimenta XP, racha, «Hoy», objetivo semanal y además criterios/ranking de party (`party.ts:6`, «Los del Gym»), así que un error aquí se propaga a todo.
- Propuesta: que el tech-lead elija y justifique entre (a) emitir un evento `gym` real marcado como automático, o (b) derivar la sesión del día a partir de las series sin escribir evento. Riesgos que la spec debe cubrir con asserts:
  - Fusión entre dispositivos: con (a), dos móviles que registren series el mismo día generan dos sesiones automáticas con ids distintos; `mergeBackup` las sumaría (2 sesiones, 60 XP). Con (b) no ocurre, pero hay que asegurar que `deriveGame`, rachas, `todaySummary`, `history` y party ven la misma cifra.
  - Deshacer todas las series del día: ¿se retira la sesión automática? Recomendación: sí, salvo que el usuario haya pulsado «+1» ese día.
  - «−» manual en la tarjeta Gym sobre una sesión automática y luego otra serie ese día: no debe reaparecer en bucle ni quedar en negativo (`clampAmount`).
  - Días pasados con el selector: la sesión cae en el día de la serie, nunca en hoy.
  - Sesión manual previa o posterior el mismo día: nunca dos (una manual + una automática).
  - Efecto en party: aunque el módulo no toque party, la sesión automática sí mueve el ranking y la votación simulada por ser el tracker `gym`; es coherente con D2 (la XP sigue viniendo de sesiones), pero debe quedar dicho en la spec.
- NO: XP por serie, más de una sesión automática por día.
- Valor alto / Coste S-M / Riesgo medio (toca XP y rachas indirectamente).
- Requiere: nada (no cambia reglas: 1 sesión = 30 XP como hoy).
- Depende de: P24.1

## P24.3 — Pantalla Gym + sección «Yo» y BottomNav con 6 pestañas (`producto`)
- Problema: `BottomNav.tsx` tiene 5 pestañas en `grid-cols-5` con `min-h-14` y etiqueta de texto; a 320 px una sexta deja ~53 px por pestaña y la etiqueta «VILLAIN» ya es la más ancha. `Screen` es una unión cerrada sin router (`App.tsx`).
- Propuesta: pantalla «Gym» (paleta HERO, `STYLE_GUIDE.md`) con: selector de ejercicio por grupo muscular, formulario peso × reps prerrellenado con la última serie y «Repetir serie», −/+ de peso, sesión del día con «Deshacer» por serie, récords del ejercicio y aviso de récord por `liveText`/toast. Sección «Yo» como pestaña nueva con una tarjeta «Gym». Para la navegación, recomendación en este orden: 6 pestañas con etiquetas cortas comprobadas a 320 px (test axe + e2e de anchura); si no caben sin truncar, alternativa: «Yo» sustituye la posición de «Nuevo» y «Nuevo» pasa a acceso desde HERO/VILLAIN — esta alternativa cambia la navegación existente y se pregunta al usuario antes. Volver de Gym a «Yo» con botón atrás visible (no hay router ni historial del navegador).
- NO: Party en la pantalla, gráficas de progreso, rutinas, temporizador.
- Valor alto / Coste M / Riesgo bajo-medio (a11y y móvil; nada de datos).
- Requiere: nada.
- Depende de: P24.1 (y P24.2 para el texto de la sesión del día)

## P24.4 — Catálogo inicial concreto (~22 ejercicios) (`producto`)
- Problema: G1 pide ~20-25 ejercicios por grupo pero no fija cuáles; sin lista cerrada, implementer y tests divergen.
- Propuesta: lista cerrada en `core/`, ids estables (no se renombran, entran en copias y fusión). Sugerencia: Pecho (press banca, press inclinado mancuernas, fondos*), Espalda (dominadas*, remo con barra, jalón al pecho, peso muerto), Piernas (sentadilla, prensa, zancadas, peso muerto rumano, curl femoral, elevación de gemelos), Hombros (press militar, elevaciones laterales, face pull), Brazos (curl bíceps barra, curl martillo, extensión tríceps polea, press francés), Core (plancha*, elevaciones de piernas*). *peso corporal con lastre opcional. La plancha es por tiempo, no reps: o se excluye o se acepta como reps=segundos; recomendación: excluirla del núcleo para no introducir otra unidad.
- NO: ejercicios por tiempo o distancia, imágenes, instrucciones.
- Valor medio / Coste S / Riesgo bajo.
- Requiere: nada.
- Depende de: P24.1

## P24.5 — Orden de ejecución y recorte de seguridad (`calidad`)
- Problema: el núcleo es el ciclo más grande desde la demo (core + storage + fusión + pantalla + nav); el ciclo 23 recordó que falta validar en móvil real antes de desplegar (`cycle-23/analysis.md`), y todo push a `main` despliega.
- Propuesta: implementar en commits en este orden: P24.1 → P24.2 → P24.4 → P24.3. Recorte acordado de antemano si el ciclo se alarga: ejercicios propios con solo crear/archivar (sin editar) y aviso de récord solo por `liveText` (sin toast propio). Tests: asserts de selfcheck (1RM, récords, kg/lbs, sesión automática sin duplicados, deshacer, fusión incluida copia antigua sin gym), tests UI y axe de la pantalla Gym y del nav, y un e2e que registre una serie y compruebe la sesión en HERO. Comprobar ids de tests libres con Grep (fricción del ciclo 23). Checklist manual a 320 px antes del push.
- NO: nada fuera del alcance aprobado.
- Valor medio / Coste S / Riesgo bajo.
- Requiere: nada (dependencias solo de desarrollo si hicieran falta).
- Depende de: P24.1-P24.4

## Pospuestas (fuera de alcance del ciclo 24)

| id | título | tipo | nota | estado |
|---|---|---|---|---|
| P24.6 | Nivel Gym propio (fuerza por ejercicio con 1RM/peso corporal, tablas Novato…Élite, global por ejercicios clave o DOTS; alternativa por volumen) | producto | Requiere registrar peso corporal (dato de salud) y cambia reglas de juego: okay explícito | pospuesta |
| P24.7 | G5 Progreso por ejercicio (mejor 1RM estimado por semana) | producto | Derivable de P24.1 sin datos nuevos | pospuesta |
| P24.8 | G7 Volumen semanal por grupo muscular | producto | Derivable de P24.1 | pospuesta |
| P24.9 | G8 Sugerencia de sobrecarga progresiva | producto | Depende de P24.7 | pospuesta |
| P24.10 | G9 Rutinas / plantillas | producto | Nuevo dato persistido y en fusión | pospuesta |
| P24.11 | G10 Temporizador de descanso | producto | Timers en segundo plano en PWA: riesgo en móvil | pospuesta |
| P24.12 | Integración del gym con el bloque «Hoy» | producto | Valorar con uso real tras P24.2 | pospuesta |
