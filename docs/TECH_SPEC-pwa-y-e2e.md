# TECH SPEC — PWA instalable y offline (P13.3) + smoke e2e en la CI (P13.5)

Ciclo 14. Fuente: `docs/cycles/cycle-13/proposals.md` (P13.3, P13.5) con los cambios de `docs/cycles/cycle-13/evaluation.md`. Requisitos: P13.1 en `main` (las claves desconocidas de custom se conservan) y despliegue activo en `https://guillelpz.github.io/ARC/` (`BASE_PATH=/ARC/`).

## 1. Resumen

- **Se construye:** un manifest con iconos PNG para que la app se pueda instalar, y un service worker escrito a mano que se genera en cada build con su `BUILD_ID` y la lista real de archivos de `dist/`. `index.html` se pide primero a la red y, sin red, sale de la caché; el resto de archivos sale primero de la caché. El service worker se registra solo en PROD. Hay un aviso visible «Hay una versión nueva · Recargar», un kill switch en el workflow de despliegue y una nota para iOS en «Tus datos».
- **Se construye:** Playwright (solo Chromium) contra `vite preview` del build con `base=/ARC/`, con tres pruebas: el flujo principal con recarga, la recarga sin red y axe con contraste. Va en un job aparte de `ci.yml` y en el script `npm run e2e`. `npm test` no cambia.
- **No se construye:** push, sincronización en segundo plano, pantalla de instalación propia, caché en tiempo de ejecución, Firefox/WebKit, regresión visual, pruebas contra el sitio desplegado ni la prueba e2e del aviso de versión nueva (necesita dos builds; queda en el checklist manual).
- El dominio (`core/`) y los datos guardados no cambian.

## 2. Decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| Generar `sw.js` | Plugin en línea en `vite.config.ts` (`apply: 'build'`, hook `closeBundle`). Lee la plantilla `app/sw.js`, recorre `dist/`, calcula `BUILD_ID` y escribe `dist/sw.js`. Sin `vite-plugin-pwa`. | Son unas 20 líneas sin dependencias. El plugin trae Workbox y su configuración, que ocupa más que nuestro service worker. |
| `BUILD_ID` | Los primeros 12 caracteres hex de un sha256 de las rutas ordenadas más el contenido de cada archivo de `dist/` (sin contar `sw.js`). | Si el build no cambia, `sw.js` tampoco, y no salta un aviso de versión nueva falso. Cualquier cambio, también en `public/`, lo cambia. |
| Lista de precache | Todos los archivos de `dist/` salvo `sw.js`, como rutas relativas `./assets/…`, `./index.html`, `./manifest.webmanifest`… | Las rutas relativas se resuelven contra la URL de `sw.js`, así que valen con cualquier `base`. Precachear todo junto evita una pantalla en blanco sin red. |
| Plantilla | `app/sw.js` es JS válido. Su primera línea es `const BUILD_ID = 'dev', ASSETS = [], KILL = false` y el plugin la sustituye. Si no la encuentra, el build lanza un error. | Así no hay globales sin declarar para oxlint, y la plantilla se puede leer tal cual. |
| Activación | `skipWaiting()` al instalar y `clients.claim()` al activar. El aviso sale con `controllerchange` solo si la página ya estaba controlada al cargar. | No hace falta `postMessage` ni gestionar el estado *waiting*. Como `index.html` va primero a la red, al recargar con conexión siempre llega la última versión, y el aviso solo cubre pestañas o PWAs que llevan tiempo abiertas. |
| Nombre de caché | `rpg-life-<BUILD_ID>`. Al activar se borran solo las cachés que empiezan por `rpg-life-` y no son la actual. | `*.github.io` lo comparten todos los proyectos del usuario: no se tocan las cachés de otros. |
| Detectar versiones | `reg.update()` cada vez que la pestaña vuelve a estar visible. | Una PWA abierta varios días también se entera de la versión nueva. |
| Kill switch | Si al construir `SW_KILL=1`, la plantilla se escribe con `KILL = true`: borra las cachés `rpg-life-*`, se desregistra y recarga las ventanas. Además, `__SW_KILL__` hace que la página no registre ningún service worker y desregistre los que encuentre. En el workflow es un input booleano `sw_kill`. | Se despliega desde Actions en un clic. Sin `__SW_KILL__`, la página volvería a registrar el service worker y entraría en un bucle de recargas. |
| Manifest | Archivo estático `public/manifest.webmanifest` con `start_url` y `scope` `"./"`. | Las rutas relativas se resuelven contra la URL del manifest (`/ARC/`), así que no hay que generarlo. |
| Iconos | PNG de 192, 512 y 180 (`apple-touch-icon`) generados una vez con Playwright desde un SVG en línea en `scripts/icons.mjs`. Los PNG se suben al repo. | Usa la devDep ya aprobada; sin dependencias para tratar imágenes. |
| axe en e2e | Se inyecta `axe-core/axe.min.js`, que ya es devDep, con `page.addScriptTag`. No se usa `@axe-core/playwright`. | Es una dependencia menos y hace lo mismo. |
| Archivos e2e | `app/e2e/*.e2e.ts` con `testMatch: '*.e2e.ts'`. | Vitest solo recoge `*.test.*` y `*.spec.*`, así que `npm test` no los ve sin tocar su configuración. |
| Servidor e2e | `webServer` de Playwright: `npm run build && npm run preview -- --port 4173 --strictPort` con `env: { BASE_PATH: '/ARC/' }`. | Usa el mismo `base` que producción, funciona igual en Windows y en la CI, y un solo comando lo arranca todo. |
| Sin red en e2e | `context.setOffline(true)`, con una comprobación previa de que el service worker tampoco tiene red (ver §11, E2). | Si Chromium no cortara la red al service worker, la prueba pasaría sin probar nada. La comprobación lo detecta. |
| iOS | En «Tus datos» se añade siempre una línea fija en gris (`text-app-muted`). No se detecta el sistema. | Detectar iOS por user agent es frágil. La línea es corta y no molesta en otros sistemas. |

