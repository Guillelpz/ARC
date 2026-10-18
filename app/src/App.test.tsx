// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, configure, fireEvent, render, screen, within } from '@testing-library/react'
import App from './App'
import { FoodMeals } from './components/FoodMeals'
import { exportBackup, unlockStorage } from './core/storage'
import { SAVE_FAIL_TEXT } from './components/SaveFailBanner'
import { STALE_TAB_TEXT } from './components/UpdateBanner'
import { downscale } from './image'

vi.mock('./image', () => ({ downscale: vi.fn() })) // la foto no se decodifica en happy-dom

// La suite completa corre en paralelo: con carga, el 1 s por defecto de findBy* se queda corto (U-C1 fallaba ~1 de cada 6).
configure({ asyncUtilTimeout: 3000 })
vi.setConfig({ testTimeout: 20000 }) // el 5 s por defecto de cada test también se queda corto con la suite en paralelo (U-C2, U-FV4)
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
  await vi.waitFor(() => expect(stored()).toEqual([]))
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

test('U-F5 fusionar con la pestaña desactualizada', async () => {
  seedX1()
  const { container } = render(<App />)
  localStorage.setItem(EV, '{roto'); window.dispatchEvent(new StorageEvent('storage', { key: EV }))
  await vi.waitFor(() => expect(screen.getByText(STALE_TAB_TEXT)).toBeTruthy())
  mergeFile(container, exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x'))
  expect(await screen.findByText('Recarga la página antes de cambiar tus datos.')).toBeTruthy()
  expect(window.confirm).not.toHaveBeenCalled()
  expect(localStorage.getItem(EV)).toBe('{roto')
})

test('U-F6 fusionar sin poder guardar la copia interna', async () => {
  seedX1()
  const { container } = render(<App />)
  const set = localStorage.setItem.bind(localStorage)
  const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k, v) => { if (k.includes('.backup.')) throw new DOMException('quota', 'QuotaExceededError'); set(k, v) })
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  mergeFile(container, exportBackup([x1, x2], { trackers: [], proposals: [] }, 'x'))
  expect(await screen.findByText(/^No se pudo guardar la copia interna, así que no se ha fusionado nada/)).toBeTruthy()
  spy.mockRestore()
  expect(stored()).toEqual([x1])
  expect(localStorage.getItem(EV + '.backup.last')).toBeNull()
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
  render(<App />); go('Nuevo'); fireEvent.click(btn('Escribir a mano'))
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
  expect(screen.getAllByRole('status').map(x => x.textContent).join(' ')).toMatch(/Gym Lv\. 2/) // en Inicio hay también el estado de VoiceLog
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

test('U23 límite de fija', () => {
  render(<App />); go('VILLAIN')
  fireEvent.click(btn('Editar límite de Beer'))
  expect(screen.queryByText('Nombre')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Archivar' })).toBeNull()
  fireEvent.change(card('Beer').getByRole('spinbutton'), { target: { value: '2' } })
  fireEvent.click(btn('Guardar'))
  expect(custom().limits).toEqual({ beer: 2 })
  expect(card('Beer').getByText(/· límite 2/)).toBeTruthy()
  for (let i = 0; i < 3; i++) fireEvent.click(card('Beer').getByRole('button', { name: '+1 unidades' }))
  expect(stored()).toHaveLength(3)
  expect(card('Beer').getByText('Te has pasado de tu límite semanal en 1 unidad.')).toBeTruthy()
  expect(screen.getByText(/^Lv\. \d+ · \d+ XP$/).textContent).toBe('Lv. 1 · 45 XP')
  fireEvent.click(card('Beer').getByRole('button', { name: 'Restar 1 unidades a Beer' }))
  expect(card('Beer').queryByText(/Te has pasado/)).toBeNull()
  fireEvent.click(btn('Editar límite de Beer'))
  fireEvent.change(card('Beer').getByRole('spinbutton'), { target: { value: '' } })
  fireEvent.click(btn('Guardar'))
  expect(custom()).not.toHaveProperty('limits')
})

test('U24 límite de propia', () => {
  const pizza = { ...base, id: 'custom-pizza', name: 'Pizza', branch: 'villain', unit: 'porciones', xpPerUnit: 15, weeklyLimit: 1 }
  localStorage.setItem(CU, JSON.stringify({ trackers: [pizza], proposals: [] }))
  localStorage.setItem(EV, JSON.stringify(['p1', 'p2'].map(id => ({ id, trackerId: 'custom-pizza', amount: 1, occurredAt: '2026-10-06T09:00:00' }))))
  render(<App />); go('VILLAIN')
  const msg = card('Pizza').getByText(/Te has pasado de tu límite semanal/)
  expect(msg.closest('p')!.getAttribute('aria-live')).toBe('polite')
  fireEvent.click(btn('Editar Pizza'))
  fireEvent.change(card('Pizza').getByLabelText(/^Límite semanal/), { target: { value: '5' } })
  fireEvent.click(btn('Guardar'))
  expect(custom().trackers[0].weeklyLimit).toBe(5)
  expect(card('Pizza').queryByText(/Te has pasado/)).toBeNull()
  expect(custom()).not.toHaveProperty('goalLog')
})

test('U25 campos por rama', () => {
  const pizza = { ...base, id: 'custom-pizza', name: 'Pizza', branch: 'villain', unit: 'porciones', xpPerUnit: 15 }
  localStorage.setItem(CU, JSON.stringify({ trackers: [pizza], proposals: [] }))
  render(<App />); go('HERO')
  fireEvent.click(btn('Editar objetivo de Gym'))
  expect(card('Gym').queryByLabelText(/^Límite semanal/)).toBeNull()
  go('VILLAIN')
  fireEvent.click(btn('Editar Pizza'))
  expect(card('Pizza').queryByLabelText(/^Objetivo semanal/)).toBeNull()
  expect(card('Beer').queryByText(/· límite/)).toBeNull()
  expect(card('Beer').queryByText(/Te has pasado/)).toBeNull()
})

test('U26 Yo → Gym → Volver devuelve el foco a la tarjeta Gym', () => {
  render(<App />); go('Yo')
  const nav = within(screen.getByRole('navigation', { name: 'Principal' }))
  expect(nav.getByRole('button', { name: 'Yo' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('button', { name: /^Gym/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Gym' })).toBeTruthy()
  expect(nav.getByRole('button', { name: 'Yo' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Yo' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Gym/ }))
})

const GY = 'life-rpg-gym-v1'
const gymStored = () => JSON.parse(localStorage.getItem(GY) ?? '{"log":[]}')
const openGym = () => { go('Yo'); fireEvent.click(screen.getByRole('button', { name: /^Gym/ })) }
const logSet = (w: string, r: string) => {
  fireEvent.change(screen.getByLabelText(/^(Peso|Lastre) \(/), { target: { value: w } })
  fireEvent.change(screen.getByLabelText('Repeticiones'), { target: { value: r } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar serie' }))
}
const statusText = () => screen.getAllByRole('status').map(s => s.textContent).join(' ')
const gymEvents = () => stored().filter((e: { trackerId: string }) => e.trackerId === 'gym')
const sessions = () => { go('HERO'); const t = card('Gym').getByText(/ sesiones esta semana/).textContent!; openGym(); return t }

test('U27 series, sesión automática y deshacer', async () => {
  render(<App />); openGym()
  logSet('100', '5')
  expect(screen.getByText('Serie 1 · 100 kg × 5')).toBeTruthy()
  await vi.waitFor(() => expect(gymStored().log).toHaveLength(1))
  expect(sessions()).toMatch(/^1 \/ 4 sesiones/)
  logSet('100', '5')
  expect(gymEvents()).toHaveLength(1)
  expect(screen.getByText('Serie 2 · 100 kg × 5')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer serie 1 de Press banca: 100 kg × 5' }))
  expect(statusText()).toContain('Serie deshecha.')
  expect(statusText()).not.toContain('Sesión de Gym retirada')
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer serie 1 de Press banca: 100 kg × 5' }))
  expect(statusText()).toContain('Sesión de Gym retirada')
  expect(screen.getByText('No hay series este día.')).toBeTruthy()
  expect(sessions()).toMatch(/^0 \/ 4 sesiones/)
})

test('U28 aviso de récord', () => {
  render(<App />); openGym()
  logSet('100', '5')
  expect(statusText()).not.toContain('Nuevo récord')
  logSet('105', '5')
  expect(statusText()).toContain('Nuevo récord en Press banca')
  expect(screen.getByText('Nuevo récord')).toBeTruthy() // RecordBanner
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer serie 2 de Press banca: 105 kg × 5' }))
  expect(statusText()).not.toContain('Nuevo récord')
})

test('U29 unidades: el log no cambia', async () => {
  render(<App />); openGym()
  logSet('100', '5')
  await vi.waitFor(() => expect(gymStored().log).toHaveLength(1))
  const before = JSON.stringify(gymStored().log)
  fireEvent.click(within(screen.getByRole('group', { name: 'Unidad de peso' })).getByRole('button', { name: 'lbs' }))
  expect(screen.getByText('Serie 1 · 220,5 lbs × 5')).toBeTruthy()
  await vi.waitFor(() => expect(gymStored().unit).toBe('lbs'))
  expect(JSON.stringify(gymStored().log)).toBe(before)
  const w = screen.getByLabelText(/^Peso \(lbs\)/) as HTMLInputElement
  expect(w.value).toBe('220,5')
  fireEvent.click(screen.getByRole('button', { name: 'Subir 5 lbs' }))
  expect(w.value).toBe('225,5')
  fireEvent.click(screen.getByRole('button', { name: 'Bajar 5 lbs' })); fireEvent.click(screen.getByRole('button', { name: 'Bajar 5 lbs' }))
  expect(w.value).toBe('215,5')
})

test('U31 ayer, repetir serie y borrar todo', async () => {
  render(<App />); openGym()
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  logSet('60', '8')
  expect(statusText()).toContain('Sesión de Gym apuntada en HERO (ayer).')
  await vi.waitFor(() => expect(gymStored().log).toHaveLength(1))
  expect(gymStored().log[0].occurredAt.startsWith('2026-10-06')).toBe(true)
  expect(gymEvents().map((e: { id: string }) => e.id)).toEqual(['gym-auto-2026-10-06'])
  fireEvent.click(screen.getByRole('button', { name: 'Repetir serie: 60 kg × 8' }))
  await vi.waitFor(() => expect(gymStored().log).toHaveLength(2))
  expect(gymStored().log[1]).toMatchObject({ exerciseId: 'bench-press', weight: 60, unit: 'kg', reps: 8 })
  go('Inicio')
  vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar todo'))
  await vi.waitFor(() => expect(gymStored().log).toEqual([]))
})

test('U30 ejercicios propios: crear, duplicado, archivar y reactivar', async () => {
  render(<App />); openGym()
  const select = () => screen.getByLabelText('Ejercicio') as HTMLSelectElement
  const create = (name: string) => {
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear ejercicio' }))
  }
  create('remo pendlay')
  expect(select().selectedOptions[0].textContent).toBe('Remo pendlay')
  await vi.waitFor(() => expect(gymStored().exercises).toHaveLength(1))
  expect(gymStored().exercises[0]).toMatchObject({ name: 'Remo pendlay', group: 'chest', kind: 'load' })
  expect(gymStored().exercises[0].id.startsWith('custom-')).toBe(true)
  create('Press banca')
  expect(screen.getByText('Ya existe un ejercicio con ese nombre.')).toBeTruthy()
  create('REMO PENDLAY')
  expect(screen.getByText('Ya existe un ejercicio con ese nombre.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Archivar Remo pendlay' }))
  expect([...select().options].some(o => o.textContent === 'Remo pendlay')).toBe(false)
  expect(select().selectedOptions[0].textContent).toBe('Press banca')
  await vi.waitFor(() => expect(gymStored().exercises[0].archived).toBe(true))
  create('Remo Pendlay')
  expect(screen.getByText('Ya tienes «Remo pendlay» archivado: reactívalo abajo.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Reactivar Remo pendlay' }))
  expect([...select().options].some(o => o.textContent === 'Remo pendlay')).toBe(true)
  await vi.waitFor(() => expect(gymStored().exercises[0]).not.toHaveProperty('archived'))
})

test('U32 recuperar copia anterior avisa de las series de gym', async () => {
  render(<App />); openGym()
  logSet('100', '5')
  go('Inicio')
  vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar todo'))
  await vi.waitFor(() => expect(gymStored().log).toEqual([]))
  const confirm = vi.mocked(window.confirm).mockReturnValueOnce(false)
  fireEvent.click(btn('Recuperar copia anterior'))
  expect(confirm.mock.calls.at(-1)![0]).toContain('Series de gym: 0 → 1.')
})

test('U33 deshacer o restar la sesión de un día con series la repone sin toast', async () => {
  render(<App />); openGym()
  logSet('100', '5')
  await vi.waitFor(() => expect(gymEvents()).toHaveLength(1))
  go('HERO')
  fireEvent.click(card('Gym').getByText('Últimos registros'))
  fireEvent.click(card('Gym').getByRole('button', { name: 'Deshacer 1 sesión de Hoy' }))
  await vi.waitFor(() => expect(gymEvents()).toHaveLength(3))
  expect(gymEvents().map((e: { amount: number }) => e.amount)).toEqual([1, -1, 1])
  expect(gymEvents()[2].id).toBe('gym-auto-2026-10-07-2')
  expect(card('Gym').getByText(/ sesiones esta semana/).textContent).toMatch(/^1 \/ 4 sesiones/)
  expect(statusText()).not.toMatch(/Lv\.|LEVEL/)
  fireEvent.click(card('Gym').getByRole('button', { name: 'Restar 1 sesiones a Gym' }))
  await vi.waitFor(() => expect(gymEvents()).toHaveLength(5))
  expect(card('Gym').getByText(/ sesiones esta semana/).textContent).toMatch(/^1 \/ 4 sesiones/)
})

test('U34 recuperar una copia sin gym conserva las series y recrea las sesiones', async () => {
  const set = (id: string, day: string) => ({ id, exerciseId: 'bench-press', weight: 100, unit: 'kg', reps: 5, occurredAt: `${day}T10:00:00` })
  localStorage.setItem(GY, JSON.stringify({ log: [set('s1', '2026-10-06'), set('s2', '2026-10-07')], exercises: [] }))
  localStorage.setItem(EV + '.backup.last', JSON.stringify([{ id: 'old', trackerId: 'gym', amount: 1, occurredAt: '2026-10-01T09:00:00' }]))
  render(<App />)
  const confirm = vi.mocked(window.confirm).mockReturnValueOnce(true)
  fireEvent.click(btn('Recuperar copia anterior'))
  expect(confirm.mock.calls.at(-1)![0]).toContain('Esta copia es anterior al módulo Gym: tus 2 series de gym se conservan y los días con series vuelven a contar como sesión.')
  await vi.waitFor(() => expect(gymEvents().map((e: { id: string }) => e.id)).toEqual(['old', 'gym-auto-2026-10-06', 'gym-auto-2026-10-07']))
  expect(gymStored().log).toHaveLength(2)
})

test('U35 progreso del 1RM: lista accesible, estado vacío y unidad preferida', async () => {
  render(<App />); openGym()
  expect(screen.getByText(/^Aún no hay datos para el progreso/)).toBeTruthy()
  logSet('100', '5')
  const items = () => within(screen.getByRole('region', { name: /^Progreso/ })).getAllByRole('listitem').map(l => l.textContent)
  expect(items()).toHaveLength(8)
  expect(items()[7]).toBe('Semana del 5 oct (en curso): ≈ 116,7 kg')
  expect(items()[6]).toMatch(/: sin datos$/)
  expect(screen.getByText('Mejor del periodo: ≈ 116,7 kg')).toBeTruthy()
  fireEvent.click(within(screen.getByRole('group', { name: 'Unidad de peso' })).getByRole('button', { name: 'lbs' }))
  expect(items()[7]).toBe('Semana del 5 oct (en curso): ≈ 257,2 lbs')
  fireEvent.click(screen.getByRole('button', { name: 'Deshacer serie 1 de Press banca: 220,5 lbs × 5' }))
  expect(screen.getByText(/^Aún no hay datos para el progreso/)).toBeTruthy()
})

test('U36 volumen semanal: kg y lbs mezclados y comparación con la semana anterior', async () => {
  const set = (id: string, w: number, unit: string, day: string) => ({ id, exerciseId: 'bench-press', weight: w, unit, reps: 5, occurredAt: `${day}T10:00:00` })
  localStorage.setItem(GY, JSON.stringify({ log: [set('a', 100, 'kg', '2026-10-06'), set('b', 220, 'lbs', '2026-10-06'), set('c', 80, 'kg', '2026-09-30')], exercises: [] }))
  render(<App />); openGym()
  const vol = () => within(screen.getByRole('region', { name: 'Volumen semanal' }))
  expect(vol().getByText('Pecho · 2 series · 999 kg')).toBeTruthy()
  expect(vol().getByText('semana anterior hasta hoy: 1 serie · 400 kg')).toBeTruthy()
  expect(vol().queryByText(/^Espalda/)).toBeNull()
  fireEvent.click(within(screen.getByRole('group', { name: 'Unidad de peso' })).getByRole('button', { name: 'lbs' }))
  expect(vol().getByText('Pecho · 2 series · 2.202 lbs')).toBeTruthy()
  expect(vol().getByText('semana anterior hasta hoy: 1 serie · 882 lbs')).toBeTruthy()
})

test('U37 fila Gym en «Hoy»: solo con series, abre Gym y Volver deja el foco en «Hoy»', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: /^Gym.* serie/ })).toBeNull()
  openGym(); logSet('100', '5'); logSet('60', '8')
  go('Inicio')
  fireEvent.click(screen.getByRole('button', { name: /^Gym.*2 series · 1 ejercicio$/ }))
  expect(screen.getByRole('heading', { level: 1, name: 'Gym' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { level: 1, name: /^PLAYER Lv./ })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Hoy' }))
  openGym() // desde «Yo» sigue volviendo a «Yo»
  fireEvent.click(screen.getByRole('button', { name: 'Volver' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Yo' })).toBeTruthy()
})

test('U38 rutinas: guardar, errores, cargar con contadores por día, seleccionar y borrar', async () => {
  render(<App />); openGym()
  expect(screen.getByText('Aún no tienes rutinas.')).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Guardar rutina' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Registra alguna serie en este día para guardarla como rutina.')).toBeTruthy()
  logSet('100', '5'); logSet('100', '5')
  fireEvent.change(screen.getByLabelText('Ejercicio'), { target: { value: 'squat' } })
  logSet('120', '5')
  const name = () => screen.getByLabelText('Nombre de la rutina')
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar rutina' }))
  expect(screen.getByText('Guardar la sesión de hoy como rutina')).toBeTruthy()
  fireEvent.change(name(), { target: { value: 'x' } }); save()
  expect(screen.getByText('El nombre debe tener entre 2 y 40 caracteres.')).toBeTruthy()
  fireEvent.change(name(), { target: { value: 'Push day' } }); save()
  await vi.waitFor(() => expect(gymStored().routines).toEqual([{ id: expect.stringMatching(/^routine-/), name: 'Push day', items: [{ exerciseId: 'bench-press', sets: 2 }, { exerciseId: 'squat', sets: 1 }] }]))
  expect(statusText()).toContain('Rutina Push day guardada.')
  fireEvent.change(name(), { target: { value: 'push DAY' } }); save()
  expect(screen.getByText('Ya tienes una rutina con ese nombre.')).toBeTruthy()
  expect(screen.getByText((_, el) => el?.tagName === 'SPAN' && el.textContent === 'Push day · 2 ejercicios')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Cargar rutina Push day' }))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Rutina: Push day' })))
  expect(statusText()).toContain('Rutina Push day cargada.')
  const panel = () => within(screen.getByRole('region', { name: 'Rutina: Push day' }))
  expect(panel().getByRole('button', { name: 'Press banca · 2/2 series' })).toBeTruthy()
  expect(panel().getAllByText('hecho')).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  expect(panel().getByRole('button', { name: 'Press banca · 0/2 series' })).toBeTruthy()
  expect(panel().queryByText('hecho')).toBeNull()
  fireEvent.click(panel().getByRole('button', { name: 'Press banca · 0/2 series' }))
  expect((screen.getByLabelText('Ejercicio') as HTMLSelectElement).value).toBe('bench-press')
  expect(gymStored().log).toHaveLength(3) // cargar no crea series
  fireEvent.click(screen.getByRole('button', { name: 'Borrar rutina Push day' }))
  expect(screen.getByRole('region', { name: 'Rutina: Push day' })).toBeTruthy() // confirm cancelado
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  fireEvent.click(screen.getByRole('button', { name: 'Borrar rutina Push day' }))
  expect(screen.queryByRole('region', { name: 'Rutina: Push day' })).toBeNull()
  expect(screen.getByText('Aún no tienes rutinas.')).toBeTruthy()
  await vi.waitFor(() => expect(gymStored()).not.toHaveProperty('routines'))
  expect(gymStored().log).toHaveLength(3)
})

// Reconocimiento de voz simulado: dice `window.__voz` al empezar
class FakeSpeech {
  lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
  onstart: (() => void) | null = null; onresult: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
  start() {
    (window as unknown as { __lang?: string }).__lang = this.lang
    const v = (window as unknown as { __voz?: string | { error: string } }).__voz
    setTimeout(() => {
      if (typeof v === 'string') this.onresult?.({ results: [Object.assign([{ transcript: v }], { isFinal: true })] })
      else if (v) this.onerror?.({ error: v.error })
      this.onend?.()
    }, 0)
  }
  stop() {}
  abort() {}
}

test('U-V0 Probar voz: muestra el resultado y guarda privacyAck', async () => {
  vi.useRealTimers() // la voz simulada usa setTimeout
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSpeech
  ;(window as unknown as Record<string, unknown>).__voz = '80 kilos press banca 5 repeticiones'
  try {
    render(<App />); go('Yo')
    fireEvent.click(btn('Probar voz'))
    expect(screen.getByRole('heading', { name: 'Privacidad de la voz' })).toBeTruthy()
    expect(localStorage.getItem('life-rpg-voice-v1')).toBeNull()
    fireEvent.click(btn('Entendido'))
    expect(JSON.parse(localStorage.getItem('life-rpg-voice-v1')!).privacyAck).toBeTruthy()
    expect((await screen.findAllByText(/80 kilos press banca 5 repeticiones/)).length).toBeGreaterThan(0)
    expect(screen.getByText('disponible (webkitSpeechRecognition)')).toBeTruthy()
    expect(screen.getByText('Detalles técnicos')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('life-rpg-gym-v1')!).log).toEqual([]) // no guarda series
  } finally { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; delete (window as unknown as Record<string, unknown>).__voz }
})

test('U-V0b Probar voz sin API: no disponible', async () => {
  render(<App />); go('Yo')
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: 'x' }))
  cleanup(); render(<App />); go('Yo')
  fireEvent.click(btn('Probar voz'))
  expect(await screen.findByText('no disponible')).toBeTruthy()
  expect(screen.getAllByText('Error: not-supported').length).toBeGreaterThan(0)
})

async function voiceRun(writeText: ReturnType<typeof vi.fn>) {
  vi.useRealTimers()
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeSpeech
  ;(window as unknown as Record<string, unknown>).__voz = '80 kilos press banca 5 repeticiones'
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: 'x' }))
  localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-XYZ')
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  render(<App />); go('Yo')
  fireEvent.click(btn('Probar voz'))
  await screen.findByRole('button', { name: 'Copiar resumen' })
}
const voiceCleanup = () => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; delete (window as unknown as Record<string, unknown>).__voz
  delete (navigator as unknown as Record<string, unknown>).clipboard
}

