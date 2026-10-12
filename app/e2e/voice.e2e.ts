import { createRequire } from 'node:module'
import { expect, test, type Page, type Request } from '@playwright/test'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name }).click()
const KEY = 'sk-ant-test-0000000000000000'

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

// Ninguna petición sale a la API real: por defecto se aborta (y el test lo ve en `calls`); `reply` responde con un JSON.
async function anthropic(page: Page, reply?: unknown) {
  const calls: Request[] = []
  await page.route('https://api.anthropic.com/**', route => {
    const req = route.request()
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST' }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    calls.push(req)
    if (reply === undefined) return route.abort()
    return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(reply) })
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

test('E7 voz en Gym a 320 px: serie guardada, recarga, Deshacer; sin clave no hay llamadas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const calls = await anthropic(page)
  await fakeSpeech(page)
  await page.goto('./')
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await say(page, '80 kilos press banca 5 repeticiones')
  await page.getByRole('button', { name: 'Dictar serie' }).click()
  await expect(page.getByRole('heading', { name: 'Privacidad de la voz' })).toBeVisible()
  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText(/^Registrado: Press banca · 80 kg × 5/)).toBeVisible()
  await expect(page.getByText('Serie 1 · 80 kg × 5')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.reload()
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await expect(page.getByText('Serie 1 · 80 kg × 5')).toBeVisible()
  await page.getByRole('button', { name: /^Deshacer serie 1 de Press banca/ }).click()
  await expect(page.getByText('No hay series este día.')).toBeVisible()
  expect(calls).toHaveLength(0)
})

test('E8 con clave, la IA resuelve la frase desde Hoy', async ({ page }) => {
  const reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ exerciseId: 'squat', weight: 100, unit: 'none', reps: 5, sets: 1 }) }] }
  const calls = await anthropic(page, reply)
  await fakeSpeech(page)
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByLabel('Clave', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await expect(page.getByText('Clave guardada: termina en 0000')).toBeVisible()
  await nav(page, 'Inicio')
  await say(page, 'agachadas con cien kilos cinco veces')
  await page.getByRole('button', { name: 'Dictar serie' }).click()
  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText(/^Registrado: Sentadilla · 100 kg × 5/)).toBeVisible()
  expect(calls).toHaveLength(1)
  const h = calls[0].headers()
  expect(h['x-api-key']).toBe(KEY)
  expect(h['anthropic-dangerous-direct-browser-access']).toBe('true')
})

test('E9 axe en Gym con la tarjeta del resultado y en Yo con la clave guardada', async ({ page }) => {
  await anthropic(page)
  await fakeSpeech(page)
  await page.goto('./')
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await say(page, 'press banca 80 kg 5 reps')
  await page.getByRole('button', { name: 'Dictar serie' }).click()
  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText(/^Registrado:/)).toBeVisible()
  await axe(page, 'Gym con resultado')
  await nav(page, 'Yo')
  await page.getByLabel('Clave', { exact: true }).fill(KEY)
  await page.getByRole('button', { name: 'Guardar clave' }).click()
  await expect(page.getByText('Clave guardada: termina en 0000')).toBeVisible()
  await axe(page, 'Yo con clave')
})
