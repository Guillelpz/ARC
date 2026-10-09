# Análisis ciclo 13

## Entregado frente a lo especificado
P13.1 (conservar claves desconocidas de `life-rpg-custom-v1` al guardar, tests C13–C15) y P13.2 (build para hosting estático: `BASE_PATH`, `__AI_PROXY__`, workflow manual `deploy-pages.yml`, `docs/DEPLOY.md`). Review APROBADO, 82/82 tests. Recortado: no se activa el despliegue ni hay endpoint de IA real (P13.4).

## Deuda nueva
- Menor 1: `npm run build` local con key en `.env.local` da `__AI_PROXY__ = true` (no filtra la key; en producción haría un POST fallido y caería a heurística). Cierre: `command === 'serve'` en `vite.config.ts`.
- Menor 2: `'__proto__'` dentro de `KNOWN` en `storage.ts:32` sin comentario.
- Menor 3: DEPLOY.md no menciona que `favicon.svg` se reescribe con `base`.
- `ponytail:` nuevos: `storage.ts` (desconocidas copiadas sin validar; una versión antigua no las actualiza) y `vite.config.ts` (proxy solo con key, endpoint real P13.4).

## Fricción del proceso
Sin fallos relevantes. Nota de entorno: no existe `app/.env.local` en este equipo, así que la rama con IA nunca se ha ejercitado en local; solo se verificó la heurística.

## Huecos para el siguiente ciclo
- Cerrar el menor 1 antes de activar el despliegue.
- Despliegue sin activar: decidir hosting y si se quiere IA desplegada (P13.4 exige endpoint de servidor, key y límite de uso).
- Probar la clasificación con IA al menos una vez con key real.
