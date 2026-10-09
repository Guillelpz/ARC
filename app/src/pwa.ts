declare const __SW_KILL__: boolean // vite.config `define`: true solo con SW_KILL=1 al construir

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