test('U-V1 Copiar resumen: copia el resumen sin la clave', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  try {
    await voiceRun(writeText)
    fireEvent.click(btn('Copiar resumen'))
    expect(await screen.findByText(/Resumen copiado/)).toBeTruthy()
    const txt = (writeText.mock.calls[0] as unknown as [string])[0]
    expect(txt).toContain(navigator.userAgent)
    for (const k of ['Reconocimiento:', '80 kilos press banca 5 repeticiones', 'KEYBOARD_ON_IOS']) expect(txt).toContain(k)
    expect(txt).not.toContain('sk-ant-test-XYZ')
  } finally { voiceCleanup() }
})

test('U-V2 Copiar resumen: si el portapapeles falla, textarea enfocado', async () => {
  const writeText = vi.fn(() => Promise.reject(new Error('denied')))
  try {
    await voiceRun(writeText)
    fireEvent.click(btn('Copiar resumen'))
    const area = await screen.findByLabelText('Resumen de la prueba de voz') as HTMLTextAreaElement
    expect(screen.getByText(/No se ha podido copiar/)).toBeTruthy()
    expect(area.value).toContain('Reconocimiento:')
    expect(area.value).not.toContain('sk-ant-test-XYZ')
    await vi.waitFor(() => expect(document.activeElement).toBe(area))
  } finally { voiceCleanup() }
})

const AIK = 'life-rpg-ai-key-v1', KEY = 'sk-ant-test-0000000000000000'
const typeKey = (v: string) => fireEvent.change(screen.getByLabelText('Clave'), { target: { value: v } })

