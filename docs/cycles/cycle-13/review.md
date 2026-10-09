# Review ciclo 13

Veredicto: **APROBADO**

`build` OK, `test` 82/82 OK, `lint` solo warnings preexistentes (App.tsx:58-59). Bundle sin `sk-ant`.

## Hallazgos

### menor
1. `app/vite.config.ts:20` — un `npm run build` local con `ANTHROPIC_API_KEY` en `.env.local` produce `__AI_PROXY__ = true` en un bundle desplegable. No filtra la key (solo entra un booleano), pero en producción cada «Nuevo» haría un POST fallido a `/api/claude` antes de caer a la heurística (el `catch` de `classifyAI` lo cubre, así que no hay pérdida de datos). DEPLOY.md ya avisa («publica siempre el build del hosting»). Corrección mínima si se quiere cerrar: `__AI_PROXY__: JSON.stringify(!!key && command === 'serve')` con `({ mode, command })`; coste: `vite preview` pasaría a heurística. Alternativa: dejarlo documentado, como está.
2. `app/src/core/storage.ts:32` — `KNOWN` incluye `'__proto__'` mezclado con claves de dominio; funciona (`Object.entries` de un JSON.parse devuelve `__proto__` como propia y se omite, test C15). `constructor` y `prototype` se copian como propiedades propias, sin contaminar el prototipo; inocuo. Un comentario de una línea sobre por qué está `__proto__` ahí ayudaría.
3. `docs/DEPLOY.md` — correcto y coherente con `BASE_PATH` (workflow lo fija a `/<repo>/`; Cloudflare sin base; prueba local con `/rpg/`). Opcional: indicar que `favicon.svg` se reescribe con el `base` en el build (Vite lo hace).

## Puntos de atención
1. Seguridad: `define` expone solo un booleano; la key solo va en `headers` del proxy (dev/preview). `deploy-pages.yml` solo `workflow_dispatch`, sin secretos, permisos mínimos para Pages. `ci.yml` (preexistente, `push`/`pull_request`) no forma parte de este diff y no despliega ni usa secretos.
2. P13.1: conocidas ganan (se omiten del bucle y se asignan validadas después); `__proto__` no contamina; tests C13–C15 cubren desconocidas, viaje completo y `__proto__`.
3. `__AI_PROXY__`: dev/preview con key → true; sin key → false (CI y hosting); ver menor 1.
4. DEPLOY.md: pasos correctos.
