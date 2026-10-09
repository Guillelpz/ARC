# Análisis ciclo 16

## Entregado frente a lo especificado
- T1 (P16.3): IA solo en `npm run dev`; `preview` sin proxy; textos «dev/preview» corregidos; menores del ciclo 13 cerrados (`__proto__`, nota de `favicon`).
- T2/T3 (P16.1): `weekly()` con asserts W1-W3 y bloque «Últimas 8 semanas» en cada tarjeta (barras, `Check`, borde discontinuo, lista `sr-only`), test U-W1. Nada recortado. P16.2 pasó al ciclo 17 por decisión previa.
- Review: aprobado, 0 bloqueantes, build/lint/test 84/84 estables.

## Deuda nueva
- Menores sin corregir: la leyenda «borde discontinuo» se muestra aunque ninguna semana esté cumplida (cosmético, pedido por la spec); `weekText`/`max` se calculan con el `<details>` cerrado (despreciable).
- `ponytail:` nuevo en `stats.ts`: 8 sumas por tarjeta y render; indexar por semana si se nota. Se reformuló el de `vite.config.ts`.

## Fricción del proceso
- Sin fallos. El coste estuvo en tocar docs duplicados (README, DEPLOY, ESTADO, CLAUDE) para un cambio de texto; la spec los listó bien y el review lo verificó.
- Ediciones simultáneas de docs por otros agentes obligan a `git add` selectivo.

## Huecos para el siguiente ciclo
- Despliegue sigue sin activar y la IA no existe fuera de dev: P13.4 (endpoint) es prerrequisito de cualquier publicación con clasificación IA.
- La tendencia depende de textos de fecha por ICU; el test usa regex, pero un entorno distinto podría variar.
- Persisten las deudas de §5: party simulada, sin backend, persistencia solo local.
