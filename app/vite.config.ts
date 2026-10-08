import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // sin prefijo VITE_: la key la lee el proxy y nunca entra al bundle
  const key = loadEnv(mode, process.cwd(), '').ANTHROPIC_API_KEY
  // ponytail: proxy solo en dev/preview; en hosting estático no hay /api/claude y classifyAI cae a la heurística
  const proxy = key ? {
    '/api/claude': {
      target: 'https://api.anthropic.com',
      changeOrigin: true,
      rewrite: () => '/v1/messages',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    },
  } : undefined
  return { plugins: [react(), tailwindcss()], server: { proxy }, preview: { proxy } }
})
