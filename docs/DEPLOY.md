# Despliegue estático (GitHub Pages o Cloudflare Pages)

GitHub Pages está activo en `https://guillelpz.github.io/ARC/`. La app es un sitio estático: `npm run build` en `app/` genera `app/dist`.

## Antes de elegir

- Cada origen (`localhost`, `*.github.io`, `*.pages.dev`) tiene su propio localStorage. Para llevar tus datos: **Exportar** en local e **Importar** en el sitio.
- No hay servidor: los datos siguen en el navegador de cada persona. La URL es pública.
- **Nunca** definas `ANTHROPIC_API_KEY` en el hosting. Sin ella, la IA se desactiva sola y «Nuevo» usa la heurística. Publica siempre el build del hosting, no uno local.
- Un `npm run build` nunca usa la IA, aunque exista `app/.env.local`: `__AI_PROXY__` solo es `true` en `npm run dev`. `npm run preview` sirve ese mismo build, sin IA.
- `index.html` enlaza `/favicon.svg`; Vite lo reescribe con `base` al hacer el build, no hay que tocarlo.

## GitHub Pages

1. El repo tiene que ser público en el plan gratuito.
2. Settings → Pages → Source «GitHub Actions».
3. Despliegue automático (`.github/workflows/deploy-pages.yml`) en cada push a `main` que toque `app/**` o el workflow; los push de solo `docs/` no publican. Actions → «Deploy Pages» → Run workflow sigue sirviendo para redesplegar a mano y para `sw_kill`.
4. URL: `https://<usuario>.github.io/<repo>/`.
5. Aviso: todas las páginas de proyecto de un usuario comparten el origen `<usuario>.github.io` y, por tanto, el localStorage.

## Cloudflare Pages

- Puede usarse con repo privado. Panel → Workers & Pages → Create → Pages → conectar con Git.
- Root directory `app`, build command `npm run build`, output `dist`, variable `NODE_VERSION=22`, sin `BASE_PATH`.
- URL: `https://<proyecto>.pages.dev`. Despliega en cada push y crea previews por rama.
- Si usas Cloudflare, borra `deploy-pages.yml`. Es la única opción que deja abierto un endpoint de IA futuro.

## PWA y kill switch

1. Si se publica un service worker roto, lanzar «Deploy Pages» con `sw_kill` marcado. Las visitas siguientes borran la caché, desregistran el service worker y recargan.
2. Para volver a la normalidad, desplegar sin marcarlo.
3. Cada build genera un `sw.js` nuevo, así que no hay que tocar nada a mano.
4. Con el kill switch activo, el siguiente push a `main` que toque `app/` vuelve a registrar el service worker, así que tiene que llevar el arreglo.
5. `concurrency: cancel-in-progress` cancela un despliegue en curso si entra otro, incluido el del kill switch: no hacer push mientras se publica el kill.
6. El despliegue con `sw_kill` se salta lint, test y e2e, pero no el humo final, que comprueba que el `sw.js` de desinstalación está publicado.

## Volver atrás

1. Principal: `git revert <commit>` + `git push` a `main`. Vuelve a pasar la puerta (lint, test, e2e), despliega y se queda en la historia.
2. Vía rápida: Actions → «Deploy Pages» → la última ejecución verde anterior → «Re-run all jobs». Avisos: solo funciona dentro de los 30 días siguientes a la ejecución original, y el siguiente push a `main` vuelve a publicar HEAD si no se ha revertido.
3. Si lo roto es el service worker: `sw_kill` (sección anterior).
4. Si el paso de humo sale en rojo, abrir la URL. Si sirve la versión anterior, relanzar el workflow; si sirve una versión rota, aplicar el punto 1.

## Proteger producción (pasos en GitHub, los hace el usuario)

- [ ] Settings → Environments → `github-pages` → «Deployment branches and tags» → «Selected branches and tags» → Add rule `main`. **Es la protección real** contra publicar desde otra rama; el `if` del workflow es cosmético.
- [ ] Settings → Rules → Rulesets → New ruleset → New branch ruleset: nombre `main`, Enforcement «Active», Target «Include default branch», con «Restrict deletions» y «Block force pushes». **No** marcar «Require a pull request» ni «Require status checks», porque bloquean el push directo del orquestador.
- [ ] (Opcional, no recomendado de entrada) En el mismo entorno, «Required reviewers» = tú. Cada despliegue espera tu clic.
- [ ] Settings → Pages → Source sigue en «GitHub Actions».

## Comprobar tras desplegar