## 3. Decisiones que requieren aprobación

Ninguna nueva. Solo se añade la devDep ya aprobada `@playwright/test` (con Chromium descargado en la CI). No se añaden `@axe-core/playwright` ni `vite-plugin-pwa`, ni dependencias de runtime. Las reglas de juego y los atajos de la demo no cambian.

## 4. Impacto en el código

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `app/public/manifest.webmanifest` | nuevo | Manifest de instalación. |
| `app/public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | nuevos | Iconos generados. |
| `app/scripts/icons.mjs` | nuevo | Script para regenerar los iconos (`node scripts/icons.mjs`). No lo ejecuta ningún paso del build. |
| `app/index.html` | mod. | `<link rel="manifest">`, `apple-touch-icon` y `theme-color`. |
| `app/sw.js` | nuevo | Plantilla del service worker (normal y kill switch). |
| `app/vite.config.ts` | mod. | Plugin `serviceWorker(kill)` y define `__SW_KILL__`. |
| `app/src/pwa.ts` | nuevo | `registerSW(onUpdate)`. |
| `app/src/components/UpdateBanner.tsx` | nuevo | Aviso visible de versión nueva. |
| `app/src/components/SaveFailBanner.tsx` | mod. | Exporta `tones` como `bannerTones` para reutilizarlo. |
| `app/src/App.tsx` | mod. | Estado `update`, efecto que llama a `registerSW` y render de `UpdateBanner`. |
| `app/src/components/HomeView.tsx` | mod. | Nota de iOS en «Tus datos». |
| `app/playwright.config.ts`, `app/e2e/smoke.e2e.ts` | nuevos | Configuración y pruebas e2e. |
| `app/package.json` | mod. | devDep `@playwright/test` y script `"e2e": "playwright test"`. |
| `app/.gitignore` | mod. | `playwright-report`, `test-results`. |
| `.github/workflows/ci.yml` | mod. | Job `e2e`. |
| `.github/workflows/deploy-pages.yml` | mod. | Input `sw_kill` y su `env`. |
| `docs/DEPLOY.md` | mod. | Sección «PWA y kill switch» y comprobaciones nuevas. |

## 5. Modelos de datos

Sin cambios en `core/types.ts`. Solo se añade la declaración de ámbito de módulo en `pwa.ts`, igual que `__AI_PROXY__` en `classify.ts`:

```ts
declare const __SW_KILL__: boolean // vite.config `define`: true solo con SW_KILL=1 al construir
```

## 6. Persistencia y migración

- localStorage no cambia: mismas claves, mismo formato y sin migración.
- La caché nueva (Cache Storage `rpg-life-<BUILD_ID>`) solo guarda archivos estáticos. No contiene datos del usuario y se puede borrar sin perder nada.
- Varias versiones conviviendo (una pestaña vieja y una nueva): P13.1 ya conserva las claves desconocidas de `life-rpg-custom-v1`, así que no hace falta nada más.
- **iOS:** la app instalada tiene un localStorage distinto del de Safari y arranca vacía. La forma de pasar los datos es Exportar en Safari e Importar en la app. Se dice en «Tus datos» (§8).

## 7. Lógica de dominio

Sin cambios en `core/`. `selfcheck.ts` no se toca y tiene que seguir pasando. La lógica nueva está en tres sitios.

### 7.1 Plugin (`vite.config.ts`)

```ts
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'

