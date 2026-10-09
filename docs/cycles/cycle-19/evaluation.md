# Evaluación — ciclo 19

Código revisado: `deploy-pages.yml`, `ci.yml`, `storage.ts`, `App.tsx` e `index.html` en `main`, y `TECH_SPEC-pwa-y-e2e.md` (ciclo 14, en curso en `cycle-14`). Las afirmaciones de las propuestas sobre el código son correctas: el despliegue es solo `workflow_dispatch`, no hay ningún listener de `storage` y `index.html` solo tiene `<title>`.

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P19.1 | APROBAR CON CAMBIOS | S | medio | El paso manual existe y se olvida. Pero el deploy no espera al e2e (es otro workflow) y cada push deshace un kill switch activo. |
| P19.2 | APROBAR CON CAMBIOS | S | bajo-medio | Pérdida silenciosa real (PWA y pestaña comparten localStorage en Android y escritorio). Hay que acotar los efectos secundarios de `loadAll`. |
| P19.3 | APROBAR (menor) | XS | bajo | Hueco real y barato. Toca `index.html`, igual que el ciclo 14: hacerlo después del merge. |

## Cambios pedidos

**P19.1**
1. **El e2e tiene que ir dentro de `deploy-pages.yml`.** Hoy el job solo pasa lint, test y build, y el ciclo 14 mete el e2e en `ci.yml`, que corre en paralelo y no bloquea nada. Hay que añadir `npx playwright install --with-deps chromium` y `npm run e2e` antes del build. No vale con `workflow_run`: es más complejo.
2. **Saltar el e2e cuando se despliega el kill switch** (`if: ${{ !inputs.sw_kill }}`). En una emergencia, un e2e que falla con el build roto impediría publicar el kill.
3. **Filtro `paths`** (`app/**`, `.github/workflows/deploy-pages.yml`). Casi todos los push de cierre son solo `docs/`, y así no se redespliega por ellos. Además evita que un push de docs reactive el service worker estando el kill switch activo.
4. **Explicarlo en `DEPLOY.md`:** con el kill switch activo, el siguiente push a `main` que toque `app/` vuelve a registrar el service worker, así que tiene que llevar el arreglo. `concurrency: cancel-in-progress` puede cancelar un despliegue del kill switch que esté en curso si entra un push: no hacer push mientras tanto.
5. Comprobar que en un push `SW_KILL` queda vacío, con un `echo` en el log del primer despliegue automático.
6. Partir del `deploy-pages.yml` que deje el ciclo 14, que cambia el `on:`. Empezar solo después del merge.

**P19.2**
1. Filtrar por `e.key` en {`life-rpg-demo-v1`, `life-rpg-custom-v1`, `null`}. `null` es `clear()`. Así se ignoran `.backup.*` y `meta`. Para la otra pestaña, `backupCurrent`/`restoreLast` solo son dos escrituras de claves principales más: `restoreLast` escribe primero una y luego la otra, la pestaña puede leer un estado intermedio, y como `loadAll` relee las dos claves en cada evento, se corrige solo.
2. Al recibir un evento, actualizar también `canRestore` (`hasLastBackup()`) y `lastExport` (`loadLastExport()`). Si no, «Recuperar copia anterior» y el aviso de copia se quedan desfasados respecto a la otra pestaña.
3. Si `loadAll` devuelve `problems`, mostrar `noticeFor` y no machacar el estado. Si no hay problemas, no borrar el aviso que ya se esté mostrando. Decidir si, cuando una clave bloqueada (`locked`) vuelve a leerse bien, se llama a `unlockStorage()`.
4. El rebote está acotado: `setItem` con el mismo valor no lanza el evento `storage`. Aun así, `readCustom` puede reordenar claves y provocar un único rebote. Hay que confirmarlo en el test (que no haya bucle) en lugar de añadir guardas.
5. Si el usuario «Deshace» o «Borra todo» en una pestaña, la otra lo replica, y es lo correcto. No se lanzan toasts ni level-ups por los cambios que llegan de otra pestaña.
6. Añadir `ponytail:` sobre la ventana que queda: dos escrituras en menos de lo que tarda el evento siguen perdiendo una.
7. No interactúa con el service worker (no accede a localStorage). Si conviven dos builds en dos pestañas, P13.1 ya conserva las claves desconocidas. En iOS el problema no existe, porque la app instalada tiene su propio almacenamiento.
8. Test: escribir en `localStorage` y luego hacer `dispatchEvent(new StorageEvent('storage', { key }))`, porque happy-dom no lo dispara solo. Esperar con `vi.waitFor`.

**P19.3:** `og:url` y `og:image` con la URL absoluta de Pages escrita a mano, con un `ponytail:` (si se renombra el repo, hay que cambiarlo). Usar `icon-512.png`.

## Ciclo recomendado

Orden: **P19.2 → P19.1 (+ P19.3 como menor)**, todo después del merge del ciclo 14.
**Ciclo 19 = P19.2 + P19.1 + P19.3.** Las tres son S o menos y no se pisan (`App.tsx`, el workflow e `index.html`). Si hay que recortar, P19.2 sola, porque es la única que evita pérdida de datos.
