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
  expect(card('Gym').getByText(/\/ 4 sesiones esta semana/).textContent).toMatch(/^1 \/ 4 sesiones esta semana/)
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
  await vi.waitFor(() => expect(stored()).toEqual(ev))
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

const streakEvents = () => {
  const wk = (mon: string, n: number) => Array.from({ length: n }, (_, i) => {
    const d = new Date(mon + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + i)
    return { id: `${mon}-${i}`, trackerId: 'gym', amount: 1, occurredAt: `${d.toISOString().slice(0, 10)}T10:00:00` }
  })
  localStorage.setItem(EV, JSON.stringify([...wk('2026-09-21', 4), ...wk('2026-09-28', 4), ...wk('2026-10-05', 2)]))
}

test('U12 racha', () => {
  streakEvents(); render(<App />); go('HERO')
  expect(card('Gym').getByText('Racha: 2 semanas')).toBeTruthy()
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  expect(card('Gym').getByText('Racha: 3 semanas')).toBeTruthy()
  go('Inicio')
  expect(screen.getByText('Mejor racha: Gym · 3 semanas')).toBeTruthy()
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

test('U13 objetivo de fijas', () => {
  render(<App />); go('HERO')
  const xp = heroXp()
  const edit = (v: string) => {
    fireEvent.click(btn('Editar objetivo de Gym'))
    expect(screen.queryByText('Nombre')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull()
    fireEvent.change(card('Gym').getAllByRole('spinbutton')[0], { target: { value: v } })
    fireEvent.click(btn('Guardar'))
  }
  edit('2')
  expect(JSON.parse(localStorage.getItem(CU)!).goals).toEqual({ gym: 2 })
  expect(card('Gym').getByText(/\/ 2 sesiones esta semana/)).toBeTruthy()
  expect(heroXp()).toBe(xp)
  edit('')
  expect(JSON.parse(localStorage.getItem(CU)!).goals?.gym).toBeUndefined()
  expect(card('Gym').getByText(/\/ 4 sesiones esta semana/)).toBeTruthy()
  go('VILLAIN')
  expect(screen.queryByRole('button', { name: 'Editar objetivo de Beer' })).toBeNull()
})

const custom = () => JSON.parse(localStorage.getItem(CU)!)

test('U19 registro de objetivos: fija', async () => {
  render(<App />); go('HERO')
  const edit = (v: string) => {
    fireEvent.click(btn('Editar objetivo de Gym'))
    fireEvent.change(card('Gym').getAllByRole('spinbutton')[0], { target: { value: v } })
    fireEvent.click(btn('Guardar'))
  }
  const entry = { trackerId: 'gym', goal: 4, until: '2026-10-05' }
  edit('3')
  await vi.waitFor(() => { expect(custom().goals).toEqual({ gym: 3 }); expect(custom().goalLog).toEqual([entry]) })
  edit('')
  await vi.waitFor(() => { expect(custom()).not.toHaveProperty('goals'); expect(custom().goalLog).toEqual([entry]) })
})

test('U19 registro de objetivos: propia', async () => {
  preload(); render(<App />); go('HERO')
  fireEvent.click(btn('Editar Meditar'))
  fireEvent.change(card('Meditar').getByLabelText(/^Objetivo semanal .unidades/), { target: { value: '5' } })
  fireEvent.click(btn('Guardar'))
  await vi.waitFor(() => {
    expect(custom().goalLog).toContainEqual({ trackerId: 'custom-med', goal: null, until: '2026-10-05' })
    expect(custom().trackers[0]).not.toHaveProperty('pastGoals')
  })
})

test('U15 ranking prorrateado', () => {
  render(<App />)
  fireEvent.click(btn('Cargar ejemplo')); go('Party')
  expect(screen.getByText('Amigos: su ritmo de la semana hasta hoy.')).toBeTruthy()
  expect(document.querySelector('ol li')!.getAttribute('aria-current')).toBe('true')
  expect(screen.getByText(/221 XP/)).toBeTruthy()
})

test('U14 proponer actividad existente', () => {
  const pizza = { ...base, id: 'custom-pizza', name: 'Pizza', branch: 'villain', unit: 'porciones', xpPerUnit: 15 }
  localStorage.setItem(CU, JSON.stringify({ trackers: [base, pizza], proposals: [{ trackerId: 'custom-pizza', partyId: 'la-oficina', proposedAt: '2026-10-06T09:00:00' }] }))
  render(<App />); go('HERO')
  expect(card('Gym').queryByRole('button', { name: /^Proponer/ })).toBeNull()
  fireEvent.click(btn('Proponer Meditar a una party'))
  fireEvent.click(card('Meditar').getByLabelText('La Oficina'))
  fireEvent.click(card('Meditar').getByRole('button', { name: 'Proponer' }))
  expect(JSON.parse(localStorage.getItem(CU)!).proposals).toContainEqual(expect.objectContaining({ trackerId: 'custom-med', partyId: 'la-oficina' }))
  expect(card('Meditar').getByText('Aceptada en La Oficina · 3/3')).toBeTruthy()
  expect(card('Meditar').getByText(/Cuenta en: La Oficina/)).toBeTruthy()
  fireEvent.click(btn('Proponer Meditar a una party'))
  expect(card('Meditar').queryByLabelText('La Oficina')).toBeNull()
  fireEvent.click(card('Meditar').getByLabelText('Los del Gym'))
  fireEvent.click(card('Meditar').getByRole('button', { name: 'Proponer' }))
  expect(card('Meditar').queryByRole('button', { name: /^Proponer/ })).toBeNull()
  go('VILLAIN')
  expect(card('Pizza').getByText('Rechazada en La Oficina · 1/3')).toBeTruthy()
  fireEvent.click(btn('Proponer Pizza a una party'))
  expect(card('Pizza').getByLabelText('Los del Gym')).toBeTruthy()
  expect(card('Pizza').queryByLabelText('La Oficina')).toBeNull()
})

test('U16 archivar guarda cambios válidos', () => {
  preload(); render(<App />); go('HERO')
  fireEvent.click(btn('Editar Meditar'))
  fireEvent.change(card('Meditar').getByLabelText(/^Nombre/), { target: { value: 'Meditar zen' } })
  fireEvent.click(btn('Archivar'))
  expect(JSON.parse(localStorage.getItem(CU)!).trackers[0]).toMatchObject({ name: 'Meditar zen', archived: true })
  go('Inicio')
  fireEvent.click(btn('Reactivar Meditar zen'))
  go('HERO')
  fireEvent.click(btn('Editar Meditar zen'))
  fireEvent.change(card('Meditar zen').getByLabelText(/^Nombre/), { target: { value: '' } })
  fireEvent.click(btn('Archivar'))
  expect(JSON.parse(localStorage.getItem(CU)!).trackers[0]).toMatchObject({ name: 'Meditar zen', archived: true })
})

test('U17 duplicado de archivada en Nuevo', () => {
  localStorage.setItem(CU, JSON.stringify({ trackers: [{ ...base, archived: true }], proposals: [] }))
  render(<App />); go('Nuevo')
  fireEvent.change(screen.getByLabelText('¿Qué has hecho?'), { target: { value: 'meditar' } })
  expect(screen.getByText(/Ya tienes «Meditar» \(archivada\)/)).toBeTruthy()
  expect((screen.getByRole('button', { name: /Analizar con IA/ }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('button', { name: /^Sumar a/ })).toBeNull()
  fireEvent.click(btn('Reactivar Meditar'))
  expect(screen.getByRole('heading', { name: 'Misiones HERO' })).toBeTruthy()
  expect(screen.getByRole('group', { name: 'Meditar' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(CU)!).trackers[0].archived).toBe(false)
})

test('U18 región status del level-up', () => {
  render(<App />); go('HERO')
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  expect(screen.getByRole('status').textContent).toMatch(/^LEVEL UP\. .*Gym Lv\. 2/)
  expect(document.querySelector('.levelup-backdrop')!.getAttribute('aria-hidden')).toBe('true')
  expect(document.querySelector('.levelup-backdrop[aria-live]')).toBeNull()
})