const HEAD = "const BUILD_ID = 'dev', ASSETS = [], KILL = false"
function serviceWorker(kill: boolean): Plugin {
  let root = '', outDir = ''
  return {
    name: 'rpg-sw', apply: 'build',
    configResolved(c) { root = c.root; outDir = resolve(c.root, c.build.outDir) },
    closeBundle() {
      const files = (readdirSync(outDir, { recursive: true }) as string[])
        .map(f => f.replaceAll('\\', '/'))
        .filter(f => f !== 'sw.js' && statSync(join(outDir, f)).isFile()).sort()
      const h = createHash('sha256')
      for (const f of files) h.update(f).update(readFileSync(join(outDir, f)))
      const tpl = readFileSync(resolve(root, 'sw.js'), 'utf8')
      if (!tpl.includes(HEAD)) throw new Error('sw.js: falta la cabecera reemplazable')
      const head = `const BUILD_ID = ${JSON.stringify(h.digest('hex').slice(0, 12))}, ASSETS = ${JSON.stringify(files.map(f => './' + f))}, KILL = ${kill}`
      writeFileSync(join(outDir, 'sw.js'), tpl.replace(HEAD, head))
    },
  }
}
```

En la config: `const kill = env.SW_KILL === '1'`, `define` añade `__SW_KILL__: JSON.stringify(kill)` y `plugins: [react(), tailwindcss(), serviceWorker(kill)]`.

### 7.2 Plantilla (`app/sw.js`)

```js
const BUILD_ID = 'dev', ASSETS = [], KILL = false // el build reemplaza esta línea (vite.config.ts)
const CACHE = 'rpg-life-' + BUILD_ID
const old = keys => keys.filter(k => k.startsWith('rpg-life-') && (KILL || k !== CACHE))

self.addEventListener('install', e => e.waitUntil(
  (KILL ? Promise.resolve() : caches.open(CACHE).then(c => c.addAll(ASSETS))).then(() => self.skipWaiting())))

self.addEventListener('activate', e => e.waitUntil((async () => {
  await Promise.all(old(await caches.keys()).map(k => caches.delete(k)))
  if (!KILL) return self.clients.claim()
  await self.registration.unregister()
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url)
})()))