test('U-V9 clave: formato, guardada, fuera de las copias y de Borrar todo', async () => {
  const { container } = render(<App />); go('Yo')
  typeKey('abc'); fireEvent.click(btn('Guardar clave'))
  expect(screen.getByText('La clave debe empezar por sk-ant-.')).toBeTruthy()
  expect(screen.getByLabelText('Clave').getAttribute('aria-invalid')).toBe('true')
  expect(localStorage.getItem(AIK)).toBeNull()
  typeKey(KEY); fireEvent.click(btn('Guardar clave'))
  expect(screen.getByText('Clave guardada: termina en 0000')).toBeTruthy()
  expect(localStorage.getItem(AIK)).toBe(KEY)
  expect(screen.queryByLabelText('Clave')).toBeNull() // el campo vuelve vacío y oculto
  expect(document.body.innerHTML).not.toContain(KEY)
  // exportar: la copia no lleva la clave
  go('Inicio'); fireEvent.click(btn('Exportar copia'))
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
  expect(await blob.text()).not.toContain(KEY)
  // «Borrar todo» no la toca
  window.confirm = vi.fn(() => true)
  fireEvent.click(btn('Borrar todo'))
  expect(localStorage.getItem(AIK)).toBe(KEY)
  // importar una copia no la toca
  importFile(container, exportBackup([], { trackers: [], proposals: [] }, '2026-10-07T10:00:00.000Z'))
  await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2))
  expect(localStorage.getItem(AIK)).toBe(KEY)
  // borrar la clave
  go('Yo'); fireEvent.click(btn('Borrar clave'))
  expect(localStorage.getItem(AIK)).toBeNull()
  expect(screen.getByLabelText('Clave')).toBeTruthy()
})

test('U-V9b clave guardada pero no válida: aviso y Borrar clave', () => {
  localStorage.setItem(AIK, 'basura'); window.confirm = vi.fn(() => true)
  render(<App />); go('Yo')
  expect(screen.getByText(/La clave guardada no es válida/)).toBeTruthy()
  fireEvent.click(btn('Borrar clave'))
  expect(localStorage.getItem(AIK)).toBeNull()
})

test('U-V12 Probar clave: ok y 401', async () => {
  localStorage.setItem(AIK, KEY)
  const bench = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ exerciseId: 'bench-press', weight: 80, unit: 'kg', reps: 5, sets: 1 }) }] }
  const f = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(bench), { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 401 }))
  vi.stubGlobal('fetch', f)
  try {
    render(<App />); go('Yo')
    fireEvent.click(btn('Probar clave'))
    expect(await screen.findByText('La clave funciona.')).toBeTruthy()
    expect(f).toHaveBeenCalledTimes(1)
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'x-api-key': KEY })
    fireEvent.click(btn('Probar clave'))
    expect(await screen.findByText('Anthropic rechaza la clave. Comprueba que la has copiado entera.')).toBeTruthy()
  } finally { vi.unstubAllGlobals() }
})

// ---- Voz en Gym (T6) ----
type W = Record<string, unknown>
const win = window as unknown as W
const setVoz = (v: string | { error: string }) => { win.webkitSpeechRecognition = FakeSpeech; win.__voz = v }
afterEach(() => { delete win.webkitSpeechRecognition; delete win.__voz; Object.defineProperty(navigator, 'onLine', { value: true, configurable: true }) })
const ackVoice = () => localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
const gymLog = () => JSON.parse(localStorage.getItem('life-rpg-gym-v1') ?? '{"log":[]}').log as { id: string; exerciseId?: string; weight?: number; unit?: string; reps?: number; undoes?: string; occurredAt: string }[]
const liveGym = () => { const l = gymLog(); const u = new Set(l.filter(e => e.undoes).map(e => e.undoes)); return l.filter(e => !e.undoes && !u.has(e.id)) }
const gymSum = () => stored().filter((e: { trackerId: string }) => e.trackerId === 'gym').reduce((n: number, e: { amount: number }) => n + e.amount, 0)
const dictate = (v: string | { error: string }) => { setVoz(v); fireEvent.click(btn('Dictar serie')) }
const dictateHome = (v: string | { error: string }) => { setVoz(v); fireEvent.click(btn('Dictar')) } // «Dictar» de «Hoy»: abre la captura
const KEY2 = 'sk-ant-test-0000000000000000'

test('U-V1 primera vez: privacidad, dictar, guardar con sesion en HERO', async () => {
  render(<App />); openGym()
  setVoz('80 kilos press banca 5 repeticiones')
  fireEvent.click(btn('Dictar serie'))
  expect(screen.getByRole('heading', { name: 'Privacidad de la voz' })).toBeTruthy()
  fireEvent.click(btn('Entendido'))
  expect(await screen.findByText(/^Registrado: Press banca · 80 kg × 5/)).toBeTruthy()
  expect(screen.getByText('Serie 1 · 80 kg × 5')).toBeTruthy()
  expect(screen.getByText('Oído: «80 kilos press banca 5 repeticiones»')).toBeTruthy()
  expect(screen.getByText(/Sesión de Gym apuntada en HERO \(hoy\)\./)).toBeTruthy()
  await vi.waitFor(() => expect(liveGym()).toHaveLength(1))
  expect(stored().some((e: { id: string; amount: number }) => e.id === 'gym-auto-2026-10-07' && e.amount === 1)).toBe(true)
  expect(JSON.parse(localStorage.getItem('life-rpg-voice-v1')!).privacyAck).toBeTruthy()
  // la segunda vez no sale el aviso
  fireEvent.click(btn('Cerrar'))
  dictate('sentadilla 100 5')
  expect(screen.queryByRole('heading', { name: 'Privacidad de la voz' })).toBeNull()
  expect(await screen.findByText(/^Registrado: Sentadilla · 100 kg × 5/)).toBeTruthy()
  await vi.waitFor(() => expect(liveGym()).toHaveLength(2))
})

test('U-V2 3x5, Deshacer: 0 series, sesion retirada y foco en Dictar serie', async () => {
  ackVoice(); render(<App />); openGym()
  dictate('press banca 80 kg 3x5')
  expect(await screen.findByText(/^Registrado: Press banca · 3 series · 80 kg × 5/)).toBeTruthy()
  await vi.waitFor(() => expect(liveGym()).toHaveLength(3)); expect(gymSum()).toBe(1)
  fireEvent.click(btn('Deshacer'))
  expect(liveGym()).toHaveLength(0); expect(gymSum()).toBe(0)
  expect(screen.getByText('Deshecho: 3 series de Press banca. Sesión de Gym retirada.')).toBeTruthy()
  await vi.waitFor(() => expect(document.activeElement).toBe(btn('Dictar serie')))
})

test('U-V3 Editar: deshace y rellena el formulario con el foco en el peso', async () => {
  ackVoice(); render(<App />); openGym()
  dictate('press banca 80 kg 5 reps')
  await screen.findByText(/^Registrado:/)
  fireEvent.click(btn('Editar'))
  await vi.waitFor(() => expect((screen.getByLabelText(/^Peso \(/) as HTMLInputElement).value).toBe('80'))
  await vi.waitFor(() => expect(liveGym()).toHaveLength(0))
  expect((screen.getByLabelText('Repeticiones') as HTMLInputElement).value).toBe('5')
  expect((screen.getByLabelText('Ejercicio') as HTMLSelectElement).value).toBe('bench-press')
  expect(screen.getByText('Formulario rellenado con Press banca · 80 kg × 5. Registra la serie.')).toBeTruthy()
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/^Peso \(/)))
})

test('U-V4 incompleto: no guarda, formulario con foco en las repeticiones', async () => {
  ackVoice(); render(<App />); openGym()
  dictate('press banca 80')
  expect(await screen.findByText('Faltan las repeticiones. Completa el formulario.')).toBeTruthy()
  expect(liveGym()).toHaveLength(0)
  expect((screen.getByLabelText(/^Peso \(/) as HTMLInputElement).value).toBe('80')
  expect((screen.getByLabelText('Repeticiones') as HTMLInputElement).value).toBe('')
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Repeticiones')))
})

test('U-V5 sin API: Dictar serie abre el campo de texto', async () => {
  ackVoice(); render(<App />); openGym()
  fireEvent.click(btn('Dictar serie'))
  const input = screen.getByLabelText('Serie') as HTMLInputElement
  expect(document.activeElement).toBe(input)
  expect(screen.getByText(/no puede reconocer la voz/)).toBeTruthy()
  fireEvent.change(input, { target: { value: 'dominadas 12' } })
  fireEvent.click(btn('Registrar'))
  expect(await screen.findByText('Serie 1 · 12 reps')).toBeTruthy()
})

test('U-V8 con clave y fallo de la IA: usa el parser; con 401, avisa', async () => {
  ackVoice(); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 500 })).mockResolvedValueOnce(new Response('{}', { status: 401 }))
  vi.stubGlobal('fetch', f)
  try {
    render(<App />); openGym()
    dictate('press banca 80 kg 5 reps')
    expect(await screen.findByText(/^Registrado: Press banca · 80 kg × 5/)).toBeTruthy()
    expect(screen.queryByText(/La IA no está disponible/)).toBeNull()
    fireEvent.click(btn('Cerrar'))
    dictate('sentadilla 100 kg 5 reps')
    expect(await screen.findByText(/^Registrado: Sentadilla/)).toBeTruthy()
    expect(screen.getByText(/La IA no está disponible \(clave rechazada o sin saldo\)/)).toBeTruthy()
    expect(f).toHaveBeenCalledTimes(2)
    await vi.waitFor(() => expect(liveGym()).toHaveLength(2))
  } finally { vi.unstubAllGlobals() }
})

test('U-V10 sin conexion: campo de texto y fetch no se llama', async () => {
  ackVoice(); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn(); vi.stubGlobal('fetch', f)
  try {
    setVoz('x'); Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<App />); openGym()
    fireEvent.click(btn('Dictar serie'))
    expect(screen.getByText(/Sin conexión: el reconocimiento de voz necesita internet/)).toBeTruthy()
    const input = screen.getByLabelText('Serie') as HTMLInputElement
    expect(document.activeElement).toBe(input)
    fireEvent.change(input, { target: { value: 'dominadas 12' } }); fireEvent.click(btn('Registrar'))
    expect(await screen.findByText('Serie 1 · 12 reps')).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  } finally { vi.unstubAllGlobals() }
})

test('U-V11 not-allowed: mensaje y campo de texto enfocado', async () => {
  ackVoice(); render(<App />); openGym()
  dictate({ error: 'not-allowed' })
  expect(await screen.findByText(/No hay permiso para el micrófono/)).toBeTruthy()
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Serie')))
  expect(liveGym()).toHaveLength(0)
})

test('U-V13 dia pasado: 3 series ese dia', async () => {
  ackVoice(); render(<App />); openGym()
  fireEvent.click(screen.getByRole('button', { name: 'Ayer' }))
  dictate('dominadas 3x8 con 10 kilos')
  expect(await screen.findByText(/^Registrado: Dominadas · 3 series · \+10 kg × 8/)).toBeTruthy()
  await vi.waitFor(() => expect(liveGym()).toHaveLength(3))
  const l = liveGym()
  expect(l).toHaveLength(3); expect(l.every(s => s.occurredAt.startsWith('2026-10-06') && s.weight === 10)).toBe(true)
  expect(stored().some((e: { id: string }) => e.id === 'gym-auto-2026-10-06')).toBe(true)
})

test('U-V14 libras dichas se guardan en lbs', async () => {
  ackVoice(); render(<App />); openGym()
  dictate('sentadilla 225 libras 5')
  await screen.findByText(/^Registrado:/)
  await vi.waitFor(() => expect(liveGym()).toHaveLength(1))
  expect(liveGym()[0]).toMatchObject({ exerciseId: 'squat', weight: 225, unit: 'lbs', reps: 5 })
})

test('Voz: una serie que bate el peso maximo muestra Nuevo record', async () => {
  ackVoice(); render(<App />); openGym()
  dictate('press banca 100 5')
  await screen.findByText(/^Registrado:/)
  fireEvent.click(btn('Cerrar'))
  dictate('press banca 105 5')
  expect(await screen.findByText('Nuevo récord')).toBeTruthy()
})

// ---- Voz en «Hoy» (T7) ----
const aiReply = (o: unknown) => new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] }), { status: 200 })

test('U-V6 desde Hoy: guarda hoy, Deshacer la quita y el incompleto abre Gym prerrellenado', async () => {
  ackVoice(); render(<App />)
  dictateHome('press banca 80 kg 5 reps')
  expect(await screen.findByText(/^Registrado: Press banca · 80 kg × 5/)).toBeTruthy()
  await vi.waitFor(() => expect(liveGym()).toHaveLength(1))
  expect(liveGym()[0].occurredAt.startsWith('2026-10-07')).toBe(true)
  fireEvent.click(btn('Deshacer'))
  await vi.waitFor(() => expect(liveGym()).toHaveLength(0))
  expect(liveGym()).toHaveLength(0)
  go('Inicio')
  expect(screen.queryByRole('button', { name: /^Gym.*serie/ })).toBeNull()
  // incompleto: abre Gym con el formulario rellenado
  dictateHome('press banca 80')
  expect(await screen.findByRole('heading', { name: 'Gym', level: 1 })).toBeTruthy()
  expect((screen.getByLabelText(/^Peso \(/) as HTMLInputElement).value).toBe('80')
  expect(screen.getByText('Faltan las repeticiones. Completa el formulario.')).toBeTruthy()
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Repeticiones')))
  fireEvent.click(btn('Volver'))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Hoy' })))
  expect(liveGym()).toHaveLength(0)
})

test('U-V6b Editar desde Hoy abre Gym con el formulario del comando deshecho', async () => {
  ackVoice(); render(<App />)
  dictateHome('press banca 80 kg 3x5')
  await screen.findByText(/^Registrado:/)
  fireEvent.click(btn('Editar'))
  await vi.waitFor(() => expect(liveGym()).toHaveLength(0))
  expect(await screen.findByText('Formulario rellenado con Press banca · 3 series · 80 kg × 5. Registra la serie y usa «Repetir serie» para las demás.')).toBeTruthy()
  await vi.waitFor(() => expect((screen.getByLabelText('Repeticiones') as HTMLInputElement).value).toBe('5'))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/^Peso \(/)))
})

