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
6. El despliegue con `sw_kill` se salta el e2e.

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

Prueba local del build con base: `BASE_PATH=/rpg/ npm run build && npm run preview` → `http://localhost:4173/rpg/`. En Git Bash, antepón `MSYS_NO_PATHCONV=1` (si no, `/rpg/` se convierte en una ruta de Windows).