// ponytail: la navegación espera a la red sin timeout (con red lenta tarda); sin caché en tiempo de ejecución. Añadir timeout si se nota.
self.addEventListener('fetch', e => {
  const r = e.request
  if (KILL || r.method !== 'GET' || new URL(r.url).origin !== location.origin) return
  if (r.mode === 'navigate') e.respondWith(fetch(r).catch(() => caches.match('./index.html')))
  else e.respondWith(caches.match(r).then(hit => hit || fetch(r)))
})
```

Reglas:
- La navegación no guarda la respuesta de red en la caché. El `index.html` cacheado tiene que corresponder a los assets cacheados.
- `addAll` es atómico: si falta algún archivo, la instalación falla y sigue la versión anterior.

### 7.3 Registro (`app/src/pwa.ts`)

```ts
declare const __SW_KILL__: boolean
export function registerSW(onUpdate: () => void) {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return // en dev cachearía el servidor de Vite
  const sw = navigator.serviceWorker
  if (__SW_KILL__) { sw.getRegistrations().then(rs => rs.forEach(r => r.unregister()), () => {}); return }
  const had = !!sw.controller // primera visita: claim() también dispara controllerchange, sin aviso
  sw.addEventListener('controllerchange', () => { if (had) onUpdate() })
  sw.register(`${import.meta.env.BASE_URL}sw.js`).then(reg => {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) })
  }, () => {}) // sin service worker la app funciona igual
}
```

- El scope por defecto es la carpeta de `sw.js`, `/ARC/`.
- En `App.tsx`: `const [update, setUpdate] = useState(false)` y `useEffect(() => registerSW(() => setUpdate(true)), [])`.
- En Vitest, `PROD` es `false` y la función sale al principio. Los tests de UI no cambian.

## 8. UI

**`UpdateBanner`** (`components/UpdateBanner.tsx`), con props `{ tone, onReload, onClose }`:
- Va en `App.tsx` después de `BottomNav`, con `{update && <UpdateBanner … />}`. El tono depende de la pantalla: `hero` → `hero`, `villain` → `villain` y el resto → `app`. Así no se mezclan paletas.
- Contenedor `fixed inset-x-0 top-4 z-40 mx-auto max-w-md px-4`, por debajo de los toasts (`z-50`). Dentro va la misma caja que `SaveFailBanner` (`bannerTones[tone].box`) con `role="status"`. Es un bloque visible, no el `sr-only`.
- Texto: «Hay una versión nueva de la app.» Botón «Recargar» con el icono `RotateCw`, `min-h-11`, estilo `bannerTones[tone].btn`, y `onReload = () => location.reload()`. Botón de cerrar con `X`, `aria-label="Cerrar aviso"` y el mismo patrón que el aviso de `HomeView` (`min-h-11 min-w-11`), que pone `update` a `false`. No recarga solo.
- Sin animación de entrada. No hay estados de cargando ni de error: si el registro falla, no se muestra nada.

**«Tus datos»** (`HomeView.tsx`): debajo del párrafo de estado de la copia y antes de los botones, un `<p className="text-xs leading-5 text-app-muted">` con el texto: «En iPhone y iPad, la app añadida a la pantalla de inicio guarda sus datos aparte de Safari: exporta una copia aquí e impórtala en la app.»

**`index.html`** (`<head>`):
```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="theme-color" content="#E8E9E5" />
```
Vite añade `base` a los `href` de los archivos de `public/`, igual que con el favicon. Hay que comprobarlo en `dist/index.html`.

**`manifest.webmanifest`:**
```json
{ "name": "RPG Life Tracker", "short_name": "Life RPG", "lang": "es",
  "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "#E8E9E5", "theme_color": "#E8E9E5",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" } ] }
```

**Iconos** (`scripts/icons.mjs`): un SVG cuadrado con fondo `#E8E9E5` (`--color-app-bg`) y un círculo centrado de diámetro 62 %, con la mitad izquierda `#285B70` (`--color-hero`) y la derecha `#16141C` (`--color-villain-bg`). Es el mismo motivo que el botón «+» de la home. Hay que copiar los hex de `@theme` y citar el token en un comentario; este archivo no es un componente. El script lanza `chromium` de `@playwright/test` y, por cada tamaño (192, 512, 180), pone ese viewport, hace `setContent` del SVG a tamaño completo y guarda el `screenshot` en `public/<nombre>.png`. Son unas 15 líneas.

## 9. Backlog

### T1 — Manifest, iconos y nota de iOS
- **Objetivo:** que la app se pueda instalar con iconos propios y que el usuario de iOS sepa cómo llevar sus datos a la app instalada.
- **Archivos:** `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `scripts/icons.mjs`, `index.html`, `components/HomeView.tsx`, `package.json` y `package-lock.json`.
- **Funcionalidad:** §8 (manifest, `index.html`, iconos y nota de «Tus datos»). `@playwright/test` entra aquí como devDep porque lo usa `icons.mjs`. Hay que ejecutar `npx playwright install chromium` una vez en local.
- **Depende de:** nada.
- **Aceptación:**
  - Con `BASE_PATH=/ARC/ npm run build`, `dist/index.html` enlaza `/ARC/manifest.webmanifest` y `/ARC/apple-touch-icon.png`.
  - En `npm run preview`, DevTools → Application → Manifest no muestra errores y enseña los 2 iconos.
  - La nota se ve en «Tus datos».
  - `build`, `lint` y `test` en verde.

### T2 — Smoke e2e (E1 y E3) en la CI
- **Objetivo:** probar en un navegador real el flujo principal y el contraste, con el `base` de producción.
- **Archivos:** `playwright.config.ts`, `e2e/smoke.e2e.ts`, `package.json` (script `e2e`), `.gitignore` y `.github/workflows/ci.yml`.
- **Funcionalidad:**
  - `playwright.config.ts`: `testDir: 'e2e'`, `testMatch: '*.e2e.ts'`, `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 1 : 0` y `reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list'`.
  - En `use`: `{ ...devices['Pixel 7'], baseURL: 'http://localhost:4173/ARC/', reducedMotion: 'reduce' }`. `Pixel 7` es Chromium móvil.
  - `webServer`: `{ command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/ARC/', env: { BASE_PATH: '/ARC/' }, reuseExistingServer: !process.env.CI, timeout: 120_000 }`.
  - En las pruebas, navegar siempre con `page.goto('./')`. Con `'/'` se iría a la raíz y no a `/ARC/`.
  - Pruebas E1 y E3 (§11). Nunca esperas fijas: solo `expect(...).toBeVisible()` y `toHaveText`.
  - Job `e2e` en `ci.yml`, en paralelo con `check` y sin `needs`: checkout, setup-node (igual que `check`), `npm ci`, `npx playwright install --with-deps chromium`, `npm run e2e` y, si falla, `actions/upload-artifact@v4` de `app/playwright-report` con `retention-days: 7`. `# ponytail: navegador sin cachear en la CI (+~1 min); cachear ~/.cache/ms-playwright si molesta`.
- **Depende de:** T1 (la devDep).
- **Aceptación:**
  - `npm run e2e` pasa en local, en Windows.
  - El job `e2e` pasa en GitHub Actions.
  - `npm test` no ejecuta ningún `*.e2e.ts`.
  - Si axe encuentra problemas de contraste reales, se arreglan en esta tarea ajustando la clase o el token según `STYLE_GUIDE.md`. Si el arreglo necesita una decisión de diseño, se excluye ese selector con `exclude` y un comentario, y se informa en el handback.

### T3 — Service worker, aviso de versión, kill switch y prueba sin red (E2)
- **Objetivo:** que la app abra sin red después de la primera visita, sin quedarse atrapada en una versión vieja.
- **Archivos:** `sw.js`, `vite.config.ts`, `src/pwa.ts`, `src/components/UpdateBanner.tsx`, `src/components/SaveFailBanner.tsx`, `src/App.tsx`, `e2e/smoke.e2e.ts`, `.github/workflows/deploy-pages.yml` y `docs/DEPLOY.md`.
- **Funcionalidad:**
  - Lo descrito en §7.1–7.3 y el `UpdateBanner` de §8.
  - En `deploy-pages.yml`: `on: { workflow_dispatch: { inputs: { sw_kill: { description: 'Emergencia: publicar un sw.js que desinstala el service worker', type: boolean, default: false } } } }` y, en el paso de build, `env: { BASE_PATH: …, SW_KILL: "${{ inputs.sw_kill && '1' || '' }}" }`. Se mantiene el comentario de cabecera actualizado.
  - `DEPLOY.md`, sección nueva «PWA y kill switch»:
    1. Si se publica un service worker roto, lanzar «Deploy Pages» con `sw_kill` marcado. Las visitas siguientes borran la caché, desregistran el service worker y recargan.
    2. Para volver a la normalidad, desplegar sin marcarlo.
    3. Cada build genera un `sw.js` nuevo, así que no hay que tocar nada a mano.
  - Añadir al checklist de `DEPLOY.md` las comprobaciones manuales de §11.
  - Añadir E2 a `smoke.e2e.ts`.
- **Depende de:** T2.
- **Aceptación:**
  - E1, E2 y E3 en verde, en local y en la CI.
  - `npm run dev` no registra ningún service worker (Application → Service Workers vacío).
  - Con `SW_KILL=1 npm run build`, `dist/sw.js` contiene `KILL = true`.
  - Dos builds seguidos sin cambios generan un `dist/sw.js` idéntico.
  - Checklist manual de §11 hecho en el sitio desplegado.

## 10. Riesgos

| Riesgo | Prevención | Si se complica |
|---|---|---|
| Usuarios atrapados en una versión vieja | `index.html` va primero a la red. Cada build cambia `sw.js` y hay `skipWaiting`. `reg.update()` al volver a la pestaña. | Kill switch (T3). |
| Pantalla en blanco sin red | Se precachea todo `dist/` junto con `addAll`, que es atómico, y la navegación usa el `index.html` cacheado. | E2 lo detecta en la CI. |
| `setOffline` no corta la red al service worker y E2 da un falso verde | Comprobación previa obligatoria en E2 (§11). | Si la comprobación falla, E2 levanta su propio servidor con `preview()` de `vite` (`port: 4174`, `base: '/ARC/'`) y lo cierra con `server.close()` en lugar de `setOffline`. |
| La CI tarda más o falla de forma intermitente | Job en paralelo, una sola reintentona en la CI y esperas a elementos, nunca tiempos fijos. | Quitar E3 del job (dejarlo con `test.skip` y un comentario) antes que quitar E2. |
| axe da falsos positivos de contraste a mitad de una animación | `reducedMotion: 'reduce'` y esperar a que el encabezado de la pantalla sea visible. | `exclude` del nodo concreto, con un comentario. |
| La app instalada en iOS arranca vacía | Nota en «Tus datos». | — |
| Otro proyecto de `*.github.io` usa el mismo nombre de caché | Prefijo `rpg-life-`. | — |
| Cambiar solo el manifest o los iconos no se nota hasta que cambia el `BUILD_ID` | El `BUILD_ID` incluye todo `dist/`, también `public/`. | — |

**Qué recortar:** primero la reactivación con `reg.update()` en `visibilitychange` (el navegador ya revisa `sw.js` en cada navegación), y después E3. E2, el kill switch y el registro solo en PROD no se recortan.

## 11. Verificación

**Asserts:** `selfcheck.ts` no cambia. No hay lógica nueva en `core/`.

**e2e (`app/e2e/smoke.e2e.ts`), con un contexto nuevo por prueba:**
- **E1 · flujo y persistencia**
  1. `goto('./')` y comprobar que se ve «Empieza tu historial».
  2. Pulsar «Cargar ejemplo» e ir a HERO en la navegación «Principal».
  3. En `getByRole('group', { name: 'Gym' })`, leer el texto `/\d+ XP$/`, pulsar el botón `/^\+1 sesiones · /` y esperar a que la XP sea la anterior + 30.
  4. `page.reload()`, ir a HERO y comprobar que la XP de Gym sigue en ese valor.
- **E2 · recarga sin red tras la primera visita**
  1. `goto('./')`, `request.get('manifest.webmanifest')` → 200, y `page.waitForFunction(() => navigator.serviceWorker.controller)`.
  2. Pulsar «Cargar ejemplo».
  3. `context.setOffline(true)`.
  4. **Comprobación previa:** `page.evaluate(() => fetch('./nada-' + Date.now()).then(() => 'red', () => 'sin red'))` tiene que dar `'sin red'`. La petición pasa por el service worker, que no la tiene en caché y va a la red.
  5. `page.reload()`. Se ve el encabezado «Tus datos» y **no** se ve «Empieza tu historial», porque los datos de localStorage siguen ahí.
  6. Ir a HERO y comprobar que se ve el grupo «Gym».
- **E3 · axe con contraste en navegador real**
  1. Cargar el ejemplo y pasar axe en la home, en HERO y en VILLAIN. Antes de cada pasada, esperar a que el encabezado de la pantalla sea visible.
  2. Inyectar `createRequire(import.meta.url).resolve('axe-core/axe.min.js')` con `page.addScriptTag({ path })` y ejecutar `axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })`.
  3. Resultado esperado: ninguna violación `serious` ni `critical`. El mensaje de error lista `id` y `target`, igual que `a11y.test.tsx`.

**Cierre de cada tarea:** `npm run build`, `npm run lint` y `npm test` en verde desde `app/`, más `npm run e2e` desde T2. En `npm run dev`, `[selfcheck] done` sin fallos.

**Checklist manual** (en `https://guillelpz.github.io/ARC/` después de desplegar T3; se añade a `DEPLOY.md`):
- [ ] Android/Chrome: aparece «Instalar app». La app instalada abre en `/ARC/` a pantalla completa con su icono.
- [ ] Con modo avión, después de una visita, la app abre con los datos.
- [ ] Desplegar otra vez con algún cambio, con la app ya abierta. Al volver a la pestaña sale «Hay una versión nueva · Recargar» con el tono de la pantalla; «Recargar» carga la versión nueva y la X lo cierra.
- [ ] iOS/Safari: «Añadir a pantalla de inicio» usa el icono de 180. La app instalada arranca vacía y, al importar una copia exportada en Safari, aparecen los datos.
- [ ] Kill switch, una vez: desplegar con `sw_kill`. Tras abrir y recargar, Application → Service Workers queda vacío y Cache Storage no tiene `rpg-life-*`. Desplegar de nuevo sin `sw_kill` para restaurar.
- [ ] `npm run dev` no registra ningún service worker.

## 12. Handoff para Claude Code

1. Trabaja desde `app/`. Implementa T1, T2 y T3 en orden. Cada tarea va en su propio commit y deja la app desplegable.
2. No toques `core/` ni `selfcheck.ts`. No añadas dependencias, salvo `@playwright/test` como devDep.
3. Copia la lógica de §7 tal como está. Si una API no se comporta como dice esta spec (el hook `closeBundle`, `readdirSync` recursivo, `setOffline` con el service worker), aplica la alternativa de §10 y dilo en el handback.
4. Cuando pruebes a mano en el navegador de siempre, usa `vite preview` en una ventana privada, o desregistra el service worker después: un service worker de `localhost:4173` sobrevive entre pruebas.
5. Para cerrar: `npm run build`, `npm run lint`, `npm test` y `npm run e2e` en verde, y el job `e2e` en verde en la CI. El checklist manual de §11 lo hace el usuario en el sitio desplegado.