test('U-V7 con clave, la IA resuelve una frase rara desde Hoy', async () => {
  ackVoice(); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn().mockResolvedValue(aiReply({ kind: 'gym', otherDay: false, exerciseId: 'leg-press', weight: 100, weightUnit: 'none', reps: 10, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
      name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '' }))
  vi.stubGlobal('fetch', f)
  try {
    render(<App />)
    dictateHome('la máquina de piernas 100 10')
    expect(await screen.findByText(/^Registrado: Prensa · 100 kg × 10/)).toBeTruthy()
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({ 'x-api-key': KEY2, 'anthropic-dangerous-direct-browser-access': 'true' })
    expect(JSON.parse(init.body as string).messages[0].content).toContain('<frase>la máquina de piernas 100 10</frase>')
    await vi.waitFor(() => expect(liveGym()).toHaveLength(1))
    expect(liveGym()[0]).toMatchObject({ exerciseId: 'leg-press', weight: 100, reps: 10 })
  } finally { vi.unstubAllGlobals() }
})

test('U-V15 idioma del dictado: español por defecto aunque el sistema esté en inglés; English se guarda', async () => {
  ackVoice()
  const nav = vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
  try {
    render(<App />); openGym()
    dictate('press banca 80 kg 5 reps')
    await screen.findByText(/^Registrado:/)
    expect(win.__lang).toBe('es-ES')
    go('Yo')
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(JSON.parse(localStorage.getItem('life-rpg-voice-v1')!)).toMatchObject({ lang: 'en-US', privacyAck: expect.any(String) })
    fireEvent.click(btn('Probar voz'))
    await vi.waitFor(() => expect(win.__lang).toBe('en-US'))
  } finally { nav.mockRestore(); delete win.__lang }
})

// ---- Captura por voz (ciclo 27) ----
test('U-C0 «+» y «Nuevo» escuchan en el mismo clic; sin aviso aceptado sale la privacidad; sin API, el campo de texto', async () => {
  ackVoice(); setVoz('press banca 80 kg 5 reps')
  render(<App />)
  fireEvent.click(btn('Apuntar por voz'))
  expect(win.__lang).toBe('es-ES') // ya escuchando, antes de cualquier await
  expect(await screen.findByText(/^Registrado: Press banca · 80 kg × 5/)).toBeTruthy()
  delete win.__lang
  go('Inicio'); go('Nuevo')
  expect(win.__lang).toBe('es-ES')
  await screen.findByText(/^Registrado: Press banca/)
  cleanup(); localStorage.clear(); delete win.__lang
  render(<App />); fireEvent.click(btn('Apuntar por voz'))
  expect(screen.getByRole('heading', { name: 'Privacidad de la voz' })).toBeTruthy()
  expect(win.__lang).toBeUndefined()
  cleanup(); ackVoice(); delete win.webkitSpeechRecognition
  render(<App />); fireEvent.click(btn('Dictar'))
  expect(screen.getByLabelText('¿Qué has hecho hoy?')).toBeTruthy()
  expect(screen.getByText(/Este navegador no puede reconocer la voz/)).toBeTruthy()
})

test('U-C5 otro día: no guarda nada', async () => {
  ackVoice(); render(<App />)
  setVoz('ayer leí 20 páginas'); const before = JSON.stringify(Object.entries(localStorage))
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Por voz solo se apunta hoy. Para otro día, hazlo a mano.')).toBeTruthy()
  expect(JSON.stringify(Object.entries(localStorage))).toBe(before)
})

test('U-C8 Escribir a mano abre el formulario con lo oído', async () => {
  ackVoice(); render(<App />)
  setVoz('de la'); fireEvent.click(btn('Dictar'))
  await screen.findByText('No se ha entendido qué apuntar. Prueba otra vez o escríbelo a mano.')
  fireEvent.click(btn('Escribir a mano'))
  expect((screen.getByLabelText('¿Qué has hecho?') as HTMLInputElement).value).toBe('de la')
})

const net = (id: string) => stored().filter((e: { trackerId: string }) => e.trackerId === id).reduce((n: number, e: { amount: number }) => n + e.amount, 0)

test('U-C1 «+»: Reading con páginas, conversión y Deshacer deja el neto en 0', async () => {
  ackVoice(); setVoz('Read 50 pages of the name of the wind'); render(<App />)
  fireEvent.click(btn('Apuntar por voz'))
  expect(win.__lang).toBe('es-ES')
  expect(await screen.findByText(/^Registrado: Reading · \+100 min · \+100 HERO XP$/)).toBeTruthy()
  expect(screen.getByText('50 páginas ≈ 100 min')).toBeTruthy()
  expect(stored()).toHaveLength(1)
  expect(stored()[0]).toMatchObject({ trackerId: 'reading', amount: 100 })
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: +100 min en Reading.')).toBeTruthy()
  await vi.waitFor(() => expect(net('reading')).toBe(0))
})

test('U-C2 pestaña «Nuevo»: Burgers +1; Editar → 2 → Apuntar deja el neto en 2', async () => {
  ackVoice(); setVoz('ate a burguer'); render(<App />)
  go('Nuevo')
  expect(await screen.findByText('¿Apuntar en Burgers? +1 unidad. Aún no se ha apuntado nada.')).toBeTruthy()
  expect(net('burgers')).toBe(0)
  expect(document.activeElement).toBe(btn('Apuntar'))
  fireEvent.click(btn('Apuntar'))
  expect(await screen.findByText(/^Registrado: Burgers · \+1 unidad · \+20 VILLAIN XP$/)).toBeTruthy()
  await vi.waitFor(() => expect(net('burgers')).toBe(1)) // el guardado en localStorage va en un efecto: puede llegar tras el texto
  fireEvent.click(btn('Editar'))
  const q = screen.getByLabelText('Cantidad (unidades)') as HTMLInputElement
  expect(q.value).toBe('1'); expect(document.activeElement).toBe(q)
  expect(net('burgers')).toBe(0)
  fireEvent.change(q, { target: { value: '2' } })
  fireEvent.click(btn('Apuntar'))
  expect(await screen.findByText(/^Registrado: Burgers · \+2 unidades/)).toBeTruthy()
  await vi.waitFor(() => expect(net('burgers')).toBe(2))
})

test('U-C9 sin clave, «I ran out of milk» pide confirmar: Descartar no guarda y Escribir a mano abre el formulario', async () => {
  ackVoice(); setVoz('I ran out of milk'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText(/^¿Apuntar en Running\?/)).toBeTruthy()
  await vi.waitFor(() => expect(stored()).toHaveLength(0))
  fireEvent.click(btn('Descartar'))
  expect(screen.queryByText(/^¿Apuntar en Running\?/)).toBeNull()
  expect(stored()).toHaveLength(0)
  fireEvent.click(btn('Dictar'))
  await screen.findByText(/^¿Apuntar en Running\?/)
  fireEvent.click(btn('Escribir a mano'))
  expect((screen.getByLabelText('¿Qué has hecho?') as HTMLInputElement).value).toBe('I ran out of milk')
})

test('U-C10 con clave y la IA caída (500), la tarjeta lo dice y no se guarda nada', async () => {
  ackVoice(); setVoz('I ran out of milk'); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn().mockResolvedValue(new Response('{}', { status: 500 })); vi.stubGlobal('fetch', f)
  try {
    render(<App />)
    fireEvent.click(btn('Dictar'))
    expect(await screen.findByText(/^¿Apuntar en Running\?/)).toBeTruthy()
    expect(screen.getByText('La IA no ha respondido: interpretado en el dispositivo.')).toBeTruthy()
    expect(f).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(stored()).toHaveLength(0))
  } finally { vi.unstubAllGlobals() }
})

test('U-C6 unidad que no encaja: no guarda y pide la cantidad en la unidad del hábito', async () => {
  ackVoice(); setVoz('corrí 30 minutos'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Running se mide en km: no se ha apuntado nada.')).toBeTruthy()
  await vi.waitFor(() => expect(stored()).toHaveLength(0))
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Cantidad (km)')))
  fireEvent.change(screen.getByLabelText('Cantidad (km)'), { target: { value: '5' } })
  fireEvent.click(btn('Apuntar'))
  expect(await screen.findByText(/^Registrado: Running · \+5 km/)).toBeTruthy()
  await vi.waitFor(() => expect(net('running')).toBe(5))
})

const customTrackers = () => JSON.parse(localStorage.getItem(CU) ?? '{"trackers":[]}').trackers as { id: string; name: string; branch: string; type: string; unit: string; archived?: boolean }[]
const newReply = { kind: 'new', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'none', amount: 30, amountUnit: 'min', unitWord: 'min',
  name: 'Grounding', branch: 'hero', confidence: 'alta', type: 'duration', customUnit: '', reason: 'Bienestar mental' }

test('U-C3 sin clave, un hábito nuevo nunca se crea solo: propuesta editable', async () => {
  ackVoice(); setVoz('grounding 30 min'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByRole('heading', { name: 'Propuesta: HERO' })).toBeTruthy()
  expect(screen.getByText('Confianza baja')).toBeTruthy()
  expect(screen.queryByText(/Se crea sola/)).toBeNull()
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Grounding')
  expect((screen.getByLabelText('Cantidad (min)') as HTMLInputElement).value).toBe('30')
  fireEvent.click(within(screen.getByRole('group', { name: 'Rama' })).getByRole('button', { name: 'VILLAIN' }))
  expect(screen.getByRole('heading', { name: 'Propuesta: VILLAIN' })).toBeTruthy()
  fireEvent.click(btn('Crear y apuntar'))
  expect(await screen.findByText(/^Creada: Grounding \(VILLAIN\) · \+30 min\.$/)).toBeTruthy()
  await vi.waitFor(() => expect(customTrackers()).toHaveLength(1))
  expect(customTrackers()[0]).toMatchObject({ name: 'Grounding', branch: 'villain', type: 'duration' })
  expect(stored()).toHaveLength(1)
  expect(stored()[0]).toMatchObject({ trackerId: customTrackers()[0].id, amount: 30 })
  expect(screen.queryByText('¿A qué parties la propones?')).toBeNull()
})

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0) }) }
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
async function dictateNewWithKey() {
  ackVoice(); setVoz('grounding 30 min'); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(aiReply(newReply)))
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] }); vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0))
  render(<App />)
  fireEvent.click(btn('Dictar'))
  await settle()
}

test('U-C4 con clave y confianza alta, la propuesta se crea sola a los 10 s', async () => {
  try {
    await dictateNewWithKey()
    expect(screen.getByRole('heading', { name: 'Propuesta: HERO' })).toBeTruthy()
    expect(screen.getByText('Confianza alta')).toBeTruthy()
    expect(screen.getByText(/Se crea sola en/)).toBeTruthy()
    expect(screen.getByText('Se creará sola en 10 segundos. Toca la tarjeta para revisarla.')).toBeTruthy()
    for (let i = 0; i < 9; i++) await tick(1000)
    expect(customTrackers()).toHaveLength(0)
    await tick(1000)
    expect(customTrackers()).toHaveLength(1)
    expect(customTrackers()[0]).toMatchObject({ name: 'Grounding', branch: 'hero', type: 'duration' })
    expect(stored()[0]).toMatchObject({ amount: 30 })
  } finally { vi.unstubAllGlobals() }
})

test('U-C4b tocar la tarjeta cancela la cuenta atrás', async () => {
  try {
    await dictateNewWithKey()
    for (let i = 0; i < 3; i++) await tick(1000)
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Grounding diario' } })
    for (let i = 0; i < 12; i++) await tick(1000)
    expect(customTrackers()).toHaveLength(0)
    expect(screen.queryByText(/Se crea sola/)).toBeNull()
    expect(screen.getByText('Cuenta atrás parada. Revisa la propuesta.')).toBeTruthy()
    fireEvent.click(btn('Crear y apuntar'))
    expect(customTrackers()[0].name).toBe('Grounding diario')
  } finally { vi.unstubAllGlobals() }
})

