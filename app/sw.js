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

// ignoreVary: los scripts con crossorigin envían Origin y el servidor responde Vary: Origin; sin esto no coinciden con lo precacheado.
// ponytail: la navegación espera a la red sin timeout (con red lenta tarda); sin caché en tiempo de ejecución. Añadir timeout si se nota.
self.addEventListener('fetch', e => {
  const r = e.request
  if (KILL || r.method !== 'GET' || new URL(r.url).origin !== location.origin) return
  // ponytail: el .wasm del escáner no se precachea; se guarda la primera vez que se pide con red. Tras un despliegue la caché se renueva y se vuelve a bajar al abrir el escáner con red.
  if (new URL(r.url).pathname.endsWith('.wasm')) e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r, { ignoreVary: true })
    if (hit) return hit
    const res = await fetch(r)
    if (res.ok) await c.put(r, res.clone())
    return res
  }))
  else if (r.mode === 'navigate') e.respondWith(fetch(r).catch(() => caches.match('./index.html')))
  else e.respondWith(caches.match(r, { ignoreVary: true }).then(hit => hit || fetch(r)))
})
