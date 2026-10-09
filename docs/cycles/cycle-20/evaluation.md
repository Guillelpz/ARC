# Evaluación — ciclo 20

| id | veredicto | coste | riesgo | motivo |
|---|---|---|---|---|
| P20.1 | APROBAR CON CAMBIOS | S | bajo | El problema existe (`deploy-pages.yml` no tiene guarda de rama ni comprobación posterior), pero el `if` de rama protege menos de lo que dice y «Re-run» no basta como vuelta atrás. |
| P20.2 | APROBAR CON CAMBIOS | S | bajo | La pérdida es real (`App.tsx:75` avisa sin bloquear y el siguiente `save*` pisa la clave). Con el despliegue automático es más probable: una pestaña con la versión vieja y otra con la nueva. Una de las dos variantes propuestas bloquearía para siempre. |
| P20.3 | POSPONER (decisión del usuario; hoy recomiendo la alternativa barata) | S decidir / M-L implementar | alto | Valor real, pero el plan deja datos de vicios en claro en un tercero y aún no tiene definidos el cifrado, el borrado ni los conflictos. |

## Cambios pedidos

**P20.1 — código y workflow (lo hace el implementador)**
- `if: github.ref == 'refs/heads/main'` en el job: se acepta porque es barato, pero es cosmético. Un `workflow_dispatch` lanzado desde otra rama ejecuta el YAML **de esa rama**, que puede no tener el `if`. La protección real es el paso 1 del usuario, y así debe constar en `DEPLOY.md`.
- Humo: con `title` y 200 no se detecta una regresión, y Pages puede servir desde caché la versión anterior durante unos segundos. Hay que comprobar que el `index.html` publicado referencia el mismo `assets/index-*.js` que `app/dist/index.html`, con reintentos (unos 5 × 10 s), y que `sw.js` devuelve 200. Con `sw_kill` también se puede ejecutar, porque no bloquea nada al ir después del deploy. La spec debe decir explícitamente si se ejecuta o no.
- «Volver atrás» en `DEPLOY.md`: el método principal es `git revert <commit>` + push a main, que vuelve a pasar la puerta y despliega. «Re-run all jobs» de una ejecución verde anterior queda como vía rápida, con dos avisos: solo funciona dentro de los 30 días siguientes a la ejecución original, y el siguiente push vuelve a publicar HEAD si no se ha revertido.

**P20.1 — pasos del usuario en GitHub (no son código)**
1. Settings → Environments → `github-pages` → «Deployment branches and tags» → «Selected branches and tags» → Add rule `main`. Cierra el menor 2.
2. Settings → Rules → Rulesets → New ruleset → New branch ruleset: nombre `main`, Enforcement «Active», Target «Include default branch»; marcar «Restrict deletions» y «Block force pushes». **No** marcar «Require a pull request» ni «Require status checks», porque bloquearían el push directo del orquestador.
3. (Opcional, no recomendado de entrada) En el mismo entorno, «Required reviewers» con el propio usuario: cada despliegue espera su clic.
4. Comprobar que Settings → Pages → Source sigue en «GitHub Actions».

**P20.2**
- Bloquear **solo desde `onStorage`** con un `lockStorage(keys)` exportado de `storage.ts`. Que lo haga `loadAll` no sirve: al arrancar con datos reparables nunca se reescribiría lo reparado, cada recarga volvería a encontrar problemas y la clave quedaría bloqueada para siempre.
- La propuesta se equivoca en un punto: el aviso existente **no** pide recargar (`noticeFor`, `App.tsx:25-30`). Con la clave bloqueada, `save*` devuelve `null` y no aparece `SaveFailBanner`, así que lo que se registre se perdería en silencio. Hace falta un texto propio, del tipo «Otra pestaña ha guardado datos que esta no puede leer. Recarga para seguir; lo que registres aquí no se guardará».
- Test en `App.test`: evento `storage` con datos con problemas → registrar → la clave conserva lo de la otra pestaña y se muestra el aviso. Un evento limpio posterior desbloquea (`unlockStorage`, como hoy).