test('U-C7 Deshacer un hábito recién creado lo archiva y anula el registro', async () => {
  ackVoice(); setVoz('grounding 30 min'); render(<App />)
  fireEvent.click(btn('Dictar'))
  await screen.findByRole('heading', { name: 'Propuesta: HERO' })
  fireEvent.click(btn('Crear y apuntar'))
  await screen.findByText(/^Creada: Grounding/)
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: Grounding archivada y registro anulado.')).toBeTruthy()
  const id = customTrackers()[0].id
  expect(customTrackers()[0].archived).toBe(true)
  expect(net(id)).toBe(0)
  go('Inicio')
  expect(screen.getByRole('heading', { name: 'Archivadas' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reactivar Grounding' })).toBeTruthy()
})

// ---- Memoria de la captura (ciclo 28) ----
const MEMO = 'life-rpg-capture-memo-v1'
const legPress = { kind: 'gym', otherDay: false, exerciseId: 'leg-press', weight: 100, weightUnit: 'none', reps: 10, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
  name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '' }
const memoEntries = () => (JSON.parse(localStorage.getItem(MEMO) ?? '{"entries":[]}') as { entries: { k: string }[] }).entries

test('U-M1 lo que Haiku resolvió se recuerda: la frase siguiente no llama a fetch', async () => {
  ackVoice(); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn().mockImplementation(() => Promise.resolve(aiReply(legPress)))
  vi.stubGlobal('fetch', f)
  try {
    render(<App />)
    dictateHome('la máquina de piernas 100 10')
    expect(await screen.findByText(/^Registrado: Prensa · 100 kg × 10/)).toBeTruthy()
    expect(memoEntries().map(e => e.k)).toEqual(['maquina piernas'])
    setVoz('máquina de piernas 120 8'); fireEvent.click(btn('Dictar'))
    expect(await screen.findByText(/^Registrado: Prensa · 120 kg × 8/)).toBeTruthy()
    expect(f).toHaveBeenCalledTimes(1)
  } finally { vi.unstubAllGlobals() }
})

test('U-M2 Deshacer olvida la frase y la siguiente vuelve a llamar a fetch', async () => {
  ackVoice(); localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  const f = vi.fn().mockImplementation(() => Promise.resolve(aiReply(legPress)))
  vi.stubGlobal('fetch', f)
  try {
    render(<App />)
    dictateHome('la máquina de piernas 100 10')
    await screen.findByText(/^Registrado: Prensa · 100 kg × 10/)
    fireEvent.click(btn('Deshacer'))
    await screen.findByText(/^Deshecho:/)
    expect(memoEntries()).toEqual([])
    setVoz('máquina de piernas 120 8'); fireEvent.click(btn('Dictar'))
    await screen.findByText(/^Registrado: Prensa/)
    expect(f).toHaveBeenCalledTimes(2)
  } finally { vi.unstubAllGlobals() }
})

test('U-M3 «Borrar todo» vacía la memoria y conserva la clave de IA; la copia no los lleva', () => {
  localStorage.setItem('life-rpg-ai-key-v1', KEY2)
  localStorage.setItem(MEMO, JSON.stringify({ v: 1, entries: [{ k: 'maquina piernas', kind: 'gym', id: 'leg-press' }] }))
  render(<App />)
  fireEvent.click(btn('Cargar ejemplo'))
  const confirm = vi.mocked(window.confirm).mockReturnValueOnce(false).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar todo'))
  expect(confirm).toHaveBeenCalled()
  expect(localStorage.getItem(MEMO)).toBeNull()
  expect(localStorage.getItem('life-rpg-ai-key-v1')).toBe(KEY2)
  const text = exportBackup([], { trackers: [], proposals: [] } as never, 'x')
  expect(text).not.toContain(KEY2); expect(text).not.toContain('maquina')
})

// --- Comida (ciclo 29) ---
const FD = 'life-rpg-food-v1'
const foodStored = () => JSON.parse(localStorage.getItem(FD) ?? '{"log":[]}')
const openFood = () => { go('Yo'); fireEvent.click(btn(/^Comida/)) }
const search = (q: string) => fireEvent.change(screen.getByLabelText('Buscar alimento'), { target: { value: q } })
const setGoal = (kcal = '2000') => { fireEvent.change(screen.getByLabelText(/^Calorías al día/), { target: { value: kcal } }); fireEvent.click(btn('Guardar objetivo')) }
const quick = (kcal: string) => {
  if (!screen.queryByLabelText(/^Calorías \(kcal\)/)) fireEvent.click(btn('Añadido rápido'))
  fireEvent.change(screen.getByLabelText(/^Calorías \(kcal\)/), { target: { value: kcal } })
  fireEvent.click(within(document.getElementById('food-quick')!).getByRole('button', { name: 'Añadir' }))
}
const diary = () => within(screen.getByRole('region', { name: 'Diario' }))
const dieta = () => screen.queryByRole('group', { name: 'Dieta' })

test('U-FD1 Yo → Comida → Volver devuelve el foco a la tarjeta Comida', () => {
  render(<App />); go('Yo')
  const nav = within(screen.getByRole('navigation', { name: 'Principal' }))
  fireEvent.click(btn(/^Comida/))
  expect(screen.getByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  expect(nav.getByRole('button', { name: 'Yo' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(btn('Volver'))
  expect(screen.getByRole('heading', { level: 1, name: 'Yo' })).toBeTruthy()
  expect(document.activeElement).toBe(btn(/^Comida/))
})

test('U-FD2 buscar «arroz», elegir y añadir 150 g: diario, estado y guardado', async () => {
  render(<App />); openFood()
  expect(screen.getByText('Aún no has apuntado alimentos.')).toBeTruthy()
  search('arroz')
  fireEvent.click(btn(/^Arroz blanco cocido/))
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '150' } })
  expect(screen.getByText('195 kcal · P 4,1 · C 42,3 · G 0,5')).toBeTruthy()
  fireEvent.click(btn('Añadir'))
  expect(screen.getByText('Añadido: Arroz blanco cocido 150 g (195 kcal)')).toBeTruthy()
  expect(diary().getByText('150 g')).toBeTruthy()
  expect(diary().getByText('195 kcal')).toBeTruthy()
  expect((screen.getByLabelText('Buscar alimento') as HTMLInputElement).value).toBe('')
  await vi.waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Buscar alimento')))
  await vi.waitFor(() => expect(foodStored().log).toMatchObject([{ name: 'Arroz blanco cocido', foodId: 'rice-white-cooked', base: 'g', qty: 150, kcal: 195 }]))
  // recientes con la última cantidad
  expect(btn(/^Arroz blanco cocido.*150 g$/)).toBeTruthy()
  fireEvent.click(btn(/^Arroz blanco cocido/))
  expect((screen.getByLabelText('Cantidad') as HTMLInputElement).value).toBe('150')
  fireEvent.click(btn('Cancelar'))
  search('zzzz')
  expect(screen.getByText('Sin resultados para «zzzz». Apunta las calorías con «Añadido rápido».')).toBeTruthy()
})

test('U-FD3 añadido rápido de 1000 kcal y Deshacer', async () => {
  render(<App />); openFood()
  expect(diary().getByText('Nada apuntado este día.')).toBeTruthy()
  quick('1000')
  expect(screen.getByText('Añadido: Añadido rápido (1.000 kcal)')).toBeTruthy()
  expect(screen.getByText('1.000 kcal', { selector: 'p' })).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().log).toMatchObject([{ name: 'Añadido rápido', kcal: 1000, qty: 0 }]))
  fireEvent.click(btn('Deshacer Añadido rápido 1.000 kcal'))
  expect(diary().getByText('Nada apuntado este día.')).toBeTruthy()
  expect(screen.getByText(/^Deshecho: Añadido rápido/)).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().log).toHaveLength(2))
})

test('U-FD4 objetivo 2000 + 1900 kcal → Dieta +1; pasarse o deshacer lo retira', async () => {
  render(<App />); openFood()
  expect(screen.getByText('Fija tu objetivo de calorías: los días dentro del 90–110 % cuentan en Dieta.')).toBeTruthy()
  setGoal()
  quick('1900')
  expect(screen.getByText('Añadido: Añadido rápido (1.900 kcal) · Día dentro del objetivo: +1 Dieta')).toBeTruthy()
  expect(screen.getByText('Dentro del objetivo: cuenta en Dieta')).toBeTruthy()
  await vi.waitFor(() => expect(stored()).toMatchObject([{ trackerId: 'dieta', amount: 1, id: 'dieta-auto-2026-10-07' }]))
  go('HERO')
  expect(card('Dieta').getByText(/\/ 5 días esta semana/).textContent).toMatch(/^1 \/ 5/)
  openFood()
  fireEvent.click(btn('Deshacer Añadido rápido 1.900 kcal'))
  expect(screen.getByText(/se retira el \+1 de Dieta/)).toBeTruthy()
  await vi.waitFor(() => expect(stored().map((e: { amount: number }) => e.amount)).toEqual([1, -1]))
  quick('1900'); quick('1000')
  expect(screen.getByText(/^Añadido: Añadido rápido \(1\.000 kcal\) · Fuera del rango: se retira el \+1 de Dieta$/)).toBeTruthy()
  expect(screen.getByText('Te has pasado 700 kcal del rango')).toBeTruthy()
  await vi.waitFor(() => expect(stored().map((e: { amount: number }) => e.amount)).toEqual([1, -1, 1, -1]))
  go('HERO')
  expect(card('Dieta').getByText(/\/ 5 días esta semana/).textContent).toMatch(/^0 \/ 5/)
})

test('U-FD5 fila «Hoy»: 1.900 / 2.000 kcal abre Comida y Volver deja el foco en «Hoy»', () => {
  render(<App />)
  expect(screen.queryByRole('button', { name: /^Comida/ })).toBeNull()
  openFood(); setGoal(); quick('1900')
  go('Inicio')
  fireEvent.click(btn(/^Comida.*1\.900 \/ 2\.000 kcal$/))
  expect(screen.getByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  fireEvent.click(btn('Volver'))
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Hoy' }))
  openFood()
  fireEvent.click(btn('Volver'))
  expect(screen.getByRole('heading', { level: 1, name: 'Yo' })).toBeTruthy()
})

test('U-FD6 día pasado con el selector', async () => {
  render(<App />); openFood()
  fireEvent.click(btn('Ayer'))
  quick('500')
  await vi.waitFor(() => expect(foodStored().log[0].occurredAt.startsWith('2026-10-06')).toBe(true))
  expect(screen.getByText('500 kcal', { selector: 'p' })).toBeTruthy()
  fireEvent.click(btn('Hoy'))
  expect(screen.getByText('0 kcal', { selector: 'p' })).toBeTruthy()
  expect(diary().getByText('Nada apuntado este día.')).toBeTruthy()
})

test('U-FD7 importar con comida y copia antigua sin comida: texto de la confirmación', async () => {
  const entry = { id: 'f1', occurredAt: '2026-10-07T10:00:00', name: 'Pizza', kcal: 800, qty: 0 }
  localStorage.setItem(FD, JSON.stringify({ log: [entry, { ...entry, id: 'f2' }], foods: [] }))
  const { container } = render(<App />)
  const cu = { trackers: [], proposals: [] }
  vi.mocked(window.confirm).mockReturnValueOnce(false)
  importFile(container, exportBackup([], cu, 'x', undefined, { log: [{ ...entry, id: 'g1' }], foods: [] }))
  await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1))
  expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('Comida: 2 → 1 entradas.')
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  importFile(container, exportBackup([], cu, 'x'))
  await vi.waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(2))
  expect(vi.mocked(window.confirm).mock.calls[1][0]).toContain('Esta copia es anterior al módulo Comida: tus 2 entradas de comida también se reemplazan (quedan 0).')
  await vi.waitFor(() => expect(foodStored().log).toEqual([]))
})

test('U-FD8 Dieta oculta sin objetivo ni eventos; aparece al fijar el objetivo', () => {
  render(<App />); go('HERO')
  expect(dieta()).toBeNull()
  go('Inicio')
  expect(screen.queryByText('Dieta')).toBeNull()
  openFood(); setGoal()
  go('HERO')
  expect(dieta()).toBeTruthy()
  go('Inicio')
  expect(screen.getByRole('button', { name: /^Dieta 5 días/ })).toBeTruthy()
})

// --- Comida (ciclo 30) ---
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const fieldv = (k: string, v: string) => fireEvent.change(document.getElementById('food-c-' + k)!, { target: { value: v } })
const createFood = (name: string, kcal = '300') => {
  fireEvent.click(btn('Crear alimento'))
  type('Nombre', name); type(/^Calorías \(kcal\)/, kcal); fieldv('p', '10'); fieldv('c', '40'); fieldv('f', '5')
}

