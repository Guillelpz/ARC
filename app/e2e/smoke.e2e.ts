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
  for (const [screen, heading] of [['Inicio', /PLAYER/], ['HERO', /Misiones/], ['VILLAIN', /Misiones/]] as const) {
    await nav(page, screen)
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
