// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { exportBackup, unlockStorage } from './core/storage'
import { SAVE_FAIL_TEXT } from './components/SaveFailBanner'
import { STALE_TAB_TEXT } from './components/UpdateBanner'

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
  fireEvent.click(card('Gym').getByRole('button', { name: 'Deshacer 1 sesión de Hoy' }))
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

const mergeFile = (container: HTMLElement, text: string) => { fireEvent.click(btn('Importar y fusionar')); importFile(container, text) }
const x1 = { id: 'x1', trackerId: 'gym', amount: 1, occurredAt: '2026-10-05T09:00:00' }
const x2 = { id: 'x2', trackerId: 'bjj', amount: 1, occurredAt: '2026-10-06T09:00:00' }
const seedX1 = () => localStorage.setItem(EV, JSON.stringify([x1]))

test('U-F1 fusionar', async () => {
  seedX1()
  const { container } = render(<App />)
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  mergeFile(container, exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x'))
  expect(await screen.findByText('Copia fusionada: 1 registros y 0 misiones nuevas.')).toBeTruthy()
  expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('1 registros nuevos (1 ya estaban)')
  await vi.waitFor(() => expect(stored()).toEqual([x1, x2]))
  expect(localStorage.getItem(EV + '.backup.last')).not.toBeNull()
})

test('U-F2 fusionar cancelado', async () => {
  seedX1()
  const { container } = render(<App />)
  mergeFile(container, exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x'))
  await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1))
  expect(stored()).toEqual([x1])
  expect(localStorage.getItem(EV + '.backup.last')).toBeNull()
})

test('U-F3 fusionar dos veces', async () => {
  seedX1()
  const { container } = render(<App />)
  const copia = exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x')
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  mergeFile(container, copia)
  await screen.findByText(/^Copia fusionada/)
  mergeFile(container, copia)
  expect(await screen.findByText(/^Esa copia no trae nada nuevo/)).toBeTruthy()
  expect(window.confirm).toHaveBeenCalledTimes(1)
})

test('U-F4 fusionar y recuperar', async () => {
  seedX1()
  const { container } = render(<App />)
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  mergeFile(container, exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x'))
  await screen.findByText(/^Copia fusionada/)
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  fireEvent.click(btn('Recuperar copia anterior'))
  await vi.waitFor(() => expect(stored()).toEqual([x1]))
})

const shareEnv = (canShare: boolean, share: () => Promise<void>) => {
  window.matchMedia = vi.fn(() => ({ matches: true })) as never
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => canShare })
  Object.defineProperty(navigator, 'share', { configurable: true, value: vi.fn(share) })
}
const lastExport = () => JSON.parse(localStorage.getItem('life-rpg-meta-v1') ?? '{}').lastExportAt
afterEach(() => { delete (navigator as never as Record<string, unknown>).canShare; delete (navigator as never as Record<string, unknown>).share; delete (window as never as Record<string, unknown>).matchMedia })