test('U-FD9 alimentos propios: crear, buscar primero, archivar y reactivar; nombre único', async () => {
  render(<App />); openFood()
  createFood('Arroz', '300')
  fireEvent.click(btn('Guardar'))
  expect(screen.getByText('Alimento creado: Arroz')).toBeTruthy()
  fireEvent.click(btn('Añadir'))
  expect(diary().getByText('Arroz')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().foods).toMatchObject([{ name: 'Arroz', base: 'g', kcal: 300, p: 10, c: 40, f: 5 }]))
  expect(foodStored().foods[0].id).toMatch(/^food-/)
  search('arroz')
  const names = screen.getAllByRole('button', { name: /kcal\/100/ }).map(b => b.textContent)
  expect(names[0]).toMatch(/^Arroz300/) // el propio antes que el catálogo
  fireEvent.click(btn('Archivar Arroz'))
  expect(screen.getByText('Archivado: Arroz')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Arroz300/ })).toBeNull()
  await vi.waitFor(() => expect(foodStored().foods[0].archived).toBe(true))
  // crear con el mismo nombre → «Reactivar»; con el del catálogo → no se permite
  createFood('arroz'); expect(screen.getByText('Ya existe, archivado.')).toBeTruthy()
  fireEvent.click(btn('Guardar'))
  expect(screen.getByRole('alert').textContent).toMatch(/Reactivar/)
  type('Nombre', 'Plátano'); expect(screen.getByText('Ya existe en el catálogo.')).toBeTruthy()
  type('Nombre', 'arroz'); fireEvent.click(btn('Reactivar'))
  expect(screen.getByText('Reactivado: Arroz')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().foods[0].archived).toBeUndefined())
  fireEvent.click(btn('Cancelar'))
  // los macros no pueden sumar más de 100
  createFood('Raro'); fieldv('f', '60'); fireEvent.click(btn('Guardar'))
  expect(screen.getByText('Los macros suman más de 100 g por 100 g.')).toBeTruthy()
})

test('U-FD10 platos: guardar, añadir de un toque, deshacer todo, borrar', async () => {
  render(<App />); openFood()
  search('arroz'); fireEvent.click(btn(/^Arroz blanco cocido/)); fireEvent.click(btn('Añadir'))
  search('huevo'); fireEvent.click(btn(/^Huevo/)); fireEvent.click(btn('Añadir'))
  quick('100')
  fireEvent.click(btn('Guardar como plato'))
  const group = within(screen.getByRole('group', { name: 'Alimentos del día' }))
  expect(group.getAllByRole('checkbox')).toHaveLength(2) // el añadido rápido no entra
  expect(group.getAllByRole('checkbox').every(c => !(c as HTMLInputElement).checked)).toBe(true)
  fireEvent.click(btn('Guardar'))
  expect(screen.getByText('Marca al menos un alimento.')).toBeTruthy()
  fireEvent.click(group.getByLabelText(/^Arroz blanco cocido/)); fireEvent.click(group.getByLabelText(/^Huevo/))
  type('Nombre del plato', 'Comida típica'); fireEvent.click(btn('Guardar'))
  expect(screen.getByText('Plato guardado: Comida típica')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().meals).toMatchObject([{ name: 'Comida típica', items: [{ foodId: 'rice-white-cooked' }, { foodId: 'egg' }] }]))
  fireEvent.click(btn('Añadir plato Comida típica'))
  expect(screen.getByText(/^Añadido: Comida típica \(2 alimentos\)/)).toBeTruthy()
  expect(diary().getAllByRole('button', { name: /^Deshacer/ })).toHaveLength(5)
  await vi.waitFor(() => expect(foodStored().log.filter((e: { via?: string }) => e.via === 'meal')).toHaveLength(2))
  fireEvent.click(within(screen.getByRole('region', { name: 'Platos' })).getByRole('button', { name: 'Deshacer' }))
  expect(screen.getByText(/^Deshecho: 2 entradas del plato/)).toBeTruthy()
  expect(diary().getAllByRole('button', { name: /^Deshacer/ })).toHaveLength(3)
  fireEvent.click(btn('Borrar plato Comida típica'))
  expect(screen.queryByText('Plato borrado: Comida típica')).toBeNull() // confirm cancelado
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar plato Comida típica'))
  expect(screen.getByText('Plato borrado: Comida típica')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().meals).toBeUndefined())
})

test('U-FD11 plato con alimentos que ya no existen y máximo de 20 platos', () => {
  const meal = (i: number, items = [{ foodId: 'egg', qty: 50 }]) => ({ id: `meal-${i}`, name: `Plato ${i}`, items })
  localStorage.setItem(FD, JSON.stringify({ log: [], foods: [], meals: [meal(0, [{ foodId: 'egg', qty: 50 }, { foodId: 'ya-no-existe', qty: 10 }]), ...Array.from({ length: 19 }, (_, i) => meal(i + 1))] }))
  render(<App />); openFood()
  fireEvent.click(btn('Añadir plato Plato 0'))
  expect(screen.getByText(/1 alimento del plato ya no existe y no se ha añadido/)).toBeTruthy()
  expect(diary().getAllByRole('button', { name: /^Deshacer/ })).toHaveLength(1)
  expect((btn('Guardar como plato') as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText('Máximo 20 platos: borra alguno para guardar otro.')).toBeTruthy()
})

test('U-FD12 resumen semanal: media sobre días con registros y lista equivalente al gráfico', () => {
  const e = (id: string, day: string, kcal: number) => ({ id, occurredAt: `${day}T10:00:00`, name: 'Pizza', kcal, qty: 0 })
  localStorage.setItem(FD, JSON.stringify({ log: [e('a', '2026-10-05', 1900), e('b', '2026-10-06', 2100), e('c', '2026-09-29', 3000)], foods: [], goals: [{ from: '2026-09-01', kcal: 2000, p: 20, c: 50, f: 30 }] }))
  render(<App />); openFood()
  const week = within(screen.getByRole('region', { name: 'Semana' }))
  expect(week.getByText('2.000 / 2.000 kcal/día')).toBeTruthy() // 2 días con registros, no 7
  expect(week.getByText('2 días · 2 en rango')).toBeTruthy()
  const items = week.getAllByRole('listitem').map(li => li.textContent)
  expect(items).toHaveLength(8)
  expect(items[7]).toMatch(/\(en curso\): media 2\.000 kcal en 2 días · objetivo 2\.000 · 2 en rango$/)
  expect(items[6]).toMatch(/: media 3\.000 kcal en 1 día · objetivo 2\.000 · 0 en rango$/)
  expect(items[0]).toMatch(/: sin registros$/)
})

// --- Comida: Open Food Facts (ciclo 32). Ningún test llama a la red: fetch siempre simulado. ---
const PK = 'life-rpg-food-privacy-v1', EAN = '8480000118837'
const ack = () => localStorage.setItem(PK, JSON.stringify({ off: '2026-10-07T10:00:00.000Z' }))
const offJson = (product: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(product), { status, headers: { 'content-type': 'application/json' } }))
const yogur = { status: 1, product: { product_name_es: 'Yogur natural', brands: 'Hacendado, Mercadona', nutriments: { 'energy-kcal_100g': 61.4, proteins_100g: 3.46, carbohydrates_100g: 4.7, fat_100g: 3.3 }, serving_quantity: 125, quantity: '4 x 125 g' } }
const stubFetch = (impl: () => Promise<Response>) => { const f = vi.fn(impl); vi.stubGlobal('fetch', f); return f }
const openBarcode = () => { openFood(); fireEvent.click(btn('Código de barras')) }
const searchEan = (v = EAN) => { fireEvent.change(screen.getByRole('textbox', { name: 'Código de barras' }), { target: { value: v } }); fireEvent.click(btn('Buscar')) }
const own = (o: Record<string, unknown>) => ({ id: 'food-1', name: 'Mi yogur', base: 'g', kcal: 60, p: 3, c: 5, f: 3, ref: EAN, source: 'off', ...o })
afterEach(() => { vi.unstubAllGlobals() })

test('U-FI1 aviso de OFF la primera vez, persistido; la segunda va directo', () => {
  const f = stubFetch(() => offJson(yogur))
  render(<App />); openBarcode()
  expect(screen.getByRole('heading', { name: 'Privacidad del código de barras' })).toBeTruthy()
  expect(screen.getByText(/licencia ODbL/)).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Privacidad del código de barras' }))
  fireEvent.click(btn('Entendido'))
  expect(screen.getByRole('textbox', { name: 'Código de barras' })).toBeTruthy()
  expect(JSON.parse(localStorage.getItem(PK)!).off).toMatch(/^\d{4}-/)
  fireEvent.click(btn('Cancelar'))
  fireEvent.click(btn('Código de barras'))
  expect(screen.queryByRole('heading', { name: 'Privacidad del código de barras' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Código de barras' })).toBeTruthy()
  expect(f).not.toHaveBeenCalled()
})

test('U-FI2 EAN no válido: error y sin fetch', () => {
  ack(); const f = stubFetch(() => offJson(yogur))
  render(<App />); openBarcode()
  searchEan('8480000118838')
  expect(screen.getByRole('alert').textContent).toBe('Revisa el código: son 8 o 13 cifras.')
  expect(f).not.toHaveBeenCalled()
})

test('U-FI3 encontrado: revisión prerrellenada con atribución, guardar, cantidad y añadir', async () => {
  ack(); const f = stubFetch(() => offJson(yogur))
  render(<App />); openBarcode(); searchEan()
  expect(await screen.findByRole('heading', { name: 'Revisar alimento' })).toBeTruthy()
  expect((f.mock.calls[0] as unknown as [string])[0]).toContain(`/product/${EAN}.json`)
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Yogur natural (Hacendado)')
  expect((screen.getByLabelText(/^Calorías \(kcal\)/) as HTMLInputElement).value).toBe('61')
  expect((document.getElementById('food-c-p') as HTMLInputElement).value).toBe('3,5')
  const link = screen.getByRole('link', { name: /Open Food Facts/ })
  expect(link.getAttribute('href')).toBe(`https://world.openfoodfacts.org/product/${EAN}`)
  expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  fireEvent.click(btn('Guardar'))
  expect(screen.getByRole('heading', { name: 'Yogur natural (Hacendado)' })).toBeTruthy()
  expect(screen.getByRole('link', { name: /Open Food Facts/ })).toBeTruthy()
  fireEvent.click(btn('Añadir'))
  expect(diary().getByText('Yogur natural (Hacendado)')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().foods).toMatchObject([{ name: 'Yogur natural (Hacendado)', source: 'off', ref: EAN, kcal: 61, servings: [{ name: 'Ración', qty: 125 }] }]))
  expect(foodStored().log).toHaveLength(1)
})

test('U-FI4 EAN ya propio: sin fetch; archivado, «Reactivar»', async () => {
  ack(); const f = stubFetch(() => offJson(yogur))
  localStorage.setItem(FD, JSON.stringify({ log: [], foods: [own({})] }))
  render(<App />); openBarcode(); searchEan()
  expect(screen.getByText('Ya lo tienes: Mi yogur')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Mi yogur' })).toBeTruthy()
  expect(f).not.toHaveBeenCalled()
  cleanup()
  localStorage.setItem(FD, JSON.stringify({ log: [], foods: [own({ archived: true })] }))
  render(<App />); openBarcode(); searchEan()
  expect(screen.getByText('Ya lo tienes, archivado')).toBeTruthy()
  fireEvent.click(btn('Reactivar'))
  expect(screen.getByRole('heading', { name: 'Mi yogur' })).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().foods[0].archived).toBeUndefined())
  expect(f).not.toHaveBeenCalled()
})

test('U-FI5 no encontrado, 503 y sin conexión: alternativas; «Crear a mano» guarda el ref', async () => {
  ack(); let status = 404
  const f = stubFetch(() => offJson(status === 404 ? { status: 0 } : {}, status))
  render(<App />); openBarcode(); searchEan()
  expect((await screen.findByRole('alert')).textContent).toBe('Open Food Facts no tiene este código.')
  expect(screen.getByText('Con una clave de Anthropic en Ajustes puedes leer la etiqueta con una foto.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  status = 503; fireEvent.click(btn('Buscar'))
  await screen.findByText('Open Food Facts ha respondido algo inesperado.')
  expect(btn('Reintentar')).toBeTruthy()
  expect(f).toHaveBeenCalledTimes(2)
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  fireEvent.click(btn('Buscar'))
  expect(screen.getByText('Sin conexión. Puedes crearlo a mano')).toBeTruthy()
  expect(f).toHaveBeenCalledTimes(2)
  fireEvent.click(btn('Crear a mano'))
  expect(screen.getByRole('heading', { name: 'Crear alimento' })).toBeTruthy()
  type('Nombre', 'Mi yogur'); type(/^Calorías \(kcal\)/, '60'); fieldv('p', '3'); fieldv('c', '5'); fieldv('f', '3')
  fireEvent.click(btn('Guardar'))
  await vi.waitFor(() => expect(foodStored().foods).toMatchObject([{ name: 'Mi yogur', ref: EAN }]))
  expect(foodStored().foods[0].source).toBeUndefined()
  online.mockRestore()
})

test('U-FI6 ficha incompleta: campos vacíos marcados y mensaje', async () => {
  ack(); stubFetch(() => offJson({ status: 1, product: { product_name: 'Raro', nutriments: { 'energy-kcal_100g': 100 } } }))
  render(<App />); openBarcode(); searchEan()
  expect(await screen.findByText(/no tiene todos los valores/)).toBeTruthy()
  expect((screen.getByLabelText(/^Calorías \(kcal\)/) as HTMLInputElement).getAttribute('aria-invalid')).toBeNull()
  for (const k of ['p', 'c', 'f']) {
    const el = document.getElementById('food-c-' + k) as HTMLInputElement
    expect(el.value).toBe(''); expect(el.getAttribute('aria-invalid')).toBe('true')
  }
})

// --- Comida: foto de la etiqueta (ciclo 33). Haiku siempre simulado: ningún test llama a Anthropic. ---
const LAB = { readable: true, name: 'Galletas', ean: '', per: '100g', servingQty: null, servingUnit: 'none', kcal: 450, kj: null, p: 6, c: 70, f: 16 }
const claude = (o: unknown) => Promise.resolve(new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }] }), { status: 200 }))
const ackLabel = () => localStorage.setItem(PK, JSON.stringify({ off: 'x', label: 'x' }))
const withKey = () => localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
const photo = () => fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'e.jpg', { type: 'image/jpeg' })] } })
const openLabel = () => { openFood(); fireEvent.click(btn('Foto de la etiqueta')) }
const goodImage = () => vi.mocked(downscale).mockResolvedValue({ data: 'QUJD', mediaType: 'image/jpeg' })

