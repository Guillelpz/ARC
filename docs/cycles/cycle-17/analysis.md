# Análisis ciclo 17

## Entregado frente a lo especificado
Todo lo de la spec: `branchWeekly`/`shortDate`/`unitFor` en core con asserts BW1–BW3, bloque «Últimas semanas» (HERO vs VILLAIN, 8 semanas) en la home y singular en el `aria-label` de «Deshacer» (P16.2, P18.2). Review APROBADO a la primera: 0 bloqueantes, 0 importantes. Sin recortes; 85/85 tests.

## Deuda nueva
- menor (sin corregir): leyenda del gráfico en `HomeView.tsx` (~l.180) en un solo flex-wrap; en 390 px puede separar texto y muestra de color. Sin verificar visualmente.
- `ponytail:` nuevos: `branchWeekly` O(trackers·eventos) por render (`stats.ts`); `unitFor` solo singulariza unidades fijas/por defecto (`trackers.ts`).

## Fricción del proceso
Ciclo corto y sin retrabajo. Lo único no cubierto: el checklist manual móvil (390 px) no es verificable por el reviewer, así que queda pendiente para el usuario.

## Huecos y riesgos para el siguiente ciclo
- Despliegue: el repo ya es público (https://github.com/Guillelpz/ARC) pero Pages no está activado; sin endpoint de IA la clasificación desplegada usa solo heurística (P13.4).
- Con datos reales publicados, persistencia solo en localStorage por origen: recordar exportar/importar al cambiar de origen.
- Revisar visualmente el bloque «Últimas semanas» en móvil antes de dar el ciclo por cerrado.
