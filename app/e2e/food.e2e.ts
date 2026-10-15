import { expect, test, type Page } from '@playwright/test'

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Principal' }).getByRole('button', { name }).click()
const noOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

test('E-FD1 a 320 px: objetivo, añadido rápido y alimento del catálogo; la fila «Hoy» y la recarga', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('./')
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Comida' })).toBeVisible()
  expect(await noOverflow(page)).toBe(true)

  await page.getByLabel(/^Calorías al día/).fill('2000')
  await page.getByRole('button', { name: 'Guardar objetivo' }).click()
  await expect(page.getByText('Cuenta en Dieta entre 1.800 y 2.200 kcal (90–110 %).')).toBeVisible()

  await page.getByRole('button', { name: 'Añadido rápido' }).click()
  await page.getByLabel(/^Calorías \(kcal\)/).fill('1000')
  await page.locator('#food-quick').getByRole('button', { name: 'Añadir' }).click()
  await expect(page.getByText('Añadido: Añadido rápido (1.000 kcal)')).toBeVisible()

  await page.getByLabel('Buscar alimento').fill('arroz')
  await page.getByRole('button', { name: /^Arroz blanco cocido/ }).click()
  await page.getByLabel('Cantidad').fill('700')
  await expect(page.getByText(/^910 kcal · /)).toBeVisible()
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()
  await expect(page.getByText('Añadido: Arroz blanco cocido 700 g (910 kcal) · Día dentro del objetivo: +1 Dieta')).toBeVisible()
  await expect(page.getByText('Dentro del objetivo: cuenta en Dieta')).toBeVisible()
  expect(await noOverflow(page)).toBe(true)

  await nav(page, 'Inicio')
  await expect(page.getByRole('button', { name: /^Comida.*1\.910 \/ 2\.000 kcal$/ })).toBeVisible()
  expect(await noOverflow(page)).toBe(true)

  await page.reload()
  await nav(page, 'Yo')
  await page.getByRole('button', { name: /^Comida/ }).click()
  const diary = page.getByRole('region', { name: 'Diario' })
  await expect(diary.getByText('910 kcal')).toBeVisible()
  await expect(diary.getByText('1.000 kcal')).toBeVisible()
  expect(await noOverflow(page)).toBe(true)
  await nav(page, 'HERO')
  await expect(page.getByRole('group', { name: 'Dieta' })).toBeVisible()
})
