# Evaluación — ciclo 3

He comprobado las afirmaciones contra `main`. Son correctas: `.git/config` sin remoto, `App.tsx` l. 95 (`window.confirm`), `HomeView.tsx` l. 97 y `PartyView.tsx` l. 72, y `vite.config.ts` l. 8 (`ponytail:`). Hay que corregir tres cosas:

- La copy de demo también está en `HomeView.tsx` l. 75 («de ejemplo») y l. 94 («Historial de ejemplo · Fecha demo»). P1.1 y P1.2 (ciclo 2) ya tocan esas líneas.
- La afirmación de P3.4 «`classify.ts` no cambia» es **falsa en la práctica**. El cliente envía `model`, `max_tokens`, `system` y `messages` (`classify.ts` l. 73-77). Si la función reenvía el cuerpo tal cual, cualquiera puede usar la key con el modelo y el prompt que quiera.
- La afirmación de P3.5 «sin conflictos» solo vale para los eventos. `reset()` reemplaza todo (l. 96), y `proposals` y `trackers` son estado mutable (l. 87, 91).

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P3.1 | APROBAR CON CAMBIOS | S | bajo | Problema real y barato; sin remoto no hay copia del código. Necesita que el usuario cree el repo. |
| P3.2 | APROBAR CON CAMBIOS (fusionar en P3.3) | S | bajo | El valor real está en el aviso de copia. `persist()` es una petición que el navegador puede ignorar: no garantiza nada en Safari. |
| P3.3 | APROBAR CON CAMBIOS | S | bajo | Hoy «Borrar todo» es un solo clic más `confirm` sobre datos reales. Choca con las líneas que tocan P1.1 y P1.2: va después del ciclo 2. |
| P3.4 | POSPONER (hasta que decida el usuario) | M | medio-alto | Tal como está escrita, deja un relay abierto a la API de pago, y el «límite de uso» en serverless necesita almacenamiento (KV), es decir, otro servicio. |
| P3.5 | POSPONER | L+ | alto | No cabe en un ciclo. Depende de P3.4, no resuelve el borrado entre dispositivos ni el estado mutable, y guarda datos sensibles (vicios) en un tercero. |

## Cambios pedidos

- **P3.1:**
  - Usar `npm ci` con el `app/package-lock.json` existente y `defaults.run.working-directory: app`.
  - Que se dispare en `push` y en `pull_request`, para cubrir también la rama `cycle-1`.
  - Nada más.
  - El usuario decide si el repo es **privado o público**. Los datos semilla y los textos sobre vicios no son secretos, pero `.env.local` debe estar en `.gitignore`: verificarlo antes del primer push.
- **P3.2 → dentro de P3.3:**
  - La fecha de la última exportación se guarda en `life-rpg-meta-v1` mediante `storage.ts`.
  - El aviso va en el bloque «Tus datos», no como banner aparte.
  - `persist()` se llama una sola vez y se ignora el resultado. Incluir una línea `ponytail:` con N días.
- **P3.3:**
  - Implementarla sobre la versión de `reset` que deje P1.2, que vacía en vez de cargar la semilla. Si no, se reabre la decisión de onboarding.
  - «Borrar todo» usa el mismo `confirm` y antes enlaza la exportación. No hace falta un modal nuevo.
  - La copy cubre las l. 75 y 94 de `HomeView` y la l. 72 de `PartyView`, salvo lo que ya haya quitado el ciclo 2.
- **P3.4, si el usuario la aprueba:**
  - La función fija en el servidor `model`, `max_tokens` y `system`, y acepta solo `{ text, trackers }`, con tope de longitud.
  - Por tanto, `classifyAI` cambia (el fallback sigue igual). Quitar la cabecera `anthropic-dangerous-direct-browser-access`.
  - El tope de gasto real lo pone el **límite de gasto del workspace en la consola de Anthropic**. El límite por IP en memoria es solo cosmético.
- **P3.5, si se retoma:** partirla en dos.
  - (a) Auth y subida/bajada de eventos con fusión por `id`.
  - (b) Datos custom, borrado propagado (tombstones o «borrar en servidor») y migración de lo local.

## Decisiones que debe tomar el usuario

- **P3.1:** la cuenta y la visibilidad del repositorio (GitHub u otro).
- **P3.4:** el proveedor de hosting (Vercel, Netlify o Cloudflare) y su cuenta. Una key de Anthropic de producción con **coste por uso** y un límite de gasto. Y aceptar un backend mínimo, lo que exige el okay de `CLAUDE.md`. Si el límite de uso se quiere de verdad, otro servicio (KV) más.
- **P3.5:** el proveedor (Supabase u otro), su cuenta y su plan, la región de los datos y la privacidad (datos de vicios: RGPD y texto legal mínimo), y una dependencia de runtime (cliente). Requiere el okay explícito para cuentas y backend.

## Ciclo recomendado

**Ciclo 3 = P3.1 + P3.3 (con P3.2 integrada).** Las tres son S y de bajo riesgo. Además, CI protege el resto, y «Tus datos» cierra la pérdida de datos que dejan abierta los ciclos 1 y 2.

**Orden:** P3.1 (puede empezar ya, en paralelo al ciclo 2) → P3.3 + P3.2 (después de P1.1 y P1.2) → P3.4 (tras las decisiones del usuario) → P3.5a → P3.5b.
