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

const net = (page: Page, id: string) => page.evaluate(t => (JSON.parse(localStorage.getItem('life-rpg-demo-v1') ?? '[]') as { trackerId: string; amount: number }[])
  .filter(e => e.trackerId === t).reduce((n, e) => n + e.amount, 0), id)

test('E10 captura a 320 px: «+», hábito nuevo propuesto, creado, recarga y axe', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ kind: 'new', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1,
    trackerId: 'none', amount: 30, amountUnit: 'min', unitWord: 'min', name: 'Grounding', branch: 'hero', confidence: 'media', type: 'duration', customUnit: '', reason: 'Bienestar mental' }) }] }
  await anthropic(page, reply)
  await fakeSpeech(page)
  await page.addInitScript(() => localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000'))
  await page.goto('./')
  await say(page, 'grounding 30 min')
  await page.getByRole('button', { name: 'Apuntar por voz' }).click()
  await expect(page.getByRole('heading', { name: 'Privacidad de la voz' })).toBeVisible()
  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByRole('heading', { name: 'Propuesta: HERO' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await axe(page, 'propuesta')
  await page.getByRole('button', { name: 'Crear y apuntar' }).click()
  await expect(page.getByText(/^Creada: Grounding \(HERO\) · \+30 min\.$/)).toBeVisible()
  await page.reload()
  await nav(page, 'HERO')
  await expect(page.getByRole('group', { name: 'Grounding' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('E11 pestaña «Nuevo» sin clave: «¿Apuntar en Burgers?» → Apuntar → Burgers +1 y ninguna llamada a la IA', async ({ page }) => {
  const calls = await anthropic(page)
  await fakeSpeech(page)
  await page.addInitScript(() => localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' })))
  await page.goto('./')
  await say(page, 'eat a burguer')
  await nav(page, 'Nuevo')
  await expect(page.getByText(/^¿Apuntar en Burgers\?/)).toBeVisible()
  await page.getByRole('button', { name: 'Apuntar', exact: true }).click()
  await expect(page.getByText(/^Registrado: Burgers · \+1 unidad/)).toBeVisible()
  expect(await net(page, 'burgers')).toBe(1)
  expect(calls).toHaveLength(0)
})
