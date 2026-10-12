# Evaluación — ciclo 24 (Módulo Gym)

D1-D8 y el alcance núcleo no se reabren. Lo comprobado en el código coincide con lo que dicen las propuestas: `trackers.ts:5` (gym, 30 XP, objetivo 4), `party.ts:6` («Los del Gym» con `gym` en `seedCriteria`), `BottomNav.tsx` (`grid-cols-5`, `min-h-14`, `text-xs`, «VILLAIN» como etiqueta más larga) y `Screen` como unión cerrada. Hay un detalle que las propuestas no mencionan: en `merge.ts:17,34`, un evento con el mismo id y el mismo contenido (`trackerId`, `amount`, `occurredAt`) se descarta como duplicado. Cuando el id coincide y cambia algo más, se añade como `id~n`, y cuando el id es distinto, se añade siempre.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P24.1 | APROBAR CON CAMBIOS | M-L (no M) | medio-alto | Es la base de todo. Abre una clave nueva con validación, backup y fusión, y además hay ejercicios propios con su propia fusión |
| P24.2 | APROBAR CON CAMBIOS | S-M | medio | Bien planteada. La fusión entre dispositivos tiene una solución barata con id determinista |
| P24.3 | APROBAR CON CAMBIOS | M | bajo-medio | Correcta. La forma de la navegación hay que preguntarla antes de la spec, no después de implementar |
| P24.4 | APROBAR | S | bajo | La lista cerrada evita divergencias. Sin la plancha quedan 21, dentro de G1 |
| P24.5 | APROBAR (como plan, no como entregable) | S | bajo | El orden y el recorte acordado de antemano son sensatos |
| P24.6-P24.12 | POSPONER | — | — | Están fuera del núcleo según STATE.md |

## Cambios pedidos

- **P24.1:** cada serie guarda `weight` + `unit` tal como se registró (sin canónico redondeado), y la conversión solo se hace al comparar y al mostrar. Los ejercicios del catálogo usan ids estables, y los propios siguen el patrón de los trackers custom (`custom-…`, archivar, nunca borrar). La fusión de series reutiliza la regla de `merge.ts` (id + contenido, `~n`, reasignar el deshacer) y no inventa una nueva. Epley se calcula solo con reps ≤ 12 y peso > 0. Si se registra la primera serie de un ejercicio o se deshace una serie, no hay aviso. Hacen falta asserts para una copia antigua sin la clave gym, tanto al importar como al fusionar.
- **P24.2:** recomendamos la opción (a), un evento `gym` real con **id y `occurredAt` deterministas** (p. ej. `gym-auto-<día>`, `<día>T12:00:00`). Así, si dos dispositivos registran series el mismo día, la fusión deja una sola sesión gracias a la regla `same` y no se cuentan 60 XP. Solo se emite si ese día no hay ya una sesión manual y nunca ha existido una automática, lo que evita bucles con el «−» y colisiones de id. Si se deshacen todas las series del día, se emite un −1 con `undoes` sobre la automática, salvo que haya un «+1» manual. La opción (b), sesión derivada, obliga a inyectar eventos sintéticos antes de `deriveGame`, `history`, `todaySummary` y `clampAmount`, y con un «−» previo deja días en negativo. Esta propuesta debe incluir un assert de fusión con dos dispositivos.
- **P24.3:** la navegación se decide antes de que entre el tech-lead (ver abajo). En la pantalla Gym, el botón atrás tiene que ser visible y el foco debe volver a «Yo». Hace falta un e2e a 320 px que compruebe que ninguna etiqueta se trunca.
- **P24.5:** reservar desde ya rangos de ids de asserts libres (Grep) y mantener la checklist a 320 px en móvil real antes del push.

## Decisiones que requieren al usuario (en el resumen de okay)

1. **BottomNav:** (A) 6 pestañas con etiquetas cortas (~53 px cada una a 320 px; «VILLAIN» queda justa), o (B) «Yo» ocupa el sitio de «Nuevo» y «Nuevo» pasa a abrirse desde HERO/VILLAIN, lo que cambia una navegación que ya existe. Recomendación: A si el e2e de anchura pasa, y B como plan de reserva ya aprobado.
2. **Sesión automática:** (a) evento real con id determinista (recomendado) o (b) derivada. En los dos casos, la sesión **mueve XP, racha, objetivo, ranking y votación de «Los del Gym»**, porque es el tracker `gym`. El usuario debe confirmar que esto es aceptable aunque el módulo «no toca party».
3. **Fusión:** con (a) y un id determinista no se duplica la XP. Lo que sí queda como dos sesiones legítimas es el caso de un «+1» manual en un dispositivo y series en otro el mismo día (son ids distintos). Hay que confirmar si se acepta o si se quiere un máximo de 1 sesión por día en total (eso sí sería un cambio de regla).
4. Salto de 5 lbs en los botones −/+ y exclusión de la plancha del catálogo: basta con confirmarlo.

## Ciclo recomendado

Ciclo 24 = P24.1 → P24.2 → P24.4 → P24.3, con P24.5 como plan y recorte (los ejercicios propios solo se crean y archivan; el aviso de récord sale solo por `liveText`). Si al terminar P24.1 + P24.2 se ha consumido más de la mitad del ciclo, se aplica el recorte y no se añade nada más.
