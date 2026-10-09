// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import App from './App'
import { unlockStorage } from './core/storage'
import { liveText } from './components/liveText'

beforeEach(() => {
  localStorage.clear(); unlockStorage()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
  window.scrollTo = vi.fn() as never
  window.confirm = vi.fn(() => false)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

const go = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name }))
const example = () => fireEvent.click(screen.getByRole('button', { name: 'Cargar ejemplo' }))

async function serious() {
  const r = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
  return r.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' | ')}`)
}

test('A1 home vacía', async () => { render(<App />); expect(await serious()).toEqual([]) })
test('A2 home con ejemplo', async () => { render(<App />); example(); expect(await serious()).toEqual([]) })
test('A3 HERO', async () => { render(<App />); example(); go('HERO'); expect(await serious()).toEqual([]) })
test('A4 VILLAIN', async () => { render(<App />); example(); go('VILLAIN'); expect(await serious()).toEqual([]) })
test('A5 Nuevo', async () => { render(<App />); go('Nuevo'); expect(await serious()).toEqual([]) })
test('A6 Party', async () => { render(<App />); example(); go('Party'); expect(await serious()).toEqual([]) })

test('U19 liveText de banners', () => {
  const o = { key: 'k', party: 'X', names: ['Alex'], position: 2 }
  expect(liveText(null, o)).toBe('Adelantamiento: Superas a Alex · 2.º en X')
  expect(liveText(null, { ...o, lost: 'hero' })).toBe('Te adelantan: Alex te supera en HERO · 2.º en X')
})
