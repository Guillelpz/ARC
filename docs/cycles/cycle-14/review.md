# Review ciclo 14 (PWA y e2e)

Veredicto: **APROBADO**

Ejecutado sobre cycle-14: `build`, `lint` y `npm test` (85 tests) en verde. `npm run e2e`: E1, E2 y E3 pasan (3/3). `dist/index.html` con `BASE_PATH=/ARC/` enlaza `/ARC/manifest.webmanifest` y `/ARC/apple-touch-icon.png`. Dos builds seguidos dan un `sw.js` idéntico (md5 igual). `SW_KILL=1` produce `KILL = true`.

## Puntos de atención

1. **sw.js.** index.html network-first sin guardar la respuesta; assets cache-first; la lista sale de `dist/` real; limpieza solo de `rpg-life-*`; `skipWaiting` y `clients.claim`; scope `/ARC/` por defecto. `ignoreVary: true` es seguro aquí: solo se consulta para peticiones GET del mismo origen y la clave es la URL completa (con hash de contenido en `assets/`), así que ignorar `Vary: Origin` no puede devolver otra variante. El `caches.match` sin `cacheName` mira todas las cachés del origen, pero otros proyectos de `*.github.io` tienen rutas distintas a `/ARC/…`, así que no hay colisión.
2. **Kill switch.** Funciona aunque el SW viejo tenga index.html cacheado: la revisión de `sw.js` va por red y salta la caché HTTP (`updateViaCache` por defecto), el nuevo SW instala con `skipWaiting`, borra las cachés, se desregistra y navega las ventanas. La página del build kill no registra y desregistra. Sin bucle.
3. **Registro.** Solo PROD; `had` evita el aviso en la primera visita; un único `controllerchange` solo avisa, no recarga. Sin bucles de recarga.
4. **Manifest/iconos/iOS.** Correctos con subruta (rutas relativas, `base` aplicado en index.html). Nota iOS presente.
5. **e2e.** E2 comprueba que fetch offline falla antes de recargar, y exige que el contenido salga de localStorage. E3 filtra serious/critical con wcag2a/aa (incluye contraste). Job `e2e` correcto (Chromium con deps, build con `BASE_PATH` vía webServer, artefacto en fallo). `npm test` no recoge `*.e2e.ts`.
6. **Desviaciones.** `bannerTones.ts` aparte (evita importar de un componente con efectos y respeta el reuso): válida. Selectores de E1 con `getByText(/^\d+ XP$/)` y `+1 sesiones` exacto: válidos, más robustos que la spec. Estilo del botón X: válido.

## Hallazgos

- **bloqueante:** ninguno.
- **importante:** ninguno.
- **menor** `app/playwright.config.ts:13`: `reuseExistingServer` en local puede reutilizar un `preview` viejo sin reconstruir; y `npm run e2e` reconstruye `dist/` con base `/ARC/`, que luego no sirve para un preview en raíz. Aceptable, anotar en DEPLOY o ignorar.
- **menor** `app/sw.js:19`: un fallback `caches.match('./index.html')` sin `ignoreVary`; inocuo (HTML sin crossorigin), por coherencia podría igualarse.
- **menor** `app/public/manifest.webmanifest`: sin icono `maskable`; Android recorta el icono en círculo con margen. Opcional.
- **menor:** no se pudo comprobar que E2 falle sin `ignoreVary` (se acepta lo declarado por el implementer); el aviso de versión nueva no tiene e2e (previsto por la spec, queda en el checklist manual).
