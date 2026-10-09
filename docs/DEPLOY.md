# Despliegue estático (GitHub Pages o Cloudflare Pages)

Nada de esto está activado. La app es un sitio estático: `npm run build` en `app/` genera `app/dist`.

## Antes de elegir

- Cada origen (`localhost`, `*.github.io`, `*.pages.dev`) tiene su propio localStorage. Para llevar tus datos: **Exportar** en local e **Importar** en el sitio.
- No hay servidor: los datos siguen en el navegador de cada persona. La URL es pública.
- **Nunca** definas `ANTHROPIC_API_KEY` en el hosting. Sin ella, la IA se desactiva sola y «Nuevo» usa la heurística. Publica siempre el build del hosting, no uno local.

## GitHub Pages

1. El repo tiene que ser público en el plan gratuito.
2. Settings → Pages → Source «GitHub Actions».
3. Actions → «Deploy Pages» → Run workflow (`.github/workflows/deploy-pages.yml`, solo manual).
4. URL: `https://<usuario>.github.io/<repo>/`.
5. Para desplegar en cada push a `main`, añade `push: { branches: [main] }` al `on:` del workflow.
6. Aviso: todas las páginas de proyecto de un usuario comparten el origen `<usuario>.github.io` y, por tanto, el localStorage.

## Cloudflare Pages

- Puede usarse con repo privado. Panel → Workers & Pages → Create → Pages → conectar con Git.
- Root directory `app`, build command `npm run build`, output `dist`, variable `NODE_VERSION=22`, sin `BASE_PATH`.
- URL: `https://<proyecto>.pages.dev`. Despliega en cada push y crea previews por rama.
- Si usas Cloudflare, borra `deploy-pages.yml`. Es la única opción que deja abierto un endpoint de IA futuro.

## Comprobar tras desplegar

- [ ] La URL carga con estilos y favicon.
- [ ] Registrar algo y recargar: persiste.
- [ ] Exportar en local → Importar en el sitio: los datos aparecen.
- [ ] «Nuevo» responde al instante con la propuesta heurística y no hay peticiones a `/api/claude` en Network.
- [ ] Probado desde el móvil.

Prueba local del build con base: `BASE_PATH=/rpg/ npm run build && npm run preview` → `http://localhost:4173/rpg/`.
