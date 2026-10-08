// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { unlockStorage } from './core/storage'

const EV = 'life-rpg-demo-v1'
const stored = () => JSON.parse(localStorage.getItem(EV) ?? '[]')
beforeEach(() => {
  localStorage.clear(); unlockStorage()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
  window.scrollTo = vi.fn() as never
  let n = 0; vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` as never)
  URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

const go = (name: string) => fireEvent.click(within(screen.getByRole('navigation', { name: 'Principal' })).getByRole('button', { name }))
const card = (name: string) => within(screen.getByRole('group', { name }))

test('U1 registrar hoy', () => {
  render(<App />); go('HERO')
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  const ev = stored()
  expect(ev).toHaveLength(1)
  expect(ev[0]).toMatchObject({ trackerId: 'gym', amount: 1 })
  expect(ev[0].occurredAt.startsWith('2026-10-07')).toBe(true)
  expect(card('Gym').getByText('1')).toBeTruthy()
  expect(card('Gym').getByText(/\/ 4 sesiones esta semana/)).toBeTruthy()
})

test('U2 día pasado', () => {
  render(<App />); go('HERO')
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones · ayer' }))
  expect(stored()[0].occurredAt.startsWith('2026-10-06')).toBe(true)
  const day = screen.getByLabelText('Elegir día')
  fireEvent.change(day, { target: { value: '2026-09-30' } })
  fireEvent.click(card('Gym').getByRole('button', { name: /^\+1 sesiones · / }))
  expect(stored()[1].occurredAt.startsWith('2026-09-30')).toBe(true)
  fireEvent.change(day, { target: { value: '2026-10-10' } })
  expect(screen.getByRole('button', { name: 'Hoy' }).getAttribute('aria-pressed')).toBe('true')
})

test('U3 corrección', () => {
  render(<App />); go('HERO')
  const minus = () => card('Gym').getByRole('button', { name: 'Restar 1 sesiones a Gym' }) as HTMLButtonElement
  expect(minus().disabled).toBe(true)
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  expect(minus().disabled).toBe(false)
  fireEvent.click(minus())
  expect(stored()[1].amount).toBe(-1)
  expect(minus().disabled).toBe(true)
})

test('U4 deshacer', () => {
  render(<App />); go('HERO')
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  fireEvent.click(card('Gym').getByText('Últimos registros'))
  fireEvent.click(card('Gym').getByRole('button', { name: 'Deshacer 1 sesiones de Hoy' }))
  const ev = stored()
  expect(ev[1]).toMatchObject({ amount: -1, undoes: ev[0].id })
  expect(card('Gym').getAllByText('deshecho').length).toBeGreaterThan(0)
  expect(card('Gym').queryByRole('button', { name: /^Deshacer/ })).toBeNull()
})
