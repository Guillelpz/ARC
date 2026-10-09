# Review ciclo 20

Veredicto: APROBADO

build, lint, `npm test` (87) y `npm run e2e` (3): todo verde sobre cycle-20.

## Hallazgos

### menor
1. `.github/workflows/deploy-pages.yml` (paso Humo, `cmp -s - dist/sw.js`): comparar `sw.js` byte a byte es la única parte frágil (falso rojo si el CDN o un proxy lo transforma, p. ej. saltos de línea o compresión). Más simple y robusto: comparar solo la primera línea, que lleva `BUILD_ID`, `ASSETS` y `KILL` (distingue build y kill switch): `[ "$(curl -fsS "${url}sw.js?smoke=..." | head -1)" = "$(head -1 dist/sw.js)" ]`. El `assets/index-*.js` ya prueba el build; esto prueba además el modo kill. No bloquea: Pages sirve los bytes tal cual.
2. `App.tsx` (`restoreLast` → `setStale(false)`): `restoreLast` solo desbloquea las claves que tienen copia; `lockStorage` bloquea ambas. Caso raro (copia con una sola clave): el banner desaparece y la otra clave sigue bloqueada sin aviso. Corrección: `unlockStorage()` en App tras `restoreLast` correcto, o no ocultar el banner si queda clave bloqueada.
3. `App.tsx` `reset()` con el banner activo: «Borrar todo» ejecuta `backupCurrent` (copia los datos ilegibles a `.backup.last` y rota la copia buena a `.prev`) y luego no guarda nada. Es seguro, pero la copia buena pasa a `.prev`. Aceptable; considerar saltar el borrado si está bloqueado.
4. Smoke usa `${url}sw.js`: depende de que `page_url` termine en `/` (en Pages de proyecto es así). Documentado de forma implícita; sin acción.

## Puntos pedidos
1. P20.2: `lockStorage` solo se llama en `onStorage` (storage.ts:92, App.tsx onStorage); al arrancar no se usa, así que recargar no deja bloqueo (el `locked` es de módulo y se reinicia). Ningún camino de guardado escribe con la clave bloqueada (`saveEvents`/`saveCustom` devuelven null). Banner fijo (`UpdateBanner`, `fixed`) fuera de las pantallas, visible en todas. Desaparece al: recargar, otra pestaña con datos válidos, importar, recuperar copia; los dos primeros con test (`U-pestañas`, `U-pestañas-bloqueo`, ambas claves).
2. Humo: va tras `deploy-pages`, así que no bloquea el kill switch; también corre con `sw_kill`; sale con `exit 1` y `::error::` (job rojo); 5 reintentos con `?smoke=run-i`. Ver menor 1 para la comparación de `sw.js`.
3. CRLF: el `BUILD_ID` es un hash de los ficheros de `dist` (vite.config.ts) y el `sw.js` conserva los saltos de línea de la plantilla. Solo afecta a una comparación local del humo contra producción; el build de producción es de CI (Linux, LF), así que no hay efecto real. `.gitattributes` (`* text=auto eol=lf`) es opcional: útil por higiene, no necesario para este ciclo. Con la comparación de la primera línea (menor 1) el problema desaparece también en local.
4. DEPLOY.md: «Volver atrás» (revert + push como principal; re-run de la última ejecución verde con aviso de 30 días y de que el siguiente push republica HEAD; `sw_kill`; qué hacer con humo rojo) y checklist del usuario (entorno `github-pages` limitado a `main` como protección real, ruleset sin PR obligatorio ni status checks para no bloquear el push directo, Pages en «GitHub Actions») son correctos. El `if: github.ref == 'refs/heads/main'` está bien marcado como cosmético. Antes de mergear, el usuario debería marcar la primera casilla, porque este merge despliega.
5. Comandos: ver arriba.

## Exceso
Ninguno.

## Segunda vuelta (orquestador)

Commit c4af313: humo compara la primera línea de `sw.js`; con el banner stale, «Borrar todo», «Importar» y «Recuperar» se bloquean y piden recargar. Gate en verde (87 tests, e2e 3/3). APROBADO.
