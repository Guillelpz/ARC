# Propuestas — ciclo 3

Se da por hecho: P1.4 (`npm test`), P1.3 (validar + exportar/importar), P1.1 (fecha real) y P1.2 (onboarding vacío + «Cargar ejemplo»). El repo ya está bajo git (`.git/` existe), pero sin remoto (`.git/config` no tiene `url`).

## P3.1 — CI: build + lint + test en cada push (`calidad`)
- Problema: build, lint y `npm test` (P1.4) solo se ejecutan si alguien se acuerda. ESTADO-ACTUAL §5 («Calidad: sin tests automatizados ni CI»). Tampoco hay remoto, así que no existe copia del código fuera de esta máquina.
- Propuesta: crear un remoto (GitHub) y un único workflow `.github/workflows/ci.yml` que, en `app/`, ejecute `npm ci`, `npm run lint`, `npm run build` y `npm test`. NO incluye: despliegue, cobertura, matrices de versiones ni hooks locales.
- Valor: alto (protege todo lo que viene después) / Coste: S / Riesgo: bajo
- Requiere: que el usuario cree o elija el repositorio remoto. Sin dependencias de runtime.
- Depende de: P1.4.

## P3.2 — Pedir almacenamiento persistente y recordar la copia (`deuda`)
- Problema: los datos solo viven en localStorage (ESTADO-ACTUAL §5, «Persistencia»). El navegador puede desalojarlos (Safari borra el almacenamiento de webs no instaladas tras 7 días sin uso), y la exportación de P1.3 solo sirve si el usuario se acuerda de usarla.
- Propuesta: llamar una vez a `navigator.storage.persist()` al arrancar y guardar la fecha de la última exportación en una clave nueva (`life-rpg-meta-v1`; las claves existentes no se tocan). En la home, un aviso discreto si nunca se ha exportado o si la última copia tiene más de N días (N fijo, con `ponytail:`). NO incluye: copias automáticas, backend ni notificaciones.
- Valor: medio-alto (reduce la pérdida de datos real hasta que haya backend) / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: P1.3.

## P3.3 — Zona de datos: «Restablecer demo» deja de ser un botón suelto en la home (`producto`)
- Problema: con fecha real y onboarding vacío (P1.1 y P1.2), el botón «Restablecer demo» (`HomeView.tsx` l. 95-97) borra registros reales con un solo `window.confirm` (`App.tsx` l. 95), y el texto habla de una «demo» que ya no existe. Quedan textos de demo: «Party de ejemplo» (`PartyView.tsx` l. 72).
- Propuesta: agrupar Exportar / Importar / Borrar todo en un bloque «Tus datos» al final de la home. «Borrar todo» ofrece exportar antes de confirmar. Revisar la copy con «demo» que quede tras P1.1 y P1.2, siguiendo el tono de STYLE_GUIDE. NO incluye: pantalla de ajustes nueva, router ni cambios en PARTY.
- Valor: medio / Coste: S / Riesgo: bajo
- Requiere: nada.
- Depende de: P1.2, P1.3.

## P3.4 — Despliegue estático + endpoint de IA en servidor (`infra`)
- Problema: la app no está publicada en ningún sitio y la clasificación con IA solo funciona en local: el proxy vive en `vite.config.ts` (l. 8, `ponytail:`). Desplegada, `classifyAI` siempre cae a la heurística (ESTADO-ACTUAL §4 «IA»).
- Propuesta: publicar el build en un hosting estático con funciones (Vercel, Netlify o Cloudflare, a elegir) y mover el proxy a una única función `/api/claude` con la key como secreto del hosting, un tope de tamaño de entrada y un límite de uso básico. `classify.ts` no cambia (ya llama a `/api/claude` y tiene fallback). NO incluye: cuentas, caché, reintentos ni analítica.
- Valor: alto (primera versión usable por terceros) / Coste: M / Riesgo: medio (endpoint público con una key de pago: hay riesgo de abuso y coste si el límite falla)
- Requiere: elegir hosting y cuenta, y la key de Anthropic en producción con su coste económico. Decisión explícita del usuario (backend mínimo).
- Depende de: P3.1 (recomendado: desplegar solo lo que pasa CI), P1.1.

## P3.5 — Cuentas + sincronización de eventos (`infra`)
- Problema: hay un único usuario local sin cuenta. Los datos no pasan de un dispositivo a otro y se pierden con el navegador (ESTADO-ACTUAL §5 «Usuarios», «Persistencia»). Además, PARTY no puede ser real sin identidades (§5 «Party»).
- Propuesta: login (magic link) con un backend gestionado (p. ej. Supabase) y una tabla `events` por usuario que refleje `ActivityEvent[]`, más los datos custom. Fusión por `id` (los eventos son solo de añadir y las correcciones son eventos, así que no hay conflictos de edición). La app sigue funcionando sin sesión, solo con localStorage. NO incluye: PARTY real, invitaciones ni modo offline avanzado (cola de reintentos más allá de reenviar lo pendiente al volver).
- Valor: muy alto (desbloquea PARTY real y elimina la pérdida de datos) / Coste: L (al límite de un ciclo) / Riesgo: alto (auth, privacidad de datos personales sobre vicios, migración de los datos locales existentes)
- Requiere: dependencia de runtime (cliente del backend), servicio externo y cuenta, y decisión explícita del usuario. Sin cambio de reglas de juego.
- Depende de: P3.1, P3.4 (hosting) y P1.3 (`parse*` para validar lo que llega del servidor).
