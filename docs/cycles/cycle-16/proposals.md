# Propuestas — ciclo 16

Se da por hecho el ciclo 15 (deshacer desde «Hoy» y lint sin warnings). No se repropone el ciclo 14 (PWA + e2e, bloqueado por el despliegue) ni P11.2/P7.2a, P13.4, P15.2 (no aprobadas) o P3.5 (pospuesta). Ninguna de estas propuestas depende del despliegue.

## P16.1 — Tendencia de las últimas 8 semanas por actividad (`producto`)
- Problema: la tarjeta solo compara la semana en curso con el mismo tramo de la anterior (`trackerStats`, `stats.ts:75-86`) y resume el pasado en un número de racha. Después de 13 ciclos acumulando historial, el usuario no puede ver cómo evoluciona una actividad. El dato ya existe en `ActivityEvent[]`, pero no se enseña.
- Propuesta: una función pura `weekly(events, t, today, n = 8)` en `stats.ts` que devuelve, por semana (lun–dom, la actual hasta hoy), `{ monday, total, goal, met }`. Reutiliza `total`, `mondayOf` y `goalAt` (el objetivo vigente en cada semana, la misma regla que la racha, P11.1). En `TrackerCard`, una fila de 8 barras con CSS (alto proporcional al máximo, la semana cumplida marcada con el tono de la rama y la actual diferenciada), con `aria-label` por barra o una tabla accesible oculta. Asserts en `selfcheck` sobre la semilla (totales y `met` coherentes con `streak`) y un test de UI. NO: librería de gráficos, rangos configurables, vista mensual o anual, ni nueva pantalla.
- Valor: alto (es la primera vista de progreso a largo plazo y da sentido a rachas y objetivos) / Coste: S / Riesgo: bajo (solo derivación y presentación; `core/` gana una función sin tocar las existentes)
- Requiere: nada (sin dependencias ni cambios de reglas).
- Depende de: —

## P16.2 — HERO contra VILLAIN semana a semana en la home (`producto`)
- Problema: la home muestra la XP total por rama y la composición % acumulada (ESTADO-ACTUAL §2). Esos números solo crecen, así que no dicen si el usuario va mejor o peor. La pregunta central del juego, si el héroe le está ganando al villano, no tiene respuesta en el tiempo.
- Propuesta: un bloque «Últimas semanas» en la home con la XP neta por semana de cada rama (8 semanas, barras pareadas HERO/VILLAIN con los tokens de cada rama) y una línea de texto («Esta semana: HERO +120 / VILLAIN +40»). Se deriva sumando `weekly()` (P16.1) × `xpPerUnit` por rama. Las archivadas cuentan, igual que en la XP. Un test de UI. NO: nuevos niveles o recompensas, cambios en `deriveGame` ni en los umbrales, ni comparativa con la party.
- Valor: medio-alto (convierte la capa RPG en una tendencia legible) / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: P16.1 (la función de semanas).

## P16.3 — Cerrar los menores del ciclo 13 (`deuda`)
- Problema: `vite.config.ts:20` define `__AI_PROXY__ = !!key` también en `build`. Un `npm run build` local con `app/.env.local` genera un bundle que hace un POST a `/api/claude` que no existe (`cycle-13/analysis.md`, menor 1; ESTADO-ACTUAL §5 «IA»: «no publicar ese build»). Es una trampa que hay que desactivar **antes** de activar el despliegue, y se puede cerrar ya. Quedan además el menor 2 (`'__proto__'` en `KNOWN` de `storage.ts` sin comentario) y el menor 3 (`DEPLOY.md` no dice que `favicon.svg` se reescribe con `base`).
- Propuesta: `__AI_PROXY__` es `true` solo si `command === 'serve'` y hay key. `vite preview` sirve un bundle construido sin IA, y se documenta en una línea. Un comentario en `KNOWN` y una línea en `DEPLOY.md`. Se quita el aviso «no publicar ese build» de ESTADO-ACTUAL. NO: endpoint de IA (P13.4) ni activar el despliegue.
- Valor: medio (quita un riesgo del futuro despliegue y tres menores abiertos) / Coste: S / Riesgo: bajo (con preview se pierde la IA en local; con dev sigue igual)
- Requiere: nada.
- Depende de: —

No se proponen:
- **Purgar los backups con sello `.backup.<stamp>`:** solo se crean cuando hay datos corruptos al cargar, que es raro, y no hay ningún caso observado de cuota llena. Sería especulativo.
- **Ver más de 10 registros en «Últimos registros»:** un error antiguo ya se corrige con el selector de día y la corrección del día (P4.1). La tendencia de P16.1 cubre la necesidad de ver el pasado.
