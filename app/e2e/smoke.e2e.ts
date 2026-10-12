import { createRequire } from 'node:module'
import { expect, test, type Page } from '@playwright/test'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name }).click()

async function loadExample(page: Page) {
  await page.goto('./')
  await expect(page.getByText('Empieza tu historial')).toBeVisible()
  await page.getByRole('button', { name: 'Cargar ejemplo' }).click()
}

test('E1 flujo principal y persistencia', async ({ page }) => {
  await loadExample(page)
  await nav(page, 'HERO')
  const gym = page.getByRole('group', { name: 'Gym' })
  const xpOf = gym.getByText(/^\d+ XP$/)
  await expect(xpOf).toBeVisible()
  const before = Number((await xpOf.textContent())!.match(/\d+/)![0])
  await gym.getByRole('button', { name: '+1 sesiones', exact: true }).click()
  await expect(xpOf).toHaveText(`${before + 30} XP`)
  await page.reload()
  await nav(page, 'HERO')
  await expect(xpOf).toHaveText(`${before + 30} XP`)
})

test('E3 axe con contraste', async ({ page }) => {
  await loadExample(page)
  const path = createRequire(import.meta.url).resolve('axe-core/axe.min.js')
  for (const [screen, heading] of [['Inicio', /PLAYER/], ['HERO', /Misiones/], ['VILLAIN', /Misiones/], ['Yo', /^Yo$/], ['Gym', /^Gym$/]] as const) {
    if (screen === 'Gym') await page.getByRole('button', { name: /^Gym/ }).click()
    else await nav(page, screen)
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await page.addScriptTag({ path })
    const bad = await page.evaluate(async () => {
      // @ts-expect-error axe lo inyecta addScriptTag
      const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
      return r.violations.filter((v: { impact: string }) => v.impact === 'serious' || v.impact === 'critical')
        .map((v: { id: string; nodes: { target: unknown }[] }) => `${v.id}: ${v.nodes.map(n => JSON.stringify(n.target)).join(' ')}`)
    })
    expect(bad, `${screen}: ${bad.join('\n')}`).toEqual([])
  }
})

test('E2 recarga sin red tras la primera visita', async ({ page, context, request }) => {
  await page.goto('./')
  expect((await request.get('manifest.webmanifest')).status()).toBe(200)
  await page.waitForFunction(() => navigator.serviceWorker.controller)
  await page.getByRole('button', { name: 'Cargar ejemplo' }).click()
  await context.setOffline(true)
  // Comprobación previa: sin esto, el test pasaría aunque el service worker conservara la red.
  expect(await page.evaluate(() => fetch('./nada-' + Date.now()).then(() => 'red', () => 'sin red'))).toBe('sin red')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Tus datos' })).toBeVisible()
  await expect(page.getByText('Empieza tu historial')).toBeHidden()
  await nav(page, 'HERO')
  await expect(page.getByRole('group', { name: 'Gym' })).toBeVisible()
})

test('E5 la barra de 6 pestañas cabe a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('./')
  const buttons = page.getByRole('navigation', { name: 'Principal' }).getByRole('button')
  await expect(buttons).toHaveCount(6)
  for (let i = 0; i < 6; i++) {
    const b = buttons.nth(i)
    const m = await b.evaluate(el => {
      const l = el.querySelector('[data-label]')!, lr = l.getBoundingClientRect(), br = el.getBoundingClientRect()
      return { fits: l.scrollWidth <= l.clientWidth, inside: lr.left >= br.left - 0.5 && lr.right <= br.right + 0.5, text: l.textContent }
    })
    expect(m, `etiqueta ${m.text}`).toMatchObject({ fits: true, inside: true })
  }
})

test('E4 registrar una serie a 320 px y recargar', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('./') // sin ejemplo: el de hoy ya trae una sesión de Gym y no se apuntaría otra
  const xp = async () => {
    await nav(page, 'HERO')
    const t = await page.getByRole('group', { name: 'Gym' }).getByText(/^\d+ XP$/).textContent()
    return Number(t!.match(/\d+/)![0])
  }
  const before = await xp()
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await page.getByLabel(/^Peso \(/).fill('60')
  await page.getByLabel('Repeticiones').fill('8')
  await page.getByRole('button', { name: 'Registrar serie' }).click()
  await expect(page.getByText('Serie 1 · 60 kg × 8')).toBeVisible()
  expect(await xp()).toBe(before + 30)
  await page.reload()
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await expect(page.getByText('Serie 1 · 60 kg × 8')).toBeVisible()
})

test('E6 rutina: guardar, recargar y cargar; Gym a 320 px sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Gym/ }).click()
  await page.getByLabel(/^Peso \(/).fill('60')
  await page.getByLabel('Repeticiones').fill('8')
  await page.getByRole('button', { name: 'Registrar serie' }).click()
  await expect(page.getByText('Serie 1 · 60 kg × 8')).toBeVisible()
  await page.getByLabel('Nombre de la rutina').fill('Push day')
  await page.getByRole('button', { name: 'Guardar rutina' }).click()
  await expect(page.getByRole('button', { name: 'Cargar rutina Push day' })).toBeVisible()
  await page.reload()
  await nav(page, 'Yo')
  await expect(page.getByRole('heading', { level: 1, name: 'Yo' })).toBeVisible()
  await page.getByRole('button', { name: /^Gym/ }).click()
  await page.getByRole('button', { name: 'Cargar rutina Push day' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Rutina: Push day' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Press banca · 1/1 series' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  const small = await page.getByRole('button', { name: /^(Cargar|Borrar) rutina Push day$/ }).evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
  expect(Math.min(...small)).toBeGreaterThanOrEqual(44)
})