test('U-FI7 sin clave no hay «Foto de la etiqueta»; con clave, aviso y después el selector', () => {
  render(<App />); openFood()
  expect(screen.queryByRole('button', { name: 'Foto de la etiqueta' })).toBeNull()
  cleanup(); withKey()
  const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
  render(<App />); openLabel()
  expect(screen.getByRole('heading', { name: 'Privacidad de la foto' })).toBeTruthy()
  expect(screen.getByText(/envía la foto, reducida y sin datos de ubicación, a Anthropic/)).toBeTruthy()
  const inp = document.querySelector('input[type=file]')!
  expect([inp.getAttribute('accept'), inp.getAttribute('capture'), inp.getAttribute('tabindex'), inp.getAttribute('aria-hidden')]).toEqual(['image/*', 'environment', '-1', 'true'])
  expect(click).not.toHaveBeenCalled()
  fireEvent.click(btn('Entendido'))
  expect(click).toHaveBeenCalledTimes(1)
  expect(JSON.parse(localStorage.getItem(PK)!).label).toMatch(/^\d{4}-/)
})

test('U-FI8 foto leída: revisión con aviso de coherencia; guardar crea source label', async () => {
  ackLabel(); withKey(); goodImage()
  const f = stubFetch(() => claude({ ...LAB, kcal: 100 }))
  render(<App />); openLabel(); photo()
  expect(await screen.findByRole('heading', { name: 'Revisar alimento' })).toBeTruthy()
  expect(screen.getByText('Las kcal no cuadran con los macros. Revisa la etiqueta.')).toBeTruthy()
  expect(screen.queryByRole('link', { name: /Open Food Facts/ })).toBeNull()
  expect(f).toHaveBeenCalledTimes(1)
  const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe('https://api.anthropic.com/v1/messages')
  expect(JSON.parse(init.body as string).messages[0].content[0].source.data).toBe('QUJD')
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Galletas')
  fireEvent.click(btn('Guardar'))
  await vi.waitFor(() => expect(foodStored().foods).toMatchObject([{ name: 'Galletas', source: 'label', kcal: 100 }]))
})

test('U-FI9 401, ilegible, foto inválida y sin conexión: mensajes y «Crear a mano»', async () => {
  ackLabel(); withKey(); goodImage()
  let reply: () => Promise<Response> = () => Promise.resolve(new Response('{}', { status: 401 }))
  const f = stubFetch(() => reply())
  render(<App />); openLabel(); photo()
  expect((await screen.findByRole('alert')).textContent).toBe('Anthropic rechaza la clave. Comprueba que la has copiado entera.')
  reply = () => claude({ ...LAB, readable: false }); photo()
  await screen.findByText('No se lee la tabla nutricional. Haz la foto más cerca y con luz.')
  vi.mocked(downscale).mockResolvedValueOnce(null); photo()
  await screen.findByText('No se ha podido abrir la foto. Prueba con otra.')
  expect(f).toHaveBeenCalledTimes(2)
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  photo()
  expect(await screen.findByText('Sin conexión. Puedes crearlo a mano')).toBeTruthy()
  expect(f).toHaveBeenCalledTimes(2)
  online.mockRestore()
  fireEvent.click(btn('Crear a mano'))
  expect(screen.getByRole('heading', { name: 'Crear alimento' })).toBeTruthy()
})

// --- Comida: escáner con cámara (ciclo 35). Cámara y detector simulados; sin red ni wasm. ---
const nativeDetector = (codes: string[]) => vi.stubGlobal('BarcodeDetector', class { static getSupportedFormats = () => Promise.resolve(['ean_13']); detect = () => Promise.resolve(codes.map(rawValue => ({ rawValue }))) })
const track = () => ({ stop: vi.fn() })
const streamOf = (t: { stop: () => void }) => Object.assign(new MediaStream(), { getTracks: () => [t] })
const camera = (gum: () => Promise<unknown>) => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(gum) } })
afterEach(() => { Reflect.deleteProperty(navigator, 'mediaDevices') })

test('U-FI10 sin mediaDevices no hay botón de cámara; con él, sí', () => {
  ack(); render(<App />); openBarcode()
  expect(screen.queryByRole('button', { name: 'Escanear con la cámara' })).toBeNull()
  cleanup()
  camera(() => new Promise(() => undefined))
  render(<App />); openBarcode()
  expect(btn('Escanear con la cámara')).toBeTruthy()
})

test('U-FI11 permiso denegado: mensaje y foco en el campo; otro error: sin cámara', async () => {
  ack(); nativeDetector([]); render(<App />)
  camera(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' })))
  openBarcode(); fireEvent.click(btn('Escanear con la cámara'))
  expect((await screen.findByRole('alert')).textContent).toBe('Sin permiso para la cámara. Teclea el código.')
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Código de barras' }))
  camera(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotFoundError' })))
  fireEvent.click(btn('Escanear con la cámara'))
  await screen.findByText('No hay cámara disponible. Teclea el código.')
})

test('U-FI12 BarcodeDetector nativo detecta un EAN: se paran las pistas y se busca', async () => {
  ack(); const f = stubFetch(() => offJson(yogur))
  const t = track()
  nativeDetector(['1234', EAN])
  camera(() => Promise.resolve(streamOf(t)))
  render(<App />); openBarcode(); fireEvent.click(btn('Escanear con la cámara'))
  expect(screen.getByLabelText('Vista de la cámara')).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Revisar alimento' })).toBeTruthy()
  expect(t.stop).toHaveBeenCalled()
  expect(f).toHaveBeenCalledTimes(1)
  expect(String(f.mock.calls[0])).toContain(EAN)
})

test('U-FI13 «Exportar copia» no contiene el aviso de OFF', () => {
  ack(); render(<App />)
  expect(exportBackup([], { trackers: [], proposals: [] } as never, 'x')).not.toContain(PK)
})

// --- Comida por voz (ciclo 36). Sin clave ni fetch: todo en el dispositivo; voz simulada. ---
const foodLive = () => { const l = foodStored().log as { id: string; undoes?: string; via?: string; name: string; kcal: number }[]; const u = new Set(l.filter(e => e.undoes).map(e => e.undoes)); return l.filter(e => !e.undoes && !u.has(e.id)) }

test('U-FV1 «200 g de arroz y una manzana»: 2 entradas por voz; Deshacer las anula las dos', async () => {
  ackVoice(); setVoz('200 g de arroz y una manzana'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Registrado en Comida: 2 alimentos · 354 kcal')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive().map(e => [e.name, e.via])).toEqual([['Arroz blanco cocido', 'voice'], ['Manzana', 'voice']]))
  expect(screen.getByText('Arroz blanco cocido · 200 g · 260 kcal')).toBeTruthy()
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: 2 alimentos (354 kcal).')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(0))
  expect((foodStored().log as { undoes?: string }[]).filter(e => e.undoes)).toHaveLength(2)
  await vi.waitFor(() => expect(document.activeElement).toBe(btn('Dictar')))
})

test('U-FV2 con objetivo, la frase pone el día en rango: nota de Dieta y Deshacer la retira', async () => {
  localStorage.setItem(FD, JSON.stringify({ log: [], foods: [], goals: [{ from: '2026-10-01', kcal: 2000, p: 30, c: 40, f: 30 }] }))
  ackVoice(); setVoz('1900 kcal'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Registrado en Comida: 1 alimento · 1.900 kcal · Día dentro del objetivo: +1 Dieta')).toBeTruthy()
  await vi.waitFor(() => expect(net('dieta')).toBe(1))
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: 1 alimento (1.900 kcal). · Fuera del rango: se retira el +1 de Dieta')).toBeTruthy()
  await vi.waitFor(() => expect(net('dieta')).toBe(0))
})

test('U-FV4 «comí una hamburguesa»: Burgers +1 y el botón «Apuntar también en Comida»', async () => {
  ackVoice(); setVoz('comí una hamburguesa'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText(/^Registrado: Burgers · \+1 unidad/)).toBeTruthy()
  await vi.waitFor(() => expect(net('burgers')).toBe(1)) // el guardado en localStorage va en un efecto: puede llegar tras el texto
  expect(btn('Apuntar también en Comida')).toBeTruthy()
  expect(foodLive()).toHaveLength(0)
})

test('U-FV3 «arroz» sin cantidad: abre Comida con el panel de cantidad y no guarda nada', async () => {
  ackVoice(); setVoz('arroz'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: 'Por voz: pendiente' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 3, name: 'Arroz blanco cocido' })).toBeTruthy()
  expect(foodLive()).toHaveLength(0)
  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '150' } })
  fireEvent.click(btn('Añadir'))
  expect(foodLive().map(e => [e.name, e.kcal])).toEqual([['Arroz blanco cocido', 195]])
  expect(screen.queryByRole('heading', { level: 2, name: 'Por voz: pendiente' })).toBeNull()
})

test('U-FV4b «Apuntar también en Comida» abre Comida con la hamburguesa pendiente', async () => {
  ackVoice(); setVoz('comí una hamburguesa'); render(<App />)
  fireEvent.click(btn('Dictar'))
  await screen.findByText(/^Registrado: Burgers/)
  fireEvent.click(btn('Apuntar también en Comida'))
  expect(await screen.findByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 3, name: 'Hamburguesa de ternera cocinada' })).toBeTruthy()
  await vi.waitFor(() => expect(net('burgers')).toBe(1)) // el guardado en localStorage va en un efecto: puede llegar tras el texto
  expect(foodLive()).toHaveLength(0)
})

test('U-FV5 «Editar» deshace las entradas y las deja pendientes en Comida', async () => {
  ackVoice(); setVoz('200 g de arroz y dos huevos'); render(<App />)
  fireEvent.click(btn('Dictar'))
  await screen.findByText('Registrado en Comida: 2 alimentos · 403 kcal')
  fireEvent.click(btn('Editar'))
  expect(await screen.findByRole('heading', { level: 2, name: 'Por voz: pendiente' })).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(0))
  expect(screen.getAllByRole('button', { name: /^Revisar / })).toHaveLength(2)
  fireEvent.click(screen.getAllByRole('button', { name: /^Quitar / })[0])
  expect(screen.getAllByRole('button', { name: /^Revisar / })).toHaveLength(1)
})

test('U-FV6 «papa 100 g» es ambiguo: abre el buscador con «papa»', async () => {
  ackVoice(); setVoz('papa 100 g'); render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  expect((screen.getByLabelText('Buscar alimento') as HTMLInputElement).value).toBe('papa')
  expect(screen.getByText('Patata cocida')).toBeTruthy()
  expect(screen.getByText('«papa»: hay varios alimentos')).toBeTruthy()
  expect(foodLive()).toHaveLength(0)
})

// --- «Dictar» en Comida (ciclo 37) ---
test('U-FV7 «Dictar comida» con el selector en «Ayer»: entrada de ayer y Deshacer la anula', async () => {
  ackVoice(); setVoz('200 g de arroz y una manzana'); render(<App />); openFood()
  fireEvent.click(btn('Ayer'))
  fireEvent.click(btn('Dictar comida'))
  expect(await screen.findByText('Registrado en Comida: 2 alimentos · 354 kcal (ayer).')).toBeTruthy()
  // El guardado va en un efecto: se espera a localStorage en vez de leerlo justo tras el texto (fallaba ~1 de cada 6).
  await vi.waitFor(() => expect(foodLive().map(e => [e.name, e.via])).toEqual([['Arroz blanco cocido', 'voice'], ['Manzana', 'voice']]))
  expect((foodStored().log as { occurredAt: string }[]).every(e => e.occurredAt.startsWith('2026-10-06'))).toBe(true)
  expect(screen.getByText('354 kcal', { selector: 'p' })).toBeTruthy()
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: 2 alimentos (354 kcal).')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(0))
})

test('U-FV8 frase con otro día en Comida: mensaje y nada guardado', async () => {
  ackVoice(); setVoz('ayer comí 200 g de arroz'); render(<App />); openFood()
  fireEvent.click(btn('Dictar comida'))
  expect(await screen.findByText('Para otro día, cámbialo en el selector y dicta sin decir el día.')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(0))
})