test('U-S1 compartir', async () => {
  shareEnv(true, () => Promise.resolve())
  render(<App />)
  fireEvent.click(btn('Exportar copia'))
  await vi.waitFor(() => expect(lastExport()).toBeTruthy())
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

test('U-S2 compartir cancelado', async () => {
  shareEnv(true, () => Promise.reject(new DOMException('x', 'AbortError')))
  render(<App />)
  fireEvent.click(btn('Exportar copia'))
  expect(await screen.findByText('No se ha exportado la copia.')).toBeTruthy()
  expect(lastExport()).toBeUndefined()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

test('U-S3 compartir sin permiso cae a descarga', async () => {
  shareEnv(true, () => Promise.reject(new DOMException('x', 'NotAllowedError')))
  render(<App />)
  fireEvent.click(btn('Exportar copia'))
  await vi.waitFor(() => expect(lastExport()).toBeTruthy())
  expect(URL.createObjectURL).toHaveBeenCalled()
})

test('U-S4 sin canShare descarga', async () => {
  shareEnv(false, () => Promise.resolve())
  render(<App />)
  fireEvent.click(btn('Exportar copia'))
  await vi.waitFor(() => expect(lastExport()).toBeTruthy())
  expect(URL.createObjectURL).toHaveBeenCalled()
  expect(navigator.share).not.toHaveBeenCalled()
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

test('U-W1 tendencia semanal', () => {
  streakEvents(); render(<App />); go('HERO')
  expect(card('Gym').getByText('Últimas 8 semanas')).toBeTruthy()
  expect(card('Gym').getByText(/^Semana del 28 sep.*: 4 de 4 sesiones, cumplida$/)).toBeTruthy()
  expect(card('Gym').getByText(/^Semana del 5 oct.* \(en curso\): 2 de 4 sesiones$/)).toBeTruthy()
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

test('U20 guardado fallido', async () => {
  render(<App />); go('HERO')
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  await vi.waitFor(() => {
    expect(screen.getAllByText(SAVE_FAIL_TEXT).length).toBeGreaterThan(0)
    expect(screen.getByRole('status').textContent).toBe(SAVE_FAIL_TEXT)
  })
  go('Inicio')
  fireEvent.click(screen.getByRole('button', { name: 'Exportar copia ahora' }))
  expect(URL.createObjectURL).toHaveBeenCalled()
  spy.mockRestore()
  go('HERO')
  fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  await vi.waitFor(() => {
    expect(screen.queryAllByText(SAVE_FAIL_TEXT)).toHaveLength(0)
    expect(stored()).toHaveLength(2)
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

test('U21 registrar desde la home', async () => {
  render(<App />)
  fireEvent.click(btn('+1 sesión en Gym'))
  await vi.waitFor(() => expect(stored()).toHaveLength(1))
  expect(stored()[0]).toMatchObject({ trackerId: 'gym', amount: 1 })
  expect(stored()[0].occurredAt.startsWith('2026-10-07')).toBe(true)
  expect(screen.getByText('+30 HERO')).toBeTruthy()
  expect(btn(/^Gym 3 sesiones/)).toBeTruthy()
  expect(btn(/^Gym \+1 sesiones/)).toBeTruthy()
  fireEvent.click(btn('+1 sesión en Gym'))
  expect(screen.getByRole('status').textContent).toMatch(/Gym Lv\. 2/)
  fireEvent.click(btn(/^Gym 2 sesiones/))
  expect(screen.getByRole('heading', { name: 'Misiones HERO' })).toBeTruthy()
})

test('U22 cumplir el objetivo desde la home', async () => {
  localStorage.setItem(EV, JSON.stringify(['2026-10-05', '2026-10-06', '2026-10-06'].map((d, i) => ({ id: `g${i}`, trackerId: 'gym', amount: 1, occurredAt: `${d}T10:00:00` }))))
  render(<App />)
  fireEvent.click(btn('+1 sesión en Gym'))
  expect(screen.queryByRole('button', { name: /^Gym 1 sesiones/ })).toBeNull()
  expect(screen.queryByRole('button', { name: '+1 sesión en Gym' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hoy' }))
  await vi.waitFor(() => expect(stored()).toHaveLength(4))
})

test('U23 deshacer desde la home', async () => {
  const plus = () => fireEvent.click(screen.getByRole('button', { name: '+1 sesión en Gym' }))
  const undoBtn = () => screen.getByRole('button', { name: 'Deshacer +1 sesión en Gym' })
  render(<App />)
  plus(); fireEvent.click(undoBtn())
  await vi.waitFor(() => expect(stored()).toHaveLength(2))
  expect(stored()[1]).toMatchObject({ amount: -1, undoes: stored()[0].id })
  expect(screen.getByText('Aún nada hoy.')).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hoy' }))
  cleanup(); localStorage.clear()
  render(<App />)
  plus(); plus(); fireEvent.click(undoBtn())
  await vi.waitFor(() => expect(stored()).toHaveLength(3))
  expect(screen.getByRole('button', { name: /^Gym \+1 sesiones/ })).toBeTruthy()
  expect(undoBtn()).toBeTruthy()
  cleanup(); localStorage.clear()
  localStorage.setItem(EV, JSON.stringify([
    { id: 'a', trackerId: 'gym', amount: 2, occurredAt: '2026-10-07T09:00:00' },
    { id: 'b', trackerId: 'gym', amount: -1, occurredAt: '2026-10-07T10:00:00' }]))
  render(<App />)
  expect(screen.getByRole('button', { name: /^Gym \+1 sesiones/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Deshacer/ })).toBeNull()
})

test('U-HV1 HERO contra VILLAIN en la home', () => {
  render(<App />)
  expect(screen.queryByRole('heading', { name: 'Últimas semanas' })).toBeNull() // usuario nuevo
  cleanup(); streakEvents(); render(<App />)
  expect(screen.getByRole('heading', { name: 'Últimas semanas' })).toBeTruthy()
  expect(screen.getByText(/^Semana del 28 sep.*: HERO 120 XP, VILLAIN 0 XP$/)).toBeTruthy()
  expect(screen.getByText(/^Semana del 5 oct.* \(en curso\): HERO 60 XP, VILLAIN 0 XP$/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '+1 sesión en Gym' }))
  expect(screen.getByText(/\(en curso\): HERO 90 XP, VILLAIN 0 XP$/)).toBeTruthy()
})

test('U-pestañas sincroniza el estado entre pestañas', async () => {
  render(<App />); go('HERO')
  const spy = vi.spyOn(localStorage, 'setItem')
  const fire = (key: string | null) => window.dispatchEvent(new StorageEvent('storage', { key }))
  const gym = () => card('Gym').getByText(/sesiones esta semana/).textContent
  const written = JSON.stringify([{ id: 't1', trackerId: 'gym', amount: 1, occurredAt: '2026-10-07T09:00:00' }])
  localStorage.setItem(EV, written); fire(EV)
  await vi.waitFor(() => expect(gym()).toMatch(/^1 \/ 4 sesiones esta semana/))
  expect(localStorage.getItem(EV)).toBe(written)
  localStorage.setItem(CU, JSON.stringify({ proposals: [], trackers: [], zz: 1 })); fire(CU)
  let v1 = ''
  await vi.waitFor(() => { v1 = localStorage.getItem(CU)!; expect(v1).toContain('zz') })
  spy.mockClear(); fire(CU)
  await vi.waitFor(() => expect(localStorage.getItem(CU)).toBe(v1))
  const calls = spy.mock.calls.filter(c => c[0] === CU)
  expect(calls.length).toBeLessThanOrEqual(1)
  calls.forEach(c => expect(c[1]).toBe(v1))
  localStorage.setItem(EV + '.backup.last', '[]'); fire(EV + '.backup.last')
  expect(gym()).toMatch(/^1 \//)
  fire(EV); go('Inicio')
  await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Recuperar copia anterior' })).toBeTruthy())
  go('HERO')
  localStorage.setItem(EV, '{roto'); fire(EV)
  await vi.waitFor(() => expect(screen.getByText(STALE_TAB_TEXT)).toBeTruthy())
  expect(gym()).toMatch(/^1 \//)
  localStorage.clear(); fire(null)
  await vi.waitFor(() => expect(gym()).toMatch(/^0 \//))
  expect(screen.queryByText(STALE_TAB_TEXT)).toBeNull()
})

test('U-pestañas-bloqueo no pisa datos de otra pestaña', async () => {
  render(<App />); go('HERO')
  const fire = (key: string) => window.dispatchEvent(new StorageEvent('storage', { key }))
  const gym = () => card('Gym').getByText(/sesiones esta semana/).textContent
  const plus = () => fireEvent.click(card('Gym').getByRole('button', { name: '+1 sesiones' }))
  const one = JSON.stringify([{ id: 't1', trackerId: 'gym', amount: 1, occurredAt: '2026-10-07T09:00:00' }])
  const banner = () => screen.getByText(STALE_TAB_TEXT)
  plus()
  for (const bad of [EV, CU]) {
    localStorage.setItem(bad, '{roto'); fire(bad)
    await vi.waitFor(() => expect(banner()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Inicio' }))
    fireEvent.click(screen.getByRole('button', { name: 'Borrar todo' }))
    await vi.waitFor(() => expect(screen.getByText('Recarga la página antes de cambiar tus datos.')).toBeTruthy())
    expect(window.confirm).not.toHaveBeenCalled()
    go('HERO')
    plus()
    expect(gym()).toMatch(/^2 \//)
    await vi.waitFor(() => expect(localStorage.getItem(bad)).toBe('{roto'))
    if (bad === CU) expect(localStorage.getItem(EV)).toBe(one) // las dos claves quedan bloqueadas
    localStorage.setItem(bad, bad === EV ? one : JSON.stringify({ proposals: [], trackers: [] })); fire(bad)
    await vi.waitFor(() => expect(screen.queryByText(STALE_TAB_TEXT)).toBeNull())
    await vi.waitFor(() => expect(gym()).toMatch(/^1 \//))
    plus()
    await vi.waitFor(() => expect(stored()).toHaveLength(2))
    if (bad === EV) { localStorage.setItem(EV, one); fire(EV); await vi.waitFor(() => expect(gym()).toMatch(/^1 \//)) }
  }
})
