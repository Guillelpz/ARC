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

test('A7 VILLAIN con límite superado', async () => {
  localStorage.setItem('life-rpg-custom-v1', JSON.stringify({ trackers: [], proposals: [], limits: { beer: 1 } }))
  render(<App />); example(); go('VILLAIN')
  expect(screen.getByText(/Te has pasado de tu límite semanal/)).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A8 Yo', async () => { render(<App />); go('Yo'); expect(await serious()).toEqual([]) })

test('A9 Gym con series y récords', async () => {
  render(<App />); go('Yo'); fireEvent.click(screen.getByRole('button', { name: /^Gym/ }))
  for (const w of ['100', '105']) {
    fireEvent.change(screen.getByLabelText(/^Peso \(/), { target: { value: w } })
    fireEvent.change(screen.getByLabelText('Repeticiones'), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar serie' }))
  }
  expect(screen.getByText(/Peso máximo/)).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A10 Gym con rutina cargada, progreso y volumen; Inicio con la fila Gym', async () => {
  render(<App />); go('Yo'); fireEvent.click(screen.getByRole('button', { name: /^Gym/ }))
  fireEvent.change(screen.getByLabelText(/^Peso \(/), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('Repeticiones'), { target: { value: '5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Registrar serie' }))
  fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Push day' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar rutina' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cargar rutina Push day' }))
  expect(screen.getByRole('region', { name: 'Progreso · Press banca' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Volumen semanal' })).toBeTruthy()
  expect(await serious()).toEqual([])
  go('Inicio')
  expect(screen.getByRole('button', { name: /^Gym.*1 serie · 1 ejercicio$/ })).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A12 Yo con Ajustes y el diagnóstico de voz', async () => {
  render(<App />); go('Yo')
  expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Probar voz' }))
  expect(await serious()).toEqual([])
})

test('A12b Yo con la clave guardada', async () => {
  localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
  render(<App />); go('Yo')
  expect(screen.getByText('Clave guardada: termina en 0000')).toBeTruthy()
  expect(await serious()).toEqual([])
})
