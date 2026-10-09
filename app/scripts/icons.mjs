// Regenera los iconos: node scripts/icons.mjs
import { chromium } from '@playwright/test'
// Hex copiados de @theme (index.css): fondo --color-app-bg, mitad izquierda --color-hero, derecha --color-villain-bg.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%"><rect width="100" height="100" fill="#E8E9E5"/><path d="M50 19a31 31 0 0 0 0 62z" fill="#285B70"/><path d="M50 19a31 31 0 0 1 0 62z" fill="#16141C"/></svg>`
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<body style="margin:0;overflow:hidden">${svg}</body>`)
  await page.screenshot({ path: new URL(`../public/${name}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1') })
}
await browser.close()
