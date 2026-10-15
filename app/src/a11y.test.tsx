// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import App from './App'
import { unlockStorage } from './core/storage'
import { liveText } from './components/liveText'
import { downscale } from './image'

vi.mock('./image', () => ({ downscale: vi.fn() }))
vi.setConfig({ testTimeout: 20000 })

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
test('A5 Nuevo: captura con el aviso de privacidad', async () => { render(<App />); go('Nuevo'); expect(screen.getByRole('heading', { name: 'Privacidad de la voz' })).toBeTruthy(); expect(await serious()).toEqual([]) })
test('A-C1 Nuevo a mano', async () => { render(<App />); go('Nuevo'); fireEvent.click(screen.getByRole('button', { name: 'Escribir a mano' })); expect(await serious()).toEqual([]) })
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

test('A11Y-1 Ajustes con el resultado de Probar voz y el textarea de respaldo', async () => {
  class Fake {
    lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
    onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
    start() { setTimeout(() => { this.onresult?.({ results: [Object.assign([{ transcript: 'press banca 80 kg 5 reps' }], { isFinal: true })] }); this.onend?.() }, 0) }
    stop() {}; abort() {}
  }
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = Fake
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: 'x' }))
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('x')) }, configurable: true })
  try {
    render(<App />); go('Yo')
    fireEvent.click(screen.getByRole('button', { name: 'Probar voz' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Copiar resumen' }))
    expect(await screen.findByLabelText('Resumen de la prueba de voz')).toBeTruthy()
    expect(await serious()).toEqual([])
  } finally { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition; delete (navigator as unknown as Record<string, unknown>).clipboard }
})

test('A12b Yo con la clave guardada', async () => {
  localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
  render(<App />); go('Yo')
  expect(screen.getByText('Clave guardada: termina en 0000')).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A11 Gym con el aviso de privacidad de la voz y con la tarjeta del resultado', async () => {
  class Fake {
    lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
    onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
    start() { setTimeout(() => { this.onresult?.({ results: [Object.assign([{ transcript: 'press banca 80 kg 5 reps' }], { isFinal: true })] }); this.onend?.() }, 0) }
    stop() {}; abort() {}
  }
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = Fake
  try {
    render(<App />); go('Yo'); fireEvent.click(screen.getByRole('button', { name: /^Gym/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Dictar serie' }))
    expect(screen.getByRole('heading', { name: 'Privacidad de la voz' })).toBeTruthy()
    expect(await serious()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
    expect(await screen.findByText(/^Registrado:/)).toBeTruthy()
    expect(await serious()).toEqual([])
  } finally { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition }
})

test('A13 captura con el campo de texto abierto', async () => {
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictar' })) // sin API de voz: abre el campo de texto
  expect(screen.getByLabelText('¿Qué has hecho hoy?')).toBeTruthy()
  expect(await serious()).toEqual([])
})

async function capture(said: string) {
  class Fake {
    lang = ''; continuous = false; interimResults = false; maxAlternatives = 1
    onresult: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
    start() { setTimeout(() => { this.onresult?.({ results: [Object.assign([{ transcript: said }], { isFinal: true })] }); this.onend?.() }, 0) }
    stop() {}; abort() {}
  }
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
  ;(window as unknown as Record<string, unknown>).webkitSpeechRecognition = Fake
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictar' }))
}
const noSpeech = () => { delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition }

test('A-C2 propuesta de hábito nuevo en HERO y en VILLAIN', async () => {
  try {
    await capture('grounding 30 min')
    expect(await screen.findByRole('heading', { name: 'Propuesta: HERO' })).toBeTruthy()
    expect(await serious()).toEqual([])
    fireEvent.click(within(screen.getByRole('group', { name: 'Rama' })).getByRole('button', { name: 'VILLAIN' }))
    expect(screen.getByRole('heading', { name: 'Propuesta: VILLAIN' })).toBeTruthy()
    expect(await serious()).toEqual([])
  } finally { noSpeech() }
})

test('A-C3 resultado de un hábito existente', async () => {
  try {
    await capture('ate a burguer')
    expect(await screen.findByText(/^Registrado: Burgers/)).toBeTruthy()
    expect(await serious()).toEqual([])
  } finally { noSpeech() }
})

const openFood = () => { go('Yo'); fireEvent.click(screen.getByRole('button', { name: /^Comida/ })) }

test('A-FD1 Comida vacía (formulario del objetivo)', async () => {
  render(<App />); openFood()
  expect(screen.getByRole('heading', { level: 1, name: 'Comida' })).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FD2 Comida con objetivo, entradas y estado del rango', async () => {
  render(<App />); openFood()
  fireEvent.change(screen.getByLabelText(/^Calorías al día/), { target: { value: '2000' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar objetivo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Añadido rápido' }))
  fireEvent.change(screen.getByLabelText(/^Calorías \(kcal\)/), { target: { value: '1900' } })
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
  fireEvent.change(screen.getByLabelText('Buscar alimento'), { target: { value: 'huevo' } })
  fireEvent.click(screen.getByRole('button', { name: /^Huevo/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Añadir' }))
  expect(screen.getByRole('region', { name: 'Diario' })).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FD3 Comida con resultados de búsqueda y el panel de cantidad', async () => {
  render(<App />); openFood()
  fireEvent.change(screen.getByLabelText('Buscar alimento'), { target: { value: 'a' } })
  expect(screen.getAllByRole('button', { name: /kcal\/100/ }).length).toBeGreaterThan(1)
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getAllByRole('button', { name: /kcal\/100/ })[0])
  expect(screen.getByLabelText('Cantidad')).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FD4 Comida: crear alimento, plato guardado y resumen semanal', async () => {
  const e = (id: string, day: string, kcal: number) => ({ id, occurredAt: `${day}T10:00:00`, name: 'Huevo', kcal, qty: 100, foodId: 'egg', base: 'g' })
  localStorage.setItem('life-rpg-food-v1', JSON.stringify({ log: [e('a', '2026-10-07', 1900), e('b', '2026-10-05', 2100)], foods: [], goals: [{ from: '2026-09-01', kcal: 2000, p: 20, c: 50, f: 30 }], meals: [{ id: 'meal-1', name: 'Desayuno', items: [{ foodId: 'egg', qty: 100 }] }] }))
  render(<App />); openFood()
  expect(screen.getByRole('region', { name: 'Semana' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Platos' })).toBeTruthy()
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Guardar como plato' }))
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  fireEvent.click(screen.getByRole('button', { name: 'Crear alimento' }))
  fireEvent.click(screen.getByRole('button', { name: 'Añadir ración' }))
  expect(await serious()).toEqual([])
})

// --- Comida: Open Food Facts (ciclo 32) ---
const offReply = (o: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(o), { status: 200 })))
const openBarcode = () => { openFood(); fireEvent.click(screen.getByRole('button', { name: 'Código de barras' })) }

test('A-FI1 código de barras: aviso y campo', async () => {
  vi.stubGlobal('fetch', offReply({}))
  render(<App />); openBarcode()
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Entendido' }))
  expect(await serious()).toEqual([])
  vi.unstubAllGlobals()
})

test('A-FI2 revisión con atribución y aviso de coherencia', async () => {
  localStorage.setItem('life-rpg-food-privacy-v1', JSON.stringify({ off: 'x' }))
  vi.stubGlobal('fetch', offReply({ status: 1, product: { product_name: 'Raro', nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 10, fat_100g: 5 } } }))
  render(<App />); openBarcode()
  fireEvent.change(screen.getByRole('textbox', { name: 'Código de barras' }), { target: { value: '8480000118837' } })
  fireEvent.click(screen.getByRole('button', { name: 'Buscar' }))
  expect(await screen.findByText('Las kcal no cuadran con los macros. Revisa la etiqueta.')).toBeTruthy()
  expect(screen.getByRole('link', { name: /Open Food Facts/ })).toBeTruthy()
  expect(await serious()).toEqual([])
  vi.unstubAllGlobals()
})

test('A-FI3 error de etiqueta', async () => {
  localStorage.setItem('life-rpg-food-privacy-v1', JSON.stringify({ off: 'x', label: 'x' }))
  localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
  vi.mocked(downscale).mockResolvedValue(null)
  render(<App />); openFood(); fireEvent.click(screen.getByRole('button', { name: 'Foto de la etiqueta' }))
  expect(await serious()).toEqual([])
  fireEvent.change(document.querySelector('input[type=file]')!, { target: { files: [new File(['x'], 'e.jpg', { type: 'image/jpeg' })] } })
  expect(await screen.findByText('No se ha podido abrir la foto. Prueba con otra.')).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FI4 escáner abierto (vídeo simulado)', async () => {
  localStorage.setItem('life-rpg-food-privacy-v1', JSON.stringify({ off: 'x' }))
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.resolve(Object.assign(new MediaStream(), { getTracks: () => [{ stop: vi.fn() }] })) } })
  vi.stubGlobal('BarcodeDetector', class { static getSupportedFormats = () => Promise.resolve(['ean_13']); detect = () => Promise.resolve([]) })
  render(<App />); openBarcode()
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Escanear con la cámara' }))
  await screen.findByText('Apunta al código de barras')
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getAllByRole('button', { name: 'Cancelar' })[0])
  Reflect.deleteProperty(navigator, 'mediaDevices'); vi.unstubAllGlobals()
})

// Comida por voz (ciclo 36): sin API de voz, la frase se escribe en el campo de la captura
const typeCapture = async (text: string) => {
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Dictar' }))
  fireEvent.change(screen.getByLabelText('¿Qué has hecho hoy?'), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Apuntar' }))
}

test('A-FV1 captura: tarjeta de comida con apuntados, pendientes y sin reconocer', async () => {
  await typeCapture('200 g de arroz, café con leche y papa 100 g')
  expect(await screen.findByText(/^Registrado en Comida: 2 alimentos/)).toBeTruthy()
  expect(screen.getByText('«papa»: hay varios alimentos')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Completar en Comida' })).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FV2 Comida con pendientes por voz', async () => {
  await typeCapture('arroz y pan')
  fireEvent.click(await screen.findByRole('button', { name: 'Completar en Comida' }))
  expect(await screen.findByRole('heading', { level: 2, name: 'Por voz: pendiente' })).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FV3 Comida con «Por voz» y una frase guardada', async () => {
  localStorage.setItem('life-rpg-voice-v1', JSON.stringify({ privacyAck: '2026-10-07T10:00:00.000Z' }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Yo' }))
  fireEvent.click(screen.getByRole('button', { name: /^Comida/ }))
  expect(await serious()).toEqual([])
  fireEvent.click(screen.getByRole('button', { name: 'Escribir' }))
  fireEvent.change(screen.getByLabelText('Comida'), { target: { value: '200 g de arroz y papa 100 g' } })
  fireEvent.click(screen.getByRole('button', { name: 'Apuntar' }))
  expect(await screen.findByText(/^Registrado en Comida: 1 alimento/)).toBeTruthy()
  expect(await serious()).toEqual([])
})

test('A-FV4 captura: fila «Estimación» con casilla y «Apuntar» (Haiku simulado)', async () => {
  localStorage.setItem('life-rpg-ai-key-v1', 'sk-ant-test-0000000000000000')
  const food = { name: 'bocadillo de calamares', amount: 1, unit: 'serving', servingWord: 'bocadillo', base: 'g', kcal100: 260, p100: 10, c100: 30, f100: 10, typicalQty: 200 }
  const reply = { kind: 'food', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
    name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '', foods: [food] }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(reply) }] }), { status: 200 })))
  await typeCapture('un bocadillo de calamares')
  expect(await screen.findByText('Estimación', { selector: 'span' })).toBeTruthy()
  expect(screen.getByRole('checkbox', { name: 'Guardar también como alimento propio' })).toBeTruthy()
  expect(await serious()).toEqual([])
  vi.unstubAllGlobals()
})
