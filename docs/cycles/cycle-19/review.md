# Review ciclo 19

Veredicto: **APROBADO**

Comprobado en `cycle-19`: `npm run build`, `npm run lint` (--deny-warnings), `npm test` (86 tests) y `npm run e2e` (3/3) en verde. `dist/index.html` contiene las dos URLs OG absolutas intactas; `icon-512.png` y `manifest.webmanifest` siguen en `dist`.

## Bloqueantes
Ninguno.

## Importantes
Ninguno.

## Menores
1. `.github/workflows/deploy-pages.yml:26-35` (kill switch): con `sw_kill` se salta el e2e, pero lint y `npm test` siguen siendo puerta. Si un test roto es la causa de la emergencia, el kill queda bloqueado. Aceptable (el spec solo pide saltar el e2e); valorar `if: ${{ !inputs.sw_kill }}` también en lint/test si se quiere un kill de verdad incondicional.
2. `docs/DEPLOY.md`: `workflow_dispatch` puede lanzarse desde cualquier rama; si el entorno `github-pages` no restringe ramas, un dispatch desde una rama publicaría sin pasar por main. Opcional: restringir ramas del entorno.
3. `app/src/App.tsx:67-81`: tras un evento con problemas se muestra el aviso pero el estado local sigue siendo el viejo y el siguiente guardado pisará el dato dañado de la otra pestaña. Es lo que pide el spec (el original queda en `.backup.<stamp>`), anotado con `ponytail:`.

## Verificación de los puntos pedidos
1. Workflow: `push` a main con `paths` y `workflow_dispatch` con `sw_kill` correctos. En push `inputs` es nulo, así que `!inputs.sw_kill` es true (e2e se ejecuta) y `SW_KILL` queda `''` (el config solo activa con `'1'`). e2e va antes del build y el build final sobrescribe el `dist` del e2e. Permisos mínimos y concurrency sin cambios. No hay camino en que un push publique sin e2e; el único salto es el dispatch con `sw_kill`, intencionado. El kill switch no queda bloqueado por el e2e (ver menor 1 para lint/test). Un push posterior al kill lo revierte: documentado.
2. Evento `storage`: filtra por `isDataKey` (KEY, CUSTOM_KEY, null); ignora `.backup.*`; META solo actualiza `lastExport`. Con `problems` no toca `events`/`custom`; sin problemas llama `unlockStorage()` y sustituye el estado. `setItem` con el mismo valor no emite `storage`, y el test comprueba que no hay bucle (<=1 escritura, mismo valor). `canRestore`/`lastExport` se actualizan antes de la rama de problemas. El cleanup del listener es correcto y `[]` es válido.
3. OG: URLs absolutas con `/ARC/`, coherentes con `BASE_PATH`; Vite no las reescribe; build y manifest intactos.

## Corrección del orquestador

Menor 1 corregido antes del merge: con `sw_kill` también se saltan lint y test, para que nada bloquee el kill switch.
