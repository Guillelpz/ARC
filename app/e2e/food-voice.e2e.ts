import { createRequire } from 'node:module'
import { expect, test, type Page, type Request } from '@playwright/test'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name }).click()

// Reconocimiento simulado: emite `window.__voz` como resultado final a los 50 ms.
async function fakeSpeech(page: Page) {
  await page.addInitScript(() => {
    class Fake {
      lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
      onstart: (() => void) | null = null; onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
      start() {
        this.onstart?.()
        setTimeout(() => {
          const t = (window as unknown as { __voz?: string }).__voz ?? ''
          this.onresult?.({ results: [Object.assign([{ transcript: t }], { isFinal: true })] }); this.onend?.()
        }, 50)
      }
      stop() {}; abort() {}
    }
    const w = window as unknown as Record<string, unknown>
    w.webkitSpeechRecognition = Fake; w.SpeechRecognition = Fake
  })
}
const say = (page: Page, text: string) => page.evaluate(t => { (window as unknown as { __voz: string }).__voz = t }, text)

// Ninguna petición sale a la API real: se aborta y el test cuenta las llamadas.
async function anthropic(page: Page) {
  const calls: Request[] = []
  await page.route('https://api.anthropic.com/**', route => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' } })
    calls.push(req)
    return route.abort()
  })
  return calls
}

async function axe(page: Page, label: string) {
  await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') })
  const bad = await page.evaluate(async () => {
    // @ts-expect-error axe lo inyecta addScriptTag
    const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
    return r.violations.filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
      .map((v: { id: string; nodes: { target: unknown }[] }) => `${v.id}: ${v.nodes.map(n => JSON.stringify(n.target)).join(' ')}`)
  })
  expect(bad, `${label}: ${bad.join('\n')}`).toEqual([])
}

test('E-FV1 «+» a 320 px sin clave: «200 gramos de arroz y dos huevos» queda en Comida, recarga, diario con 2 filas y 0 llamadas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const calls = await anthropic(page)
  await fakeSpeech(page)
  await page.addInitScript(() => { if (!localStorage.getItem('life-rpg-voice-v1')) localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' })) })
  await page.goto('./')
  await say(page, '200 gramos de arroz y dos huevos')
  await page.getByRole('button', { name: 'Apuntar por voz' }).click()
  await expect(page.getByText(/^Registrado en Comida: 2 alimentos · 403 kcal/)).toBeVisible()
  await expect(page.getByText('Arroz blanco cocido · 200 g · 260 kcal')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await axe(page, 'tarjeta de comida')
  await page.reload()
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Comida' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diario' }).getByRole('button', { name: /^Deshacer/ })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(calls).toHaveLength(0)
})

test('E-FV2 «Dictar comida» en Comida con el selector en «Ayer»: queda en ayer, no en hoy, a 320 px y sin llamadas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const calls = await anthropic(page)
  await fakeSpeech(page)
  await page.addInitScript(() => { if (!localStorage.getItem('life-rpg-voice-v1')) localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' })) })
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await page.getByRole('button', { name: 'Ayer' }).click()
  await say(page, '200 gramos de arroz y dos huevos')
  await page.getByRole('button', { name: 'Dictar comida' }).click()
  await expect(page.getByText(/^Registrado en Comida: 2 alimentos · 403 kcal/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diario' }).getByRole('button', { name: /^Deshacer/ })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await axe(page, 'Comida con Por voz')
  await page.getByRole('button', { name: 'Hoy' }).click()
  await expect(page.getByRole('region', { name: 'Diario' }).getByText('Nada apuntado este día.')).toBeVisible()
  expect(calls).toHaveLength(0)
})

test('E-FV3 con clave y Haiku interceptado: «Estimación» a 320 px, nada guardado hasta «Apuntar», axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await fakeSpeech(page)
  await page.addInitScript(() => {
    if (!localStorage.getItem('life-rpg-voice-v1')) localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
    localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
  })
  const food = { name: 'bocadillo de calamares', amount: 1, unit: 'serving', servingWord: 'bocadillo', base: 'g', kcal100: 260, p100: 10, c100: 30, f100: 10, typicalQty: 200 }
  const reply = { kind: 'food', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
    name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '', foods: [food] }
  let calls = 0
  await page.route('https://api.anthropic.com/**', route => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    calls++
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] }) })
  })
  await page.goto('./')
  await say(page, 'un bocadillo de calamares')
  await page.getByRole('button', { name: 'Apuntar por voz' }).click()
  await expect(page.getByText('Estimación', { exact: true })).toBeVisible()
  await expect(page.getByText('Revisa la propuesta: no se ha apuntado nada.')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await axe(page, 'fila Estimación')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('life-rpg-food-v1') ?? '{"log":[]}').log.length)).toBe(0)
  await page.getByRole('button', { name: /^Apuntar Bocadillo de calamares/ }).click()
  await expect(page.getByText(/^Registrado en Comida: 1 alimento · 520 kcal/)).toBeVisible()
  expect(calls).toBe(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