test('U-FV7b «Dictar comida» con un alimento sin cantidad: pasa a «Por voz: pendiente» sin guardar', async () => {
  ackVoice(); setVoz('arroz y 150 g de pollo'); render(<App />); openFood()
  fireEvent.click(btn('Dictar comida'))
  expect(await screen.findByText(/^Registrado en Comida: 1 alimento ·/)).toBeTruthy()
  fireEvent.click(btn('Completar en Comida'))
  expect(await screen.findByRole('heading', { level: 2, name: 'Por voz: pendiente' })).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(1))
})

// --- Comida por voz con Haiku y memoria (ciclo 38). La API se simula: nunca se llama a la real. ---
const capFood = (foods: unknown[]) => aiReply({ kind: 'food', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
  name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '', foods })
const calamares = { name: 'bocadillo de calamares', amount: 1, unit: 'serving', servingWord: 'bocadillo', base: 'g', kcal100: 260, p100: 10, c100: 30, f100: 10, typicalQty: 200 }

test('U-FV9 con clave, «un bocadillo de calamares»: chip «Estimación» y nada guardado hasta «Apuntar»', async () => {
  ackVoice(); withKey(); setVoz('un bocadillo de calamares')
  const f = stubFetch(() => Promise.resolve(capFood([calamares])))
  render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Estimación', { selector: 'span' })).toBeTruthy()
  expect(screen.getByText('Bocadillo de calamares · 1 Ración (200 g) · 520 kcal')).toBeTruthy()
  expect(screen.getByText('Revisa la propuesta: no se ha apuntado nada.')).toBeTruthy()
  expect(foodLive()).toHaveLength(0); expect(f).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: /^Apuntar Bocadillo de calamares/ }))
  expect(await screen.findByText('Registrado en Comida: 1 alimento · 520 kcal')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive().map(e => [e.name, e.via, e.kcal])).toEqual([['Bocadillo de calamares (200 g)', 'voice', 520]]))
  expect((foodStored().foods as unknown[]).length).toBe(0) // sin la casilla, no se crea un propio (A4)
})

test('U-FV10 «Guardar también como alimento propio»: propio con source estimate y Deshacer lo archiva', async () => {
  ackVoice(); withKey(); setVoz('un bocadillo de calamares')
  stubFetch(() => Promise.resolve(capFood([calamares])))
  render(<App />)
  fireEvent.click(btn('Dictar'))
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Guardar también como alimento propio' }))
  fireEvent.click(screen.getByRole('button', { name: /^Apuntar Bocadillo de calamares/ }))
  expect(await screen.findByText('Registrado en Comida: 1 alimento · 520 kcal')).toBeTruthy()
  const own = foodStored().foods as { id: string; source: string; archived?: boolean }[]
  expect(own).toHaveLength(1); expect(own[0].source).toBe('estimate'); expect(own[0].id.startsWith('food-')).toBe(true)
  expect(foodLive().map(e => [e.name, e.via])).toEqual([['Bocadillo de calamares', 'voice']])
  fireEvent.click(btn('Deshacer'))
  expect(await screen.findByText('Deshecho: 1 alimento (520 kcal).')).toBeTruthy()
  await vi.waitFor(() => expect(foodLive()).toHaveLength(0))
  expect((foodStored().foods as { archived?: boolean }[])[0].archived).toBe(true)
})

test('U-FV11 memoria: la segunda frase igual se resuelve sin llamar a Haiku', async () => {
  ackVoice(); withKey(); setVoz('el arroz de siempre 200 g')
  const arroz = { ...calamares, name: 'arroz blanco', amount: 200, unit: 'g', servingWord: '', typicalQty: null, kcal100: 130, p100: 3, c100: 28, f100: 0 }
  const f = stubFetch(() => Promise.resolve(capFood([arroz])))
  render(<App />)
  fireEvent.click(btn('Dictar'))
  expect(await screen.findByText('Registrado en Comida: 1 alimento · 260 kcal')).toBeTruthy()
  expect(f).toHaveBeenCalledTimes(1)
  fireEvent.click(btn('Cerrar'))
  fireEvent.click(btn('Dictar'))
  await vi.waitFor(() => expect(foodLive()).toHaveLength(2))
  expect(f).toHaveBeenCalledTimes(1)
})

test('U-FV12 «Editar» una estimación abre Comida en «Revisar alimento» con la marca «Estimación»', async () => {
  ackVoice(); withKey(); setVoz('un bocadillo de calamares')
  stubFetch(() => Promise.resolve(capFood([calamares])))
  render(<App />)
  fireEvent.click(btn('Dictar'))
  await screen.findByText('Estimación', { selector: 'span' })
  fireEvent.click(btn('Editar'))
  expect(await screen.findByRole('heading', { name: 'Revisar alimento' })).toBeTruthy()
  expect(screen.getByText('Estimación', { selector: 'span' })).toBeTruthy()
  expect((screen.getByLabelText('Nombre') as HTMLInputElement).value).toBe('Bocadillo de calamares')
  expect(foodLive()).toHaveLength(0)
})

test('U-FV13 doble clic en «Apuntar» de «Dictar comida» guarda una sola vez (también el +1 de Dieta)', async () => {
  localStorage.setItem(FD, JSON.stringify({ log: [], foods: [], goals: [{ from: '2026-10-01', kcal: 800, p: 30, c: 40, f: 30 }] }))
  ackVoice(); withKey(); setVoz('un bocadillo de calamares')
  stubFetch(() => Promise.resolve(capFood([{ ...calamares, kcal100: 400 }])))
  render(<App />); openFood()
  fireEvent.click(btn('Dictar comida'))
  const ap = await screen.findByRole('button', { name: /^Apuntar Bocadillo de calamares/ })
  act(() => { ap.click(); ap.click() }) // los dos en el mismo lote: ambos ven el mismo `done`
  await screen.findByText(/^Registrado en Comida: 1 alimento · 800 kcal/)
  await vi.waitFor(() => expect(foodLive()).toHaveLength(1))
  await vi.waitFor(() => expect(net('dieta')).toBe(1))
})

// --- Copiar día anterior (ciclo 39) ---
const yEntry = (id: string, kcal: number, day = '2026-10-06') => ({ id, occurredAt: `${day}T10:00:00`, name: `Plato ${id}`, kcal, qty: 0 })
const liveFood = () => { const l = foodStored().log as { id: string; undoes?: string; via?: string; occurredAt: string }[]; const u = new Set(l.map(e => e.undoes)); return l.filter(e => !e.undoes && !u.has(e.id)) }
const copyBtn = () => screen.getByRole('button', { name: 'Copiar día anterior' }) as HTMLButtonElement

test('U-C39-1 copiar día anterior: 2 entradas con via copy, botón desactivado con su motivo', async () => {
  localStorage.setItem(FD, JSON.stringify({ log: [yEntry('a', 300), yEntry('b', 500)], foods: [] }))
  render(<App />); openFood()
  expect(screen.getByText('Añade lo de ayer: 2 alimentos · 800 kcal')).toBeTruthy()
  fireEvent.click(copyBtn())
  expect(screen.getByText('Copiado: 2 alimentos · 800 kcal')).toBeTruthy()
  expect(copyBtn().disabled).toBe(true)
  expect(screen.getByText('Ya has copiado el día anterior aquí. Deshaz las copias para volver a copiar.')).toBeTruthy()
  fireEvent.click(copyBtn())
  await vi.waitFor(() => expect(liveFood().filter(e => e.occurredAt.startsWith('2026-10-07') && e.via === 'copy')).toHaveLength(2))
  expect(liveFood()).toHaveLength(4)
  expect(screen.getByText('800 kcal', { selector: 'p' })).toBeTruthy()
})

test('U-C39-2 Deshacer retira las copias de un golpe, reactiva el botón y quita el +1 de Dieta', async () => {
  localStorage.setItem(FD, JSON.stringify({ log: [yEntry('a', 1000), yEntry('b', 900)], foods: [], goals: [{ from: '2026-10-01', kcal: 2000, p: 20, c: 50, f: 30 }] }))
  render(<App />); openFood()
  fireEvent.click(copyBtn())
  expect(screen.getByText('Copiado: 2 alimentos · 1.900 kcal · Día dentro del objetivo: +1 Dieta')).toBeTruthy()
  await vi.waitFor(() => expect(stored()).toMatchObject([{ trackerId: 'dieta', amount: 1 }]))
  fireEvent.click(btn('Deshacer'))
  expect(screen.getByText(/^Deshecho: 2 entradas copiadas · Fuera del rango: se retira el \+1 de Dieta$/)).toBeTruthy()
  expect(copyBtn().disabled).toBe(false)
  await vi.waitFor(() => expect(liveFood()).toHaveLength(2))
  await vi.waitFor(() => expect(stored().map((e: { amount: number }) => e.amount)).toEqual([1, -1]))
  expect(document.activeElement).toBe(copyBtn())
})

test('U-C39-3 sin entradas ayer: botón desactivado; con el selector en ayer copia desde anteayer', async () => {
  localStorage.setItem(FD, JSON.stringify({ log: [yEntry('a', 400, '2026-10-05')], foods: [] }))
  render(<App />); openFood()
  expect(copyBtn().disabled).toBe(true)
  expect(screen.getByText('Nada apuntado el día anterior.')).toBeTruthy()
  fireEvent.click(btn('Ayer'))
  expect(copyBtn().disabled).toBe(false)
  fireEvent.click(copyBtn())
  expect(screen.getByText('Copiado: 1 alimento · 400 kcal')).toBeTruthy()
  await vi.waitFor(() => expect(liveFood().filter(e => e.via === 'copy').map(e => e.occurredAt.slice(0, 10))).toEqual(['2026-10-06']))
})

// --- Platos (ciclo 39) ---
const saveMealAs = (name: string) => {
  fireEvent.click(btn('Guardar como plato'))
  fireEvent.click(within(screen.getByRole('group', { name: 'Alimentos del día' })).getByLabelText(/^Arroz blanco cocido/))
  type('Nombre del plato', name); fireEvent.click(btn('Guardar'))
}

test('U-ML1 un plato con el nombre de otro plato da error y no se guarda', async () => {
  render(<App />); openFood()
  search('arroz'); fireEvent.click(btn(/^Arroz blanco cocido/)); fireEvent.click(btn('Añadir'))
  saveMealAs('Comida típica')
  expect(screen.getByText('Plato guardado: Comida típica')).toBeTruthy()
  saveMealAs(' comida TÍPICA ')
  expect(screen.getByText('Ya tienes un plato con ese nombre.')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().meals).toHaveLength(1))
})

test('U-ML2 «Borrar» plato pide confirmación', async () => {
  render(<App />); openFood()
  search('arroz'); fireEvent.click(btn(/^Arroz blanco cocido/)); fireEvent.click(btn('Añadir'))
  saveMealAs('Comida típica')
  fireEvent.click(btn('Borrar plato Comida típica'))
  expect(window.confirm).toHaveBeenCalledWith('¿Borrar el plato «Comida típica»? Lo que ya has apuntado no cambia.')
  expect(screen.queryByText('Plato borrado: Comida típica')).toBeNull()
  vi.mocked(window.confirm).mockReturnValueOnce(true)
  fireEvent.click(btn('Borrar plato Comida típica'))
  expect(screen.getByText('Plato borrado: Comida típica')).toBeTruthy()
  await vi.waitFor(() => expect(foodStored().meals).toBeUndefined())
})

test('U-ML3 añadir un plato que ya no existe avisa', () => {
  const food = { log: [], foods: [], meals: [{ id: 'meal-1', name: 'Cena', items: [{ foodId: 'egg', qty: 100 }] }] }
  render(<FoodMeals food={food} day="2026-10-07" onSave={() => true} onDelete={() => {}} onAdd={() => ({ ids: [], missing: 0, diet: 0, gone: true })} onUndo={() => ({ undone: 0, diet: 0 })} />)
  fireEvent.click(btn('Añadir plato Cena'))
  expect(screen.getByText('Ese plato ya no existe.')).toBeTruthy()
})

// --- Espacio usado (ciclo 40) ---
test('U-S1 «Tus datos» muestra el espacio usado y no avisa con el ejemplo', () => {
  render(<App />)
  fireEvent.click(btn('Cargar ejemplo'))
  expect(screen.getByText(/^Espacio usado: aprox\. .+ de ~5 MB/)).toBeTruthy()
  expect(screen.queryByText(/casi lleno/)).toBeNull()
})

test('U-S2 aviso del 70 % con una copia dañada de 3,6 M', () => {
  localStorage.setItem('life-rpg-food-v1.backup.20261008T123456', 'x'.repeat(3_600_000))
  render(<App />)
  const w = screen.getByText(/está casi lleno \(aprox\. 72 %\)/)
  expect(w.textContent).toContain('Incluye 1 copia de datos dañados')
  expect(btn('Exportar copia')).toBeTruthy()
})