- [ ] La URL carga con estilos y favicon.
- [ ] Registrar algo y recargar: persiste.
- [ ] Exportar en local → Importar en el sitio: los datos aparecen.
- [ ] «Nuevo» responde al instante con la propuesta heurística y no hay peticiones a `/api/claude` en Network.
- [ ] Probado desde el móvil.
- [ ] Android/Chrome: aparece «Instalar app». La app instalada abre en `/ARC/` a pantalla completa con su icono.
- [ ] Con modo avión, después de una visita, la app abre con los datos.
- [ ] Desplegar otra vez con algún cambio, con la app ya abierta. Al volver a la pestaña sale «Hay una versión nueva · Recargar» con el tono de la pantalla; «Recargar» carga la versión nueva y la X lo cierra.
- [ ] iOS/Safari: «Añadir a pantalla de inicio» usa el icono de 180. La app instalada arranca vacía y, al importar una copia exportada en Safari, aparecen los datos.
- [ ] Kill switch, una vez: desplegar con `sw_kill`. Tras abrir y recargar, Application → Service Workers queda vacío y Cache Storage no tiene `rpg-life-*`. Desplegar de nuevo sin `sw_kill` para restaurar.
- [ ] `npm run dev` no registra ningún service worker.
- [ ] Voz en iPhone real (PWA instalada; hasta cerrar T8, y otra vez tras el merge a producción). Para una prueba previa sin desplegar: en `app/`, `npm run build && npx vite preview --host --port 4173` y `npx cloudflared tunnel --url http://localhost:4173` (sin `BASE_PATH`); cerrar el túnel al terminar.
  - [ ] Siri y Dictado activados (Ajustes › Siri; Ajustes › General › Teclado › Activar dictado). Anotar la versión de iOS.
  - [ ] Yo › Ajustes › «Probar voz» ×5 en Safari y ×5 en la PWA (decir «80 kilos press banca 5 repeticiones»); cerrar y reabrir la app y probar 2 veces más. Capturas con «Detalles técnicos».
  - [ ] Primera vez: el aviso de privacidad; «Entendido» empieza a escuchar en el mismo toque.
  - [ ] Gym: dictar «80 kilos press banca 5 repeticiones» → serie, sesión en HERO y aviso; «Deshacer» la quita y retira la sesión.
  - [ ] «3 series de 5» → 3 series; «Editar» → formulario con el foco en el peso y el teclado abierto.
  - [ ] Incompleto («press banca 80») → formulario con el foco en las repeticiones.
  - [ ] «Hoy»: dictar → fila Gym; incompleto → abre Gym; «Volver» → foco en «Hoy».
  - [ ] Modo avión → «Dictar serie» abre el campo; el dictado del teclado + «Registrar» funciona.
  - [ ] Ajustes dentro de la PWA: pegar la clave, «Probar clave» → «La clave funciona»; dictar una frase rara («la máquina de piernas 100 10») → Prensa.
  - [ ] Recargar y cerrar/abrir la app: las series y la clave siguen; «Exportar copia» no contiene la clave.
  - [ ] 320 px sin scroll horizontal en Gym, «Hoy» y «Yo».

Prueba local del build con base: `BASE_PATH=/rpg/ npm run build && npm run preview` → `http://localhost:4173/rpg/`. En Git Bash, antepón `MSYS_NO_PATHCONV=1` (si no, `/rpg/` se convierte en una ruta de Windows).

## Comida: código de barras (Open Food Facts)

- [ ] iPhone (Safari y PWA): teclear un EAN real de Hacendado → «Revisar alimento» con la atribución «Open Food Facts (ODbL)» y su enlace → guardar → apuntar. Repetir el mismo EAN → «Ya lo tienes» sin peticiones en Network.
- [ ] Modo avión: «Código de barras» → «Sin conexión. Puedes crearlo a mano»; «Crear a mano» guarda y después el EAN lo encuentra.
- [ ] El aviso de privacidad sale solo la primera vez; «Exportar copia» no incluye `life-rpg-food-privacy-v1` y «Borrar todo» no lo vuelve a mostrar.
- [ ] 320 px sin scroll horizontal con el panel abierto.

## Comida: foto de la etiqueta (Haiku)

Validación manual (I4) que hace el usuario en el iPhone antes de cerrar el ciclo 33. Requiere la clave de Anthropic en Ajustes.

- [ ] Primer uso: «Foto de la etiqueta» muestra el aviso («la app envía la foto, reducida y sin datos de ubicación, a Anthropic con tu clave»); «Entendido» abre la cámara/selector de una vez. No vuelve a salir; «Borrar todo» no lo restablece y «Exportar copia» no lo incluye.
- [ ] Etiquetas: 10-20 etiquetas reales distintas (yogur, cereales, bebida en ml, producto solo por ración, etiqueta en otro idioma, foto torcida, con reflejos, HEIC de la cámara). Por cada una, anota kcal, P, C, G y base tras la revisión: acierto sin tocar nada, valor corregido o error. Objetivo: >= 8 de 10 sin corregir. Si >= 3 de cada 10 salen con algún valor mal, se anota para un ciclo aparte (no se cambia de modelo aquí).
- [ ] Tabla en la foto: se rellena «Revisar alimento»; si las kcal no cuadran con los macros sale el aviso y no bloquea.
- [ ] La foto sale reducida: DevTools (Safari remoto) → la petición a `api.anthropic.com` pesa < 1 MB y no lleva EXIF.
- [ ] Foto ilegible o sin tabla: «No se lee la tabla nutricional…»; con una clave mala: «Anthropic rechaza la clave…»; ambos con «Crear a mano» y «Probar otra foto».
- [ ] Modo avión: «Sin conexión. Puedes crearlo a mano», sin petición.
- [ ] Etiqueta con código de barras legible ya guardado: «Ya lo tienes».
- [ ] 320 px sin scroll horizontal con el panel abierto.
