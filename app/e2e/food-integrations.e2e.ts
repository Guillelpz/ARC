import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const EAN = '8480000118837'
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name }).click()
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const yogur = { status: 1, product: { product_name_es: 'Yogur natural', brands: 'Hacendado, Mercadona', nutriments: { 'energy-kcal_100g': 61.4, proteins_100g: 3.46, carbohydrates_100g: 4.7, fat_100g: 3.3 }, serving_quantity: 125, quantity: '4 x 125 g' } }

// Primero se aborta todo origen que no sea el de la app; las rutas concretas registradas después tienen prioridad.
async function guard(context: BrowserContext) {
  await context.route('**/*', route => (new URL(route.request().url()).hostname === 'localhost' ? route.continue() : route.abort()))
}
async function openBarcode(page: Page) {
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await page.getByRole('button', { name: 'Código de barras' }).click()
  await page.getByRole('button', { name: 'Entendido' }).click()
}

test('E-FI1 OFF simulado: revisar, guardar, añadir y recargar', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await guard(context)
  const seen: string[] = []
  await context.route('https://world.openfoodfacts.org/**', route => { seen.push(route.request().url()); return route.fulfill({ json: yogur, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }) })
  await openBarcode(page)
  await page.getByRole('textbox', { name: 'Código de barras' }).fill(EAN)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByRole('heading', { name: 'Revisar alimento' })).toBeVisible()
  await expect(page.getByLabel('Nombre')).toHaveValue('Yogur natural (Hacendado)')
  await expect(page.getByRole('link', { name: /Open Food Facts/ })).toBeVisible()
  expect(await noOverflow(page)).toBe(true)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  const diary = page.getByRole('region', { name: 'Diario' })
  await expect(diary.getByText('Yogur natural (Hacendado)')).toBeVisible()
  expect(seen.length).toBeGreaterThan(0)

  await page.reload()
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await expect(page.getByRole('region', { name: 'Diario' }).getByText('Yogur natural (Hacendado)')).toBeVisible()
  // el aviso ya está aceptado y el EAN guardado se resuelve sin red
  const before = seen.length
  await page.getByRole('button', { name: 'Código de barras' }).click()
  await page.getByRole('textbox', { name: 'Código de barras' }).fill(EAN)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Ya lo tienes: Yogur natural (Hacendado)')).toBeVisible()
  expect(seen.length).toBe(before)
})

test('E-FI2 sin conexión: alternativas y ninguna petición a OFF', async ({ page, context }) => {
  await guard(context)
  const seen: string[] = []
  page.on('request', r => { if (new URL(r.url()).hostname !== 'localhost') seen.push(r.url()) })
  await openBarcode(page)
  await context.setOffline(true)
  await page.getByRole('textbox', { name: 'Código de barras' }).fill(EAN)
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Sin conexión. Puedes crearlo a mano')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear a mano' })).toBeVisible()
  expect(seen).toEqual([])
})

test('E-FI3 foto de la etiqueta con Haiku simulado: revisar, guardar y añadir', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await guard(context)
  await page.addInitScript(() => localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000'))
  const label = { readable: true, name: 'Galletas', ean: '', per: '100g', servingQty: null, servingUnit: 'none', kcal: 450, kj: null, p: 6, c: 70, f: 16 }
  const bodies: string[] = []
  await context.route('https://api.anthropic.com/**', route => {
    const req = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    bodies.push(req.postData() ?? '')
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(label) }] }) })
  })
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await page.getByRole('button', { name: 'Foto de la etiqueta' }).click()
  await expect(page.getByRole('heading', { name: 'Privacidad de la foto' })).toBeVisible()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Entendido' }).click()
  await (await chooser).setFiles('e2e/fixtures/label.png')
  await expect(page.getByRole('heading', { name: 'Revisar alimento' })).toBeVisible()
  await expect(page.getByLabel('Nombre')).toHaveValue('Galletas')
  expect(await noOverflow(page)).toBe(true)
  expect(bodies).toHaveLength(1)
  const sent = JSON.parse(bodies[0]).messages[0].content[0].source
  expect(sent.media_type).toBe('image/jpeg')
  expect(sent.data.length).toBeGreaterThan(20)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Diario' }).getByText('Galletas')).toBeVisible()
})

// --- Escáner con cámara (ciclo 35): cámara falsa de Chromium (a nivel de archivo: launchOptions fuerza worker nuevo), ninguna petición fuera del origen de la app ---
test.use({ permissions: ['camera'], launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })
test.describe('escáner', () => {
  const openFood = async (page: Page) => {
    await page.goto('./')
    await nav(page, 'Yo')
    await page.getByRole('button', { name: /^Comida/ }).click()
  }

  test('E-FI4 cámara falsa y BarcodeDetector simulado: busca el EAN', async ({ page, context }) => {
    await guard(context)
    await context.route('https://world.openfoodfacts.org/**', route => route.fulfill({ json: yogur, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } }))
    await page.addInitScript(ean => {
      (window as unknown as Record<string, unknown>).BarcodeDetector = class {
        static getSupportedFormats() { return Promise.resolve(['ean_13']) }
        detect() { return Promise.resolve([{ rawValue: ean }]) }
      }
    }, EAN)
    await openBarcode(page)
    await page.getByRole('button', { name: 'Escanear con la cámara' }).click()
    await expect(page.getByRole('heading', { name: 'Revisar alimento' })).toBeVisible()
    await expect(page.getByLabel('Nombre')).toHaveValue('Yogur natural (Hacendado)')
  })

  test('E-FI5 al abrir Comida no se pide el wasm ni el chunk del escáner', async ({ page, context }) => {
    await guard(context)
    await openFood(page)
    await page.getByRole('button', { name: 'Código de barras' }).click()
    await expect(page.getByRole('heading', { name: 'Privacidad del código de barras' })).toBeVisible()
    const names = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name))
    expect(names.filter(n => /\.wasm|ponyfill|scanwasm/.test(n))).toEqual([])
  })

  test('E-FI6 sin BarcodeDetector nativo: el wasm sale del propio origen', async ({ page, context }) => {
    await guard(context)
    const urls: string[] = []
    page.on('request', r => urls.push(r.url()))
    await page.addInitScript(() => { delete (window as unknown as Record<string, unknown>).BarcodeDetector })
    await openBarcode(page)
    const wasm = page.waitForResponse(r => /\/ARC\/assets\/.*\.wasm$/.test(new URL(r.url()).pathname))
    await page.getByRole('button', { name: 'Escanear con la cámara' }).click()
    expect((await wasm).status()).toBe(200)
    await expect(page.getByText('Apunta al código de barras')).toBeVisible()
    expect(urls.filter(u => new URL(u).hostname !== 'localhost' && !u.startsWith('data:') && !u.startsWith('blob:'))).toEqual([])
  })
})
