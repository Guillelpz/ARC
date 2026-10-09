# Evaluación — ciclo 13

He contrastado las propuestas con `main` y con `storage.ts` de la rama `cycle-11`. El ciclo 13 va después del 11 y del 12.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P13.1 | APROBAR CON CAMBIOS | XS | bajo | Es real, pero más pequeño de lo que dice. Es la condición previa para el primer despliegue. |
| P13.2 | APROBAR CON CAMBIOS | S | bajo-medio | Es la pieza de más valor. Antes, el usuario tiene que tomar 3 decisiones. |
| P13.3 | POSPONER (ciclo 14) | M | medio | Tiene valor, pero no puede ir antes de comprobar el primer despliegue. El diseño de la caché tiene huecos. |
| P13.4 | POSPONER | M (no S-M) | medio | Depende por completo de decisiones del usuario sobre cuenta, key, gasto y privacidad. |
| P13.5 | POSPONER (ciclo 14, con P13.3) | M | bajo | Su valor está en probar sin red y la ruta base, y eso requiere P13.3 y P13.2. |

## Cambios pedidos y decisiones

**P13.1.** La propuesta se equivoca en esto: `readEvents` ya conserva los campos desconocidos, porque guarda el propio `e` (`storage.ts:27`). También los conservan los trackers (`{ ...t }`) y las propuestas (`filter`). Solo se pierden las **claves de primer nivel** de `custom`. `App` ya hace `...c` al cambiar el estado, así que basta con copiar las claves desconocidas en `readCustom` y añadir 1 test. Hay que hacerlo después de mergear el ciclo 11, porque toca la misma función. Hay que dejar un `ponytail:` con el límite: una versión anterior conserva `goalLog`, pero si cambia un objetivo no lo apunta. Tiene que estar en el primer despliegue, porque las versiones publicadas antes no tienen la protección.

**P13.2. Decide el usuario:**
1. **Repo remoto:** crearlo y hacer push (hoy no existe y el job no se puede probar sin él).
2. **Proveedor.** Con GitHub Pages gratis, el **repo tiene que ser público**: se ve todo el código y `docs/`. La key está a salvo porque `*.local` está en `.gitignore`. Hay que activar Settings → Pages → «GitHub Actions» y fijar `base: '/<repo>/'`. Con Cloudflare Pages (gratis, también con repo privado) se crea una cuenta y se conecta el repo en el panel, y Cloudflare hace el build sin ningún job. Es la única opción que deja abierta P13.4. **Recomiendo Cloudflare** si P13.4 puede llegar algún día. Si no, GitHub Pages.
3. **Privacidad.** Los datos siguen solo en el navegador de cada persona. No hay servidor, así que no hace falta aviso legal, pero la URL es pública. Lo que hay en `localhost` no se traspasa solo: hay que Exportar y luego Importar.

Cambios: `deploy` con `needs: check` y `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` (solo con GitHub Pages). El proxy de Vite no cambia: sigue en dev y preview. Comprobar a mano que, desplegada, «Nuevo» pasa a la heurística sin esperar los 8 s (un 404 o un 405 lo consiguen, `classify.ts:79`). La propuesta cita `classify.ts:11`, pero el fallback está en `:88`.

**P13.3 (para el ciclo 14).** La propuesta no resuelve el riesgo de servir versiones viejas, que está en estos puntos:
- Un `public/sw.js` estático no conoce los nombres con hash ni cambia entre builds. Así, el navegador nunca ve una versión nueva y el aviso no salta. Además, sin red, el `index.html` cacheado puede apuntar a assets que no están en caché, y la pantalla sale en blanco. **Cambio:** generar `sw.js` en el build con un plugin de ~15 líneas en `vite.config.ts` (sin dependencia) que escriba un `BUILD_ID` y la lista de `assets/`. Al instalar, se precachea todo junto. Al activar, se borran las cachés con otro `BUILD_ID`.
- `index.html` va primero a la red, así que al recargar con conexión siempre llega la última versión. El aviso solo cubre las pestañas o PWAs que llevan días abiertas. Va en un bloque visible: no sirve el `role="status"` `sr-only` de `App.tsx:210`.
- El registro solo se hace con `import.meta.env.PROD`. Si en dev se instala un service worker, cachea el servidor de Vite.
- **Kill switch documentado:** si se publica un service worker roto, se despliega un `sw.js` que borra las cachés y llama a `registration.unregister()`. Hay que ajustar el scope y el `start_url` al `base`.
- **iOS:** la app añadida a la pantalla de inicio tiene su propio almacenamiento, distinto del de Safari. El usuario que instala la app la ve vacía hasta que importe su copia. Hay que decirlo en «Tus datos». Los iconos tienen que ser PNG de 192 y 512, más `apple-touch-icon` de 180.

**P13.4. Decide el usuario:**
- Cuenta de Cloudflare: P13.2 tiene que estar en Cloudflare Pages.
- Una **key de Anthropic de producción**, distinta de la de `.env.local`, en un **workspace propio** con un **límite de gasto mensual**. Por ejemplo, 5 €: a unos 0,001 € por clasificación con Haiku son miles de usos. La key se guarda como secret de la función.
- Que el endpoint sea anónimo: cualquiera puede agotar el límite, y entonces la IA deja de funcionar para todos y la app usa la heurística.
- **Privacidad:** el texto que escribe el usuario, que puede ser un vicio, y los nombres de sus actividades salen del dispositivo y llegan a Anthropic. Hay que avisar en «Nuevo» antes de la llamada.

Coste M. El proxy de Vite reenvía el cuerpo tal cual y no puede convertir `{text, trackers}` en la petición completa. Para mantener la IA en local hay dos opciones: un middleware en `configureServer` que reutilice el mismo código que la función, o usar `wrangler pages dev`, que es una dependencia de desarrollo.

**P13.5.** Va en el ciclo 14 junto con P13.3, contra `vite preview` y con el `base` de producción. Su prueba de más valor es «recargar sin red tras la primera visita».

## Ciclo recomendado

**Ciclo 13 = P13.1 + P13.2.** Las dos son pequeñas y la primera es requisito de la segunda. P13.1 se implementa en cuanto se mergee el ciclo 11. Con P11.4 (ciclo 12) no chocan: esa propuesta toca la home, y estas tocan `storage.ts`, `ci.yml` y `vite.config.ts`. Antes de empezar, el usuario tiene que crear el remoto y elegir proveedor. **Ciclo 14 = P13.3 + P13.5**, después de comprobar en el móvil el primer despliegue. P13.4 queda pendiente de las decisiones de arriba.
