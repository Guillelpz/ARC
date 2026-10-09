import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // sin prefijo VITE_: la key la lee el proxy y nunca entra al bundle
  const env = loadEnv(mode, process.cwd(), '')
  const key = env.ANTHROPIC_API_KEY
  // ponytail: proxy solo en dev/preview y con key. Sin key (hosting estático), __AI_PROXY__ = false y classifyAI usa la heurística sin llamar. Endpoint real: P13.4.
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
    define: { __AI_PROXY__: JSON.stringify(!!key) },
    plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy },
  }
})
