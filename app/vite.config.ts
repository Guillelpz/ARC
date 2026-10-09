import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Genera dist/sw.js desde la plantilla sw.js con BUILD_ID (hash de dist/) y la lista de archivos a precachear.
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

export default defineConfig(({ command, mode }) => {
  // sin prefijo VITE_: la key la lee el proxy y nunca entra al bundle
  const env = loadEnv(mode, process.cwd(), '')
  const key = env.ANTHROPIC_API_KEY
  const kill = env.SW_KILL === '1'
  // ponytail: IA solo en `npm run dev` y con key; un build (también `vite preview`) usa la heurística sin llamar. Endpoint real: P13.4.
  const proxy = key ? {
    '/api/claude': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: () => '/v1/messages',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    },
  } : undefined
  return {
    base: env.BASE_PATH || '/', // p. ej. '/<repo>/' en GitHub Pages; vacío = raíz (dev, Cloudflare)
    define: { __AI_PROXY__: JSON.stringify(command === 'serve' && !!key), __SW_KILL__: JSON.stringify(kill) },
    plugins: [react(), tailwindcss(), serviceWorker(kill)], server: { proxy },
  }
})
