// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { exportBackup, unlockStorage } from './core/storage'

const EV = 'life-rpg-demo-v1', CU = 'life-rpg-custom-v1'
const stored = () => JSON.parse(localStorage.getItem(EV) ?? '[]')
beforeEach(() => {
  localStorage.clear(); unlockStorage()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
  window.scrollTo = vi.fn() as never
  window.confirm = vi.fn(() => false) // happy-dom no lo define
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

const importFile = (container: HTMLElement, text: string) =>
  fireEvent.change(container.querySelector('input[type=file]')!, { target: { files: [{ text: () => Promise.resolve(text) }] } })
const btn = (name: string | RegExp) => screen.getByRole('button', { name })

test('U5 exportar', () => {
  render(<App />)
  fireEvent.click(btn('Exportar copia'))
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
  expect(JSON.parse(localStorage.getItem('life-rpg-meta-v1')!).lastExportAt).toBeTruthy()
  expect(screen.getByText('Última copia: hoy.')).toBeTruthy()
})

test('U6 importar', async () => {
  const { container } = render(<App />)
  importFile(container, '{roto')
  expect(await screen.findByText('Ese archivo no es una copia válida de RPG Life Tracker.')).toBeTruthy()
  expect(stored()).toEqual([])
  const ev = [{ id: 'x1', trackerId: 'gym', amount: 1, occurredAt: '2026-10-05T09:00:00' }]
  const copia = exportBackup(ev, { trackers: [], proposals: [] }, 'x')
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  importFile(container, copia)
  await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1))
  expect(stored()).toEqual([])
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  importFile(container, copia)
  expect(await screen.findByText('Copia importada: 1 registros y 0 misiones nuevas.')).toBeTruthy()
  expect(stored()).toEqual(ev)
})

test('U7 borrar todo y U8 recuperar', () => {
  render(<App />)
  fireEvent.click(btn('Cargar ejemplo'))
  expect(stored()).toHaveLength(28)
  const confirm = vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(false)
  fireEvent.click(btn('Borrar todo'))
  expect(stored()).toHaveLength(28)
  confirm.mockReturnValueOnce(false).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar todo'))
  expect(stored()).toEqual([])
  expect(localStorage.getItem('life-rpg-demo-v1.backup.last')).not.toBeNull()
  confirm.mockReturnValueOnce(true)
  fireEvent.click(btn('Recuperar copia anterior'))
  expect(stored()).toHaveLength(28)
  expect(screen.getByText('Copia recuperada: 28 registros y 0 misiones nuevas.')).toBeTruthy()
})

const base = { id: 'custom-med', name: 'Meditar', branch: 'hero', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 20, custom: true }
const preload = () => {
  localStorage.setItem(CU, JSON.stringify({ trackers: [base], proposals: [] }))
  localStorage.setItem(EV, JSON.stringify([{ id: 'm1', trackerId: 'custom-med', amount: 1, occurredAt: '2026-10-06T09:00:00' }]))
}
const heroXp = () => screen.getByText(/^Lv\. \d+ · \d+ XP$/).textContent

test('U9 editar', () => {
  preload(); render(<App />); go('HERO')
  const xp = heroXp()
  fireEvent.click(btn('Editar Meditar'))
  const save = () => btn('Guardar') as HTMLButtonElement
  fireEvent.change(card('Meditar').getByLabelText(/^Nombre/), { target: { value: 'Gym' } })
  expect(save().disabled).toBe(true)
  fireEvent.change(card('Meditar').getByLabelText(/^Nombre/), { target: { value: 'Meditar mucho' } })
  fireEvent.change(card('Meditar').getByLabelText(/^Incremento/), { target: { value: '3' } })
  fireEvent.change(card('Meditar').getByLabelText(/^Objetivo semanal .unidades/), { target: { value: '5' } })
  fireEvent.click(save())
  expect(JSON.parse(localStorage.getItem(CU)!).trackers[0]).toMatchObject({ name: 'Meditar mucho', increment: 3, buttonLabel: '+3 unidades', weeklyGoal: 5, xpPerUnit: 20 })
  expect(card('Meditar mucho').getByRole('button', { name: '+3 unidades' })).toBeTruthy()
  expect(card('Meditar mucho').getByText(/\/ 5 unidades esta semana/)).toBeTruthy()
  expect(heroXp()).toBe(xp)
})

test('U11 hoy', () => {
  render(<App />)
  expect(screen.getByText('Aún nada hoy.')).toBeTruthy()
  expect(screen.getByText('Te faltan · quedan 5 días')).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Gym 4 sesiones/ })).toBeTruthy()
  go('HERO')
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  go('Inicio')
  expect(screen.getByText('+30 HERO')).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Gym \+1 sesiones/ })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^Gym 3 sesiones/ }))
  expect(screen.getByRole('heading', { name: 'Misiones HERO' })).toBeTruthy()
})

test('U10 archivar y reactivar', () => {
  preload(); render(<App />); go('HERO')
  const xp = heroXp()
  fireEvent.click(btn('Editar Meditar'))
  fireEvent.click(btn('Archivar'))
  expect(screen.queryByRole('group', { name: 'Meditar' })).toBeNull()
  expect(heroXp()).toBe(xp)
  go('Inicio')
  expect(screen.getByText('Archivadas')).toBeTruthy()
  fireEvent.click(btn('Reactivar Meditar'))
  go('HERO')
  expect(screen.getByRole('group', { name: 'Meditar' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(CU)!).trackers[0].archived).toBe(false)
})