**P20.3 — datos para que decida el usuario**
- *Coste y cuenta:* cuenta de Cloudflare gratuita (email) y `wrangler` como dependencia de desarrollo. El plan gratuito incluye 100k peticiones/día en Workers y, en KV, 100k lecturas/día, **1.000 escrituras/día** y 1 GB. Con sincronización manual sobra; con sincronización automática por cada registro, el límite de escrituras se alcanza enseguida. Coste en euros: 0, pero hay un servicio más que mantener.
- *Seguridad de la clave:* quien la tenga puede leer, sobrescribir y borrar los datos. Esto es aceptable solo si se cumplen todas estas condiciones: (a) **cifrado en el cliente** con WebCrypto (nativo, sin dependencias), con AES-GCM derivado de la clave mediante HKDF y la ruta igual al `SHA-256` de otra derivación, de modo que el servidor solo guarde texto cifrado; (b) el QR o enlace lleva la clave en el fragmento `#`, que nunca llega al servidor; (c) límite de tamaño y de frecuencia en el Worker, porque cualquiera puede hacer PUT a rutas aleatorias y agotar la cuota; (d) el servidor guarda la versión anterior y el cliente ejecuta `backupCurrent()` antes de aplicar lo remoto; (e) acción «Cambiar clave», que sube con una clave nueva y borra la antigua. Sin (a), la propuesta no debería aprobarse.
- *Privacidad/RGPD:* los registros de vicios (alcohol, tabaco, comida) pueden considerarse datos de salud (art. 9). El usuario pasaría a ser responsable del tratamiento: necesita un aviso de privacidad en la app, una forma de borrar los datos (DELETE) y aceptar a Cloudflare como encargado del tratamiento, con transferencia a EE. UU. El cifrado en el cliente reduce mucho la exposición, pero no la elimina (IPs, metadatos).
- *Conflictos:* la unión por `id` no es suficiente. (1) «Cargar ejemplo» usa los ids `seed-NN` con fechas que dependen de `today` (`seed.ts:7`): en dos dispositivos se obtiene el mismo id con contenido distinto. (2) «Borrar todo», importar y `restoreLast` reemplazan el array entero, así que la unión resucita lo borrado. Hace falta un `resetAt`/época en la instantánea que descarte lo anterior. (3) En `custom`, «gana la última escritura» sobre todo el objeto hace perder ediciones, archivados y cambios de `goalLog` hechos en el otro dispositivo, y depende de relojes que no tienen por qué coincidir. Como mínimo, la fusión de `trackers` debería hacerse por `id`.
- *Alternativa barata (recomendada primero, S, sin servidor):* «Importar y fusionar» como opción junto a «Reemplazar»: unión de eventos por `id`, trackers custom por `id` y `backupCurrent` previo. Se puede reutilizar `parseBackup`, sin cambiar el formato. Junto con P15.2 (Web Share del archivo al otro dispositivo), cubre el cambio de móvil y el uso en dos dispositivos sin datos en terceros. No cubre un navegador borrado sin copia previa; para eso sigue el recordatorio de 14 días.

## Ciclo recomendado

Orden: **P20.2 → P20.1**. El ciclo 20 = P20.2 + la parte de código y docs de P20.1. Son dos cambios S que no se pisan: uno toca `storage.ts`/`App.tsx` y el otro `deploy-pages.yml`/`DEPLOY.md`. Los pasos de GitHub los hace el usuario en paralelo. P20.3 se presenta al usuario como decisión: (A) no sincronizar y proponer «Importar y fusionar» + P15.2 en el ciclo 21, o (B) Worker con las condiciones (a)–(e) en los ciclos 21-22 (M manual, partido en Worker y cliente).
